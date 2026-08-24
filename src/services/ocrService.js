/* ================================================================
   Transcripción de casillas

   Recibe recortes PNG de casillas sueltas y devuelve qué dice cada
   una. El navegador NO habla directamente con la API: la llave vive
   aquí. Si estuviera en el frontend, cualquiera que abra la consola se
   la lleva, y una llave filtrada la paga el dueño de la cuenta.

   Lo que sale de este servidor son recortes de casillas, no el PDF.
   Aun así, sale información del cliente: es una decisión consciente y
   está anotada en CONTEXTO-DISTRIAVES.txt.
   ================================================================ */

const URL_API = "https://api.anthropic.com/v1/messages";
const VERSION_API = "2023-06-01";

/* Verificado en la documentación de la API (agosto 2026): es un ID de
   modelo válido y admite imagen de entrada. Si Anthropic lo retira,
   se cambia con la variable OCR_MODELO sin tocar el código. */
const MODELO_POR_DEFECTO = "claude-sonnet-5";

/* Tope de recortes por petición. Son casillas de una línea; el paquete
   completo son 8. El límite está para que un PDF raro no dispare una
   petición enorme por accidente. */
const MAX_RECORTES = 20;

const INSTRUCCIONES = [
  "Vas a ver recortes de casillas de un formulario colombiano escaneado.",
  "Cada recorte va precedido de su nombre. Dentro del recorte está el",
  "rótulo impreso de la casilla y, al lado, lo que alguien escribió a mano.",
  "",
  "Para cada recorte devuelve lo que está ESCRITO A MANO, sin el rótulo",
  "impreso. Copia exactamente lo que ves, letra por letra, sin corregir",
  "faltas de ortografía, sin completar lo que parezca incompleto y sin",
  "arreglar un correo que se vea raro: el error puede ser justo lo que",
  "hay que detectar.",
  "",
  "Responde SOLO con un objeto JSON, sin explicaciones y sin ```. Formato:",
  '{"campos":[{"campo":"...","texto":"...","vacio":false,"seguridad":"alta"}]}',
  "",
  '- "texto": lo escrito a mano, o "" si no hay nada escrito.',
  '- "vacio": true si la casilla está en blanco.',
  '- "seguridad": "alta" si lo lees con claridad, "media" si dudas de',
  '  algún carácter, "baja" si no te atreves a afirmar lo que dice.',
  "",
  'Si el rótulo del recorte dice "(grupo de opciones)", no hay nada',
  "escrito a mano: hay varias opciones con un círculo al lado y una lleva",
  "marca (una X, un relleno, un aspa). Devuelve en \"texto\" el nombre de la",
  'opción marcada. Si no ves ninguna, devuelve "" y "vacio": true. Si hay',
  'más de una, devuélvelas separadas por " y ".',
  "",
  'Si el rótulo dice "(debería estar en blanco)", lo normal es que esté',
  "vacía. Solo di que tiene algo si de verdad se lee algo escrito.",
  "",
  'Para el recorte llamado "letreroLocal" la regla es otra: es la foto de',
  "la fachada de un negocio, no una casilla. Devuelve en \"texto\" todos los",
  "nombres y rótulos que se lean en los letreros, separados por \" | \".",
  'Si en la foto no se lee ningún nombre de negocio, devuelve "" y',
  '"vacio": true.',
].join("\n");

function llave() {
  return process.env.ANTHROPIC_API_KEY || "";
}

function estado() {
  return {
    disponible: !!llave(),
    modelo: process.env.OCR_MODELO || MODELO_POR_DEFECTO,
  };
}

/* Un data URL de PNG viene como "data:image/png;base64,AAA...". */
function partirDataUrl(dataUrl) {
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { tipo: m[1], datos: m[2] };
}

function armarMensaje(recortes) {
  const bloques = [];
  for (const r of recortes) {
    const img = partirDataUrl(r.imagen);
    if (!img) continue;
    bloques.push({ type: "text", text: "Recorte: " + r.campo + " (" + (r.rotulo || "") + ")" });
    bloques.push({
      type: "image",
      source: { type: "base64", media_type: img.tipo, data: img.datos },
    });
  }
  bloques.push({ type: "text", text: INSTRUCCIONES });
  return bloques;
}

/* La respuesta puede traer varios bloques de texto; se pegan y se
   busca el JSON. Si el modelo se pone a explicar, no se adivina: se
   devuelve el fallo y las reglas quedan en "no se pudo revisar". */
function leerJson(cuerpo) {
  const texto = (cuerpo.content || [])
    .filter(function (b) { return b.type === "text"; })
    .map(function (b) { return b.text; })
    .join("\n");
  const limpio = texto.replace(/```json/g, "").replace(/```/g, "").trim();
  const desde = limpio.indexOf("{");
  const hasta = limpio.lastIndexOf("}");
  if (desde < 0 || hasta <= desde) throw new Error("La respuesta no traía JSON.");
  return JSON.parse(limpio.slice(desde, hasta + 1));
}

async function transcribir(recortes) {
  if (!llave()) {
    const e = new Error("Falta ANTHROPIC_API_KEY en el servidor.");
    e.status = 503;
    throw e;
  }
  if (!Array.isArray(recortes) || !recortes.length) {
    const e = new Error("No llegó ningún recorte.");
    e.status = 400;
    throw e;
  }
  if (recortes.length > MAX_RECORTES) {
    const e = new Error("Demasiados recortes (máximo " + MAX_RECORTES + ").");
    e.status = 400;
    throw e;
  }

  const contenido = armarMensaje(recortes);
  if (contenido.length < 2) {
    const e = new Error("Ningún recorte traía una imagen válida.");
    e.status = 400;
    throw e;
  }

  const respuesta = await fetch(URL_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": llave(),
      "anthropic-version": VERSION_API,
    },
    body: JSON.stringify({
      model: estado().modelo,
      max_tokens: 2000,
      messages: [{ role: "user", content: contenido }],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    const e = new Error("La API respondió " + respuesta.status + ": " + detalle.slice(0, 300));
    e.status = 502;
    throw e;
  }

  const salida = leerJson(await respuesta.json());
  const campos = {};
  for (const c of (salida.campos || [])) {
    if (!c || !c.campo) continue;
    campos[c.campo] = {
      texto: typeof c.texto === "string" ? c.texto : "",
      vacio: !!c.vacio || !String(c.texto || "").trim(),
      seguridad: ["alta", "media", "baja"].indexOf(c.seguridad) >= 0 ? c.seguridad : "baja",
    };
  }
  return { campos: campos, modelo: estado().modelo };
}

module.exports = { transcribir, estado, leerJson, partirDataUrl, MAX_RECORTES };
