/* Capa de servicio: reglas de negocio.
   Aquí viven la validación, los días de espera, la prioridad, las
   devoluciones y las métricas del proceso. No sabe de HTTP ni de SQL.

   Lo que esta capa NO guarda, a propósito: cédulas, correos, direcciones
   y documentos del cliente. El verificador los usa en el navegador y se
   descartan. Aquí solo queda el rastro del trámite. */
const clientesRepo = require("../repositories/clientesRepo");
const actividadRepo = require("../repositories/actividadRepo");
const devolucionesRepo = require("../repositories/devolucionesRepo");

const AVISO_DIAS = 2;      // sin respuesta: toca preguntar
const URGENTE_DIAS = 15;   // lleva demasiado
const ESTADOS = ["Activo", "Pendiente", "Devuelto"];
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

class ErrorNegocio extends Error {
  constructor(mensaje, codigo = 400) { super(mensaje); this.codigo = codigo; }
}

/* ---------- utilidades ---------- */
const hoyISO = () => new Date().toISOString().slice(0, 10);

function diasDesde(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const a = new Date(y, m - 1, d);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / 86400000));
}

function enriquecer(c) {
  const esperando = c.estado === "Pendiente" && c.fechaEnvio;
  const diasEspera = esperando ? diasDesde(c.fechaEnvio) : null;
  return Object.assign({}, c, {
    diasEspera: diasEspera,
    sinRespuesta: diasEspera !== null && diasEspera >= AVISO_DIAS,
    urgente: diasEspera !== null && diasEspera > URGENTE_DIAS,
    diasHastaActivar: (c.estado === "Activo" && c.fechaEnvio && c.fechaActivacion)
      ? Math.max(0, Math.round((new Date(c.fechaActivacion) - new Date(c.fechaEnvio)) / 86400000))
      : null,
  });
}

function validar({ nombre, tipo, estado, fechaEnvio }) {
  if (!nombre || !String(nombre).trim()) throw new ErrorNegocio("El nombre del cliente es obligatorio.");
  if (!ESTADOS.includes(estado)) throw new ErrorNegocio("El estado debe ser 'Activo', 'Pendiente' o 'Devuelto'.");
  if (fechaEnvio != null && fechaEnvio !== "" && !RE_FECHA.test(fechaEnvio))
    throw new ErrorNegocio("La fecha de envío debe tener formato AAAA-MM-DD.");
  return {
    nombre: String(nombre).trim(),
    tipo: String(tipo || "").trim(),
    estado: estado,
    fechaEnvio: fechaEnvio || null,
  };
}

/* ---------- consultas ---------- */
function listar({ estado, q } = {}) {
  let lista = clientesRepo.listar().map(enriquecer);
  if (estado && ESTADOS.includes(estado)) lista = lista.filter((c) => c.estado === estado);
  if (q) {
    const t = q.toLowerCase();
    lista = lista.filter((c) =>
      c.nombre.toLowerCase().includes(t) || (c.tipo || "").toLowerCase().includes(t));
  }
  return lista;
}

function colaPrioridad() {
  const pendientes = clientesRepo.listar().map(enriquecer).filter((c) => c.estado === "Pendiente");
  const conFecha = pendientes.filter((c) => c.fechaEnvio).sort((a, b) => b.diasEspera - a.diasEspera);
  const sinFecha = pendientes.filter((c) => !c.fechaEnvio);
  return [...conFecha, ...sinFecha].map((c, i) => Object.assign({}, c, { prioridad: i + 1 }));
}

function resumen() {
  const todos = clientesRepo.listar().map(enriquecer);
  const cola = colaPrioridad();
  return {
    total: todos.length,
    activos: todos.filter((c) => c.estado === "Activo").length,
    pendientes: cola.length,
    devueltos: todos.filter((c) => c.estado === "Devuelto").length,
    sinRespuesta: cola.filter((c) => c.sinRespuesta).length,
    urgentes: cola.filter((c) => c.urgente).length,
    umbralAviso: AVISO_DIAS,
    umbralUrgencia: URGENTE_DIAS,
    cola: cola,
  };
}

/* Lo que el proceso no mide hoy y esta herramienta sí puede medir. */
function metricas() {
  const todos = clientesRepo.listar().map(enriquecer);
  const tiempos = todos.map((c) => c.diasHastaActivar).filter((d) => d != null);
  const promedio = tiempos.length
    ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length * 10) / 10 : null;
  const ordenados = tiempos.slice().sort((a, b) => a - b);
  const mediana = ordenados.length
    ? (ordenados.length % 2
      ? ordenados[(ordenados.length - 1) / 2]
      : (ordenados[ordenados.length / 2 - 1] + ordenados[ordenados.length / 2]) / 2)
    : null;

  const conIntentos = todos.filter((c) => c.intentos > 1).length;
  return {
    muestras: tiempos.length,
    promedioDias: promedio,
    medianaDias: mediana,
    peorDias: ordenados.length ? ordenados[ordenados.length - 1] : null,
    mejorDias: ordenados.length ? ordenados[0] : null,
    conDevolucion: conIntentos,
    tasaDevolucion: todos.length ? Math.round(conIntentos / todos.length * 1000) / 10 : 0,
    motivos: devolucionesRepo.porMotivo(),
  };
}

/* ---------- casos de uso ---------- */
function crear(datos) {
  const limpio = validar(datos);
  const creado = clientesRepo.crear(Object.assign({}, limpio, {
    fechaActivacion: limpio.estado === "Activo" ? hoyISO() : null,
    intentos: limpio.estado === "Pendiente" ? 1 : 0,
  }));
  actividadRepo.registrar("neutro", "Cliente agregado: " + creado.nombre);
  return enriquecer(creado);
}

/* El verificador termina aquí: registrar el envío no es un paso aparte,
   es la consecuencia de haber revisado el paquete. */
function registrarEnvio({ nombre, tipo }) {
  if (!nombre || !String(nombre).trim()) throw new ErrorNegocio("Falta el nombre del cliente.");
  const existente = clientesRepo.porNombre(nombre);

  if (existente) {
    const actualizado = clientesRepo.actualizar(existente.id, {
      nombre: String(nombre).trim(),
      tipo: String(tipo || existente.tipo || "").trim(),
      estado: "Pendiente",
      fechaEnvio: hoyISO(),
      fechaActivacion: null,
      intentos: (existente.intentos || 1) + 1,
    });
    actividadRepo.registrar("warn", "Reenvío #" + actualizado.intentos + ": " + actualizado.nombre);
    return enriquecer(actualizado);
  }

  const creado = clientesRepo.crear({
    nombre: String(nombre).trim(),
    tipo: String(tipo || "").trim(),
    estado: "Pendiente",
    fechaEnvio: hoyISO(),
    fechaActivacion: null,
    intentos: 1,
  });
  actividadRepo.registrar("neutro", "Creación enviada: " + creado.nombre);
  return enriquecer(creado);
}

function actualizar(id, datos) {
  const actual = clientesRepo.porId(id);
  if (!actual) throw new ErrorNegocio("El cliente no existe.", 404);
  const limpio = validar(datos);
  const cambioEstado = actual.estado !== limpio.estado;
  const actualizado = clientesRepo.actualizar(id, Object.assign({}, limpio, {
    fechaActivacion: cambioEstado
      ? (limpio.estado === "Activo" ? hoyISO() : null)
      : actual.fechaActivacion,
  }));
  actividadRepo.registrar(
    cambioEstado ? (limpio.estado === "Activo" ? "ok" : "warn") : "neutro",
    cambioEstado
      ? actualizado.nombre + " pasó a " + limpio.estado.toLowerCase()
      : "Datos actualizados: " + actualizado.nombre
  );
  return enriquecer(actualizado);
}

function cambiarEstado(id, estado) {
  const actual = clientesRepo.porId(id);
  if (!actual) throw new ErrorNegocio("El cliente no existe.", 404);
  if (!ESTADOS.includes(estado)) throw new ErrorNegocio("Estado no válido.");
  if (actual.estado === estado) return enriquecer(actual);

  const actualizado = clientesRepo.actualizar(id, {
    nombre: actual.nombre, tipo: actual.tipo, estado: estado,
    fechaEnvio: actual.fechaEnvio,
    fechaActivacion: estado === "Activo" ? hoyISO() : null,
  });
  const texto = estado === "Activo" ? "Código activado para " + actualizado.nombre
    : estado === "Devuelto" ? "Devuelta la creación de " + actualizado.nombre
      : actualizado.nombre + " volvió a pendiente";
  actividadRepo.registrar(estado === "Activo" ? "ok" : "warn", texto);
  return enriquecer(actualizado);
}

/* Marcar una devolución guarda el motivo: de ahí sale la lista de los
   errores que más cuestan, que es el dato que hoy nadie tiene. */
function devolver(id, motivo) {
  const actual = clientesRepo.porId(id);
  if (!actual) throw new ErrorNegocio("El cliente no existe.", 404);
  if (!motivo || !String(motivo).trim()) throw new ErrorNegocio("Anota por qué la devolvieron: es lo que sirve para no repetirlo.");

  const actualizado = clientesRepo.actualizar(id, {
    nombre: actual.nombre, tipo: actual.tipo, estado: "Devuelto",
    fechaEnvio: actual.fechaEnvio, fechaActivacion: null,
  });
  devolucionesRepo.registrar(id, String(motivo).trim());
  actividadRepo.registrar("danger", "Devuelta: " + actual.nombre + " — " + String(motivo).trim());
  return enriquecer(actualizado);
}

function eliminar(id) {
  const actual = clientesRepo.porId(id);
  if (!actual) throw new ErrorNegocio("El cliente no existe.", 404);
  clientesRepo.eliminar(id);
  actividadRepo.registrar("danger", "Cliente eliminado: " + actual.nombre);
}

function historial(id) {
  const actual = clientesRepo.porId(id);
  if (!actual) throw new ErrorNegocio("El cliente no existe.", 404);
  return devolucionesRepo.deCliente(id);
}

function exportar() {
  return {
    exportado: new Date().toISOString(),
    clientes: clientesRepo.listar(),
    devoluciones: devolucionesRepo.todas(),
  };
}

function importar(cuerpo) {
  const lista = Array.isArray(cuerpo) ? cuerpo : cuerpo && cuerpo.clientes;
  if (!Array.isArray(lista)) throw new ErrorNegocio("El respaldo debe contener una lista de clientes.");
  for (const c of lista) {
    if (!c || typeof c.nombre !== "string" || !ESTADOS.includes(c.estado))
      throw new ErrorNegocio("El archivo no tiene el formato de un respaldo de Distriaves.");
  }
  clientesRepo.reemplazarTodos(lista);
  actividadRepo.registrar("ok", "Respaldo importado (" + lista.length + " clientes)");
  return { importados: lista.length };
}

function actividad() {
  return actividadRepo.ultimos(30);
}

module.exports = {
  listar, resumen, metricas, crear, registrarEnvio, actualizar, cambiarEstado,
  devolver, eliminar, historial, exportar, importar, actividad,
  ErrorNegocio, AVISO_DIAS, URGENTE_DIAS, ESTADOS,
};
