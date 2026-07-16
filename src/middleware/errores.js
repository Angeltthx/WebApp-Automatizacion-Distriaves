/* Middleware de errores: respuestas uniformes en JSON. */
const { ErrorNegocio } = require("../services/clientesService");

function noEncontrado(req, res, next) {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Ruta no encontrada." });
  }
  next();
}

function manejarErrores(err, req, res, next) {
  if (err instanceof ErrorNegocio) {
    return res.status(err.codigo).json({ error: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
}

module.exports = { noEncontrado, manejarErrores };
