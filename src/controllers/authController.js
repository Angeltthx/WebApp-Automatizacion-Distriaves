/* Traduce HTTP <-> servicio de autenticación. */
const authService = require("../services/authService");
const { ponerCookie, quitarCookie } = require("../middleware/auth");

function entrar(req, res) {
  const sesion = authService.entrar(req.body.usuario, req.body.clave);
  if (!sesion) return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
  ponerCookie(res, sesion.token);
  res.json({ ok: true });
}

function salir(req, res) {
  if (req.token) authService.salir(req.token);
  quitarCookie(res);
  res.json({ ok: true });
}

function yo(req, res) {
  res.json({ usuario: req.usuario ? req.usuario.usuario : null });
}

function cambiarClave(req, res) {
  const r = authService.cambiarClave(req.usuario.id, req.body.actual, req.body.nueva);
  if (!r.ok) return res.status(400).json({ error: r.error });
  quitarCookie(res);
  res.json({ ok: true });
}

module.exports = { entrar, salir, yo, cambiarClave };
