/**
 * Sustituto de sync.js para la compilación DEMO.
 *
 * El build de demostración reemplaza el módulo de sincronización por este,
 * que no contiene ninguna llamada de red de ningún tipo. Así la garantía de
 * "cero peticiones salientes" no depende de que un `if` se haya optimizado
 * bien: el código de red sencillamente no entra en el archivo.
 */

import { modal } from './dom.js';

export function leerConfig() { return null; }
export function guardarConfig() { return false; }
export const SQL_SUPABASE = '';

export function abrirConfiguracionSync() {
  modal({
    titulo: 'Versión de demostración',
    cuerpo: '<p class="mini tenue" style="margin-top:0">Esta copia no se conecta a ninguna red, a propósito: todo lo que hagas se queda en este dispositivo.</p>',
  });
}

export function crearSync() {
  const estado = { activo: false, conectado: false, mensaje: 'Demo sin conexión', pendientes: 0 };
  return {
    get estado() { return estado; },
    configurado() { return false; },
    configurar() {},
    async probar() { return { ok: false, error: 'La demo no se conecta a internet.' }; },
    encolar() {},
    async empujarTodo() { return false; },
    arrancar() {},
    parar() {},
    alVolver() {},
    async sincronizarAhora() {},
  };
}
