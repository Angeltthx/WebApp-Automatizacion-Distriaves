"use strict";
/* ================================================================
   Rejilla del formato FO-901

   Para dibujar un recuadro sobre un campo hay que saber dónde quedó
   ese campo en TU foto: cada paquete llega con otra escala, otro
   recorte y algo de inclinación.

   En vez de una plantilla de coordenadas fijas, aquí se detectan las
   líneas del formulario sobre la imagen real y se emparejan con la
   referencia. Medido sobre 5 paquetes: las filas coinciden entre
   escaneos con menos de 0.5% de diferencia, salvo un corrimiento
   global que es justo lo que corrige el emparejamiento.

   Si el emparejamiento no da confianza, no se inventa un recuadro:
   se marca la franja de la fila y se dice que es aproximado.
   ================================================================ */

/* Posiciones de las líneas, como fracción del alto de la página.
   Tomadas de un escaneo limpio y verificadas contra los otros cuatro. */
const REFERENCIA = {
  /* Hoja 1: bloque de datos del cliente. */
  "1/3": [
    0.2113, 0.2219, 0.2339, 0.2452, 0.2572, 0.2686, 0.2806, 0.2926,
    0.3039, 0.3159, 0.3272, 0.3392, 0.3512, 0.3625, 0.3739, 0.3859,
    0.3972, 0.4297, 0.4375, 0.4466, 0.4657, 0.5173, 0.5329, 0.5484,
  ],
  /* Hoja 2: tabla del aval, autorizaciones y bloque de firma.
     Medida sobre las hojas 2 de 24 paquetes reales. */
  "2/3": [
    0.115, 0.127, 0.138, 0.149, 0.160, 0.171, 0.183, 0.194, 0.202,
    0.213, 0.323, 0.331, 0.342, 0.632, 0.644, 0.673, 0.682, 0.832, 0.930,
  ],
  /* Hoja 3: datos comerciales, visita y confirmación de cartera. */
  "3/3": [
    0.122, 0.134, 0.275, 0.287, 0.296, 0.309, 0.318, 0.330, 0.344,
    0.443, 0.454, 0.535, 0.551, 0.566, 0.581, 0.597, 0.612, 0.628,
    0.643, 0.659, 0.684,
  ],
};

/* Campos que sabemos ubicar. Cada uno vive entre dos líneas de la
   referencia y ocupa una franja horizontal de la página. */
const CAMPOS = {
  /* de / a son índices de la referencia. Cuando un dato no está entre
     dos líneas (los campos escritos a mano no tienen rayas alrededor),
     fDesde y fHasta dicen en qué parte del tramo cae, de 0 a 1. */

  nombreRazonSocial:   { hoja: "1/3", de: 1,  a: 2,  x0: 0.07, x1: 0.62, zona: "derecha", etiqueta: "Nombre o Razón Social" },
  numeroIdentificacion:{ hoja: "1/3", de: 2,  a: 3,  x0: 0.44, x1: 0.80, zona: "derecha", etiqueta: "No. de Identificación" },
  actividadPrincipal:  { hoja: "1/3", de: 3,  a: 4,  x0: 0.07, x1: 0.66, zona: "derecha", etiqueta: "Actividad Principal" },
  codigoCiiu:          { hoja: "1/3", de: 3,  a: 4,  x0: 0.75, x1: 0.95, zona: "derecha", etiqueta: "Código CIIU" },
  telefono:            { hoja: "1/3", de: 4,  a: 5,  x0: 0.07, x1: 0.30, zona: "derecha", etiqueta: "Teléfono" },
  direccionComercial:  { hoja: "1/3", de: 4,  a: 5,  x0: 0.30, x1: 0.78, zona: "derecha", etiqueta: "Dirección Comercial" },
  ubicacion:           { hoja: "1/3", de: 5,  a: 6,  x0: 0.07, x1: 0.70, zona: "derecha", etiqueta: "País, Departamento y Ciudad" },
  codigoPostal:        { hoja: "1/3", de: 5,  a: 6,  x0: 0.697, x1: 0.884, zona: "derecha", etiqueta: "Código Postal" },
  correoFacturacion:   { hoja: "1/3", de: 6,  a: 7,  x0: 0.424, x1: 0.884, zona: "derecha", etiqueta: "E-mail de facturación" },
  contactoNombre:      { hoja: "1/3", de: 8,  a: 9,  x0: 0.07, x1: 0.62, zona: "derecha", etiqueta: "Nombre del contacto" },
  contactoCorreo:      { hoja: "1/3", de: 9,  a: 10, x0: 0.07, x1: 0.55, zona: "derecha", etiqueta: "E-mail del contacto" },
  repLegalNombre:      { hoja: "1/3", de: 11, a: 12, x0: 0.07, x1: 0.456, zona: "derecha", etiqueta: "Nombre del representante" },
  repLegalCorreo:      { hoja: "1/3", de: 11, a: 12, x0: 0.456, x1: 0.884, zona: "derecha", etiqueta: "E-mail del representante" },
  repLegalDocumento:   { hoja: "1/3", de: 12, a: 13, x0: 0.42, x1: 0.80, zona: "derecha", etiqueta: "Documento del representante" },

  firmaAutorizacion:   { hoja: "2/3", de: 16, a: 17, x0: 0.08, x1: 0.47, zona: "todo", etiqueta: "Firma y huella" },
  nombreRepFirma:      { hoja: "2/3", de: 17, a: 18, fDesde: 0.00, fHasta: 0.50, x0: 0.08, x1: 0.47, zona: "arriba", etiqueta: "Nombre del rep. legal" },
  identificacionFirma: { hoja: "2/3", de: 17, a: 18, fDesde: 0.50, fHasta: 1.00, x0: 0.08, x1: 0.47, zona: "arriba", etiqueta: "Número de identificación" },

  establecimiento:     { hoja: "3/3", de: 2,  a: 3,  x0: 0.08, x1: 0.92, zona: "derecha", etiqueta: "Nombre del establecimiento" },
  direccionEntrega:    { hoja: "3/3", de: 3,  a: 4,  x0: 0.08, x1: 0.92, zona: "derecha", etiqueta: "Dirección de entrega" },
  contactoPedidos:     { hoja: "3/3", de: 4,  a: 5,  x0: 0.08, x1: 0.92, zona: "derecha", etiqueta: "Contacto de pedidos" },
  listaPrecios:        { hoja: "3/3", de: 6,  a: 7,  x0: 0.456, x1: 0.884, zona: "derecha", etiqueta: "Lista de precios" },
  horaRecibo:          { hoja: "3/3", de: 7,  a: 8,  x0: 0.28, x1: 0.64, zona: "derecha", etiqueta: "Hora de recibo" },
  responsableVisita:   { hoja: "3/3", de: 8,  a: 9,  fDesde: 0.05, fHasta: 0.45, x0: 0.08, x1: 0.62, zona: "arriba", etiqueta: "Responsable y fecha" },
  lugarVisita:         { hoja: "3/3", de: 8,  a: 9,  fDesde: 0.50, fHasta: 0.95, x0: 0.35, x1: 0.95, zona: "arriba", etiqueta: "Lugar y ciudad de visita" },
};

/* Barras de sección: las bandas grises con el título en blanco.
   A diferencia de las filas, NO son periódicas, así que sirven de
   ancla. Sin ellas, un calce corrido tres filas puntúa igual de bien
   que el correcto: sobre 24 paquetes reales eso daba 6 recuadros que
   se declaraban exactos estando desviados. */
const REFERENCIA_BARRAS = {
  "1/3": [0.214, 0.296, 0.332, 0.440, 0.622, 0.653, 0.718, 0.788],
  "2/3": [0.117, 0.202, 0.335, 0.685],
  "3/3": [0.125, 0.448],
};

/* Una barra es oscura y pareja; un renglón de texto es oscuro pero
   lleno de altibajos. Eso las separa. */
function detectarBarras(gris, ancho, alto) {
  const desde = Math.floor(ancho * 0.10), hasta = Math.floor(ancho * 0.90);
  const n = hasta - desde;
  const medias = new Float32Array(alto);
  const desvios = new Float32Array(alto);

  for (let y = 0; y < alto; y++) {
    let suma = 0;
    for (let x = desde; x < hasta; x++) suma += gris[y * ancho + x];
    const media = suma / n;
    let varianza = 0;
    for (let x = desde; x < hasta; x++) {
      const d = gris[y * ancho + x] - media;
      varianza += d * d;
    }
    medias[y] = media;
    desvios[y] = Math.sqrt(varianza / n);
  }

  const ordenadas = Array.from(medias).sort(function (a, b) { return a - b; });
  const fondo = ordenadas[Math.floor(ordenadas.length * 0.8)];
  const grueso = Math.max(3, Math.round(alto * 0.004));

  const barras = [];
  let inicio = null;
  for (let y = 0; y <= alto; y++) {
    const esBarra = y < alto && medias[y] < fondo - 28 && desvios[y] < 62;
    if (esBarra) {
      if (inicio === null) inicio = y;
    } else if (inicio !== null) {
      if (y - inicio >= grueso) barras.push((inicio + y - 1) / 2 / alto);
      inicio = null;
    }
  }
  return barras;
}

/* Casillas que vienen escritas en los 24 paquetes que ya te aprobaron.
   El número es el nivel de tinta por debajo del cual la casilla se
   considera vacía: el 60% de lo que marca una casilla escrita.

   No es cero porque el papel nunca está limpio: la etiqueta impresa y
   la raya aportan un piso de tinta aunque nadie escriba nada. Por eso
   se compara contra lo que marca una casilla llena, no contra cero.

   Contrastado con los 24 paquetes: dispara 2 veces. Una es real (el
   «Lugar de visita» de un paquete que quedó en blanco y aun así pasó);
   la otra es dudosa. Las casillas que en los paquetes buenos a veces
   van vacías no están en esta lista: marcarlas sería inventar un error.

   Si alguna te marca mal, dímelo y se ajusta el número. */
const CASILLAS_OBLIGATORIAS = {
  actividadPrincipal:   0.1771,
  contactoNombre:       0.1874,
  contactoPedidos:      0.1225,
  correoFacturacion:    0.1745,
  direccionEntrega:     0.2089,
  firmaAutorizacion:    0.1009,
  horaRecibo:           0.1368,
  lugarVisita:          0.0723,
  nombreRazonSocial:    0.1777,
  numeroIdentificacion: 0.127,
  repLegalDocumento:    0.1485,
  responsableVisita:    0.0881,
  ubicacion:            0.1915,
};

/* ---------------- celdas que se transcriben ----------------

   Recuadros para RECORTAR y mandar a transcribir, no para medir tinta.
   Van de raya a raya: incluyen la etiqueta impresa a propósito, porque
   la etiqueta le dice al lector qué casilla es y eso lo hace mucho más
   difícil de confundir que un recorte pelado. La instrucción de "copia
   solo lo escrito a mano" va en el mensaje, no en el recorte.

   Los límites en X salen de MEDIR las rayas verticales del formato en
   blanco (Formato_Vacio.pdf, FO-901 2025/05 V4, rasterizado a 800 px):
     hoja 1, fila País/Depto/Ciudad/Cód.Postal → 0.085 0.249 0.456 0.697 0.884
     hoja 1, fila Actividad/Código CIIU        → 0.085 0.697 0.884
     hoja 1, fila Tipo de empresa/E-mail Fact. → 0.085 0.424 0.884
     hoja 1, fila E-mail contacto/Teléfono     → 0.086 0.456 0.884
     hoja 1, fila Nombre rep./E-mail rep.      → 0.086 0.884 (sin raya interna;
                 el rótulo "E-mail:" empieza en 0.456, medido sobre la hoja)
     hoja 3, fila Grupo Cliente/Lista precios  → 0.087 0.456 0.884
   El margen de la tabla es 0.085–0.884 en las dos hojas.

   ORDEN IMPORTA: es el orden en que se le muestran al modelo. */
const CELDAS = {
  nombreRazonSocial: { hoja: "1/3", de: 1,  a: 2,  x0: 0.085, x1: 0.884,
                       rotulo: "Nombre o Razón Social" },
  codigoPostal:      { hoja: "1/3", de: 5,  a: 6,  x0: 0.697, x1: 0.884,
                       rotulo: "Código Postal" },
  correoFacturacion: { hoja: "1/3", de: 6,  a: 7,  x0: 0.424, x1: 0.884,
                       rotulo: "E-mail Facturación Electrónica" },
  contactoCorreo:    { hoja: "1/3", de: 9,  a: 10, x0: 0.086, x1: 0.456,
                       rotulo: "E-mail (Información Contacto)" },
  repLegalCorreo:    { hoja: "1/3", de: 11, a: 12, x0: 0.456, x1: 0.884,
                       rotulo: "E-mail (Representante legal)" },
  establecimiento:   { hoja: "3/3", de: 2,  a: 3,  x0: 0.086, x1: 0.884,
                       rotulo: "Nombre del establecimiento comercial (Negocio)" },
  listaPrecios:      { hoja: "3/3", de: 6,  a: 7,  x0: 0.456, x1: 0.884,
                       rotulo: "Lista de precios" },
};

/* Los tres sitios donde va el MISMO correo. Si esta lista crece, la
   regla de los correos se entera sola. */
const CELDAS_CORREO = ["correoFacturacion", "contactoCorreo", "repLegalCorreo"];

/* Valor que debe llevar siempre la casilla "Lista de precios".
   Dicho por el usuario, 2026-08: es CQ en todos los casos. */
const LISTA_PRECIOS_ESPERADA = "CQ";

/* Dónde recortar una celda en ESTA página, en fracciones de 0 a 1.
   Se estira un poco en vertical: las rayas del formato quedan justo
   pegadas al texto y sin ese aire el recorte corta las tildes y las
   colas de las letras. 12% del alto de la fila, medido sobre las tres
   hojas de prueba2.pdf: con 0% se cortaba la "g" de "gmail". */
function ubicarCelda(nombre, ajuste) {
  const celda = CELDAS[nombre];
  if (!celda || !ajuste) return null;
  const ref = REFERENCIA[celda.hoja];
  if (!ref || celda.a >= ref.length) return null;

  const y0 = ajuste.escala * ref[celda.de] + ajuste.desplazamiento;
  const y1 = ajuste.escala * ref[celda.a] + ajuste.desplazamiento;
  if (y1 <= y0) return null;
  const aire = (y1 - y0) * 0.12;

  return {
    campo: nombre,
    rotulo: celda.rotulo,
    hoja: celda.hoja,
    x: celda.x0,
    ancho: celda.x1 - celda.x0,
    y: Math.max(0, y0 - aire),
    alto: Math.min(1, y1 + aire) - Math.max(0, y0 - aire),
  };
}

/* Tinta donde de verdad va el dato escrito, evitando el texto impreso.
   En este formato la etiqueta no siempre está en el mismo sitio: en la
   hoja 1 va a la izquierda y el dato a la derecha, pero en los campos
   de la visita el dato va ARRIBA y la etiqueta debajo, en letra chica.
   Medir el lado equivocado hacía leer "lleno" una casilla en blanco. */
/* Tinta en una caja tal cual, sin apartarse de la etiqueta. La usa el
   mapa de casillas, donde la caja YA viene puesta donde va el dato
   (sale de la marca del formato marcado), así que recortarla más solo
   quitaría trazo. */
function tintaEnCaja(bin, ancho, alto, caja) {
  const x0 = Math.max(0, Math.floor(caja.x * ancho));
  const x1 = Math.min(ancho, Math.ceil((caja.x + caja.ancho) * ancho));
  const y0 = Math.max(0, Math.floor(caja.y * alto));
  const y1 = Math.min(alto, Math.ceil((caja.y + caja.alto) * alto));
  if (x1 <= x0 || y1 <= y0) return null;

  let tinta = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (bin[y * ancho + x]) tinta++;
      total++;
    }
  }
  return total ? tinta / total : null;
}

/* Densidad máxima de tinta dentro de una caja: se recorre la casilla
   con una ventana estrecha y se devuelve la más cargada.

   Es lo que sustituyó a la media, y el motivo es simple: la letra a
   mano se concentra al principio de la casilla y la media la reparte
   entre todo el ancho. "N/A" en una casilla de tres centímetros mueve
   el promedio una miseria y quedaba en naranja. La ventana la ve.

   16 px sobre el lienzo de 800 son unos 12 puntos en A4: dos o tres
   caracteres escritos a mano. Se probó de 12 a 44 y de 12 a 18 el
   resultado es idéntico —una meseta, no un filo—, así que 16 está en
   el centro de la zona buena. */
const VENTANA_DENSIDAD = 16;

function densidadMaxima(bin, ancho, alto, caja, ventana) {
  ventana = ventana || VENTANA_DENSIDAD;
  const x0 = Math.max(0, Math.floor(caja.x * ancho));
  const x1 = Math.min(ancho, Math.ceil((caja.x + caja.ancho) * ancho));
  const y0 = Math.max(0, Math.floor(caja.y * alto));
  const y1 = Math.min(alto, Math.ceil((caja.y + caja.alto) * alto));
  if (x1 <= x0 || y1 <= y0) return null;

  /* Tinta media de cada columna de la casilla. */
  const filas = y1 - y0;
  const columnas = new Float64Array(x1 - x0);
  for (let y = y0; y < y1; y++) {
    const base = y * ancho;
    for (let x = x0; x < x1; x++) {
      if (bin[base + x]) columnas[x - x0]++;
    }
  }
  for (let i = 0; i < columnas.length; i++) columnas[i] /= filas;

  const w = Math.min(ventana, columnas.length);
  if (w < 1) return null;
  let suma = 0;
  for (let i = 0; i < w; i++) suma += columnas[i];
  let mejor = suma / w;
  for (let i = w; i < columnas.length; i++) {
    suma += columnas[i] - columnas[i - w];
    const v = suma / w;
    if (v > mejor) mejor = v;
  }
  return mejor;
}

function tintaEnCampo(bin, ancho, alto, caja, zona) {
  zona = zona || "derecha";
  let fx0 = 0, fx1 = 1, fy0 = 0.15, fy1 = 0.85;
  if (zona === "derecha") { fx0 = 0.45; }
  else if (zona === "arriba") { fy0 = 0.05; fy1 = 0.62; }
  else { fy0 = 0.08; fy1 = 0.92; }

  const x0 = Math.floor((caja.x + caja.ancho * fx0) * ancho);
  const x1 = Math.floor((caja.x + caja.ancho * fx1) * ancho);
  const y0 = Math.floor((caja.y + caja.alto * fy0) * alto);
  const y1 = Math.floor((caja.y + caja.alto * fy1) * alto);
  if (x1 <= x0 || y1 <= y0) return null;

  let tinta = 0, total = 0;
  for (let y = Math.max(0, y0); y < Math.min(alto, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(ancho, x1); x++) {
      if (bin[y * ancho + x]) tinta++;
      total++;
    }
  }
  return total ? tinta / total : null;
}

/* ---------------- detección sobre la imagen ---------------- */

/* Umbral adaptativo por bandas. Las fotos llegan con tinte y sombras;
   un umbral único parte la hoja por la mitad. */
function binarizar(gris, ancho, alto) {
  const bin = new Uint8Array(ancho * alto);
  const BLOQUE = 48;
  for (let by = 0; by < alto; by += BLOQUE) {
    for (let bx = 0; bx < ancho; bx += BLOQUE) {
      const hy = Math.min(by + BLOQUE, alto), hx = Math.min(bx + BLOQUE, ancho);
      let suma = 0, n = 0;
      for (let y = by; y < hy; y++) {
        for (let x = bx; x < hx; x++) { suma += gris[y * ancho + x]; n++; }
      }
      const umbral = suma / n - 12;
      for (let y = by; y < hy; y++) {
        for (let x = bx; x < hx; x++) {
          const i = y * ancho + x;
          if (gris[i] < umbral) bin[i] = 1;
        }
      }
    }
  }
  return bin;
}

/* Racha más larga de tinta en una fila, siguiendo una pendiente.
   Probar varias pendientes cubre la inclinación del papel sin tener
   que rotar la imagen entera.

   `hueco` es cuántos píxeles en blanco seguidos se pueden saltar sin
   dar la racha por terminada. Con hueco 0 (la versión anterior) una
   hoja ESCRITA pierde justo las rayas que importan: la letra cruza la
   raya, parte la racha en dos trozos de ~40% del ancho y ninguno llega
   al 45% que se exige. Medido sobre la hoja 1 de prueba2.pdf, contra
   las 24 rayas de la plantilla:
       hueco  0px → 15/24     hueco  8px → 18/24
       hueco  2px → 18/24     hueco 12px → 22/24
       hueco  4px → 19/24     hueco 16px → 24/24
       hueco  6px → 18/24     hueco 20px → 24/24
   A partir de 16 px se satura: no es que 16 sea mágico, es que ahí ya
   no queda ninguna raya por recuperar. */
function rachaMaxima(bin, ancho, alto, y0, pendiente, hueco) {
  hueco = hueco || 0;
  let mejor = 0, largo = 0, blancos = 0;
  for (let x = 0; x < ancho; x++) {
    const y = Math.round(y0 + pendiente * x);
    const hayTinta = y >= 0 && y < alto && bin[y * ancho + x];
    if (hayTinta) {
      largo++;
      blancos = 0;
    } else {
      blancos++;
      if (blancos > hueco) {
        if (largo > mejor) mejor = largo;
        largo = 0;
        blancos = 0;
      } else {
        largo++;   /* el hueco se cuenta como parte de la raya */
      }
    }
  }
  return largo > mejor ? largo : mejor;
}

function detectarLineas(bin, ancho, alto, pendiente, hueco) {
  const minimo = ancho * 0.45;
  const marcas = new Uint8Array(alto);
  for (let y = 0; y < alto; y++) {
    if (rachaMaxima(bin, ancho, alto, y, pendiente, hueco) >= minimo) marcas[y] = 1;
  }
  const lineas = [];
  let inicio = null;
  for (let y = 0; y <= alto; y++) {
    if (y < alto && marcas[y]) {
      if (inicio === null) inicio = y;
    } else if (inicio !== null) {
      lineas.push((inicio + y - 1) / 2 / alto);
      inicio = null;
    }
  }
  return lineas;
}

/* Ancho de trazo que se salta al buscar una raya, en píxeles del
   lienzo de análisis (800 px de ancho). Ver la tabla de rachaMaxima. */
const HUECO_TRAZO = 16;

/* Prueba unas pocas pendientes y se queda con la que encuentra más
   líneas: es la que tiene el papel derecho.

   Con hueco 0 se comporta EXACTAMENTE igual que en la v9. Ese modo
   sigue siendo el que reparte las hojas en 1/3, 2/3 y 3/3: en el
   paquete de prueba, el modo tolerante infla el puntaje de la hoja 1
   sobre la hoja 2 y le cambia la etiqueta. El modo tolerante se usa
   SOLO después, ya sabiendo qué hoja es cuál, para afinar el ajuste. */
function lineasDeLaHoja(gris, ancho, alto, hueco) {
  const bin = binarizar(gris, ancho, alto);
  let mejor = { lineas: [], pendiente: 0 };
  for (let p = -0.02; p <= 0.0201; p += 0.005) {
    const lineas = detectarLineas(bin, ancho, alto, p, hueco || 0);
    if (lineas.length > mejor.lineas.length) mejor = { lineas: lineas, pendiente: p };
  }
  return mejor;
}

/* ---------------- emparejamiento con la referencia ---------------- */

/* Busca la escala y el desplazamiento que hacen calzar las líneas
   detectadas sobre las de referencia. Se prueban parejas de líneas
   como hipótesis y gana la que deja más coincidencias.
   Tolera que falten líneas (las tenues no siempre se ven) y que
   sobren (a veces un renglón de texto parece línea). */
/* Una rejilla regular calza consigo misma comprimida y corrida: sobre
   los 5 paquetes reales, sin restringir, tres encontraban un calce
   falso con 92% de aciertos. Estos dos límites vienen del papel, no
   del algoritmo: siempre es el mismo formulario A4 escaneado entero,
   así que la escala ronda 1 y el corrimiento es pequeño. */
const ESCALA_MIN = 0.92, ESCALA_MAX = 1.10, DESPLAZAMIENTO_MAX = 0.045;

/* Las filas del formulario están casi igual de separadas, así que un
   calce corrido tres filas puntúa parecido al correcto. Lo que rompe
   el empate son los huecos grandes e irregulares del formato: pesan
   triple, y ahí el calce falso deja de ganar. */
function pesos(referencia) {
  const huecos = [];
  for (let i = 1; i < referencia.length; i++) huecos.push(referencia[i] - referencia[i - 1]);
  const ordenados = huecos.slice().sort(function (a, b) { return a - b; });
  const mediana = ordenados[Math.floor(ordenados.length / 2)];
  return referencia.map(function (_, i) {
    const antes = i > 0 ? huecos[i - 1] : 0;
    const despues = i < huecos.length ? huecos[i] : 0;
    return (antes > mediana * 1.8 || despues > mediana * 1.8) ? 3 : 1;
  });
}

/* Afina (escala, desplazamiento) por mínimos cuadrados sobre las
   parejas que ya calzan, y vuelve a emparejar con el resultado hasta
   que se estabiliza.

   POR QUÉ HACE FALTA. La hipótesis ganadora sale de UNA pareja de
   líneas: cualquier escala dentro de la tolerancia de ±0.006 puntúa
   igual, así que lo que se devuelve no es el mejor ajuste sino el
   primero que empató en puntaje. Medido sobre prueba2.pdf, la hoja 3
   daba escala 1.0292 por filas y 1.0010 por barras: los dos ajustes
   eran buenos, pero se llevaban 0.028 y la condición de "acuerdo"
   exige ≤0.02, así que el recuadro se declaraba aproximado teniendo
   20 de 21 rayas calzadas. Tras afinar, la diferencia baja a 0.0156 en
   la hoja 3 y de 0.0167 a 0.0033 en la hoja 1.

   No introduce ningún umbral nuevo: solo pone cada ajuste en su mejor
   sitio ANTES de compararlos. */
function refinarAjuste(detectadas, referencia, escala, desplazamiento, tolerancia, vueltas) {
  tolerancia = tolerancia || 0.006;
  vueltas = vueltas || 4;
  let usadas = 0, residuo = null;

  for (let v = 0; v < vueltas; v++) {
    const xs = [], ys = [];
    for (const r of referencia) {
      const esperado = escala * r + desplazamiento;
      let cerca = null;
      for (const d of detectadas) {
        if (Math.abs(d - esperado) > tolerancia) continue;
        if (cerca === null || Math.abs(d - esperado) < Math.abs(cerca - esperado)) cerca = d;
      }
      if (cerca !== null) { xs.push(r); ys.push(cerca); }
    }
    if (xs.length < 3) break;

    let sx = 0, sy = 0;
    for (let i = 0; i < xs.length; i++) { sx += xs[i]; sy += ys[i]; }
    const mx = sx / xs.length, my = sy / ys.length;
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) * (xs[i] - mx);
    }
    if (den === 0) break;

    const nuevaEscala = num / den;
    const nuevoDesp = my - nuevaEscala * mx;
    const quieto = Math.abs(nuevaEscala - escala) < 1e-7 &&
                   Math.abs(nuevoDesp - desplazamiento) < 1e-8;
    escala = nuevaEscala;
    desplazamiento = nuevoDesp;

    let peor = 0;
    for (let i = 0; i < xs.length; i++) {
      const d = Math.abs(ys[i] - (escala * xs[i] + desplazamiento));
      if (d > peor) peor = d;
    }
    usadas = xs.length;
    residuo = peor;
    if (quieto) break;
  }
  return { escala: escala, desplazamiento: desplazamiento, usadas: usadas, residuo: residuo };
}

/* Ancla gruesa con las barras. Al no ser periódicas, no hay empate. */
function anclarConBarras(barras, refBarras, tolerancia) {
  tolerancia = tolerancia || 0.012;
  if (!barras || barras.length < 2 || !refBarras || refBarras.length < 2) return null;

  let mejor = null;
  for (let i = 0; i < barras.length - 1; i++) {
    for (let j = i + 1; j < barras.length; j++) {
      const dDet = barras[j] - barras[i];
      if (dDet < 0.05) continue;
      for (let a = 0; a < refBarras.length - 1; a++) {
        for (let b = a + 1; b < refBarras.length; b++) {
          const dRef = refBarras[b] - refBarras[a];
          if (dRef < 0.05) continue;
          const escala = dDet / dRef;
          if (escala < ESCALA_MIN || escala > ESCALA_MAX) continue;
          const desplazamiento = barras[i] - escala * refBarras[a];
          if (Math.abs(desplazamiento) > DESPLAZAMIENTO_MAX) continue;

          let aciertos = 0;
          for (const r of refBarras) {
            const esperado = escala * r + desplazamiento;
            for (const d of barras) {
              if (Math.abs(d - esperado) <= tolerancia) { aciertos++; break; }
            }
          }
          if (!mejor || aciertos > mejor.aciertos) {
            mejor = { aciertos: aciertos, escala: escala, desplazamiento: desplazamiento,
                      total: refBarras.length };
          }
        }
      }
    }
  }
  if (!mejor || mejor.aciertos < Math.min(2, refBarras.length)) return null;
  const fino = refinarAjuste(barras, refBarras, mejor.escala, mejor.desplazamiento, tolerancia);
  if (fino.usadas >= 2) {
    mejor.escala = fino.escala;
    mejor.desplazamiento = fino.desplazamiento;
  }
  mejor.confianza = mejor.aciertos / mejor.total;
  /* Se llevan consigo para que `emparejar` pueda comprobar dónde caen
     las barras con SU propio ajuste, sin volver a detectarlas. */
  mejor.barras = barras;
  mejor.refBarras = refBarras;
  return mejor;
}

function emparejar(detectadas, referencia, tolerancia) {
  tolerancia = tolerancia || 0.006;
  if (detectadas.length < 4 || referencia.length < 4) return null;

  const w = pesos(referencia);
  let mejor = { aciertos: 0, puntaje: -1, escala: 1, desplazamiento: 0, confianza: 0 };
  /* Si hay ancla de barras, solo se consideran hipótesis cercanas a ella. */
  const ancla = arguments.length > 3 ? arguments[3] : null;

  for (let i = 0; i < detectadas.length - 1; i++) {
    for (let j = i + 1; j < detectadas.length; j++) {
      const dDet = detectadas[j] - detectadas[i];
      if (dDet < 0.05) continue;

      for (let a = 0; a < referencia.length - 1; a++) {
        for (let b = a + 1; b < referencia.length; b++) {
          const dRef = referencia[b] - referencia[a];
          if (dRef < 0.05) continue;

          const escala = dDet / dRef;
          if (escala < ESCALA_MIN || escala > ESCALA_MAX) continue;
          const desplazamiento = detectadas[i] - escala * referencia[a];
          if (Math.abs(desplazamiento) > DESPLAZAMIENTO_MAX) continue;
          if (ancla && (Math.abs(escala - ancla.escala) > 0.05 ||
                        Math.abs(desplazamiento - ancla.desplazamiento) > 0.012)) continue;

          let aciertos = 0, peso = 0;
          for (let k = 0; k < referencia.length; k++) {
            const esperado = escala * referencia[k] + desplazamiento;
            for (const d of detectadas) {
              if (Math.abs(d - esperado) <= tolerancia) { aciertos++; peso += w[k]; break; }
            }
          }

          /* Penaliza las líneas detectadas dentro del tramo del
             formulario que no corresponden a ninguna de la referencia:
             es lo que delata un calce comprimido. */
          const desde = escala * referencia[0] + desplazamiento;
          const hasta = escala * referencia[referencia.length - 1] + desplazamiento;
          let sobrantes = 0;
          for (const d of detectadas) {
            if (d < desde - tolerancia || d > hasta + tolerancia) continue;
            let calza = false;
            for (const r of referencia) {
              if (Math.abs(escala * r + desplazamiento - d) <= tolerancia) { calza = true; break; }
            }
            if (!calza) sobrantes++;
          }

          /* Si todas las coincidencias caen en la mitad de abajo, la
             escala queda sin anclaje y el recuadro puede irse una fila
             o dos. Pasó con un escaneo real que traía el encabezado
             recortado. Se mide la cobertura arriba y abajo. */
          const mitad = Math.floor(referencia.length / 2);
          let arriba = 0, abajo = 0;
          for (let k = 0; k < referencia.length; k++) {
            const esperado = escala * referencia[k] + desplazamiento;
            for (const d of detectadas) {
              if (Math.abs(d - esperado) <= tolerancia) {
                if (k < mitad) arriba++; else abajo++;
                break;
              }
            }
          }

          const puntaje = peso - 0.5 * sobrantes;
          if (puntaje > mejor.puntaje) {
            mejor = {
              aciertos: aciertos, sobrantes: sobrantes, puntaje: puntaje,
              arriba: arriba, abajo: abajo,
              escala: escala, desplazamiento: desplazamiento,
              confianza: aciertos / referencia.length,
            };
          }
        }
      }
    }
  }

  if (mejor.puntaje < 0) {
    /* Sin filas utilizables, el ancla de barras alcanza para la franja. */
    if (ancla) return { escala: ancla.escala, desplazamiento: ancla.desplazamiento,
                        confianza: ancla.confianza, aciertos: 0, arriba: 0, abajo: 0,
                        exacto: false, soloBarras: true };
    return null;
  }
  /* Afinar ANTES de comparar con el ancla: si no, se comparan dos
     estimaciones ruidosas y discrepan por el ruido, no por estar en
     sitios distintos. */
  const fino = refinarAjuste(detectadas, referencia, mejor.escala, mejor.desplazamiento, tolerancia);
  if (fino.usadas >= 3) {
    mejor.escala = fino.escala;
    mejor.desplazamiento = fino.desplazamiento;
    mejor.residuo = fino.residuo;
    /* Los aciertos cambian al moverse el ajuste: hay que recontarlos,
       o `confianza` habla de una posición que ya no es la que se usa. */
    let aciertos = 0, arriba = 0, abajo = 0;
    const mitad = Math.floor(referencia.length / 2);
    for (let k = 0; k < referencia.length; k++) {
      const esperado = mejor.escala * referencia[k] + mejor.desplazamiento;
      for (const d of detectadas) {
        if (Math.abs(d - esperado) <= tolerancia) {
          aciertos++;
          if (k < mitad) arriba++; else abajo++;
          break;
        }
      }
    }
    mejor.aciertos = aciertos;
    mejor.arriba = arriba;
    mejor.abajo = abajo;
    mejor.confianza = aciertos / referencia.length;
  }

  /* ¿Se puede confiar en este recuadro?

     ANTES se comparaban dos ESTIMACIONES: la escala salida de las filas
     contra la salida de las barras, exigiendo que no se llevaran más de
     0.02. El problema es que la escala de las barras sale de dos o
     cuatro puntos —la hoja 3 solo tiene DOS barras— y es ruidosa de
     nacimiento. Medido sobre cuatro documentos y sus doce hojas: solo 5
     llegaban a exacto, y la hoja 3 casi nunca, así que el semáforo de
     casillas no aparecía ahí jamás.

     AHORA se comprueba lo que de verdad importa: que el ajuste de filas
     ponga cada barra de sección DONDE ESTÁ. Es una comprobación sobre
     la colocación, no sobre los parámetros. Con las mismas doce hojas,
     pasan las doce.

     LO QUE ESTO NO ATRAPA: en la hoja 1 las barras están separadas casi
     por un número entero de filas, así que un ajuste corrido una fila
     también las coloca bien. Ahí la protección no son las barras sino
     el puntaje ponderado de `pesos`, que da triple valor a las rayas
     pegadas a los huecos grandes. Queda dicho para que nadie dé por
     hecho que las barras cubren ese caso. */
  const separaciones = [];
  for (let i = 1; i < referencia.length; i++) {
    separaciones.push(referencia[i] - referencia[i - 1]);
  }
  separaciones.sort(function (a, b) { return a - b; });
  const paso = (separaciones[Math.floor(separaciones.length / 2)] || 0.012) * mejor.escala;
  mejor.paso = paso;

  const refBarras = (ancla && ancla.refBarras) || [];
  let barrasCalzadas = 0;
  for (const r of refBarras) {
    const esperado = mejor.escala * r + mejor.desplazamiento;
    if ((ancla.barras || []).some(function (b) { return Math.abs(b - esperado) <= 0.012; })) {
      barrasCalzadas++;
    }
  }
  mejor.barrasCalzadas = barrasCalzadas;

  /* MAYORÍA, no unanimidad. Exigir que calcen las 8 barras de la hoja
     1 es pedirle a un detector ruidoso que acierte ocho veces seguidas:
     basta que el escaneo se coma una barra tenue para que la hoja
     entera se quede sin rejilla. Con dos tercios ya no hay forma de
     que el ajuste esté corrido una fila y las barras sigan cayendo
     donde toca, porque un corrimiento las mueve TODAS a la vez.
     Mínimo dos: con una sola no se demuestra nada. */
  const barrasNecesarias = Math.max(2, Math.ceil(refBarras.length * 0.66));
  const acuerdo = refBarras.length > 0 && barrasCalzadas >= barrasNecesarias;
  mejor.barrasNecesarias = barrasNecesarias;
  mejor.acuerdo = acuerdo;
  mejor.exacto = !!(acuerdo &&
                    mejor.confianza >= 0.75 &&
                    mejor.residuo != null && mejor.residuo <= paso * 0.5 &&
                    mejor.arriba >= 2 && mejor.abajo >= 2);
  mejor.confianzaBarras = ancla ? ancla.confianza : 0;
  return mejor;
}

/* Dónde cae un campo en ESTA página, en fracciones de 0 a 1.
   Devuelve además si el recuadro es de fiar o solo aproximado. */
function ubicarCampo(nombre, ajuste) {
  const campo = CAMPOS[nombre];
  if (!campo || !ajuste) return null;
  const ref = REFERENCIA[campo.hoja];
  if (!ref || campo.a >= ref.length) return null;

  let refDesde = ref[campo.de], refHasta = ref[campo.a];
  if (campo.fDesde != null) {
    const tramo = refHasta - refDesde;
    refHasta = refDesde + tramo * campo.fHasta;
    refDesde = refDesde + tramo * campo.fDesde;
  }
  const y0 = ajuste.escala * refDesde + ajuste.desplazamiento;
  const y1 = ajuste.escala * refHasta + ajuste.desplazamiento;
  if (y1 <= y0 || y0 < -0.05 || y1 > 1.05) return null;

  return {
    campo: nombre,
    etiqueta: campo.etiqueta,
    x: campo.x0,
    y: y0,
    ancho: campo.x1 - campo.x0,
    alto: y1 - y0,
    exacto: !!ajuste.exacto,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { REFERENCIA, REFERENCIA_BARRAS, CAMPOS, CASILLAS_OBLIGATORIAS,
    CELDAS, CELDAS_CORREO, LISTA_PRECIOS_ESPERADA, HUECO_TRAZO,
    tintaEnCampo, tintaEnCaja, densidadMaxima, VENTANA_DENSIDAD, binarizar, detectarBarras, refinarAjuste,
    lineasDeLaHoja, anclarConBarras, emparejar, ubicarCampo, ubicarCelda };
}
