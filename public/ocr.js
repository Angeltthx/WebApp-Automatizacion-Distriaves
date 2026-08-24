"use strict";
/* ================================================================
   Transcripción de casillas y cruces de texto

   Tres revisiones que antes no se podían hacer:
     · los tres sitios donde va el correo llevan el mismo correo
     · "Lista de precios" dice CQ
     · el nombre del negocio del formato aparece en el letrero de la foto

   Cómo se hace: se recorta cada casilla del PDF (ya sabemos dónde
   están, ver CELDAS en rejilla.js), se manda a transcribir y se
   comparan los textos. El PDF no sale de aquí; los recortes sí.

   LO QUE ESTA HERRAMIENTA NO PUEDE HACER, y conviene saberlo antes de
   confiar en ella: si dos correos salen distintos, no hay forma de
   saber si el error está en el formato o en la lectura. Una letra
   cambiada —cindy contra cindi— es indistinguible del ruido de
   transcripción. Por eso las reglas SIEMPRE muestran los textos leídos
   al lado del veredicto: quien decide eres tú, mirando. Lo que sí caza
   con soltura es el error grueso, que es el que devuelven de verdad:
   un correo entero distinto, un CA donde debía ir CQ, un letrero que
   no tiene nada que ver con el nombre del formato.
   ================================================================ */

/* Ancho en píxeles al que se rasteriza cada recorte. Las casillas del
   formato miden ~0.012 del alto de una A4; a 1400 px de ancho de
   recorte la letra escrita a mano queda con ~40 px de altura, que es
   donde se lee cómoda. Subirlo solo engorda la petición. */
const ANCHO_RECORTE = 1400;
const ANCHO_RECORTE_FOTO = 1100;

/* Margen izquierdo de la tabla del formato, medido sobre el formato en
   blanco: las rayas verticales exteriores caen en 0.085 y 0.884. */
const MARGEN_TABLA = 0.085;

/* Palabras que no identifican a nadie: aparecen en medio negocio de
   Colombia y en casi todos los letreros. Si el nombre del formato solo
   tiene de estas, no se puede comparar y la regla se calla. */
const PALABRAS_GENERICAS = [
  "restaurante", "comidas", "comida", "tienda", "supermercado", "super",
  "minimercado", "panaderia", "asadero", "asadero", "pollo", "pollos",
  "distribuidora", "comercializadora", "almacen", "deposito", "cafeteria",
  "bar", "granero", "carniceria", "fruteria", "papeleria", "sas", "ltda",
  "cia", "eu", "the", "del", "los", "las", "una", "por", "con", "para",
];

/* ---------------- normalización y comparación ----------------
   Funciones puras, sin DOM y sin red: se prueban solas. */

function sinTildes(t) {
  return String(t == null ? "" : t)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* Para correos: se quitan los espacios que mete la letra a mano y las
   variantes de la arroba escritas raro. NO se corrige nada más. */
function normalizarCorreo(t) {
  return sinTildes(t)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（(]a[）)]|\[at\]/g, "@")
    .replace(/[,;]+$/, "")
    .trim();
}

function normalizarTexto(t) {
  return sinTildes(t)
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ¿Los correos leídos son todos el mismo? Devuelve también los
   valores, porque la regla los tiene que enseñar. */
function compararCorreos(lecturas) {
  const valores = lecturas.map(function (l) {
    return { campo: l.campo, texto: l.texto || "", norma: normalizarCorreo(l.texto),
             vacio: !!l.vacio, seguridad: l.seguridad || "baja" };
  });
  const vacios = valores.filter(function (v) { return v.vacio || !v.norma; });
  const normas = valores.filter(function (v) { return v.norma; })
                        .map(function (v) { return v.norma; });
  const distintos = normas.filter(function (v, i) { return normas.indexOf(v) === i; });
  return {
    valores: valores,
    vacios: vacios,
    distintos: distintos,
    iguales: !vacios.length && distintos.length === 1,
  };
}

function esListaPreciosCorrecta(texto) {
  return normalizarTexto(texto).replace(/\s+/g, "") === normalizarTexto(LISTA_PRECIOS_ESPERADA);
}


function fichas(texto) {
  return normalizarTexto(texto)
    .split(" ")
    .filter(function (p) { return p.length >= 4; });
}

function fichasPropias(texto) {
  return fichas(texto).filter(function (p) { return PALABRAS_GENERICAS.indexOf(p) < 0; });
}

/* Distancia de edición con tope: solo interesa saber si es 0, 1 o más.
   Un carácter de diferencia se acepta porque es el ruido típico de
   leer un letrero con brillo o en diagonal. */
function difiereEnMasDeUno(a, b) {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return true;
  let i = 0, j = 0, fallos = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    fallos++;
    if (fallos > 1) return true;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return (fallos + (a.length - i) + (b.length - j)) > 1;
}

/* ¿El nombre del formato aparece en el letrero?
   Basta con que UNA palabra propia del nombre esté en el letrero. No
   se exige que coincida entero: los letreros añaden "RESTAURANTE",
   "BIENVENIDOS", el teléfono y el menú, y el formato suele llevar solo
   la marca. El error que se busca es grueso —otro negocio— y con esta
   condición se ve igual de bien sin inventar un porcentaje. */
function nombreEnLetrero(nombreFormato, textoLetrero) {
  const propias = fichasPropias(nombreFormato);
  const usadas = propias.length ? propias : fichas(nombreFormato);
  if (!usadas.length) return { estado: "sinDatos", motivo: "nombre" };

  const enLetrero = fichas(textoLetrero);
  if (!enLetrero.length) return { estado: "sinDatos", motivo: "letrero" };

  const coinciden = usadas.filter(function (p) {
    return enLetrero.some(function (q) { return !difiereEnMasDeUno(p, q); });
  });
  return {
    estado: coinciden.length ? "coincide" : "noCoincide",
    buscadas: usadas,
    encontradas: coinciden,
    enLetrero: enLetrero,
  };
}

/* ---------------- recorte de las casillas ---------------- */

/* Rasteriza un trozo de una página del PDF. Se renderiza la página
   entera a la escala que deja el RECORTE con el ancho pedido y se
   copia solo el trozo: pdf.js no recorta, así que el recorte se hace
   sobre el lienzo. */
async function recortarDelPdf(doc, numeroPagina, caja, anchoObjetivo) {
  const pagina = await doc.getPage(numeroPagina);
  const base = pagina.getViewport({ scale: 1 });
  const escala = Math.min(8, (anchoObjetivo / Math.max(0.02, caja.ancho)) / base.width);
  const vista = pagina.getViewport({ scale: escala });

  const completo = document.createElement("canvas");
  completo.width = Math.max(1, Math.floor(vista.width));
  completo.height = Math.max(1, Math.floor(vista.height));
  const ctx = completo.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, completo.width, completo.height);
  await pagina.render({ canvasContext: ctx, viewport: vista }).promise;

  const x = Math.max(0, Math.floor(caja.x * completo.width));
  const y = Math.max(0, Math.floor(caja.y * completo.height));
  const w = Math.max(1, Math.min(completo.width - x, Math.floor(caja.ancho * completo.width)));
  const h = Math.max(1, Math.min(completo.height - y, Math.floor(caja.alto * completo.height)));

  const trozo = document.createElement("canvas");
  trozo.width = w;
  trozo.height = h;
  trozo.getContext("2d").drawImage(completo, x, y, w, h, 0, 0, w, h);
  return trozo.toDataURL("image/png");
}

/* Qué casillas hay para transcribir en este paquete. Salen de las
   hojas con recuadro exacto; si ninguna lo tiene, la lista va vacía y
   las reglas dirán que no se pudo revisar, que es la verdad. */
function celdasDelPaquete(analisis) {
  const lista = [];
  for (const p of analisis.paginas) {
    if (!p.celdas) continue;
    for (const c of p.celdas) lista.push(c);
  }
  return lista;
}

function fotoDelLocal(analisis) {
  return analisis.paginas.find(function (p) { return p.tipo === "foto"; }) || null;
}

/* ---------------- resolver las dudas de la tinta ----------------

   La tinta no basta para decidir. Sobre un paquete real, de 44
   casillas escritas dejó 20 en verde, 16 en amarillo y 8 en rojo, y de
   esas 8 cinco SÍ estaban escritas, con poco trazo ("DJ", "NA", "CA").
   Fiarse del rojo sería devolver paquetes buenos.

   Así que la tinta hace de filtro y la transcripción de juez: se manda
   a leer solo lo que quedó amarillo o rojo. En ese paquete serían 24
   recortes en vez de 74, y lo verde —que es donde la tinta acierta— no
   cuesta nada.

   Lo que la transcripción diga MANDA sobre lo que dijo la tinta. Es la
   única de las dos que mira lo que está escrito. */
function camposADespejar(analisis) {
  if (!analisis.casillas) return [];
  const campos = analisis.casillas.campos;
  return Object.keys(campos).filter(function (k) {
    const c = campos[k];
    if (c.clase === "pendiente") return false;
    /* Los grupos van SIEMPRE: la tinta no los sabe leer (ver la nota
       de estadoDeGrupo en casillas.js). */
    if (c.clase === "grupo") return true;
    return c.color === "amarillo" || c.color === "rojo";
  });
}

async function resolverDudas(analisis, alProgresar) {
  const dudosos = camposADespejar(analisis);
  if (!dudosos.length) return { estado: "sinDudas", campos: {} };

  const porPagina = {};
  for (const p of analisis.paginas) {
    if (p.ajuste && p.ajuste.exacto) porPagina[p.hoja] = p.n;
  }

  const recortes = [];
  let hechos = 0;
  for (const campo of dudosos) {
    const c = analisis.casillas.campos[campo];
    const pagina = porPagina[c.hoja];
    if (!pagina) continue;
    const p = analisis.paginas.find(function (x) { return x.n === pagina; });
    const caja = ubicarDelMapa(campo, p.ajuste);
    if (!caja) continue;
    /* Se recorta con aire alrededor: la caja de la marca es justa y un
       recorte pelado corta las colas de las letras. */
    const aire = caja.alto * 0.35;
    /* Un grupo se recorta desde el margen de la tabla, para que entre
       el rótulo y todas las opciones: sin eso no se puede decir CUÁL
       está marcada. Una casilla suelta se recorta ajustada. */
    const esGrupo = c.clase === "grupo";
    const x = esGrupo ? MARGEN_TABLA : Math.max(0, caja.x - caja.ancho * 0.06);
    const ancho = esGrupo
      ? Math.min(1 - x, caja.x + caja.ancho + 0.02 - x)
      : Math.min(1 - x, caja.ancho * 1.12);
    recortes.push({
      campo: campo,
      rotulo: c.etiqueta + (esGrupo ? " (grupo de opciones)" :
                            c.clase === "vacio" ? " (debería estar en blanco)" : ""),
      imagen: await recortarDelPdf(analisis.doc, pagina, {
        x: x, ancho: ancho,
        y: Math.max(0, caja.y - aire),
        alto: Math.min(1, caja.alto + 2 * aire),
      }, ANCHO_RECORTE),
    });
    if (alProgresar) alProgresar(++hechos, dudosos.length);
  }
  if (!recortes.length) return { estado: "sinDudas", campos: {} };

  const campos = {};
  /* En tandas: 74 recortes en una sola petición sería enorme y si algo
     falla se pierde todo. En tandas, lo que llegó se aprovecha. */
  for (let i = 0; i < recortes.length; i += 12) {
    const tanda = recortes.slice(i, i + 12);
    const r = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recortes: tanda }),
    });
    const cuerpo = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(cuerpo.error || ("La lectura falló (" + r.status + ")"));
    Object.assign(campos, cuerpo.campos || {});
  }

  /* La lectura pisa a la tinta. */
  for (const campo of Object.keys(campos)) {
    const c = analisis.casillas.campos[campo];
    if (!c) continue;
    const v = campos[campo];
    c.texto = v.texto;
    c.fuente = "lectura";
    c.seguridad = v.seguridad;
    if (v.seguridad === "baja") {
      c.color = "amarillo";
      c.estado = "duda";
    } else {
      c.estado = v.vacio ? "vacio" : "lleno";
      c.color = colorDe(c.clase, c.estado);
    }
  }
  analisis.dudasResueltas = { estado: "listo", cuantas: Object.keys(campos).length };
  return { estado: "listo", campos: campos };
}

/* Arma los recortes, los manda y guarda el resultado en el análisis. */
async function transcribirPaquete(analisis, alProgresar) {
  const celdas = celdasDelPaquete(analisis);
  const foto = fotoDelLocal(analisis);
  if (!celdas.length && !foto) {
    analisis.transcripcion = { estado: "sinCeldas", campos: {} };
    return analisis.transcripcion;
  }

  const recortes = [];
  let hechos = 0;
  const total = celdas.length + (foto ? 1 : 0);

  for (const c of celdas) {
    recortes.push({
      campo: c.campo,
      rotulo: c.rotulo,
      imagen: await recortarDelPdf(analisis.doc, c.pagina, c, ANCHO_RECORTE),
    });
    if (alProgresar) alProgresar(++hechos, total);
  }

  if (foto) {
    recortes.push({
      campo: "letreroLocal",
      rotulo: "Foto de la fachada del negocio",
      imagen: await recortarDelPdf(analisis.doc, foto.n,
        { x: 0, y: 0, ancho: 1, alto: 1 }, ANCHO_RECORTE_FOTO),
    });
    if (alProgresar) alProgresar(++hechos, total);
  }

  const r = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recortes: recortes }),
  });
  const cuerpo = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error(cuerpo.error || cuerpo.mensaje || ("La transcripción falló (" + r.status + ")"));

  analisis.transcripcion = {
    estado: "listo",
    campos: cuerpo.campos || {},
    modelo: cuerpo.modelo || null,
    cuando: new Date().toISOString(),
  };
  return analisis.transcripcion;
}

async function ocrDisponible() {
  try {
    const r = await fetch("/api/ocr/estado");
    if (!r.ok) return { disponible: false };
    return await r.json();
  } catch (e) {
    return { disponible: false };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizarCorreo, normalizarTexto, compararCorreos, esListaPreciosCorrecta,
    fichas, fichasPropias, difiereEnMasDeUno, nombreEnLetrero,
  };
}
