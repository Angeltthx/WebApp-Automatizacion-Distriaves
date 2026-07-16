/* Capa de datos: conexión única a SQLite (módulo nativo de Node). */
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const RUTA_BD = process.env.DATABASE_PATH ||
  path.join(__dirname, "..", "..", "data", "distriaves.db");

fs.mkdirSync(path.dirname(RUTA_BD), { recursive: true });

const db = new DatabaseSync(RUTA_BD);
db.exec("PRAGMA journal_mode = WAL;");

module.exports = db;
