/**
 * STORE — estado de la aplicación con escrituras granulares.
 *
 * Principio de arquitectura nº2 del encargo: nunca se sobrescribe el estado
 * entero. Toda modificación es una operación sobre UN registro concreto
 * (`set` / `patch` / `remove` en una colección), y esa misma operación es la
 * que viaja a la nube. Dos dispositivos que tocan cosas distintas no se pisan.
 *
 * Colecciones (todas son mapas id → registro):
 *   ajustes      — cada preferencia es un registro independiente { id, valor }
 *   tareas       — catálogo de tareas
 *   marcas       — tareas marcadas por Nil (una por tarea y día)
 *   ledger       — movimientos de créditos (ver ledger.js)
 *   tienda       — premios y bonos comprables
 *   compras      — solicitudes/compras de la tienda
 *   horario      — bloques del horario semanal recurrente
 *   eventos      — citas del calendario con fecha real
 *   sesiones     — sesiones de PC cronometradas
 *   semanas      — cierres de semana archivados
 *   stakings     — depósitos, apuestas de racha y compromisos de sueño
 *   sueno        — registro de a qué hora se durmió cada noche
 *   logros       — insignias conseguidas, con la fecha (el catálogo vive en código)
 *   temas        — fondos regalados a mano por el padre
 *   temasVistos  — fondos cuya celebración de desbloqueo ya se ha enseñado
 *   propuestas   — lo que Nil propone y la respuesta del padre
 *   retos        — el reto de la casa de cada semana
 */

import { deepClone } from './util.js';

export const COLECCIONES = [
  'ajustes', 'tareas', 'marcas', 'ledger', 'tienda', 'compras',
  'horario', 'eventos', 'sesiones', 'semanas', 'stakings', 'sueno',
  'logros', 'temas', 'temasVistos', 'propuestas', 'retos',
];

export function estadoVacio() {
  const e = { version: 3 };
  for (const c of COLECCIONES) e[c] = {};
  return e;
}

export function crearStore(estadoInicial = estadoVacio(), opciones = {}) {
  let estado = estadoInicial;
  const oyentes = new Set();
  const oyentesOps = new Set();
  let silencio = 0;
  let pendiente = false;

  function notificar() {
    if (silencio > 0) { pendiente = true; return; }
    for (const fn of oyentes) fn(estado);
  }

  function emitirOp(op) {
    for (const fn of oyentesOps) fn(op);
  }

  function comprobarColeccion(coleccion) {
    if (!COLECCIONES.includes(coleccion)) {
      throw new Error(`Colección desconocida: ${coleccion}`);
    }
    if (!estado[coleccion]) estado[coleccion] = {};
  }

  const api = {
    get estado() { return estado; },

    /** Sustituye el estado completo. Solo para carga inicial y reinicio. */
    reemplazar(nuevo, { local = true } = {}) {
      estado = nuevo;
      notificar();
      if (local) emitirOp({ tipo: 'reemplazo' });
    },

    obtener(coleccion, id) {
      comprobarColeccion(coleccion);
      return estado[coleccion][id] || null;
    },

    listar(coleccion) {
      comprobarColeccion(coleccion);
      return Object.values(estado[coleccion]);
    },

    /** Escribe un registro completo. */
    set(coleccion, id, registro, { remoto = false } = {}) {
      comprobarColeccion(coleccion);
      const conId = { ...registro, id };
      estado[coleccion] = { ...estado[coleccion], [id]: conId };
      notificar();
      if (!remoto) emitirOp({ tipo: 'set', coleccion, id, registro: conId });
      return conId;
    },

    /** Modifica solo los campos indicados de un registro. */
    patch(coleccion, id, campos, { remoto = false } = {}) {
      comprobarColeccion(coleccion);
      const actual = estado[coleccion][id];
      if (!actual) return null;
      const nuevo = { ...actual, ...campos, id };
      estado[coleccion] = { ...estado[coleccion], [id]: nuevo };
      notificar();
      if (!remoto) emitirOp({ tipo: 'set', coleccion, id, registro: nuevo });
      return nuevo;
    },

    remove(coleccion, id, { remoto = false } = {}) {
      comprobarColeccion(coleccion);
      if (!estado[coleccion][id]) return false;
      const copia = { ...estado[coleccion] };
      delete copia[id];
      estado[coleccion] = copia;
      notificar();
      if (!remoto) emitirOp({ tipo: 'remove', coleccion, id });
      return true;
    },

    /** Agrupa varias escrituras en una sola notificación de interfaz. */
    lote(fn) {
      silencio++;
      try {
        return fn(api);
      } finally {
        silencio--;
        if (silencio === 0 && pendiente) { pendiente = false; notificar(); }
      }
    },

    suscribir(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },
    suscribirOps(fn) { oyentesOps.add(fn); return () => oyentesOps.delete(fn); },

    /** Ajustes: cada clave es un registro independiente (sincronización fina). */
    ajuste(clave, porDefecto = null) {
      const r = estado.ajustes[clave];
      return r === undefined || r === null ? porDefecto : r.valor;
    },

    fijarAjuste(clave, valor) {
      return api.set('ajustes', clave, { valor });
    },

    instantanea() { return deepClone(estado); },
  };

  if (opciones.alCambiar) api.suscribir(opciones.alCambiar);
  return api;
}
