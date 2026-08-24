"use strict";
/* ================================================================
   Diligenciar el formato digitalmente

   En vez de revisar lo que alguien escribió a mano, se escribe bien de
   entrada. Se pregunta campo por campo, se imprime encima del FO-901
   en blanco y sale un PDF listo para imprimir y que el cliente firme.

   DÓNDE SE IMPRIME CADA COSA. En las mismas coordenadas del mapa
   (mapa.js), que salieron de medir el formato marcado. El PDF base es
   public/formato/FO-901-vacio.pdf, el mismo escaneo que se midió, así
   que su ajuste contra la plantilla se conoce y está aquí abajo: no
   hay que detectarlo cada vez.

   LO QUE ESTE MÓDULO NO HACE, y conviene decirlo: no evita el papel.
   La firma y la huella siguen siendo a mano, así que el flujo sigue
   siendo imprimir, firmar y escanear. Lo que quita son los errores de
   transcripción: casillas en blanco, tres correos distintos, CA donde
   iba CQ. El verificador sigue haciendo falta para los paquetes que
   lleguen escritos a mano.
   ================================================================ */

const PDF_BASE = "formato/FO-901-vacio.pdf";

/* Ajuste del PDF base contra la plantilla, MEDIDO sobre ese mismo
   archivo (escala y desplazamiento por hoja). Con esto, cualquier
   coordenada del mapa se convierte en coordenada de la página. */
const AJUSTE_BASE = {
  "1/3": { escala: 1.0405, desplazamiento: -0.0178 },
  "2/3": { escala: 1.0565, desplazamiento: -0.0233 },
  "3/3": { escala: 1.0450, desplazamiento: +0.0058 },
};

const PAGINA_DE_HOJA = { "1/3": 0, "2/3": 1, "3/3": 2 };

/* Los tres pares de "Tipo de cliente" no están en el mapa porque el
   formato marcado solo traía una opción de cada uno.

   Estos van en coordenadas de PÁGINA del PDF base, no de plantilla, y
   están medidos uno a uno sobre el propio archivo aislando cada
   círculo por su franja vertical: los seis dieron 0.0100 de alto y
   0.01375 de ancho. Antes se deducían de la caja de la marca roja del
   formato marcado, que es la caja de una LETRA "x" —más alta y
   desplazada que el círculo— y por eso las X salían altas y algo a la
   izquierda.

   Que estén en coordenadas de página los ata a este PDF base. Es lo
   que toca: son marcas para ESTE archivo. Si el base se cambia, hay
   que volver a medirlas, y esta nota está para acordarse. */
const DIAMETRO_CIRCULO = 0.01375;

/* La casilla blanca de la fecha, medida en el papel (la marca del
   formato marcado señalaba la banda gris del rótulo, no la casilla). */
const CAJA_FECHA = { y: 0.1129, alto: 0.0139 };

/* ================================================================
   LO QUE SE REPITE EN TODOS LOS PAQUETES (v31)

   Todo lo de aquí abajo es de ESTA vendedora y ESTA zona. Está junto a
   propósito: cuando cambie el vendedor, la ruta o el código de canal,
   se toca este bloque y nada más. Ninguno de estos valores está
   clavado: todos salen como campo normal en la pantalla y se pueden
   cambiar en un paquete concreto sin tocar el código.
   ================================================================ */

/* El nombre que va escrito encima de la firma. Va aquí y no en el
   juego de datos de prueba porque no es un ejemplo: es quien firma. */
const RESPONSABLE_COMERCIAL = "Olga Lucía Lemus";

/* Las ciudades que se ofrecen, con el departamento que le toca a cada
   una. En este formato la casilla "Municipio" de la hoja 3 se rellena
   con el DEPARTAMENTO —así viene en los paquetes ya enviados, donde
   Bogotá lleva "Cundinamarca"—, así que al elegir ciudad se pone solo
   el departamento que le corresponde.

   Son las cinco ciudades más pobladas del país. Si la zona de trabajo
   es otra, esta lista es lo único que hay que cambiar. */
const CIUDADES = [
  { ciudad: "Bogotá", departamento: "Cundinamarca" },
  { ciudad: "Medellín", departamento: "Antioquia" },
  { ciudad: "Cali", departamento: "Valle del Cauca" },
  { ciudad: "Barranquilla", departamento: "Atlántico" },
  { ciudad: "Cartagena", departamento: "Bolívar" },
];

/* Los dos códigos postales que se usan.

   OJO CON ESTOS DOS NÚMEROS, que son los únicos de todo el archivo que
   no se pudieron medir ni deducir: una localidad de Bogotá NO tiene un
   código postal, tiene varios, uno por zona de barrios. Suba tiene
   diez y Chapinero tres.

     · El de Suba es el que aparece escrito en los paquetes que ya se
       enviaron, así que es el que ella viene usando.
     · El de Chapinero es el de Chapinero Central, Chapinero Norte,
       Marly y Quinta Camacho, que es la zona comercial. Los otros dos
       de esa localidad son 110211 (San Isidro, El Páramo, la parte de
       arriba) y 110221 (El Chicó, El Nogal, Los Rosales).

   Si un cliente cae en otro barrio, el código es otro y hay que
   escribirlo a mano: la lista son atajos, no una lista cerrada. */
const CODIGOS_POSTALES = [
  { etiqueta: "Suba", valor: "111221" },
  { etiqueta: "Chapinero", valor: "110231" },
];

/* Las dos rutas. En la lista se ven con el nombre de la zona, para
   poder elegir sin saberse los códigos de memoria, pero en el papel se
   escribe SOLO el código: "25-L104", nunca "25-L104 (Suba)". */
const ZONAS_TRANSPORTE = [
  { etiqueta: "25-L104 (Suba)", valor: "25-L104" },
  { etiqueta: "25-L103 (Chapinero)", valor: "25-L103" },
];

const GRUPOS_CLIENTE = ["03", "15"];

/* Los atajos que salen debajo de un campo de texto.

   NO son listas cerradas, y esa es la diferencia importante con los
   grupos de círculos. Un cliente puede estar en un barrio de Suba con
   otro código postal, o en una ciudad que no está entre las cinco: el
   campo se sigue pudiendo escribir a mano y el atajo solo ahorra
   teclear lo de siempre. Cerrarlos obligaría a tocar el código cada
   vez que aparezca un caso nuevo.

   Cada atajo puede enseñar una cosa y escribir otra: la zona de
   transporte se elige por el nombre del barrio y en el papel cae solo
   el código. */
const ATAJOS = {
  ciudad: CIUDADES.map(function (c) { return { etiqueta: c.ciudad, valor: c.ciudad }; }),
  ciudadVisita: CIUDADES.map(function (c) { return { etiqueta: c.ciudad, valor: c.ciudad }; }),
  lugarVisita: CIUDADES.map(function (c) { return { etiqueta: c.ciudad, valor: c.ciudad }; }),
  codigoPostal: CODIGOS_POSTALES,
  zonaTransporte: ZONAS_TRANSPORTE,
  grupoCliente: GRUPOS_CLIENTE.map(function (g) { return { etiqueta: g, valor: g }; }),
};

/* El departamento que le toca a una ciudad, para la casilla
   "Municipio" de la hoja 3. Devuelve null si la ciudad no está en la
   lista, y entonces no se toca nada: es mejor dejar el campo como
   estaba que rellenarlo con el departamento de otra ciudad. */
function departamentoDe(ciudad) {
  const c = CIUDADES.filter(function (x) { return x.ciudad === ciudad; })[0];
  return c ? c.departamento : null;
}

const TIPO_CLIENTE = {
  /* "Cliente de" (v31). Esta fila se escapó hasta la v30: no estaba en
     el mapa, ni en el cuestionario, ni en el verificador. En el papel
     va marcada Delichicks S.A.S., que es la empresa desde la que se
     crean los clientes, así que viene puesta por defecto y se puede
     cambiar si algún paquete va por otra.

     Las cinco están en la MISMA fila y a distinta x, al revés que los
     tres grupos de abajo, que comparten x y cambian de y. Por eso cada
     opción trae aquí su propia `x` y el grupo trae la `y` y el `alto`
     comunes; `cajaDeImpresion` toma lo que haya en la opción y si no,
     lo del grupo.

     MEDIDAS. Sacadas del PDF base a 150 ppp, aislando cada círculo por
     su mancha y exigiendo que sea un ANILLO (hueco por el centro).
     Hizo falta ese filtro: las letras redondas de "Súper Pollos del
     Galpón" también son manchas huecas de tamaño parecido y se colaban
     como si fueran círculos; se distinguen porque miden 12 px de ancho
     y los círculos 16-18.

     El método se estrenó volviendo a medir cuatro círculos que ya
     estaban medidos a mano aquí abajo (Contado, Crédito, Vinculación,
     Persona Natural): las cuatro `y` salieron con menos de 0.0006 de
     diferencia, o sea menos de un píxel. El centro de Contado dio
     0.2789 contra el 0.2785 escrito. Por eso los números de esta fila
     salen del mismo sitio.

     El `alto` es 0.0100 y el ancho DIAMETRO_CIRCULO, los mismos que
     los seis de abajo, que ya están validados en papel. Lo medido aquí
     variaba entre 0.0091 y 0.0114 por el ruido de la detección, y
     usarlo tal cual haría que unas X salieran más grandes que otras
     sin ningún motivo real. */
  clienteDe: {
    etiqueta: "Cliente de", y: 0.1380, alto: 0.0100,
    opciones: [
      { texto: "Solla S.A.", x: 0.2310 },
      { texto: "Transgraneles S.A.S.", x: 0.3708 },
      { texto: "Agrinal S.A.S.", x: 0.4847 },
      { texto: "Súper Pollos del Galpón", x: 0.6548 },
      { texto: "Delichicks S.A.S.", x: 0.7938 },
    ],
  },
  tipoClienteForma: {
    etiqueta: "Tipo de cliente", x: 0.2785,
    opciones: [
      { texto: "Contado", y: 0.1619, alto: 0.0100 },
      { texto: "Crédito", y: 0.1774, alto: 0.0099 },
    ],
  },
  tipoClienteVinculo: {
    etiqueta: "Motivo", x: 0.4569,
    opciones: [
      { texto: "Vinculación", y: 0.1631, alto: 0.0100 },
      { texto: "Actualización", y: 0.1789, alto: 0.0100 },
    ],
  },
  tipoClientePersona: {
    etiqueta: "Naturaleza", x: 0.6542,
    opciones: [
      { texto: "Persona Jurídica", y: 0.1653, alto: 0.0099 },
      { texto: "Persona Natural", y: 0.1810, alto: 0.0100 },
    ],
  },
};

/* Nombres de las opciones de cada grupo, leídos del formato impreso.
   El orden es el de izquierda a derecha, igual que MAPA[x].opciones. */
const OPCIONES_GRUPO = {
  tipoDocumento: ["C.C.", "NIT", "ID", "C.E.", "Pasaporte"],
  tipoEmpresa: ["Pública", "Privada", "Mixta"],
  repLegalTipoDoc: ["C.C.", "ID", "C.E.", "Pasaporte"],
  pepEsOhaSido: ["Sí", "No"],
  pepRecursos: ["Sí", "No"],
  pepCargos: ["Sí", "No"],
  pepExtranjera: ["Sí", "No"],
  pepVinculo: ["Sí", "No"],
};

/* El cuestionario, por bloques y en el orden del papel. `campo` apunta
   al mapa; `tipo` decide qué control se pinta. */
const SECCIONES_FORMULARIO = [
  { titulo: "Encabezado", campos: ["fecha", "clienteDe", "tipoClienteForma", "tipoClienteVinculo", "tipoClientePersona"] },
  { titulo: "Información General Cliente",
    campos: ["nombreRazonSocial", "tipoDocumento", "numeroIdentificacion", "actividadPrincipal",
             "codigoCiiu", "telefono", "direccionComercial", "pais", "departamento",
             "ciudad", "codigoPostal", "tipoEmpresa", "correoFacturacion"] },
  { titulo: "Información Contacto",
    campos: ["contactoNombre", "contactoCargo", "contactoCorreo", "contactoTelefono"] },
  { titulo: "Representante legal / Persona natural",
    campos: ["repLegalNombre", "repLegalCorreo", "repLegalTipoDoc", "repLegalDocumento",
             "pepEsOhaSido", "pepRecursos", "pepCargos", "pepExtranjera", "pepVinculo"] },
  { titulo: "Firma (hoja 2)",
    campos: ["repLegalNombreFirma", "repLegalDocFirma"] },
  { titulo: "Datos comerciales (hoja 3)",
    campos: ["establecimiento", "direccionEntrega", "barrio", "municipio", "contactoPedidos",
             "telMovil", "canal", "vendedor", "centroSuministrador", "grupoCliente",
             "listaPrecios", "zonaTransporte", "horaRecibo", "clienteCercano"] },
  { titulo: "Visita",
    campos: ["responsableNombre", "fechaVisita", "lugarVisita", "ciudadVisita"] },
];

/* Campos que el formato repite y que tienen que ir iguales. El
   formulario los copia solo, que es la forma definitiva de que no
   vuelvan a salir tres correos distintos. */
const ESPEJOS = {
  contactoCorreo: "correoFacturacion",
  repLegalCorreo: "correoFacturacion",
};

/* Grupos que normalmente llevan la MISMA opción, pero que a veces no.
   Si el cliente es C.C., el representante suele serlo también; si no,
   se cambia a mano y se queda como se ponga.

   Se llama sugerencia y no espejo a propósito: un espejo (los correos)
   no se puede tocar, porque el formato exige que sean iguales. Aquí
   pueden ser distintos, así que se copia el valor solo mientras nadie
   haya tocado el campo de destino. */
const SUGERENCIAS = {
  repLegalTipoDoc: "tipoDocumento",
  /* El documento y el nombre del representante se copian del cliente
     porque en la mayoría de paquetes es la misma persona. NO son
     espejos: si el cliente es una persona jurídica, el NIT de la
     empresa y la cédula del representante son distintos, y ahí se
     escriben a mano y ya no se vuelven a pisar. */
  repLegalDocumento: "numeroIdentificacion",
  repLegalDocFirma: "numeroIdentificacion",
  repLegalNombre: "nombreRazonSocial",
  repLegalNombreFirma: "nombreRazonSocial",
  contactoNombre: "nombreRazonSocial",

  /* El teléfono se copia a los otros dos sitios donde el formato lo
     vuelve a pedir. Va como SUGERENCIA y no como espejo a propósito:
     el fijo del negocio y el móvil de pedidos son distintos más veces
     de las que parece, y un espejo los ataría para siempre. Copiado,
     se corrige una vez el que sea distinto y ya no se vuelve a pisar. */
  contactoTelefono: "telefono",
  telMovil: "telefono",

  /* El nombre del negocio de la hoja 3 suele ser la razón social. Suele:
     un cliente puede llamarse "Distribuidora Pérez S.A.S." y tener el
     local como "Asadero El Buen Sabor". Por eso se copia y se deja
     cambiar, en vez de forzarlo. */
  establecimiento: "nombreRazonSocial",
};

/* ¿Existe la opción elegida en el grupo de destino? "NIT" está en el
   documento del cliente pero no en el del representante. */
function sugerenciaValida(destino, valor) {
  if (!String(valor || "").trim()) return false;
  /* En un grupo solo vale una opción que exista: "NIT" está en el
     documento del cliente y no en el del representante. En un campo de
     texto vale cualquier cosa. */
  if (OPCIONES_GRUPO[destino]) return OPCIONES_GRUPO[destino].indexOf(valor) >= 0;
  return true;
}

/* Valores que van siempre igual. Se rellenan de entrada y se pueden
   cambiar, pero ya no se olvidan. */
function valoresPorDefecto() {
  return {
    pais: "Colombia",
    /* El Día/Mes/Año casi siempre es el de hoy: se pone puesto y quien
       lo necesite distinto lo cambia en el calendario. */
    fecha: hoyEnIso(),
    ciudad: "Bogotá",
    municipio: "Cundinamarca",
    ciudadVisita: "Bogotá",
    listaPrecios: typeof LISTA_PRECIOS_ESPERADA !== "undefined" ? LISTA_PRECIOS_ESPERADA : "CQ",
    pepEsOhaSido: "No",
    pepRecursos: "No",
    pepCargos: "No",
    pepExtranjera: "No",
    pepVinculo: "No",
    tipoClienteForma: "Contado",
    /* Fijos de esta vendedora: se repiten en todos los paquetes y
       escribirlos cada vez solo daba ocasión de equivocarse. Se pueden
       cambiar en la pantalla como cualquier otro campo. */
    clienteDe: "Delichicks S.A.S.",
    vendedor: "10020265",
    clienteCercano: "N/A",
    canal: "03",
    grupoCliente: GRUPOS_CLIENTE[0],
    codigoPostal: CODIGOS_POSTALES[0].valor,
    zonaTransporte: ZONAS_TRANSPORTE[0].valor,
    /* Quien firma es siempre la misma persona, y su nombre va escrito
       encima de la firma estampada. */
    responsableNombre: RESPONSABLE_COMERCIAL,
    /* En los paquetes enviados el lugar de visita es la ciudad, no la
       dirección del negocio. */
    lugarVisita: CIUDADES[0].ciudad,
  };
}

/* ---------------- un formato de prueba (v30) ----------------

   Para mirar cómo queda la letra, cómo cae cada dato en su casilla o
   si un campo se sale, hay que tener el formato LLENO. Llenar treinta
   y ocho campos a mano cada vez que se quiere comprobar una cosa es
   suficiente fricción como para dejar de comprobarla, que es lo que
   de verdad cuesta caro.

   TODOS LOS DATOS SON INVENTADOS Y SE NOTA. El nombre es "Cliente de
   Prueba", el correo va a `ejemplo.com` —el dominio que existe justo
   para esto y no se puede registrar— y los documentos empiezan por
   1000000000, que está fuera del rango de cédulas colombianas
   emitidas. Es a propósito: si un formato de prueba se cuela impreso
   en un paquete de verdad, tiene que cantar a la primera. Nunca metas
   aquí un cliente real: este archivo va al repositorio.

   Los textos son LARGOS a propósito, no cómodos. "Comercializadora
   Cliente de Prueba S.A.S." y el correo de abajo están cerca del
   máximo que aguantan sus casillas, que es justo lo que interesa
   mirar: un juego de datos cortos no enseña nada porque todo cabe.

   Las fechas no se ponen aquí: las pone `valoresPorDefecto`, que ya
   deja el día de hoy, y una fecha fija envejecería mal. */
const DATOS_DE_PRUEBA = {
  /* Encabezado */
  clienteDe: "Delichicks S.A.S.",
  tipoClienteForma: "Contado",
  tipoClienteVinculo: "Vinculación",
  tipoClientePersona: "Persona Natural",

  /* Información General Cliente */
  nombreRazonSocial: "Comercializadora Cliente de Prueba S.A.S.",
  tipoDocumento: "C.C.",
  numeroIdentificacion: "1000000001",
  actividadPrincipal: "Elaboracion de comidas preparadas",
  codigoCiiu: "5611",
  telefono: "3000000001",
  direccionComercial: "Cra 00 # 00-00 Sur",
  pais: "Colombia",
  departamento: "Cundinamarca",
  ciudad: "Bogotá",
  codigoPostal: "111221",
  tipoEmpresa: "Privada",
  correoFacturacion: "cliente.de.prueba@ejemplo.com",

  /* Información Contacto */
  contactoNombre: "María Ñuñez de Prueba",
  contactoCargo: "Propietaria",
  contactoCorreo: "cliente.de.prueba@ejemplo.com",
  contactoTelefono: "3000000002",

  /* Representante legal */
  repLegalNombre: "María Ñuñez de Prueba",
  repLegalCorreo: "cliente.de.prueba@ejemplo.com",
  repLegalTipoDoc: "C.C.",
  repLegalDocumento: "1000000002",
  pepEsOhaSido: "No",
  pepRecursos: "No",
  pepCargos: "No",
  pepExtranjera: "No",
  pepVinculo: "No",

  /* Firma (hoja 2) */
  repLegalNombreFirma: "María Ñuñez de Prueba",
  repLegalDocFirma: "1000000002",

  /* Datos comerciales (hoja 3) */
  establecimiento: "Comercializadora Cliente de Prueba S.A.S.",
  direccionEntrega: "Cra 00 # 00-00 Sur",
  barrio: "Barrio de Prueba",
  municipio: "Cundinamarca",
  contactoPedidos: "María Ñuñez de Prueba",
  telMovil: "3000000003",
  canal: "03",
  vendedor: "10020265",
  centroSuministrador: "Bogotá",
  grupoCliente: "03",
  listaPrecios: "CQ",
  zonaTransporte: "25-L104",
  horaRecibo: "8:00 a 12:00",
  clienteCercano: "N/A",

  /* Visita */
  responsableNombre: RESPONSABLE_COMERCIAL,
  lugarVisita: "Bogotá",
  ciudadVisita: "Bogotá",
};

/* Sobre los valores por defecto, para que la fecha siga siendo la de
   hoy y no una fija guardada en el código. Devuelve una copia: si se
   entregara el objeto tal cual, escribir en el formulario iría
   pisando la plantilla y el segundo "Llenar de prueba" saldría con lo
   que el usuario dejó a medias en el primero. */
function datosDePrueba() {
  return Object.assign(valoresPorDefecto(), DATOS_DE_PRUEBA,
    { fechaVisita: hoyEnIso() });
}

/* ---------------- cuánto sitio hay de verdad ----------------

   Las cajas del mapa son las de la MARCA que puso el usuario, y una
   marca es corta: "actividadPrincipal" mide 0.10 del ancho de la hoja.
   Para MEDIR tinta eso está bien —la marca está donde empieza el
   dato—, pero para IMPRIMIR no: "Elaboracion de comidas preparadas" no
   cabe en 0.10, y pdf-lib, si se le pasa maxWidth, parte el texto en
   dos líneas y la segunda cae sobre la fila de abajo. Pasó: la palabra
   "preparadas" acabó encima de País.

   Así que aquí se calcula hasta dónde llega la casilla de verdad: el
   dato puede extenderse hasta donde empieza el siguiente campo de su
   misma fila, o hasta el margen de la tabla si no hay ninguno. Sale
   del propio mapa, no de medir otra vez. */
const MARGEN_DERECHO = 0.884;

function seSolapanEnY(a, b) {
  return a.y0 < b.y1 - 0.0015 && b.y0 < a.y1 - 0.0015;
}

function anchoImprimible(campo) {
  const m = MAPA[campo];
  if (!m) return null;
  let tope = MARGEN_DERECHO;
  for (const otro of Object.keys(MAPA)) {
    if (otro === campo) continue;
    const o = MAPA[otro];
    if (o.hoja !== m.hoja || !seSolapanEnY(m, o)) continue;
    if (o.x0 > m.x0 && o.x0 < tope) tope = o.x0;
  }
  /* Un pelín de aire para que la letra no toque la raya de al lado. */
  return Math.max(m.x1 - m.x0, tope - m.x0 - 0.004);
}

/* ---------------- cómo se ve lo impreso ----------------

   Negro y lo más grande que quepa en cada casilla.

   LA LETRA es Short Stack (Google Fonts, SIL OFL, en public/fuentes/
   con su licencia). Se cambió en la v29 para parecerse a la letra del
   formato que se llena a mano hoy: redonda, DERECHA, ancha y de trazo
   uniforme. Kalam —lo que había hasta la v28— va inclinada y con
   contraste de trazo (grueso-fino), que es justo lo que no hace un
   bolígrafo. Kalam-Bold.ttf se queda en la carpeta con su licencia:
   para volver a ella basta cambiar las tres constantes de abajo por
   los valores que están anotados ahí.

   Antes se probó Caveat y salió casi invisible: se veía una letra
   suelta de cada palabra. Dos causas, las dos importan:

   1. `subset: true` de pdf-lib se come los contornos. Medido sobre el
      mismo texto y el mismo cuerpo: con subset 430 píxeles de tinta,
      sin subset 8906. No es cosa de la fuente, le pasa a las dos que
      se probaron. Por eso va `subset: false`, aunque el PDF engorde
      unos 200 KB: un formato ilegible no sirve de nada.
   2. Caveat solo existe como fuente VARIABLE. pdf-lib no la instancia
      y sale fina y con huecos. Short Stack es estática, igual que
      Kalam: sin `fvar`, un solo peso, 279 glifos, y tiene todas las
      tildes y la ñ que pide el formato.

   LO QUE CUESTA EL CAMBIO, medido y no escondido: Short Stack es de un
   solo peso y Kalam era la NEGRITA, así que hay menos tinta. Contando
   píxeles oscuros del mismo texto ("avella.lrosales@gmail.com
   3108667424"), cada una a su propio cuerpo ajustado: Kalam 162.485,
   Short Stack 114.566, o sea el 71%. Sigue leyéndose bien impreso y
   escaneado —se comprobó generando el formato entero y mirándolo a 150
   ppp—, pero si algún día devuelven un paquete por letra floja, ese es
   el número del que hay que partir.

   EL TAMAÑO no se puede sacar de `heightAtSize`: en una manuscrita esa
   medida incluye un montón de aire, así que la letra saldría diminuta.
   Lo que se usa es la tinta REAL de la propia fuente, medida sobre los
   contornos de "Angel Jesús ñ 0123 gjpy": lo más alto y lo más bajo
   que llega, en fracción del cuerpo. El método se validó contra Kalam,
   donde ya estaba medido a mano imprimiendo a 20 pt: daba 0.808 y
   0.258, y midiendo los contornos sale 0.8080 y 0.2590. Coincide, así
   que los números de Short Stack salen del mismo sitio.

   Si se cambia otra vez de letra HAY QUE VOLVER A MEDIRLO: son números
   de ESA letra, no del formato. */
/* ---- que no parezca escrito por una máquina ----

   Con la letra manuscrita puesta seguía notándose que era impresa, y
   el motivo no es la tipografía: es que TODO estaba perfecto. Misma
   altura, mismo tamaño, misma inclinación, apoyadas en una línea recta
   de verdad. La letra a mano no hace nada de eso.

   Así que cada carácter se dibuja por separado con tres desviaciones
   pequeñas: se sube o baja un poco, se inclina un poco y se agranda o
   encoge un poco. Los valores son deliberadamente cortos —una letra
   que baila demasiado se lee peor y canta más que una recta—, y salen
   de un generador con SEMILLA: el mismo texto en el mismo campo se
   dibuja siempre igual. Sin eso, la vista previa cambiaría de forma en
   cada tecla y parecería que la app está temblando.

   Además la línea base va ondulando lentamente a lo largo de la
   casilla, que es lo que hace la mano de verdad: no da tumbos letra a
   letra, se va yendo. */
const JITTER_ALTURA = 0.055;   // del cuerpo, arriba o abajo
const JITTER_GIRO = 1.6;       // grados
const JITTER_TAMANO = 0.05;    // proporción del cuerpo
const JITTER_AVANCE = 0.04;    // holgura entre letras
const ONDA_BASE = 0.05;        // vaivén lento de la línea base

/* Tinta de bolígrafo, no negro puro. El negro absoluto no existe en un
   papel escaneado y es lo que más delata que el texto se imprimió. */
const TINTA_PLUMA = [0.11, 0.13, 0.20];

/* ---- que no parezca escrito por una máquina ----

   La letra manuscrita sola no basta: si todos los caracteres van a la
   misma altura, del mismo tamaño y perfectamente derechos, se nota que
   lo escribió un programa. Mirando un formato lleno a mano de verdad,
   lo que salta a la vista es que NADA se repite: cada letra baila un
   poco de altura, cambia de tamaño y se inclina a su aire.

   Así que cada carácter se dibuja por separado con su propio temblor.
   Los tres números salen de medir un formato manuscrito real: la línea
   base sube y baja hasta un 5% del cuerpo, el tamaño varía un 5% y la
   inclinación llega a 2 grados. Más que eso ya parece un tembleque.

   EL TEMBLOR ES DETERMINISTA. La semilla sale del nombre del campo y
   de lo escrito, así que el mismo dato tiembla siempre igual. Si fuera
   al azar, la vista previa y el PDF descargado saldrían distintos y
   cada corrección movería toda la hoja: eso desconcierta más de lo que
   ayuda la naturalidad. */
const TEMBLOR_ALTURA = 0.05;    // del cuerpo, arriba y abajo
const TEMBLOR_TAMANO = 0.05;    // del cuerpo
const TEMBLOR_GIRO = 2;         // grados
const TEMBLOR_ESPACIO = 0.04;   // del ancho del carácter

/* Tinta de bolígrafo, no negro puro. Un negro absoluto sobre un
   escaneo gris canta: la letra de verdad siempre tiene algo de azul y
   nunca llega al 0. */
const TINTA_BOLIGRAFO = [0.09, 0.10, 0.16];

const FUENTE_MANUSCRITA = true;

/* ---------------- las tres letras (v30) ----------------

   Hasta la v29 había UNA letra fija. Ahora hay tres y se eligen en la
   pantalla, porque cuál se parece más al escaneo no se decide en
   abstracto: depende de con qué bolígrafo escriba quien llene el
   formato ese día.

   CADA ENTRADA VA COMPLETA: ruta, `sube` y `baja`. Los tres números
   van juntos y no se pueden mezclar entre fuentes. `sube` y `baja`
   son la tinta real que la letra pone por encima y por debajo de la
   línea base, en fracción del cuerpo, y de ahí sale el tamaño (ver la
   nota larga de arriba: `heightAtSize` no vale en una manuscrita).
   Colocar un texto con las medidas de OTRA fuente lo saca de la
   casilla o lo deja flotando.

   CÓMO SE MIDIERON. Sobre los contornos del propio TTF, con el texto
   "Angel Jesús ñ 0123 gjpy". El método se estrenó reproduciendo lo
   que ya estaba medido a mano para Kalam Bold (0.808 / 0.258): salió
   0.8080 / 0.2590. Y con Short Stack, que estaba en 0.845 / 0.283:
   salió 0.8447 / 0.2827. Coincide en las dos, así que los números de
   las letras nuevas salen del mismo sitio.

   `escala` es lo que hay que agrandar la muestra de la PANTALLA para
   que las tres se vean del mismo tamaño, ya que a igual `font-size`
   una fuente con poca tinta sobre la línea sale enana. Sale de la
   misma cuenta que usa `generarPdf` para elegir el cuerpo dentro de la
   casilla, o sea que la previsualización engorda y adelgaza igual que
   lo hará el papel. Sin esto, Gochi Hand se veía un 19% más pequeña en
   la pantalla y más grande en el PDF, que es la peor combinación
   posible: la muestra desmentiría al resultado.

   `tinta` es cuánta tinta pone cada una respecto de Short Stack, con
   el mismo texto ("avella.lrosales@gmail.com 3108667424"), cada una a
   su propio cuerpo ajustado a la misma altura de casilla. Es el
   número que importa si algún día devuelven un paquete por letra
   floja. `ancho` es lo mismo para el ancho de línea: manda solo en el
   correo, que es el único campo donde el ancho llega antes que la
   altura.

   POR QUÉ ESTAS DOS Y NO OTRAS. Se probaron catorce manuscritas de
   Google Fonts poniendo cada una AL LADO del escaneo real (que es la
   lección del error #41), y descartándolas por medida:
     · Gaegu Bold y Nanum Pen Script no traen ñ ni tildes. Fuera.
     · Sedgwick Ave, Sriracha, Caveat Brush y Kalam van inclinadas; la
       letra del escaneo es derecha.
     · Indie Flower (44% de la tinta de Short Stack), Architects
       Daughter (71%), Coming Soon, Delius, Handlee, Mynerve y Shadows
       Into Light Two son MÁS FLOJAS que la que ya había, así que no
       acercan nada al escaneo, que es de trazo grueso.
     · Rock Salt es tan irregular que se lee peor que la letra a mano.
   Quedaron Gochi Hand y Permanent Marker, las dos derechas y las dos
   más cargadas de tinta que Short Stack.

   LO QUE CUESTA CADA UNA, medido y no escondido:
     · Gochi Hand pone un 20% más de tinta que Short Stack y ocupa un
       12% MENOS de ancho, así que no aprieta ningún campo. Es la más
       parecida al escaneo de las tres.
     · Permanent Marker pone 2.25 veces la tinta —es la más gruesa con
       diferencia— pero dibuja las minúsculas como versalitas: escribe
       "ALEXIS", no "Alexis". En el escaneo real el cliente mezcla
       mayúsculas y minúsculas, así que no queda lejos, pero no es lo
       mismo. Y es un 9% más ancha, lo que baja el cuerpo del correo.
       Está aquí porque es la única que llega a ese grosor; si el
       correo se ve apretado, esa es la causa.

   Kalam Bold sigue en la carpeta con su licencia. No está en la lista
   porque va inclinada y ya se decidió en la v29 que no es la letra
   que se quiere imitar; para volver a ella basta añadir su entrada
   con 0.808 / 0.258. */
const LETRAS = [
  {
    id: "shortstack",
    nombre: "Short Stack",
    ruta: "fuentes/ShortStack-Regular.ttf",
    sube: 0.845, baja: 0.283,
    tinta: 1.00, ancho: 1.00, escala: 1.000,
    pista: "Redonda y ligera. La de la v29.",
  },
  {
    id: "gochihand",
    nombre: "Gochi Hand",
    ruta: "fuentes/GochiHand-Regular.ttf",
    sube: 0.639, baja: 0.330,
    tinta: 1.20, ancho: 0.88, escala: 1.187,
    pista: "Trazo grueso y redondo. La más parecida al formato escrito a mano.",
  },
  {
    id: "permanentmarker",
    nombre: "Permanent Marker",
    ruta: "fuentes/PermanentMarker-Regular.ttf",
    sube: 0.899, baja: 0.033,
    tinta: 2.25, ancho: 1.09, escala: 1.128,
    pista: "La más gruesa. Escribe las minúsculas como mayúsculas pequeñas.",
  },
];

const LETRA_POR_DEFECTO = "shortstack";
const CLAVE_LETRA = "distriaves.letra";

/* Cuál está elegida. Va en DOS sitios y el orden importa:

   · en memoria, que es lo que manda durante esta sesión;
   · en localStorage, para no tener que volver a elegirla mañana.

   Guardarla SOLO en localStorage tenía un fallo: si el navegador lo
   tiene bloqueado —ventana privada, cookies de terceros apagadas, o
   una prueba corriendo sin `window`— el `setItem` lanza, se traga la
   excepción y el botón se queda sin hacer nada, sin decirlo. Con la
   copia en memoria la elección funciona igual; lo único que se pierde
   es que sobreviva al cierre de la pestaña.

   Si lo guardado no corresponde a ninguna letra de la lista —una que
   se retiró, por ejemplo— se cae a la de siempre en vez de quedarse
   sin fuente. */
let letraEnMemoria = null;

function letraGuardada() {
  if (letraEnMemoria) return letraEnMemoria;
  try {
    const id = window.localStorage.getItem(CLAVE_LETRA);
    if (id && LETRAS.some(function (l) { return l.id === id; })) return id;
  } catch (e) { /* navegador sin localStorage: se usa la de siempre */ }
  return LETRA_POR_DEFECTO;
}

function letraActual() {
  const id = letraGuardada();
  return LETRAS.filter(function (l) { return l.id === id; })[0] || LETRAS[0];
}

function elegirLetra(id) {
  if (!LETRAS.some(function (l) { return l.id === id; })) return false;
  letraEnMemoria = id;
  try { window.localStorage.setItem(CLAVE_LETRA, id); } catch (e) { /* da igual */ }
  return true;
}

const CUERPO_MAX = 13;
const CUERPO_MIN = 5;

function tipoDeCampo(campo) {
  if (TIPO_CLIENTE[campo]) return "grupo";
  const m = MAPA[campo];
  if (!m) return null;
  return m.clase === "grupo" ? "grupo" : "texto";
}

function etiquetaDeCampo(campo) {
  if (TIPO_CLIENTE[campo]) return TIPO_CLIENTE[campo].etiqueta;
  return MAPA[campo] ? MAPA[campo].etiqueta : campo;
}

function opcionesDeCampo(campo) {
  if (TIPO_CLIENTE[campo]) return TIPO_CLIENTE[campo].opciones.map(function (o) { return o.texto; });
  return OPCIONES_GRUPO[campo] || [];
}

function camposDelFormulario() {
  const out = [];
  for (const s of SECCIONES_FORMULARIO) for (const c of s.campos) out.push(c);
  return out;
}

/* Qué falta por llenar. Es la misma pregunta que el verificador hace
   sobre papel, pero aquí se responde sin leer nada: o hay valor o no
   lo hay. */
function camposVacios(datos) {
  return camposDelFormulario().filter(function (c) {
    return !String(datos[c] == null ? "" : datos[c]).trim();
  });
}

/* ---------------- lo que se saca del RUT ----------------

   El RUT digital de la DIAN trae capa de texto, así que `rut.js` ya lo
   sabe leer: es el mismo lector que usa la pestaña Verificar para
   cruzar los datos. Aquí se usa al revés, para RELLENAR.

   Solo se traen los campos que el RUT dice sin ambigüedad. El
   teléfono, por ejemplo, viene en el RUT pero en dos casillas (41 y
   45) y no siempre es el del negocio, así que no se copia: es mejor
   dejarlo vacío que meter un número que nadie revisó. */
function camposDesdeRut(rut) {
  if (!rut) return {};
  const datos = {};
  const nombre = rut.esJuridica ? rut.razonSocial : rut.nombreCompleto;
  if (nombre) datos.nombreRazonSocial = nombre;
  if (rut.identificacion) datos.numeroIdentificacion = rut.identificacion;
  if (rut.ciiu) datos.codigoCiiu = rut.ciiu;
  if (rut.direccion) datos.direccionComercial = rut.direccion;
  if (rut.departamento) datos.departamento = rut.departamento;
  if (rut.ciudad) datos.ciudad = rut.ciudad;
  if (rut.correo) datos.correoFacturacion = rut.correo;
  /* Persona jurídica lleva NIT; persona natural, cédula. */
  datos.tipoDocumento = rut.esJuridica ? "NIT" : "C.C.";
  return datos;
}

/* ---------------- qué clase de dato pide cada campo ----------------

   Las fechas se guardan en ISO (2026-08-03) porque es lo que entiende
   `<input type="date">`, y se IMPRIMEN en 03/08/2026, que es como se
   llena el formato a mano. Guardar el formato de pantalla y traducir
   al revés sería peor: cada navegador muestra la fecha a su manera
   según el idioma del sistema. */
const TIPO_ENTRADA = {
  fecha: "date", fechaVisita: "date",
  correoFacturacion: "email", contactoCorreo: "email", repLegalCorreo: "email",
  telefono: "tel", contactoTelefono: "tel", telMovil: "tel",
  numeroIdentificacion: "numerico", repLegalDocumento: "numerico",
  repLegalDocFirma: "numerico", codigoCiiu: "numerico", codigoPostal: "numerico",
};

function tipoDeEntrada(campo) { return TIPO_ENTRADA[campo] || "texto"; }
function esFecha(campo) { return TIPO_ENTRADA[campo] === "date"; }

function hoyEnIso() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mes + "-" + dia;
}

/* ISO a como se escribe en el papel. Si llega algo que no es ISO se
   devuelve tal cual: puede venir de un formulario viejo o de una
   corrección hecha a mano sobre el PDF. */
function fechaParaImprimir(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso || "");
}

function valorParaImprimir(campo, valor) {
  return esFecha(campo) ? fechaParaImprimir(valor) : String(valor == null ? "" : valor).trim();
}

/* ---------------- validaciones ----------------

   Lo que se comprueba es la FORMA, no si el dato es cierto. Un correo
   sin arroba está mal seguro; un correo bien escrito puede seguir
   siendo el equivocado, y eso no lo sabe nadie desde aquí. */
const SOLO_DIGITOS = /^[0-9]+$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const FECHA = /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/;

const REGLAS_CAMPO = {
  correoFacturacion: { prueba: CORREO, aviso: "No parece un correo (falta la arroba o el punto)." },
  contactoCorreo:    { prueba: CORREO, aviso: "No parece un correo." },
  repLegalCorreo:    { prueba: CORREO, aviso: "No parece un correo." },
  numeroIdentificacion: { prueba: SOLO_DIGITOS, largo: [5, 12], aviso: "Solo números, sin puntos ni guiones." },
  repLegalDocumento:    { prueba: SOLO_DIGITOS, largo: [5, 12], aviso: "Solo números, sin puntos ni guiones." },
  repLegalDocFirma:     { prueba: SOLO_DIGITOS, largo: [5, 12], aviso: "Solo números, sin puntos ni guiones." },
  telefono:          { prueba: SOLO_DIGITOS, largo: [7, 10], aviso: "Un teléfono va sin espacios: 7 o 10 dígitos." },
  contactoTelefono:  { prueba: SOLO_DIGITOS, largo: [7, 10], aviso: "Un teléfono va sin espacios: 7 o 10 dígitos." },
  telMovil:          { prueba: SOLO_DIGITOS, largo: [10, 10], aviso: "Un celular colombiano tiene 10 dígitos." },
  codigoCiiu:        { prueba: SOLO_DIGITOS, largo: [4, 4], aviso: "El código CIIU son 4 dígitos." },
  codigoPostal:      { prueba: SOLO_DIGITOS, largo: [6, 6], aviso: "El código postal son 6 dígitos." },
  /* Las fechas las valida el propio `<input type="date">`: aquí solo
     se comprueba que lo guardado sea ISO, por si viene de otro sitio. */
  fecha:             { prueba: /^\d{4}-\d{2}-\d{2}$/, aviso: "Elige la fecha en el calendario." },
  fechaVisita:       { prueba: /^\d{4}-\d{2}-\d{2}$/, aviso: "Elige la fecha en el calendario." },
};

/* Devuelve el aviso, o null si el campo está bien. Un campo vacío NO
   se avisa aquí: de eso ya se encarga la cuenta de los que faltan, y
   marcar en rojo lo que aún no has escrito es hostil. */
function validarCampo(campo, valor) {
  const v = String(valor == null ? "" : valor).trim();
  if (!v) return null;

  if (campo === "listaPrecios" && v.toUpperCase().replace(/\s+/g, "") !== LISTA_PRECIOS_ESPERADA) {
    return "Va " + LISTA_PRECIOS_ESPERADA + ".";
  }
  const r = REGLAS_CAMPO[campo];
  if (!r) return null;
  if (r.prueba && !r.prueba.test(v)) return r.aviso;
  if (r.largo && (v.length < r.largo[0] || v.length > r.largo[1])) return r.aviso;
  return null;
}

/* Todos los avisos del formulario, en el orden del papel. */
function avisosDelFormulario(datos) {
  const salida = [];
  for (const campo of camposDelFormulario()) {
    const aviso = validarCampo(campo, datos[campo]);
    if (aviso) salida.push({ campo: campo, etiqueta: etiquetaDeCampo(campo), aviso: aviso });
  }
  return salida;
}

/* ---------------- dónde se imprime ----------------

   Devuelve, para un campo y un valor, la caja en coordenadas de PÁGINA
   (fracciones de 0 a 1, con el origen ARRIBA a la izquierda, como el
   resto de la app; pdf-lib usa el origen abajo y la conversión se hace
   al dibujar). */
function cajaDeImpresion(campo, valor) {
  if (TIPO_CLIENTE[campo]) {
    const t = TIPO_CLIENTE[campo];
    const i = t.opciones.findIndex(function (o) { return o.texto === valor; });
    if (i < 0) return null;
    const o = t.opciones[i];
    /* Cada opción puede traer lo suyo y lo que no traiga lo pone el
       grupo. Los tres grupos de "Tipo de cliente" comparten la x y
       cambian de y; "Cliente de" comparte la y y cambia de x. */
    const x = o.x != null ? o.x : t.x;
    const y = o.y != null ? o.y : t.y;
    const alto = o.alto != null ? o.alto : t.alto;
    /* Ya vienen en coordenadas de página: no se convierten. */
    return { hoja: "1/3", marca: true,
             x: x - DIAMETRO_CIRCULO / 2, ancho: DIAMETRO_CIRCULO,
             y: y, alto: alto };
  }

  if (campo === "fecha") {
    const m = MAPA.fecha;
    return { hoja: "1/3", marca: false, x: m.x0,
             ancho: anchoImprimible("fecha"),
             y: CAJA_FECHA.y, alto: CAJA_FECHA.alto };
  }

  const m = MAPA[campo];
  if (!m) return null;
  const aj = AJUSTE_BASE[m.hoja];
  const y = aj.escala * m.y0 + aj.desplazamiento;
  const alto = aj.escala * (m.y1 - m.y0);

  if (m.clase === "grupo") {
    const i = (OPCIONES_GRUPO[campo] || []).indexOf(valor);
    if (i < 0 || !m.opciones || !m.opciones[i]) return null;
    return { hoja: m.hoja, marca: true,
             x: m.opciones[i][0], ancho: m.opciones[i][1] - m.opciones[i][0],
             y: y, alto: alto };
  }
  return { hoja: m.hoja, marca: false, x: m.x0, ancho: anchoImprimible(campo),
           y: y, alto: alto };
}

/* Las dos rayas de cada casilla, en coordenadas de página del PDF base.

   MEDIDO sobre el propio archivo: para cada campo se busca, hacia
   abajo y hacia arriba, la primera fila de píxeles oscura que cruza
   todo el ancho del campo. Una raya no se puede confundir con otra
   cosa; un rótulo sí.

   Se anclan a las rayas y no al rótulo impreso porque el rótulo no
   siempre está donde uno cree: el de la fecha está ARRIBA, en una
   banda gris, y el de las casillas de la visita está DEBAJO de la
   línea. Buscándolo a la izquierda salían la fecha impresa sobre el
   gris y la hoja 3 descuadrada.

   RAYA_ABAJO son las 41 casillas que tienen una raya debajo. TECHO son
   las 34 que además tienen una raya encima; las otras están en zonas
   abiertas de la hoja (el bloque de firmas y el de la visita) y ahí no
   hay techo que respetar. */
const RAYA_ABAJO = {
  actividadPrincipal: 0.2509,
  barrio: 0.3148,
  canal: 0.3372,
  centroSuministrador: 0.339,
  ciudad: 0.2745,
  ciudadVisita: 0.4485,
  clienteCercano: 0.3662,
  codigoCiiu: 0.2533,
  codigoPostal: 0.2775,
  contactoCargo: 0.3123,
  contactoCorreo: 0.3226,
  contactoNombre: 0.3108,
  contactoPedidos: 0.3266,
  contactoTelefono: 0.3245,
  correoFacturacion: 0.289,
  departamento: 0.2757,
  direccionComercial: 0.2639,
  direccionEntrega: 0.3136,
  establecimiento: 0.3048,
  fecha: 0.1268,
  fechaVisita: 0.3992,
  firmaSolicitante: 0.7727,
  grupoCliente: 0.3484,
  horaRecibo: 0.3653,
  huellaSolicitante: 0.77,
  listaPrecios: 0.3499,
  lugarVisita: 0.4479,
  municipio: 0.3154,
  nombreRazonSocial: 0.2267,
  numeroIdentificacion: 0.2403,
  pais: 0.2745,
  repLegalCorreo: 0.3487,
  repLegalDocFirma: 0.8317,
  repLegalDocumento: 0.3614,
  repLegalNombre: 0.3475,
  repLegalNombreFirma: 0.8099,
  responsableFirma: 0.4464,
  responsableNombre: 0.3971,
  telMovil: 0.3278,
  telefono: 0.2627,
  vendedor: 0.3378,
  zonaTransporte: 0.3644,
};

const TECHO = {
  actividadPrincipal: 0.2394,
  barrio: 0.3063,
  canal: 0.3272,
  centroSuministrador: 0.3287,
  ciudad: 0.2654,
  clienteCercano: 0.3508,
  codigoCiiu: 0.2421,
  codigoPostal: 0.2663,
  contactoCargo: 0.3012,
  contactoCorreo: 0.3114,
  contactoNombre: 0.2996,
  contactoPedidos: 0.3145,
  contactoTelefono: 0.3133,
  correoFacturacion: 0.2775,
  departamento: 0.2645,
  direccionComercial: 0.2527,
  direccionEntrega: 0.3051,
  establecimiento: 0.2933,
  fecha: 0.1123,
  grupoCliente: 0.3381,
  horaRecibo: 0.3502,
  listaPrecios: 0.3396,
  municipio: 0.3069,
  nombreRazonSocial: 0.2152,
  numeroIdentificacion: 0.2291,
  pais: 0.2633,
  repLegalCorreo: 0.3375,
  repLegalDocFirma: 0.8105,
  repLegalDocumento: 0.3502,
  repLegalNombre: 0.3357,
  telMovil: 0.316,
  telefono: 0.2515,
  vendedor: 0.3275,
  zonaTransporte: 0.3493,
};

/* Qué parte de la cola de la "g" queda POR ENCIMA de la raya. Con 0.75
   sobresale por debajo un cuarto de la cola: la letra se ve apoyada en
   la línea, como escrita a mano, sin meterse en la casilla de abajo.
   Con 0.4 —el primer valor que se probó— la cola bajaba 2.6 pt por
   debajo de la raya y rozaba el renglón siguiente. */
const COLA_SOBRE_LA_RAYA = 0.75;

/* Alto de casilla que se supone donde no hay raya arriba (el bloque de
   firmas y el de la visita). Es de sobra: ahí manda CUERPO_MAX. */
const ALTO_SIN_TECHO = 0.016;



/* Generador con semilla (mulberry32). Hace falta que sea reproducible:
   el mismo campo con el mismo texto tiene que salir siempre idéntico o
   la vista previa parecería temblar al reescribir. */
function azarConSemilla(texto) {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Ancho real de un texto con las holguras del temblor incluidas: hace
   falta ANTES de decidir el cuerpo, o el último carácter se sale. */
function anchoConTemblor(fuente, texto, cuerpo) {
  return fuente.widthOfTextAtSize(texto, cuerpo) * (1 + JITTER_AVANCE / 2);
}

/* Escribe letra a letra, cada una con su pequeño desvío. */
function escribirAMano(pag, texto, opciones) {
  const azar = azarConSemilla(opciones.semilla + "|" + texto);
  const fuente = opciones.fuente;
  const cuerpo = opciones.cuerpo;
  let x = opciones.x;

  for (let i = 0; i < texto.length; i++) {
    const letra = texto[i];
    const avance = fuente.widthOfTextAtSize(letra, cuerpo);

    if (letra !== " ") {
      const t = texto.length > 1 ? i / (texto.length - 1) : 0;
      /* Vaivén lento + sacudida corta por letra. */
      const onda = Math.sin(t * Math.PI * 1.7 + opciones.fase) * ONDA_BASE;
      const dy = (onda + (azar() - 0.5) * 2 * JITTER_ALTURA) * cuerpo;
      const giro = (azar() - 0.5) * 2 * JITTER_GIRO;
      const tam = cuerpo * (1 + (azar() - 0.5) * 2 * JITTER_TAMANO);

      pag.drawText(letra, {
        x: x,
        y: opciones.apoyo + dy,
        size: tam,
        font: fuente,
        color: opciones.color,
        rotate: PDFLib.degrees(giro),
      });
    }
    x += avance * (1 + (azar() - 0.5) * 2 * JITTER_AVANCE);
  }
}

/* Números pseudoaleatorios repetibles a partir de un texto. Es un
   xorshift de 32 bits: no sirve para criptografía y no falta que
   sirva; lo que hace falta es que la misma casilla tiemble siempre
   igual. */
function semillaDe(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

function dadoDe(semilla) {
  let x = semilla;
  return function () {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;       // 0 a 1
  };
}

/* Ancho real de lo escrito con temblor. Hay que calcularlo igual que
   se dibuja, o el texto se sale de la casilla: el temblor cambia el
   tamaño de cada letra y con él el ancho total. */
function anchoTembloroso(fuente, texto, cuerpo, semilla) {
  const dado = dadoDe(semilla);
  let ancho = 0;
  for (const caracter of texto) {
    const tamano = cuerpo * (1 + (dado() - 0.5) * 2 * TEMBLOR_TAMANO);
    ancho += fuente.widthOfTextAtSize(caracter, tamano) *
             (1 + (dado() - 0.5) * 2 * TEMBLOR_ESPACIO);
    dado(); dado();               // los dos dados de altura y giro
  }
  return ancho;
}

/* Escribe carácter a carácter, cada uno con su temblor. */
function escribirTembloroso(pag, texto, opciones) {
  const dado = dadoDe(opciones.semilla);
  let x = opciones.x;
  for (const caracter of texto) {
    const tamano = opciones.cuerpo * (1 + (dado() - 0.5) * 2 * TEMBLOR_TAMANO);
    const avance = opciones.fuente.widthOfTextAtSize(caracter, tamano) *
                   (1 + (dado() - 0.5) * 2 * TEMBLOR_ESPACIO);
    const altura = (dado() - 0.5) * 2 * TEMBLOR_ALTURA * opciones.cuerpo;
    const giro = (dado() - 0.5) * 2 * TEMBLOR_GIRO;
    if (caracter !== " ") {
      pag.drawText(caracter, {
        x: x, y: opciones.base + altura, size: tamano,
        font: opciones.fuente, color: opciones.color,
        rotate: PDFLib.degrees(giro),
      });
    }
    x += avance;
  }
}

/* Incrusta la letra manuscrita. Necesita fontkit, que es lo que sabe
   leer un TTF; pdf-lib solo trae las 14 fuentes estándar del PDF. */
async function cargarFuente(doc) {
  if (FUENTE_MANUSCRITA && typeof fontkit !== "undefined") {
    try {
      doc.registerFontkit(fontkit);
      /* La letra y sus dos medidas salen de la MISMA entrada del
         catálogo. Es la forma de que no se puedan descuadrar. */
      const letra = letraActual();
      const r = await fetch(letra.ruta);
      if (r.ok) {
        /* subset: false a propósito. Ver la nota de arriba. */
        const f = await doc.embedFont(new Uint8Array(await r.arrayBuffer()), { subset: false });
        return { fuente: f, sube: letra.sube, baja: letra.baja };
      }
    } catch (e) {
      /* Se sigue con la de palo seco: mejor un formato feo que ninguno. */
    }
  }
  const f = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  /* En una fuente de palo seco las métricas del archivo sí valen. */
  const sube = f.heightAtSize(100, { descender: false }) / 100;
  return { fuente: f, sube: sube, baja: f.heightAtSize(100) / 100 - sube };
}

/* ---------------- generar el PDF ----------------

   Se dibuja ENCIMA del formato original en vez de rehacerlo. Rehacerlo
   milímetro a milímetro sería mucho más trabajo y cualquier diferencia
   con el original es motivo de devolución. */
/* ---------------- la firma de la responsable comercial (v31) ----------

   La firma va siempre en el mismo sitio y es siempre la misma persona,
   así que se estampa como imagen en vez de dejar el hueco para firmar
   a mano. Antes tocaba imprimir el formato, firmarlo y volver a
   escanearlo en cada creación.

   QUÉ ES ESTE PNG. La firma de Olga Lucía Lemus, recortada de un
   formato que ella misma firmó. Del recorte original se quitaron por
   componentes conectados la línea del recuadro y las motas del papel,
   se pasó el papel a transparente y el trazo al mismo azul-negro que
   usa el resto del formato. Se guarda a 4x el tamaño de la foto porque
   el original venía pequeño y al imprimirlo se veía dentado.

   ESTO ES UNA FIRMA DE VERDAD Y ESO TIENE CONSECUENCIAS. Cualquiera
   que reciba el PDF puede sacar la imagen y ponerla en otro documento.
   Es una decisión tomada a conciencia para no tener que imprimir y
   escanear cada paquete, no un efecto colateral. Para dejar de
   estamparla basta poner FIRMA_ESTAMPADA en false: el hueco vuelve a
   quedar en blanco y se firma a mano como antes.

   Si el PNG no está o no se puede leer, el formato SALE IGUAL con el
   hueco vacío. Un paquete sin firma se arregla firmando; un paquete
   que no se genera deja a la vendedora sin nada. */
const FIRMA_ESTAMPADA = true;
const RUTA_FIRMA = "firma/responsable.png";

/* Dónde va, en coordenadas de página del PDF base. El ancho sale de la
   casilla `responsableFirma` del mapa; el alto lo pone la proporción
   de la imagen, para no deformar el trazo. El 1.6 la saca un poco de
   su caja a propósito: una firma a mano nunca cabe clavada en el
   rectángulo, y una que sí lo hace se nota impresa. */
const ANCHO_FIRMA = 1.6;

async function estamparFirma(doc, paginas) {
  if (!FIRMA_ESTAMPADA) return false;
  const m = MAPA.responsableFirma;
  if (!m) return false;
  try {
    const r = await fetch(RUTA_FIRMA);
    if (!r.ok) return false;
    const png = await doc.embedPng(new Uint8Array(await r.arrayBuffer()));

    const pag = paginas[PAGINA_DE_HOJA[m.hoja]];
    const { width: W, height: H } = pag.getSize();
    const aj = AJUSTE_BASE[m.hoja];

    const ancho = (m.x1 - m.x0) * W * ANCHO_FIRMA;
    const alto = ancho * (png.height / png.width);

    /* Se centra en la casilla y se apoya un poco por encima de la raya,
       como se firma de verdad: sobre la línea, no colgando de ella. */
    const centroX = (m.x0 + (m.x1 - m.x0) / 2) * W;
    const rayaY = H - (aj.escala * m.y1 + aj.desplazamiento) * H;

    pag.drawImage(png, {
      x: centroX - ancho / 2,
      y: rayaY + alto * 0.06,
      width: ancho, height: alto,
      rotate: PDFLib.degrees(-1.2),   // nadie firma perfectamente recto
    });
    return true;
  } catch (e) {
    /* Sin firma, pero con formato. */
    return false;
  }
}

async function generarPdf(datos, adjuntos) {
  if (typeof PDFLib === "undefined") throw new Error("No se cargó la librería de PDF.");

  const base = await fetch(PDF_BASE);
  if (!base.ok) throw new Error("No encontré el formato en blanco (" + PDF_BASE + ").");
  const doc = await PDFLib.PDFDocument.load(await base.arrayBuffer());
  const letra = await cargarFuente(doc);
  const fuente = letra.fuente;
  const paginas = doc.getPages();
  const tinta = PDFLib.rgb(TINTA_PLUMA[0], TINTA_PLUMA[1], TINTA_PLUMA[2]);

  await estamparFirma(doc, paginas);

  for (const campo of camposDelFormulario()) {
    const valor = valorParaImprimir(campo, datos[campo]);
    if (!valor) continue;
    const caja = cajaDeImpresion(campo, valor);
    if (!caja) continue;

    const pag = paginas[PAGINA_DE_HOJA[caja.hoja]];
    const { width: W, height: H } = pag.getSize();

    if (caja.marca) {
      /* Una X dentro del círculo. El radio se saca del lado MENOR de
         la caja para que no se salga por el lado estrecho, que es lo
         que pasaba antes al usar el alto de la fila entera. */
      const dado = dadoDe(semillaDe(campo + "|" + valor));
      const cx = (caja.x + caja.ancho / 2) * W + (dado() - 0.5) * 1.2;
      const cy = H - (caja.y + caja.alto / 2) * H + (dado() - 0.5) * 1.2;
      const r = Math.min(caja.ancho * W, caja.alto * H) * 0.40;
      /* Una cruz hecha a mano no sale simétrica: cada aspa se desvía un
         poco de su punta ideal. */
      const t = function () { return (dado() - 0.5) * r * 0.35; };
      pag.drawLine({ start: { x: cx - r + t(), y: cy - r + t() },
                     end: { x: cx + r + t(), y: cy + r + t() },
                     thickness: 1.3, color: tinta });
      pag.drawLine({ start: { x: cx - r + t(), y: cy + r + t() },
                     end: { x: cx + r + t(), y: cy - r + t() },
                     thickness: 1.3, color: tinta });
      continue;
    }

    /* Texto en UNA sola línea, siempre. Nada de maxWidth: pdf-lib
       partiría la frase y la segunda línea caería sobre la fila de
       abajo. Pasó con "Elaboracion de comidas preparadas".

       El cuerpo sale de la ALTURA DE LA CASILLA, medida entre sus dos
       rayas, y de la tinta real de la letra (SUBE_LETRA y BAJA_LETRA,
       arriba). Se apoya en la raya de abajo, dejando asomar un
       cuarto de la cola por debajo, como la letra a mano.

       No se usa `heightAtSize`: en una manuscrita esa medida va llena
       de aire y devolvería un cuerpo diminuto. */
    const anchoCaja = caja.ancho * W;
    const abajo = RAYA_ABAJO[campo];

    let apoyo, cuerpo;
    if (abajo != null) {
      const arriba = TECHO[campo] != null ? TECHO[campo] : abajo - ALTO_SIN_TECHO;
      const altoCelda = (abajo - arriba) * H;
      /* Se reserva sitio para el temblor: una letra puede salir un 5%
         más grande y subida otro 5% del cuerpo. Sin ese margen, la más
         alta de la casilla se asoma por encima de su raya. */
      const alturaPorPunto = letra.sube * (1 + TEMBLOR_TAMANO) + TEMBLOR_ALTURA +
                             COLA_SOBRE_LA_RAYA * letra.baja;
      cuerpo = Math.min(CUERPO_MAX, altoCelda / alturaPorPunto);
      apoyo = H - abajo * H + COLA_SOBRE_LA_RAYA * letra.baja * cuerpo;
    } else {
      /* Sin rayas medidas se cae a la caja del mapa, que es peor pero
         no deja el campo sin imprimir. */
      const altoCaja = caja.alto * H;
      cuerpo = Math.min(CUERPO_MAX,
                        altoCaja / (letra.sube * (1 + TEMBLOR_TAMANO) +
                                    TEMBLOR_ALTURA + letra.baja));
      apoyo = H - (caja.y + caja.alto) * H + letra.baja * cuerpo;
    }

    while (cuerpo > CUERPO_MIN && anchoConTemblor(fuente, valor, cuerpo) > anchoCaja) {
      cuerpo -= 0.25;
    }

    escribirAMano(pag, valor, {
      x: caja.x * W,
      apoyo: apoyo,
      cuerpo: cuerpo,
      fuente: fuente,
      color: tinta,
      semilla: campo,
      /* La fase del vaivén cambia de campo en campo: si no, todas las
         casillas ondulan igual y vuelve a notarse el patrón. */
      fase: (campo.length % 7) * 0.9,
    });
  }

  await adjuntarDocumentos(doc, adjuntos);
  return await doc.save();
}

/* ---------------- pegar el RUT y la cédula detrás ----------------

   El paquete que se entrega son las tres hojas del formato, el RUT y
   la cédula. Si ya se subieron para autorrellenar, tenerlos y aun así
   pedir que se junten aparte no tiene sentido: se pegan aquí y el PDF
   sale completo.

   El orden es el del trámite y el mismo que usa "Ordenar las hojas":
   formato, RUT, cédula. */
async function adjuntarDocumentos(doc, adjuntos) {
  if (!adjuntos) return;
  for (const clave of ["rut", "cedula"]) {
    const a = adjuntos[clave];
    if (!a || !a.bytes) continue;
    try {
      await pegarDocumento(doc, a);
    } catch (e) {
      /* Un adjunto que no se puede leer no puede tumbar el formato:
         se entrega el formato solo y la pantalla lo avisa. */
      a.error = e && e.message ? e.message : String(e);
    }
  }
}

const A4 = [595.28, 841.89];

async function pegarDocumento(doc, a) {
  if (a.tipo === "imagen") {
    const img = /\.png$/i.test(a.nombre || "")
      ? await doc.embedPng(a.bytes)
      : await doc.embedJpg(a.bytes);
    /* La foto va en una A4 y se encoge para que quepa entera: a tamaño
       natural, una foto de móvil sale como una página de metro y
       medio. */
    const escala = Math.min(A4[0] / img.width, A4[1] / img.height);
    const pag = doc.addPage(A4);
    pag.drawImage(img, {
      x: (A4[0] - img.width * escala) / 2,
      y: (A4[1] - img.height * escala) / 2,
      width: img.width * escala,
      height: img.height * escala,
    });
    return;
  }
  const origen = await PDFLib.PDFDocument.load(a.bytes);
  const indices = origen.getPageIndices();
  const copias = await doc.copyPages(origen, indices);
  copias.forEach(function (p) { doc.addPage(p); });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { AJUSTE_BASE, TIPO_CLIENTE, OPCIONES_GRUPO, SECCIONES_FORMULARIO, ESPEJOS,
                     LETRAS, LETRA_POR_DEFECTO, CLAVE_LETRA, letraActual, elegirLetra,
                     CIUDADES, CODIGOS_POSTALES, ZONAS_TRANSPORTE, GRUPOS_CLIENTE, ATAJOS,
                     RESPONSABLE_COMERCIAL, departamentoDe, FIRMA_ESTAMPADA, RUTA_FIRMA,
                     DATOS_DE_PRUEBA, datosDePrueba,
                     valoresPorDefecto, SUGERENCIAS, sugerenciaValida, tipoDeCampo,
                     camposDesdeRut, validarCampo, avisosDelFormulario, REGLAS_CAMPO,
                     tipoDeEntrada, esFecha, hoyEnIso, fechaParaImprimir, valorParaImprimir, etiquetaDeCampo, opcionesDeCampo,
                     camposDelFormulario, camposVacios, cajaDeImpresion, anchoImprimible,
                     semillaDe, dadoDe, anchoTembloroso, TEMBLOR_ALTURA, TEMBLOR_TAMANO,
                     TINTA_BOLIGRAFO,
                     azarConSemilla, anchoConTemblor, TINTA_PLUMA,
                     RAYA_ABAJO, TECHO, DIAMETRO_CIRCULO, adjuntarDocumentos, generarPdf };
}
