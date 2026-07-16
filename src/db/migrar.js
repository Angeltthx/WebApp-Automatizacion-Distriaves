/* Migración: crea las tablas si no existen y siembra los datos iniciales. */
const crypto = require("crypto");
const db = require("./connection");

const SEMILLA = [
  ["Carlos Julio Avella", "Activo"],
  ["Carlos Raul Peñaloza", "Activo"],
  ["Christian Fabian Garcia Luna", "Activo"],
  ["Cristian Otalora", "Activo"],
  ["Gloria Edith Gutierrez", "Activo"],
  ["Guillermo Prada Gonzalez", "Activo"],
  ["Isnael Camacho Calvo", "Activo"],
  ["Jairo Jose Mackenzie Noya", "Activo"],
  ["Juan Carlos Mejia Polo", "Activo"],
  ["Juan David Cubillos Sarmiento", "Pendiente"],
  ["Leidy Diana Lozano", "Pendiente"],
  ["Luis Lorenzo Peña", "Activo"],
  ["Maria Elvia Rojas", "Activo"],
  ["Maricela Sanchez Zuñiga", "Activo"],
  ["Martha Isabel Rosas Gavilan", "Pendiente"],
  ["Mauricio Lara", "Activo"],
  ["Nidia Yurany Prieto Franco Cortez", "Activo"],
  ["Yenny Carolina Rico Avila", "Activo"],
];

function migrar() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL CHECK (estado IN ('Activo','Pendiente')),
      fecha_envio TEXT,
      fecha_activacion TEXT,
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS actividad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      texto TEXT NOT NULL,
      fecha TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
  `);

  const { n } = db.prepare("SELECT COUNT(*) AS n FROM clientes").get();
  if (n === 0) {
    const ahora = new Date().toISOString();
    const insertar = db.prepare(`
      INSERT INTO clientes (id, nombre, tipo, estado, fecha_envio, fecha_activacion, creado_en, actualizado_en)
      VALUES (?, ?, '', ?, NULL, NULL, ?, ?)
    `);
    for (const [nombre, estado] of SEMILLA) {
      insertar.run(crypto.randomUUID(), nombre, estado, ahora, ahora);
    }
  }
}

module.exports = { migrar };
