/**
 * SALUD Y RITMO NATURAL
 *
 * Enfoque deliberado, y conviene que quede escrito aquí para quien lea el
 * código dentro de un año: esto **no** es una app de dieta.
 *
 *   · No se registra el peso, ni la talla, ni las calorías, ni nada sobre el
 *     cuerpo de un chico de 13 años. Nunca.
 *   · No hay alimentos "buenos" y "malos", ni objetivos de comer menos, ni
 *     nada que premie restringir. Premiar restricción a esta edad es
 *     exactamente lo que no se debe hacer.
 *   · Lo que se registra son RITMOS y PRESENCIAS: si hubo agua, si hubo verdura
 *     o fruta, si se comió con calma, si se salió a la luz del día, si hubo
 *     movimiento. Cosas que se hacen, no cosas que se evitan.
 *   · Se paga en ESTRELLAS, la moneda del cuidado, nunca en créditos. Así el
 *     cuidado del propio cuerpo no compite con el ocio ni se puede "vender".
 *
 * Los hábitos son tareas normales del catálogo con `tipo: 'habito'`, así que el
 * padre los edita, los crea y los borra con las mismas herramientas que todo lo
 * demás.
 */

import { addDays, toDateKey } from './util.js';
import { leerParametro } from './tokenomics.js';

export const CATEGORIA = 'salud';

/** Hábitos del día: son las tareas de tipo 'habito' activas. */
export function habitosDelDia(estado) {
  return Object.values(estado.tareas || {})
    .filter((t) => t.tipo === 'habito' && t.activa !== false)
    .sort((a, b) => (a.orden || 999) - (b.orden || 999));
}

export function marcaHabito(estado, fecha, habitoId) {
  return estado.marcas?.[`${fecha}__${habitoId}`] || null;
}

/** Cuántos hábitos se marcaron un día concreto. */
export function resumenDia(estado, fecha) {
  const habitos = habitosDelDia(estado);
  const hechos = habitos.filter((h) => {
    const m = marcaHabito(estado, fecha, h.id);
    return m && m.estado !== 'vetada' && m.estado !== 'nocumplida';
  });
  return {
    fecha,
    total: habitos.length,
    hechos: hechos.length,
    ids: hechos.map((h) => h.id),
    completo: habitos.length > 0 && hechos.length === habitos.length,
    pct: habitos.length ? Math.round((hechos.length / habitos.length) * 100) : 0,
  };
}

/** Rejilla de los últimos días: hábito × día. Es lo que pinta la gráfica. */
export function rejilla(estado, hasta = toDateKey(new Date()), dias = 14) {
  const habitos = habitosDelDia(estado);
  const fechas = [];
  for (let i = dias - 1; i >= 0; i--) fechas.push(addDays(hasta, -i));
  return {
    habitos,
    fechas,
    celdas: habitos.map((h) => ({
      habito: h,
      dias: fechas.map((f) => {
        const m = marcaHabito(estado, f, h.id);
        return { fecha: f, hecho: Boolean(m && m.estado !== 'vetada' && m.estado !== 'nocumplida') };
      }),
    })),
  };
}

/** Racha de días seguidos con TODOS los hábitos marcados. */
export function rachaDiasCompletos(estado, fecha) {
  let n = 0;
  let f = fecha;
  for (let i = 0; i < 400; i++) {
    if (!resumenDia(estado, f).completo) break;
    n++;
    f = addDays(f, -1);
  }
  return n;
}

/**
 * Comentarios sobre los hábitos. Mismo tono que los del ritmo circadiano:
 * explican el porqué, no dan órdenes y nunca hablan del cuerpo.
 */
export function comentarios(estado, fecha, { limite = 2 } = {}) {
  const salida = [];
  const hoy = resumenDia(estado, fecha);
  const ayer = resumenDia(estado, addDays(fecha, -1));
  const racha = rachaDiasCompletos(estado, addDays(fecha, -1));
  const agua = habitosDelDia(estado).find((h) => h.referencia === 'agua');
  const aguaHecha = agua ? Boolean(marcaHabito(estado, fecha, agua.id)) : null;
  const sol = habitosDelDia(estado).find((h) => h.referencia === 'sol');
  const solHecho = sol ? Boolean(marcaHabito(estado, fecha, sol.id)) : null;

  if (racha >= 3) {
    salida.push({
      id: 'racha-habitos',
      tono: 'bien',
      titulo: `${racha} días cuidándote seguidos`,
      texto: 'Lo interesante de estos hábitos no es un día suelto, es la repetición. Justo esto.',
    });
  }

  if (aguaHecha === false) {
    salida.push({
      id: 'agua',
      tono: 'info',
      titulo: 'Aún no has marcado el agua',
      texto: `Beber a lo largo del día ayuda a concentrarte y a no llegar arrastrando a la tarde. ${
        leerParametro(estado, 'vasosAguaObjetivo', 6)} vasos repartidos son suficientes.`,
    });
  }

  if (solHecho === false) {
    salida.push({
      id: 'sol',
      tono: 'info',
      titulo: 'Sal un rato a la luz del día',
      texto: 'La luz natural por la mañana es lo que más ayuda a colocar tu reloj interno. Diez minutos fuera valen más que una hora de luz artificial.',
    });
  }

  if (hoy.hechos === 0 && ayer.hechos > 0) {
    salida.push({
      id: 'dia-nuevo',
      tono: 'info',
      titulo: 'Día nuevo, hábitos a cero',
      texto: 'No hay nada que recuperar de ayer: esto se cuenta día a día y hoy empieza limpio.',
    });
  }

  const orden = { aviso: 0, bien: 1, info: 2 };
  return salida.sort((a, b) => orden[a.tono] - orden[b.tono]).slice(0, limite);
}
