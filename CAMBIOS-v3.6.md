# Rutineitor v3.6 — la economía por tiempo

**Fecha:** 10 de noviembre de 2026 · **Versión:** 3.6.0
**Resultado:** 291 pruebas automáticas, 291 pasan. Revisión en navegador real (pantalla de móvil):
0 errores de consola, 0 desbordes, funciona sin internet.

## La regla
- **1 crédito por cada 5 minutos de tarea** (cada tramo empezado cuenta, mínimo 1).
- **1 hora de ocio cuesta 12 créditos**, lo mismo que paga una hora de tareas (1:1).
  Las rebajas del padre (Economía → Herramientas) lo abaratan: con un 50 % queda en 1:2.
- Los minutos son una **estimación fija**, no un cronómetro: a Nil no se le mide el tiempo.
- Las de puntualidad (cenar y apagar la luz a la hora) valen 1 fijo.
- La regla se cambia en Economía → Reglas → «Minutos de tarea por crédito».

## Qué cambia para Nil
- Cada tarea muestra lo que lleva: «⏱ 15 min» y su valor, más la nota de qué cuenta como hecha.
- Las obligatorias dicen las estrellas que dan («+2 ⭐»).
- En la tienda: «1 crédito = 5 min de tareas».
- El catálogo de tareas es el de la casa (el de la v2), con los valores nuevos.
  Una semana normal da unos **147 créditos** y **31 estrellas**.
- Ocio: TV 1 h = 12 · Móvil 30 min = 6 (máx. 2 días/semana) · Anime 2 episodios = 9 · Anime +30 min = 6 ·
  PC 6 cada 30 min (el permiso entre semana es gratis, el tiempo se paga) · Modo Búho 1 h = 12 ·
  **Hora de ocio a elegir** = 12 (genérica, para lo que se pacte).
- Premios con créditos: sobre One Piece 27, sobre Pokémon 54. Con la hucha: caja de sobres 180, juego nuevo 420.
  Regalos con estrellas: libro o cómic 90, juego de mesa 200, camiseta o zapatillas 330, regalo grande del año 550.
- **Ya no vienen de fábrica** los premios que se negocian (auriculares, bici, capricho, noches o tardes con amigos,
  día sin tareas, elegir el menú): se crean al pactarlos.
- Horario: cena del fin de semana 21:00, luces 22:00 entre semana y 23:00 el fin de semana,
  corte de pantallas 21:30 entre semana y 22:30 el fin de semana. Auto-aprobación en 6 h.

## Qué cambia para el padre
- En el editor de tareas: **«Minutos que lleva»** calcula el valor solo (se puede corregir a mano),
  también en cada opción de las tareas a elegir.
- Las obligatorias tienen **«Estrellas que da»**, cada una la suya.
- El catálogo muestra los minutos de cada tarea.
- Corte de pantallas separado para entre semana y fin de semana.

## Al instalar la v3.6 (una sola vez)
1. Las tareas y la tienda de fábrica se ponen al día. Las antiguas que ya no se usan quedan **desactivadas,
   no borradas** (el histórico las sigue mostrando y se pueden volver a encender). Lo que haya creado el padre no se toca.
2. **El saldo y la hucha de Nil se multiplican por 1,5** (los depósitos abiertos también cuentan; el extra va a la hucha),
   con un movimiento visible: «Sistema nuevo: tus créditos ×1,5». Así lo ahorrado conserva su valor frente a los premios,
   que suben en la misma proporción. Las estrellas no cambian.
3. Es seguro con dos móviles: la conversión tiene un identificador fijo y no se cobra dos veces.

## Pruebas
| Archivo | Qué comprueba | Nº |
|---|---|---|
| `tests/v36.test.mjs` (nuevo) | La regla, valores del catálogo, semana tipo (147 créditos, 31 estrellas), ocio a 12/h, premios retirados, estrellas por tarea, permiso de PC gratis, cortes por día, migración (catálogo, lo del padre, ×1,5, una sola vez, dos móviles, casa nueva) | 14 |
| Resto | Las pruebas del motor usan el catálogo de la v3.5 (`src/core/catalogo-v35.js`), con el que están calibradas | 277 |
