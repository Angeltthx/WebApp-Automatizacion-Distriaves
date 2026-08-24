"use strict";
/* El catálogo de revisiones no debe pedir confirmaciones que la
   aplicación no puede comprobar. Cada casilla manual es un clic en
   cada paquete; si además no aporta información, solo estorba. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ctx = vm.createContext({ console: console });
["rejilla.js", "verificador.js", "reglas.js"].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8"), ctx, { filename: f });
});
const REGLAS = vm.runInContext("REGLAS", ctx);

/* Las que se quitaron porque solo añadían un paso: preguntaban por
   algo que ni la persona ni la máquina pueden verificar mejor mirando
   la pantalla que mirando el papel. */
const RETIRADAS = ["sin-tachones", "casillas-marcadas", "campos-que-se-olvidan",
                   "lista-precios-cq", "nombre-igual-que-la-cedula"];

test("no vuelven las preguntas que solo añadían clics", function () {
  const ids = REGLAS.map(function (r) { return r.id; });
  RETIRADAS.forEach(function (id) {
    assert.ok(!ids.includes(id), "volvió la revisión " + id);
  });
});

test("toda revisión manual que queda tiene ayuda que explica por qué se pregunta", function () {
  REGLAS.filter(function (r) { return r.nivel === "manual"; }).forEach(function (r) {
    assert.ok(r.ayuda && r.ayuda.length > 20,
      "la revisión manual " + r.id + " no explica por qué no puede comprobarse sola");
  });
});

/* Una revisión manual con `evaluar` que no se resuelve sola tiene que
   tener un motivo: que la medición proponga, pero no decida. */
const PREGUNTAN_AUNQUE_MIDEN = {
  "foto-incluida": "el color no distingue la fachada de una cédula fotografiada sobre una mesa",
  "ciiu-del-rut": "el CIIU del formato está manuscrito; solo se puede mostrar el del RUT para comparar",
  "correo-confirmado": "el correo del formato está manuscrito, y además hay que preguntárselo al cliente",
};

/* Esta lista es el inventario de lo que la herramienta todavía te
   pregunta, con el motivo escrito. Si crece sin justificación, la
   pantalla vuelve a ser una lista de casillas que marcar sin mirar. */
test("no se pregunta más de lo justificado", function () {
  assert.ok(Object.keys(PREGUNTAN_AUNQUE_MIDEN).length <= 3,
    "hay demasiadas revisiones que preguntan aunque midan algo");
});

test("las revisiones que se pueden comprobar solas se resuelven solas", function () {
  REGLAS.filter(function (r) { return r.nivel === "manual" && r.evaluar; }).forEach(function (r) {
    if (PREGUNTAN_AUNQUE_MIDEN[r.id]) return;
    assert.strictEqual(r.autoResuelve, true,
      "la revisión " + r.id + " sabe comprobarse pero igual te pregunta");
  });
});
