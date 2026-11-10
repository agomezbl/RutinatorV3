/**
 * TAREAS — marcado, aprobación, veto, auto-aprobación y cumplimiento.
 *
 * El identificador de una marca es determinista: `<fecha>__<tareaId>`.
 * Así dos dispositivos que marcan la misma tarea el mismo día escriben el
 * mismo registro en vez de duplicarlo.
 */

import { uid, weekdayIndex, weekDays, weekIdOf, toDateKey, creditos } from './util.js';
import { crearMovimiento, TIPOS } from './ledger.js';
import { valorTareaEn } from './economy.js';
import { tareasDePreparacion } from './schedule.js';
import { diaSinTareas } from './leisure.js';
import { leerParametro } from './tokenomics.js';
import { habitosDelDia, marcaHabito, resumenDia } from './health.js';

/** La moneda en la que cobra una tarea: créditos de la semana o estrellas. */
export function monedaDeTarea(tarea) {
  if (tarea.moneda === 'estrellas' || tarea.tipo === 'habito') return 'estrellas';
  return 'semana';
}

/** Las que se aprueban solas: hábitos y cualquiera marcada como tal. */
export function seAutoAprueba(tarea) {
  return tarea.tipo === 'habito' || tarea.requiereAprobacion === false;
}

export const ESTADOS_MARCA = ['pendiente', 'aprobada', 'vetada', 'nocumplida'];

export function idMarca(fecha, tareaId) {
  return `${fecha}__${tareaId}`;
}

export function marcaDe(estado, fecha, tareaId) {
  return estado.marcas?.[idMarca(fecha, tareaId)] || null;
}

function aplicaEnFecha(tarea, fecha) {
  if (tarea.activa === false) return false;
  if (tarea.tipo === 'puntual') return tarea.fecha === fecha;
  const dias = tarea.dias;
  if (!dias || dias === 'todos') return true;
  return Array.isArray(dias) && dias.includes(weekdayIndex(fecha));
}

/**
 * Lista completa de tareas de un día: catálogo + generadas por el horario.
 * Si hay un "Día sin tareas" aprobado, solo quedan las obligatorias.
 */
export function tareasDelDia(estado, fecha) {
  // Los hábitos de salud viven en su propia sección y no cuentan para el
  // cumplimiento de las tareas de casa: son cuidado, no faena.
  const catalogo = Object.values(estado.tareas || {})
    .filter((t) => t.tipo !== 'habito')
    .filter((t) => aplicaEnFecha(t, fecha));
  const generadas = tareasDePreparacion(estado, fecha);
  let todas = [...catalogo, ...generadas];
  if (diaSinTareas(estado, fecha)) {
    todas = todas.filter((t) => t.tipo === 'obligatoria');
  }
  return todas.sort((a, b) => (a.orden || 999) - (b.orden || 999) || a.nombre.localeCompare(b.nombre));
}

export function tareaPorId(estado, fecha, tareaId) {
  return tareasDelDia(estado, fecha).find((t) => t.id === tareaId)
    || estado.tareas?.[tareaId]
    || null;
}

/* ------------------------------------------------------------------ */
/* Marcar                                                              */
/* ------------------------------------------------------------------ */

/**
 * Nil marca una tarea. Si da créditos, se anota YA en el ledger como
 * movimiento provisional: así ve el efecto al instante. Si el padre veta,
 * la anulación lo resta sola. Nadie hace cuentas a mano en ningún sitio.
 */
export function marcarTarea(store, {
  fecha, tareaId, opcionId = null, fotos = [], actor = 'nil', bonificacion = 0,
}) {
  const estado = store.estado;
  const tarea = tareaPorId(estado, fecha, tareaId);
  if (!tarea) return { ok: false, razon: 'Esa tarea no existe hoy.' };

  const existente = marcaDe(estado, fecha, tareaId);
  if (existente && existente.estado !== 'vetada' && existente.estado !== 'nocumplida') {
    return { ok: false, razon: 'Esta tarea ya estaba marcada.' };
  }
  if (tarea.tipo === 'eleccion') {
    const valida = (tarea.opciones || []).some((o) => o.id === opcionId);
    if (!valida) return { ok: false, razon: 'Elige una de las dos opciones.' };
  }

  const valor = valorTareaEn(estado, tarea, fecha, opcionId, bonificacion);
  const moneda = monedaDeTarea(tarea);
  const cuenta = moneda === 'estrellas' ? 'estrellas' : 'semana';
  const sola = seAutoAprueba(tarea);
  const mId = idMarca(fecha, tareaId);
  let movId = null;
  let extra = 0;

  store.lote((s) => {
    if (valor > 0) {
      const mov = crearMovimiento({
        cuenta,
        tipo: TIPOS.GANADO,
        cantidad: valor,
        concepto: tarea.nombre,
        categoria: tarea.categoria || 'otros',
        fecha,
        refTipo: 'tarea',
        refId: mId,
        actor,
        provisional: !sola,
      });
      s.set('ledger', mov.id, mov);
      movId = mov.id;
    }
    s.set('marcas', mId, {
      id: mId,
      tareaId,
      fecha,
      nombre: tarea.nombre,
      tipo: tarea.tipo,
      categoria: tarea.categoria || 'otros',
      moneda,
      estado: sola ? 'aprobada' : 'pendiente',
      opcionId: opcionId || null,
      opcionEtiqueta: opcionId ? (tarea.opciones || []).find((o) => o.id === opcionId)?.etiqueta || null : null,
      valor,
      fotos: (fotos || []).slice(0, 2),
      movimientoId: movId,
      movimientoExtraId: null,
      marcadaEn: Date.now(),
      resueltaEn: sola ? Date.now() : null,
      resueltaPor: sola ? 'auto' : null,
      motivo: null,
      autoAprobada: false,
    });

    if (tarea.tipo === 'habito') extra = premiarDiaCompleto(s, fecha);
  });

  return { ok: true, marcaId: mId, valor, moneda, extra, autoAprobada: sola };
}

/**
 * Si con esta marca quedan todos los hábitos del día hechos, se abona el
 * premio de día completo. Idempotente: se guarda el abono con un id derivado
 * de la fecha y no se repite.
 */
function premiarDiaCompleto(store, fecha) {
  const estado = store.estado;
  if (!resumenDia(estado, fecha).completo) return 0;
  const premio = Number(leerParametro(estado, 'estrellasDiaCompleto', 3));
  if (premio <= 0) return 0;
  const yaHay = Object.values(estado.ledger || {}).some(
    (m) => m.refTipo === 'habitos-dia' && m.refId === fecha && !m.anuladoPor,
  );
  if (yaHay) return 0;
  const mov = crearMovimiento({
    cuenta: 'estrellas',
    tipo: TIPOS.GANADO,
    cantidad: premio,
    concepto: 'Día completo de cuidado',
    categoria: 'salud',
    fecha,
    refTipo: 'habitos-dia',
    refId: fecha,
    actor: 'sistema',
  });
  store.set('ledger', mov.id, mov);
  return premio;
}

/** Nil deshace una marca que aún está pendiente (se equivocó). */
export function desmarcarTarea(store, marcaId) {
  const marca = store.obtener('marcas', marcaId);
  if (!marca) return { ok: false, razon: 'No existe esa marca.' };
  if (marca.estado !== 'pendiente') {
    return { ok: false, razon: 'Ya está resuelta: habla con papá si hay un error.' };
  }
  store.lote((s) => {
    if (marca.movimientoId) s.remove('ledger', marca.movimientoId);
    if (marca.movimientoExtraId) s.remove('ledger', marca.movimientoExtraId);
    s.remove('marcas', marcaId);
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Resolver (padre)                                                    */
/* ------------------------------------------------------------------ */

export function aprobarMarca(store, marcaId, { auto = false, nota = '' } = {}) {
  const marca = store.obtener('marcas', marcaId);
  if (!marca || marca.estado !== 'pendiente') return false;
  store.lote((s) => {
    if (marca.movimientoId) s.patch('ledger', marca.movimientoId, { provisional: false });

    // Las obligatorias no dan créditos nunca, pero sí estrellas: son higiene y
    // cuidado, y esa es justo la moneda del cuidado.
    let extraId = marca.movimientoExtraId || null;
    if (marca.tipo === 'obligatoria' && !extraId) {
      // Cada obligatoria puede valer sus propias estrellas (v3.6: «Llamar a
      // alguien de la familia» vale 2); si no lo dice, el valor general.
      const propia = Number(s.estado.tareas?.[marca.tareaId]?.estrellas);
      const premio = Number.isFinite(propia) && propia >= 0
        ? propia : Number(leerParametro(s.estado, 'estrellasPorObligatoria', 1));
      if (premio > 0) {
        const mov = crearMovimiento({
          cuenta: 'estrellas',
          tipo: TIPOS.GANADO,
          cantidad: premio,
          concepto: marca.nombre,
          categoria: 'salud',
          fecha: marca.fecha,
          refTipo: 'tarea',
          refId: marcaId,
          actor: auto ? 'sistema' : 'padre',
        });
        s.set('ledger', mov.id, mov);
        extraId = mov.id;
      }
    }

    s.patch('marcas', marcaId, {
      estado: 'aprobada',
      resueltaEn: Date.now(),
      resueltaPor: auto ? 'auto' : 'padre',
      autoAprobada: auto,
      movimientoExtraId: extraId,
      // La nota del padre: aprobar deja de ser un sello de goma y pasa a ser
      // alguien diciéndote algo. Es opcional, y Nil la ve en su lista.
      nota: String(nota || '').trim().slice(0, 140) || null,
    });
  });
  return true;
}

/**
 * Vetar: el crédito se revierte con un movimiento de anulación.
 * Funciona igual si la tarea ya estaba aprobada o auto-aprobada.
 */
export function vetarMarca(store, marcaId, motivo = '') {
  const marca = store.obtener('marcas', marcaId);
  if (!marca || marca.estado === 'vetada') return false;
  const aRevertir = [marca.movimientoId, marca.movimientoExtraId]
    .filter(Boolean)
    .map((id) => store.obtener('ledger', id))
    .filter(Boolean);
  store.lote((s) => {
    for (const original of aRevertir) {
      if (original.anuladoPor) continue;
      const rev = crearMovimiento({
        cuenta: original.cuenta,
        tipo: TIPOS.ANULACION,
        cantidad: -original.cantidad,
        concepto: `Vetada: ${original.concepto}`,
        categoria: original.categoria,
        fecha: original.fecha,
        refTipo: 'tarea',
        refId: marcaId,
        actor: 'padre',
        anula: original.id,
      });
      s.set('ledger', rev.id, rev);
      s.patch('ledger', original.id, { anuladoPor: rev.id, provisional: false });
    }
    s.patch('marcas', marcaId, {
      estado: 'vetada',
      resueltaEn: Date.now(),
      resueltaPor: 'padre',
      motivo: String(motivo || ''),
    });
  });
  return true;
}

/**
 * Obligatorias: el padre dice si se cumplió. No mueve créditos nunca, pero
 * cuenta en el cumplimiento y da estrellas si se cumplió.
 */
export function evaluarObligatoria(store, marcaId, cumplida, motivo = '') {
  const marca = store.obtener('marcas', marcaId);
  if (!marca) return false;
  if (cumplida) {
    if (marca.estado === 'pendiente') aprobarMarca(store, marcaId);
    else store.patch('marcas', marcaId, { estado: 'aprobada', resueltaEn: Date.now(), resueltaPor: 'padre' });
    if (motivo) store.patch('marcas', marcaId, { motivo: String(motivo) });
    return true;
  }
  store.lote((s) => {
    // Si ya se habían abonado estrellas, se anulan igual que cualquier crédito.
    if (marca.movimientoExtraId) {
      const original = s.obtener('ledger', marca.movimientoExtraId);
      if (original && !original.anuladoPor) {
        const rev = crearMovimiento({
          cuenta: original.cuenta,
          tipo: TIPOS.ANULACION,
          cantidad: -original.cantidad,
          concepto: `No cumplida: ${original.concepto}`,
          categoria: original.categoria,
          fecha: original.fecha,
          refTipo: 'tarea',
          refId: marcaId,
          actor: 'padre',
          anula: original.id,
        });
        s.set('ledger', rev.id, rev);
        s.patch('ledger', original.id, { anuladoPor: rev.id });
      }
    }
    s.patch('marcas', marcaId, {
      estado: 'nocumplida',
      resueltaEn: Date.now(),
      resueltaPor: 'padre',
      motivo: String(motivo || ''),
    });
  });
  return true;
}

/**
 * Auto-aprobación: si el padre no actúa en N horas, la marca se da por buena.
 * Se ejecuta al abrir la app y cada pocos minutos; es idempotente.
 */
export function procesarAutoAprobaciones(store, ahora = Date.now()) {
  const estado = store.estado;
  const horas = Number(estado.ajustes?.autoAprobacionHoras?.valor ?? 12);
  if (!Number.isFinite(horas) || horas <= 0) return 0;
  const limite = horas * 3600 * 1000;
  let n = 0;
  store.lote(() => {
    for (const marca of Object.values(estado.marcas || {})) {
      if (marca.estado !== 'pendiente') continue;
      if (ahora - (marca.marcadaEn || 0) < limite) continue;
      if (aprobarMarca(store, marca.id, { auto: true })) n++;
    }
  });
  return n;
}

/** Marcas que esperan al padre, más antiguas primero. */
export function pendientesDeAprobacion(estado) {
  return Object.values(estado.marcas || {})
    .filter((m) => m.estado === 'pendiente')
    .sort((a, b) => (a.marcadaEn || 0) - (b.marcadaEn || 0));
}

/* ------------------------------------------------------------------ */
/* Cumplimiento y racha                                                */
/* ------------------------------------------------------------------ */

function cuentaComoCumplida(marca) {
  return marca && (marca.estado === 'aprobada' || marca.estado === 'pendiente');
}

export function cumplimientoDia(estado, fecha) {
  const tareas = tareasDelDia(estado, fecha);
  const esperadas = tareas.length;
  let cumplidas = 0;
  for (const t of tareas) {
    if (cuentaComoCumplida(marcaDe(estado, fecha, t.id))) cumplidas++;
  }
  return {
    fecha,
    esperadas,
    cumplidas,
    pct: esperadas === 0 ? 100 : Math.round((cumplidas / esperadas) * 100),
  };
}

/**
 * Cumplimiento de la semana hasta la fecha indicada (incluida).
 * Alimenta la racha semanal.
 */
export function cumplimientoSemana(estado, weekId, hastaFecha) {
  const dias = weekDays(weekId).filter((d) => !hastaFecha || d <= hastaFecha);
  let esperadas = 0;
  let cumplidas = 0;
  const porDia = [];
  for (const d of dias) {
    const c = cumplimientoDia(estado, d);
    esperadas += c.esperadas;
    cumplidas += c.cumplidas;
    porDia.push(c);
  }
  return {
    weekId,
    esperadas,
    cumplidas,
    porDia,
    pct: esperadas === 0 ? 0 : Math.round((cumplidas / esperadas) * 100),
  };
}

/** Racha actual almacenada en ajustes (la actualiza el cierre de semana). */
export function rachaActual(estado) {
  return Number(estado.ajustes?.racha?.valor ?? 0);
}

export function umbralRacha(estado) {
  return Number(estado.ajustes?.umbralRacha?.valor ?? 70);
}

/* ------------------------------------------------------------------ */
/* Tareas puntuales (las crea el padre)                                */
/* ------------------------------------------------------------------ */

export function crearTareaPuntual(store, { nombre, valor, fecha, icono = '⭐' }) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return { ok: false, razon: 'Ponle un nombre a la tarea.' };
  const v = creditos(valor);
  if (v < 0) return { ok: false, razon: 'El valor no puede ser negativo.' };
  const id = uid('tp');
  store.set('tareas', id, {
    id,
    nombre: limpio,
    tipo: 'puntual',
    valor: v,
    categoria: 'puntual',
    fecha: fecha || toDateKey(new Date()),
    icono,
    orden: 200,
    activa: true,
  });
  return { ok: true, id };
}

/** Ajuste manual del padre. El motivo es obligatorio y lo ve Nil. */
export function ajusteManual(store, { cantidad, motivo, fecha, cuenta = 'semana' }) {
  const texto = String(motivo || '').trim();
  if (!texto) return { ok: false, razon: 'El motivo es obligatorio: Nil tiene que saber por qué.' };
  const v = creditos(cantidad);
  if (v === 0) return { ok: false, razon: 'La cantidad no puede ser 0.' };
  const mov = crearMovimiento({
    cuenta,
    tipo: TIPOS.AJUSTE,
    cantidad: v,
    concepto: texto,
    categoria: 'ajuste',
    fecha,
    actor: 'padre',
  });
  store.set('ledger', mov.id, mov);
  return { ok: true, movimientoId: mov.id, cantidad: v };
}

/** Semana a la que pertenece una fecha (reexportado por comodidad). */
export { weekIdOf };
