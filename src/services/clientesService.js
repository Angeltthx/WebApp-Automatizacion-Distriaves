/* Capa de servicio: reglas de negocio.
   Aquí viven la validación, los días de espera, la prioridad y el historial.
   No sabe nada de HTTP ni de SQL. */
const clientesRepo = require("../repositories/clientesRepo");
const actividadRepo = require("../repositories/actividadRepo");

const URGENTE_DIAS = 15;
const ESTADOS = ["Activo", "Pendiente"];
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
  const diasEspera = c.estado === "Pendiente" && c.fechaEnvio ? diasDesde(c.fechaEnvio) : null;
  return { ...c, diasEspera, urgente: diasEspera !== null && diasEspera > URGENTE_DIAS };
}

function validar({ nombre, tipo, estado, fechaEnvio }) {
  if (!nombre || !String(nombre).trim()) throw new ErrorNegocio("El nombre del cliente es obligatorio.");
  if (!ESTADOS.includes(estado)) throw new ErrorNegocio("El estado debe ser 'Activo' o 'Pendiente'.");
  if (fechaEnvio != null && fechaEnvio !== "" && !RE_FECHA.test(fechaEnvio))
    throw new ErrorNegocio("La fecha de envío debe tener formato AAAA-MM-DD.");
  return {
    nombre: String(nombre).trim(),
    tipo: String(tipo || "").trim(),
    estado,
    fechaEnvio: fechaEnvio || null,
  };
}

/* ---------- casos de uso ---------- */
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
  const conFecha = pendientes.filter((c) => c.fechaEnvio)
    .sort((a, b) => b.diasEspera - a.diasEspera);
  const sinFecha = pendientes.filter((c) => !c.fechaEnvio);
  return [...conFecha, ...sinFecha].map((c, i) => ({ ...c, prioridad: i + 1 }));
}

function resumen() {
  const todos = clientesRepo.listar();
  const cola = colaPrioridad();
  return {
    total: todos.length,
    activos: todos.filter((c) => c.estado === "Activo").length,
    pendientes: cola.length,
    urgentes: cola.filter((c) => c.urgente).length,
    umbralUrgencia: URGENTE_DIAS,
    cola,
  };
}

function crear(datos) {
  const limpio = validar(datos);
  const creado = clientesRepo.crear({
    ...limpio,
    fechaActivacion: limpio.estado === "Activo" ? hoyISO() : null,
  });
  actividadRepo.registrar("neutro", `Cliente agregado: ${creado.nombre}`);
  return enriquecer(creado);
}

function actualizar(id, datos) {
  const actual = clientesRepo.porId(id);
  if (!actual) throw new ErrorNegocio("El cliente no existe.", 404);
  const limpio = validar(datos);
  const cambioEstado = actual.estado !== limpio.estado;
  const actualizado = clientesRepo.actualizar(id, {
    ...limpio,
    fechaActivacion: cambioEstado
      ? (limpio.estado === "Activo" ? hoyISO() : null)
      : actual.fechaActivacion,
  });
  actividadRepo.registrar(
    cambioEstado ? (limpio.estado === "Activo" ? "ok" : "warn") : "neutro",
    cambioEstado
      ? `${actualizado.nombre} pasó a ${limpio.estado.toLowerCase()}`
      : `Datos actualizados: ${actualizado.nombre}`
  );
  return enriquecer(actualizado);
}

function cambiarEstado(id, estado) {
  const actual = clientesRepo.porId(id);
  if (!actual) throw new ErrorNegocio("El cliente no existe.", 404);
  if (!ESTADOS.includes(estado)) throw new ErrorNegocio("Estado no válido.");
  if (actual.estado === estado) return enriquecer(actual);
  const actualizado = clientesRepo.actualizar(id, {
    nombre: actual.nombre, tipo: actual.tipo, estado,
    fechaEnvio: actual.fechaEnvio,
    fechaActivacion: estado === "Activo" ? hoyISO() : null,
  });
  actividadRepo.registrar(
    estado === "Activo" ? "ok" : "warn",
    estado === "Activo"
      ? `Código activado para ${actualizado.nombre}`
      : `${actualizado.nombre} volvió a pendiente`
  );
  return enriquecer(actualizado);
}

function eliminar(id) {
  const actual = clientesRepo.porId(id);
  if (!actual) throw new ErrorNegocio("El cliente no existe.", 404);
  clientesRepo.eliminar(id);
  actividadRepo.registrar("danger", `Cliente eliminado: ${actual.nombre}`);
}

function exportar() {
  return { exportado: new Date().toISOString(), clientes: clientesRepo.listar() };
}

function importar(cuerpo) {
  const lista = Array.isArray(cuerpo) ? cuerpo : cuerpo && cuerpo.clientes;
  if (!Array.isArray(lista)) throw new ErrorNegocio("El respaldo debe contener una lista de clientes.");
  for (const c of lista) {
    if (!c || typeof c.nombre !== "string" || !ESTADOS.includes(c.estado))
      throw new ErrorNegocio("El archivo no tiene el formato de un respaldo de Distriaves.");
  }
  clientesRepo.reemplazarTodos(lista);
  actividadRepo.registrar("ok", `Respaldo importado (${lista.length} clientes)`);
  return { importados: lista.length };
}

function actividad() {
  return actividadRepo.ultimos(30);
}

module.exports = {
  listar, resumen, crear, actualizar, cambiarEstado, eliminar,
  exportar, importar, actividad, ErrorNegocio, URGENTE_DIAS,
};
