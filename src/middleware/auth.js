/* Puerta de entrada: la API y la aplicación exigen sesión. */
const authService = require("../services/authService");
const { DIAS_SESION } = require("../repositories/usuariosRepo");

const NOMBRE_COOKIE = "distriaves_sesion";

/* Sin cookie-parser: leer una cookie es partir una cadena. */
function leerCookie(req, nombre) {
  const crudo = req.headers.cookie;
  if (!crudo) return null;
  for (const trozo of crudo.split(";")) {
    const i = trozo.indexOf("=");
    if (i < 0) continue;
    if (trozo.slice(0, i).trim() === nombre) return decodeURIComponent(trozo.slice(i + 1).trim());
  }
  return null;
}

function ponerCookie(res, token) {
  res.setHeader("Set-Cookie",
    NOMBRE_COOKIE + "=" + token +
    "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + (DIAS_SESION * 86400));
}

function quitarCookie(res) {
  res.setHeader("Set-Cookie", NOMBRE_COOKIE + "=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
}

/* Reconoce al usuario si trae sesión válida, pero no bloquea. */
function identificar(req, res, next) {
  req.token = leerCookie(req, NOMBRE_COOKIE);
  req.usuario = req.token ? authService.usuarioDeToken(req.token) : null;
  next();
}

/* Bloquea la API. */
function exigirSesionApi(req, res, next) {
  if (req.usuario) return next();
  res.status(401).json({ error: "Sesión no iniciada." });
}

/* Bloquea las páginas; manda al login. */
const PUBLICAS = ["/login.html", "/styles.css", "/favicon.ico"];

function exigirSesionWeb(req, res, next) {
  if (req.usuario) return next();
  if (PUBLICAS.indexOf(req.path) >= 0) return next();
  res.redirect("/login.html");
}

module.exports = { identificar, exigirSesionApi, exigirSesionWeb, ponerCookie, quitarCookie, NOMBRE_COOKIE };
