/**
 * Panel del padre. Lenguaje algo más serio, misma exigencia de claridad.
 */

import { esc, escAttr, barra, vacio, dato } from './dom.js';
import {
  formatoFechaLarga, formatoFechaCorta, nombreDiaCorto, weekdayIndex, toDateKey, addDays,
} from '../core/util.js';
import { saldoSemana, saldoHucha, saldoProvisional, movimientosDe, TIPOS } from '../core/ledger.js';
import {
  pendientesDeAprobacion, cumplimientoSemana, rachaActual, umbralRacha, tareasDelDia,
} from '../core/tasks.js';
import { informeSalud, AMBITOS_MULTIPLICADOR, precioEfectivo, estadoObjetivo } from '../core/economy.js';
import { comprasDe } from '../core/leisure.js';
import { semanaArchivada, semanasPendientesDeCierre, datosDeSemana } from '../core/week.js';
import { CATEGORIAS } from '../core/defaults.js';
import { GRUPOS, leerParametro, simular } from '../core/tokenomics.js';
import { saldoEstrellas } from '../core/ledger.js';
import { propuestas, esperandoAlPadre, retoDeLaSemana } from '../core/propuestas.js';
import { stakings, stakingsActivos, capitalBloqueado, resumenStaking, TIPOS_STAKING } from '../core/staking.js';
import { weekDays, textoDuracion } from '../core/util.js';
import { tabEconomia, tabDiasPasados, tabCatalogo } from './views-economia.js';


export const PESTANAS_PADRE = [
  { id: 'aprobaciones', etiqueta: 'Aprobaciones' },
  { id: 'propuestas', etiqueta: 'Propuestas' },
  { id: 'economia', etiqueta: 'Economía' },
  { id: 'dias', etiqueta: 'Días pasados' },
  { id: 'catalogo', etiqueta: 'Catálogo' },
  { id: 'semana', etiqueta: 'Semana' },
  { id: 'sistema', etiqueta: 'Sistema' },
];

export function vistaPadre(ctx) {
  const tab = ctx.ui.tabPadre || 'aprobaciones';
  const cuerpo = {
    aprobaciones: tabAprobaciones,
    propuestas: tabPropuestas,
    economia: tabEconomia,
    dias: tabDiasPasados,
    catalogo: tabCatalogo,
    semana: tabSemana,
    sistema: tabSistema,
  }[tab] || tabAprobaciones;

  const pendientes = pendientesDeAprobacion(ctx.estado).length
    + comprasDe(ctx.estado).filter((c) => c.estado === 'pendiente').length;
  const propuestasNuevas = esperandoAlPadre(ctx.estado).length;

  return `
    <div class="banda-padre">
      <span>🔐</span>
      <div class="crece">Panel del padre · ${esc(ctx.estado.ajustes?.nombreHijo?.valor || 'Nil')}</div>
      <button class="btn pequeno fantasma" data-accion="salir-padre">Salir</button>
    </div>
    <div class="pestanas" role="tablist">
      ${PESTANAS_PADRE.map((p) => `<button role="tab" aria-selected="${p.id === tab}"
        data-accion="tab-padre" data-tab="${escAttr(p.id)}">${esc(p.etiqueta)}${
  p.id === 'aprobaciones' && pendientes ? ` (${pendientes})` : ''
}${
  p.id === 'propuestas' && propuestasNuevas ? ` (${propuestasNuevas})` : ''
}</button>`).join('')}
    </div>
    ${cuerpo(ctx)}`;
}

/* ---------------------------- PROPUESTAS -------------------------------- */

/**
 * Lo que Nil propone y lo que se puede hacer con ello. Rechazar exige motivo
 * a propósito: un "no" sin explicación enseña que el sistema es arbitrario, y
 * eso es exactamente lo contrario de lo que se busca aquí.
 */
function tabPropuestas(ctx) {
  const { estado } = ctx;
  const lista = propuestas(estado);
  const reto = retoDeLaSemana(estado, ctx.hoy);

  const resumen = (p) => {
    if (p.tipo === 'tarea') return `Tarea nueva: "${p.nombre}" por ${p.valor} créditos`;
    if (p.tipo === 'valor') {
      const t = estado.tareas?.[p.tareaId];
      return `"${t ? t.nombre : 'una tarea'}" debería valer ${p.valor}${t ? ` (ahora ${t.valor})` : ''}`;
    }
    const moneda = p.moneda === 'estrellas' ? 'estrellas' : 'créditos';
    return `Premio nuevo: "${p.nombre}" por ${p.valor} ${moneda}`;
  };

  const chip = (p) => {
    const mapa = {
      pendiente: ['Te toca', 'aviso'],
      contraoferta: ['Esperando a Nil', ''],
      aceptada: ['Aceptada', 'bien'],
      rechazada: ['Rechazada', 'mal'],
      retirada: ['Retirada', ''],
    };
    const [txt, cls] = mapa[p.estado] || [p.estado, ''];
    return `<span class="chip ${escAttr(cls)}">${esc(txt)}</span>`;
  };

  const fila = (p) => `
    <div class="propuesta ${p.estado === 'contraoferta' ? 'contraoferta' : ''}">
      <div class="cab">
        <span aria-hidden="true">${esc(p.icono || '💡')}</span>
        <b class="crece">${esc(resumen(p))}</b>
        ${chip(p)}
      </div>
      <div class="motivo">${esc(p.motivo)}</div>
      ${p.respuesta ? `<div class="respuesta"><b>Tú:</b> ${esc(p.respuesta)}</div>` : ''}
      ${p.estado === 'pendiente' ? `<div class="acciones">
        <button class="btn pequeno" data-accion="aceptar-propuesta" data-id="${escAttr(p.id)}">Aceptar</button>
        <button class="btn pequeno fantasma" data-accion="contraofertar" data-id="${escAttr(p.id)}">Contraoferta</button>
        <button class="btn pequeno peligro" data-accion="rechazar-propuesta" data-id="${escAttr(p.id)}">No</button>
      </div>` : ''}
      ${p.estado === 'contraoferta' ? `<p class="mini tenue" style="margin:6px 0 0">
        Le has ofrecido ${esc(String(p.contraoferta))}. Ahora decide él.
      </p>` : ''}
    </div>`;

  const abiertas = lista.filter((p) => p.estado === 'pendiente' || p.estado === 'contraoferta');
  const cerradas = lista.filter((p) => !abiertas.includes(p));

  return `
    <div class="tarjeta">
      <h2>🎯 Reto de la casa</h2>
      ${reto && reto.estado === 'abierto' ? `
        <p style="margin:0 0 6px"><b>${esc(reto.emoji)} ${esc(reto.etiqueta)}</b>:
          ${esc(`${reto.hecho} de ${reto.meta} ${reto.unidad}`)}</p>
        <div class="nivel-barra"><span style="width:${escAttr(String(reto.pct))}%"></span></div>
        <p class="mini tenue" style="margin:8px 0 0">En juego: ${esc(reto.premio)}.
          Se cierra solo al cerrar la semana.</p>`
    : `<p class="mini tenue" style="margin:0 0 10px">
          Un reto semanal que jugáis los dos y que Nil ve avanzar en su pantalla.
          Si no sale, no pasa nada: no hay castigo, solo el premio que pongas.
        </p>
        <button class="btn" data-accion="nuevo-reto">Lanzar un reto</button>`}
    </div>

    <div class="tarjeta">
      <h2>💡 Esperando respuesta</h2>
      ${abiertas.length ? abiertas.map(fila).join('')
    : vacio('Nada pendiente. Cuando Nil proponga algo aparece aquí.', '💡')}
    </div>

    ${cerradas.length ? `<div class="tarjeta">
      <h2>Ya contestadas</h2>
      ${cerradas.map(fila).join('')}
    </div>` : ''}`;
}

/* --------------------------- APROBACIONES ------------------------------- */

function tabAprobaciones(ctx) {
  const { estado } = ctx;
  const marcas = pendientesDeAprobacion(estado);
  const compras = comprasDe(estado).filter((c) => c.estado === 'pendiente')
    .sort((a, b) => (a.solicitadaEn || 0) - (b.solicitadaEn || 0));
  const horas = estado.ajustes?.autoAprobacionHoras?.valor ?? 12;

  return `
    <div class="tarjeta compacta">
      <p class="mini tenue" style="margin:0">
        Lo que no resuelvas se auto-aprueba a las ${esc(String(horas))} h. Vetar revierte el crédito automáticamente.
      </p>
    </div>

    <div class="tarjeta">
      <h2>Tareas pendientes (${marcas.length})</h2>
      ${marcas.length ? marcas.map((m) => `
        <div class="tarea">
          <div class="crece">
            <div class="nom">${esc(m.nombre)}</div>
            <div class="meta">
              ${esc(formatoFechaLarga(m.fecha))}
              ${m.opcionEtiqueta ? ` · ${esc(m.opcionEtiqueta)}` : ''}
              ${m.tipo === 'obligatoria' ? ' · obligatoria (0 créditos)' : ` · +${m.valor}`}
              · hace ${esc(hace(m.marcadaEn))}
            </div>
            ${(m.fotos || []).length ? `<div class="miniaturas">${m.fotos.map((f, i) => `
              <img src="${escAttr(f)}" alt="Foto ${i + 1}" data-accion="ver-foto" data-marca="${escAttr(m.id)}" data-src-idx="${i}">`).join('')}</div>` : ''}
          </div>
          <div class="pila">
            <button class="btn ok pequeno" data-accion="aprobar-marca" data-marca="${escAttr(m.id)}">✓</button>
            <button class="btn pequeno fantasma" data-accion="aprobar-con-nota" data-marca="${escAttr(m.id)}"
              title="Aprobar y decirle algo" aria-label="Aprobar y decirle algo">💬</button>
            <button class="btn peligro pequeno" data-accion="vetar-marca" data-marca="${escAttr(m.id)}">✕</button>
          </div>
        </div>`).join('')
        : vacio('Nada pendiente por aquí.', '✅')}
      ${marcas.length > 1 ? `<button class="btn bloque" style="margin-top:10px" data-accion="aprobar-todo">Aprobar todas</button>` : ''}
    </div>

    <div class="tarjeta">
      <h2>Compras pendientes (${compras.length})</h2>
      ${compras.length ? compras.map((c) => `
        <div class="articulo">
          <div class="crece">
            <div style="font-weight:600">${esc(c.nombre)}${textoDuracion(c.duracion) ? ` · ⏱ ${esc(textoDuracion(c.duracion))}` : ''}</div>
            <div class="mini tenue">${esc(formatoFechaLarga(c.fecha))} · ${c.precio} créditos (${esc(c.moneda)}) · hace ${esc(hace(c.solicitadaEn))}</div>
          </div>
          <div class="pila">
            <button class="btn ok pequeno" data-accion="aprobar-compra" data-compra="${escAttr(c.id)}">✓</button>
            <button class="btn peligro pequeno" data-accion="denegar-compra" data-compra="${escAttr(c.id)}">✕</button>
          </div>
        </div>`).join('')
        : vacio('Ninguna compra esperando.', '🛍️')}
    </div>`;
}

function hace(ts) {
  if (!ts) return '—';
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} días`;
}

/* ------------------------------ SEMANA ---------------------------------- */

function tabSemana(ctx) {
  const { estado, hoy, weekId } = ctx;
  const cumple = cumplimientoSemana(estado, weekId, hoy);
  const cerrada = semanaArchivada(estado, weekId);
  const pendientesCierre = semanasPendientesDeCierre(estado, hoy);
  const datos = datosDeSemana(estado, weekId, hoy);
  const cats = Object.entries(datos.porCategoria).sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? Math.max(...cats.map(([, v]) => v)) : 0;
  const archivos = Object.values(estado.semanas || {}).sort((a, b) => (a.id < b.id ? 1 : -1));

  return `
    <div class="tarjeta">
      <h2>Semana del ${esc(weekId)}</h2>
      <div class="rejilla tres" style="margin-bottom:10px">
        ${dato(datos.ganado, 'Ganado')}
        ${dato(datos.gastado, 'Gastado')}
        ${dato(`${cumple.pct}%`, 'Cumplido')}
      </div>
      ${barra(cumple.pct, cumple.pct >= umbralRacha(estado) ? 'var(--exito)' : 'var(--aviso)')}
      <p class="mini tenue" style="margin:8px 0 0">
        Umbral de racha: ${esc(String(umbralRacha(estado)))}% · racha actual ${rachaActual(estado)}.
        ${cerrada ? ' Esta semana ya está cerrada.' : ''}
      </p>
      <div class="rejilla dos" style="margin-top:12px">
        <button class="btn" data-accion="descargar-resumen">⬇️ Descargar resumen</button>
        <button class="btn ${cerrada ? '' : 'principal'}" data-accion="cerrar-semana" ${cerrada ? 'disabled' : ''}>Cerrar la semana</button>
      </div>
      ${pendientesCierre.length ? `<p class="mini" style="color:var(--aviso);margin:10px 0 0">
        Hay ${pendientesCierre.length} semana(s) anterior(es) sin cerrar: ${esc(pendientesCierre.join(', '))}.
        <button class="btn pequeno" data-accion="cerrar-pendientes">Cerrarlas</button></p>` : ''}
    </div>

    <div class="tarjeta">
      <h2>Día a día</h2>
      ${cumple.porDia.map((d) => `
        <div class="fila sep" style="padding:5px 0">
          <span class="mini nowrap" style="width:86px">${esc(nombreDiaCorto(weekdayIndex(d.fecha)))} ${esc(formatoFechaCorta(d.fecha))}</span>
          <div class="crece">${barra(d.pct, d.pct >= 70 ? 'var(--exito)' : 'var(--aviso)')}</div>
          <span class="mini tenue nowrap" style="width:52px;text-align:right">${d.cumplidas}/${d.esperadas}</span>
        </div>`).join('')}
    </div>

    <div class="tarjeta">
      <h2>Créditos por categoría</h2>
      ${cats.length ? cats.map(([k, v]) => {
        const cat = CATEGORIAS[k] || CATEGORIAS.otros;
        return `<div style="margin-bottom:8px">
          <div class="fila sep mini"><span>${esc(cat.icono)} ${esc(cat.etiqueta)}</span><b>${v}</b></div>
          ${barra(maxCat ? (v / maxCat) * 100 : 0, cat.color)}
        </div>`;
      }).join('') : vacio('Sin créditos ganados esta semana.', '📊')}
      <p class="mini tenue" style="margin:8px 0 0">Suma: ${cats.reduce((s, [, v]) => s + v, 0)} — mismo origen que el saldo, siempre cuadra.</p>
    </div>

    ${archivos.length ? `
    <div class="tarjeta">
      <h2>Semanas cerradas</h2>
      ${archivos.slice(0, 10).map((s) => `
        <div class="movimiento">
          <span class="mini tenue nowrap">${esc(s.id)}</span>
          <div class="crece mini">${s.cumplimiento}% · racha ${s.racha}</div>
          <span class="cant ${s.traspasadoAHucha >= 0 ? 'mas' : 'menos'}">${s.traspasadoAHucha > 0 ? `+${s.traspasadoAHucha} hucha` : s.arrastrado ? `${s.arrastrado} arrastre` : '0'}</span>
        </div>`).join('')}
    </div>` : ''}`;
}

/* ------------------------------ SISTEMA --------------------------------- */

function tabSistema(ctx) {
  const { estado, sync } = ctx;
  const a = estado.ajustes || {};
  const v = (k, d) => (a[k]?.valor ?? d);
  const e = ctx.sync ? ctx.sync.estado : { activo: false, mensaje: 'No disponible' };

  return `
    <div class="tarjeta">
      <h2>Aprobación y racha</h2>
      <label for="aj-horas">Auto-aprobación (horas sin actuar)</label>
      <input id="aj-horas" type="number" min="1" max="72" value="${escAttr(String(v('autoAprobacionHoras', 12)))}" data-ajuste="autoAprobacionHoras" data-tipo="numero">
      <label for="aj-umbral">Umbral de racha (%)</label>
      <input id="aj-umbral" type="number" min="10" max="100" value="${escAttr(String(v('umbralRacha', 70)))}" data-ajuste="umbralRacha" data-tipo="numero">
      <label for="aj-nombre">Nombre del hijo</label>
      <input id="aj-nombre" type="text" maxlength="24" value="${escAttr(String(v('nombreHijo', 'Nil')))}" data-ajuste="nombreHijo" data-tipo="texto">
    </div>

    <div class="tarjeta">
      <h2>Ritmo circadiano</h2>
      <div class="rejilla dos">
        <div><label for="aj-cena1">Cena entre semana</label>
          <input id="aj-cena1" type="time" value="${escAttr(String(v('cenaEntreSemana', '20:30')))}" data-ajuste="cenaEntreSemana" data-tipo="texto"></div>
        <div><label for="aj-cena2">Cena fin de semana</label>
          <input id="aj-cena2" type="time" value="${escAttr(String(v('cenaFinde', '21:00')))}" data-ajuste="cenaFinde" data-tipo="texto"></div>
        <div><label for="aj-dor1">Dormir entre semana</label>
          <input id="aj-dor1" type="time" value="${escAttr(String(v('dormirEntreSemana', '22:00')))}" data-ajuste="dormirEntreSemana" data-tipo="texto"></div>
        <div><label for="aj-dor2">Dormir fin de semana</label>
          <input id="aj-dor2" type="time" value="${escAttr(String(v('dormirFinde', '23:00')))}" data-ajuste="dormirFinde" data-tipo="texto"></div>
      </div>
      <div class="rejilla dos">
        <div><label for="aj-corte">Corte del ocio entre semana</label>
          <input id="aj-corte" type="time" value="${escAttr(String(v('horaCorteOcio', '21:30')))}" data-ajuste="horaCorteOcio" data-tipo="texto"></div>
        <div><label for="aj-corte2">Corte del ocio fin de semana</label>
          <input id="aj-corte2" type="time" value="${escAttr(String(v('horaCorteOcioFinde', '22:30')))}" data-ajuste="horaCorteOcioFinde" data-tipo="texto"></div>
      </div>
    </div>

    <div class="tarjeta">
      <h2>Ocio</h2>
      <label for="aj-pc-b">Minutos por bloque de PC</label>
      <input id="aj-pc-b" type="number" min="5" max="120" value="${escAttr(String(v('pcBloqueMinutos', 30)))}" data-ajuste="pcBloqueMinutos" data-tipo="numero">
      <label for="aj-pc-c">Créditos por bloque de PC</label>
      <input id="aj-pc-c" type="number" min="0" max="60" value="${escAttr(String(v('pcCreditosPorBloque', 5)))}" data-ajuste="pcCreditosPorBloque" data-tipo="numero">
      <div class="campo-linea" style="margin-top:12px">
        <input type="checkbox" id="aj-pc-f" ${v('pcLibreFinde', true) ? 'checked' : ''} data-ajuste="pcLibreFinde" data-tipo="bool">
        <label for="aj-pc-f">PC libre el fin de semana (sin pase)</label>
      </div>
    </div>

    <div class="tarjeta">
      <h2>Sincronización</h2>
      <p class="mini tenue" style="margin:0 0 8px">Estado: <b>${esc(e.mensaje || '—')}</b>${e.pendientes ? ` · ${e.pendientes} por subir` : ''}</p>
      <div class="rejilla dos">
        <button class="btn" data-accion="config-sync">Configurar la nube</button>
        <button class="btn fantasma" data-accion="sincronizar-ya" ${ctx.sync && ctx.sync.configurado() ? '' : 'disabled'}>Sincronizar ahora</button>
      </div>
    </div>

    <div class="tarjeta">
      <h2>Seguridad</h2>
      <button class="btn bloque" data-accion="cambiar-clave">Cambiar la clave del panel</button>
      <p class="mini tenue" style="margin:10px 0 0">
        La clave se guarda como huella (hash) en este dispositivo. La app no trae ninguna clave por defecto.
      </p>
    </div>

    <div class="tarjeta">
      <h2>Copia de seguridad</h2>
      <div class="rejilla dos">
        <button class="btn" data-accion="exportar">⬇️ Exportar datos</button>
        <button class="btn" data-accion="importar">⬆️ Importar datos</button>
      </div>
    </div>

    <div class="tarjeta">
      <h2>🧭 Volver a configurar</h2>
      <p class="mini tenue" style="margin:0 0 10px">
        Abre otra vez el asistente del principio: el nombre, el horario de colegio,
        las horas de casa y qué bloques están activos. <b>No se pierde nada</b> de lo
        ya conseguido: créditos, racha, logros e historial se quedan como están.
      </p>
      <button class="btn bloque" data-accion="reabrir-asistente">Abrir el asistente</button>
    </div>

    <div class="tarjeta">
      <h2 style="color:var(--peligro)">Reinicio</h2>
      <p class="mini tenue" style="margin:0 0 10px">
        Elegirás exactamente qué se borra y qué se conserva. Pide dos confirmaciones.
      </p>
      <button class="btn peligro bloque" data-accion="reiniciar">Reinicio completo…</button>
    </div>`;
}
