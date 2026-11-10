/**
 * HORARIO SEMANAL — plantilla recurrente por día de la semana.
 * No confundir con el calendario de citas (calendar.js): el horario se repite
 * todas las semanas y no tiene fechas reales.
 */

import { weekdayIndex, minutosDeHora, horaActual, uid } from './util.js';

export const TIPOS_BLOQUE = {
  colegio: { etiqueta: 'Colegio', color: '#4d7cfe', bloqueaOcio: true },
  extraescolar: { etiqueta: 'Extraescolar', color: '#ff8a3d', bloqueaOcio: true },
  rutina: { etiqueta: 'Rutina', color: '#28b487', bloqueaOcio: false },
  libre: { etiqueta: 'Tiempo libre', color: '#9aa5b1', bloqueaOcio: false },
};

export const HORA_INICIO_REJILLA = 7;
export const HORA_FIN_REJILLA = 23;

export function crearBloque({
  dia = 0, inicio = '17:00', fin = '18:00', titulo = 'Nuevo bloque',
  tipo = 'rutina', bloqueaOcio = null, requierePreparacion = false, id = null,
}) {
  const def = TIPOS_BLOQUE[tipo] || TIPOS_BLOQUE.rutina;
  return {
    id: id || uid('blq'),
    dia, inicio, fin, titulo, tipo,
    bloqueaOcio: bloqueaOcio === null ? def.bloqueaOcio : Boolean(bloqueaOcio),
    requierePreparacion: Boolean(requierePreparacion),
  };
}

export function bloquesDeDia(estado, diaIdx) {
  return Object.values(estado.horario || {})
    .filter((b) => b.dia === diaIdx)
    .sort((a, b) => (minutosDeHora(a.inicio) ?? 0) - (minutosDeHora(b.inicio) ?? 0));
}

export function bloquesDeFecha(estado, fecha) {
  return bloquesDeDia(estado, weekdayIndex(fecha));
}

/**
 * ¿Se puede empezar ocio ahora mismo?
 * Devuelve { bloqueado, bloque } — bloqueado si hay un bloque activo marcado
 * como "bloquea ocio" a la hora indicada.
 */
export function ocioBloqueadoPorHorario(estado, fecha, hora = horaActual()) {
  const min = minutosDeHora(hora);
  if (min === null) return { bloqueado: false, bloque: null };
  for (const b of bloquesDeFecha(estado, fecha)) {
    if (!b.bloqueaOcio) continue;
    const ini = minutosDeHora(b.inicio);
    const fin = minutosDeHora(b.fin);
    if (ini === null || fin === null) continue;
    if (min >= ini && min < fin) return { bloqueado: true, bloque: b };
  }
  return { bloqueado: false, bloque: null };
}

/**
 * Tareas generadas automáticamente por el horario: cada bloque marcado como
 * "requiere preparación" genera una tarea "Preparar [actividad]" ese día.
 * Son tareas virtuales: viven en el horario, no en el catálogo, así que
 * desaparecen solas si se borra o desmarca el bloque.
 */
export function tareasDePreparacion(estado, fecha) {
  return bloquesDeFecha(estado, fecha)
    .filter((b) => b.requierePreparacion)
    .map((b) => ({
      id: `gen_${b.id}`,
      nombre: `Preparar ${b.titulo}`,
      tipo: 'estandar',
      valor: Number(estado.ajustes?.valorPreparacion?.valor ?? 3),
      categoria: 'preparacion',
      dias: [b.dia],
      icono: '🎒',
      orden: 55,
      activa: true,
      generadaPor: b.id,
      horaReferencia: b.inicio,
    }));
}

/** Próximo bloque del día a partir de una hora. */
export function proximoBloque(estado, fecha, hora = horaActual()) {
  const min = minutosDeHora(hora) ?? 0;
  return bloquesDeFecha(estado, fecha).find((b) => (minutosDeHora(b.inicio) ?? 0) > min) || null;
}

export function bloqueActual(estado, fecha, hora = horaActual()) {
  const min = minutosDeHora(hora);
  if (min === null) return null;
  return bloquesDeFecha(estado, fecha).find((b) => {
    const i = minutosDeHora(b.inicio);
    const f = minutosDeHora(b.fin);
    return i !== null && f !== null && min >= i && min < f;
  }) || null;
}

/** Valida un bloque antes de guardarlo. Devuelve null si está bien. */
export function validarBloque(bloque) {
  const i = minutosDeHora(bloque.inicio);
  const f = minutosDeHora(bloque.fin);
  if (i === null) return 'La hora de inicio no es válida.';
  if (f === null) return 'La hora de fin no es válida.';
  if (f <= i) return 'La hora de fin tiene que ser posterior a la de inicio.';
  if (!String(bloque.titulo || '').trim()) return 'Ponle un nombre al bloque.';
  if (![0, 1, 2, 3, 4, 5, 6].includes(Number(bloque.dia))) return 'Día de la semana no válido.';
  return null;
}
