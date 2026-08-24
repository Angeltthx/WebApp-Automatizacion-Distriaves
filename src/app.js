/* Capa de aplicación: configura Express, middlewares y rutas. */
const express = require("express");
const path = require("path");
const rutasApi = require("./routes/api");
const { manejarErrores, noEncontrado } = require("./middleware/errores");
const { identificar, exigirSesionWeb } = require("./middleware/auth");
const { migrar, asegurarUsuario, sembrarClientes } = require("./db/migrar");

migrar();
const sembrados = sembrarClientes();
if (sembrados) console.log("\n  Cargados " + sembrados + " clientes ya creados.");
const nuevo = asegurarUsuario();
if (nuevo) {
  console.log("\n  Usuario creado: " + nuevo.usuario);
  if (nuevo.clave) {
    console.log("  Contraseña:     " + nuevo.clave);
    console.log("  Anótala: no se vuelve a mostrar. Cámbiala desde la app.\n");
  }
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "30mb" }));  // el PDF viaja en base64
app.use(identificar);

/* API */
app.use("/api", rutasApi);

/* Motor de PDF: viaja con el proyecto, no depende de internet. */
const rutaPdfjs = path.dirname(require.resolve("pdfjs-dist/package.json"));
app.use("/vendor", express.static(path.join(rutaPdfjs, "build"), {
  setHeaders: function (res, ruta) {
    if (ruta.endsWith(".mjs")) res.setHeader("Content-Type", "text/javascript; charset=utf-8");
  },
}));

/* Frontend: la aplicación exige sesión, el login no. */
app.use(exigirSesionWeb);
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(noEncontrado);
app.use(manejarErrores);

module.exports = app;
