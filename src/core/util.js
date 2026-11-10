/**
 * Utilidades base de Rutineitor v3.
 *
 * REGLA DE SEGURIDAD DEL PROYECTO (obligatoria, auditada en tests/audit-escape.test.mjs):
 *   - Cualquier texto que venga del usuario (nombres de tareas, motivos, notas,
 *     títulos de eventos, nombres de premios...) que se inserte en HTML debe pasar
 *     por `esc()`.
 *   - Cualquier texto que se inserte DENTRO de un atributo HTML debe pasar por
 *     `escAttr()` (escapa además comillas simples y dobles).
 *   - Nunca se construye HTML con datos de usuario sin una de las dos funciones.
 */

/** Escapa texto para insertarlo como contenido HTML. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapa texto para insertarlo dentro de un atributo HTML (incluye comillas). */
export function escAttr(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Identificador único ordenable por tiempo. */
let _seq = 0;
export function uid(prefix = 'id') {
  _seq = (_seq + 1) % 100000;
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${t}${_seq.toString(36)}${r}`;
}

/* ------------------------------------------------------------------ */
/* Fechas: siempre trabajamos en hora local con claves 'YYYY-MM-DD'    */
/* ------------------------------------------------------------------ */

export function toDateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function addDays(key, n) {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** 0 = lunes ... 6 = domingo (el calendario de Nil empieza en lunes). */
export function weekdayIndex(key) {
  const js = fromDateKey(key).getDay(); // 0 = domingo
  return (js + 6) % 7;
}

export function isWeekend(key) {
  const w = weekdayIndex(key);
  return w === 5 || w === 6;
}

/** Clave de la semana a la que pertenece una fecha: el lunes de esa semana. */
export function weekIdOf(key) {
  return addDays(key, -weekdayIndex(key));
}

export function weekDays(weekId) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekId, i));
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nombreDia(i) { return DIAS[i] || ''; }
export function nombreDiaCorto(i) { return DIAS_CORTOS[i] || ''; }
export function nombreMes(i) { return MESES[i] || ''; }

export function formatoFechaLarga(key) {
  const d = fromDateKey(key);
  return `${nombreDia(weekdayIndex(key))} ${d.getDate()} de ${nombreMes(d.getMonth())}`;
}

export function formatoFechaCorta(key) {
  const d = fromDateKey(key);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Horas 'HH:MM'                                                       */
/* ------------------------------------------------------------------ */

export function minutosDeHora(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function horaDeMinutos(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function horaActual(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Números                                                             */
/* ------------------------------------------------------------------ */

/** Los créditos son siempre enteros: nunca medio crédito. */
export function creditos(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v);
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Hash simple y estable para la clave del panel (no criptográfico: ver GUIA). */
export function hashClave(texto) {
  const s = String(texto ?? '');
  let h1 = 0x12345678;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761) >>> 0;
    h2 = Math.imul(h2 + c + i, 1597334677) >>> 0;
  }
  return `${h1.toString(36)}.${h2.toString(36)}.${s.length}`;
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** 60 → "1 h", 90 → "1 h 30 min", 45 → "45 min". 0 o vacío → ''. */
export function textoDuracion(minutos) {
  const m = Math.round(Number(minutos) || 0);
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}
