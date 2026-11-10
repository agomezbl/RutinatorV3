# Rutineitor v3.5 — economía como la v2 y herramientas del padre

**Fecha:** 4 de noviembre de 2026 · **Versión:** 3.5.0
**Resultado:** 273 pruebas automáticas, 273 pasan, 0 fallan. Revisión en navegador real
(Chromium, pantalla de móvil): 0 errores de consola, 0 desbordes, funciona sin internet.

---

## v3.5.1 — 7 de noviembre de 2026 · tiempo de los bonos y premios de ejemplo

- **Los bonos de pantalla dicen cuánto tiempo dan**: Bono TV, Bono Móvil y Bono Anime **⏱ 1 h**;
  Anime: tiempo extra **⏱ 30 min**. Se ve en la tienda, al pedirlo, en el billete y en la aprobación del padre.
- El padre lo cambia en **Catálogo → Tienda → ✏️ → «Tiempo que da, en minutos»** (0 = no se indica).
- **Aviso «Para las familias»** al principio de la tienda: los premios, textos, precios y tiempos son ejemplos
  y se adaptan en Más → Panel de papá → Catálogo → Tienda. Desaparece al pulsar **Entendido**.
- En el catálogo del padre, la misma explicación arriba de la tienda.
- Las instalaciones que ya existen reciben los tiempos de ejemplo **sin pisar** lo que el padre haya cambiado
  (solo se actualiza un texto si sigue siendo el de fábrica).
- 277 pruebas automáticas, 277 pasan; revisión en navegador: 0 errores.

---

## 1. Qué cambia para Nil

| Antes (v3.4) | Ahora (v3.5) |
|---|---|
| El saldo «de la semana» se vaciaba cada domingo y lo que sobraba caía solo a la hucha | **Los créditos no caducan** (como en la v2). Nil decide qué guarda |
| La hucha se llenaba sola al cerrar la semana | En **Mi ahorro**: botones **Guardar en la hucha** y **Sacar de la hucha** |
| No veía bien por qué le sumaban o quitaban | **Mis últimos movimientos**: cada «Regalo de papá» o «Quitado por papá» con su motivo |
| Apuestas, staking de sueño, misiones, escudos, bonos… | Desaparecen de su vista. Quedan: créditos, estrellas, hucha con interés y depósito a plazo |

## 2. Qué cambia para ti (Panel)

Pestañas del panel: **Aprobaciones · Propuestas · Economía · Días pasados · Catálogo · Semana · Sistema**
(la antigua «Tokenomics» ya no existe como pestaña: está dentro de Economía → Reglas).

### Economía (sección nueva)
- **Resumen**: créditos, hucha y estrellas; salud económica; últimos movimientos.
- **Histórico**: todo lo que ha pasado, con filtros por cuenta, tipo, fechas y texto.
  En cada línea, el saldo que quedó después. Botón **CSV** para abrirlo en Excel.
  - **↩︎ Anular** (con motivo): nunca se borra nada; se añade una anulación visible.
  - **✕ Vetar** en las tareas, igual que en Aprobaciones.
- **Herramientas**:
  - **Añadir / Quitar puntos** en créditos, hucha o estrellas, hoy o hasta 14 días atrás.
    Motivo obligatorio, con motivos frecuentes de un toque.
  - **Hucha ⇄ créditos** (mover en nombre de Nil).
  - **Tarea puntual** (también para un día pasado).
  - **Multiplicador**: siempre, fines de semana, entre semana, solo hoy o **entre dos fechas**.
  - **Subir o bajar precios** en bloque (en %, respetando los precios mínimos).
  - **Pausar la tienda** (no toca saldos; solo impide pedir hasta reabrirla).
- **Reglas**: los valores de siempre con la simulación arriba. Nuevo ajuste: *Nil puede sacar de la hucha*.
- **Avanzado**: lo que la v3 tenía de más, **apagado pero no borrado**. Se enciende con un botón:
  apuesta de racha, staking de sueño, bonos por dormir a la hora, misiones, escudos,
  bonus al subir la racha y cierre semanal a la hucha. Lo que ya estaba en marcha termina su curso.

### Días pasados (pestaña nueva)
Eliges un día de las dos últimas semanas (cada día muestra su %), marcas las tareas que se hicieron
(o «Marcar todo lo que falta») y **Validar las marcadas**. Los créditos quedan fechados en ese día
y la racha se recalcula sola aunque esa semana ya estuviera cerrada. Desde ahí también puedes
crear una tarea que no estaba o apuntar puntos en ese día.

### Catálogo (todo editable)
- **Tareas**, agrupadas por grupo. Se puede cambiar: nombre, **tipo** (normal, a elegir,
  obligatoria, puntual), valor, **moneda** (créditos o estrellas), **opciones** de las tareas
  a elegir (añadir/quitar), días, si necesita aprobación, y activarla o no.
- **Grupos de tareas**: cambiar nombre e icono (✏️), crear grupos nuevos, volver al nombre original.
- **Tienda**, en cuatro bloques: ocio del día, premios, premios grandes (hucha) y **regalos (estrellas)**.
- Arreglado un fallo: al editar un regalo de estrellas se cambiaba solo a créditos.

## 3. Al instalar la v3.5
La primera vez que se abre, la app hace una única migración: pone el saldo continuo y apaga
lo avanzado. **No se pierde nada**: créditos, hucha, estrellas, racha, historial y depósitos
abiertos siguen igual. Si un día quieres volver a algo, está en Economía → Avanzado.

## 4. Pruebas
| Archivo | Qué comprueba | Nº |
|---|---|---|
| `tests/v35.test.mjs` (nuevo) | Migración, saldo continuo, hucha, ajustes con fecha, anular, histórico y CSV, días pasados y racha, precios, pausa, multiplicador por fechas, grupos | 16 |
| `tests/app.test.mjs` | +8 pruebas sobre el archivo final: Reglas/Avanzado, quitar puntos y que Nil lo vea, filtros y anular, recuperar ayer, Nil guarda en la hucha, editar regalo de estrellas, convertir tarea en «a elegir» | 48 |
| Resto (`core`, `v31`, `v33`, `v34`, `audit`) | Lo de siempre, incluida la auditoría de seguridad (todo el texto escapado) | 209 |
| Navegador real | Todas las pestañas y subpestañas de Economía, Días pasados, Catálogo y los diálogos nuevos a 390 px de ancho | — |
