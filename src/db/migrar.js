/* Migración del esquema. Se ejecuta en cada arranque y es idempotente.
   Respeta los datos que ya existan: nunca borra clientes. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("./connection");

const ESTADOS = ["Pendiente", "Activo", "Devuelto"];

function columnas(tabla) {
  try {
    return db.prepare("PRAGMA table_info(" + tabla + ")").all().map(function (c) { return c.name; });
  } catch (e) {
    return [];
  }
}

function definicion(tabla) {
  const fila = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(tabla);
  return fila ? fila.sql : null;
}

/* La tabla original solo aceptaba 'Activo' y 'Pendiente'. Para admitir
   'Devuelto' hay que rehacerla: SQLite no permite alterar un CHECK. */
function ampliarEstados() {
  const sql = definicion("clientes");
  if (!sql || sql.indexOf("Devuelto") >= 0) return false;

  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE clientes_nueva (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT '',
        estado TEXT NOT NULL CHECK (estado IN ('Activo','Pendiente','Devuelto')),
        fecha_envio TEXT,
        fecha_activacion TEXT,
        intentos INTEGER NOT NULL DEFAULT 1,
        creado_en TEXT NOT NULL,
        actualizado_en TEXT NOT NULL
      );
      INSERT INTO clientes_nueva (id, nombre, tipo, estado, fecha_envio, fecha_activacion, intentos, creado_en, actualizado_en)
        SELECT id, nombre, tipo, estado, fecha_envio, fecha_activacion, 1, creado_en, actualizado_en FROM clientes;
      DROP TABLE clientes;
      ALTER TABLE clientes_nueva RENAME TO clientes;
    `);
    db.exec("COMMIT");
    return true;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function migrar() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL CHECK (estado IN ('Activo','Pendiente','Devuelto')),
      fecha_envio TEXT,
      fecha_activacion TEXT,
      intentos INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS actividad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      texto TEXT NOT NULL,
      fecha TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS devoluciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      motivo TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      usuario TEXT NOT NULL UNIQUE,
      hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      creado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sesiones (
      token TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      expira TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
    CREATE INDEX IF NOT EXISTS idx_devoluciones_cliente ON devoluciones(cliente_id);
  `);

  ampliarEstados();

  if (columnas("clientes").indexOf("intentos") < 0) {
    db.exec("ALTER TABLE clientes ADD COLUMN intentos INTEGER NOT NULL DEFAULT 1");
  }

  db.prepare("DELETE FROM sesiones WHERE expira < ?").run(new Date().toISOString());
}

/* Primer arranque: crea el usuario. Si no hay credenciales en el entorno,
   inventa una contraseña y la imprime una sola vez en la consola. */
function asegurarUsuario() {
  const fila = db.prepare("SELECT COUNT(*) AS n FROM usuarios").get();
  if (fila.n > 0) return null;

  const usuario = process.env.ADMIN_USER || "olga";
  const clave = process.env.ADMIN_PASS || crypto.randomBytes(9).toString("base64url");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(clave, salt, 64).toString("hex");

  db.prepare("INSERT INTO usuarios (id, usuario, hash, salt, creado_en) VALUES (?, ?, ?, ?, ?)")
    .run(crypto.randomUUID(), usuario, hash, salt, new Date().toISOString());

  return { usuario: usuario, clave: process.env.ADMIN_PASS ? null : clave };
}

/* Carga los clientes que ya existían antes de la herramienta.

   Corre una sola vez, marcada en la tabla meta. No exige que la base
   esté vacía: agrega los que falten y respeta los que ya estén, para
   que funcione aunque hayas alcanzado a crear alguno probando. Y como
   queda la marca, no resucita los que borres después. */
function sembrarClientes() {
  const hecha = db.prepare("SELECT valor FROM meta WHERE clave = 'siembra'").get();
  if (hecha) return 0;

  const ruta = path.join(__dirname, "clientes-iniciales.json");
  if (!fs.existsSync(ruta)) return 0;

  let lista;
  try {
    lista = JSON.parse(fs.readFileSync(ruta, "utf8")).clientes;
  } catch (e) {
    console.warn("  No pude leer clientes-iniciales.json:", e.message);
    return 0;
  }
  if (!Array.isArray(lista) || !lista.length) return 0;

  const existe = db.prepare("SELECT 1 FROM clientes WHERE lower(trim(nombre)) = lower(trim(?))");
  const insertar = db.prepare(`
    INSERT INTO clientes (id, nombre, tipo, estado, fecha_envio, fecha_activacion, intentos, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ahora = new Date().toISOString();
  const hoy = ahora.slice(0, 10);
  let agregados = 0;

  db.exec("BEGIN");
  try {
    for (const c of lista) {
      if (!c || !c.nombre) continue;
      const nombre = String(c.nombre).trim();
      if (existe.get(nombre)) continue;
      const estado = ESTADOS.includes(c.estado) ? c.estado : "Activo";
      insertar.run(crypto.randomUUID(), nombre, String(c.tipo || "").trim(), estado,
        c.fechaEnvio || null, estado === "Activo" ? (c.fechaActivacion || hoy) : null,
        1, ahora, ahora);
      agregados++;
    }
    db.prepare("INSERT INTO meta (clave, valor) VALUES ('siembra', ?)").run(ahora);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  if (agregados) {
    db.prepare("INSERT INTO actividad (tipo, texto, fecha) VALUES (?, ?, ?)")
      .run("ok", "Cargados " + agregados + " clientes ya creados", ahora);
  }
  return agregados;
}

module.exports = { migrar, asegurarUsuario, sembrarClientes, ESTADOS };
