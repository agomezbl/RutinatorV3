# Rutineitor v3 — informe de pruebas y auditoría

**Fecha:** 13 de septiembre de 2026 · **Versión:** 3.1.0
**Resultado:** 250 pruebas automáticas, 250 pasan, 0 fallan. Revisión adicional en
navegador real (Chromium) sin errores ni problemas de diseño, con las pantallas
comprobadas dos veces: vacías (primer día) y llenas de datos.

Cómo repetirlo todo en un solo comando:

```
npm run verificar
```

Eso compila los archivos finales, ejecuta las 250 pruebas y después abre la app en
un navegador real para revisarla y sacar capturas.

---

## 1. Cómo se ha probado (no solo "debería funcionar")

Hay **cuatro capas** de prueba, cada una comprueba algo distinto:

| Capa | Archivo | Qué comprueba | Nº |
|---|---|---|---|
| Lógica pura | `tests/core.test.mjs` | Las reglas del sistema (créditos, semana, ocio, sudoku) sin interfaz | 52 |
| v3.1 | `tests/v31.test.mjs` | Estrellas, stakings, sueño, hábitos, tokenomics, escenas y gráficas | 45 |
| Funcional real | `tests/app.test.mjs` | El **archivo final publicado** cargado en un navegador simulado: se pulsan botones de verdad | 19 |
| Auditoría | `tests/audit.test.mjs` | Seguridad, cero red en la demo, validez de los archivos, revisión del código | 18 |
| Navegador real | `tools/revision-navegador.mjs` | Chromium a 390×844 y a 1280×900: consola, desbordes, service worker, modo sin internet | — |

Lo importante de la segunda capa: **no se prueban los módulos sueltos, se prueba
el `index.html` que te vas a llevar**. Si el compilador rompiera algo al juntar
los archivos, estas pruebas lo verían.

---

## 2. Errores reales que encontraron las pruebas (y que ya están arreglados)

No es una lista decorativa: estos fallos existían y las pruebas los cazaron.

1. **El saldo salía 0 si se consultaba con una fecha que no fuera el lunes.**
   `saldoSemana()` esperaba el identificador de la semana y devolvía 0 en
   silencio si se le pasaba "hoy". Arreglado normalizando la fecha dentro de la
   función, para que nadie pueda equivocarse.
2. **El informe de salud económica ignoraba los bonus y las multas**, así que
   decía "sin datos" aunque hubiera movimientos. Ahora un ajuste positivo cuenta
   como ganado y uno negativo como gastado.
3. **Una devolución se contaba como si fuera dinero ganado.** Ahora una anulación
   cuenta como lo que anula: devolver una compra resta de lo gastado, no suma a
   lo ganado.
4. **El icono tenía un trozo blanco** en el anillo (PIL sustituye el canal alfa
   en vez de mezclarlo). Corregido.
5. **La demo seguía mencionando el service worker y el servicio de nube** aunque
   no los usara. Ahora el módulo de red se **sustituye entero** en el build de
   demo, así que ni el código ni el texto llegan al archivo.
6. **La descarga del resumen fallaba** en navegadores sin `createObjectURL`.
   Ahora hay una alternativa con `data:`.

---

## 3. Lista completa de pruebas ejecutadas

### Reglas del sistema (52)

**Escapado y utilidades**

- `esc` escapa los caracteres peligrosos de HTML
- `escAttr` escapa además las comillas
- Las fechas de referencia son los días que decimos (semana que empieza en lunes)
- `minutosDeHora` valida el formato
- `hashClave` es estable y distinto por clave

**Tareas y ledger**

- Marcar una tarea anota el crédito como provisional y aprobar lo consolida
- Vetar revierte el crédito sin borrar nada del historial
- Vetar funciona también después de aprobar
- No se puede marcar dos veces la misma tarea el mismo día
- Tarea de elección: exige opción válida y paga lo que corresponde
- Tarea obligatoria vale 0 pero cuenta en el cumplimiento
- Desmarcar solo funciona mientras está pendiente
- La auto-aprobación solo salta pasadas las horas configuradas (y es idempotente)
- **El ledger es la única fuente: el saldo y el gráfico por categoría cuadran**
- El ajuste manual exige motivo y queda en el ledger
- La tarea puntual solo aparece en su día

**Multiplicador**

- Afecta a lo ganado y nunca a lo gastado
- Ámbitos: siempre, fin de semana, entre semana, solo hoy
- Nunca da créditos a una tarea obligatoria

**Tienda y ocio**

- No se puede comprar sin saldo suficiente
- Comprar descuenta al instante y denegar devuelve el crédito
- Aprobar una compra la deja activa ese día y no se puede repetir
- El bono de móvil respeta el tope semanal (2 días)
- El extra de anime exige tener antes el bono base **aprobado**
- El bono de anime nunca puede costar 0: tiene suelo de precio
- Pasada la hora de corte no se puede comprar ocio, salvo Modo Búho
- El Modo Búho vale solo para el día en que se pidió
- Un bloque del horario que bloquea ocio impide comprar durante su franja
- "Día sin tareas" deja solo las obligatorias
- PC: entre semana necesita pase, el fin de semana es libre
- PC: la sesión cronometrada factura por bloques empezados
- El fin de semana no admite pase de PC (no hace falta)

**Semana, hucha y racha**

- Lo que sobra al cerrar la semana cae a la hucha y el saldo semanal queda a 0
- Una semana en negativo arrastra el déficit en vez de vaciar la hucha
- La racha sube si se supera el umbral y se resetea si no
- El cierre de semana **no toca** el calendario de citas
- El objetivo de ahorro calcula lo que falta y estima semanas por ritmo real
- Si se borra el premio fijado como objetivo, el objetivo lo avisa sin romperse
- El informe de salud diagnostica generoso, ajustado o equilibrado

**Horario y calendario**

- Un bloque con "requiere preparación" genera su tarea automáticamente
- `validarBloque` rechaza horas imposibles
- El calendario guarda eventos con fecha real y sobrevive a las semanas
- `validarEvento` exige título y fecha correcta
- La rejilla del mes tiene 42 celdas y empieza en lunes
- Los recordatorios saltan en la ventana de 5 minutos
- Los objetivos circadianos cambian entre semana y fin de semana

**Sudoku**

- El puzzle del día es el mismo para la misma fecha y distinto cada día
- La cuadrícula generada es un sudoku válido (filas, columnas y cajas)
- El puzzle deja huecos y la comprobación detecta errores
- Solución única garantizada (se verifica al generarlo)

**Sincronización granular**

- El store escribe registro a registro y emite una operación por escritura
- Dos escrituras en registros distintos no se pisan
- `datosDeSemana` devuelve todo lo que necesita el resumen descargable

### Funcionales sobre el archivo publicado (19)

- La app arranca, pinta la pantalla de inicio y la navegación
- La navegación cambia de vista (tareas, tienda, agenda, calendario)
- Marcar una tarea desde la interfaz suma créditos y se puede deshacer
- Una tarea de doble opción abre el diálogo y paga lo elegido
- Las tareas obligatorias se ven como tales y no dan créditos
- Sin saldo, el botón de comprar está desactivado y explica por qué
- Con saldo se puede pedir un bono y queda pendiente de aprobación
- Pasada la hora de corte la tienda no deja comprar ocio, salvo Modo Búho
- El panel del padre exige crear una clave la primera vez (**no hay clave de fábrica**)
- La clave guardada no se almacena en claro en ningún sitio
- El padre aprueba una tarea y el crédito deja de ser provisional
- Vetar exige motivo y devuelve el crédito (nada se borra: se añade la anulación)
- Crear una cita para dentro de tres semanas y encontrarla allí
- El horario permite crear un bloque y valida las horas
- El sudoku se pinta, acepta números y comprueba
- Nil puede cambiar de tema y se aplican las variables de color
- El tema del padre es independiente del de Nil
- Lo marcado sobrevive a cerrar y volver a abrir la app
- Cerrar la semana traspasa el sobrante a la hucha desde el panel

### Auditoría (18)

**Inyección de código (se prueban 6 ataques distintos en cada punto)**

Vectores usados: `<script>`, `"><img onerror=…>`, `' onmouseover='…`,
`</textarea><script>`, y texto con `&`, `<`, comillas y apóstrofes.

- Nombre de tarea del catálogo
- Nombre y descripción de premio de la tienda
- Título y notas de una cita del calendario
- Color de una cita (no puede romper el atributo `style`)
- Título de un bloque del horario **y de la tarea que genera**
- Motivo de veto, motivo de denegación y concepto de ajuste manual
- Nombre del hijo y ajustes de texto
- El resumen semanal descargable también escapa el texto

En todos los casos se comprueba que no se ejecuta nada, que no aparece ningún
atributo `on…` en el documento y que el texto se ve literal.

**Cero red en la demo**

- La demo no contiene `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `sendBeacon`, `importScripts`, `serviceWorker`, ninguna URL `http(s)://`,
  ningún `<script src>`, ninguna hoja de estilo externa, ningún `@import`
- La demo arranca sola, se declara como DEMO y usa un almacén separado
- En Chromium, abierta como `file://`, hace **0 peticiones** de red
- La app normal, en cambio, sí registra el service worker y enlaza el manifest

**Validez y revisión del código**

- Los dos archivos finales son HTML y JavaScript válidos (un único script en línea)
- El manifest y el service worker son correctos (icono maskable incluido)
- Ninguna interpolación de HTML sin escapar (y una prueba que verifica que **el
  propio detector funciona**)
- El núcleo no genera HTML: por eso basta con escapar en las vistas
- No se usa `innerHTML` con datos fuera de la capa de plantillas
- No hay ninguna clave ni PIN por defecto en el código

### Revisión en navegador real

Chromium, pantalla de móvil 390×844 y escritorio 1280×900:

- 0 errores de consola en todas las pantallas
- 0 peticiones externas (ni fuentes de Google, ni CDN, ni nada)
- Ningún desbordamiento horizontal en ninguna pantalla, ni en el panel del padre
- Ningún botón por debajo de 30 px de alto (objetivo táctil)
- Service worker registrado y manifest servido correctamente
- **La app abre con la red cortada** (modo avión simulado)
- La demo abierta como archivo local funciona y no pide nada a la red
- 13 capturas guardadas en `capturas/`

---

## 4. Lo que NO se ha podido probar automáticamente

Por honestidad, esto queda pendiente de tu prueba manual:

- **La instalación real en el móvil de Nil** (el diálogo "Instalar aplicación" es
  del navegador; se ha verificado que el manifest y el service worker son
  correctos, que es lo que lo habilita).
- **Las notificaciones del navegador**: se ha probado la lógica que decide cuándo
  disparar el aviso, no el aviso del sistema en sí.
- **La cámara**: la compresión de fotos se ha revisado en código; hace falta un
  móvil real para probar el flujo de "hacer foto".
- **La sincronización con Supabase**: el código está escrito y el SQL preparado,
  pero no se ha podido probar contra tu proyecto real porque hace falta tu URL y
  tu clave. El propio botón "Probar y guardar" de la app hace esa comprobación
  contra tu servidor antes de guardar nada.

---

## 5. Lo añadido en la v3.1 (45 pruebas más)

### Errores reales que cazaron estas pruebas

1. **`--test-force-exit` estaba truncando la ejecución.** El comando de pruebas
   mataba el proceso antes de tiempo y a veces se quedaban tests sin correr (89
   declarados, 80 ejecutados). Quitado: ahora siempre corren todos.
2. **La validación de horas aceptaba `25:00`.** Tenía el formato correcto y no
   existe. Ahora se valida el valor, no solo la forma.
3. **Editar un valor de tokenomics cerraba el apartado** en el que estabas
   trabajando. Ahora se recuerda qué grupos están desplegados.
4. **El billete denegado no se sellaba.** Se quedaba sin el sello "anulado".
5. **El halo del sol se veía como una mancha** con borde duro: era un círculo
   plano con opacidad. Ahora es un degradado radial.

### Segunda moneda (estrellas)

- Las estrellas son una cuenta aparte y no se mezclan con los créditos
- Una tarea obligatoria da estrellas al aprobarse, nunca créditos
- Vetar una obligatoria ya aprobada devuelve las estrellas
- Los hábitos de cuidado se aprueban solos y pagan en estrellas
- Los hábitos no cuentan en el cumplimiento de las tareas de casa
- Completar todos los hábitos del día da el premio **una sola vez**
- El multiplicador de créditos nunca toca las estrellas
- Un regalo físico se paga con estrellas y no con créditos

### Stakings

- **Depósito**: bloquea, vence y paga el interés; el patrimonio total no cambia al bloquear
- Romper un depósito devuelve el capital pero no el interés
- No se puede bloquear más de lo que hay libre, ni por debajo del mínimo
- Los depósitos se pueden desactivar desde el panel
- **Interés de la hucha**: se abona una vez por periodo y respeta el tope
- **Apuesta**: se gana manteniendo la racha; al romperla se pierde el % configurado
- La apuesta tiene tope máximo y solo se admite una a la vez
- **Sueño**: paga por noche cumplida y no castiga las falladas
- Una misma noche no se cuenta dos veces
- El cierre de semana paga el bonus de racha y resuelve la apuesta

### Sueño y ritmo circadiano

- Apuntar dentro del margen da el bonus; pasarse no quita nada
- La madrugada cuenta como la noche anterior (00:40 es más tarde que 23:45)
- La racha de noches suma y paga el bonus extra cada N noches, a la hucha
- Una noche fallada corta la racha
- No se puede apuntar dos veces la misma noche, salvo corrigiendo (y entonces
  el bonus anterior **se anula**, no se borra)
- La media de sueño sale de las noches apuntadas
- Los consejos cambian según la hora y según lo que ha pasado estos días

### Salud y ritmo natural

- **El catálogo de hábitos no menciona peso, calorías, dieta ni grasa** (se
  comprueba palabra por palabra)
- **No hay comida entre los premios** que se compran con estrellas
- Los comentarios de salud no hablan del cuerpo
- El resumen del día, la racha de días completos y la rejilla de dos semanas

### Tokenomics

- Cada parámetro valida sus límites de verdad (mínimos, máximos, tipos, opciones)
- Todos los campos declarados tienen etiqueta y un tipo conocido
- Todos los parámetros del panel existen en los ajustes por defecto
- La simulación avisa cuando la economía deja de permitir ahorro

### Temas y escenas (fondos de canvas)

- El momento del día se reparte en cuatro tramos
- El catálogo tiene **17 escenas completas**: cada una con nombre, emoji, paleta
  completa, cielo para los cuatro momentos y sus dos funciones de dibujo, y hay
  al menos cinco de estilo cyberpunk/matrix
- **Las 17 escenas × 4 momentos** dibujan varios fotogramas seguidos sin
  romperse, contra un contexto 2D de mentira que caza coordenadas no finitas y
  colores rotos; además cada una tiene que pintar un mínimo de trazos y usar
  algún degradado (si no, se vería plana)
- Aguantan pantallas raras: muy estrecha, muy ancha y cuadrada
- Bajar la calidad quita trabajo de verdad, y con la animación apagada no falla
- La misma escena se dibuja igual siempre, también diez fotogramas después
- **Ninguna escena usa `Math.random`** dentro de un fotograma (se leen los
  archivos): si lo hiciera, no sería reproducible
- Los temas antiguos (`cosmos`, `invierno`, `fuego`, `amazonas`, `desierto`)
  siguen funcionando por alias, y un tema inventado no deja la app en gris
- Cada tema deja la interfaz vestida (todas las variables de color) y tiene
  degradado de respaldo por si el canvas no estuviera disponible
- Las calidades que puede elegir Nil existen todas en el motor, y la automática
  nunca llega a congelar el fondo sola

### El fondo a pantalla completa

- El botón del ojo aparta la interfaz para ver el fondo, y vuelve sola al tocar
- En modo padre ese botón no aparece

### Gráficas

- Producen SVG válido y etiquetan los valores
- La de noches marca el objetivo y distingue las cumplidas
- La rejilla de hábitos y el aro de progreso se pintan
- **Aguantan quedarse sin datos** sin sacar NaN ni undefined
- La serie de la hucha rellena todos los días, también los que no hay movimiento

### En navegador real, además

- Las 10 pantallas de Nil y las 6 pestañas del panel, sin desbordes
- El panel de tokenomics **escribe de verdad** en los ajustes y **rechaza** un
  valor fuera de límites
- El fondo es un lienzo que cubre la pantalla y usa la densidad de píxeles real
- Mide el lienzo de verdad: variedad de color, relieve de luz, que **cambie entre
  fotogramas** (que no esté congelado) y que no se aclare tanto que se coma el
  texto; se comprueba escena por escena, las 17
- Va a **más de 24 fotogramas por segundo**, el parallax reacciona al movimiento
  y **todo se para cuando la app no se ve** (y vuelve al mostrarla)
- Bajar la calidad se aplica, apagarla deja de dibujar del todo y volver a
  automática arranca otra vez
- Las pantallas se revisan dos veces: vacías y con seis semanas de datos
  sembrados, comprobando que no aparece ningún NaN

## 6. Lo de esta ronda: los fondos de verdad (canvas)

Los fondos anteriores eran SVG con cuatro capas y animaciones CSS: correctos,
pero planos. Se han rehecho como escenas de canvas y, de paso, las pruebas nuevas
cazaron cuatro fallos reales antes de que llegaran al móvil de Nil:

1. **La lluvia se salía del array.** `cuantos()` escala con el tamaño de
   pantalla, así que en una tablet en horizontal pedía más gotas de las que
   existían y la escena reventaba (`Cannot read properties of undefined`). Se
   añadió `cuantosDe()`, que nunca pasa del tamaño de la lista.
2. **`mezclar()` no sabía leer su propio resultado.** Devolvía `rgb(...)` pero
   solo aceptaba hexadecimal, así que al encadenar dos mezclas salía
   `rgb(NaN,...)`: un color inválido que el canvas ignora en silencio. La ciudad
   entera dejaba de dibujarse y no había ningún error en consola. Ahora
   `hexARgb()` acepta las dos formas y nunca devuelve NaN.
3. **La calidad automática podía congelar el fondo.** La escalera llegaba hasta
   "apagado", y un fondo quieto parece una app colgada. Ahora la automática se
   queda en "baja"; apagarlo es una decisión de Nil.
4. **El tema sobrio ignoraba la calidad.** Dibujaba lo mismo en alta que en baja.

Y una prueba que dependía del reloj: la de comprar un bono fallaba si se
ejecutaba en horario de colegio, porque el horario por defecto bloquea el ocio de
8 a 17 entre semana. Ahora la prueba aparta el horario a propósito (el bloqueo
tiene su propia prueba, aparte).

Además se rehicieron las escenas que se veían pobres —ciudad neón, lluvia de
código, neuronas, partículas y la sobria—, se añadieron tres nuevas (Atardecer
Neón, Túnel de Datos y el Plano Técnico) y se pasó la interfaz a cristal
translúcido, porque el fondo mejor dibujado no sirve de nada si las tarjetas lo
tapan del todo.

## 7. La v3.3: la capa de juego (59 pruebas más)

### Errores reales que cazaron estas pruebas

1. **El número que vuela no volaba desde la pantalla de Tareas.** El saldo solo
   existía en el panel de inicio, así que al marcar desde Tareas —que es donde
   más se marca— el efecto no tenía destino y no salía. Lo cazó la revisión en
   navegador. Se arregló poniendo el saldo en la cabecera, siempre a la vista:
   además de dar destino al efecto, es información útil en todas las pantallas.
2. **Apagar los efectos no los apagaba del todo.** El módulo se guardaba una
   copia del ajuste al arrancar. Si el ajuste cambiaba por otro camino (desde el
   panel del padre, o sincronizado desde el otro móvil) los efectos seguían
   saliendo. Ahora se lee el estado en vivo cada vez.
3. **Una violación de capas.** `desbloqueos.js` importaba el catálogo de escenas,
   que arrastra el motor de canvas al núcleo. Se invirtió la dependencia y se
   añadió una prueba de auditoría que falla si `core/` importa de `ui/` o
   `themes/`, o si usa `document`, `window` o `localStorage`.

### Y una comprobación de que las pruebas sirven

Se rompió el código a propósito en dos sitios (que el escudo no salvara la racha,
y que se pudiera rechazar una propuesta sin motivo) y se comprobó que las pruebas
fallaban. Fallaron las tres que tenían que fallar. Una prueba que no se ha visto
fallar nunca no demuestra nada.

### Nivel y experiencia (7)

- La experiencia sale del ledger: no hay ningún contador que desincronizar
- **Gastar créditos no baja la experiencia**: lo ganado, ganado está
- **Vetar una tarea sí resta** la experiencia que había dado, sola
- Los traspasos al cerrar la semana no inventan experiencia
- La curva sube siempre y llega al máximo; el nivel dice cuánto falta

### Racha con escudo (7)

- Cumplir sube la racha; fallar sin escudo la parte
- **El escudo la salva**: no la sube, pero tampoco la parte, y se gasta
- Se gana uno cada N semanas, con tope, y con el tope a 0 se comporta como antes
- El récord no se pierde al fallar, y el próximo hito es siempre el que falta
- Cerrar la semana aplica el escudo de verdad y lo deja anotado en el archivo

### Logros (5)

- Los 38 del catálogo están completos, sin ids repetidos, y ninguno revienta con
  la app recién estrenada
- En una app nueva no hay ninguno conseguido
- Marcar la primera tarea consigue el primero, **y solo se anuncia una vez**
- Los de nivel y hucha usan el contexto que se les pasa

### Misiones (8)

- Son las mismas todo el día y cambian al día siguiente
- Salen tres, todas con título, meta y premio, sin huecos sin rellenar
- El padre puede cambiar cuántas hay, o quitarlas
- Se completan al hacer lo que piden y eso se nota en el multiplicador
- **La bonificación SUMA al multiplicador, no lo multiplica** (x2 + 50 % = x2,5)
- Tiene tope y no se dispara
- **No pagan créditos**: el movimiento del ledger va a cero, y no se apunta dos veces
- Ninguna plantilla se rompe con la app recién estrenada, ningún día de la semana

### Desbloqueos de fondos (7)

- Se empieza con cinco abiertos, uno por familia
- Cada bloqueado dice **exactamente** qué le falta, sin NaN ni undefined
- Subir de nivel abre los que van por nivel; el nivel máximo **no** regala las gestas
- Apagarlos abre los diecisiete; el padre puede regalar uno suelto
- Los cinco de salida no se anuncian, y un desbloqueo no se celebra dos veces
- Todos los fondos del catálogo tienen requisito declarado

### Propuestas de Nil (14)

- Propone y queda esperando; sin motivo de verdad no se envía
- Los valores fuera de rango se rechazan, y hay límite de propuestas abiertas
- Aceptar una de tarea **la crea de verdad** en el catálogo; una de valor cambia
  el precio; una de premio lo mete en la tienda con su moneda
- **Rechazar sin motivo no cuela**: la propuesta sigue abierta
- La contraoferta devuelve la pelota a Nil y no aplica nada todavía
- Contraofertar el mismo número no es una contraoferta
- Al aceptar la contraoferta se aplica **con el número pactado**, no con el pedido
- Una propuesta cerrada no se puede volver a responder

### Reto de la casa (5) y notas al aprobar (4)

- El reto mide lo que dice medir y solo hay uno por semana
- Fallarlo **no cuesta créditos**: no hay castigo, solo el premio que estaba en juego
- Se cierra solo al cerrar la semana
- El padre puede aprobar dejando una nota, con tope de longitud, y Nil la ve

### En navegador real, además

- El panel enseña la barra de nivel y las misiones del día
- Se pintan los 38 logros y **los secretos no enseñan su pista**
- Marcar una tarea **lanza el número que vuela** de verdad
- La celebración llega al fondo (la escena se enciende)
- **Con los efectos apagados no sale ninguno**
- De salida hay 5 fondos abiertos y 12 con candado, y cada candado explica qué falta
- Un fondo bloqueado **no se puede poner ni forzando la acción**
- Al apagar los desbloqueos se ven los 17

## 8. La v3.4: el asistente de primer uso (34 pruebas más)

Esta versión existe por una razón operativa: para mandarle la app a otra
familia, el catálogo de fábrica era un muro. Ahora hay seis preguntas al abrir.

### Un error real que cazó la suite al restaurar el proyecto

Una prueba fallaba **solo los domingos**: elegía una tarea del catálogo entero
en vez de una de las que hay hoy, y el catálogo cambia según el día de la
semana. Es el mismo fallo de diseño que ya apareció con la tienda. Ahora la
prueba coge la tarea de lo que hay en pantalla.

### Cuándo aparece (5)

- Una app recién instalada pide configurarse, y una vez hecho no vuelve a pedirlo
- **Saltarlo deja el catálogo de fábrica intacto**: ni una tarea desactivada, ni
  el nombre cambiado
- Se puede volver a abrir desde el panel
- Los valores de partida salen del estado, no están inventados

### Validación (5)

- El nombre es obligatorio; las horas del colegio tienen que tener sentido
  (salir antes de entrar no vale, 25:00 no existe, hacen falta días marcados)
- Sin colegio no se valida el horario de colegio
- No se puede dejar la app sin ningún bloque: se quedaría sin tareas
- **Una configuración inválida no se aplica a medias**: no toca nada y sigue
  pidiendo configurarse

### Qué cambia de verdad (12)

- El nombre y el tratamiento ("papá", "mamá", "los papás")
- Las horas van donde las lee el ritmo circadiano
- **Quitar un bloque aparta sus tareas, pero NO las borra**: siguen las 26 en el
  catálogo, desactivadas, y volver a marcarlo las devuelve
- Lo apartado desaparece de la lista del día (con una excepción comprobada: las
  tareas de preparación las genera el horario, no el catálogo)
- El ocio que no existe en esa casa desaparece de la tienda, y **un bono
  desactivado no se puede comprar ni intentándolo**
- **Los premios grandes de la hucha no los toca el asistente**
- El horario de colegio se reescribe con los días y horas elegidos, y
  **reconfigurar dos veces no duplica bloques**
- Las extraescolares que haya puesto el padre no se pisan
- La capa de juego se enciende y se apaga según lo elegido
- **Reconfigurar NO toca el progreso**: ledger, logros y racha se quedan

### La pantalla (7, en jsdom sobre el archivo compilado)

- Una app recién instalada abre el asistente, **sin barra de navegación**
- Avanza, vuelve atrás y **no pierde lo escrito**
- Sin nombre no deja pasar y lo dice en pantalla
- El asistente entero deja la app configurada a medida y entra en ella
- Saltarlo entra con el catálogo de fábrica
- Marcar una casilla se ve al instante
- El padre puede reabrirlo desde el panel

### En navegador real, además

- Los **ocho pasos** se recorren uno a uno: todos con título, todos con salida,
  ninguno se sale de la pantalla a 390 px, ninguno con huecos sin rellenar
- Sin nombre, frena de verdad
- Al terminar: el nombre guardado, los bloques quitados apartados, cinco bloques
  de colegio, y la app abierta por dentro
- La demo **no** enseña el asistente: entra directa

### La paleta de las gráficas está validada, no elegida a ojo

Los siete colores de categoría pasan las comprobaciones de separación para
daltonismo (ΔE adyacente 8.4 protan) y de visión normal (19.3, mínimo 15) sobre
fondo oscuro, con contraste ≥ 3:1. Además cada barra lleva siempre icono, nombre
y número: el color refuerza, nunca es el único canal de identidad.
