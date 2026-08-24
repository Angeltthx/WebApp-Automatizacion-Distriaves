# Devoluciones registradas

> **Criterio:** un motivo de devolución solo entra al catálogo de
> revisiones cuando la aplicación puede comprobarlo. Convertirlo en una
> casilla para marcar a mano no evita el olvido: lo traslada, y encima
> cobra un clic en cada paquete. Lo que no se puede medir todavía se
> queda en esta lista hasta que se pueda.
>
> Se probó lo contrario en la v8 —cuatro revisiones manuales sacadas de
> esta misma tabla— y se retiraron en la v9 por eso.

Cada entrada salió de un paquete que un supervisor devolvió. Esta lista
es la fuente de las reglas: antes de inventar una revisión, mirar si el
error está aquí y cuántas veces.

El campo **detectable** dice si la máquina puede verlo hoy:

- `sí` — hay una medición que lo cubre;
- `no, por ahora` — se podría, pero falta saber dónde cae el campo en la
  plantilla (ver «Lo que falta» al final);
- `no` — necesita leer letra manuscrita o comparar con la cédula, y
  ningún OCR es fiable sobre estos escaneos.

---

## Casillas de selección sin marcar

| Caso | Campo | Detectable |
|---|---|---|
| 1 | Tipo de documento (C.C.) sin marcar | no, por ahora |
| 2 | Tipo de empresa (pública / privada / mixta) sin marcar | no, por ahora |

Son círculos impresos que se marcan con una X. Medir tinta dentro de
cada círculo y exigir que al menos uno del grupo esté marcado es
factible: no hay que leer nada, solo contar píxeles oscuros. Falta la
posición de los círculos en la plantilla.

## Campos en blanco

| Caso | Campo | Hoja | Detectable |
|---|---|---|---|
| 3 | Actividad principal | 1 | sí (ya está en `CASILLAS_OBLIGATORIAS`) |
| 4 | Número de documento de identidad (representante legal) | 1 | no, por ahora |
| 5 | Tel. móvil | 3 | no, por ahora |
| 6 | Centro suministrador | 3 | no, por ahora |
| 7 | Cliente cercano | 3 | no, por ahora |

Aparecen dos veces el mismo par: número de documento del representante
legal en blanco es el motivo más repetido de los que hay recogidos.

## Valor fijo equivocado

| Caso | Campo | Regla | Detectable |
|---|---|---|---|
| 8 | Lista de precios | siempre `CQ`; se devolvió con `AC` | no |

Es un valor de dos letras manuscritas. Leerlo con OCR y equivocarse es
peor que preguntar.

## No coincide con la cédula

| Caso | Qué pasó | Detectable |
|---|---|---|
| 9 | El formato dice «Montaña», la cédula dice «Montaño» | no |
| 10 | El número de identificación no coincidía con la cédula adjunta | no |

Si el cliente entrega el **RUT descargado de la DIAN**, el número sí se
puede cruzar automático, porque ese PDF trae capa de texto. Contra una
foto de la cédula, no.

## Documento faltante

| Caso | Qué pasó | Detectable |
|---|---|---|
| 11 | Faltaba la página 1 del formato FO901 V.4 | sí (regla `formato-tres-hojas`) |

---

## Lo que falta para automatizar las marcadas «no, por ahora»

Todas necesitan lo mismo: saber entre qué dos líneas de `REFERENCIA` cae
el campo y en qué franja horizontal, para poder añadirlo a `CAMPOS` en
`public/rejilla.js`. Eso no se puede deducir de una foto recortada; hace
falta una hoja completa y bien escaneada de cada una de las tres, con el
diagnóstico encendido, para leer los índices de fila.

Además, para las casillas de selección hace falta una medición nueva:
hoy `tintaEnCampo()` mide una franja rectangular ancha, y un círculo
marcado con una X aporta poca tinta sobre mucha área. Habría que medir
la caja de cada opción por separado y comparar entre ellas, no contra un
umbral fijo.


## Añadido en la v10

Estos tres motivos ya no son "a ojo": se detectan transcribiendo la
casilla y comparando el texto (ver `public/ocr.js` y la sección 1.6 del
CONTEXTO).

| Motivo | Cómo se detecta | Qué NO caza |
|---|---|---|
| El correo no es el mismo en los tres sitios de la hoja 1 | Se transcriben las tres casillas y se comparan normalizadas | Una sola letra cambiada: es indistinguible del ruido de lectura |
| "Lista de precios" no dice CQ | Se transcribe y se compara con CQ | Nada conocido, pero ojo: en el formato existe "CR" a una letra de distancia |
| El nombre del negocio no coincide con el letrero de la foto | Se transcribe el nombre y los letreros de la foto y se busca una palabra propia en común | Si en la foto no se lee ningún nombre, la regla calla (no es motivo de devolución) |
| Código postal en blanco | Sale como casilla vacía en la transcripción | — |

Pendientes de automatizar, con lo que falta para cada uno:

- **Casillas de selección sin marcar** (C.C., tipo de empresa, tipo de
  cliente). Sigue igual que en la v9: hace falta medir la caja de cada
  opción por separado y compararlas entre sí.
- **Resto de casillas de la hoja 3** (Barrio, Municipio, Tel. móvil,
  Canal, Vendedor, Centro suministrador, Grupo Cliente, Zona de
  Transporte, Cliente cercano). Los tramos ya están medidos sobre el
  formato en blanco; falta saber qué valor se espera en cada una.
- **Umbrales de tinta de los campos nuevos.** `CASILLAS_OBLIGATORIAS`
  no tiene entrada para `codigoPostal`, `repLegalCorreo` ni
  `listaPrecios`: calibrarlos exige volver a medir sobre los 24
  paquetes aprobados, y ponerles un número a ojo sería inventarlo. Para
  esos tres, "vacío" lo decide la transcripción, que es una medición.
