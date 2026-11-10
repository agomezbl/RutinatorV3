/**
 * DESBLOQUEOS — convertir los fondos en el premio que ya eran.
 *
 * La app tiene diecisiete escenas de fondo, cada una con su ciudad, su nebulosa
 * o su bosque. Hasta ahora se regalaban todas el primer día, así que eran papel
 * pintado: bonitas y sin consecuencia. Aquí pasan a ser lo que sostiene el mes
 * tres, que es cuando la novedad del sistema ya se ha gastado.
 *
 * Reglas que se han seguido:
 *  · Se empieza con cinco, una por familia, para que el primer día ya haya de
 *    dónde elegir y no parezca una app capada.
 *  · Cada desbloqueo se gana con **una sola condición clara**, nunca con una
 *    lista. "Nivel 4" o "una semana perfecta", no "nivel 4 y además...".
 *  · Ningún fondo se pierde nunca. Lo que se gana, se queda.
 *  · El padre puede apagar el sistema entero desde Tokenomics y dejarlos todos
 *    abiertos: es su casa y su criterio.
 *
 * El requisito se declara aquí, en un solo sitio, no repartido por la interfaz.
 *
 * Nota de arquitectura: este módulo **no importa el catálogo de escenas**. Las
 * reglas de desbloqueo son lógica de juego (núcleo) y el catálogo es capa
 * visual; quien llama pasa la lista. Así el núcleo sigue sin saber que existe
 * un navegador, y estas reglas se prueban sin montar el motor de fondos.
 */

import { nivelDe, recordRacha, semanasCerradas, LOGROS_POR_ID, evaluarLogros } from './progreso.js';

/**
 * Qué hace falta para cada escena. `nivel` es el caso normal; los especiales
 * son los que premian algo concreto y por eso se recuerdan.
 */
export const REQUISITOS = {
  // De salida: una por familia, para que el selector no nazca vacío.
  bosque: { inicial: true },
  neon: { inicial: true },
  neuronas: { inicial: true },
  nebulosa: { inicial: true },
  pizarra: { inicial: true },

  // Por nivel: el goteo que acompaña al día a día.
  oceano: { nivel: 2 },
  circuito: { nivel: 3 },
  adn: { nivel: 4 },
  sakura: { nivel: 5 },
  orbital: { nivel: 6 },
  celula: { nivel: 8 },
  synthwave: { nivel: 10 },

  // Por gesta: cada una recuerda algo que costó.
  matrix: { logro: 'tareas_100', texto: 'Completa 100 tareas' },
  aurora: { racha: 4, texto: 'Cuatro semanas seguidas de racha' },
  volcan: { logro: 'semana_perfecta', texto: 'Cierra una semana al 100 %' },
  atomos: { logro: 'sueno_30', texto: 'Treinta noches a tu hora' },
  datos: { logro: 'racha_12', texto: 'Doce semanas seguidas de racha' },
};

export function desbloqueosActivos(estado) {
  const v = estado.ajustes?.desbloqueosActivos?.valor;
  return v === undefined ? true : Boolean(v);
}

function textoRequisito(req) {
  if (req.inicial) return 'Disponible desde el principio';
  if (req.texto) return req.texto;
  if (req.nivel) return `Llega al nivel ${req.nivel}`;
  return 'Sigue jugando';
}

/**
 * Estado de cada escena: si está abierta, y si no, qué falta exactamente.
 * Devuelve siempre las diecisiete, en el orden del catálogo, porque ver lo que
 * queda por delante es justo lo que hace que apetezca seguir.
 */
export function estadoDeTemas(estado, catalogo = []) {
  const abiertoATodo = !desbloqueosActivos(estado);
  const nivel = nivelDe(estado).nivel;
  const racha = recordRacha(estado);
  const ganados = new Set(Object.keys(estado.logros || {}));
  // Los logros pueden estar conseguidos sin haberse guardado todavía (por
  // ejemplo la primera vez que se abre la pantalla), así que se recalculan.
  for (const l of evaluarLogros(estado, { nivel, hucha: 0 })) {
    if (l.logrado) ganados.add(l.id);
  }
  const manuales = new Set(Object.keys(estado.temas || {}));

  return catalogo.map((escena) => {
    const req = REQUISITOS[escena.id] || { nivel: 2 };
    let abierto = abiertoATodo || Boolean(req.inicial) || manuales.has(escena.id);
    let falta = null;

    if (!abierto) {
      if (req.nivel) {
        abierto = nivel >= req.nivel;
        falta = abierto ? null : `Nivel ${req.nivel} · te falta ${req.nivel - nivel}`;
      } else if (req.racha) {
        abierto = racha >= req.racha;
        falta = abierto ? null : `${req.racha} semanas de racha · llevas ${racha}`;
      } else if (req.logro) {
        abierto = ganados.has(req.logro);
        falta = abierto ? null : textoRequisito(req);
      }
    }

    return {
      id: escena.id,
      nombre: escena.nombre,
      emoji: escena.emoji,
      familia: escena.familia,
      abierto,
      inicial: Boolean(req.inicial),
      requisito: textoRequisito(req),
      falta,
    };
  });
}

export function temaAbierto(estado, id, catalogo = []) {
  const t = estadoDeTemas(estado, catalogo).find((x) => x.id === id);
  return t ? t.abierto : false;
}

export function contarAbiertos(estado, catalogo = []) {
  const todos = estadoDeTemas(estado, catalogo);
  return { abiertos: todos.filter((t) => t.abierto).length, total: todos.length };
}

/**
 * Los que se acaban de abrir y aún no se han anunciado. Se guardan al
 * anunciarlos para no repetir la celebración cada vez que se pinta la pantalla.
 */
export function temasNuevos(store, catalogo = []) {
  const estado = store.estado;
  if (!desbloqueosActivos(estado)) return [];
  const vistos = new Set(Object.keys(estado.temasVistos || {}));
  const nuevos = estadoDeTemas(estado, catalogo)
    .filter((t) => t.abierto && !t.inicial && !vistos.has(t.id));
  if (!nuevos.length) return [];
  store.lote((s) => {
    for (const t of nuevos) s.set('temasVistos', t.id, { id: t.id, ts: Date.now() });
  });
  return nuevos;
}

/**
 * Marca los iniciales como vistos sin anunciarlos: si no, la primera vez que
 * se abre la app saltarían cinco celebraciones seguidas por nada.
 */
export function sembrarTemasVistos(store, catalogo = []) {
  const estado = store.estado;
  const faltan = estadoDeTemas(estado, catalogo)
    .filter((t) => t.inicial && !estado.temasVistos?.[t.id]);
  if (!faltan.length) return;
  store.lote((s) => {
    for (const t of faltan) s.set('temasVistos', t.id, { id: t.id, ts: Date.now() });
  });
}

/** Abrir un tema a mano desde el panel del padre (regalo, o para probar). */
export function regalarTema(store, id, catalogo = []) {
  if (catalogo.length && !catalogo.some((e) => e.id === id)) {
    return { ok: false, razon: 'Ese fondo no existe.' };
  }
  store.set('temas', id, { id, regalado: true, ts: Date.now() });
  return { ok: true };
}

export { LOGROS_POR_ID, semanasCerradas };
