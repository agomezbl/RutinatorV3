/**
 * PROPUESTAS Y RETOS — la parte que convierte el sistema en un acuerdo.
 *
 * Todo lo demás de la app lo decide el padre: qué tareas hay, cuánto valen,
 * qué se puede comprar. Eso funciona, pero deja a Nil como ejecutor de un plan
 * ajeno. De las tres cosas que sostienen la motivación —sentirse capaz, sentirse
 * acompañado y **decidir algo**— la app tenía dos. Esta es la tercera.
 *
 * Cómo funciona:
 *  1. Nil propone: una tarea nueva, otro valor para una que ya existe, o un
 *     premio para la tienda. Siempre con un motivo escrito por él.
 *  2. El padre **acepta** (y el cambio se aplica solo, sin tocar nada a mano),
 *     **rechaza** con una razón, o hace una **contraoferta** con otro número.
 *  3. Si hay contraoferta, la pelota vuelve a Nil, que acepta o la deja pasar.
 *
 * Dos decisiones deliberadas:
 *  · Rechazar **obliga** a escribir un motivo. Un "no" sin explicación enseña
 *    que el sistema es arbitrario, que es justo lo contrario de lo que se busca.
 *  · Nil nunca puede aplicar un cambio él solo, ni siquiera aceptando una
 *    contraoferta que le beneficie: aceptar solo cierra el trato, y el cambio
 *    lo aplica el mismo camino de siempre. Un único sitio donde se toca el
 *    catálogo es un sitio donde auditar.
 */

import { uid, toDateKey, weekIdOf, weekDays } from './util.js';
import { cumplimientoDia } from './tasks.js';

export const TIPOS_PROPUESTA = {
  tarea: {
    id: 'tarea',
    etiqueta: 'Una tarea nueva',
    emoji: '🧹',
    ayuda: 'Algo que haces y no está en la lista, o algo que te apetece encargarte.',
  },
  valor: {
    id: 'valor',
    etiqueta: 'Cambiar lo que vale una tarea',
    emoji: '⚖️',
    ayuda: 'Si crees que una tarea cuesta más (o menos) de lo que pone.',
  },
  premio: {
    id: 'premio',
    etiqueta: 'Un premio para la tienda',
    emoji: '🎁',
    ayuda: 'Algo que te gustaría poder comprar, y cuánto crees que debería costar.',
  },
};

export const ESTADOS_PROPUESTA = ['pendiente', 'contraoferta', 'aceptada', 'rechazada', 'retirada'];

export function propuestas(estado) {
  return Object.values(estado.propuestas || {})
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function propuestasAbiertas(estado) {
  return propuestas(estado).filter((p) => p.estado === 'pendiente' || p.estado === 'contraoferta');
}

/** Las que esperan al padre. Es lo que lleva la pastilla roja del panel. */
export function esperandoAlPadre(estado) {
  return propuestas(estado).filter((p) => p.estado === 'pendiente');
}

/** Las que esperan a Nil: le han hecho una contraoferta. */
export function esperandoANil(estado) {
  return propuestas(estado).filter((p) => p.estado === 'contraoferta');
}

export function limitePropuestas(estado) {
  const v = Number(estado.ajustes?.limitePropuestas?.valor);
  return Number.isFinite(v) && v > 0 ? v : 3;
}

export function propuestasActivas(estado) {
  const v = estado.ajustes?.propuestasActivas?.valor;
  return v === undefined ? true : Boolean(v);
}

/* ==================================================================== */
/* CREAR                                                                 */
/* ==================================================================== */

function validar(estado, datos) {
  const tipo = TIPOS_PROPUESTA[datos.tipo];
  if (!tipo) return 'Ese tipo de propuesta no existe.';
  const motivo = String(datos.motivo || '').trim();
  if (motivo.length < 5) return 'Explica un poco por qué: con cinco letras no se entiende.';

  if (datos.tipo === 'tarea') {
    if (String(datos.nombre || '').trim().length < 3) return 'Ponle un nombre a la tarea.';
    const v = Number(datos.valor);
    if (!Number.isFinite(v) || v < 0 || v > 60) return 'El valor tiene que estar entre 0 y 60 créditos.';
  }
  if (datos.tipo === 'valor') {
    if (!estado.tareas?.[datos.tareaId]) return 'Esa tarea ya no existe.';
    const v = Number(datos.valor);
    if (!Number.isFinite(v) || v < 0 || v > 60) return 'El valor tiene que estar entre 0 y 60 créditos.';
  }
  if (datos.tipo === 'premio') {
    if (String(datos.nombre || '').trim().length < 3) return 'Ponle un nombre al premio.';
    const v = Number(datos.valor);
    if (!Number.isFinite(v) || v < 1 || v > 900) return 'El precio tiene que estar entre 1 y 900.';
    if (!['semana', 'hucha', 'estrellas'].includes(datos.moneda || 'semana')) return 'Esa moneda no existe.';
  }
  return null;
}

export function crearPropuesta(store, datos) {
  const estado = store.estado;
  if (!propuestasActivas(estado)) {
    return { ok: false, razon: 'Las propuestas están desactivadas ahora mismo.' };
  }
  const abiertas = propuestasAbiertas(estado).length;
  const limite = limitePropuestas(estado);
  if (abiertas >= limite) {
    return { ok: false, razon: `Ya tienes ${limite} propuestas esperando. Espera a que papá conteste.` };
  }
  const problema = validar(estado, datos);
  if (problema) return { ok: false, razon: problema };

  const p = {
    id: uid('pr'),
    tipo: datos.tipo,
    nombre: String(datos.nombre || '').trim(),
    tareaId: datos.tareaId || null,
    valor: Number(datos.valor),
    moneda: datos.moneda || 'semana',
    icono: datos.icono || TIPOS_PROPUESTA[datos.tipo].emoji,
    motivo: String(datos.motivo).trim(),
    estado: 'pendiente',
    fecha: datos.fecha || toDateKey(new Date()),
    ts: Date.now(),
    contraoferta: null,
    respuesta: null,
  };
  store.set('propuestas', p.id, p);
  return { ok: true, propuesta: p };
}

export function retirarPropuesta(store, id) {
  const p = store.estado.propuestas?.[id];
  if (!p) return { ok: false, razon: 'No existe esa propuesta.' };
  if (p.estado !== 'pendiente' && p.estado !== 'contraoferta') {
    return { ok: false, razon: 'Esa propuesta ya está cerrada.' };
  }
  store.patch('propuestas', id, { estado: 'retirada', cerradaEn: Date.now() });
  return { ok: true };
}

/* ==================================================================== */
/* RESPONDER                                                             */
/* ==================================================================== */

/**
 * Aplica el cambio que pedía la propuesta. Es el único punto donde una
 * propuesta toca el catálogo, y solo se llega aquí desde `aceptarPropuesta`.
 */
function aplicar(store, p, valorFinal) {
  if (p.tipo === 'tarea') {
    const id = uid('t');
    store.set('tareas', id, {
      id,
      nombre: p.nombre,
      valor: valorFinal,
      categoria: 'tarde',
      tipo: 'estandar',
      dias: [0, 1, 2, 3, 4, 5, 6],
      icono: p.icono || '🧹',
      requiereAprobacion: true,
      orden: 900,
      propuestaPor: 'nil',
    });
    return id;
  }
  if (p.tipo === 'valor') {
    store.patch('tareas', p.tareaId, { valor: valorFinal });
    return p.tareaId;
  }
  if (p.tipo === 'premio') {
    const id = uid('p');
    store.set('tienda', id, {
      id,
      nombre: p.nombre,
      descripcion: 'Propuesto por Nil.',
      precio: valorFinal,
      moneda: p.moneda || 'semana',
      tipo: 'premio',
      requiereAprobacion: true,
      icono: p.icono || '🎁',
      orden: 900,
      propuestaPor: 'nil',
    });
    return id;
  }
  return null;
}

export function aceptarPropuesta(store, id, { valor = null, nota = '' } = {}) {
  const p = store.estado.propuestas?.[id];
  if (!p) return { ok: false, razon: 'No existe esa propuesta.' };
  if (p.estado !== 'pendiente' && p.estado !== 'contraoferta') {
    return { ok: false, razon: 'Esa propuesta ya está cerrada.' };
  }
  const valorFinal = valor === null
    ? (p.contraoferta !== null && p.contraoferta !== undefined ? p.contraoferta : p.valor)
    : Number(valor);
  if (!Number.isFinite(valorFinal) || valorFinal < 0) {
    return { ok: false, razon: 'Ese número no vale.' };
  }

  let creado = null;
  store.lote((s) => {
    creado = aplicar(s, p, valorFinal);
    s.patch('propuestas', id, {
      estado: 'aceptada',
      valorFinal,
      respuesta: String(nota || '').trim() || null,
      creadoId: creado,
      cerradaEn: Date.now(),
    });
  });
  return { ok: true, valorFinal, creadoId: creado };
}

export function rechazarPropuesta(store, id, motivo = '') {
  const p = store.estado.propuestas?.[id];
  if (!p) return { ok: false, razon: 'No existe esa propuesta.' };
  if (p.estado !== 'pendiente' && p.estado !== 'contraoferta') {
    return { ok: false, razon: 'Esa propuesta ya está cerrada.' };
  }
  const texto = String(motivo || '').trim();
  // Un "no" sin explicación enseña que el sistema es arbitrario. Aquí no cuela.
  if (texto.length < 5) return { ok: false, razon: 'Escribe por qué no: un no sin motivo no vale.' };

  store.patch('propuestas', id, {
    estado: 'rechazada',
    respuesta: texto,
    cerradaEn: Date.now(),
  });
  return { ok: true };
}

export function contraofertar(store, id, { valor, nota = '' }) {
  const p = store.estado.propuestas?.[id];
  if (!p) return { ok: false, razon: 'No existe esa propuesta.' };
  if (p.estado !== 'pendiente') return { ok: false, razon: 'Solo se contraoferta una propuesta pendiente.' };
  const v = Number(valor);
  if (!Number.isFinite(v) || v < 0 || v > 900) return { ok: false, razon: 'Ese número no vale.' };
  if (v === Number(p.valor)) return { ok: false, razon: 'Eso no es una contraoferta: es lo mismo que pedía.' };

  store.patch('propuestas', id, {
    estado: 'contraoferta',
    contraoferta: v,
    respuesta: String(nota || '').trim() || null,
    contraofertadaEn: Date.now(),
  });
  return { ok: true };
}

/** Nil acepta la contraoferta. No aplica nada: la aplica el camino de siempre. */
export function aceptarContraoferta(store, id) {
  const p = store.estado.propuestas?.[id];
  if (!p) return { ok: false, razon: 'No existe esa propuesta.' };
  if (p.estado !== 'contraoferta') return { ok: false, razon: 'Aquí no hay ninguna contraoferta.' };
  return aceptarPropuesta(store, id, { valor: p.contraoferta, nota: p.respuesta || '' });
}

/* ==================================================================== */
/* RETO DE LA CASA                                                       */
/* ==================================================================== */

/**
 * Un reto semanal que se juega entre los dos. El padre lo propone, dice qué
 * pasa si sale, y durante la semana se ve avanzar en la pantalla de Nil.
 * No hay castigo si no sale: el premio es lo único en juego.
 */
export const RETOS = {
  cumplimiento: {
    id: 'cumplimiento',
    etiqueta: 'Días por encima del objetivo',
    emoji: '🎯',
    unidad: 'días',
    medir: (estado, dias, umbral) => dias.filter((d) => {
      const c = cumplimientoDia(estado, d);
      return c.total > 0 && c.pct >= umbral;
    }).length,
  },
  tareas: {
    id: 'tareas',
    etiqueta: 'Tareas completadas',
    emoji: '✅',
    unidad: 'tareas',
    medir: (estado, dias) => Object.values(estado.marcas || {})
      .filter((m) => dias.includes(m.fecha) && m.estado !== 'vetada').length,
  },
  noches: {
    id: 'noches',
    etiqueta: 'Noches a la hora',
    emoji: '🌙',
    unidad: 'noches',
    medir: (estado, dias) => dias
      .filter((d) => estado.sueno?.[d]?.cumplida).length,
  },
  cuidado: {
    id: 'cuidado',
    etiqueta: 'Días de cuidado completos',
    emoji: '🌿',
    unidad: 'días',
    medir: (estado, dias) => Object.values(estado.ledger || {})
      .filter((m) => m.refTipo === 'habitos-dia' && dias.includes(m.fecha)).length,
  },
};

export function crearReto(store, { tipo, meta, premio, fecha = toDateKey(new Date()) }) {
  if (!RETOS[tipo]) return { ok: false, razon: 'Ese tipo de reto no existe.' };
  const m = Number(meta);
  if (!Number.isFinite(m) || m < 1 || m > 100) return { ok: false, razon: 'La meta tiene que estar entre 1 y 100.' };
  if (String(premio || '').trim().length < 3) return { ok: false, razon: 'Di qué hay en juego.' };

  const weekId = weekIdOf(fecha);
  if (store.estado.retos?.[weekId] && store.estado.retos[weekId].estado === 'abierto') {
    return { ok: false, razon: 'Ya hay un reto esta semana.' };
  }
  const reto = {
    id: weekId,
    tipo,
    meta: m,
    premio: String(premio).trim(),
    estado: 'abierto',
    creadoEn: Date.now(),
  };
  store.set('retos', weekId, reto);
  return { ok: true, reto };
}

export function retoDeLaSemana(estado, fecha = toDateKey(new Date())) {
  const weekId = weekIdOf(fecha);
  const reto = estado.retos?.[weekId];
  if (!reto) return null;
  const def = RETOS[reto.tipo];
  if (!def) return null;
  const dias = weekDays(weekId).filter((d) => d <= fecha);
  const umbral = Number(estado.ajustes?.umbralRacha?.valor) || 70;
  const hecho = def.medir(estado, dias, umbral);
  return {
    ...reto,
    emoji: def.emoji,
    etiqueta: def.etiqueta,
    unidad: def.unidad,
    hecho,
    pct: Math.min(100, Math.round((hecho / reto.meta) * 100)),
    conseguido: hecho >= reto.meta,
  };
}

/** Se cierra al cerrar la semana: ganado o no, queda en el historial. */
export function cerrarReto(store, fecha = toDateKey(new Date())) {
  const reto = retoDeLaSemana(store.estado, fecha);
  if (!reto || reto.estado !== 'abierto') return null;
  const estado = reto.conseguido ? 'ganado' : 'fallado';
  store.patch('retos', reto.id, { estado, resultado: reto.hecho, cerradoEn: Date.now() });
  return { ...reto, estado };
}
