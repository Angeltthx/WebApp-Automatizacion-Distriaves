/* Capa de repositorio: historial de movimientos. */
const db = require("../db/connection");

function registrar(tipo, texto) {
  db.prepare("INSERT INTO actividad (tipo, texto, fecha) VALUES (?, ?, ?)")
    .run(tipo, texto, new Date().toISOString());
  // conservar solo los últimos 100 movimientos
  db.exec(`DELETE FROM actividad WHERE id NOT IN
    (SELECT id FROM actividad ORDER BY id DESC LIMIT 100)`);
}

function ultimos(limite = 30) {
  return db.prepare("SELECT tipo, texto, fecha FROM actividad ORDER BY id DESC LIMIT ?")
    .all(limite);
}

module.exports = { registrar, ultimos };
