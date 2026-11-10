/**
 * CALENDARIO DE CITAS — eventos con FECHA REAL, no recurrentes.
 *
 * Diferencia clave con el horario semanal (schedule.js): lo que se apunta hoy
 * para dentro de tres semanas sigue ahí, completo, cuando llegue esa semana.
 * El cierre de semana NO toca esta colección. El reinicio completo solo la
 * borra si se pide explícitamente.
 */

import { uid, toDateKey, fromDateKey, addDays, minutosDeHora, weekIdOf } from './util.js';

export const COLORES_EVENTO = ['#4d7cfe', '#28b487', '#ff8a3d', '#e2445c', '#7e6bd8', '#00b8d9'];

export function crearEvento({
  fecha, hora = null, titulo = '', notas = '', color = COLORES_EVENTO[0],
  recordatorio = false, id = null,
}) {
  return {
    id: id || uid('evt'),
    fecha,
    hora: hora || null,
    titulo: String(titulo || ''),
    notas: String(notas || ''),
    color,
    recordatorio: Boolean(recordatorio),
    creadoEn: Date.now(),
  };
}

export function validarEvento(evento) {
  if (!String(evento.titulo || '').trim()) return 'El evento necesita un título.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(evento.fecha || ''))) return 'La fecha no es válida.';
  if (evento.hora && minutosDeHora(evento.hora) === null) return 'La hora no es válida.';
  return null;
}

export function eventosDeFecha(estado, fecha) {
  return Object.values(estado.eventos || {})
    .filter((e) => e.fecha === fecha)
    .sort((a, b) => {
      const ha = minutosDeHora(a.hora);
      const hb = minutosDeHora(b.hora);
      if (ha === null && hb === null) return a.creadoEn - b.creadoEn;
      if (ha === null) return -1;
      if (hb === null) return 1;
      return ha - hb;
    });
}

export function eventosEntre(estado, desde, hasta) {
  return Object.values(estado.eventos || {})
    .filter((e) => e.fecha >= desde && e.fecha <= hasta)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (minutosDeHora(a.hora) ?? -1) - (minutosDeHora(b.hora) ?? -1)));
}

export function eventosDeSemana(estado, fechaDeLaSemana) {
  const ini = weekIdOf(fechaDeLaSemana);
  return eventosEntre(estado, ini, addDays(ini, 6));
}

/** Rejilla de un mes: 6 semanas x 7 días, empezando en lunes. */
export function rejillaMes(anio, mes) {
  const primero = new Date(anio, mes, 1);
  const desplazamiento = (primero.getDay() + 6) % 7;
  const inicio = new Date(anio, mes, 1 - desplazamiento);
  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    celdas.push({ fecha: toDateKey(d), delMes: d.getMonth() === mes });
  }
  return celdas;
}

export function proximosEventos(estado, fechaHoy, dias = 14, limite = 6) {
  return eventosEntre(estado, fechaHoy, addDays(fechaHoy, dias)).slice(0, limite);
}

/**
 * Eventos con recordatorio que caen dentro de los próximos `minutos`.
 * La app solo puede avisar con la pestaña abierta (no hay push real):
 * esto se dice explícitamente en la interfaz.
 */
export function recordatoriosInminentes(estado, ahora = new Date(), minutos = 5) {
  const hoy = toDateKey(ahora);
  const minsAhora = ahora.getHours() * 60 + ahora.getMinutes();
  return eventosDeFecha(estado, hoy).filter((e) => {
    if (!e.recordatorio || !e.hora) return false;
    const m = minutosDeHora(e.hora);
    if (m === null) return false;
    const delta = m - minsAhora;
    return delta >= 0 && delta <= minutos;
  });
}

export function mesAnterior(anio, mes) {
  return mes === 0 ? { anio: anio - 1, mes: 11 } : { anio, mes: mes - 1 };
}

export function mesSiguiente(anio, mes) {
  return mes === 11 ? { anio: anio + 1, mes: 0 } : { anio, mes: mes + 1 };
}

export function fechaDesdeCelda(key) {
  return fromDateKey(key);
}
