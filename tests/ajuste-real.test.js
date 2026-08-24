/* ================================================================
   Ajuste sobre hojas REALES, no sintéticas.

   Las otras pruebas de rejilla usan hojas generadas a partir de la
   propia plantilla: siempre calzan. Esta usa el gris de las tres hojas
   de un paquete de verdad (prueba2.pdf, con errores puestos a
   propósito) y del formato en blanco (Formato_Vacio.pdf).

   Es la prueba que en la v9 habría fallado, y por eso existe: en la v9
   la hoja 1 calzaba 15 de 24 rayas —la letra parte la raya y el
   detector no la ve— y ninguna casilla se llegaba a medir.

   Los .raw.gz son el canal de gris a 800 px de ancho, un byte por
   píxel, por filas, comprimidos (en crudo son 5.3 MB y no vale la pena
   arrastrarlos así). Si no están, la prueba se salta sola.
   ================================================================ */
const { test, skip } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");

const R = require("../public/rejilla.js");
const DIR = path.join(__dirname, "grises");

function hoja(nombre, ancho) {
  const ruta = path.join(DIR, nombre + ".raw.gz");
  if (!fs.existsSync(ruta)) return null;
  const datos = new Uint8Array(zlib.gunzipSync(fs.readFileSync(ruta)));
  return { gris: datos, ancho: ancho, alto: datos.length / ancho };
}

function ajustar(g, etiqueta, hueco) {
  const l = R.lineasDeLaHoja(g.gris, g.ancho, g.alto, hueco);
  const barras = R.detectarBarras(g.gris, g.ancho, g.alto);
  const ancla = R.anclarConBarras(barras, R.REFERENCIA_BARRAS[etiqueta]);
  return R.emparejar(l.lineas, R.REFERENCIA[etiqueta], undefined, ancla);
}

/* Igual que ubicarRejillaDe(): estricto y tolerante, gana el que se
   pone de acuerdo con las barras. */
function mejorAjuste(g, etiqueta) {
  const c = [ajustar(g, etiqueta, 0), ajustar(g, etiqueta, R.HUECO_TRAZO)]
    .filter(Boolean)
    .sort(function (a, b) {
      if (!!b.acuerdo !== !!a.acuerdo) return b.acuerdo ? 1 : -1;
      return b.confianza - a.confianza;
    });
  return c[0] || null;
}

const disponible = fs.existsSync(path.join(DIR, "p1.raw.gz"));

if (!disponible) {
  skip("Faltan los grises de referencia en tests/grises/ (ver README).");
} else {

  test("el formato en blanco calza en las tres hojas", function () {
    for (const [archivo, etiqueta] of [["v1", "1/3"], ["v2", "2/3"], ["v3", "3/3"]]) {
      const g = hoja(archivo, 800);
      const a = mejorAjuste(g, etiqueta);
      assert.ok(a, "sin ajuste para " + etiqueta);
      assert.ok(a.confianza >= 0.75,
        etiqueta + " calzó solo " + Math.round(a.confianza * 100) + "% de las rayas");
    }
  });

  test("cada hoja del paquete real gana con SU plantilla", function () {
    for (const [archivo, esperada] of [["p1", "1/3"], ["p2", "2/3"], ["p3", "3/3"]]) {
      const g = hoja(archivo, 800);
      let mejor = null;
      for (const etiqueta of Object.keys(R.REFERENCIA)) {
        /* El reparto de hojas usa el detector estricto, como en
           verificador.js: el tolerante infla el puntaje de la hoja 1 y
           le roba la hoja 2. */
        const a = ajustar(g, etiqueta, 0);
        if (a && (!mejor || a.puntaje > mejor.puntaje)) mejor = Object.assign({ etiqueta: etiqueta }, a);
      }
      assert.equal(mejor.etiqueta, esperada, archivo + " se clasificó como " + mejor.etiqueta);
    }
  });

  /* EL CORAZÓN DE LA v10. En la v9 esto daba exacto=false en las dos y
     por eso no se detectaba ni una casilla vacía. */
  test("las hojas 1 y 3 del paquete real llegan a recuadro exacto", function () {
    for (const [archivo, etiqueta] of [["p1", "1/3"], ["p3", "3/3"]]) {
      const a = mejorAjuste(hoja(archivo, 800), etiqueta);
      assert.ok(a && a.exacto,
        "la hoja " + etiqueta + " no llegó a exacta (confianza " +
        (a ? Math.round(a.confianza * 100) : 0) + "%)");
    }
  });

  test("con hueco 0 la hoja 1 escrita pierde rayas: es el fallo de la v9", function () {
    const estricto = ajustar(hoja("p1", 800), "1/3", 0);
    const tolerante = ajustar(hoja("p1", 800), "1/3", R.HUECO_TRAZO);
    assert.ok(estricto.confianza < 0.75,
      "si esto sube por sí solo, el arreglo del hueco dejó de hacer falta");
    assert.ok(tolerante.confianza > estricto.confianza,
      "el detector tolerante tiene que ver MÁS rayas que el estricto");
  });

  test("las celdas a transcribir caen dentro de la hoja", function () {
    for (const [archivo, etiqueta] of [["p1", "1/3"], ["p3", "3/3"]]) {
      const a = mejorAjuste(hoja(archivo, 800), etiqueta);
      const enEstaHoja = Object.keys(R.CELDAS)
        .filter(function (c) { return R.CELDAS[c].hoja === etiqueta; });
      assert.ok(enEstaHoja.length, "la hoja " + etiqueta + " no tiene celdas definidas");
      for (const campo of enEstaHoja) {
        const caja = R.ubicarCelda(campo, a);
        assert.ok(caja, campo + " no se pudo ubicar");
        assert.ok(caja.y >= 0 && caja.y + caja.alto <= 1, campo + " se sale de la hoja");
        assert.ok(caja.alto > 0.004 && caja.alto < 0.05,
          campo + " tiene un alto imposible para una fila: " + caja.alto);
      }
    }
  });

  test("los tres correos de la hoja 1 son tres celdas distintas", function () {
    const a = mejorAjuste(hoja("p1", 800), "1/3");
    const cajas = R.CELDAS_CORREO.map(function (c) { return R.ubicarCelda(c, a); });
    const centros = cajas.map(function (c) { return Math.round((c.y + c.alto / 2) * 1000); });
    assert.equal(new Set(centros).size, 3, "dos correos apuntan a la misma fila");
  });
}
