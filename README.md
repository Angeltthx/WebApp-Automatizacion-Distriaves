# Distriaves · Gestión de Creación de Clientes

Aplicación web para hacer seguimiento a la creación de códigos de compra de clientes:
quién está **Activo**, quién sigue **Pendiente**, cuántos días lleva esperando cada uno
y en qué orden de prioridad atenderlos.

## Arquitectura por capas

```
distriaves-app/
├── server.js                  Punto de entrada (levanta el servidor HTTP)
├── src/
│   ├── app.js                 Configuración de Express (middlewares + rutas)
│   ├── routes/api.js          CAPA DE RUTAS — mapa de la API
│   ├── controllers/           CAPA DE CONTROLADORES — traduce HTTP ↔ servicio
│   ├── services/              CAPA DE SERVICIOS — reglas de negocio
│   │                          (validación, días de espera, prioridad, historial)
│   ├── repositories/          CAPA DE REPOSITORIOS — único lugar con SQL
│   ├── db/                    Conexión SQLite + migraciones + datos iniciales
│   └── middleware/            Manejo uniforme de errores
├── public/                    CAPA DE PRESENTACIÓN — frontend (HTML/CSS/JS)
├── tests/                     Pruebas de integración de la API
└── data/                      Base de datos SQLite (se crea sola al arrancar)
```

Regla de dependencia: cada capa solo conoce a la de abajo.
Las rutas llaman controladores, los controladores llaman servicios, los servicios
llaman repositorios. Si un día cambian SQLite por Postgres, solo se reescriben
los archivos de `repositories/` y `db/`.

## Requisitos

- Node.js **22.5 o superior** (usa el SQLite nativo de Node, sin instalar nada extra).

## Correr en local

```bash
npm install
npm start          # → http://localhost:3000
```

Para desarrollo con recarga automática: `npm run dev`.

La primera vez crea `data/distriaves.db` y la siembra con los 18 clientes iniciales.
Al ser SQLite, la base es un archivo: respaldarla es copiar ese archivo (o usar
el botón **Exportar** de la interfaz).

## Pruebas

```bash
npm test
```

Corre 6 pruebas de integración contra una base temporal (no toca los datos reales).

## API

| Método | Ruta                        | Descripción                                  |
|--------|-----------------------------|----------------------------------------------|
| GET    | `/api/clientes?estado=&q=`  | Lista clientes (con días de espera y urgencia) |
| POST   | `/api/clientes`             | Crea un cliente                              |
| PUT    | `/api/clientes/:id`         | Edita un cliente                             |
| PATCH  | `/api/clientes/:id/estado`  | Cambia el estado (`{"estado":"Activo"}`)     |
| DELETE | `/api/clientes/:id`         | Elimina un cliente                           |
| GET    | `/api/resumen`              | Totales + cola de prioridad                  |
| GET    | `/api/actividad`            | Últimos movimientos                          |
| GET    | `/api/export`               | Descarga respaldo JSON                       |
| POST   | `/api/import`               | Restaura un respaldo (reemplaza todo)        |

## Desplegar en la web

El proyecto es un solo servicio Node (la API sirve también el frontend), así que
cualquier hosting de Node lo corre. Pasos generales con **Render** (tiene plan gratuito):

1. Sube el proyecto a un repositorio de GitHub (sin `node_modules`, ya está en `.gitignore`).
2. En Render: **New → Web Service**, conecta el repositorio.
3. Configura: *Build command* = `npm install` · *Start command* = `npm start`.
4. Render asigna el puerto por la variable `PORT` (la app ya la lee).

⚠️ **Importante — persistencia en el hosting:** en los planes gratuitos de servicios
como Render el disco es *efímero*: se borra en cada reinicio o nuevo despliegue,
y con él el archivo SQLite. Opciones, de menor a mayor esfuerzo:

- Usar la app y **exportar respaldos** con frecuencia (el botón Exportar), reimportando si se reinicia.
- Contratar un **disco persistente** en el hosting y apuntar la variable de entorno
  `DATABASE_PATH` a esa ruta (p. ej. `/var/data/distriaves.db`).
- Migrar el repositorio a **Postgres** gestionado (Render, Neon, Supabase ofrecen planes gratuitos);
  gracias a la separación por capas, solo hay que reescribir `src/repositories/` y `src/db/`.

Verifica los pasos exactos y los planes vigentes en la documentación del hosting que elijas,
porque cambian con frecuencia.

## Variables de entorno

| Variable        | Por defecto              | Uso                            |
|-----------------|--------------------------|--------------------------------|
| `PORT`          | `3000`                   | Puerto del servidor            |
| `DATABASE_PATH` | `./data/distriaves.db`   | Ubicación del archivo SQLite   |

## Nota

La app no tiene autenticación: cualquiera con la URL puede ver y modificar los datos.
Para uso interno en una red de confianza está bien; si va a quedar pública en internet,
agrega al menos una contraseña (por ejemplo, HTTP Basic Auth con un middleware)
antes de compartir la URL.
