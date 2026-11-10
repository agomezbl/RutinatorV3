/**
 * GESTIÓN DE LA ECONOMÍA (v3.5) — las herramientas del padre.
 *
 * Todo sigue pasando por el ledger: aquí no se suma ningún saldo "a mano".
 * Cada herramienta escribe movimientos normales (ajuste, traspaso, anulación)
 * con su motivo, así que el histórico cuenta siempre la verdad completa.
 *
 *   - Saldo continuo (como la v2): los créditos no se vacían al cerrar la semana.
 *   - Guardar en la hucha / sacar de la hucha (traspasos, no son ganar ni gastar).
 *   - Ajustes en cualquier cuenta con motivo obligatorio.
 *   - Anular un movimiento con motivo (nunca se borra nada).
 *   - Histórico filtrable de las tres cuentas, con el saldo tras cada movimiento.
 *   - Recuperar un día pasado (hasta 14 días) y validar varias tareas de golpe.
 *   - Subir o bajar precios en bloque, y pausar la tienda.
 *   - Instrumentos avanzados apagados por defecto (se encienden en Avanzado).
 */

import { creditos, toDateKey, addDays, weekIdOf } from './util.js';
import {
  crearMovimiento, TIPOS, movimientos, saldoHucha, saldoEstrellas, saldoCreditos, modoSaldo,
} from './ledger.js';
import {
  tareasDelDia, marcaDe, marcarTarea, aprobarMarca, evaluarObligatoria, idMarca,
  cumplimientoSemana, umbralRacha,
} from './tasks.js';
import { leerParametro } from './tokenomics.js';
import { precioEfectivo } from './economy.js';
import {
  CATEGORIAS, PALETA_CATEGORIAS, TAREAS_POR_DEFECTO, TIENDA_POR_DEFECTO, AJUSTES_POR_DEFECTO,
} from './defaults.js';
import { capitalBloqueado } from './staking.js';

/* ------------------------------------------------------------------ */
/* Saldo continuo                                                      */
/* ------------------------------------------------------------------ */

export { modoSaldo, saldoCreditos };

/** Todos los créditos de la cuenta de gasto, de todas las semanas. */
export function saldoCreditosTotal(estado) {
  let s = 0;
  for (const m of Object.values(estado.ledger || {})) if (m.cuenta === 'semana') s += m.cantidad;
  return creditos(s);
}

/* ------------------------------------------------------------------ */
/* Instrumentos avanzados                                              */
/* ------------------------------------------------------------------ */

/**
 * Lo que la v3 tenía de más respecto a la v2. Desde la v3.5 viene apagado;
 * cada uno se puede volver a encender en Economía → Avanzado.
 * `ajustes` son los valores que se fijan al encender (y a 0/false al apagar).
 */
export const INSTRUMENTOS_AVANZADOS = [
  { id: 'apuesta', nombre: 'Apuesta de racha', texto: 'Nil apuesta créditos de la hucha a que mantiene la racha varias semanas. El único instrumento que puede salir mal.',
    encender: { apuestaActiva: true }, apagar: { apuestaActiva: false }, grupo: 'apuesta' },
  { id: 'sueno', nombre: 'Staking de sueño', texto: 'Bloquear créditos y cobrar interés por cada noche que se duerme a su hora.',
    encender: { stakingSuenoActivo: true }, apagar: { stakingSuenoActivo: false }, grupo: 'sueno' },
  { id: 'bonosSueno', nombre: 'Bonos por dormir a la hora', texto: 'Créditos por cada noche cumplida y un extra por la racha de noches.',
    encender: { bonoNocheCumplida: 2, bonoRachaSueno: 15 }, apagar: { bonoNocheCumplida: 0, bonoRachaSueno: 0 }, grupo: 'circadiano' },
  { id: 'misiones', nombre: 'Misiones diarias', texto: 'Retos del día que suben el multiplicador de lo ganado ese día.',
    encender: { misionesActivas: true }, apagar: { misionesActivas: false }, grupo: 'misiones' },
  { id: 'escudos', nombre: 'Escudos de racha', texto: 'Un escudo cada N semanas de racha que salva una semana floja.',
    encender: { escudosMaximos: 2 }, apagar: { escudosMaximos: 0 }, grupo: 'progresion' },
  { id: 'bonoRacha', nombre: 'Bonus al subir la racha', texto: 'Créditos a la hucha cada vez que la racha semanal sube.',
    encender: { bonoRachaCreditos: 20 }, apagar: { bonoRachaCreditos: 0 }, grupo: 'semana' },
  { id: 'cierreSemanal', nombre: 'Cierre semanal a la hucha', texto: 'Como la v3 original: cada domingo el saldo de créditos se vacía y lo que sobra cae a la hucha.',
    encender: { modoSaldo: 'semanal' }, apagar: { modoSaldo: 'continuo' }, grupo: null },
];

export function instrumentoEncendido(estado, inst) {
  return Object.entries(inst.encender).every(([k, v]) => {
    const actual = leerParametro(estado, k, null);
    return typeof v === 'boolean' || typeof v === 'string' ? actual === v : Number(actual) > 0;
  });
}

export function cambiarInstrumento(store, id, encender) {
  const inst = INSTRUMENTOS_AVANZADOS.find((i) => i.id === id);
  if (!inst) return { ok: false, razon: 'Ese instrumento no existe.' };
  store.lote((s) => {
    for (const [k, v] of Object.entries(encender ? inst.encender : inst.apagar)) s.fijarAjuste(k, v);
  });
  return { ok: true };
}

/** Migración única a la economía simplificada (v3.5). Idempotente. */
export const VERSION_ECONOMIA = 35;
export function migrarEconomia(store) {
  const v = Number(store.ajuste('versionEconomia', 0)) || 0;
  if (v >= VERSION_ECONOMIA) return false;
  store.lote((s) => {
    for (const inst of INSTRUMENTOS_AVANZADOS) {
      for (const [k, val] of Object.entries(inst.apagar)) s.fijarAjuste(k, val);
    }
    s.fijarAjuste('versionEconomia', VERSION_ECONOMIA);
  });
  return true;
}

/**
 * v3.5.1: los bonos de pantalla indican cuánto tiempo dan. A las tiendas ya
 * instaladas se les pone la duración de ejemplo solo a los artículos de
 * fábrica que no la tengan, y se cambia la descripción solo si sigue siendo
 * la de fábrica: lo que haya escrito el padre no se toca. Idempotente.
 */
export const VERSION_TIENDA = 351;
const TIENDA_351 = {
  b_tv: { duracion: 60, antes: 'Un rato de tele hoy.', ahora: 'Tele hoy, el tiempo que marca el bono.' },
  b_movil: { duracion: 60, antes: 'Rato de móvil hoy. Tope de días por semana.', ahora: 'Móvil hoy, el tiempo que marca el bono. Tope de días por semana.' },
  b_anime: { duracion: 60, antes: 'Un episodio seguro, con margen para un segundo.', ahora: 'Uno o dos episodios hoy.' },
  b_anime_extra: { duracion: 30, antes: 'Solo si ya tienes el bono de anime de hoy.', ahora: 'Un rato más, solo si ya tienes el bono de anime de hoy.' },
};
export function migrarTienda(store) {
  const v = Number(store.ajuste('versionTienda', 0)) || 0;
  if (v >= VERSION_TIENDA) return false;
  store.lote((s) => {
    for (const [id, m] of Object.entries(TIENDA_351)) {
      const a = s.estado.tienda?.[id];
      if (!a) continue;
      const cambios = {};
      if (a.duracion === undefined) cambios.duracion = m.duracion;
      if ((a.descripcion || '') === m.antes) cambios.descripcion = m.ahora;
      if (Object.keys(cambios).length) s.patch('tienda', id, cambios);
    }
    s.fijarAjuste('versionTienda', VERSION_TIENDA);
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* v3.6 — la economía por tiempo                                       */
/* ------------------------------------------------------------------ */

/**
 * Migración única al sistema nuevo: 1 crédito por cada 5 min de tarea y
 * 12 créditos por hora de ocio. Es un cambio a la vista (se le explica al
 * hijo), y por eso hace tres cosas de una vez:
 *
 *   1. Pone el catálogo nuevo: las tareas y la tienda de fábrica se
 *      actualizan, las de fábrica antiguas que ya no existen se DESACTIVAN
 *      (no se borran: el histórico sigue apuntando a ellas y se pueden
 *      volver a encender). Lo que haya creado el padre no se toca.
 *   2. Ajusta los parámetros que cambian (auto-aprobación, horas, PC…).
 *   3. Multiplica por 1,5 el saldo y la hucha, para que lo ahorrado conserve
 *      su valor frente a los premios, que suben en la misma proporción.
 *      Lo que hay en depósitos a plazo también cuenta: el extra va a la hucha.
 *
 * Seguro con dos móviles: los apuntes de la conversión tienen un id fijo, así
 * que si los dos aparatos la hacen a la vez escriben el MISMO apunte en vez de
 * cobrarla dos veces. Idempotente.
 */
export const VERSION_TIEMPO = 36;
export const FACTOR_CONVERSION_36 = 1.5;

/** Ids de fábrica de la v3.5 que el catálogo nuevo ya no usa. */
export const TAREAS_RETIRADAS_36 = ['t_levantarse', 't_dientes_m', 't_deberes', 't_ducha', 't_pantallas', 't_compra', 't_plantas', 'e_trato'];
export const TIENDA_RETIRADA_36 = [
  'p_peli', 'p_amigos', 'p_menu', 'p_sintareas', 'g_libro', 'g_auriculares', 'g_excursion',
  'e_semillas', 'e_libreta', 'e_mineral', 'e_planta', 'e_salida',
];
/** Ajustes que cambian con el sistema nuevo (el resto se queda como esté). */
const AJUSTES_36 = [
  'autoAprobacionHoras', 'cenaFinde', 'dormirEntreSemana', 'dormirFinde', 'horaCorteOcio',
  'horaCorteOcioFinde', 'precioMinimoAnime', 'pcCreditosPorBloque', 'minutosPorCredito',
];

export function migrarTiempo(store, { fecha = toDateKey(new Date()) } = {}) {
  const v = Number(store.ajuste('versionEconomia', 0)) || 0;
  if (v >= VERSION_TIEMPO) return false;
  const e = store.estado;
  const enUso = Object.keys(e.ledger || {}).length > 0;
  const saldo = enUso ? saldoCreditos(e, fecha) : 0;
  const hucha = enUso ? saldoHucha(e) + capitalBloqueado(e) : 0;
  store.lote((s) => {
    // 1. Catálogo
    for (const t of TAREAS_POR_DEFECTO) {
      const nuevo = { activa: true, ...t };
      if (!nuevo.opciones) nuevo.opciones = null;
      s.set('tareas', t.id, { ...(s.estado.tareas?.[t.id] || {}), ...nuevo });
    }
    for (const id of TAREAS_RETIRADAS_36) if (s.estado.tareas?.[id]) s.patch('tareas', id, { activa: false });
    for (const a of TIENDA_POR_DEFECTO) {
      s.set('tienda', a.id, { ...(s.estado.tienda?.[a.id] || {}), activo: true, ...a });
    }
    for (const id of TIENDA_RETIRADA_36) if (s.estado.tienda?.[id]) s.patch('tienda', id, { activo: false });
    // 2. Ajustes
    for (const k of AJUSTES_36) s.fijarAjuste(k, AJUSTES_POR_DEFECTO[k]);
    // 3. Conversión ×1,5
    const extra = (n) => creditos(n * (FACTOR_CONVERSION_36 - 1));
    if (saldo > 0 && extra(saldo) > 0 && !s.estado.ledger?.mov_v36_saldo) {
      s.set('ledger', 'mov_v36_saldo', crearMovimiento({
        id: 'mov_v36_saldo', cuenta: 'semana', tipo: TIPOS.AJUSTE, cantidad: extra(saldo),
        concepto: 'Sistema nuevo: tus créditos ×1,5', categoria: 'ajuste', fecha, actor: 'sistema',
      }));
    }
    if (hucha > 0 && extra(hucha) > 0 && !s.estado.ledger?.mov_v36_hucha) {
      s.set('ledger', 'mov_v36_hucha', crearMovimiento({
        id: 'mov_v36_hucha', cuenta: 'hucha', tipo: TIPOS.AJUSTE, cantidad: extra(hucha),
        concepto: 'Sistema nuevo: tu hucha ×1,5', categoria: 'ajuste', fecha, actor: 'sistema',
      }));
    }
    s.fijarAjuste('versionEconomia', VERSION_TIEMPO);
    s.fijarAjuste('fechaSistemaTiempo', fecha);
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* v3.7 — el banco de Nil                                              */
/* ------------------------------------------------------------------ */

/**
 * Pone en marcha la hucha nueva (banco.js y freno.js) en una casa instalada:
 * depósito con plazo libre, fondo variable, freno semanal y pausa. Los
 * depósitos ya abiertos conservan su interés. Idempotente.
 */
export const VERSION_BANCO = 37;
const AJUSTES_37 = [
  'interesHuchaPct', 'interesHuchaPeriodo', 'interesHuchaTope', 'depositoActivo', 'depositoMinimo',
  'depositoPlazoMin', 'depositoPlazoMax', 'depositoPctMin', 'depositoPctMax', 'depositoMaximo',
  'fondoActivo', 'fondoMinPct', 'fondoMaxPct', 'fondoMinimo', 'fondoMaximo', 'fondoSueloPct',
  'frenoActivo', 'frenoPct', 'bancoPausado',
];
export function migrarBanco(store) {
  if ((Number(store.ajuste('versionBanco', 0)) || 0) >= VERSION_BANCO) return false;
  store.lote((s) => {
    for (const k of AJUSTES_37) s.fijarAjuste(k, AJUSTES_POR_DEFECTO[k]);
    if (s.ajuste('rendimientoAplazado', null) === null) s.fijarAjuste('rendimientoAplazado', 0);
    s.fijarAjuste('versionBanco', VERSION_BANCO);
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Hucha: guardar y sacar                                              */
/* ------------------------------------------------------------------ */

function traspaso(store, { de, a, cantidad, fecha, actor, concepto }) {
  const v = creditos(cantidad);
  if (!(v > 0)) return { ok: false, razon: 'Pon una cantidad mayor que 0.' };
  const disponible = de === 'hucha' ? saldoHucha(store.estado) : saldoCreditos(store.estado, fecha);
  if (v > disponible) return { ok: false, razon: `Solo hay ${disponible} disponibles.` };
  const ref = `tr_${Date.now().toString(36)}`;
  store.lote((s) => {
    const salida = crearMovimiento({ cuenta: de, tipo: TIPOS.TRASPASO, cantidad: -v, concepto, categoria: 'ahorro', fecha, refTipo: 'traspaso', refId: ref, actor });
    const entrada = crearMovimiento({ cuenta: a, tipo: TIPOS.TRASPASO, cantidad: v, concepto, categoria: 'ahorro', fecha, refTipo: 'traspaso', refId: ref, actor });
    s.set('ledger', salida.id, salida);
    s.set('ledger', entrada.id, entrada);
  });
  return { ok: true, cantidad: v };
}

export function guardarEnHucha(store, { cantidad, fecha = toDateKey(new Date()), actor = 'nil' }) {
  return traspaso(store, { de: 'semana', a: 'hucha', cantidad, fecha, actor, concepto: 'Guardado en la hucha' });
}

export function sacarDeHucha(store, { cantidad, fecha = toDateKey(new Date()), actor = 'nil' }) {
  return traspaso(store, { de: 'hucha', a: 'semana', cantidad, fecha, actor, concepto: 'Sacado de la hucha' });
}

/* ------------------------------------------------------------------ */
/* Ajustes y anulaciones                                               */
/* ------------------------------------------------------------------ */

export const MOTIVOS_FRECUENTES = {
  sumar: ['Ayuda extra en casa', 'Buen comportamiento', 'Esfuerzo en los estudios', 'Corrección de un error', 'Regalo de cumpleaños'],
  quitar: ['Tarea marcada sin hacer', 'Faltar al respeto', 'Pantallas sin permiso', 'Corrección de un error', 'Romper una norma de casa'],
};

/**
 * Sumar o quitar en cualquier cuenta, con motivo obligatorio (lo ve Nil).
 * `fecha` puede ser un día pasado (hasta 14 días) para que el movimiento
 * quede en el día al que corresponde.
 */
export function ajusteCuenta(store, { cuenta = 'semana', cantidad, motivo, fecha = null, hoy = toDateKey(new Date()) }) {
  const texto = String(motivo || '').trim();
  if (!texto) return { ok: false, razon: 'El motivo es obligatorio: Nil tiene que saber por qué.' };
  if (!['semana', 'hucha', 'estrellas'].includes(cuenta)) return { ok: false, razon: 'Cuenta desconocida.' };
  const v = creditos(cantidad);
  if (v === 0) return { ok: false, razon: 'La cantidad no puede ser 0.' };
  const f = fecha || hoy;
  if (f > hoy) return { ok: false, razon: 'No se puede apuntar en el futuro.' };
  if (f < addDays(hoy, -DIAS_ATRAS)) return { ok: false, razon: `Como mucho ${DIAS_ATRAS} días atrás.` };
  if (v < 0 && cuenta !== 'semana') {
    const saldo = cuenta === 'hucha' ? saldoHucha(store.estado) : saldoEstrellas(store.estado);
    if (saldo + v < 0) return { ok: false, razon: `No se puede dejar en negativo: hay ${saldo}.` };
  }
  const mov = crearMovimiento({
    cuenta, tipo: TIPOS.AJUSTE, cantidad: v, concepto: texto.slice(0, 120), categoria: 'ajuste', fecha: f, actor: 'padre',
  });
  store.set('ledger', mov.id, mov);
  return { ok: true, movimientoId: mov.id, cantidad: v };
}

/** Un movimiento se puede anular si es manual o automático, no si ya está anulado ni si es una anulación. */
export function anulable(m) {
  if (!m || m.anuladoPor || m.tipo === TIPOS.ANULACION || m.tipo === TIPOS.REINICIO) return false;
  if (m.tipo === TIPOS.TRASPASO) return false; // los traspasos se deshacen con otro traspaso
  if (m.refTipo === 'tarea') return false;      // las tareas se vetan desde Aprobaciones o Días pasados
  if (m.refTipo === 'staking') return false;    // lo bloqueado lo gestiona el propio depósito
  return true;
}

export function anularMovimiento(store, movId, motivo) {
  const m = store.obtener('ledger', movId);
  const texto = String(motivo || '').trim();
  if (!m) return { ok: false, razon: 'Ese movimiento no existe.' };
  if (!anulable(m)) return { ok: false, razon: 'Este movimiento no se puede anular desde aquí.' };
  if (!texto) return { ok: false, razon: 'Explica por qué se anula.' };
  store.lote((s) => {
    const rev = crearMovimiento({
      cuenta: m.cuenta, tipo: TIPOS.ANULACION, cantidad: -m.cantidad,
      concepto: `Anulado: ${m.concepto} — ${texto}`.slice(0, 160), categoria: m.categoria, fecha: toDateKey(new Date()),
      refTipo: m.refTipo, refId: m.refId, actor: 'padre', anula: m.id,
    });
    s.set('ledger', rev.id, rev);
    s.patch('ledger', m.id, { anuladoPor: rev.id, provisional: false });
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Histórico                                                           */
/* ------------------------------------------------------------------ */

export const ETIQUETA_TIPO = {
  ganado: 'Ganado', gastado: 'Gastado', ajuste: 'Ajuste de papá', anulacion: 'Anulación', traspaso: 'Traspaso', reinicio: 'Reinicio',
};
export const ETIQUETA_CUENTA = { semana: 'Créditos', hucha: 'Hucha', estrellas: 'Estrellas' };
export const ETIQUETA_ACTOR = { padre: 'papá', nil: 'Nil', sistema: 'automático' };

/**
 * Lista de movimientos con filtros, del más nuevo al más antiguo, y con el
 * saldo que quedó en su cuenta justo después de cada uno.
 * filtros: { cuenta, tipo, desde, hasta, texto }
 */
export function historico(estado, filtros = {}) {
  const lista = movimientos(estado);
  const acumulado = { semana: 0, hucha: 0, estrellas: 0 };
  const conSaldo = lista.map((m) => {
    acumulado[m.cuenta] = creditos((acumulado[m.cuenta] || 0) + m.cantidad);
    return { ...m, saldoTras: acumulado[m.cuenta] };
  });
  const t = String(filtros.texto || '').trim().toLowerCase();
  return conSaldo.filter((m) => {
    if (filtros.cuenta && filtros.cuenta !== 'todas' && m.cuenta !== filtros.cuenta) return false;
    if (filtros.tipo && filtros.tipo !== 'todos' && m.tipo !== filtros.tipo) return false;
    if (filtros.desde && m.fecha < filtros.desde) return false;
    if (filtros.hasta && m.fecha > filtros.hasta) return false;
    if (t && !String(m.concepto || '').toLowerCase().includes(t)) return false;
    return true;
  }).reverse();
}

/** El histórico en CSV (separador ; para que Excel en español lo abra bien). */
export function historicoCSV(estado, filtros = {}) {
  const fila = (cols) => cols.map((c) => {
    const s = String(c ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';');
  const lineas = [fila(['Fecha', 'Cuenta', 'Tipo', 'Concepto', 'Cantidad', 'Saldo tras', 'Quién', 'Anulado'])];
  for (const m of historico(estado, filtros).slice().reverse()) {
    lineas.push(fila([m.fecha, ETIQUETA_CUENTA[m.cuenta] || m.cuenta, ETIQUETA_TIPO[m.tipo] || m.tipo, m.concepto,
      String(m.cantidad).replace('.', ','), String(m.saldoTras).replace('.', ','), ETIQUETA_ACTOR[m.actor] || m.actor, m.anuladoPor ? 'sí' : '']));
  }
  return lineas.join('\r\n');
}

/* ------------------------------------------------------------------ */
/* Días pasados                                                        */
/* ------------------------------------------------------------------ */

export const DIAS_ATRAS = 14;

export function fechaRecuperable(fecha, hoy = toDateKey(new Date())) {
  return Boolean(fecha) && fecha <= hoy && fecha >= addDays(hoy, -DIAS_ATRAS);
}

/** Las tareas de un día pasado con su estado, para la pantalla de recuperar. */
export function tareasDeDiaPasado(estado, fecha) {
  return tareasDelDia(estado, fecha).map((t) => {
    const m = marcaDe(estado, fecha, t.id);
    return { tarea: t, marca: m, estado: m ? m.estado : 'sin-marcar' };
  });
}

/**
 * Validar varias tareas de un día pasado de una vez.
 * items: [{ tareaId, opcionId? }]. Lo que estaba pendiente se aprueba; lo que
 * no estaba marcado (o estaba vetado / no cumplido) se marca y se aprueba,
 * con los créditos fechados en ESE día. Después se recalcula la racha si la
 * semana ya estaba cerrada.
 */
export function validarDiaPasado(store, { fecha, items = [], hoy = toDateKey(new Date()), nota = '' }) {
  if (!fechaRecuperable(fecha, hoy)) return { ok: false, razon: `Solo se pueden recuperar los últimos ${DIAS_ATRAS} días.` };
  if (!items.length) return { ok: false, razon: 'Marca al menos una tarea.' };
  if (modoSaldo(store.estado) === 'semanal' && weekIdOf(fecha) !== weekIdOf(hoy) && store.estado.semanas?.[weekIdOf(fecha)]) {
    return { ok: false, razon: 'Con el cierre semanal activado, solo se puede recuperar la semana en curso.' };
  }
  let hechas = 0;
  let creditosTotal = 0;
  const errores = [];
  store.lote((s) => {
    for (const it of items) {
      const tarea = tareasDelDia(s.estado, fecha).find((t) => t.id === it.tareaId);
      if (!tarea) { errores.push(`${it.tareaId}: no existe ese día`); continue; }
      let marca = marcaDe(s.estado, fecha, tarea.id);
      if (marca && marca.estado === 'aprobada') continue;
      if (!marca || marca.estado === 'vetada' || marca.estado === 'nocumplida') {
        const opcionId = tarea.tipo === 'eleccion' ? (it.opcionId || (tarea.opciones || [])[0]?.id) : null;
        const r = marcarTarea(s, { fecha, tareaId: tarea.id, opcionId, actor: 'padre' });
        if (!r.ok) { errores.push(`${tarea.nombre}: ${r.razon}`); continue; }
        marca = s.obtener('marcas', r.marcaId);
      }
      if (marca.estado === 'pendiente') {
        if (tarea.tipo === 'obligatoria') evaluarObligatoria(s, marca.id, true);
        else aprobarMarca(s, marca.id, { nota: nota || 'Validada desde «días pasados»' });
      }
      const final = s.obtener('marcas', idMarca(fecha, tarea.id));
      if (final && final.estado === 'aprobada') { hechas++; creditosTotal += Number(final.valor || 0); }
    }
  });
  const racha = recalcularRachaDesde(store, weekIdOf(fecha));
  return { ok: hechas > 0 || !errores.length, hechas, creditos: creditosTotal, errores, racha };
}

/**
 * Si se valida algo de una semana que ya estaba cerrada, el cumplimiento y la
 * racha archivados se rehacen desde esa semana hacia delante.
 */
export function recalcularRachaDesde(store, weekId) {
  const estado = store.estado;
  const semanas = Object.values(estado.semanas || {}).filter((w) => w.id >= weekId).sort((a, b) => a.id.localeCompare(b.id));
  if (!semanas.length) return null;
  let racha = Number(semanas[0].rachaPrevia || 0);
  store.lote((s) => {
    for (const w of semanas) {
      const pct = cumplimientoSemana(s.estado, w.id, addDays(w.id, 6)).pct;
      const umbral = Number(w.umbral ?? umbralRacha(s.estado));
      const previa = racha;
      if (pct >= umbral) racha = previa + 1;
      else if (!w.escudoUsado) racha = 0;
      s.patch('semanas', w.id, { cumplimiento: pct, rachaPrevia: previa, racha });
    }
    s.fijarAjuste('racha', racha);
  });
  return racha;
}

/* ------------------------------------------------------------------ */
/* Tienda: precios en bloque y pausa                                   */
/* ------------------------------------------------------------------ */

/**
 * Sube o baja en un % los precios de un grupo de artículos (redondeando y
 * respetando los suelos de precio). moneda: 'semana' | 'hucha' | 'estrellas' | 'todas'.
 */
export function ajustarPrecios(store, { pct, moneda = 'todas', soloOcio = false }) {
  const p = Number(pct);
  if (!Number.isFinite(p) || p === 0 || p < -80 || p > 300) return { ok: false, razon: 'Elige un porcentaje entre −80 % y +300 %.' };
  let n = 0;
  store.lote((s) => {
    for (const a of Object.values(s.estado.tienda || {})) {
      const mon = a.moneda || 'semana';
      if (moneda !== 'todas' && mon !== moneda) continue;
      if (soloOcio && a.tipo === 'premio') continue;
      const nuevo = Math.max(Number(a.precioMinimo || 0), 1, Math.round(Number(a.precio || 0) * (1 + p / 100)));
      if (nuevo !== a.precio) { s.patch('tienda', a.id, { precio: nuevo }); n++; }
    }
  });
  return { ok: true, cambiados: n };
}

export function tiendaPausada(estado) {
  return Boolean(leerParametro(estado, 'tiendaPausada', false));
}

/** Resumen de las tres cuentas para la cabecera de Economía. */
export function resumenCuentas(estado, fecha = toDateKey(new Date())) {
  return {
    creditos: saldoCreditos(estado, fecha),
    hucha: saldoHucha(estado),
    estrellas: saldoEstrellas(estado),
    modo: modoSaldo(estado),
  };
}

/** ¿Puede Nil sacar de la hucha él solo? (Reglas → Hucha). */
export function puedeSacarNil(estado) {
  return leerParametro(estado, 'huchaSacarNil', true) !== false;
}

/* ------------------------------------------------------------------ */
/* Categorías editables                                                */
/* ------------------------------------------------------------------ */

// Copia de las categorías de fábrica: lo personalizado se aplica encima y
// se puede volver atrás sin perder nada.
const CATEGORIAS_FABRICA = JSON.parse(JSON.stringify(CATEGORIAS));

/**
 * Aplica los nombres e iconos que el padre ha puesto a los grupos de tareas
 * (y los grupos nuevos que haya creado). Se llama antes de cada pintado.
 */
export function aplicarCategorias(estado) {
  const propias = leerParametro(estado, 'categoriasPersonalizadas', null) || {};
  for (const k of Object.keys(CATEGORIAS)) {
    if (!CATEGORIAS_FABRICA[k] && !propias[k]) delete CATEGORIAS[k];
  }
  for (const [k, base] of Object.entries(CATEGORIAS_FABRICA)) {
    CATEGORIAS[k] = { ...base, ...(propias[k] || {}) };
  }
  for (const [k, v] of Object.entries(propias)) {
    if (!CATEGORIAS_FABRICA[k]) CATEGORIAS[k] = { color: PALETA_CATEGORIAS[0], orden: 40, ...v };
  }
  return CATEGORIAS;
}

export function editarCategoria(store, id, { etiqueta, icono }) {
  const nombre = String(etiqueta || '').trim().slice(0, 24);
  if (!nombre) return { ok: false, razon: 'Ponle un nombre al grupo.' };
  const propias = { ...(store.ajuste('categoriasPersonalizadas', null) || {}) };
  const clave = id || `c_${Date.now().toString(36)}`;
  const n = Object.keys(propias).filter((k) => !CATEGORIAS_FABRICA[k]).length;
  propias[clave] = {
    ...(propias[clave] || {}),
    etiqueta: nombre,
    icono: String(icono || '•').trim().slice(0, 3) || '•',
    ...(!CATEGORIAS_FABRICA[clave] && !propias[clave]?.color
      ? { color: PALETA_CATEGORIAS[(n + 3) % PALETA_CATEGORIAS.length], orden: 30 + n } : {}),
  };
  store.fijarAjuste('categoriasPersonalizadas', propias);
  aplicarCategorias(store.estado);
  return { ok: true, id: clave };
}

/** Vuelve un grupo de fábrica a su nombre original. */
export function restaurarCategoria(store, id) {
  const propias = { ...(store.ajuste('categoriasPersonalizadas', null) || {}) };
  if (!CATEGORIAS_FABRICA[id]) return { ok: false, razon: 'Solo los grupos de fábrica se restauran.' };
  delete propias[id];
  store.fijarAjuste('categoriasPersonalizadas', propias);
  aplicarCategorias(store.estado);
  return { ok: true };
}

export function esCategoriaDeFabrica(id) { return Boolean(CATEGORIAS_FABRICA[id]); }

export { precioEfectivo };
