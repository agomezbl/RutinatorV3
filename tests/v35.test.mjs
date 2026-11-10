/**
 * v3.5 — economía como la v2 y herramientas del padre.
 *
 *   - Lo avanzado se apaga (no se borra) y se vuelve a encender.
 *   - Saldo continuo: los créditos no caducan al cerrar la semana.
 *   - Hucha: guardar y sacar son traspasos, no ganar ni gastar.
 *   - Puntos a mano en cualquier cuenta, con motivo y con fecha.
 *   - Anular con motivo, histórico filtrable y CSV.
 *   - Días pasados: validar varias tareas y recalcular la racha.
 *   - Precios en bloque, tienda en pausa, multiplicador por fechas.
 *   - Grupos de tareas con nombre e icono propios.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { addDays, weekIdOf } from '../src/core/util.js';
import { crearStore } from '../src/core/store.js';
import { catalogoInicial, CATEGORIAS } from '../src/core/defaults.js';
import {
  saldoHucha, saldoEstrellas, saldoCreditos, resumenSemana, crearMovimiento, TIPOS,
} from '../src/core/ledger.js';
import { marcarTarea, tareasDelDia, marcaDe, rachaActual } from '../src/core/tasks.js';
import { cerrarSemana } from '../src/core/week.js';
import { multiplicadorEn } from '../src/core/economy.js';
import { puedeComprar } from '../src/core/leisure.js';
import { abrirDeposito } from '../src/core/staking.js';
import {
  migrarEconomia, VERSION_ECONOMIA, INSTRUMENTOS_AVANZADOS, instrumentoEncendido, cambiarInstrumento,
  guardarEnHucha, sacarDeHucha, ajusteCuenta, anularMovimiento, anulable, historico, historicoCSV,
  validarDiaPasado, recalcularRachaDesde, fechaRecuperable, tareasDeDiaPasado, ajustarPrecios,
  tiendaPausada, aplicarCategorias, editarCategoria, restaurarCategoria, DIAS_ATRAS,
} from '../src/core/gestion.js';

const LUNES = '2026-09-07';
const MIERCOLES = '2026-09-09';
const DOMINGO = '2026-09-13';
const LUNES2 = '2026-09-14';
const MIERCOLES2 = '2026-09-16';

function nuevoStore() {
  const s = crearStore(catalogoInicial());
  migrarEconomia(s);
  return s;
}

function dar(s, cantidad, fecha = LUNES, cuenta = 'semana') {
  const m = crearMovimiento({ cuenta, tipo: TIPOS.AJUSTE, cantidad, concepto: 'saldo de prueba', categoria: 'ajuste', fecha, actor: 'padre' });
  s.set('ledger', m.id, m);
  return m;
}

/* ------------------------------- migración ------------------------------ */

test('la migración apaga lo avanzado una sola vez y lo deja todo recuperable', () => {
  const s = crearStore(catalogoInicial());
  assert.equal(s.ajuste('apuestaActiva'), true, 'de fábrica venía encendido');
  assert.equal(migrarEconomia(s), true);
  for (const inst of INSTRUMENTOS_AVANZADOS) {
    assert.equal(instrumentoEncendido(s.estado, inst), false, `${inst.id} queda apagado`);
  }
  assert.equal(s.ajuste('modoSaldo'), 'continuo');
  assert.equal(s.ajuste('versionEconomia'), VERSION_ECONOMIA);
  assert.equal(s.ajuste('depositoActivo'), true, 'el depósito a plazo sigue: es como la v2');
  // idempotente: si el padre enciende algo, la migración no vuelve a apagarlo
  cambiarInstrumento(s, 'apuesta', true);
  assert.equal(migrarEconomia(s), false);
  assert.equal(s.ajuste('apuestaActiva'), true);
});

test('encender y apagar desde Avanzado fija los valores de cada instrumento', () => {
  const s = nuevoStore();
  const escudos = INSTRUMENTOS_AVANZADOS.find((i) => i.id === 'escudos');
  assert.equal(cambiarInstrumento(s, 'escudos', true).ok, true);
  assert.equal(instrumentoEncendido(s.estado, escudos), true);
  assert.equal(s.ajuste('escudosMaximos'), 2);
  cambiarInstrumento(s, 'escudos', false);
  assert.equal(s.ajuste('escudosMaximos'), 0);
  assert.equal(cambiarInstrumento(s, 'nada', true).ok, false);
});

/* ------------------------------ saldo continuo -------------------------- */

test('saldo continuo: cerrar la semana no vacía los créditos ni toca la hucha', () => {
  const s = nuevoStore();
  dar(s, 50, LUNES);
  const r = cerrarSemana(s, { fecha: LUNES });
  assert.equal(r.ok, true);
  assert.equal(r.traspasado, 0);
  assert.equal(saldoHucha(s.estado), 0);
  assert.equal(saldoCreditos(s.estado, LUNES2), 50, 'la semana siguiente siguen ahí');
  dar(s, 10, LUNES2);
  assert.equal(saldoCreditos(s.estado, MIERCOLES2), 60);
});

test('con el cierre semanal encendido, vuelve el comportamiento de la v3 original', () => {
  const s = nuevoStore();
  cambiarInstrumento(s, 'cierreSemanal', true);
  dar(s, 40, LUNES);
  cerrarSemana(s, { fecha: LUNES });
  assert.equal(saldoHucha(s.estado), 40);
  assert.equal(saldoCreditos(s.estado, LUNES2), 0);
});

/* --------------------------------- hucha -------------------------------- */

test('guardar y sacar de la hucha son traspasos: ni ganar ni gastar', () => {
  const s = nuevoStore();
  dar(s, 30, LUNES);
  assert.equal(guardarEnHucha(s, { cantidad: 20, fecha: LUNES }).ok, true);
  assert.equal(saldoCreditos(s.estado, LUNES), 10);
  assert.equal(saldoHucha(s.estado), 20);
  assert.equal(sacarDeHucha(s, { cantidad: 5, fecha: LUNES }).ok, true);
  assert.equal(saldoHucha(s.estado), 15);
  assert.equal(saldoCreditos(s.estado, LUNES), 15);
  const r = resumenSemana(s.estado, LUNES);
  assert.equal(r.gastado, 0, 'guardar no cuenta como gasto');
  assert.equal(guardarEnHucha(s, { cantidad: 99, fecha: LUNES }).ok, false, 'no más de lo que hay');
  assert.equal(sacarDeHucha(s, { cantidad: 0, fecha: LUNES }).ok, false);
});

/* ------------------------------ ajustes a mano -------------------------- */

test('añadir o quitar puntos: motivo obligatorio, cualquier cuenta y hasta 14 días atrás', () => {
  const s = nuevoStore();
  const hoy = MIERCOLES2;
  assert.equal(ajusteCuenta(s, { cantidad: 5, motivo: '', hoy }).ok, false);
  assert.equal(ajusteCuenta(s, { cantidad: 0, motivo: 'x', hoy }).ok, false);
  assert.equal(ajusteCuenta(s, { cantidad: 5, motivo: 'x', cuenta: 'banco', hoy }).ok, false);
  assert.equal(ajusteCuenta(s, { cantidad: 5, motivo: 'x', fecha: addDays(hoy, 1), hoy }).ok, false, 'futuro no');
  assert.equal(ajusteCuenta(s, { cantidad: 5, motivo: 'x', fecha: addDays(hoy, -DIAS_ATRAS - 1), hoy }).ok, false);

  const r = ajusteCuenta(s, { cantidad: 3, motivo: 'Ayudó a un vecino', cuenta: 'estrellas', fecha: LUNES2, hoy });
  assert.equal(r.ok, true);
  assert.equal(saldoEstrellas(s.estado), 3);
  assert.equal(s.obtener('ledger', r.movimientoId).fecha, LUNES2, 'queda en el día al que corresponde');
  assert.equal(s.obtener('ledger', r.movimientoId).concepto, 'Ayudó a un vecino');

  assert.equal(ajusteCuenta(s, { cantidad: -5, motivo: 'x', cuenta: 'estrellas', hoy }).ok, false, 'las estrellas no bajan de 0');
  assert.equal(ajusteCuenta(s, { cantidad: -2, motivo: 'Tarea marcada sin hacer', cuenta: 'semana', hoy }).ok, true, 'los créditos sí pueden quedar en negativo');
  assert.equal(saldoCreditos(s.estado, hoy), -2);
});

test('anular: se revierte con motivo, nunca se borra, y no se anula dos veces', () => {
  const s = nuevoStore();
  const m = dar(s, 12, LUNES);
  assert.equal(anularMovimiento(s, m.id, '').ok, false, 'pide motivo');
  assert.equal(anularMovimiento(s, m.id, 'Me equivoqué de cantidad').ok, true);
  assert.equal(saldoCreditos(s.estado, LUNES), 0);
  assert.ok(s.obtener('ledger', m.id), 'el original sigue en el histórico');
  assert.ok(s.obtener('ledger', m.id).anuladoPor);
  assert.equal(anularMovimiento(s, m.id, 'otra vez').ok, false);
  assert.equal(anulable(s.obtener('ledger', s.obtener('ledger', m.id).anuladoPor)), false, 'una anulación no se anula');
  dar(s, 10);
  guardarEnHucha(s, { cantidad: 5, fecha: LUNES });
  const tr = Object.values(s.estado.ledger).find((x) => x.tipo === TIPOS.TRASPASO);
  assert.equal(anulable(tr), false, 'los traspasos se deshacen con otro traspaso');
});

test('el histórico filtra por cuenta, tipo, fechas y texto, con el saldo tras cada movimiento', () => {
  const s = nuevoStore();
  dar(s, 10, LUNES);
  dar(s, 5, MIERCOLES);
  ajusteCuenta(s, { cantidad: -3, motivo: 'Pantallas sin permiso', fecha: MIERCOLES, hoy: MIERCOLES });
  dar(s, 2, MIERCOLES, 'estrellas');
  const todo = historico(s.estado);
  assert.equal(todo.length, 4);
  assert.equal(todo[0].concepto, 'saldo de prueba', 'del más nuevo al más antiguo');
  const creditos = historico(s.estado, { cuenta: 'semana' });
  assert.deepEqual(creditos.map((m) => m.saldoTras), [12, 15, 10]);
  assert.equal(historico(s.estado, { texto: 'pantallas' }).length, 1);
  assert.equal(historico(s.estado, { desde: MIERCOLES }).length, 3);
  assert.equal(historico(s.estado, { hasta: LUNES }).length, 1);
  assert.equal(historico(s.estado, { tipo: 'ganado' }).length, 0);
  const csv = historicoCSV(s.estado);
  assert.match(csv.split('\r\n')[0], /^Fecha;Cuenta;Tipo;Concepto;Cantidad/);
  assert.equal(csv.split('\r\n').length, 5);
  assert.match(csv, /Pantallas sin permiso;-3;12;papá/);
});

/* -------------------------------- días pasados -------------------------- */

function tareasConValor(s, fecha) {
  return tareasDelDia(s.estado, fecha).filter((t) => t.tipo === 'estandar' && (t.valor || 0) > 0 && t.moneda !== 'estrellas');
}

test('días pasados: se validan varias tareas de golpe, fechadas en ese día', () => {
  const s = nuevoStore();
  const hoy = MIERCOLES2;
  const dia = LUNES2;
  const [a, b] = tareasConValor(s, dia);
  const r = validarDiaPasado(s, { fecha: dia, items: [{ tareaId: a.id }, { tareaId: b.id }], hoy });
  assert.equal(r.ok, true);
  assert.equal(r.hechas, 2);
  assert.equal(r.creditos, a.valor + b.valor);
  assert.equal(marcaDe(s.estado, dia, a.id).estado, 'aprobada');
  const movs = Object.values(s.estado.ledger).filter((m) => m.refTipo === 'tarea');
  assert.ok(movs.every((m) => m.fecha === dia && m.provisional === false && m.actor === 'padre'));
  assert.equal(saldoCreditos(s.estado, hoy), a.valor + b.valor);
  // repetir no duplica nada
  assert.equal(validarDiaPasado(s, { fecha: dia, items: [{ tareaId: a.id }], hoy }).hechas, 0);
  assert.equal(saldoCreditos(s.estado, hoy), a.valor + b.valor);
});

test('días pasados: aprueba lo pendiente, rehace lo vetado, y respeta el límite de 14 días', () => {
  const s = nuevoStore();
  const hoy = MIERCOLES2;
  const dia = LUNES2;
  const [a] = tareasConValor(s, dia);
  marcarTarea(s, { fecha: dia, tareaId: a.id, actor: 'nil' });
  assert.equal(marcaDe(s.estado, dia, a.id).estado, 'pendiente');
  const obligatoria = tareasDelDia(s.estado, dia).find((t) => t.tipo === 'obligatoria');
  const eleccion = tareasDelDia(s.estado, dia).find((t) => t.tipo === 'eleccion');
  const items = [{ tareaId: a.id }, { tareaId: obligatoria.id }];
  if (eleccion) items.push({ tareaId: eleccion.id, opcionId: eleccion.opciones[1].id });
  const r = validarDiaPasado(s, { fecha: dia, items, hoy });
  assert.equal(r.hechas, items.length);
  assert.equal(marcaDe(s.estado, dia, a.id).estado, 'aprobada');
  assert.equal(marcaDe(s.estado, dia, obligatoria.id).estado, 'aprobada');
  assert.ok(saldoEstrellas(s.estado) >= 1, 'la obligatoria da su estrella');
  if (eleccion) assert.equal(marcaDe(s.estado, dia, eleccion.id).opcionId, eleccion.opciones[1].id);
  const lista = tareasDeDiaPasado(s.estado, dia);
  assert.ok(lista.some((x) => x.estado === 'aprobada'));

  assert.equal(fechaRecuperable(addDays(hoy, -DIAS_ATRAS), hoy), true);
  assert.equal(fechaRecuperable(addDays(hoy, -DIAS_ATRAS - 1), hoy), false);
  assert.equal(validarDiaPasado(s, { fecha: addDays(hoy, -20), items, hoy }).ok, false);
  assert.equal(validarDiaPasado(s, { fecha: addDays(hoy, 1), items, hoy }).ok, false);
  assert.equal(validarDiaPasado(s, { fecha: dia, items: [], hoy }).ok, false);
});

test('validar un día de una semana ya cerrada recalcula su cumplimiento y la racha', () => {
  const s = nuevoStore();
  cerrarSemana(s, { fecha: LUNES }); // semana vacía: 0 % → racha 0
  assert.equal(rachaActual(s.estado), 0);
  assert.equal(s.estado.semanas[LUNES].cumplimiento, 0);
  // Se recupera TODA la semana (los días que caen dentro de los 14).
  const hoy = addDays(DOMINGO, 2);
  for (let i = 0; i < 7; i++) {
    const d = addDays(LUNES, i);
    const items = tareasDelDia(s.estado, d).map((t) => ({ tareaId: t.id, opcionId: t.tipo === 'eleccion' ? t.opciones[0].id : null }));
    validarDiaPasado(s, { fecha: d, items, hoy });
  }
  assert.equal(s.estado.semanas[LUNES].cumplimiento, 100);
  assert.equal(rachaActual(s.estado), 1, 'la racha sube sola');
  assert.equal(recalcularRachaDesde(s, weekIdOf(LUNES)), 1, 'y recalcular otra vez da lo mismo');
});

/* ---------------------------------- tienda ------------------------------ */

test('subir o bajar precios en bloque redondea y respeta los suelos', () => {
  const s = nuevoStore();
  const antes = s.obtener('tienda', 'b_tv').precio;
  const r = ajustarPrecios(s, { pct: 50, moneda: 'semana', soloOcio: true });
  assert.equal(r.ok, true);
  assert.equal(s.obtener('tienda', 'b_tv').precio, Math.round(antes * 1.5));
  assert.equal(s.obtener('tienda', 'p_peli').precio, 15, 'soloOcio no toca los premios');
  assert.equal(s.obtener('tienda', 'g_juego').precio, 350, 'ni la hucha');
  ajustarPrecios(s, { pct: -80, moneda: 'semana' });
  assert.ok(s.obtener('tienda', 'b_anime').precio >= 6, 'el suelo del anime aguanta');
  assert.equal(ajustarPrecios(s, { pct: 0 }).ok, false);
  assert.equal(ajustarPrecios(s, { pct: 500 }).ok, false);
});

test('con la tienda en pausa no se puede pedir nada', () => {
  const s = nuevoStore();
  dar(s, 100, LUNES);
  s.fijarAjuste('tiendaPausada', true);
  assert.equal(tiendaPausada(s.estado), true);
  const r = puedeComprar(s.estado, s.obtener('tienda', 'p_peli'), LUNES, '12:00');
  assert.equal(r.ok, false);
  assert.match(r.razon, /pausa/);
});

test('multiplicador entre dos fechas', () => {
  const s = nuevoStore();
  s.lote((x) => {
    x.fijarAjuste('multiplicadorValor', 2);
    x.fijarAjuste('multiplicadorAmbito', 'rango');
    x.fijarAjuste('multiplicadorDesde', LUNES);
    x.fijarAjuste('multiplicadorHasta', MIERCOLES);
  });
  assert.equal(multiplicadorEn(s.estado, LUNES), 2);
  assert.equal(multiplicadorEn(s.estado, MIERCOLES), 2);
  assert.equal(multiplicadorEn(s.estado, DOMINGO), 1);
});

test('el depósito a plazo de la v2 sigue disponible tras la migración', () => {
  const s = nuevoStore();
  dar(s, 100, LUNES, 'hucha');
  const r = abrirDeposito(s, { capital: 30, dias: 7, fecha: LUNES });
  assert.equal(r.ok, true, 'el depósito a plazo sigue disponible');
});

/* -------------------------------- categorías ---------------------------- */

test('los grupos de tareas se renombran, se crean y se restauran', () => {
  const s = nuevoStore();
  const original = CATEGORIAS.tarde.etiqueta;
  assert.equal(editarCategoria(s, 'tarde', { etiqueta: 'Después del cole', icono: '🎒' }).ok, true);
  assert.equal(CATEGORIAS.tarde.etiqueta, 'Después del cole');
  assert.equal(CATEGORIAS.tarde.color, CATEGORIAS.tarde.color, 'conserva el color');
  const n = editarCategoria(s, null, { etiqueta: 'Música', icono: '🎸' });
  assert.equal(n.ok, true);
  assert.equal(CATEGORIAS[n.id].etiqueta, 'Música');
  assert.equal(editarCategoria(s, 'tarde', { etiqueta: '  ' }).ok, false);
  restaurarCategoria(s, 'tarde');
  assert.equal(CATEGORIAS.tarde.etiqueta, original);
  // otro estado sin personalizar deja las categorías de fábrica
  aplicarCategorias(crearStore(catalogoInicial()).estado);
  assert.equal(CATEGORIAS[n.id], undefined);
  assert.equal(CATEGORIAS.tarde.etiqueta, original);
});
