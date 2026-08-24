/* Capa HTTP de la transcripción. No guarda nada: recibe recortes,
   devuelve texto y se olvida. */
const ocr = require("../services/ocrService");

function estado(req, res) {
  res.json(ocr.estado());
}

async function transcribir(req, res, siguiente) {
  try {
    const salida = await ocr.transcribir(req.body && req.body.recortes);
    res.json(salida);
  } catch (e) {
    siguiente(e);
  }
}

module.exports = { estado, transcribir };
