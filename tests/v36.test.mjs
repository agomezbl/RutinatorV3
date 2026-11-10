/**
 * v3.6 — la economía por tiempo.
 *
 *   - 1 crédito por cada 5 min de tarea (mínimo 1); 1 h de ocio = 12 créditos.
 *   - El catálogo nuevo: los valores salen de los minutos, las estrellas
 *     cuadran con la v2 (~31 a la semana) y los premios que se negocian ya no
 *     vienen de fábrica.
 *   - La migración de una casa antigua: catálogo nuevo sin borrar nada, lo del
 *     padre intacto, saldo y hucha ×1,5, una sola vez, segura con dos móviles.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearStore } from '../src/core/store.js';
import { catalogoInicial, TAREAS_POR_DEFECTO, TIENDA_POR_DEFECTO } from '../src/core/defaults.js';
import { saldoHucha, saldoCreditos, saldoEstrellas, crearMovimiento, TIPOS } from '../src/core/ledger.js';
import { marcarTarea, aprobarMarca, tareasDelDia, idMarca } from '../src/core/tasks.js';
import { valorPorTiempo, creditosPorHora, valorTareaEn } from '../src/core/economy.js';
import { solicitarCompra, iniciarSesionPc, pararSesionPc } from '../src/core/leisure.js';
import { abrirDeposito, capitalBloqueado } from '../src/core/staking.js';
import { objetivosDe } from '../src/core/circadian.js';
import {
  migrarEconomia, migrarTienda, migrarTiempo, VERSION_TIEMPO, TAREAS_RETIRADAS_36, TIENDA_RETIRADA_36,
} from '../src/core/gestion.js';

const LUNES = '2026-11-16';
const DOMINGO = '2026-11-22';
const SEMANA = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

function casaNueva() {
  const s = crearStore(catalogoInicial());
  migrarEconomia(s); migrarTienda(s); migrarTiempo(s, { fecha: LUNES });
  return s;
}

function casaAntigua() {
  const s = crearStore(catalogoInicial({ version: 35 }));
  migrarEconomia(s); migrarTienda(s);
  return s;
}

function dar(s, cantidad, cuenta = 'semana', fecha = '2026-11-10') {
  const m = crearMovimiento({ cuenta, tipo: TIPOS.AJUSTE, cantidad, concepto: 'saldo de prueba', categoria: 'ajuste', fecha, actor: 'padre' });
  s.set('ledger', m.id, m);
}

/** Lo máximo que paga el catálogo un día: cada tarea con su mejor opción.
 *  Sin las de preparación, que dependen del horario de cada casa. */
function potencialDia(s, fecha) {
  let creditos = 0; let estrellas = 0;
  for (const t of tareasDelDia(s.estado, fecha).filter((x) => !String(x.id).startsWith('gen_'))) {
    if (t.tipo === 'obligatoria') { estrellas += Number(t.estrellas ?? 1); continue; }
    const op = t.tipo === 'eleccion' ? t.opciones[0].id : null;
    creditos += valorTareaEn(s.estado, t, fecha, op);
  }
  return { creditos, estrellas };
}

/* ------------------------------ la regla ------------------------------- */

test('la regla del tiempo: 1 crédito cada 5 min empezados, mínimo 1', () => {
  const e = catalogoInicial();
  assert.equal(valorPorTiempo(e, 1), 1);
  assert.equal(valorPorTiempo(e, 5), 1);
  assert.equal(valorPorTiempo(e, 6), 2);
  assert.equal(valorPorTiempo(e, 15), 3);
  assert.equal(valorPorTiempo(e, 60), 12);
  assert.equal(valorPorTiempo(e, 0), null, 'sin minutos no hay valor por tiempo');
  assert.equal(creditosPorHora(e), 12);
  e.ajustes.minutosPorCredito.valor = 10;
  assert.equal(valorPorTiempo(e, 15), 2, 'la regla se puede cambiar desde el panel');
});

test('cada tarea con minutos vale exactamente lo que dice la regla', () => {
  const e = catalogoInicial();
  for (const t of TAREAS_POR_DEFECTO) {
    if (t.minutos) assert.equal(t.valor, valorPorTiempo(e, t.minutos), t.nombre);
    for (const o of t.opciones || []) if (o.minutos) assert.equal(o.valor, valorPorTiempo(e, o.minutos), `${t.nombre}: ${o.etiqueta}`);
  }
});

test('una semana normal da ~147 créditos y ~31 estrellas (la v2 ×1,5)', () => {
  const s = casaNueva();
  const dias = SEMANA.map((f) => potencialDia(s, f));
  const creditos = dias.reduce((a, d) => a + d.creditos, 0);
  const estrellas = dias.reduce((a, d) => a + d.estrellas, 0);
  assert.equal(dias[0].creditos, 18, 'lunes');
  assert.equal(dias[6].creditos, 37, 'domingo, con la limpieza y las auditorías');
  assert.equal(creditos, 147);
  assert.equal(estrellas, 31, 'como la v2: un libro cuesta unas tres semanas');
});

test('el ocio cuesta 12 créditos la hora; el PC, 6 cada media hora', () => {
  const e = catalogoInicial();
  for (const a of TIENDA_POR_DEFECTO) {
    if (a.duracion && a.moneda === 'semana') assert.equal(a.precio * 60 / a.duracion, 12, a.nombre);
  }
  assert.equal(e.ajustes.pcCreditosPorBloque.valor, 6);
  assert.equal(e.ajustes.pcBloqueMinutos.valor, 30);
});

test('los premios que se negocian ya no vienen de fábrica', () => {
  const nombres = TIENDA_POR_DEFECTO.map((a) => a.nombre.toLowerCase()).join(' | ');
  for (const fuera of ['auriculares', 'bici', 'capricho', 'amigos', 'sin tareas', 'menú', 'cena']) {
    assert.ok(!nombres.includes(fuera), `no está «${fuera}»`);
  }
  assert.ok(TIENDA_POR_DEFECTO.some((a) => a.id === 'b_hora'), 'queda una hora de ocio a elegir, genérica');
});

/* ----------------------------- estrellas ------------------------------- */

test('cada obligatoria paga sus propias estrellas al aprobarse', () => {
  const s = casaNueva();
  const martes = '2026-11-17';
  assert.equal(marcarTarea(s, { fecha: martes, tareaId: 't_llamada' }).ok, true);
  aprobarMarca(s, idMarca(martes, 't_llamada'));
  assert.equal(saldoEstrellas(s.estado), 2, 'llamar a la familia vale 2');
  assert.equal(marcarTarea(s, { fecha: martes, tareaId: 't_trato' }).ok, true);
  aprobarMarca(s, idMarca(martes, 't_trato'));
  assert.equal(saldoEstrellas(s.estado), 3, 'buen trato vale 1');
  assert.equal(saldoCreditos(s.estado, martes), 0, 'y ninguna da créditos');
});

/* ------------------------------ tienda --------------------------------- */

test('el permiso de PC es gratis: no deja un apunte de 0 y el tiempo se paga aparte', () => {
  const s = casaNueva();
  dar(s, 30);
  const antes = Object.keys(s.estado.ledger).length;
  const r = solicitarCompra(s, { itemId: 'b_pc', fecha: LUNES, hora: '18:00' });
  assert.equal(r.ok, true, r.razon);
  assert.equal(Object.keys(s.estado.ledger).length, antes, 'sin apunte de 0 créditos');
  assert.equal(s.estado.compras[r.compraId].movimientoId, null);
});

test('una sesión de PC de 40 min cuesta 12 (dos medias horas empezadas)', () => {
  const s = casaNueva();
  dar(s, 30);
  const sabado = '2026-11-21';
  const t0 = new Date('2026-11-21T16:00:00').getTime();
  assert.equal(iniciarSesionPc(s, { fecha: sabado, ahora: t0, hora: '16:00' }).ok, true);
  const r = pararSesionPc(s, { ahora: t0 + 40 * 60000 });
  assert.equal(r.coste, 12);
});

test('el corte del ocio es distinto entre semana y el fin de semana', () => {
  const e = catalogoInicial();
  assert.equal(objetivosDe(e, LUNES).corte, '21:30');
  assert.equal(objetivosDe(e, '2026-11-21').corte, '22:30');
  assert.equal(objetivosDe(e, LUNES).dormir, '22:00');
  assert.equal(objetivosDe(e, '2026-11-21').dormir, '23:00');
});

/* ----------------------------- migración ------------------------------- */

test('una casa antigua recibe el catálogo nuevo sin perder nada', () => {
  const s = casaAntigua();
  s.set('tareas', 'tc_mia', { id: 'tc_mia', nombre: 'Tarea inventada por papá', tipo: 'estandar', valor: 4, categoria: 'tarde', dias: [0], activa: true });
  s.set('tienda', 'pr_mio', { id: 'pr_mio', nombre: 'Premio de papá', precio: 7, moneda: 'semana', tipo: 'premio', activo: true });
  assert.equal(migrarTiempo(s, { fecha: LUNES }), true);
  const e = s.estado;
  for (const id of TAREAS_RETIRADAS_36) assert.equal(e.tareas[id].activa, false, `${id} desactivada, no borrada`);
  for (const id of TIENDA_RETIRADA_36) assert.equal(e.tienda[id].activo, false, `${id} oculto, no borrado`);
  for (const t of TAREAS_POR_DEFECTO) assert.equal(e.tareas[t.id].valor, t.valor, t.id);
  assert.equal(e.tareas.t_cama.nombre, 'Cama hecha');
  assert.equal(e.tareas.t_cama.minutos, 5);
  assert.equal(e.tienda.b_tv.precio, 12);
  assert.equal(e.tienda.b_movil.duracion, 30);
  assert.equal(e.tareas.h_agua.activa, false, 'los hábitos quedan apagados');
  assert.equal(e.tareas.tc_mia.activa, true, 'lo del padre se queda');
  assert.equal(e.tienda.pr_mio.activo, true, 'lo del padre se queda');
  assert.equal(s.ajuste('autoAprobacionHoras'), 6);
  assert.equal(s.ajuste('pcCreditosPorBloque'), 6);
  assert.equal(s.ajuste('versionEconomia'), VERSION_TIEMPO);
});

test('el saldo y la hucha se multiplican por 1,5, depósitos incluidos', () => {
  const s = casaAntigua();
  dar(s, 40);
  dar(s, 100, 'hucha');
  assert.equal(abrirDeposito(s, { capital: 60, dias: 14, fecha: '2026-11-10' }).ok, true);
  assert.equal(saldoHucha(s.estado), 40);
  assert.equal(capitalBloqueado(s.estado), 60);
  migrarTiempo(s, { fecha: LUNES });
  assert.equal(saldoCreditos(s.estado, LUNES), 60, '40 × 1,5');
  assert.equal(saldoHucha(s.estado), 40 + 50, 'el extra de toda la hucha (100 × 0,5) va a la parte libre');
  assert.equal(s.estado.ledger.mov_v36_saldo.concepto, 'Sistema nuevo: tus créditos ×1,5');
});

test('la migración es de una sola vez', () => {
  const s = casaAntigua();
  dar(s, 40);
  migrarTiempo(s, { fecha: LUNES });
  assert.equal(migrarTiempo(s, { fecha: LUNES }), false);
  assert.equal(saldoCreditos(s.estado, LUNES), 60, 'no se vuelve a multiplicar');
});

test('dos móviles que migran a la vez escriben el mismo apunte, no dos', () => {
  const base = casaAntigua();
  dar(base, 40);
  const copia = JSON.parse(JSON.stringify(base.estado));
  const a = crearStore(JSON.parse(JSON.stringify(copia)));
  const b = crearStore(JSON.parse(JSON.stringify(copia)));
  const opsDeB = [];
  b.suscribirOps((op) => opsDeB.push(op));
  migrarTiempo(a, { fecha: LUNES });
  migrarTiempo(b, { fecha: LUNES });
  for (const op of opsDeB) if (op.tipo === 'set') a.set(op.coleccion, op.id, op.registro, { remoto: true });
  assert.equal(saldoCreditos(a.estado, LUNES), 60, 'la conversión cuenta una sola vez');
});

test('una casa nueva no recibe ninguna conversión', () => {
  const s = casaNueva();
  assert.equal(Object.keys(s.estado.ledger).length, 0);
});
