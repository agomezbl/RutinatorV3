/**
 * Pruebas del asistente de primer uso: la pantalla que convierte el catálogo
 * de fábrica en el de la casa que lo instala.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearStore } from '../src/core/store.js';
import { catalogoInicial } from '../src/core/defaults.js';
import { tareasDelDia } from '../src/core/tasks.js';
import { habitosDelDia } from '../src/core/health.js';
import { puedeComprar } from '../src/core/leisure.js';
import {
  necesitaConfiguracion, configuracionInicial, aplicarConfiguracion,
  saltarConfiguracion, reabrirConfiguracion, validarPaso, validarTodo,
  resumenDeConfiguracion, BLOQUES, OCIO, EXTRAS,
} from '../src/core/onboarding.js';

function nuevo() {
  return crearStore(catalogoInicial({ version: 35 }));
}

const BASE = {
  nombre: 'Marta',
  tratamiento: 'mamá',
  hayColegio: true,
  diasColegio: [0, 1, 2, 3, 4],
  entradaColegio: '09:00',
  salidaColegio: '14:00',
  cenaEntreSemana: '20:00',
  dormirEntreSemana: '21:30',
  dormirFinde: '23:00',
  bloques: ['manana', 'tarde', 'noche', 'semanal', 'cuidado'],
  ocio: ['tv', 'movil'],
  juego: ['misiones', 'efectos'],
};

/* ========================= CUÁNDO APARECE ============================= */

test('una app recién instalada pide configurarse', () => {
  const s = nuevo();
  assert.ok(necesitaConfiguracion(s.estado));
});

test('una vez configurada no vuelve a pedirlo', () => {
  const s = nuevo();
  aplicarConfiguracion(s, BASE);
  assert.ok(!necesitaConfiguracion(s.estado));
});

test('saltarlo deja el catálogo de fábrica tal cual y no vuelve a salir', () => {
  const s = nuevo();
  const tareasAntes = Object.keys(s.estado.tareas).length;
  const activasAntes = Object.values(s.estado.tareas).filter((t) => t.activa !== false).length;
  saltarConfiguracion(s);
  assert.ok(!necesitaConfiguracion(s.estado));
  assert.equal(Object.keys(s.estado.tareas).length, tareasAntes);
  assert.equal(Object.values(s.estado.tareas).filter((t) => t.activa !== false).length, activasAntes);
  assert.equal(s.ajuste('nombreHijo'), 'Nil', 'no toca ni el nombre');
});

test('se puede volver a abrir desde el panel', () => {
  const s = nuevo();
  aplicarConfiguracion(s, BASE);
  reabrirConfiguracion(s);
  assert.ok(necesitaConfiguracion(s.estado));
});

test('los valores de partida salen del estado, no inventados', () => {
  const s = nuevo();
  const d = configuracionInicial(s.estado);
  assert.equal(d.cenaEntreSemana, '20:30');
  assert.equal(d.dormirEntreSemana, '22:30');
  assert.ok(d.bloques.length === BLOQUES.length, 'todos los bloques vienen marcados');
  assert.ok(d.juego.length === EXTRAS.length, 'y toda la capa de juego');
});

/* ============================ VALIDACIÓN ============================== */

test('el nombre es obligatorio y con un mínimo', () => {
  assert.ok(validarPaso('nombre', { ...BASE, nombre: '' }));
  assert.ok(validarPaso('nombre', { ...BASE, nombre: 'A' }));
  assert.equal(validarPaso('nombre', BASE), null);
});

test('las horas del colegio tienen que tener sentido', () => {
  assert.ok(validarPaso('colegio', { ...BASE, entradaColegio: '25:00' }));
  assert.ok(validarPaso('colegio', { ...BASE, entradaColegio: '15:00', salidaColegio: '09:00' }),
    'salir antes de entrar no vale');
  assert.ok(validarPaso('colegio', { ...BASE, diasColegio: [] }), 'hacen falta días');
  assert.equal(validarPaso('colegio', BASE), null);
});

test('sin colegio no se valida el horario del colegio', () => {
  assert.equal(validarPaso('colegio', { ...BASE, hayColegio: false, diasColegio: [] }), null);
});

test('no se puede dejar la app sin ningún bloque de tareas', () => {
  assert.ok(validarPaso('bloques', { ...BASE, bloques: [] }));
  const r = validarTodo({ ...BASE, bloques: [] });
  assert.ok(!r.ok);
  assert.equal(r.paso, 'bloques');
});

test('una configuración inválida no se aplica a medias', () => {
  const s = nuevo();
  const r = aplicarConfiguracion(s, { ...BASE, nombre: '' });
  assert.ok(!r.ok);
  assert.equal(s.ajuste('nombreHijo'), 'Nil', 'no ha tocado nada');
  assert.ok(necesitaConfiguracion(s.estado), 'y sigue pidiendo configurarse');
});

/* ============================== APLICAR =============================== */

test('la app pasa a ser de quien la instala', () => {
  const s = nuevo();
  aplicarConfiguracion(s, BASE);
  assert.equal(s.ajuste('nombreHijo'), 'Marta');
  assert.equal(s.ajuste('tratamientoAdulto'), 'mamá');
});

test('las horas de casa se guardan donde las lee el ritmo circadiano', () => {
  const s = nuevo();
  aplicarConfiguracion(s, BASE);
  assert.equal(s.ajuste('cenaEntreSemana'), '20:00');
  assert.equal(s.ajuste('dormirEntreSemana'), '21:30');
  assert.equal(s.ajuste('dormirFinde'), '23:00');
});

test('quitar un bloque aparta sus tareas, pero NO las borra', () => {
  const s = nuevo();
  const total = Object.keys(s.estado.tareas).length;
  aplicarConfiguracion(s, { ...BASE, bloques: ['tarde'] });

  assert.equal(Object.keys(s.estado.tareas).length, total, 'no se borra ninguna');
  const deManana = Object.values(s.estado.tareas).filter((t) => t.categoria === 'manana');
  assert.ok(deManana.length > 0);
  assert.ok(deManana.every((t) => t.activa === false), 'las de mañana quedan apartadas');
  const deTarde = Object.values(s.estado.tareas).filter((t) => t.categoria === 'tarde');
  assert.ok(deTarde.every((t) => t.activa === true), 'las de tarde siguen activas');
});

test('lo apartado desaparece de la lista del día, y se puede recuperar', () => {
  const s = nuevo();
  aplicarConfiguracion(s, { ...BASE, bloques: ['tarde'] });
  const hoy = '2026-11-03'; // un martes
  const delDia = tareasDelDia(s.estado, hoy);
  assert.ok(delDia.length > 0);
  // Solo quedan las de tarde. Las de 'preparacion' son la excepción a propósito:
  // no salen del catálogo, las genera el horario cuando un bloque está marcado
  // como "requiere preparación", así que no dependen de los bloques elegidos.
  assert.ok(delDia.every((t) => t.categoria === 'tarde' || t.categoria === 'preparacion'),
    delDia.map((t) => `${t.id}:${t.categoria}`).join(', '));
  assert.ok(!delDia.some((t) => t.categoria === 'manana'));

  // Volver a activarlo lo devuelve todo.
  aplicarConfiguracion(s, { ...BASE, bloques: ['tarde', 'manana'] });
  assert.ok(tareasDelDia(s.estado, hoy).some((t) => t.categoria === 'manana'));
});

test('quitar el bloque de cuidado aparta los hábitos de estrellas', () => {
  const s = nuevo();
  assert.ok(habitosDelDia(s.estado).length > 0);
  aplicarConfiguracion(s, { ...BASE, bloques: ['tarde'] });
  assert.equal(habitosDelDia(s.estado).length, 0);
  aplicarConfiguracion(s, { ...BASE, bloques: ['tarde', 'cuidado'] });
  assert.ok(habitosDelDia(s.estado).length > 0);
});

test('el ocio que no existe en esa casa desaparece de la tienda', () => {
  const s = nuevo();
  aplicarConfiguracion(s, { ...BASE, ocio: ['tv'] });
  assert.equal(s.estado.tienda.b_tv.activo, true);
  assert.equal(s.estado.tienda.b_movil.activo, false);
  assert.equal(s.estado.tienda.b_pc.activo, false);
  assert.equal(s.estado.tienda.b_anime.activo, false);
});

test('un bono desactivado no se puede comprar aunque se intente', () => {
  const s = nuevo();
  aplicarConfiguracion(s, { ...BASE, ocio: ['tv'] });
  const r = puedeComprar(s.estado, s.estado.tienda.b_movil, '2026-11-03', '16:00');
  assert.ok(!r.ok);
});

test('los premios grandes de la hucha no los toca el asistente', () => {
  const s = nuevo();
  const grandes = Object.values(s.estado.tienda).filter((a) => a.moneda === 'hucha');
  assert.ok(grandes.length > 0);
  aplicarConfiguracion(s, { ...BASE, ocio: [] });
  for (const g of grandes) {
    assert.notEqual(s.estado.tienda[g.id].activo, false, `${g.id} no debería tocarse`);
  }
});

test('el horario de colegio se reescribe con los días y horas elegidos', () => {
  const s = nuevo();
  aplicarConfiguracion(s, { ...BASE, diasColegio: [0, 2, 4], entradaColegio: '09:15', salidaColegio: '13:30' });
  const cole = Object.values(s.estado.horario).filter((b) => b.tipo === 'colegio');
  assert.equal(cole.length, 3);
  assert.deepEqual(cole.map((b) => b.dia).sort(), [0, 2, 4]);
  for (const b of cole) {
    assert.equal(b.inicio, '09:15');
    assert.equal(b.fin, '13:30');
    assert.ok(b.bloqueaOcio);
  }
});

test('sin colegio no queda ningún bloque de colegio en el horario', () => {
  const s = nuevo();
  aplicarConfiguracion(s, { ...BASE, hayColegio: false });
  assert.equal(Object.values(s.estado.horario).filter((b) => b.tipo === 'colegio').length, 0);
});

test('el asistente no pisa las extraescolares que el padre haya puesto', () => {
  const s = nuevo();
  const antes = Object.values(s.estado.horario).filter((b) => b.tipo === 'extraescolar').length;
  assert.ok(antes > 0);
  aplicarConfiguracion(s, BASE);
  assert.equal(Object.values(s.estado.horario).filter((b) => b.tipo === 'extraescolar').length, antes);
});

test('reconfigurar dos veces no duplica los bloques de colegio', () => {
  const s = nuevo();
  aplicarConfiguracion(s, BASE);
  aplicarConfiguracion(s, BASE);
  assert.equal(Object.values(s.estado.horario).filter((b) => b.tipo === 'colegio').length, 5);
});

test('la capa de juego se enciende y se apaga según lo elegido', () => {
  const s = nuevo();
  aplicarConfiguracion(s, { ...BASE, juego: ['misiones'] });
  assert.equal(s.ajuste('misionesActivas'), true);
  assert.equal(s.ajuste('desbloqueosActivos'), false);
  assert.equal(s.ajuste('propuestasActivas'), false);
  assert.equal(s.ajuste('efectosActivos'), false);

  aplicarConfiguracion(s, { ...BASE, juego: EXTRAS.map((e) => e.id) });
  for (const e of EXTRAS) {
    for (const clave of Object.keys(e.ajustes)) assert.equal(s.ajuste(clave), true);
  }
});

test('reconfigurar NO toca el progreso ya conseguido', () => {
  const s = nuevo();
  aplicarConfiguracion(s, BASE);
  // Se simula una temporada de uso.
  s.set('ledger', 'mv1', {
    id: 'mv1', cuenta: 'semana', tipo: 'ganado', cantidad: 40, concepto: 'x',
    categoria: 'tarde', fecha: '2026-11-03', ts: Date.now(), anula: null,
  });
  s.set('logros', 'primera_tarea', { id: 'primera_tarea', fecha: '2026-11-03' });
  s.fijarAjuste('racha', 5);

  aplicarConfiguracion(s, { ...BASE, nombre: 'Otro', bloques: ['tarde'] });
  assert.ok(s.estado.ledger.mv1, 'el ledger sigue entero');
  assert.ok(s.estado.logros.primera_tarea, 'los logros se quedan');
  assert.equal(s.ajuste('racha'), 5, 'y la racha también');
});

/* ============================== RESUMEN =============================== */

test('el resumen final dice en castellano lo que va a pasar', () => {
  const s = nuevo();
  const lineas = resumenDeConfiguracion(s.estado, BASE);
  assert.ok(lineas.length >= 4);
  assert.ok(lineas.some((l) => l.includes('Marta')));
  assert.ok(lineas.some((l) => /tareas activas/.test(l)));
  assert.ok(lineas.some((l) => /09:00/.test(l)));
  for (const l of lineas) assert.ok(!/undefined|NaN|\[object/.test(l), l);
});

test('el resumen avisa cuando no hay colegio ni ocio ni capa de juego', () => {
  const s = nuevo();
  const lineas = resumenDeConfiguracion(s.estado, {
    ...BASE, hayColegio: false, ocio: [], juego: [],
  });
  assert.ok(lineas.some((l) => /Sin horario de colegio/.test(l)));
  assert.ok(lineas.some((l) => /Sin bonos de ocio/.test(l)));
  assert.ok(lineas.some((l) => /Sin capa de juego/.test(l)));
});

test('los catálogos del asistente están completos', () => {
  for (const b of BLOQUES) {
    assert.ok(b.id && b.etiqueta && b.emoji && b.ayuda, `${b.id} a medias`);
    assert.ok(b.categorias.length > 0);
  }
  for (const o of OCIO) {
    assert.ok(o.id && o.etiqueta && o.emoji, `${o.id} a medias`);
    assert.ok(o.articulos.length > 0);
  }
  for (const e of EXTRAS) {
    assert.ok(e.id && e.etiqueta && e.emoji && e.ayuda, `${e.id} a medias`);
    assert.ok(Object.keys(e.ajustes).length > 0);
  }
});
