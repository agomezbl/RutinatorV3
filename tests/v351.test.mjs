/**
 * v3.5.1 — los bonos de pantalla dicen cuánto tiempo dan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { crearStore } from '../src/core/store.js';
import { catalogoInicial } from '../src/core/defaults.js';
import { textoDuracion } from '../src/core/util.js';
import { migrarTienda, VERSION_TIENDA } from '../src/core/gestion.js';
import { solicitarCompra } from '../src/core/leisure.js';
import { crearMovimiento, TIPOS } from '../src/core/ledger.js';

test('textoDuracion escribe horas y minutos', () => {
  assert.equal(textoDuracion(60), '1 h');
  assert.equal(textoDuracion(90), '1 h 30 min');
  assert.equal(textoDuracion(45), '45 min');
  assert.equal(textoDuracion(120), '2 h');
  assert.equal(textoDuracion(0), '');
  assert.equal(textoDuracion(null), '');
});

test('una tienda nueva trae 1 h en TV, móvil y anime', () => {
  const t = catalogoInicial().tienda;
  assert.equal(t.b_tv.duracion, 60);
  assert.equal(t.b_movil.duracion, 60);
  assert.equal(t.b_anime.duracion, 60);
  assert.equal(t.b_anime_extra.duracion, 30);
});

test('migrarTienda pone la duración a una tienda antigua sin pisar lo del padre', () => {
  const e = catalogoInicial();
  for (const a of Object.values(e.tienda)) delete a.duracion;
  e.tienda.b_tv.descripcion = 'Un rato de tele hoy.';                     // texto de fábrica antiguo
  e.tienda.b_movil.descripcion = 'Media hora de móvil, nada más.';         // texto del padre
  e.tienda.b_anime.duracion = 45;                                          // tiempo del padre
  const s = crearStore(e);
  assert.equal(migrarTienda(s), true);
  assert.equal(s.estado.tienda.b_tv.duracion, 60);
  assert.equal(s.estado.tienda.b_tv.descripcion, 'Tele hoy, el tiempo que marca el bono.');
  assert.equal(s.estado.tienda.b_movil.duracion, 60);
  assert.equal(s.estado.tienda.b_movil.descripcion, 'Media hora de móvil, nada más.');
  assert.equal(s.estado.tienda.b_anime.duracion, 45);
  assert.equal(s.ajuste('versionTienda'), VERSION_TIENDA);
  // Si el padre luego quita el tiempo, la migración no vuelve a ponerlo.
  s.patch('tienda', 'b_tv', { duracion: null });
  assert.equal(migrarTienda(s), false);
  assert.equal(s.estado.tienda.b_tv.duracion, null);
});

test('la compra guarda el tiempo del bono para el billete', () => {
  const s = crearStore(catalogoInicial());
  const m = crearMovimiento({ cuenta: 'semana', tipo: TIPOS.AJUSTE, cantidad: 50, concepto: 'prueba', categoria: 'ajuste', fecha: '2026-11-07', actor: 'padre' });
  s.set('ledger', m.id, m);
  const r = solicitarCompra(s, { itemId: 'b_tv', fecha: '2026-11-07', hora: '17:00' });
  assert.equal(r.ok, true, r.razon);
  const compra = Object.values(s.estado.compras)[0];
  assert.equal(compra.duracion, 60);
});
