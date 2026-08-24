/* ================================================================
   Ordenar las hojas solo.

   El fallo de la v15: el clasificador traía dos reglas que SUPONEN el
   paquete ya armado ("la foto va de última"), y sobre un montón
   desordenado convertían la foto real en documento y ascendían a foto
   lo que hubiera quedado de último. Ahora esas reglas van detrás de
   una bandera y el orden se decide con esta función, que es pura.
   ================================================================ */
const { test } = require("node:test");
const assert = require("node:assert");
const O = require("../public/organizar.js");

function orden(lista) {
  return O.ordenPorTipo(lista).map(function (x) { return x.posicion; });
}

test("un paquete revuelto queda en el orden del trámite", function () {
  const revuelto = [
    { tipo: "foto" },
    { tipo: "formato", hoja: "3/3" },
    { tipo: "rut" },
    { tipo: "formato", hoja: "1/3" },
    { tipo: "documento" },
    { tipo: "formato", hoja: "2/3" },
  ];
  assert.deepEqual(orden(revuelto), [3, 5, 1, 2, 4, 0]);
});

test("un paquete ya armado no se toca", function () {
  const armado = [
    { tipo: "formato", hoja: "1/3" }, { tipo: "formato", hoja: "2/3" },
    { tipo: "formato", hoja: "3/3" }, { tipo: "rut" }, { tipo: "rut" },
    { tipo: "documento" }, { tipo: "documento" }, { tipo: "foto" },
  ];
  assert.deepEqual(orden(armado), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("las hojas del RUT y de la cédula conservan su orden entre ellas", function () {
  const p = [{ tipo: "rut" }, { tipo: "rut" }, { tipo: "documento" }, { tipo: "documento" }];
  assert.deepEqual(orden(p), [0, 1, 2, 3]);
});

/* Si no se sabe qué hoja del formato es, va al final de su grupo. */
test("un formato sin identificar no se cuela delante de los que sí", function () {
  const p = [{ tipo: "formato", hoja: "" }, { tipo: "formato", hoja: "2/3" },
             { tipo: "formato", hoja: "1/3" }];
  assert.deepEqual(orden(p), [2, 1, 0]);
});

test("lo que no se reconoce queda al final y se marca como dudoso", function () {
  const p = [null, { tipo: "formato", hoja: "1/3" }, { tipo: "foto" }];
  const r = O.ordenPorTipo(p);
  assert.deepEqual(r.map(function (x) { return x.posicion; }), [1, 2, 0]);
  assert.equal(r.filter(function (x) { return !x.seguro; }).length, 1);
});

test("una hoja de formato sin número cuenta como dudosa", function () {
  const r = O.ordenPorTipo([{ tipo: "formato", hoja: "" }]);
  assert.equal(r[0].seguro, false);
});

test("el orden es formato, RUT, documentos y foto, en ese orden", function () {
  assert.ok(O.ORDEN_TIPOS.formato < O.ORDEN_TIPOS.rut);
  assert.ok(O.ORDEN_TIPOS.rut < O.ORDEN_TIPOS.documento);
  assert.ok(O.ORDEN_TIPOS.documento < O.ORDEN_TIPOS.foto);
  assert.ok(O.ORDEN_TIPOS.foto < O.ORDEN_TIPOS.desconocido);
});

/* ---- cuál es la foto del local (v18) ----

   No se puede por umbral: medido sobre un paquete real, mirando solo la
   parte no blanca, la cédula da 0.156 y 0.164 de píxeles con color y la
   fachada 0.190. Demasiado cerca. Sí se puede por comparación dentro
   del mismo paquete: ahí la fachada saca 1.75 veces a la siguiente. */
const V = require("../public/verificador.js");

function tipos(p) { V.elegirFotoDelLocal(p); return p.map(function (x) { return x.tipo; }); }

test("con los números reales de un paquete, la fachada gana", function () {
  const p = [
    { tipo: "formato", colorCubierto: 0.002 }, { tipo: "formato", colorCubierto: 0.002 },
    { tipo: "formato", colorCubierto: 0.001 }, { tipo: "rut", colorCubierto: 0.004 },
    { tipo: "documento", colorCubierto: 0.156 },   // cédula frente
    { tipo: "documento", colorCubierto: 0.164 },   // cédula reverso
    { tipo: "documento", colorCubierto: 0.190 },   // fachada
  ];
  assert.deepEqual(tipos(p),
    ["formato", "formato", "formato", "rut", "documento", "documento", "foto"]);
});

/* Este es el fallo que se venía arrastrando: una fachada en vertical
   metida en una A4 lleva franjas blancas a los lados, así que su color
   sobre la página entera baja y con umbral fijo (0.10) se quedaba
   corta. Por comparación sigue ganando. */
test("una fachada apaisada en una A4 sigue ganando aunque baje su color", function () {
  /* Sobre la página entera la fachada bajaría de 0.147 a ~0.09 por las
     franjas blancas y perdería contra la cédula. Sobre la parte
     cubierta no se diluye: sigue en 0.190. */
  const p = [
    { tipo: "documento", color: 0.084, colorCubierto: 0.156 },
    { tipo: "documento", color: 0.070, colorCubierto: 0.164 },
    { tipo: "documento", color: 0.090, colorCubierto: 0.190 },
  ];
  assert.deepEqual(tipos(p), ["documento", "documento", "foto"]);
});

test("sin foto en el paquete, ninguna cédula se va al final", function () {
  /* Dos cédulas parecidas: ninguna saca el 30% a la otra. */
  const p = [{ tipo: "documento", colorCubierto: 0.156 },
             { tipo: "documento", colorCubierto: 0.164 }];
  assert.deepEqual(tipos(p), ["documento", "documento"]);
});

test("un paquete de puro papel no inventa una foto", function () {
  const p = [{ tipo: "documento", colorCubierto: 0.004 },
             { tipo: "documento", colorCubierto: 0.002 }];
  assert.deepEqual(tipos(p), ["documento", "documento"]);
});

test("con dos fotos del local parecidas no se elige ninguna", function () {
  const p = [{ tipo: "documento", colorCubierto: 0.190 },
             { tipo: "documento", colorCubierto: 0.185 },
             { tipo: "documento", colorCubierto: 0.160 }];
  assert.deepEqual(tipos(p), ["documento", "documento", "documento"]);
});

test("una sola página suelta y colorida sí se toma por la foto", function () {
  const p = [{ tipo: "formato", colorCubierto: 0.002 },
             { tipo: "documento", colorCubierto: 0.190 }];
  assert.deepEqual(tipos(p), ["formato", "foto"]);
});

test("el orden final deja las cédulas antes que la fachada", function () {
  const p = [
    { tipo: "formato", hoja: "1/3", colorCubierto: 0.002 },
    { tipo: "documento", colorCubierto: 0.190 },  // la fachada, soltada antes que las cédulas
    { tipo: "documento", colorCubierto: 0.156 },
    { tipo: "documento", colorCubierto: 0.164 },
  ];
  V.elegirFotoDelLocal(p);
  const orden = O.ordenPorTipo(p).map(function (x) { return x.posicion; });
  assert.deepEqual(orden, [0, 2, 3, 1], "la fachada tiene que quedar de última");
});
