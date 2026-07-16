/* Pruebas de integración de la API con el runner nativo de Node.
   Usa una base de datos temporal para no tocar la real. */
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Base temporal ANTES de cargar la app
const dirTmp = fs.mkdtempSync(path.join(os.tmpdir(), "distriaves-test-"));
process.env.DATABASE_PATH = path.join(dirTmp, "test.db");

const app = require("../src/app");
let servidor, base;

before(async () => {
  await new Promise((res) => { servidor = app.listen(0, res); });
  base = "http://127.0.0.1:" + servidor.address().port;
});
after(() => { servidor.close(); fs.rmSync(dirTmp, { recursive: true, force: true }); });

const json = (r) => r.json();

test("la semilla carga 18 clientes con 3 pendientes", async () => {
  const lista = await fetch(base + "/api/clientes").then(json);
  assert.strictEqual(lista.length, 18);
  assert.strictEqual(lista.filter((c) => c.estado === "Pendiente").length, 3);
});

test("crear cliente valida el nombre", async () => {
  const r = await fetch(base + "/api/clientes", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "  ", estado: "Pendiente" }),
  });
  assert.strictEqual(r.status, 400);
  const cuerpo = await r.json();
  assert.match(cuerpo.error, /nombre/i);
});

test("flujo completo: crear -> aparece en cola -> activar -> sale de cola", async () => {
  const creado = await fetch(base + "/api/clientes", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "Cliente Prueba", tipo: "Tienda", estado: "Pendiente", fechaEnvio: "2026-06-20" }),
  }).then(json);
  assert.ok(creado.id);
  assert.ok(creado.diasEspera > 15, "debería llevar más de 15 días");
  assert.strictEqual(creado.urgente, true);

  let resumen = await fetch(base + "/api/resumen").then(json);
  assert.strictEqual(resumen.cola[0].nombre, "Cliente Prueba", "el más antiguo encabeza la cola");
  assert.strictEqual(resumen.cola[0].prioridad, 1);
  assert.strictEqual(resumen.urgentes, 1);

  const activado = await fetch(base + "/api/clientes/" + creado.id + "/estado", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "Activo" }),
  }).then(json);
  assert.strictEqual(activado.estado, "Activo");
  assert.ok(activado.fechaActivacion);

  resumen = await fetch(base + "/api/resumen").then(json);
  assert.ok(!resumen.cola.some((c) => c.id === creado.id));
});

test("eliminar devuelve 204 y luego 404", async () => {
  const creado = await fetch(base + "/api/clientes", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: "Efímero", estado: "Pendiente" }),
  }).then(json);
  const del = await fetch(base + "/api/clientes/" + creado.id, { method: "DELETE" });
  assert.strictEqual(del.status, 204);
  const del2 = await fetch(base + "/api/clientes/" + creado.id, { method: "DELETE" });
  assert.strictEqual(del2.status, 404);
});

test("export e import son simétricos", async () => {
  const exportado = await fetch(base + "/api/export").then(json);
  assert.ok(Array.isArray(exportado.clientes));
  const r = await fetch(base + "/api/import", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exportado),
  }).then(json);
  assert.strictEqual(r.importados, exportado.clientes.length);
});

test("la actividad registra los movimientos", async () => {
  const actividad = await fetch(base + "/api/actividad").then(json);
  assert.ok(actividad.length > 0);
  assert.ok(actividad.some((a) => a.texto.includes("Código activado")));
});
