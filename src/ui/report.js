/**
 * RESUMEN SEMANAL DESCARGABLE
 * Genera un HTML autocontenido (sin red, sin fuentes externas) con todo lo que
 * ha pasado en la semana. Las fotos van incrustadas como miniaturas.
 */

import { esc, escAttr, formatoFechaCorta, formatoFechaLarga, nombreDiaCorto, weekdayIndex } from '../core/util.js';
import { datosDeSemana } from '../core/week.js';
import { CATEGORIAS } from '../core/defaults.js';

function filaMovimiento(m) {
  const signo = m.cantidad > 0 ? '+' : '';
  const clase = m.cantidad > 0 ? 'mas' : 'menos';
  return `<tr>
    <td class="f">${esc(formatoFechaCorta(m.fecha))}</td>
    <td>${esc(m.concepto)}${m.provisional ? ' <span class="et">pendiente</span>' : ''}</td>
    <td class="c">${esc((CATEGORIAS[m.categoria] || CATEGORIAS.otros).etiqueta)}</td>
    <td class="n ${clase}">${signo}${m.cantidad}</td>
  </tr>`;
}

function barrasCategoria(porCategoria) {
  const entradas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  if (!entradas.length) return '<p class="tenue">Sin créditos ganados esta semana.</p>';
  const max = Math.max(...entradas.map(([, v]) => v));
  return entradas.map(([k, v]) => {
    const cat = CATEGORIAS[k] || CATEGORIAS.otros;
    const pct = max > 0 ? Math.round((v / max) * 100) : 0;
    return `<div class="cat">
      <div class="cat-n"><span>${esc(cat.icono)} ${esc(cat.etiqueta)}</span><b>${v}</b></div>
      <div class="cat-b"><i style="width:${pct}%;background:${escAttr(cat.color)}"></i></div>
    </div>`;
  }).join('');
}

function bloqueMarcas(marcas) {
  if (!marcas.length) return '<p class="tenue">No se marcó ninguna tarea.</p>';
  const porDia = {};
  for (const m of marcas) (porDia[m.fecha] = porDia[m.fecha] || []).push(m);
  return Object.entries(porDia).sort().map(([fecha, lista]) => `
    <h4>${esc(nombreDiaCorto(weekdayIndex(fecha)))} ${esc(formatoFechaCorta(fecha))}</h4>
    <ul class="marcas">
      ${lista.map((m) => `<li class="e-${escAttr(m.estado)}">
        <span>${esc(m.nombre)}</span>
        ${m.opcionEtiqueta ? `<em>${esc(m.opcionEtiqueta)}</em>` : ''}
        <b>${m.valor > 0 ? `+${m.valor}` : '—'}</b>
        <i>${esc(etiquetaEstado(m.estado))}</i>
        ${(m.fotos || []).length ? `<div class="fotos">${m.fotos.map((f) => `<img src="${escAttr(f)}" alt="Foto de ${escAttr(m.nombre)}">`).join('')}</div>` : ''}
      </li>`).join('')}
    </ul>`).join('');
}

function etiquetaEstado(e) {
  return { pendiente: 'pendiente', aprobada: 'aprobada', vetada: 'vetada', nocumplida: 'no cumplida' }[e] || e;
}

export function generarResumenSemanal(estado, weekId, { hastaFecha = null, nombreHijo = 'Nil' } = {}) {
  const d = datosDeSemana(estado, weekId, hastaFecha || undefined);
  const archivada = estado.semanas?.[weekId] || null;
  const compras = d.compras;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rutineitor — semana del ${esc(d.desde)}</title>
<style>
:root{--tinta:#1d2430;--tenue:#6b7785;--linea:#e3e8ee;--ok:#1f9d55;--mal:#d64545;--acento:#3b7ddd}
*{box-sizing:border-box}
body{margin:0;background:#f5f7fa;color:var(--tinta);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:20px}
.hoja{max-width:840px;margin:0 auto;background:#fff;border-radius:14px;padding:26px;box-shadow:0 4px 20px rgba(20,30,50,.08)}
h1{font-size:1.4rem;margin:0 0 2px}
h2{font-size:1rem;margin:26px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--linea)}
h4{font-size:.82rem;margin:14px 0 4px;color:var(--tenue);text-transform:uppercase;letter-spacing:.6px}
.sub{color:var(--tenue);font-size:.9rem;margin:0 0 18px}
.tenue{color:var(--tenue)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:16px 0}
.kpi{background:#f7f9fc;border:1px solid var(--linea);border-radius:10px;padding:12px;text-align:center}
.kpi b{display:block;font-size:1.5rem;line-height:1.1}
.kpi span{font-size:.7rem;color:var(--tenue);text-transform:uppercase;letter-spacing:.5px}
table{width:100%;border-collapse:collapse;font-size:.88rem}
th,td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--linea)}
th{font-size:.72rem;text-transform:uppercase;color:var(--tenue);letter-spacing:.5px}
td.n{text-align:right;font-weight:700;white-space:nowrap}
td.f{white-space:nowrap;color:var(--tenue);font-size:.82rem}
td.c{color:var(--tenue);font-size:.82rem}
.mas{color:var(--ok)}.menos{color:var(--mal)}
.et{background:#fff3cd;border-radius:4px;padding:0 4px;font-size:.7rem}
.cat{margin-bottom:8px}
.cat-n{display:flex;justify-content:space-between;font-size:.84rem;margin-bottom:3px}
.cat-b{height:8px;background:#eef1f5;border-radius:99px;overflow:hidden}
.cat-b i{display:block;height:100%}
ul.marcas{list-style:none;padding:0;margin:0}
ul.marcas li{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--linea);font-size:.88rem}
ul.marcas li b{margin-left:auto;font-weight:700}
ul.marcas li i{font-style:normal;font-size:.72rem;color:var(--tenue);border:1px solid var(--linea);border-radius:99px;padding:1px 7px}
ul.marcas li em{font-size:.78rem;color:var(--tenue)}
ul.marcas li.e-vetada{opacity:.6;text-decoration:line-through}
.fotos{flex-basis:100%;display:flex;gap:6px;margin-top:4px}
.fotos img{width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--linea)}
.pie{margin-top:24px;font-size:.76rem;color:var(--tenue);text-align:center}
@media print{body{background:#fff;padding:0}.hoja{box-shadow:none;border-radius:0}}
</style></head>
<body><div class="hoja">
  <h1>Resumen de la semana · ${esc(nombreHijo)}</h1>
  <p class="sub">Del ${esc(formatoFechaLarga(d.desde))} al ${esc(formatoFechaLarga(d.hasta))}${archivada ? ' · semana cerrada' : ' · semana en curso'}</p>

  <div class="kpis">
    <div class="kpi"><b>${d.ganado}</b><span>Ganado</span></div>
    <div class="kpi"><b>${d.gastado}</b><span>Gastado</span></div>
    <div class="kpi"><b>${d.saldo}</b><span>Saldo semanal</span></div>
    <div class="kpi"><b>${d.hucha}</b><span>Hucha</span></div>
    <div class="kpi"><b>${d.cumplimiento.pct}%</b><span>Cumplimiento</span></div>
    <div class="kpi"><b>${archivada ? archivada.racha : d.racha}</b><span>Racha</span></div>
  </div>

  <h2>Créditos por categoría</h2>
  ${barrasCategoria(d.porCategoria)}

  <h2>Movimientos de la semana</h2>
  ${d.movimientos.length ? `<table>
    <thead><tr><th>Día</th><th>Concepto</th><th>Categoría</th><th style="text-align:right">Créditos</th></tr></thead>
    <tbody>${d.movimientos.map(filaMovimiento).join('')}</tbody></table>`
    : '<p class="tenue">Sin movimientos.</p>'}

  <h2>Compras en la tienda</h2>
  ${compras.length ? `<table>
    <thead><tr><th>Día</th><th>Artículo</th><th>Estado</th><th style="text-align:right">Precio</th></tr></thead>
    <tbody>${compras.map((c) => `<tr>
      <td class="f">${esc(formatoFechaCorta(c.fecha))}</td>
      <td>${esc(c.nombre)}</td>
      <td class="c">${esc(c.estado)}${c.motivo ? ` — ${esc(c.motivo)}` : ''}</td>
      <td class="n menos">${c.estado === 'denegada' ? '0' : `-${c.precio}`}</td>
    </tr>`).join('')}</tbody></table>`
    : '<p class="tenue">Ninguna compra esta semana.</p>'}

  <h2>Tareas marcadas</h2>
  ${bloqueMarcas(d.marcas)}

  <p class="pie">Generado por Rutineitor v3 · ${esc(new Date().toLocaleString('es-ES'))}</p>
</div></body></html>`;
}

export function nombreArchivoResumen(weekId) {
  return `rutineitor-semana-${weekId}.html`;
}
