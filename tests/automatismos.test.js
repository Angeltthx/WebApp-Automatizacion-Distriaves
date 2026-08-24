/* ================================================================
   Lo que la app rellena sola (v31)

   Todo lo de aquí es algo que el formato lleva puesto sin que nadie lo
   escriba: el vendedor, la ruta, el canal, la firma. Y ahí está el
   riesgo: un valor fijo equivocado no se nota al llenar el
   cuestionario —porque nadie lo escribe, luego nadie lo lee— y sale
   impreso en TODOS los paquetes hasta que alguien lo devuelve.

   Por eso se comprueba el valor exacto, no solo que haya algo.
   ================================================================ */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..", "public");
globalThis.MAPA = require("../public/mapa.js").MAPA;
globalThis.LISTA_PRECIOS_ESPERADA = require("../public/rejilla.js").LISTA_PRECIOS_ESPERADA;
const F = require("../public/formulario.js");

/* ---------------- los valores que se repiten ---------------- */

test("los fijos de la vendedora salen puestos y con el valor exacto", function () {
  const d = F.valoresPorDefecto();
  assert.equal(d.vendedor, "10020265", "el código de vendedor va impreso en todos los paquetes");
  assert.equal(d.canal, "03");
  assert.equal(d.clienteCercano, "N/A");
  assert.equal(d.clienteDe, "Delichicks S.A.S.");
  assert.equal(d.responsableNombre, "Olga Lucía Lemus");
});

test("el vendedor es el código, no un nombre", function () {
  /* Es el campo con más papeletas para que alguien lo "arregle"
     poniendo el nombre de la persona. En el formato va el código. */
  assert.match(F.valoresPorDefecto().vendedor, /^\d{8}$/);
});

test("los atajos escriben el valor, no la etiqueta", function () {
  /* La zona de transporte se elige por barrio y en el papel cae solo
     el código: "25-L104", nunca "25-L104 (Suba)". Si esto se rompe,
     el formato sale con el nombre del barrio metido en la casilla. */
  for (const z of F.ZONAS_TRANSPORTE) {
    assert.match(z.valor, /^25-L10[34]$/, "la ruta no tiene la forma esperada: " + z.valor);
    assert.ok(!/[()]/.test(z.valor), "el valor lleva paréntesis: " + z.valor);
    assert.ok(/\(/.test(z.etiqueta), "la etiqueta debería decir el barrio: " + z.etiqueta);
  }
  assert.equal(F.valoresPorDefecto().zonaTransporte, "25-L104");
});

test("los códigos postales tienen los seis dígitos que usa Colombia", function () {
  for (const c of F.CODIGOS_POSTALES) {
    assert.match(c.valor, /^\d{6}$/, c.etiqueta + ": " + c.valor);
  }
  /* Los dos primeros dígitos son el departamento y en Bogotá son 11. */
  for (const c of F.CODIGOS_POSTALES) {
    assert.equal(c.valor.slice(0, 2), "11", c.etiqueta + " no parece de Bogotá");
  }
});

test("cada ciudad trae su departamento y no se cruzan", function () {
  /* Un departamento cruzado —Cali con Antioquia— sale impreso en la
     casilla Municipio de la hoja 3 sin que nadie lo escriba. */
  const esperado = { "Bogotá": "Cundinamarca", "Medellín": "Antioquia", "Cali": "Valle del Cauca",
                     "Barranquilla": "Atlántico", "Cartagena": "Bolívar" };
  for (const c of F.CIUDADES) {
    assert.equal(c.departamento, esperado[c.ciudad], c.ciudad + " tiene mal el departamento");
  }
  assert.equal(F.departamentoDe("Bogotá"), "Cundinamarca");
  assert.equal(F.departamentoDe("Medellín"), "Antioquia");
});

test("una ciudad desconocida no inventa departamento", function () {
  /* Devolver algo aquí sería poner el departamento de otra ciudad en
     el papel. Mejor dejar el campo como estaba. */
  assert.equal(F.departamentoDe("Sogamoso"), null);
  assert.equal(F.departamentoDe(""), null);
  assert.equal(F.departamentoDe(undefined), null);
});

test("los atajos apuntan a campos que existen y son de texto", function () {
  /* Un atajo sobre un campo de círculos no se pintaría nunca, y sobre
     un campo inexistente tampoco: en los dos casos el botón
     desaparece sin decir nada. */
  const campos = F.camposDelFormulario();
  for (const campo of Object.keys(F.ATAJOS)) {
    assert.ok(campos.indexOf(campo) >= 0, campo + " tiene atajos pero no está en el cuestionario");
    assert.equal(F.tipoDeCampo(campo), "texto", campo + " es un grupo: los atajos no se pintan");
    for (const a of F.ATAJOS[campo]) {
      assert.ok(a.etiqueta && a.valor, campo + ": un atajo sin etiqueta o sin valor");
    }
  }
});

test("los valores por defecto que salen de una lista están EN esa lista", function () {
  /* Si el valor puesto no coincide con ningún atajo, la pantalla
     muestra los botones y ninguno marcado, y parece que no hay nada
     elegido cuando sí lo hay. */
  const d = F.valoresPorDefecto();
  for (const campo of Object.keys(F.ATAJOS)) {
    if (!d[campo]) continue;
    const valores = F.ATAJOS[campo].map(function (a) { return a.valor; });
    assert.ok(valores.indexOf(d[campo]) >= 0,
      campo + ' viene con "' + d[campo] + '" y los atajos son: ' + valores.join(", "));
  }
});

/* ---------------- el teléfono y el nombre del negocio ---------------- */

test("el teléfono se copia a los otros dos sitios donde lo pide el formato", function () {
  assert.equal(F.SUGERENCIAS.contactoTelefono, "telefono");
  assert.equal(F.SUGERENCIAS.telMovil, "telefono");
});

test("el teléfono se copia pero se puede cambiar", function () {
  /* Va como sugerencia y NO como espejo a propósito: el fijo del
     negocio y el móvil de pedidos son distintos más veces de las que
     parece. Si alguien lo pasa a ESPEJOS, los tres quedan atados para
     siempre y esta prueba lo dice. */
  for (const campo of ["contactoTelefono", "telMovil", "establecimiento"]) {
    assert.equal(F.ESPEJOS[campo], undefined,
      campo + " está como espejo: dejaría de poderse corregir a mano");
  }
});

test("el nombre del negocio sale de la razón social", function () {
  assert.equal(F.SUGERENCIAS.establecimiento, "nombreRazonSocial");
});

test("las sugerencias nuevas apuntan a campos que existen", function () {
  const campos = F.camposDelFormulario();
  for (const destino of Object.keys(F.SUGERENCIAS)) {
    assert.ok(campos.indexOf(destino) >= 0, destino + " no está en el cuestionario");
    assert.ok(campos.indexOf(F.SUGERENCIAS[destino]) >= 0,
      "la sugerencia de " + destino + " viene de un campo que no existe");
  }
});

/* ---------------- la fila "Cliente de" ---------------- */

test("Cliente de trae las cinco empresas del papel", function () {
  const ops = F.opcionesDeCampo("clienteDe");
  assert.deepEqual(ops, ["Solla S.A.", "Transgraneles S.A.S.", "Agrinal S.A.S.",
                         "Súper Pollos del Galpón", "Delichicks S.A.S."]);
});

test("las cinco marcas de Cliente de caen en la fila, no en la de abajo", function () {
  /* Debajo va "Tipo de cliente". Una X con la y equivocada caería
     sobre Contado o Vinculación y marcaría dos cosas a la vez. */
  for (const op of F.opcionesDeCampo("clienteDe")) {
    const c = F.cajaDeImpresion("clienteDe", op);
    assert.ok(c.y > 0.130 && c.y < 0.150, op + ": y fuera de la fila (" + c.y + ")");
    const contado = F.cajaDeImpresion("tipoClienteForma", "Contado");
    assert.ok(c.y + c.alto <= contado.y, op + " se solapa con la fila de Tipo de cliente");
  }
});

test("las cinco marcas van en orden de izquierda a derecha", function () {
  /* El orden de las opciones tiene que ser el del papel: si no, elegir
     "Agrinal" marcaría el círculo de otra empresa. */
  const xs = F.opcionesDeCampo("clienteDe").map(function (o) {
    return F.cajaDeImpresion("clienteDe", o).x;
  });
  for (let i = 1; i < xs.length; i++) {
    assert.ok(xs[i] > xs[i - 1], "la opción " + i + " no está a la derecha de la anterior");
  }
});

/* ---------------- la firma ---------------- */

test("el PNG de la firma está donde dice la constante", function () {
  assert.ok(fs.existsSync(path.join(RAIZ, F.RUTA_FIRMA)), "no está " + F.RUTA_FIRMA);
});

test("la firma es un PNG con transparencia de verdad", function () {
  /* Sin canal alfa se estamparía un rectángulo blanco encima del
     recuadro del formato, tapando la raya de firmar. La cabecera IHDR
     de un PNG lleva el tipo de color en el byte 25: 6 es RGBA. */
  const bytes = fs.readFileSync(path.join(RAIZ, F.RUTA_FIRMA));
  assert.equal(bytes.slice(1, 4).toString(), "PNG", "no es un PNG");
  assert.equal(bytes[25], 6, "el PNG no lleva canal alfa");
});

test("la firma es apaisada, como una firma", function () {
  /* Un recorte accidentalmente vertical entraría deformado en la
     casilla, que es ancha y baja. El alto sale de la proporción de la
     imagen, así que una imagen con la proporción mal se sale del
     recuadro. */
  const bytes = fs.readFileSync(path.join(RAIZ, F.RUTA_FIRMA));
  const ancho = bytes.readUInt32BE(16), alto = bytes.readUInt32BE(20);
  assert.ok(ancho > alto * 3, "la firma no es apaisada: " + ancho + "x" + alto);
  assert.ok(ancho >= 600, "la firma es pequeña y saldría dentada al imprimir: " + ancho + " px");
});

test("se puede apagar el estampado sin tocar nada más", function () {
  /* Es la salida si algún día hay que volver a firmar a mano. */
  assert.equal(typeof F.FIRMA_ESTAMPADA, "boolean");
});

test("quien firma y el nombre impreso encima son la misma persona", function () {
  /* El nombre va escrito justo encima de la firma. Que no coincidan es
     el tipo de cosa que nadie mira porque los dos salen solos. */
  assert.equal(F.valoresPorDefecto().responsableNombre, F.RESPONSABLE_COMERCIAL);
});

test("la firma llega de verdad al PDF, no solo al código", async function () {
  /* Las pruebas de arriba miran el PNG y las constantes. Ésta genera
     el formato y comprueba que la imagen quedó dentro: `estamparFirma`
     se traga sus propios errores a propósito —un paquete sin firma se
     arregla firmando, uno que no se genera deja sin nada— y por eso
     un fallo ahí sería mudo. */
  const PDFLib = require("pdf-lib");
  globalThis.PDFLib = PDFLib;
  globalThis.fontkit = require("@pdf-lib/fontkit");
  globalThis.fetch = async function (u) {
    return { ok: true, arrayBuffer: async function () { return fs.readFileSync(path.join(RAIZ, u)); } };
  };

  function imagenes(pagina) {
    const xo = pagina.node.Resources().lookup(PDFLib.PDFName.of("XObject"));
    return xo ? xo.keys().length : 0;
  }

  /* Se cuenta contra el PDF BASE, no contra cero: la hoja 3 ya trae
     una imagen suya —el escaneo del formato en blanco— y comprobar
     "hay alguna imagen" daba verdadero con la firma apagada. Comprobado
     poniendo FIRMA_ESTAMPADA en false: la prueba seguía pasando. */
  const base = await PDFLib.PDFDocument.load(
    fs.readFileSync(path.join(RAIZ, "formato", "FO-901-vacio.pdf")));
  const antes = imagenes(base.getPages()[2]);

  const doc = await PDFLib.PDFDocument.load(await F.generarPdf(F.datosDePrueba()));
  const despues = imagenes(doc.getPages()[2]);

  assert.equal(despues, antes + 1,
    "la hoja 3 tenía " + antes + " imagen(es) y ahora tiene " + despues +
    ": la firma no se estampó");
});
