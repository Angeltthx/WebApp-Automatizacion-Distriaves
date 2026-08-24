"use strict";
/* ================================================================
   Verificador · análisis del paquete

   Todo ocurre en el navegador: el PDF nunca se sube al servidor ni
   se guarda en ninguna parte. Solo viaja el resultado (qué revisó
   y qué encontró), que no contiene datos del cliente.

   Lo que se mide en cada página:
     tinta       proporción de píxeles oscuros
     medioTono   píxeles ni blancos ni negros → escaneo lavado o borroso
     color       píxeles con saturación real  → fotos a color
     reglas      filas con trazos horizontales largos → formularios
     bandas      tinta en 6 franjas horizontales, para ubicar firmas
   ================================================================ */

const ANCHO_ANALISIS = 800;

let pdfjsLib = null;

async function cargarPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("/vendor/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.mjs";
  return pdfjsLib;
}

/* ---------- medición de píxeles ---------- */
function medirLienzo(ctx, ancho, alto) {
  const datos = ctx.getImageData(0, 0, ancho, alto).data;
  const total = ancho * alto;

  let oscuros = 0, medios = 0, colores = 0, noBlancos = 0;
  const NUM_BANDAS = 6;
  const bandas = new Array(NUM_BANDAS).fill(0);
  const bandasIzq = new Array(NUM_BANDAS).fill(0);
  const altoBanda = alto / NUM_BANDAS;
  const filaOscura = new Uint8Array(alto);

  for (let y = 0; y < alto; y++) {
    const banda = Math.min(NUM_BANDAS - 1, Math.floor(y / altoBanda));
    let corridaMax = 0, corrida = 0;
    for (let x = 0; x < ancho; x++) {
      const p = (y * ancho + x) * 4;
      const r = datos[p], g = datos[p + 1], b = datos[p + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const luz = (max + min) / 2;
      const satura = max - min;

      if (luz < 128) {
        oscuros++;
        bandas[banda]++;
        if (x < ancho / 2) bandasIzq[banda]++;
        corrida++;
        if (corrida > corridaMax) corridaMax = corrida;
      } else {
        corrida = 0;
        if (luz < 215) medios++;
      }
      if (satura > 45 && luz > 40 && luz < 235) colores++;
      /* Píxel que no es papel en blanco. Sirve para medir el color
         SIN que lo diluyan los márgenes: una foto apaisada metida en
         una A4 lleva franjas blancas arriba y abajo, y sobre la página
         entera su color baja a la mitad. */
      if (luz < 235 || satura > 25) noBlancos++;
    }
    /* una "regla" es un trazo horizontal continuo de más de medio ancho */
    if (corridaMax > ancho * 0.5) filaOscura[y] = 1;
  }

  let filasRegla = 0;
  for (let y = 1; y < alto; y++) {
    if (filaOscura[y] && !filaOscura[y - 1]) filasRegla++;
  }

  const pxBanda = total / NUM_BANDAS;
  return {
    tinta: oscuros / total,
    medioTono: medios / total,
    color: colores / total,
    colorCubierto: colores / Math.max(noBlancos, 1),
    cubierto: noBlancos / total,
    reglas: filasRegla,
    bandas: bandas.map(function (v) { return v / pxBanda; }),
    bandasIzq: bandasIzq.map(function (v) { return v / (pxBanda / 2); }),
  };
}

/* ---------- clasificación de páginas ----------
   Medida sobre 5 paquetes reales (33 páginas). Lo que se aprendió:

   · Las hojas del formato tienen muchos trazos horizontales largos
     (9 a 34) y casi nada de color.
   · El color NO distingue la foto del local de la foto de la cédula:
     una cédula fotografiada sobre una mesa de madera marcó 34% de
     color y una fachada de vidrio apenas 2.7%. Por eso aquí solo se
     propone un tipo y la confirmación la das tú en las miniaturas.  */
function clasificar(p) {
  if (p.esRut) return "rut";
  const pocoColor = p.color < 0.03;
  if (pocoColor && p.reglas >= 12) return "formato";
  if (pocoColor && p.reglas >= 9 && p.tinta > 0.05 && p.bandas[5] < 0.04) return "formato";
  if (p.color >= 0.10) return "foto";
  return "documento";
}

const NOMBRES_TIPO = {
  formato: "Formato de conocimiento",
  rut: "RUT",
  documento: "Cédula o RUT escaneado",
  foto: "Foto del establecimiento",
  descartada: "No cuenta",
};

/* Ajustes que salen de cómo se arma el paquete, no de los píxeles.
   Corrigen los dos errores que aparecieron al probar con los 5 reales:
   una cédula con las dos caras en una hoja se confundía con el formato,
   y una cédula fotografiada sobre madera se confundía con la fachada. */
function ajustarClasificacion(paginas, yaOrdenado) {
  const ultima = paginas.length - 1;

  /* La foto del local va de última en los 5 paquetes revisados.
     Una página a color en la mitad es una cédula fotografiada.

     ESTO SOLO VALE SI EL PAQUETE YA ESTÁ ARMADO. Cuando lo que se está
     mirando es un montón sin ordenar —que es justo lo que hace el
     botón "Ordenar solo"— la posición no dice nada, y aplicar estas
     dos reglas convierte la foto real en documento y asciende a foto
     lo que hubiera quedado de último. Por eso van detrás de una
     bandera. */
  if (yaOrdenado) {
    paginas.forEach(function (p, i) {
      if (p.tipo === "foto" && i !== ultima) p.tipo = "documento";
    });
    if (paginas.length >= 5 && paginas[ultima] && paginas[ultima].tipo === "documento") {
      paginas[ultima].tipo = "foto";
    }
  }

  /* El formato tiene 3 hojas. Si salen más, sobran las que peor calzan
     con la plantilla. Antes se ordenaba por `reglas`, y ese número se
     va a cero en cuanto el papel es claro: con el PDF que genera la
     propia app daba 1, 4 y 2. La confianza del emparejador no depende
     del papel. */
  const formatos = paginas.filter(function (p) { return p.tipo === "formato"; });
  if (formatos.length > 3) {
    formatos.slice()
      .sort(function (a, b) {
        const ca = a.confianzaFormato != null ? a.confianzaFormato : a.reglas / 40;
        const cb = b.confianzaFormato != null ? b.confianzaFormato : b.reglas / 40;
        return cb - ca;
      })
      .slice(3)
      .forEach(function (p) { p.tipo = "documento"; });
  }
}

/* Cuál de las tres hojas del formato es cuál.

   Antes se decidía por tinta: la 3/3 es la de mitad inferior más
   vacía, la 2/3 la que tiene tinta abajo a la izquierda (la firma).
   Acertaba en los 5 paquetes con que se midió, pero se equivoca en
   cuanto la firma se sale de su sitio o el escaneo viene recortado, y
   cuando falla manda TODOS los recuadros de dos páginas a la página
   equivocada: el recuadro de «Firma y huella» aparecía sobre la
   hoja 3.

   Ahora se decide por lo que ya sabe hacer el emparejamiento: se
   prueba cada página contra las tres plantillas y gana el reparto que
   más calza en total. Las barras de sección son distintas en cada
   hoja (8, 4 y 2), así que la señal es fuerte. Si ninguna plantilla
   engancha, se vuelve al método de la tinta. */
const HOJAS = ["1/3", "2/3", "3/3"];

function medirRejilla(p) {
  if (p.barras && p.lineas) return;
  if (!p.gris) { p.barras = p.barras || []; p.lineas = p.lineas || []; return; }
  p.barras = detectarBarras(p.gris, p.ancho, p.alto);
  p.lineas = lineasDeLaHoja(p.gris, p.ancho, p.alto).lineas;
}

/* Qué tan bien calza una página con la plantilla de una hoja. */
function calceConPlantilla(p, hoja) {
  if (!REFERENCIA[hoja] || !p.lineas) return 0;
  const ancla = anclarConBarras(p.barras, REFERENCIA_BARRAS[hoja]);
  const ajuste = emparejar(p.lineas, REFERENCIA[hoja], undefined, ancla);
  if (!ajuste) return 0;
  let puntaje = ajuste.confianza || 0;
  if (ancla) puntaje += ancla.confianza || 0;
  if (ajuste.exacto) puntaje += 1;
  else if (ajuste.acuerdo) puntaje += 0.3;
  return puntaje;
}

/* ¿Es esta página una hoja del formato? Se decide comparándola contra
   las tres plantillas, no por el color ni por cuántas rayas tiene.

   POR QUÉ. `clasificar` exige `color < 0.03` para siquiera considerar
   que algo sea formato. Un escaneo con fondo rosado o amarillento
   —que es lo normal en una fotocopiadora vieja— pasa de 0.03 y sus
   tres hojas caen a "documento". En la pestaña Verificar eso apenas se
   nota, porque el usuario corrige a mano cuál hoja es cuál; al ordenar
   solo, deja el paquete revuelto y sin avisar.

   La plantilla no depende del color. Medido sobre un paquete real, la
   confianza del mejor calce fue 1.00, 0.95 y 0.95 en las tres hojas
   del formato, y como mucho 0.71 en las cinco que no lo son (el RUT
   escaneado). El umbral va en 0.85, en medio de ese hueco.

   Hacen falta LOS DOS detectores de rayas: con el estricto solo, la
   hoja 1 —que es la más escrita— baja a 0.62 y se cuela por debajo
   del RUT. Es el mismo hallazgo de la v10. */
const CONFIANZA_ES_FORMATO = 0.85;

/* Las rayas toleranrtes al trazo se calculan UNA vez por página y se
   guardan: detectarlas cuesta lo mismo que el resto junto, y hacerlo
   tres veces (una por plantilla) triplicaba la espera sin ganar nada. */
function lineasTolerantes(p) {
  if (!p.lineasTolerantes) {
    p.lineasTolerantes = p.gris
      ? lineasDeLaHoja(p.gris, p.ancho, p.alto, HUECO_TRAZO).lineas
      : [];
  }
  return p.lineasTolerantes;
}

function confianzaDeFormato(p, hoja) {
  if (!REFERENCIA[hoja] || !p.gris) return 0;
  medirRejilla(p);
  const ancla = anclarConBarras(p.barras, REFERENCIA_BARRAS[hoja]);
  let mejor = 0;
  for (const lineas of [p.lineas, lineasTolerantes(p)]) {
    const ajuste = emparejar(lineas, REFERENCIA[hoja], undefined, ancla);
    if (ajuste && ajuste.confianza > mejor) mejor = ajuste.confianza;
  }
  return mejor;
}

/* Solo para ordenar un montón sin armar. En la pestaña Verificar no se
   usa: allí el reparto de hojas ya se hace con la plantilla y el
   usuario puede corregirlo. */
function identificarFormatos(paginas, alProgresar) {
  paginas.forEach(function (p, i) {
    if (alProgresar) alProgresar(i + 1, paginas.length);
    if (p.esRut) return;                 // el RUT digital se sabe por el texto
    /* Filtro barato para no gastar el emparejador en una fotografía.
       0.20 deja pasar de sobra una cédula escaneada (0.084) y una
       fachada (0.147): esas se descartan solas al no calzar. */
    if (p.color >= 0.20) return;
    let mejor = { hoja: null, confianza: 0 };
    for (const hoja of HOJAS) {
      const c = confianzaDeFormato(p, hoja);
      if (c > mejor.confianza) mejor = { hoja: hoja, confianza: c };
    }
    p.confianzaFormato = mejor.confianza;
    if (mejor.confianza >= CONFIANZA_ES_FORMATO) {
      p.tipo = "formato";
      p.hojaSugerida = mejor.hoja;
    }
    /* Si la plantilla no lo respalda NO se degrada: la clasificación
       por píxeles se queda como estaba. Las dos vías tienen fallos
       distintos —una se rompe con el papel claro, la otra con un
       escaneo muy torcido— y sumarlas atrapa más que cualquiera sola. */
  });
}

/* Cuál de las páginas sueltas es la foto del local.

   NO SE PUEDE POR UMBRAL. Medido sobre un paquete real, mirando solo
   la parte no blanca de cada página: cédula 0.156 y 0.164 de píxeles
   con color, fachada 0.190. Y la saturación media, 26.7 y 25.8 contra
   32.3. Están demasiado cerca; cualquier umbral fijo acierta en unos
   paquetes y falla en otros. Con el umbral de 0.10 sobre la página
   entera, una fachada fotografiada en vertical —con franjas blancas a
   los lados al meterla en una A4— se quedaba por debajo y acababa
   antes que la cédula.

   SÍ SE PUEDE POR COMPARACIÓN. Dentro de un mismo paquete la fachada
   es la más colorida de largo: 0.147 contra 0.084 y 0.070 sobre la
   página entera, o sea 1.75 veces la siguiente. Se elige la máxima y
   se exige que saque al menos un 30% a la segunda; si no lo saca, no
   se señala ninguna y todas se quedan como documentos, en el orden en
   que llegaron. Es una comparación dentro del paquete, no un número
   traído de fuera.

   Se compara `colorCubierto` —color medido solo sobre la parte no
   blanca— y no `color` sobre la página entera. Es lo que arregla el
   caso que falló: una fachada apaisada metida en una A4 lleva franjas
   blancas arriba y abajo, su color sobre la página entera baja casi a
   la mitad y quedaba por debajo de la cédula. Sobre lo cubierto no se
   diluye. Cédula 0.156 y 0.164, fachada 0.190.

   El margen es del 10%: entre las dos cédulas hay un 5% de diferencia
   y entre la cédula y la fachada un 16%, así que 10% cae en medio. Es
   estrecho, y por eso el aviso SIEMPRE dice qué eligió: si se equivoca,
   se arregla arrastrando una vez.

   El piso de 0.05 está para el caso de un paquete sin foto ni cédula.
   Las hojas del formato dan 0.002 y el RUT escaneado 0.004. */
const COLOR_MINIMO_FOTO = 0.05;
const VENTAJA_FOTO = 1.10;

function elegirFotoDelLocal(paginas) {
  const sueltas = paginas.filter(function (p) {
    return p.tipo !== "formato" && p.tipo !== "rut";
  });
  sueltas.forEach(function (p) { p.tipo = "documento"; });
  if (!sueltas.length) return null;

  const medida = function (p) { return p.colorCubierto != null ? p.colorCubierto : p.color; };
  const porColor = sueltas.slice().sort(function (a, b) { return medida(b) - medida(a); });
  const primera = porColor[0];
  const segunda = porColor[1];
  if (medida(primera) < COLOR_MINIMO_FOTO) return null;
  if (segunda && medida(primera) < medida(segunda) * VENTAJA_FOTO) return null;

  primera.tipo = "foto";
  return primera;
}

/* Reparto que maximiza el calce total. Con tres hojas y pocas páginas
   se pueden probar todas las combinaciones sin pensarlo mucho. */
function repartirHojas(paginas) {
  const tabla = paginas.map(function (p) {
    return HOJAS.map(function (h) { return calceConPlantilla(p, h); });
  });

  let mejor = null;
  const usadas = new Array(paginas.length).fill(false);
  const eleccion = {};

  (function probar(iHoja, suma) {
    if (iHoja === HOJAS.length) {
      if (!mejor || suma > mejor.suma) {
        mejor = { suma: suma, mapa: Object.assign({}, eleccion) };
      }
      return;
    }
    let alguna = false;
    for (let i = 0; i < paginas.length; i++) {
      if (usadas[i] || tabla[i][iHoja] <= 0) continue;
      alguna = true;
      usadas[i] = true; eleccion[HOJAS[iHoja]] = i;
      probar(iHoja + 1, suma + tabla[i][iHoja]);
      usadas[i] = false; delete eleccion[HOJAS[iHoja]];
    }
    /* Una hoja puede no estar en el paquete: se deja sin asignar. */
    if (!alguna || paginas.length < HOJAS.length) probar(iHoja + 1, suma);
  })(0, 0);

  return mejor && mejor.suma > 0 ? mejor.mapa : null;
}

/* Respaldo: el método de la tinta, que es el que había. */
function repartirPorTinta(hojas) {
  if (hojas.length < 2) return;
  const porVacia = hojas.slice().sort(function (a, b) { return a.mitadInferior - b.mitadInferior; });
  porVacia[0].hoja = "3/3";
  const resto = hojas.filter(function (h) { return h.hoja !== "3/3"; });
  const porFirma = resto.slice().sort(function (a, b) { return b.zonaFirma - a.zonaFirma; });
  if (porFirma[0]) porFirma[0].hoja = "2/3";
  if (porFirma[1]) porFirma[1].hoja = "1/3";
  porFirma.slice(2).forEach(function (h) { h.hoja = "extra"; });
}

function etiquetarHojasFormato(paginas) {
  const hojas = paginas.filter(function (p) { return p.tipo === "formato"; });
  hojas.forEach(function (h) {
    h.mitadInferior = (h.bandas[3] + h.bandas[4] + h.bandas[5]) / 3;
    h.zonaFirma = h.bandasIzq[5];
    h.hoja = null;
    try { medirRejilla(h); } catch (e) { h.barras = []; h.lineas = []; }
  });
  if (!hojas.length) return;

  let mapa = null;
  try { mapa = repartirHojas(hojas); } catch (e) { mapa = null; }

  if (mapa) {
    Object.keys(mapa).forEach(function (h) { hojas[mapa[h]].hoja = h; });
    hojas.forEach(function (h) { if (!h.hoja) h.hoja = "extra"; });
    return;
  }
  repartirPorTinta(hojas);
}

/* Umbrales medidos, no inventados. */
const UMBRAL = {
  paginaEnBlanco: 0.0015,   // la cédula más tenue del lote marcó 0.4%
  escaneoLavado: 0.60,      // dos RUT fotografiados marcaron 62.8% y 88.1%
  zonaFirmaConTinta: 0.008, // hojas de autorización firmadas: 1.4% a 3.8%
};

/* Mide las casillas de UNA hoja. Sale aparte para poder rehacerlo
   cuando quien revisa pide pintar la rejilla de una hoja que no llegó
   a exacta: en ese caso los recuadros pueden estar corridos, y por eso
   se marca `p.rejillaForzada` y la interfaz lo advierte. */
function medirCasillasDe(p) {
  if (!p.ajuste || !p.gris) return false;
  const bin = binarizar(p.gris, p.ancho, p.alto);

  p.casillas = {};
  for (const campo of Object.keys(CAMPOS)) {
    if (CAMPOS[campo].hoja !== p.hoja) continue;
    const caja = ubicarCampo(campo, p.ajuste);
    if (!caja) continue;
    const t = tintaEnCampo(bin, p.ancho, p.alto, caja, CAMPOS[campo].zona);
    if (t != null) p.casillas[campo] = t;
  }

  /* Todas las casillas del mapa. Se mide la tinta cruda; quién está
     lleno y quién vacío lo decide después `casillas.js`, que necesita
     el paquete entero para calibrarse. */
  p.tintaMapa = {};
  p.tintaOpciones = {};
  for (const campo of camposDeHoja(p.hoja)) {
    const caja = ubicarDelMapa(campo, p.ajuste);
    if (!caja) continue;
    /* Densidad máxima, no media: ver la nota de densidadMaxima. */
    const t = densidadMaxima(bin, p.ancho, p.alto, caja);
    if (t != null) p.tintaMapa[campo] = t;
    if (MAPA[campo].opciones) {
      p.tintaOpciones[campo] = MAPA[campo].opciones.map(function (_, i) {
        const c = ubicarOpcion(campo, i, p.ajuste);
        return c ? densidadMaxima(bin, p.ancho, p.alto, c) : null;
      });
    }
  }

  /* Celdas a transcribir: un recorte corrido una fila manda a leer la
     casilla de al lado, que es peor que no mandar nada. Por eso estas
     SÍ exigen `exacto`, aunque la rejilla se pinte con menos. */
  p.celdas = [];
  if (!p.ajuste.exacto) return true;
  for (const campo of Object.keys(CELDAS)) {
    if (CELDAS[campo].hoja !== p.hoja) continue;
    const caja = ubicarCelda(campo, p.ajuste);
    if (caja) p.celdas.push(Object.assign({ pagina: p.n }, caja));
  }
  return true;
}

/* Estado de cada casilla del mapa, para todo el paquete.
   Va después de ubicar las rejillas porque la calibración necesita
   las tres hojas juntas: las casillas que siempre van vacías están en
   la 2 y en la 3, y sirven de referencia también para la 1. */
function evaluarCasillas(paginas) {
  const medidas = {}, opciones = {}, hojaDe = {};
  for (const p of paginas) {
    if (!p.tintaMapa) continue;
    for (const campo of Object.keys(p.tintaMapa)) {
      medidas[campo] = p.tintaMapa[campo];
      hojaDe[campo] = p.n;
    }
    for (const campo of Object.keys(p.tintaOpciones || {})) {
      opciones[campo] = p.tintaOpciones[campo];
    }
  }
  if (!Object.keys(medidas).length) return null;

  const cal = calibrarVacio(medidas);
  const campos = {};
  for (const campo of Object.keys(MAPA)) {
    const m = MAPA[campo];
    if (medidas[campo] == null) continue;
    let r;
    if (m.clase === "grupo") r = estadoDeGrupo(opciones[campo] || []);
    else r = estadoPorTinta(campo, medidas, cal);
    campos[campo] = {
      campo: campo, etiqueta: m.etiqueta, clase: m.clase, hoja: m.hoja,
      pagina: hojaDe[campo], tinta: medidas[campo],
      estado: r.estado, z: r.z != null ? r.z : null,
      marcadas: r.marcadas || null,
      color: m.clase === "pendiente" ? "gris" : colorDe(m.clase, r.estado),
      fuente: "tinta",
    };
  }
  return { calibracion: cal, campos: campos };
}

/* ---------- análisis completo ---------- */
async function analizarPdf(archivo, alProgresar, opciones) {
  opciones = opciones || {};
  /* `paraOrdenar` = el PDF viene sin armar: no se puede suponer nada
     por la posición de las páginas, ni hace falta medir casillas. */
  const paraOrdenar = !!opciones.paraOrdenar;
  const pdfjs = await cargarPdfjs();
  const buffer = await archivo.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const paginas = [];
  let rut = null;

  for (let n = 1; n <= doc.numPages; n++) {
    if (alProgresar) alProgresar(n, doc.numPages);
    const pagina = await doc.getPage(n);

    const contenido = await pagina.getTextContent();
    const items = contenido.items
      .filter(function (i) { return i.str && i.str.trim(); })
      .map(function (i) { return { t: i.str, x: i.transform[4], y: i.transform[5] }; });
    const texto = contenido.items.map(function (i) { return i.str; }).join(" ").replace(/\s+/g, " ").trim();

    const vistaBase = pagina.getViewport({ scale: 1 });
    const escala = ANCHO_ANALISIS / vistaBase.width;
    const vista = pagina.getViewport({ scale: escala });
    const ancho = Math.max(1, Math.floor(vista.width));
    const alto = Math.max(1, Math.floor(vista.height));

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ancho, alto);
    await pagina.render({ canvasContext: ctx, viewport: vista }).promise;

    const medidas = medirLienzo(ctx, ancho, alto);
    const gris = grisDe(ctx, ancho, alto);
    const esRut = esPaginaRut(texto);
    if (esRut && !rut) rut = leerRut(items, texto);

    const p = Object.assign({
      n: n,
      ancho: ancho,
      alto: alto,
      apaisada: ancho > alto,
      texto: texto,
      esRut: esRut,
      miniatura: lienzo.toDataURL("image/jpeg", 0.55),
      gris: gris,
    }, medidas);

    p.tipo = clasificar(p);
    paginas.push(p);
  }

  identificarFormatos(paginas, alProgresar);
  if (paraOrdenar) elegirFotoDelLocal(paginas);
  ajustarClasificacion(paginas, !paraOrdenar);
  etiquetarHojasFormato(paginas);
  ubicarRejillas(paginas);
  const casillas = paraOrdenar ? null : evaluarCasillas(paginas);

  return {
    casillas: casillas,
    doc: doc,
    archivo: archivo.name,
    totalPaginas: doc.numPages,
    paginas: paginas,
    rut: rut,
    rutEscaneado: !rut && paginas.some(function (p) { return p.tipo === "documento"; }),
  };
}

/* Escala de grises para el detector de líneas. */
function grisDe(ctx, ancho, alto) {
  const datos = ctx.getImageData(0, 0, ancho, alto).data;
  const gris = new Uint8Array(ancho * alto);
  for (let i = 0, p = 0; i < gris.length; i++, p += 4) {
    gris[i] = (datos[p] * 299 + datos[p + 1] * 587 + datos[p + 2] * 114) / 1000;
  }
  return gris;
}

/* Sobre cada hoja del formato busca la rejilla y la empareja con la
   plantilla. De ahí salen las coordenadas de los recuadros. */
function ubicarRejillas(paginas) {
  paginas.forEach(function (p) {
    ubicarRejillaDe(p);
    /* El gris de las hojas del formato se conserva: si corriges a mano
       cuál hoja es cuál (1/3, 2/3, 3/3) hay que rehacer el ajuste sin
       volver a rasterizar la página. Son ~0.9 MB por hoja, tres hojas.
       En el resto se libera. */
    if (p.tipo !== "formato") p.gris = null;
  });
}

/* Ajuste de UNA página. Se puede volver a llamar si cambia p.hoja. */
function ubicarRejillaDe(p) {
    p.ajuste = null;
    p.casillas = null;
    p.celdas = null;
    if (p.tipo !== "formato" || !p.hoja || !REFERENCIA[p.hoja] || !p.gris) return;
    try {
      /* Dos detectores independientes: las barras de sección dan el
         ancla gruesa (no son periódicas, así que no hay empate) y la
         rejilla de filas afina. Solo si coinciden se promete un
         recuadro exacto. */
      medirRejilla(p);   // ya se midió al repartir las hojas; no se repite
      const ancla = anclarConBarras(p.barras, REFERENCIA_BARRAS[p.hoja]);

      /* Dos candidatos: las rayas vistas con el detector estricto (el
         de siempre, el que reparte las hojas) y con el tolerante, que
         salta el trazo de la letra que cruza la raya. Gana el que se
         pone de acuerdo con las barras; a igualdad, el que calza más
         rayas. En prueba2.pdf la hoja 1 solo llega a exacta con el
         tolerante y la hoja 3 solo con el estricto, así que hacen
         falta los dos. */
      const candidatos = [];
      const conEstricto = emparejar(p.lineas, REFERENCIA[p.hoja], undefined, ancla);
      if (conEstricto) candidatos.push({ ajuste: conEstricto, lineas: p.lineas, hueco: 0 });

      const tolerante = lineasDeLaHoja(p.gris, p.ancho, p.alto, HUECO_TRAZO);
      const conTolerante = emparejar(tolerante.lineas, REFERENCIA[p.hoja], undefined, ancla);
      if (conTolerante) {
        candidatos.push({ ajuste: conTolerante, lineas: tolerante.lineas, hueco: HUECO_TRAZO });
      }

      candidatos.sort(function (a, b) {
        if (!!b.ajuste.acuerdo !== !!a.ajuste.acuerdo) return b.ajuste.acuerdo ? 1 : -1;
        return b.ajuste.confianza - a.ajuste.confianza;
      });
      if (candidatos.length) {
        p.ajuste = candidatos[0].ajuste;
        p.lineasAjuste = candidatos[0].lineas;   // las que dibuja el diagnóstico
        p.huecoAjuste = candidatos[0].hueco;
      }

      /* Se pinta la rejilla siempre que el ajuste sea BUENO, no solo
         cuando es exacto.

         POR QUÉ CAMBIÓ. `exacto` exige además que las barras de
         sección respalden el ajuste, y ese detector es ruidoso: unas
         veces se quedaba sin rejilla la hoja 1, otras la 2, otras la
         3, sin patrón. Desde fuera parecía aleatorio y dejaba la
         verificación inservible.

         Lo que de verdad dice si los recuadros caen en su fila es la
         calidad del ajuste: cuántas rayas calzaron y cuánto se desvía
         la mejor recta. Con el residuo por debajo de media fila no hay
         forma de estar corrido una fila entera. Medido sobre cuatro
         documentos y doce hojas, todas cumplen: confianza de 0.86 a
         1.00 y residuo máximo 0.0049 contra un límite de 0.006.

         `exacto` no desaparece: sigue siendo el sello de calidad que
         decide si se pueden recortar celdas para transcribir, donde un
         recorte corrido sí hace daño de verdad. Pintar un recuadro es
         reversible y se ve; mandar a leer la casilla equivocada, no. */
      if (p.ajuste && p.ajuste.confianza >= 0.75 &&
          p.ajuste.residuo != null && p.ajuste.residuo <= p.ajuste.paso * 0.5) {
        medirCasillasDe(p);
        p.rejillaFiable = !!p.ajuste.exacto;
      }
    } catch (e) {
      p.ajuste = null;
    }
}

/* Cuenta páginas por tipo, ignorando las que el usuario descartó. */
function contarTipos(analisis) {
  const c = { formato: 0, rut: 0, documento: 0, foto: 0 };
  analisis.paginas.forEach(function (p) {
    if (p.tipo in c) c[p.tipo]++;
  });
  return c;
}

/* Solo para las pruebas: el resto del archivo necesita DOM y canvas,
   pero estas dos deciden el orden del paquete y sí se pueden probar
   sueltas. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { elegirFotoDelLocal, medirCasillasDe, COLOR_MINIMO_FOTO, VENTAJA_FOTO,
                     CONFIANZA_ES_FORMATO };
}
