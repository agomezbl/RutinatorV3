/**
 * TEMAS VISUALES — catálogo de escenas.
 *
 * Cada tema es una escena dibujada en canvas fotograma a fotograma: partículas
 * de verdad, luz, profundidad y estelas. El motor (motor.js) se encarga del
 * rendimiento; aquí solo está el catálogo y la paleta de interfaz de cada uno.
 *
 * Reglas comunes a todas las escenas:
 *  · Cero imágenes, cero fuentes externas, cero peticiones de red.
 *  · Todo se genera con ruido determinista: la misma escena sale igual siempre.
 *  · Cada una declara los colores de su cielo para los cuatro momentos del día,
 *    así que el fondo cuenta la hora que es.
 */

import { neon, synthwave, matrix, datos, circuito } from './escenas/digital.js';
import { neuronas, adn, celula, atomos } from './escenas/ciencia.js';
import { nebulosa, orbital } from './escenas/cosmos.js';
import { bosque, oceano, aurora, volcan, sakura, pizarra } from './escenas/naturaleza.js';

export { crearMotor, pintarMiniatura, NIVELES, ORDEN_NIVELES } from './motor.js';

export const MOMENTOS = ['amanecer', 'dia', 'atardecer', 'noche'];

/** Momento del día a partir de la hora local. */
export function momentoDelDia(fecha = new Date()) {
  const h = fecha.getHours();
  if (h >= 6 && h < 9) return 'amanecer';
  if (h >= 9 && h < 18) return 'dia';
  if (h >= 18 && h < 21) return 'atardecer';
  return 'noche';
}

/**
 * El orden importa: es el que ve Nil en el selector. Van agrupadas por
 * familia y empezando por las que más llaman la atención.
 */
export const ESCENAS = [
  neon, synthwave, matrix, datos, circuito,
  neuronas, adn, celula, atomos,
  nebulosa, orbital,
  bosque, oceano, aurora, volcan, sakura,
  pizarra,
];

export const FAMILIAS = {
  cyberpunk: 'Cyberpunk',
  ciencia: 'Ciencia y biología',
  espacio: 'Universo',
  naturaleza: 'Naturaleza',
  calor: 'Naturaleza',
  anime: 'Anime',
  sobrio: 'Sobrio',
};

/** Lo que consume la interfaz: id, nombre, emoji, familia y paleta. */
export const TEMAS = ESCENAS.map((s) => ({
  id: s.id,
  nombre: s.nombre,
  emoji: s.emoji,
  familia: s.familia,
  paleta: s.paleta,
}));

export const ESCENAS_POR_ID = Object.fromEntries(ESCENAS.map((s) => [s.id, s]));
export const TEMAS_POR_ID = Object.fromEntries(TEMAS.map((t) => [t.id, t]));

/**
 * Temas de versiones anteriores que ya no existen: se redirigen al más
 * parecido para que a nadie se le quede la app en gris tras actualizar.
 */
export const ALIAS = {
  cosmos: 'nebulosa',
  invierno: 'aurora',
  fuego: 'volcan',
  amazonas: 'bosque',
  desierto: 'volcan',
};

export function idReal(id) {
  if (ESCENAS_POR_ID[id]) return id;
  if (ALIAS[id] && ESCENAS_POR_ID[ALIAS[id]]) return ALIAS[id];
  return 'bosque';
}

export function tema(id) {
  return TEMAS_POR_ID[idReal(id)];
}

export function escenaDe(id) {
  return ESCENAS_POR_ID[idReal(id)];
}

/** Variables CSS del tema activo. */
export function variablesTema(id) {
  const p = tema(id).paleta;
  return [
    `--fondo:${p.fondo}`, `--fondo2:${p.fondo2}`, `--panel:${p.panel}`, `--panel-alto:${p.panelAlto || p.panel}`,
    `--panel-solido:${p.panelSolido}`, `--texto:${p.texto}`, `--tenue:${p.tenue}`,
    `--acento:${p.acento}`, `--acento2:${p.acento2}`, `--exito:${p.exito}`,
    `--aviso:${p.aviso}`, `--peligro:${p.peligro}`, `--borde:${p.borde}`,
  ].join(';');
}

/**
 * Degradado de respaldo para el contenedor del fondo. Si el canvas no
 * estuviera disponible (navegador muy viejo, modo de ahorro), la app sigue
 * teniéndose en pie con esto.
 */
export function fondoDeRespaldo(id, momento = momentoDelDia()) {
  const escena = escenaDe(id);
  const c = escena.cielo[MOMENTOS.includes(momento) ? momento : 'dia'];
  return `linear-gradient(180deg, ${c.join(', ')})`;
}

export const CALIDADES = [
  { id: 'auto', etiqueta: 'Automática', ayuda: 'Empieza al máximo y baja sola si el móvil no llega.' },
  { id: 'alta', etiqueta: 'Alta', ayuda: 'Todo el detalle, siempre.' },
  { id: 'media', etiqueta: 'Media', ayuda: 'Menos partículas. Va fino en móviles justos.' },
  { id: 'baja', etiqueta: 'Baja', ayuda: 'Lo mínimo, sin brillos. Para ahorrar batería.' },
  { id: 'apagado', etiqueta: 'Apagada', ayuda: 'Fondo quieto, sin animación ninguna.' },
];
