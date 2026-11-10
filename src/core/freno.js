/**
 * EL FRENO — que el dinero nunca gane más que el trabajo.
 *
 * Todo lo que la hucha "gana sola" (interés de la cuenta, interés de los
 * depósitos al vencer, ganancias del fondo al sacarlas) pasa por aquí antes de
 * entrar en la hucha. En los últimos 7 días, esas ganancias no pueden superar
 * un porcentaje (`frenoPct`, 20 % de fábrica) de lo que Nil ha ganado con sus
 * tareas en esos mismos 7 días.
 *
 * Lo que no cabe NO se pierde: queda "aplazado" y se paga en cuanto vuelve a
 * haber hueco (cuando Nil vuelve a trabajar). Así un depósito firmado siempre
 * cobra lo prometido, solo que quizá un poco más tarde.
 *
 * Con `frenoActivo` apagado, todo se paga al momento (como antes de la v3.7).
 */

import { addDays, creditos } from './util.js';
import { crearMovimiento, TIPOS } from './ledger.js';
import { leerParametro } from './tokenomics.js';

/** Tipos de referencia que cuentan como "ganancia del ahorro". */
export const REF_RENDIMIENTO = ['interes', 'rendimiento'];

function enVentana(fecha, hasta) {
  return fecha && fecha > addDays(hasta, -7) && fecha <= hasta;
}

/** Créditos ganados con tareas en los 7 días que acaban en `fecha`. */
export function ganadoConTareas(estado, fecha) {
  let total = 0;
  for (const m of Object.values(estado.ledger || {})) {
    if (m.cuenta !== 'semana' || m.tipo !== TIPOS.GANADO || m.anuladoPor) continue;
    if (m.categoria === 'staking' || m.categoria === 'ajuste') continue;
    if (!enVentana(m.fecha, fecha)) continue;
    total += Number(m.cantidad) || 0;
  }
  return total;
}

/** Ganancias del ahorro ya pagadas en los 7 días que acaban en `fecha`. */
export function rendimientoPagado(estado, fecha) {
  let total = 0;
  for (const m of Object.values(estado.ledger || {})) {
    if (m.cuenta !== 'hucha' || m.tipo !== TIPOS.GANADO || m.anuladoPor) continue;
    if (!REF_RENDIMIENTO.includes(m.refTipo)) continue;
    if (!enVentana(m.fecha, fecha)) continue;
    total += Number(m.cantidad) || 0;
  }
  return total;
}

export function frenoActivo(estado) {
  return Boolean(leerParametro(estado, 'frenoActivo', false));
}

/** El techo de los 7 días y lo que queda libre de él. */
export function estadoFreno(estado, fecha) {
  const pct = Number(leerParametro(estado, 'frenoPct', 20)) || 0;
  const base = ganadoConTareas(estado, fecha);
  const techo = Math.floor(base * pct / 100);
  const pagado = rendimientoPagado(estado, fecha);
  return {
    activo: frenoActivo(estado),
    pct,
    base,
    techo,
    pagado,
    hueco: Math.max(0, techo - pagado),
    aplazado: creditos(leerParametro(estado, 'rendimientoAplazado', 0)),
  };
}

function apunte(store, { cantidad, concepto, fecha, refTipo, refId }) {
  const mov = crearMovimiento({
    cuenta: 'hucha',
    tipo: TIPOS.GANADO,
    cantidad: creditos(cantidad),
    concepto,
    categoria: 'staking',
    fecha,
    refTipo,
    refId,
    actor: 'sistema',
  });
  store.set('ledger', mov.id, mov);
  return mov.id;
}

/**
 * Paga una ganancia del ahorro respetando el freno. Lo que no cabe se aplaza.
 * Devuelve { pagado, aplazado }. Se debe llamar dentro de un `store.lote`
 * o fuera: funciona en los dos casos.
 */
export function pagarRendimiento(store, { cantidad, concepto, fecha, refTipo = 'rendimiento', refId = null }) {
  const c = creditos(cantidad);
  if (c <= 0) return { pagado: 0, aplazado: 0 };
  if (!frenoActivo(store.estado)) {
    apunte(store, { cantidad: c, concepto, fecha, refTipo, refId });
    return { pagado: c, aplazado: 0 };
  }
  const { hueco, aplazado } = estadoFreno(store.estado, fecha);
  const paga = Math.min(c, hueco);
  const resto = c - paga;
  if (paga > 0) apunte(store, { cantidad: paga, concepto, fecha, refTipo, refId });
  if (resto > 0) store.fijarAjuste('rendimientoAplazado', aplazado + resto);
  return { pagado: paga, aplazado: resto };
}

/**
 * Paga lo aplazado en cuanto haya hueco. Idempotente: si no hay hueco o no
 * hay nada pendiente, no hace nada.
 */
export function pagarAplazado(store, { fecha }) {
  const e = estadoFreno(store.estado, fecha);
  if (e.aplazado <= 0) return 0;
  // Si el padre apaga el freno, lo pendiente se paga entero.
  const paga = e.activo ? Math.min(e.aplazado, e.hueco) : e.aplazado;
  if (paga <= 0) return 0;
  store.lote((s) => {
    apunte(s, { cantidad: paga, concepto: 'Intereses que esperaban al freno', fecha, refTipo: 'rendimiento', refId: 'aplazado' });
    s.fijarAjuste('rendimientoAplazado', e.aplazado - paga);
  });
  return paga;
}
