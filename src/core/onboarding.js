/**
 * PRIMER USO — el asistente que convierte "la app de Nil" en "vuestra app".
 *
 * El catálogo de fábrica está calibrado para un chaval concreto: su nombre, su
 * horario de colegio, sus bonos de ocio. Para la casa de origen eso es una
 * ventaja (se abre y ya funciona); para cualquier otra es un muro, porque nadie
 * va a entrar a Catálogo a editar veinte tareas antes de empezar.
 *
 * Este módulo resuelve eso en seis preguntas. Las reglas que se han seguido:
 *
 *  · **Nada se borra, se desactiva.** Si una familia dice que no usa el PC, el
 *    bono de PC se queda en el catálogo marcado como inactivo. Si cambian de
 *    opinión dentro de un mes, lo reactivan en vez de reescribirlo.
 *  · **Todo tiene respuesta por defecto.** Se puede pasar el asistente entero
 *    a golpe de "Siguiente" y queda una app razonable.
 *  · **Se puede saltar, y se puede repetir.** Saltarlo deja el catálogo de
 *    fábrica tal cual; repetirlo desde el panel no toca el progreso ya hecho.
 *  · **No pregunta nada que no vaya a usar.** Cada respuesta cambia algo
 *    concreto: no hay preguntas de adorno.
 *
 * El asistente NO crea la clave del padre: de eso sigue encargándose el flujo
 * de siempre, que ya obliga a elegirla en el primer acceso al panel.
 */

import { LABORABLES, TODOS } from './defaults.js';

/* ==================================================================== */
/* ESTADO                                                                */
/* ==================================================================== */

/** ¿Hay que enseñar el asistente? Solo mientras nadie lo haya cerrado. */
export function necesitaConfiguracion(estado) {
  return !estado.ajustes?.configurado?.valor;
}

/** Valores de partida del formulario: los del catálogo de fábrica. */
export function configuracionInicial(estado = {}) {
  const v = (k, pd) => {
    const r = estado.ajustes?.[k];
    return r === undefined || r === null || r.valor === null ? pd : r.valor;
  };
  return {
    nombre: v('nombreHijo', ''),
    tratamiento: v('tratamientoAdulto', 'papá'),
    diasColegio: [0, 1, 2, 3, 4],
    entradaColegio: '08:00',
    salidaColegio: '17:00',
    hayColegio: true,
    cenaEntreSemana: v('cenaEntreSemana', '20:30'),
    dormirEntreSemana: v('dormirEntreSemana', '22:30'),
    dormirFinde: v('dormirFinde', '23:45'),
    bloques: ['manana', 'tarde', 'noche', 'semanal', 'cuidado'],
    ocio: ['tv', 'movil', 'pc'],
    juego: ['misiones', 'desbloqueos', 'propuestas', 'efectos'],
  };
}

/* ==================================================================== */
/* LO QUE SE PUEDE ELEGIR                                                */
/* ==================================================================== */

/**
 * Bloques de tareas. Cada uno agrupa las categorías del catálogo que se
 * activan o se desactivan juntas. "Mañana" y "noche" se pueden quitar enteros:
 * hay casas donde las mañanas no son el problema, y meter tareas que nadie va
 * a marcar es la forma más rápida de que la app se abandone.
 */
export const BLOQUES = [
  {
    id: 'manana',
    etiqueta: 'La mañana',
    emoji: '🌅',
    ayuda: 'Levantarse, la cama, el desayuno, la mochila.',
    categorias: ['manana'],
  },
  {
    id: 'tarde',
    etiqueta: 'La tarde y la casa',
    emoji: '🏠',
    ayuda: 'Deberes, la habitación, poner la mesa, el lavavajillas, la basura.',
    categorias: ['tarde'],
  },
  {
    id: 'noche',
    etiqueta: 'La noche y los horarios',
    emoji: '🌙',
    ayuda: 'Cenar a su hora, dejar las pantallas, luces apagadas.',
    categorias: ['noche'],
  },
  {
    id: 'semanal',
    etiqueta: 'Tareas de fin de semana',
    emoji: '📅',
    ayuda: 'La compra, el baño, las plantas. Una o dos veces por semana.',
    categorias: ['semanal'],
  },
  {
    id: 'cuidado',
    etiqueta: 'Cuidado y buen trato',
    emoji: '🌿',
    ayuda: 'Agua, fruta, luz del día, moverse. Se pagan en estrellas, no en créditos.',
    categorias: ['salud'],
  },
];

/**
 * El ocio de cada casa. Lo que no se marque se desactiva en la tienda, para que
 * no aparezcan bonos de cosas que en esa casa no existen.
 */
export const OCIO = [
  { id: 'tv', etiqueta: 'Tele', emoji: '📺', articulos: ['b_tv'] },
  { id: 'movil', etiqueta: 'Móvil', emoji: '📱', articulos: ['b_movil'] },
  { id: 'series', etiqueta: 'Series o anime', emoji: '🌸', articulos: ['b_anime', 'b_anime_extra'] },
  { id: 'pc', etiqueta: 'Ordenador', emoji: '🖥️', articulos: ['b_pc'] },
];

/** La capa de juego. Se puede empezar sin ella y encenderla más adelante. */
export const EXTRAS = [
  {
    id: 'misiones',
    etiqueta: 'Misiones diarias',
    emoji: '📜',
    ayuda: 'Tres retos que cambian cada día. No dan créditos: hacen que el día valga más.',
    ajustes: { misionesActivas: true },
  },
  {
    id: 'desbloqueos',
    etiqueta: 'Fondos que se desbloquean',
    emoji: '🎨',
    ayuda: 'Empieza con 5 de los 17 y va abriendo el resto. Si lo apagas, los tiene todos ya.',
    ajustes: { desbloqueosActivos: true },
  },
  {
    id: 'propuestas',
    etiqueta: 'Que pueda proponer cosas',
    emoji: '💡',
    ayuda: 'Propone tareas, precios o premios, y tú aceptas, contraofertas o dices que no.',
    ajustes: { propuestasActivas: true },
  },
  {
    id: 'efectos',
    etiqueta: 'Animaciones y vibración',
    emoji: '✨',
    ayuda: 'El número que vuela al marcar, el confeti. El sonido va aparte y viene apagado.',
    ajustes: { efectosActivos: true },
  },
];

export const DIAS_SEMANA = [
  { i: 0, corto: 'L', largo: 'Lunes' },
  { i: 1, corto: 'M', largo: 'Martes' },
  { i: 2, corto: 'X', largo: 'Miércoles' },
  { i: 3, corto: 'J', largo: 'Jueves' },
  { i: 4, corto: 'V', largo: 'Viernes' },
  { i: 5, corto: 'S', largo: 'Sábado' },
  { i: 6, corto: 'D', largo: 'Domingo' },
];

export const TRATAMIENTOS = ['papá', 'mamá', 'los papás', 'la familia'];

/* ==================================================================== */
/* VALIDACIÓN                                                            */
/* ==================================================================== */

function horaValida(h) {
  if (!/^\d{2}:\d{2}$/.test(String(h || ''))) return false;
  const [hh, mm] = String(h).split(':').map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

/** Comprueba un paso concreto. Devuelve el problema, o null si está bien. */
export function validarPaso(paso, datos) {
  if (paso === 'nombre') {
    const n = String(datos.nombre || '').trim();
    if (n.length < 2) return 'Escribe su nombre (al menos dos letras).';
    if (n.length > 24) return 'Un nombre más corto, que tiene que caber en la pantalla.';
  }
  if (paso === 'colegio' && datos.hayColegio) {
    if (!horaValida(datos.entradaColegio) || !horaValida(datos.salidaColegio)) {
      return 'Revisa las horas del colegio.';
    }
    if (datos.entradaColegio >= datos.salidaColegio) {
      return 'La hora de salida tiene que ser posterior a la de entrada.';
    }
    if (!(datos.diasColegio || []).length) return 'Marca al menos un día de colegio.';
  }
  if (paso === 'horas') {
    for (const h of [datos.cenaEntreSemana, datos.dormirEntreSemana, datos.dormirFinde]) {
      if (!horaValida(h)) return 'Revisa las horas: tienen que ser del tipo 21:30.';
    }
  }
  if (paso === 'bloques' && !(datos.bloques || []).length) {
    return 'Deja al menos un bloque: si no, la app se queda sin tareas.';
  }
  return null;
}

export function validarTodo(datos) {
  for (const paso of ['nombre', 'colegio', 'horas', 'bloques']) {
    const problema = validarPaso(paso, datos);
    if (problema) return { ok: false, paso, razon: problema };
  }
  return { ok: true };
}

/* ==================================================================== */
/* APLICAR                                                              */
/* ==================================================================== */

/** Categorías de tarea que quedan activas con los bloques elegidos. */
function categoriasActivas(bloques) {
  const elegidos = new Set(bloques || []);
  const cats = new Set(['puntual', 'preparacion']); // estas nunca se tocan
  for (const b of BLOQUES) {
    if (elegidos.has(b.id)) for (const c of b.categorias) cats.add(c);
  }
  return cats;
}

/**
 * Deja el catálogo a la medida de la casa. Todo en una sola operación, para que
 * no haya un instante en que la app esté a medio configurar.
 */
export function aplicarConfiguracion(store, datos) {
  const v = validarTodo(datos);
  if (!v.ok) return { ok: false, ...v };

  const nombre = String(datos.nombre).trim();
  const cats = categoriasActivas(datos.bloques);
  const ocioElegido = new Set(datos.ocio || []);
  const extras = new Set(datos.juego || []);
  const dias = (datos.diasColegio || []).slice().sort();

  const resumen = { tareas: 0, articulos: 0, bloquesHorario: 0 };

  store.lote((s) => {
    /* --- Quién es --- */
    s.fijarAjuste('nombreHijo', nombre);
    s.fijarAjuste('tratamientoAdulto', datos.tratamiento || 'papá');

    /* --- Horas de casa --- */
    s.fijarAjuste('cenaEntreSemana', datos.cenaEntreSemana);
    s.fijarAjuste('dormirEntreSemana', datos.dormirEntreSemana);
    s.fijarAjuste('dormirFinde', datos.dormirFinde);

    /* --- Tareas: se activan o se desactivan, nunca se borran --- */
    for (const t of Object.values(s.estado.tareas || {})) {
      const esHabito = t.tipo === 'habito';
      const activa = esHabito ? cats.has('salud') : cats.has(t.categoria);
      if (Boolean(t.activa) !== activa) resumen.tareas++;
      s.patch('tareas', t.id, { activa });
      // Las tareas que solo tienen sentido con colegio siguen sus días.
      if (!esHabito && (t.id === 't_levantarse' || t.id === 't_mochila' || t.id === 't_deberes')) {
        s.patch('tareas', t.id, { dias: datos.hayColegio && dias.length ? dias : TODOS });
      }
    }

    /* --- Tienda: fuera los bonos de ocio que esa casa no usa --- */
    for (const o of OCIO) {
      const activo = ocioElegido.has(o.id);
      for (const id of o.articulos) {
        if (!s.estado.tienda?.[id]) continue;
        if (Boolean(s.estado.tienda[id].activo) !== activo) resumen.articulos++;
        s.patch('tienda', id, { activo });
      }
    }

    /* --- Horario de colegio --- */
    for (const b of Object.values(s.estado.horario || {})) {
      if (b.tipo !== 'colegio') continue;
      s.remove('horario', b.id);
    }
    if (datos.hayColegio) {
      for (const d of dias) {
        const id = `h_cole_${d}`;
        s.set('horario', id, {
          id,
          dia: d,
          inicio: datos.entradaColegio,
          fin: datos.salidaColegio,
          titulo: 'Colegio',
          tipo: 'colegio',
          bloqueaOcio: true,
          requierePreparacion: false,
        });
        resumen.bloquesHorario++;
      }
    }

    /* --- La capa de juego --- */
    for (const e of EXTRAS) {
      const encendido = extras.has(e.id);
      for (const clave of Object.keys(e.ajustes)) s.fijarAjuste(clave, encendido);
    }

    s.fijarAjuste('configurado', true);
    s.fijarAjuste('configuradoEn', Date.now());
  });

  return { ok: true, resumen };
}

/** Saltar el asistente: se queda el catálogo de fábrica, sin tocar nada. */
export function saltarConfiguracion(store) {
  store.lote((s) => {
    s.fijarAjuste('configurado', true);
    s.fijarAjuste('configuradoEn', Date.now());
  });
  return { ok: true };
}

/** Volver a abrirlo desde el panel. No toca el progreso ya hecho. */
export function reabrirConfiguracion(store) {
  store.fijarAjuste('configurado', false);
  return { ok: true };
}

/**
 * Un resumen en lenguaje normal de lo que va a pasar al confirmar. Se enseña
 * en el último paso: nadie debería pulsar "Listo" sin saber qué cambia.
 */
export function resumenDeConfiguracion(estado, datos) {
  const cats = categoriasActivas(datos.bloques);
  const tareas = Object.values(estado.tareas || {});
  const activas = tareas.filter((t) => (t.tipo === 'habito' ? cats.has('salud') : cats.has(t.categoria)));
  const fuera = tareas.length - activas.length;
  const ocioElegido = (datos.ocio || []).length;

  const lineas = [
    `La app será de ${String(datos.nombre).trim()}.`,
    `${activas.length} tareas activas${fuera > 0 ? `, y ${fuera} apartadas (se pueden recuperar cuando queráis)` : ''}.`,
  ];
  if (datos.hayColegio) {
    lineas.push(`Colegio de ${datos.entradaColegio} a ${datos.salidaColegio}, ${(datos.diasColegio || []).length} días por semana.`);
  } else {
    lineas.push('Sin horario de colegio: el ocio no se bloquea por las mañanas.');
  }
  lineas.push(`Cena a las ${datos.cenaEntreSemana} y a dormir a las ${datos.dormirEntreSemana} entre semana.`);
  lineas.push(ocioElegido
    ? `${ocioElegido} tipos de ocio en la tienda.`
    : 'Sin bonos de ocio: solo premios.');
  const extras = (datos.juego || []).length;
  lineas.push(extras
    ? `Capa de juego: ${extras} de ${EXTRAS.length} cosas encendidas.`
    : 'Sin capa de juego: solo tareas y créditos.');
  return lineas;
}

export { LABORABLES, TODOS };
