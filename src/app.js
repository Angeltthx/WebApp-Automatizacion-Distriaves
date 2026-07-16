/* Capa de aplicación: configura Express, middlewares y rutas. */
const express = require("express");
const path = require("path");
const rutasApi = require("./routes/api");
const { manejarErrores, noEncontrado } = require("./middleware/errores");
const { migrar } = require("./db/migrar");

migrar(); // asegura esquema y datos iniciales antes de atender peticiones

const app = express();
app.use(express.json({ limit: "1mb" }));

// API
app.use("/api", rutasApi);

// Frontend estático
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(noEncontrado);
app.use(manejarErrores);

module.exports = app;
