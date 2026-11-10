/**
 * ECONOMÍA (v3.5) — la sección dedicada del panel del padre, el catálogo
 * completo y la pantalla de «días pasados».
 *
 *   Economía → Resumen · Histórico · Herramientas · Reglas · Avanzado
 *
 * Todo lo que aquí se pinta sale del ledger a través de core/gestion.js.
 */

import { esc, escAttr, vacio, dato } from './dom.js';
import {
  formatoFechaCorta, formatoFechaLarga, nombreDiaCorto, weekdayIndex, addDays, weekDays, textoDuracion,
} from '../core/util.js';
import { saldoHucha, saldoEstrellas, saldoProvisional, saldoCreditos, modoSaldo } from '../core/ledger.js';
import { informeSalud, AMBITOS_MULTIPLICADOR, precioEfectivo, estadoObjetivo } from '../core/economy.js';
import { CATEGORIAS } from '../core/defaults.js';
import { GRUPOS, leerParametro, simular } from '../core/tokenomics.js';
import { tareasDelDia, cumplimientoDia } from '../core/tasks.js';
import { stakings, stakingsActivos, capitalBloqueado, resumenStaking, TIPOS_STAKING } from '../core/staking.js';
import {
  historico, anulable, ETIQUETA_TIPO, ETIQUETA_CUENTA, ETIQUETA_ACTOR, INSTRUMENTOS_AVANZADOS,
  instrumentoEncendido, tiendaPausada, DIAS_ATRAS, tareasDeDiaPasado, fechaRecuperable,
} from '../core/gestion.js';

export const PESTANAS_ECONOMIA = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'historico', etiqueta: 'Histórico' },
  { id: 'herramientas', etiqueta: 'Herramientas' },
  { id: 'reglas', etiqueta: 'Reglas' },
  { id: 'avanzado', etiqueta: 'Avanzado' },
];

const ICONO_CUENTA = { semana: '🟢', hucha: '🐷', estrellas: '⭐' };

function signo(n) { return `${n >= 0 ? '+' : ''}${n}`; }

/** Una línea del histórico. `conAcciones` añade anular / vetar. */
export function filaMovimiento(estado, m, { conAcciones = true, conSaldo = true } = {}) {
  const anulado = Boolean(m.anuladoPor);
  const marca = m.refTipo === 'tarea' ? estado.marcas?.[m.refId] : null;
  const puedeVetar = conAcciones && marca && !anulado && m.tipo === 'ganado' && marca.tipo !== 'habito'
    && (marca.estado === 'aprobada' || marca.estado === 'pendiente');
  const quien = ETIQUETA_ACTOR[m.actor] || m.actor || '';
  return `
    <div class="movimiento${anulado ? ' anulado' : ''}">
      <span class="mini tenue nowrap" style="width:44px">${esc(formatoFechaCorta(m.fecha))}</span>
      <div class="crece">
        <div class="truncar">${esc(ICONO_CUENTA[m.cuenta] || '•')} ${esc(m.concepto)}</div>
        <div class="mini tenue">${esc(ETIQUETA_TIPO[m.tipo] || m.tipo)}${quien ? ` · ${esc(quien)}` : ''}${m.provisional ? ' · sin aprobar' : ''}${anulado ? ' · anulado' : ''}${conSaldo && m.saldoTras !== undefined ? ` · queda ${esc(String(m.saldoTras))}` : ''}</div>
      </div>
      <span class="cant ${m.cantidad >= 0 ? 'mas' : 'menos'}">${esc(signo(m.cantidad))}</span>
      ${conAcciones && anulable(m) ? `<button class="btn pequeno fantasma" data-accion="anular-mov" data-mov="${escAttr(m.id)}" aria-label="Anular este movimiento" title="Anular">↩︎</button>` : ''}
      ${puedeVetar ? `<button class="btn pequeno fantasma" data-accion="vetar-marca" data-marca="${escAttr(marca.id)}" aria-label="Vetar esta tarea" title="Vetar">✕</button>` : ''}
    </div>`;
}

/* ================================================================== */
/* ECONOMÍA                                                            */
/* ================================================================== */

export function tabEconomia(ctx) {
  const sub = PESTANAS_ECONOMIA.some((p) => p.id === ctx.ui.ecoTab) ? ctx.ui.ecoTab : 'resumen';
  const cuerpo = {
    resumen: ecoResumen, historico: ecoHistorico, herramientas: ecoHerramientas,
    reglas: ecoReglas, avanzado: ecoAvanzado,
  }[sub];
  return `
    <div class="pestanas sub" role="tablist" aria-label="Economía">
      ${PESTANAS_ECONOMIA.map((p) => `<button role="tab" aria-selected="${p.id === sub}"
        data-accion="eco-tab" data-tab="${escAttr(p.id)}">${esc(p.etiqueta)}</button>`).join('')}
    </div>
    ${cuerpo(ctx)}`;
}

function cabeceraSaldos(ctx) {
  const { estado, hoy, weekId } = ctx;
  const prov = saldoProvisional(estado, weekId);
  return `
    <div class="tarjeta compacta">
      <div class="rejilla tres">
        ${dato(saldoCreditos(estado, hoy), 'Créditos')}
        ${dato(saldoHucha(estado), 'Hucha')}
        ${dato(saldoEstrellas(estado), 'Estrellas')}
      </div>
      <p class="mini tenue" style="margin:8px 0 0">
        ${prov > 0 ? `${esc(String(prov))} créditos aún sin aprobar · ` : ''}${capitalBloqueado(estado) ? `${esc(String(capitalBloqueado(estado)))} en depósitos · ` : ''}
        ${modoSaldo(estado) === 'continuo' ? 'Saldo continuo: los créditos no caducan.' : 'Cierre semanal activado: el domingo lo que sobra cae a la hucha.'}
        ${tiendaPausada(estado) ? ' <b style="color:var(--aviso)">Tienda en pausa.</b>' : ''}
      </p>
    </div>`;
}

function ecoResumen(ctx) {
  const { estado, hoy } = ctx;
  const salud = informeSalud(estado, hoy);
  const objetivo = estadoObjetivo(estado, hoy);
  const colorDiag = { generoso: 'var(--aviso)', ajustado: 'var(--peligro)', equilibrado: 'var(--exito)' }[salud.diagnostico] || 'var(--tenue)';
  const ultimos = historico(estado).slice(0, 8);
  return `
    ${cabeceraSaldos(ctx)}

    <div class="tarjeta">
      <h2>Lo más usado</h2>
      <div class="rejilla dos">
        <button class="btn principal" data-accion="ajuste-manual" data-modo="sumar">＋ Añadir puntos</button>
        <button class="btn" data-accion="ajuste-manual" data-modo="quitar">－ Quitar puntos</button>
        <button class="btn" data-accion="tab-padre" data-tab="dias">📅 Recuperar un día</button>
        <button class="btn" data-accion="traspaso-padre">🐷 Mover a / desde la hucha</button>
      </div>
      <p class="mini tenue" style="margin:10px 0 0">Siempre con un motivo: Nil lo ve en su ahorro, y queda en el histórico.</p>
    </div>

    <div class="tarjeta">
      <h2>Salud económica</h2>
      <div class="rejilla tres" style="margin-bottom:10px">
        ${dato(salud.mediaGanado, 'Ganado/sem')}
        ${dato(salud.mediaGastado, 'Gastado/sem')}
        ${dato(`${salud.tasaGasto}%`, 'Se gasta')}
      </div>
      <div class="chip" style="border-color:${escAttr(colorDiag)};color:${escAttr(colorDiag)}">${esc(salud.diagnostico)}</div>
      <p class="mini" style="margin:8px 0 0">${esc(salud.mensaje)}</p>
      ${objetivo && !objetivo.roto ? `<p class="mini tenue" style="margin:6px 0 0">Objetivo de Nil: ${esc(objetivo.articulo.nombre)} — le faltan ${esc(String(objetivo.faltante))}${objetivo.semanasEstimadas !== null ? ` (unas ${esc(String(objetivo.semanasEstimadas))} semanas a su ritmo)` : ''}.</p>` : ''}
    </div>

    <div class="tarjeta">
      <div class="fila sep" style="margin-bottom:6px">
        <h2 style="margin:0">Últimos movimientos</h2>
        <button class="btn pequeno fantasma" data-accion="eco-tab" data-tab="historico">Ver todo</button>
      </div>
      ${ultimos.length ? ultimos.map((m) => filaMovimiento(estado, m)).join('') : vacio('Todavía no hay movimientos.', '📒')}
    </div>`;
}

const TIPOS_FILTRO = [
  { id: 'todos', etiqueta: 'Todos los tipos' },
  { id: 'ganado', etiqueta: 'Ganado' },
  { id: 'gastado', etiqueta: 'Gastado' },
  { id: 'ajuste', etiqueta: 'Ajustes de papá' },
  { id: 'anulacion', etiqueta: 'Anulaciones' },
  { id: 'traspaso', etiqueta: 'Traspasos' },
];

function ecoHistorico(ctx) {
  const { estado } = ctx;
  const f = ctx.ui.ecoFiltros || {};
  const lista = historico(estado, f);
  const limite = ctx.ui.ecoLimite || 60;
  const entra = lista.filter((m) => m.cantidad > 0).reduce((s, m) => s + m.cantidad, 0);
  const sale = lista.filter((m) => m.cantidad < 0).reduce((s, m) => s + m.cantidad, 0);
  const opt = (v, actual, et) => `<option value="${escAttr(v)}" ${v === (actual || '') ? 'selected' : ''}>${esc(et)}</option>`;
  return `
    <div class="tarjeta">
      <h2>Histórico completo</h2>
      <div class="rejilla dos">
        <div><label for="hf-cuenta">Cuenta</label>
          <select id="hf-cuenta" data-filtro="cuenta">
            ${opt('todas', f.cuenta || 'todas', 'Todas')}${opt('semana', f.cuenta, 'Créditos')}${opt('hucha', f.cuenta, 'Hucha')}${opt('estrellas', f.cuenta, 'Estrellas')}
          </select></div>
        <div><label for="hf-tipo">Tipo</label>
          <select id="hf-tipo" data-filtro="tipo">
            ${TIPOS_FILTRO.map((t) => opt(t.id, f.tipo || 'todos', t.etiqueta)).join('')}
          </select></div>
        <div><label for="hf-desde">Desde</label>
          <input id="hf-desde" type="date" data-filtro="desde" value="${escAttr(f.desde || '')}"></div>
        <div><label for="hf-hasta">Hasta</label>
          <input id="hf-hasta" type="date" data-filtro="hasta" value="${escAttr(f.hasta || '')}"></div>
      </div>
      <label for="hf-texto">Buscar en el concepto o el motivo</label>
      <input id="hf-texto" type="search" data-filtro="texto" maxlength="40" value="${escAttr(f.texto || '')}" placeholder="p. ej. lavavajillas">
      <div class="fila sep" style="margin-top:10px">
        <span class="mini tenue">${esc(String(lista.length))} movimientos · entra ${esc(signo(Math.round(entra * 100) / 100))} · sale ${esc(String(Math.round(sale * 100) / 100))}</span>
        <span class="fila" style="gap:6px">
          <button class="btn pequeno fantasma" data-accion="limpiar-filtros">Limpiar</button>
          <button class="btn pequeno" data-accion="exportar-csv">⬇️ CSV</button>
        </span>
      </div>
    </div>

    <div class="tarjeta">
      ${lista.length ? lista.slice(0, limite).map((m) => filaMovimiento(estado, m)).join('') : vacio('Nada con estos filtros.', '🔎')}
      ${lista.length > limite ? `<button class="btn bloque fantasma" style="margin-top:8px" data-accion="mas-movimientos">Ver ${esc(String(Math.min(60, lista.length - limite)))} más</button>` : ''}
      <p class="mini tenue" style="margin:10px 0 0">
        Nada se borra nunca: para deshacer, ↩︎ anula el movimiento con un motivo y la anulación queda a la vista.
        Las tareas se deshacen con ✕ (vetar). «Queda» es el saldo de esa cuenta justo después del movimiento.
      </p>
    </div>`;
}

function ecoHerramientas(ctx) {
  const { estado } = ctx;
  const mult = Number(leerParametro(estado, 'multiplicadorValor', 1));
  const ambito = leerParametro(estado, 'multiplicadorAmbito', 'siempre');
  const amb = AMBITOS_MULTIPLICADOR.find((a) => a.id === ambito);
  const rango = ambito === 'rango'
    ? ` del ${formatoFechaCorta(leerParametro(estado, 'multiplicadorDesde', '') || '')} al ${formatoFechaCorta(leerParametro(estado, 'multiplicadorHasta', '') || '')}` : '';
  const pausada = tiendaPausada(estado);
  return `
    ${cabeceraSaldos(ctx)}
    <div class="tarjeta">
      <h2>Puntos</h2>
      <div class="rejilla dos">
        <button class="btn principal" data-accion="ajuste-manual" data-modo="sumar">＋ Añadir puntos</button>
        <button class="btn" data-accion="ajuste-manual" data-modo="quitar">－ Quitar puntos</button>
        <button class="btn" data-accion="traspaso-padre">🐷 Hucha ⇄ créditos</button>
        <button class="btn" data-accion="tarea-puntual">⭐ Tarea puntual</button>
      </div>
      <p class="mini tenue" style="margin:10px 0 0">En créditos, hucha o estrellas, hoy o hasta ${esc(String(DIAS_ATRAS))} días atrás. El motivo es obligatorio.</p>
    </div>

    <div class="tarjeta">
      <h2>Ritmo</h2>
      <button class="btn bloque" data-accion="multiplicador">✖️ Multiplicador de lo ganado</button>
      <p class="mini tenue" style="margin:8px 0 0">Ahora: <b>x${esc(String(mult))}</b> (${esc(amb ? amb.etiqueta : ambito)}${esc(rango)}). Solo afecta a lo ganado, nunca a precios ni estrellas.</p>
    </div>

    <div class="tarjeta">
      <h2>Tienda</h2>
      <div class="rejilla dos">
        <button class="btn" data-accion="precios-bloque">％ Subir o bajar precios</button>
        <button class="btn ${pausada ? 'principal' : ''}" data-accion="pausar-tienda">${pausada ? '▶️ Reabrir la tienda' : '⏸️ Pausar la tienda'}</button>
      </div>
      <p class="mini tenue" style="margin:8px 0 0">Pausar no toca saldos: solo impide pedir cosas nuevas hasta que la reabras.</p>
    </div>

    <div class="tarjeta">
      <h2>Informes</h2>
      <div class="rejilla dos">
        <button class="btn" data-accion="descargar-resumen">⬇️ Resumen semanal</button>
        <button class="btn" data-accion="exportar-csv">⬇️ Histórico (CSV)</button>
      </div>
    </div>`;
}

/* Campos de Reglas que pertenecen a un instrumento avanzado: si está
   apagado, no se enseñan (se encienden en Avanzado). */
const CAMPO_INSTRUMENTO = {
  bonoRachaCreditos: 'bonoRacha',
  bonoNocheCumplida: 'bonosSueno', bonoRachaSuenoNoches: 'bonosSueno', bonoRachaSueno: 'bonosSueno',
  escudoCadaSemanas: 'escudos', escudosMaximos: 'escudos',
};
const GRUPO_INSTRUMENTO = { apuesta: 'apuesta', sueno: 'sueno', misiones: 'misiones' };

function encendido(estado, id) {
  const inst = INSTRUMENTOS_AVANZADOS.find((i) => i.id === id);
  return inst ? instrumentoEncendido(estado, inst) : true;
}

export function gruposVisibles(estado) {
  return GRUPOS
    .filter((g) => !GRUPO_INSTRUMENTO[g.id] || encendido(estado, GRUPO_INSTRUMENTO[g.id]))
    .map((g) => ({ ...g, campos: g.campos.filter((c) => !CAMPO_INSTRUMENTO[c.id] || encendido(estado, CAMPO_INSTRUMENTO[c.id])) }))
    .filter((g) => g.campos.length);
}

function campoTokenomics(estado, campo) {
  const valor = leerParametro(estado, campo.id, '');
  const id = `tk-${campo.id}`;
  let control = '';
  if (campo.tipo === 'bool') {
    control = `<div class="campo-linea">
      <input type="checkbox" id="${escAttr(id)}" data-tk="${escAttr(campo.id)}" ${valor ? 'checked' : ''}>
      <label for="${escAttr(id)}">${valor ? 'Activado' : 'Desactivado'}</label>
    </div>`;
  } else if (campo.tipo === 'opcion') {
    control = `<select id="${escAttr(id)}" data-tk="${escAttr(campo.id)}">
      ${(campo.opciones || []).map((o) => `<option value="${escAttr(o.id)}" ${o.id === valor ? 'selected' : ''}>${esc(o.etiqueta)}</option>`).join('')}
    </select>`;
  } else if (campo.tipo === 'hora') {
    control = `<input type="time" id="${escAttr(id)}" data-tk="${escAttr(campo.id)}" value="${escAttr(String(valor || '00:00'))}">`;
  } else if (campo.tipo === 'texto') {
    control = `<input type="text" id="${escAttr(id)}" data-tk="${escAttr(campo.id)}" maxlength="${escAttr(String(campo.max || 30))}" value="${escAttr(String(valor ?? ''))}">`;
  } else {
    const paso = campo.tipo === 'decimal' ? (campo.paso || 0.1) : 1;
    control = `<div class="con-sufijo">
      <input type="number" id="${escAttr(id)}" data-tk="${escAttr(campo.id)}"
        min="${escAttr(String(campo.min ?? 0))}" max="${escAttr(String(campo.max ?? 9999))}"
        step="${escAttr(String(paso))}" value="${escAttr(String(valor ?? 0))}">
      ${campo.sufijo ? `<span class="suf">${esc(campo.sufijo)}</span>` : ''}
    </div>`;
  }
  return `<div class="tk-campo">
    <label for="${escAttr(id)}">${esc(campo.etiqueta)}</label>
    ${campo.ayuda ? `<p class="ayuda">${esc(campo.ayuda)}</p>` : ''}
    ${control}
  </div>`;
}

function ecoReglas(ctx) {
  const { estado, weekId } = ctx;
  const sim = simular(estado, { tareasDelDiaFn: tareasDelDia, diasMuestra: weekDays(weekId) });
  const abiertos = ctx.ui.tkAbiertos || ['monedas'];
  return `
    <div class="tarjeta">
      <h2>Simulación con los valores de ahora</h2>
      <div class="rejilla tres" style="margin-bottom:10px">
        ${dato(sim.ganadoSemana, 'Ganable/sem')}
        ${dato(sim.tercio, 'Tercio del día')}
        ${dato(sim.sobrante, 'Sobrante/sem')}
      </div>
      <p class="mini tenue" style="margin:0">
        Si cumpliera todo, ganaría <b>${esc(String(sim.ganadoSemana))}</b> créditos a la semana. El ocio básico está en
        <b>${esc(String(sim.ocioBasico))}</b> y el extra en <b>${esc(String(sim.ocioExtra))}</b>; gastando los dos cada día
        laborable le quedarían <b>${esc(String(sim.sobrante))}</b> para ahorrar${sim.semanasPremioMedio !== null
          ? `: unas <b>${esc(String(sim.semanasPremioMedio))}</b> semanas por premio grande.` : '.'}
      </p>
    </div>
    <div class="tarjeta compacta">
      <p class="mini tenue" style="margin:0">
        Las reglas de siempre, como en la v2: créditos, estrellas, hucha con interés y depósito a plazo.
        Lo demás está apagado y escondido en <b>Avanzado</b>. Cada cambio se guarda al momento.
      </p>
    </div>
    ${gruposVisibles(estado).map((g) => `
      <details class="tk-grupo" data-grupo-tk="${escAttr(g.id)}" ${abiertos.includes(g.id) ? 'open' : ''}>
        <summary>${esc(g.titulo)}<span class="tk-resumen">${esc(g.resumen)}</span></summary>
        <div class="tk-cuerpo">${g.campos.map((c) => campoTokenomics(estado, c)).join('')}</div>
      </details>`).join('')}`;
}

function ecoAvanzado(ctx) {
  const { estado, hoy } = ctx;
  const activos = stakingsActivos(estado);
  return `
    <div class="tarjeta compacta">
      <p class="mini tenue" style="margin:0">
        Desde la v3.5 la economía es tan sencilla como la de la v2. Esto es lo que la v3 tenía de más:
        está apagado, pero nada se ha perdido. Si enciendes algo, aparece para Nil y sus reglas salen en «Reglas».
        Lo que ya estaba en marcha termina su curso aunque lo apagues.
      </p>
    </div>
    ${INSTRUMENTOS_AVANZADOS.map((i) => {
      const on = instrumentoEncendido(estado, i);
      return `
      <div class="tarjeta">
        <div class="fila sep">
          <h2 style="margin:0">${esc(i.nombre)}</h2>
          <button class="btn pequeno ${on ? '' : 'principal'}" data-accion="instrumento" data-id="${escAttr(i.id)}" data-on="${on ? '0' : '1'}">${on ? 'Apagar' : 'Encender'}</button>
        </div>
        <p class="mini tenue" style="margin:6px 0 0">${esc(i.texto)}</p>
        <p class="mini" style="margin:4px 0 0;color:${on ? 'var(--exito)' : 'var(--tenue)'}">${on ? 'Encendido' : 'Apagado'}</p>
      </div>`;
    }).join('')}
    <div class="tarjeta">
      <h2>En marcha ahora (${esc(String(activos.length))})</h2>
      ${activos.length ? activos.map((s) => `
        <div class="staking-card">
          <div class="fila sep"><span>${esc(TIPOS_STAKING[s.tipo].icono)} ${esc(TIPOS_STAKING[s.tipo].nombre)}</span><span class="cap">${esc(String(s.capital))}</span></div>
          <div class="mini tenue">${esc(resumenStaking(estado, s, hoy))}</div>
        </div>`).join('') : vacio('Nada bloqueado ahora mismo.', '🔓')}
      <p class="mini tenue" style="margin:10px 0 0">Cerrados en total: ${esc(String(stakings(estado).filter((s) => s.estado !== 'activo').length))}.</p>
    </div>`;
}

/* ================================================================== */
/* DÍAS PASADOS                                                        */
/* ================================================================== */

const ETIQUETA_ESTADO = {
  aprobada: '✓ hecha', pendiente: 'marcada, sin aprobar', vetada: 'vetada', nocumplida: 'no cumplida', 'sin-marcar': 'sin marcar',
};

export function tabDiasPasados(ctx) {
  const { estado, hoy } = ctx;
  const fecha = fechaRecuperable(ctx.ui.diaPasado, hoy) ? ctx.ui.diaPasado : addDays(hoy, -1);
  const dias = Array.from({ length: DIAS_ATRAS + 1 }, (_, i) => addDays(hoy, -i));
  const filas = tareasDeDiaPasado(estado, fecha);
  const faltan = filas.filter((f) => f.estado !== 'aprobada');
  const ganadoDia = Object.values(estado.ledger || {})
    .filter((m) => m.fecha === fecha && m.cantidad > 0 && m.tipo === 'ganado' && !m.anuladoPor && m.cuenta === 'semana')
    .reduce((s, m) => s + m.cantidad, 0);
  const cumple = cumplimientoDia(estado, fecha);
  // Lo que el padre va marcando se recuerda aunque la pantalla se repinte.
  const sel = ctx.ui.dpSel || {};
  const ops = ctx.ui.dpOp || {};
  const marcada = (t, est) => {
    const v = sel[`${fecha}|${t.id}`];
    return v === undefined ? est === 'pendiente' : v;
  };

  return `
    <div class="tarjeta">
      <h2>Recuperar un día</h2>
      <p class="mini tenue" style="margin:0 0 10px">
        ¿Se os olvidó marcar algo? Elige el día (hasta ${esc(String(DIAS_ATRAS))} atrás), marca las tareas y valídalas
        juntas. Los créditos quedan con la fecha de ese día y la racha se recalcula sola.
      </p>
      <div class="pestanas dias-pasados" role="tablist">
        ${dias.map((d) => {
          const c = cumplimientoDia(estado, d);
          const etq = d === hoy ? 'Hoy' : `${nombreDiaCorto(weekdayIndex(d))} ${formatoFechaCorta(d)}`;
          return `<button role="tab" aria-selected="${d === fecha}" data-accion="dia-pasado" data-fecha="${escAttr(d)}">${esc(etq)} <span class="mini">${esc(String(c.pct))}%</span></button>`;
        }).join('')}
      </div>
    </div>

    <div class="tarjeta">
      <div class="fila sep" style="margin-bottom:6px">
        <h2 style="margin:0">${esc(formatoFechaLarga(fecha))}</h2>
        <span class="chip">${esc(String(cumple.cumplidas))}/${esc(String(cumple.esperadas))} · +${esc(String(ganadoDia))}</span>
      </div>
      ${filas.length ? filas.map(({ tarea, marca, estado: est }) => {
        const hecha = est === 'aprobada';
        const valor = tarea.tipo === 'obligatoria' ? 'estrella' : tarea.tipo === 'eleccion' ? '' : `+${tarea.valor || 0}`;
        return `
        <label class="tarea dp-fila${hecha ? ' hecha' : ''}" style="cursor:${hecha ? 'default' : 'pointer'}">
          ${hecha ? '<span class="ic">✅</span>' : `<input type="checkbox" data-dp-tarea="${escAttr(tarea.id)}" data-dp-fecha="${escAttr(fecha)}" ${marcada(tarea, est) ? 'checked' : ''} style="width:22px;height:22px" aria-label="${escAttr(`Validar ${tarea.nombre}`)}">`}
          <span class="ic">${esc(tarea.icono || '•')}</span>
          <div class="crece">
            <div class="nom">${esc(tarea.nombre)}</div>
            <div class="meta">${esc(ETIQUETA_ESTADO[est] || est)}${marca && marca.motivo ? ` · ${esc(marca.motivo)}` : ''}</div>
            ${!hecha && tarea.tipo === 'eleccion' ? `<select data-dp-op="${escAttr(tarea.id)}" data-dp-fecha="${escAttr(fecha)}" style="margin-top:6px" aria-label="Opción">
              ${(tarea.opciones || []).map((o) => `<option value="${escAttr(o.id)}" ${(ops[`${fecha}|${tarea.id}`] || (marca && marca.opcionId)) === o.id ? 'selected' : ''}>${esc(o.etiqueta)} (+${esc(String(o.valor))})</option>`).join('')}
            </select>` : ''}
          </div>
          <div class="val">${esc(valor)}</div>
        </label>`;
      }).join('') : vacio('Ese día no tenía tareas.', '🍃')}
      ${faltan.length ? `
        <div class="rejilla dos" style="margin-top:12px">
          <button class="btn" data-accion="dp-todas" data-fecha="${escAttr(fecha)}">Marcar todo lo que falta</button>
          <button class="btn principal" data-accion="validar-dia-pasado" data-fecha="${escAttr(fecha)}">Validar las marcadas</button>
        </div>` : '<p class="mini" style="color:var(--exito);margin:10px 0 0">Ese día está completo.</p>'}
    </div>

    <div class="tarjeta">
      <h2>Algo más de ese día</h2>
      <div class="rejilla dos">
        <button class="btn" data-accion="tarea-puntual" data-fecha="${escAttr(fecha)}">⭐ Tarea que no estaba</button>
        <button class="btn" data-accion="ajuste-manual" data-fecha="${escAttr(fecha)}">± Puntos en ese día</button>
      </div>
      <p class="mini tenue" style="margin:8px 0 0">Una tarea puntual creada para ese día aparece arriba y se valida igual.</p>
    </div>`;
}

/* ================================================================== */
/* CATÁLOGO                                                            */
/* ================================================================== */

const GRUPOS_TIENDA = [
  { id: 'ocio', titulo: 'Ocio del día', ayuda: 'Bonos de pantalla y tiempo libre. Se pagan con créditos.', filtro: (a) => (a.moneda || 'semana') === 'semana' && a.tipo !== 'premio', moneda: 'semana', tipo: 'bono' },
  { id: 'premios', titulo: 'Premios', ayuda: 'Planes y privilegios. Se pagan con créditos.', filtro: (a) => (a.moneda || 'semana') === 'semana' && a.tipo === 'premio', moneda: 'semana', tipo: 'premio' },
  { id: 'grandes', titulo: 'Premios grandes', ayuda: 'Cosas que se consiguen ahorrando. Se pagan con la hucha.', filtro: (a) => a.moneda === 'hucha', moneda: 'hucha', tipo: 'premio' },
  { id: 'regalos', titulo: 'Regalos', ayuda: 'Regalos físicos. Se pagan con estrellas.', filtro: (a) => a.moneda === 'estrellas', moneda: 'estrellas', tipo: 'premio' },
];

const TIPO_TAREA = {
  estandar: 'normal', eleccion: 'a elegir', obligatoria: 'obligatoria', circadiana: 'de horario',
  puntual: 'puntual', preparacion: 'preparación', habito: 'hábito',
};

function diasTexto(t) {
  if (t.tipo === 'puntual') return t.fecha ? formatoFechaCorta(t.fecha) : 'sin fecha';
  const d = t.dias;
  if (!d || d === 'todos' || (Array.isArray(d) && d.length === 7)) return 'todos los días';
  return (Array.isArray(d) ? d : []).map((i) => nombreDiaCorto(i)).join(' ');
}

function valorTarea(t) {
  if (t.tipo === 'eleccion') return (t.opciones || []).map((o) => o.valor).join('/');
  if (t.tipo === 'obligatoria') return '⭐';
  return `${t.moneda === 'estrellas' || t.tipo === 'habito' ? '⭐' : '+'}${t.valor || 0}`;
}

export function tabCatalogo(ctx) {
  const { estado } = ctx;
  const tareas = Object.values(estado.tareas || {}).sort((a, b) => (a.orden || 999) - (b.orden || 999));
  const tienda = Object.values(estado.tienda || {}).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const porCat = {};
  for (const t of tareas) {
    const k = t.categoria in CATEGORIAS ? t.categoria : 'otros';
    if (!porCat[k]) porCat[k] = [];
    porCat[k].push(t);
  }
  const cats = Object.keys(porCat).sort((a, b) => (CATEGORIAS[a]?.orden || 50) - (CATEGORIAS[b]?.orden || 50));
  const pausada = tiendaPausada(estado);

  return `
    <div class="pestanas sub" role="tablist">
      <button role="tab" aria-selected="${ctx.ui.catTab !== 'tienda'}" data-accion="cat-tab" data-tab="tareas">Tareas (${esc(String(tareas.length))})</button>
      <button role="tab" aria-selected="${ctx.ui.catTab === 'tienda'}" data-accion="cat-tab" data-tab="tienda">Tienda (${esc(String(tienda.length))})</button>
    </div>
    ${ctx.ui.catTab === 'tienda' ? `
    <div class="tarjeta compacta">
      <p class="mini" style="margin:0 0 8px"><b>Lo que viene de fábrica es un ejemplo.</b> Adaptadlo a vuestro hijo:
        ✏️ cambia nombre, descripción, precio, tiempo, moneda, tope y visibilidad · ＋ añade uno nuevo ·
        desmarcar «Visible en la tienda» lo oculta sin borrarlo.</p>
      <div class="fila sep">
        <span class="mini tenue">％ precios en bloque · ⏸️ pausar la tienda.</span>
        <span class="fila" style="gap:6px">
          <button class="btn pequeno" data-accion="precios-bloque">％</button>
          <button class="btn pequeno ${pausada ? 'principal' : ''}" data-accion="pausar-tienda">${pausada ? '▶️' : '⏸️'}</button>
        </span>
      </div>
      ${pausada ? '<p class="mini" style="color:var(--aviso);margin:6px 0 0">La tienda está en pausa.</p>' : ''}
    </div>
    ${GRUPOS_TIENDA.map((g) => {
      const lista = tienda.filter(g.filtro);
      return `
      <div class="tarjeta">
        <div class="fila sep" style="margin-bottom:4px">
          <h2 style="margin:0">${esc(g.titulo)} (${esc(String(lista.length))})</h2>
          <button class="btn pequeno principal" data-accion="nuevo-premio" data-moneda="${escAttr(g.moneda)}" data-tipo="${escAttr(g.tipo)}">＋</button>
        </div>
        <p class="mini tenue" style="margin:0 0 6px">${esc(g.ayuda)}</p>
        ${lista.length ? lista.map((a) => `
          <div class="articulo">
            <span class="ic">${esc(a.icono || '🎁')}</span>
            <div class="crece">
              <div style="font-weight:600">${esc(a.nombre)}</div>
              <div class="mini tenue">${textoDuracion(a.duracion) ? `⏱ ${esc(textoDuracion(a.duracion))} · ` : ''}${a.precioMinimo ? `mínimo ${esc(String(a.precioMinimo))} · ` : ''}${a.topeSemanal ? `tope ${esc(String(a.topeSemanal))}/sem · ` : ''}${a.requiereAprobacion === false ? 'sin aprobación' : 'con aprobación'}${a.activo === false ? ' · oculto' : ''}</div>
            </div>
            <div class="precio">${esc(String(precioEfectivo(a)))}</div>
            <button class="btn pequeno fantasma" data-accion="editar-premio" data-articulo="${escAttr(a.id)}" aria-label="Editar">✏️</button>
          </div>`).join('') : vacio('Nada aquí todavía.', '🎁')}
      </div>`;
    }).join('')}` : `
    <div class="tarjeta compacta">
      <div class="fila sep">
        <span class="mini tenue">Tareas por grupo. ✏️ en el título cambia el nombre o el icono del grupo.</span>
        <span class="fila" style="gap:6px">
          <button class="btn pequeno" data-accion="nueva-categoria">＋ Grupo</button>
          <button class="btn pequeno principal" data-accion="nueva-tarea">＋ Tarea</button>
        </span>
      </div>
    </div>
    ${cats.map((k) => {
      const cat = CATEGORIAS[k] || CATEGORIAS.otros;
      return `
      <div class="tarjeta">
        <div class="fila sep" style="margin-bottom:6px">
          <h2 style="margin:0">${esc(cat.icono || '•')} ${esc(cat.etiqueta)} (${esc(String(porCat[k].length))})</h2>
          <span class="fila" style="gap:4px">
            <button class="btn pequeno fantasma" data-accion="editar-categoria" data-cat="${escAttr(k)}" aria-label="Editar el grupo">✏️</button>
            <button class="btn pequeno fantasma" data-accion="nueva-tarea" data-cat="${escAttr(k)}" aria-label="Nueva tarea en este grupo">＋</button>
          </span>
        </div>
        ${porCat[k].map((t) => `
          <div class="tarea">
            <span class="ic">${esc(t.icono || '•')}</span>
            <div class="crece">
              <div class="nom">${esc(t.nombre)}</div>
              <div class="meta">${esc(TIPO_TAREA[t.tipo] || t.tipo)} · ${esc(diasTexto(t))}${t.requiereAprobacion === false && t.tipo !== 'habito' ? ' · sin aprobación' : ''}${t.activa === false ? ' · desactivada' : ''}</div>
            </div>
            <div class="val">${esc(valorTarea(t))}</div>
            <button class="btn pequeno fantasma" data-accion="editar-tarea" data-tarea="${escAttr(t.id)}" aria-label="Editar">✏️</button>
          </div>`).join('')}
      </div>`;
    }).join('')}`}`;
}
