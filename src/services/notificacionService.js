/* Copia del paquete a un canal personal, para dejar constancia de qué
   se envió y cuándo.

   Ojo con lo que implica: mandar el PDF es la única parte de la
   herramienta donde el documento sale de tu equipo. Por eso está
   apagada mientras no configures las credenciales, y por eso el
   archivo nunca se escribe en disco: se recibe, se reenvía y se
   descarta.

   El canal es intercambiable. Hoy Telegram; si algún día montas un
   número de empresa para WhatsApp, se agrega aquí y no cambia nada más. */

const TELEGRAM_API = "https://api.telegram.org/bot";
const LIMITE_BYTES = 20 * 1024 * 1024;

function configurado() {
  return !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function canal() {
  return configurado() ? "Telegram" : null;
}

async function enviarPaquete({ pdfBase64, nombreArchivo, cliente, intento }) {
  if (!configurado()) {
    const e = new Error(
      "Telegram todavía no está conectado. Se hace una sola vez: escríbele a @BotFather " +
      "en Telegram, manda /newbot y copia el token; luego escríbele algo a tu bot y abre " +
      "https://api.telegram.org/bot<TU_TOKEN>/getUpdates para sacar el chat.id. " +
      "Arranca con TELEGRAM_TOKEN y TELEGRAM_CHAT_ID puestos. Los pasos están en el README.");
    e.codigo = 400;
    throw e;
  }
  if (!pdfBase64) {
    const e = new Error("No llegó el archivo.");
    e.codigo = 400;
    throw e;
  }

  const bytes = Buffer.from(String(pdfBase64), "base64");
  if (!bytes.length) {
    const e = new Error("El archivo llegó vacío.");
    e.codigo = 400;
    throw e;
  }
  if (bytes.length > LIMITE_BYTES) {
    const e = new Error("El PDF pesa más de 20 MB y Telegram no lo acepta.");
    e.codigo = 413;
    throw e;
  }

  const fecha = new Date().toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
  const pie = [
    (cliente || "Sin nombre") + (intento > 1 ? "  ·  intento " + intento : ""),
    "Enviado el " + fecha,
  ].join("\n");

  const forma = new FormData();
  forma.append("chat_id", String(process.env.TELEGRAM_CHAT_ID));
  forma.append("caption", pie);
  forma.append("document", new Blob([bytes], { type: "application/pdf" }),
    nombreArchivo || "paquete.pdf");

  const res = await fetch(TELEGRAM_API + process.env.TELEGRAM_TOKEN + "/sendDocument", {
    method: "POST", body: forma,
  });
  const cuerpo = await res.json().catch(function () { return {}; });

  if (!res.ok || !cuerpo.ok) {
    const e = new Error("Telegram rechazó el envío: " + (cuerpo.description || res.status));
    e.codigo = 502;
    throw e;
  }
  return { enviado: true, canal: "Telegram", fecha: new Date().toISOString() };
}

module.exports = { configurado, canal, enviarPaquete };
