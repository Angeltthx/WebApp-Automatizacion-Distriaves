/* Capa de rutas: mapa de la API. */
const { Router } = require("express");
const c = require("../controllers/clientesController");
const a = require("../controllers/authController");
const n = require("../controllers/notificacionController");
const o = require("../controllers/ocrController");
const { exigirSesionApi } = require("../middleware/auth");

const router = Router();

/* Abiertas: entrar y saber si hay sesión. */
router.post("/auth/entrar", a.entrar);
router.get("/auth/yo", a.yo);

/* De aquí para abajo, todo exige sesión. */
router.use(exigirSesionApi);

router.post("/auth/salir", a.salir);
router.post("/auth/clave", a.cambiarClave);

router.get("/clientes", c.listar);
router.post("/clientes", c.crear);
router.post("/clientes/envio", c.registrarEnvio);
router.put("/clientes/:id", c.actualizar);
router.patch("/clientes/:id/estado", c.cambiarEstado);
router.post("/clientes/:id/devolucion", c.devolver);
router.get("/clientes/:id/historial", c.historial);
router.delete("/clientes/:id", c.eliminar);

router.get("/ocr/estado", o.estado);
router.post("/ocr", o.transcribir);

router.get("/notificacion", n.estado);
router.post("/notificar", n.enviar);

router.get("/resumen", c.resumen);
router.get("/metricas", c.metricas);
router.get("/actividad", c.actividad);
router.get("/export", c.exportar);
router.post("/import", c.importar);

module.exports = router;
