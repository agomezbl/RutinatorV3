import test from 'node:test';
import assert from 'node:assert/strict';

import { esc, escAttr, weekIdOf, weekdayIndex, addDays, isWeekend, minutosDeHora, hashClave } from '../src/core/util.js';
import { crearStore } from '../src/core/store.js';
import { catalogoInicial } from '../src/core/defaults.js';
import { saldoSemana, saldoHucha, ganadoPorCategoria, resumenSemana } from '../src/core/ledger.js';
import { marcarTarea, aprobarMarca, vetarMarca, desmarcarTarea, procesarAutoAprobaciones, cumplimientoDia, cumplimientoSemana, crearTareaPuntual, ajusteManual, tareasDelDia, marcaDe, evaluarObligatoria } from '../src/core/tasks.js';
import { solicitarCompra, aprobarCompra, denegarCompra, puedeComprar, modoBuhoActivo, iniciarSesionPc, pararSesionPc, puedeUsarPc, diaSinTareas } from '../src/core/leisure.js';
import { cerrarSemana, semanaArchivada, datosDeSemana } from '../src/core/week.js';
import { multiplicadorEn, valorTareaEn, precioEfectivo, estadoObjetivo, informeSalud } from '../src/core/economy.js';
import { ocioBloqueadoPorHorario, tareasDePreparacion, validarBloque, crearBloque } from '../src/core/schedule.js';
import { crearEvento, validarEvento, eventosDeFecha, rejillaMes, recordatoriosInminentes, eventosEntre } from '../src/core/calendar.js';
import { pasadaHoraDeCorte, objetivosDe, horasDeSuenoPrevistas } from '../src/core/circadian.js';
import { puzzleDelDia, comprobar, cuadriculaCompleta } from '../src/core/sudoku.js';

// Lunes 7 de septiembre de 2026 (comprobado abajo).
const LUNES = '2026-09-07';
const MARTES = '2026-09-08';
const SABADO = '2026-09-12';

function nuevoStore() {
  return crearStore(catalogoInicial());
}

/* ================= util ================= */

test('esc escapa los caracteres peligrosos de HTML', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(esc('Pan & mantequilla'), 'Pan &amp; mantequilla');
  assert.equal(esc(null), '');
  assert.equal(esc(0), '0');
});

test('escAttr escapa además las comillas', () => {
  assert.equal(escAttr('a" onclick="x'), 'a&quot; onclick=&quot;x');
  assert.equal(escAttr("a' onclick='x"), 'a&#39; onclick=&#39;x');
  assert.ok(!escAttr('<img src=x onerror="y">').includes('"'));
});

test('las fechas de referencia son los días que decimos', () => {
  assert.equal(weekdayIndex(LUNES), 0);
  assert.equal(weekdayIndex(SABADO), 5);
  assert.equal(weekIdOf(SABADO), LUNES);
  assert.equal(weekIdOf(LUNES), LUNES);
  assert.equal(addDays(LUNES, 7), '2026-09-14');
  assert.equal(isWeekend(SABADO), true);
  assert.equal(isWeekend(MARTES), false);
});

test('minutosDeHora valida el formato', () => {
  assert.equal(minutosDeHora('08:30'), 510);
  assert.equal(minutosDeHora('24:00'), null);
  assert.equal(minutosDeHora('8:5'), null);
  assert.equal(minutosDeHora(''), null);
});

test('hashClave es estable y distinto por clave', () => {
  assert.equal(hashClave('abc123'), hashClave('abc123'));
  assert.notEqual(hashClave('abc123'), hashClave('abc124'));
});

/* ================= ledger y tareas ================= */

test('marcar una tarea anota el crédito como provisional y aprobar lo consolida', () => {
  const s = nuevoStore();
  const r = marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });
  assert.equal(r.ok, true);
  assert.equal(r.valor, 2);
  assert.equal(saldoSemana(s.estado, LUNES), 2);
  const marca = marcaDe(s.estado, LUNES, 't_cama');
  assert.equal(marca.estado, 'pendiente');
  assert.equal(s.obtener('ledger', marca.movimientoId).provisional, true);

  aprobarMarca(s, marca.id);
  assert.equal(s.obtener('ledger', marca.movimientoId).provisional, false);
  assert.equal(saldoSemana(s.estado, LUNES), 2);
});

test('vetar revierte el crédito sin borrar nada del historial', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_deberes' });
  assert.equal(saldoSemana(s.estado, LUNES), 6);
  const marca = marcaDe(s.estado, LUNES, 't_deberes');
  vetarMarca(s, marca.id, 'sin hacer');
  assert.equal(saldoSemana(s.estado, LUNES), 0);
  assert.equal(s.obtener('marcas', marca.id).estado, 'vetada');
  assert.equal(s.obtener('marcas', marca.id).motivo, 'sin hacer');
  // El movimiento original sigue existiendo, anulado por otro.
  const original = s.obtener('ledger', marca.movimientoId);
  assert.ok(original.anuladoPor);
  assert.equal(Object.keys(s.estado.ledger).length, 2);
});

test('vetar funciona también después de aprobar', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_deberes' });
  const marca = marcaDe(s.estado, LUNES, 't_deberes');
  aprobarMarca(s, marca.id);
  vetarMarca(s, marca.id, 'mentira');
  assert.equal(saldoSemana(s.estado, LUNES), 0);
});

test('no se puede marcar dos veces la misma tarea el mismo día', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });
  const segunda = marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });
  assert.equal(segunda.ok, false);
  assert.equal(saldoSemana(s.estado, LUNES), 2);
});

test('tarea de elección: exige opción válida y paga lo que corresponde', () => {
  const s = nuevoStore();
  assert.equal(marcarTarea(s, { fecha: LUNES, tareaId: 't_lavavajillas' }).ok, false);
  assert.equal(marcarTarea(s, { fecha: LUNES, tareaId: 't_lavavajillas', opcionId: 'inventada' }).ok, false);
  const r = marcarTarea(s, { fecha: LUNES, tareaId: 't_lavavajillas', opcionId: 'ayuda' });
  assert.equal(r.ok, true);
  assert.equal(r.valor, 2);
  const r2 = marcarTarea(s, { fecha: MARTES, tareaId: 't_lavavajillas', opcionId: 'solo' });
  assert.equal(r2.valor, 4);
});

test('tarea obligatoria vale 0 pero cuenta en el cumplimiento', () => {
  const s = nuevoStore();
  const r = marcarTarea(s, { fecha: LUNES, tareaId: 't_dientes_m' });
  assert.equal(r.valor, 0);
  assert.equal(saldoSemana(s.estado, LUNES), 0);
  const marca = marcaDe(s.estado, LUNES, 't_dientes_m');
  assert.equal(marca.movimientoId, null);
  const antes = cumplimientoDia(s.estado, LUNES).cumplidas;
  evaluarObligatoria(s, marca.id, false, 'no se los lavó');
  const despues = cumplimientoDia(s.estado, LUNES).cumplidas;
  assert.equal(despues, antes - 1);
  assert.equal(saldoSemana(s.estado, LUNES), 0);
});

test('desmarcar solo funciona mientras está pendiente', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });
  const marca = marcaDe(s.estado, LUNES, 't_cama');
  aprobarMarca(s, marca.id);
  assert.equal(desmarcarTarea(s, marca.id).ok, false);

  marcarTarea(s, { fecha: MARTES, tareaId: 't_cama' });
  const m2 = marcaDe(s.estado, MARTES, 't_cama');
  assert.equal(desmarcarTarea(s, m2.id).ok, true);
  assert.equal(saldoSemana(s.estado, MARTES), 2);
  assert.equal(marcaDe(s.estado, MARTES, 't_cama'), null);
});

test('auto-aprobación solo salta pasadas las horas configuradas', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });
  assert.equal(procesarAutoAprobaciones(s, Date.now()), 0);
  const dentroDe13h = Date.now() + 13 * 3600 * 1000;
  assert.equal(procesarAutoAprobaciones(s, dentroDe13h), 1);
  const marca = marcaDe(s.estado, LUNES, 't_cama');
  assert.equal(marca.estado, 'aprobada');
  assert.equal(marca.autoAprobada, true);
  assert.equal(procesarAutoAprobaciones(s, dentroDe13h), 0); // idempotente
});

test('el ledger es la única fuente: saldo y gráfico por categoría cuadran', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });        // manana 2
  marcarTarea(s, { fecha: LUNES, tareaId: 't_deberes' });     // tarde 6
  marcarTarea(s, { fecha: LUNES, tareaId: 't_basura' });      // tarde 2
  const marcaDeberes = marcaDe(s.estado, LUNES, 't_deberes');
  vetarMarca(s, marcaDeberes.id, 'no');
  const cat = ganadoPorCategoria(s.estado, LUNES);
  const sumaCategorias = Object.values(cat).reduce((a, b) => a + b, 0);
  assert.equal(sumaCategorias, saldoSemana(s.estado, LUNES));
  assert.equal(sumaCategorias, 4);
  assert.equal(resumenSemana(s.estado, LUNES).ganado, 4);
});

test('ajuste manual exige motivo y queda en el ledger', () => {
  const s = nuevoStore();
  assert.equal(ajusteManual(s, { cantidad: 5, motivo: '   ', fecha: LUNES }).ok, false);
  assert.equal(ajusteManual(s, { cantidad: 0, motivo: 'nada', fecha: LUNES }).ok, false);
  assert.equal(ajusteManual(s, { cantidad: -3, motivo: 'contestar mal', fecha: LUNES }).ok, true);
  assert.equal(saldoSemana(s.estado, LUNES), -3);
});

test('tarea puntual solo aparece en su día', () => {
  const s = nuevoStore();
  const r = crearTareaPuntual(s, { nombre: 'Ayudar con el trastero', valor: 8, fecha: MARTES });
  assert.equal(r.ok, true);
  assert.ok(!tareasDelDia(s.estado, LUNES).some((t) => t.id === r.id));
  assert.ok(tareasDelDia(s.estado, MARTES).some((t) => t.id === r.id));
  assert.equal(crearTareaPuntual(s, { nombre: '  ', valor: 5, fecha: MARTES }).ok, false);
});

/* ================= multiplicador ================= */

test('el multiplicador afecta a lo ganado y nunca a lo gastado', () => {
  const s = nuevoStore();
  s.fijarAjuste('multiplicadorValor', 2);
  s.fijarAjuste('multiplicadorAmbito', 'siempre');
  assert.equal(multiplicadorEn(s.estado, LUNES), 2);
  marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });
  assert.equal(saldoSemana(s.estado, LUNES), 4);

  const precio = precioEfectivo(s.estado.tienda.b_tv);
  assert.equal(precio, 10); // el precio no se multiplica
});

test('ámbito del multiplicador: finde, entre semana y solo hoy', () => {
  const s = nuevoStore();
  s.fijarAjuste('multiplicadorValor', 3);
  s.fijarAjuste('multiplicadorAmbito', 'finde');
  assert.equal(multiplicadorEn(s.estado, SABADO), 3);
  assert.equal(multiplicadorEn(s.estado, LUNES), 1);

  s.fijarAjuste('multiplicadorAmbito', 'entresemana');
  assert.equal(multiplicadorEn(s.estado, LUNES), 3);
  assert.equal(multiplicadorEn(s.estado, SABADO), 1);

  s.fijarAjuste('multiplicadorAmbito', 'hoy');
  s.fijarAjuste('multiplicadorFecha', MARTES);
  assert.equal(multiplicadorEn(s.estado, MARTES), 3);
  assert.equal(multiplicadorEn(s.estado, LUNES), 1);
});

test('valorTareaEn nunca da créditos a una obligatoria', () => {
  const s = nuevoStore();
  s.fijarAjuste('multiplicadorValor', 5);
  assert.equal(valorTareaEn(s.estado, s.estado.tareas.t_dientes_m, LUNES), 0);
});

/* ================= tienda y ocio ================= */

function darCreditos(s, fecha, cantidad) {
  ajusteManual(s, { cantidad, motivo: 'saldo de prueba', fecha });
}

test('no se puede comprar sin saldo suficiente', () => {
  const s = nuevoStore();
  const r = solicitarCompra(s, { itemId: 'b_tv', fecha: LUNES, hora: '18:00' });
  assert.equal(r.ok, false);
  assert.match(r.razon, /faltan/i);
});

test('comprar descuenta al instante y denegar devuelve el crédito', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 30);
  const r = solicitarCompra(s, { itemId: 'b_tv', fecha: LUNES, hora: '18:00' });
  assert.equal(r.ok, true);
  assert.equal(saldoSemana(s.estado, LUNES), 20);
  denegarCompra(s, r.compraId, 'hoy no');
  assert.equal(saldoSemana(s.estado, LUNES), 30);
  assert.equal(s.obtener('compras', r.compraId).estado, 'denegada');
});

test('aprobar una compra la deja activa ese día y no se puede repetir', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 60);
  const r = solicitarCompra(s, { itemId: 'b_tv', fecha: LUNES, hora: '18:00' });
  aprobarCompra(s, r.compraId);
  const repe = solicitarCompra(s, { itemId: 'b_tv', fecha: LUNES, hora: '18:00' });
  assert.equal(repe.ok, false);
  assert.match(repe.razon, /ya tienes/i);
});

test('el bono de móvil respeta el tope semanal', () => {
  const s = nuevoStore();
  const dias = ['2026-09-07', '2026-09-08', '2026-09-09'];
  for (const d of dias) darCreditos(s, d, 40);
  // 17:30: fuera del bloque de "Entreno" (18:00-19:30) del martes.
  const a = solicitarCompra(s, { itemId: 'b_movil', fecha: dias[0], hora: '17:30' });
  assert.equal(a.ok, true);
  aprobarCompra(s, a.compraId);
  const b = solicitarCompra(s, { itemId: 'b_movil', fecha: dias[1], hora: '17:30' });
  assert.equal(b.ok, true);
  aprobarCompra(s, b.compraId);
  const c = solicitarCompra(s, { itemId: 'b_movil', fecha: dias[2], hora: '17:30' });
  assert.equal(c.ok, false);
  assert.match(c.razon, /2 días/i);
});

test('el extra de anime exige tener antes el bono base aprobado', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 60);
  const extra = solicitarCompra(s, { itemId: 'b_anime_extra', fecha: LUNES, hora: '18:00' });
  assert.equal(extra.ok, false);
  const base = solicitarCompra(s, { itemId: 'b_anime', fecha: LUNES, hora: '18:00' });
  const extra2 = solicitarCompra(s, { itemId: 'b_anime_extra', fecha: LUNES, hora: '18:00' });
  assert.equal(extra2.ok, false, 'con el bono solo pendiente todavía no');
  aprobarCompra(s, base.compraId);
  const extra3 = solicitarCompra(s, { itemId: 'b_anime_extra', fecha: LUNES, hora: '18:00' });
  assert.equal(extra3.ok, true);
});

test('el bono de anime nunca puede costar 0: tiene suelo de precio', () => {
  const s = nuevoStore();
  s.patch('tienda', 'b_anime', { precio: 0 });
  assert.equal(precioEfectivo(s.estado.tienda.b_anime), 6);
  s.patch('tienda', 'b_anime', { precio: -50 });
  assert.equal(precioEfectivo(s.estado.tienda.b_anime), 6);
});

test('pasada la hora de corte no se puede comprar ocio, salvo Modo Búho', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 80);
  assert.equal(pasadaHoraDeCorte(s.estado, LUNES, '21:30'), true);
  const tarde = solicitarCompra(s, { itemId: 'b_tv', fecha: LUNES, hora: '21:30' });
  assert.equal(tarde.ok, false);
  assert.match(tarde.razon, /corte/i);

  const buho = solicitarCompra(s, { itemId: 'b_buho', fecha: LUNES, hora: '21:30' });
  assert.equal(buho.ok, true, 'el Modo Búho sí se puede pedir después del corte');
  aprobarCompra(s, buho.compraId);
  assert.equal(modoBuhoActivo(s.estado, LUNES), true);
  const tv = solicitarCompra(s, { itemId: 'b_tv', fecha: LUNES, hora: '21:30' });
  assert.equal(tv.ok, true);
});

test('el Modo Búho vale solo para el día en que se pidió', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 80);
  const buho = solicitarCompra(s, { itemId: 'b_buho', fecha: LUNES, hora: '21:30' });
  aprobarCompra(s, buho.compraId);
  assert.equal(modoBuhoActivo(s.estado, LUNES), true);
  assert.equal(modoBuhoActivo(s.estado, MARTES), false);
});

test('un bloque del horario que bloquea ocio impide comprar durante su franja', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 80);
  const bloqueo = ocioBloqueadoPorHorario(s.estado, LUNES, '10:00');
  assert.equal(bloqueo.bloqueado, true);
  assert.equal(bloqueo.bloque.titulo, 'Colegio');
  const r = solicitarCompra(s, { itemId: 'b_tv', fecha: LUNES, hora: '10:00' });
  assert.equal(r.ok, false);
  assert.match(r.razon, /Colegio/);
});

test('"Día sin tareas" deja solo las obligatorias', () => {
  const s = nuevoStore();
  darCreditos(s, MARTES, 60);
  const r = solicitarCompra(s, { itemId: 'p_sintareas', fecha: MARTES, hora: '17:00' });
  aprobarCompra(s, r.compraId);
  assert.equal(diaSinTareas(s.estado, MARTES), true);
  const tareas = tareasDelDia(s.estado, MARTES);
  assert.ok(tareas.length > 0);
  assert.ok(tareas.every((t) => t.tipo === 'obligatoria'));
});

test('PC: entre semana necesita pase, el fin de semana es libre', () => {
  const s = nuevoStore();
  darCreditos(s, MARTES, 80);
  assert.equal(puedeUsarPc(s.estado, MARTES, '17:30').ok, false);
  assert.equal(puedeUsarPc(s.estado, SABADO, '17:30').ok, true);
  const pase = solicitarCompra(s, { itemId: 'b_pc', fecha: MARTES, hora: '17:30' });
  assert.equal(pase.ok, true);
  aprobarCompra(s, pase.compraId);
  assert.equal(puedeUsarPc(s.estado, MARTES, '17:30').ok, true);
});

test('PC: la sesión cronometrada factura por bloques empezados', () => {
  const s = nuevoStore();
  darCreditos(s, SABADO, 80);
  const t0 = Date.now();
  const ini = iniciarSesionPc(s, { fecha: SABADO, ahora: t0, hora: '11:00' });
  assert.equal(ini.ok, true);
  assert.equal(iniciarSesionPc(s, { fecha: SABADO, ahora: t0, hora: '11:00' }).ok, false);
  const fin = pararSesionPc(s, { ahora: t0 + 35 * 60000 });
  assert.equal(fin.minutos, 35);
  assert.equal(fin.coste, 10); // 2 bloques de 30 min
  assert.equal(saldoSemana(s.estado, SABADO), 70);
});

test('el fin de semana no admite pase de PC (no hace falta)', () => {
  const s = nuevoStore();
  darCreditos(s, SABADO, 80);
  const r = solicitarCompra(s, { itemId: 'b_pc', fecha: SABADO, hora: '11:00' });
  assert.equal(r.ok, false);
  assert.match(r.razon, /libre/i);
});

/* ================= hucha, cierre y racha ================= */

test('lo que sobra al cerrar la semana cae a la hucha y el saldo semanal queda a 0', () => {
  const s = nuevoStore();
  s.fijarAjuste('modoSaldo', 'semanal'); // cierre semanal clásico (Avanzado)
  darCreditos(s, LUNES, 50);
  const r = cerrarSemana(s, { fecha: MARTES });
  assert.equal(r.ok, true);
  assert.equal(r.traspasado, 50);
  assert.equal(saldoSemana(s.estado, LUNES), 0);
  assert.equal(saldoHucha(s.estado), 50);
  assert.ok(semanaArchivada(s.estado, LUNES));
  assert.equal(cerrarSemana(s, { fecha: MARTES }).ok, false, 'idempotente');
});

test('una semana en negativo arrastra el déficit en vez de vaciar la hucha', () => {
  const s = nuevoStore();
  s.fijarAjuste('modoSaldo', 'semanal'); // cierre semanal clásico (Avanzado)
  darCreditos(s, LUNES, 100);
  cerrarSemana(s, { fecha: LUNES });
  assert.equal(saldoHucha(s.estado), 100);

  const semana2 = '2026-09-14';
  ajusteManual(s, { cantidad: -20, motivo: 'multa', fecha: semana2 });
  const r = cerrarSemana(s, { fecha: semana2 });
  assert.equal(r.arrastrado, -20);
  assert.equal(saldoHucha(s.estado), 100, 'la hucha no se toca');
  assert.equal(saldoSemana(s.estado, semana2), 0);
  assert.equal(saldoSemana(s.estado, '2026-09-21'), -20);
});

test('la racha sube si se supera el umbral y se resetea si no', () => {
  const s = nuevoStore();
  // Cumplimos todo el lunes y nada más: el % de la semana será bajo.
  for (const t of tareasDelDia(s.estado, LUNES)) marcarTarea(s, { fecha: LUNES, tareaId: t.id, opcionId: t.tipo === 'eleccion' ? t.opciones[0].id : null });
  const r = cerrarSemana(s, { fecha: LUNES });
  assert.equal(r.subioRacha, false);
  assert.equal(r.racha, 0);

  // Semana siguiente: se cumple TODO, así que la racha sube con el umbral normal.
  const semana2 = '2026-09-14';
  for (let i = 0; i < 7; i++) {
    const dia = addDays(semana2, i);
    for (const t of tareasDelDia(s.estado, dia)) {
      marcarTarea(s, { fecha: dia, tareaId: t.id, opcionId: t.tipo === 'eleccion' ? t.opciones[0].id : null });
    }
  }
  const r2 = cerrarSemana(s, { fecha: semana2 });
  assert.equal(r2.cumplimiento, 100);
  assert.equal(r2.subioRacha, true);
  assert.equal(r2.racha, 1);
});

test('el cierre de semana no toca el calendario de citas', () => {
  const s = nuevoStore();
  const ev = crearEvento({ fecha: '2026-10-01', titulo: 'Dentista', hora: '17:00' });
  s.set('eventos', ev.id, ev);
  cerrarSemana(s, { fecha: LUNES });
  assert.equal(eventosDeFecha(s.estado, '2026-10-01').length, 1);
});

/* ================= objetivo de ahorro ================= */

test('el objetivo de ahorro calcula lo que falta y estima semanas por ritmo real', () => {
  const s = nuevoStore();
  s.fijarAjuste('modoSaldo', 'semanal'); // cierre semanal clásico (Avanzado)
  s.fijarAjuste('objetivoAhorroId', 'g_juego'); // 350
  darCreditos(s, LUNES, 70);
  cerrarSemana(s, { fecha: LUNES });
  const o = estadoObjetivo(s.estado, '2026-09-15');
  assert.equal(o.precio, 350);
  assert.equal(o.hucha, 70);
  assert.equal(o.faltante, 280);
  assert.equal(o.ritmoSemanal, 70);
  assert.equal(o.semanasEstimadas, 4);
});

test('si se borra el premio fijado como objetivo, el objetivo lo avisa sin romperse', () => {
  const s = nuevoStore();
  s.fijarAjuste('objetivoAhorroId', 'g_juego');
  s.remove('tienda', 'g_juego');
  const o = estadoObjetivo(s.estado, LUNES);
  assert.equal(o.roto, true);
  assert.equal(o.faltante, null);
});

test('informe de salud diagnostica generoso, ajustado o equilibrado', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 100);
  assert.equal(informeSalud(s.estado, LUNES).diagnostico, 'generoso');
  const s2 = nuevoStore();
  darCreditos(s2, LUNES, 100);
  solicitarCompra(s2, { itemId: 'p_sintareas', fecha: LUNES, hora: '17:00' }); // 25
  solicitarCompra(s2, { itemId: 'p_amigos', fecha: LUNES, hora: '17:00' });    // 18
  solicitarCompra(s2, { itemId: 'p_peli', fecha: LUNES, hora: '17:00' });      // 15
  assert.equal(informeSalud(s2.estado, LUNES).diagnostico, 'equilibrado');
});

/* ================= horario y calendario ================= */

test('un bloque con "requiere preparación" genera su tarea automáticamente', () => {
  const s = nuevoStore();
  const generadas = tareasDePreparacion(s.estado, MARTES);
  assert.equal(generadas.length, 1);
  assert.equal(generadas[0].nombre, 'Preparar Entreno');
  assert.ok(tareasDelDia(s.estado, MARTES).some((t) => t.id === generadas[0].id));
  // Al desmarcar la preparación, la tarea desaparece sola.
  s.patch('horario', 'h_depor_m', { requierePreparacion: false });
  assert.equal(tareasDePreparacion(s.estado, MARTES).length, 0);
});

test('validarBloque rechaza horas imposibles', () => {
  assert.match(validarBloque(crearBloque({ inicio: '18:00', fin: '17:00' })), /posterior/);
  assert.match(validarBloque(crearBloque({ titulo: '   ' })), /nombre/);
  assert.equal(validarBloque(crearBloque({ titulo: 'Piano', inicio: '17:00', fin: '18:00' })), null);
});

test('el calendario guarda eventos con fecha real y sobrevive semanas', () => {
  const s = nuevoStore();
  const ev = crearEvento({ fecha: '2026-10-05', hora: '18:30', titulo: 'Cumple de Marc', recordatorio: true });
  assert.equal(validarEvento(ev), null);
  s.set('eventos', ev.id, ev);
  assert.equal(eventosEntre(s.estado, '2026-09-01', '2026-12-31').length, 1);
  // Edición completa
  s.patch('eventos', ev.id, { titulo: 'Cumple de Marc (cambiado)', hora: '19:00' });
  assert.equal(eventosDeFecha(s.estado, '2026-10-05')[0].titulo, 'Cumple de Marc (cambiado)');
  s.remove('eventos', ev.id);
  assert.equal(eventosDeFecha(s.estado, '2026-10-05').length, 0);
});

test('validarEvento exige título y fecha correcta', () => {
  assert.match(validarEvento({ titulo: '', fecha: '2026-10-05' }), /título/);
  assert.match(validarEvento({ titulo: 'x', fecha: '5-10-2026' }), /fecha/);
  assert.match(validarEvento({ titulo: 'x', fecha: '2026-10-05', hora: '99:99' }), /hora/);
});

test('la rejilla del mes tiene 42 celdas y empieza en lunes', () => {
  const celdas = rejillaMes(2026, 8); // septiembre 2026
  assert.equal(celdas.length, 42);
  assert.equal(weekdayIndex(celdas[0].fecha), 0);
  assert.ok(celdas.some((c) => c.fecha === '2026-09-01' && c.delMes));
});

test('los recordatorios saltan en la ventana de 5 minutos', () => {
  const s = nuevoStore();
  const ahora = new Date(2026, 8, 8, 18, 27, 0);
  const ev = crearEvento({ fecha: '2026-09-08', hora: '18:30', titulo: 'Dentista', recordatorio: true });
  s.set('eventos', ev.id, ev);
  assert.equal(recordatoriosInminentes(s.estado, ahora, 5).length, 1);
  assert.equal(recordatoriosInminentes(s.estado, new Date(2026, 8, 8, 18, 10), 5).length, 0);
});

/* ================= circadiano ================= */

test('los objetivos circadianos cambian entre semana y fin de semana', () => {
  const s = nuevoStore();
  assert.equal(objetivosDe(s.estado, LUNES).dormir, '22:30');
  assert.equal(objetivosDe(s.estado, SABADO).dormir, '23:45');
  assert.equal(horasDeSuenoPrevistas(s.estado, LUNES, '07:00'), 8.5);
});

/* ================= sudoku ================= */

test('el sudoku del día es el mismo para la misma fecha y distinto cada día', () => {
  const a = puzzleDelDia('2026-09-12');
  const b = puzzleDelDia('2026-09-12');
  const c = puzzleDelDia('2026-09-13');
  assert.deepEqual(a.tablero, b.tablero);
  assert.notDeepEqual(a.tablero, c.tablero);
});

test('la cuadrícula generada es un sudoku válido', () => {
  const g = cuadriculaCompleta('2026-09-12');
  for (let i = 0; i < 9; i++) {
    assert.equal(new Set(g[i]).size, 9, `fila ${i}`);
    assert.equal(new Set(g.map((f) => f[i])).size, 9, `columna ${i}`);
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const caja = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) caja.push(g[br * 3 + i][bc * 3 + j]);
      assert.equal(new Set(caja).size, 9, `caja ${br}${bc}`);
    }
  }
});

test('el puzzle deja huecos y comprobar detecta errores', () => {
  const p = puzzleDelDia('2026-09-12', 'medio');
  assert.ok(p.huecos >= 30, `huecos=${p.huecos}`);
  const jugado = p.tablero.map((f) => f.slice());
  assert.equal(comprobar(jugado, p.solucion).resuelto, false);
  assert.equal(comprobar(p.solucion, p.solucion).resuelto, true);
  // Un valor mal puesto se detecta
  const rc = [];
  for (let r = 0; r < 9 && !rc.length; r++) for (let c = 0; c < 9; c++) if (!jugado[r][c]) { rc.push(r, c); break; }
  jugado[rc[0]][rc[1]] = (p.solucion[rc[0]][rc[1]] % 9) + 1;
  assert.equal(comprobar(jugado, p.solucion).erroneas, 1);
});

/* ================= store granular ================= */

test('el store escribe registro a registro y emite una operación por escritura', () => {
  const s = nuevoStore();
  const ops = [];
  s.suscribirOps((op) => ops.push(op));
  s.fijarAjuste('temaNil', 'volcan');
  s.patch('tienda', 'b_tv', { precio: 12 });
  assert.equal(ops.length, 2);
  assert.equal(ops[0].coleccion, 'ajustes');
  assert.equal(ops[1].registro.precio, 12);
  assert.equal(s.estado.tienda.b_tv.nombre, 'Bono TV', 'el resto del registro se conserva');
});

test('dos escrituras en registros distintos no se pisan', () => {
  const s = nuevoStore();
  const instantanea = s.instantanea();
  const otro = crearStore(instantanea);
  s.patch('tienda', 'b_tv', { precio: 99 });
  otro.patch('tienda', 'b_movil', { precio: 1 });
  // Aplicamos la operación del otro dispositivo sobre el primero
  s.set('tienda', 'b_movil', otro.estado.tienda.b_movil, { remoto: true });
  assert.equal(s.estado.tienda.b_tv.precio, 99);
  assert.equal(s.estado.tienda.b_movil.precio, 1);
});

test('datosDeSemana devuelve todo lo que necesita el resumen descargable', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });
  darCreditos(s, LUNES, 40);
  solicitarCompra(s, { itemId: 'b_tv', fecha: LUNES, hora: '18:00' });
  const d = datosDeSemana(s.estado, LUNES);
  assert.ok(d.movimientos.length >= 3);
  assert.equal(d.compras.length, 1);
  assert.equal(d.marcas.length, 1);
  assert.ok(d.cumplimiento.esperadas > 0);
  assert.ok('manana' in d.porCategoria);
});
