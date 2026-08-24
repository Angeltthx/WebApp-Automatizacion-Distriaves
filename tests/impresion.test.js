/* ================================================================
   Que lo impreso se quede en su sitio.

   Estas pruebas cubren el fallo real de la v12: "Elaboracion de
   comidas preparadas" no cabía en la caja de la marca, pdf-lib partió
   la frase y "preparadas" acabó impreso sobre la fila de País.
   ================================================================ */
const { test } = require("node:test");
const assert = require("node:assert");

const M = require("../public/mapa.js");
globalThis.MAPA = M.MAPA;
globalThis.LISTA_PRECIOS_ESPERADA = require("../public/rejilla.js").LISTA_PRECIOS_ESPERADA;
const F = require("../public/formulario.js");

/* Ancho de una A4 en puntos: es lo que usa pdf-lib para el formato. */
const ANCHO_A4 = 595.28;

test("ningún dato se imprime dentro de la casilla del campo de al lado", function () {
  for (const campo of F.camposDelFormulario()) {
    const m = M.MAPA[campo];
    if (!m || m.clase === "grupo") continue;
    const hasta = m.x0 + F.anchoImprimible(campo);

    for (const otro of Object.keys(M.MAPA)) {
      if (otro === campo) continue;
      const o = M.MAPA[otro];
      if (o.hoja !== m.hoja) continue;
      const solapanY = m.y0 < o.y1 - 0.0015 && o.y0 < m.y1 - 0.0015;
      if (!solapanY || o.x0 <= m.x0) continue;
      assert.ok(hasta <= o.x0,
        campo + " llegaría hasta " + hasta.toFixed(4) + " y " + otro + " empieza en " + o.x0);
    }
  }
});

test("nada se sale del margen derecho de la tabla", function () {
  for (const campo of F.camposDelFormulario()) {
    const m = M.MAPA[campo];
    if (!m || m.clase === "grupo") continue;
    assert.ok(m.x0 + F.anchoImprimible(campo) <= 0.885,
      campo + " se saldría de la tabla");
  }
});

/* El ancho de la marca era demasiado corto para escribir de verdad.
   Si esto deja de cumplirse, es que se volvió a usar la caja cruda. */
test("los campos largos tienen más sitio que la marca que los señalaba", function () {
  for (const campo of ["nombreRazonSocial", "actividadPrincipal", "direccionComercial",
                       "correoFacturacion", "establecimiento"]) {
    const m = M.MAPA[campo];
    assert.ok(F.anchoImprimible(campo) > (m.x1 - m.x0) * 1.4,
      campo + " sigue teniendo el ancho corto de la marca");
  }
});

test("un correo largo cabe en su casilla sin encogerse hasta ser ilegible", function () {
  const correo = "administracion.contabilidad@miempresa.com.co";
  const caja = F.cajaDeImpresion("correoFacturacion", correo);
  const anchoPt = caja.ancho * ANCHO_A4;
  /* Helvetica-Bold gasta ~0.58 del cuerpo por carácter de media. Si a
     6 pt (el mínimo que se imprime) no cupiera, la casilla sería
     demasiado estrecha para lo que se le pide. */
  assert.ok(correo.length * 6 * 0.58 < anchoPt,
    "no cabría ni al cuerpo mínimo: " + anchoPt.toFixed(1) + " pt de ancho");
});

test("la X de una opción cabe dentro de su círculo", function () {
  const casos = [["tipoDocumento", "C.C."], ["tipoEmpresa", "Privada"],
                 ["pepRecursos", "No"], ["tipoClienteForma", "Contado"],
                 ["tipoClientePersona", "Persona Jurídica"]];
  for (const [campo, valor] of casos) {
    const caja = F.cajaDeImpresion(campo, valor);
    assert.ok(caja && caja.marca, campo + " no da una caja de marca");
    /* El radio sale del lado MENOR, así que la X nunca puede
       desbordar por el lado estrecho del círculo. */
    const lado = Math.min(caja.ancho, caja.alto * (841.89 / ANCHO_A4));
    const r = lado * 0.40;
    assert.ok(2 * r <= lado + 1e-9, campo + ": la X se saldría del círculo");
    assert.ok(caja.alto > 0.002 && caja.alto < 0.014,
      campo + ": el círculo tiene un alto raro (" + caja.alto.toFixed(4) + ")");
  }
});

test("las dos opciones de un par de Tipo de cliente son del mismo tamaño", function () {
  for (const campo of Object.keys(F.TIPO_CLIENTE)) {
    const ops = F.opcionesDeCampo(campo);
    const a = F.cajaDeImpresion(campo, ops[0]);
    const b = F.cajaDeImpresion(campo, ops[1]);
    /* Medidos uno a uno sobre el papel: no salen idénticos al sexto
       decimal, pero tienen que ser el mismo círculo. */
    assert.ok(Math.abs(a.alto - b.alto) < 0.0005, campo + ": círculos de distinto alto");
    assert.equal(a.ancho.toFixed(6), b.ancho.toFixed(6), campo + ": círculos de distinto ancho");
  }
});

/* ---- geometría de la letra (v16) ----

   Sustituye a las pruebas del "apoyo" de la v13: aquello se apoyaba en
   encontrar el rótulo impreso a la izquierda, y eso fallaba donde el
   rótulo no está a la izquierda (la fecha, el bloque de la visita).
   Ahora todo cuelga de las dos rayas de cada casilla. */

test("casi todos los campos de texto tienen medida su raya de abajo", function () {
  const texto = F.camposDelFormulario().filter(function (c) {
    return M.MAPA[c] && M.MAPA[c].clase === "texto";
  });
  const conRaya = texto.filter(function (c) { return F.RAYA_ABAJO[c] != null; });
  assert.ok(conRaya.length >= texto.length - 3,
    "solo " + conRaya.length + " de " + texto.length + " tienen raya medida");
});

test("el techo de cada casilla está por encima de su raya, no al revés", function () {
  for (const campo of Object.keys(F.TECHO)) {
    assert.ok(F.RAYA_ABAJO[campo] != null, campo + " tiene techo pero no raya");
    const alto = (F.RAYA_ABAJO[campo] - F.TECHO[campo]) * 841.89;
    assert.ok(alto > 3, campo + ": casilla de " + alto.toFixed(1) + " pt, imposible");
    assert.ok(alto < 40, campo + ": casilla de " + alto.toFixed(1) + " pt, demasiado alta");
  }
});

test("la raya de cada casilla cae dentro o justo debajo de su caja", function () {
  for (const campo of Object.keys(F.RAYA_ABAJO)) {
    const caja = F.cajaDeImpresion(campo, "x");
    if (!caja) continue;
    const raya = F.RAYA_ABAJO[campo];
    assert.ok(raya > caja.y, campo + ": la raya queda por encima de la caja");
    assert.ok(raya < caja.y + caja.alto + 0.006,
      campo + ": la raya queda demasiado lejos por debajo de la caja");
  }
});

test("la fecha se imprime en la casilla blanca, no en la banda gris del rótulo", function () {
  /* Medido en el papel: banda gris 0.0990-0.1123, casilla 0.1129-0.1268. */
  const c = F.cajaDeImpresion("fecha", "03/08/2026");
  assert.ok(c.y >= 0.1125, "la caja empieza dentro de la banda gris");
  assert.ok(c.y + c.alto <= 0.1272, "la caja se pasa de la casilla");
  assert.equal(F.RAYA_ABAJO.fecha, 0.1268);
  assert.equal(F.TECHO.fecha, 0.1123);
});

test("los seis círculos de Tipo de cliente son redondos y del mismo tamaño", function () {
  /* Las cajas van en fracción de página y la A4 no es cuadrada
     (595.28 x 841.89 pt), así que "redondo" se comprueba en puntos. */
  for (const campo of Object.keys(F.TIPO_CLIENTE)) {
    for (const opcion of F.opcionesDeCampo(campo)) {
      const c = F.cajaDeImpresion(campo, opcion);
      assert.equal(c.ancho.toFixed(5), F.DIAMETRO_CIRCULO.toFixed(5),
        campo + "/" + opcion + ": ancho distinto del diámetro medido");
      const anchoPt = c.ancho * 595.28, altoPt = c.alto * 841.89;
      assert.ok(Math.abs(anchoPt - altoPt) < 1,
        campo + "/" + opcion + ": el círculo no es redondo (" +
        anchoPt.toFixed(1) + " x " + altoPt.toFixed(1) + " pt)");
    }
  }
});

test("las marcas de un grupo caen dentro de su círculo, no entre dos", function () {
  /* Antes esto comprobaba que la primera opción quedara por encima de
     la segunda, que solo vale para grupos en columna. "Cliente de"
     (v31) va en fila y son cinco. Lo que se comprueba ahora es que
     todas las marcas de un grupo tengan el tamaño del círculo: si una
     saliera más grande o más pequeña, la X se vería descuadrada
     respecto a las de al lado aunque cayera en el sitio.

     Que no se solapen se comprueba en formulario.test.js. */
  for (const campo of Object.keys(F.TIPO_CLIENTE)) {
    for (const op of F.opcionesDeCampo(campo)) {
      const c = F.cajaDeImpresion(campo, op);
      assert.ok(c.marca, campo + " / " + op + ": no está marcada como círculo");
      assert.equal(Math.round(c.ancho * 1e5), Math.round(F.DIAMETRO_CIRCULO * 1e5),
        campo + " / " + op + ": el ancho no es el del círculo");
      assert.ok(c.alto > 0.008 && c.alto < 0.012,
        campo + " / " + op + ": alto raro (" + c.alto + ")");
    }
  }
});

/* ---- letra a mano simulada (v26) ----

   Lo que separaba nuestra letra de una escrita a mano no era la
   tipografía: era que TODO estaba perfecto. Misma altura, mismo
   tamaño, misma inclinación. Ahora cada carácter lleva su desvío. */

test("el mismo texto en el mismo campo se dibuja siempre igual", function () {
  /* Sin semilla, la vista previa cambiaría de forma en cada tecla y
     parecería que la app tiembla. */
  const a = F.azarConSemilla("nombreRazonSocial|Peter Parker");
  const b = F.azarConSemilla("nombreRazonSocial|Peter Parker");
  const uno = [a(), a(), a(), a(), a()];
  const dos = [b(), b(), b(), b(), b()];
  assert.deepEqual(uno, dos);
});

test("dos campos distintos no tiemblan igual", function () {
  const a = F.azarConSemilla("nombreRazonSocial|Peter Parker");
  const b = F.azarConSemilla("contactoNombre|Peter Parker");
  assert.notDeepEqual([a(), a(), a()], [b(), b(), b()],
    "si dos campos comparten el temblor, se nota el patrón");
});

test("el azar se queda entre 0 y 1", function () {
  const a = F.azarConSemilla("lo que sea");
  for (let i = 0; i < 200; i++) {
    const v = a();
    assert.ok(v >= 0 && v < 1, "salió " + v);
  }
});

test("al medir el ancho se cuenta la holgura del temblor", function () {
  /* Si no, el último carácter se sale de la casilla: las letras
     avanzan un poco más de lo que mide la fuente. */
  const fuenteFalsa = { widthOfTextAtSize: function (t, c) { return t.length * c * 0.5; } };
  const liso = fuenteFalsa.widthOfTextAtSize("Peter Parker", 10);
  const conTemblor = F.anchoConTemblor(fuenteFalsa, "Peter Parker", 10);
  assert.ok(conTemblor > liso, "el ancho con temblor tiene que ser mayor");
  assert.ok(conTemblor < liso * 1.1, "pero no tanto como para encoger la letra sin motivo");
});

test("la tinta no es negro puro", function () {
  /* El negro absoluto no existe en un papel escaneado y es lo que más
     delata que el texto se imprimió. */
  const [r, g, b] = F.TINTA_PLUMA;
  assert.ok(r > 0 && g > 0 && b > 0, "sigue siendo negro puro");
  assert.ok(b > r, "un bolígrafo tira a azul, no a rojo");
  assert.ok(r < 0.3 && g < 0.3 && b < 0.35, "demasiado clara para leerse impresa");
});

/* ---- que no parezca escrito a máquina (v26) ----

   Cada carácter se dibuja con su propio temblor de altura, tamaño y
   giro. Lo que hay que garantizar es que el temblor sea REPETIBLE: si
   cambiara en cada dibujado, la vista previa y el PDF descargado
   saldrían distintos y cada corrección movería toda la hoja. */

test("el mismo dato tiembla siempre igual", function () {
  const a = F.semillaDe("nombreRazonSocial|Peter Parker");
  const b = F.semillaDe("nombreRazonSocial|Peter Parker");
  assert.equal(a, b);
  const d1 = F.dadoDe(a), d2 = F.dadoDe(b);
  for (let i = 0; i < 20; i++) assert.equal(d1(), d2());
});

test("datos distintos tiemblan distinto", function () {
  assert.notEqual(F.semillaDe("campoA|Peter Parker"), F.semillaDe("campoB|Peter Parker"));
  assert.notEqual(F.semillaDe("campoA|Peter Parker"), F.semillaDe("campoA|Peter Parker "));
});

test("el dado se queda entre 0 y 1 y no se atasca", function () {
  const dado = F.dadoDe(F.semillaDe("cualquiera"));
  const vistos = new Set();
  for (let i = 0; i < 500; i++) {
    const v = dado();
    assert.ok(v >= 0 && v < 1, "salió fuera de rango: " + v);
    vistos.add(Math.floor(v * 10));
  }
  assert.ok(vistos.size >= 8, "el dado se atascó: solo " + vistos.size + " de 10 tramos");
});

test("el ancho con temblor se parece al ancho normal, no se dispara", function () {
  const fuente = { widthOfTextAtSize: function (t, s) { return t.length * s * 0.5; } };
  const texto = "Cindy Paola Steffanell Maiquez";
  const normal = texto.length * 10 * 0.5;
  const conTemblor = F.anchoTembloroso(fuente, texto, 10, F.semillaDe("x|" + texto));
  assert.ok(Math.abs(conTemblor - normal) / normal < 0.06,
    "el temblor cambia el ancho un " +
    Math.round(Math.abs(conTemblor - normal) / normal * 100) + "%, demasiado para ajustar la casilla");
});

test("el temblor es pequeño: es letra, no un tembleque", function () {
  assert.ok(F.TEMBLOR_ALTURA > 0 && F.TEMBLOR_ALTURA <= 0.08);
  assert.ok(F.TEMBLOR_TAMANO > 0 && F.TEMBLOR_TAMANO <= 0.08);
});

test("la tinta es de bolígrafo, no negro absoluto", function () {
  const [r, g, b] = F.TINTA_BOLIGRAFO;
  assert.ok(r > 0.02 && g > 0.02, "un negro puro sobre un escaneo gris canta");
  assert.ok(b > r, "la tinta de bolígrafo tira a azul, no al revés");
  assert.ok(Math.max(r, g, b) < 0.3, "demasiado clara para leerse impresa");
});
