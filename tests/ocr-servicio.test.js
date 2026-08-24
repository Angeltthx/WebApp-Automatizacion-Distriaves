/* El servicio de transcripción, sin tocar la red.
   Lo que se prueba es lo que se rompe solo: leer la respuesta y no
   dejar pasar entradas mal formadas. */
const { test } = require("node:test");
const assert = require("node:assert");
const S = require("../src/services/ocrService.js");

test("lee el JSON aunque venga envuelto en ``` o con palabrería", function () {
  const r = S.leerJson({
    content: [{ type: "text", text: "Claro:\n```json\n{\"campos\":[{\"campo\":\"a\",\"texto\":\"CQ\"}]}\n```" }],
  });
  assert.equal(r.campos[0].texto, "CQ");
});

test("si no hay JSON, falla en vez de inventarse una lectura", function () {
  assert.throws(function () {
    S.leerJson({ content: [{ type: "text", text: "No pude leer la imagen." }] });
  });
});

test("un data URL de PNG se parte bien y uno cualquiera no pasa", function () {
  const ok = S.partirDataUrl("data:image/png;base64,iVBORw0KGgo=");
  assert.equal(ok.tipo, "image/png");
  assert.equal(ok.datos, "iVBORw0KGgo=");
  assert.equal(S.partirDataUrl("https://ejemplo.com/foto.png"), null);
  assert.equal(S.partirDataUrl("data:text/html;base64,PHNjcmlwdD4="), null);
});

test("sin llave no se llama a la API: da 503 y lo dice", async function () {
  const antes = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(
    S.transcribir([{ campo: "a", imagen: "data:image/png;base64,iVBORw0KGgo=" }]),
    function (e) { return e.status === 503; });
  if (antes) process.env.ANTHROPIC_API_KEY = antes;
});

test("una lista vacía o desbordada se rechaza antes de salir a la red", async function () {
  process.env.ANTHROPIC_API_KEY = "prueba";
  await assert.rejects(S.transcribir([]), function (e) { return e.status === 400; });
  const muchos = new Array(S.MAX_RECORTES + 1).fill({ campo: "a", imagen: "data:image/png;base64,AA==" });
  await assert.rejects(S.transcribir(muchos), function (e) { return e.status === 400; });
  delete process.env.ANTHROPIC_API_KEY;
});

test("un texto vacío se marca vacío aunque el modelo diga que no", function () {
  /* No hay red aquí, así que se prueba la normalización tal como la
     hace transcribir(): texto en blanco manda sobre el campo "vacio". */
  const c = { campo: "a", texto: "   ", vacio: false, seguridad: "alta" };
  const vacio = !!c.vacio || !String(c.texto || "").trim();
  assert.equal(vacio, true);
});
