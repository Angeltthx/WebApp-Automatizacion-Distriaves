/* ================================================================
   El semáforo de casillas, sobre documentos REALES.

   Tres documentos, tres respuestas que se saben de antemano:
     · el formato en blanco  → ninguna casilla escrita
     · un paquete lleno       → casi todas escritas
     · los bloques del Aval y de Cartera → vacíos en los dos

   Los .raw.gz son el gris a 800 px. Si no están, se salta.
   ================================================================ */
const { test, skip } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");

const M = require("../public/mapa.js");
/* casillas.js lee MAPA del ámbito compartido del navegador; en Node hay
   que ponérselo delante, igual que hace index.html con el orden de
   los <script>. */
globalThis.MAPA = M.MAPA;
const R = require("../public/rejilla.js");
const C = require("../public/casillas.js");

const DIR = path.join(__dirname, "grises");
const HOJAS = ["1/3", "2/3", "3/3"];

function gris(nombre) {
  const ruta = path.join(DIR, nombre + ".raw.gz");
  if (!fs.existsSync(ruta)) return null;
  const datos = new Uint8Array(zlib.gunzipSync(fs.readFileSync(ruta)));
  return { gris: datos, ancho: 800, alto: datos.length / 800 };
}

function ajustarHoja(g, etiqueta) {
  const barras = R.detectarBarras(g.gris, g.ancho, g.alto);
  const ancla = R.anclarConBarras(barras, R.REFERENCIA_BARRAS[etiqueta]);
  const opciones = [0, R.HUECO_TRAZO].map(function (hueco) {
    const l = R.lineasDeLaHoja(g.gris, g.ancho, g.alto, hueco);
    return R.emparejar(l.lineas, R.REFERENCIA[etiqueta], undefined, ancla);
  }).filter(Boolean).sort(function (a, b) {
    if (!!b.acuerdo !== !!a.acuerdo) return b.acuerdo ? 1 : -1;
    return b.confianza - a.confianza;
  });
  return opciones[0] || null;
}

/* Mide las 74 casillas de un documento de tres hojas. */
function medir(prefijo) {
  const medidas = {}, opciones = {};
  HOJAS.forEach(function (etiqueta, i) {
    const g = gris(prefijo + (i + 1));
    if (!g) return;
    const ajuste = ajustarHoja(g, etiqueta);
    if (!ajuste) return;
    const bin = R.binarizar(g.gris, g.ancho, g.alto);
    M.camposDeHoja(etiqueta).forEach(function (campo) {
      const caja = M.ubicarDelMapa(campo, ajuste);
      if (!caja) return;
      const t = R.densidadMaxima(bin, g.ancho, g.alto, caja);
      if (t != null) medidas[campo] = t;
      if (M.MAPA[campo].opciones) {
        opciones[campo] = M.MAPA[campo].opciones.map(function (_, k) {
          const c = M.ubicarOpcion(campo, k, ajuste);
          return c ? R.densidadMaxima(bin, g.ancho, g.alto, c) : null;
        });
      }
    });
  });
  return { medidas: medidas, opciones: opciones };
}

function colores(prefijo) {
  const { medidas, opciones } = medir(prefijo);
  const cal = C.calibrarVacio(medidas);
  const out = {};
  Object.keys(M.MAPA).forEach(function (campo) {
    if (medidas[campo] == null) return;
    const clase = M.MAPA[campo].clase;
    if (clase === "pendiente") { out[campo] = "gris"; return; }
    const r = clase === "grupo"
      ? C.estadoDeGrupo(opciones[campo] || [])
      : C.estadoPorTinta(campo, medidas, cal);
    out[campo] = C.colorDe(clase, r.estado);
  });
  return { colores: out, calibracion: cal };
}

const hay = fs.existsSync(path.join(DIR, "b1.raw.gz")) && fs.existsSync(path.join(DIR, "p1.raw.gz"));

if (!hay) {
  skip("Faltan los grises de referencia en tests/grises/.");
} else {

  test("el mapa cubre las tres hojas y no repite campos", function () {
    /* 74 del formato marcado + "Ciudad", que se añadió a mano en la v15
       porque en el marcado se había olvidado. */
    assert.equal(Object.keys(M.MAPA).length, 75);
    for (const etiqueta of HOJAS) {
      assert.ok(M.camposDeHoja(etiqueta).length > 0, "hoja " + etiqueta + " sin campos");
    }
    for (const k of Object.keys(M.MAPA)) {
      const m = M.MAPA[k];
      assert.ok(m.y1 > m.y0 && m.x1 > m.x0, k + " tiene una caja imposible");
      assert.ok(m.y0 >= 0 && m.y1 <= 1 && m.x0 >= 0 && m.x1 <= 1, k + " se sale de la hoja");
    }
  });

  /* La prueba más importante: en un formato SIN ESCRIBIR, ninguna
     casilla puede salir verde. Si alguna sale, el semáforo está
     inventándose tinta y todo lo demás sobra. */
  test("en el formato en blanco no hay ni una casilla escrita", function () {
    const { colores: c } = colores("b");
    const verdes = Object.keys(c).filter(function (k) {
      return M.MAPA[k].clase !== "vacio" && c[k] === "verde";
    });
    assert.deepEqual(verdes, [], "salieron escritas sin estarlo: " + verdes.join(", "));
  });

  /* La tinta no puede declarar escrita una casilla que va en blanco:
     como mucho la manda a leer. Así que ninguna sale roja por tinta,
     ni en el formato vacío ni en un paquete lleno. */
  test("la tinta nunca acusa por su cuenta a una casilla que va en blanco", function () {
    for (const doc of ["b", "p"]) {
      const { colores: c } = colores(doc);
      const rojas = Object.keys(c).filter(function (k) {
        return M.MAPA[k].clase === "vacio" && c[k] === "rojo";
      });
      assert.deepEqual(rojas, [], doc + ": acusó a " + rojas.join(", "));
    }
  });

  test("en un paquete real la mayoría de las casillas salen escritas", function () {
    const { colores: c } = colores("p");
    const texto = Object.keys(c).filter(function (k) { return M.MAPA[k].clase === "texto"; });
    const verdes = texto.filter(function (k) { return c[k] === "verde"; });
    /* Con la media de tinta salían 21 de 45. Con la densidad máxima,
       38. El listón sube a 0.7 para que no se pueda volver atrás sin
       que una prueba lo diga. */
    assert.ok(verdes.length >= texto.length * 0.7,
      "solo " + verdes.length + " de " + texto.length + " salieron escritas");
  });

  /* Esta prueba fija un LÍMITE CONOCIDO, no una virtud. Sobre un
     paquete real la tinta deja 10 de 41 casillas escritas en rojo:
     firmas, "DJ", "NA", "CA"… trazo corto sobre una caja pequeña. Es
     el número que obliga a que la transcripción tenga la última
     palabra. Si sube, algo se rompió; si baja, mejoró y hay que
     apretar el tope. */
  test("la tinta sola se equivoca, y está medido cuánto", function () {
    const { colores: c } = colores("p");
    const texto = Object.keys(c).filter(function (k) { return M.MAPA[k].clase === "texto"; });
    const rojos = texto.filter(function (k) { return c[k] === "rojo"; });
    assert.ok(rojos.length <= 5,
      "la tinta dejó " + rojos.length + " casillas escritas en rojo: " + rojos.join(", "));
  });

  test("la calibración sin la propia casilla usa suficientes vecinas", function () {
    const { medidas } = medir("p");
    const cal = C.calibrarSin("avalTipoDocumento", medidas);
    assert.ok(cal, "no se pudo calibrar dejando fuera la casilla");
    assert.ok(cal.usadas >= 15, "solo " + cal.usadas + " casillas de referencia");
    assert.ok(!Object.keys(M.MAPA).some(function (k) {
      return k === "avalTipoDocumento" && cal.incluye;
    }));
  });

  test("la calibración se apoya en suficientes casillas vacías", function () {
    const { calibracion } = colores("p");
    assert.ok(calibracion, "no se pudo calibrar");
    assert.ok(calibracion.usadas >= 15,
      "solo " + calibracion.usadas + " casillas de referencia");
    assert.ok(calibracion.dispersion > 0, "dispersión nula: el semáforo no distinguiría nada");
  });

  test("las tres casillas de Tipo de cliente quedan sin revisar, no en falso verde", function () {
    const { colores: c } = colores("p");
    for (const k of ["tipoClienteForma", "tipoClienteVinculo", "tipoClientePersona"]) {
      assert.equal(c[k], "gris", k + " no debería opinar todavía");
    }
  });

  /* Los círculos de opción NO se leen con tinta: miden 7 px y la
     marcada sale más clara que las vacías. Está medido en el
     comentario de estadoDeGrupo. Esta prueba fija que el código NO
     opine sobre ellos, que es lo correcto mientras no se transcriban. */
  test("los grupos de opciones no se juzgan por tinta", function () {
    assert.equal(C.estadoDeGrupo([0.10, 0.10, 0.62, 0.11, 0.10]).estado, "sinDato");
    assert.equal(C.colorDe("grupo", "sinDato"), "amarillo");
    const { colores: c } = colores("p");
    for (const k of Object.keys(M.MAPA)) {
      if (M.MAPA[k].clase === "grupo" && c[k]) {
        assert.equal(c[k], "amarillo", k + " no debería tener veredicto por tinta");
      }
    }
  });

  test("el color traduce bien lo que va vacío al revés que lo que va escrito", function () {
    assert.equal(C.colorDe("texto", "lleno"), "verde");
    assert.equal(C.colorDe("texto", "vacio"), "rojo");
    assert.equal(C.colorDe("vacio", "lleno"), "rojo");
    assert.equal(C.colorDe("vacio", "vacio"), "verde");
    assert.equal(C.colorDe("texto", "sinDato"), "amarillo");
  });
}

/* ---- corrección de quien revisa (v19) ---- */

test("lo que dice quien revisa manda sobre lo que midió el programa", function () {
  assert.equal(C.colorEfectivo({ color: "verde", revision: "mal" }), "rojo");
  assert.equal(C.colorEfectivo({ color: "rojo", revision: "ok" }), "verde");
  assert.equal(C.colorEfectivo({ color: "amarillo" }), "amarillo");
  assert.equal(C.colorEfectivo({ color: "verde", revision: null }), "verde");
});

test("el color medido no se pierde al corregir", function () {
  /* Se guardan aparte a propósito: si el análisis se rehace, la
     corrección sigue ahí, y siempre se puede ver qué dijo cada uno. */
  const c = { color: "verde", revision: "mal" };
  assert.equal(C.colorEfectivo(c), "rojo");
  assert.equal(c.color, "verde");
});

test("el toque va de sin revisar a bien, a mal, y vuelve a empezar", function () {
  assert.equal(C.siguienteRevision(null), "ok");
  assert.equal(C.siguienteRevision("ok"), "mal");
  assert.equal(C.siguienteRevision("mal"), null);
});

/* ---- densidad máxima contra media (v21) ---- */

test("la densidad máxima ve una palabra corta que la media diluye", function () {
  /* Casilla de 200 px de ancho y 20 de alto, con "N/A" ocupando los
     primeros 30 px bien cargados y el resto en blanco. Es el caso que
     dejaba media hoja en naranja. */
  const ancho = 200, alto = 20;
  const bin = new Uint8Array(ancho * alto);
  for (let y = 4; y < 16; y++) {
    for (let x = 2; x < 32; x++) bin[y * ancho + x] = 1;
  }
  const caja = { x: 0, y: 0, ancho: 1, alto: 1 };
  const media = R.tintaEnCaja(bin, ancho, alto, caja);
  const densidad = R.densidadMaxima(bin, ancho, alto, caja);
  assert.ok(media < 0.10, "la media reparte la palabra por toda la casilla: " + media.toFixed(3));
  assert.ok(densidad > 0.5, "la densidad tiene que verla: " + densidad.toFixed(3));
});

test("una casilla en blanco sigue dando casi cero con la ventana", function () {
  const ancho = 200, alto = 20;
  const bin = new Uint8Array(ancho * alto);
  const d = R.densidadMaxima(bin, ancho, alto, { x: 0, y: 0, ancho: 1, alto: 1 });
  assert.ok(d < 0.01, "una casilla vacía no puede dar densidad: " + d);
});

test("la ventana no se sale de una casilla más estrecha que ella", function () {
  const ancho = 8, alto = 10;
  const bin = new Uint8Array(ancho * alto).fill(1);
  const d = R.densidadMaxima(bin, ancho, alto, { x: 0, y: 0, ancho: 1, alto: 1 }, 16);
  assert.equal(d, 1, "con la casilla llena tiene que dar 1, no partirse");
});
