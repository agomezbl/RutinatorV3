# Rutineitor v3.7 — el banco de Nil

**Fecha:** 10 de noviembre de 2026 · **Versión:** 3.7.0
**Resultado:** 306 pruebas automáticas, 306 pasan. Revisión en navegador real (pantalla de móvil):
0 errores de consola, 0 desbordes.

## Los instrumentos (cada uno se enciende o apaga en Economía → Reglas)
1. **Cuenta de ahorro.** La hucha libre gana un 1 % cada semana, como mucho 10 créditos.
2. **Depósito a plazo con interés variable.** Nil elige de 3 a 30 días (cualquier número, o los botones
   3 · 7 · 14 · 30). El padre fija el interés del plazo más corto (2 %) y del más largo (15 %); los
   intermedios salen solos en línea recta (7 días: 4 %, 14 días: 7,5 %). El interés queda fijado al
   firmar. Si lo rompe antes, recupera lo que puso y pierde el interés. Tope: 300 créditos a la vez.
3. **Fondo variable.** Cada lunes sube o baja entre −4 % y +6 % (de media +1 %), siempre sobre lo que
   ha puesto. Nunca vale menos del 75 % de lo puesto. Lo que mete empieza a moverse la semana siguiente.
   Lo saca cuando quiere. Mínimo 10, tope 200. Los dos móviles calculan el mismo número cada semana.

## Los frenos
- **Interés simple**: nada crece sobre lo ya ganado (adiós a lo de la v2: 100 → 569 en un mes).
- **Freno semanal**: todo lo que gana la hucha (cuenta, depósitos, fondo) no pasa del 20 % de lo que
  ha ganado con tareas en los últimos 7 días. Lo que no cabe **se aplaza, no se pierde**: llega en
  cuanto vuelve a hacer tareas.
- **Topes** por instrumento.
- **Pausar la hucha**: congela la cuenta y el fondo y no deja abrir nada nuevo. Los depósitos
  firmados se respetan y Nil puede sacar lo suyo.
- **Avisos** en «La hucha de un vistazo» si algún número se dispara.

## Lo que ve Nil
- Un **consejo** al día con sus números («Los mismos 60 créditos: a 3 días ganas 1, a 30 días ganas 9»).
- Su fondo con una **gráfica** de las últimas semanas (verde sube, rojo baja) y botones para meter y sacar.
- Al abrir un depósito ve al momento cuánto ganaría y qué día.
- Fichas **«Aprende»**: el interés, el plazo, el riesgo, no todo en el mismo cesto, el coste de
  oportunidad y por qué aquí hay un freno.
- Si hay intereses esperando al freno, se le dice cuántos y por qué.

## Lo que ve el padre (Economía → Reglas)
- **La hucha de un vistazo**: qué daría cada instrumento con 100 créditos, cómo va el freno esta
  semana (lo ganado, el techo, lo pagado y lo que espera) y el fondo de Nil.
- Grupos nuevos: **Fondo variable** y **Freno y pausa de la hucha**. El depósito tiene plazo corto,
  plazo largo, sus dos intereses y el tope.

## Al instalar la v3.7 (una sola vez)
Se ponen los valores nuevos de la hucha. Los depósitos que ya estuvieran abiertos conservan su interés.

## Para más adelante (módulos)
Préstamo de papá con interés, precios que suben poco a poco (inflación) y metas de diversificar.

## Pruebas
| Archivo | Qué comprueba | Nº |
|---|---|---|
| `tests/v37.test.mjs` (nuevo) | La recta de intereses, plazos libres y tope, freno que aplaza y luego paga, tope de la cuenta, qué cuenta como trabajo, fondo igual en dos móviles, semanas completas, interés simple, suelo, aportaciones a mitad de semana, sacar con ganancia y con pérdida, mínimo y tope del fondo, pausa, migración, avisos y consejos | 15 |
| Resto | Las de siempre (las del motor, con el banco de antes: plazos fijos, sin freno) | 291 |
