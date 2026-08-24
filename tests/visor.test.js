"use strict";
/* Monta el visor en un DOM de mentira, cargando los scripts en el
   MISMO orden que index.html.

   Existe por un fallo concreto: verificar-ui.js llamaba a render(),
   que lo define app.js, que se carga después. Eso lanzaba un
   ReferenceError en cada carga. Durante mucho tiempo no se notó,
   porque lo único que quedaba debajo eran declaraciones de función
   —que se izan— pero en cuanto apareció una constante `const` abajo,
   quedó sin inicializar y el visor dejó de dibujar hojas: página en
   blanco, sin un error visible en la pantalla.

   Estas pruebas necesitan jsdom. Si no está instalado, se saltan. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

let JSDOM = null;
try { JSDOM = require("jsdom").JSDOM; } catch (e) { /* sin jsdom */ }

const ORDEN = ["rut.js", "mapa.js", "rejilla.js", "casillas.js", "ocr.js", "verificador.js", "reglas.js", "verificar-ui.js", "formulario.js", "organizar.js", "diligenciar-ui.js", "app.js"];

/* Los scripts se inyectan como <script> de verdad: es lo único que
   reproduce el ámbito léxico compartido entre archivos del navegador.
   Con eval() cada archivo tendría su propio ámbito y las `const` de
   uno no se verían desde otro, que es justo lo que hay que probar. */
function navegador() {
  const jsdom = require("jsdom");
  const fallos = [];
  const consola = new jsdom.VirtualConsole();
  consola.on("jsdomError", function (e) { fallos.push(e.message + " · " + (e.detail || "")); });

  const dom = new JSDOM(
    '<!DOCTYPE html><body>' +
    '<div id="vista"></div><div id="zonaModal"></div><div id="zonaToast"></div>' +
    '<div id="navLateral"></div><nav id="navMovil"></nav><h1 id="tituloVista"></h1>' +
    '<div id="barraBusqueda"></div><button id="btnNuevo"></button><span id="usuarioActivo"></span>' +
    '<button id="btnExportar"></button><button id="btnImportar"></button><button id="btnSalir"></button>' +
    '<span id="icoSearch"></span><span id="icoPlus"></span><span id="fechaHoy"></span>' +
    '<input id="inputPdf"><input id="inputImportar">' +
    '</body>',
    { url: "http://localhost/",   // sin origen, jsdom no da localStorage
      pretendToBeVisual: true, runScripts: "dangerously", virtualConsole: consola });

  const w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = function () {
    return { fillRect: function () {}, fillStyle: "",
             getImageData: function () { return { data: new Uint8ClampedArray(4) }; } };
  };
  /* La API se queda colgada a propósito: aquí solo se prueba el visor,
     y una respuesta falsa a medias hace tropezar al resto de la app
     mucho después, cuando la prueba ya terminó. */
  w.fetch = function () { return new Promise(function () {}); };

  ORDEN.forEach(function (f) {
    const s = w.document.createElement("script");
    s.textContent = fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8");
    w.document.body.appendChild(s);
  });
  return { w: w, fallos: fallos };
}

/* Un análisis como el que devuelve analizarPdf, sin abrir ningún PDF. */
const ANALISIS_GLOBAL = `
  ver.analisis = {
    doc: { getPage: function () { return Promise.resolve({
      getViewport: function (o) { return { width: 600 * (o.scale || 1), height: 850 * (o.scale || 1) }; },
      render: function () { return { promise: Promise.resolve() }; },
    }); } },
    archivo: "paquete.pdf", totalPaginas: 3, rut: null, rutEscaneado: false,
    paginas: [1, 2, 3].map(function (n) {
      return { n: n, tipo: "formato", hoja: n + "/3", ancho: 800, alto: 1130,
               tinta: 0.1, medioTono: 0.2, color: 0.01, reglas: 20, texto: "",
               bandas: [0,0,0,0,0,0], bandasIzq: [0,0,0,0,0,0],
               lineas: [0.21, 0.30, 0.44], barras: [0.214, 0.296],
               ajuste: { escala: 1, desplazamiento: 0, confianza: 0.8, aciertos: 18,
                         arriba: 5, abajo: 6, exacto: n === 1, confianzaBarras: 0.5 },
               casillas: null };
    }),
  };
  ver.montado = false;
  document.getElementById("vista").innerHTML = htmlVerificar();
`;

test("los scripts cargan sin errores, en el orden de index.html", { skip: !JSDOM }, function () {
  const { w, fallos } = navegador();
  assert.deepStrictEqual(fallos, [], "algún script falló al cargarse");
  w.close();
});

test("las constantes del visor quedan inicializadas", { skip: !JSDOM }, function () {
  const { w } = navegador();
  assert.strictEqual(w.eval("SVGNS"), "http://www.w3.org/2000/svg");
  assert.strictEqual(typeof w.eval("ALTO_ETQ"), "number");
  w.close();
});

test("el visor dibuja las hojas, los recuadros y las etiquetas", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  await w.eval("montarHojas()");

  const zona = w.document.getElementById("visorHojas");
  assert.strictEqual(zona.querySelectorAll(".hoja").length, 3, "faltan hojas");
  assert.strictEqual(zona.querySelectorAll("canvas").length, 3, "faltan lienzos");
  assert.ok(zona.querySelectorAll(".marca-campo").length > 0, "no se dibujó ningún recuadro");
  assert.strictEqual(zona.querySelectorAll(".marca-campo").length,
                     zona.querySelectorAll(".rotulo").length,
                     "cada recuadro necesita su etiqueta en el margen");
});

test("ninguna etiqueta se dibuja encima del papel", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  await w.eval("montarHojas()");
  const papeles = w.document.querySelectorAll(".hoja-papel");
  assert.ok(papeles.length > 0);
  papeles.forEach(function (papel) {
    assert.strictEqual(papel.querySelectorAll(".rotulo").length, 0,
      "una etiqueta acabó sobre el documento");
  });
  w.close();
});

test("corregir cuál hoja es cuál rehace el ajuste", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  await w.eval("montarHojas()");
  w.eval("cambiarHoja(1, '2/3')");
  assert.strictEqual(w.eval("ver.analisis.paginas[0].hoja"), "2/3");
  assert.strictEqual(w.eval("ver.analisis.paginas[1].hoja"), "1/3", "las dos hojas se intercambian");
  w.close();
});

test("si algo reescribe el visor, se vuelve a montar solo", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  await w.eval("montarHojas()");
  assert.strictEqual(w.document.querySelectorAll(".hoja").length, 3);

  /* Esto es lo que hacía cualquier render() posterior. Antes dejaba el
     visor vacío hasta que recargabas la página. */
  w.eval('document.getElementById("vista").innerHTML = htmlVerificar();');
  assert.strictEqual(w.document.querySelectorAll(".hoja").length, 0);

  await w.eval("montarHojas()");
  assert.strictEqual(w.document.querySelectorAll(".hoja").length, 3, "no se volvió a montar");
  w.close();
});

test("descartar deja lista la pantalla para otro paquete", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  await w.eval("montarHojas()");
  w.eval("descartarPaquete()");
  assert.strictEqual(w.eval("ver.analisis"), null, "el paquete anterior sigue cargado");
  assert.strictEqual(w.eval('document.getElementById("inputPdf").value'), "",
    "el input no se vació: volver a elegir el mismo archivo no dispararía change");
  w.close();
});

test("un fallo al dibujar se muestra en pantalla, no en blanco", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  w.eval('ver.analisis.doc.getPage = function () { throw new Error("PDF roto de prueba"); };');
  try { await w.eval("montarHojas()"); } catch (e) { /* se relanza a propósito */ }
  const zona = w.document.getElementById("visorHojas");
  assert.ok(/PDF roto de prueba/.test(zona.textContent), "el error no aparece en la columna");
  assert.ok(zona.querySelector(".fallo-visor"), "falta el bloque de error");
  w.close();
});

test("el zoom agranda la hoja sin mover los recuadros", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  await w.eval("montarHojas()");

  const antes = Array.from(w.document.querySelectorAll(".marca-campo")).map(function (m) {
    return m.style.top + "|" + m.style.left + "|" + m.style.width + "|" + m.style.height;
  });
  const anchoAntes = parseFloat(w.document.querySelector(".hoja-papel").style.width);

  await w.eval("ponerZoom(2)");

  const anchoDespues = parseFloat(w.document.querySelector(".hoja-papel").style.width);
  assert.ok(anchoDespues > anchoAntes * 1.9, "la hoja no se agrandó");

  const despues = Array.from(w.document.querySelectorAll(".marca-campo")).map(function (m) {
    return m.style.top + "|" + m.style.left + "|" + m.style.width + "|" + m.style.height;
  });
  assert.deepStrictEqual(despues, antes,
    "los recuadros van en % del papel: al acercar deben quedarse donde estaban");
  assert.strictEqual(w.eval("ver.zoom"), 2);
  w.close();
});

test("el lienzo se redibuja con más píxeles al acercar", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  await w.eval("montarHojas()");
  const antes = w.document.querySelector(".hoja-papel canvas").width;
  await w.eval("ponerZoom(2)");
  const despues = w.document.querySelector(".hoja-papel canvas").width;
  assert.ok(despues > antes, "se estiró el lienzo en vez de volver a dibujarlo: se vería borroso");
  w.close();
});

test("al confirmar se abre el formulario en otra pestaña", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);

  const abiertas = [];
  w.open = function (url) {
    const falsa = { location: url, cerrada: false, close: function () { this.cerrada = true; } };
    abiertas.push(falsa);
    return falsa;
  };
  w.eval('localStorage.setItem("distriaves_url_formulario", "https://forms.office.com/prueba");');
  w.eval('ver.datos.nombre = "Cliente de prueba";');
  w.eval('api = function () { return Promise.resolve({ nombre: "Cliente de prueba", intentos: 1 }); };');
  w.eval('refrescar = function () { return Promise.resolve(); };');

  await w.eval("confirmarEnvio()");

  assert.strictEqual(abiertas.length, 1, "no se abrió el formulario");
  assert.strictEqual(abiertas[0].location, "https://forms.office.com/prueba");
  assert.strictEqual(abiertas[0].cerrada, false);
  w.close();
});

test("si el registro falla, la pestaña se cierra", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  const abiertas = [];
  w.open = function (url) {
    const falsa = { location: url, cerrada: false, close: function () { this.cerrada = true; } };
    abiertas.push(falsa);
    return falsa;
  };
  w.eval('localStorage.setItem("distriaves_url_formulario", "https://forms.office.com/prueba");');
  w.eval('ver.datos.nombre = "Cliente de prueba";');
  w.eval('api = function () { return Promise.reject(new Error("sin servidor")); };');

  await w.eval("confirmarEnvio()");

  assert.strictEqual(abiertas[0].cerrada, true, "quedó una pestaña en blanco abierta");
  assert.strictEqual(w.eval("ver.enviado"), null);
  w.close();
});

test("sin enlace guardado no se abre nada", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  let abrio = 0;
  w.open = function () { abrio++; return null; };
  w.eval('ver.datos.nombre = "Cliente de prueba";');
  w.eval('api = function () { return Promise.resolve({ nombre: "x", intentos: 1 }); };');
  w.eval('refrescar = function () { return Promise.resolve(); };');
  await w.eval("confirmarEnvio()");
  assert.strictEqual(abrio, 0);
  w.close();
});

/* ================================================================
   Dos dibujos a la vez sobre el mismo lienzo (v22)

   pdf.js revienta con "Cannot use the same canvas during multiple
   render operations". Desde que el pellizco del trackpad programa un
   redibujado 250 ms despues, eso pasa de verdad: coincide con el
   montaje de la hoja o con el boton de zoom.
   ================================================================ */
test("el dibujo anterior se cancela antes de empezar el siguiente", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  w.eval([
    'window.cancelados = 0; window.errores = [];',
    'ver.analisis.doc.getPage = function () {',
    '  return Promise.resolve({',
    '    getViewport: function (o) { return { width: 600 * (o.scale || 1), height: 850 * (o.scale || 1) }; },',
    '    render: function () {',
    '      var rechazar;',
    '      var promesa = new Promise(function (_, rej) { rechazar = rej; });',
    '      promesa.catch(function () {});',
    '      return { promise: promesa, cancel: function () {',
    '        window.cancelados++;',
    '        var e = new Error("cancelado"); e.name = "RenderingCancelledException";',
    '        rechazar(e);',
    '      } };',
    '    },',
    '  });',
    '};',
    'window.lienzo = document.createElement("canvas");',
    'dibujarPagina(1, window.lienzo).catch(function (e) { window.errores.push(String(e)); });',
  ].join("\n"));

  await new Promise(function (r) { setTimeout(r, 30); });
  w.eval('dibujarPagina(1, window.lienzo).catch(function (e) { window.errores.push(String(e)); });');
  await new Promise(function (r) { setTimeout(r, 50); });

  assert.equal(w.cancelados, 1, "no se canceló el dibujo anterior");
  assert.deepEqual(w.errores, [],
    "una cancelación no puede salir como error: " + w.errores.join(" | "));
});

/* ================================================================
   El puente entre Ordenar y Verificar (v23)
   ================================================================ */
test("el ordenador ofrece verificar solo cuando hay hojas", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval('org.hojas = [];');
  const vacio = w.eval("htmlOrganizar()");
  assert.ok(!/verificarLoOrganizado/.test(vacio),
    "sin hojas no deber\u00eda ofrecer verificar nada");

  w.eval('org.hojas = [{ id: "h1", nombre: "a.pdf", fuente: 0, indice: 0, rotacion: 0, miniatura: null }];');
  const conHojas = w.eval("htmlOrganizar()");
  assert.ok(/verificarLoOrganizado/.test(conHojas), "con hojas tiene que ofrecer verificar");
  assert.ok(/descargarOrganizado/.test(conHojas), "y seguir ofreciendo la descarga");
});

test("la animaci\u00f3n de entrega no revienta sin tarjetas ni deja restos", { skip: !JSDOM }, async function () {
  const { w } = navegador();
  w.eval('org.hojas = [];');
  /* Sin tarjetas en pantalla tiene que resolver enseguida y no dejar
     el sello pegado en el body. */
  await w.eval("animarEntrega()");
  assert.equal(w.document.querySelectorAll(".org-sello").length, 0,
    "dej\u00f3 el sello colgado en la p\u00e1gina");
});

/* ================================================================
   El chulito y la animación (v24)
   ================================================================ */
test("la animación fuerza un reflow antes de mover las tarjetas", { skip: !JSDOM }, function () {
  /* Sin ese reflow el navegador junta la clase y el transform en el
     mismo tick y salta al estado final: no se ve NINGUNA animación.
     Es lo que pasaba en la v23. */
  const fuente = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "public", "diligenciar-ui.js"), "utf8");
  const i = fuente.indexOf('classList.add("volando")');
  const j = fuente.indexOf("t.style.transform =");
  assert.ok(i > 0 && j > i, "no encontré el bloque de la animación");
  assert.ok(/void tarjetas\[0\]\.offsetWidth/.test(fuente.slice(i, j)),
    "falta el reflow entre poner la clase y aplicar el transform");
});

test("cada casilla pintada lleva su chulito", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  w.eval(`
    ver.verCasillas = true;
    ver.analisis.casillas = { campos: {
      unCampo:  { campo: "unCampo",  etiqueta: "Uno",  clase: "texto", hoja: "1/3",
                  pagina: 1, color: "amarillo", revision: null },
      otroMas:  { campo: "otroMas",  etiqueta: "Dos",  clase: "texto", hoja: "1/3",
                  pagina: 1, color: "verde", revision: "ok" },
    } };
    window.cajas = 0;
    ubicarDelMapa = function () { window.cajas++; return { x: .1, ancho: .2, y: .3, alto: .01 }; };
    const papel = document.createElement("div");
    ver.hojas = { "1/3": { papel: papel, pagina: ver.analisis.paginas[0] } };
    pintarCasillas();
    window.pintadas = papel.querySelectorAll(".casilla-color").length;
    window.conTic = papel.querySelectorAll(".casilla-color .cas-tic").length;
    window.apagados = papel.querySelectorAll(".cas-tic.apagado").length;
  `);
  assert.equal(w.pintadas, 2, "no pintó las dos casillas");
  assert.equal(w.conTic, 2, "hay casillas sin chulito: " + w.conTic + " de " + w.pintadas);
  assert.equal(w.apagados, 1, "el chulito apagado es solo el de la casilla sin revisar");
});

/* ================================================================
   El clic de la casilla no se lo puede comer el arrastre (v25)

   Había DOS manejadores de arrastre sobre la misma hoja. El viejo
   llamaba a preventDefault() en pointerdown sin mirar dónde se tocó,
   así que el clic nunca llegaba al chulito. Y como solo se activa
   cuando la hoja se puede arrastrar, unas veces funcionaba y otras no.
   ================================================================ */
test("solo hay un manejador de arrastre sobre la hoja", { skip: !JSDOM }, function () {
  const fuente = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "public", "verificar-ui.js"), "utf8");
  const cuantos = (fuente.match(/addEventListener\("pointerdown"/g) || []).length;
  assert.equal(cuantos, 1,
    "hay " + cuantos + " manejadores de pointerdown: se van a pelear por el puntero");
});

test("el arrastre se aparta cuando el toque empieza en una casilla", { skip: !JSDOM }, function () {
  const fuente = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "public", "verificar-ui.js"), "utf8");
  const i = fuente.indexOf('addEventListener("pointerdown"');
  const j = fuente.indexOf("e.preventDefault();", i);
  assert.ok(i > 0 && j > i, "no encontré el manejador de arrastre");
  assert.ok(/closest\(".casilla-color"\)/.test(fuente.slice(i, j)),
    "el arrastre no comprueba si el toque cayó sobre una casilla antes de bloquear el clic");
});

test("tocar una casilla la cicla por los tres estados", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  w.eval(`
    ver.verCasillas = true;
    ver.analisis.casillas = { campos: {
      uno: { campo: "uno", etiqueta: "Uno", clase: "texto", hoja: "1/3",
             pagina: 1, color: "amarillo", revision: null },
    } };
    ubicarDelMapa = function () { return { x: .1, ancho: .2, y: .3, alto: .01 }; };
    render = function () {};
    const papel = document.createElement("div");
    ver.hojas = { "1/3": { papel: papel, pagina: ver.analisis.paginas[0] } };
    window.papel = papel;
    pintarCasillas();
    window.pasos = [];
    for (var i = 0; i < 4; i++) {
      window.pasos.push(String(ver.analisis.casillas.campos.uno.revision));
      papel.querySelector(".casilla-color").click();
    }
  `);
  assert.deepEqual(w.pasos, ["null", "ok", "mal", "null"],
    "el ciclo del chulito no es sin revisar -> bien -> mal -> sin revisar");
});

/* El panel del RUT solo tiene sentido si `esPaginaRut` y `leerRut` de
   rut.js están cargados antes que diligenciar-ui.js. */
test("el formulario puede llamar al lector de RUT", { skip: !JSDOM }, function () {
  const { w } = navegador();
  assert.equal(typeof w.esPaginaRut, "function", "esPaginaRut no llegó al ámbito compartido");
  assert.equal(typeof w.leerRut, "function", "leerRut no llegó al ámbito compartido");
  assert.equal(typeof w.camposDesdeRut, "function", "camposDesdeRut no está disponible");
  assert.equal(typeof w.recibirDocumento, "function", "recibirDocumento no está disponible");
  assert.equal(typeof w.quitarDocumento, "function", "quitarDocumento no está disponible");
});

/* ---- añadidos de la v30 ----

   Las tres cosas que se tocaron en la interfaz. Todas comparten el
   mismo riesgo: una función que se llama desde un `onclick` no existe
   hasta que alguien pulsa, así que un nombre mal escrito no lo caza
   nada —ni el navegador al cargar, ni las pruebas de lógica— y el
   botón se queda mudo. Aquí se comprueba que el HTML se pinta Y que
   lo que invoca existe de verdad en el ámbito compartido. */

test("el cuestionario pinta las tres letras y marca la que está puesta", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  const html = w.eval("htmlFormulario()");

  for (const letra of w.eval("LETRAS.map(function (l) { return l.nombre; })")) {
    assert.ok(html.indexOf(letra) >= 0, "no aparece la letra " + letra);
  }
  /* Cada opción se escribe EN su propia letra: sin el font-family la
     tarjeta saldría en la letra del navegador y las tres se verían
     iguales, que es justo lo que hacía falta arreglar. */
  for (const id of w.eval("LETRAS.map(function (l) { return l.id; })")) {
    assert.ok(html.indexOf("font-family:'" + id + "'") >= 0,
      "la muestra de " + id + " no usa su propia letra");
  }
  /* La que está elegida tiene que verse elegida, o no hay forma de
     saber con cuál se va a generar el formato. */
  assert.ok(/class="letra-op on"/.test(html), "la letra puesta no sale marcada");
  assert.ok(/aria-pressed="true"/.test(html), "la marca no llega a un lector de pantalla");
  w.close();
});

test("cambiar de letra tira la vista previa vieja", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  /* Si la previa no se tirara, la pantalla seguiría enseñando el PDF
     de la letra anterior y parecería que el botón no hizo nada. */
  w.eval("dil.pdf = new Uint8Array([1,2,3]); dil.fase = 'previa';");
  w.eval("usarLetra('gochihand')");
  assert.equal(w.eval("letraActual().id"), "gochihand");
  assert.equal(w.eval("dil.pdf"), null, "la previa de la letra vieja se quedó puesta");
  assert.equal(w.eval("dil.fase"), "formulario");

  /* Una letra que no existe no cambia nada ni deja la pantalla a medias. */
  w.eval("dil.pdf = new Uint8Array([1,2,3]);");
  w.eval("usarLetra('no-existe')");
  assert.equal(w.eval("letraActual().id"), "gochihand");
  assert.ok(w.eval("dil.pdf") !== null, "una letra inventada no debería tirar la previa");
  w.eval("usarLetra('" + w.eval("LETRA_POR_DEFECTO") + "')");
  w.close();
});

test("llenar de prueba deja el cuestionario completo y sin avisos", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  w.eval("llenarDePrueba()");
  assert.deepEqual(w.eval("camposVacios(dil.datos)"), [],
    "el juego de prueba dejó campos vacíos");
  assert.deepEqual(w.eval("avisosDelFormulario(dil.datos).map(function (a) { return a.campo; })"), [],
    "el juego de prueba dispara avisos de formato");

  /* Los campos van marcados como tocados: si no, la copia automática
     del documento y el nombre del representante pisaría el juego y ya
     no sería el que está escrito en el código. */
  assert.equal(w.eval("dil.tocados.repLegalDocumento"), true);
  assert.equal(w.eval("dil.datos.repLegalDocumento"), "1000000002");
  w.close();
});

test("el enlace de llenar de prueba está en la pantalla y su función existe", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  const html = w.eval("htmlAutocompletado()");
  assert.ok(html.indexOf("llenarDePrueba()") >= 0, "no está el botón de datos de prueba");
  assert.equal(typeof w.llenarDePrueba, "function", "llenarDePrueba no llegó al ámbito compartido");
  assert.equal(typeof w.usarLetra, "function", "usarLetra no llegó al ámbito compartido");
  /* El aviso de que son datos falsos va en la propia pantalla, no solo
     en el toast: quien mira el formulario tiene que saberlo antes de
     pulsar, no después. */
  assert.ok(/no vale para un paquete real/i.test(html),
    "falta el aviso de que los datos son falsos");
  assert.ok(/ejemplo\.com/.test(html), "el aviso debería decir de qué datos se trata");
  w.close();
});

test("el panel del verificador ofrece descargar el paquete", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  /* Sin enviar todavía: la descarga tiene que estar disponible ANTES
     de confirmar el envío, que es justo lo que faltaba. */
  const html = w.eval("htmlPanel(hallazgos(), 0, 0)");
  assert.ok(html.indexOf("descargarPaquete()") >= 0,
    "no se puede descargar el paquete hasta confirmar el envío");
  assert.equal(typeof w.descargarPaquete, "function", "descargarPaquete no está en el ámbito compartido");

  /* Y también después de registrar el envío. */
  w.eval("ver.enviado = { nombre: 'Cliente Uno', intentos: 1 };");
  assert.ok(w.eval("htmlPanel([], 0, 0)").indexOf("descargarPaquete()") >= 0,
    "falta la descarga en el panel de envío registrado");
  w.close();
});

test("descargar sin archivo en memoria avisa en vez de romperse", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  w.eval("ver.archivoOriginal = null; document.getElementById('inputPdf').value = '';");
  const avisos = [];
  w.eval("window.__avisos = [];");
  w.eval("toast = function (tipo, texto) { window.__avisos.push(texto); };");
  w.eval("descargarPaquete()");
  assert.ok(w.eval("window.__avisos.length") > 0,
    "sin archivo a mano debería avisar, no quedarse callado");
  w.close();
});

test("el nombre del archivo sale del cliente que se registró", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval(ANALISIS_GLOBAL);
  /* Lo que manda es el nombre del cliente ya registrado; el del
     formulario es el respaldo mientras no se haya confirmado. */
  w.eval("ver.datos.nombre = 'Escrito a mano'; ver.enviado = { nombre: 'Cliente Registrado', intentos: 1 };");
  const nombres = [];
  w.eval("window.__nombres = [];");
  w.eval("descargarBytes = function (bytes, nombre) { window.__nombres.push(nombre); };");
  w.eval("ver.archivoOriginal = new Blob(['x'], { type: 'application/pdf' });");
  w.eval("descargarPaquete()");
  assert.equal(w.eval("window.__nombres[0]"), "FO-901 Cliente Registrado.pdf");
  w.close();
});

/* ---- automatismos de la v31 ---- */

test("los atajos se pintan y su función existe", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  const html = w.eval("htmlFormulario()");
  assert.ok(html.indexOf("usarAtajo('zonaTransporte'") >= 0, "no se pintan los atajos de ruta");
  assert.ok(html.indexOf("usarAtajo('codigoPostal'") >= 0, "no se pintan los códigos postales");
  assert.equal(typeof w.usarAtajo, "function", "usarAtajo no llegó al ámbito compartido");
  /* La etiqueta con el barrio se ve; el valor que se escribirá, no. */
  assert.ok(html.indexOf("25-L104 (Suba)") >= 0, "el atajo debería decir el barrio");
  w.close();
});

test("elegir ciudad pone su departamento en la hoja 3", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  w.eval("usarAtajo('ciudad', 'Medellín')");
  assert.equal(w.eval("dil.datos.ciudad"), "Medellín");
  assert.equal(w.eval("dil.datos.municipio"), "Antioquia",
    "la casilla Municipio lleva el departamento de la ciudad elegida");

  /* Escrito a mano, el municipio ya no se vuelve a pisar. */
  w.eval("anotarDato('municipio', 'Sabaneta'); usarAtajo('ciudad', 'Cali');");
  assert.equal(w.eval("dil.datos.municipio"), "Sabaneta",
    "un municipio escrito a mano no debería pisarse al cambiar de ciudad");
  w.close();
});

test("el teléfono se copia a los otros dos campos al escribirlo", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  w.eval("anotarDato('telefono', '3001234567'); aplicarEspejos();");
  assert.equal(w.eval("dil.datos.contactoTelefono"), "3001234567");
  assert.equal(w.eval("dil.datos.telMovil"), "3001234567");

  /* Y el móvil se puede dejar distinto sin que se lo vuelvan a pisar. */
  w.eval("anotarDato('telMovil', '3009999999'); anotarDato('telefono', '3007777777'); aplicarEspejos();");
  assert.equal(w.eval("dil.datos.telMovil"), "3009999999",
    "un móvil corregido a mano no debería pisarse");
  assert.equal(w.eval("dil.datos.contactoTelefono"), "3007777777");
  w.close();
});

test("el nombre del negocio sigue a la razón social hasta que se cambia", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  w.eval("anotarDato('nombreRazonSocial', 'Distribuidora Pérez S.A.S.'); aplicarEspejos();");
  assert.equal(w.eval("dil.datos.establecimiento"), "Distribuidora Pérez S.A.S.");
  w.eval("anotarDato('establecimiento', 'Asadero El Buen Sabor'); aplicarEspejos();");
  assert.equal(w.eval("dil.datos.establecimiento"), "Asadero El Buen Sabor");
  w.close();
});

test("Cliente de sale en el cuestionario con Delichicks marcada", { skip: !JSDOM }, function () {
  const { w } = navegador();
  w.eval("iniciarDiligenciar()");
  const html = w.eval("htmlFormulario()");
  assert.ok(html.indexOf("elegirOpcion('clienteDe'") >= 0, "la fila Cliente de no se pinta");
  assert.equal(w.eval("dil.datos.clienteDe"), "Delichicks S.A.S.");
  w.close();
});
