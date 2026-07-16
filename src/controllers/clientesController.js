/* Capa de controladores: traduce HTTP <-> servicio.
   No contiene reglas de negocio, solo lectura de la petición y armado de la respuesta. */
const servicio = require("../services/clientesService");

const listar = (req, res) =>
  res.json(servicio.listar({ estado: req.query.estado, q: req.query.q }));

const resumen = (req, res) => res.json(servicio.resumen());

const crear = (req, res) => res.status(201).json(servicio.crear(req.body));

const actualizar = (req, res) => res.json(servicio.actualizar(req.params.id, req.body));

const cambiarEstado = (req, res) =>
  res.json(servicio.cambiarEstado(req.params.id, req.body.estado));

const eliminar = (req, res) => {
  servicio.eliminar(req.params.id);
  res.status(204).end();
};

const exportar = (req, res) => {
  const data = servicio.exportar();
  res.setHeader("Content-Disposition",
    `attachment; filename="distriaves-respaldo-${data.exportado.slice(0, 10)}.json"`);
  res.json(data);
};

const importar = (req, res) => res.json(servicio.importar(req.body));

const actividad = (req, res) => res.json(servicio.actividad());

module.exports = { listar, resumen, crear, actualizar, cambiarEstado, eliminar, exportar, importar, actividad };
