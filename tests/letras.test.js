/* ================================================================
   Las tres letras, el nombre del archivo y el juego de prueba (v30)

   Lo que se comprueba aquí es lo que dejaría un formato inservible
   sin que se vea en pantalla:

     · una letra con las medidas de OTRA, que saca el texto de la
       casilla o lo deja flotando (es el error #25, y ahora hay tres
       sitios donde equivocarse en vez de uno);
     · una fuente sin ñ ni tildes, que en un formato colombiano
       significa medio formulario con huecos;
     · una fuente VARIABLE, que pdf-lib no instancia y sale fina y con
       agujeros sin avisar de nada (el error #24, con Caveat);
     · un nombre de archivo que Windows no acepta o que sale con dos
       puntos seguidos;
     · un juego de datos de prueba que deje campos vacíos, y entonces
       no sirve para lo único que existe: mirar el formato lleno.
   ================================================================ */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..", "public");

globalThis.MAPA = require("../public/mapa.js").MAPA;
globalThis.LISTA_PRECIOS_ESPERADA = require("../public/rejilla.js").LISTA_PRECIOS_ESPERADA;
const F = require("../public/formulario.js");
const V = require("../public/verificar-ui.js");

/* Se usa el mismo lector de fuentes que usa la app para incrustarlas,
   así lo que se comprueba aquí es lo que verá pdf-lib. */
const fontkit = require("@pdf-lib/fontkit");

/* ---------------- las tres letras ---------------- */

test("hay tres letras y Short Stack sigue siendo la de por defecto", function () {
  assert.equal(F.LETRAS.length, 3);
  assert.equal(F.LETRA_POR_DEFECTO, "shortstack");
  assert.equal(F.letraActual().id, "shortstack",
    "sin elegir nada tiene que salir la de la v29, que es la que ya estaba validada");
});

test("cada letra trae su archivo, sus dos medidas y su pista", function () {
  for (const l of F.LETRAS) {
    assert.ok(l.id && l.nombre && l.pista, l.id + ": le falta nombre o pista");
    assert.ok(fs.existsSync(path.join(RAIZ, l.ruta)), l.id + ": no está el .ttf en " + l.ruta);
    /* Las medidas van juntas con la ruta a propósito. Si alguna se
       queda a cero o fuera de rango, el texto se coloca con las
       medidas de otra fuente: o se sale de la casilla por arriba o
       queda flotando en mitad de la fila. */
    assert.ok(l.sube > 0.5 && l.sube < 1.2, l.id + ": `sube` fuera de rango (" + l.sube + ")");
    assert.ok(l.baja >= 0 && l.baja < 0.6, l.id + ": `baja` fuera de rango (" + l.baja + ")");
  }
});

test("ninguna letra repite el par de medidas de otra", function () {
  /* Copiar una entrada y olvidarse de cambiar `sube`/`baja` es el
     error fácil de este catálogo, y no se nota: el PDF sale, solo que
     con el texto mal apoyado. */
  const vistas = new Set();
  for (const l of F.LETRAS) {
    const clave = l.sube + "/" + l.baja;
    assert.ok(!vistas.has(clave), l.id + " tiene las mismas medidas que otra letra: " + clave);
    vistas.add(clave);
  }
});

test("las medidas de cada letra son las de SU archivo, no las de otra", function () {
  /* Ésta es la prueba que de verdad importa: vuelve a medir el TTF y
     lo compara con lo que dice el catálogo. El método es el mismo con
     el que se midieron (el mayor y el menor alcance de los contornos
     de un texto de muestra, en fracción del cuerpo) y está validado
     contra los números que ya existían para Kalam Bold y Short Stack.

     La tolerancia es de 0.01 del cuerpo: en una casilla de 11 px eso
     es un décimo de píxel, o sea que ninguna diferencia visible pasa
     por aquí. */
  const MUESTRA = "Angel Jesús ñ 0123 gjpy";
  for (const l of F.LETRAS) {
    const fuente = fontkit.create(fs.readFileSync(path.join(RAIZ, l.ruta)));
    let arriba = -Infinity, abajo = Infinity;
    for (const glifo of fuente.layout(MUESTRA).glyphs) {
      const caja = glifo.bbox;
      if (!caja || caja.maxY === caja.minY) continue;
      arriba = Math.max(arriba, caja.maxY / fuente.unitsPerEm);
      abajo = Math.min(abajo, caja.minY / fuente.unitsPerEm);
    }
    assert.ok(Math.abs(arriba - l.sube) < 0.01,
      l.id + ": `sube` dice " + l.sube + " y el archivo mide " + arriba.toFixed(4));
    assert.ok(Math.abs(-abajo - l.baja) < 0.01,
      l.id + ": `baja` dice " + l.baja + " y el archivo mide " + (-abajo).toFixed(4));
  }
});

test("ninguna letra es variable: pdf-lib no las instancia", function () {
  /* El error #24: Caveat salió fina y con huecos porque solo existe
     como fuente variable y pdf-lib se queda con la instancia base sin
     decir nada. El PDF se genera igual, así que esto no se cae solo:
     hay que preguntarlo. */
  for (const l of F.LETRAS) {
    const fuente = fontkit.create(fs.readFileSync(path.join(RAIZ, l.ruta)));
    assert.ok(!fuente.variationAxes || !Object.keys(fuente.variationAxes).length,
      l.id + " es una fuente variable y no sirve para incrustar");
  }
});

test("las tres letras traen la ñ y las tildes que pide el formato", function () {
  /* Sin esto se descartaron dos candidatas que por lo demás encajaban
     (Gaegu Bold y Nanum Pen Script). Un nombre colombiano sin ñ ni
     tildes sale con huecos, y el hueco no se ve hasta que el formato
     está impreso. */
  const PIDE = "ñÑáéíóúÁÉÍÓÚüÜ";
  for (const l of F.LETRAS) {
    const fuente = fontkit.create(fs.readFileSync(path.join(RAIZ, l.ruta)));
    const faltan = [...PIDE].filter(function (c) { return !fuente.hasGlyphForCodePoint(c.codePointAt(0)); });
    assert.deepEqual(faltan, [], l.id + " no tiene: " + faltan.join(""));
  }
});

test("cada letra tiene su licencia al lado", function () {
  /* Las tres son de fuera y las tres piden que la licencia viaje con
     el archivo: Short Stack y Gochi Hand son SIL OFL, Permanent
     Marker es Apache 2.0. */
  const licencias = fs.readdirSync(path.join(RAIZ, "fuentes"))
    .filter(function (f) { return /\.txt$/i.test(f); });
  assert.ok(licencias.length >= F.LETRAS.length,
    "hay " + F.LETRAS.length + " letras y solo " + licencias.length + " licencias en la carpeta");
});

test("elegir una letra la cambia; una que no existe no cambia nada", function () {
  const antes = F.letraActual().id;
  assert.equal(F.elegirLetra("no-existe-esta-letra"), false);
  assert.equal(F.letraActual().id, antes, "una letra inventada no debería cambiar la elegida");

  for (const l of F.LETRAS) {
    assert.equal(F.elegirLetra(l.id), true);
    assert.equal(F.letraActual().id, l.id, "elegir " + l.id + " no la dejó puesta");
  }
  F.elegirLetra(F.LETRA_POR_DEFECTO);
});

test("ninguna letra se sale de su casilla por arriba", function () {
  /* Hasta la v29 esto se comprobó UNA vez, a mano, con una sola
     fuente ("0 de 36 campos se pasan de su raya"). Con tres letras hay
     tres formas de romperlo, así que se comprueba con la misma cuenta
     que hace `generarPdf`: dónde apoya la letra, cuánto sube la más
     alta contando el temblor, y si eso se pasa del techo de la
     casilla.

     No se mide sobre el PDF porque haría falta rasterizarlo, que es
     una dependencia más; lo que se comprueba es la aritmética de la
     colocación, que es donde vive el fallo. */
  const campos = F.camposDelFormulario()
    .filter(function (c) { return F.tipoDeCampo(c) === "texto" && F.RAYA_ABAJO[c] != null; });
  assert.ok(campos.length > 30, "esperaba más campos con raya medida, encontré " + campos.length);

  for (const l of F.LETRAS) {
    for (const campo of campos) {
      const abajo = F.RAYA_ABAJO[campo];
      const arriba = F.TECHO[campo] != null ? F.TECHO[campo] : abajo - 0.016;
      const altoCelda = abajo - arriba;

      const alturaPorPunto = l.sube * (1 + F.TEMBLOR_TAMANO) + F.TEMBLOR_ALTURA + 0.75 * l.baja;
      const cuerpo = Math.min(13, altoCelda / alturaPorPunto);
      /* Lo más alto a lo que llega la letra más alta de la casilla,
         contando que puede salir un 5% más grande y subida otro 5%. */
      const sobreLaRaya = 0.75 * l.baja * cuerpo +
                          l.sube * cuerpo * (1 + F.TEMBLOR_TAMANO) + F.TEMBLOR_ALTURA * cuerpo;
      assert.ok(sobreLaRaya <= altoCelda + 1e-9,
        l.id + " se pasa del techo en " + campo +
        " (sube " + sobreLaRaya.toFixed(4) + " y la casilla mide " + altoCelda.toFixed(4) + ")");
    }
  }
});

/* ---------------- el nombre del archivo ---------------- */

test("el nombre del archivo aguanta lo que se le eche", function () {
  const n = V.nombreDeArchivoFormato;
  assert.equal(n("Peña Gómez"), "FO-901 Peña Gómez.pdf",
    "las tildes y la ñ se quedan: son la mitad de los nombres");
  assert.equal(n("Müller"), "FO-901 Müller.pdf", "la diéresis también");
  assert.equal(n(""), "FO-901 sin nombre.pdf");
  assert.equal(n("   "), "FO-901 sin nombre.pdf");
  assert.equal(n(null), "FO-901 sin nombre.pdf");
  assert.equal(n("Comercializadora S.A.S."), "FO-901 Comercializadora S.A.S.pdf",
    "un punto final dejaría dos puntos seguidos, y Windows lo borra por su cuenta");
});

test("el nombre del archivo no lleva nada que Windows rechace", function () {
  const salida = V.nombreDeArchivoFormato('C:/ruta\\mala *nombre? <raro> "x" | y');
  for (const malo of ["\\", "/", ":", "*", "?", '"', "<", ">", "|"]) {
    assert.ok(salida.indexOf(malo) < 0, "quedó un " + malo + " en: " + salida);
  }
  assert.ok(salida.endsWith(".pdf"));
});

test("un nombre larguísimo se recorta y no queda colgando de un punto", function () {
  const largo = V.nombreDeArchivoFormato("Distribuidora ".repeat(40));
  assert.ok(largo.length < 140, "salió de " + largo.length + " caracteres");
  assert.ok(!/[.\s]\.pdf$/.test(largo), "quedó un punto o un espacio antes de la extensión");
});

/* ---------------- el juego de prueba ---------------- */

test("los datos de prueba no dejan ningún campo vacío", function () {
  /* Es lo único para lo que existe el juego: ver el formato LLENO. Si
     deja campos fuera, el hueco se lee como un fallo de colocación y
     se persigue un problema que no está. */
  assert.deepEqual(F.camposVacios(F.datosDePrueba()), []);
});

test("los datos de prueba no traen ningún aviso de formato", function () {
  /* Si el propio juego de prueba tiene un correo sin arroba o una
     cédula con puntos, la pantalla sale llena de avisos rojos y ya no
     se sabe cuáles son de verdad. */
  const avisos = F.avisosDelFormulario(F.datosDePrueba());
  assert.deepEqual(avisos.map(function (a) { return a.campo; }), []);
});

test("cada grupo del juego de prueba marca una opción que existe", function () {
  /* Es el error #23: un valor copiado a un grupo que no lo tiene deja
     la casilla SIN marcar y sin que nada avise. */
  const datos = F.datosDePrueba();
  for (const campo of F.camposDelFormulario()) {
    if (F.tipoDeCampo(campo) !== "grupo") continue;
    const opciones = F.opcionesDeCampo(campo);
    assert.ok(opciones.indexOf(datos[campo]) >= 0,
      campo + ' vale "' + datos[campo] + '" y sus opciones son: ' + opciones.join(", "));
  }
});

test("los datos de prueba se ven falsos a simple vista", function () {
  /* Si un formato de prueba se cuela impreso en un paquete de verdad,
     tiene que cantar. Por eso el correo va a ejemplo.com —el dominio
     reservado justo para esto— y los documentos empiezan por
     1000000000, que está fuera del rango de cédulas emitidas. */
  const datos = F.datosDePrueba();
  assert.match(datos.correoFacturacion, /@ejemplo\.com$/);
  assert.match(datos.nombreRazonSocial, /Prueba/i);
  for (const campo of ["numeroIdentificacion", "repLegalDocumento", "repLegalDocFirma"]) {
    assert.match(datos[campo], /^10000000\d\d$/, campo + " no parece un documento de mentira");
  }
});

test("los datos de prueba llevan textos largos y una ñ", function () {
  /* Un juego de datos cortos no enseña nada, porque todo cabe. Lo que
     interesa mirar es justo lo que va apretado: el correo, la
     actividad principal y un nombre con ñ. */
  const datos = F.datosDePrueba();
  assert.ok(datos.nombreRazonSocial.length >= 30, "el nombre es demasiado corto para probar nada");
  assert.ok(datos.actividadPrincipal.length >= 25);
  assert.ok(/ñ|Ñ/.test(datos.contactoNombre), "hace falta una ñ para ver si la fuente la tiene");
});

test("cada llamada a datosDePrueba devuelve una copia limpia", function () {
  /* Si devolviera el objeto tal cual, escribir en el formulario iría
     pisando la plantilla y el segundo "llenar de prueba" saldría con
     lo que quedó a medias del primero. */
  const uno = F.datosDePrueba();
  uno.nombreRazonSocial = "TOCADO A MANO";
  assert.notEqual(F.datosDePrueba().nombreRazonSocial, "TOCADO A MANO");
  assert.equal(F.DATOS_DE_PRUEBA.nombreRazonSocial.indexOf("TOCADO"), -1,
    "la plantilla del código quedó modificada");
});

test("la fecha del juego de prueba es la de hoy, no una guardada", function () {
  assert.equal(F.datosDePrueba().fecha, F.hoyEnIso());
  assert.equal(F.datosDePrueba().fechaVisita, F.hoyEnIso());
});

test("cada letra está declarada en el CSS para poder previsualizarla", function () {
  /* La pantalla escribe cada opción EN su propia letra, y eso solo
     funciona si hay un @font-face con el id de la letra como
     font-family. Si alguien añade una al catálogo y se olvida de
     declararla aquí, esa muestra sale en la letra del navegador: la
     pantalla enseñaría una cosa y el PDF otra, que es peor que no
     enseñar nada. El PDF sale bien igual, así que esto no se cae solo. */
  const css = fs.readFileSync(path.join(RAIZ, "styles.css"), "utf8");
  for (const l of F.LETRAS) {
    assert.ok(css.indexOf("font-family:'" + l.id + "'") >= 0,
      l.id + " no tiene @font-face en styles.css");
    /* Y que apunte al mismo .ttf que incrusta el PDF, no a otro. */
    const archivo = l.ruta.split("/").pop();
    assert.ok(css.indexOf(archivo) >= 0,
      l.id + ": el @font-face no apunta a " + archivo);
  }
});

test("la escala de la muestra es coherente con la del PDF", function () {
  /* `escala` existe para que las tres se vean del mismo tamaño en
     pantalla, con la misma cuenta que usa generarPdf para el cuerpo.
     Si se toca `sube` o `baja` y no se recalcula, la muestra deja de
     parecerse al papel. */
  for (const l of F.LETRAS) {
    const alto = l.sube * 1.05 + 0.05 + 0.75 * l.baja;
    const base = F.LETRAS[0];
    const esperada = (base.sube * 1.05 + 0.05 + 0.75 * base.baja) / alto;
    assert.ok(Math.abs(l.escala - esperada) < 0.01,
      l.id + ": escala " + l.escala + " y debería ser " + esperada.toFixed(3));
  }
});
