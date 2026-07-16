/* Capa de rutas: mapa de la API. */
const { Router } = require("express");
const c = require("../controllers/clientesController");

const router = Router();

router.get("/clientes", c.listar);
router.post("/clientes", c.crear);
router.put("/clientes/:id", c.actualizar);
router.patch("/clientes/:id/estado", c.cambiarEstado);
router.delete("/clientes/:id", c.eliminar);

router.get("/resumen", c.resumen);
router.get("/actividad", c.actividad);
router.get("/export", c.exportar);
router.post("/import", c.importar);

module.exports = router;
