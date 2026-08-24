"use strict";
/* ================================================================
   Reglas de verificación

   Cada regla dice qué revisa, cómo lo revisa y qué significa si falla.
   Agregar una regla nueva es agregar un objeto a esta lista.

   nivel:
     bloqueo  no deberías enviar el paquete así
     aviso    míralo antes de enviar, pero no detiene nada
     manual   la máquina no puede verlo; lo confirmas tú

   estado que devuelve evaluar():
     ok | falla | aviso | pendiente | na
   ================================================================ */

/* ---------- lectura de las casillas medidas ---------- */

/* Hojas donde la ubicación fue lo bastante buena para medir casillas. */
function hojasRevisadas(analisis) {
  return analisis.paginas
    .filter(function (p) { return p.casillas && Object.keys(p.casillas).length; })
    .map(function (p) { return p.hoja; })
    .filter(Boolean);
}

/* true = vacía, false = tiene algo, null = no se pudo medir. */
function casillaVacia(analisis, campo) {
  const piso = CASILLAS_OBLIGATORIAS[campo];
  for (const p of analisis.paginas) {
    if (!p.casillas || !(campo in p.casillas)) continue;
    if (piso == null) return null;
    return p.casillas[campo] < piso;
  }
  return null;
}

/* Todas las casillas obligatorias que llegaron vacías. */
function casillasVacias(analisis) {
  const fuera = [];
  for (const p of analisis.paginas) {
    if (!p.casillas) continue;
    for (const campo of Object.keys(p.casillas)) {
      const piso = CASILLAS_OBLIGATORIAS[campo];
      if (piso == null) continue;
      if (p.casillas[campo] < piso) {
        fuera.push({ campo: campo, pagina: p.n, hoja: p.hoja,
                     etiqueta: CAMPOS[campo] ? CAMPOS[campo].etiqueta : campo });
      }
    }
  }
  return fuera;
}

/* ---------- lectura de la transcripción ---------- */

/* Devuelve las lecturas de esos campos, o null si todavía no se ha
   transcrito nada. La diferencia importa: null es "no lo sé", lista
   vacía es "lo intenté y no había casillas". */
function leidas(analisis, campos) {
  const t = analisis.transcripcion;
  if (!t || t.estado !== "listo" || !t.campos) return null;
  const salida = [];
  for (const campo of campos) {
    const v = t.campos[campo];
    if (!v) continue;
    salida.push({ campo: campo, texto: v.texto || "", vacio: !!v.vacio,
                  seguridad: v.seguridad || "baja" });
  }
  return salida;
}

/* Nombre legible de una celda, para los mensajes. */
function rotulo(campo) {
  if (campo === "letreroLocal") return "Letrero de la foto";
  if (typeof CELDAS !== "undefined" && CELDAS[campo]) return CELDAS[campo].rotulo;
  if (typeof CAMPOS !== "undefined" && CAMPOS[campo]) return CAMPOS[campo].etiqueta;
  return campo;
}

const REGLAS = [

  /* ---------- qué trae el paquete ---------- */
  {
    id: "formato-tres-hojas",
    grupo: "Contenido del paquete",
    nivel: "bloqueo",
    titulo: "Las 3 hojas del formato de conocimiento",
    evaluar: function (c) {
      const n = c.tipos.formato;
      if (n === 3) return { estado: "ok", detalle: "Están las 3 hojas." };
      if (n < 3) return { estado: "falla", detalle: "Solo encontré " + n + ". Faltan " + (3 - n) + "." };
      return { estado: "aviso", detalle: "Encontré " + n + " hojas de formato. Revisa si hay una repetida." };
    },
  },
  {
    id: "rut-incluido",
    grupo: "Contenido del paquete",
    nivel: "bloqueo",
    titulo: "RUT del cliente",
    evaluar: function (c) {
      if (c.tipos.rut > 0) return { estado: "ok", detalle: "RUT descargado del portal: se puede leer entero." };
      if (c.tipos.documento > 0) return { estado: "aviso", detalle: "Hay documentos escaneados pero ninguno es un RUT legible por máquina. Confirma a ojo que el RUT está." };
      return { estado: "falla", detalle: "No encontré el RUT." };
    },
  },
  {
    id: "cedula-incluida",
    grupo: "Contenido del paquete",
    nivel: "bloqueo",
    titulo: "Copia de la cédula",
    evaluar: function (c) {
      if (c.tipos.documento > 0) return { estado: "ok", detalle: c.tipos.documento + " página(s) de documento." };
      return { estado: "falla", detalle: "No encontré la cédula." };
    },
  },
  {
    id: "cedula-dos-caras",
    grupo: "Contenido del paquete",
    nivel: "manual",
    titulo: "La cédula tiene las dos caras",
    ayuda: "Va en una hoja o en dos; con una sola no puedo saber si trae las dos caras.",
    evaluar: function (c) {
      if (c.tipos.documento >= 2) {
        return { estado: "ok", detalle: "Hay " + c.tipos.documento + " páginas de documento: alcanzan para las dos caras." };
      }
      return { estado: "pendiente", detalle: "Solo hay una página de documento. Confirma que trae las dos caras." };
    },
    autoResuelve: true,
  },
  {
    id: "foto-incluida",
    grupo: "Contenido del paquete",
    nivel: "manual",
    titulo: "Foto del establecimiento comercial",
    ayuda: "Marca la página de la fachada en las miniaturas y confirma aquí.",
    evaluar: function (c) {
      if (c.tipos.foto > 0) return { estado: "ok", detalle: "Marcaste " + c.tipos.foto + " foto(s) del local." };
      return { estado: "pendiente", detalle: "Ninguna página está marcada como foto del local." };
    },
  },

  /* ---------- cómo se ven las hojas ---------- */
  {
    id: "sin-paginas-en-blanco",
    grupo: "Estado de las hojas",
    nivel: "bloqueo",
    titulo: "Ninguna página salió en blanco",
    evaluar: function (c) {
      const malas = c.analisis.paginas.filter(function (p) { return p.tinta < UMBRAL.paginaEnBlanco; });
      if (!malas.length) return { estado: "ok", detalle: "Todas las páginas tienen contenido." };
      return {
        estado: "falla",
        detalle: "Página " + malas.map(function (p) { return p.n; }).join(", ") + " sin contenido: se coló una hoja vacía o el escáner falló.",
      };
    },
  },
  {
    id: "escaneo-legible",
    grupo: "Estado de las hojas",
    nivel: "aviso",
    titulo: "El escaneo no está lavado",
    evaluar: function (c) {
      const malas = c.analisis.paginas.filter(function (p) { return p.medioTono > UMBRAL.escaneoLavado; });
      if (!malas.length) return { estado: "ok", detalle: "Contraste suficiente en todas las páginas." };
      return {
        estado: "aviso",
        detalle: "Página " + malas.map(function (p) { return p.n + " (" + Math.round(p.medioTono * 100) + "% gris)"; }).join(", ") +
          ". Se ve deslavada; si el revisor no la lee, la devuelve. Vale la pena repetir la foto con más luz.",
      };
    },
  },
  {
    id: "firma-y-huella",
    grupo: "Estado de las hojas",
    nivel: "aviso",
    campo: "firmaAutorizacion",
    titulo: "Firma y huella en la hoja de autorizaciones",
    evaluar: function (c) {
      const hoja = c.analisis.paginas.find(function (p) { return p.hoja === "2/3"; });
      if (!hoja) return { estado: "na", detalle: "No pude identificar cuál es la hoja de autorizaciones." };
      const v = Math.round(hoja.zonaFirma * 1000) / 10;
      if (hoja.zonaFirma >= UMBRAL.zonaFirmaConTinta) {
        return { estado: "ok", detalle: "Hay trazos en la zona de firma de la página " + hoja.n + " (" + v + "%)." };
      }
      return {
        estado: "aviso",
        detalle: "La zona de firma y huella de la página " + hoja.n + " se ve casi vacía (" + v +
          "%). En paquetes firmados esa zona marca entre 1.4% y 3.8%. Confírmalo a ojo.",
      };
    },
  },
  {
    id: "hojas-identificadas",
    grupo: "Estado de las hojas",
    nivel: "aviso",
    titulo: "Las 3 hojas van en orden 1/3, 2/3, 3/3",
    evaluar: function (c) {
      const hojas = c.analisis.paginas.filter(function (p) { return p.tipo === "formato" && p.hoja; });
      if (hojas.length < 3) return { estado: "na", detalle: "Necesito las 3 hojas para revisar el orden." };
      const orden = hojas.slice().sort(function (a, b) { return a.n - b.n; }).map(function (h) { return h.hoja; });
      if (orden.join(" ") === "1/3 2/3 3/3") return { estado: "ok", detalle: "En orden." };
      return {
        estado: "aviso",
        detalle: "Van en orden " + orden.join(" → ") + ". No es causal de devolución, pero le facilita la vida a quien revisa.",
      };
    },
  },

  /* ---------- cruce contra el RUT ---------- */
  {
    id: "cedula-coincide-rut",
    grupo: "Cruce con el RUT",
    nivel: "bloqueo",
    campo: "numeroIdentificacion",
    titulo: "El número de cédula coincide con el RUT",
    evaluar: function (c) {
      if (!c.analisis.rut) return { estado: "na", detalle: "El RUT viene escaneado: no puedo leerlo. Compáralo a ojo." };
      if (!c.datos.cedula) return { estado: "pendiente", detalle: "Escribe la cédula que pusiste en el formato." };
      const rut = String(c.analisis.rut.identificacion || "").replace(/\D/g, "");
      const mia = String(c.datos.cedula).replace(/\D/g, "");
      if (rut && mia && rut === mia) return { estado: "ok", detalle: "Coincide con el RUT: " + rut + "." };
      return { estado: "falla", detalle: "En el formato escribiste " + mia + " y el RUT dice " + rut + "." };
    },
  },
  {
    id: "nombre-coincide-rut",
    grupo: "Cruce con el RUT",
    nivel: "bloqueo",
    campo: "nombreRazonSocial",
    titulo: "El nombre coincide con el RUT",
    evaluar: function (c) {
      if (!c.analisis.rut) return { estado: "na", detalle: "El RUT viene escaneado: compara el nombre a ojo, letra por letra." };
      if (!c.datos.nombre) return { estado: "pendiente", detalle: "Escribe el nombre tal como quedó en el formato." };
      const igual = mismoNombre(c.datos.nombre, c.analisis.rut.nombreCompleto);
      if (igual) return { estado: "ok", detalle: "Coincide: " + c.analisis.rut.nombreCompleto + "." };
      return {
        estado: "falla",
        detalle: "El RUT dice «" + c.analisis.rut.nombreCompleto + "» y tú escribiste «" + c.datos.nombre + "». Revisa tildes, la ñ y las s/z.",
      };
    },
  },
  {
    id: "ciiu-del-rut",
    grupo: "Cruce con el RUT",
    nivel: "manual",
    campo: "codigoCiiu",
    titulo: "El CIIU es el mismo del RUT",
    ayuda: "La regla no es que el código «tenga sentido» para el negocio: es copiar el del RUT tal cual.",
    evaluar: function (c) {
      const vacia = casillaVacia(c.analisis, "codigoCiiu");
      if (vacia === true) {
        return { estado: "falla", detalle: "La casilla del CIIU está vacía en el formato." };
      }
      if (!c.analisis.rut || !c.analisis.rut.ciiu) {
        return { estado: "pendiente", detalle: "No pude leer el CIIU del RUT. Cópialo de la casilla 46." };
      }
      return { estado: "pendiente", detalle: "El RUT dice CIIU " + c.analisis.rut.ciiu + ". Confirma que ese mismo quedó escrito." };
    },
  },
  {
    id: "correo-confirmado",
    grupo: "Cruce con el RUT",
    nivel: "manual",
    campo: "correoFacturacion",
    titulo: "El correo lo confirmaste con el cliente",
    ayuda: "Es el correo donde llegan las facturas, y puede ser distinto al del RUT a propósito. Por eso se pregunta, no se copia.",
    evaluar: function (c) {
      if (c.analisis.rut && c.analisis.rut.correo) {
        return { estado: "pendiente", detalle: "El RUT dice " + c.analisis.rut.correo + ". Pregúntale al cliente si las facturas llegan ahí." };
      }
      return { estado: "pendiente", detalle: "Pregúntale al cliente a qué correo deben llegar las facturas." };
    },
  },

  /* ---------- lo que solo se ve a ojo ---------- */
  {
    id: "campos-completos",
    grupo: "Revisión a ojo",
    nivel: "manual",
    titulo: "Ninguna casilla obligatoria quedó vacía",
    ayuda: "Ojo con la hoja 3/3: lugar de visita, ciudad y hora de recibo se olvidan seguido.",
    evaluar: function (c) {
      const revisadas = hojasRevisadas(c.analisis);
      if (!revisadas.length) {
        return { estado: "pendiente", detalle: "No pude ubicar las casillas con precisión, así que esta la revisas tú." };
      }
      const vacias = casillasVacias(c.analisis);
      if (vacias.length) {
        return { estado: "falla", detalle: "Revisé las hojas " + revisadas.join(", ") + " y encontré " + vacias.length + " casilla(s) sin llenar." };
      }
      return { estado: "ok", detalle: "Revisé las casillas de las hojas " + revisadas.join(", ") + " y están todas escritas." };
    },
    autoResuelve: true,
  },

  /* ---------- lo que se lee de las casillas ----------

     Estas cuatro se apoyan en la transcripción. Todas devuelven "na"
     mientras no se haya transcrito: no hay veredicto sin lectura, y
     un "todo bien" sobre algo que no se leyó es peor que callarse.
     Cuando acusan, enseñan el texto leído, porque la lectura puede
     estar mal y quien decide es quien mira. */
  {
    id: "correos-iguales",
    grupo: "Casillas transcritas",
    nivel: "bloqueo",
    campo: "correoFacturacion",
    titulo: "El mismo correo en los tres sitios",
    ayuda: "En la hoja 1 el correo va tres veces: facturación electrónica, contacto y representante legal. Los tres tienen que decir lo mismo.",
    evaluar: function (c) {
      const t = leidas(c.analisis, CELDAS_CORREO);
      if (!t) return { estado: "na", detalle: "Todavía no he transcrito las casillas." };
      if (t.length < CELDAS_CORREO.length) {
        return { estado: "na", detalle: "Solo pude recortar " + t.length + " de los 3 correos." };
      }
      const r = compararCorreos(t);
      if (r.vacios.length) {
        return { estado: "falla", detalle: "Hay " + r.vacios.length + " casilla(s) de correo en blanco: " +
          r.vacios.map(function (v) { return rotulo(v.campo); }).join(", ") + "." };
      }
      if (r.iguales) {
        return { estado: "ok", detalle: "Los tres dicen «" + r.valores[0].texto + "»." };
      }
      return {
        estado: "falla",
        detalle: "Los tres no coinciden. Leí: " +
          r.valores.map(function (v) { return rotulo(v.campo) + " → «" + v.texto + "»"; }).join("; ") +
          ". Míralos en el documento antes de corregir: la lectura también puede fallar.",
      };
    },
  },
  {
    id: "lista-precios",
    grupo: "Casillas transcritas",
    nivel: "bloqueo",
    campo: "listaPrecios",
    titulo: "Lista de precios dice " + LISTA_PRECIOS_ESPERADA,
    ayuda: "Va en la hoja 3, a la derecha de Grupo Cliente.",
    evaluar: function (c) {
      const t = leidas(c.analisis, ["listaPrecios"]);
      if (!t) return { estado: "na", detalle: "Todavía no he transcrito las casillas." };
      if (!t.length) return { estado: "na", detalle: "No pude ubicar la casilla en la hoja 3." };
      const v = t[0];
      if (v.vacio) return { estado: "falla", detalle: "La casilla está en blanco. Va " + LISTA_PRECIOS_ESPERADA + "." };
      if (esListaPreciosCorrecta(v.texto)) {
        return { estado: "ok", detalle: "Dice " + LISTA_PRECIOS_ESPERADA + "." };
      }
      return { estado: "falla", detalle: "Leí «" + v.texto + "» y va " + LISTA_PRECIOS_ESPERADA + "." };
    },
  },
  {
    id: "negocio-igual-letrero",
    grupo: "Casillas transcritas",
    nivel: "bloqueo",
    campo: "establecimiento",
    titulo: "El nombre del negocio coincide con el letrero de la foto",
    ayuda: "Quien revisa compara el nombre del formato con el letrero de la foto del local. Si en la foto no se lee ningún nombre, no pasa nada.",
    evaluar: function (c) {
      const t = leidas(c.analisis, ["establecimiento", "letreroLocal"]);
      if (!t) return { estado: "na", detalle: "Todavía no he transcrito las casillas." };
      const formato = t.find(function (x) { return x.campo === "establecimiento"; });
      const letrero = t.find(function (x) { return x.campo === "letreroLocal"; });
      if (!formato) return { estado: "na", detalle: "No pude ubicar el nombre del establecimiento en la hoja 3." };
      if (formato.vacio) return { estado: "falla", detalle: "El nombre del establecimiento está en blanco en la hoja 3." };
      if (!letrero) return { estado: "na", detalle: "No hay ninguna página marcada como foto del local." };

      const r = nombreEnLetrero(formato.texto, letrero.texto);
      if (r.estado === "sinDatos" && r.motivo === "letrero") {
        return { estado: "na", detalle: "En la foto no se lee ningún nombre de negocio. No es motivo de devolución." };
      }
      if (r.estado === "sinDatos") {
        return { estado: "na", detalle: "El nombre del formato no tiene ninguna palabra propia con la que comparar." };
      }
      if (r.estado === "coincide") {
        return { estado: "ok", detalle: "«" + formato.texto + "» aparece en el letrero (" + r.encontradas.join(", ") + ")." };
      }
      return {
        estado: "falla",
        detalle: "El formato dice «" + formato.texto + "» y en el letrero leí «" + letrero.texto +
          "». No comparten ninguna palabra. Revisa que la foto sea la de este negocio.",
      };
    },
  },
  {
    id: "casillas-transcritas-llenas",
    grupo: "Casillas transcritas",
    nivel: "bloqueo",
    titulo: "Ninguna de las casillas leídas quedó en blanco",
    ayuda: "El código postal es el que más se olvida.",
    evaluar: function (c) {
      const t = leidas(c.analisis, Object.keys(CELDAS));
      if (!t) return { estado: "na", detalle: "Todavía no he transcrito las casillas." };
      if (!t.length) return { estado: "na", detalle: "No pude recortar ninguna casilla." };
      const vacias = t.filter(function (x) { return x.vacio; });
      if (!vacias.length) {
        return { estado: "ok", detalle: "Las " + t.length + " casillas que leí están escritas." };
      }
      return {
        estado: "falla",
        detalle: "En blanco: " + vacias.map(function (v) { return rotulo(v.campo); }).join(", ") + ".",
      };
    },
  },

  {
    id: "mapa-obligatorias",
    grupo: "Casillas del formato",
    nivel: "bloqueo",
    titulo: "Las casillas obligatorias están escritas",
    ayuda: "El mapa sale del formato marcado: X roja va escrita, círculo verde va una opción marcada, X negra va en blanco.",
    evaluar: function (c) {
      const m = c.analisis.casillas;
      if (!m || !m.campos) return { estado: "na", detalle: "No pude ubicar ninguna hoja con precisión de casilla." };
      const faltan = [], dudan = [];
      for (const k of Object.keys(m.campos)) {
        const x = m.campos[k];
        if (x.clase !== "texto" && x.clase !== "grupo") continue;
        const color = colorEfectivo(x);
        if (color === "rojo") faltan.push(x.etiqueta);
        else if (color === "amarillo") dudan.push(x.etiqueta);
      }
      if (faltan.length) {
        return { estado: "falla", detalle: "En blanco: " + faltan.join(", ") + "." +
          (dudan.length ? " Y " + dudan.length + " más que no pude leer con seguridad." : "") };
      }
      if (dudan.length) {
        return { estado: "revisar", detalle: "No pude leer con seguridad: " + dudan.join(", ") + "." };
      }
      const cuantas = Object.keys(m.campos).filter(function (k) {
        return m.campos[k].clase === "texto" || m.campos[k].clase === "grupo";
      }).length;
      return { estado: "ok", detalle: "Las " + cuantas + " casillas obligatorias que reviso están escritas." };
    },
  },
  {
    id: "mapa-deben-ir-vacias",
    grupo: "Casillas del formato",
    nivel: "aviso",
    titulo: "Lo que va en blanco está en blanco",
    ayuda: "El bloque del Aval (hoja 2) y el de Confirmación de Cartera (hoja 3) no los llena el comercial.",
    evaluar: function (c) {
      const m = c.analisis.casillas;
      if (!m || !m.campos) return { estado: "na", detalle: "No pude ubicar las casillas." };
      const deBlanco = Object.keys(m.campos).filter(function (k) {
        return m.campos[k].clase === "vacio";
      });
      /* La tinta no opina sobre estas: solo la transcripción. Si no se
         ha leído ninguna, no hay veredicto que dar. */
      const leidas = deBlanco.filter(function (k) { return m.campos[k].fuente === "lectura"; });
      const escritas = deBlanco
        .filter(function (k) { return colorEfectivo(m.campos[k]) === "rojo"; })
        .map(function (k) { return m.campos[k].etiqueta; });
      if (!escritas.length && !leidas.length) {
        return { estado: "na", detalle: "Estas casillas solo las puedo revisar leyéndolas." };
      }
      if (!escritas.length) return { estado: "ok", detalle: "Los bloques del Aval y de Cartera están en blanco." };
      return { estado: "revisar", detalle: "Tienen algo escrito y no deberían: " + escritas.join(", ") + "." };
    },
  },

];

/* Ejecuta todas las reglas y arma el veredicto. */
function evaluarReglas(analisis, datos, marcadas) {
  const contexto = {
    analisis: analisis,
    tipos: contarTipos(analisis),
    datos: datos || {},
  };

  const resultados = REGLAS.map(function (r) {
    let salida = r.evaluar ? r.evaluar(contexto) : { estado: "pendiente", detalle: null };
    if (r.nivel === "manual") {
      const confirmada = marcadas && marcadas[r.id];
      /* Si la regla pudo comprobarse sola, no se te vuelve a preguntar. */
      const yaResuelta = r.autoResuelve && salida.estado === "ok";
      salida = {
        estado: (confirmada || yaResuelta) ? "ok"
          : (salida.estado === "ok" ? "pendiente" : salida.estado),
        detalle: salida.detalle,
      };
    }
    return Object.assign({}, r, salida, { evaluar: undefined, campo: r.campo || null });
  });

  const bloqueos = resultados.filter(function (r) { return r.estado === "falla"; });
  const pendientes = resultados.filter(function (r) { return r.estado === "pendiente"; });
  const avisos = resultados.filter(function (r) { return r.estado === "aviso"; });

  return {
    resultados: resultados,
    bloqueos: bloqueos.length,
    pendientes: pendientes.length,
    avisos: avisos.length,
    listo: bloqueos.length === 0 && pendientes.length === 0,
  };
}
