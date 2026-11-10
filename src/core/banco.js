/**
 * EL BANCO DE NIL (v3.7) — instrumentos para aprender a ahorrar.
 *
 *   1. Cuenta de ahorro   — la hucha libre gana un poco cada semana (staking.js).
 *   2. Depósito a plazo   — Nil elige de 3 a 30 días; más plazo, más interés.
 *                           El padre fija el interés del plazo más corto y del
 *                           más largo, y los intermedios se calculan solos.
 *   3. Fondo variable     — cada semana sube o baja dentro de un margen. El
 *                           único instrumento en el que se puede perder, con
 *                           un suelo (nunca vale menos del 75 % de lo puesto).
 *
 * Frenos para que no haya locuras (todos los fija el padre):
 *   - todo el interés es SIMPLE (sobre lo puesto, nunca sobre lo ganado);
 *   - el freno semanal (freno.js): las ganancias no pasan del 20 % de lo que
 *     ha ganado trabajando esa semana; lo que no cabe se aplaza, no se pierde;
 *   - topes de créditos por instrumento;
 *   - un botón de pausa que congela la cuenta y el fondo (los depósitos ya
 *     firmados se respetan).
 *
 * El rendimiento semanal del fondo sale de una semilla de la casa y de la
 * semana: los dos móviles calculan exactamente el mismo número.
 */

import { addDays, creditos, weekIdOf, clamp } from './util.js';
import { crearMovimiento, TIPOS, saldoHucha } from './ledger.js';
import { leerParametro } from './tokenomics.js';
import { pagarRendimiento, estadoFreno } from './freno.js';

/* ------------------------------------------------------------------ */
/* General                                                             */
/* ------------------------------------------------------------------ */

export function bancoPausado(estado) {
  return Boolean(leerParametro(estado, 'bancoPausado', false));
}

/** ¿Funciona la casa con el banco de la v3.7 (plazo libre, fondo, freno)? */
export function bancoV37(estado) {
  return leerParametro(estado, 'depositoPctMax', null) !== null;
}

/* ------------------------------------------------------------------ */
/* Depósito con interés variable según el plazo                        */
/* ------------------------------------------------------------------ */

export function rangoPlazo(estado) {
  const min = Math.max(1, Number(leerParametro(estado, 'depositoPlazoMin', 3)) || 3);
  const max = Math.max(min, Number(leerParametro(estado, 'depositoPlazoMax', 30)) || 30);
  return { min, max };
}

/**
 * Interés total del depósito (en %) para un plazo en días: una recta entre el
 * interés del plazo más corto y el del más largo, redondeada a medio punto.
 */
export function pctVariable(estado, dias) {
  const { min, max } = rangoPlazo(estado);
  const d = Number(dias);
  if (!Number.isInteger(d) || d < min || d > max) return 0;
  const a = Number(leerParametro(estado, 'depositoPctMin', 2)) || 0;
  const b = Number(leerParametro(estado, 'depositoPctMax', 15)) || 0;
  const t = max === min ? 1 : (d - min) / (max - min);
  return Math.round((a + (b - a) * t) * 2) / 2;
}

/** Plazos "de un toque" que se ofrecen en la pantalla (dentro del rango). */
export function plazosSugeridos(estado) {
  const { min, max } = rangoPlazo(estado);
  const base = [min, 7, 14, max];
  return [...new Set(base.filter((d) => d >= min && d <= max))].sort((x, y) => x - y);
}

/** Capital que hay ahora en depósitos abiertos. */
export function capitalEnDepositos(estado) {
  return Object.values(estado.stakings || {})
    .filter((s) => s.estado === 'activo' && s.tipo === 'deposito')
    .reduce((t, s) => t + (Number(s.capital) || 0), 0);
}

/* ------------------------------------------------------------------ */
/* Fondo variable                                                      */
/* ------------------------------------------------------------------ */

export const ID_FONDO = 'fondo_principal';

export function fondo(estado) {
  const f = estado.stakings?.[ID_FONDO];
  return f && f.estado === 'activo' ? f : null;
}

export function fondoDisponible(estado) {
  return Boolean(leerParametro(estado, 'fondoActivo', false));
}

/** Número entre 0 y 1, estable para una semilla y una semana. */
function azarDeSemana(semilla, semana) {
  let h = 2166136261 >>> 0;
  const s = `${semilla}|${semana}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  // Un par de vueltas más para que semanas seguidas no se parezcan.
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Rendimiento del fondo (en %) de una semana dada, dentro del margen del padre. */
export function rendimientoDeSemana(estado, semana) {
  const lo = Number(leerParametro(estado, 'fondoMinPct', -4));
  const hi = Number(leerParametro(estado, 'fondoMaxPct', 6));
  const semilla = leerParametro(estado, 'semillaFondo', 'rutineitor');
  const pct = lo + (hi - lo) * azarDeSemana(semilla, semana);
  return Math.round(pct * 2) / 2;
}

export function puedeMeterEnFondo(estado, { cantidad }) {
  if (!fondoDisponible(estado)) return { ok: false, razon: 'El fondo no está disponible ahora mismo.' };
  if (bancoPausado(estado)) return { ok: false, razon: 'Papá ha pausado la hucha un momento.' };
  const c = creditos(cantidad);
  const minimo = Number(leerParametro(estado, 'fondoMinimo', 10));
  if (c < minimo) return { ok: false, razon: `Lo mínimo para meter en el fondo son ${minimo} créditos.` };
  if (c > saldoHucha(estado)) return { ok: false, razon: 'No tienes tanto en la hucha libre.' };
  const maximo = Number(leerParametro(estado, 'fondoMaximo', 200));
  const puesto = fondo(estado)?.aportado || 0;
  if (maximo > 0 && puesto + c > maximo) {
    return { ok: false, razon: `En el fondo caben como mucho ${maximo} créditos puestos. Te quedan ${Math.max(0, maximo - puesto)}.` };
  }
  return { ok: true };
}

/** Meter créditos de la hucha en el fondo. Empiezan a moverse la semana siguiente. */
export function meterEnFondo(store, { cantidad, fecha }) {
  const check = puedeMeterEnFondo(store.estado, { cantidad });
  if (!check.ok) return check;
  const c = creditos(cantidad);
  const semana = weekIdOf(fecha);
  const f = fondo(store.estado);
  store.lote((s) => {
    if (!leerParametro(s.estado, 'semillaFondo', null)) {
      s.fijarAjuste('semillaFondo', Math.random().toString(36).slice(2, 10));
    }
    const mov = crearMovimiento({
      cuenta: 'hucha', tipo: TIPOS.GASTADO, cantidad: -c, concepto: 'Al fondo variable',
      categoria: 'staking', fecha, refTipo: 'staking', refId: ID_FONDO, actor: 'nil',
    });
    s.set('ledger', mov.id, mov);
    if (f) {
      const nuevaSemana = f.aportadoSemana?.semana === semana ? (f.aportadoSemana.cantidad || 0) + c : c;
      s.patch('stakings', ID_FONDO, {
        aportado: f.aportado + c,
        capital: f.capital + c,
        aportadoSemana: { semana, cantidad: nuevaSemana },
      });
    } else {
      s.set('stakings', ID_FONDO, {
        id: ID_FONDO, tipo: 'fondo', estado: 'activo',
        aportado: c, capital: c,
        semanaUltima: semana,
        aportadoSemana: { semana, cantidad: c },
        historial: [],
        fechaInicio: fecha, abiertoEn: Date.now(), cerradoEn: null,
      });
    }
  });
  return { ok: true };
}

/**
 * Mueve el fondo por cada semana completa que ha pasado. Interés simple: el
 * porcentaje se aplica a lo puesto (no a lo ganado). Con suelo. Idempotente.
 */
export function procesarFondo(store, { fecha }) {
  const f = fondo(store.estado);
  if (!f) return [];
  const actual = weekIdOf(fecha);
  if (f.semanaUltima >= addDays(actual, -7)) return [];
  if (bancoPausado(store.estado)) {
    // En pausa el fondo no se mueve, y esas semanas no se recuperan después.
    store.patch('stakings', ID_FONDO, { semanaUltima: addDays(actual, -7) });
    return [];
  }
  const sueloPct = clamp(Number(leerParametro(store.estado, 'fondoSueloPct', 75)) || 0, 0, 100);
  let { capital, aportado } = f;
  const historial = [...(f.historial || [])];
  const eventos = [];
  for (let w = addDays(f.semanaUltima, 7); w < actual; w = addDays(w, 7)) {
    const recien = f.aportadoSemana?.semana === w ? (f.aportadoSemana.cantidad || 0) : 0;
    const base = Math.max(0, aportado - recien);
    const pct = rendimientoDeSemana(store.estado, w);
    const suelo = Math.ceil(aportado * sueloPct / 100);
    const antes = capital;
    capital = Math.max(suelo, capital + creditos(base * pct / 100));
    historial.push({ semana: w, pct, cambio: capital - antes, valor: capital });
    eventos.push({ tipo: 'fondo-semana', semana: w, pct, cambio: capital - antes });
  }
  store.patch('stakings', ID_FONDO, {
    capital, semanaUltima: addDays(actual, -7), historial: historial.slice(-26),
  });
  return eventos;
}

/**
 * Sacar del fondo. Lo puesto vuelve tal cual; la ganancia (si la hay) pasa por
 * el freno; la pérdida (si la hay) se queda en el fondo como lección.
 */
export function sacarDeFondo(store, { cantidad, fecha }) {
  const f = fondo(store.estado);
  if (!f) return { ok: false, razon: 'No tienes nada en el fondo.' };
  if (bancoPausado(store.estado)) return { ok: false, razon: 'Papá ha pausado la hucha un momento.' };
  const c = Math.min(creditos(cantidad), f.capital);
  if (c <= 0) return { ok: false, razon: 'Elige cuánto quieres sacar.' };
  const parte = c / f.capital;
  const puestoQueSale = creditos(f.aportado * parte);
  const ganancia = c - puestoQueSale;
  let aplazado = 0;
  store.lote((s) => {
    const devuelto = ganancia > 0 ? puestoQueSale : c;
    if (devuelto > 0) {
      const mov = crearMovimiento({
        cuenta: 'hucha', tipo: TIPOS.GANADO, cantidad: devuelto,
        concepto: ganancia >= 0 ? 'Sacado del fondo' : `Sacado del fondo (pusiste ${puestoQueSale})`,
        categoria: 'staking', fecha, refTipo: 'staking', refId: ID_FONDO, actor: 'nil',
      });
      s.set('ledger', mov.id, mov);
    }
    if (ganancia > 0) {
      aplazado = pagarRendimiento(s, { cantidad: ganancia, concepto: `Ganancia del fondo (+${ganancia})`, fecha, refId: ID_FONDO }).aplazado;
    }
    const queda = f.capital - c;
    const aportadoQueda = Math.max(0, f.aportado - puestoQueSale);
    s.patch('stakings', ID_FONDO, queda > 0
      ? { capital: queda, aportado: aportadoQueda }
      : { capital: 0, aportado: 0, estado: 'cobrado', cerradoEn: Date.now(), interesPagado: ganancia });
  });
  return { ok: true, sacado: c, ganancia, aplazado };
}

/* ------------------------------------------------------------------ */
/* Consejos con los números de Nil                                     */
/* ------------------------------------------------------------------ */

/** Fichas para aprender: cortas, sin sermón. */
export const FICHAS = [
  { id: 'interes', icono: '💡', titulo: 'El interés',
    texto: 'Es lo que te pagan por dejar tu dinero quieto un tiempo. Quien te lo paga lo usa mientras tanto; tú cobras por esperar.' },
  { id: 'plazo', icono: '⏳', titulo: 'El plazo',
    texto: 'Cuanto más tiempo te comprometes a no tocarlo, más te pagan. Por eso un depósito a 30 días gana más que uno a 3.' },
  { id: 'riesgo', icono: '🎢', titulo: 'El riesgo',
    texto: 'Si algo puede darte más, también puede darte menos. El fondo sube unas semanas y baja otras: lo que cuenta es el resultado después de muchas semanas, no una sola.' },
  { id: 'diversificar', icono: '🧺', titulo: 'No todo en el mismo cesto',
    texto: 'Repartir es más tranquilo: una parte segura (depósito), una que se mueve (fondo) y una libre para cuando la necesites.' },
  { id: 'coste', icono: '⚖️', titulo: 'El coste de oportunidad',
    texto: 'Gastar algo hoy también es renunciar a lo que habría crecido. No es malo gastar: es elegir sabiendo lo que cuesta.' },
  { id: 'compuesto', icono: '🌱', titulo: 'Por qué aquí hay un freno',
    texto: 'En la vida real los intereses se suman a los intereses y crecen cada vez más rápido. Aquí lo frenamos a propósito: tu trabajo tiene que valer más que tu dinero quieto.' },
];

/**
 * Un consejo corto con los números de Nil. Cambia cada día y solo propone lo
 * que de verdad puede hacer ahora.
 */
export function consejoAhorro(estado, fecha, { horasDe = (c) => c / 12 } = {}) {
  const libre = saldoHucha(estado);
  const f = fondo(estado);
  const freno = estadoFreno(estado, fecha);
  const opciones = [];
  const { min, max } = rangoPlazo(estado);
  const minimo = Number(leerParametro(estado, 'depositoMinimo', 10));
  if (leerParametro(estado, 'depositoActivo', true) && libre >= minimo) {
    const c = Math.min(libre, Math.max(minimo, Math.round(libre / 2 / 10) * 10 || minimo));
    const d = clamp(14, min, max);
    const gana = creditos(c * pctVariable(estado, d) / 100);
    if (gana > 0) {
      opciones.push(`Si guardas ${c} créditos ${d} días en un depósito, ganas ${gana}. Si los gastas hoy, son ${formatoHoras(horasDe(c))} de pantalla.`);
    }
    const gMax = creditos(c * pctVariable(estado, max) / 100);
    const gMin = creditos(c * pctVariable(estado, min) / 100);
    if (gMax > gMin) opciones.push(`Los mismos ${c} créditos: a ${min} días ganas ${gMin}, a ${max} días ganas ${gMax}. Esperar se paga.`);
  }
  if (f) {
    const dif = f.capital - f.aportado;
    opciones.push(dif >= 0
      ? `Tu fondo vale ${f.capital} y pusiste ${f.aportado}: vas ${dif > 0 ? `${dif} por encima` : 'igual'}. Recuerda que también puede bajar.`
      : `Tu fondo vale ${f.capital} y pusiste ${f.aportado}. Bajar unas semanas es normal: lo que cuenta es el resultado a la larga.`);
  } else if (fondoDisponible(estado) && libre >= 20) {
    opciones.push('Repartir es más tranquilo: una parte en un depósito (seguro) y otra en el fondo (puede subir o bajar).');
  }
  if (freno.activo && freno.aplazado > 0) {
    opciones.push(`Tienes ${freno.aplazado} créditos de intereses esperando. El freno los suelta cuando haces tareas.`);
  }
  if (!opciones.length) return null;
  const dia = Math.floor(new Date(`${fecha}T12:00:00`).getTime() / 86400000);
  return opciones[dia % opciones.length];
}

function formatoHoras(h) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  const entero = Math.floor(h);
  const min = Math.round((h - entero) * 60);
  return min ? `${entero} h ${min} min` : `${entero} h`;
}

/* ------------------------------------------------------------------ */
/* Avisos para el padre                                                */
/* ------------------------------------------------------------------ */

/** Números que se disparan: se enseñan en Economía → Reglas. */
export function avisosBanco(estado) {
  const v = (k, d) => Number(leerParametro(estado, k, d));
  const avisos = [];
  if (v('depositoPctMax', 15) > 25) avisos.push('El depósito más largo paga más de un 25 %: es mucho para 30 días.');
  if (v('interesHuchaPct', 1) > 3) avisos.push('La cuenta de ahorro paga más de un 3 % semanal: con una hucha grande crece muy deprisa.');
  if (v('fondoMaxPct', 6) > 10) avisos.push('El fondo puede subir más de un 10 % en una semana: demasiado premio por suerte.');
  if (v('fondoMinPct', -4) < -10) avisos.push('El fondo puede bajar más de un 10 % en una semana: puede ser frustrante.');
  if ((v('fondoMinPct', -4) + v('fondoMaxPct', 6)) / 2 > 2) avisos.push('De media el fondo sube más de un 2 % semanal: casi no tiene riesgo real.');
  if (!leerParametro(estado, 'frenoActivo', false)) avisos.push('El freno está apagado: el ahorro puede llegar a dar más que las tareas.');
  else if (v('frenoPct', 20) > 40) avisos.push('El freno deja que el ahorro dé más del 40 % de lo ganado trabajando.');
  return avisos;
}

/** Ejemplo de lo que daría cada instrumento con 100 créditos. */
export function ejemploBanco(estado) {
  const { min, max } = rangoPlazo(estado);
  return {
    cuentaSemana: Math.min(Math.floor(100 * v0(estado, 'interesHuchaPct', 1) / 100), v0(estado, 'interesHuchaTope', 10) || Infinity),
    depositoCorto: { dias: min, gana: creditos(100 * pctVariable(estado, min) / 100) },
    depositoLargo: { dias: max, gana: creditos(100 * pctVariable(estado, max) / 100) },
    fondoSemana: { min: creditos(v0(estado, 'fondoMinPct', -4)), max: creditos(v0(estado, 'fondoMaxPct', 6)) },
  };
}
function v0(estado, k, d) { return Number(leerParametro(estado, k, d)) || 0; }
