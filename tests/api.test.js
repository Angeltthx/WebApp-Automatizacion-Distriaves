/* Pruebas de integración de la API con el runner nativo de Node.
   Usa una base de datos temporal para no tocar la real. */
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

/* Base temporal y credenciales conocidas ANTES de cargar la app */
const dirTmp = fs.mkdtempSync(path.join(os.tmpdir(), "distriaves-test-"));
process.env.DATABASE_PATH = path.join(dirTmp, "test.db");
process.env.ADMIN_USER = "prueba";
process.env.ADMIN_PASS = "clave-de-prueba";

const app = require("../src/app");
let servidor, base, cookie;

before(async () => {
  await new Promise((res) => { servidor = app.listen(0, res); });
  base = "http://127.0.0.1:" + servidor.address().port;
});
after(() => { servidor.close(); fs.rmSync(dirTmp, { recursive: true, force: true }); });

/* fetch con la cookie de sesión pegada */
function pedir(ruta, opciones = {}) {
  const cabeceras = Object.assign({ "Content-Type": "application/json" }, opciones.headers);
  if (cookie) cabeceras.Cookie = cookie;
  return fetch(base + ruta, Object.assign({}, opciones, { headers: cabeceras }));
}
const json = (r) => r.json();

/* ---------- sesión ---------- */

test("la API rechaza a quien no ha entrado", async () => {
  const r = await fetch(base + "/api/clientes");
  assert.strictEqual(r.status, 401);
});

test("la contraseña incorrecta no abre sesión", async () => {
  const r = await pedir("/api/auth/entrar", {
    method: "POST", body: JSON.stringify({ usuario: "prueba", clave: "equivocada" }),
  });
  assert.strictEqual(r.status, 401);
});

test("entrar deja una sesión utilizable", async () => {
  const r = await pedir("/api/auth/entrar", {
    method: "POST", body: JSON.stringify({ usuario: "prueba", clave: "clave-de-prueba" }),
  });
  assert.strictEqual(r.status, 200);
  cookie = r.headers.get("set-cookie").split(";")[0];
  assert.match(cookie, /distriaves_sesion=/);

  const yo = await pedir("/api/auth/yo").then(json);
  assert.strictEqual(yo.usuario, "prueba");
});

/* ---------- base limpia ---------- */

test("arranca con los clientes ya creados cargados", async () => {
  const lista = await pedir("/api/clientes").then(json);
  assert.strictEqual(lista.length, 24, "se siembran los clientes que ya existían");
  assert.ok(lista.every((c) => c.estado === "Activo"), "todos entran como activos");
});

test("crear cliente valida el nombre", async () => {
  const r = await pedir("/api/clientes", {
    method: "POST", body: JSON.stringify({ nombre: "  ", estado: "Pendiente" }),
  });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).error, /nombre/i);
});

/* ---------- el flujo que importa ---------- */

test("el verificador registra el envío y arranca el reloj", async () => {
  const c = await pedir("/api/clientes/envio", {
    method: "POST", body: JSON.stringify({ nombre: "Panadería La Espiga", tipo: "Panadería" }),
  }).then(json);

  assert.strictEqual(c.estado, "Pendiente");
  assert.strictEqual(c.intentos, 1);
  assert.strictEqual(c.fechaEnvio, new Date().toISOString().slice(0, 10));
  assert.strictEqual(c.diasEspera, 0);
});

test("reenviar el mismo cliente no lo duplica: suma un intento", async () => {
  const c = await pedir("/api/clientes/envio", {
    method: "POST", body: JSON.stringify({ nombre: "panadería la espiga" }),
  }).then(json);

  assert.strictEqual(c.intentos, 2, "reconoce el nombre aunque cambien mayúsculas");
  const lista = await pedir("/api/clientes").then(json);
  assert.strictEqual(lista.filter((x) => /espiga/i.test(x.nombre)).length, 1);
});

test("una devolución exige motivo y queda contada", async () => {
  const lista = await pedir("/api/clientes").then(json);
  const id = lista.find((x) => /espiga/i.test(x.nombre)).id;

  const sinMotivo = await pedir("/api/clientes/" + id + "/devolucion", {
    method: "POST", body: JSON.stringify({ motivo: "  " }),
  });
  assert.strictEqual(sinMotivo.status, 400);

  const c = await pedir("/api/clientes/" + id + "/devolucion", {
    method: "POST", body: JSON.stringify({ motivo: "Número de cédula ilegible" }),
  }).then(json);
  assert.strictEqual(c.estado, "Devuelto");

  const m = await pedir("/api/metricas").then(json);
  assert.strictEqual(m.motivos[0].motivo, "Número de cédula ilegible");
  assert.strictEqual(m.motivos[0].veces, 1);
});

test("la cola ordena por días de espera y avisa a los 2 días", async () => {
  await pedir("/api/clientes", {
    method: "POST",
    body: JSON.stringify({ nombre: "Asadero El Fogón", estado: "Pendiente", fechaEnvio: "2026-06-20" }),
  });
  const s = await pedir("/api/resumen").then(json);

  assert.strictEqual(s.cola[0].nombre, "Asadero El Fogón", "el más antiguo encabeza la cola");
  assert.strictEqual(s.cola[0].prioridad, 1);
  assert.ok(s.cola[0].diasEspera > 15);
  assert.strictEqual(s.cola[0].urgente, true);
  assert.strictEqual(s.cola[0].sinRespuesta, true);
  assert.strictEqual(s.umbralAviso, 2);
});

test("activar cierra el ciclo y deja medido cuánto tardó", async () => {
  const lista = await pedir("/api/clientes").then(json);
  const id = lista.find((x) => /Fogón/.test(x.nombre)).id;

  const c = await pedir("/api/clientes/" + id + "/estado", {
    method: "PATCH", body: JSON.stringify({ estado: "Activo" }),
  }).then(json);

  assert.strictEqual(c.estado, "Activo");
  assert.ok(c.fechaActivacion);
  assert.ok(c.diasHastaActivar > 15, "guarda cuántos días tardó el trámite");

  const m = await pedir("/api/metricas").then(json);
  assert.strictEqual(m.muestras, 1);
  assert.ok(m.promedioDias > 15);
});

/* ---------- respaldo y borrado ---------- */

test("export e import son simétricos", async () => {
  const exportado = await pedir("/api/export").then(json);
  assert.ok(Array.isArray(exportado.clientes));
  const r = await pedir("/api/import", {
    method: "POST", body: JSON.stringify(exportado),
  }).then(json);
  assert.strictEqual(r.importados, exportado.clientes.length);
});

test("eliminar devuelve 204 y luego 404", async () => {
  const creado = await pedir("/api/clientes", {
    method: "POST", body: JSON.stringify({ nombre: "Efímero", estado: "Pendiente" }),
  }).then(json);
  assert.strictEqual((await pedir("/api/clientes/" + creado.id, { method: "DELETE" })).status, 204);
  assert.strictEqual((await pedir("/api/clientes/" + creado.id, { method: "DELETE" })).status, 404);
});

test("la actividad registra los movimientos", async () => {
  const actividad = await pedir("/api/actividad").then(json);
  assert.ok(actividad.length > 0);
  assert.ok(actividad.some((a) => /Devuelta/.test(a.texto)));
});

test("salir invalida la sesión", async () => {
  await pedir("/api/auth/salir", { method: "POST" });
  assert.strictEqual((await pedir("/api/clientes")).status, 401);
});
