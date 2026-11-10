/**
 * Ayudas de interfaz. Todo el HTML se construye aquí con plantillas de texto,
 * y TODO dato de usuario pasa por esc()/escAttr() antes de entrar.
 */

import { esc, escAttr } from '../core/util.js';

export { esc, escAttr };

export function $(sel, raiz = document) { return raiz.querySelector(sel); }
export function $$(sel, raiz = document) { return [...raiz.querySelectorAll(sel)]; }

/** Barra flotante de avisos (no usa alert(): bloquearía la app). */
let temporizadorAviso = null;
export function aviso(texto, tipo = '') {
  let el = $('#rt-aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rt-aviso';
    document.body.appendChild(el);
  }
  el.className = `aviso-flotante ${tipo}`;
  el.textContent = String(texto);
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { el.hidden = true; }, 3200);
}

/* ------------------------------ Modales -------------------------------- */

let cerrarModalActual = null;

/**
 * Abre un modal. `cuerpo` es HTML ya escapado por quien lo construye.
 * Devuelve el elemento del modal para enganchar eventos.
 */
export function modal({ titulo, cuerpo, acciones = [], alCerrar = null, ancho = null }) {
  cerrarModal();
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escAttr(titulo)}"${ancho ? ` style="max-width:${escAttr(ancho)}"` : ''}>
      <div class="fila sep" style="margin-bottom:10px">
        <h2>${esc(titulo)}</h2>
        <button class="btn pequeno fantasma" data-cerrar-modal aria-label="Cerrar">✕</button>
      </div>
      <div data-cuerpo-modal>${cuerpo}</div>
      ${acciones.length ? `<div class="acciones">${acciones.map((a, i) => `
        <button class="btn ${escAttr(a.clase || '')}" data-accion-modal="${i}"${a.desactivado ? ' disabled' : ''}>${esc(a.texto)}</button>
      `).join('')}</div>` : ''}
    </div>`;
  document.body.appendChild(fondo);
  document.body.style.overflow = 'hidden';

  const cerrar = () => {
    fondo.remove();
    document.body.style.overflow = '';
    cerrarModalActual = null;
    if (alCerrar) alCerrar();
  };
  cerrarModalActual = cerrar;

  fondo.addEventListener('click', (ev) => {
    if (ev.target === fondo || ev.target.closest('[data-cerrar-modal]')) { cerrar(); return; }
    const b = ev.target.closest('[data-accion-modal]');
    if (b) {
      const a = acciones[Number(b.dataset.accionModal)];
      if (a && a.al) a.al(fondo, cerrar);
      else cerrar();
    }
  });
  return fondo;
}

export function cerrarModal() {
  if (cerrarModalActual) cerrarModalActual();
}

/** Confirmación de un paso. Devuelve una promesa con true/false. */
export function confirmar({ titulo, texto, textoSi = 'Sí', textoNo = 'Cancelar', peligro = false }) {
  return new Promise((resolve) => {
    let resuelto = false;
    const fin = (v) => { if (!resuelto) { resuelto = true; resolve(v); } };
    modal({
      titulo,
      cuerpo: `<p class="tenue" style="margin-top:0">${esc(texto)}</p>`,
      alCerrar: () => fin(false),
      acciones: [
        { texto: textoNo, clase: 'fantasma', al: (_, cerrar) => { fin(false); cerrar(); } },
        { texto: textoSi, clase: peligro ? 'peligro' : 'principal', al: (_, cerrar) => { fin(true); cerrar(); } },
      ],
    });
  });
}

/** Visor de fotos a pantalla completa. */
export function visorFoto(src) {
  const v = document.createElement('div');
  v.className = 'visor';
  const img = document.createElement('img');
  img.src = src; // dataURL generado por la propia app
  img.alt = 'Foto de la tarea';
  v.appendChild(img);
  v.addEventListener('click', () => v.remove());
  document.body.appendChild(v);
}

/* ------------------------------ Fragmentos ------------------------------ */

export function anilloProgreso(pct, etiqueta, color = 'var(--acento)') {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 46;
  const c = 2 * Math.PI * r;
  const off = c * (1 - p / 100);
  return `
    <div class="anillo">
      <svg viewBox="0 0 108 108" aria-hidden="true">
        <circle cx="54" cy="54" r="${r}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="9"/>
        <circle cx="54" cy="54" r="${r}" fill="none" stroke="${escAttr(color)}" stroke-width="9"
          stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>
      <div class="centro-anillo">${p}%<small>${esc(etiqueta)}</small></div>
    </div>`;
}

export function barra(pct, color = 'var(--acento)') {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="barra"><i style="width:${p}%;background:${escAttr(color)}"></i></div>`;
}

export function vacio(texto, emoji = '🍃') {
  return `<div class="vacio"><span class="em">${esc(emoji)}</span>${esc(texto)}</div>`;
}

export function dato(valor, etiqueta) {
  return `<div class="dato"><div class="v">${esc(valor)}</div><div class="e">${esc(etiqueta)}</div></div>`;
}

/** Delegación de eventos: un solo listener por raíz. */
export function delegar(raiz, evento, selector, manejador) {
  raiz.addEventListener(evento, (ev) => {
    const el = ev.target.closest(selector);
    if (el && raiz.contains(el)) manejador(ev, el);
  });
}
