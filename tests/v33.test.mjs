/**
 * Pruebas de la capa de juego de la v3.3: nivel, racha con escudo, logros,
 * misiones, desbloqueos, propuestas y reto de la casa.
 *
 * Todas trabajan contra el núcleo, sin navegador. Lo que necesita DOM (los
 * efectos de celebración) se prueba en app.test.mjs contra el archivo compilado.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { crearStore } from '../src/core/store.js';
import { catalogoInicial } from '../src/core/defaults.js';
import { crearMovimiento, TIPOS, saldoHucha } from '../src/core/ledger.js';
import { marcarTarea, aprobarMarca, vetarMarca, tareasDelDia } from '../src/core/tasks.js';
import { cerrarSemana } from '../src/core/week.js';
import { addDays, toDateKey, weekIdOf } from '../src/core/util.js';
import {
  experiencia, nivelDe, xpParaNivel, NIVEL_MAXIMO, XP_POR,
  resolverRacha, resumenRacha, recordRacha, HITOS_RACHA,
  evaluarLogros, resumenLogros, registrarLogros, LOGROS, progresoCompleto,
} from '../src/core/progreso.js';
import {
  misionesDelDia, misionSemanal, bonificacionDeMisiones, registrarMisionesCompletadas,
  PLANTILLAS_DIA, PLANTILLAS_SEMANA,
} from '../src/core/misiones.js';
import {
  estadoDeTemas, contarAbiertos, temaAbierto, temasNuevos, sembrarTemasVistos,
  regalarTema, REQUISITOS,
} from '../src/core/desbloqueos.js';
import {
  crearPropuesta, aceptarPropuesta, rechazarPropuesta, contraofertar,
  aceptarContraoferta, retirarPropuesta, propuestas, esperandoAlPadre, esperandoANil,
  crearReto, retoDeLaSemana, cerrarReto, RETOS, TIPOS_PROPUESTA,
} from '../src/core/propuestas.js';
import { valorTareaEn, multiplicadorEn } from '../src/core/economy.js';
import { TEMAS } from '../src/themes/themes.js';

const HOY = '2026-09-16';

function nuevo() {
  return crearStore(catalogoInicial({ version: 35 }));
}

/** Mete créditos ganados directamente, para no depender del catálogo. */
function ganar(store, cantidad, { cuenta = 'semana', fecha = HOY, id = null } = {}) {
  const mov = crearMovimiento({
    cuenta,
    tipo: TIPOS.GANADO,
    cantidad,
    concepto: 'prueba',
    categoria: 'tarde',
    fecha,
    id: id || `mv_${cuenta}_${cantidad}_${Math.random().toString(36).slice(2)}`,
  });
  store.set('ledger', mov.id, mov);
  return mov;
}

/* ====================== NIVEL Y EXPERIENCIA =========================== */

test('la experiencia sale del ledger: no hay ningún contador que desincronizar', () => {
  const s = nuevo();
  assert.equal(experiencia(s.estado), 0);
  ganar(s, 30);
  assert.equal(experiencia(s.estado), 30 * XP_POR.credito);
  ganar(s, 5, { cuenta: 'estrellas' });
  assert.equal(experiencia(s.estado), 30 + 5 * XP_POR.estrella);
});

test('gastar créditos no baja la experiencia: lo ganado, ganado está', () => {
  const s = nuevo();
  ganar(s, 40);
  const antes = experiencia(s.estado);
  const gasto = crearMovimiento({
    cuenta: 'semana', tipo: TIPOS.GASTADO, cantidad: -25,
    concepto: 'bono', categoria: 'tienda', fecha: HOY, id: 'mv_gasto',
  });
  s.set('ledger', gasto.id, gasto);
  assert.equal(experiencia(s.estado), antes, 'comprarse algo no te hace retroceder');
});

test('vetar una tarea sí resta la experiencia que había dado', () => {
  const s = nuevo();
  const tarea = tareasDelDia(s.estado, HOY).find((t) => t.tipo === 'estandar' && t.valor > 0);
  const r = marcarTarea(s, { fecha: HOY, tareaId: tarea.id });
  aprobarMarca(s, r.marcaId);
  const conTarea = experiencia(s.estado);
  assert.ok(conTarea > 0);
  vetarMarca(s, r.marcaId, 'no estaba hecha');
  assert.equal(experiencia(s.estado), 0, 'la anulación se lleva también la experiencia');
});

test('los traspasos al cerrar la semana no inventan experiencia', () => {
  const s = nuevo();
  ganar(s, 50);
  const antes = experiencia(s.estado);
  const salida = crearMovimiento({
    cuenta: 'semana', tipo: TIPOS.TRASPASO, cantidad: -50,
    concepto: 'cierre', categoria: 'cierre', fecha: HOY, id: 'mv_t1',
  });
  const entrada = crearMovimiento({
    cuenta: 'hucha', tipo: TIPOS.TRASPASO, cantidad: 50,
    concepto: 'cierre', categoria: 'cierre', fecha: HOY, id: 'mv_t2',
  });
  s.set('ledger', salida.id, salida);
  s.set('ledger', entrada.id, entrada);
  assert.equal(experiencia(s.estado), antes, 'mover créditos de sitio no es mérito nuevo');
});

test('la curva de niveles sube siempre y llega al máximo', () => {
  for (let n = 2; n <= NIVEL_MAXIMO; n++) {
    assert.ok(xpParaNivel(n) > xpParaNivel(n - 1), `el nivel ${n} tiene que costar más que el ${n - 1}`);
  }
  const s = nuevo();
  ganar(s, xpParaNivel(NIVEL_MAXIMO));
  const n = nivelDe(s.estado);
  assert.equal(n.nivel, NIVEL_MAXIMO);
  assert.ok(n.maximo);
  assert.equal(n.falta, 0);
  assert.equal(n.pct, 100);
});

test('el nivel enseña cuánto falta para el siguiente', () => {
  const s = nuevo();
  ganar(s, xpParaNivel(3) + 10);
  const n = nivelDe(s.estado);
  assert.equal(n.nivel, 3);
  assert.equal(n.falta, xpParaNivel(4) - (xpParaNivel(3) + 10));
  assert.ok(n.pct > 0 && n.pct < 100);
  assert.ok(n.nombre.length > 2);
});

/* =========================== RACHA Y ESCUDO =========================== */

test('cumplir el objetivo sube la racha; fallar sin escudo la parte', () => {
  const s = nuevo();
  s.fijarAjuste('racha', 3);
  s.fijarAjuste('escudos', 0);
  assert.equal(resolverRacha(s.estado, { cumplimiento: 80, umbral: 70 }).racha, 4);
  assert.equal(resolverRacha(s.estado, { cumplimiento: 40, umbral: 70 }).racha, 0);
});

test('el escudo salva la racha: no la sube, pero tampoco la parte', () => {
  const s = nuevo();
  s.fijarAjuste('racha', 6);
  s.fijarAjuste('escudos', 1);
  const r = resolverRacha(s.estado, { cumplimiento: 30, umbral: 70 });
  assert.equal(r.racha, 6, 'la racha se queda donde estaba');
  assert.ok(r.escudoUsado);
  assert.equal(r.escudos, 0, 'y se gasta el escudo');
});

test('se gana un escudo cada N semanas, con tope', () => {
  const s = nuevo();
  s.fijarAjuste('escudoCadaSemanas', 4);
  s.fijarAjuste('escudosMaximos', 2);

  s.fijarAjuste('racha', 3);
  s.fijarAjuste('escudos', 0);
  const cuarta = resolverRacha(s.estado, { cumplimiento: 90, umbral: 70 });
  assert.equal(cuarta.racha, 4);
  assert.ok(cuarta.ganaEscudo, 'a las 4 semanas toca escudo');
  assert.equal(cuarta.escudos, 1);

  // Con el tope lleno ya no se acumulan más.
  s.fijarAjuste('racha', 7);
  s.fijarAjuste('escudos', 2);
  const octava = resolverRacha(s.estado, { cumplimiento: 90, umbral: 70 });
  assert.equal(octava.racha, 8);
  assert.ok(!octava.ganaEscudo, 'no pasa del tope');
  assert.equal(octava.escudos, 2);
});

test('con los escudos a cero desactivados, la racha se parte como antes', () => {
  const s = nuevo();
  s.fijarAjuste('escudosMaximos', 0);
  s.fijarAjuste('escudos', 0);
  s.fijarAjuste('racha', 5);
  const r = resolverRacha(s.estado, { cumplimiento: 10, umbral: 70 });
  assert.equal(r.racha, 0);
  assert.ok(!r.escudoUsado);
});

test('el récord de racha no se pierde al fallar', () => {
  const s = nuevo();
  s.set('semanas', '2026-08-03', { id: '2026-08-03', racha: 7, cumplimiento: 90 });
  s.set('semanas', '2026-08-10', { id: '2026-08-10', racha: 0, cumplimiento: 20 });
  s.fijarAjuste('racha', 0);
  assert.equal(recordRacha(s.estado), 7);
  const r = resumenRacha(s.estado);
  assert.equal(r.actual, 0);
  assert.equal(r.record, 7);
});

test('el próximo hito es siempre el siguiente que falta', () => {
  const s = nuevo();
  s.fijarAjuste('racha', 3);
  const { proximo } = resumenRacha(s.estado);
  assert.equal(proximo.hito, 4);
  assert.equal(proximo.faltan, 1);
  s.fijarAjuste('racha', HITOS_RACHA[HITOS_RACHA.length - 1]);
  assert.equal(resumenRacha(s.estado).proximo, null, 'pasado el último no hay más');
});

test('cerrar la semana aplica el escudo de verdad y lo cuenta', () => {
  const s = nuevo();
  s.fijarAjuste('racha', 4);
  s.fijarAjuste('escudos', 1);
  // Semana sin ninguna tarea hecha: cumplimiento 0, por debajo del umbral.
  const r = cerrarSemana(s, { fecha: HOY });
  assert.ok(r.ok);
  assert.ok(r.escudoUsado, 'el escudo entra solo');
  assert.equal(r.racha, 4, 'la racha aguanta');
  assert.equal(s.ajuste('escudos'), 0, 'y se ha gastado');
  assert.equal(s.estado.semanas[weekIdOf(HOY)].escudoUsado, true, 'queda en el archivo');
});

/* ============================== LOGROS ================================ */

test('cada logro del catálogo está completo y sabe comprobarse', () => {
  const s = nuevo();
  const ids = new Set();
  for (const l of LOGROS) {
    assert.ok(l.id && !ids.has(l.id), `id repetido o ausente: ${l.id}`);
    ids.add(l.id);
    assert.ok(l.nombre && l.emoji && l.pista, `${l.id} está a medias`);
    assert.equal(typeof l.comprobar, 'function');
    // Ninguno puede reventar con el estado recién creado.
    assert.doesNotThrow(() => l.comprobar(s.estado, { nivel: 1, hucha: 0 }), `${l.id} revienta en vacío`);
  }
  assert.ok(LOGROS.length >= 30, `solo hay ${LOGROS.length} logros`);
  assert.ok(LOGROS.some((l) => l.secreto), 'tiene que haber alguno secreto');
});

test('en una app recién estrenada no hay ningún logro conseguido', () => {
  const s = nuevo();
  const r = resumenLogros(s.estado, { nivel: 1, hucha: 0 });
  assert.equal(r.hechos, 0);
  assert.equal(r.total, LOGROS.length);
});

test('marcar la primera tarea consigue el primer logro, y solo una vez', () => {
  const s = nuevo();
  const tarea = tareasDelDia(s.estado, HOY).find((t) => t.tipo === 'estandar');
  const r = marcarTarea(s, { fecha: HOY, tareaId: tarea.id });
  aprobarMarca(s, r.marcaId);

  const nuevos = registrarLogros(s, { nivel: 1, hucha: 0 }, HOY);
  assert.ok(nuevos.some((l) => l.id === 'primera_tarea'));
  assert.equal(s.estado.logros.primera_tarea.fecha, HOY);

  // Segunda pasada: ya no anuncia nada.
  assert.deepEqual(registrarLogros(s, { nivel: 1, hucha: 0 }, HOY), []);
});

test('los logros de nivel y de hucha usan el contexto que se les pasa', () => {
  const s = nuevo();
  const sinNada = evaluarLogros(s.estado, { nivel: 1, hucha: 0 });
  assert.ok(!sinNada.find((l) => l.id === 'nivel_3').logrado);
  assert.ok(!sinNada.find((l) => l.id === 'hucha_100').logrado);

  const conTodo = evaluarLogros(s.estado, { nivel: 6, hucha: 150 });
  assert.ok(conTodo.find((l) => l.id === 'nivel_3').logrado);
  assert.ok(conTodo.find((l) => l.id === 'hucha_100').logrado);
  assert.ok(!conTodo.find((l) => l.id === 'nivel_10').logrado);
});

test('progresoCompleto junta nivel, racha y logros en una llamada', () => {
  const s = nuevo();
  ganar(s, 200);
  const p = progresoCompleto(s.estado, { hucha: 0, temasDesbloqueados: 5, temasTotales: 17 });
  assert.ok(p.nivel.nivel >= 2);
  assert.equal(p.racha.actual, 0);
  assert.equal(p.logros.total, LOGROS.length);
});

/* ============================= MISIONES =============================== */

test('las misiones del día son las mismas todo el día y cambian mañana', () => {
  const s = nuevo();
  const titulos = (f) => misionesDelDia(s.estado, f).map((m) => m.plantilla).join('|');
  assert.equal(titulos(HOY), titulos(HOY), 'dos veces el mismo día, lo mismo');
  const otroDia = [];
  for (let i = 1; i <= 6; i++) otroDia.push(titulos(addDays(HOY, i)));
  assert.ok(otroDia.some((t) => t !== titulos(HOY)), 'en seis días tiene que cambiar alguna');
});

test('salen tres misiones y todas están completas por dentro', () => {
  const s = nuevo();
  const ms = misionesDelDia(s.estado, HOY);
  assert.equal(ms.length, 3);
  for (const m of ms) {
    assert.ok(m.titulo && m.titulo.length > 5, 'la misión se explica');
    assert.ok(m.meta >= 1, `${m.plantilla} sin meta`);
    assert.ok(m.premio > 0 && m.premio <= 0.5, `${m.plantilla} premia raro`);
    assert.equal(m.hecho, 0);
    assert.ok(!m.completa);
    assert.ok(!m.titulo.includes('undefined'));
  }
});

test('el padre puede cambiar cuántas misiones hay, o quitarlas', () => {
  const s = nuevo();
  s.fijarAjuste('misionesPorDia', 1);
  assert.equal(misionesDelDia(s.estado, HOY).length, 1);
  s.fijarAjuste('misionesPorDia', 0);
  assert.equal(misionesDelDia(s.estado, HOY).length, 0);
  s.fijarAjuste('misionesPorDia', 3);
  s.fijarAjuste('misionesActivas', false);
  assert.equal(misionesDelDia(s.estado, HOY).length, 0);
  assert.equal(misionSemanal(s.estado, HOY), null);
});

test('una misión se completa al hacer lo que pide, y se nota en el multiplicador', () => {
  const s = nuevo();
  s.fijarAjuste('misionesPorDia', 4);
  // Se marcan todas las tareas del día: alguna misión de volumen tiene que caer.
  for (const t of tareasDelDia(s.estado, HOY)) {
    if (t.tipo === 'eleccion') continue;
    marcarTarea(s, { fecha: HOY, tareaId: t.id });
  }
  const ms = misionesDelDia(s.estado, HOY);
  assert.ok(ms.some((m) => m.completa), 'con el día entero hecho, alguna misión cae');

  const bono = bonificacionDeMisiones(s.estado, HOY);
  assert.ok(bono.extra > 0, 'y eso da bonificación');
  assert.ok(bono.completadas >= 1);
});

test('la bonificación de misiones SUMA al multiplicador, no lo multiplica', () => {
  const s = nuevo();
  s.fijarAjuste('multiplicadorValor', 2);
  s.fijarAjuste('multiplicadorAmbito', 'siempre');
  // x2 del padre + 50 % de misiones = x2,5. Si se multiplicaran serían x3.
  assert.equal(multiplicadorEn(s.estado, HOY, 0.5), 2.5);
  assert.equal(multiplicadorEn(s.estado, HOY, 0), 2);
  assert.equal(multiplicadorEn(s.estado, HOY), 2, 'sin extra, como siempre');
});

test('la bonificación tiene tope y no se dispara', () => {
  const s = nuevo();
  s.fijarAjuste('topeBonificacionMisiones', 0.3);
  s.fijarAjuste('misionesPorDia', 4);
  for (const t of tareasDelDia(s.estado, HOY)) {
    if (t.tipo === 'eleccion') continue;
    marcarTarea(s, { fecha: HOY, tareaId: t.id });
  }
  assert.ok(bonificacionDeMisiones(s.estado, HOY).extra <= 0.3);
});

test('las misiones no pagan créditos: solo dejan constancia en el ledger', () => {
  const s = nuevo();
  s.fijarAjuste('misionesPorDia', 4);
  for (const t of tareasDelDia(s.estado, HOY)) {
    if (t.tipo === 'eleccion') continue;
    marcarTarea(s, { fecha: HOY, tareaId: t.id });
  }
  const apuntadas = registrarMisionesCompletadas(s, HOY);
  assert.ok(apuntadas.length >= 1);
  for (const m of Object.values(s.estado.ledger)) {
    if (m.refTipo !== 'mision') continue;
    assert.equal(m.cantidad, 0, 'una misión no imprime dinero');
  }
  // Y no se apuntan dos veces.
  assert.deepEqual(registrarMisionesCompletadas(s, HOY), []);
});

test('la misión semanal existe y mide algo de la semana', () => {
  const s = nuevo();
  const m = misionSemanal(s.estado, HOY);
  assert.ok(m && m.titulo && m.meta >= 1);
  assert.ok(PLANTILLAS_SEMANA.some((p) => p.id === m.plantilla));
});

test('ninguna plantilla de misión se rompe con la app recién estrenada', () => {
  const s = nuevo();
  for (const dias of [0, 1, 2, 3, 4, 5, 6]) {
    const f = addDays(HOY, dias);
    for (const m of [...misionesDelDia(s.estado, f), misionSemanal(s.estado, f)]) {
      if (!m) continue;
      assert.ok(Number.isFinite(m.pct) && m.pct >= 0 && m.pct <= 100, `${m.plantilla} da un % raro`);
      assert.ok(!/undefined|NaN/.test(m.titulo), `${m.plantilla}: ${m.titulo}`);
    }
  }
});

/* ============================ DESBLOQUEOS ============================= */

test('se empieza con cinco fondos abiertos, uno por familia', () => {
  const s = nuevo();
  const { abiertos, total } = contarAbiertos(s.estado, TEMAS);
  assert.equal(total, 17);
  assert.equal(abiertos, 5);
  const iniciales = estadoDeTemas(s.estado, TEMAS).filter((t) => t.abierto);
  assert.equal(new Set(iniciales.map((t) => t.familia)).size, 5, 'uno de cada familia');
});

test('cada fondo bloqueado dice exactamente qué le falta', () => {
  const s = nuevo();
  for (const t of estadoDeTemas(s.estado, TEMAS)) {
    if (t.abierto) continue;
    assert.ok(t.falta && t.falta.length > 4, `${t.id} no explica qué falta`);
    assert.ok(!/undefined|NaN/.test(t.falta), `${t.id}: ${t.falta}`);
  }
});

test('subir de nivel abre los fondos que iban por nivel', () => {
  const s = nuevo();
  assert.ok(!temaAbierto(s.estado, 'oceano', TEMAS));
  ganar(s, xpParaNivel(2));
  assert.ok(temaAbierto(s.estado, 'oceano', TEMAS), 'el nivel 2 abre el océano');
  assert.ok(!temaAbierto(s.estado, 'synthwave', TEMAS), 'pero no el del nivel 10');
  ganar(s, xpParaNivel(10));
  assert.ok(temaAbierto(s.estado, 'synthwave', TEMAS));
});

test('los fondos por gesta se abren con su logro, no con el nivel', () => {
  const s = nuevo();
  ganar(s, xpParaNivel(NIVEL_MAXIMO));
  assert.ok(!temaAbierto(s.estado, 'volcan', TEMAS), 'el nivel máximo no regala las gestas');
  s.set('semanas', '2026-09-07', { id: '2026-09-07', cumplimiento: 100, racha: 1 });
  assert.ok(temaAbierto(s.estado, 'volcan', TEMAS), 'una semana perfecta sí');
});

test('apagar los desbloqueos abre los diecisiete', () => {
  const s = nuevo();
  s.fijarAjuste('desbloqueosActivos', false);
  assert.equal(contarAbiertos(s.estado, TEMAS).abiertos, 17);
});

test('el padre puede regalar un fondo suelto', () => {
  const s = nuevo();
  assert.ok(!temaAbierto(s.estado, 'datos', TEMAS));
  assert.ok(regalarTema(s, 'datos', TEMAS).ok);
  assert.ok(temaAbierto(s.estado, 'datos', TEMAS));
  assert.ok(!regalarTema(s, 'inventado', TEMAS).ok, 'un fondo que no existe se rechaza');
});

test('los cinco de salida no se anuncian como desbloqueo', () => {
  const s = nuevo();
  sembrarTemasVistos(s, TEMAS);
  assert.deepEqual(temasNuevos(s, TEMAS), [], 'nada que celebrar el primer día');
  ganar(s, xpParaNivel(2));
  const nuevos = temasNuevos(s, TEMAS);
  assert.equal(nuevos.length, 1);
  assert.equal(nuevos[0].id, 'oceano');
  assert.deepEqual(temasNuevos(s, TEMAS), [], 'y no se celebra dos veces');
});

test('todos los fondos del catálogo tienen requisito declarado', () => {
  for (const t of TEMAS) {
    assert.ok(REQUISITOS[t.id], `${t.id} no dice cómo se desbloquea`);
  }
});

/* ============================ PROPUESTAS ============================== */

const PROPUESTA_TAREA = {
  tipo: 'tarea',
  nombre: 'Sacar la basura por la noche',
  valor: 6,
  motivo: 'Lo hago casi siempre y no está en la lista.',
  fecha: HOY,
};

test('Nil propone una tarea y queda esperando al padre', () => {
  const s = nuevo();
  const r = crearPropuesta(s, PROPUESTA_TAREA);
  assert.ok(r.ok);
  assert.equal(r.propuesta.estado, 'pendiente');
  assert.equal(esperandoAlPadre(s.estado).length, 1);
  assert.equal(esperandoANil(s.estado).length, 0);
});

test('una propuesta sin motivo de verdad no se envía', () => {
  const s = nuevo();
  const r = crearPropuesta(s, { ...PROPUESTA_TAREA, motivo: 'pq' });
  assert.ok(!r.ok);
  assert.match(r.razon, /por qué/i);
  assert.equal(propuestas(s.estado).length, 0);
});

test('los valores fuera de rango se rechazan', () => {
  const s = nuevo();
  assert.ok(!crearPropuesta(s, { ...PROPUESTA_TAREA, valor: 500 }).ok);
  assert.ok(!crearPropuesta(s, { ...PROPUESTA_TAREA, valor: -3 }).ok);
  assert.ok(!crearPropuesta(s, { ...PROPUESTA_TAREA, nombre: 'a' }).ok);
});

test('hay un límite de propuestas abiertas a la vez', () => {
  const s = nuevo();
  s.fijarAjuste('limitePropuestas', 2);
  assert.ok(crearPropuesta(s, PROPUESTA_TAREA).ok);
  assert.ok(crearPropuesta(s, { ...PROPUESTA_TAREA, nombre: 'Otra cosa distinta' }).ok);
  const tercera = crearPropuesta(s, { ...PROPUESTA_TAREA, nombre: 'Y una tercera' });
  assert.ok(!tercera.ok);
  assert.match(tercera.razon, /esperando/i);
});

test('aceptar una propuesta de tarea la crea de verdad en el catálogo', () => {
  const s = nuevo();
  const { propuesta } = crearPropuesta(s, PROPUESTA_TAREA);
  const antes = Object.keys(s.estado.tareas).length;
  const r = aceptarPropuesta(s, propuesta.id);
  assert.ok(r.ok);
  assert.equal(Object.keys(s.estado.tareas).length, antes + 1);
  const creada = s.estado.tareas[r.creadoId];
  assert.equal(creada.nombre, PROPUESTA_TAREA.nombre);
  assert.equal(creada.valor, 6);
  assert.equal(creada.propuestaPor, 'nil');
  assert.equal(s.estado.propuestas[propuesta.id].estado, 'aceptada');
});

test('aceptar una propuesta de valor cambia el precio de la tarea que ya existía', () => {
  const s = nuevo();
  const tarea = Object.values(s.estado.tareas).find((t) => t.tipo === 'estandar');
  const { propuesta } = crearPropuesta(s, {
    tipo: 'valor', tareaId: tarea.id, valor: tarea.valor + 4,
    motivo: 'Es más trabajo de lo que parece.', fecha: HOY,
  });
  aceptarPropuesta(s, propuesta.id);
  assert.equal(s.estado.tareas[tarea.id].valor, tarea.valor + 4);
});

test('aceptar una propuesta de premio lo mete en la tienda con su moneda', () => {
  const s = nuevo();
  const { propuesta } = crearPropuesta(s, {
    tipo: 'premio', nombre: 'Lupa de campo', valor: 40, moneda: 'estrellas',
    motivo: 'Para mirar bichos en el monte.', fecha: HOY,
  });
  const r = aceptarPropuesta(s, propuesta.id);
  const creado = s.estado.tienda[r.creadoId];
  assert.equal(creado.nombre, 'Lupa de campo');
  assert.equal(creado.moneda, 'estrellas');
  assert.equal(creado.precio, 40);
});

test('rechazar SIN motivo no cuela: un no sin explicación no vale', () => {
  const s = nuevo();
  const { propuesta } = crearPropuesta(s, PROPUESTA_TAREA);
  const r = rechazarPropuesta(s, propuesta.id, '');
  assert.ok(!r.ok);
  assert.equal(s.estado.propuestas[propuesta.id].estado, 'pendiente', 'sigue abierta');

  const conMotivo = rechazarPropuesta(s, propuesta.id, 'Esa ya la cubre la de recoger la cocina.');
  assert.ok(conMotivo.ok);
  assert.equal(s.estado.propuestas[propuesta.id].estado, 'rechazada');
  assert.ok(s.estado.propuestas[propuesta.id].respuesta.length > 5);
});

test('la contraoferta devuelve la pelota a Nil y no aplica nada todavía', () => {
  const s = nuevo();
  const { propuesta } = crearPropuesta(s, PROPUESTA_TAREA);
  const antes = Object.keys(s.estado.tareas).length;
  const r = contraofertar(s, propuesta.id, { valor: 4, nota: 'Te doy 4, que son dos minutos.' });
  assert.ok(r.ok);
  assert.equal(s.estado.propuestas[propuesta.id].estado, 'contraoferta');
  assert.equal(Object.keys(s.estado.tareas).length, antes, 'todavía no se ha creado nada');
  assert.equal(esperandoANil(s.estado).length, 1);
});

test('contraofertar el mismo número no es una contraoferta', () => {
  const s = nuevo();
  const { propuesta } = crearPropuesta(s, PROPUESTA_TAREA);
  const r = contraofertar(s, propuesta.id, { valor: PROPUESTA_TAREA.valor });
  assert.ok(!r.ok);
});

test('Nil acepta la contraoferta y se aplica con el número pactado', () => {
  const s = nuevo();
  const { propuesta } = crearPropuesta(s, PROPUESTA_TAREA);
  contraofertar(s, propuesta.id, { valor: 4, nota: 'Cuatro.' });
  const r = aceptarContraoferta(s, propuesta.id);
  assert.ok(r.ok);
  assert.equal(r.valorFinal, 4, 'vale lo pactado, no lo que pedía');
  assert.equal(s.estado.tareas[r.creadoId].valor, 4);
  assert.equal(s.estado.propuestas[propuesta.id].estado, 'aceptada');
});

test('Nil puede retirar su propuesta mientras esté abierta', () => {
  const s = nuevo();
  const { propuesta } = crearPropuesta(s, PROPUESTA_TAREA);
  assert.ok(retirarPropuesta(s, propuesta.id).ok);
  assert.equal(s.estado.propuestas[propuesta.id].estado, 'retirada');
  assert.ok(!retirarPropuesta(s, propuesta.id).ok, 'una cerrada ya no se retira');
});

test('una propuesta cerrada no se puede volver a responder', () => {
  const s = nuevo();
  const { propuesta } = crearPropuesta(s, PROPUESTA_TAREA);
  aceptarPropuesta(s, propuesta.id);
  assert.ok(!aceptarPropuesta(s, propuesta.id).ok);
  assert.ok(!rechazarPropuesta(s, propuesta.id, 'ya no toca').ok);
  assert.ok(!contraofertar(s, propuesta.id, { valor: 2 }).ok);
});

test('con las propuestas desactivadas, Nil no puede enviar ninguna', () => {
  const s = nuevo();
  s.fijarAjuste('propuestasActivas', false);
  const r = crearPropuesta(s, PROPUESTA_TAREA);
  assert.ok(!r.ok);
  assert.match(r.razon, /desactivad/i);
});

test('los tres tipos de propuesta están declarados y se explican', () => {
  for (const t of Object.values(TIPOS_PROPUESTA)) {
    assert.ok(t.id && t.etiqueta && t.emoji && t.ayuda, `${t.id} está a medias`);
  }
});

/* ========================== RETO DE LA CASA =========================== */

test('el reto de la casa mide lo que dice medir', () => {
  const s = nuevo();
  const r = crearReto(s, { tipo: 'tareas', meta: 3, premio: 'Pizza el sábado', fecha: HOY });
  assert.ok(r.ok);
  let reto = retoDeLaSemana(s.estado, HOY);
  assert.equal(reto.hecho, 0);
  assert.ok(!reto.conseguido);

  const tareas = tareasDelDia(s.estado, HOY).filter((t) => t.tipo === 'estandar').slice(0, 3);
  for (const t of tareas) marcarTarea(s, { fecha: HOY, tareaId: t.id });
  reto = retoDeLaSemana(s.estado, HOY);
  assert.equal(reto.hecho, 3);
  assert.ok(reto.conseguido);
  assert.equal(reto.pct, 100);
});

test('solo puede haber un reto abierto por semana', () => {
  const s = nuevo();
  assert.ok(crearReto(s, { tipo: 'tareas', meta: 3, premio: 'Pizza', fecha: HOY }).ok);
  const segundo = crearReto(s, { tipo: 'noches', meta: 3, premio: 'Cine', fecha: HOY });
  assert.ok(!segundo.ok);
});

test('un reto sin premio o con meta imposible se rechaza', () => {
  const s = nuevo();
  assert.ok(!crearReto(s, { tipo: 'tareas', meta: 3, premio: '', fecha: HOY }).ok);
  assert.ok(!crearReto(s, { tipo: 'tareas', meta: 0, premio: 'Pizza', fecha: HOY }).ok);
  assert.ok(!crearReto(s, { tipo: 'inventado', meta: 3, premio: 'Pizza', fecha: HOY }).ok);
});

test('el reto se cierra con la semana, ganado o fallado, sin castigo', () => {
  const s = nuevo();
  crearReto(s, { tipo: 'tareas', meta: 99, premio: 'Pizza', fecha: HOY });
  const antes = saldoHucha(s.estado);
  const cerrado = cerrarReto(s, HOY);
  assert.equal(cerrado.estado, 'fallado');
  assert.equal(saldoHucha(s.estado), antes, 'fallar no cuesta créditos');
  assert.equal(cerrarReto(s, HOY), null, 'ya está cerrado');
});

test('cerrar la semana cierra también el reto', () => {
  const s = nuevo();
  crearReto(s, { tipo: 'tareas', meta: 1, premio: 'Helado', fecha: HOY });
  marcarTarea(s, { fecha: HOY, tareaId: tareasDelDia(s.estado, HOY)[0].id });
  const r = cerrarSemana(s, { fecha: HOY });
  assert.ok(r.reto);
  assert.equal(r.reto.estado, 'ganado');
  assert.equal(s.estado.retos[weekIdOf(HOY)].estado, 'ganado');
});

test('los cuatro tipos de reto están declarados y saben medir', () => {
  const s = nuevo();
  for (const r of Object.values(RETOS)) {
    assert.ok(r.id && r.etiqueta && r.emoji && r.unidad, `${r.id} está a medias`);
    assert.equal(typeof r.medir, 'function');
    assert.doesNotThrow(() => r.medir(s.estado, [HOY], 70), `${r.id} revienta en vacío`);
  }
});

/* ===================== APROBAR DICIENDO ALGO ========================== */

test('el padre puede aprobar dejando una nota, y Nil la conserva', () => {
  const s = nuevo();
  const tarea = tareasDelDia(s.estado, HOY).find((t) => t.tipo === 'estandar');
  const r = marcarTarea(s, { fecha: HOY, tareaId: tarea.id });
  aprobarMarca(s, r.marcaId, { nota: '  Te ha quedado impecable  ' });
  const marca = s.estado.marcas[r.marcaId];
  assert.equal(marca.estado, 'aprobada');
  assert.equal(marca.nota, 'Te ha quedado impecable', 'se guarda limpia de espacios');
});

test('aprobar sin nota no deja una nota vacía rondando', () => {
  const s = nuevo();
  const tarea = tareasDelDia(s.estado, HOY).find((t) => t.tipo === 'estandar');
  const r = marcarTarea(s, { fecha: HOY, tareaId: tarea.id });
  aprobarMarca(s, r.marcaId);
  assert.equal(s.estado.marcas[r.marcaId].nota, null);
});

test('la nota tiene tope: no se cuela un texto infinito', () => {
  const s = nuevo();
  const tarea = tareasDelDia(s.estado, HOY).find((t) => t.tipo === 'estandar');
  const r = marcarTarea(s, { fecha: HOY, tareaId: tarea.id });
  aprobarMarca(s, r.marcaId, { nota: 'x'.repeat(500) });
  assert.equal(s.estado.marcas[r.marcaId].nota.length, 140);
});
