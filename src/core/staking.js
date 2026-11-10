/**
 * STAKINGS — cuatro formas de que el ahorro trabaje.
 *
 * Todos funcionan sobre la HUCHA y solo sobre la hucha: el saldo semanal es
 * para el día a día y no se puede bloquear. Bloquear créditos es un movimiento
 * normal del ledger (negativo en la hucha), y liquidar es otro movimiento
 * positivo. Por eso el saldo de la hucha que se ve en pantalla es siempre el
 * saldo LIBRE, sin trucos ni restas aparte.
 *
 *   1. Depósito a plazo  — bloqueas X días, cobras un interés fijo al vencer.
 *   2. Interés de la hucha — abono automático sobre el saldo libre.
 *   3. Apuesta de racha  — apuestas a mantener la racha N semanas.
 *   4. Staking de sueño  — cobras un interés por cada noche cumplida.
 *
 * El único que puede salir mal es la apuesta de racha, y tiene tope máximo
 * configurable para que una mala semana no se lleve meses de ahorro.
 */

import { uid, toDateKey, addDays, creditos, weekIdOf } from './util.js';
import { crearMovimiento, TIPOS, saldoHucha } from './ledger.js';
import { leerParametro } from './tokenomics.js';
import {
  bancoV37, bancoPausado, pctVariable, rangoPlazo, capitalEnDepositos, procesarFondo,
} from './banco.js';
import { pagarRendimiento, pagarAplazado, frenoActivo } from './freno.js';

export const TIPOS_STAKING = {
  deposito: { id: 'deposito', nombre: 'Depósito a plazo', icono: '🔒', riesgo: 'ninguno' },
  fondo: { id: 'fondo', nombre: 'Fondo variable', icono: '📈', riesgo: 'medio' },
  apuesta: { id: 'apuesta', nombre: 'Apuesta de racha', icono: '🎲', riesgo: 'alto' },
  sueno: { id: 'sueno', nombre: 'Compromiso de sueño', icono: '🌙', riesgo: 'ninguno' },
};

export const PLAZOS = [7, 14, 30];

export function stakings(estado) {
  return Object.values(estado.stakings || {}).sort((a, b) => (b.abiertoEn || 0) - (a.abiertoEn || 0));
}

export function stakingsActivos(estado) {
  return stakings(estado).filter((s) => s.estado === 'activo');
}

/** Créditos bloqueados ahora mismo (ya restados de la hucha). */
export function capitalBloqueado(estado) {
  return stakingsActivos(estado).reduce((s, x) => s + x.capital, 0);
}

/** Hucha libre + bloqueado: lo que Nil tiene en total ahorrado. */
export function patrimonio(estado) {
  return saldoHucha(estado) + capitalBloqueado(estado);
}

function bloquear(store, { capital, concepto, refId, fecha }) {
  const mov = crearMovimiento({
    cuenta: 'hucha',
    tipo: TIPOS.GASTADO,
    cantidad: -creditos(capital),
    concepto,
    categoria: 'staking',
    fecha,
    refTipo: 'staking',
    refId,
    actor: 'nil',
  });
  store.set('ledger', mov.id, mov);
  return mov.id;
}

function devolver(store, { cantidad, concepto, refId, fecha }) {
  const mov = crearMovimiento({
    cuenta: 'hucha',
    tipo: TIPOS.GANADO,
    cantidad: creditos(cantidad),
    concepto,
    categoria: 'staking',
    fecha,
    refTipo: 'staking',
    refId,
    actor: 'sistema',
  });
  store.set('ledger', mov.id, mov);
  return mov.id;
}

/* ------------------------------------------------------------------ */
/* 1. Depósito a plazo                                                 */
/* ------------------------------------------------------------------ */

export function porcentajeDePlazo(estado, dias) {
  // v3.7: cualquier plazo del rango, con el interés en una recta.
  if (bancoV37(estado)) return pctVariable(estado, dias);
  const clave = { 7: 'deposito7Pct', 14: 'deposito14Pct', 30: 'deposito30Pct' }[dias];
  return Number(leerParametro(estado, clave, 0)) || 0;
}

export function puedeAbrirDeposito(estado, { capital, dias, fecha }) {
  if (!leerParametro(estado, 'depositoActivo', true)) {
    return { ok: false, razon: 'Los depósitos están desactivados ahora mismo.' };
  }
  if (bancoPausado(estado)) return { ok: false, razon: 'Papá ha pausado la hucha un momento.' };
  if (bancoV37(estado)) {
    const { min, max } = rangoPlazo(estado);
    const d = Number(dias);
    if (!Number.isInteger(d) || d < min || d > max) return { ok: false, razon: `El plazo tiene que ser de ${min} a ${max} días.` };
  } else if (!PLAZOS.includes(Number(dias))) return { ok: false, razon: 'Ese plazo no existe.' };
  const minimo = Number(leerParametro(estado, 'depositoMinimo', 20));
  const c = creditos(capital);
  if (c < minimo) return { ok: false, razon: `El depósito mínimo es de ${minimo} créditos.` };
  if (c > saldoHucha(estado)) return { ok: false, razon: 'No tienes tanto en la hucha libre.' };
  const tope = Number(leerParametro(estado, 'depositoMaximo', 0)) || 0;
  const ya = capitalEnDepositos(estado);
  if (tope > 0 && ya + c > tope) {
    return { ok: false, razon: `En depósitos caben como mucho ${tope} créditos a la vez. Te quedan ${Math.max(0, tope - ya)}.` };
  }
  return { ok: true };
}

export function abrirDeposito(store, { capital, dias, fecha = toDateKey(new Date()) }) {
  const estado = store.estado;
  const check = puedeAbrirDeposito(estado, { capital, dias, fecha });
  if (!check.ok) return check;

  const c = creditos(capital);
  const pct = porcentajeDePlazo(estado, dias);
  const id = uid('stk');
  const vencimiento = addDays(fecha, Number(dias));

  store.lote((s) => {
    const movId = bloquear(store, { capital: c, concepto: `Depósito a ${dias} días`, refId: id, fecha });
    s.set('stakings', id, {
      id,
      tipo: 'deposito',
      estado: 'activo',
      capital: c,
      dias: Number(dias),
      pct,
      interesPrevisto: creditos(c * pct / 100),
      fechaInicio: fecha,
      fechaVencimiento: vencimiento,
      abiertoEn: Date.now(),
      movimientoBloqueoId: movId,
      movimientoLiquidacionId: null,
      interesPagado: 0,
      cerradoEn: null,
    });
  });
  return { ok: true, id, vencimiento, interesPrevisto: creditos(c * pct / 100) };
}

/** Romper un depósito antes de tiempo: vuelve el capital, se pierde el interés. */
export function romperDeposito(store, id, { fecha = toDateKey(new Date()) } = {}) {
  const st = store.obtener('stakings', id);
  if (!st || st.estado !== 'activo' || st.tipo !== 'deposito') {
    return { ok: false, razon: 'Ese depósito ya no está abierto.' };
  }
  const devuelveCapital = leerParametro(store.estado, 'depositoRescateDevuelveCapital', true);
  store.lote((s) => {
    const movId = devuelveCapital
      ? devolver(store, { cantidad: st.capital, concepto: 'Depósito roto antes de tiempo', refId: id, fecha })
      : null;
    s.patch('stakings', id, {
      estado: 'roto',
      cerradoEn: Date.now(),
      movimientoLiquidacionId: movId,
      interesPagado: 0,
    });
  });
  return { ok: true, devuelto: devuelveCapital ? st.capital : 0 };
}

/* ------------------------------------------------------------------ */
/* 2. Interés automático de la hucha                                   */
/* ------------------------------------------------------------------ */

/**
 * Abona el interés de la hucha si toca. Idempotente: se guarda el último
 * periodo abonado, así que llamarlo diez veces el mismo día no paga diez veces.
 */
export function abonarInteresHucha(store, { fecha = toDateKey(new Date()) } = {}) {
  const estado = store.estado;
  const pct = Number(leerParametro(estado, 'interesHuchaPct', 0));
  if (!pct || pct <= 0) return { ok: false, razon: 'El interés está a 0.' };

  const periodo = leerParametro(estado, 'interesHuchaPeriodo', 'semana');
  const clavePeriodo = periodo === 'dia' ? fecha : weekIdOf(fecha);
  const ultimo = leerParametro(estado, 'ultimoInteresHucha', null);
  if (ultimo === clavePeriodo) return { ok: false, razon: 'Ya se abonó este periodo.' };
  if (bancoPausado(estado)) {
    // En pausa no se genera interés, y ese periodo no se recupera después.
    store.fijarAjuste('ultimoInteresHucha', clavePeriodo);
    return { ok: false, razon: 'La hucha está en pausa.' };
  }

  const saldo = saldoHucha(estado);
  if (saldo <= 0) {
    store.fijarAjuste('ultimoInteresHucha', clavePeriodo);
    return { ok: false, razon: 'La hucha está vacía.' };
  }

  let interes = Math.floor(saldo * pct / 100);
  const tope = Number(leerParametro(estado, 'interesHuchaTope', 0));
  if (tope > 0) interes = Math.min(interes, tope);
  if (interes < 1) {
    store.fijarAjuste('ultimoInteresHucha', clavePeriodo);
    return { ok: false, razon: 'Todavía no llega ni a 1 crédito de interés.' };
  }

  let r;
  store.lote((s) => {
    // Pasa por el freno (freno.js): si no cabe, se aplaza; nunca se pierde.
    r = pagarRendimiento(s, {
      cantidad: interes, concepto: `Interés de la hucha (${pct}%)`, fecha, refTipo: 'interes', refId: clavePeriodo,
    });
    s.fijarAjuste('ultimoInteresHucha', clavePeriodo);
  });
  return { ok: true, interes: r.pagado, aplazado: r.aplazado };
}

/* ------------------------------------------------------------------ */
/* 3. Apuesta de racha                                                 */
/* ------------------------------------------------------------------ */

export function puedeApostar(estado, { capital }) {
  if (!leerParametro(estado, 'apuestaActiva', true)) {
    return { ok: false, razon: 'Las apuestas están desactivadas ahora mismo.' };
  }
  const c = creditos(capital);
  const max = Number(leerParametro(estado, 'apuestaMaxima', 60));
  if (c < 1) return { ok: false, razon: 'Apuesta algo.' };
  if (c > max) return { ok: false, razon: `La apuesta máxima es de ${max} créditos.` };
  if (c > saldoHucha(estado)) return { ok: false, razon: 'No tienes tanto en la hucha libre.' };
  if (stakingsActivos(estado).some((s) => s.tipo === 'apuesta')) {
    return { ok: false, razon: 'Ya tienes una apuesta en marcha.' };
  }
  return { ok: true };
}

export function abrirApuesta(store, { capital, semanas, fecha = toDateKey(new Date()) }) {
  const estado = store.estado;
  const check = puedeApostar(estado, { capital });
  if (!check.ok) return check;
  const maxSemanas = Number(leerParametro(estado, 'apuestaSemanasMax', 4));
  const n = Math.max(1, Math.min(maxSemanas, Math.round(Number(semanas) || 1)));
  const c = creditos(capital);
  const multiplicador = Number(leerParametro(estado, 'apuestaMultiplicador', 1.6));
  const penalizacionPct = Number(leerParametro(estado, 'apuestaPenalizacionPct', 50));
  const id = uid('stk');

  store.lote((s) => {
    const movId = bloquear(store, { capital: c, concepto: `Apuesta de racha (${n} semanas)`, refId: id, fecha });
    s.set('stakings', id, {
      id,
      tipo: 'apuesta',
      estado: 'activo',
      capital: c,
      semanas: n,
      semanasSuperadas: 0,
      multiplicador,
      penalizacionPct,
      premioPrevisto: creditos(c * multiplicador),
      fechaInicio: fecha,
      abiertoEn: Date.now(),
      movimientoBloqueoId: movId,
      movimientoLiquidacionId: null,
      cerradoEn: null,
    });
  });
  return { ok: true, id, premioPrevisto: creditos(c * multiplicador) };
}

/**
 * Se llama justo después de cerrar una semana. `subioRacha` decide si la
 * apuesta avanza o se rompe.
 */
export function resolverApuestasTrasCierre(store, { subioRacha, fecha }) {
  const resultados = [];
  for (const st of stakingsActivos(store.estado).filter((s) => s.tipo === 'apuesta')) {
    if (!subioRacha) {
      const perdido = Math.round(st.capital * (st.penalizacionPct / 100));
      const devuelto = st.capital - perdido;
      store.lote((s) => {
        const movId = devuelto > 0
          ? devolver(store, { cantidad: devuelto, concepto: 'Apuesta perdida: parte devuelta', refId: st.id, fecha })
          : null;
        s.patch('stakings', st.id, {
          estado: 'roto', cerradoEn: Date.now(), movimientoLiquidacionId: movId, perdido,
        });
      });
      resultados.push({ id: st.id, resultado: 'perdida', perdido, devuelto });
      continue;
    }

    const superadas = (st.semanasSuperadas || 0) + 1;
    if (superadas < st.semanas) {
      store.patch('stakings', st.id, { semanasSuperadas: superadas });
      resultados.push({ id: st.id, resultado: 'avanza', superadas, total: st.semanas });
      continue;
    }

    const premio = creditos(st.capital * st.multiplicador);
    store.lote((s) => {
      const movId = devolver(store, { cantidad: premio, concepto: `Apuesta ganada (x${st.multiplicador})`, refId: st.id, fecha });
      s.patch('stakings', st.id, {
        estado: 'cobrado',
        semanasSuperadas: superadas,
        cerradoEn: Date.now(),
        movimientoLiquidacionId: movId,
        interesPagado: premio - st.capital,
      });
    });
    resultados.push({ id: st.id, resultado: 'ganada', premio });
  }
  return resultados;
}

/* ------------------------------------------------------------------ */
/* 4. Staking de sueño                                                 */
/* ------------------------------------------------------------------ */

export function puedeAbrirStakingSueno(estado, { capital }) {
  if (!leerParametro(estado, 'stakingSuenoActivo', true)) {
    return { ok: false, razon: 'El compromiso de sueño está desactivado.' };
  }
  const minimo = Number(leerParametro(estado, 'stakingSuenoMinimo', 15));
  const c = creditos(capital);
  if (c < minimo) return { ok: false, razon: `El mínimo es de ${minimo} créditos.` };
  if (c > saldoHucha(estado)) return { ok: false, razon: 'No tienes tanto en la hucha libre.' };
  if (stakingsActivos(estado).some((s) => s.tipo === 'sueno')) {
    return { ok: false, razon: 'Ya tienes un compromiso de sueño en marcha.' };
  }
  return { ok: true };
}

export function abrirStakingSueno(store, { capital, fecha = toDateKey(new Date()) }) {
  const estado = store.estado;
  const check = puedeAbrirStakingSueno(estado, { capital });
  if (!check.ok) return check;
  const noches = Number(leerParametro(estado, 'stakingSuenoNoches', 7));
  const pctNoche = Number(leerParametro(estado, 'stakingSuenoPctNoche', 1.5));
  const c = creditos(capital);
  const id = uid('stk');

  store.lote((s) => {
    const movId = bloquear(store, { capital: c, concepto: `Compromiso de sueño (${noches} noches)`, refId: id, fecha });
    s.set('stakings', id, {
      id,
      tipo: 'sueno',
      estado: 'activo',
      capital: c,
      noches,
      nochesCumplidas: 0,
      nochesContadas: 0,
      pctNoche,
      interesMaximo: creditos(c * pctNoche / 100 * noches),
      fechaInicio: fecha,
      fechaVencimiento: addDays(fecha, noches),
      abiertoEn: Date.now(),
      movimientoBloqueoId: movId,
      movimientoLiquidacionId: null,
      cerradoEn: null,
    });
  });
  return { ok: true, id, noches, interesMaximo: creditos(c * pctNoche / 100 * noches) };
}

/** Se llama cada vez que se apunta una noche. Solo cuenta noches nuevas. */
export function registrarNocheEnStaking(store, { fecha, cumplida }) {
  for (const st of stakingsActivos(store.estado).filter((s) => s.tipo === 'sueno')) {
    if (fecha < st.fechaInicio || fecha > st.fechaVencimiento) continue;
    const yaContadas = st.fechasContadas || [];
    if (yaContadas.includes(fecha)) continue;
    store.patch('stakings', st.id, {
      fechasContadas: [...yaContadas, fecha],
      nochesContadas: (st.nochesContadas || 0) + 1,
      nochesCumplidas: (st.nochesCumplidas || 0) + (cumplida ? 1 : 0),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Proceso periódico                                                   */
/* ------------------------------------------------------------------ */

/**
 * Liquida lo que haya vencido y abona el interés de la hucha si toca.
 * Idempotente: se puede llamar al abrir la app y cada minuto sin efectos raros.
 */
export function procesarStakings(store, { fecha = toDateKey(new Date()) } = {}) {
  const eventos = [];

  for (const st of stakingsActivos(store.estado)) {
    if (st.tipo === 'deposito' && fecha >= st.fechaVencimiento) {
      const interes = creditos(st.capital * st.pct / 100);
      store.lote((s) => {
        let movId;
        if (frenoActivo(s.estado)) {
          // v3.7: el capital vuelve entero; el interés pasa por el freno.
          movId = devolver(store, { cantidad: st.capital, concepto: `Depósito a ${st.dias} días: vuelve lo que pusiste`, refId: st.id, fecha });
          pagarRendimiento(s, { cantidad: interes, concepto: `Interés del depósito a ${st.dias} días (+${interes})`, fecha, refId: st.id });
        } else movId = devolver(store, {
          cantidad: st.capital + interes,
          concepto: `Depósito a ${st.dias} días vencido (+${interes})`,
          refId: st.id,
          fecha,
        });
        s.patch('stakings', st.id, {
          estado: 'cobrado', cerradoEn: Date.now(), movimientoLiquidacionId: movId, interesPagado: interes,
        });
      });
      eventos.push({ tipo: 'deposito-vencido', interes, capital: st.capital });
    }

    if (st.tipo === 'sueno' && fecha > st.fechaVencimiento) {
      const interes = creditos(st.capital * st.pctNoche / 100 * (st.nochesCumplidas || 0));
      store.lote((s) => {
        const movId = devolver(store, {
          cantidad: st.capital + interes,
          concepto: `Compromiso de sueño: ${st.nochesCumplidas || 0}/${st.noches} noches (+${interes})`,
          refId: st.id,
          fecha,
        });
        s.patch('stakings', st.id, {
          estado: 'cobrado', cerradoEn: Date.now(), movimientoLiquidacionId: movId, interesPagado: interes,
        });
      });
      eventos.push({ tipo: 'sueno-vencido', interes, noches: st.nochesCumplidas || 0 });
    }
  }

  for (const ev of procesarFondo(store, { fecha })) eventos.push(ev);

  // Primero lo que esperaba al freno, después el interés nuevo.
  const aplazado = pagarAplazado(store, { fecha });
  if (aplazado > 0) eventos.push({ tipo: 'aplazado', interes: aplazado });

  const int = abonarInteresHucha(store, { fecha });
  if (int.ok && int.interes > 0) eventos.push({ tipo: 'interes-hucha', interes: int.interes });

  return eventos;
}

/** Texto corto del estado de un staking, para la interfaz. */
export function resumenStaking(estado, st, fecha) {
  if (st.tipo === 'fondo') {
    const dif = (st.capital || 0) - (st.aportado || 0);
    if (st.estado !== 'activo') return `Cerrado${st.interesPagado > 0 ? `: +${st.interesPagado} de ganancia` : ''}`;
    const ultima = (st.historial || []).slice(-1)[0];
    return `Pusiste ${st.aportado} · vale ${st.capital} (${dif >= 0 ? '+' : ''}${dif})${ultima ? ` · última semana ${ultima.pct >= 0 ? '+' : ''}${ultima.pct}%` : ' · se moverá el próximo lunes'}`;
  }
  if (st.tipo === 'deposito') {
    const dias = Math.max(0, Math.ceil((new Date(`${st.fechaVencimiento}T00:00:00`) - new Date(`${fecha}T00:00:00`)) / 86400000));
    if (st.estado === 'activo') return `Vence en ${dias} día${dias === 1 ? '' : 's'} · +${creditos(st.capital * st.pct / 100)} de interés`;
    if (st.estado === 'roto') return 'Roto antes de tiempo: se perdió el interés';
    return `Cobrado: +${st.interesPagado || 0} de interés`;
  }
  if (st.tipo === 'apuesta') {
    if (st.estado === 'activo') return `${st.semanasSuperadas || 0} de ${st.semanas} semanas · premio ${st.premioPrevisto}`;
    if (st.estado === 'roto') return `Perdida: se fueron ${st.perdido || 0} créditos`;
    return `Ganada: +${st.interesPagado || 0} créditos`;
  }
  if (st.estado === 'activo') return `${st.nochesCumplidas || 0} de ${st.noches} noches cumplidas`;
  return `Cerrado: ${st.nochesCumplidas || 0}/${st.noches} noches · +${st.interesPagado || 0}`;
}
