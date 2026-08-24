/* ================================================================
   Llenar el formato digitalmente.

   Lo que se comprueba aquí es lo que dejaría un PDF inservible sin que
   se note en pantalla: que un campo se imprima en la casilla de al
   lado, que un grupo marque la opción equivocada, o que los tres
   correos vuelvan a poder ser distintos.
   ================================================================ */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const M = require("../public/mapa.js");
globalThis.MAPA = M.MAPA;
globalThis.LISTA_PRECIOS_ESPERADA = require("../public/rejilla.js").LISTA_PRECIOS_ESPERADA;
const F = require("../public/formulario.js");

const EJEMPLO = {
  fecha: "2026-08-02", clienteDe: "Delichicks S.A.S.", tipoClienteForma: "Contado", tipoClienteVinculo: "Vinculación",
  tipoClientePersona: "Persona Natural", nombreRazonSocial: "Roberto Carlos Mora Arias",
  tipoDocumento: "C.C.", numeroIdentificacion: "9169999",
  actividadPrincipal: "Elaboracion de comidas preparadas", codigoCiiu: "1084",
  telefono: "3226768342", direccionComercial: "Calle 62 #11-48", pais: "Colombia",
  departamento: "Cundinamarca", codigoPostal: "110411", tipoEmpresa: "Privada",
  correoFacturacion: "robert1992mora@gmail.com", contactoNombre: "Roberto Carlos Mora Arias",
  contactoCargo: "Propietario", contactoCorreo: "robert1992mora@gmail.com",
  contactoTelefono: "3226768342", repLegalNombre: "Roberto Carlos Mora Arias",
  repLegalCorreo: "robert1992mora@gmail.com", repLegalTipoDoc: "C.C.",
  repLegalDocumento: "9169999", pepEsOhaSido: "No", pepRecursos: "No", pepCargos: "No",
  pepExtranjera: "No", pepVinculo: "No", repLegalNombreFirma: "Roberto Carlos Mora Arias",
  repLegalDocFirma: "9169999", establecimiento: "Restaurante Rikas Comidas",
  direccionEntrega: "Calle 62 #11-48", barrio: "Chapinero", municipio: "Cundinamarca", ciudad: "Bogotá",
  contactoPedidos: "Roberto Carlos Mora Arias", telMovil: "3226768342", canal: "DJ",
  vendedor: "10020265", centroSuministrador: "A601", grupoCliente: "15",
  listaPrecios: "CQ", zonaTransporte: "25L103", horaRecibo: "7 a 11", clienteCercano: "NA",
  responsableNombre: "Olga Lucia Lemus Gutierrez", fechaVisita: "2026-08-02",
  lugarVisita: "Bogota", ciudadVisita: "Bogota Cundinamarca",
};

test("todos los campos del cuestionario existen y tienen sitio donde imprimirse", function () {
  for (const c of F.camposDelFormulario()) {
    const tipo = F.tipoDeCampo(c);
    assert.ok(tipo, c + " no tiene tipo");
    const valor = tipo === "grupo" ? F.opcionesDeCampo(c)[0] : "x";
    assert.ok(valor, c + " es un grupo sin opciones");
    const caja = F.cajaDeImpresion(c, valor);
    assert.ok(caja, c + " no tiene caja de impresión");
    assert.ok(caja.y >= 0 && caja.y + caja.alto <= 1, c + " se imprimiría fuera de la hoja");
    assert.ok(caja.x >= 0 && caja.x + caja.ancho <= 1, c + " se saldría de ancho");
  }
});

test("el cuestionario no pregunta por lo que va en blanco ni por lo que se firma", function () {
  const preguntados = F.camposDelFormulario();
  for (const c of preguntados) {
    if (!M.MAPA[c]) continue;   // los de Tipo de cliente no están en el mapa
    assert.notEqual(M.MAPA[c].clase, "vacio", c + " va en blanco y no debería preguntarse");
  }
  for (const firma of ["firmaSolicitante", "huellaSolicitante", "responsableFirma"]) {
    assert.ok(!preguntados.includes(firma), firma + " se hace a mano, no se imprime");
  }
});

/* La razón de ser del módulo: que los tres correos NO PUEDAN ser
   distintos. No es que se revise después; es que no se escriben. */
test("los tres correos se copian solos del primero", function () {
  const datos = Object.assign({}, F.valoresPorDefecto());
  datos.correoFacturacion = "alguien@ejemplo.com";
  for (const destino of Object.keys(F.ESPEJOS)) {
    datos[destino] = datos[F.ESPEJOS[destino]];
  }
  assert.equal(datos.contactoCorreo, "alguien@ejemplo.com");
  assert.equal(datos.repLegalCorreo, "alguien@ejemplo.com");
});

test("la lista de precios viene puesta en CQ de entrada", function () {
  assert.equal(F.valoresPorDefecto().listaPrecios, "CQ");
});

test("un grupo marca la opción elegida y ninguna otra", function () {
  const opciones = F.opcionesDeCampo("tipoDocumento");
  assert.deepEqual(opciones, ["C.C.", "NIT", "ID", "C.E.", "Pasaporte"]);
  const cajas = opciones.map(function (o) { return F.cajaDeImpresion("tipoDocumento", o); });
  const centros = cajas.map(function (c) { return Math.round(c.x * 10000); });
  assert.equal(new Set(centros).size, opciones.length, "dos opciones se marcarían en el mismo sitio");
  assert.equal(F.cajaDeImpresion("tipoDocumento", "Cédula"), null, "una opción inventada no se marca");
});

test("cada opción de un grupo tiene tantas cajas como opciones tiene el mapa", function () {
  for (const campo of Object.keys(F.OPCIONES_GRUPO)) {
    assert.ok(M.MAPA[campo], campo + " no está en el mapa");
    assert.equal(F.OPCIONES_GRUPO[campo].length, M.MAPA[campo].opciones.length,
      campo + ": los nombres no cuadran con los círculos medidos");
  }
});

test("las opciones de un mismo grupo no caen unas sobre otras", function () {
  /* Hasta la v30 los tres grupos de "Tipo de cliente" tenían dos
     opciones, apiladas en la misma columna, y la prueba comprobaba eso
     mismo: dos opciones, misma x, distinta y. Con "Cliente de" (v31)
     dejó de valer, porque son CINCO y van en fila: misma y, distinta x.

     Lo que de verdad hay que asegurar no era ninguna de las dos cosas,
     sino que dos marcas del mismo grupo no se pisen. Separadas en x o
     separadas en y, da igual cuál: si se solapan, el formato sale con
     dos opciones marcadas encima y no se sabe cuál eligió nadie. */
  for (const campo of Object.keys(F.TIPO_CLIENTE)) {
    const ops = F.opcionesDeCampo(campo);
    assert.ok(ops.length >= 2, campo + ": un grupo de una sola opción no es un grupo");
    for (let i = 0; i < ops.length; i++) {
      for (let j = i + 1; j < ops.length; j++) {
        const a = F.cajaDeImpresion(campo, ops[i]);
        const b = F.cajaDeImpresion(campo, ops[j]);
        const separadasEnX = a.x + a.ancho <= b.x || b.x + b.ancho <= a.x;
        const separadasEnY = a.y + a.alto <= b.y || b.y + b.alto <= a.y;
        assert.ok(separadasEnX || separadasEnY,
          campo + ': "' + ops[i] + '" y "' + ops[j] + '" caerían una encima de otra');
      }
    }
  }
});

test("cada grupo va en fila o en columna, no a medio camino", function () {
  /* Un grupo mal medido —una opción con la y de otra fila, por
     ejemplo— seguiría pasando la prueba de arriba y saldría torcido en
     el papel. Aquí se comprueba que todas las opciones de un grupo
     comparten x (columna) o comparten y (fila). */
  for (const campo of Object.keys(F.TIPO_CLIENTE)) {
    const cajas = F.opcionesDeCampo(campo).map(function (o) { return F.cajaDeImpresion(campo, o); });
    const mismaX = cajas.every(function (c) { return Math.abs(c.x - cajas[0].x) < 1e-6; });
    const mismaY = cajas.every(function (c) { return Math.abs(c.y - cajas[0].y) < 1e-6; });
    assert.ok(mismaX || mismaY,
      campo + ": las opciones no están alineadas ni en fila ni en columna");
  }
});

test("camposVacios ve exactamente lo que falta", function () {
  assert.deepEqual(F.camposVacios(EJEMPLO), []);
  const cojo = Object.assign({}, EJEMPLO, { codigoPostal: "", listaPrecios: "  " });
  assert.deepEqual(F.camposVacios(cojo).sort(), ["codigoPostal", "listaPrecios"]);
});

/* Prueba de extremo a extremo: se arma el PDF de verdad. Si el archivo
   base no está, se salta en vez de fallar. */
test("se genera un PDF de tres hojas con los datos dentro", { skip: !fs.existsSync(path.join(__dirname, "..", "public", "formato", "FO-901-vacio.pdf")) }, async function () {
  globalThis.PDFLib = require("pdf-lib");
  const raiz = path.join(__dirname, "..", "public");
  globalThis.fetch = async function (u) {
    return { ok: true, arrayBuffer: async function () { return fs.readFileSync(path.join(raiz, u)); } };
  };
  const bytes = await F.generarPdf(EJEMPLO);
  assert.ok(bytes.length > 1000, "el PDF salió vacío");

  const doc = await globalThis.PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 3, "el formato tiene que salir con sus tres hojas");
});

test("un formulario a medias no revienta: se imprime lo que hay", { skip: !fs.existsSync(path.join(__dirname, "..", "public", "formato", "FO-901-vacio.pdf")) }, async function () {
  globalThis.PDFLib = require("pdf-lib");
  const raiz = path.join(__dirname, "..", "public");
  globalThis.fetch = async function (u) {
    return { ok: true, arrayBuffer: async function () { return fs.readFileSync(path.join(raiz, u)); } };
  };
  const bytes = await F.generarPdf({ nombreRazonSocial: "Solo un nombre" });
  assert.ok(bytes.length > 1000);
});

/* ---- añadidos de la v15 ---- */

test("Ciudad y Municipio vienen puestos y son editables", function () {
  const d = F.valoresPorDefecto();
  assert.equal(d.ciudad, "Bogotá");
  assert.equal(d.municipio, "Cundinamarca");
  assert.ok(F.camposDelFormulario().includes("ciudad"), "Ciudad no está en el cuestionario");
  assert.ok(F.cajaDeImpresion("ciudad", "Bogotá"), "Ciudad no tiene dónde imprimirse");
});

test("Ciudad no invade Departamento ni Código Postal", function () {
  const c = F.cajaDeImpresion("ciudad", "x");
  assert.ok(c.x >= M.MAPA.departamento.x1, "empieza antes de que acabe Departamento");
  assert.ok(c.x + c.ancho <= M.MAPA.codigoPostal.x0, "llega hasta Código Postal");
});

/* El tipo de documento del representante sigue al del cliente, pero
   solo hasta que alguien lo cambia. */
test("el tipo de documento se copia al del representante si vale", function () {
  assert.equal(F.SUGERENCIAS.repLegalTipoDoc, "tipoDocumento");
  assert.equal(F.sugerenciaValida("repLegalTipoDoc", "C.C."), true);
  assert.equal(F.sugerenciaValida("repLegalTipoDoc", "Pasaporte"), true);
  /* NIT existe para el cliente pero NO para el representante: si se
     copiara a ciegas, quedaría un valor que ese grupo no tiene y no se
     marcaría nada. */
  assert.equal(F.sugerenciaValida("repLegalTipoDoc", "NIT"), false);
});



/* ---- rellenar desde el RUT y validar (v27) ---- */

test("del RUT salen los campos que dice sin ambigüedad", function () {
  const rut = {
    esJuridica: false, nombreCompleto: "Roberto Carlos Mora Arias",
    identificacion: "9169999", ciiu: "1084", direccion: "CALLE 59 B SUR 13 B 31",
    departamento: "Bogotá D.C.", ciudad: "Bogotá, D.C.", correo: "robert@gmail.com",
  };
  const d = F.camposDesdeRut(rut);
  assert.equal(d.nombreRazonSocial, "Roberto Carlos Mora Arias");
  assert.equal(d.numeroIdentificacion, "9169999");
  assert.equal(d.codigoCiiu, "1084");
  assert.equal(d.correoFacturacion, "robert@gmail.com");
  assert.equal(d.tipoDocumento, "C.C.");
  /* El teléfono está en el RUT pero en dos casillas distintas y no
     siempre es el del negocio: se deja vacío a propósito. */
  assert.equal(d.telefono, undefined);
});

test("una persona jurídica trae razón social y NIT", function () {
  const d = F.camposDesdeRut({ esJuridica: true, razonSocial: "Avícola del Norte S.A.S.",
                               identificacion: "9001234567" });
  assert.equal(d.nombreRazonSocial, "Avícola del Norte S.A.S.");
  assert.equal(d.tipoDocumento, "NIT");
});

test("sin RUT no se inventa nada", function () {
  assert.deepEqual(F.camposDesdeRut(null), {});
});

test("las validaciones cazan lo que está mal escrito", function () {
  assert.ok(F.validarCampo("correoFacturacion", "pepe@"));
  assert.ok(F.validarCampo("correoFacturacion", "pepe.arroba.gmail.com"));
  assert.equal(F.validarCampo("correoFacturacion", "pepe@gmail.com"), null);
  assert.ok(F.validarCampo("numeroIdentificacion", "1.045.702"), "los puntos no van");
  assert.equal(F.validarCampo("numeroIdentificacion", "1045702358"), null);
  assert.ok(F.validarCampo("telMovil", "31924504"), "un celular tiene 10 dígitos");
  assert.ok(F.validarCampo("codigoCiiu", "108"), "el CIIU son 4");
  assert.ok(F.validarCampo("codigoPostal", "1101"), "el postal son 6");
  assert.ok(F.validarCampo("listaPrecios", "CA"));
  assert.equal(F.validarCampo("listaPrecios", "cq"), null, "la caja no importa");
});

/* Marcar en rojo lo que aún no has escrito es hostil: de los vacíos ya
   se encarga la cuenta de los que faltan. */
test("un campo vacío no se marca como error", function () {
  for (const c of ["correoFacturacion", "telMovil", "codigoCiiu", "listaPrecios"]) {
    assert.equal(F.validarCampo(c, ""), null, c + " en blanco no debería avisar");
    assert.equal(F.validarCampo(c, "   "), null);
  }
});

test("el documento del representante se copia del cliente pero se puede cambiar", function () {
  assert.equal(F.SUGERENCIAS.repLegalDocumento, "numeroIdentificacion");
  assert.equal(F.SUGERENCIAS.repLegalDocFirma, "numeroIdentificacion");
  /* Es sugerencia y no espejo porque en una persona jurídica el NIT de
     la empresa y la cédula del representante son distintos. */
  assert.ok(!F.ESPEJOS.repLegalDocumento, "no puede ser un espejo bloqueado");
  assert.equal(F.sugerenciaValida("repLegalDocumento", "9169999"), true);
  assert.equal(F.sugerenciaValida("repLegalDocumento", ""), false);
});

test("avisosDelFormulario los devuelve todos, en el orden del papel", function () {
  const datos = Object.assign({}, EJEMPLO, { telMovil: "312", codigoCiiu: "1" });
  const avisos = F.avisosDelFormulario(datos);
  const campos = avisos.map(function (a) { return a.campo; });
  assert.deepEqual(campos.sort(), ["codigoCiiu", "telMovil"]);
  assert.ok(avisos[0].etiqueta && avisos[0].aviso);
});

/* ---- fechas y adjuntos (v28) ---- */

test("las fechas se guardan en ISO y se imprimen como en el papel", function () {
  /* Se guarda ISO porque es lo que entiende <input type="date">, y se
     imprime dd/mm/aaaa porque es como se llena el formato a mano. */
  assert.equal(F.tipoDeEntrada("fecha"), "date");
  assert.equal(F.fechaParaImprimir("2026-08-03"), "03/08/2026");
  assert.equal(F.valorParaImprimir("fecha", "2026-08-03"), "03/08/2026");
  assert.equal(F.valorParaImprimir("nombreRazonSocial", "  Peter  "), "Peter");
});

test("una fecha que no sea ISO se imprime tal cual, sin romperse", function () {
  /* Puede venir de una corrección hecha a mano sobre el PDF. */
  assert.equal(F.fechaParaImprimir("N/A"), "N/A");
  assert.equal(F.fechaParaImprimir(""), "");
  assert.equal(F.fechaParaImprimir(null), "");
});

test("el Día/Mes/Año viene con la fecha de hoy", function () {
  const hoy = F.hoyEnIso();
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(hoy), "hoyEnIso no devuelve ISO: " + hoy);
  assert.equal(F.valoresPorDefecto().fecha, hoy);
});

test("cada campo pide el teclado que le toca", function () {
  assert.equal(F.tipoDeEntrada("correoFacturacion"), "email");
  assert.equal(F.tipoDeEntrada("telMovil"), "tel");
  assert.equal(F.tipoDeEntrada("numeroIdentificacion"), "numerico");
  assert.equal(F.tipoDeEntrada("nombreRazonSocial"), "texto");
});

const hayBase = fs.existsSync(path.join(__dirname, "..", "public", "formato", "FO-901-vacio.pdf"));

test("el RUT y la cédula quedan pegados detrás del formato", { skip: !hayBase }, async function () {
  globalThis.PDFLib = require("pdf-lib");
  globalThis.fontkit = require("@pdf-lib/fontkit");
  const raiz = path.join(__dirname, "..", "public");
  globalThis.fetch = async function (u) {
    return { ok: true, arrayBuffer: async function () { return fs.readFileSync(path.join(raiz, u)); } };
  };
  const base = new Uint8Array(fs.readFileSync(path.join(raiz, "formato", "FO-901-vacio.pdf")));

  const solo = await PDFLib.PDFDocument.load(await F.generarPdf(EJEMPLO));
  assert.equal(solo.getPageCount(), 3, "el formato son tres hojas");

  const con = await PDFLib.PDFDocument.load(
    await F.generarPdf(EJEMPLO, { rut: { nombre: "rut.pdf", tipo: "pdf", bytes: base } }));
  assert.equal(con.getPageCount(), 6, "tres del formato más las tres del adjunto");
});

/* Un adjunto ilegible no puede llevarse por delante el formato: se
   entrega el formato solo y la pantalla avisa. */
test("un adjunto roto no tumba el formato", { skip: !hayBase }, async function () {
  globalThis.PDFLib = require("pdf-lib");
  globalThis.fontkit = require("@pdf-lib/fontkit");
  const raiz = path.join(__dirname, "..", "public");
  globalThis.fetch = async function (u) {
    return { ok: true, arrayBuffer: async function () { return fs.readFileSync(path.join(raiz, u)); } };
  };
  const adjunto = { nombre: "roto.pdf", tipo: "pdf", bytes: new Uint8Array([1, 2, 3]) };
  const doc = await PDFLib.PDFDocument.load(await F.generarPdf(EJEMPLO, { cedula: adjunto }));
  assert.equal(doc.getPageCount(), 3);
  assert.ok(adjunto.error, "el adjunto tendría que quedar marcado con el error");
});

test("el orden de los adjuntos es el del trámite: primero el RUT", function () {
  const fuente = fs.readFileSync(
    path.join(__dirname, "..", "public", "formulario.js"), "utf8");
  const i = fuente.indexOf('for (const clave of ["rut", "cedula"])');
  assert.ok(i > 0, "el orden de los adjuntos no está fijado en el código");
});
