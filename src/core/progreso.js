/**
 * PROGRESO — lo que no se gasta nunca.
 *
 * El resto de la app es una economía: se gana, se gasta, y el lunes el saldo
 * de la semana vuelve a cero. Eso está bien para el dinero, pero es horrible
 * como sensación de avance: lo único que Nil veía crecer se le borraba cada
 * semana. Este módulo es el otro eje, el que solo sube.
 *
 * Tres piezas:
 *
 *  · **Experiencia y nivel.** No es una moneda nueva ni un saldo aparte: se
 *    *deriva* del ledger, igual que todo lo demás. Cada crédito ganado y cada
 *    estrella dejan huella permanente aunque el crédito se gaste luego. Si un
 *    padre veta una tarea, la anulación resta también aquí, sola. No hay
 *    ningún contador que pueda desincronizarse porque no hay contador.
 *
 *  · **Racha con escudo.** La racha semanal existía pero era un número pelado.
 *    Ahora tiene récord histórico (lo mejor que ha hecho nunca, que no se
 *    pierde al fallar) y un escudo que se gana cada N semanas y salva un fallo
 *    automáticamente. El escudo no es un regalo: es lo que evita que una mala
 *    semana se lleve por delante dos meses de constancia y con ellos las ganas.
 *
 *  · **Logros.** Un catálogo declarativo. Cada uno sabe comprobarse a sí mismo
 *    contra el estado; no hay banderas que mantener a mano.
 *
 * Nada de esto inventa créditos: el nivel y los logros dan acceso a cosas
 * (fondos, tope de hucha, poder proponer), nunca dinero. Así la economía que
 * ya está calibrada no se descuadra por añadir progresión encima.
 */

import { movimientos, TIPOS } from './ledger.js';
import { rachaActual, umbralRacha } from './tasks.js';
import { toDateKey, weekIdOf, addDays } from './util.js';

/* ==================================================================== */
/* EXPERIENCIA Y NIVEL                                                   */
/* ==================================================================== */

/**
 * Cuánta experiencia deja cada cosa. Las estrellas pesan más por unidad
 * porque hay muchas menos: una estrella cuesta más de conseguir que un crédito.
 */
export const XP_POR = {
  credito: 1,
  estrella: 4,
};

/**
 * La curva. Cada nivel cuesta un poco más que el anterior, pero sin dispararse:
 * se busca que a ritmo normal salga aproximadamente un nivel por semana al
 * principio y uno cada dos o tres más adelante. Nada de muros de meses.
 */
export function xpParaNivel(n) {
  if (n <= 1) return 0;
  return Math.round(60 * (n - 1) + 14 * (n - 1) * (n - 2));
}

export const NIVELES = [
  { n: 1, nombre: 'Aprendiz' },
  { n: 2, nombre: 'Escudero' },
  { n: 3, nombre: 'Explorador' },
  { n: 4, nombre: 'Rastreador' },
  { n: 5, nombre: 'Artesano' },
  { n: 6, nombre: 'Navegante' },
  { n: 7, nombre: 'Cartógrafo' },
  { n: 8, nombre: 'Alquimista' },
  { n: 9, nombre: 'Ingeniero' },
  { n: 10, nombre: 'Arquitecto' },
  { n: 11, nombre: 'Astrónomo' },
  { n: 12, nombre: 'Guardián' },
  { n: 13, nombre: 'Maestro' },
  { n: 14, nombre: 'Leyenda' },
  { n: 15, nombre: 'Mito' },
];

export const NIVEL_MAXIMO = NIVELES.length;

export function nombreDeNivel(n) {
  const encontrado = NIVELES.find((x) => x.n === n);
  if (encontrado) return encontrado.nombre;
  return NIVELES[NIVELES.length - 1].nombre;
}

/**
 * Experiencia total. Se recorre el ledger entero: solo cuenta lo GANADO y lo
 * ganado que luego se anuló resta. Lo gastado no toca la experiencia (por eso
 * comprarse un premio no te hace retroceder) y los traspasos tampoco (mover
 * créditos de la semana a la hucha no es mérito nuevo).
 */
export function experiencia(estado) {
  const ledger = estado.ledger || {};
  let xp = 0;
  for (const m of movimientos(estado)) {
    // Una anulación resta exactamente lo que dio el movimiento que anula.
    if (m.tipo === TIPOS.ANULACION && m.anula) {
      const original = ledger[m.anula];
      if (original && original.tipo === TIPOS.GANADO && original.cantidad > 0) {
        xp -= peso(original);
      }
      continue;
    }
    if (m.tipo !== TIPOS.GANADO || m.cantidad <= 0) continue;
    xp += peso(m);
  }
  // Los premios de constancia (bonus de racha, de sueño, de día completo) ya
  // son movimientos 'ganado' del ledger, así que entran por aquí. No hay que
  // sumarlos aparte ni existe ningún contador que pueda desincronizarse.
  return Math.max(0, Math.round(xp));
}

function peso(m) {
  const factor = m.cuenta === 'estrellas' ? XP_POR.estrella : XP_POR.credito;
  return Math.abs(m.cantidad) * factor;
}

/** Nivel, progreso dentro del nivel y cuánto falta para el siguiente. */
export function nivelDe(estado) {
  const xp = experiencia(estado);
  let n = 1;
  while (n < NIVEL_MAXIMO && xp >= xpParaNivel(n + 1)) n++;
  const base = xpParaNivel(n);
  const techo = n < NIVEL_MAXIMO ? xpParaNivel(n + 1) : base;
  const rango = Math.max(1, techo - base);
  return {
    xp,
    nivel: n,
    nombre: nombreDeNivel(n),
    base,
    techo,
    enNivel: xp - base,
    falta: n < NIVEL_MAXIMO ? techo - xp : 0,
    pct: n < NIVEL_MAXIMO ? Math.min(100, Math.round(((xp - base) / rango) * 100)) : 100,
    maximo: n >= NIVEL_MAXIMO,
  };
}

/* ==================================================================== */
/* RACHA: RÉCORD Y ESCUDO                                                */
/* ==================================================================== */

/** Hitos de racha. Llegar a uno es un logro con nombre, no solo un número. */
export const HITOS_RACHA = [2, 4, 8, 12, 26, 52];

/** Cada cuántas semanas de racha se gana un escudo. */
export function semanasPorEscudo(estado) {
  const v = Number(estado.ajustes?.escudoCadaSemanas?.valor);
  return Number.isFinite(v) && v > 0 ? v : 4;
}

export function escudosMaximos(estado) {
  const v = Number(estado.ajustes?.escudosMaximos?.valor);
  return Number.isFinite(v) && v >= 0 ? v : 2;
}

export function escudosDisponibles(estado) {
  const v = Number(estado.ajustes?.escudos?.valor);
  return Number.isFinite(v) && v >= 0 ? Math.min(v, escudosMaximos(estado)) : 0;
}

/** Semanas cerradas, de la más antigua a la más reciente. */
export function semanasCerradas(estado) {
  return Object.values(estado.semanas || {})
    .filter((s) => s && s.id)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/**
 * Récord histórico de racha. Se saca del archivo de semanas, así que no hay
 * que mantener a mano un "mejor" que pueda quedarse desfasado.
 */
export function recordRacha(estado) {
  const actual = rachaActual(estado);
  const mejorArchivado = semanasCerradas(estado)
    .reduce((mejor, s) => Math.max(mejor, Number(s.racha) || 0), 0);
  return Math.max(actual, mejorArchivado);
}

/** El siguiente hito al que se aspira, y cuánto falta. */
export function proximoHitoRacha(estado) {
  const r = rachaActual(estado);
  const hito = HITOS_RACHA.find((h) => h > r);
  if (!hito) return null;
  return { hito, faltan: hito - r };
}

/**
 * Qué pasa con la racha al cerrar una semana. Devuelve la decisión, no la
 * aplica: quien cierra la semana es `week.js`, y así esta regla se puede
 * probar sola sin montar medio sistema.
 */
export function resolverRacha(estado, { cumplimiento, umbral }) {
  const previa = rachaActual(estado);
  const escudos = escudosDisponibles(estado);
  const superada = cumplimiento >= umbral;

  if (superada) {
    const nueva = previa + 1;
    // Se gana escudo al llegar a un múltiplo, y nunca más del tope.
    const ganaEscudo = nueva > 0 && nueva % semanasPorEscudo(estado) === 0
      && escudos < escudosMaximos(estado);
    return {
      racha: nueva,
      superada: true,
      escudoUsado: false,
      escudos: escudos + (ganaEscudo ? 1 : 0),
      ganaEscudo,
      hito: HITOS_RACHA.includes(nueva) ? nueva : null,
    };
  }

  if (escudos > 0) {
    // El escudo salva la racha: no la sube, pero tampoco la parte.
    return {
      racha: previa,
      superada: false,
      escudoUsado: true,
      escudos: escudos - 1,
      ganaEscudo: false,
      hito: null,
    };
  }

  return {
    racha: 0,
    superada: false,
    escudoUsado: false,
    escudos,
    ganaEscudo: false,
    hito: null,
  };
}

/** Resumen listo para pintar. */
export function resumenRacha(estado) {
  return {
    actual: rachaActual(estado),
    record: recordRacha(estado),
    escudos: escudosDisponibles(estado),
    escudosMax: escudosMaximos(estado),
    cadaCuantas: semanasPorEscudo(estado),
    proximo: proximoHitoRacha(estado),
    umbral: umbralRacha(estado),
  };
}

/* ==================================================================== */
/* LOGROS                                                                */
/* ==================================================================== */

/**
 * Cada logro sabe comprobarse solo contra el estado. No hay banderas que
 * mantener: si mañana cambia la forma de calcular algo, los logros se
 * recalculan con ella y no queda ninguna medalla colgada de un dato viejo.
 *
 * `secreto: true` significa que no se ve la descripción hasta conseguirlo:
 * son los que dan la alegría de descubrir que existían.
 */
function contarMovimientos(estado, filtro) {
  return movimientos(estado).filter(filtro).length;
}

function marcasAprobadas(estado) {
  return Object.values(estado.marcas || {}).filter((m) => m.estado === 'aprobada');
}

function comprasAprobadas(estado) {
  return Object.values(estado.compras || {}).filter((c) => c.estado === 'aprobada');
}

function nochesApuntadas(estado) {
  return Object.values(estado.sueno || {});
}

export const LOGROS = [
  // --- Primeros pasos -------------------------------------------------
  { id: 'primera_tarea', nombre: 'Primer paso', emoji: '👣', pista: 'Marca tu primera tarea.',
    comprobar: (e) => marcasAprobadas(e).length >= 1 },
  { id: 'primer_premio', nombre: 'Me lo he ganado', emoji: '🎁', pista: 'Consigue tu primer premio.',
    comprobar: (e) => comprasAprobadas(e).length >= 1 },
  { id: 'primera_estrella', nombre: 'Brilla', emoji: '⭐', pista: 'Gana tu primera estrella.',
    comprobar: (e) => contarMovimientos(e, (m) => m.cuenta === 'estrellas' && m.cantidad > 0) >= 1 },
  { id: 'primera_hucha', nombre: 'Guardián de la hucha', emoji: '🐷', pista: 'Ahorra algo en la hucha.',
    comprobar: (e) => contarMovimientos(e, (m) => m.cuenta === 'hucha' && m.cantidad > 0) >= 1 },

  // --- Volumen --------------------------------------------------------
  { id: 'tareas_25', nombre: 'Veinticinco', emoji: '✅', pista: 'Completa 25 tareas.',
    comprobar: (e) => marcasAprobadas(e).length >= 25 },
  { id: 'tareas_100', nombre: 'Centenario', emoji: '💯', pista: 'Completa 100 tareas.',
    comprobar: (e) => marcasAprobadas(e).length >= 100 },
  { id: 'tareas_500', nombre: 'Quinientas', emoji: '🏔️', pista: 'Completa 500 tareas.',
    comprobar: (e) => marcasAprobadas(e).length >= 500 },
  { id: 'estrellas_50', nombre: 'Constelación', emoji: '✨', pista: 'Reúne 50 estrellas en total.',
    comprobar: (e) => movimientos(e)
      .filter((m) => m.cuenta === 'estrellas' && m.cantidad > 0)
      .reduce((s, m) => s + m.cantidad, 0) >= 50 },

  // --- Constancia -----------------------------------------------------
  { id: 'racha_2', nombre: 'Dos seguidas', emoji: '🔥', pista: 'Dos semanas seguidas superando el objetivo.',
    comprobar: (e) => recordRacha(e) >= 2 },
  { id: 'racha_4', nombre: 'Un mes entero', emoji: '🗓️', pista: 'Cuatro semanas seguidas.',
    comprobar: (e) => recordRacha(e) >= 4 },
  { id: 'racha_12', nombre: 'Un trimestre', emoji: '🏆', pista: 'Doce semanas seguidas.',
    comprobar: (e) => recordRacha(e) >= 12 },
  { id: 'escudo_usado', nombre: 'Salvado por los pelos', emoji: '🛡️', secreto: true,
    pista: 'Un escudo te salvó la racha en una mala semana.',
    comprobar: (e) => semanasCerradas(e).some((s) => s.escudoUsado) },
  { id: 'semana_perfecta', nombre: 'Semana perfecta', emoji: '💎', pista: 'Cierra una semana al 100 %.',
    comprobar: (e) => semanasCerradas(e).some((s) => Number(s.cumplimiento) >= 100) },

  // --- Cuidado --------------------------------------------------------
  { id: 'habitos_dia', nombre: 'Día redondo', emoji: '🌿', pista: 'Completa todos los hábitos de cuidado en un día.',
    comprobar: (e) => contarMovimientos(e, (m) => m.refTipo === 'habitos-dia') >= 1 },
  { id: 'habitos_7', nombre: 'Siete de siete', emoji: '🍀', pista: 'Siete días completos de cuidado.',
    comprobar: (e) => contarMovimientos(e, (m) => m.refTipo === 'habitos-dia') >= 7 },
  { id: 'sueno_7', nombre: 'Siete noches', emoji: '🌙', pista: 'Apunta siete noches a su hora.',
    comprobar: (e) => nochesApuntadas(e).filter((n) => n.cumplida).length >= 7 },
  { id: 'sueno_30', nombre: 'Reloj interno', emoji: '🕰️', pista: 'Treinta noches a su hora.',
    comprobar: (e) => nochesApuntadas(e).filter((n) => n.cumplida).length >= 30 },
  { id: 'madrugador', nombre: 'A la cama pronto', emoji: '😴', secreto: true,
    pista: 'Te acostaste más de media hora antes de tu hora.',
    comprobar: (e) => nochesApuntadas(e).some((n) => Number(n.margen) <= -30) },

  // --- Ahorro ---------------------------------------------------------
  { id: 'hucha_100', nombre: 'Cien en la hucha', emoji: '💰', pista: 'Ten 100 créditos ahorrados a la vez.',
    comprobar: (e, ctx) => (ctx.hucha || 0) >= 100 },
  { id: 'objetivo_cumplido', nombre: 'Objetivo alcanzado', emoji: '🎯', pista: 'Consigue un premio que te habías fijado como objetivo.',
    comprobar: (e) => comprasAprobadas(e).some((c) => c.eraObjetivo) },
  { id: 'primer_deposito', nombre: 'Paciencia', emoji: '⏳', pista: 'Abre tu primer depósito a plazo.',
    comprobar: (e) => Object.values(e.stakings || {}).some((s) => s.tipo === 'deposito') },
  { id: 'deposito_vencido', nombre: 'Interés compuesto', emoji: '📈', pista: 'Deja vencer un depósito sin romperlo.',
    comprobar: (e) => Object.values(e.stakings || {}).some((s) => s.tipo === 'deposito' && s.estado === 'vencido') },
  { id: 'apuesta_ganada', nombre: 'Apostó y ganó', emoji: '🎲', secreto: true, pista: 'Gana una apuesta de racha.',
    comprobar: (e) => Object.values(e.stakings || {}).some((s) => s.tipo === 'apuesta' && s.estado === 'ganada') },

  // --- Nivel ----------------------------------------------------------
  { id: 'nivel_3', nombre: 'Explorador', emoji: '🧭', pista: 'Llega al nivel 3.',
    comprobar: (e, ctx) => ctx.nivel >= 3 },
  { id: 'nivel_6', nombre: 'Navegante', emoji: '⛵', pista: 'Llega al nivel 6.',
    comprobar: (e, ctx) => ctx.nivel >= 6 },
  { id: 'nivel_10', nombre: 'Arquitecto', emoji: '🏛️', pista: 'Llega al nivel 10.',
    comprobar: (e, ctx) => ctx.nivel >= 10 },
  { id: 'nivel_15', nombre: 'Mito', emoji: '🐉', pista: 'Llega al nivel máximo.',
    comprobar: (e, ctx) => ctx.nivel >= NIVEL_MAXIMO },

  // --- Misiones y propuestas -----------------------------------------
  { id: 'mision_1', nombre: 'Misión cumplida', emoji: '📜', pista: 'Completa tu primera misión.',
    comprobar: (e) => contarMovimientos(e, (m) => m.refTipo === 'mision') >= 1 },
  { id: 'mision_10', nombre: 'Cazador de misiones', emoji: '🗡️', pista: 'Completa diez misiones.',
    comprobar: (e) => contarMovimientos(e, (m) => m.refTipo === 'mision') >= 10 },
  { id: 'propuesta_1', nombre: 'Tengo una idea', emoji: '💡', pista: 'Haz tu primera propuesta a papá.',
    comprobar: (e) => Object.keys(e.propuestas || {}).length >= 1 },
  { id: 'propuesta_aceptada', nombre: 'Negociador', emoji: '🤝', pista: 'Consigue que te acepten una propuesta.',
    comprobar: (e) => Object.values(e.propuestas || {}).some((p) => p.estado === 'aceptada') },
  { id: 'reto_casa', nombre: 'En equipo', emoji: '👨‍👦', pista: 'Gana un reto de la casa con papá.',
    comprobar: (e) => Object.values(e.retos || {}).some((r) => r.estado === 'ganado') },

  // --- Curiosidades ---------------------------------------------------
  { id: 'coleccionista_temas', nombre: 'Coleccionista', emoji: '🎨', pista: 'Desbloquea diez fondos.',
    comprobar: (e, ctx) => (ctx.temasDesbloqueados || 0) >= 10 },
  { id: 'todos_los_temas', nombre: 'Museo completo', emoji: '🖼️', pista: 'Desbloquea todos los fondos.',
    comprobar: (e, ctx) => ctx.temasTotales > 0 && ctx.temasDesbloqueados >= ctx.temasTotales },
  { id: 'billetes_20', nombre: 'Álbum de recuerdos', emoji: '🎟️', pista: 'Guarda veinte billetes gastados.',
    comprobar: (e) => comprasAprobadas(e).length >= 20 },
  { id: 'sudoku', nombre: 'Sudoku resuelto', emoji: '🔢', secreto: true, pista: 'Termina un sudoku.',
    comprobar: (e) => Number(e.ajustes?.sudokusResueltos?.valor) >= 1 },
  { id: 'madrugon', nombre: 'Antes que el gallo', emoji: '🐓', secreto: true,
    pista: 'Marca una tarea antes de las 7 de la mañana.',
    comprobar: (e) => Object.values(e.marcas || {}).some((m) => {
      const h = new Date(m.ts || 0).getHours();
      return m.ts && h >= 4 && h < 7;
    }) },
  { id: 'ojo', nombre: 'Contemplativo', emoji: '👁️', secreto: true,
    pista: 'Mira el fondo a pantalla completa veinte veces.',
    comprobar: (e) => Number(e.ajustes?.vecesEscaparate?.valor) >= 20 },
];

export const LOGROS_POR_ID = Object.fromEntries(LOGROS.map((l) => [l.id, l]));

/**
 * Evalúa el catálogo entero. `ctx` trae los datos que ya están calculados en
 * otro sitio (hucha, nivel, temas desbloqueados) para no recalcularlos aquí.
 */
export function evaluarLogros(estado, ctx = {}) {
  const conseguidos = estado.logros || {};
  return LOGROS.map((l) => {
    let logrado = false;
    try {
      logrado = Boolean(l.comprobar(estado, ctx));
    } catch {
      logrado = false;
    }
    const guardado = conseguidos[l.id];
    return {
      id: l.id,
      nombre: l.nombre,
      emoji: l.emoji,
      pista: l.pista,
      secreto: Boolean(l.secreto),
      logrado,
      fecha: guardado ? guardado.fecha : null,
    };
  });
}

export function resumenLogros(estado, ctx = {}) {
  const todos = evaluarLogros(estado, ctx);
  const hechos = todos.filter((l) => l.logrado);
  return {
    todos,
    hechos: hechos.length,
    total: todos.length,
    pct: Math.round((hechos.length / Math.max(1, todos.length)) * 100),
  };
}

/**
 * Guarda los logros recién conseguidos y devuelve cuáles son nuevos, para
 * poder celebrarlos. Es idempotente: llamarlo dos veces no duplica nada ni
 * vuelve a anunciar lo mismo.
 */
export function registrarLogros(store, ctx = {}, fecha = toDateKey(new Date())) {
  const estado = store.estado;
  const nuevos = evaluarLogros(estado, ctx)
    .filter((l) => l.logrado && !estado.logros?.[l.id]);
  if (!nuevos.length) return [];
  store.lote((s) => {
    for (const l of nuevos) {
      s.set('logros', l.id, { id: l.id, fecha, ts: Date.now() });
    }
  });
  return nuevos;
}

/* ==================================================================== */
/* CONTEXTO COMPLETO                                                     */
/* ==================================================================== */

/**
 * Una sola llamada para la pantalla de progreso: nivel, racha y logros juntos,
 * con el contexto que los logros necesitan ya resuelto.
 */
export function progresoCompleto(estado, { hucha = 0, temasDesbloqueados = 0, temasTotales = 0 } = {}) {
  const nivel = nivelDe(estado);
  const ctx = { hucha, nivel: nivel.nivel, temasDesbloqueados, temasTotales };
  return {
    nivel,
    racha: resumenRacha(estado),
    logros: resumenLogros(estado, ctx),
    ctx,
  };
}

export { weekIdOf, addDays };
