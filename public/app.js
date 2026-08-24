"use strict";
/* ================================================================
   Distriaves · Frontend
   Capa de presentación: consume la API (/api/*) y pinta la interfaz.
   No contiene reglas de negocio: días, prioridad y urgencia
   llegan calculados desde el servidor.
   ================================================================ */

/* ---------- iconos SVG (trazo estilo lucide) ---------- */
/* Versión visible en la pantalla. Sirve para lo más aburrido y lo más
   útil: saber si el navegador está corriendo el código que acabas de
   copiar o uno viejo que quedó en caché. */
const APP_VERSION = "v32";

function svg(nombre, s) {
  s = s || 15;
  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2.5 19.5h19L12 3z"/><path d="M12 10v4M12 17.5h.01"/>',
    pencil: '<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 8 5-5 5 5M12 3v12"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    updown: '<path d="m7 9 5-5 5 5M7 15l5 5 5-5"/>',
    zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
    wifiOff: '<path d="m2 2 20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5.2-2.7M12 20h.01M19 12.5a10 10 0 0 0-2.6-1.8"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
    minus: '<path d="M6 12h12"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.2 7.9 8 9 4.8-1.1 8-4.5 8-9V6l-8-3z"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    gauge: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M12 3a9 9 0 0 1 9 9M3 12a9 9 0 0 1 4-7.5M14.2 9.8 19 5"/>',
    rotate: '<path d="M3 12a9 9 0 1 1 3 6.7"/><path d="M3 21v-6h6"/>',
  };
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (P[nombre] || "") + '</svg>';
}

/* ---------- estado de la interfaz ---------- */
let resumen = { total: 0, activos: 0, pendientes: 0, devueltos: 0, sinRespuesta: 0,
  urgentes: 0, umbralAviso: 2, umbralUrgencia: 15, cola: [] };
let clientes = [];
let actividad = [];
let metricas = { muestras: 0, promedioDias: null, medianaDias: null, conDevolucion: 0, tasaDevolucion: 0, motivos: [] };
let usuario = null;
let vista = "resumen";
let filtro = "Todos";
let orden = { col: "prioridad", dir: "desc" };

/* ---------- capa de acceso a la API ---------- */
async function api(ruta, opciones) {
  const res = await fetch("/api" + ruta, Object.assign({
    headers: { "Content-Type": "application/json" },
  }, opciones));
  if (res.status === 204) return null;
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(cuerpo.error || "Error de comunicación con el servidor.");
  return cuerpo;
}

async function refrescar() {
  try {
    const [r, c, a, m, y] = await Promise.all([
      api("/resumen"), api("/clientes"), api("/actividad"), api("/metricas"), api("/auth/yo"),
    ]);
    resumen = r; clientes = c; actividad = a; metricas = m; usuario = y.usuario;
    render();
  } catch (e) {
    if (/sesi/i.test(e.message)) { location.href = "/login.html"; return; }
    render();
    toast("wifiOff", "No se pudo conectar con el servidor: " + e.message);
  }
}

async function salir() {
  try { await api("/auth/salir", { method: "POST" }); } catch (e) { /* igual salimos */ }
  location.href = "/login.html";
}

/* ---------- utilidades ---------- */
function hoyISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmt(iso) {
  if (!iso) return null;
  const p = iso.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}
function fmtHora(isoFull) {
  const d = new Date(isoFull);
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " " +
    String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------- acciones ---------- */
async function activar(id) {
  try {
    const c = await api("/clientes/" + id + "/estado", { method: "PATCH", body: JSON.stringify({ estado: "Activo" }) });
    await refrescar();
    toast("check", "Código activado: " + c.nombre);
  } catch (e) { toast("alert", e.message); }
}
async function volverPendiente(id) {
  try {
    const c = await api("/clientes/" + id + "/estado", { method: "PATCH", body: JSON.stringify({ estado: "Pendiente" }) });
    await refrescar();
    toast("clock", c.nombre + " volvió a pendiente");
  } catch (e) { toast("alert", e.message); }
}
function pedirDevolucion(id) {
  const c = clientes.find(function (x) { return x.id === id; });
  if (!c) return;
  const sugerencias = [
    "Nombre distinto al de la cédula",
    "Número de cédula ilegible o tachado",
    "Casilla obligatoria vacía",
    "Correo de facturación equivocado",
    "CIIU distinto al del RUT",
    "Escaneo ilegible",
    "Falta un documento",
  ];
  document.getElementById("zonaModal").innerHTML =
    '<div class="scrim" onclick="cerrarModal()"></div>' +
    '<div class="dialogo" role="dialog" aria-modal="true">' +
    '<h3>Devolvieron la creación de ' + esc(c.nombre) + '</h3>' +
    '<p>Anota por qué. Es lo único que después te dice qué error te está costando más tiempo.</p>' +
    '<div class="campo"><label for="motivo">Motivo</label>' +
    '<input type="text" id="motivo" list="motivosComunes" placeholder="¿Qué te dijeron?"></div>' +
    '<datalist id="motivosComunes">' +
    sugerencias.map(function (m) { return '<option value="' + esc(m) + '">'; }).join("") +
    '</datalist>' +
    '<div class="fila-btn">' +
    '<button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>' +
    '<button class="btn btn-danger" onclick="devolver(\'' + c.id + '\')">Guardar devolución</button>' +
    '</div></div>';
  const inp = document.getElementById("motivo");
  inp.focus();
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter") devolver(c.id); });
}

async function devolver(id) {
  const motivo = document.getElementById("motivo").value.trim();
  try {
    const c = await api("/clientes/" + id + "/devolucion", {
      method: "POST", body: JSON.stringify({ motivo: motivo }),
    });
    cerrarModal();
    await refrescar();
    toast("undo", "Devolución anotada: " + c.nombre);
  } catch (e) { toast("alert", e.message); }
}

function pedirEliminar(id) {
  const c = clientes.find(function (x) { return x.id === id; });
  if (!c) return;
  document.getElementById("zonaModal").innerHTML =
    '<div class="scrim" onclick="cerrarModal()"></div>' +
    '<div class="dialogo" role="alertdialog">' +
    '<h3>Eliminar a ' + esc(c.nombre) + '</h3>' +
    '<p>El registro se borra de la base de datos y no se puede recuperar. Si solo cambió de estado, edítalo en lugar de eliminarlo.</p>' +
    '<div class="fila-btn">' +
    '<button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>' +
    '<button class="btn btn-danger" onclick="eliminar(\'' + c.id + '\')">Eliminar cliente</button>' +
    '</div></div>';
}
async function eliminar(id) {
  const c = clientes.find(function (x) { return x.id === id; });
  try {
    await api("/clientes/" + id, { method: "DELETE" });
    cerrarModal();
    await refrescar();
    if (c) toast("trash", "Cliente eliminado: " + c.nombre);
  } catch (e) { toast("alert", e.message); }
}

/* ---------- export / import ---------- */
function exportar() {
  window.location.href = "/api/export";
  toast("download", "Descargando copia de seguridad…");
}
function importar(archivo) {
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = async function () {
    try {
      const data = JSON.parse(lector.result);
      const r = await api("/import", { method: "POST", body: JSON.stringify(data) });
      await refrescar();
      toast("upload", "Respaldo importado: " + r.importados + " clientes");
    } catch (e) {
      toast("alert", e.message || "No se pudo leer el archivo.");
    }
  };
  lector.readAsText(archivo);
  document.getElementById("inputImportar").value = "";
}

/* ---------- formulario (slide-over) ---------- */
let formId = null;
let formEstado = "Pendiente";

function abrirForm(id) {
  formId = id || null;
  const c = id ? clientes.find(function (x) { return x.id === id; }) : null;
  formEstado = c ? c.estado : "Pendiente";
  const fechaIni = c ? (c.fechaEnvio || "") : hoyISO();

  document.getElementById("zonaModal").innerHTML =
    '<div class="scrim" onclick="cerrarModal()"></div>' +
    '<div class="panel-lateral" role="dialog" aria-modal="true">' +
    '<div class="pl-head"><h3>' + (c ? "Editar cliente" : "Nuevo cliente") + '</h3>' +
    '<button class="ico-btn" onclick="cerrarModal()" aria-label="Cerrar">' + svg("x", 16) + '</button></div>' +
    '<div class="pl-body">' +
    '<div class="campo"><label>Nombre del cliente</label>' +
    '<input type="text" id="fNombre" placeholder="Nombre completo" value="' + (c ? esc(c.nombre) : "") + '"></div>' +
    '<div class="campo"><label>Tipo de negocio</label>' +
    '<input type="text" id="fTipo" placeholder="Asadero, restaurante, tienda…" value="' + (c ? esc(c.tipo || "") : "") + '"></div>' +
    '<div class="campo"><label>Estado del código</label>' +
    '<div class="seg">' +
    '<button id="segPend" onclick="setFormEstado(\'Pendiente\')">' + svg("clock", 14) + ' Pendiente</button>' +
    '<button id="segAct" onclick="setFormEstado(\'Activo\')">' + svg("checkCircle", 14) + ' Activo</button>' +
    '<button id="segDev" onclick="setFormEstado(\'Devuelto\')">' + svg("rotate", 14) + ' Devuelta</button>' +
    '</div>' +
    '<p class="ayuda">Pendiente: la creación fue enviada pero aún no tiene código de compra.</p></div>' +
    '<div class="campo"><label>Fecha de envío de la creación</label>' +
    '<div class="fecha-row">' +
    '<input type="date" id="fFecha" class="num" value="' + fechaIni + '">' +
    '<button class="btn-hoy" onclick="document.getElementById(\'fFecha\').value=hoyISO()">Hoy</button>' +
    '</div>' +
    '<p class="ayuda">Con esta fecha se calculan los días de espera y el orden de prioridad.</p></div>' +
    '<div id="fError"></div>' +
    '</div>' +
    '<div class="pl-foot">' +
    '<button class="btn btn-ghost" onclick="cerrarModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="guardarForm()">' + (c ? "Guardar cambios" : "Agregar cliente") + '</button>' +
    '</div></div>';

  pintarSeg();
  const inp = document.getElementById("fNombre");
  inp.focus();
  ["fNombre", "fTipo"].forEach(function (idc) {
    document.getElementById(idc).addEventListener("keydown", function (e) {
      if (e.key === "Enter") guardarForm();
    });
  });
}
function setFormEstado(e) { formEstado = e; pintarSeg(); }
function pintarSeg() {
  const p = document.getElementById("segPend"), a = document.getElementById("segAct"), d = document.getElementById("segDev");
  if (!p || !a) return;
  p.className = formEstado === "Pendiente" ? "on-pend" : "";
  a.className = formEstado === "Activo" ? "on-act" : "";
  if (d) d.className = formEstado === "Devuelto" ? "on-dev" : "";
}
async function guardarForm() {
  const nombre = document.getElementById("fNombre").value.trim();
  const tipo = document.getElementById("fTipo").value.trim();
  const fecha = document.getElementById("fFecha").value || null;
  const cuerpo = JSON.stringify({ nombre: nombre, tipo: tipo, estado: formEstado, fechaEnvio: fecha });
  try {
    if (formId) {
      await api("/clientes/" + formId, { method: "PUT", body: cuerpo });
      toast("check", "Cambios guardados: " + nombre);
    } else {
      await api("/clientes", { method: "POST", body: cuerpo });
      toast("plus", "Cliente agregado: " + nombre);
    }
    cerrarModal();
    await refrescar();
  } catch (e) {
    document.getElementById("fError").innerHTML =
      '<div class="form-error">' + svg("alert", 14) + " " + esc(e.message) + '</div>';
  }
}
function cerrarModal() { document.getElementById("zonaModal").innerHTML = ""; }

/* ---------- toast ---------- */
let toastTimer = null;
function toast(ico, msg) {
  document.getElementById("zonaToast").innerHTML =
    '<div class="toast">' + svg(ico, 15) + esc(msg) + '</div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { document.getElementById("zonaToast").innerHTML = ""; }, 3500);
}

/* ---------- navegación ---------- */
function setVista(v) { vista = v; render(); }
function setFiltro(f) { filtro = f; render(); }
function onBuscar() { if (vista !== "clientes") vista = "clientes"; render(); }
function ordenarPor(col) {
  if (orden.col === col) { orden.dir = orden.dir === "asc" ? "desc" : "asc"; }
  else { orden = { col: col, dir: (col === "nombre" || col === "tipo") ? "asc" : "desc" }; }
  render();
}

/* ---------- render ---------- */
function render() {
  const rankMap = {};
  resumen.cola.forEach(function (c) { rankMap[c.id] = c.prioridad; });

  const items = [
    { id: "verificar", ico: "shield", txt: "Verificar", badge: null },
    { id: "diligenciar", ico: "edit", txt: "Diligenciar", badge: null },
    { id: "resumen", ico: "grid", txt: "Resumen", badge: resumen.sinRespuesta > 0 ? resumen.sinRespuesta : null },
    { id: "clientes", ico: "list", txt: "Clientes", badge: resumen.total },
    { id: "proceso", ico: "gauge", txt: "Proceso", badge: null },
  ];
  document.getElementById("navLateral").innerHTML = items.map(function (it) {
    return '<button class="nav-item' + (vista === it.id ? " on" : "") + '" onclick="setVista(\'' + it.id + '\')">' +
      svg(it.ico, 15) + it.txt + (it.badge != null ? '<span class="badge num">' + it.badge + '</span>' : "") + '</button>';
  }).join("");
  document.getElementById("navMovil").innerHTML = items.map(function (it) {
    return '<button class="' + (vista === it.id ? "on" : "") + '" onclick="setVista(\'' + it.id + '\')">' + svg(it.ico, 17) + it.txt + '</button>';
  }).join("");
  const titulos = { verificar: "Verificar un paquete", diligenciar: "Llenar el formato", resumen: "Resumen", clientes: "Clientes", proceso: "Cómo va el proceso" };
  document.getElementById("tituloVista").textContent = titulos[vista] || "Resumen";
  document.getElementById("barraBusqueda").style.display = vista === "clientes" ? "" : "none";
  document.getElementById("btnNuevo").style.display = (vista === "verificar" || vista === "diligenciar") ? "none" : "";
  const pie = document.getElementById("usuarioActivo");
  if (pie) pie.textContent = usuario || "";

  const zona = document.getElementById("vista");
  /* Sin comprobar ver.montado: montarHojas() mira el DOM y no hace
     nada si ya está. Así, si un render() posterior reescribe el
     contenedor, el visor se vuelve a montar solo en vez de quedarse
     en blanco hasta que recargues. */
  if (vista === "verificar" && ver && ver.analisis) {
    setTimeout(montarHojas, 0);
  }
  zona.innerHTML =
    vista === "verificar" ? htmlVerificar() :
    vista === "diligenciar" ? htmlDiligenciar() :
    vista === "proceso" ? htmlProceso() :
    vista === "clientes" ? htmlClientes(rankMap) : htmlResumen(rankMap);
}

function htmlProceso() {
  const m = metricas;
  const dato = function (v, unidad) { return v == null ? "—" : v + (unidad || ""); };

  const kpis = '<div class="kpis">' +
    kpi("Días promedio en aprobar", dato(m.promedioDias), "clock",
      m.muestras ? "sobre " + m.muestras + " creaciones aprobadas" : "aún no hay ninguna aprobada con fecha") +
    kpi("Mediana", dato(m.medianaDias), "gauge",
      m.muestras ? "la mitad tardó menos que esto" : "—") +
    kpi("La que más tardó", dato(m.peorDias), "alert",
      m.mejorDias != null ? "la más rápida: " + m.mejorDias + " días" : "—", m.peorDias != null && m.peorDias > resumen.umbralUrgencia) +
    kpi("Devueltas alguna vez", m.conDevolucion, "rotate", m.tasaDevolucion + "% de tus clientes") +
    '</div>';

  let motivos;
  if (!m.motivos.length) {
    motivos = '<div class="panel-vacio"><div class="ico">' + svg("checkCircle", 22) + '</div>' +
      '<p class="t">Sin devoluciones anotadas</p>' +
      '<p class="s">Cuando te devuelvan una creación, anótala desde la lista de clientes. ' +
      'Con cinco o seis ya vas a ver cuál error te está costando el tiempo.</p></div>';
  } else {
    const tope = Math.max.apply(null, m.motivos.map(function (x) { return x.veces; }));
    motivos = '<div class="barras">' + m.motivos.map(function (x) {
      return '<div class="barra-fila">' +
        '<div class="barra-etq">' + esc(x.motivo) + '</div>' +
        '<div class="barra-riel"><div class="barra" style="width:' + Math.round(x.veces / tope * 100) + '%"></div></div>' +
        '<div class="barra-n num">' + x.veces + '</div></div>';
    }).join("") + '</div>';
  }

  return kpis +
    '<div class="panel"><div class="panel-head"><h2>Por qué te devuelven</h2>' +
    '<span class="hint">de lo que has anotado</span></div>' + motivos + '</div>' +
    '<div class="panel nota-proceso">' + svg("gauge", 16) +
    '<div><strong>Este es el dato que nadie más tiene.</strong> El trámite pasa por varias áreas y ' +
    'nadie mide cuánto tarda de punta a punta, porque nadie está en los dos extremos. Tú sí. ' +
    'Con dos o tres meses de historia, esta pantalla deja de ser una curiosidad y pasa a ser el ' +
    'argumento con el que se pide cambiar algo.</div></div>';
}

function kpi(lbl, num, ico, sub, alerta) {
  return '<div class="kpi' + (alerta ? " alerta" : "") + '">' +
    '<div class="kpi-top"><span class="kpi-lbl">' + lbl + '</span><span class="kpi-ico">' + svg(ico, 15) + '</span></div>' +
    '<div class="kpi-num num">' + num + '</div>' +
    '<div class="kpi-sub">' + sub + '</div></div>';
}

function htmlResumen(rankMap) {
  const s = resumen;
  const kpis =
    '<div class="kpis">' +
    kpi("Clientes registrados", s.total, "users", s.activos + " activos · " + s.pendientes + " pendientes") +
    kpi("Con código activo", s.activos, "checkCircle", s.total ? Math.round(s.activos / s.total * 100) + "% del total" : "—") +
    kpi("Esperando código", s.pendientes, "clock", s.pendientes ? "el más antiguo encabeza la cola" : "sin pendientes") +
    kpi("Sin respuesta hace " + s.umbralAviso + "+ días", s.sinRespuesta, "alert",
      s.sinRespuesta ? "hora de preguntar por ellas" : "nada por reclamar todavía", s.sinRespuesta > 0) +
    '</div>';

  let cola;
  if (s.cola.length === 0) {
    cola = '<div class="panel-vacio"><div class="ico">' + svg("checkCircle", 22) + '</div>' +
      '<p class="t">Sin pendientes</p><p class="s">Todos los clientes registrados ya tienen código activo.</p></div>';
  } else {
    cola = s.cola.map(function (c) {
      return '<div class="cola-item' + (c.urgente ? " urg" : (c.sinRespuesta ? " avisa" : "")) + '">' +
        '<div class="rank num">' + c.prioridad + '</div>' +
        '<div class="cola-info">' +
        '<div class="cola-nombre">' + esc(c.nombre) + '</div>' +
        '<div class="cola-meta">' +
        (c.tipo ? esc(c.tipo) : "Negocio sin definir") + ' · ' +
        (c.fechaEnvio ? "enviado el " + fmt(c.fechaEnvio) : "sin fecha de envío") +
        '</div></div>' +
        (c.fechaEnvio
          ? '<div class="cola-dias num"><div class="d">' + c.diasEspera + '</div><div class="u">' + (c.diasEspera === 1 ? "día" : "días") + '</div></div>'
          : '<button class="mini-btn amarillo" onclick="abrirForm(\'' + c.id + '\')">' + svg("calendar", 13) + ' Agregar fecha</button>') +
        '<button class="mini-btn" onclick="activar(\'' + c.id + '\')">' + svg("check", 13) + ' Activar</button>' +
        '</div>';
    }).join("");
  }

  let act;
  if (actividad.length === 0) {
    act = '<div class="panel-vacio"><div class="ico">' + svg("zap", 20) + '</div>' +
      '<p class="t">Sin movimientos aún</p><p class="s">Aquí queda el historial: activaciones, clientes nuevos, cambios.</p></div>';
  } else {
    const colores = { ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)", neutro: "var(--text-3)" };
    act = actividad.slice(0, 10).map(function (r) {
      return '<div class="act-item"><div class="act-dot" style="background:' + (colores[r.tipo] || colores.neutro) + '"></div>' +
        '<div><div class="act-txt">' + esc(r.texto) + '</div><div class="act-fecha num">' + fmtHora(r.fecha) + '</div></div></div>';
    }).join("");
  }

  const devueltos = clientes.filter(function (c) { return c.estado === "Devuelto"; });
  const avisoDevueltos = devueltos.length
    ? '<div class="panel aviso-devueltos">' + svg("rotate", 16) +
      '<div><strong>' + devueltos.length + (devueltos.length === 1 ? ' creación devuelta' : ' creaciones devueltas') +
      ' esperando corrección:</strong> ' + devueltos.map(function (c) { return esc(c.nombre); }).join(", ") +
      '. Corrige el paquete, vuelve a pasarlo por Verificar y el reenvío queda registrado solo.</div></div>'
    : "";

  return kpis + avisoDevueltos +
    '<div class="grid-2">' +
    '<div class="panel"><div class="panel-head"><h2>Cola de prioridad</h2>' +
    '<span class="hint">ordenada por días de espera</span></div>' + cola + '</div>' +
    '<div class="panel"><div class="panel-head"><h2>Actividad reciente</h2>' +
    '<span class="hint">últimos ' + Math.min(actividad.length, 10) + ' movimientos</span></div>' + act + '</div>' +
    '</div>';
}

function htmlClientes(rankMap) {
  const q = document.getElementById("buscador").value.trim().toLowerCase();
  let lista = clientes.filter(function (c) {
    return (filtro === "Todos" || c.estado === filtro) &&
      (!q || c.nombre.toLowerCase().includes(q) || (c.tipo || "").toLowerCase().includes(q));
  });

  const dir = orden.dir === "asc" ? 1 : -1;
  lista.sort(function (a, b) {
    switch (orden.col) {
      case "nombre": return a.nombre.localeCompare(b.nombre, "es") * dir;
      case "tipo": return (a.tipo || "").localeCompare(b.tipo || "", "es") * dir;
      case "estado": return a.estado.localeCompare(b.estado, "es") * dir;
      case "fecha": return ((a.fechaEnvio || "") < (b.fechaEnvio || "") ? -1 : 1) * dir;
      case "dias": {
        const da = a.diasEspera == null ? -1 : a.diasEspera;
        const db = b.diasEspera == null ? -1 : b.diasEspera;
        return (da - db) * dir;
      }
      default: {
        const ra = rankMap[a.id] || 9999, rb = rankMap[b.id] || 9999;
        if (ra !== rb) return (ra - rb) * (orden.dir === "desc" ? 1 : -1);
        return a.nombre.localeCompare(b.nombre, "es");
      }
    }
  });

  const nA = clientes.filter(function (c) { return c.estado === "Activo"; }).length;
  const nP = clientes.filter(function (c) { return c.estado === "Pendiente"; }).length;
  const nD = clientes.filter(function (c) { return c.estado === "Devuelto"; }).length;

  function tab(val, txt, n) {
    return '<button class="tab' + (filtro === val ? " on" : "") + '" onclick="setFiltro(\'' + val + '\')">' + txt +
      ' <span class="n num">' + n + '</span></button>';
  }
  function th(col, txt, alinear) {
    const activa = orden.col === col;
    const ico = activa ? (orden.dir === "asc" ? svg("up", 12) : svg("down", 12)) : svg("updown", 12);
    return '<th class="sortable"' + (alinear ? ' style="text-align:' + alinear + '"' : "") + ' onclick="ordenarPor(\'' + col + '\')">' +
      '<span class="th-in">' + txt + '<span class="sort-ico">' + ico + '</span></span></th>';
  }

  let cuerpo;
  if (lista.length === 0) {
    cuerpo = '<tr><td colspan="7"><div class="panel-vacio">' +
      '<div class="ico">' + svg("search", 20) + '</div>' +
      '<p class="t">No hay resultados</p>' +
      '<p class="s">Ajusta la búsqueda o el filtro, o crea un cliente con «Nuevo cliente».</p>' +
      '</div></td></tr>';
  } else {
    cuerpo = lista.map(function (c) {
      const activo = c.estado === "Activo";
      const devuelto = c.estado === "Devuelto";
      const rank = rankMap[c.id];
      const punto = activo ? "ok" : devuelto ? "danger" : c.urgente ? "danger" : c.sinRespuesta ? "warn" : "warn";
      const etiqueta = activo ? "Activo" : devuelto ? "Devuelta" : c.urgente ? "Urgente" : "Pendiente";
      return '<tr' + (devuelto ? ' class="fila-devuelta"' : "") + '>' +
        '<td class="num" style="width:44px;color:var(--text-3)">' + (rank ? ("#" + rank) : "—") + '</td>' +
        '<td class="c-nombre">' + esc(c.nombre) +
        (c.intentos > 1 ? '<span class="etq intentos" title="Veces enviada">' + c.intentos + 'º envío</span>' : "") + '</td>' +
        '<td class="c-tipo">' + (c.tipo ? esc(c.tipo) : '<span class="sin-dato">sin definir</span>') + '</td>' +
        '<td><span class="estado"><span class="dot ' + punto + '"></span>' + etiqueta + '</span></td>' +
        '<td class="c-fecha num">' +
        (activo
          ? (c.fechaActivacion
            ? ("Activo desde " + fmt(c.fechaActivacion) + (c.diasHastaActivar != null ? " · tardó " + c.diasHastaActivar + "d" : ""))
            : "Código creado")
          : (c.fechaEnvio ? fmt(c.fechaEnvio) : '<span class="sin-dato">sin fecha</span>')) +
        '</td>' +
        '<td style="text-align:right">' +
        (!activo && c.diasEspera != null
          ? '<span class="pill-dias num' + (c.urgente ? " rojo" : (c.sinRespuesta ? " ambar" : "")) + '">' + c.diasEspera + ' ' + (c.diasEspera === 1 ? "día" : "días") + '</span>'
          : '<span style="color:var(--text-3)">—</span>') +
        '</td>' +
        '<td style="width:150px"><div class="acciones">' +
        (activo
          ? '<button class="ico-btn" title="Volver a pendiente" onclick="volverPendiente(\'' + c.id + '\')">' + svg("undo", 14) + '</button>'
          : '<button class="ico-btn verde" title="Le dieron código" onclick="activar(\'' + c.id + '\')">' + svg("check", 15) + '</button>') +
        (!activo && !devuelto
          ? '<button class="ico-btn ambar" title="Me la devolvieron" onclick="pedirDevolucion(\'' + c.id + '\')">' + svg("rotate", 14) + '</button>'
          : "") +
        '<button class="ico-btn" title="Editar" onclick="abrirForm(\'' + c.id + '\')">' + svg("pencil", 14) + '</button>' +
        '<button class="ico-btn rojo" title="Eliminar" onclick="pedirEliminar(\'' + c.id + '\')">' + svg("trash", 14) + '</button>' +
        '</div></td></tr>';
    }).join("");
  }

  return '<div class="toolbar"><div class="tabs">' +
    tab("Todos", "Todos", clientes.length) +
    tab("Pendiente", "Pendientes", nP) +
    tab("Devuelto", "Devueltas", nD) +
    tab("Activo", "Activos", nA) +
    '</div></div>' +
    '<div class="tabla-wrap"><table>' +
    '<thead><tr>' +
    th("prioridad", "Prioridad") + th("nombre", "Cliente") + th("tipo", "Negocio") +
    th("estado", "Estado") + th("fecha", "Fecha") + th("dias", "Espera", "right") +
    '<th></th></tr></thead>' +
    '<tbody>' + cuerpo + '</tbody>' +
    '</table></div>' +
    '<p class="tabla-pie">' + lista.length + ' de ' + clientes.length +
    ' clientes · clic en un encabezado para ordenar · los cambios se guardan en el servidor</p>';
}

/* ---------- atajos ---------- */
document.addEventListener("keydown", function (e) {
  const escribiendo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement && document.activeElement.tagName);
  if (e.key === "Escape") { cerrarModal(); return; }
  if (escribiendo) return;
  if (e.key === "/") { e.preventDefault(); document.getElementById("buscador").focus(); }
  if (e.key === "n" || e.key === "N") { e.preventDefault(); abrirForm(); }
  if (e.key === "v" || e.key === "V") { e.preventDefault(); setVista("verificar"); }
});

/* ---------- inicio ---------- */
document.getElementById("icoSearch").innerHTML = svg("search", 14);
document.getElementById("icoPlus").innerHTML = svg("plus", 14);
document.getElementById("btnExportar").innerHTML = svg("download", 13) + " Exportar";
document.getElementById("btnImportar").innerHTML = svg("upload", 13) + " Importar";
document.getElementById("btnSalir").innerHTML = svg("salir", 13) + " Salir";
document.getElementById("fechaHoy").textContent = fmt(hoyISO());
const nodoVersion = document.getElementById("appVersion");
if (nodoVersion) nodoVersion.textContent = APP_VERSION;
document.getElementById("inputPdf").addEventListener("change", function () {
  if (this.files && this.files[0]) {
    const archivo = this.files[0];
    ver.archivoOriginal = archivo;
    /* Vaciar el input: si no, volver a elegir el MISMO archivo no
       dispara change y parece que la aplicación se colgó. */
    this.value = "";
    recibirArchivo(archivo);
  }
});

/* Cualquier error que nadie atrape se muestra en pantalla. Un fallo
   silencioso en JavaScript deja la interfaz a medio pintar sin decir
   nada, y desde afuera es indistinguible de «no funciona». */
function mostrarFallo(texto) {
  let banda = document.getElementById("bandaFallo");
  if (!banda) {
    banda = document.createElement("div");
    banda.id = "bandaFallo";
    banda.className = "banda-fallo";
    document.body.appendChild(banda);
  }
  banda.innerHTML =
    '<div class="bf-txt"><b>Algo falló · ' + APP_VERSION + '</b><pre>' + esc(texto) + '</pre></div>' +
    '<button class="bf-x" onclick="this.parentNode.remove()">Cerrar</button>';
}

window.addEventListener("error", function (e) {
  mostrarFallo((e.message || "error") + "\n" + (e.filename || "") + ":" + (e.lineno || "") + ":" + (e.colno || ""));
});
window.addEventListener("unhandledrejection", function (e) {
  const r = e.reason;
  mostrarFallo("Promesa rechazada: " + (r && r.message ? r.message : String(r)) +
               (r && r.stack ? "\n" + r.stack : ""));
});
activarSoltar();
vista = "verificar";  // la puerta de entrada es revisar un paquete
render();      // primer pintado con estado vacío
refrescar();   // carga real desde la API
