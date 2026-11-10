/**
 * ECONOMÍA — multiplicadores, precios, objetivo de ahorro e informe de salud.
 * Todo lo que aquí se calcula parte SIEMPRE del ledger (ledger.js).
 */

import { creditos, isWeekend, weekIdOf, addDays } from './util.js';
import {
  saldoSemana, saldoHucha, saldoEstrellas, saldoCreditos, resumenSemana, ritmoAhorroSemanal, movimientosDe, TIPOS,
} from './ledger.js';

export const AMBITOS_MULTIPLICADOR = [
  { id: 'siempre', etiqueta: 'Siempre' },
  { id: 'finde', etiqueta: 'Solo fin de semana' },
  { id: 'entresemana', etiqueta: 'Solo entre semana' },
  { id: 'hoy', etiqueta: 'Solo hoy' },
  { id: 'rango', etiqueta: 'Entre dos fechas' },
];

/**
 * Multiplicador aplicable a lo GANADO en una fecha.
 * Nunca se aplica a lo gastado (regla explícita del encargo).
 */
export function multiplicadorEn(estado, fecha, extra = 0) {
  const a = estado.ajustes || {};
  const valor = Number(a.multiplicadorValor?.valor ?? 1);
  const ambito = a.multiplicadorAmbito?.valor ?? 'siempre';
  const fechaAmbito = a.multiplicadorFecha?.valor ?? null;
  // `extra` es lo que aportan las misiones cumplidas. Se SUMA al multiplicador
  // del padre en vez de multiplicarse con él: dos bonificaciones del 50 % dan
  // x2, no x2,25. Si se multiplicaran, una buena racha de misiones sumada a una
  // promoción de fin de semana dispararía la economía sin que nadie lo viera
  // venir.
  const bonus = Number.isFinite(extra) ? Math.max(0, extra) : 0;
  let base = 1;
  if (Number.isFinite(valor) && valor !== 1) {
    if (ambito === 'siempre') base = valor;
    else if (ambito === 'finde') base = isWeekend(fecha) ? valor : 1;
    else if (ambito === 'entresemana') base = isWeekend(fecha) ? 1 : valor;
    else if (ambito === 'hoy') base = fechaAmbito === fecha ? valor : 1;
    else if (ambito === 'rango') {
      const desde = a.multiplicadorDesde?.valor || null;
      const hasta = a.multiplicadorHasta?.valor || null;
      base = desde && hasta && fecha >= desde && fecha <= hasta ? valor : 1;
    }
  }
  return base + bonus;
}

/**
 * Lo que otorga una tarea en una fecha, ya con multiplicador aplicado.
 * El multiplicador es de CRÉDITOS: nunca toca las estrellas, para que el
 * cuidado del cuerpo no se infle con una promoción de fin de semana.
 */
export function valorTareaEn(estado, tarea, fecha, opcionId = null, extra = 0) {
  let base = Number(tarea.valor || 0);
  if (tarea.tipo === 'obligatoria') return 0;
  if (tarea.tipo === 'eleccion') {
    const op = (tarea.opciones || []).find((o) => o.id === opcionId);
    base = op ? Number(op.valor || 0) : 0;
  }
  const esEstrellas = tarea.moneda === 'estrellas' || tarea.tipo === 'habito';
  if (esEstrellas) return creditos(base);
  return creditos(base * multiplicadorEn(estado, fecha, extra));
}

/** Precio efectivo de un artículo, respetando su suelo de precio. */
export function precioEfectivo(articulo) {
  const min = Number(articulo.precioMinimo || 0);
  return creditos(Math.max(Number(articulo.precio || 0), min));
}

/** Saldo disponible en la moneda que usa un artículo. */
export function saldoDe(estado, cuenta, fechaHoy) {
  if (cuenta === 'hucha') return saldoHucha(estado);
  if (cuenta === 'estrellas') return saldoEstrellas(estado);
  return saldoCreditos(estado, fechaHoy);
}

/** Objetivo de ahorro: cuánto falta y estimación realista de semanas. */
export function estadoObjetivo(estado, fechaHoy) {
  const id = estado.ajustes?.objetivoAhorroId?.valor || null;
  if (!id) return null;
  const articulo = estado.tienda?.[id];
  if (!articulo) return { id, faltante: null, roto: true };
  const precio = precioEfectivo(articulo);
  const hucha = saldoHucha(estado);
  const faltante = Math.max(0, precio - hucha);
  const ritmo = ritmoAhorroSemanal(estado);
  let semanas = null;
  if (faltante === 0) semanas = 0;
  else if (ritmo > 0) semanas = Math.ceil(faltante / ritmo);
  return {
    id,
    articulo,
    precio,
    hucha,
    faltante,
    progreso: precio > 0 ? Math.min(1, hucha / precio) : 0,
    ritmoSemanal: Math.round(ritmo * 10) / 10,
    semanasEstimadas: semanas,
    fechaHoy,
  };
}

/**
 * Informe de salud económica del padre.
 * Compara lo ganado con lo gastado en las últimas semanas y da un diagnóstico
 * simple, sin jerga.
 */
export function informeSalud(estado, fechaHoy, semanasAtras = 4) {
  const semanaActual = weekIdOf(fechaHoy);
  const semanas = [];
  for (let i = semanasAtras - 1; i >= 0; i--) {
    const wid = addDays(semanaActual, -7 * i);
    semanas.push(resumenSemana(estado, wid));
  }
  const conDatos = semanas.filter((s) => s.ganado !== 0 || s.gastado !== 0);
  const totalGanado = conDatos.reduce((s, x) => s + x.ganado, 0);
  const totalGastado = conDatos.reduce((s, x) => s + x.gastado, 0);
  const mediaGanado = conDatos.length ? totalGanado / conDatos.length : 0;
  const mediaGastado = conDatos.length ? totalGastado / conDatos.length : 0;
  const tasaGasto = totalGanado > 0 ? totalGastado / totalGanado : 0;

  let diagnostico = 'sin-datos';
  let mensaje = 'Todavía no hay suficientes movimientos para diagnosticar nada.';
  if (conDatos.length > 0) {
    if (tasaGasto > 0.95) {
      diagnostico = 'ajustado';
      mensaje = 'Se gasta casi todo lo que se gana: la hucha apenas crece y los premios grandes quedan lejos. Sube algún valor de tarea o baja un precio de ocio.';
    } else if (tasaGasto < 0.45) {
      diagnostico = 'generoso';
      mensaje = 'Sobra mucho cada semana: la hucha crece rápido y el ocio sale barato. Los premios grandes se van a alcanzar antes de lo previsto.';
    } else {
      diagnostico = 'equilibrado';
      mensaje = 'El reparto está en el rango previsto: se cubre el ocio del día y queda margen que cae a la hucha.';
    }
  }

  return {
    semanas,
    semanasConDatos: conDatos.length,
    mediaGanado: Math.round(mediaGanado),
    mediaGastado: Math.round(mediaGastado),
    tasaGasto: Math.round(tasaGasto * 100),
    ahorroSemanal: Math.round(ritmoAhorroSemanal(estado) * 10) / 10,
    hucha: saldoHucha(estado),
    diagnostico,
    mensaje,
  };
}

/** Reparto en tercios del día (calibración de referencia del encargo). */
export function calibracionDia(estado, fecha) {
  const movs = movimientosDe(estado, 'semana', weekIdOf(fecha)).filter((m) => m.fecha === fecha);
  const ganado = movs.filter((m) => m.cantidad > 0 && m.tipo !== TIPOS.ANULACION)
    .reduce((s, m) => s + m.cantidad, 0);
  const gastado = Math.abs(movs.filter((m) => m.cantidad < 0 && m.tipo === TIPOS.GASTADO)
    .reduce((s, m) => s + m.cantidad, 0));
  const tercio = ganado / 3;
  return {
    ganado,
    gastado,
    tercio: Math.round(tercio),
    restante: ganado - gastado,
    enObjetivo: ganado > 0 && gastado <= tercio * 2.2,
  };
}
