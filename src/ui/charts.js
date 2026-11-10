/**
 * GRÁFICAS — SVG en línea, sin ninguna librería.
 *
 * Reglas que se siguen en todas:
 *  · Una sola escala por gráfica. Nunca dos ejes con unidades distintas.
 *  · El texto usa los colores del tema (var(--texto) / var(--tenue)), nunca el
 *    color de la serie, para que se lea en los once fondos.
 *  · Toda marca de categoría lleva su icono, su nombre y su número al lado: el
 *    color refuerza la identidad, no es el único canal.
 *  · Cada marca lleva un <title> para que al pasar por encima se vea el dato.
 *  · El viewBox deja sitio a las etiquetas de los extremos.
 */

import { esc, escAttr } from './dom.js';
import { nombreDiaCorto, weekdayIndex, formatoFechaCorta, horaDeMinutos } from '../core/util.js';

const EJE = 'var(--borde)';
const TINTA = 'var(--texto)';
const TENUE = 'var(--tenue)';

function vacia(texto) {
  return `<p class="mini tenue centro" style="margin:14px 0">${esc(texto)}</p>`;
}

/* ------------------------------------------------------------------ */
/* Barras horizontales etiquetadas (créditos por categoría)            */
/* ------------------------------------------------------------------ */

export function barrasCategoria(items, { maxFilas = 8 } = {}) {
  const datos = items.filter((d) => d.valor > 0).slice(0, maxFilas);
  if (!datos.length) return vacia('Todavía no hay créditos esta semana.');
  const max = Math.max(...datos.map((d) => d.valor));

  return `<div class="grafica">${datos.map((d) => {
    const pct = max > 0 ? Math.max(3, (d.valor / max) * 100) : 0;
    return `
      <div class="gc-fila" title="${escAttr(`${d.etiqueta}: ${d.valor}`)}">
        <span class="gc-etq"><span aria-hidden="true">${esc(d.icono || '•')}</span> ${esc(d.etiqueta)}</span>
        <span class="gc-pista"><i style="width:${pct.toFixed(1)}%;background:${escAttr(d.color)}"></i></span>
        <b class="gc-val">${esc(String(d.valor))}</b>
      </div>`;
  }).join('')}</div>`;
}

/* ------------------------------------------------------------------ */
/* Barras verticales de una serie (cumplimiento por día)               */
/* ------------------------------------------------------------------ */

export function barrasDia(dias, { umbral = null, sufijo = '%', maximo = 100 } = {}) {
  if (!dias.length) return vacia('Sin datos todavía.');
  const An = 320;
  const Al = 132;
  const margenX = 6;
  const base = Al - 26;
  const techo = 16;
  const ancho = (An - margenX * 2) / dias.length;
  const barra = Math.min(26, ancho - 8);
  const max = Math.max(maximo, ...dias.map((d) => d.valor));
  const y = (v) => base - (v / max) * (base - techo);

  return `
    <svg class="g-svg" viewBox="0 0 ${An} ${Al}" role="img" aria-label="Cumplimiento por día">
      <line x1="${margenX}" y1="${base}" x2="${An - margenX}" y2="${base}" stroke="${EJE}" stroke-width="1"/>
      ${umbral !== null ? `
        <line x1="${margenX}" y1="${y(umbral).toFixed(1)}" x2="${An - margenX}" y2="${y(umbral).toFixed(1)}"
          stroke="${EJE}" stroke-width="1" stroke-dasharray="3 3"/>
        <text x="${An - margenX}" y="${(y(umbral) - 4).toFixed(1)}" text-anchor="end"
          fill="${TENUE}" font-size="8">objetivo ${umbral}${sufijo}</text>` : ''}
      ${dias.map((d, i) => {
        const cx = margenX + ancho * i + ancho / 2;
        const alto = Math.max(2, base - y(d.valor));
        const color = d.color || (umbral !== null && d.valor >= umbral ? 'var(--exito)' : 'var(--aviso)');
        return `
          <g>
            <title>${escAttr(`${d.etiqueta}: ${d.valor}${sufijo}`)}</title>
            <rect x="${(cx - barra / 2).toFixed(1)}" y="${(base - alto).toFixed(1)}"
              width="${barra.toFixed(1)}" height="${alto.toFixed(1)}" rx="4" fill="${escAttr(color)}"/>
            <text x="${cx.toFixed(1)}" y="${(base - alto - 4).toFixed(1)}" text-anchor="middle"
              fill="${TINTA}" font-size="8.5" font-weight="700">${d.valor}</text>
            <text x="${cx.toFixed(1)}" y="${(base + 11).toFixed(1)}" text-anchor="middle"
              fill="${TENUE}" font-size="8.5">${esc(d.etiqueta)}</text>
          </g>`;
      }).join('')}
    </svg>`;
}

/* ------------------------------------------------------------------ */
/* Área + línea de una serie (evolución de la hucha)                   */
/* ------------------------------------------------------------------ */

export function areaEvolucion(puntos, { etiqueta = 'Hucha', color = 'var(--acento)' } = {}) {
  const datos = puntos.filter((p) => Number.isFinite(p.valor));
  if (datos.length < 2) return vacia('Necesito un par de días más para dibujar la evolución.');
  // Una línea plana en cero no cuenta nada y ocupa media pantalla.
  if (datos.every((p) => p.valor === 0)) {
    return vacia('Cuando cierres tu primera semana con saldo, aquí verás crecer la hucha.');
  }

  const An = 320;
  const Al = 130;
  const izq = 4;
  const der = 34;
  const base = Al - 20;
  const techo = 16;
  const max = Math.max(1, ...datos.map((p) => p.valor));
  const min = Math.min(0, ...datos.map((p) => p.valor));
  const x = (i) => izq + (i / (datos.length - 1)) * (An - izq - der);
  const y = (v) => base - ((v - min) / (max - min || 1)) * (base - techo);

  const linea = datos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(datos.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
  const ultimo = datos[datos.length - 1];
  const iMax = datos.reduce((mejor, p, i) => (p.valor > datos[mejor].valor ? i : mejor), 0);

  return `
    <svg class="g-svg" viewBox="0 0 ${An} ${Al}" role="img" aria-label="${escAttr(`Evolución de ${etiqueta}`)}">
      <defs>
        <linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${escAttr(color)}" stop-opacity=".38"/>
          <stop offset="100%" stop-color="${escAttr(color)}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="${izq}" y1="${base}" x2="${An - der}" y2="${base}" stroke="${EJE}" stroke-width="1"/>
      <path d="${area}" fill="url(#g-area)"/>
      <path d="${linea}" fill="none" stroke="${escAttr(color)}" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>
      ${iMax !== datos.length - 1 && datos[iMax].valor > ultimo.valor ? `
        <circle cx="${x(iMax).toFixed(1)}" cy="${y(datos[iMax].valor).toFixed(1)}" r="3"
          fill="${escAttr(color)}" fill-opacity=".5"/>
        <text x="${x(iMax).toFixed(1)}" y="${(y(datos[iMax].valor) - 6).toFixed(1)}" text-anchor="middle"
          fill="${TENUE}" font-size="8.5">máx ${datos[iMax].valor}</text>` : ''}
      <circle cx="${x(datos.length - 1).toFixed(1)}" cy="${y(ultimo.valor).toFixed(1)}" r="4"
        fill="${escAttr(color)}" stroke="var(--panel-solido)" stroke-width="2"/>
      <text x="${(An - der + 5)}" y="${(y(ultimo.valor) + 3).toFixed(1)}"
        fill="${TINTA}" font-size="11" font-weight="700">${ultimo.valor}</text>
      <text x="${izq}" y="${Al - 6}" fill="${TENUE}" font-size="8.5">${esc(formatoFechaCorta(datos[0].fecha))}</text>
      <text x="${An - der}" y="${Al - 6}" text-anchor="end" fill="${TENUE}" font-size="8.5">${esc(formatoFechaCorta(ultimo.fecha))}</text>
    </svg>`;
}

/* ------------------------------------------------------------------ */
/* Barras agrupadas de dos series (ganado vs gastado por semana)       */
/* ------------------------------------------------------------------ */

export function barrasGanadoGastado(semanas) {
  const datos = semanas.filter((s) => s.ganado || s.gastado);
  if (!datos.length) return vacia('Aún no hay semanas con movimiento.');

  const An = 320;
  const Al = 140;
  const margenX = 6;
  const base = Al - 26;
  const techo = 16;
  const paso = (An - margenX * 2) / datos.length;
  const barra = Math.min(13, (paso - 10) / 2);
  const max = Math.max(1, ...datos.flatMap((s) => [s.ganado, s.gastado]));
  const y = (v) => base - (v / max) * (base - techo);

  return `
    <div class="g-leyenda">
      <span><i style="background:var(--exito)"></i>Ganado</span>
      <span><i style="background:var(--peligro)"></i>Gastado</span>
    </div>
    <svg class="g-svg" viewBox="0 0 ${An} ${Al}" role="img" aria-label="Ganado y gastado por semana">
      <line x1="${margenX}" y1="${base}" x2="${An - margenX}" y2="${base}" stroke="${EJE}" stroke-width="1"/>
      ${datos.map((s, i) => {
        const centro = margenX + paso * i + paso / 2;
        const g = Math.max(2, base - y(s.ganado));
        const p = Math.max(2, base - y(s.gastado));
        return `
          <g>
            <title>${escAttr(`Semana del ${s.etiqueta}: +${s.ganado} / -${s.gastado}`)}</title>
            <rect x="${(centro - barra - 1).toFixed(1)}" y="${(base - g).toFixed(1)}" width="${barra.toFixed(1)}"
              height="${g.toFixed(1)}" rx="3" fill="var(--exito)"/>
            <rect x="${(centro + 1).toFixed(1)}" y="${(base - p).toFixed(1)}" width="${barra.toFixed(1)}"
              height="${p.toFixed(1)}" rx="3" fill="var(--peligro)"/>
            <text x="${centro.toFixed(1)}" y="${(base + 11).toFixed(1)}" text-anchor="middle"
              fill="${TENUE}" font-size="8">${esc(s.etiqueta)}</text>
          </g>`;
      }).join('')}
      <text x="${margenX}" y="${techo - 6}" fill="${TENUE}" font-size="8.5">máx ${max}</text>
    </svg>`;
}

/* ------------------------------------------------------------------ */
/* Noches: hora de dormir frente al objetivo                           */
/* ------------------------------------------------------------------ */

export function graficaNoches(noches, { objetivoMin, margen = 15 }) {
  const conDato = noches.filter((n) => n.registro);
  if (!conDato.length) return vacia('Apunta alguna noche y aquí verás tu ritmo.');

  const An = 320;
  const Al = 138;
  const izq = 30;
  const der = 6;
  const base = Al - 24;
  const techo = 18;
  const horas = conDato.map((n) => n.minutosNocturnos);
  const minEje = Math.min(objetivoMin - 30, ...horas) - 15;
  const maxEje = Math.max(objetivoMin + 60, ...horas) + 15;
  const x = (i) => izq + ((i + 0.5) / noches.length) * (An - izq - der);
  const y = (m) => techo + ((m - minEje) / (maxEje - minEje || 1)) * (base - techo);

  const yObjetivo = y(objetivoMin);
  const yMargen = y(objetivoMin + margen);

  return `
    <div class="g-leyenda">
      <span><i style="background:var(--exito)"></i>A la hora</span>
      <span><i style="background:var(--aviso)"></i>Más tarde</span>
      <span><i class="linea"></i>Objetivo</span>
    </div>
    <svg class="g-svg" viewBox="0 0 ${An} ${Al}" role="img" aria-label="Hora de dormir de las últimas noches">
      <rect x="${izq}" y="${techo}" width="${An - izq - der}" height="${(yMargen - techo).toFixed(1)}"
        fill="var(--exito)" fill-opacity=".08"/>
      <line x1="${izq}" y1="${yObjetivo.toFixed(1)}" x2="${An - der}" y2="${yObjetivo.toFixed(1)}"
        stroke="${EJE}" stroke-width="1" stroke-dasharray="4 3"/>
      <text x="${izq - 4}" y="${(yObjetivo + 3).toFixed(1)}" text-anchor="end" fill="${TENUE}"
        font-size="8.5">${esc(horaDeMinutos(objetivoMin))}</text>
      <line x1="${izq}" y1="${base}" x2="${An - der}" y2="${base}" stroke="${EJE}" stroke-width="1"/>
      ${noches.map((n, i) => {
        if (!n.registro) {
          return `<circle cx="${x(i).toFixed(1)}" cy="${base - 4}" r="1.6" fill="${TENUE}" fill-opacity=".5">
            <title>${escAttr(`${formatoFechaCorta(n.fecha)}: sin apuntar`)}</title></circle>`;
        }
        const cy = y(n.minutosNocturnos);
        const color = n.registro.cumplida ? 'var(--exito)' : 'var(--aviso)';
        return `
          <g>
            <title>${escAttr(`${formatoFechaCorta(n.fecha)}: ${n.registro.hora}${n.registro.cumplida ? ' · a la hora' : ' · más tarde'}`)}</title>
            <line x1="${x(i).toFixed(1)}" y1="${yObjetivo.toFixed(1)}" x2="${x(i).toFixed(1)}" y2="${cy.toFixed(1)}"
              stroke="${color}" stroke-width="1.5" stroke-opacity=".45"/>
            <circle cx="${x(i).toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${color}"
              stroke="var(--panel-solido)" stroke-width="1.5"/>
          </g>`;
      }).join('')}
      ${noches.map((n, i) => (i % 2 === 0
        ? `<text x="${x(i).toFixed(1)}" y="${base + 11}" text-anchor="middle" fill="${TENUE}" font-size="7.5">${esc(nombreDiaCorto(weekdayIndex(n.fecha)))}</text>`
        : '')).join('')}
    </svg>`;
}

/* ------------------------------------------------------------------ */
/* Rejilla de hábitos: presencia, no cantidad                          */
/* ------------------------------------------------------------------ */

export function rejillaHabitos(rejilla) {
  if (!rejilla.habitos.length) return vacia('No hay hábitos configurados.');
  const dias = rejilla.fechas.length;
  return `
    <div class="g-habitos" style="--dias:${dias}">
      <div class="gh-cab">
        <span></span>
        ${rejilla.fechas.map((f, i) => `<span class="gh-dia">${i % 2 === 0 ? esc(nombreDiaCorto(weekdayIndex(f))[0]) : ''}</span>`).join('')}
      </div>
      ${rejilla.celdas.map((fila) => `
        <div class="gh-fila">
          <span class="gh-nombre" title="${escAttr(fila.habito.nombre)}">
            <span aria-hidden="true">${esc(fila.habito.icono || '•')}</span>
          </span>
          ${fila.dias.map((d) => `<span class="gh-celda ${d.hecho ? 'si' : ''}"
            title="${escAttr(`${fila.habito.nombre} · ${formatoFechaCorta(d.fecha)}: ${d.hecho ? 'hecho' : 'no'}`)}"></span>`).join('')}
        </div>`).join('')}
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Aro de progreso grande (camino al objetivo)                         */
/* ------------------------------------------------------------------ */

export function aroObjetivo(pct, { centro, abajo, color = 'var(--acento2)' }) {
  const p = Math.max(0, Math.min(100, pct));
  const r = 52;
  const c = 2 * Math.PI * r;
  return `
    <div class="g-aro">
      <svg viewBox="0 0 128 128" role="img" aria-label="${escAttr(`Progreso ${Math.round(p)} por ciento`)}">
        <circle cx="64" cy="64" r="${r}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="11"/>
        <circle cx="64" cy="64" r="${r}" fill="none" stroke="${escAttr(color)}" stroke-width="11"
          stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}"
          stroke-dashoffset="${(c * (1 - p / 100)).toFixed(1)}" transform="rotate(-90 64 64)"/>
      </svg>
      <div class="g-aro-centro">
        <b>${esc(centro)}</b>
        <small>${esc(abajo)}</small>
      </div>
    </div>`;
}
