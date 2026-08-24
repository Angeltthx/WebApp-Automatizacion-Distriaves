"use strict";
/* ================================================================
   Pantalla "Diligenciar"

   Dos pestañas:
     · Formato   · llenar, generar, corregir sobre el PDF y descargar
     · Ordenar   · juntar formato, RUT, cédula y foto en un solo PDF

   CÓMO SE LLENA. Primero se responde todo el cuestionario y LUEGO se
   pulsa Generar. La primera versión rehacía el PDF sola mientras se
   escribía y, con el respiro de por medio, el redibujado caía justo
   en mitad de una palabra y sacaba el cursor del campo. Escribir era
   incómodo. Ahora no se regenera nada solo.

   CORREGIR. Sobre el PDF ya generado se hace clic en cualquier dato y
   se edita ahí mismo. Las zonas donde se pincha son LAS MISMAS cajas
   con las que se imprimió, así que lo que se ve y lo que se toca
   coinciden por construcción, no porque alguien las haya cuadrado.
   ================================================================ */

const dil = {
  pestana: "formato",
  tocados: {},          // campos que el usuario cambió a mano
  fase: "formulario",   // formulario | previa
  datos: null,
  pdf: null,
  generando: false,
  error: null,
  hoja: 1,
  editando: null,       // campo abierto sobre el PDF
  leyendoRut: false,
  avisoRut: null,
  autoAbierto: true,        // el bloque de autocompletado, desplegable
  adjuntos: { rut: null, cedula: null },
};

function iniciarDiligenciar() {
  if (dil.datos) return;
  dil.datos = valoresPorDefecto();
  aplicarEspejos();
}

/* Los campos que el formato repite se copian solos. Es la forma
   definitiva de que no vuelvan a salir tres correos distintos: no es
   que se revisen después, es que no se pueden escribir distintos. */
function aplicarEspejos() {
  for (const destino of Object.keys(ESPEJOS)) {
    const origen = ESPEJOS[destino];
    if (dil.datos[origen]) dil.datos[destino] = dil.datos[origen];
  }
  /* Las sugerencias solo se copian mientras nadie haya tocado el
     destino: si el representante lleva otro documento, se pone a mano
     una vez y ya no se vuelve a pisar. */
  for (const destino of Object.keys(SUGERENCIAS)) {
    if (dil.tocados[destino]) continue;
    const valor = dil.datos[SUGERENCIAS[destino]];
    if (valor && sugerenciaValida(destino, valor)) dil.datos[destino] = valor;
  }
  /* La casilla "Municipio" de la hoja 3 lleva el DEPARTAMENTO —así van
     los paquetes ya enviados, con "Cundinamarca" para Bogotá—, así que
     sale de la ciudad. No es una sugerencia normal porque el valor no
     se copia tal cual sino que se traduce, y no cabe en la tabla.

     Si la ciudad no está entre las conocidas se deja lo que hubiera:
     poner el departamento equivocado es peor que no poner ninguno. */
  if (!dil.tocados.municipio) {
    const depto = departamentoDe(dil.datos.ciudad);
    if (depto) dil.datos.municipio = depto;
  }
}

/* Guarda SIN repintar: repintar en cada tecla reconstruye el input y
   el cursor se pierde. El repintado se hace al salir del campo. */
/* Los campos que la app rellena sola. Escribir en uno de ellos cuenta
   como reclamarlo: a partir de ahí la app no lo vuelve a tocar.

   `municipio` está aquí y no en SUGERENCIAS porque su valor no se
   copia de otro campo sino que se traduce (ciudad -> departamento), y
   eso no cabe en aquella tabla. Sin esta lista, un municipio escrito a
   mano se perdía en cuanto se cambiaba de ciudad, y la pantalla no
   decía nada: el dato desaparecía y ya. */
function seRellenaSolo(campo) {
  return !!SUGERENCIAS[campo] || campo === "municipio";
}

function anotarDato(campo, valor) {
  dil.datos[campo] = valor;
  /* Escribirlo a mano cuenta como tocarlo: a partir de ahí ninguna
     sugerencia lo vuelve a pisar. */
  if (seRellenaSolo(campo)) dil.tocados[campo] = true;
  aplicarEspejos();
  const espejo = document.querySelector('[data-espejo-de="' + campo + '"]');
  if (espejo) espejo.value = valor;
}

function elegirOpcion(campo, valor) {
  dil.datos[campo] = valor;
  if (SUGERENCIAS[campo]) dil.tocados[campo] = true;
  aplicarEspejos();
  render();
}

/* ---------------- rellenar desde el RUT ----------------

   El RUT digital de la DIAN trae capa de texto, así que se lee entero
   sin OCR y sin que salga nada del equipo. De ahí salen ocho campos
   del formato con los datos oficiales, que es mejor punto de partida
   que teclearlos.

   LA CÉDULA NO SE LEE, y conviene explicar por qué en vez de fingir
   que sí: es una foto, no trae texto, y lo poco que aportaría —número
   y nombre— ya viene en el RUT y coincide. Leerla con transcripción
   costaría una llamada a la API para confirmar lo que ya se sabe. Si
   algún día llega un caso donde no coincidan, la pestaña Verificar es
   la que tiene que cazarlo, y ya lo hace. */
async function recibirDocumento(clase, archivos) {
  const archivo = archivos && archivos[0];
  if (!archivo) return;
  dil.leyendoRut = clase === "rut";
  dil.avisoRut = null;
  render();

  const esImagen = /^image\/(png|jpeg)$/.test(archivo.type);
  const guardado = {
    nombre: archivo.name,
    peso: archivo.size,
    tipo: esImagen ? "imagen" : "pdf",
    bytes: new Uint8Array(await archivo.arrayBuffer()),
    paginas: null,
    error: null,
  };

  /* Del RUT, además de guardarlo para adjuntarlo, se sacan los datos.
     De la cédula no: es una foto sin texto, y lo único que aportaría
     —número y nombre— ya viene en el RUT. Se guarda para pegarla al
     PDF, que es para lo que sirve. */
  if (clase === "rut" && !esImagen) {
    try {
      const leido = await leerRutDelPdf(guardado.bytes);
      guardado.paginas = leido.paginas;
      if (!leido.rut) {
        dil.avisoRut = "Lo adjunto, pero no pude leerlo: si lo escaneaste en papel no " +
          "trae texto. Para que se rellene solo tiene que ser el PDF de la DIAN.";
      } else {
        const traidos = camposDesdeRut(leido.rut);
        const nombres = [];
        for (const campo of Object.keys(traidos)) {
          dil.datos[campo] = traidos[campo];
          dil.tocados[campo] = true;   // viene de un documento oficial
          nombres.push(etiquetaDeCampo(campo));
        }
        aplicarEspejos();
        dil.avisoRut = "Traje " + nombres.length + " campos: " + nombres.join(", ") +
          ". Revísalos, que el RUT puede estar desactualizado.";
      }
    } catch (e) {
      dil.avisoRut = "No pude abrir el archivo: " + (e && e.message ? e.message : String(e));
    }
  } else if (!esImagen) {
    try { guardado.paginas = (await contarPaginas(guardado.bytes)); } catch (e) { /* da igual */ }
  } else {
    guardado.paginas = 1;
  }

  dil.adjuntos[clase] = guardado;
  dil.leyendoRut = false;
  dil.pdf = null;                  // el PDF armado ya no vale: cambió el paquete
  const entrada = document.getElementById(clase === "rut" ? "inputRut" : "inputCedula");
  if (entrada) entrada.value = "";
  render();
}

async function contarPaginas(bytes) {
  const pdfjs = await cargarPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  return doc.numPages;
}

async function leerRutDelPdf(bytes) {
  const pdfjs = await cargarPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    const texto = contenido.items.map(function (i) { return i.str; })
      .join(" ").replace(/\s+/g, " ").trim();
    if (!esPaginaRut(texto)) continue;
    const items = contenido.items
      .filter(function (i) { return i.str && i.str.trim(); })
      .map(function (i) { return { t: i.str, x: i.transform[4], y: i.transform[5] }; });
    const rut = leerRut(items, texto);
    if (rut) return { rut: rut, paginas: doc.numPages };
  }
  return { rut: null, paginas: doc.numPages };
}

function quitarDocumento(clase) {
  dil.adjuntos[clase] = null;
  if (clase === "rut") dil.avisoRut = null;
  dil.pdf = null;
  render();
}

async function generarFormato() {
  if (dil.generando) return;
  dil.generando = true;
  dil.error = null;
  render();
  try {
    dil.pdf = await generarPdf(dil.datos, dil.adjuntos);
    dil.fase = "previa";
  } catch (e) {
    dil.error = e && e.message ? e.message : String(e);
  }
  dil.generando = false;
  render();
  pintarPreview();
}

function volverAlFormulario() {
  dil.fase = "formulario";
  dil.editando = null;
  render();
}

async function pintarPreview() {
  const lienzo = document.getElementById("previewLienzo");
  if (!lienzo || !dil.pdf) return;
  /* pdf.js se carga bajo demanda (cargarPdfjs en verificador.js). Si
     se entra directo a Diligenciar sin haber analizado ningún
     paquete, `pdfjsLib` todavía es null. */
  const pdfjs = await cargarPdfjs();
  const doc = await pdfjs.getDocument({ data: dil.pdf.slice() }).promise;
  const p = await doc.getPage(Math.min(dil.hoja, doc.numPages));
  const base = p.getViewport({ scale: 1 });
  const disponible = (lienzo.parentElement && lienzo.parentElement.clientWidth) || 900;
  const vista = p.getViewport({ scale: disponible / base.width });
  lienzo.width = Math.ceil(vista.width);
  lienzo.height = Math.ceil(vista.height);
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  await p.render({ canvasContext: ctx, viewport: vista }).promise;
  colocarZonas();
}

/* Una zona pinchable por cada dato de esta hoja, en la misma caja con
   la que se imprimió. */
function colocarZonas() {
  const capa = document.getElementById("previewZonas");
  if (!capa) return;
  capa.innerHTML = "";
  /* Solo las tres primeras páginas son el formato; de la cuarta en
     adelante es el RUT o la cédula, donde no hay nada que editar. */
  const hoja = ["1/3", "2/3", "3/3"][dil.hoja - 1];
  if (!hoja) return;

  for (const campo of camposDelFormulario()) {
    const valor = dil.datos[campo];
    /* Un grupo sin elegir no tiene caja propia; se usa la de la
       primera opción para poder pincharlo y elegir. */
    const referencia = tipoDeCampo(campo) === "grupo" && !valor
      ? opcionesDeCampo(campo)[0] : valor;
    const caja = cajaDeImpresion(campo, referencia || "x");
    if (!caja || caja.hoja !== hoja) continue;

    const z = document.createElement("button");
    z.className = "zona-campo" + (String(valor || "").trim() ? "" : " vacia");
    z.style.left = (caja.x * 100) + "%";
    z.style.width = (Math.max(caja.ancho, 0.018) * 100) + "%";
    z.style.top = (caja.y * 100) + "%";
    z.style.height = (caja.alto * 100) + "%";
    z.title = etiquetaDeCampo(campo) + (valor ? ": " + valor : " (vacío)");
    z.onclick = function (ev) { ev.stopPropagation(); abrirEdicion(campo); };
    capa.appendChild(z);
  }
}

function abrirEdicion(campo) {
  dil.editando = campo;
  render();
  const c = document.getElementById("edicionCampo");
  if (c) { c.focus(); c.select(); }
}

async function guardarEdicion() {
  const campo = dil.editando;
  if (!campo) return;
  const c = document.getElementById("edicionCampo");
  if (c) dil.datos[campo] = c.value;
  aplicarEspejos();
  dil.editando = null;
  await generarFormato();
}

async function elegirEnEdicion(valor) {
  if (!dil.editando) return;
  dil.datos[dil.editando] = valor;
  if (SUGERENCIAS[dil.editando]) dil.tocados[dil.editando] = true;
  aplicarEspejos();
  dil.editando = null;
  await generarFormato();
}

function cerrarEdicion() { dil.editando = null; render(); }

function verHoja(n) { dil.hoja = n; render(); pintarPreview(); }

/* El nombre lo arma `nombreDeArchivoFormato`, en verificar-ui.js, para
   que las dos pantallas dejen los archivos llamados igual.

   Antes esta función tenía su propia limpieza, que borraba todo lo que
   no fuera letra ASCII más una lista corta de acentos. Comprobado
   sobre casos reales: "Comercializadora S.A.S." salía como
   "Comercializadora SAS", "Ñuñez-Pérez" como "ÑuñezPérez" y "Müller"
   como "Mller", porque la diéresis no estaba en la lista. Las tildes y
   la ñ sí las conservaba. La regla nueva quita solo lo que Windows no
   admite en un nombre de archivo, así que el nombre llega entero. */
function descargarFormato() {
  if (!dil.pdf) return;
  descargarBytes(dil.pdf, nombreDeArchivoFormato(dil.datos.nombreRazonSocial));
}

/* ---------------- pintado ---------------- */

function htmlDiligenciar() {
  iniciarDiligenciar();
  const pestanas = '<div class="dil-tabs">' +
    [["formato", "Llenar el formato"], ["ordenar", "Ordenar las hojas"]].map(function (p) {
      return '<button class="dil-tab' + (dil.pestana === p[0] ? " on" : "") + '" ' +
        'onclick="dil.pestana=\'' + p[0] + '\';render()">' + p[1] + '</button>';
    }).join("") + '</div>';
  return pestanas + (dil.pestana === "formato"
    ? (dil.fase === "previa" ? htmlPrevia() : htmlFormulario())
    : htmlOrganizar());
}

function htmlFormulario() {
  const faltan = camposVacios(dil.datos);
  const avisos = avisosDelFormulario(dil.datos);
  const porCampo = {};
  avisos.forEach(function (a) { porCampo[a.campo] = a.aviso; });

  const cargarRut = htmlAutocompletado();

  const secciones = SECCIONES_FORMULARIO.map(function (s) {
    const campos = s.campos.map(function (c) {
      const val = dil.datos[c] == null ? "" : dil.datos[c];
      const espejo = ESPEJOS[c];
      const vacio = !String(val).trim();

      if (tipoDeCampo(c) === "grupo") {
        const ops = opcionesDeCampo(c).map(function (o) {
          return '<button class="op' + (val === o ? " on" : "") + '" ' +
            'onclick="elegirOpcion(\'' + c + '\', \'' + esc(o) + '\')">' + esc(o) + '</button>';
        }).join("");
        return '<div class="campo ancho"><label>' + esc(etiquetaDeCampo(c)) +
          (vacio ? ' <span class="falta">falta</span>' : "") + '</label>' +
          '<div class="ops">' + ops + '</div></div>';
      }
      const aviso = porCampo[c];
      const clase = tipoDeEntrada(c);
      /* Cada campo pide lo suyo: un calendario para las fechas, el
         teclado numérico en el móvil para documentos y teléfonos, y el
         de correo para los correos. Un `type="date"` además impide de
         entrada las fechas imposibles, que es mejor que avisarlas
         después. */
      const atributos =
        clase === "date" ? 'type="date"' :
        clase === "email" ? 'type="email" inputmode="email" autocomplete="off"' :
        clase === "tel" ? 'type="text" inputmode="tel" pattern="[0-9]*"' :
        clase === "numerico" ? 'type="text" inputmode="numeric" pattern="[0-9]*"' :
        'type="text"';
      return '<div class="campo' + (aviso ? " con-aviso" : "") + '"><label>' +
        esc(etiquetaDeCampo(c)) +
        (espejo ? ' <span class="espejo">se copia solo</span>' : "") +
        (SUGERENCIAS[c] && !dil.tocados[c] ? ' <span class="espejo">copiado</span>' : "") +
        (vacio && !espejo ? ' <span class="falta">falta</span>' : "") + '</label>' +
        '<input ' + atributos + ' value="' + esc(String(val)) + '"' +
        (espejo ? ' disabled data-espejo-de="' + espejo + '"' : "") +
        ' oninput="anotarDato(\'' + c + '\', this.value)" onblur="render()">' +
        htmlAtajos(c, val) +
        (aviso ? '<span class="aviso-campo">' + esc(aviso) + '</span>' : "") + '</div>';
    }).join("");
    return '<div class="panel"><div class="panel-head"><h2>' + esc(s.titulo) + '</h2></div>' +
      '<div class="campos-rejilla">' + campos + '</div></div>';
  }).join("");

  const pie = '<div class="dil-pie">' +
    htmlLetras() +
    (dil.error ? '<div class="form-error">' + svg("alert", 14) + " " + esc(dil.error) + '</div>' : "") +
    (avisos.length
      ? '<p class="ayuda aviso"><b>' + avisos.length + ' con pinta de error:</b> ' +
        esc(avisos.slice(0, 6).map(function (a) { return a.etiqueta; }).join(", ")) +
        (avisos.length > 6 ? "…" : "") + '</p>'
      : "") +
    (faltan.length
      ? '<p class="ayuda"><b>Faltan ' + faltan.length + ':</b> ' +
        esc(faltan.slice(0, 8).map(etiquetaDeCampo).join(", ")) + (faltan.length > 8 ? "…" : "") +
        ' — puedes generar igual y completarlas después haciendo clic sobre el PDF.</p>'
      : '<p class="ayuda">Están todas las casillas que se llenan a máquina. La firma y la huella van a mano.</p>') +
    '<button class="btn btn-primary btn-ancho" onclick="generarFormato()">' +
    (dil.generando ? "Armando el formato…" : "Generar el formato") + '</button></div>';

  return cargarRut + secciones + pie;
}

/* ---------------- atajos de campo (v31) ----------------

   Botoncitos debajo de un campo de texto con los valores que se
   repiten. NO cierran el campo: sigue siendo texto libre, y el atajo
   solo evita teclear lo de siempre. Un cliente en un barrio con otro
   código postal, o en una ciudad que no está en la lista, se escribe a
   mano igual que antes.

   El botón puede enseñar una cosa y escribir otra: la zona de
   transporte se elige por el barrio ("25-L104 (Suba)") y en el papel
   cae solo el código, que es lo que el formato espera. */
function htmlAtajos(campo, valor) {
  const atajos = ATAJOS[campo];
  if (!atajos || !atajos.length) return "";
  const botones = atajos.map(function (a) {
    return '<button class="atajo' + (String(valor) === a.valor ? " on" : "") + '" ' +
      'onclick="usarAtajo(\'' + campo + '\', \'' + esc(a.valor) + '\')">' +
      esc(a.etiqueta) + '</button>';
  }).join("");
  return '<div class="atajos">' + botones + '</div>';
}

function usarAtajo(campo, valor) {
  /* Pulsar un atajo cuenta como escribirlo: a partir de ahí ninguna
     sugerencia lo vuelve a pisar. Sin esto, elegir una ciudad y que la
     copia automática la borrase acto seguido sería exactamente el tipo
     de fallo que no se ve hasta que el formato está impreso. */
  anotarDato(campo, valor);
  aplicarEspejos();
  render();
}

/* ---------------- elegir la letra (v30, con muestra desde la v32) ----

   Las tres están medidas y la comparación vive en el catálogo LETRAS
   de formulario.js. Aquí solo se enseñan y se elige.

   CADA OPCIÓN SE ESCRIBE EN SU PROPIA LETRA, y con el nombre del
   cliente que se está escribiendo ahora mismo. Hasta la v31 eran tres
   botones que ponían "Short Stack", "Gochi Hand" y "Permanent Marker"
   en la letra de la pantalla: había que elegir una tipografía sin
   verla, generar el formato y volver atrás si no gustaba. Ahora se ve
   antes de decidir, y se ve con el dato de verdad, que es donde se
   nota si una letra gruesa aprieta un nombre largo.

   El tamaño de cada muestra sale de `escala`, medido con la misma
   cuenta que el PDF. Sin eso, la muestra mentiría: Gochi Hand se veía
   más pequeña en la pantalla y salía más grande en el papel.

   El cuerpo base es 15 px y no más: en una tarjeta de un tercio del
   ancho, un nombre completo a 19 px se cortaba por la mitad en las
   tres, y entonces la muestra ya no enseña la letra sino el corte. Lo
   que no quepa se corta con puntos suspensivos, que además avisa de
   que el nombre es largo. El nombre entero está en su campo, arriba.

   Cambiar de letra TIRA el PDF ya generado (`dil.pdf = null`): si no,
   la pantalla seguiría enseñando la vista previa vieja y parecería
   que el botón no hizo nada. */
function htmlLetras() {
  const actual = letraActual();
  /* La muestra usa el nombre del cliente. Si aún no hay, se usa quien
     firma: es un nombre real, con tilde y de largo parecido, y así la
     muestra nunca sale vacía ni con un "AaBbCc" que no dice nada. */
  const muestra = String(dil.datos.nombreRazonSocial || "").trim() || RESPONSABLE_COMERCIAL;

  const tarjetas = LETRAS.map(function (l) {
    const puesta = l.id === actual.id;
    return '<button class="letra-op' + (puesta ? " on" : "") + '" ' +
      'aria-pressed="' + puesta + '" ' +
      'onclick="usarLetra(\'' + l.id + '\')">' +
      '<span class="letra-muestra" style="font-family:\'' + l.id + '\',cursive;' +
      'font-size:' + (15 * l.escala).toFixed(1) + 'px">' + esc(muestra) + '</span>' +
      '<span class="letra-pie">' +
      '<span class="letra-nombre">' + esc(l.nombre) + '</span>' +
      '<span class="letra-nota">' + esc(l.pista) + '</span>' +
      '</span></button>';
  }).join("");

  return '<div class="campo ancho dil-letra">' +
    '<label>Letra del formato</label>' +
    '<div class="letra-ops">' + tarjetas + '</div></div>';
}

function usarLetra(id) {
  if (!elegirLetra(id)) return;
  /* La previa de la letra vieja ya no vale. */
  dil.pdf = null;
  dil.fase = "formulario";
  render();
}

/* Llena el cuestionario con el juego de prueba de formulario.js.
   Sirve para mirar la letra y la colocación sin escribir treinta y
   ocho campos.

   Marca todos los campos como TOCADOS a propósito: si no, la copia
   automática del documento y el nombre del representante pisaría lo
   que acaba de ponerse, y el juego de prueba dejaría de ser el que
   está escrito en el código. */
function llenarDePrueba() {
  dil.datos = datosDePrueba();
  dil.tocados = {};
  for (const campo of Object.keys(DATOS_DE_PRUEBA)) dil.tocados[campo] = true;
  aplicarEspejos();
  dil.pdf = null;
  dil.fase = "formulario";
  dil.error = null;
  render();
  toast("check", "Cuestionario lleno con datos de prueba. No los mandes a nadie.");
}

/* Bloque desplegable de autocompletado: dos zonas separadas, RUT y
   cédula, cada una mostrando qué tiene cargado. */
function htmlAutocompletado() {
  const puestos = ["rut", "cedula"].filter(function (k) { return dil.adjuntos[k]; }).length;

  if (!dil.autoAbierto) {
    return '<div class="panel auto-cerrado" onclick="dil.autoAbierto=true;render()">' +
      svg("upload", 15) + '<span><b>Autocompletar desde el RUT</b> y adjuntar la cédula' +
      (puestos ? ' · ' + puestos + ' cargado' + (puestos > 1 ? "s" : "") : "") + '</span>' +
      '<span class="hint">abrir</span></div>';
  }

  return '<div class="panel"><div class="panel-head"><h2>Autocompletado</h2>' +
    '<button class="hint hint-btn" onclick="dil.autoAbierto=false;render()">ocultar</button></div>' +
    '<p class="s">Suelta aquí el RUT y la cédula. Del RUT saco los datos que pueda, y ' +
    'los dos quedan pegados al final del PDF para que salga el paquete completo.</p>' +
    '<div class="auto-zonas">' +
    htmlZonaDoc("rut", "RUT", "PDF de la DIAN, no un escaneo") +
    htmlZonaDoc("cedula", "Cédula", "PDF o foto, las dos caras") +
    '</div>' +
    (dil.avisoRut ? '<p class="ayuda">' + esc(dil.avisoRut) + '</p>' : "") +
    /* El juego de prueba vive aquí porque es la tercera forma de que
       aparezcan datos en el cuestionario, junto al RUT y la cédula.

       Hasta la v31 era un enlace subrayado en mitad de un párrafo, o
       sea lo mismo que esconderlo. Ahora es un botón, pero de la fila
       de abajo y en tono de aviso: lo que llena son datos falsos, y
       eso tiene que verse ANTES de pulsarlo, no en el toast de
       después. */
    '<div class="dil-prueba">' +
    '<button class="btn-prueba" onclick="llenarDePrueba()">' +
    svg("edit", 13) + ' Llenar con datos de prueba</button>' +
    '<span class="dil-prueba-nota">Cliente de Prueba, ejemplo.com. ' +
    'Sirve para ver cómo queda la letra; no vale para un paquete real.</span>' +
    '</div>' +
    '</div>';
}

function pesoLegible(bytes) {
  if (!bytes) return "";
  return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + " MB"
                         : Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function htmlZonaDoc(clave, titulo, pista) {
  const a = dil.adjuntos[clave];
  const entrada = clave === "rut" ? "inputRut" : "inputCedula";
  const acepta = clave === "rut" ? "application/pdf"
                                 : "application/pdf,image/png,image/jpeg";

  if (a) {
    return '<div class="auto-doc puesto">' +
      '<div class="auto-tic">' + svg("check", 15) + '</div>' +
      '<div class="auto-txt"><b>' + esc(titulo) + '</b>' +
      '<span>' + esc(a.nombre) + '</span>' +
      '<span class="hint">' + pesoLegible(a.peso) +
      (a.paginas ? ' · ' + a.paginas + (a.paginas > 1 ? " páginas" : " página") : "") +
      '</span>' +
      (a.error ? '<span class="aviso-campo">' + esc(a.error) + '</span>' : "") +
      '</div>' +
      '<button class="auto-x" title="Quitar" onclick="quitarDocumento(\'' + clave + '\')">&#215;</button>' +
      '</div>';
  }

  return '<div class="auto-doc" ondragover="event.preventDefault();this.classList.add(\'encima\')" ' +
    'ondragleave="this.classList.remove(\'encima\')" ' +
    'ondrop="event.preventDefault();this.classList.remove(\'encima\');recibirDocumento(\'' +
    clave + '\', event.dataTransfer.files)">' +
    '<input type="file" id="' + entrada + '" accept="' + acepta + '" hidden ' +
    'onchange="recibirDocumento(\'' + clave + '\', this.files)">' +
    '<div class="auto-txt"><b>' + esc(titulo) + '</b><span class="hint">' + esc(pista) + '</span></div>' +
    '<button class="btn btn-ghost btn-min" onclick="document.getElementById(\'' + entrada + '\').click()">' +
    (dil.leyendoRut && clave === "rut" ? "Leyendo…" : "Elegir") + '</button></div>';
}

/* Cuántas páginas tiene el PDF armado: las tres del formato más las
   que traigan los adjuntos. Sin esto, los botones de hoja se quedaban
   en 1-2-3 y no había forma de mirar el RUT pegado. */
function paginasDelPreview() {
  let total = 3;
  for (const clave of ["rut", "cedula"]) {
    const a = dil.adjuntos[clave];
    if (a && !a.error) total += a.paginas || 1;
  }
  const lista = [];
  for (let i = 1; i <= total; i++) lista.push(i);
  return lista;
}

function htmlPrevia() {
  return '<div class="panel dil-previa-panel">' +
    '<div class="panel-head"><h2>Formato armado</h2>' +
    '<span class="hint">' + paginasDelPreview().map(function (n) {
      return '<button class="hoja-btn' + (dil.hoja === n ? " on" : "") + '" onclick="verHoja(' + n + ')">' + n + '</button>';
    }).join("") + '</span></div>' +
    (dil.error ? '<div class="form-error">' + svg("alert", 14) + " " + esc(dil.error) + '</div>' : "") +
    '<p class="ayuda">Haz clic sobre cualquier dato del formato para corregirlo. ' +
    'Las casillas con borde punteado están vacías.</p>' +
    '<div class="previa-envoltura">' +
    '<canvas id="previewLienzo"></canvas>' +
    '<div class="previa-zonas" id="previewZonas"></div>' +
    htmlEdicion() +
    '</div>' +
    '<div class="dil-acciones">' +
    '<button class="btn btn-primary" onclick="descargarFormato()">' +
    svg("download", 14) + ' Descargar para imprimir y firmar</button>' +
    '<button class="btn btn-ghost" onclick="volverAlFormulario()">Volver al cuestionario</button>' +
    '</div></div>';
}

function htmlEdicion() {
  const campo = dil.editando;
  if (!campo) return "";
  const caja = cajaDeImpresion(campo, dil.datos[campo] || opcionesDeCampo(campo)[0] || "x");
  if (!caja) return "";

  const cuerpo = tipoDeCampo(campo) === "grupo"
    ? '<div class="ops">' + opcionesDeCampo(campo).map(function (o) {
        return '<button class="op' + (dil.datos[campo] === o ? " on" : "") + '" ' +
          'onclick="elegirEnEdicion(\'' + esc(o) + '\')">' + esc(o) + '</button>';
      }).join("") + '</div>'
    : '<div class="ed-fila"><input id="edicionCampo" type="text" value="' +
      esc(String(dil.datos[campo] || "")) + '" ' +
      'onkeydown="if(event.key===\'Enter\'){guardarEdicion()}if(event.key===\'Escape\'){cerrarEdicion()}">' +
      '<button class="btn btn-primary btn-min" onclick="guardarEdicion()">Listo</button></div>';

  /* El cuadro se abre debajo del dato, salvo que el dato esté ya muy
     abajo: entonces se abre encima, o se saldría de la hoja. */
  const abajo = caja.y > 0.72;
  return '<div class="edicion-flotante' + (abajo ? " arriba" : "") + '" style="left:' +
    (Math.min(caja.x, 0.72) * 100) + '%;top:' +
    ((abajo ? caja.y : caja.y + caja.alto) * 100) + '%">' +
    '<div class="ed-tit">' + esc(etiquetaDeCampo(campo)) +
    '<button class="ed-x" onclick="cerrarEdicion()">&#215;</button></div>' +
    cuerpo + '</div>';
}

/* ---------------- ordenar las hojas ---------------- */

function htmlOrganizar() {
  const hojas = org.hojas.map(function (h, i) {
    return '<div class="org-hoja" draggable="true" data-id="' + h.id + '"' +
      ' ondragstart="arrastreInicio(event,\'' + h.id + '\')"' +
      ' ondragover="arrastreEncima(event,\'' + h.id + '\')"' +
      ' ondrop="arrastreSuelta(event)"' +
      ' ondragend="arrastreFin()">' +
      '<div class="org-n num">' + (i + 1) + '</div>' +
      (h.miniatura ? '<img src="' + h.miniatura + '" alt="" draggable="false" ' +
                     'style="transform:rotate(' + h.rotacion + 'deg)">'
                   : '<div class="org-cargando"></div>') +
      '<div class="org-nom">' + esc(h.nombre) + '</div>' +
      '<div class="org-btns">' +
      '<button onclick="girarHoja(\'' + h.id + '\');render()" title="Girar">&#8635;</button>' +
      '<button onclick="quitarHoja(\'' + h.id + '\');render()" title="Quitar">&#215;</button>' +
      '</div></div>';
  }).join("");

  return '<div class="panel">' +
    '<div class="panel-head"><h2>Hojas del paquete</h2>' +
    (org.hojas.length ? '<span class="hint">' + org.hojas.length + '</span>' : "") + '</div>' +
    (org.error ? '<div class="form-error">' + svg("alert", 14) + " " + esc(org.error) + '</div>' : "") +
    '<p class="s">Suelta aquí el formato, el RUT, la cédula y la foto del local. ' +
    'Después arrastra las hojas para ponerlas en orden. Nada sale de tu equipo.</p>' +
    '<div class="org-zona" ondragover="event.preventDefault()" ondrop="soltarArchivos(event)">' +
    '<input type="file" id="inputOrg" accept="application/pdf,image/png,image/jpeg" multiple hidden ' +
    'onchange="cargarEnOrganizador(this.files)">' +
    '<button class="btn btn-ghost" onclick="document.getElementById(\'inputOrg\').click()">Buscar archivos</button>' +
    '<p class="s" style="margin:8px 0 0">o suéltalos aquí</p></div>' +
    (org.cargando ? '<p class="s">Cargando…</p>' : "") +
    (org.ordenando ? '<p class="s" id="progresoOrden">Mirando qué es cada hoja…</p>' : "") +
    (org.aviso ? '<p class="ayuda">' + esc(org.aviso) + '</p>' : "") +
    (org.hojas.length ? '<div class="org-lista">' + hojas + '</div>' +
      '<div class="dil-acciones">' +
      '<button class="btn btn-ghost" onclick="ordenarAutomatico()">' +
      svg("gauge", 14) + ' Ordenar solo</button>' +
      '<button class="btn btn-primary" onclick="descargarOrganizado()">' +
      svg("download", 14) + ' Descargar el paquete en un solo PDF</button>' +
      '<button class="btn btn-ghost" onclick="verificarLoOrganizado()">' +
      svg("shield", 14) + ' Verificarlo ahora</button>' +
      '<button class="btn btn-ghost" onclick="reiniciarOrganizador();render()">Empezar de nuevo</button></div>'
      : "") +
    '</div>';
}

/* Arrastrar y soltar. La lista se reordena EN VIVO al pasar por
   encima, así se ve dónde va a caer la hoja antes de soltarla. */
let arrastrando = null;

function arrastreInicio(ev, id) {
  arrastrando = id;
  ev.dataTransfer.effectAllowed = "move";
  try { ev.dataTransfer.setData("text/plain", id); } catch (e) { /* navegadores viejos */ }
  const nodo = ev.currentTarget;
  setTimeout(function () { nodo.classList.add("arrastrando"); }, 0);
}

function arrastreEncima(ev, id) {
  ev.preventDefault();
  if (!arrastrando || arrastrando === id) return;
  const desde = org.hojas.findIndex(function (h) { return h.id === arrastrando; });
  const hasta = org.hojas.findIndex(function (h) { return h.id === id; });
  if (desde < 0 || hasta < 0) return;
  const movida = org.hojas.splice(desde, 1)[0];
  org.hojas.splice(hasta, 0, movida);
  render();
  /* Tras repintar, el nodo es otro: hay que volver a marcarlo o el
     usuario pierde de vista cuál está moviendo. */
  const nodo = document.querySelector('.org-hoja[data-id="' + arrastrando + '"]');
  if (nodo) nodo.classList.add("arrastrando");
}

function arrastreSuelta(ev) { ev.preventDefault(); arrastreFin(); }

function arrastreFin() {
  arrastrando = null;
  document.querySelectorAll(".org-hoja.arrastrando").forEach(function (n) {
    n.classList.remove("arrastrando");
  });
  render();
}

function soltarArchivos(ev) {
  ev.preventDefault();
  if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) {
    cargarEnOrganizador(ev.dataTransfer.files);
  }
}

async function cargarEnOrganizador(archivos) {
  if (!archivos || !archivos.length) return;
  org.cargando = true;
  org.error = null;
  render();
  try {
    for (const a of archivos) await agregarArchivo(a);
    for (const h of org.hojas) await miniaturaDe(h, 150);
  } catch (e) {
    org.error = e && e.message ? e.message : String(e);
  }
  org.cargando = false;
  const entrada = document.getElementById("inputOrg");
  if (entrada) entrada.value = "";
  render();
}

async function ordenarAutomatico() {
  if (org.ordenando || org.hojas.length < 2) return;
  org.ordenando = true;
  org.error = null;
  org.aviso = null;
  render();
  try {
    const r = await ordenarSolo(function (hecho, total) {
      const n = document.getElementById("progresoOrden");
      if (n) n.textContent = "Mirando la hoja " + hecho + " de " + total + "…";
    });
    const avisos = [];
    avisos.push(r.movidas ? "Moví " + r.movidas + " hoja(s)." : "Ya estaban en ese orden.");
    if (r.dudosas) avisos.push("No identifiqué " + r.dudosas + ", quedaron al final.");
    avisos.push(r.fotos
      ? "La última es la que tomé por la foto del local; las cédulas van justo antes."
      : "No encontré ninguna foto del local, así que dejé las hojas sueltas como estaban.");
    org.aviso = avisos.join(" ");
  } catch (e) {
    org.error = e && e.message ? e.message : String(e);
  }
  org.ordenando = false;
  render();
}

/* ---------------- del ordenador al verificador ----------------

   Armar el paquete y revisarlo son dos pasos del mismo trabajo, así
   que no tiene sentido obligar a descargar el PDF y volver a soltarlo
   en la otra pestaña. Se le pasa el archivo en memoria.

   `recibirArchivo` espera algo con nombre terminado en .pdf, así que
   no vale un Blob pelado: hace falta un File. */
async function verificarLoOrganizado() {
  if (!org.hojas.length || org.ordenando) return;
  org.ordenando = true;
  org.error = null;
  render();

  let bytes;
  try {
    bytes = await exportarOrganizado();
  } catch (e) {
    org.error = e && e.message ? e.message : String(e);
    org.ordenando = false;
    return render();
  }
  org.ordenando = false;

  await animarEntrega();

  const archivo = new File([bytes], "Paquete ordenado.pdf", { type: "application/pdf" });
  ver.archivoOriginal = archivo;
  setVista("verificar");
  await recibirArchivo(archivo);
}

/* Las hojas se apilan sobre la primera y el montón se va hacia la
   pestaña de Verificar. No es adorno gratuito: dice sin palabras que
   lo que estabas ordenando es lo que se va a revisar, y tapa el rato
   en que el navegador está armando el PDF.

   Si el sistema pide menos movimiento, se salta entera. */
function animarEntrega() {
  const menosMovimiento = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tarjetas = Array.prototype.slice.call(document.querySelectorAll(".org-hoja"));
  if (menosMovimiento || !tarjetas.length) return Promise.resolve();

  const destino = tarjetas[0].getBoundingClientRect();
  const cajas = tarjetas.map(function (t) { return t.getBoundingClientRect(); });

  /* Poner la clase con la transición y el transform en el mismo tick
     no anima nada: el navegador junta los dos cambios y salta directo
     al estado final. Hay que forzar un reflow entre medias para que
     calcule el estado de partida. Era el motivo de que no se viera
     absolutamente ninguna animación. */
  tarjetas.forEach(function (t) { t.classList.add("volando"); });
  void tarjetas[0].offsetWidth;

  tarjetas.forEach(function (t, i) {
    const caja = cajas[i];
    t.style.transitionDelay = (i * 45) + "ms";
    /* Cada tarjeta viaja hasta donde está la primera y se encoge un
       poco: el resultado se ve como un mazo de hojas juntándose. */
    t.style.transform = "translate(" + (destino.left - caja.left) + "px," +
      (destino.top - caja.top) + "px) scale(.82) rotate(" + ((i % 3) - 1) * 1.5 + "deg)";
    t.style.opacity = i === 0 ? "1" : String(Math.max(0.15, 1 - i * 0.12));
    t.style.zIndex = String(40 - i);
  });

  const sello = document.createElement("div");
  sello.className = "org-sello";
  sello.style.left = (destino.left + destino.width / 2) + "px";
  sello.style.top = (destino.top + destino.height / 2) + "px";
  sello.innerHTML = svg("shield", 26);
  document.body.appendChild(sello);

  return new Promise(function (listo) {
    setTimeout(function () {
      sello.classList.add("late");
    }, 380);
    setTimeout(function () {
      sello.remove();
      /* Las tarjetas se dejan como estaban: al cambiar de vista se
         repintan solas, pero si el usuario vuelve sin repintado se
         encontraría el mazo apilado. */
      tarjetas.forEach(function (t) {
        t.classList.remove("volando");
        t.style.cssText = "";
      });
      listo();
    }, 1050);
  });
}

async function descargarOrganizado() {
  try {
    descargarBytes(await exportarOrganizado(), "Paquete ordenado.pdf");
  } catch (e) {
    org.error = e && e.message ? e.message : String(e);
    render();
  }
}
