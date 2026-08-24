# Distriaves · Verificador y seguimiento de creación de clientes · v32

La versión se ve abajo a la izquierda, junto a tu usuario, y los
archivos se piden con `?v=32`. Suena a detalle tonto y no lo es: sin eso
no hay forma de saber si el navegador está corriendo el código nuevo o
uno viejo que quedó en caché, y se pierden horas depurando algo que ya
estaba arreglado.

Los motivos de devolución que han llegado están recogidos en
[`docs/devoluciones.md`](docs/devoluciones.md), con cuáles se pueden
detectar hoy y qué falta para el resto.

Herramienta personal para revisar el paquete de documentos **antes** de enviarlo,
registrar el envío sin trabajo extra y saber cuánto está tardando el trámite.

No reemplaza ningún sistema de la empresa. El envío se sigue haciendo por el
formulario de siempre; esto es la revisión previa y el reloj.

---

## La idea

El problema no es llevar una lista de clientes: es que un paquete se devuelve por
una letra reteñida y nadie sabe cuántos días lleva esperando. Una herramienta que
pida *además* anotar el cliente en una página no se usa. Por eso aquí el orden es
al revés:

**revisas el paquete → si pasa, el envío queda registrado solo.**

Anotar el cliente no es un paso: es la consecuencia de haberlo revisado.

---

## Cómo se ve

Sueltas el PDF y se abren las hojas completas, con scroll. Los problemas
aparecen **como recuadros sobre el papel**, en el campo donde están:

- **Rojo** — no deberías enviarlo así.
- **Amarillo** — míralo antes de enviar.
- **Verde** — resuelto.

Sobre el documento va **solo el contorno**. El nombre del campo, el
número y el botón viven en una franja a la derecha de la hoja, unidos
al recuadro por una línea. Antes la etiqueta iba pegada al borde
superior del recuadro y en un formato con renglones de 14 px tapaba
justo el dato que estaba señalando.

Las etiquetas que se pisan se juntan en un bloque y el bloque se centra
sobre el promedio de sus filas, así el desvío se reparte hacia arriba y
hacia abajo en vez de correrse todo hacia abajo. En el bloque de datos
de la hoja 1 —nueve renglones en 120 px— eso baja el desvío máximo de
80 px a 40 px. Está probado sin navegador en `tests/etiquetas.test.js`.

El número del margen es el mismo del panel lateral: pasar el mouse por
cualquiera de los dos enciende el recuadro, la etiqueta y la línea.

Cada etiqueta tiene un botón para dar el hallazgo por bueno. Los rojos
piden un motivo de una lista corta; los amarillos se apagan con un
clic. Cuando no queda ninguno abierto, aparece el botón de confirmar.

**Descargar el paquete (v30).** Debajo del panel hay un botón que baja
el PDF, y está disponible desde que se abre el paquete: no hace falta
confirmar el envío para poder guardarlo. Sale con el nombre
`FO-901 <cliente>.pdf`, el mismo patrón que usa la pestaña Diligenciar,
para que una carpeta de paquetes se pueda ordenar y tenga sentido.

Ojo con lo que es y lo que no: **el archivo es el mismo que soltaste,
con el nombre puesto**. No lleva encima los recuadros, ni las
correcciones, ni las casillas que confirmaste. El análisis vive en la
pantalla y no toca el documento, que es justo lo que permite que el
paquete que mandas sea idéntico al que revisaste.

Ese motivo no es burocracia: es la señal de qué reglas están fallando.
Si «el recuadro señala el lugar equivocado» aparece diez veces, la
plantilla está mal y se corrige con datos.

Cuando el ajuste no da confianza, el recuadro **no finge una casilla**:
se dibuja la franja de la fila de lado a lado, con borde punteado, y la
etiqueta dice `· fila`. Un recuadro angosto sobre la columna equivocada
se lee como «el error está aquí»; la franja dice lo único que de verdad
se sabe.

### Zoom

La hoja entra completa en la columna, que es cómodo para ver dónde caen
los recuadros pero deja la letra manuscrita demasiado pequeña para
juzgar si lo señalado está mal de verdad. La barra de arriba acerca
hasta el 300%, y con la hoja acercada se **arrastra** para moverse por
ella: en horizontal se mueve la hoja, en vertical la página entera.
Apuntar a una barra de desplazamiento de once píxeles cada vez que
quieres mirar otra casilla no es navegar.

Los recuadros van en porcentaje del papel, así que se agrandan **con**
la hoja y siguen señalando lo mismo. El lienzo se vuelve a dibujar con
pdf.js a la resolución nueva en vez de estirarse: si se estirara, la
letra se vería más grande e igual de borrosa, que es justo lo que no
sirve. Hay un tope de 2200 px reales por hoja para no comerse la
memoria con un paquete de ocho páginas.

### Cuando algo falla

Un error de JavaScript que nadie atrapa deja la pantalla a medio pintar
y en silencio. Desde afuera eso es «no funciona» y depurarlo cuesta
varias vueltas de ida y vuelta. Ahora:

- cualquier error suelto sale en una banda roja abajo, con el archivo y
  la línea, y se puede copiar;
- si falla el dibujo de las hojas, el error se pinta **en la columna de
  las hojas**, no la deja vacía. Las marcas de la derecha siguen siendo
  válidas: lo que falló fue el dibujo, no el análisis;
- el botón **Descartar y revisar otro** suelta el paquete y vuelve al
  inicio sin recargar la página. Además vacía el input, que si no,
  volver a elegir el *mismo* archivo no dispara nada y parece que se
  colgó.

Y el visor ya no se monta una sola vez: comprueba el DOM en cada
pintado. Antes bastaba con que cualquier `render()` posterior
reescribiera el contenedor para que las hojas desaparecieran hasta que
recargaras.

### Corregir cuál hoja es cuál

Cuál página es la 1/3, la 2/3 o la 3/3 se decidía por tinta: la 3/3 es
la de mitad inferior más vacía, la 2/3 la que tiene tinta abajo a la
izquierda, donde va la firma. Acertaba en los 5 paquetes con que se
midió y se equivocaba en cuanto la firma se salía de su sitio: el
recuadro de «Firma y huella» acababa dibujado sobre la hoja 3.

Ahora se decide con lo que ya sabe hacer el emparejamiento: se prueba
cada página contra las tres plantillas y gana el reparto que más calza
en total. Las barras de sección son 8, 4 y 2 según la hoja, así que la
señal es fuerte y no depende de dónde firmó nadie. Si ninguna plantilla
engancha, se vuelve al método de la tinta.

Aun así puede fallar, y **todos** los recuadros de dos páginas acaban en
la página que no es.

Ahora la cabecera de cada hoja del formato trae los tres botones. Al
elegir otra, las dos hojas se intercambian y el ajuste se rehace en el
momento, sin volver a abrir el PDF. Por eso el gris de las hojas del
formato se conserva en memoria (~0.9 MB por hoja).

### Diagnóstico

El botón `diagnóstico` de la cabecera dibuja encima de la hoja lo que
vio el detector:

- **azul** — las líneas que encontró en tu escaneo;
- **violeta** — dónde caen las líneas de la plantilla con la escala y
  el corrimiento que eligió;
- **naranja** — las barras de sección que sirvieron de ancla.

Y en la cabecera, los números del ajuste: escala, corrimiento, cuántas
filas calzaron y cuánta cobertura hay arriba y abajo.

Sirve para no discutir a ciegas. Si las violetas están corridas una
fila respecto de las azules, el problema es el emparejamiento; si
faltan azules, el problema es el escaneo; si están encima y el recuadro
igual señala mal, el problema es la plantilla de `CAMPOS`.

## Qué revisa

El PDF se abre **en tu navegador**. No se sube al servidor ni se guarda.

| Revisión | Cómo |
|---|---|
| Las 3 hojas del formato, cédula, RUT y foto del local | Clasifica cada página y tú confirmas en las miniaturas |
| Ninguna página en blanco | Mide tinta por página |
| Escaneo no lavado | Mide grises intermedios; avisa arriba del 60% |
| Firma y huella en la hoja de autorizaciones | Mide tinta en la zona de firma |
| Las hojas van en orden 1/3, 2/3, 3/3 | Perfil de tinta por franjas |
| Cédula y nombre coinciden con el RUT | Lee el RUT digital sin OCR |
| CIIU igual al del RUT | Te muestra el del RUT para copiarlo |
| Correo confirmado con el cliente | Casilla que marcas tú |
| **Casillas vacías** | Mide la tinta dentro de cada casilla y la compara con lo que marca una casilla escrita |
| Sin tachones | No se revisa: ver «Qué no se pregunta» |

### Casillas vacías

Cuando la ubicación de los recuadros es de fiar, se mide la tinta dentro
de cada casilla obligatoria y sale un recuadro rojo sobre las que
llegaron en blanco.

El umbral no es cero: la etiqueta impresa y la raya aportan tinta aunque
nadie escriba. Se compara contra lo que marca una casilla escrita, con
los niveles medidos en los 24 paquetes que ya fueron aprobados.

Sobre esos mismos 24 paquetes dispara dos veces. Una es real: un «Lugar
de visita» que quedó en blanco y aun así pasó. Solo se revisan las
casillas que vienen escritas en los 24; las que a veces van vacías se
dejan en paz, porque marcarlas sería inventar un error.

Solo corre en las hojas donde dos detectores independientes coinciden en
dónde están los campos. En el resto, la pregunta te la sigue haciendo a
ti.

### Qué no se pregunta

Una casilla para marcar a mano cuesta un clic en cada paquete y no
evita ningún olvido: lo traslada. Por eso la herramienta **solo abre
una marca cuando midió algo**, y calla cuando la revisión sale bien o
cuando no pudo hacerla.

Las pocas preguntas manuales que quedan son las que la medición sí
puede acotar pero no cerrar: la foto del local (el color no distingue
una fachada de una cédula fotografiada sobre una mesa) y el CIIU (está
manuscrito; lo que se puede hacer es mostrarte el del RUT al lado).

Lo que no se puede medir todavía —tipo de documento sin marcar, tipo de
empresa, lista de precios distinta de CQ, nombre que no coincide letra
por letra con la cédula— está en
[`docs/devoluciones.md`](docs/devoluciones.md) esperando a que se pueda,
no convertido en una casilla más.

### Lo que no hace, a propósito

- **No lee letra manuscrita.** Sobre escaneos de CamScanner ningún OCR es
  confiable, y un verificador que dice «todo bien» sobre algo que no pudo leer es
  peor que no tener verificador. Cuando no puede leer, lo dice.
- **No envía el formulario solo.** Microsoft Forms no tiene una API pública para
  enviar respuestas, y automatizarlo exigiría guardar credenciales corporativas.
  Lo que sí hace: al confirmar el envío **abre el formulario en otra pestaña**,
  con esta ventana intacta, para que sueltes el PDF ahí mismo. Registrar y no
  enviar es el olvido más caro que hay —queda un trámite contando días que nunca
  salió—, y el momento en que se olvida es justo ese. La pestaña se abre dentro
  del clic, antes de esperar al servidor, o el navegador la bloquearía.
- **No genera el formato prellenado.** Es el siguiente paso natural, pero primero
  hay que confirmar con cumplimiento si aceptan un formato impreso.

### El RUT digital vale oro

Si el cliente entrega el RUT **descargado del portal de la DIAN**, el PDF trae capa
de texto y se lee exacto: cédula, NIT con dígito de verificación, nombre, CIIU,
correo y dirección. Si entrega una foto, no hay nada que leer.

Pídelo descargado siempre que puedas: es la diferencia entre cruces automáticos y
comparar a ojo.

---

## Instalar y correr

Requiere **Node.js 22.5 o superior** (usa el módulo `node:sqlite` nativo).

```bash
npm install
npm start
```

Abre <http://localhost:3000>.

En el primer arranque se crea el usuario y **la contraseña se imprime una sola vez
en la consola**. Anótala. Para fijarla tú:

```bash
ADMIN_USER=olga ADMIN_PASS=tu-clave-larga npm start
```

Pruebas:

```bash
npm test
```

Son tres grupos: la API contra SQLite en memoria, la colocación de las
etiquetas del visor (sin navegador) y el montaje del visor completo en
un DOM de mentira, cargando los scripts en el mismo orden que
`index.html`. El último necesita `jsdom`, que está en
`devDependencies`; si no está instalado, esas pruebas se saltan solas.

Ese grupo existe por un fallo que costó encontrar: `verificar-ui.js`
llamaba a `render()`, que lo define `app.js`, que se carga **después**.
Eso lanzaba un `ReferenceError` en cada carga de la página desde hacía
tiempo y no se notaba, porque debajo de esa línea solo había
declaraciones de función, que se izan. En cuanto apareció una `const`
más abajo, quedó sin inicializar y el visor dejó de dibujar hojas:
pantalla en blanco y ningún mensaje de error a la vista. Ahora las
constantes van al principio del archivo y el primer pintado lo hace
`app.js`, como siempre debió ser.

### Variables

| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Puerto | `3000` |
| `DATABASE_PATH` | Ruta del archivo SQLite | `./data/distriaves.db` |
| `ADMIN_USER` | Usuario inicial | `olga` |
| `ADMIN_PASS` | Contraseña inicial | se genera y se imprime |
| `TELEGRAM_TOKEN` | Token del bot, para la copia del PDF | apagado |
| `TELEGRAM_CHAT_ID` | A qué chat llega la copia | apagado |
| `ANTHROPIC_API_KEY` | Llave para leer las casillas (v10) | apagado |
| `OCR_MODELO` | Qué modelo lee las casillas | `claude-sonnet-5` |

### Leer las casillas (v10)

Tres devoluciones frecuentes no dependen de si la casilla está llena
sino de **qué dice**, así que medir tinta no alcanza:

- el correo va en **tres** sitios de la hoja 1 y los tres tienen que
  llevar el mismo;
- **Lista de precios** (hoja 3) tiene que decir `CQ`;
- el nombre del negocio del formato tiene que aparecer en el **letrero**
  de la foto del local. Si en la foto no se lee ningún nombre, no pasa
  nada: la revisión se calla.

Con `ANTHROPIC_API_KEY` puesta aparece el botón **Leer las casillas**.
Recorta esas casillas del PDF y las manda a transcribir.

**Qué sale de tu equipo.** Recortes de casillas sueltas, nunca el PDF, y
solo cuando pulsas el botón. Son ocho imágenes por paquete. Es la única
cosa de toda la herramienta que sale del navegador, y está puesta a
sabiendas: se cambia privacidad por detección. La llave **no** baja al
navegador; la petición pasa por `/api/ocr` para que se quede en el
servidor.

**Lo que no puede hacer.** Si dos correos salen distintos, no hay forma
de saber si el error está en el formato o en la lectura. Un correo con
una sola letra cambiada es indistinguible del ruido de transcripción.
Lo que sí caza bien es el error grueso: un correo entero distinto, un
`CA` donde iba `CQ`, un letrero de otro negocio. Por eso cada revisión
te enseña **el texto que leyó** al lado del veredicto, y cuando no pudo
leer dice que no pudo, en vez de dar el visto bueno.

### Diligenciar el formato (v12)

Pestaña **Diligenciar**, con dos partes.

**Llenar el formato.** Arriba hay un bloque de autocompletado con dos
zonas: **RUT** y **cédula**. Del RUT —el PDF de la DIAN, no un escaneo—
salen solos el nombre, el documento, el CIIU, la dirección, la ciudad y
el correo. De la cédula no se saca nada, porque lo único que aportaría
ya viene en el RUT.

Los dos quedan **pegados al final del PDF**, así que lo que descargas es
el paquete completo: formato, RUT y cédula, en ese orden.

El Día/Mes/Año viene con la fecha de hoy y las fechas se eligen en un
calendario.

Los campos avisan cuando algo está mal escrito: un correo sin arroba,
una cédula con puntos, un celular de ocho dígitos. Lo que aún no has
escrito no se marca en rojo, solo cuenta como pendiente.

El documento y el nombre del representante se copian del cliente, y si
los cambias a mano se quedan como los pongas.

Respondes el resto y pulsas **Generar el formato**. El PDF aparece a tamaño completo y, si algo está mal,
**haces clic encima del dato** y lo corriges ahí mismo. Las casillas
vacías salen con borde punteado. Nada se regenera mientras escribes.

Lo impreso va con letra manuscrita en azul-negro de bolígrafo, apoyada
en la línea de cada casilla y al mayor tamaño que quepa. Cada letra
lleva su pequeño desvío de altura, giro y tamaño para que no parezca
impresa — pero siempre el mismo para el mismo dato, así que la vista
previa no baila mientras escribes. Si en el papel cuesta leer algún
dato, se vuelve a la letra de palo seco poniendo
`FUENTE_MANUSCRITA = false` en `public/formulario.js`.

**Hay tres letras y se eligen abajo del cuestionario.** Cuál se parece
más al papel no se decide en abstracto: depende del bolígrafo con el
que se escriba ese día. La elección se guarda en el navegador.

Desde la v32 **cada opción se ve escrita en su propia letra, y con el
nombre del cliente que estás escribiendo**. Antes eran tres botones con
el nombre de la tipografía, así que había que elegir a ciegas, generar
el formato y volver atrás si no gustaba. Ahora se ve antes de decidir,
y con el dato de verdad, que es donde se nota si una letra gruesa
aprieta un nombre largo. Si aún no hay cliente, la muestra usa el
nombre de quien firma.

| Letra | Tinta | Ancho | Cómo es |
|---|---|---|---|
| **Short Stack** | 1.00 | 1.00 | Redonda y ligera. La de la v29, y la que viene puesta. |
| **Gochi Hand** | 1.20 | 0.88 | Trazo grueso y redondo. La más parecida a un formato escrito a mano. |
| **Permanent Marker** | 2.25 | 1.09 | La más gruesa. Escribe las minúsculas como mayúsculas pequeñas. |

«Tinta» es cuánta pone cada una respecto de Short Stack con el mismo
texto, cada una a su cuerpo ajustado a la misma casilla; «ancho», lo
mismo para el largo de la línea, que solo llega a mandar en el correo.
Permanent Marker es un 9% más ancha, así que ahí el cuerpo baja un
poco: si el correo se ve apretado, esa es la causa.

Las otras doce manuscritas que se probaron están descartadas **por
medida** y con el motivo escrito en `public/formulario.js`: dos no
traen ñ ni tildes, cuatro van inclinadas y siete son más flojas que la
que ya había, así que no acercaban nada a un escaneo de trazo grueso.
La comparación se hizo poniendo cada una al lado del escaneo real, que
es la lección del error #41.

### Lo que se rellena solo

Hay datos que se repiten en todos los paquetes y escribirlos cada vez
solo daba ocasión de equivocarse. Salen puestos y se pueden cambiar
como cualquier otro campo:

| Campo | Valor |
|---|---|
| Cliente de | Delichicks S.A.S. (marcada en la hoja 1) |
| Vendedor | `10020265` |
| Canal | `03` |
| Cliente cercano | `N/A` |
| Nombre Responsable Comercial | Olga Lucía Lemus |
| Lugar de visita / Ciudad | Bogotá |

Otros se copian de un campo a otro: **el teléfono** va a los tres
sitios donde el formato lo pide, y **la razón social** al nombre del
establecimiento de la hoja 3. Se copian, pero no se atan: si el móvil
de pedidos es distinto del fijo, o el local se llama de otra forma, se
corrige una vez y no se vuelve a pisar.

Debajo de algunos campos salen **atajos**: ciudad (las cinco más
grandes del país), código postal (Suba y Chapinero), ruta y grupo de
cliente. No son listas cerradas — el campo se sigue pudiendo escribir
a mano, porque siempre aparece un cliente en otro barrio u otra
ciudad. La ruta se elige por barrio (`25-L104 (Suba)`) pero en el
papel cae solo el código.

Al elegir ciudad, la casilla **Municipio** de la hoja 3 se rellena con
su departamento — Bogotá lleva Cundinamarca, como en los paquetes ya
enviados.

**Sobre los dos códigos postales:** una localidad de Bogotá no tiene
un código, tiene varios. Suba tiene diez y Chapinero tres. El de Suba
es el que aparece en los paquetes enviados; el de Chapinero es el de
Chapinero Central y alrededores. Si un cliente cae en otro barrio, hay
que escribirlo a mano.

### La firma

La firma de la responsable comercial va estampada en la hoja 3, así
que ya no hace falta imprimir el formato, firmarlo y volver a
escanearlo en cada creación.

Es una firma real, y eso tiene consecuencias: cualquiera que reciba el
PDF puede extraer la imagen y ponerla en otro documento. Es una
decisión tomada a conciencia, no un efecto colateral. Para volver a
firmar a mano basta poner `FIRMA_ESTAMPADA = false` en
`public/formulario.js`: el hueco vuelve a salir en blanco.

Si el PNG falta o no se puede leer, el formato **se genera igual** con
el hueco vacío. Un paquete sin firma se arregla firmando; uno que no
se genera deja a la vendedora sin nada.

### Llenar de prueba

En el bloque de autocompletado hay un enlace que llena el cuestionario
entero con datos inventados. Sirve para mirar cómo cae la letra sin
escribir treinta y ocho campos, que es fricción suficiente como para
dejar de comprobarlo.

Los datos cantan a propósito: «Cliente de Prueba», correos a
`ejemplo.com` y documentos que empiezan por 1000000000, fuera del rango
de cédulas emitidas. Si un formato de prueba se cuela impreso en un
paquete de verdad, tiene que verse a la primera.

**Ciudad** viene con Bogotá y **Municipio** con Cundinamarca. El tipo de
documento del representante se copia del cliente, y si lo cambias a mano
se queda como lo pongas.

El correo se escribe **una vez** y se copia solo a los tres sitios donde
lo pide el formato. La lista de precios viene puesta en `CQ`. Las
casillas que falten salen marcadas en rojo antes de descargar.

La firma y la huella siguen siendo a mano: eso no lo imprime nadie.

**Ordenar las hojas.** Suelta el formato, el RUT, la cédula y la foto
del local —PDF o foto, en cualquier orden— y **arrastra las hojas** para
ponerlas donde quieras; se recolocan mientras arrastras, así ves dónde
va a caer antes de soltar. Gira o quita lo que sobre y descarga el
paquete en un solo PDF.

**Ordenar solo.** El botón compara cada hoja con las tres plantillas del
FO-901 y las coloca: formato 1, 2 y 3, luego el RUT, la cédula y la foto
del local. Tarda unos segundos porque mira hoja por hoja. Lo que no
reconozca lo deja donde estaba y te lo dice.

Cuando el paquete esté armado, **Verificarlo ahora** lo manda directo a
la pestaña Verificar sin que tengas que descargarlo y volver a subirlo.

La foto del local se elige comparando: es la más colorida de las hojas
sueltas, medida sobre la parte no blanca para que no la diluyan los
márgenes. Va de última, con las cédulas justo antes. El aviso te dice
siempre cuál eligió, porque el margen es estrecho.

Las hojas del RUT y de la cédula no se distinguen entre sí, así que
conservan el orden en que las soltaste: suelta primero la cara delantera. Es lo que hacías en una
web de fuera; aquí ningún archivo sale de tu equipo.

### Semáforo de casillas (v11)

Sobre cada hoja se dibuja un recuadro por casilla:

- **verde** — está escrita (o está en blanco, si es de las que van en blanco)
- **amarillo** — no estoy seguro
- **rojo** — no detecto nada donde debería haber algo

El mapa de las 75 casillas sale del formato que marcaste tú, no de una
lista escrita a mano. Se apaga con "ocultar" en el panel, porque tapa la
letra si se deja puesto.

Las casillas que **van en blanco** (el bloque del Aval y el de Cartera)
no se dibujan salvo que tengan algo escrito, y eso solo lo dice la
transcripción: la medida de tinta no acusa a nadie por su cuenta.

**Toca cualquier casilla** sobre la hoja para darla por buena (✓) o
marcarla como mala (✕). Cada recuadro lleva su chulito pegado al borde
derecho.

Los recuadros con **borde punteado** son los de hojas donde el ajuste es
bueno pero las barras de sección no lo respaldan del todo: mira si cada
uno cae en su fila antes de fiarte. Y si alguna hoja se queda sin
rejilla, el panel ofrece pintarla igual. Lo que tú digas manda sobre lo que midió la app,
y las marcas de la derecha se rehacen con tu corrección.

En el visor: **pellizca en el trackpad** para acercar y **arrastra** para
moverte por la hoja. El botón *Pantalla ancha* esconde el panel y le da
toda la pantalla al documento.

**El color de la tinta no es la última palabra.** Medido sobre un paquete
real: de 41 casillas escritas, la tinta dejó 10 en rojo por tener el
trazo corto (una firma, un "NA", un "CA"). Y los círculos de opción
—C.C., NIT, Sí/No— no se pueden medir así: tienen siete píxeles y la
marcada llega a salir más clara que las vacías. Por eso el botón **Leer
las casillas dudosas** manda a transcribir todo lo amarillo, lo rojo y
todos los grupos, y lo que diga la lectura manda sobre la tinta.

Tres casillas se quedan **sin revisar** a propósito: las de "Tipo de
cliente". El formato marcado trae solo una opción de cada par, y si el
cliente es a crédito la marca va en otro sitio. Para activarlas hace
falta un formato con las dos opciones de cada par marcadas.

### Copia del paquete en Telegram

Guarda el PDF que enviaste, con fecha y número de intento. Sirve como
constancia: si te devuelven una creación y la corriges, el original no
se pierde.

**No adelanta el trámite.** El envío a la empresa lo sigues haciendo tú
por el formulario. Esto es tu archivo personal.

Para activarlo:

1. En Telegram, escríbele a `@BotFather` y manda `/newbot`. Te da un token.
2. Escríbele algo a tu bot recién creado.
3. Abre `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` y copia el
   `chat.id` que aparece.
4. Arranca con las dos variables puestas.

Mientras no las definas, el botón avisa que no está configurado y no
rompe nada.

---

## Qué se guarda y qué no

**Se guarda:** nombre del cliente, tipo de negocio, estado, fecha de envío, fecha
de activación, número de intentos y motivos de devolución.

**No se guarda:** el PDF, la cédula, el correo, la dirección ni ningún dato leído
del RUT. Todo eso vive en el navegador mientras revisas y se descarta al cerrar.

Esto es deliberado. Los clientes autorizaron el tratamiento de sus datos a las
empresas del grupo, no a una herramienta particular. Guardar cédulas y documentos
en infraestructura personal es un problema legal y laboral que no vale la pena
tener, y además no hace falta para lo que la herramienta resuelve.

Por la misma razón la base **no viene sembrada con datos de personas reales**.
Si vienes de la versión anterior, tus clientes se conservan: la migración amplía
el esquema sin borrar nada.

---

## La pantalla «Proceso»

Es el motivo por el que vale la pena sostener esto en el tiempo.

Nadie en la cadena mide cuánto tarda una creación de punta a punta, porque nadie
está en los dos extremos: quien la manda no ve la aprobación y quien la aprueba no
ve cuándo se mandó. Tú sí estás en los dos.

Con dos o tres meses de historia esta pantalla responde dos preguntas que hoy no
tienen respuesta: **cuánto tarda en promedio** y **cuáles errores son los que más
la devuelven**. Ese dato es el argumento para pedir cambios, y es más valioso que
el software.

---

## Arquitectura

Dependencia hacia abajo: rutas → controladores → servicios → repositorios.
El SQL vive solo en `repositories/`; cambiar SQLite por Postgres toca esa carpeta
y `db/` y nada más.

```
src/
  app.js                     Express, sesión, estáticos
  routes/api.js              mapa de la API
  controllers/               HTTP <-> servicio
  services/
    clientesService.js       días, prioridad, devoluciones, métricas
    authService.js           scrypt, sin dependencias externas
  repositories/              único lugar con SQL
  db/migrar.js               esquema idempotente, conserva datos
  middleware/                sesión y errores

public/
  rut.js                     lee el RUT digital anclado a la plantilla DIAN
  verificador.js             mide páginas y las clasifica (en el navegador)
  reglas.js                  catálogo de revisiones
  verificar-ui.js            pantalla del verificador
  app.js                     resumen, clientes, proceso
```

### Agregar una revisión

En `public/reglas.js`, un objeto más en la lista:

```js
{
  id: "mi-revision",
  grupo: "Contenido del paquete",
  nivel: "bloqueo",          // bloqueo | aviso | manual
  titulo: "Lo que revisa",
  evaluar: function (c) {
    return c.algo
      ? { estado: "ok", detalle: "Bien." }
      : { estado: "falla", detalle: "Qué corregir." };
  },
}
```

Las de nivel `manual` no necesitan `evaluar`: salen como casilla para marcar.

---

## Cómo se calibraron los umbrales

Los números no son a ojo. Salen de medir 34 páginas de 5 paquetes reales que ya
habían sido aceptados:

- **Página en blanco:** por debajo de 0.15% de tinta. La cédula más tenue del lote
  marcó 0.4%, así que ese es el piso de contenido real.
- **Escaneo lavado:** más de 60% de grises intermedios. Dos RUT fotografiados
  marcaron 62.8% y 88.1%; todo lo legible quedó por debajo.
- **Zona de firma:** más de 0.8% de tinta abajo a la izquierda. Las hojas de
  autorización firmadas marcaron entre 1.4% y 3.8%.
- **Hoja 3/3:** es la de mitad inferior más vacía (2.8–3.6% contra 8.9–23.5%).

Dos cosas se aprendieron rompiéndolas: el color **no** distingue la foto del local
de la cédula (una cédula sobre una mesa de madera marcó 34% de color y una fachada
de vidrio 2.7%), y una cédula con las dos caras en una hoja se parece al formato.
Por eso la clasificación se propone y **la confirmas tú** en las miniaturas.

Sobre los 5 paquetes aceptados, el verificador no levanta ni un bloqueo falso.

---

## Cómo se ubican los recuadros

Para dibujar un cuadro sobre «Nombre o Razón Social» hay que saber dónde
quedó ese campo en tu foto: cada paquete llega con otra escala, otro
recorte y algo de inclinación. Una plantilla de coordenadas fijas no
sirve.

Lo que se hace es detectar las líneas del formulario **sobre tu imagen**
y emparejarlas con las de la plantilla. Medido sobre los 5 paquetes: las
filas coinciden entre escaneos con menos de 0.5% de diferencia, salvo un
corrimiento global, que es justo lo que corrige el emparejamiento.

Dos trampas que aparecieron probando:

- Las filas del formato están casi igual de separadas, así que un calce
  **corrido tres filas** puntúa parecido al correcto. Tres de los cinco
  paquetes caían en ese error. Se resuelve limitando escala y
  corrimiento a lo que físicamente puede pasar con una hoja A4, y dando
  triple peso a los huecos grandes e irregulares del formato.
- Si un escaneo trae el encabezado recortado, las filas de arriba no se
  detectan y la escala queda sin anclaje: el recuadro se va una fila o
  dos. Por eso se exige que las coincidencias cubran arriba **y** abajo
  antes de prometer un recuadro exacto.

### Lo que da hoy, medido sobre 24 paquetes reales

De 69 hojas de formato: **20 con recuadro exacto**, 48 en modo franja
(borde punteado, ubicación aproximada) y 1 sin ajuste posible.

O sea: menos de un tercio consigue precisión de campo. El resto te
señala la zona, no la casilla. Es la parte más floja de la herramienta y
conviene saberlo antes de confiar en ella.

La razón es que la rejilla del formato es casi periódica: un calce
corrido dos filas puntúa igual de bien que el correcto. Se atacó con dos
detectores independientes —las barras oscuras de sección, que no son
periódicas, y la rejilla de filas— y solo se promete precisión **cuando
los dos coinciden**. Eso bajó los recuadros pero también los errores.

Un recuadro en el lugar equivocado destruye la confianza más rápido de
lo que uno correcto la construye, así que el sesgo es hacia decir «no
estoy seguro».

## Pendientes

- Avisar por fuera de la app (correo o Telegram) cuando pasen los días sin respuesta.
- Formato prellenado desde el RUT, si cumplimiento lo acepta.
- Afinar las reglas con los motivos de devolución que se vayan registrando.
