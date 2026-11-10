/**
 * LEDGER — fuente única de verdad de toda la economía.
 *
 * Principio de arquitectura nº1 del encargo: ningún saldo, ningún gráfico y
 * ningún informe calcula créditos por su cuenta. TODO se deriva de esta lista
 * cronológica de movimientos. Si dos pantallas muestran números distintos es
 * porque una de ellas no ha usado este módulo: eso es un bug de diseño.
 *
 * Cuentas (monedas):
 *   'semana'    → créditos para gastar. Desde la v3.5 el saldo es continuo (no se
 *                 vacía al cerrar la semana) salvo que se encienda el cierre semanal
 *                 (lo que sobra cae a la hucha)
 *   'hucha'     → ahorro persistente de créditos, nunca se resetea; paga los
 *                 premios grandes y es de donde salen los stakings
 *   'estrellas' → segunda moneda, independiente. Se gana con higiene, buen
 *                 trato y cuidado, nunca con tareas de casa, y solo compra
 *                 regalos físicos. Nunca se mezcla con los créditos.
 *
 * Un movimiento nunca se borra ni se edita: para revertirlo se añade otro
 * movimiento que lo anula (`anula: idOriginal`). Así el histórico es auditable.
 */

import { uid, creditos, weekIdOf, toDateKey } from './util.js';

export const CUENTAS = ['semana', 'hucha', 'estrellas'];

export const MONEDAS = {
  semana: { id: 'semana', nombre: 'Créditos de la semana', corto: 'créditos', icono: '🟢', persistente: false },
  hucha: { id: 'hucha', nombre: 'Hucha', corto: 'hucha', icono: '🐷', persistente: true },
  estrellas: { id: 'estrellas', nombre: 'Estrellas', corto: 'estrellas', icono: '⭐', persistente: true },
};

export const TIPOS = {
  GANADO: 'ganado',        // tarea aprobada / provisional
  GASTADO: 'gastado',      // compra en la tienda
  AJUSTE: 'ajuste',        // bonus o multa manual del padre
  ANULACION: 'anulacion',  // reverso de un movimiento anterior (veto, compra denegada)
  TRASPASO: 'traspaso',    // cierre de semana: semana → hucha
  REINICIO: 'reinicio',    // reinicio completo
};

/**
 * Crea un movimiento. `cantidad` es un entero con signo:
 * positivo suma a la cuenta, negativo resta.
 */
export function crearMovimiento({
  cuenta = 'semana',
  tipo = TIPOS.GANADO,
  cantidad = 0,
  concepto = '',
  categoria = 'otros',
  fecha,
  refTipo = null,
  refId = null,
  actor = 'sistema',
  provisional = false,
  anula = null,
  ts = Date.now(),
  id = null,
}) {
  if (!CUENTAS.includes(cuenta)) {
    throw new Error(`Cuenta desconocida: ${cuenta}`);
  }
  return {
    id: id || uid('mov'),
    ts,
    fecha,
    cuenta,
    tipo,
    cantidad: creditos(cantidad),
    concepto: String(concepto || ''),
    categoria: String(categoria || 'otros'),
    refTipo,
    refId,
    actor,
    provisional: Boolean(provisional),
    anula,
    anuladoPor: null,
  };
}

/** Lista de movimientos ordenada cronológicamente. */
export function movimientos(estado) {
  return Object.values(estado.ledger || {}).sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
}

/**
 * Movimientos de una cuenta, opcionalmente filtrados por semana.
 * Acepta cualquier fecha de la semana, no solo el lunes: se normaliza aquí
 * para que nadie pueda equivocarse pasando "hoy" en vez del id de semana.
 */
export function movimientosDe(estado, cuenta, fechaODeSemana = null) {
  const weekId = fechaODeSemana ? weekIdOf(fechaODeSemana) : null;
  return movimientos(estado).filter((m) => {
    if (m.cuenta !== cuenta) return false;
    if (weekId && weekIdOf(m.fecha) !== weekId) return false;
    return true;
  });
}

/**
 * Tipo efectivo de un movimiento: una anulación cuenta como lo que anula.
 * Así "devolver una compra" resta de lo gastado en vez de sumar a lo ganado.
 */
function tipoEfectivo(estado, m) {
  if (m.tipo === TIPOS.ANULACION && m.anula) {
    const original = estado.ledger?.[m.anula];
    if (original) return original.tipo;
  }
  return m.tipo;
}

/**
 * Saldo semanal: suma de los movimientos de la cuenta 'semana' de esa semana.
 * Incluye los provisionales (tareas marcadas aún sin aprobar) porque así es
 * como Nil ve su saldo; si el padre veta, la anulación lo resta de forma natural.
 */
export function saldoSemana(estado, weekId) {
  return movimientosDe(estado, 'semana', weekId).reduce((s, m) => s + m.cantidad, 0);
}

/** Saldo de la hucha: histórico completo, nunca se filtra por semana. */
export function saldoHucha(estado) {
  return movimientosDe(estado, 'hucha').reduce((s, m) => s + m.cantidad, 0);
}

/** Saldo de estrellas: histórico completo. Nunca se mezcla con los créditos. */
export function saldoEstrellas(estado) {
  return movimientosDe(estado, 'estrellas').reduce((s, m) => s + m.cantidad, 0);
}

/**
 * Modo del saldo de créditos (v3.5):
 *   'continuo' — como la v2: los créditos se acumulan, la semana no los vacía.
 *   'semanal'  — como la v3 original: cada cierre lleva lo que sobra a la hucha.
 */
export function modoSaldo(estado) {
  return estado.ajustes?.modoSaldo?.valor === 'semanal' ? 'semanal' : 'continuo';
}

/** Créditos disponibles para gastar: todo el histórico, o solo la semana. */
export function saldoCreditos(estado, fecha) {
  if (modoSaldo(estado) === 'semanal') return saldoSemana(estado, fecha || toDateKey(new Date()));
  return movimientosDe(estado, 'semana').reduce((s, m) => s + m.cantidad, 0);
}

/** Saldo de cualquier moneda, con la semana correcta si hace falta. */
export function saldoDeCuenta(estado, cuenta, fecha) {
  if (cuenta === 'hucha') return saldoHucha(estado);
  if (cuenta === 'estrellas') return saldoEstrellas(estado);
  return saldoCreditos(estado, fecha);
}

/** Serie de saldos de la hucha día a día, para la gráfica de evolución. */
export function serieHucha(estado, desde, hasta) {
  const movs = movimientosDe(estado, 'hucha');
  const serie = [];
  let acumulado = movs.filter((m) => m.fecha < desde).reduce((s, m) => s + m.cantidad, 0);
  let fecha = desde;
  let i = movs.findIndex((m) => m.fecha >= desde);
  if (i < 0) i = movs.length;
  while (fecha <= hasta) {
    while (i < movs.length && movs[i].fecha <= fecha) {
      acumulado += movs[i].cantidad;
      i++;
    }
    serie.push({ fecha, valor: acumulado });
    const d = new Date(`${fecha}T00:00:00`);
    d.setDate(d.getDate() + 1);
    fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return serie;
}

/** Parte del saldo semanal que todavía está pendiente de aprobación. */
export function saldoProvisional(estado, weekId) {
  return movimientosDe(estado, 'semana', weekId)
    .filter((m) => m.provisional && !m.anuladoPor)
    .reduce((s, m) => s + m.cantidad, 0);
}

/** Ganado / gastado de la semana, para informes. Nunca se recalcula fuera de aquí. */
export function resumenSemana(estado, fechaODeSemana) {
  const weekId = weekIdOf(fechaODeSemana);
  const movs = movimientosDe(estado, 'semana', weekId);
  let ganado = 0;
  let gastado = 0;
  let ajustes = 0;
  for (const m of movs) {
    const t = tipoEfectivo(estado, m);
    if (t === TIPOS.GANADO) {
      ganado += m.cantidad;
    } else if (t === TIPOS.GASTADO) {
      gastado += -m.cantidad;
    } else if (t === TIPOS.AJUSTE) {
      ajustes += m.cantidad;
      if (m.cantidad > 0) ganado += m.cantidad;
      else gastado += -m.cantidad;
    }
    // Los traspasos de cierre no son ni ganancia ni gasto: solo mueven saldo.
  }
  return {
    weekId,
    ganado,
    gastado,
    ajustes,
    saldo: saldoSemana(estado, weekId),
    provisional: saldoProvisional(estado, weekId),
    movimientos: movs,
  };
}

/** Créditos ganados por categoría en una semana (mismo origen que el saldo). */
export function ganadoPorCategoria(estado, fechaODeSemana) {
  const out = {};
  for (const m of movimientosDe(estado, 'semana', fechaODeSemana)) {
    const t = tipoEfectivo(estado, m);
    if (t !== TIPOS.GANADO && t !== TIPOS.AJUSTE) continue;
    if (t === TIPOS.AJUSTE && m.cantidad < 0) continue; // una multa no es "ganado"
    out[m.categoria] = (out[m.categoria] || 0) + m.cantidad;
  }
  for (const k of Object.keys(out)) {
    if (out[k] === 0) delete out[k];
  }
  return out;
}

/** Ritmo real de ahorro: media de lo que cae a la hucha por semana cerrada. */
export function ritmoAhorroSemanal(estado) {
  const traspasos = movimientosDe(estado, 'hucha').filter(
    (m) => m.tipo === TIPOS.TRASPASO && m.cantidad > 0,
  );
  if (traspasos.length === 0) return 0;
  const total = traspasos.reduce((s, m) => s + m.cantidad, 0);
  return total / traspasos.length;
}
