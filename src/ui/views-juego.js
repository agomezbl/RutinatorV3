/**
 * Las pantallas de la capa de juego: nivel, misiones, logros, colección de
 * fondos y las propuestas de Nil.
 *
 * Igual que el resto de la interfaz, aquí se construye HTML a mano y TODO dato
 * que venga de una persona (el motivo de una propuesta, el nombre de un premio)
 * pasa por esc()/escAttr() antes de entrar.
 */

import { esc, escAttr, vacio } from './dom.js';
import { formatoFechaCorta } from '../core/util.js';
import { nivelDe, resumenRacha, resumenLogros, HITOS_RACHA } from '../core/progreso.js';
import { misionesDelDia, misionSemanal, bonificacionDeMisiones, misionesActivas } from '../core/misiones.js';
import { estadoDeTemas, contarAbiertos, desbloqueosActivos } from '../core/desbloqueos.js';
import {
  propuestas, esperandoAlPadre, esperandoANil, TIPOS_PROPUESTA,
  propuestasActivas, limitePropuestas, propuestasAbiertas, retoDeLaSemana, RETOS,
} from '../core/propuestas.js';
import { saldoHucha } from '../core/ledger.js';
import { TEMAS, FAMILIAS } from '../themes/themes.js';

/* ==================================================================== */
/* NIVEL                                                                 */
/* ==================================================================== */

/** La barra de nivel. Es lo único de la app que no baja nunca. */
export function tarjetaNivel(ctx, { compacta = false } = {}) {
  const n = nivelDe(ctx.estado);
  const pie = n.maximo
    ? 'Nivel máximo. Ya está todo.'
    : `${n.falta} de experiencia para el nivel ${n.nivel + 1}`;
  return `
    <div class="tarjeta ${compacta ? 'compacta' : ''}">
      <div class="nivel-caja">
        <div class="nivel-medalla" data-nivel-medalla aria-hidden="true">${esc(String(n.nivel))}</div>
        <div class="nivel-datos">
          <div class="nivel-nombre">${esc(n.nombre)} <span class="tenue mini">· nivel ${esc(String(n.nivel))}</span></div>
          <div class="nivel-barra" role="progressbar" aria-valuenow="${escAttr(String(n.pct))}"
            aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del nivel">
            <span style="width:${escAttr(String(n.pct))}%"></span>
          </div>
          <div class="mini tenue" style="margin-top:5px">${esc(pie)}</div>
        </div>
      </div>
    </div>`;
}

/* ==================================================================== */
/* RACHA                                                                 */
/* ==================================================================== */

export function tarjetaRacha(ctx) {
  const r = resumenRacha(ctx.estado);
  const escudos = Array.from({ length: r.escudosMax }, (_, i) => (
    `<span class="${i < r.escudos ? '' : 'apagado'}" aria-hidden="true">🛡️</span>`
  )).join('');

  const hitos = HITOS_RACHA.map((h) => {
    const hecho = r.record >= h;
    return `<span class="chip ${hecho ? 'bien' : ''}" title="${escAttr(`${h} semanas`)}">${esc(String(h))}</span>`;
  }).join(' ');

  return `
    <div class="tarjeta">
      <h2>🔥 Mi racha</h2>
      <div class="rejilla tres">
        <div class="dato"><span class="v">${esc(String(r.actual))}</span><span class="e">semanas</span></div>
        <div class="dato"><span class="v">${esc(String(r.record))}</span><span class="e">récord</span></div>
        ${r.escudosMax > 0 ? `<div class="dato">
          <span class="v escudos">${escudos}</span>
          <span class="e">escudos</span>
        </div>` : `<div class="dato"><span class="v">${esc(String(r.umbral))}%</span><span class="e">para subir</span></div>`}
      </div>
      <div class="mini tenue" style="margin-top:10px">Hitos: ${hitos}</div>
      ${r.proximo ? `<p class="mini" style="margin:9px 0 0">
        Te faltan <b>${esc(String(r.proximo.faltan))}</b> semanas para el hito de ${esc(String(r.proximo.hito))}.
      </p>` : ''}
      <p class="mini tenue" style="margin:9px 0 0">
        ${r.escudosMax > 0 ? `Un escudo se gana cada ${esc(String(r.cadaCuantas))} semanas seguidas y te salva un fallo solo,
        sin que tengas que hacer nada. ` : ''}La racha sube si cumples el ${esc(String(r.umbral))} % de la semana.
      </p>
    </div>`;
}

/* ==================================================================== */
/* MISIONES                                                              */
/* ==================================================================== */

function filaMision(m) {
  return `
    <div class="mision ${m.completa ? 'hecha' : ''}">
      <span class="ic" aria-hidden="true">${esc(m.completa ? '✅' : m.emoji)}</span>
      <div class="cuerpo">
        <div class="tit">${esc(m.titulo)}</div>
        ${m.ayuda ? `<div class="ayuda">${esc(m.ayuda)}</div>` : ''}
        <div class="pista-barra" role="progressbar"
          aria-valuenow="${escAttr(String(m.hecho))}" aria-valuemin="0" aria-valuemax="${escAttr(String(m.meta))}"
          aria-label="${escAttr(m.titulo)}">
          <span style="width:${escAttr(String(m.pct))}%"></span>
        </div>
        <div class="mini tenue" style="margin-top:4px">${esc(`${m.hecho} de ${m.meta}`)}</div>
      </div>
      <span class="premio">+${esc(String(Math.round(m.premio * 100)))} %</span>
    </div>`;
}

export function tarjetaMisiones(ctx, { compacta = false } = {}) {
  if (!misionesActivas(ctx.estado)) return '';
  const dia = misionesDelDia(ctx.estado, ctx.hoy);
  const semanal = misionSemanal(ctx.estado, ctx.hoy);
  if (!dia.length && !semanal) return '';
  const bono = bonificacionDeMisiones(ctx.estado, ctx.hoy);

  return `
    <div class="tarjeta">
      <h2>📜 Misiones de hoy</h2>
      <p class="mini tenue" style="margin:-4px 0 6px">
        No dan créditos: hacen que lo que ganes hoy valga más. Cambian cada día.
      </p>
      ${dia.map(filaMision).join('')}
      ${semanal && !compacta ? `<h3>Y esta semana</h3>${filaMision(semanal)}` : ''}
      ${bono.extra > 0 ? `<p class="mini" style="margin:10px 0 0">
        Llevas <b>+${esc(String(Math.round(bono.extra * 100)))} %</b> extra en todo lo que ganes hoy.
      </p>` : ''}
    </div>`;
}

/* ==================================================================== */
/* LOGROS                                                                */
/* ==================================================================== */

export function vistaLogros(ctx) {
  const { abiertos, total } = contarAbiertos(ctx.estado, TEMAS);
  const r = resumenLogros(ctx.estado, {
    hucha: saldoHucha(ctx.estado),
    nivel: nivelDe(ctx.estado).nivel,
    temasDesbloqueados: abiertos,
    temasTotales: total,
  });

  const tarjeta = (l) => {
    // Los secretos no enseñan la pista hasta que se consiguen: esa es la gracia.
    const oculto = l.secreto && !l.logrado;
    return `
      <div class="logro ${l.logrado ? '' : 'pendiente'}">
        <span class="em" aria-hidden="true">${esc(oculto ? '❔' : l.emoji)}</span>
        <div class="nm">${esc(oculto ? 'Secreto' : l.nombre)}</div>
        <div class="ps">${esc(oculto ? 'Aparecerá solo' : l.pista)}</div>
        ${l.fecha ? `<div class="ps">${esc(formatoFechaCorta(l.fecha))}</div>` : ''}
      </div>`;
  };

  const hechos = r.todos.filter((l) => l.logrado);
  const faltan = r.todos.filter((l) => !l.logrado);

  return `
    ${tarjetaNivel(ctx)}
    <div class="tarjeta">
      <h2>🏅 Mis logros</h2>
      <p class="mini tenue" style="margin:-4px 0 10px">
        ${esc(`${r.hechos} de ${r.total}`)} · ${esc(String(r.pct))} %
      </p>
      ${hechos.length
    ? `<div class="logros-rejilla">${hechos.map(tarjeta).join('')}</div>`
    : vacio('Aún no tienes ninguno. Marca tu primera tarea y verás.', '🏅')}
    </div>
    ${faltan.length ? `<div class="tarjeta">
      <h2>Por conseguir</h2>
      <div class="logros-rejilla">${faltan.map(tarjeta).join('')}</div>
    </div>` : ''}`;
}

/* ==================================================================== */
/* COLECCIÓN DE FONDOS                                                   */
/* ==================================================================== */

/**
 * El selector de fondos, que ahora es un mapa de progreso: se ve lo que tienes
 * y lo que te falta, con el requisito exacto de cada uno. Ver lo que queda por
 * delante es justo lo que hace que apetezca seguir.
 */
export function selectorTemas(ctx, { idActual, accion = 'tema' }) {
  const temas = estadoDeTemas(ctx.estado, TEMAS);
  const porFamilia = new Map();
  for (const t of temas) {
    const fam = FAMILIAS[t.familia] || t.familia;
    if (!porFamilia.has(fam)) porFamilia.set(fam, []);
    porFamilia.get(fam).push(t);
  }
  const { abiertos, total } = contarAbiertos(ctx.estado, TEMAS);

  const bloque = (fam, lista) => `
    <div class="grupo-titulo">${esc(fam)}</div>
    <div class="rejilla dos tres-md">
      ${lista.map((t) => {
    if (!t.abierto) {
      // Bloqueado: se ve la silueta y, sobre todo, qué falta exactamente.
      return `<div class="tema-opcion bloqueado" aria-label="${escAttr(`${t.nombre}: bloqueado`)}">
            <canvas class="mini-lienzo" data-tema-mini="${escAttr(t.id)}" width="220" height="165"></canvas>
            <div class="tema-candado">
              <span class="cd" aria-hidden="true">🔒</span>
              <span class="rq">${esc(t.falta || t.requisito)}</span>
            </div>
          </div>`;
    }
    return `<button class="tema-opcion ${idActual === t.id ? 'sel' : ''}"
          data-accion="${escAttr(accion)}" data-tema="${escAttr(t.id)}"
          aria-label="Tema ${escAttr(t.nombre)}" aria-pressed="${idActual === t.id}">
          <canvas class="mini-lienzo" data-tema-mini="${escAttr(t.id)}" width="220" height="165"></canvas>
          <span class="nombre">${esc(t.emoji)} ${esc(t.nombre)}</span>
        </button>`;
  }).join('')}
    </div>`;

  return `
    ${desbloqueosActivos(ctx.estado) ? `<p class="mini tenue" style="margin:-4px 0 10px">
      Tienes <b>${esc(String(abiertos))}</b> de ${esc(String(total))} fondos.
      Los demás se van abriendo según vas subiendo de nivel y consiguiendo cosas.
    </p>` : ''}
    ${[...porFamilia.entries()].map(([fam, lista]) => bloque(fam, lista)).join('')}`;
}

/* ==================================================================== */
/* PROPUESTAS (lado de Nil)                                              */
/* ==================================================================== */

function chipEstado(p) {
  const mapa = {
    pendiente: ['Esperando a papá', ''],
    contraoferta: ['Te ha contestado', 'aviso'],
    aceptada: ['Aceptada', 'bien'],
    rechazada: ['Rechazada', 'mal'],
    retirada: ['Retirada', ''],
  };
  const [texto, clase] = mapa[p.estado] || [p.estado, ''];
  return `<span class="chip ${escAttr(clase)}">${esc(texto)}</span>`;
}

function resumenPropuesta(p, estado) {
  if (p.tipo === 'tarea') return `Tarea nueva: “${p.nombre}” por ${p.valor} créditos`;
  if (p.tipo === 'valor') {
    const t = estado.tareas?.[p.tareaId];
    const ahora = t ? ` (ahora ${t.valor})` : '';
    return `“${t ? t.nombre : 'una tarea'}” debería valer ${p.valor}${ahora}`;
  }
  const moneda = p.moneda === 'estrellas' ? 'estrellas' : 'créditos';
  return `Premio nuevo: “${p.nombre}” por ${p.valor} ${moneda}`;
}

export function vistaPropuestas(ctx) {
  const activas = propuestasActivas(ctx.estado);
  const lista = propuestas(ctx.estado);
  const abiertas = propuestasAbiertas(ctx.estado).length;
  const limite = limitePropuestas(ctx.estado);

  const fila = (p) => `
    <div class="propuesta ${p.estado === 'contraoferta' ? 'contraoferta' : ''}">
      <div class="cab">
        <span aria-hidden="true">${esc(p.icono || '💡')}</span>
        <b class="crece">${esc(resumenPropuesta(p, ctx.estado))}</b>
        ${chipEstado(p)}
      </div>
      <div class="motivo">${esc(p.motivo)}</div>
      ${p.respuesta ? `<div class="respuesta"><b>Papá:</b> ${esc(p.respuesta)}</div>` : ''}
      ${p.estado === 'contraoferta' ? `
        <p class="mini" style="margin:6px 0 8px">
          Te ofrece <b>${esc(String(p.contraoferta))}</b> en vez de ${esc(String(p.valor))}.
        </p>
        <div class="acciones">
          <button class="btn pequeno" data-accion="aceptar-contra" data-id="${escAttr(p.id)}">Trato hecho</button>
          <button class="btn pequeno fantasma" data-accion="retirar-propuesta" data-id="${escAttr(p.id)}">Déjalo</button>
        </div>` : ''}
      ${p.estado === 'pendiente' ? `<div class="acciones">
        <button class="btn pequeno fantasma" data-accion="retirar-propuesta" data-id="${escAttr(p.id)}">Retirar</button>
      </div>` : ''}
    </div>`;

  return `
    <div class="tarjeta">
      <h2>💡 Mis propuestas</h2>
      <p class="mini tenue" style="margin:-4px 0 10px">
        Si crees que falta una tarea, que algo debería valer otra cosa o que hay un
        premio que tendría que estar en la tienda: dilo. Papá contesta siempre,
        y si dice que no, tiene que explicar por qué.
      </p>
      ${activas ? `
        <button class="btn" data-accion="nueva-propuesta"${abiertas >= limite ? ' disabled' : ''}>
          ✍️ Proponer algo
        </button>
        <p class="mini tenue" style="margin:8px 0 0">
          ${esc(abiertas >= limite
    ? `Ya tienes ${limite} esperando respuesta. Espera a que papá conteste.`
    : `Puedes tener ${limite} propuestas esperando a la vez. Llevas ${abiertas}.`)}
        </p>`
    : '<p class="mini tenue">Las propuestas están desactivadas ahora mismo.</p>'}
    </div>
    <div class="tarjeta">
      <h2>Historial</h2>
      ${lista.length ? lista.map(fila).join('') : vacio('Todavía no has propuesto nada.', '💡')}
    </div>`;
}

/* ==================================================================== */
/* RETO DE LA CASA                                                       */
/* ==================================================================== */

export function tarjetaReto(ctx) {
  const r = retoDeLaSemana(ctx.estado, ctx.hoy);
  if (!r || r.estado !== 'abierto') return '';
  return `
    <div class="reto-casa" style="margin-bottom:13px">
      <div class="fila sep">
        <b><span aria-hidden="true">${esc(r.emoji)}</span> Reto de la casa</b>
        <span class="chip ${r.conseguido ? 'bien' : ''}">${esc(r.conseguido ? '¡Conseguido!' : 'En marcha')}</span>
      </div>
      <div class="meta" style="margin-top:4px">
        ${esc(`${r.etiqueta}: ${r.hecho} de ${r.meta} ${r.unidad}`)}
      </div>
      <div class="nivel-barra" style="margin-top:7px">
        <span style="width:${escAttr(String(r.pct))}%"></span>
      </div>
      <div class="premio" style="margin-top:8px">En juego: ${esc(r.premio)}</div>
    </div>`;
}

export { TIPOS_PROPUESTA, RETOS, esperandoAlPadre, esperandoANil };
