/**
 * OCIO Y TIENDA
 *
 * Decisión de diseño explícita: móvil, TV y anime se compran POR ADELANTADO
 * como un bono de un día. No hay cronómetro en directo para esas categorías;
 * el cumplimiento real del tiempo lo gestionan los padres fuera de la app.
 * El PC es la única excepción: sesión cronometrada de verdad.
 *
 * Todos los "bonos de un día" (TV, móvil, anime, extra de anime, pase de PC,
 * Modo Búho) usan UN SOLO mecanismo genérico: una compra con fecha, aprobada
 * por el padre, válida solo ese día. No hay lógica repetida por categoría.
 */

import { uid, weekIdOf, weekDays, horaActual, minutosDeHora, creditos } from './util.js';
import { crearMovimiento, TIPOS } from './ledger.js';
import { precioEfectivo, saldoDe } from './economy.js';
import { pasadaHoraDeCorte } from './circadian.js';
import { ocioBloqueadoPorHorario } from './schedule.js';

export const TIPOS_OCIO = ['bono', 'pasePc', 'extraAnime', 'buho'];

export function esOcio(articulo) {
  return TIPOS_OCIO.includes(articulo.tipo);
}

export function comprasDe(estado) {
  return Object.values(estado.compras || {});
}

export function comprasDeFecha(estado, fecha) {
  return comprasDe(estado).filter((c) => c.fecha === fecha);
}

/** Compra viva (pendiente o aprobada) de un artículo en una fecha. */
export function compraDelDia(estado, fecha, itemId) {
  return comprasDeFecha(estado, fecha).find(
    (c) => c.itemId === itemId && (c.estado === 'pendiente' || c.estado === 'aprobada'),
  ) || null;
}

export function bonoAprobado(estado, fecha, itemId) {
  return comprasDeFecha(estado, fecha).find(
    (c) => c.itemId === itemId && c.estado === 'aprobada',
  ) || null;
}

export function modoBuhoActivo(estado, fecha) {
  return comprasDeFecha(estado, fecha).some(
    (c) => c.tipo === 'buho' && c.estado === 'aprobada',
  );
}

export function diaSinTareas(estado, fecha) {
  return comprasDeFecha(estado, fecha).some(
    (c) => c.itemId === 'p_sintareas' && c.estado === 'aprobada',
  );
}

/** Veces que se ha pedido un artículo esta semana (pendientes + aprobadas). */
export function usosEnLaSemana(estado, fecha, itemId) {
  const dias = new Set(weekDays(weekIdOf(fecha)));
  return comprasDe(estado).filter(
    (c) => c.itemId === itemId && dias.has(c.fecha) && c.estado !== 'denegada',
  ).length;
}

/**
 * ¿Se puede comprar este artículo hoy? Única puerta de entrada a la tienda.
 * Devuelve { ok, razon } — razon en lenguaje normal, para enseñarla tal cual.
 */
export function puedeComprar(estado, articulo, fecha, hora = horaActual()) {
  if (!articulo || articulo.activo === false) {
    return { ok: false, razon: 'Este premio ya no está disponible.' };
  }
  if (estado.ajustes?.tiendaPausada?.valor) {
    return { ok: false, razon: 'La tienda está en pausa ahora mismo. Habla con papá.' };
  }

  const precio = precioEfectivo(articulo);
  const saldo = saldoDe(estado, articulo.moneda || 'semana', fecha);
  if (precio > saldo) {
    if (articulo.moneda === 'estrellas') {
      return { ok: false, razon: `Te faltan ${precio - saldo} estrellas.` };
    }
    const cual = articulo.moneda === 'hucha' ? ' en la hucha' : '';
    return { ok: false, razon: `Te faltan ${precio - saldo} créditos${cual}.` };
  }

  if (compraDelDia(estado, fecha, articulo.id) && esOcio(articulo)) {
    return { ok: false, razon: 'Ya tienes este bono para hoy.' };
  }

  if (articulo.topeSemanal) {
    const usados = usosEnLaSemana(estado, fecha, articulo.id);
    if (usados >= Number(articulo.topeSemanal)) {
      return { ok: false, razon: `Ya has usado los ${articulo.topeSemanal} días de esta semana para este bono.` };
    }
  }

  if (articulo.requiereBase) {
    const base = bonoAprobado(estado, fecha, articulo.requiereBase);
    if (!base) {
      const nombreBase = estado.tienda?.[articulo.requiereBase]?.nombre || 'el bono base';
      return { ok: false, razon: `Necesitas tener aprobado hoy "${nombreBase}" antes de pedir más tiempo.` };
    }
  }

  if (articulo.tipo === 'pasePc' && !esDiaDeSemana(fecha, estado)) {
    return { ok: false, razon: 'El fin de semana el PC está libre: no hace falta pase.' };
  }

  // Toque de queda: el ocio no se puede ni empezar a comprar pasada la hora de
  // corte, salvo que haya Modo Búho aprobado esa noche. El propio Modo Búho sí
  // se puede comprar después (es justo lo que levanta el toque de queda).
  if (esOcio(articulo) && articulo.tipo !== 'buho') {
    if (pasadaHoraDeCorte(estado, fecha, hora) && !modoBuhoActivo(estado, fecha)) {
      return { ok: false, razon: 'Ya ha pasado la hora de corte. Solo con Modo Búho aprobado.' };
    }
    const bloqueo = ocioBloqueadoPorHorario(estado, fecha, hora);
    if (bloqueo.bloqueado) {
      return { ok: false, razon: `Ahora estás en "${bloqueo.bloque.titulo}": el ocio espera a que termine.` };
    }
  }

  return { ok: true, razon: null, precio };
}

function esDiaDeSemana(fecha) {
  const d = new Date(`${fecha}T00:00:00`).getDay();
  return d >= 1 && d <= 5;
}

/**
 * Solicita una compra. El crédito se descuenta en el momento (para que no se
 * pueda gastar dos veces) y si el padre deniega, se devuelve con un movimiento
 * de anulación. Nunca hay matemática manual.
 */
export function solicitarCompra(store, { itemId, fecha, hora = horaActual(), actor = 'nil' }) {
  const estado = store.estado;
  const articulo = estado.tienda?.[itemId];
  const check = puedeComprar(estado, articulo, fecha, hora);
  if (!check.ok) return { ok: false, razon: check.razon };

  const precio = precioEfectivo(articulo);
  const cuenta = ['hucha', 'estrellas'].includes(articulo.moneda) ? articulo.moneda : 'semana';
  const compraId = uid('cmp');

  // Un artículo gratuito (el permiso de PC, que se paga por tiempo) no deja
  // un apunte de 0 en el histórico: solo la compra, para que papá la apruebe.
  const mov = precio > 0 ? crearMovimiento({
    cuenta,
    tipo: TIPOS.GASTADO,
    cantidad: -precio,
    concepto: articulo.nombre,
    categoria: 'tienda',
    fecha,
    refTipo: 'compra',
    refId: compraId,
    actor,
  }) : null;

  store.lote((s) => {
    if (mov) s.set('ledger', mov.id, mov);
    s.set('compras', compraId, {
      id: compraId,
      itemId,
      nombre: articulo.nombre,
      duracion: Number(articulo.duracion) > 0 ? Number(articulo.duracion) : null,
      tipo: articulo.tipo,
      categoriaOcio: articulo.categoriaOcio || null,
      moneda: cuenta,
      precio,
      fecha,
      estado: articulo.requiereAprobacion === false ? 'aprobada' : 'pendiente',
      movimientoId: mov ? mov.id : null,
      solicitadaEn: Date.now(),
      resueltaEn: articulo.requiereAprobacion === false ? Date.now() : null,
      motivo: null,
    });
  });

  return { ok: true, compraId, precio };
}

export function aprobarCompra(store, compraId) {
  const c = store.obtener('compras', compraId);
  if (!c || c.estado !== 'pendiente') return false;
  store.patch('compras', compraId, { estado: 'aprobada', resueltaEn: Date.now() });
  return true;
}

/** Denegar devuelve el crédito con un movimiento de anulación (auditable). */
export function denegarCompra(store, compraId, motivo = '') {
  const c = store.obtener('compras', compraId);
  if (!c || c.estado !== 'pendiente') return false;
  const original = store.obtener('ledger', c.movimientoId);
  store.lote((s) => {
    if (original && !original.anuladoPor) {
      const rev = crearMovimiento({
        cuenta: original.cuenta,
        tipo: TIPOS.ANULACION,
        cantidad: -original.cantidad,
        concepto: `Devolución: ${original.concepto}`,
        categoria: 'tienda',
        fecha: original.fecha,
        refTipo: 'compra',
        refId: compraId,
        actor: 'padre',
        anula: original.id,
      });
      s.set('ledger', rev.id, rev);
      s.patch('ledger', original.id, { anuladoPor: rev.id });
    }
    s.patch('compras', compraId, {
      estado: 'denegada',
      resueltaEn: Date.now(),
      motivo: String(motivo || ''),
    });
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* PC — sesión cronometrada real                                       */
/* ------------------------------------------------------------------ */

export function sesionPcAbierta(estado) {
  return Object.values(estado.sesiones || {}).find((s) => !s.fin) || null;
}

export function puedeUsarPc(estado, fecha, hora = horaActual()) {
  const libreFinde = estado.ajustes?.pcLibreFinde?.valor !== false;
  const bloqueo = ocioBloqueadoPorHorario(estado, fecha, hora);
  if (bloqueo.bloqueado) {
    return { ok: false, razon: `Ahora estás en "${bloqueo.bloque.titulo}".` };
  }
  if (pasadaHoraDeCorte(estado, fecha, hora) && !modoBuhoActivo(estado, fecha)) {
    return { ok: false, razon: 'Ya ha pasado la hora de corte. Solo con Modo Búho aprobado.' };
  }
  if (!esDiaDeSemana(fecha)) {
    if (libreFinde) return { ok: true, razon: null };
  }
  const pase = bonoAprobado(estado, fecha, 'b_pc');
  if (!pase) {
    return { ok: false, razon: 'Entre semana el PC necesita un pase comprado y aprobado para hoy.' };
  }
  return { ok: true, razon: null };
}

export function iniciarSesionPc(store, { fecha, ahora = Date.now(), hora = horaActual() }) {
  const estado = store.estado;
  if (sesionPcAbierta(estado)) return { ok: false, razon: 'Ya tienes una sesión de PC abierta.' };
  const check = puedeUsarPc(estado, fecha, hora);
  if (!check.ok) return { ok: false, razon: check.razon };
  const id = uid('ses');
  store.set('sesiones', id, { id, fecha, inicio: ahora, fin: null, minutos: 0, coste: 0, movimientoId: null });
  return { ok: true, sesionId: id };
}

/**
 * Cierra la sesión y factura por bloques empezados.
 * El coste sale del saldo semanal como cualquier otro gasto: mismo ledger.
 */
export function pararSesionPc(store, { ahora = Date.now() } = {}) {
  const estado = store.estado;
  const sesion = sesionPcAbierta(estado);
  if (!sesion) return { ok: false, razon: 'No hay ninguna sesión abierta.' };
  const minutos = Math.max(0, Math.round((ahora - sesion.inicio) / 60000));
  const bloque = Number(estado.ajustes?.pcBloqueMinutos?.valor ?? 30);
  const porBloque = Number(estado.ajustes?.pcCreditosPorBloque?.valor ?? 5);
  const bloques = minutos === 0 ? 0 : Math.ceil(minutos / Math.max(1, bloque));
  const coste = creditos(bloques * porBloque);

  let movId = null;
  store.lote((s) => {
    if (coste > 0) {
      const mov = crearMovimiento({
        cuenta: 'semana',
        tipo: TIPOS.GASTADO,
        cantidad: -coste,
        concepto: `Sesión de PC (${minutos} min)`,
        categoria: 'tienda',
        fecha: sesion.fecha,
        refTipo: 'sesion',
        refId: sesion.id,
        actor: 'nil',
      });
      s.set('ledger', mov.id, mov);
      movId = mov.id;
    }
    s.patch('sesiones', sesion.id, { fin: ahora, minutos, coste, movimientoId: movId });
  });
  return { ok: true, minutos, coste };
}

/** Minutos de PC consumidos en una fecha. */
export function minutosPcDe(estado, fecha) {
  return Object.values(estado.sesiones || {})
    .filter((s) => s.fecha === fecha && s.fin)
    .reduce((t, s) => t + (s.minutos || 0), 0);
}

/** Resumen de lo que Nil tiene activo hoy, para la pantalla de inicio. */
export function ocioDeHoy(estado, fecha) {
  const compras = comprasDeFecha(estado, fecha).filter(
    (c) => c.estado !== 'denegada' && TIPOS_OCIO.includes(c.tipo),
  );
  return compras.map((c) => ({
    ...c,
    pendiente: c.estado === 'pendiente',
  }));
}
