/* Historial de devoluciones: sirve para medir por qué se cae una creación. */
const db = require("../db/connection");

function registrar(clienteId, motivo) {
  db.prepare("INSERT INTO devoluciones (cliente_id, fecha, motivo) VALUES (?, ?, ?)")
    .run(clienteId, new Date().toISOString(), motivo);
}

function deCliente(clienteId) {
  return db.prepare("SELECT fecha, motivo FROM devoluciones WHERE cliente_id = ? ORDER BY id DESC").all(clienteId);
}

function todas() {
  return db.prepare("SELECT cliente_id AS clienteId, fecha, motivo FROM devoluciones ORDER BY id DESC").all();
}

function porMotivo() {
  return db.prepare(`
    SELECT motivo, COUNT(*) AS veces
    FROM devoluciones GROUP BY motivo ORDER BY veces DESC, motivo
  `).all();
}

function borrarDe(clienteId) {
  db.prepare("DELETE FROM devoluciones WHERE cliente_id = ?").run(clienteId);
}

module.exports = { registrar, deCliente, todas, porMotivo, borrarDe };
