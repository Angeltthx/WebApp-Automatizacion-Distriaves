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
  /* Un error que ya sabe qué código merece lo dice él. Lo usa la
     transcripción, que no tiene por qué importar el servicio de
     clientes solo para poder decir 503. El mensaje se muestra tal
     cual, así que solo se usa en errores escritos a mano. */
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 600) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
}

module.exports = { noEncontrado, manejarErrores };
