/**
 * MISIONES — la parte que no es predecible.
 *
 * El sistema base es siempre igual: haces una tarea, cobras su valor. Eso está
 * bien como economía y es aburrido como juego. Las misiones meten variedad sin
 * tocar la calibración: **pagan en multiplicador, no en créditos nuevos**. Una
 * misión no imprime dinero, hace que el trabajo del día valga más. Así se puede
 * subir la emoción sin descuadrar los números que ya están ajustados.
 *
 * Son deterministas: salen de la fecha con un generador con semilla. La misión
 * de hoy es la misma cada vez que se abre la app, en los dos móviles, sin
 * guardar nada y sin sincronizar nada. Y mañana son otras.
 *
 * Reglas de diseño que se respetan a propósito:
 *  · Ninguna misión pide **más** de lo que ya hay que hacer ese día: eligen
 *    entre lo que ya está en la lista. No son deberes extra.
 *  · Ninguna tiene cuenta atrás ni castiga fallarla. Si no sale, no pasa nada:
 *    mañana hay otras. La presión de tiempo en un chaval produce ansiedad, no
 *    ganas de jugar.
 *  · Las de cuidado personal nunca piden "más", solo "sigue".
 */

import { toDateKey, weekIdOf, weekDays, addDays, isWeekend } from './util.js';
import { tareasDelDia, marcaDe, cumplimientoDia } from './tasks.js';
import { habitosDelDia, resumenDia } from './health.js';
import { movimientos, TIPOS, crearMovimiento } from './ledger.js';
import { registroSueno } from './circadian.js';
import { CATEGORIAS } from './defaults.js';
import { uid } from './util.js';

/** Generador con semilla: la misma fecha da siempre las mismas misiones. */
function prng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function semillaDe(texto) {
  let h = 2166136261;
  const s = String(texto);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ==================================================================== */
/* CATÁLOGO                                                              */
/* ==================================================================== */

/**
 * Cada plantilla sabe tres cosas: si hoy tiene sentido proponerla
 * (`disponible`), cómo se mide (`progreso`) y cómo se llama con los datos de
 * hoy (`titulo`). El premio es un multiplicador que se aplica a lo que se gane
 * el resto del día.
 */
export const PLANTILLAS_DIA = [
  {
    id: 'categoria',
    emoji: '🎯',
    premio: 0.25,
    disponible: (ctx) => ctx.categorias.length > 0,
    elegir: (ctx, rnd) => ({ categoria: ctx.categorias[Math.floor(rnd() * ctx.categorias.length)] }),
    titulo: (d, ctx) => `Haz ${d.meta} de ${ctx.nombreCategoria(d.categoria)}`,
    ayuda: () => 'Todas cuentan igual: elige las que quieras de esa categoría.',
    preparar: (d, ctx) => {
      const deEsa = ctx.tareas.filter((t) => t.categoria === d.categoria);
      return { ...d, meta: Math.min(3, Math.max(2, deEsa.length)) };
    },
    progreso: (d, ctx) => ({
      hecho: ctx.tareas.filter((t) => t.categoria === d.categoria && ctx.marcada(t.id)).length,
      meta: d.meta,
    }),
  },
  {
    id: 'madrugar',
    emoji: '🌅',
    premio: 0.3,
    disponible: () => true,
    elegir: () => ({}),
    preparar: (d, ctx) => ({ ...d, meta: Math.min(3, Math.max(1, Math.round(ctx.tareas.length / 4))), hora: 12 }),
    titulo: (d) => `Ten ${d.meta} tareas hechas antes de comer`,
    ayuda: () => 'Empezar pronto el día hace que el resto pese menos.',
    progreso: (d, ctx) => ({
      hecho: ctx.tareas.filter((t) => ctx.marcadaAntesDe(t.id, d.hora)).length,
      meta: d.meta,
    }),
  },
  {
    id: 'mitad',
    emoji: '⚡',
    premio: 0.25,
    disponible: (ctx) => ctx.tareas.length >= 4,
    elegir: () => ({}),
    preparar: (d, ctx) => ({ ...d, meta: Math.ceil(ctx.tareas.length / 2) }),
    titulo: (d) => `Completa ${d.meta} tareas hoy`,
    ayuda: () => 'La mitad del día. Ni más ni menos.',
    progreso: (d, ctx) => ({ hecho: ctx.hechas, meta: d.meta }),
  },
  {
    id: 'pleno',
    emoji: '🌟',
    premio: 0.5,
    disponible: (ctx) => ctx.tareas.length > 0 && ctx.tareas.length <= 9,
    elegir: () => ({}),
    preparar: (d, ctx) => ({ ...d, meta: ctx.tareas.length }),
    titulo: () => 'Día completo: no dejes ninguna',
    ayuda: () => 'La grande del día. Si sale, el resto del día vale más.',
    progreso: (d, ctx) => ({ hecho: ctx.hechas, meta: d.meta }),
  },
  {
    id: 'cuidado',
    emoji: '🌿',
    premio: 0.2,
    disponible: (ctx) => ctx.habitos.length >= 3,
    elegir: () => ({}),
    preparar: (d, ctx) => ({ ...d, meta: Math.min(4, ctx.habitos.length) }),
    titulo: (d) => `Marca ${d.meta} cosas de cuidado`,
    ayuda: () => 'Agua, luz del día, moverse. Lo de siempre, sin prisa.',
    progreso: (d, ctx) => ({ hecho: ctx.habitosHechos, meta: d.meta }),
  },
  {
    id: 'obligatorias',
    emoji: '🧭',
    premio: 0.2,
    disponible: (ctx) => ctx.obligatorias.length > 0,
    elegir: () => ({}),
    preparar: (d, ctx) => ({ ...d, meta: ctx.obligatorias.length }),
    titulo: () => 'Todas las obligatorias, sin que te las recuerden',
    ayuda: () => 'No dan créditos, pero cuentan para la racha.',
    progreso: (d, ctx) => ({
      hecho: ctx.obligatorias.filter((t) => ctx.marcada(t.id)).length,
      meta: d.meta,
    }),
  },
  {
    id: 'foto',
    emoji: '📸',
    premio: 0.15,
    disponible: (ctx) => ctx.tareas.length > 0,
    elegir: () => ({}),
    preparar: (d) => ({ ...d, meta: 1 }),
    titulo: () => 'Enseña una tarea con foto',
    ayuda: () => 'Una foto vale más que explicarlo.',
    progreso: (d, ctx) => ({ hecho: Math.min(1, ctx.conFoto), meta: 1 }),
  },
];

export const PLANTILLAS_SEMANA = [
  {
    id: 'sin_fallos',
    emoji: '🛡️',
    premio: 0.3,
    preparar: (d) => ({ ...d, meta: 5 }),
    titulo: (d) => `${d.meta} días seguidos por encima del objetivo`,
    ayuda: () => 'La misión larga. Va sumando sola cada día que cumples.',
    progreso: (d, ctx) => ({ hecho: ctx.diasCumplidos, meta: d.meta }),
  },
  {
    id: 'noches',
    emoji: '🌙',
    premio: 0.25,
    preparar: (d) => ({ ...d, meta: 5 }),
    titulo: (d) => `${d.meta} noches a tu hora esta semana`,
    ayuda: () => 'Dormir bien es la que más se nota en todo lo demás.',
    progreso: (d, ctx) => ({ hecho: ctx.nochesCumplidas, meta: d.meta }),
  },
  {
    id: 'ahorro',
    emoji: '🐷',
    premio: 0.25,
    preparar: (d) => ({ ...d, meta: 3 }),
    titulo: (d) => `Llega al domingo con algo guardado ${d.meta} días`,
    ayuda: () => 'No gastarlo todo el mismo día también es jugar bien.',
    progreso: (d, ctx) => ({ hecho: ctx.diasConSaldo, meta: d.meta }),
  },
  {
    id: 'variedad',
    emoji: '🎨',
    premio: 0.3,
    preparar: (d) => ({ ...d, meta: 4 }),
    titulo: (d) => `Toca ${d.meta} categorías distintas esta semana`,
    ayuda: () => 'Que no se te quede ninguna zona de la casa sin visitar.',
    progreso: (d, ctx) => ({ hecho: ctx.categoriasTocadas, meta: d.meta }),
  },
];

/* ==================================================================== */
/* CONTEXTO                                                              */
/* ==================================================================== */

function contextoDia(estado, fecha) {
  const tareas = tareasDelDia(estado, fecha).filter((t) => t.tipo !== 'obligatoria');
  const obligatorias = tareasDelDia(estado, fecha).filter((t) => t.tipo === 'obligatoria');
  const habitos = habitosDelDia(estado);
  const salud = resumenDia(estado, fecha);
  const marcas = Object.values(estado.marcas || {}).filter((m) => m.fecha === fecha);
  const viva = (m) => m && m.estado !== 'vetada';
  const marcada = (id) => marcas.some((m) => m.tareaId === id && viva(m));
  const categorias = [...new Set(tareas.map((t) => t.categoria).filter(Boolean))];

  return {
    tareas,
    obligatorias,
    habitos,
    hechas: tareas.filter((t) => marcada(t.id)).length,
    habitosHechos: salud.hechos,
    conFoto: marcas.filter((m) => viva(m) && (m.fotos || []).length > 0).length,
    categorias,
    marcada,
    marcadaAntesDe: (id, hora) => marcas.some((m) => {
      if (m.tareaId !== id || !viva(m) || !m.ts) return false;
      return new Date(m.ts).getHours() < hora;
    }),
    nombreCategoria: (c) => (CATEGORIAS[c]?.etiqueta || c).toLowerCase(),
    iconoCategoria: (c) => CATEGORIAS[c]?.icono || '•',
  };
}

function contextoSemana(estado, fecha) {
  const weekId = weekIdOf(fecha);
  const dias = weekDays(weekId).filter((d) => d <= fecha);
  const umbral = Number(estado.ajustes?.umbralRacha?.valor) || 70;

  let diasCumplidos = 0;
  const categoriasTocadas = new Set();
  for (const d of dias) {
    const c = cumplimientoDia(estado, d);
    if (c.total > 0 && c.pct >= umbral) diasCumplidos++;
  }
  for (const m of Object.values(estado.marcas || {})) {
    if (!dias.includes(m.fecha) || m.estado === 'vetada') continue;
    const t = estado.tareas?.[m.tareaId];
    if (t && t.categoria) categoriasTocadas.add(t.categoria);
  }

  let nochesCumplidas = 0;
  for (const d of dias) {
    const n = registroSueno(estado, d);
    if (n && n.cumplida) nochesCumplidas++;
  }

  // Días que terminaron con saldo sin gastar: se mira el gasto del día contra
  // lo ganado, sin tocar el ledger más que para leer.
  let diasConSaldo = 0;
  for (const d of dias) {
    const delDia = movimientos(estado).filter((m) => m.fecha === d && m.cuenta === 'semana');
    const ganado = delDia.filter((m) => m.tipo === TIPOS.GANADO).reduce((s, m) => s + m.cantidad, 0);
    const gastado = -delDia.filter((m) => m.tipo === TIPOS.GASTADO).reduce((s, m) => s + m.cantidad, 0);
    if (ganado > 0 && gastado < ganado) diasConSaldo++;
  }

  return { diasCumplidos, nochesCumplidas, diasConSaldo, categoriasTocadas: categoriasTocadas.size, dias };
}

/* ==================================================================== */
/* GENERACIÓN                                                            */
/* ==================================================================== */

export function misionesActivas(estado) {
  const v = estado.ajustes?.misionesActivas?.valor;
  return v === undefined ? true : Boolean(v);
}

export function cuantasPorDia(estado) {
  const v = Number(estado.ajustes?.misionesPorDia?.valor);
  return Number.isFinite(v) ? Math.max(0, Math.min(4, v)) : 3;
}

function construir(plantilla, datos, ctx) {
  const preparada = plantilla.preparar ? plantilla.preparar(datos, ctx) : datos;
  const p = plantilla.progreso(preparada, ctx);
  const hecho = Math.min(p.hecho, p.meta);
  return {
    id: preparada.id,
    plantilla: plantilla.id,
    emoji: plantilla.emoji,
    titulo: plantilla.titulo(preparada, ctx),
    ayuda: plantilla.ayuda ? plantilla.ayuda(preparada, ctx) : '',
    premio: plantilla.premio,
    meta: p.meta,
    hecho,
    pct: p.meta > 0 ? Math.round((hecho / p.meta) * 100) : 0,
    completa: p.meta > 0 && hecho >= p.meta,
    datos: preparada,
  };
}

/** Las misiones de hoy. Deterministas: la fecha manda. */
export function misionesDelDia(estado, fecha = toDateKey(new Date())) {
  if (!misionesActivas(estado)) return [];
  const cuantas = cuantasPorDia(estado);
  if (cuantas === 0) return [];

  const ctx = contextoDia(estado, fecha);
  const rnd = prng(semillaDe(`misiones|${fecha}`));
  const posibles = PLANTILLAS_DIA.filter((p) => p.disponible(ctx));
  if (!posibles.length) return [];

  // Barajado determinista: siempre el mismo orden para la misma fecha.
  const orden = posibles
    .map((p) => ({ p, k: rnd() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.p);

  const salida = [];
  for (const plantilla of orden) {
    if (salida.length >= cuantas) break;
    const extra = plantilla.elegir ? plantilla.elegir(ctx, rnd) : {};
    salida.push(construir(plantilla, { id: `${fecha}__${plantilla.id}`, ...extra }, ctx));
  }
  return salida;
}

/** La misión larga de la semana. Una sola, para que tenga peso. */
export function misionSemanal(estado, fecha = toDateKey(new Date())) {
  if (!misionesActivas(estado)) return null;
  const weekId = weekIdOf(fecha);
  const ctx = contextoSemana(estado, fecha);
  const rnd = prng(semillaDe(`semanal|${weekId}`));
  const plantilla = PLANTILLAS_SEMANA[Math.floor(rnd() * PLANTILLAS_SEMANA.length)];
  return construir(plantilla, { id: `${weekId}__${plantilla.id}` }, ctx);
}

/**
 * El multiplicador que aportan las misiones ya completadas hoy. Se suma al
 * multiplicador manual del padre, no lo sustituye.
 */
export function bonificacionDeMisiones(estado, fecha = toDateKey(new Date())) {
  const dia = misionesDelDia(estado, fecha).filter((m) => m.completa);
  const semanal = misionSemanal(estado, fecha);
  let extra = dia.reduce((s, m) => s + m.premio, 0);
  if (semanal && semanal.completa) extra += semanal.premio;
  const tope = Number(estado.ajustes?.topeBonificacionMisiones?.valor);
  const max = Number.isFinite(tope) ? tope : 1;
  return {
    extra: Math.min(max, Math.round(extra * 100) / 100),
    completadas: dia.length + (semanal && semanal.completa ? 1 : 0),
    tope: max,
  };
}

/**
 * Apunta en el ledger las misiones completadas hoy, una sola vez cada una.
 * No pagan créditos: el movimiento va a cero y sirve de registro para los
 * logros y el historial. El premio de verdad es el multiplicador.
 */
export function registrarMisionesCompletadas(store, fecha = toDateKey(new Date())) {
  const estado = store.estado;
  const yaApuntadas = new Set(
    movimientos(estado).filter((m) => m.refTipo === 'mision').map((m) => m.refId),
  );
  const completas = [
    ...misionesDelDia(estado, fecha),
    ...(misionSemanal(estado, fecha) ? [misionSemanal(estado, fecha)] : []),
  ].filter((m) => m.completa && !yaApuntadas.has(m.id));

  if (!completas.length) return [];
  store.lote((s) => {
    for (const m of completas) {
      const mov = crearMovimiento({
        cuenta: 'semana',
        tipo: TIPOS.GANADO,
        cantidad: 0,
        concepto: `Misión: ${m.titulo}`,
        categoria: 'mision',
        fecha,
        refTipo: 'mision',
        refId: m.id,
        actor: 'sistema',
        id: uid('mv'),
      });
      s.set('ledger', mov.id, mov);
    }
  });
  return completas;
}

export { isWeekend, addDays };
