/* ================================================================
   Genera el formato relleno con CADA letra del catálogo, para poder
   ponerlas al lado de un escaneo real y decidir mirando.

   Existe por el error #41: la letra de la v26 se dio por buena
   mirándola en abstracto y estuvo tres versiones sin corregirse. Una
   imitación se juzga al lado del original, y para eso hay que poder
   generar el original de comparación sin abrir el navegador.

       node herramientas/muestras-de-letra.js [carpeta-de-salida]

   Deja un PDF por letra. Para verlo a 150 ppp, con poppler instalado:

       pdftoppm -png -r 150 formato-gochihand.pdf hoja

   Los datos son los de DATOS_DE_PRUEBA, que son inventados a
   propósito: este script no toca ningún cliente real.
   ================================================================ */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PUBLICO = path.join(RAIZ, "public");
const SALIDA = process.argv[2] || path.join(RAIZ, "muestras");

/* Los archivos de public/ son scripts de navegador: comparten ámbito
   global y esperan `fetch`. Se les monta aquí lo justo para que
   funcionen fuera del navegador, igual que hacen las pruebas. */
globalThis.MAPA = require(path.join(PUBLICO, "mapa.js")).MAPA;
globalThis.LISTA_PRECIOS_ESPERADA = require(path.join(PUBLICO, "rejilla.js")).LISTA_PRECIOS_ESPERADA;
globalThis.PDFLib = require("pdf-lib");
globalThis.fontkit = require("@pdf-lib/fontkit");
globalThis.fetch = async function (u) {
  return { ok: true, arrayBuffer: async function () { return fs.readFileSync(path.join(PUBLICO, u)); } };
};

const F = require(path.join(PUBLICO, "formulario.js"));

(async function () {
  fs.mkdirSync(SALIDA, { recursive: true });
  const datos = F.datosDePrueba();
  for (const letra of F.LETRAS) {
    F.elegirLetra(letra.id);
    const bytes = await F.generarPdf(datos);
    const destino = path.join(SALIDA, "formato-" + letra.id + ".pdf");
    fs.writeFileSync(destino, bytes);
    console.log(letra.nombre.padEnd(18), (bytes.length / 1024).toFixed(0) + " KB",
                "  tinta " + letra.tinta.toFixed(2) + "x   ->  " + destino);
  }
  F.elegirLetra(F.LETRA_POR_DEFECTO);
})();
