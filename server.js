/* Punto de entrada: levanta el servidor HTTP. */
const app = require("./src/app");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Distriaves Clientes escuchando en http://localhost:${PORT}`);
});
