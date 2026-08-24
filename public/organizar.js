"use strict";
/* ================================================================
   Ordenar las hojas del paquete

   Se sueltan el formato de tres hojas, el RUT, la cédula y la foto del
   local —en el orden que sea, en PDF o en foto— y salen en un solo PDF
   con el orden que se les ponga. Es lo que se venía haciendo en una
   web de fuera; aquí no hace falta subir nada a ningún sitio.

   Todo pasa en el navegador: pdf.js para ver las páginas y pdf-lib
   para armar el resultado. Ningún archivo sale del equipo.
   ================================================================ */

const org = {
  hojas: [],        // { id, nombre, origen, indice, rotacion, miniatura }
  fuentes: [],      // { nombre, bytes, tipo }
  cargando: false,
  ordenando: false,
  error: null,
  aviso: null,
};

let contadorHoja = 0;

function reiniciarOrganizador() {
  org.hojas = [];
  org.fuentes = [];
  org.cargando = false;
  org.error = null;
  contadorHoja = 0;
}

/* Mete un archivo en la lista. Un PDF aporta tantas hojas como
   páginas; una imagen aporta una. */
async function agregarArchivo(archivo) {
  /* pdf.js se carga bajo demanda; aquí puede ser la primera vez que
     hace falta en toda la sesión. */
  const pdfjs = await cargarPdfjs();
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const esImagen = /^image\/(png|jpeg)$/.test(archivo.type);
  const fuente = { nombre: archivo.name, bytes: bytes, tipo: esImagen ? "imagen" : "pdf" };
  org.fuentes.push(fuente);
  const iFuente = org.fuentes.length - 1;

  if (esImagen) {
    org.hojas.push({
      id: "h" + (++contadorHoja), nombre: archivo.name, fuente: iFuente,
      indice: 0, rotacion: 0, miniatura: URL.createObjectURL(archivo),
    });
    return;
  }

  /* pdf.js se queda con el buffer que se le pasa, así que va una copia:
     si no, pdf-lib encuentra el original vacío al exportar. */
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  for (let i = 1; i <= doc.numPages; i++) {
    org.hojas.push({
      id: "h" + (++contadorHoja), nombre: archivo.name, fuente: iFuente,
      indice: i - 1, rotacion: 0, miniatura: null, doc: doc, pagina: i,
    });
  }
}

async function miniaturaDe(hoja, ancho) {
  if (hoja.miniatura) return hoja.miniatura;
  if (!hoja.doc) return null;
  const p = await hoja.doc.getPage(hoja.pagina);
  const base = p.getViewport({ scale: 1 });
  const vista = p.getViewport({ scale: (ancho || 150) / base.width });
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.ceil(vista.width);
  lienzo.height = Math.ceil(vista.height);
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  await p.render({ canvasContext: ctx, viewport: vista }).promise;
  hoja.miniatura = lienzo.toDataURL("image/jpeg", 0.7);
  return hoja.miniatura;
}

function moverHoja(id, salto) {
  const i = org.hojas.findIndex(function (h) { return h.id === id; });
  const j = i + salto;
  if (i < 0 || j < 0 || j >= org.hojas.length) return;
  const t = org.hojas[i];
  org.hojas[i] = org.hojas[j];
  org.hojas[j] = t;
}

function quitarHoja(id) {
  org.hojas = org.hojas.filter(function (h) { return h.id !== id; });
}

function girarHoja(id) {
  const h = org.hojas.find(function (x) { return x.id === id; });
  if (h) h.rotacion = (h.rotacion + 90) % 360;
}

/* Arma el PDF final respetando el orden de la lista. */
async function exportarOrganizado() {
  if (typeof PDFLib === "undefined") throw new Error("No se cargó la librería de PDF.");
  if (!org.hojas.length) throw new Error("No hay ninguna hoja que ordenar.");

  const salida = await PDFLib.PDFDocument.create();
  const cache = {};

  for (const h of org.hojas) {
    const fuente = org.fuentes[h.fuente];

    if (fuente.tipo === "imagen") {
      const img = /\.png$/i.test(fuente.nombre)
        ? await salida.embedPng(fuente.bytes)
        : await salida.embedJpg(fuente.bytes);
      /* La imagen se mete en una hoja A4 y se encoge para que quepa
         entera: si se pone a tamaño natural, una foto de móvil sale
         como una página de metro y medio. */
      const A4 = [595.28, 841.89];
      const escala = Math.min(A4[0] / img.width, A4[1] / img.height);
      const pag = salida.addPage(A4);
      pag.drawImage(img, {
        x: (A4[0] - img.width * escala) / 2,
        y: (A4[1] - img.height * escala) / 2,
        width: img.width * escala,
        height: img.height * escala,
      });
      if (h.rotacion) pag.setRotation(PDFLib.degrees(h.rotacion));
      continue;
    }

    if (!cache[h.fuente]) cache[h.fuente] = await PDFLib.PDFDocument.load(fuente.bytes);
    const [copia] = await salida.copyPages(cache[h.fuente], [h.indice]);
    if (h.rotacion) {
      const previa = copia.getRotation().angle || 0;
      copia.setRotation(PDFLib.degrees((previa + h.rotacion) % 360));
    }
    salida.addPage(copia);
  }
  return await salida.save();
}

/* ---------------- ordenar solo ----------------

   Se junta lo que hay en un PDF de trabajo, se le pasa al MISMO
   analizador que usa la pestaña Verificar y se ordena con lo que
   diga: primero las tres hojas del formato en su orden, luego el RUT,
   después la cédula y los demás documentos, y la foto del local al
   final. Es el orden en que se arma el paquete.

   No se inventa un clasificador nuevo: el que ya existe está calibrado
   contra 24 paquetes reales. Si se equivoca aquí, se equivoca allí, y
   se arregla en un solo sitio.

   Si el analizador no reconoce una hoja, esa se queda donde estaba y
   se avisa: mover a ciegas es peor que no mover. */
const ORDEN_TIPOS = { formato: 0, rut: 1, documento: 2, foto: 3, desconocido: 4 };

/* Decide el orden a partir de lo que dijo el clasificador. Función
   pura: entra una lista de {tipo, hoja} y sale el orden. Así se puede
   probar sin navegador, que es donde vive todo lo demás. */
function ordenPorTipo(clasificadas) {
  return clasificadas
    .map(function (c, i) {
      const tipo = c && c.tipo ? c.tipo : "desconocido";
      const hoja = c && c.hoja ? c.hoja : "";
      return {
        posicion: i,
        grupo: ORDEN_TIPOS[tipo] != null ? ORDEN_TIPOS[tipo] : ORDEN_TIPOS.desconocido,
        /* Dentro del formato manda el número de hoja. Una hoja de
           formato sin identificar va al final de su grupo, no la
           primera: colarse delante sería peor que quedarse detrás. */
        subOrden: hoja === "1/3" ? 0 : hoja === "2/3" ? 1 : hoja === "3/3" ? 2 : 9,
        seguro: !!c && tipo !== "desconocido" && (tipo !== "formato" || !!hoja),
      };
    })
    .sort(function (a, b) {
      if (a.grupo !== b.grupo) return a.grupo - b.grupo;
      if (a.subOrden !== b.subOrden) return a.subOrden - b.subOrden;
      return a.posicion - b.posicion;   // empate: se respeta el orden que traían
    });
}

async function ordenarSolo(alProgresar) {
  if (org.hojas.length < 2) return { movidas: 0, dudosas: 0, fotos: 0 };

  const bytes = await exportarOrganizado();
  const analisis = await analizarPdf(new Blob([bytes], { type: "application/pdf" }),
                                     alProgresar, { paraOrdenar: true });

  /* El PDF de trabajo salió con el orden actual, así que la página n
     del análisis es la hoja n de la lista. */
  const antes = org.hojas.slice();
  const orden = ordenPorTipo(antes.map(function (_, i) {
    const p = analisis.paginas[i];
    return p ? { tipo: p.tipo, hoja: p.hoja } : null;
  }));

  org.hojas = orden.map(function (x) { return antes[x.posicion]; });
  let movidas = 0;
  org.hojas.forEach(function (h, i) { if (antes[i] !== h) movidas++; });

  const fotos = orden.filter(function (x) { return x.grupo === ORDEN_TIPOS.foto; }).length;
  return {
    movidas: movidas,
    dudosas: orden.filter(function (x) { return !x.seguro; }).length,
    fotos: fotos,
  };
}

/* Descarga unos bytes con un nombre. Se revoca la URL después: sin
   eso, cada vista previa deja el PDF entero retenido en memoria. */
function descargarBytes(bytes, nombre) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { org, reiniciarOrganizador, moverHoja, quitarHoja, girarHoja,
                     ordenPorTipo, ORDEN_TIPOS };
}
