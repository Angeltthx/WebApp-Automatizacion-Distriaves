/* Reglas de autenticación. Sin dependencias externas: scrypt viene con Node. */
const crypto = require("crypto");
const repo = require("../repositories/usuariosRepo");

const LARGO_CLAVE = 64;

function derivar(clave, salt) {
  return crypto.scryptSync(String(clave), salt, LARGO_CLAVE).toString("hex");
}

/* Comparación en tiempo constante: no delata la clave por cuánto tarda. */
function iguales(a, b) {
  const ba = Buffer.from(String(a), "hex");
  const bb = Buffer.from(String(b), "hex");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function entrar(usuario, clave) {
  if (!usuario || !clave) return null;
  const fila = repo.porUsuario(String(usuario).trim().toLowerCase());
  if (!fila) {
    /* Gasta el mismo tiempo aunque el usuario no exista. */
    derivar(clave, "0".repeat(32));
    return null;
  }
  if (!iguales(derivar(clave, fila.salt), fila.hash)) return null;
  return repo.crearSesion(fila.id);
}

function usuarioDeToken(token) {
  const s = repo.sesion(token);
  return s ? repo.porId(s.usuario_id) : null;
}

function salir(token) {
  repo.borrarSesion(token);
}

function cambiarClave(usuarioId, claveActual, claveNueva) {
  const fila = repo.porUsuario(repo.porId(usuarioId).usuario);
  if (!iguales(derivar(claveActual, fila.salt), fila.hash)) return { ok: false, error: "La contraseña actual no es correcta." };
  if (!claveNueva || String(claveNueva).length < 8) return { ok: false, error: "La contraseña nueva debe tener al menos 8 caracteres." };
  const salt = crypto.randomBytes(16).toString("hex");
  repo.cambiarClave(usuarioId, derivar(claveNueva, salt), salt);
  repo.borrarSesionesDe(usuarioId);
  return { ok: true };
}

module.exports = { entrar, usuarioDeToken, salir, cambiarClave };
