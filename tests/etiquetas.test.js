"use strict";
/* Las etiquetas del visor no pueden solaparse ni salirse de la hoja:
   es justo lo que hacía la versión anterior, que las pegaba al borde
   del recuadro y tapaba el dato. Aquí se prueba la colocación sola,
   sin navegador. */
const test = require("node:test");
const assert = require("node:assert");

const ALTO_ETQ = 22, HUECO = 3, PASO = ALTO_ETQ + HUECO;
const { apilarEtiquetas } = require("../public/verificar-ui.js");

function revisar(centros, alto) {
  const t = apilarEtiquetas(centros, alto);
  assert.strictEqual(t.length, centros.length);
  for (let i = 0; i < t.length; i++) {
    assert.ok(t[i] >= -0.001, "etiqueta por encima del borde: " + t[i]);
    assert.ok(t[i] + ALTO_ETQ <= alto + 0.001, "etiqueta fuera por abajo: " + t[i]);
    if (i) assert.ok(t[i] - t[i - 1] >= PASO - 0.001, "etiquetas solapadas en " + i);
  }
  return t;
}

const ALTO = 1300;  // A4 mostrada a 920 px de ancho

test("filas contiguas del bloque de datos", function () {
  const centros = [0.2113, 0.2219, 0.2339, 0.2452, 0.2572, 0.2686, 0.2806, 0.2926, 0.3039]
    .map(function (y) { return y * ALTO; });
  revisar(centros, ALTO);
});

test("etiquetas pegadas al pie de página", function () {
  revisar([0.93, 0.95, 0.97, 0.99].map(function (y) { return y * ALTO; }), ALTO);
});

test("varias marcas en la misma fila", function () {
  revisar([0.5, 0.5, 0.5, 0.5, 0.5, 0.5].map(function (y) { return y * ALTO; }), ALTO);
});

test("hoja corta con muchas marcas", function () {
  const centros = [];
  for (let i = 0; i < 17; i++) centros.push((i / 17) * 600);
  revisar(centros, 600);
});

test("sin marcas y con una sola", function () {
  assert.deepStrictEqual(apilarEtiquetas([], ALTO), []);
  const una = apilarEtiquetas([0.5 * ALTO], ALTO);
  assert.ok(Math.abs(una[0] + ALTO_ETQ / 2 - 0.5 * ALTO) < 0.001, "una sola queda centrada en su fila");
});

test("cuando caben, ninguna se aleja más de media pantalla de su fila", function () {
  const centros = [0.15, 0.35, 0.55, 0.75].map(function (y) { return y * ALTO; });
  const t = revisar(centros, ALTO);
  t.forEach(function (arriba, i) {
    assert.ok(Math.abs(arriba + ALTO_ETQ / 2 - centros[i]) < 0.001, "bien separadas: sin desvío");
  });
});

test("no caben ni apretadas: se reparten sin salirse", function () {
  const centros = [];
  for (let i = 0; i < 40; i++) centros.push((i / 40) * 300);
  const t = apilarEtiquetas(centros, 300);
  assert.strictEqual(t.length, 40);
  t.forEach(function (v) {
    assert.ok(v >= 0 && v + ALTO_ETQ <= 300 + 0.001, "se queda dentro de la hoja");
  });
});
