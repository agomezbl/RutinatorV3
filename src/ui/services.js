/**
 * Servicios del navegador: guardado local, fotos y notificaciones.
 * Ninguno de estos servicios hace peticiones de red.
 */

import { catalogoInicial, AJUSTES_POR_DEFECTO } from '../core/defaults.js';
import { COLECCIONES } from '../core/store.js';

// __DEMO__ lo fija el compilador como literal (ver build.mjs).
export const CLAVE_ALMACEN = __DEMO__ ? 'rutineitor.v3.demo' : 'rutineitor.v3.estado';

/* ----------------------------- Guardado local --------------------------- */

export function cargarEstado() {
  const base = catalogoInicial();
  let guardado = null;
  try {
    const txt = localStorage.getItem(CLAVE_ALMACEN);
    if (txt) guardado = JSON.parse(txt);
  } catch (e) {
    guardado = null;
  }
  if (!guardado || typeof guardado !== 'object') return base;

  // Fusión conservadora: se respeta lo guardado y se añaden las claves nuevas
  // de ajustes que hayan aparecido con una versión posterior de la app.
  const estado = { version: 3 };
  for (const c of COLECCIONES) {
    estado[c] = { ...(guardado[c] && typeof guardado[c] === 'object' ? guardado[c] : {}) };
  }
  for (const [clave, valor] of Object.entries(AJUSTES_POR_DEFECTO)) {
    if (estado.ajustes[clave] === undefined) estado.ajustes[clave] = { id: clave, valor };
  }
  // Si nunca ha habido catálogo (instalación nueva a medias), se siembra.
  if (Object.keys(estado.tareas).length === 0) estado.tareas = base.tareas;
  if (Object.keys(estado.tienda).length === 0) estado.tienda = base.tienda;
  return estado;
}

let temporizadorGuardado = null;
export function guardarEstado(estado) {
  clearTimeout(temporizadorGuardado);
  temporizadorGuardado = setTimeout(() => {
    try {
      localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    } catch (e) {
      // Cuota llena: casi siempre por fotos. Se avisa desde la app.
      document.dispatchEvent(new CustomEvent('rt:almacen-lleno'));
    }
  }, 220);
}

export function guardarEstadoYa(estado) {
  clearTimeout(temporizadorGuardado);
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    return true;
  } catch (e) {
    return false;
  }
}

export function borrarAlmacen() {
  try { localStorage.removeItem(CLAVE_ALMACEN); } catch (e) { /* nada */ }
}

/* --------------------------------- Fotos -------------------------------- */

/**
 * Comprime una foto en el propio móvil antes de guardarla.
 * Nunca se guarda una imagen tal cual: la base de datos no es para archivos
 * grandes y el móvil de Nil tampoco tiene datos infinitos.
 */
export function comprimirFoto(archivo, { maxLado = 900, calidad = 0.62, maxBytes = 130000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!archivo || !archivo.type || !archivo.type.startsWith('image/')) {
      reject(new Error('Eso no es una imagen.'));
      return;
    }
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se ha podido leer la imagen.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se ha podido abrir la imagen.'));
      img.onload = () => {
        let { width, height } = img;
        const escala = Math.min(1, maxLado / Math.max(width, height));
        width = Math.round(width * escala);
        height = Math.round(height * escala);
        const lienzo = document.createElement('canvas');
        lienzo.width = width;
        lienzo.height = height;
        const ctx = lienzo.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        let q = calidad;
        let salida = lienzo.toDataURL('image/jpeg', q);
        while (salida.length > maxBytes && q > 0.25) {
          q -= 0.12;
          salida = lienzo.toDataURL('image/jpeg', q);
        }
        resolve(salida);
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

/* ----------------------------- Notificaciones --------------------------- */

export function notificacionesDisponibles() {
  return typeof Notification !== 'undefined';
}

export function permisoNotificaciones() {
  return notificacionesDisponibles() ? Notification.permission : 'unsupported';
}

export async function pedirPermisoNotificaciones() {
  if (!notificacionesDisponibles()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return 'denied';
  }
}

const yaAvisado = new Set();

export function notificar(titulo, cuerpo, clave = null) {
  if (!notificacionesDisponibles() || Notification.permission !== 'granted') return false;
  if (clave) {
    if (yaAvisado.has(clave)) return false;
    yaAvisado.add(clave);
  }
  try {
    // Sin service worker: solo funciona con la app abierta. Se dice en la guía.
    new Notification(titulo, { body: cuerpo, tag: clave || undefined });
    return true;
  } catch (e) {
    return false;
  }
}

/* -------------------------- Descarga de archivos ------------------------ */

export function descargarTexto(nombre, contenido, tipo = 'text/html;charset=utf-8') {
  let url = null;
  let revocar = false;
  try {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
      revocar = true;
    }
  } catch (e) {
    url = null;
  }
  if (!url) {
    // Algunos navegadores integrados no tienen createObjectURL: se usa data:
    url = `data:${tipo};base64,${btoa(unescape(encodeURIComponent(contenido)))}`;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revocar) setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
