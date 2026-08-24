"use strict";
/* Cuál página es la 1/3, la 2/3 o la 3/3.

   Existe porque el reparto por tinta mandaba el recuadro de «Firma y
   huella» a la hoja 3. El reparto nuevo prueba cada página contra las
   tres plantillas y se queda con la combinación que más calza. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/* rejilla.js y verificador.js son scripts de navegador: se cargan en un
   contexto compartido, como haría el <script>. */
const ctx = vm.createContext({ console: console, document: undefined });
["rejilla.js", "verificador.js"].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "public", f), "utf8"), ctx, { filename: f });
});

/* Página sintética: se generan las líneas y las barras de una hoja
   concreta, con una escala y un corrimiento como los de un escaneo. */
function paginaDe(hoja, escala, corrimiento) {
  const REF = vm.runInContext("REFERENCIA", ctx);
  const BARRAS = vm.runInContext("REFERENCIA_BARRAS", ctx);
  return {
    tipo: "formato", ancho: 800, alto: 1130, hoja: null, gris: null,
    bandas: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1], bandasIzq: [0, 0, 0, 0, 0, 0],
    lineas: REF[hoja].map(function (y) { return escala * y + corrimiento; }),
    barras: BARRAS[hoja].map(function (y) { return escala * y + corrimiento; }),
  };
}

function repartir(paginas) {
  ctx.__paginas = paginas;
  vm.runInContext("etiquetarHojasFormato(__paginas)", ctx);
  return paginas.map(function (p) { return p.hoja; });
}

test("reconoce cada hoja aunque lleguen desordenadas", function () {
  const paginas = [paginaDe("2/3", 1.0, 0), paginaDe("3/3", 1.0, 0), paginaDe("1/3", 1.0, 0)];
  assert.deepStrictEqual(repartir(paginas), ["2/3", "3/3", "1/3"]);
});

test("aguanta escala y corrimiento como los de un escaneo", function () {
  const paginas = [paginaDe("1/3", 1.02, -0.01), paginaDe("2/3", 0.98, 0.012), paginaDe("3/3", 1.01, 0.004)];
  assert.deepStrictEqual(repartir(paginas), ["1/3", "2/3", "3/3"]);
});

test("no confunde la 1/3 con la 2/3, que es el fallo que se veía", function () {
  const paginas = [paginaDe("2/3", 1.0, 0), paginaDe("1/3", 1.0, 0)];
  const r = repartir(paginas);
  assert.strictEqual(r[0], "2/3", "la hoja de la firma tiene que ser la 2/3");
  assert.strictEqual(r[1], "1/3");
});

test("con una sola hoja del formato la reconoce igual", function () {
  assert.deepStrictEqual(repartir([paginaDe("3/3", 1.0, 0)]), ["3/3"]);
});
