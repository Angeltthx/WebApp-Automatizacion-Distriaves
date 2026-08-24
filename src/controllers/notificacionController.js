/* Traduce HTTP <-> servicio de notificación. */
const servicio = require("../services/notificacionService");

const estado = (req, res) => res.json({ configurado: servicio.configurado(), canal: servicio.canal() });

async function enviar(req, res, next) {
  try {
    const r = await servicio.enviarPaquete({
      pdfBase64: req.body.pdf,
      nombreArchivo: req.body.archivo,
      cliente: req.body.cliente,
      intento: Number(req.body.intento) || 1,
    });
    res.json(r);
  } catch (e) {
    res.status(e.codigo || 500).json({ error: e.message });
  }
}

module.exports = { estado, enviar };
