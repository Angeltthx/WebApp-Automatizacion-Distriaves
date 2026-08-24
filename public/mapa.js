"use strict";
/* ================================================================
   Mapa de casillas del FO-901 2025/05 V4

   NO ESTÁ ESCRITO A MANO. Sale de para_usar_pdf.pdf: el formato
   impreso, escaneado y marcado por quien conoce el trámite. Cada marca
   se leyó de la capa de texto del PDF (posición exacta, no estimada) y
   se tradujo al espacio de la plantilla con el ajuste de esa hoja:
       yPlantilla = (yPagina - desplazamiento) / escala

   El convenio de las marcas lo puso el usuario:
       X roja     · la casilla va escrita
       circulito  · grupo de opciones: va marcada UNA
       X negra    · la casilla va en blanco

   clase:
     texto     va escrita
     grupo     varias opciones, una marcada
     vacio     va en blanco
     pendiente marcada, pero no se puede validar todavía (ver abajo)

   x0/x1 son los de la MARCA, no los de la celda entera. Es a propósito:
   la marca está donde va el dato, y una caja que abarca la celda
   completa se come la etiqueta impresa y deja de distinguir lleno de
   vacío. Se comprobó midiendo: con la celda entera, "Cargo" daba 0.3710
   vacío y 0.3739 escrito. Con la caja de la marca, 0.0625 de diferencia.

   PENDIENTES. "Tipo de cliente" trae marcada solo UNA opción de cada
   par (Contado, Vinculación, Persona Natural). No sé dónde está la otra
   y no la invento: si el cliente es a crédito, la marca va en otro
   sitio. Para activarlas hace falta un formato marcado con las DOS
   opciones de cada par en verde.

   "Ciudad" (hoja 1) no llevaba marca en el formato entregado: se
   olvidó. Se añadió a mano en la v15 a petición del usuario, con la
   caja medida entre las rayas verticales de su fila (0.520 y 0.697,
   las mismas que separan Ciudad de Departamento y de Código Postal).
   ================================================================ */

const MAPA = {
  fecha: { hoja: "1/3", clase: "texto", y0: 0.119, y1: 0.1375, x0: 0.7706, x1: 0.8719, etiqueta: "Día/Mes/Año" },
  tipoClienteForma: { hoja: "1/3", clase: "pendiente", y0: 0.1654, y1: 0.1839, x0: 0.2723, x1: 0.2836, etiqueta: "Contado / Crédito" },
  tipoClienteVinculo: { hoja: "1/3", clase: "pendiente", y0: 0.1654, y1: 0.1839, x0: 0.4513, x1: 0.4626, etiqueta: "Vinculación / Actualización" },
  tipoClientePersona: { hoja: "1/3", clase: "pendiente", y0: 0.1844, y1: 0.2029, x0: 0.6482, x1: 0.6595, etiqueta: "Persona Jurídica / Natural" },
  nombreRazonSocial: { hoja: "1/3", clase: "texto", y0: 0.2224, y1: 0.2334, x0: 0.1975, x1: 0.2988, etiqueta: "Nombre o Razón Social" },
  numeroIdentificacion: { hoja: "1/3", clase: "texto", y0: 0.2344, y1: 0.2447, x0: 0.525, x1: 0.6264, etiqueta: "No. De Identificación" },
  tipoDocumento: { hoja: "1/3", clase: "grupo", y0: 0.2364, y1: 0.2442, x0: 0.2068, x1: 0.3854, opciones: [[0.2068,0.2163], [0.2441,0.2535], [0.2723,0.2818], [0.31,0.3195], [0.376,0.3854]], etiqueta: "Tipo de Documento" },
  actividadPrincipal: { hoja: "1/3", clase: "texto", y0: 0.2457, y1: 0.2567, x0: 0.1749, x1: 0.2763, etiqueta: "Actividad Principal" },
  codigoCiiu: { hoja: "1/3", clase: "texto", y0: 0.2457, y1: 0.2567, x0: 0.7706, x1: 0.8719, etiqueta: "Código (CIIU)" },
  telefono: { hoja: "1/3", clase: "texto", y0: 0.2577, y1: 0.2681, x0: 0.1346, x1: 0.2359, etiqueta: "Teléfono" },
  direccionComercial: { hoja: "1/3", clase: "texto", y0: 0.2577, y1: 0.2681, x0: 0.4026, x1: 0.504, etiqueta: "Dirección Comercial" },
  pais: { hoja: "1/3", clase: "texto", y0: 0.2691, y1: 0.2801, x0: 0.1141, x1: 0.2155, etiqueta: "País" },
  departamento: { hoja: "1/3", clase: "texto", y0: 0.2691, y1: 0.2801, x0: 0.321, x1: 0.4224, etiqueta: "Departamento" },
  ciudad: { hoja: "1/3", clase: "texto", y0: 0.2691, y1: 0.2801, x0: 0.52, x1: 0.697, etiqueta: "Ciudad" },
  codigoPostal: { hoja: "1/3", clase: "texto", y0: 0.2691, y1: 0.2801, x0: 0.7723, x1: 0.8736, etiqueta: "Código Postal" },
  correoFacturacion: { hoja: "1/3", clase: "texto", y0: 0.2811, y1: 0.2921, x0: 0.5681, x1: 0.6694, etiqueta: "E-mail Facturación Electrónica" },
  tipoEmpresa: { hoja: "1/3", clase: "grupo", y0: 0.2843, y1: 0.291, x0: 0.2346, x1: 0.3792, opciones: [[0.2346,0.2441], [0.3116,0.321], [0.3697,0.3792]], etiqueta: "Tipo de empresa" },
  contactoNombre: { hoja: "1/3", clase: "texto", y0: 0.3044, y1: 0.3154, x0: 0.1725, x1: 0.2738, etiqueta: "Nombre completo (contacto)" },
  contactoCargo: { hoja: "1/3", clase: "texto", y0: 0.3044, y1: 0.3154, x0: 0.4929, x1: 0.5943, etiqueta: "Cargo (contacto)" },
  contactoCorreo: { hoja: "1/3", clase: "texto", y0: 0.3164, y1: 0.3267, x0: 0.1238, x1: 0.2251, etiqueta: "E-mail (contacto)" },
  contactoTelefono: { hoja: "1/3", clase: "texto", y0: 0.3164, y1: 0.3267, x0: 0.5048, x1: 0.6061, etiqueta: "Teléfono (contacto)" },
  repLegalNombre: { hoja: "1/3", clase: "texto", y0: 0.3397, y1: 0.3507, x0: 0.1749, x1: 0.2763, etiqueta: "Nombre Completo (rep. legal)" },
  repLegalCorreo: { hoja: "1/3", clase: "texto", y0: 0.3397, y1: 0.3507, x0: 0.4953, x1: 0.5966, etiqueta: "E-mail (rep. legal)" },
  repLegalDocumento: { hoja: "1/3", clase: "texto", y0: 0.3517, y1: 0.362, x0: 0.5927, x1: 0.694, etiqueta: "Número de documento de identidad" },
  repLegalTipoDoc: { hoja: "1/3", clase: "grupo", y0: 0.353, y1: 0.3608, x0: 0.2676, x1: 0.4145, opciones: [[0.2676,0.277], [0.3006,0.31], [0.3388,0.3482], [0.405,0.4145]], etiqueta: "Tipo de Documento (rep. legal)" },
  pepEsOhaSido: { hoja: "1/3", clase: "grupo", y0: 0.3652, y1: 0.3718, x0: 0.376, x1: 0.4679, opciones: [[0.376,0.3854], [0.4584,0.4679]], etiqueta: "¿Es o ha sido PEP?" },
  pepRecursos: { hoja: "1/3", clase: "grupo", y0: 0.367, y1: 0.3734, x0: 0.7421, x1: 0.7945, opciones: [[0.7421,0.7515], [0.785,0.7945]], etiqueta: "¿Maneja recursos públicos?" },
  pepCargos: { hoja: "1/3", clase: "grupo", y0: 0.377, y1: 0.3836, x0: 0.31, x1: 0.3728, opciones: [[0.31,0.3195], [0.3633,0.3728]], etiqueta: "¿Ocupa o ha ocupado cargos públicos?" },
  pepExtranjera: { hoja: "1/3", clase: "grupo", y0: 0.3792, y1: 0.3854, x0: 0.7421, x1: 0.7974, opciones: [[0.7421,0.7515], [0.7879,0.7974]], etiqueta: "¿Es PEP Extranjera?" },
  pepVinculo: { hoja: "1/3", clase: "grupo", y0: 0.3895, y1: 0.3961, x0: 0.5156, x1: 0.5785, opciones: [[0.5156,0.525], [0.569,0.5785]], etiqueta: "¿Existe algún vínculo?" },
  avalTipoDocumento: { hoja: "2/3", clase: "vacio", y0: 0.1385, y1: 0.1485, x0: 0.2067, x1: 0.388, etiqueta: "Tipo de Documento (Aval)" },
  avalIdentificacion: { hoja: "2/3", clase: "vacio", y0: 0.1385, y1: 0.1485, x0: 0.5249, x1: 0.5982, etiqueta: "No. De Identificación (Aval)" },
  avalDigito: { hoja: "2/3", clase: "vacio", y0: 0.1385, y1: 0.1485, x0: 0.7993, x1: 0.8726, etiqueta: "Dígito de verificación (Aval)" },
  avalNombres: { hoja: "2/3", clase: "vacio", y0: 0.1495, y1: 0.1595, x0: 0.2457, x1: 0.319, etiqueta: "Nombres y apellidos (Aval)" },
  avalTelefono: { hoja: "2/3", clase: "vacio", y0: 0.1605, y1: 0.1705, x0: 0.1344, x1: 0.2077, etiqueta: "Teléfono (Aval)" },
  avalDireccion: { hoja: "2/3", clase: "vacio", y0: 0.1605, y1: 0.1705, x0: 0.4008, x1: 0.4741, etiqueta: "Dirección Comercial (Aval)" },
  avalPais: { hoja: "2/3", clase: "vacio", y0: 0.1715, y1: 0.1825, x0: 0.1161, x1: 0.1894, etiqueta: "País (Aval)" },
  avalDepartamento: { hoja: "2/3", clase: "vacio", y0: 0.1715, y1: 0.1825, x0: 0.3204, x1: 0.3937, etiqueta: "Departamento (Aval)" },
  avalCiudad: { hoja: "2/3", clase: "vacio", y0: 0.1715, y1: 0.1825, x0: 0.4974, x1: 0.5707, etiqueta: "Ciudad (Aval)" },
  avalCodigoPostal: { hoja: "2/3", clase: "vacio", y0: 0.1716, y1: 0.1825, x0: 0.7778, x1: 0.8511, etiqueta: "Código Postal (Aval)" },
  avalActividad: { hoja: "2/3", clase: "vacio", y0: 0.1835, y1: 0.1935, x0: 0.1718, x1: 0.2451, etiqueta: "Actividad principal (Aval)" },
  avalCiiu: { hoja: "2/3", clase: "vacio", y0: 0.1835, y1: 0.1935, x0: 0.4974, x1: 0.5707, etiqueta: "Código CIIU (Aval)" },
  avalCorreo: { hoja: "2/3", clase: "vacio", y0: 0.1835, y1: 0.1935, x0: 0.6797, x1: 0.753, etiqueta: "E-mail (Aval)" },
  huellaSolicitante: { hoja: "2/3", clase: "texto", y0: 0.6683, y1: 0.748, x0: 0.3254, x1: 0.3747, etiqueta: "Índice derecho del solicitante" },
  huellaAval: { hoja: "2/3", clase: "vacio", y0: 0.6713, y1: 0.754, x0: 0.8026, x1: 0.8538, etiqueta: "Índice derecho del aval" },
  firmaAval: { hoja: "2/3", clase: "vacio", y0: 0.711, y1: 0.7591, x0: 0.5736, x1: 0.6926, etiqueta: "Firma del aval" },
  firmaSolicitante: { hoja: "2/3", clase: "texto", y0: 0.7245, y1: 0.7516, x0: 0.1176, x1: 0.2685, etiqueta: "Firma del solicitante" },
  avalNombresFirma: { hoja: "2/3", clase: "vacio", y0: 0.7589, y1: 0.7967, x0: 0.751, x1: 0.8444, etiqueta: "Nombres y Apellidos (aval, firma)" },
  repLegalNombreFirma: { hoja: "2/3", clase: "texto", y0: 0.7667, y1: 0.7901, x0: 0.2626, x1: 0.3932, etiqueta: "Nombre del Rep. Legal (firma)" },
  avalRazonSocial: { hoja: "2/3", clase: "vacio", y0: 0.7793, y1: 0.817, x0: 0.7537, x1: 0.8471, etiqueta: "Razón Social (aval, firma)" },
  repLegalDocFirma: { hoja: "2/3", clase: "texto", y0: 0.7895, y1: 0.8129, x0: 0.266, x1: 0.3965, etiqueta: "Número de Identificación (firma)" },
  establecimiento: { hoja: "3/3", clase: "texto", y0: 0.2755, y1: 0.2865, x0: 0.309, x1: 0.4021, etiqueta: "Nombre del establecimiento comercial" },
  direccionEntrega: { hoja: "3/3", clase: "texto", y0: 0.2875, y1: 0.2955, x0: 0.1756, x1: 0.2541, etiqueta: "Dirección entrega" },
  barrio: { hoja: "3/3", clase: "texto", y0: 0.2875, y1: 0.2955, x0: 0.5, x1: 0.5785, etiqueta: "Barrio" },
  municipio: { hoja: "3/3", clase: "texto", y0: 0.2875, y1: 0.2955, x0: 0.6969, x1: 0.7754, etiqueta: "Municipio" },
  contactoPedidos: { hoja: "3/3", clase: "texto", y0: 0.2965, y1: 0.3056, x0: 0.2133, x1: 0.2918, etiqueta: "Nombre Contacto Pedidos" },
  telMovil: { hoja: "3/3", clase: "texto", y0: 0.2965, y1: 0.3076, x0: 0.6001, x1: 0.6786, etiqueta: "Tel Móvil" },
  canal: { hoja: "3/3", clase: "texto", y0: 0.3095, y1: 0.3175, x0: 0.1271, x1: 0.2056, etiqueta: "Canal" },
  vendedor: { hoja: "3/3", clase: "texto", y0: 0.3095, y1: 0.3175, x0: 0.2863, x1: 0.3648, etiqueta: "Vendedor" },
  centroSuministrador: { hoja: "3/3", clase: "texto", y0: 0.3095, y1: 0.3175, x0: 0.653, x1: 0.7316, etiqueta: "Centro suministrador" },
  grupoCliente: { hoja: "3/3", clase: "texto", y0: 0.3185, y1: 0.3275, x0: 0.158, x1: 0.2365, etiqueta: "Grupo Cliente" },
  listaPrecios: { hoja: "3/3", clase: "texto", y0: 0.3185, y1: 0.3294, x0: 0.5432, x1: 0.6217, etiqueta: "Lista de precios" },
  zonaTransporte: { hoja: "3/3", clase: "texto", y0: 0.3305, y1: 0.3394, x0: 0.1819, x1: 0.2604, etiqueta: "Zona de Transporte" },
  horaRecibo: { hoja: "3/3", clase: "texto", y0: 0.3305, y1: 0.3413, x0: 0.4411, x1: 0.4878, etiqueta: "Hora de recibo" },
  clienteCercano: { hoja: "3/3", clase: "texto", y0: 0.3305, y1: 0.3413, x0: 0.6307, x1: 0.7092, etiqueta: "Cliente cercano" },
  responsableNombre: { hoja: "3/3", clase: "texto", y0: 0.3487, y1: 0.3748, x0: 0.1875, x1: 0.2831, etiqueta: "Nombre Responsable Comercial" },
  fechaVisita: { hoja: "3/3", clase: "texto", y0: 0.3528, y1: 0.3789, x0: 0.7061, x1: 0.8018, etiqueta: "Fecha de visita" },
  responsableFirma: { hoja: "3/3", clase: "texto", y0: 0.3917, y1: 0.4178, x0: 0.1641, x1: 0.2597, etiqueta: "Firma Responsable Comercial" },
  lugarVisita: { hoja: "3/3", clase: "texto", y0: 0.3982, y1: 0.4243, x0: 0.4836, x1: 0.5792, etiqueta: "Lugar de visita" },
  ciudadVisita: { hoja: "3/3", clase: "texto", y0: 0.4026, y1: 0.4287, x0: 0.7593, x1: 0.8549, etiqueta: "Ciudad / Municipio (visita)" },
  carteraFecha: { hoja: "3/3", clase: "vacio", y0: 0.4648, y1: 0.4798, x0: 0.2148, x1: 0.2881, etiqueta: "Fecha de confirmación" },
  carteraHora: { hoja: "3/3", clase: "vacio", y0: 0.4647, y1: 0.4797, x0: 0.381, x1: 0.4543, etiqueta: "Hora de confirmación" },
  carteraQuienConfirma: { hoja: "3/3", clase: "vacio", y0: 0.4959, y1: 0.5109, x0: 0.2724, x1: 0.3457, etiqueta: "Nombre de quien confirma" },
  carteraResponsable: { hoja: "3/3", clase: "vacio", y0: 0.4983, y1: 0.5133, x0: 0.6545, x1: 0.7278, etiqueta: "Nombre responsable Cartera" },
  carteraObservaciones: { hoja: "3/3", clase: "vacio", y0: 0.5192, y1: 0.5342, x0: 0.225, x1: 0.2983, etiqueta: "Observaciones" },
};

/* Grupos de casillas que se revisan juntas. */
const CLASES_MAPA = { TEXTO: "texto", GRUPO: "grupo", VACIO: "vacio", PENDIENTE: "pendiente" };

function camposDeHoja(hoja, clase) {
  return Object.keys(MAPA).filter(function (k) {
    return MAPA[k].hoja === hoja && (!clase || MAPA[k].clase === clase);
  });
}

/* Caja de un campo sobre ESTA página, en fracciones de 0 a 1. */
function ubicarDelMapa(campo, ajuste) {
  const m = MAPA[campo];
  if (!m || !ajuste) return null;
  const y0 = ajuste.escala * m.y0 + ajuste.desplazamiento;
  const y1 = ajuste.escala * m.y1 + ajuste.desplazamiento;
  if (y1 <= y0) return null;
  return { campo: campo, etiqueta: m.etiqueta, clase: m.clase,
           x: m.x0, ancho: m.x1 - m.x0, y: y0, alto: y1 - y0 };
}

/* Caja de UNA opción dentro de un grupo. */
function ubicarOpcion(campo, i, ajuste) {
  const m = MAPA[campo];
  if (!m || !m.opciones || !m.opciones[i] || !ajuste) return null;
  const y0 = ajuste.escala * m.y0 + ajuste.desplazamiento;
  const y1 = ajuste.escala * m.y1 + ajuste.desplazamiento;
  return { x: m.opciones[i][0], ancho: m.opciones[i][1] - m.opciones[i][0],
           y: y0, alto: y1 - y0 };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MAPA, CLASES_MAPA, camposDeHoja, ubicarDelMapa, ubicarOpcion };
}
