/* Capa de repositorio: único lugar que habla SQL con la tabla clientes.
   Si mañana cambian SQLite por Postgres, solo se reescribe este archivo. */
const crypto = require("crypto");
const db = require("../db/connection");

const aModelo = (fila) => fila && {
  id: fila.id,
  nombre: fila.nombre,
  tipo: fila.tipo,
  estado: fila.estado,
  fechaEnvio: fila.fecha_envio,
  fechaActivacion: fila.fecha_activacion,
  intentos: fila.intentos,
  creadoEn: fila.creado_en,
  actualizadoEn: fila.actualizado_en,
};

function listar() {
  return db.prepare("SELECT * FROM clientes ORDER BY nombre COLLATE NOCASE").all().map(aModelo);
}

function porId(id) {
  return aModelo(db.prepare("SELECT * FROM clientes WHERE id = ?").get(id));
}

/* Búsqueda tolerante para no duplicar al mismo cliente al reenviar. */
function porNombre(nombre) {
  const fila = db.prepare("SELECT * FROM clientes WHERE lower(trim(nombre)) = lower(trim(?))").get(nombre);
  return aModelo(fila);
}

function crear({ nombre, tipo, estado, fechaEnvio, fechaActivacion, intentos }) {
  const id = crypto.randomUUID();
  const ahora = new Date().toISOString();
  db.prepare(`
    INSERT INTO clientes (id, nombre, tipo, estado, fecha_envio, fecha_activacion, intentos, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nombre, tipo, estado, fechaEnvio, fechaActivacion, intentos == null ? 1 : intentos, ahora, ahora);
  return porId(id);
}

function actualizar(id, { nombre, tipo, estado, fechaEnvio, fechaActivacion, intentos }) {
  const actual = db.prepare("SELECT intentos FROM clientes WHERE id = ?").get(id);
  db.prepare(`
    UPDATE clientes
    SET nombre = ?, tipo = ?, estado = ?, fecha_envio = ?, fecha_activacion = ?, intentos = ?, actualizado_en = ?
    WHERE id = ?
  `).run(nombre, tipo, estado, fechaEnvio, fechaActivacion,
    intentos == null ? (actual ? actual.intentos : 1) : intentos,
    new Date().toISOString(), id);
  return porId(id);
}

function eliminar(id) {
  db.prepare("DELETE FROM devoluciones WHERE cliente_id = ?").run(id);
  return db.prepare("DELETE FROM clientes WHERE id = ?").run(id).changes > 0;
}

function reemplazarTodos(clientes) {
  const ahora = new Date().toISOString();
  const insertar = db.prepare(`
    INSERT INTO clientes (id, nombre, tipo, estado, fecha_envio, fecha_activacion, intentos, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM clientes");
    for (const c of clientes) {
      insertar.run(
        c.id || crypto.randomUUID(), c.nombre, c.tipo || "", c.estado,
        c.fechaEnvio || null, c.fechaActivacion || null, c.intentos || 1,
        c.creadoEn || ahora, ahora
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

module.exports = { listar, porId, porNombre, crear, actualizar, eliminar, reemplazarTodos };
