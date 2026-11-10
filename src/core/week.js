/**
 * CIERRE DE SEMANA
 *
 * Lo que sobra del saldo semanal NO desaparece: cae a la hucha con un
 * movimiento de traspaso. Si la semana acaba en negativo (porque el padre vetó
 * algo ya gastado), el déficit se arrastra a la semana siguiente en lugar de
 * vaciar la hucha: los dos saldos nunca se mezclan en un cálculo.
 *
 * El cierre NO toca el calendario de citas, ni el horario, ni los precios.
 */

import { uid, weekIdOf, addDays, toDateKey } from './util.js';
import {
  crearMovimiento, TIPOS, saldoSemana, saldoHucha, resumenSemana, ganadoPorCategoria, modoSaldo,
} from './ledger.js';
import { cumplimientoSemana, rachaActual, umbralRacha } from './tasks.js';
import { resolverRacha } from './progreso.js';
import { cerrarReto } from './propuestas.js';
import { comprasDe } from './leisure.js';
import { resolverApuestasTrasCierre } from './staking.js';
import { leerParametro } from './tokenomics.js';

export function semanaArchivada(estado, weekId) {
  return estado.semanas?.[weekId] || null;
}

export function datosDeSemana(estado, weekId, hastaFecha = addDays(weekId, 6)) {
  const resumen = resumenSemana(estado, weekId);
  const cumplimiento = cumplimientoSemana(estado, weekId, hastaFecha);
  const dias = new Set([0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekId, i)));
  const compras = comprasDe(estado)
    .filter((c) => dias.has(c.fecha))
    .sort((a, b) => (a.solicitadaEn || 0) - (b.solicitadaEn || 0));
  const marcas = Object.values(estado.marcas || {})
    .filter((m) => dias.has(m.fecha))
    .sort((a, b) => (a.marcadaEn || 0) - (b.marcadaEn || 0));
  return {
    weekId,
    desde: weekId,
    hasta: addDays(weekId, 6),
    ganado: resumen.ganado,
    gastado: resumen.gastado,
    ajustes: resumen.ajustes,
    saldo: resumen.saldo,
    porCategoria: ganadoPorCategoria(estado, weekId),
    movimientos: resumen.movimientos,
    compras,
    marcas,
    cumplimiento,
    hucha: saldoHucha(estado),
    racha: rachaActual(estado),
  };
}

/**
 * Cierra la semana que contiene `fecha`.
 * Idempotente: si ya estaba cerrada no hace nada.
 */
export function cerrarSemana(store, { fecha = toDateKey(new Date()) } = {}) {
  const estado = store.estado;
  const weekId = weekIdOf(fecha);
  if (semanaArchivada(estado, weekId)) {
    return { ok: false, razon: 'Esta semana ya estaba cerrada.' };
  }

  // Con saldo continuo (v3.5, como la v2) el cierre solo archiva y mueve la
  // racha: los créditos se quedan donde están y Nil decide qué guarda.
  const saldo = modoSaldo(estado) === 'continuo' ? 0 : saldoSemana(estado, weekId);
  const datos = datosDeSemana(estado, weekId);
  const pct = datos.cumplimiento.pct;
  const umbral = umbralRacha(estado);
  const rachaPrevia = rachaActual(estado);
  // La racha ya no es "sube o se parte": puede haber un escudo que la salve.
  const decision = resolverRacha(estado, { cumplimiento: pct, umbral });
  const nuevaRacha = decision.racha;
  const ultimoDia = addDays(weekId, 6);
  const primerDiaSiguiente = addDays(weekId, 7);
  let traspasado = 0;
  let arrastrado = 0;

  store.lote((s) => {
    if (saldo > 0) {
      const salida = crearMovimiento({
        cuenta: 'semana',
        tipo: TIPOS.TRASPASO,
        cantidad: -saldo,
        concepto: 'Cierre de semana: a la hucha',
        categoria: 'cierre',
        fecha: ultimoDia,
        refTipo: 'semana',
        refId: weekId,
        actor: 'sistema',
      });
      const entrada = crearMovimiento({
        cuenta: 'hucha',
        tipo: TIPOS.TRASPASO,
        cantidad: saldo,
        concepto: `Ahorro de la semana del ${weekId}`,
        categoria: 'cierre',
        fecha: ultimoDia,
        refTipo: 'semana',
        refId: weekId,
        actor: 'sistema',
      });
      s.set('ledger', salida.id, salida);
      s.set('ledger', entrada.id, entrada);
      traspasado = saldo;
    } else if (saldo < 0) {
      const cierre = crearMovimiento({
        cuenta: 'semana',
        tipo: TIPOS.TRASPASO,
        cantidad: -saldo,
        concepto: 'Cierre de semana en negativo',
        categoria: 'cierre',
        fecha: ultimoDia,
        refTipo: 'semana',
        refId: weekId,
        actor: 'sistema',
      });
      const arrastre = crearMovimiento({
        cuenta: 'semana',
        tipo: TIPOS.TRASPASO,
        cantidad: saldo,
        concepto: 'Arrastre de la semana anterior',
        categoria: 'cierre',
        fecha: primerDiaSiguiente,
        refTipo: 'semana',
        refId: weekId,
        actor: 'sistema',
      });
      s.set('ledger', cierre.id, cierre);
      s.set('ledger', arrastre.id, arrastre);
      arrastrado = saldo;
    }

    s.set('semanas', weekId, {
      id: weekId,
      cerradaEn: Date.now(),
      ganado: datos.ganado,
      gastado: datos.gastado,
      ajustes: datos.ajustes,
      traspasadoAHucha: traspasado,
      arrastrado,
      cumplimiento: pct,
      umbral,
      rachaPrevia,
      racha: nuevaRacha,
      escudoUsado: decision.escudoUsado,
      escudoGanado: decision.ganaEscudo,
      porCategoria: datos.porCategoria,
      huchaTras: saldoHucha(store.estado) + traspasado,
    });
    s.fijarAjuste('racha', nuevaRacha);
    s.fijarAjuste('escudos', decision.escudos);
    s.fijarAjuste('ultimaSemanaCerrada', weekId);
  });

  const subioRacha = decision.superada;

  // El reto de la casa se cierra con la semana: ganado o no, queda en el
  // historial. No hay castigo por fallarlo, solo el premio que estaba en juego.
  const reto = cerrarReto(store, ultimoDia);

  // Bonus por subir la racha: va directo a la hucha, no al saldo semanal, para
  // que premie el hábito y no se gaste el mismo día.
  let bonoRacha = 0;
  if (subioRacha) {
    bonoRacha = Number(leerParametro(store.estado, 'bonoRachaCreditos', 0));
    if (bonoRacha > 0) {
      const mov = crearMovimiento({
        cuenta: 'hucha',
        tipo: TIPOS.GANADO,
        cantidad: bonoRacha,
        concepto: `Racha de ${nuevaRacha} semana${nuevaRacha === 1 ? '' : 's'}`,
        categoria: 'cierre',
        fecha: ultimoDia,
        refTipo: 'racha',
        refId: weekId,
        actor: 'sistema',
      });
      store.set('ledger', mov.id, mov);
    }
  }

  // Las apuestas de racha se resuelven con el resultado real de esta semana.
  const apuestas = resolverApuestasTrasCierre(store, { subioRacha, fecha: ultimoDia });

  return {
    ok: true,
    weekId,
    traspasado,
    arrastrado,
    cumplimiento: pct,
    racha: nuevaRacha,
    rachaPrevia,
    subioRacha,
    escudoUsado: decision.escudoUsado,
    escudoGanado: decision.ganaEscudo,
    escudos: decision.escudos,
    hito: decision.hito,
    bonoRacha,
    apuestas,
    reto,
  };
}

/** ¿Hay alguna semana anterior a la actual sin cerrar? */
export function semanasPendientesDeCierre(estado, fechaHoy) {
  const actual = weekIdOf(fechaHoy);
  const semanasConMovimientos = new Set(
    Object.values(estado.ledger || {})
      .filter((m) => m.cuenta === 'semana')
      .map((m) => weekIdOf(m.fecha)),
  );
  return [...semanasConMovimientos]
    .filter((w) => w < actual && !estado.semanas?.[w])
    .sort();
}

export function idNuevaSemana() {
  return uid('sem');
}
