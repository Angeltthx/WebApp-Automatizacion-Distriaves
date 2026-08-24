"use strict";
/* ================================================================
   Estado de cada casilla · verde, amarillo, rojo

   PROBLEMA. Medir tinta en una casilla no dice si está escrita: dice
   cuánta tinta hay, y eso depende de lo oscuro que saliera el escaneo.
   El mismo campo vacío da 0.03 en una hoja limpia y 0.17 en una
   grisácea. Un umbral fijo por campo exigiría calibrarlo sobre muchos
   paquetes; con uno solo sería inventarlo.

   SOLUCIÓN. El formato trae su propia referencia. Las secciones del
   Aval (hoja 2) y de Confirmación de Cartera (hoja 3) van SIEMPRE en
   blanco: así lo marcó el usuario, y así salen en los paquetes reales.
   Son 22 casillas que en cualquier paquete están vacías. Con ellas se
   ajusta, EN ESE MISMO PAQUETE:

       tinta_vacía_esperada ≈ a · tinta_del_formato_en_blanco + b

   y la dispersión que queda alrededor de esa recta es el ruido propio
   del escaneo. Un campo escrito tiene que destacar SOBRE ese ruido.
   Ni un número puesto a dedo ni una calibración de otro día: la
   referencia sale del papel que se está mirando.

   LÍMITE MEDIDO, y es grande. Sobre un paquete real de 44 casillas que
   van escritas: 20 quedaron verdes, 16 amarillas y 8 rojas. De esas 8,
   cinco estaban escritas de verdad, pero con muy poco trazo ("DJ",
   "NA", "CA"). O sea: el amarillo es ancho y el rojo se equivoca. Por
   eso el color de la tinta NO es el veredicto, es el primer filtro; lo
   que se ponga en amarillo o en rojo se manda a transcribir, que ahí sí
   se lee lo que hay. Ver `resolverDudas` en ocr.js.
   ================================================================ */

/* Referencia de cada casilla en el formato EN BLANCO, medida sobre
   para_usar_vacio.pdf a 800 px de ancho: lo que tiene una casilla por
   las rayas y el papel, sin que nadie haya escrito.

   OJO: desde la v21 el número NO es la media de tinta de la casilla
   sino la DENSIDAD MÁXIMA en una ventana de 16 px (ver
   `densidadMaxima` en rejilla.js). La media diluye: una palabra corta
   en una casilla ancha apenas mueve el promedio, y por eso tantas
   casillas escritas quedaban en naranja. Medido sobre un paquete real,
   de 45 casillas con letra: con la media, 21 verdes, 15 naranjas y 9
   rojas; con la densidad máxima, 38 verdes, 3 naranjas y 4 rojas, y
   cero falsos positivos en el formato vacío. */
const TINTA_EN_BLANCO = {
  fecha: 0.3636,
  tipoClienteForma: 0.2857,
  tipoClienteVinculo: 0.291,
  tipoClientePersona: 0.2778,
  nombreRazonSocial: 0.2308,
  numeroIdentificacion: 0.1875,
  tipoDocumento: 0.5347,
  actividadPrincipal: 0.1667,
  codigoCiiu: 0.2344,
  telefono: 0.1667,
  direccionComercial: 0.1875,
  pais: 0.1538,
  departamento: 0.1538,
  codigoPostal: 0.1538,
  correoFacturacion: 0.1538,
  tipoEmpresa: 0.4844,
  contactoNombre: 0.1538,
  contactoCargo: 0.3077,
  contactoCorreo: 0.0909,
  contactoTelefono: 0.1818,
  repLegalNombre: 0.1538,
  repLegalCorreo: 0.2404,
  repLegalDocumento: 0.1667,
  repLegalTipoDoc: 0.4375,
  pepEsOhaSido: 0.2679,
  pepRecursos: 0.4286,
  pepCargos: 0.3984,
  pepExtranjera: 0.4107,
  pepVinculo: 0.3828,
  avalTipoDocumento: 0.4167,
  avalIdentificacion: 0.0833,
  avalDigito: 0.1667,
  avalNombres: 0.0833,
  avalTelefono: 0.0,
  avalDireccion: 0.0909,
  avalPais: 0.1538,
  avalDepartamento: 0.1538,
  avalCiudad: 0.1538,
  avalCodigoPostal: 0.1771,
  avalActividad: 0.0833,
  avalCiiu: 0.1667,
  avalCorreo: 0.1771,
  huellaSolicitante: 0.1458,
  huellaAval: 0.1765,
  firmaAval: 0.125,
  firmaSolicitante: 0.0645,
  avalNombresFirma: 0.1918,
  repLegalNombreFirma: 0.1161,
  avalRazonSocial: 0.1364,
  repLegalDocFirma: 0.1574,
  establecimiento: 0.1635,
  direccionEntrega: 0.1111,
  barrio: 0.1111,
  municipio: 0.2222,
  contactoPedidos: 0.0,
  telMovil: 0.1394,
  canal: 0.1,
  vendedor: 0.0,
  centroSuministrador: 0.1,
  grupoCliente: 0.0125,
  listaPrecios: 0.1667,
  zonaTransporte: 0.0114,
  horaRecibo: 0.2452,
  clienteCercano: 0.0817,
  responsableNombre: 0.0484,
  fechaVisita: 0.0708,
  responsableFirma: 0.0417,
  lugarVisita: 0.0706,
  ciudadVisita: 0.1375,
  carteraFecha: 0.1103,
  carteraHora: 0.0588,
  carteraQuienConfirma: 0.011,
  carteraResponsable: 0.0588,
  carteraObservaciones: 0.0074,
  ciudad: 0.1538,
};

/* Cuántas veces la dispersión de las casillas vacías tiene que superar
   un campo para darlo por escrito. No son umbrales de tinta —esos
   dependen del escaneo— sino de cuántas desviaciones se sale de lo que
   hace el ruido en ESTE paquete. Los tres documentos medidos separan
   así: el formato en blanco deja las 44 casillas en rojo, y el paquete
   real deja 20 en verde. Entre 1 y 2.5 queda la franja de duda. */
const Z_VERDE = 2.5;
const Z_AMARILLO = 1.0;

/* Mediana y desviación robusta (MAD). Se usa la robusta y no la media
   porque basta una casilla del Aval con una raya del escáner encima
   para inflar la desviación y volver amarillo todo el paquete. */
function medianaDe(v) {
  if (!v.length) return 0;
  const s = v.slice().sort(function (a, b) { return a - b; });
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function dispersionRobusta(v) {
  const med = medianaDe(v);
  return 1.4826 * medianaDe(v.map(function (x) { return Math.abs(x - med); }));
}

/* Recta que predice la tinta de una casilla vacía en este paquete. */
function calibrarVacio(medidas) {
  const xs = [], ys = [];
  for (const campo of Object.keys(MAPA)) {
    if (MAPA[campo].clase !== "vacio") continue;
    const m = medidas[campo];
    const base = TINTA_EN_BLANCO[campo];
    if (m == null || base == null) continue;
    xs.push(base);
    ys.push(m);
  }
  if (xs.length < 6) return null;   // sin referencia suficiente, no se opina

  let sx = 0, sy = 0;
  for (let i = 0; i < xs.length; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / xs.length, my = sy / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const a = den === 0 ? 0 : num / den;
  const b = my - a * mx;

  const residuos = xs.map(function (x, i) { return ys[i] - (a * x + b); });
  const centro = medianaDe(residuos);
  const dispersion = dispersionRobusta(residuos);
  return { a: a, b: b, centro: centro, dispersion: dispersion, usadas: xs.length };
}

/* Para una casilla que DEBE ir en blanco no vale la calibración
   general: esa casilla es una de las 22 con las que se calculó la
   recta, así que se está comparando contra un ruido que ella misma
   ayudó a definir. Es circular, y por eso salían rojos donde no había
   nada escrito. Aquí se recalcula la recta SIN ella. */
function calibrarSin(campo, medidas) {
  const xs = [], ys = [];
  for (const otro of Object.keys(MAPA)) {
    if (otro === campo || MAPA[otro].clase !== "vacio") continue;
    if (medidas[otro] == null || TINTA_EN_BLANCO[otro] == null) continue;
    xs.push(TINTA_EN_BLANCO[otro]);
    ys.push(medidas[otro]);
  }
  if (xs.length < 6) return null;
  let sx = 0, sy = 0;
  for (let i = 0; i < xs.length; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / xs.length, my = sy / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const a = den === 0 ? 0 : num / den;
  const b = my - a * mx;
  const residuos = xs.map(function (x, i) { return ys[i] - (a * x + b); });
  const centro = medianaDe(residuos);
  return { a: a, b: b, centro: centro, dispersion: dispersionRobusta(residuos),
           usadas: xs.length };
}

function zDe(campo, medidas, cal) {
  const m = medidas[campo];
  const base = TINTA_EN_BLANCO[campo];
  if (m == null || base == null || !cal || cal.dispersion <= 0) return null;
  return (m - (cal.a * base + cal.b) - cal.centro) / cal.dispersion;
}

/* Estado de un campo mirando SOLO la tinta.
     lleno   claramente por encima del ruido
     duda    en la franja de en medio
     vacio   al nivel del ruido o por debajo */
function estadoPorTinta(campo, medidas, cal) {
  const esDeLasQueVanEnBlanco = MAPA[campo] && MAPA[campo].clase === "vacio";

  /* Las que van en blanco se juzgan con la recta calculada SIN ellas
     mismas: son 22 de las que sale esa recta, y compararlas contra un
     ruido que ellas ayudaron a definir es circular. */
  if (esDeLasQueVanEnBlanco) cal = calibrarSin(campo, medidas) || cal;

  const z = zDe(campo, medidas, cal);
  if (z == null) return { estado: "sinDato", z: null };

  /* Y aun así, la tinta NUNCA declara escrita una casilla que debe ir
     en blanco: como mucho la manda a leer. Acusar a alguien de haber
     escrito en el bloque del Aval con una medida de píxeles, cuando la
     medida se equivoca en 10 de 41 casillas que SÍ tienen letra, es
     acusar a ciegas. Lo decide la transcripción. */
  if (esDeLasQueVanEnBlanco) {
    return { estado: z >= Z_AMARILLO ? "duda" : "vacio", z: z };
  }
  if (z >= Z_VERDE) return { estado: "lleno", z: z };
  if (z >= Z_AMARILLO) return { estado: "duda", z: z };
  return { estado: "vacio", z: z };
}

/* Grupos de opciones (C.C. / NIT / ID…): NO SE MIDEN POR TINTA.

   Se intentó y no funciona, y conviene dejar escrito por qué para que
   nadie lo vuelva a intentar. El círculo mide 0.0094 del ancho de la
   hoja: a los 800 px del lienzo de análisis son 7 píxeles y medio. Con
   ese tamaño, un píxel de desajuste pesa más que la marca de bolígrafo.
   Medido sobre un paquete real, en "Tipo de Documento" —donde está
   marcada la C.C.— las cinco opciones dieron:

       C.C. 0.256   NIT 0.338   ID 0.356   C.E. 0.362   Pasaporte 0.356

   La marcada es la MÁS CLARA de las cinco. Cualquier regla que se
   apoye en estos números acierta por casualidad.

   Así que los grupos van siempre a transcripción: un recorte de la
   fila entera, con el rótulo, y se pregunta cuál está marcada. Ahí sí
   hay resolución de sobra. Mientras no se transcriban, quedan en
   amarillo, que es lo que son: sin revisar. */
function estadoDeGrupo() {
  return { estado: "sinDato", marcadas: [] };
}

/* Traduce a color, que es lo que se pinta:
     verde     está escrita y tenía que estarlo, o está vacía y tenía
               que estarlo
     amarillo  no estoy seguro
     rojo      falta, o hay algo donde no debería haberlo */
function colorDe(clase, estado) {
  if (estado === "sinDato") return "amarillo";
  if (clase === "vacio") {
    if (estado === "lleno") return "rojo";
    if (estado === "duda") return "amarillo";
    return "verde";
  }
  if (estado === "lleno") return "verde";
  if (estado === "duda") return "amarillo";
  return "rojo";
}

/* Color que MANDA: el que dijo el programa, salvo que quien revisa lo
   haya corregido a mano. Se separa del color calculado a propósito, y
   se guarda aparte: así siempre se puede ver qué dijo cada uno, y una
   corrección no se pierde si el análisis se rehace.

     revision "ok"   quien revisa dice que la casilla está bien
     revision "mal"  quien revisa dice que está mal, aunque salga verde
     sin revision    manda lo que midió el programa */
function colorEfectivo(c) {
  if (!c) return "gris";
  if (c.revision === "ok") return "verde";
  if (c.revision === "mal") return "rojo";
  return c.color;
}

/* Siguiente estado al pulsar: sin revisar → bien → mal → sin revisar. */
function siguienteRevision(actual) {
  if (!actual) return "ok";
  if (actual === "ok") return "mal";
  return null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { colorEfectivo, siguienteRevision, calibrarSin, TINTA_EN_BLANCO, Z_VERDE, Z_AMARILLO, medianaDe, dispersionRobusta,
                     calibrarVacio, zDe, estadoPorTinta, estadoDeGrupo, colorDe };
}
