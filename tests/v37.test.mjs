/**
 * v3.7 — el banco de Nil: depósito con plazo libre, fondo variable, freno
 * semanal, topes, pausa, consejos y la migración de una casa instalada.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearStore } from '../src/core/store.js';
import { catalogoInicial } from '../src/core/defaults.js';
import { saldoHucha, crearMovimiento, TIPOS } from '../src/core/ledger.js';
import { abrirDeposito, procesarStakings, porcentajeDePlazo, abonarInteresHucha, stakingsActivos } from '../src/core/staking.js';
import {
  pctVariable, plazosSugeridos, meterEnFondo, sacarDeFondo, fondo, rendimientoDeSemana, procesarFondo,
  avisosBanco, consejoAhorro, ejemploBanco, ID_FONDO,
} from '../src/core/banco.js';
import { estadoFreno, ganadoConTareas, pagarAplazado } from '../src/core/freno.js';
import { migrarEconomia, migrarTienda, migrarTiempo, migrarBanco, VERSION_BANCO } from '../src/core/gestion.js';
import { addDays } from '../src/core/util.js';

const LUNES = '2026-11-16';

function casa() {
  const s = crearStore(catalogoInicial());
  migrarEconomia(s); migrarTienda(s); migrarTiempo(s, { fecha: LUNES }); migrarBanco(s);
  return s;
}
function hucha(s, n, fecha = '2026-11-01') {
  const m = crearMovimiento({ cuenta: 'hucha', tipo: TIPOS.AJUSTE, cantidad: n, concepto: 'prueba', categoria: 'ajuste', fecha, actor: 'padre' });
  s.set('ledger', m.id, m);
}
function trabajo(s, n, fecha) {
  const m = crearMovimiento({ cuenta: 'semana', tipo: TIPOS.GANADO, cantidad: n, concepto: 'tareas', categoria: 'manana', fecha, actor: 'sistema' });
  s.set('ledger', m.id, m);
}

/* ------------------------------ depósito ------------------------------- */

test('el interés del depósito va en una recta entre el plazo corto y el largo', () => {
  const e = casa().estado;
  assert.equal(pctVariable(e, 3), 2);
  assert.equal(pctVariable(e, 30), 15);
  assert.equal(pctVariable(e, 7), 4);
  assert.equal(pctVariable(e, 14), 7.5);
  assert.equal(pctVariable(e, 2), 0, 'fuera del rango no hay interés');
  assert.equal(porcentajeDePlazo(e, 14), 7.5, 'la función de siempre usa la recta');
  assert.deepEqual(plazosSugeridos(e), [3, 7, 14, 30]);
});

test('se puede abrir un depósito de cualquier plazo del rango, con tope total', () => {
  const s = casa();
  hucha(s, 400);
  assert.equal(abrirDeposito(s, { capital: 50, dias: 10, fecha: LUNES }).ok, true, 'diez días, que antes no existía');
  assert.equal(abrirDeposito(s, { capital: 50, dias: 2, fecha: LUNES }).ok, false);
  assert.equal(abrirDeposito(s, { capital: 50, dias: 31, fecha: LUNES }).ok, false);
  const r = abrirDeposito(s, { capital: 260, dias: 30, fecha: LUNES });
  assert.equal(r.ok, false, 'más de 300 en depósitos a la vez');
  assert.match(r.razon, /300/);
  assert.equal(abrirDeposito(s, { capital: 250, dias: 30, fecha: LUNES }).ok, true);
});

/* ------------------------------- freno --------------------------------- */

test('el depósito cobra lo prometido: si el freno no deja, se aplaza y llega después', () => {
  const s = casa();
  hucha(s, 100);
  trabajo(s, 20, '2026-11-20');
  assert.equal(abrirDeposito(s, { capital: 100, dias: 30, fecha: LUNES }).ok, true);
  const vence = addDays(LUNES, 30);
  trabajo(s, 50, addDays(vence, -1)); // 50 ganados en los 7 días → techo 10
  procesarStakings(s, { fecha: vence });
  const f = estadoFreno(s.estado, vence);
  assert.equal(f.techo, 10);
  assert.equal(saldoHucha(s.estado), 100 + 10, 'vuelve el capital y 10 de interés');
  assert.equal(f.aplazado, 6, 'los otros 5, más 1 del interés de la cuenta de esa semana, esperan');
  trabajo(s, 100, addDays(vence, 8));
  assert.equal(pagarAplazado(s, { fecha: addDays(vence, 8) }), 6);
  assert.equal(saldoHucha(s.estado), 116, 'al final cobra los 15 prometidos (y el 1 de la cuenta)');
});

test('la cuenta de ahorro paga como mucho 10 por semana y también pasa por el freno', () => {
  const s = casa();
  hucha(s, 2000);
  trabajo(s, 100, '2026-11-14');
  const r = abonarInteresHucha(s, { fecha: LUNES });
  assert.equal(r.interes, 10, 'el 1 % de 2000 son 20, pero el tope es 10');
  const s2 = casa();
  hucha(s2, 500);
  const r2 = abonarInteresHucha(s2, { fecha: LUNES });
  assert.equal(r2.interes, 0, 'sin trabajo en la semana, el interés espera');
  assert.equal(r2.aplazado, 5);
});

test('el trabajo que cuenta para el freno son las tareas, no los ajustes ni el ahorro', () => {
  const s = casa();
  trabajo(s, 30, LUNES);
  hucha(s, 500, LUNES);
  const m = crearMovimiento({ cuenta: 'semana', tipo: TIPOS.AJUSTE, cantidad: 40, concepto: 'regalo', categoria: 'ajuste', fecha: LUNES, actor: 'padre' });
  s.set('ledger', m.id, m);
  assert.equal(ganadoConTareas(s.estado, LUNES), 30);
});

/* ------------------------------- fondo --------------------------------- */

test('el rendimiento del fondo es el mismo en los dos móviles y está en el margen', () => {
  const a = casa(); const b = casa();
  a.fijarAjuste('semillaFondo', 'abc123'); b.fijarAjuste('semillaFondo', 'abc123');
  for (let i = 0; i < 52; i++) {
    const w = addDays(LUNES, 7 * i);
    const p = rendimientoDeSemana(a.estado, w);
    assert.equal(p, rendimientoDeSemana(b.estado, w));
    assert.ok(p >= -4 && p <= 6, `${w}: ${p}`);
  }
});

test('el fondo se mueve cada semana completa, con interés simple y suelo', () => {
  const s = casa();
  hucha(s, 300);
  s.fijarAjuste('semillaFondo', 'prueba');
  assert.equal(meterEnFondo(s, { cantidad: 100, fecha: LUNES }).ok, true);
  procesarFondo(s, { fecha: addDays(LUNES, 3) });
  assert.equal(fondo(s.estado).historial.length, 0, 'la semana en que entra no cuenta');
  procesarFondo(s, { fecha: addDays(LUNES, 7 * 5) });
  const f = fondo(s.estado);
  assert.equal(f.historial.length, 4, 'cuatro semanas completas');
  let esperado = 100;
  for (const h of f.historial) {
    esperado = Math.max(75, esperado + Math.round(100 * h.pct / 100));
    assert.equal(h.valor, esperado, 'cada semana sobre lo puesto (100), no sobre lo ganado');
  }
  assert.equal(f.capital, esperado);
  procesarFondo(s, { fecha: addDays(LUNES, 7 * 5) });
  assert.equal(fondo(s.estado).historial.length, 4, 'idempotente');
});

test('nunca baja del suelo aunque todas las semanas sean malas', () => {
  const s = casa();
  hucha(s, 100);
  s.fijarAjuste('fondoMinPct', -20); s.fijarAjuste('fondoMaxPct', -20);
  assert.equal(meterEnFondo(s, { cantidad: 100, fecha: LUNES }).ok, true);
  procesarFondo(s, { fecha: addDays(LUNES, 7 * 10) });
  assert.equal(fondo(s.estado).capital, 75);
});

test('lo que se mete a mitad de semana empieza a moverse la semana siguiente', () => {
  const s = casa();
  hucha(s, 300);
  s.fijarAjuste('fondoMinPct', 5); s.fijarAjuste('fondoMaxPct', 5);
  meterEnFondo(s, { cantidad: 100, fecha: LUNES });
  procesarFondo(s, { fecha: addDays(LUNES, 9) }); // miércoles de la semana 2
  meterEnFondo(s, { cantidad: 100, fecha: addDays(LUNES, 9) });
  procesarFondo(s, { fecha: addDays(LUNES, 14) });
  const f = fondo(s.estado);
  assert.equal(f.historial.at(-1).cambio, 5, 'la semana 2 solo mueve los 100 que estaban desde el lunes');
  assert.equal(f.aportado, 200);
});

test('sacar del fondo: la ganancia pasa por el freno y la pérdida se queda', () => {
  const s = casa();
  hucha(s, 100);
  s.fijarAjuste('fondoMinPct', 6); s.fijarAjuste('fondoMaxPct', 6);
  meterEnFondo(s, { cantidad: 100, fecha: LUNES });
  const dia = addDays(LUNES, 7 * 3);
  procesarFondo(s, { fecha: dia });
  assert.equal(fondo(s.estado).capital, 112);
  trabajo(s, 50, dia); // techo 10
  const r = sacarDeFondo(s, { cantidad: 112, fecha: dia });
  assert.equal(r.ok, true);
  assert.equal(r.ganancia, 12);
  assert.equal(r.aplazado, 2);
  assert.equal(saldoHucha(s.estado), 110);
  assert.equal(s.estado.stakings[ID_FONDO].estado, 'cobrado');

  const p = casa();
  hucha(p, 100);
  p.fijarAjuste('fondoMinPct', -4); p.fijarAjuste('fondoMaxPct', -4);
  meterEnFondo(p, { cantidad: 100, fecha: LUNES });
  procesarFondo(p, { fecha: addDays(LUNES, 7 * 3) });
  const valor = fondo(p.estado).capital;
  assert.equal(valor, 92, 'dos semanas completas a −4 %');
  const r2 = sacarDeFondo(p, { cantidad: 46, fecha: addDays(LUNES, 7 * 3) });
  assert.equal(r2.ganancia < 0, true, 'sacar en una bajada es perder de verdad');
  assert.equal(fondo(p.estado).aportado, 50, 'sacando la mitad del valor, queda la mitad de lo puesto');
  assert.equal(fondo(p.estado).capital, 46);
});

test('el fondo tiene mínimo y tope', () => {
  const s = casa();
  hucha(s, 500);
  assert.equal(meterEnFondo(s, { cantidad: 5, fecha: LUNES }).ok, false);
  assert.equal(meterEnFondo(s, { cantidad: 150, fecha: LUNES }).ok, true);
  const r = meterEnFondo(s, { cantidad: 60, fecha: LUNES });
  assert.equal(r.ok, false);
  assert.match(r.razon, /50/, 'le dice cuánto le queda');
});

/* ------------------------------- pausa --------------------------------- */

test('en pausa no hay interés, el fondo no se mueve y no se abre nada; lo firmado se respeta', () => {
  const s = casa();
  hucha(s, 300);
  trabajo(s, 200, '2026-11-14');
  assert.equal(abrirDeposito(s, { capital: 100, dias: 3, fecha: '2026-11-13' }).ok, true);
  assert.equal(meterEnFondo(s, { cantidad: 50, fecha: '2026-11-09' }).ok, true);
  s.fijarAjuste('bancoPausado', true);
  assert.equal(abonarInteresHucha(s, { fecha: LUNES }).ok, false);
  assert.equal(abrirDeposito(s, { capital: 20, dias: 7, fecha: LUNES }).ok, false);
  assert.equal(meterEnFondo(s, { cantidad: 20, fecha: LUNES }).ok, false);
  const antes = fondo(s.estado).capital;
  procesarStakings(s, { fecha: LUNES });
  assert.equal(fondo(s.estado).capital, antes, 'el fondo, congelado');
  assert.equal(stakingsActivos(s.estado).filter((x) => x.tipo === 'deposito').length, 0, 'el depósito vencido se cobra igual');
});

/* ---------------------------- migración -------------------------------- */

test('una casa de la v3.6 recibe la hucha nueva; sus depósitos conservan su interés', () => {
  const s = crearStore(catalogoInicial({ version: 35 }));
  migrarEconomia(s); migrarTienda(s);
  hucha(s, 200);
  assert.equal(abrirDeposito(s, { capital: 100, dias: 30, fecha: '2026-11-10' }).ok, true);
  migrarTiempo(s, { fecha: '2026-11-10' });
  assert.equal(migrarBanco(s), true);
  assert.equal(s.ajuste('versionBanco'), VERSION_BANCO);
  assert.equal(s.ajuste('frenoActivo'), true);
  assert.equal(s.ajuste('fondoActivo'), true);
  assert.equal(s.ajuste('interesHuchaTope'), 10);
  const dep = stakingsActivos(s.estado).find((x) => x.tipo === 'deposito');
  assert.equal(dep.pct, 12, 'el depósito firmado con la v3.5 sigue al 12 %');
  assert.equal(migrarBanco(s), false, 'una sola vez');
});

/* --------------------------- padre y consejos -------------------------- */

test('el panel avisa cuando un número se dispara', () => {
  const s = casa();
  assert.deepEqual(avisosBanco(s.estado), [], 'los valores de fábrica no disparan avisos');
  s.fijarAjuste('depositoPctMax', 40);
  s.fijarAjuste('frenoActivo', false);
  const a = avisosBanco(s.estado);
  assert.equal(a.length, 2);
  const ej = ejemploBanco(casa().estado);
  assert.deepEqual([ej.cuentaSemana, ej.depositoCorto.gana, ej.depositoLargo.gana], [1, 2, 15]);
});

test('los consejos usan los números de Nil y solo proponen lo que puede hacer', () => {
  const s = casa();
  assert.equal(consejoAhorro(s.estado, LUNES), null, 'con la hucha vacía no hay nada que proponer');
  hucha(s, 60);
  const c = consejoAhorro(s.estado, LUNES);
  assert.ok(c && /\d/.test(c), c);
});
