"use strict";
/* ================================================================
   Lector del RUT digital (formulario 001 de la DIAN)

   Cuando el cliente entrega el RUT descargado del portal, el PDF
   trae capa de texto: se puede leer sin OCR y sin equivocarse.
   Cuando entrega una foto o un escaneo, no hay nada que leer y
   el verificador lo dice en vez de inventar.

   La plantilla de la DIAN tiene posiciones fijas, así que cada dato
   se busca anclado a su etiqueta impresa ("42. Correo electrónico")
   y no por orden de aparición, que cambia entre archivos.
   ================================================================ */

/* Agrupa los fragmentos de texto en líneas visuales. */
function agruparLineas(items, tolerancia) {
  /* Las casillas de dígitos quedan unas unidades más abajo que el texto
     de la misma fila; con tolerancia baja se parten en dos líneas. */
  tolerancia = tolerancia || 6;
  const limpios = items
    .filter(function (i) { return i.t && i.t.trim(); })
    .map(function (i) { return { t: i.t.trim(), x: i.x, y: i.y }; })
    .sort(function (a, b) { return b.y - a.y || a.x - b.x; });

  const lineas = [];
  let actual = null;
  for (const it of limpios) {
    if (!actual || Math.abs(it.y - actual.y) > tolerancia) {
      actual = { y: it.y, items: [it] };
      lineas.push(actual);
    } else {
      actual.items.push(it);
    }
  }
  lineas.forEach(function (l) { l.items.sort(function (a, b) { return a.x - b.x; }); });
  return lineas;
}

function normaliza(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* Busca la etiqueta impresa y devuelve su posición. */
function buscarEtiqueta(lineas, texto) {
  const objetivo = normaliza(texto);
  for (let li = 0; li < lineas.length; li++) {
    for (const it of lineas[li].items) {
      if (normaliza(it.t).indexOf(objetivo) === 0) {
        return { linea: li, x: it.x, y: it.y };
      }
    }
  }
  return null;
}

/* Reconoce el texto impreso del formulario para no confundirlo con un
   dato del cliente. Sin esto, un RUT sin valores devuelve la etiqueta
   de abajo: uno de los 27 paquetes reales daba «35. Razón social»
   como nombre del cliente. */
const SECCIONES = ["identificacion", "ubicacion", "clasificacion", "exportadores",
  "usuarios aduaneros", "para uso exclusivo", "actividad economica", "ocupacion",
  "responsabilidades", "importante"];

function esEtiqueta(texto) {
  const t = String(texto).trim();
  if (/^\d{1,2}\.\s/.test(t)) return true;              // "31. Primer apellido"
  const n = normaliza(t);
  return SECCIONES.some(function (s) { return n.indexOf(s) === 0; });
}

/* Toma el valor que está en la línea siguiente a una etiqueta,
   dentro de una franja horizontal, saltando las líneas que son
   texto impreso del formulario. */
function valorBajoEtiqueta(lineas, etiqueta, margenIzq, margenDer) {
  const pos = buscarEtiqueta(lineas, etiqueta);
  if (!pos) return null;
  const xMin = pos.x - (margenIzq == null ? 12 : margenIzq);
  const xMax = pos.x + (margenDer == null ? 100 : margenDer);
  for (let li = pos.linea + 1; li < Math.min(pos.linea + 3, lineas.length); li++) {
    const trozos = lineas[li].items
      .filter(function (i) { return i.x >= xMin && i.x <= xMax; })
      .filter(function (i) { return !esEtiqueta(i.t); });
    if (trozos.length) {
      const valor = trozos.map(function (i) { return i.t; }).join(" ").trim();
      if (valor && !esEtiqueta(valor)) return valor;
    }
  }
  return null;
}

/* Los números vienen dígito por dígito en casillas separadas. */
function soloDigitos(s) {
  return s == null ? null : String(s).replace(/\D/g, "") || null;
}

/* ¿Esta página es un RUT digital de la DIAN? */
function esPaginaRut(textoPlano) {
  const t = normaliza(textoPlano || "");
  return t.indexOf("registro unico tributario") >= 0 ||
    (t.indexOf("numero de identificacion tributaria") >= 0 && t.indexOf("dian") >= 0);
}

/* Lee los campos que sirven para cruzar contra el formato. */
function leerRut(items, textoPlano) {
  const lineas = agruparLineas(items);
  if (!lineas.length) return null;

  const nit = soloDigitos(valorBajoEtiqueta(lineas, "5. Número de Identificación Tributaria", 6, 158));
  const dv = soloDigitos(valorBajoEtiqueta(lineas, "6. DV", 6, 28));
  const identificacion = soloDigitos(valorBajoEtiqueta(lineas, "26. Número de Identificación", 4, 240));

  const primerApellido = valorBajoEtiqueta(lineas, "31. Primer apellido", 6, 110);
  const segundoApellido = valorBajoEtiqueta(lineas, "32. Segundo apellido", 6, 110);
  const primerNombre = valorBajoEtiqueta(lineas, "33. Primer nombre", 6, 110);
  const otrosNombres = valorBajoEtiqueta(lineas, "34. Otros nombres", 6, 110);
  const razonSocial = valorBajoEtiqueta(lineas, "35. Razón social", 6, 420);

  const ciiu = soloDigitos(valorBajoEtiqueta(lineas, "46. Código", 8, 40));
  const ciiuSecundaria = soloDigitos(valorBajoEtiqueta(lineas, "48. Código", 8, 40));

  const direccion = valorBajoEtiqueta(lineas, "41. Dirección principal", 6, 460);
  const departamento = valorBajoEtiqueta(lineas, "39. Departamento", 4, 150);
  const ciudad = valorBajoEtiqueta(lineas, "40. Ciudad/Municipio", 4, 150);

  /* El correo es el único texto con arroba en toda la hoja. */
  const correo = (String(textoPlano || "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [null])[0];

  const generado = (String(textoPlano || "")
    .match(/Fecha generaci[oó]n documento PDF:\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i) || [null, null])[1];

  /* Persona natural: nombres y apellidos. Persona jurídica: razón social. */
  const nombreCompleto = [primerNombre, otrosNombres, primerApellido, segundoApellido]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || razonSocial || null;

  /* Si no salieron los datos esenciales, este RUT no se pudo leer.
     Mejor decirlo que devolver algo a medias que parezca válido. */
  const id = identificacion || nit;
  const idValido = id && id.length >= 5 && id.length <= 11;
  const nombreValido = nombreCompleto && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}/.test(nombreCompleto) &&
    nombreCompleto.split(/\s+/).length >= 2;
  if (!idValido || !nombreValido) return null;

  return {
    nit: nit,
    dv: dv,
    identificacion: id,
    nombreCompleto: nombreCompleto,
    razonSocial: razonSocial,
    esJuridica: !!(razonSocial && !primerApellido),
    primerApellido: primerApellido,
    segundoApellido: segundoApellido,
    primerNombre: primerNombre,
    otrosNombres: otrosNombres,
    correo: correo || null,
    direccion: direccion,
    departamento: departamento,
    ciudad: ciudad,
    ciiu: ciiu,
    ciiuSecundaria: ciiuSecundaria,
    generado: generado,
  };
}

/* Compara nombres ignorando tildes, mayúsculas y orden de palabras.
   "Maricela Sanchez Zuñiga" y "SANCHEZ ZUÑIGA MARICELA" son iguales. */
function mismoNombre(a, b) {
  if (!a || !b) return null;
  const partes = function (s) {
    return normaliza(s).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/)
      .filter(function (p) { return p.length > 1; }).sort();
  };
  const pa = partes(a), pb = partes(b);
  if (!pa.length || !pb.length) return null;
  return pa.join(" ") === pb.join(" ");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { agruparLineas, buscarEtiqueta, valorBajoEtiqueta, esPaginaRut, leerRut, mismoNombre, normaliza };
}
