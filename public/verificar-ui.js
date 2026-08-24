"use strict";
/* ================================================================
   Verificador · visor de hojas con marcas encima

   Ves el paquete completo y los problemas señalados sobre el papel.
   Cada marca se puede apagar: si el recuadro está mal o el dato sí
   era correcto, lo pasas a verde. Las rojas piden un motivo, y de
   esos motivos sale la lista de reglas que hay que arreglar.
   ================================================================ */

const ENLACE_FORMULARIO = "distriaves_url_formulario";

/* Las constantes van arriba del todo a propósito. `const` no se iza:
   si algo revienta antes de esta línea, quedan sin inicializar y la
   primera función que las use falla con «cannot access before
   initialization», que es un error confuso y muy lejos de la causa.
   Pasó: una llamada a render() antes de tiempo dejaba SVGNS muerta y
   el visor no dibujaba ni una hoja. */
const SVGNS = "http://www.w3.org/2000/svg";
const ALTO_ETQ = 22;    // px, alto fijo del rótulo; el apilado lo necesita
const HUECO_ETQ = 3;    // px entre rótulos apilados

/* Zoom. Los recuadros van en % del papel, así que al agrandar la hoja
   se agrandan con ella y siguen señalando lo mismo: se puede acercar
   para leer la letra sin que la marca se mueva de sitio.
   El lienzo se vuelve a dibujar con pdf.js en vez de estirarse, o la
   letra se vería más grande pero igual de borrosa, que es justo lo
   que no sirve. */
const ZOOMS = [1, 1.3, 1.6, 2, 2.5, 3];
const ANCHO_LIENZO_MAX = 2200;   // tope de píxeles reales, para no comerse la memoria

if (typeof module !== "undefined" && module.exports) {
  module.exports = { apilarEtiquetas: apilarEtiquetas,
                     nombreDeArchivoFormato: nombreDeArchivoFormato };  // para las pruebas
}

const MOTIVOS_DESCARTE = [
  "El dato sí está correcto",
  "El recuadro señala el lugar equivocado",
  "Lo confirmé con el cliente",
  "El RUT está desactualizado",
];

let ver = null;
let observadorTamano = null;
/* Sin pintar: este archivo se carga ANTES que app.js, que es quien
   define render(). Llamarlo aquí lanzaba un ReferenceError en cada
   carga de la página. No se notaba porque lo único que quedaba abajo
   eran declaraciones de función, que sí se izan. app.js hace el primer
   pintado al final de su propia carga. */
reiniciarVerificador(false);

function reiniciarVerificador(pintar) {
  if (observadorTamano) { observadorTamano.disconnect(); observadorTamano = null; }
  ver = {
    analisis: null, cargando: false, progreso: null, error: null,
    marcas: {},            // id de revisión -> { estado, motivo }
    datos: { nombre: "", cedula: "", negocio: "" },
    enviado: null, montado: false, formularioAbierto: false,
    transcribiendo: false, errorOcr: null, progresoOcr: null,
    verCasillas: true,     // rejilla de colores sobre la hoja
    hojas: null,           // n de página -> nodos del visor
    diag: false,           // capa de diagnóstico del ajuste
    zoom: 1,               // 1 = la hoja entra en la columna
    anchoCompleto: false,  // esconde el panel y da la pantalla a la hoja
    anchoBase: 0,          // px de la hoja a zoom 1
  };
  if (pintar !== false) render();
}

/* Soltar el paquete actual y volver a la pantalla de inicio, sin
   recargar la página. El input hay que vaciarlo o volver a elegir el
   MISMO archivo no dispara el evento change y parece que se colgó. */
function descartarPaquete() {
  const entrada = document.getElementById("inputPdf");
  if (entrada) entrada.value = "";
  ver.archivoOriginal = null;
  reiniciarVerificador();
}

/* ---------------- carga ---------------- */
async function recibirArchivo(archivo) {
  if (!archivo) return;
  if (!/\.pdf$/i.test(archivo.name)) {
    ver.error = "El paquete tiene que ser un PDF.";
    return render();
  }
  ver.cargando = true; ver.error = null; ver.analisis = null;
  ver.enviado = null; ver.montado = false;
  ver.progreso = { hecho: 0, total: 0 };
  render();

  try {
    ver.analisis = await analizarPdf(archivo, function (n, total) {
      ver.progreso = { hecho: n, total: total };
      const z = document.getElementById("progresoVer");
      if (z) z.textContent = "Revisando página " + n + " de " + total + "…";
    });
    const r = ver.analisis.rut;
    if (r) {
      if (r.nombreCompleto) ver.datos.nombre = r.nombreCompleto;
      if (r.identificacion) ver.datos.cedula = r.identificacion;
    }
  } catch (e) {
    ver.error = "No pude leer el PDF: " + (e && e.message ? e.message : e);
  }
  ver.cargando = false;
  render();
}

/* ---------------- hallazgos ubicables ---------------- */
/* Convierte las revisiones en marcas sobre una hoja concreta. */
function hallazgos() {
  if (!ver.analisis) return [];
  const v = evaluarReglas(ver.analisis, ver.datos, marcasConfirmadas());

  /* Una marca roja propia por cada casilla que llegó vacía, encima de
     la casilla misma. Solo se generan en hojas donde la ubicación es
     de fiar: con recuadro aproximado estaríamos midiendo otra cosa. */
  const vacias = casillasVacias(ver.analisis).map(function (x) {
    const id = "vacia:" + x.campo;
    const marca = ver.marcas[id] || { estado: "abierto" };
    const p = ver.analisis.paginas.find(function (pg) { return pg.n === x.pagina; });
    return {
      id: id,
      titulo: "Casilla vacía: " + x.etiqueta,
      detalle: "En los 24 paquetes que ya te aprobaron esta casilla siempre venía escrita.",
      nivel: marca.estado === "resuelto" ? "verde" : "rojo",
      bloquea: true, campo: x.campo, pagina: x.pagina,
      caja: p && p.ajuste ? ubicarCampo(x.campo, p.ajuste) : null,
      motivo: marca.motivo || null,
    };
  });

  const deReglas = v.resultados.filter(function (r) {
    /* Las que tú diste por buenas siguen en la lista, en verde. Antes se
       caían del filtro al resolverse y la marca se quedaba naranja. */
    if (ver.marcas[r.id]) return true;
    return r.estado === "falla" || r.estado === "aviso" || (r.nivel === "manual" && r.estado === "pendiente");
  }).map(function (r) {
    const marca = ver.marcas[r.id] || { estado: "abierto" };
    const nivel = marca.estado === "resuelto" ? "verde"
      : r.estado === "falla" ? "rojo" : "amarillo";

    let caja = null, pagina = null;
    if (r.campo && CAMPOS[r.campo]) {
      const hoja = CAMPOS[r.campo].hoja;
      const p = ver.analisis.paginas.find(function (x) { return x.hoja === hoja; });
      if (p) {
        pagina = p.n;
        caja = p.ajuste ? ubicarCampo(r.campo, p.ajuste) : null;
      }
    }
    return {
      id: r.id, titulo: r.titulo, detalle: r.detalle, nivel: nivel,
      bloquea: r.nivel === "bloqueo" || r.nivel === "manual",
      campo: r.campo, caja: caja, pagina: pagina, motivo: marca.motivo || null,
    };
  });

  const todos = vacias.concat(deReglas);

  /* Numeración en orden de lectura para las que caen sobre el papel.
     Ese número es el mismo en el margen de la hoja y en el panel: sin
     él, «el tercer recuadro» no señala nada y la etiqueta tiene que
     repetir el nombre completo del campo encima del documento. */
  todos
    .filter(function (h) { return h.caja && h.pagina; })
    .sort(function (a, b) { return (a.pagina - b.pagina) || (a.caja.y - b.caja.y); })
    .forEach(function (h, i) { h.n = i + 1; });

  return todos;
}

function marcasConfirmadas() {
  const m = {};
  Object.keys(ver.marcas).forEach(function (id) {
    if (ver.marcas[id].estado === "resuelto") m[id] = true;
  });
  return m;
}

function resolver(id, motivo) {
  ver.marcas[id] = { estado: "resuelto", motivo: motivo || null };
  cerrarModal();
  actualizarVisor();
}
function reabrir(id) {
  delete ver.marcas[id];
  actualizarVisor();
}

/* Refresca el panel y las marcas sin volver a rasterizar las hojas:
   repintar los lienzos en cada clic las hacía desaparecer y tardaba
   varios segundos. Las marcas sí se rehacen enteras, que es solo DOM
   y es instantáneo. */
function actualizarVisor() {
  const hs = hallazgos();
  const rojos = hs.filter(function (h) { return h.nivel === "rojo"; }).length;
  const amarillos = hs.filter(function (h) { return h.nivel === "amarillo"; }).length;

  const panel = document.querySelector(".visor-panel");
  if (panel) panel.innerHTML = htmlPanel(hs, rojos, amarillos);

  pintarMarcas(hs);
}

function pedirMotivo(id) {
  const h = hallazgos().find(function (x) { return x.id === id; });
  if (!h) return;
  if (h.nivel === "amarillo") return resolver(id, null);

  document.getElementById("zonaModal").innerHTML =
    '<div class="scrim" onclick="cerrarModal()"></div>' +
    '<div class="dialogo" role="dialog" aria-modal="true">' +
    '<h3>' + esc(h.titulo) + '</h3>' +
    '<p>Vas a dar por buena una marca roja. ¿Por qué?</p>' +
    '<div class="motivos">' +
    MOTIVOS_DESCARTE.map(function (m) {
      return '<button class="motivo-btn" onclick="resolver(\'' + id + '\', ' + JSON.stringify(m).replace(/"/g, "&quot;") + ')">' + esc(m) + '</button>';
    }).join("") +
    '</div>' +
    '<div class="fila-btn"><button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button></div>' +
    '</div>';
}

/* ---------------- envío ---------------- */
function urlFormulario() {
  try { return localStorage.getItem(ENLACE_FORMULARIO) || ""; } catch (e) { return ""; }
}
function guardarUrlFormulario(u) {
  try { localStorage.setItem(ENLACE_FORMULARIO, u); } catch (e) { /* da igual */ }
}

async function confirmarEnvio() {
  const nombre = (ver.datos.nombre || "").trim();
  if (!nombre) { toast("alert", "Falta el nombre del cliente."); return; }

  const descartes = Object.keys(ver.marcas)
    .filter(function (id) { return ver.marcas[id].motivo; })
    .map(function (id) { return { regla: id, motivo: ver.marcas[id].motivo }; });

  /* La pestaña del formulario se abre AQUÍ, todavía dentro del clic.
     Si se abriera después del await, el navegador la bloquea por venir
     fuera de un gesto de la persona. Se abre vacía y se le pone la
     dirección cuando el registro sale bien. Registrar y no enviar es
     el olvido más caro que hay: queda contando días un trámite que
     nunca salió. */
  const url = urlFormulario();
  const pestana = url ? window.open("", "_blank") : null;

  try {
    const cliente = await api("/clientes/envio", {
      method: "POST",
      body: JSON.stringify({ nombre: nombre, tipo: ver.datos.negocio, descartes: descartes }),
    });
    ver.enviado = cliente;
    if (pestana) { pestana.location = url; ver.formularioAbierto = true; }
    await refrescar();
    toast("check", cliente.intentos > 1
      ? "Reenvío #" + cliente.intentos + " registrado" : "Envío registrado: " + cliente.nombre);
    actualizarVisor();
  } catch (e) {
    if (pestana) pestana.close();
    toast("alert", e.message);
  }
}

function abrirFormulario() {
  const url = urlFormulario();
  if (!url) { toast("alert", "Todavía no has guardado el enlace del formulario."); return; }
  window.open(url, "_blank");
}

/* ---------------- descargar el paquete (v30) ----------------

   CÓMO SE LLAMA EL ARCHIVO. "FO-901 <cliente>.pdf", el mismo patrón
   que usa la pestaña Diligenciar, para que los dos sitios dejen los
   archivos con el mismo nombre y una carpeta de paquetes se pueda
   ordenar alfabéticamente y tenga sentido.

   Esta función vive AQUÍ y no en diligenciar-ui.js aunque las dos
   pantallas la usen, y el motivo es el orden de carga: en index.html
   verificar-ui.js va antes que diligenciar-ui.js, así que puesta al
   revés no existiría todavía. Es el error #2 del registro, que costó
   tres rondas.

   Se limpian los caracteres que Windows no admite en un nombre de
   archivo (\ / : * ? " < > |) y se dejan las tildes y la ñ, que sí
   valen y son la mitad de los nombres colombianos. Si al quitar lo
   que sobra no queda nada —un nombre escrito solo con signos, o el
   campo vacío— se usa "sin nombre" en vez de devolver ".pdf" a
   secas, que en algunos navegadores descarga un archivo sin nombre.

   DOS DETALLES QUE SALIERON PROBÁNDOLO:

   · Los puntos y espacios del final se quitan. "Comercializadora
     S.A.S." daba "FO-901 Comercializadora S.A.S..pdf", con dos puntos
     seguidos; y Windows además borra por su cuenta los puntos y
     espacios finales de un nombre, así que lo que se pidió y lo que
     queda en el disco no coincidían.

   · El nombre se recorta a 120 caracteres. NTFS admite 255 por
     componente de la ruta, así que 120 más el prefijo y la extensión
     deja sitio de sobra para los "(1)", "(2)" que añade el navegador
     cuando ya existe el archivo. Un campo de razón social no debería
     llegar ahí, pero es un campo de texto libre y nada impide pegarle
     un párrafo. */
function nombreDeArchivoFormato(nombre) {
  const limpio = String(nombre == null ? "" : nombre)
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    /* Otra vez al final: recortar pudo dejar un espacio o un punto
       colgando que antes estaba en mitad del nombre. */
    .replace(/[.\s]+$/, "");
  return "FO-901 " + (limpio || "sin nombre") + ".pdf";
}

/* Descarga el PDF tal y como se subió.
   OJO CON LO QUE ESTO ES Y LO QUE NO: el archivo NO lleva encima
   nada de lo que encontró la revisión —ni los recuadros, ni las
   correcciones, ni las casillas confirmadas—. Es el mismo PDF que se
   soltó, con el nombre puesto. Todo el análisis vive en la pantalla y
   no toca el documento, que es justo lo que permite que el paquete
   que se manda sea idéntico al que revisó quien lo revisó. */
function descargarPaquete() {
  const archivo = ver.archivoOriginal ||
    (document.getElementById("inputPdf") || {}).files &&
    document.getElementById("inputPdf").files[0];
  if (!archivo) {
    toast("alert", "Vuelve a seleccionar el PDF: ya no lo tengo en memoria.");
    return;
  }
  const quien = (ver.enviado && ver.enviado.nombre) || ver.datos.nombre;
  descargarBytes(archivo, nombreDeArchivoFormato(quien));
}

/* Compartir el PDF sin que pase por ningún servidor. */
async function compartirPdf() {
  const archivo = document.getElementById("inputPdf").files[0] || ver.archivoOriginal;
  if (!archivo) { toast("alert", "Vuelve a seleccionar el PDF para compartirlo."); return; }
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: ver.datos.nombre || "Paquete" });
    } catch (e) { /* el usuario canceló */ }
  } else {
    toast("alert", "Este navegador no puede compartir archivos. Prueba desde el celular.");
  }
}

async function enviarATelegram() {
  const archivo = ver.archivoOriginal;
  if (!archivo) { toast("alert", "No tengo el archivo a mano."); return; }
  toast("file", "Enviando copia…");
  try {
    const base64 = await new Promise(function (ok, mal) {
      const lector = new FileReader();
      lector.onload = function () { ok(String(lector.result).split(",")[1]); };
      lector.onerror = function () { mal(new Error("No pude leer el archivo.")); };
      lector.readAsDataURL(archivo);
    });
    await api("/notificar", {
      method: "POST",
      body: JSON.stringify({
        pdf: base64, archivo: archivo.name,
        cliente: ver.datos.nombre || "", intento: ver.enviado ? ver.enviado.intentos : 1,
      }),
    });
    toast("check", "Copia guardada en Telegram.");
  } catch (e) {
    toast("alert", e.message);
  }
}

/* ---------------- transcripción de casillas ---------------- */

/* No se lanza sola al abrir el paquete: cuesta una llamada a la API
   por paquete y hay revisiones que se resuelven sin ella (falta una
   hoja, el escaneo salió lavado). Se pide cuando el resto ya está. */
async function transcribirCasillas() {
  if (!ver.analisis || ver.transcribiendo) return;
  ver.transcribiendo = true;
  ver.errorOcr = null;
  ver.progresoOcr = { hecho: 0, total: 0 };
  render();
  try {
    await transcribirPaquete(ver.analisis, function (hecho, total) {
      ver.progresoOcr = { hecho: hecho, total: total };
      const n = document.getElementById("progresoOcr");
      if (n) n.textContent = "Recortando casilla " + hecho + " de " + total + "…";
    });
  } catch (e) {
    ver.errorOcr = e && e.message ? e.message : String(e);
  }
  ver.transcribiendo = false;
  render();
}

function htmlMapaCasillas() {
  const m = ver.analisis && ver.analisis.casillas;
  if (!m || !m.campos) {
    return '<div class="panel"><div class="panel-head"><h2>Casillas del formato</h2></div>' +
      '<p class="s">No pude ubicar ninguna hoja con precisión de casilla, así que no hay ' +
      'rejilla que pintar.</p></div>';
  }
  /* Qué hojas consiguieron rejilla y cuáles no. Sin esto, cuando una
     hoja se queda sin recuadros no hay forma de saber si fue porque no
     calzó o porque algo se rompió al dibujar. */
  const conRejilla = {}, sinRejilla = [], aproximadas = [];
  ver.analisis.paginas.forEach(function (p) {
    if (p.tipo !== "formato" || !p.hoja) return;
    if (p.tintaMapa && Object.keys(p.tintaMapa).length) {
      conRejilla[p.hoja] = true;
      if (p.rejillaFiable === false || p.rejillaForzada) aproximadas.push(p.hoja);
    } else {
      sinRejilla.push(p.hoja);
    }
  });

  const cuenta = { verde: 0, amarillo: 0, rojo: 0, gris: 0 };
  let revisadas = 0;
  Object.keys(m.campos).forEach(function (k) {
    cuenta[colorEfectivo(m.campos[k])]++;
    if (m.campos[k].revision) revisadas++;
  });
  const dudas = camposADespejar(ver.analisis).length;
  const total = Object.keys(m.campos).length;

  return '<div class="panel"><div class="panel-head"><h2>Casillas del formato</h2>' +
    '<button class="hint hint-btn" onclick="alternarCasillas()">' +
    (ver.verCasillas ? "ocultar" : "mostrar") + '</button></div>' +
    '<div class="cas-resumen">' +
    '<span class="cas-chip verde">' + cuenta.verde + ' escritas</span>' +
    '<span class="cas-chip amarillo">' + cuenta.amarillo + ' dudosas</span>' +
    '<span class="cas-chip rojo">' + cuenta.rojo + ' sin nada</span>' +
    (cuenta.gris ? '<span class="cas-chip gris">' + cuenta.gris + ' sin revisar</span>' : "") +
    '</div>' +
    (sinRejilla.length
      ? '<p class="ayuda"><b>Sin recuadros:</b> hoja ' + sinRejilla.join(", hoja ") +
        '. No calzaron con la plantilla con la seguridad suficiente. Puedo pintarlas ' +
        'igual, pero los recuadros pueden salir corridos de fila.</p>' +
        '<button class="btn btn-ghost btn-ancho" onclick="forzarRejillas()">' +
        'Pintarlas igual y revisar a ojo</button>'
      : "") +
    (aproximadas.length
      ? '<p class="ayuda">En la hoja ' + aproximadas.join(", hoja ") +
        ' los recuadros van punteados: el ajuste es bueno pero las barras de sección ' +
        'no lo respaldan del todo, así que mira si cada uno cae en su fila.</p>'
      : "") +
    '<p class="ayuda">Toca una casilla sobre la hoja para darla por buena (&#10003;) o ' +
    'marcarla como mala (&#10005;). Vas ' + revisadas + ' de ' + total + '.' +
    (revisadas ? ' <button class="hint-btn" onclick="limpiarRevision()">quitar mis marcas</button>' : "") +
    '</p>' +
    (ver.transcribiendo
      ? '<p class="s" id="progresoOcr">Leyendo las casillas dudosas…</p>'
      : dudas
        ? '<p class="ayuda">La tinta no distingue bien un trazo corto de una casilla vacía. ' +
          'Puedo leer las ' + dudas + ' dudosas y decidir con lo que dicen.</p>' +
          '<button class="btn btn-ghost btn-ancho" onclick="despejarDudas()">Leer las ' + dudas + ' casillas dudosas</button>'
        : '<p class="ayuda">Ninguna casilla quedó en duda.</p>') +
    '</div>';
}

function htmlTranscripcion() {
  const t = ver.analisis && ver.analisis.transcripcion;

  if (ver.transcribiendo) {
    return '<div class="panel"><div class="panel-head"><h2>Casillas</h2></div>' +
      '<p class="s" id="progresoOcr">Preparando los recortes…</p></div>';
  }

  const hojasExactas = ver.analisis.paginas.filter(function (p) {
    return p.celdas && p.celdas.length;
  }).length;

  let cuerpo;
  if (!t) {
    cuerpo = hojasExactas
      ? '<p class="s">Puedo leer las casillas del formato y cruzar los tres correos, ' +
        'la lista de precios y el nombre del negocio con el letrero de la foto.</p>' +
        '<button class="btn btn-ghost btn-ancho" onclick="transcribirCasillas()">Leer las casillas</button>'
      : '<p class="s">No pude ubicar ninguna hoja con precisión de casilla, así que ' +
        'no hay nada que recortar. Corrige el reparto 1/3 · 2/3 · 3/3 si está mal, ' +
        'o revisa estas casillas a ojo.</p>';
  } else if (t.estado === "sinCeldas") {
    cuerpo = '<p class="s">No había ninguna casilla que recortar.</p>';
  } else {
    const filas = Object.keys(t.campos).map(function (campo) {
      const v = t.campos[campo];
      return '<div class="ocr-fila">' +
        '<span class="ocr-campo">' + esc(rotulo(campo)) + '</span>' +
        '<span class="ocr-texto' + (v.vacio ? " vacio" : "") + '">' +
        esc(v.vacio ? "(en blanco)" : v.texto) + '</span>' +
        (v.seguridad !== "alta" ? '<span class="ocr-duda">lectura ' + esc(v.seguridad) + '</span>' : "") +
        '</div>';
    }).join("");
    cuerpo = '<div class="ocr-lista">' + filas + '</div>' +
      '<p class="ayuda">Esto es lo que leí, no lo que dice el papel. ' +
      'Si una marca te sorprende, mira la casilla en el documento antes de corregir nada.</p>' +
      '<button class="btn btn-ghost btn-ancho" onclick="transcribirCasillas()">Leer otra vez</button>';
  }

  return '<div class="panel"><div class="panel-head"><h2>Casillas</h2>' +
    (t && t.modelo ? '<span class="hint">' + esc(t.modelo) + '</span>' : "") + '</div>' +
    (ver.errorOcr ? '<div class="form-error">' + svg("alert", 14) + " " + esc(ver.errorOcr) + '</div>' : "") +
    cuerpo + '</div>';
}

/* ---------------- pintado ---------------- */
function htmlVerificar() {
  if (ver.cargando) {
    return '<div class="panel zona-soltar cargando">' +
      '<div class="spinner"></div>' +
      '<p class="t">Revisando el paquete</p>' +
      '<p class="s" id="progresoVer">Abriendo el archivo…</p></div>';
  }

  if (!ver.analisis) {
    return '<div class="panel zona-soltar" id="zonaSoltar">' +
      '<div class="ico-grande">' + svg("upload", 26) + '</div>' +
      '<p class="t">Suelta aquí el PDF del paquete</p>' +
      '<p class="s">Formato de conocimiento, cédula, RUT y foto del local, todo en un archivo.</p>' +
      '<button class="btn btn-primary" onclick="document.getElementById(\'inputPdf\').click()">Buscar el archivo</button>' +
      (ver.error ? '<div class="form-error">' + svg("alert", 14) + " " + esc(ver.error) + '</div>' : "") +
      '</div>';
  }

  const hs = hallazgos();
  const rojos = hs.filter(function (h) { return h.nivel === "rojo"; }).length;
  const amarillos = hs.filter(function (h) { return h.nivel === "amarillo"; }).length;

  return '<div class="visor' + (ver.anchoCompleto ? " ancho" : "") + '">' +
    '<div class="visor-hojas" id="visorHojas"></div>' +
    (ver.anchoCompleto ? "" :
      '<aside class="visor-panel">' + htmlPanel(hs, rojos, amarillos) + '</aside>') +
    '</div>';
}

function htmlPanel(hs, rojos, amarillos) {
  if (ver.enviado) {
    return '<div class="panel">' +
      '<div class="veredicto ok">' + svg("checkCircle", 18) +
      '<div><div class="v-tit">Envío registrado</div>' +
      '<div class="v-sub">' + esc(ver.enviado.nombre) + ", intento " + ver.enviado.intentos +
      ". Te aviso si en " + resumen.umbralAviso + " días no hay respuesta." +
      (ver.formularioAbierto
        ? " El formulario quedó abierto en otra pestaña: suelta ahí el PDF."
        : " Falta soltar el PDF en el formulario.") + "</div></div></div>" +
      '<div class="acciones-envio">' +
      (urlFormulario()
        ? '<button class="btn btn-primary" onclick="abrirFormulario()">' + svg("upload", 14) +
          ' Abrir el formulario' + (ver.formularioAbierto ? " otra vez" : "") + '</button>'
        : "") +
      '<button class="btn btn-ghost" onclick="descargarPaquete()">' + svg("download", 14) + ' Descargar el PDF</button>' +
      '<button class="btn btn-ghost" onclick="compartirPdf()">' + svg("upload", 14) + ' Compartir el PDF</button>' +
      '<button class="btn btn-ghost" onclick="enviarATelegram()">' + svg("file", 14) + ' Guardar copia en Telegram</button>' +
      '<button class="btn btn-primary" onclick="reiniciarVerificador()">Revisar otro paquete</button>' +
      '</div></div>';
  }

  const listo = rojos === 0 && amarillos === 0;
  const transcripcion = htmlMapaCasillas() + htmlTranscripcion();
  const campos = '<div class="panel"><div class="panel-head"><h2>Cliente</h2></div>' +
    '<div class="campos-fila">' +
    '<div class="campo"><label>Nombre</label><input type="text" value="' + esc(ver.datos.nombre) +
    '" oninput="ver.datos.nombre=this.value" placeholder="Como quedó en el formato"></div>' +
    '<div class="campo"><label>Cédula</label><input type="text" class="num" value="' + esc(ver.datos.cedula) +
    '" oninput="ver.datos.cedula=this.value;actualizarVisor()" placeholder="Solo números"></div>' +
    '<div class="campo"><label>Negocio</label><input type="text" value="' + esc(ver.datos.negocio) +
    '" oninput="ver.datos.negocio=this.value" placeholder="Restaurante, tienda…"></div>' +
    '</div></div>';

  const lista = hs.length
    ? hs.map(function (h) {
      return '<div class="hallazgo ' + h.nivel + '" data-id="' + esc(h.id) + '"' +
        ' onmouseenter="destacar(\'' + h.id + '\', true)" onmouseleave="destacar(\'' + h.id + '\', false)"' +
        ' onclick="irAHallazgo(\'' + h.id + '\')">' +
        (h.n
          ? '<span class="h-n ' + h.nivel + ' num">' + h.n + '</span>'
          : '<span class="punto ' + h.nivel + '"></span>') +
        '<div class="h-txt"><div class="h-tit">' + esc(h.titulo) + '</div>' +
        (h.detalle ? '<div class="h-det">' + esc(h.detalle) + '</div>' : "") +
        (h.motivo ? '<div class="h-motivo">' + esc(h.motivo) + '</div>' : "") +
        (h.caja && !h.caja.exacto ? '<div class="h-aprox">ubicación aproximada: se ubicó la fila, no la casilla</div>' : "") +
        '</div>' +
        (h.nivel === "verde"
          ? '<button class="mini-x" title="Volver a marcar" onclick="event.stopPropagation();reabrir(\'' + h.id + '\')">' + svg("x", 12) + '</button>'
          : '<button class="mini-ok" title="Dar por bueno" onclick="event.stopPropagation();pedirMotivo(\'' + h.id + '\')">' + svg("check", 12) + '</button>') +
        '</div>';
    }).join("")
    : '<div class="panel-vacio"><div class="ico">' + svg("checkCircle", 20) + '</div>' +
      '<p class="t">Sin marcas</p><p class="s">El paquete está listo para enviar.</p></div>';

  const url = urlFormulario();
  const accion = listo
    ? '<div class="veredicto ok">' + svg("checkCircle", 18) +
      '<div><div class="v-tit">Listo para enviar</div>' +
      '<div class="v-sub">Al confirmar queda registrado y se abre el formulario en otra pestaña.</div>' +
      '<div class="campo-url"><label>Enlace del formulario de Microsoft</label>' +
      '<input type="url" placeholder="https://forms.office.com/…" value="' + esc(url) + '" oninput="guardarUrlFormulario(this.value)">' +
      '<p class="ayuda"><b>Esto no envía nada.</b> Abre el formulario en otra pestaña ' +
      'para que sueltes el PDF tú, como siempre; esta ventana se queda donde está. ' +
      'Microsoft no permite enviarlo por fuera. Lo que sí queda registrado aquí es la fecha.</p></div>' +
      '</div></div>' +
      '<button class="btn btn-primary btn-ancho" onclick="confirmarEnvio()">Confirmar y registrar</button>'
    : '<div class="veredicto ' + (rojos ? "falla" : "pendiente") + '">' + svg(rojos ? "alert" : "clock", 18) +
      '<div><div class="v-tit">' + (rojos ? rojos + " en rojo" : amarillos + " por confirmar") + '</div>' +
      '<div class="v-sub">' + (rojos
        ? "Corrige el paquete, o marca en verde lo que esté bien."
        : "Revisa cada marca y pásala a verde cuando la hayas visto.") + '</div></div></div>';

  /* La descarga va disponible SIEMPRE, no solo al final: se revisa un
     paquete muchas veces antes de mandarlo —para guardarlo, para
     reenviarlo corregido, para archivarlo— y obligar a confirmar el
     envío para poder bajarlo convierte un botón en un trámite. */
  return campos +
    transcripcion +
    '<div class="panel"><div class="panel-head"><h2>Marcas</h2>' +
    '<span class="hint">' + hs.length + '</span></div>' + lista + '</div>' +
    accion +
    '<button class="btn btn-ghost btn-ancho" onclick="descargarPaquete()">' +
    svg("download", 13) + ' Descargar el paquete</button>' +
    '<button class="btn btn-ghost btn-ancho" onclick="descartarPaquete()">' +
    svg("x", 13) + ' Descartar y revisar otro</button>';
}

function irAHallazgo(id) {
  const h = hallazgos().find(function (x) { return x.id === id; });
  if (!h || !h.pagina) return;
  const el = document.getElementById("hoja-" + h.pagina);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  destacar(id, true);
  setTimeout(function () { destacar(id, false); }, 1600);
}

/* Enciende a la vez el recuadro, su etiqueta y la línea que los une.
   Son tres elementos separados justamente para que ninguno tape el
   papel; el resalte es lo que los vuelve a leer como uno solo. */
function destacar(id, encender) {
  ["marca-" + id, "rotulo-" + id, "guia-" + id].forEach(function (idEl) {
    const el = document.getElementById(idEl);
    if (el) el.classList.toggle("activa", !!encender);
  });
}

/* ================================================================
   Marcas sobre el papel

   Regla de oro: sobre el documento solo va el contorno. El nombre del
   campo, el número y el botón viven en un margen a la derecha, unidos
   al recuadro por una línea. Antes la etiqueta iba pegada al borde
   superior del recuadro y en un formato con renglones de 14 px tapaba
   justo el dato que señalaba.

   Y cuando el ajuste no es exacto, el recuadro NO finge una casilla:
   se dibuja la franja de la fila de lado a lado. Un recuadro angosto
   sobre la columna equivocada se lee como «el error está aquí»; una
   franja se lee como «el error está en esta fila», que es lo único
   que de verdad se sabe.
   ================================================================ */

function pintarMarcas(hs) {
  if (!ver.hojas) return;
  hs = hs || hallazgos();

  Object.keys(ver.hojas).forEach(function (clave) {
    const dom = ver.hojas[clave];

    dom.papel.querySelectorAll(".marca-campo").forEach(function (e) { e.remove(); });
    dom.margen.textContent = "";
    while (dom.guias.firstChild) dom.guias.removeChild(dom.guias.firstChild);

    dom.marcas = hs
      .filter(function (h) { return String(h.pagina) === String(clave) && h.caja; })
      .sort(function (a, b) { return a.caja.y - b.caja.y; })
      .map(function (h) { return crearMarca(dom, h); });

    recolocar(dom);
  });
  pintarCasillas();
}

/* Rejilla de colores: un recuadro por casilla del mapa, encima de la
   hoja. No sustituye a las marcas de hallazgo: es la foto de conjunto
   de qué campos están escritos. Se apaga con el mismo interruptor con
   el que se enciende, porque tapa la letra si se deja puesta. */
function pintarCasillas() {
  if (!ver.hojas || !ver.analisis || !ver.analisis.casillas) return;
  const campos = ver.analisis.casillas.campos;

  Object.keys(ver.hojas).forEach(function (clave) {
    const dom = ver.hojas[clave];
    dom.papel.querySelectorAll(".casilla-color").forEach(function (e) { e.remove(); });
    if (!ver.verCasillas) return;

    const p = dom.pagina;
    if (!p.ajuste) return;
    Object.keys(campos).forEach(function (k) {
      const c = campos[k];
      if (c.pagina !== p.n) return;
      /* Las casillas que van en blanco solo se dibujan si tienen algo
         escrito. Son 22 de 75 y están todas en zonas que nadie llena
         (el Aval y la confirmación de Cartera): pintarlas de verde
         llenaba media hoja 2 de recuadros que no dicen nada, y encima
         "verde" ahí significa lo contrario que en el resto. */
      if (c.clase === "vacio" && colorEfectivo(c) !== "rojo") return;
      const caja = ubicarDelMapa(k, p.ajuste);
      if (!caja) return;
      const color = colorEfectivo(c);
      const d = document.createElement("button");
      d.type = "button";
      d.className = "casilla-color " + color +
        (c.fuente === "lectura" ? " leida" : "") +
        (p.rejillaForzada || p.rejillaFiable === false ? " forzada" : "") +
        (c.revision ? " revisada rev-" + c.revision : "");
      d.style.left = (caja.x * 100) + "%";
      d.style.width = (caja.ancho * 100) + "%";
      d.style.top = (caja.y * 100) + "%";
      d.style.height = (caja.alto * 100) + "%";
      d.title = c.etiqueta + " · " +
        (color === "verde" ? "está escrita" :
         color === "amarillo" ? "no estoy seguro" :
         color === "gris" ? "todavía no la reviso" : "no detecto nada") +
        (c.texto ? " · leí «" + c.texto + "»" : "") +
        (c.fuente === "lectura" ? " (transcrita)" : "") +
        (c.revision === "ok" ? " · la diste por buena"
          : c.revision === "mal" ? " · la marcaste como mala"
          : " · pulsa para darla por buena");
      /* El chulito se ve SIEMPRE, apagado mientras no se toque: si
         solo aparece al confirmar, nada invita a tocarlo y las
         casillas naranjas se quedan naranjas para siempre.

         Va FUERA del recuadro, pegado a su borde derecho. Dentro no
         cabe: una fila del formato mide unos once píxeles de alto en
         pantalla y el chulito quedaba recortado o encima de la letra.
         Por eso en la v21 solo se veía en las casillas altas del
         bloque de la visita y en ninguna de las filas normales. */
      const tic = document.createElement("span");
      tic.className = "cas-tic" + (c.revision ? "" : " apagado");
      tic.textContent = c.revision === "mal" ? "\u2715" : "\u2713";
      d.appendChild(tic);
      d.onclick = function (ev) { ev.stopPropagation(); revisarCasilla(k); };
      dom.papel.appendChild(d);
    });
  });
}

/* Un toque en la casilla: bien → mal → sin revisar. Lo que diga quien
   revisa manda sobre lo que midió el programa, y las reglas se rehacen
   con esa corrección. */
function revisarCasilla(campo) {
  const m = ver.analisis && ver.analisis.casillas;
  if (!m || !m.campos[campo]) return;
  m.campos[campo].revision = siguienteRevision(m.campos[campo].revision);
  pintarCasillas();
  render();
}

/* Pinta la rejilla en las hojas que no llegaron a exacto. Es una
   salida de emergencia: más vale que quien revisa vea los recuadros y
   juzgue, aunque puedan estar corridos, a que la hoja se quede muda.
   Se marcan como forzadas para que la interfaz lo advierta y para que
   nadie confunda esto con una medición fiable. */
async function forzarRejillas() {
  if (!ver.analisis) return;
  let alguna = false;
  for (const p of ver.analisis.paginas) {
    if (p.tipo !== "formato" || !p.hoja || !p.ajuste) continue;
    if (p.tintaMapa && Object.keys(p.tintaMapa).length) continue;
    if (medirCasillasDe(p)) { p.rejillaForzada = true; alguna = true; }
  }
  if (!alguna) return;
  ver.analisis.casillas = evaluarCasillas(ver.analisis.paginas);
  pintarCasillas();
  render();
}

function limpiarRevision() {
  const m = ver.analisis && ver.analisis.casillas;
  if (!m) return;
  Object.keys(m.campos).forEach(function (k) { m.campos[k].revision = null; });
  pintarCasillas();
  render();
}

function alternarCasillas() {
  ver.verCasillas = !ver.verCasillas;
  pintarCasillas();
  render();
}

async function despejarDudas() {
  if (!ver.analisis || ver.transcribiendo) return;
  ver.transcribiendo = true;
  ver.errorOcr = null;
  render();
  try {
    await resolverDudas(ver.analisis, function (hecho, total) {
      const n = document.getElementById("progresoOcr");
      if (n) n.textContent = "Recortando casilla " + hecho + " de " + total + "…";
    });
  } catch (e) {
    ver.errorOcr = e && e.message ? e.message : String(e);
  }
  ver.transcribiendo = false;
  render();
}

function crearMarca(dom, h) {
  const franja = !h.caja.exacto;
  /* Si la rejilla de casillas está encendida y esta marca apunta a una
     casilla que la rejilla ya dibuja, el recuadro se pinta más flojo y
     por fuera. Antes se pintaban los dos iguales y encima uno del
     otro: parecían dos comprobaciones distintas sobre la misma
     casilla, y como la marca queda arriba, se comía el clic con el que
     se confirma la casilla. */
  const duplicaCasilla = ver.verCasillas && !franja && h.campo &&
    ver.analisis && ver.analisis.casillas &&
    ver.analisis.casillas.campos[h.campo];

  const recuadro = document.createElement("div");
  recuadro.className = "marca-campo " + h.nivel + (franja ? " franja" : "") +
    (duplicaCasilla ? " sobre-casilla" : "");
  recuadro.id = "marca-" + h.id;
  recuadro.style.top = (h.caja.y * 100) + "%";
  recuadro.style.height = (h.caja.alto * 100) + "%";
  if (franja) {
    recuadro.style.left = "0";
    recuadro.style.width = "100%";
  } else {
    recuadro.style.left = (h.caja.x * 100) + "%";
    recuadro.style.width = (h.caja.ancho * 100) + "%";
  }
  dom.papel.appendChild(recuadro);

  const guia = document.createElementNS(SVGNS, "path");
  guia.setAttribute("class", "guia " + h.nivel);
  guia.id = "guia-" + h.id;
  dom.guias.appendChild(guia);

  const etq = document.createElement("div");
  etq.className = "rotulo " + h.nivel + (franja ? " franja" : "");
  etq.id = "rotulo-" + h.id;
  etq.title = h.titulo + (h.detalle ? " — " + h.detalle : "");
  etq.innerHTML =
    '<span class="rotulo-n num">' + (h.n || "·") + '</span>' +
    '<span class="rotulo-t">' + esc(h.caja.etiqueta) + (franja ? " · fila" : "") + '</span>' +
    '<button class="rotulo-btn ' + (h.nivel === "verde" ? "x" : "ok") + '" title="' +
      (h.nivel === "verde" ? "Volver a marcar" : "Dar por bueno") + '">' +
      svg(h.nivel === "verde" ? "x" : "check", 10) + '</button>';

  etq.addEventListener("mouseenter", function () { destacar(h.id, true); });
  etq.addEventListener("mouseleave", function () { destacar(h.id, false); });
  etq.addEventListener("click", function () { irAHallazgoPanel(h.id); });
  etq.querySelector(".rotulo-btn").addEventListener("click", function (e) {
    e.stopPropagation();
    const actual = ver.marcas[h.id];
    if (actual && actual.estado === "resuelto") reabrir(h.id); else pedirMotivo(h.id);
  });
  dom.margen.appendChild(etq);

  return { h: h, franja: franja, caja: h.caja, recuadro: recuadro, etq: etq, guia: guia };
}

/* Resalta la fila del panel lateral al tocar la etiqueta de la hoja. */
function irAHallazgoPanel(id) {
  const fila = document.querySelector('.hallazgo[data-id="' + id + '"]');
  if (!fila) return;
  fila.scrollIntoView({ behavior: "smooth", block: "nearest" });
  fila.classList.add("resaltada");
  setTimeout(function () { fila.classList.remove("resaltada"); }, 1400);
}

/* Reparte las etiquetas por el margen sin que se solapen y lo más
   cerca posible de la fila que señalan.

   Empujar hacia abajo lo que se pisa —lo primero que probé— deja el
   grupo entero corrido: en el bloque de datos de la hoja 1 son nueve
   renglones en 120 px y las etiquetas ocupan 225 px, así que la última
   terminaba 80 px por debajo de su fila y la línea guía cruzaba media
   hoja. Aquí los que se pisan se juntan en un bloque y el bloque se
   centra sobre el promedio de las filas que representa: el desvío se
   reparte hacia arriba y hacia abajo, y baja a la mitad.

   Recibe los centros en px, ya ordenados de arriba a abajo. */
function apilarEtiquetas(centros, altoPapel, altoEtq, hueco) {
  altoEtq = altoEtq || ALTO_ETQ;
  hueco = hueco == null ? HUECO_ETQ : hueco;
  const paso = altoEtq + hueco;
  const n = centros.length;
  if (!n) return [];

  /* No caben ni apretadas: se reparten parejo y se acepta el roce. */
  if (n * paso > altoPapel) {
    const sobra = Math.max(0, altoPapel - altoEtq);
    return centros.map(function (_, i) { return (sobra * i) / Math.max(1, n - 1); });
  }

  /* Cada etiqueta empieza siendo su propio bloque. Si un bloque se
     mete dentro del anterior, se fusionan y el resultado se recentra.
     `suma` acumula la posición ideal del tope del bloque. */
  const bloques = [];
  for (let i = 0; i < n; i++) {
    bloques.push({ n: 1, suma: centros[i] - altoEtq / 2 });
    while (bloques.length > 1) {
      const actual = bloques[bloques.length - 1];
      const previo = bloques[bloques.length - 2];
      if (actual.suma / actual.n >= previo.suma / previo.n + previo.n * paso) break;
      previo.suma += actual.suma - previo.n * actual.n * paso;
      previo.n += actual.n;
      bloques.pop();
    }
  }

  const tapas = [];
  bloques.forEach(function (b) {
    const tope = b.suma / b.n;
    for (let k = 0; k < b.n; k++) tapas.push(tope + k * paso);
  });

  /* Que ningún bloque se salga por arriba ni por abajo. */
  const corrimiento = Math.min(0, tapas[0]) + Math.max(0, tapas[n - 1] + altoEtq - altoPapel);
  if (corrimiento) for (let i = 0; i < n; i++) tapas[i] -= corrimiento;
  for (let i = 0; i < n; i++) {
    if (tapas[i] < 0) tapas[i] = 0;
    if (i > 0 && tapas[i] < tapas[i - 1] + paso) tapas[i] = tapas[i - 1] + paso;
  }
  return tapas;
}

/* Coloca las etiquetas en el margen y traza las líneas.
   Va en píxeles porque el apilado sin solapes necesita la altura real
   de la etiqueta; por eso se rehace cuando cambia el ancho. */
function recolocar(dom) {
  const anchoPapel = dom.papel.clientWidth;
  const altoPapel = dom.papel.clientHeight;
  const anchoTotal = dom.envoltura.clientWidth;
  const anchoVisible = dom.scroll ? dom.scroll.clientWidth : anchoPapel;
  if (!anchoPapel || !altoPapel) return;

  dom.guias.setAttribute("viewBox", "0 0 " + anchoTotal + " " + altoPapel);
  dom.guias.setAttribute("preserveAspectRatio", "none");

  dibujarDiagnostico(dom, anchoVisible, altoPapel);

  const centros = (dom.marcas || []).map(function (mk) {
    return (mk.caja.y + mk.caja.alto / 2) * altoPapel;
  });
  const tapas = apilarEtiquetas(centros, altoPapel);

  (dom.marcas || []).forEach(function (mk, i) {
    const centro = centros[i];
    const arriba = tapas[i];
    mk.etq.style.top = arriba + "px";

    /* De la orilla derecha del recuadro a la etiqueta. Cuando el
       recuadro no es exacto arranca del borde del papel, porque su
       orilla derecha no significa nada. */
    /* Con la hoja acercada, la orilla derecha del recuadro puede quedar
       fuera de lo que se ve: la línea arranca del borde visible. */
    const visible = dom.scroll ? dom.scroll.clientWidth : anchoPapel;
    const corrido = dom.scroll ? dom.scroll.scrollLeft : 0;
    const orilla = mk.franja ? anchoPapel : (mk.caja.x + mk.caja.ancho) * anchoPapel;
    const desdeX = Math.max(0, Math.min(visible, orilla - corrido));
    const hastaY = arriba + ALTO_ETQ / 2;

    mk.guia.setAttribute("d",
      "M" + desdeX.toFixed(1) + "," + centro.toFixed(1) +
      " H" + (anchoVisible + 7) +
      " L" + (anchoVisible + 17) + "," + hastaY.toFixed(1) +
      " H" + (anchoVisible + 23));
  });
}

/* ---------------- diagnóstico ----------------
   Sin esto, cada devolución del supervisor es una anécdota: se ve que
   el recuadro quedó mal pero no por qué. Encendido, la hoja muestra
   las líneas que el detector encontró (azul), dónde caen las de la
   plantilla con la escala y el corrimiento que eligió (violeta) y las
   barras de sección que sirvieron de ancla (naranja). Si las violetas
   están corridas una fila respecto de las azules, el problema es el
   emparejamiento; si las azules faltan, es el escaneo. */
function alternarDiagnostico() {
  ver.diag = !ver.diag;
  Object.keys(ver.hojas || {}).forEach(function (k) { recolocar(ver.hojas[k]); });
  Object.keys(ver.hojas || {}).forEach(function (k) { pintarCabecera(ver.hojas[k]); });
}

function dibujarDiagnostico(dom, ancho, alto) {
  const p = dom.pagina;
  /* Se limpia siempre: recolocar() también corre al cambiar el ancho
     de la ventana, y sin esto las rayas se iban acumulando. */
  dom.guias.querySelectorAll("line").forEach(function (e) { e.remove(); });
  if (!ver.diag || !p) return;

  function raya(y, clase, x1) {
    const l = document.createElementNS(SVGNS, "line");
    l.setAttribute("class", clase);
    l.setAttribute("x1", 0);
    l.setAttribute("x2", x1 == null ? ancho : x1);
    l.setAttribute("y1", (y * alto).toFixed(1));
    l.setAttribute("y2", (y * alto).toFixed(1));
    dom.guias.appendChild(l);
  }

  (p.barras || []).forEach(function (y) { raya(y, "diag-barra"); });
  (p.lineas || []).forEach(function (y) { raya(y, "diag-linea"); });

  if (p.ajuste && p.hoja && REFERENCIA[p.hoja]) {
    REFERENCIA[p.hoja].forEach(function (r) {
      raya(p.ajuste.escala * r + p.ajuste.desplazamiento, "diag-ref");
    });
  }
}

/* ---------------- cabecera de cada hoja ---------------- */

/* Cuál de las tres hojas es cuál se decide por heurística (tinta abajo
   a la izquierda, mitad inferior vacía). Cuando se equivoca, TODOS los
   recuadros de esas dos hojas quedan en la página que no es, y desde
   la interfaz no había forma de corregirlo. Ahora sí: al elegir otra
   hoja se rehace el ajuste con el gris que quedó en memoria. */
function pintarCabecera(dom) {
  const p = dom.pagina;
  let extra = "";

  if (p.tipo === "formato") {
    const opciones = ["1/3", "2/3", "3/3"].map(function (h) {
      return '<button class="hoja-op' + (p.hoja === h ? " on" : "") +
        '" onclick="cambiarHoja(' + p.n + ', \'' + h + '\')">' + h + '</button>';
    }).join("");

    const estado = !p.ajuste ? ["sin", "sin ajuste"]
      : p.ajuste.exacto ? ["ok", "recuadros exactos"]
      : ["aprox", "solo la fila"];

    extra =
      '<span class="hoja-sel">' + opciones + '</span>' +
      '<span class="hoja-est ' + estado[0] + '">' + estado[1] + '</span>' +
      (ver.diag && p.ajuste
        ? '<span class="hoja-diag-datos num">escala ' + p.ajuste.escala.toFixed(3) +
          ' · corrim. ' + (p.ajuste.desplazamiento >= 0 ? "+" : "") + p.ajuste.desplazamiento.toFixed(3) +
          ' · filas ' + (p.ajuste.aciertos || 0) + '/' + (REFERENCIA[p.hoja] || []).length +
          ' · barras ' + ((p.ajuste.confianzaBarras || 0) * 100).toFixed(0) + '%' +
          ' · arriba ' + (p.ajuste.arriba || 0) + ' abajo ' + (p.ajuste.abajo || 0) + '</span>'
        : "") +
      '<button class="hoja-diag' + (ver.diag ? " on" : "") +
        '" onclick="alternarDiagnostico()">diagnóstico</button>';
  }

  dom.cab.innerHTML = '<span class="mini-n num">' + p.n + '</span>' +
    NOMBRES_TIPO[p.tipo] + extra;
}

function cambiarHoja(n, hoja) {
  const p = ver.analisis.paginas.find(function (x) { return x.n === n; });
  if (!p || p.tipo !== "formato" || p.hoja === hoja) return;

  /* Si otra página tenía esa hoja, se intercambian: es lo que pasa en
     la práctica, la 1/3 y la 2/3 se confunden entre ellas. */
  const anterior = p.hoja;
  const otra = ver.analisis.paginas.find(function (x) {
    return x !== p && x.tipo === "formato" && x.hoja === hoja;
  });
  p.hoja = hoja;
  if (otra) otra.hoja = anterior;

  [p, otra].forEach(function (x) {
    if (!x) return;
    ubicarRejillaDe(x);
    const dom = ver.hojas[x.n];
    if (dom) pintarCabecera(dom);
  });

  actualizarVisor();
}

/* ---------------- montaje ---------------- */

/* Dibuja las páginas grandes, y al lado el margen donde viven las
   etiquetas. El papel queda limpio.

   Dos decisiones que vienen de que esto se quedó en blanco dos veces:

   1) Si algo falla, el error se PINTA en la columna. Una columna vacía
      no dice nada y obliga a abrir la consola; un mensaje en pantalla
      se lee y se copia.
   2) Si ya está montado se sabe mirando el DOM, no con una bandera.
      Con bandera, cualquier render() posterior que reescriba el
      contenedor dejaba el visor vacío para siempre y la única salida
      era recargar la página. */
async function montarHojas() {
  const zona = document.getElementById("visorHojas");
  if (!zona || !ver.analisis) return;
  if (zona.querySelector(".hoja")) return;   // ya está montado

  try {
    await armarHojas(zona);
    pintarCasillas();
  } catch (e) {
    zona.innerHTML =
      '<div class="panel fallo-visor">' +
      '<p class="t">No pude dibujar las hojas</p>' +
      '<p class="s">El análisis sí funcionó: las marcas de la derecha son válidas. ' +
      'Lo que falló es el dibujo del documento.</p>' +
      '<pre>' + esc((e && e.message ? e.message : String(e)) + "\n\n" +
                    (e && e.stack ? e.stack : "")) + '</pre>' +
      '<button class="btn btn-ghost" onclick="descartarPaquete()">Descartar y empezar de nuevo</button>' +
      '</div>';
    throw e;
  }
}

async function armarHojas(zona) {
  ver.montado = true;
  ver.hojas = {};
  zona.innerHTML = "";

  /* Cuánto ancho de hoja cabe. En modo ancho la columna de la derecha
     se esconde, así que la hoja se lleva casi toda la pantalla. */
  const disponible = (zona.clientWidth || 920) - 40;
  const ANCHO = Math.max(420, Math.min(ver.anchoCompleto ? 1500 : 980, disponible));
  ver.anchoBase = ANCHO;

  const barra = document.createElement("div");
  barra.className = "visor-barra";
  barra.innerHTML =
    '<span class="vb-tit">Zoom</span>' +
    '<button class="vb-btn" onclick="moverZoom(-1)" title="Alejar">&minus;</button>' +
    '<span class="vb-pct num" id="zoomPct">100%</span>' +
    '<button class="vb-btn" onclick="moverZoom(1)" title="Acercar">+</button>' +
    '<button class="vb-btn ancho" onclick="ponerZoom(1)">Ajustar</button>' +
    '<button class="vb-btn ancho" onclick="alternarAncho()">' +
    (ver.anchoCompleto ? "Mostrar el panel" : "Pantalla ancha") + '</button>' +
    '<span class="vb-ayuda" id="zoomAyuda">Pellizca en el trackpad para acercar · arrastra para moverte</span>';
  zona.appendChild(barra);

  for (const p of ver.analisis.paginas) {
    const caja = document.createElement("div");
    caja.className = "hoja";
    caja.id = "hoja-" + p.n;

    const cab = document.createElement("div");
    cab.className = "hoja-cab";
    caja.appendChild(cab);

    const envoltura = document.createElement("div");
    envoltura.className = "hoja-lienzo";
    const scroll = document.createElement("div");
    scroll.className = "hoja-scroll";
    escucharGestos(scroll);
    const papel = document.createElement("div");
    papel.className = "hoja-papel";
    papel.style.width = Math.round(ANCHO * ver.zoom) + "px";
    scroll.appendChild(papel);
    const margen = document.createElement("div");
    margen.className = "hoja-margen";
    const guias = document.createElementNS(SVGNS, "svg");
    guias.setAttribute("class", "hoja-guias");
    envoltura.appendChild(scroll);
    envoltura.appendChild(margen);
    envoltura.appendChild(guias);
    caja.appendChild(envoltura);
    zona.appendChild(caja);

    const lienzo = document.createElement("canvas");
    papel.appendChild(lienzo);
    await dibujarPagina(p.n, lienzo);

    ver.hojas[p.n] = { pagina: p, cab: cab, envoltura: envoltura, scroll: scroll,
                       papel: papel, margen: margen, guias: guias, lienzo: lienzo, marcas: [] };
    scroll.addEventListener("scroll", function () { recolocar(ver.hojas[p.n]); });
    activarArrastre(ver.hojas[p.n]);
    pintarCabecera(ver.hojas[p.n]);
  }

  pintarMarcas();
  vigilarTamano();
}

/* Dibuja una página en su lienzo a la resolución que toca según el
   zoom. El tamaño en pantalla lo manda el CSS (100% del papel); lo que
   cambia aquí son los píxeles reales, que es lo que hace que la letra
   se lea en vez de verse ampliada y borrosa. */
/* pdf.js no deja dos render() a la vez sobre el MISMO lienzo: revienta
   con "Cannot use the same canvas during multiple render operations".
   Y desde la v19 eso pasa de verdad: el pellizco del trackpad programa
   un redibujado 250 ms después, y si mientras tanto se monta la hoja o
   se pulsa el zoom, coinciden dos sobre el mismo lienzo.

   La solución es cancelar el dibujo anterior antes de empezar el
   siguiente. Se guarda la tarea en el propio lienzo para no tener que
   llevar un registro aparte que se desincronice cuando se remonta la
   vista. Cancelar lanza una excepción a propósito en la tarea vieja
   (`RenderingCancelledException`) y esa hay que tragársela: no es un
   fallo, es la señal de que se canceló bien. */
async function dibujarPagina(n, lienzo) {
  if (lienzo._tarea) {
    try { lienzo._tarea.cancel(); } catch (e) { /* ya había terminado */ }
    lienzo._tarea = null;
  }
  const pagina = await ver.analisis.doc.getPage(n);
  const base = pagina.getViewport({ scale: 1 });
  const anchoReal = Math.min(ver.anchoBase * ver.zoom, ANCHO_LIENZO_MAX);
  const vista = pagina.getViewport({ scale: anchoReal / base.width });
  lienzo.width = Math.floor(vista.width);
  lienzo.height = Math.floor(vista.height);
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);

  const tarea = pagina.render({ canvasContext: ctx, viewport: vista });
  lienzo._tarea = tarea;
  try {
    await tarea.promise;
  } catch (e) {
    /* Si nos cancelaron, el que viene detrás ya está dibujando. */
    if (!e || e.name !== "RenderingCancelledException") throw e;
  } finally {
    if (lienzo._tarea === tarea) lienzo._tarea = null;
  }
}

/* Arrastrar la hoja para moverse por ella. Con la hoja acercada, la
   barra de desplazamiento de abajo obliga a apuntar a una franja de
   diez píxeles cada vez que quieres mirar otra casilla. En horizontal
   se mueve el contenedor; en vertical, la página entera, que es donde
   está el resto de la hoja. */
function activarArrastre(dom) {
  const s = dom.scroll;
  let activo = false, xIni = 0, yIni = 0, izqIni = 0, arribaIni = 0;

  s.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 || !hayQueMover(s)) return;
    if (e.target.closest && e.target.closest(".casilla-color")) return;
    /* Si el toque empieza sobre una casilla, el arrastre no se mete:
       ahí el clic sirve para confirmarla. Sin esta línea el
       `preventDefault` de abajo se comía el clic y el chulito no
       reaccionaba, pero SOLO cuando la hoja estaba lo bastante
       ampliada como para poder arrastrarla. De ahí que unas veces
       funcionara y otras no. */
    activo = true;
    xIni = e.clientX; yIni = e.clientY;
    izqIni = s.scrollLeft; arribaIni = window.scrollY;
    s.setPointerCapture(e.pointerId);
    s.classList.add("agarrando");
    e.preventDefault();
  });

  s.addEventListener("pointermove", function (e) {
    if (!activo) return;
    s.scrollLeft = izqIni - (e.clientX - xIni);
    window.scrollTo(0, Math.max(0, arribaIni - (e.clientY - yIni)));
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
    s.addEventListener(ev, function () {
      if (!activo) return;
      activo = false;
      s.classList.remove("agarrando");
      recolocar(dom);
    });
  });
}

function hayQueMover(s) {
  return s.scrollWidth - s.clientWidth > 2;
}

function moverZoom(paso) {
  const i = ZOOMS.indexOf(ver.zoom);
  const j = Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + paso));
  ponerZoom(ZOOMS[j]);
}

/* ---------------- gestos sobre la hoja ----------------

   El trackpad manda el pellizco como una rueda con ctrl pulsado: es lo
   que hacen todos los navegadores y no hay otra forma de distinguirlo
   de un desplazamiento normal. Si no se llama a preventDefault, el
   navegador hace su propio zoom de página y se lleva por delante toda
   la interfaz.

   El redibujado del lienzo NO va en cada evento: se cambia el ancho en
   CSS, que el navegador escala solo y sale gratis, y el redibujado
   nítido se hace 250 ms después de que pare el gesto. Redibujar en
   cada rueda deja el pellizco a trompicones. */
const ZOOM_MIN = 0.5, ZOOM_MAX = 5;
let temporizadorNitidez = null;

function escucharGestos(scroll) {
  scroll.addEventListener("wheel", function (ev) {
    if (!ev.ctrlKey) return;            // desplazamiento normal: no es lo nuestro
    ev.preventDefault();
    zoomSuave(ver.zoom * Math.exp(-ev.deltaY / 180), ev, scroll);
  }, { passive: false });

  /* El arrastre lo lleva `activarArrastre`, que además mueve la
     página en vertical. Tener dos manejadores sobre el mismo elemento
     era justo el problema: uno de ellos capturaba el puntero y el otro
     no se enteraba. */
}

/* Zoom continuo: cambia el tamaño ya y afina el dibujo al parar.
   Se conserva el punto del papel que estaba bajo el cursor, que es lo
   que hace que el pellizco se sienta natural. */
function zoomSuave(z, ev, scroll) {
  if (!ver.hojas || !ver.anchoBase) return;
  z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  if (Math.abs(z - ver.zoom) < 0.001) return;

  const caja = scroll.getBoundingClientRect();
  const px = scroll.scrollLeft + (ev.clientX - caja.left);
  const py = scroll.scrollTop + (ev.clientY - caja.top);
  const factor = z / ver.zoom;
  ver.zoom = z;

  Object.keys(ver.hojas).forEach(function (k) {
    ver.hojas[k].papel.style.width = Math.round(ver.anchoBase * z) + "px";
  });
  scroll.scrollLeft = px * factor - (ev.clientX - caja.left);
  scroll.scrollTop = py * factor - (ev.clientY - caja.top);

  const pct = document.getElementById("zoomPct");
  if (pct) pct.textContent = Math.round(z * 100) + "%";

  clearTimeout(temporizadorNitidez);
  temporizadorNitidez = setTimeout(afinarDibujo, 250);
}

/* Redibujado nítido tras el pellizco. Va hoja por hoja y NO deja que
   el fallo de una se lleve por delante a las demás: si una no se puede
   redibujar, se queda con el dibujo escalado por CSS, que se ve algo
   borroso pero está, y las otras siguen. Antes una excepción aquí
   abortaba el bucle y dejaba media vista sin recuadros. */
async function afinarDibujo() {
  if (!ver.hojas || zoomEnCurso) return;
  for (const k of Object.keys(ver.hojas)) {
    const dom = ver.hojas[k];
    try {
      await dibujarPagina(dom.pagina.n, dom.lienzo);
    } catch (e) {
      console.warn("No pude redibujar la hoja", k, e);
    }
    dom.scroll.classList.toggle("movible", hayQueMover(dom.scroll));
    recolocar(dom);
  }
  pintarCasillas();
}

async function alternarAncho() {
  ver.anchoCompleto = !ver.anchoCompleto;
  ver.montado = false;
  render();
}

let zoomEnCurso = false;
async function ponerZoom(z) {
  if (zoomEnCurso || !ver.hojas || z === ver.zoom) return;
  zoomEnCurso = true;
  ver.zoom = z;

  const pct = document.getElementById("zoomPct");
  if (pct) { pct.textContent = Math.round(z * 100) + "%"; pct.classList.add("cargando"); }

  try {
    /* Primero el tamaño de todas —así el salto se ve de una— y después
       el redibujado, que es lo que cuesta. */
    Object.keys(ver.hojas).forEach(function (k) {
      ver.hojas[k].papel.style.width = Math.round(ver.anchoBase * z) + "px";
    });
    for (const k of Object.keys(ver.hojas)) {
      const dom = ver.hojas[k];
      await dibujarPagina(dom.pagina.n, dom.lienzo);
      dom.scroll.classList.toggle("movible", hayQueMover(dom.scroll));
      recolocar(dom);
    }
    const ayuda = document.getElementById("zoomAyuda");
    if (ayuda) ayuda.textContent = z > 1
      ? "Arrastra la hoja para moverte por ella"
      : "Los recuadros se acercan con la hoja";
  } finally {
    zoomEnCurso = false;
    if (pct) pct.classList.remove("cargando");
  }
}

/* Al cambiar el ancho, los recuadros se acomodan solos porque van en
   porcentaje; los rótulos no, porque se apilan en píxeles. */
function vigilarTamano() {
  if (observadorTamano || typeof ResizeObserver === "undefined") return;
  observadorTamano = new ResizeObserver(function () {
    Object.keys(ver.hojas || {}).forEach(function (k) { recolocar(ver.hojas[k]); });
  });
  const zona = document.getElementById("visorHojas");
  if (zona) observadorTamano.observe(zona);
}

/* Arrastrar y soltar sobre la ventana. */
function activarSoltar() {
  ["dragenter", "dragover", "dragleave", "drop"].forEach(function (evento) {
    document.addEventListener(evento, function (e) {
      if (vista !== "verificar") return;
      e.preventDefault();
      const z = document.getElementById("zonaSoltar");
      if (!z) return;
      if (evento === "dragenter" || evento === "dragover") z.classList.add("encima");
      if (evento === "dragleave") z.classList.remove("encima");
      if (evento === "drop") {
        z.classList.remove("encima");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          ver.archivoOriginal = e.dataTransfer.files[0];
          recibirArchivo(e.dataTransfer.files[0]);
        }
      }
    });
  });
}
