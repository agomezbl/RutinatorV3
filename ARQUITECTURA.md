# Rutineitor v3 — en qué se diferencia por dentro

Las **funciones** son las mismas que describe el encargo. Lo que cambia es cómo
está construido por dentro. Esto es lo que hace que no vuelva a acumular la
misma deuda de diseño.

## 1. Un solo registro de movimientos (ledger) como fuente de verdad

**Antes:** cada pantalla sumaba créditos por su cuenta. El gráfico de categorías
y el saldo salían de dos sitios distintos y por eso daban números diferentes.

**Ahora:** existe `src/core/ledger.js` y **nadie más** suma créditos. El saldo de
la semana, la hucha, el gráfico por categorías, el informe de salud y el resumen
descargable salen todos de la misma lista cronológica.

Consecuencias prácticas:

- **Vetar no hace matemáticas.** No hay ninguna línea que diga "réstale 6". Se
  añade un movimiento de anulación y el saldo, que es una suma, baja solo.
- **Nada se borra.** Un movimiento no se edita ni se elimina: se anula con otro
  que apunta al original. El histórico es auditable.
- Hay una prueba que verifica el invariante: *la suma del gráfico por categorías
  es exactamente igual al saldo*. Si alguien vuelve a duplicar la lógica, falla.

## 2. Sincronización por registro, nunca del estado entero

**Antes:** se escribía el objeto de estado completo en cada cambio, así que dos
dispositivos editando cosas distintas a la vez se pisaban.

**Ahora:** el estado es un conjunto de colecciones de registros pequeños
(`src/core/store.js`). Toda modificación es una operación sobre **un** registro
(`set` / `patch` / `remove`), y esa misma operación es la que viaja a la nube.

- El identificador de una tarea marcada es determinista: `<fecha>__<tareaId>`.
  Si el móvil de Nil y tu portátil marcan lo mismo, escriben el mismo registro en
  vez de duplicarlo.
- Cada preferencia es su propio registro: cambiar el tema no reescribe los precios.
- La marca de tiempo la pone el servidor (un *trigger* de Postgres), no el móvil,
  así que un reloj mal puesto no reordena el historial.
- Prueba incluida: dos dispositivos escribiendo registros distintos no se pisan.

## 3. Escapado de HTML por diseño, no parcheado después

**Antes:** se fue arreglando cada punto de inyección según aparecía el bug.

**Ahora:** la regla está escrita en el código (`src/core/util.js`) y **auditada
por las pruebas**:

- `esc()` para texto que va dentro de HTML, `escAttr()` para texto que va dentro
  de un atributo (escapa además las comillas).
- El **núcleo nunca genera HTML** — hay una prueba que lo verifica —, así que
  solo hay que vigilar las vistas, que es una superficie pequeña y revisable.
- Una prueba recorre el código buscando interpolaciones sin escapar, y **otra
  prueba comprueba que ese detector funciona** (se le dan ejemplos buenos y malos).
- Seis ataques distintos se lanzan contra cada campo de texto que escribe una
  persona: nombres de tareas, premios, citas, bloques, motivos, ajustes y el
  nombre del hijo.

## 4. Los archivos finales se compilan, no se recortan

**Antes:** los distintos builds se generaban recortando y pegando trozos de un
archivo maestro con búsqueda-y-reemplazo. Eso duplicó una cabecera de función y
rompió la sintaxis.

**Ahora:** `build.mjs` usa un empaquetador real (esbuild) y una plantilla con
marcadores (`src/index.template.html`). Las diferencias entre los dos builds
están **declaradas en un solo sitio**, en la constante `BUILDS`:

| | App instalable | Demo |
|---|---|---|
| Cabecera | manifest + iconos | nada |
| Bandera `__DEMO__` | `false` | `true` |
| Módulo de red | `sync.js` real | **sustituido** por `sync-stub.js` |

La demo no lleva el código de red "desactivado con un `if`": lleva **otro módulo**
que no tiene ni una línea de red. Por eso la garantía de "cero peticiones" se
puede comprobar buscando texto en el archivo, y así lo hace la auditoría.

## 5. El mecanismo de "bono de un día" es uno solo

**Antes:** cada categoría de ocio repetía por su cuenta la lógica de "vale solo
hoy, lo aprueba papá".

**Ahora:** hay **un** mecanismo genérico de compra con fecha
(`src/core/leisure.js`). TV, móvil, anime, el extra de anime, el pase de PC y el
Modo Búho son todos el mismo mecanismo con distinta configuración
(`topeSemanal`, `requiereBase`, `precioMinimo`, `categoriaOcio`). Añadir una
categoría nueva es añadir una fila al catálogo, no escribir código.

## 6. La app funciona primero sin conexión

La sincronización es **opcional y añadida**, no el cimiento. El estado vive en el
dispositivo y todo funciona sin internet; si configuras la nube, las mismas
operaciones se suben y se bajan. Esto significa que:

- La app nunca se queda "cargando" porque falle la red.
- Se puede usar sin configurar nada, y decidir más tarde si se sincroniza.
- La demo es exactamente la misma app con el módulo de red sustituido.

## 7. Estructura del código

```
src/
  core/          ← reglas del sistema. Sin HTML, sin navegador, sin red.
    util.js        fechas, horas, escapado, huella de la clave
    ledger.js      fuente única de verdad de los créditos
    store.js       estado con escrituras granulares
    defaults.js    catálogo de tareas, tienda, horario y ajustes
    economy.js     multiplicador, precios, objetivo, salud económica
    tasks.js       marcar, aprobar, vetar, auto-aprobar, cumplimiento
    schedule.js    horario semanal, bloqueo de ocio, tareas generadas
    calendar.js    citas con fecha real
    circadian.js   objetivos, registro de sueño, bonos y consejos
    leisure.js     bonos de un día, tienda, sesión de PC
    week.js        cierre de semana, hucha, racha
    sudoku.js      puzzle diario determinista
    tokenomics.js  registro de TODO lo económico editable + simulación
    gestion.js     (v3.5) saldo continuo, hucha, ajustes, anulaciones, histórico,
                   días pasados, precios en bloque, instrumentos avanzados
    staking.js     depósito, interés, apuesta de racha y compromiso de sueño
    health.js      hábitos de cuidado (presencias, nunca el cuerpo)
  ui/            ← todo lo que toca el navegador
    dom.js         plantillas, modales, avisos (aquí vive el escapado)
    app.js         arranque, navegación, acciones, parallax del fondo
    views-nil.js   tareas, horario, calendario, tienda, sudoku, guía, ajustes
    views-progreso.js panel de control, progreso, billetes, salud, ahorro
    views-padre.js panel del padre: aprobaciones, propuestas, semana, sistema
    views-economia.js (v3.5) Economía, Días pasados y Catálogo
    charts.js      gráficas SVG propias
    services.js    guardado local, fotos, notificaciones, descargas
    sync.js        sincronización opcional  (sync-stub.js en la demo)
    report.js      resumen semanal descargable
  themes/        ← motor de canvas + 17 escenas animadas, 4 momentos del día
  core/progreso.js    ← nivel, racha con escudo y logros (todo derivado del ledger)
  core/misiones.js    ← misiones deterministas del día y de la semana
  core/desbloqueos.js ← qué hace falta para abrir cada fondo
  core/propuestas.js  ← lo que Nil propone y el reto semanal de la casa
  core/onboarding.js  ← el asistente de primer uso: qué pregunta y qué cambia
  ui/celebrar.js      ← el "juice": número que vuela, confeti, vibración, sonido
  styles.css     ← una sola hoja de estilo
build.mjs        ← compilación de los dos archivos finales
tests/           ← 134 pruebas
tools/           ← iconos y revisión en navegador real
```

La regla que mantiene esto ordenado: **`core/` no sabe que existe un navegador**.
Por eso se puede probar entero sin interfaz, y por eso el escapado de HTML solo
hay que vigilarlo en `ui/`.

## 8. Riesgo conocido y aceptado

La lógica de créditos vive en el cliente: no hay servidor propio. Alguien con
conocimientos técnicos podría abrir las herramientas del navegador y cambiar su
saldo. **Es un riesgo asumido**, proporcionado a una app familiar de dos usuarios,
y está dicho tanto en el código como en la guía dentro de la app. Si algún día la
app se abre a más familias, ahí sí haría falta mover la economía a un servidor.

---

## 9. Lo que cambia por dentro en la v3.1

### Una tercera cuenta en el mismo ledger, no un sistema aparte

Las **estrellas** no son un contador nuevo: son una cuenta más del ledger de
siempre (`semana`, `hucha`, `estrellas`). Por eso heredan gratis todo lo que ya
funcionaba: se ganan, se gastan, se anulan al vetar y aparecen en el historial
con las mismas funciones. Y por eso está garantizado que **no se mezclan**: son
sumas de conjuntos distintos de movimientos, no un número que alguien reparte.

Los hábitos de cuidado tampoco son una colección nueva: son tareas del catálogo
con `tipo: 'habito'`, así que el padre los edita, los crea y los borra con las
mismas herramientas que todo lo demás, y la auditoría de inyección los cubre sin
escribir una línea extra.

### Los stakings se apoyan en el ledger, no en un saldo paralelo

Bloquear créditos es un movimiento negativo en la hucha; liquidar es uno
positivo. No hay un campo "bloqueado" que alguien pueda desincronizar: el saldo
de la hucha que se ve en pantalla es siempre el **libre**, y lo bloqueado se
deriva sumando los stakings abiertos. Si el código de stakings desapareciera
mañana, los saldos seguirían cuadrando.

Los cuatro son idempotentes: `procesarStakings` se llama al abrir la app y cada
minuto, y liquidar dos veces es imposible porque el estado del staking cambia en
la misma operación que crea el movimiento.

### v3.5: la economía vuelve a ser como la v2

- **Saldo continuo**: `ledger.saldoCreditos` suma todos los movimientos de la
  cuenta de gasto. El cierre de semana ya no traspasa nada (solo archiva y mueve
  la racha), salvo que se encienda «Cierre semanal» en Avanzado
  (`modoSaldo = 'semanal'`).
- **Hucha voluntaria**: `guardarEnHucha` / `sacarDeHucha` son dos movimientos de
  traspaso con el mismo `refId`: no cuentan como ganado ni como gastado.
- **Lo avanzado no se borra, se apaga**: `INSTRUMENTOS_AVANZADOS` describe cada
  instrumento con los ajustes que fija al encender y al apagar. `migrarEconomia`
  los apaga una sola vez (`versionEconomia = 35`); lo que ya estaba en marcha
  termina su curso. Las «Reglas» del panel esconden los campos de lo apagado.
- **Nada se borra nunca**: `anularMovimiento` añade una anulación con motivo y
  marca el original con `anuladoPor`, igual que el veto de una tarea.
- **Días pasados**: `validarDiaPasado` marca y aprueba con la fecha de ese día
  (hasta 14 atrás) y `recalcularRachaDesde` rehace el cumplimiento y la racha de
  las semanas ya archivadas desde esa en adelante.

### El panel de Reglas (antes «Tokenomics») se dibuja solo

`src/core/tokenomics.js` no tiene lógica: es la **descripción** de cada parámetro
(tipo, límites, ayuda en lenguaje normal). El panel del padre se genera a partir
de esa lista, así que añadir un ajuste nuevo es añadir una línea ahí, no tocar la
interfaz. Y `validarParametro` aplica esos límites de verdad, tanto en la
interfaz como en cualquier prueba: es el mismo código.

Hay una prueba que recorre la lista entera y comprueba que **todos** los
parámetros declarados existen en los ajustes por defecto: no puede haber un campo
en pantalla que no guarde nada.

### Los fondos son escenas de canvas dibujadas fotograma a fotograma

Los fondos dejaron de ser SVG plano. Ahora hay un **motor** (`themes/motor.js`)
que pinta sobre un canvas a pantalla completa, y **17 escenas**
(`themes/escenas/`) que solo saben dos cosas: cómo construir su estado inicial
(`crear`) y cómo dibujarse en un instante dado (`dibujar`). Eso es lo que permite
partículas de verdad, luz aditiva, estelas y profundidad: una ciudad con lluvia y
reflejos, un túnel que viene hacia ti, dendritas con impulsos recorriéndolas.

Cuatro reglas gobiernan el motor:

1. **Determinismo.** Todo el azar sale de un PRNG con semilla, tanto al construir
   la escena como al animarla. No se usa `Math.random` dentro de un fotograma
   —hay una prueba que lee los archivos y lo comprueba—, así que la misma escena
   se ve igual siempre y se puede probar.
2. **Se para cuando no se ve.** Al ocultar la app el bucle se detiene del todo.
3. **Se mide y baja sola.** Vigila los fotogramas reales y baja de nivel de
   detalle si el móvil no llega (alta → media → baja). No baja hasta apagarlo:
   un fondo congelado parece que la app se colgó. Apagarlo lo decide Nil, en
   Ajustes.
4. **Respeta al sistema.** Con "reducir movimiento" dibuja un fotograma y para.

Las escenas se prueban **sin navegador**: las pruebas les pasan un contexto 2D de
mentira que anota cada llamada y falla si aparece una coordenada no finita, un
color roto o una escena que pinta demasiado poco. Y en navegador real se mide el
lienzo de verdad: variedad de color, relieve, que cambie entre fotogramas, los
fotogramas por segundo, el parallax, la pausa al ocultar y que ninguna escena se
aclare tanto que se coma el texto de la cabecera.

### El asistente de primer uso: desactivar, nunca borrar

El catálogo de fábrica está calibrado para un chaval concreto. Para cualquier
otra casa eso era un muro: nadie entra a editar veinte tareas antes de empezar.
El asistente (`core/onboarding.js`) lo resuelve en seis preguntas, y su regla
central es que **nada se borra, se desactiva**. Si una familia dice que no usa
el ordenador, el bono de PC se queda en el catálogo con `activo: false`; si
cambian de opinión en un mes, se reactiva en vez de reescribirse. Lo mismo con
las tareas (`activa: false`), que ya era el mecanismo que respetaban
`tareasDelDia()` y `habitosDelDia()`: el asistente no inventó nada, solo lo usa.

Tres decisiones que están en el código a propósito:

- **No se guarda nada hasta confirmar.** El formulario vive en `ui.asistente`
  mientras se rellena. Salirse a medias no deja la app medio configurada, y una
  configuración inválida no aplica *ninguna* de sus partes
  (`aplicarConfiguracion` valida entero antes de entrar en el `lote`).
- **Reconfigurar no toca el progreso.** Créditos, racha, logros e historial se
  quedan como están: el asistente solo escribe ajustes y banderas de activación.
  Hay una prueba que lo comprueba explícitamente.
- **La demo entra directa.** `__DEMO__` marca `configurado` al arrancar: la demo
  es para enseñarla en treinta segundos, no para que nadie configure una casa
  que no es suya.

El único horario que el asistente reescribe es el del colegio (lo borra y lo
vuelve a crear con los días elegidos, por eso reconfigurar dos veces no
duplica bloques). Las extraescolares que haya puesto el padre no se tocan.

### La progresión no es un contador: se deriva del ledger

La v3.3 añade nivel, racha con escudo y logros. Ninguno guarda un número que
haya que mantener a mano:

- La **experiencia** se calcula recorriendo el ledger y sumando lo ganado. Por
  eso gastarse un premio no te hace retroceder (gastar no es un movimiento
  `ganado`) y vetar una tarea sí resta la experiencia que había dado, solo,
  porque la anulación ya estaba ahí. No existe ningún contador que pueda
  desincronizarse porque no existe ningún contador.
- El **récord de racha** sale del archivo de semanas cerradas.
- Los **logros** se comprueban contra el estado cada vez que se pintan. Lo único
  que se guarda es la fecha en que se consiguió cada uno, para poder enseñarla.

### El escudo de racha, y por qué existe

La racha semanal era "sube o se parte". El problema no es matemático: es que el
día que se parte, después de dos meses seguidos, es el día en que se abandona.
Ahora se gana un escudo cada N semanas y se gasta **solo**, sin preguntar, en la
primera semana que no llega al objetivo. La racha no sube, pero tampoco muere.
La decisión vive en `resolverRacha()`, separada de `cerrarSemana()`, para poder
probarla sin montar media aplicación.

### Las misiones pagan en multiplicador, no en créditos

Una misión cumplida **no imprime dinero**: sube lo que vale el trabajo del día.
Y su bonificación se **suma** al multiplicador del padre en vez de multiplicarse
con él (dos bonificaciones del 50 % dan x2, no x2,25). Si se multiplicaran, una
buena racha de misiones sumada a una promoción de fin de semana dispararía la
economía sin que nadie lo viera venir. Hay un tope configurable encima de todo.

Las misiones son **deterministas**: salen de la fecha con un generador con
semilla. Las de hoy son las mismas en los dos móviles, sin guardar ni sincronizar
nada, y mañana son otras.

### Los fondos son ahora la recompensa

Se empieza con cinco (uno por familia) y los otros doce se ganan por nivel o por
gesta. El requisito se declara en un solo sitio (`REQUISITOS`) y el selector
enseña lo que falta, escena por escena. `desbloqueos.js` **no importa el catálogo
de escenas**: las reglas son lógica de juego (núcleo) y el catálogo es capa
visual, así que quien llama pasa la lista. Hay una prueba de auditoría que falla
si un módulo de `core/` importa de `ui/` o de `themes/`, o si toca `document`.

### Las propuestas: un único sitio donde se toca el catálogo

Nil propone; el padre acepta, rechaza **con motivo obligatorio** o contraoferta.
Nil nunca aplica un cambio él solo, ni siquiera aceptando una contraoferta que le
beneficia: aceptar cierra el trato y el cambio lo aplica siempre la misma función
(`aplicar()`), que es el único punto del código donde una propuesta toca las
tareas o la tienda. Un solo sitio es un sitio donde auditar.

### El "juice" no puede romper nada

`ui/celebrar.js` dibuja el número que vuela, el confeti y el rebote, y dispara la
vibración y un clic generado con osciladores (cero archivos de sonido: la app
tiene que funcionar sin internet). Todo va envuelto en `try/catch` y comprueba
que existan los elementos: **un adorno nunca puede impedir que una tarea se
marque**. Las preferencias se leen en vivo del estado, no se copian, para que
apagar los efectos funcione también si el ajuste llega sincronizado desde el
otro móvil.

### La interfaz es cristal, no cajas opacas

Un fondo trabajado no sirve de nada si las tarjetas lo tapan. Cada tema declara
dos cristales: `--panel` (muy transparente, para las tarjetas) y `--panel-alto`
(denso, para la barra inferior y los diálogos, donde manda la legibilidad). Las
tarjetas desenfocan lo de detrás lo justo para que el texto se lea y la escena
siga reconociéndose. Y el botón del ojo de la cabecera aparta la interfaz unos
segundos para ver el fondo entero.

### Las gráficas son SVG propio, con una regla de color comprobable

Nada de librerías. Una escala por gráfica, nunca dos ejes. El texto usa los
colores del tema para que se lea sobre los diecisiete fondos, y las marcas llevan color
explícito. La paleta de categorías está **validada** contra los criterios de
separación para daltonismo y de contraste sobre fondo oscuro, y cada barra lleva
icono, nombre y número: el color acompaña, no identifica por sí solo.

### Una decisión de producto que está en el código a propósito

`src/core/health.js` empieza con un comentario que explica que esto **no es una
app de dieta**: nada de peso, calorías ni alimentos prohibidos, y nada que premie
restringir. Hay pruebas que recorren el catálogo de hábitos y el de premios
buscando esas palabras y fallan si aparecen. Es la forma de que la decisión
sobreviva a quien toque el código dentro de un año.
