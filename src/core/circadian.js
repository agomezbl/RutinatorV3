/**
 * RITMO CIRCADIANO
 *
 * Base real, resumida para Nil dentro de la app:
 *  · En la pubertad el reloj biológico se retrasa de forma natural: no es
 *    vagancia, el cuerpo pide dormirse más tarde.
 *  · Entre los 13 y los 18 años hacen falta de 8 a 10 horas de sueño.
 *  · La luz de las pantallas retrasa la melatonina, la hormona que da sueño.
 *  · Cenar justo antes de dormir empeora la calidad del sueño.
 */

import { isWeekend, minutosDeHora, horaActual, horaDeMinutos, addDays, toDateKey, creditos } from './util.js';
import { crearMovimiento, TIPOS } from './ledger.js';
import { leerParametro } from './tokenomics.js';

export const EXPLICACION = [
  'Tu reloj interno se ha retrasado solo, por la edad. No es que seas vago: a los 13 el cuerpo pide acostarse más tarde y levantarse más tarde.',
  'A tu edad hacen falta entre 8 y 10 horas de sueño. Menos de eso se nota al día siguiente en memoria, humor y reflejos.',
  'La luz de las pantallas frena la melatonina, la hormona que te da sueño. Por eso hay una hora de corte del ocio.',
  'Cenar justo antes de dormir hace que duermas peor aunque estés cansado. Por eso la cena tiene su hora.',
];

export function objetivosDe(estado, fecha) {
  const a = estado.ajustes || {};
  const finde = isWeekend(fecha);
  return {
    finde,
    cena: finde ? (a.cenaFinde?.valor ?? '21:15') : (a.cenaEntreSemana?.valor ?? '20:30'),
    dormir: finde ? (a.dormirFinde?.valor ?? '23:45') : (a.dormirEntreSemana?.valor ?? '22:30'),
    corte: a.horaCorteOcio?.valor ?? '21:00',
  };
}

/**
 * ¿Estamos pasada la hora de corte del ocio?
 * No tiene en cuenta el Modo Búho: eso lo resuelve leisure.js, que es quien
 * conoce las compras aprobadas.
 */
export function pasadaHoraDeCorte(estado, fecha, hora = horaActual()) {
  const { corte } = objetivosDe(estado, fecha);
  const c = minutosDeHora(corte);
  const h = minutosDeHora(hora);
  if (c === null || h === null) return false;
  // De 00:00 a 04:00 seguimos considerando "de noche" del día anterior.
  if (h < 4 * 60) return true;
  return h >= c;
}

/** Horas de sueño previstas entre la hora de dormir y una hora de levantarse. */
export function horasDeSuenoPrevistas(estado, fecha, horaLevantarse = '07:00') {
  const { dormir } = objetivosDe(estado, fecha);
  const d = minutosDeHora(dormir);
  const l = minutosDeHora(horaLevantarse);
  if (d === null || l === null) return null;
  const mins = (l + 1440 - d) % 1440;
  return Math.round((mins / 60) * 10) / 10;
}

export function evaluacionSueno(horas) {
  if (horas === null) return { nivel: 'desconocido', texto: 'Sin datos.' };
  if (horas >= 9) return { nivel: 'genial', texto: 'Franja ideal para tu edad.' };
  if (horas >= 8) return { nivel: 'bien', texto: 'Dentro de lo recomendado (8-10 h).' };
  if (horas >= 7) return { nivel: 'justo', texto: 'Un poco corto: se nota al día siguiente.' };
  return { nivel: 'poco', texto: 'Por debajo de lo que tu cuerpo necesita.' };
}

/** Minutos que faltan para la hora de corte (negativo si ya pasó). */
export function minutosHastaCorte(estado, fecha, hora = horaActual()) {
  const { corte } = objetivosDe(estado, fecha);
  const c = minutosDeHora(corte);
  const h = minutosDeHora(hora);
  if (c === null || h === null) return null;
  return c - h;
}

export function proximoHito(estado, fecha, hora = horaActual()) {
  const o = objetivosDe(estado, fecha);
  const h = minutosDeHora(hora) ?? 0;
  const hitos = [
    { id: 'corte', etiqueta: 'Pantallas fuera', hora: o.corte },
    { id: 'cena', etiqueta: 'Cena', hora: o.cena },
    { id: 'dormir', etiqueta: 'A dormir', hora: o.dormir },
  ].sort((a, b) => (minutosDeHora(a.hora) ?? 0) - (minutosDeHora(b.hora) ?? 0));
  const siguiente = hitos.find((x) => (minutosDeHora(x.hora) ?? 0) > h);
  if (!siguiente) return null;
  const faltan = (minutosDeHora(siguiente.hora) ?? 0) - h;
  return { ...siguiente, faltanMinutos: faltan, faltanTexto: horaDeMinutos(faltan) };
}

/* ================================================================== */
/* REGISTRO DE SUEÑO Y BONIFICACIONES                                  */
/* ================================================================== */

/**
 * Los minutos de una hora nocturna, contando la madrugada como continuación
 * de la noche anterior: 00:30 son 24h30 y no media hora.
 */
export function minutosNocturnos(hora) {
  const m = minutosDeHora(hora);
  if (m === null) return null;
  return m < 4 * 60 ? m + 1440 : m;
}

export function registroSueno(estado, fecha) {
  return estado.sueno?.[fecha] || null;
}

/** Noches apuntadas entre dos fechas, en orden. */
export function nochesEntre(estado, desde, hasta) {
  const salida = [];
  let f = desde;
  while (f <= hasta) {
    salida.push({ fecha: f, registro: registroSueno(estado, f) });
    f = addDays(f, 1);
  }
  return salida;
}

/** Noches cumplidas seguidas hacia atrás desde una fecha. */
export function rachaSueno(estado, fecha) {
  let n = 0;
  let f = fecha;
  for (let i = 0; i < 400; i++) {
    const r = registroSueno(estado, f);
    if (!r || !r.cumplida) break;
    n++;
    f = addDays(f, -1);
  }
  return n;
}

/**
 * Apunta a qué hora se durmió. Si llega a la hora (con el margen de cortesía),
 * abona el bonus de la noche, y si además completa una racha, el bonus extra.
 */
export function registrarSueno(store, { fecha, hora, forzar = false }) {
  const estado = store.estado;
  const previo = registroSueno(estado, fecha);
  if (previo && !forzar) return { ok: false, razon: 'Esa noche ya está apuntada.' };
  const m = minutosNocturnos(hora);
  if (m === null) return { ok: false, razon: 'Esa hora no es válida.' };

  const objetivo = objetivosDe(estado, fecha).dormir;
  const margen = Number(leerParametro(estado, 'margenDormirMin', 15));
  const limite = minutosNocturnos(objetivo) + margen;
  const cumplida = m <= limite;
  const bonoNoche = Number(leerParametro(estado, 'bonoNocheCumplida', 2));

  let movimientoId = null;
  let bonusRacha = 0;
  let racha = 0;

  store.lote((s) => {
    // Si se está corrigiendo, se anula el bonus anterior en vez de borrarlo.
    if (previo && previo.movimientoId) {
      const original = s.obtener('ledger', previo.movimientoId);
      if (original && !original.anuladoPor) {
        const rev = crearMovimiento({
          cuenta: original.cuenta,
          tipo: TIPOS.ANULACION,
          cantidad: -original.cantidad,
          concepto: `Corrección: ${original.concepto}`,
          categoria: 'noche',
          fecha: original.fecha,
          refTipo: 'sueno',
          refId: fecha,
          actor: 'padre',
          anula: original.id,
        });
        s.set('ledger', rev.id, rev);
        s.patch('ledger', original.id, { anuladoPor: rev.id });
      }
    }

    if (cumplida && bonoNoche > 0) {
      const mov = crearMovimiento({
        cuenta: 'semana',
        tipo: TIPOS.GANADO,
        cantidad: bonoNoche,
        concepto: 'Noche a la hora',
        categoria: 'noche',
        fecha,
        refTipo: 'sueno',
        refId: fecha,
        actor: 'sistema',
      });
      s.set('ledger', mov.id, mov);
      movimientoId = mov.id;
    }

    s.set('sueno', fecha, {
      id: fecha,
      fecha,
      hora,
      cumplida,
      objetivo,
      desfaseMin: m - minutosNocturnos(objetivo),
      bono: cumplida ? bonoNoche : 0,
      movimientoId,
      apuntadoEn: Date.now(),
    });

    // La racha se calcula ya con esta noche dentro.
    racha = rachaSueno(s.estado, fecha);
    const cada = Number(leerParametro(estado, 'bonoRachaSuenoNoches', 5));
    const premio = Number(leerParametro(estado, 'bonoRachaSueno', 15));
    if (cumplida && premio > 0 && cada > 0 && racha > 0 && racha % cada === 0) {
      const mov = crearMovimiento({
        cuenta: 'hucha',
        tipo: TIPOS.GANADO,
        cantidad: premio,
        concepto: `${racha} noches seguidas a la hora`,
        categoria: 'noche',
        fecha,
        refTipo: 'sueno-racha',
        refId: `${fecha}#${racha}`,
        actor: 'sistema',
      });
      s.set('ledger', mov.id, mov);
      bonusRacha = premio;
    }
  });

  return { ok: true, cumplida, bono: cumplida ? bonoNoche : 0, racha, bonusRacha };
}

/** Media de horas dormidas de las últimas noches apuntadas. */
export function mediaSueno(estado, hasta, dias = 14, horaLevantarse = '07:00') {
  const desde = addDays(hasta, -(dias - 1));
  const noches = nochesEntre(estado, desde, hasta).filter((n) => n.registro);
  if (!noches.length) return null;
  const total = noches.reduce((s, n) => {
    const d = minutosNocturnos(n.registro.hora);
    const l = minutosDeHora(horaLevantarse) + 1440;
    return s + Math.max(0, l - d);
  }, 0);
  return Math.round((total / noches.length / 60) * 10) / 10;
}

/* ================================================================== */
/* AVISOS, COMENTARIOS Y RECOMENDACIONES                               */
/* ================================================================== */

/**
 * Consejos contextuales para Nil: dependen de la hora, de lo que ha pasado
 * estos días y de lo que tiene pendiente. Están escritos para un chico de 13
 * años: explican el porqué, no mandan.
 *
 * Devuelve como mucho `limite` consejos, del más urgente al menos.
 */
export function consejos(estado, fecha, hora = horaActual(), { limite = 3 } = {}) {
  const salida = [];
  const o = objetivosDe(estado, fecha);
  const ahora = minutosDeHora(hora) ?? 0;
  const corte = minutosDeHora(o.corte) ?? 0;
  const cena = minutosDeHora(o.cena) ?? 0;
  const dormir = minutosDeHora(o.dormir) ?? 0;
  const racha = rachaSueno(estado, addDays(fecha, -1));
  const media = mediaSueno(estado, fecha, 14);
  const anoche = registroSueno(estado, addDays(fecha, -1));
  const hoyApuntada = registroSueno(estado, fecha);

  const falta = corte - ahora;
  if (falta > 0 && falta <= 30) {
    salida.push({
      id: 'corte-cerca',
      tono: 'aviso',
      titulo: `Quedan ${falta} min de pantallas`,
      texto: 'A partir del corte, la luz de la pantalla retrasa la melatonina y cuesta más coger el sueño. Ve cerrando.',
    });
  } else if (ahora >= corte && ahora < dormir) {
    salida.push({
      id: 'corte-pasado',
      tono: 'aviso',
      titulo: 'Hora de soltar pantallas',
      texto: 'Tu cerebro necesita un rato de luz baja antes de dormir. Un libro, música o hablar un rato funcionan mejor que el móvil.',
    });
  }

  if (ahora >= cena - 45 && ahora <= cena + 30) {
    salida.push({
      id: 'cena',
      tono: 'info',
      titulo: 'Buen momento para cenar',
      texto: 'Cenar con margen antes de dormir hace que descanses mejor, aunque te acuestes a la misma hora.',
    });
  }

  if (racha >= 3) {
    salida.push({
      id: 'racha-sueno',
      tono: 'bien',
      titulo: `${racha} noches seguidas a la hora`,
      texto: 'Esto es justo lo que hace que el reloj interno se estabilice. Se nota más a la tercera o cuarta noche que a la primera.',
    });
  } else if (anoche && !anoche.cumplida) {
    salida.push({
      id: 'anoche-tarde',
      tono: 'info',
      titulo: 'Anoche se hizo tarde',
      texto: 'No pasa nada por una noche. Lo que cuesta recuperar es encadenar varias: hoy vuelve a tu hora y listo.',
    });
  }

  if (media !== null && media < 8) {
    salida.push({
      id: 'poco-sueno',
      tono: 'aviso',
      titulo: `Vas durmiendo unas ${media} h de media`,
      texto: 'A tu edad el cuerpo pide entre 8 y 10. Adelantar 20 minutos la hora de acostarte ya se nota en memoria y en humor.',
    });
  }

  if (ahora >= dormir - 30 && !hoyApuntada) {
    salida.push({
      id: 'apuntar-noche',
      tono: 'info',
      titulo: 'Acuérdate de apuntar la noche',
      texto: 'Cuando te acuestes, apunta la hora. Es lo que cuenta para el bonus y para tu gráfica de sueño.',
    });
  }

  if (isWeekend(fecha)) {
    salida.push({
      id: 'finde',
      tono: 'info',
      titulo: 'Fin de semana, pero sin desmontar el reloj',
      texto: 'Puedes acostarte algo más tarde. Si te vas más de dos horas, el lunes tu cuerpo cree que ha cambiado de país.',
    });
  }

  const orden = { aviso: 0, bien: 1, info: 2 };
  return salida.sort((a, b) => orden[a.tono] - orden[b.tono]).slice(0, limite);
}
