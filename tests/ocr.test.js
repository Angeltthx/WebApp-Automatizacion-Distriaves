/* Comparaciones de texto: funciones puras, sin DOM y sin red.
   Los casos con datos reales salen de prueba2.pdf, que trae errores
   puestos a propósito. */
const { test } = require("node:test");
const assert = require("node:assert");

const R = require("../public/rejilla.js");
globalThis.LISTA_PRECIOS_ESPERADA = R.LISTA_PRECIOS_ESPERADA;
const O = require("../public/ocr.js");

/* ---------- correos ---------- */

test("tres correos idénticos pasan", function () {
  const r = O.compararCorreos([
    { campo: "a", texto: "robert1950mora@gmail.com" },
    { campo: "b", texto: "robert1950mora@gmail.com" },
    { campo: "c", texto: "robert1950mora@gmail.com" },
  ]);
  assert.equal(r.iguales, true);
});

test("el error real de prueba2.pdf se detecta: 1750 contra 1950", function () {
  const r = O.compararCorreos([
    { campo: "correoFacturacion", texto: "robert 1950mora@gmail.com" },
    { campo: "contactoCorreo", texto: "robert1750mora@gmail.com" },
    { campo: "repLegalCorreo", texto: "robert1950mora@gmail.com" },
  ]);
  assert.equal(r.iguales, false);
  assert.equal(r.distintos.length, 2);
});

test("los espacios de la letra a mano no cuentan como diferencia", function () {
  const r = O.compararCorreos([
    { campo: "a", texto: "robert 1950 mora@gmail.com" },
    { campo: "b", texto: "robert1950mora@gmail.com" },
    { campo: "c", texto: "ROBERT1950MORA@GMAIL.COM" },
  ]);
  assert.equal(r.iguales, true);
});

test("una casilla de correo en blanco no se cuela como coincidencia", function () {
  const r = O.compararCorreos([
    { campo: "a", texto: "x@y.com" },
    { campo: "b", texto: "", vacio: true },
    { campo: "c", texto: "x@y.com" },
  ]);
  assert.equal(r.iguales, false);
  assert.equal(r.vacios.length, 1);
});

/* ---------- lista de precios ---------- */

test("CQ pasa, y da igual la caja y los espacios", function () {
  assert.equal(O.esListaPreciosCorrecta("CQ"), true);
  assert.equal(O.esListaPreciosCorrecta(" cq "), true);
  assert.equal(O.esListaPreciosCorrecta("C Q"), true);
});

test("el error real de prueba2.pdf se detecta: CA en vez de CQ", function () {
  assert.equal(O.esListaPreciosCorrecta("CA"), false);
});

test("CR, que existe en el formato, no se confunde con CQ", function () {
  assert.equal(O.esListaPreciosCorrecta("CR"), false);
  assert.equal(O.esListaPreciosCorrecta(""), false);
});

/* ---------- nombre del negocio contra el letrero ---------- */

test("el caso real de prueba2.pdf coincide", function () {
  const r = O.nombreEnLetrero(
    "Restaurante Rikas Comidas",
    "RIKA'S COMIDAS | RESTAURANTE | Bienvenidos | DESAYUNOS");
  assert.equal(r.estado, "coincide");
});

test("un negocio distinto se marca", function () {
  const r = O.nombreEnLetrero(
    "Restaurante Gourmet Fuego y Sabor",
    "C.D. VIDRIOS Y ALUMINIOS | VIDRIOS Y ALUMINIOS LA SUNCION");
  assert.equal(r.estado, "noCoincide");
});

test("si el letrero no dice ningún nombre, la regla se calla", function () {
  const r = O.nombreEnLetrero("Restaurante Rikas Comidas", "");
  assert.equal(r.estado, "sinDatos");
  assert.equal(r.motivo, "letrero");
});

test("basta con que coincida la marca, no el nombre entero", function () {
  /* El formato lleva la marca; el letrero lleva la marca más el menú,
     el teléfono y la palabra RESTAURANTE. Exigir el nombre completo
     marcaría como error casi todos los paquetes buenos. */
  const r = O.nombreEnLetrero(
    "Rikas",
    "RIKA'S COMIDAS | ALMUERZOS | PLATOS A LA CARTA | 300 487 2211");
  assert.equal(r.estado, "coincide");
});

test("una letra de diferencia se perdona: es el ruido de leer un letrero", function () {
  assert.equal(O.difiereEnMasDeUno("rikas", "rikaz"), false);
  assert.equal(O.difiereEnMasDeUno("rikas", "rikass"), false);
  assert.equal(O.difiereEnMasDeUno("rikas", "vidrios"), true);
});

test("las palabras genéricas no bastan para dar por bueno un letrero", function () {
  /* "Restaurante" está en medio Bogotá: si contara, cualquier foto de
     cualquier restaurante validaría cualquier formato. */
  const r = O.nombreEnLetrero("Restaurante Rikas Comidas", "RESTAURANTE EL BUEN SABOR");
  assert.equal(r.estado, "noCoincide");
});

test("un nombre que solo tiene palabras genéricas no se puede comparar", function () {
  const r = O.nombreEnLetrero("Restaurante", "PANADERIA LA ESPIGA");
  assert.equal(r.estado, "noCoincide");
  assert.deepEqual(r.buscadas, ["restaurante"]);
});
