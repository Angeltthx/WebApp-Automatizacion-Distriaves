/* Repositorio de usuarios y sesiones. Único lugar con SQL de acceso. */
const crypto = require("crypto");
const db = require("../db/connection");

const DIAS_SESION = 30;

function porUsuario(usuario) {
  return db.prepare("SELECT * FROM usuarios WHERE usuario = ?").get(usuario) || null;
}

function porId(id) {
  return db.prepare("SELECT id, usuario FROM usuarios WHERE id = ?").get(id) || null;
}

function cambiarClave(id, hash, salt) {
  db.prepare("UPDATE usuarios SET hash = ?, salt = ? WHERE id = ?").run(hash, salt, id);
}

function crearSesion(usuarioId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + DIAS_SESION * 86400000).toISOString();
  db.prepare("INSERT INTO sesiones (token, usuario_id, expira) VALUES (?, ?, ?)").run(token, usuarioId, expira);
  return { token: token, expira: expira };
}

function sesion(token) {
  if (!token) return null;
  const fila = db.prepare("SELECT * FROM sesiones WHERE token = ?").get(token);
  if (!fila) return null;
  if (fila.expira < new Date().toISOString()) {
    borrarSesion(token);
    return null;
  }
  return fila;
}

function borrarSesion(token) {
  db.prepare("DELETE FROM sesiones WHERE token = ?").run(token);
}

function borrarSesionesDe(usuarioId) {
  db.prepare("DELETE FROM sesiones WHERE usuario_id = ?").run(usuarioId);
}

module.exports = { porUsuario, porId, cambiarClave, crearSesion, sesion, borrarSesion, borrarSesionesDe, DIAS_SESION };
