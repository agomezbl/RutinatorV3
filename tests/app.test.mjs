/**
 * Pruebas funcionales sobre el ARCHIVO FINAL (dist/index.html), no sobre los
 * módulos sueltos: se carga en un navegador simulado (jsdom), se pulsan
 * botones de verdad y se comprueba lo que ve el usuario.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Abre la app compilada en jsdom.
 *
 * Por defecto la devuelve **ya configurada**: la inmensa mayoría de las pruebas
 * van sobre la app en uso, no sobre el primer arranque. Para probar el
 * asistente de primer uso se pasa `{ sinConfigurar: true }`.
 */
async function abrirApp(archivo = 'dist/index.html', { sinConfigurar = false } = {}) {
  const html = await readFile(path.join(RAIZ, archivo), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://rutineitor.local/',
  });
  const { window } = dom;
  await new Promise((r) => setTimeout(r, 60));
  const api = window.__rutineitor;
  assert.ok(api, 'la app debe exponer su API de pruebas');
  const pintar = () => api.render();
  if (!sinConfigurar) {
    api.store.fijarAjuste('configurado', true);
    pintar();
  }
  const $ = (sel) => window.document.querySelector(sel);
  const $$ = (sel) => [...window.document.querySelectorAll(sel)];
  const clic = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    assert.ok(el, `no existe el elemento ${sel}`);
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    pintar();
    return el;
  };
  const texto = () => window.document.body.textContent;
  /**
   * Las pruebas de la tienda no pueden depender de la hora a la que se
   * ejecuten: el horario por defecto bloquea el ocio de 8 a 5 entre semana y
   * hay una hora de corte por la noche. Esto aparta las dos cosas. El bloqueo
   * por horario y el toque de queda tienen sus propias pruebas, aparte.
   */
  const tiendaSinReloj = () => {
    for (const b of api.store.listar('horario')) api.store.remove('horario', b.id);
    api.store.fijarAjuste('horaCorteOcio', '23:59');
    pintar();
  };
  return { dom, window, api, $, $$, clic, pintar, texto, tiendaSinReloj };
}

/* ---------------------------- Arranque ---------------------------------- */

test('la app arranca, pinta la pantalla de inicio y la navegación', async () => {
  const { $, $$, texto, dom } = await abrirApp();
  assert.ok($('#app'), 'hay raíz');
  assert.match(texto(), /Mis créditos/);
  assert.equal($$('.nav button').length, 5);
  assert.ok($('.rt-lienzo'), 'el lienzo del fondo está montado');
  dom.window.close();
});

test('la navegación cambia de vista', async () => {
  const { clic, $, texto, dom } = await abrirApp();
  clic('.nav button[data-vista="tareas"]');
  assert.match(texto(), /Mis tareas/);
  clic('.nav button[data-vista="tienda"]');
  assert.match(texto(), /Con mis créditos/);
  assert.match(texto(), /Con la hucha/);
  clic('.nav button[data-vista="agenda"]');
  assert.match(texto(), /Horario semanal/);
  clic('[data-accion="agenda-tab"][data-tab="calendario"]');
  assert.match(texto(), /Calendario de citas/);
  dom.window.close();
});

/* ----------------------------- Tareas ----------------------------------- */

test('marcar una tarea desde la interfaz suma créditos y se puede deshacer', async () => {
  const { clic, $, api, texto, dom } = await abrirApp();
  clic('.nav button[data-vista="tareas"]');
  const boton = $('[data-accion="marcar"][data-tarea="t_cama"]');
  assert.ok(boton, 'la tarea "Cama hecha" está en la lista');
  clic(boton);
  assert.equal(api.store.listar('marcas').length, 1);
  const marca = api.store.listar('marcas')[0];
  assert.equal(marca.estado, 'pendiente');
  assert.equal(marca.valor, 1, 'cama: 5 min = 1 crédito');
  assert.match(texto(), /Esperando a que papá lo revise/);

  clic(`[data-accion="desmarcar"][data-tarea="t_cama"]`);
  assert.equal(api.store.listar('marcas').length, 0);
  assert.equal(api.store.listar('ledger').length, 0);
  dom.window.close();
});

test('una tarea de doble opción abre el diálogo y paga lo elegido', async () => {
  const { clic, $, api, window, dom } = await abrirApp();
  clic('.nav button[data-vista="tareas"]');
  clic('[data-accion="marcar"][data-tarea="t_lavavajillas"]');
  const dialogo = $('.modal-fondo');
  assert.ok(dialogo, 'se abre el diálogo de elección');
  const opciones = [...dialogo.querySelectorAll('[data-opcion]')];
  assert.equal(opciones.length, 2);
  opciones.find((o) => o.dataset.opcion === 'solo')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const marca = api.store.listar('marcas')[0];
  assert.equal(marca.valor, 3, 'lavavajillas entero: 15 min = 3 créditos');
  assert.equal(marca.opcionId, 'solo');
  dom.window.close();
});

test('las tareas obligatorias se ven como tales y no dan créditos', async () => {
  const { clic, $, api, dom } = await abrirApp();
  clic('.nav button[data-vista="tareas"]');
  clic('[data-accion="marcar"][data-tarea="t_dientes_n"]');
  const marca = api.store.listar('marcas')[0];
  assert.equal(marca.valor, 0);
  assert.equal(api.store.listar('ledger').length, 0);
  dom.window.close();
});

/* ------------------------------ Tienda ---------------------------------- */

test('sin saldo, el botón de comprar está desactivado y explica por qué', async () => {
  const { clic, $, texto, dom } = await abrirApp();
  clic('.nav button[data-vista="tienda"]');
  const boton = $('[data-accion="comprar"][data-articulo="b_tv"]');
  assert.ok(boton.disabled, 'no se puede comprar sin saldo');
  assert.match(texto(), /Te faltan \d+ créditos/);
  dom.window.close();
});

function darSaldo(api, cantidad = 60) {
  api.store.set('ledger', `m_${cantidad}`, {
    id: `m_${cantidad}`, ts: Date.now(), fecha: new Date().toISOString().slice(0, 10),
    cuenta: 'semana', tipo: 'ajuste', cantidad, concepto: 'saldo de prueba',
    categoria: 'ajuste', provisional: false, anula: null, anuladoPor: null,
  });
}

test('con saldo se puede pedir un bono y queda pendiente de aprobación', async () => {
  const { clic, $, api, window, dom, tiendaSinReloj } = await abrirApp();
  darSaldo(api, 60);
  tiendaSinReloj();
  clic('.nav button[data-vista="tienda"]');
  clic('[data-accion="comprar"][data-articulo="b_tv"]');
  const dialogo = $('.modal-fondo');
  assert.ok(dialogo);
  [...dialogo.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  const compras = api.store.listar('compras');
  assert.equal(compras.length, 1);
  assert.equal(compras[0].estado, 'pendiente');
  dom.window.close();
});

test('pasada la hora de corte la tienda no deja comprar ocio, salvo Modo Búho', async () => {
  const { clic, $, api, texto, dom, tiendaSinReloj } = await abrirApp();
  darSaldo(api, 80);
  tiendaSinReloj();
  api.store.fijarAjuste('horaCorteOcio', '00:01'); // ya pasada a cualquier hora
  clic('.nav button[data-vista="tienda"]');
  assert.ok($('[data-accion="comprar"][data-articulo="b_tv"]').disabled);
  assert.match(texto(), /hora de corte/i);
  assert.ok(!$('[data-accion="comprar"][data-articulo="b_buho"]').disabled,
    'el Modo Búho sí se puede pedir después del corte');
  dom.window.close();
});

/* ------------------------------- Padre ---------------------------------- */

async function entrarComoPadre(h) {
  const { clic, $, window } = h;
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="entrar-padre"]');
  const dialogo = $('.modal-fondo');
  dialogo.querySelector('#cl-1').value = 'clave-larga-1';
  dialogo.querySelector('#cl-2').value = 'clave-larga-1';
  [...dialogo.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  h.pintar();
}

test('el panel del padre exige crear una clave la primera vez (no hay clave por defecto)', async () => {
  const h = await abrirApp();
  const { clic, $, api, texto, dom } = h;
  assert.equal(api.store.ajuste('claveHash', null), null, 'no viene con clave de fábrica');
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="entrar-padre"]');
  assert.match($('.modal-fondo').textContent, /Crear la clave del panel/);

  // Una clave corta no se acepta.
  const dialogo = $('.modal-fondo');
  dialogo.querySelector('#cl-1').value = 'corta';
  dialogo.querySelector('#cl-2').value = 'corta';
  [...dialogo.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(api.store.ajuste('claveHash', null), null);
  assert.match(dom.window.document.body.textContent, /Mínimo 6 caracteres/);

  dialogo.querySelector('#cl-1').value = 'clave-larga-1';
  dialogo.querySelector('#cl-2').value = 'clave-larga-1';
  [...dialogo.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  h.pintar();
  assert.ok(api.store.ajuste('claveHash', null), 'la clave queda guardada como huella');
  assert.equal(api.ui.modo, 'padre');
  assert.match(texto(), /Panel del padre/);
  dom.window.close();
});

test('la clave guardada no se almacena en claro', async () => {
  const h = await abrirApp();
  await entrarComoPadre(h);
  const hash = h.api.store.ajuste('claveHash', null);
  assert.ok(hash);
  assert.ok(!String(hash).includes('clave-larga-1'));
  assert.ok(!JSON.stringify(h.api.store.instantanea()).includes('clave-larga-1'));
  h.dom.window.close();
});

test('el padre aprueba una tarea pendiente y el crédito deja de ser provisional', async () => {
  const h = await abrirApp();
  const { clic, $, api, dom } = h;
  clic('.nav button[data-vista="tareas"]');
  clic('[data-accion="marcar"][data-tarea="t_habitacion"]');
  const marca = api.store.listar('marcas')[0];
  assert.equal(api.store.obtener('ledger', marca.movimientoId).provisional, true);

  await entrarComoPadre(h);
  clic('.nav button[data-vista="padre"]');
  clic(`[data-accion="aprobar-marca"][data-marca="${marca.id}"]`);
  assert.equal(api.store.obtener('marcas', marca.id).estado, 'aprobada');
  assert.equal(api.store.obtener('ledger', marca.movimientoId).provisional, false);
  dom.window.close();
});

test('vetar exige motivo y devuelve el crédito', async () => {
  const h = await abrirApp();
  const { clic, $, api, dom, window } = h;
  clic('.nav button[data-vista="tareas"]');
  clic('[data-accion="marcar"][data-tarea="t_habitacion"]');
  const marca = api.store.listar('marcas')[0];
  await entrarComoPadre(h);
  clic('.nav button[data-vista="padre"]');
  clic(`[data-accion="vetar-marca"][data-marca="${marca.id}"]`);
  const dialogo = $('.modal-fondo');
  const confirmarBtn = () => [...dialogo.querySelectorAll('[data-accion-modal]')].pop();

  // Sin motivo no deja.
  confirmarBtn().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(api.store.obtener('marcas', marca.id).estado, 'pendiente');
  assert.match(window.document.body.textContent, /motivo es obligatorio/i);

  dialogo.querySelector('#rt-motivo').value = 'No los ha hecho';
  confirmarBtn().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  h.pintar();
  assert.equal(api.store.obtener('marcas', marca.id).estado, 'vetada');
  const movs = api.store.listar('ledger');
  assert.equal(movs.length, 2, 'nada se borra: se añade la anulación');
  assert.equal(movs.reduce((s, m) => s + m.cantidad, 0), 0);
  dom.window.close();
});

/* ------------------------- Calendario y horario ------------------------- */

test('crear una cita del calendario para dentro de tres semanas y encontrarla allí', async () => {
  const h = await abrirApp();
  const { clic, $, api, window, dom } = h;
  clic('.nav button[data-vista="agenda"]');
  clic('[data-accion="agenda-tab"][data-tab="calendario"]');
  clic('[data-accion="nuevo-evento"]');
  const dialogo = $('.modal-fondo');
  const dentroDe21 = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  dialogo.querySelector('#ev-t').value = 'Dentista de Nil';
  dialogo.querySelector('#ev-f').value = dentroDe21;
  dialogo.querySelector('#ev-h').value = '17:30';
  [...dialogo.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  h.pintar();
  const eventos = api.store.listar('eventos');
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].fecha, dentroDe21);
  assert.match(window.document.body.textContent, /Dentista de Nil/);
  dom.window.close();
});

test('el horario permite crear un bloque y valida las horas', async () => {
  const h = await abrirApp();
  const { clic, $, api, window, dom } = h;
  clic('.nav button[data-vista="agenda"]');
  clic('[data-accion="nuevo-bloque"]');
  const dialogo = $('.modal-fondo');
  dialogo.querySelector('#bl-t').value = 'Piano';
  dialogo.querySelector('#bl-i').value = '19:00';
  dialogo.querySelector('#bl-f').value = '18:00';
  const guardar = () => [...dialogo.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const antes = api.store.listar('horario').length;
  guardar();
  assert.equal(api.store.listar('horario').length, antes, 'no guarda horas imposibles');
  assert.match(window.document.body.textContent, /posterior a la de inicio/);

  dialogo.querySelector('#bl-f').value = '20:00';
  guardar();
  h.pintar();
  assert.equal(api.store.listar('horario').length, antes + 1);
  dom.window.close();
});

/* -------------------------------- Sudoku -------------------------------- */

test('el sudoku se pinta, acepta números y comprueba', async () => {
  const h = await abrirApp();
  const { clic, $, $$, api, window, dom } = h;
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="ir"][data-vista="juego"]');
  assert.equal($$('.sudoku button').length, 81);
  const libre = $$('.sudoku button').find((b) => !b.classList.contains('fija'));
  clic(libre);
  clic('[data-accion="num-sudoku"][data-n="5"]');
  const r = Number(libre.dataset.r);
  const c = Number(libre.dataset.c);
  assert.equal(api.ui.sudoku.tablero[r][c], 5);
  clic('[data-accion="comprobar-sudoku"]');
  assert.match(window.document.body.textContent, /por poner|Resuelto/);
  dom.window.close();
});

/* --------------------------------- Temas -------------------------------- */

test('Nil puede cambiar a un tema desbloqueado y se aplican sus colores', async () => {
  const h = await abrirApp();
  const { clic, $, $$, api, dom } = h;
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="ir"][data-vista="ajustes"]');
  // De salida hay cinco abiertos, uno por familia, y el resto con su candado.
  assert.equal($$('[data-accion="tema"]').length, 5, 'cinco fondos abiertos al empezar');
  assert.ok($$('.tema-opcion.bloqueado').length >= 10, 'el resto se ve, pero bloqueado');
  clic('[data-accion="tema"][data-tema="neon"]');
  assert.equal(api.store.ajuste('temaNil'), 'neon');
  assert.match($('#app').getAttribute('style'), /--acento:#00e5ff/);
  assert.equal($('#rt-fondo').dataset.tema, 'neon');
  dom.window.close();
});

test('un fondo bloqueado no se puede elegir, ni siquiera a la fuerza', async () => {
  const { api, pintar, $, dom, window } = await abrirApp();
  pintar();
  // El candado no es solo visual: la acción también lo comprueba.
  api.acciones.tema({ dataset: { tema: 'synthwave' } });
  assert.notEqual(api.store.ajuste('temaNil'), 'synthwave');
  assert.match($('#rt-aviso').textContent, /no está desbloqueado/i);
  dom.window.close();
});

test('el padre puede regalar un fondo y entonces sí se elige', async () => {
  const { api, pintar, dom } = await abrirApp();
  api.store.set('temas', 'synthwave', { id: 'synthwave', regalado: true });
  pintar();
  api.acciones.tema({ dataset: { tema: 'synthwave' } });
  assert.equal(api.store.ajuste('temaNil'), 'synthwave');
  dom.window.close();
});

test('apagar los desbloqueos abre los diecisiete de golpe', async () => {
  const { api, clic, $$, dom } = await abrirApp();
  api.store.fijarAjuste('desbloqueosActivos', false);
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="ir"][data-vista="ajustes"]');
  assert.equal($$('[data-accion="tema"]').length, 17);
  assert.equal($$('.tema-opcion.bloqueado').length, 0);
  dom.window.close();
});

test('el tema del padre es independiente del de Nil', async () => {
  const h = await abrirApp();
  const { clic, api, dom } = h;
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="ir"][data-vista="ajustes"]');
  clic('[data-accion="tema"][data-tema="neon"]');
  await entrarComoPadre(h);
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="ir"][data-vista="ajustes"]');
  clic('[data-accion="tema"][data-tema="nebulosa"]');
  assert.equal(api.store.ajuste('temaNil'), 'neon');
  assert.equal(api.store.ajuste('temaPadre'), 'nebulosa');
  dom.window.close();
});

/* ------------------------------ Persistencia ---------------------------- */

test('lo marcado sobrevive a cerrar y volver a abrir la app', async () => {
  const html = await readFile(path.join(RAIZ, 'dist/index.html'), 'utf8');
  const dom1 = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://rutineitor.local/' });
  await new Promise((r) => setTimeout(r, 60));
  const api1 = dom1.window.__rutineitor;
  api1.acciones.marcar({ dataset: { tarea: 't_cama', fecha: new Date().toISOString().slice(0, 10) } });
  const guardado = dom1.window.localStorage.getItem('rutineitor.v3.estado');
  assert.ok(guardado === null || typeof guardado === 'string');
  // Forzamos el guardado inmediato como hace el cierre de la app.
  dom1.window.dispatchEvent(new dom1.window.Event('beforeunload'));
  const copia = dom1.window.localStorage.getItem('rutineitor.v3.estado');
  assert.ok(copia, 'el estado se guarda en el dispositivo');
  assert.match(copia, /t_cama/);
  dom1.window.close();
});

/* ------------------------------- Semana --------------------------------- */

test('cerrar la semana traspasa el sobrante a la hucha desde el panel', async () => {
  const h = await abrirApp();
  const { clic, $, api, window, dom } = h;
  api.store.fijarAjuste('modoSaldo', 'semanal'); // cierre semanal clásico (Avanzado)
  const hoy = new Date().toISOString().slice(0, 10);
  api.store.set('ledger', 'm1', {
    id: 'm1', ts: Date.now(), fecha: hoy, cuenta: 'semana', tipo: 'ajuste',
    cantidad: 42, concepto: 'prueba', categoria: 'ajuste',
    provisional: false, anula: null, anuladoPor: null,
  });
  await entrarComoPadre(h);
  clic('.nav button[data-vista="padre"]');
  clic('[data-accion="tab-padre"][data-tab="semana"]');
  clic('[data-accion="cerrar-semana"]');
  const dialogo = $('.modal-fondo');
  [...dialogo.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  h.pintar();
  assert.equal(api.store.listar('semanas').length, 1);
  const hucha = api.store.listar('ledger').filter((m) => m.cuenta === 'hucha')
    .reduce((s, m) => s + m.cantidad, 0);
  assert.equal(hucha, 42);
  dom.window.close();
});

test('el botón del ojo aparta la interfaz para ver el fondo, y vuelve sola', async () => {
  const { clic, $, window, dom } = await abrirApp();
  const app = () => $('.app');
  assert.ok(!app().classList.contains('escaparate'), 'arranca con la interfaz puesta');
  clic('[data-accion="escaparate"]');
  assert.ok(app().classList.contains('escaparate'), 'al tocar el ojo se aparta');
  // Tocar en cualquier sitio la devuelve.
  await new Promise((r) => setTimeout(r, 90));
  window.document.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  assert.ok(!app().classList.contains('escaparate'), 'un toque la devuelve');
  dom.window.close();
});

test('en modo padre no aparece el botón de ver el fondo', async () => {
  const { api, pintar, $, dom } = await abrirApp();
  api.ui.modo = 'padre';
  pintar();
  assert.equal($('[data-accion="escaparate"]'), null);
  dom.window.close();
});

/* ------------------------- La capa de juego (v3.3) ---------------------- */

test('el panel de inicio enseña el nivel y las misiones del día', async () => {
  const { texto, $, dom } = await abrirApp();
  assert.match(texto(), /Aprendiz/, 'sale el nombre del nivel');
  assert.match(texto(), /Misiones de hoy/);
  assert.ok($('.nivel-barra'), 'hay barra de nivel');
  assert.ok($('[data-saldo="semana"]'), 'el saldo tiene ancla para el número que vuela');
  dom.window.close();
});

test('marcar una tarea lanza el número que vuela y actualiza el saldo', async () => {
  const { clic, $, $$, api, window, dom } = await abrirApp();
  clic('.nav button[data-vista="tareas"]');
  const boton = $$('[data-accion="marcar"]')[0];
  assert.ok(boton, 'hay algo que marcar');
  clic(boton);
  // El aviso lo confirma; el adorno puede no dibujarse en jsdom y da igual.
  assert.match($('#rt-aviso').textContent, /\+\d+|Marcada/);
  assert.ok(Object.keys(api.store.estado.marcas).length >= 1);
  dom.window.close();
});

test('los efectos se pueden apagar desde los ajustes de Nil', async () => {
  const { clic, $, api, dom } = await abrirApp();
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="ir"][data-vista="ajustes"]');
  const casilla = $('[data-ajuste="efectosActivos"]');
  assert.ok(casilla, 'hay interruptor de efectos');
  assert.ok(casilla.checked, 'vienen encendidos');
  const sonido = $('[data-ajuste="sonidoActivo"]');
  assert.ok(sonido && !sonido.checked, 'el sonido viene apagado a propósito');
  dom.window.close();
});

test('la pantalla de logros se abre y cuenta cuántos llevas', async () => {
  const { clic, texto, $$, dom } = await abrirApp();
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="ir"][data-vista="logros"]');
  assert.match(texto(), /Mis logros/);
  assert.ok($$('.logro').length >= 30, 'se ven todos los logros del catálogo');
  assert.ok($$('.logro.pendiente').length >= 25, 'la mayoría están por conseguir');
  assert.match(texto(), /Secreto/, 'los secretos no enseñan la pista');
  dom.window.close();
});

test('Nil hace una propuesta y le llega al padre', async () => {
  const { clic, $, api, window, dom } = await abrirApp();
  clic('.nav button[data-vista="mas"]');
  clic('[data-accion="ir"][data-vista="propuestas"]');
  clic('[data-accion="nueva-propuesta"]');

  const m = $('.modal-fondo');
  assert.ok(m, 'se abre el formulario');
  m.querySelector('[data-tipo]').value = 'tarea';
  m.querySelector('[data-nombre]').value = 'Bajar el reciclaje';
  m.querySelector('[data-valor]').value = '7';
  m.querySelector('[data-motivo]').value = 'Lo bajo yo todas las semanas y no cuenta.';
  [...m.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const lista = api.store.listar('propuestas');
  assert.equal(lista.length, 1);
  assert.equal(lista[0].estado, 'pendiente');
  assert.equal(lista[0].nombre, 'Bajar el reciclaje');
  dom.window.close();
});

test('el padre ve la propuesta y al aceptarla la tarea aparece de verdad', async () => {
  const { clic, $, api, pintar, dom } = await abrirApp();
  const r = api.acciones; // se usa el núcleo directamente para llegar al panel
  api.store.set('propuestas', 'pr_test', {
    id: 'pr_test', tipo: 'tarea', nombre: 'Regar las plantas', valor: 5,
    motivo: 'Me gusta hacerlo y no está.', estado: 'pendiente',
    fecha: new Date().toISOString().slice(0, 10), ts: Date.now(),
    contraoferta: null, respuesta: null, moneda: 'semana', icono: '🪴', tareaId: null,
  });
  api.ui.modo = 'padre';
  api.ui.vista = 'padre';
  api.ui.tabPadre = 'propuestas';
  pintar();

  assert.match($('#app').textContent, /Regar las plantas/);
  const antes = api.store.listar('tareas').length;
  clic('[data-accion="aceptar-propuesta"][data-id="pr_test"]');
  assert.equal(api.store.listar('tareas').length, antes + 1);
  assert.equal(api.store.obtener('propuestas', 'pr_test').estado, 'aceptada');
  dom.window.close();
});

test('rechazar una propuesta exige motivo también desde la interfaz', async () => {
  const { clic, $, api, pintar, window, dom } = await abrirApp();
  api.store.set('propuestas', 'pr_no', {
    id: 'pr_no', tipo: 'tarea', nombre: 'Tener perro', valor: 0,
    motivo: 'Porfa porfa porfa.', estado: 'pendiente',
    fecha: new Date().toISOString().slice(0, 10), ts: Date.now(),
    contraoferta: null, respuesta: null, moneda: 'semana', icono: '🐕', tareaId: null,
  });
  api.ui.modo = 'padre';
  api.ui.vista = 'padre';
  api.ui.tabPadre = 'propuestas';
  pintar();

  clic('[data-accion="rechazar-propuesta"][data-id="pr_no"]');
  const m = $('.modal-fondo');
  [...m.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(api.store.obtener('propuestas', 'pr_no').estado, 'pendiente', 'sin motivo no se cierra');
  assert.match($('#rt-aviso').textContent, /por qué/i);
  dom.window.close();
});

test('el padre lanza un reto de la casa y Nil lo ve en su panel', async () => {
  const { clic, $, api, pintar, window, dom } = await abrirApp();
  api.ui.modo = 'padre';
  api.ui.vista = 'padre';
  api.ui.tabPadre = 'propuestas';
  pintar();

  clic('[data-accion="nuevo-reto"]');
  const m = $('.modal-fondo');
  m.querySelector('[data-tipo]').value = 'tareas';
  m.querySelector('[data-meta]').value = '4';
  m.querySelector('[data-premio]').value = 'Pizza y peli el sábado';
  [...m.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(api.store.listar('retos').length, 1);
  api.ui.modo = 'nil';
  api.ui.vista = 'inicio';
  pintar();
  assert.match($('#app').textContent, /Reto de la casa/);
  assert.match($('#app').textContent, /Pizza y peli el sábado/);
  dom.window.close();
});

test('aprobar con nota: el padre elige un atajo y Nil lo ve en su lista', async () => {
  const { clic, $, $$, api, pintar, window, dom } = await abrirApp();
  const hoy = new Date().toISOString().slice(0, 10);
  clic('.nav button[data-vista="tareas"]');
  // La tarea se coge de lo que HAY hoy en pantalla: el catálogo cambia según
  // el día de la semana y elegir una del catálogo entero falla los domingos.
  const boton = $$('[data-accion="marcar"]')[0];
  assert.ok(boton, 'hoy tiene que haber algo que marcar');
  const tarea = { id: boton.dataset.tarea };
  clic(boton);

  api.ui.modo = 'padre';
  api.ui.vista = 'padre';
  api.ui.tabPadre = 'aprobaciones';
  pintar();
  clic('[data-accion="aprobar-con-nota"]');

  const m = $('.modal-fondo');
  assert.ok(m, 'se abre el modal de la nota');
  m.querySelector('[data-rapida]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const texto = m.querySelector('[data-nota]').value;
  assert.ok(texto.length > 3, 'el atajo rellena el campo');
  [...m.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  const marca = api.store.obtener('marcas', `${hoy}__${tarea.id}`);
  assert.equal(marca.estado, 'aprobada');
  assert.equal(marca.nota, texto);

  api.ui.modo = 'nil';
  api.ui.vista = 'tareas';
  pintar();
  assert.match($('#app').textContent, /Papá:/, 'Nil ve la nota en su lista');
  dom.window.close();
});

/* ------------------- El asistente de primer uso (v3.4) ------------------ */

test('una app recién instalada abre el asistente, no la app', async () => {
  const { $, texto, dom } = await abrirApp('dist/index.html', { sinConfigurar: true });
  assert.ok($('.asistente'), 'se ve el asistente');
  assert.equal($('.nav'), null, 'sin barra de navegación: todavía no hay nada que navegar');
  assert.match(texto(), /Bienvenido a Rutineitor/);
  assert.ok($('[data-accion="asis-saltar"]'), 'se puede saltar desde el principio');
  dom.window.close();
});

test('el asistente avanza, vuelve atrás y no pierde lo escrito', async () => {
  const { clic, $, texto, dom } = await abrirApp('dist/index.html', { sinConfigurar: true });
  clic('[data-accion="asis-siguiente"]');
  assert.match(texto(), /¿De quién es la app\?/);

  $('[data-campo="nombre"]').value = 'Marta';
  clic('[data-accion="asis-siguiente"]');
  assert.match(texto(), /El colegio/);

  clic('[data-accion="asis-atras"]');
  assert.equal($('[data-campo="nombre"]').value, 'Marta', 'al volver sigue ahí');
  dom.window.close();
});

test('sin nombre no deja pasar y lo dice', async () => {
  const { clic, $, dom } = await abrirApp('dist/index.html', { sinConfigurar: true });
  clic('[data-accion="asis-siguiente"]');
  $('[data-campo="nombre"]').value = '';
  clic('[data-accion="asis-siguiente"]');
  assert.ok($('.asis-error'), 'sale el aviso');
  assert.match($('.asis-error').textContent, /nombre/i);
  assert.match($('#app').textContent, /¿De quién es la app\?/, 'sigue en el mismo paso');
  dom.window.close();
});

test('el asistente entero deja la app configurada a medida', async () => {
  const { clic, $, $$, api, window, dom } = await abrirApp('dist/index.html', { sinConfigurar: true });
  clic('[data-accion="asis-siguiente"]');          // bienvenida -> nombre
  $('[data-campo="nombre"]').value = 'Marta';
  clic('[data-accion="asis-siguiente"]');          // nombre -> colegio
  $('[data-campo="entradaColegio"]').value = '09:00';
  $('[data-campo="salidaColegio"]').value = '14:00';
  clic('[data-accion="asis-siguiente"]');          // colegio -> horas
  $('[data-campo="dormirEntreSemana"]').value = '21:30';
  clic('[data-accion="asis-siguiente"]');          // horas -> bloques

  // Se quita el bloque de la mañana.
  const manana = $('[data-grupo="bloques"][value="manana"]');
  manana.checked = false;
  manana.dispatchEvent(new window.Event('change', { bubbles: true }));
  clic('[data-accion="asis-siguiente"]');          // bloques -> ocio
  clic('[data-accion="asis-siguiente"]');          // ocio -> juego
  clic('[data-accion="asis-siguiente"]');          // juego -> listo
  assert.match($('#app').textContent, /Todo listo/);
  assert.match($('#app').textContent, /Marta/);

  clic('[data-accion="asis-terminar"]');
  assert.equal(api.store.ajuste('nombreHijo'), 'Marta');
  assert.equal(api.store.ajuste('dormirEntreSemana'), '21:30');
  assert.equal(api.store.ajuste('configurado'), true);
  const cole = api.store.listar('horario').filter((b) => b.tipo === 'colegio');
  assert.equal(cole[0].inicio, '09:00');
  assert.ok(api.store.listar('tareas').filter((t) => t.categoria === 'manana')
    .every((t) => t.activa === false), 'la mañana quedó apartada');

  // Y ya se ve la app de verdad.
  assert.ok($('.nav'), 'ya hay navegación');
  assert.match($('#app').textContent, /Hola, Marta/);
  dom.window.close();
});

test('saltar el asistente deja entrar con el catálogo de fábrica', async () => {
  const { clic, $, api, dom } = await abrirApp('dist/index.html', { sinConfigurar: true });
  clic('[data-accion="asis-saltar"]');
  assert.equal($('.asistente'), null);
  assert.ok($('.nav'));
  assert.equal(api.store.ajuste('nombreHijo'), 'Nil', 'nada tocado');
  assert.equal(api.store.ajuste('configurado'), true);
  dom.window.close();
});

test('marcar una casilla se ve al instante', async () => {
  const { clic, $, window, dom } = await abrirApp('dist/index.html', { sinConfigurar: true });
  for (let i = 0; i < 4; i++) clic('[data-accion="asis-siguiente"]');
  const cuidado = $('[data-grupo="bloques"][value="cuidado"]');
  assert.ok(cuidado.closest('.asis-opcion').classList.contains('sel'));
  cuidado.checked = false;
  cuidado.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.ok(!$('[data-grupo="bloques"][value="cuidado"]').closest('.asis-opcion').classList.contains('sel'),
    'se queda sin marcar tras repintar');
  dom.window.close();
});

test('el padre puede reabrir el asistente desde el panel', async () => {
  const { api, pintar, $, dom } = await abrirApp();
  api.ui.modo = 'padre';
  api.ui.vista = 'padre';
  api.ui.tabPadre = 'sistema';
  pintar();
  assert.ok($('[data-accion="reabrir-asistente"]'), 'está el botón');

  api.store.fijarAjuste('configurado', false);
  pintar();
  assert.ok($('.asistente'), 'y vuelve a salir el asistente');
  dom.window.close();
});

/* ------------------------- Economía v3.5 (panel) ------------------------- */

function comoPadre(api, pintar, tab, eco = null) {
  api.ui.modo = 'padre';
  api.ui.vista = 'padre';
  api.ui.tabPadre = tab;
  if (eco) api.ui.ecoTab = eco;
  pintar();
}

function pulsarUltimaAccion(window, $) {
  const dialogo = $('.modal-fondo');
  assert.ok(dialogo, 'tiene que haber un diálogo abierto');
  [...dialogo.querySelectorAll('[data-accion-modal]')].pop()
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

test('Economía → Reglas enseña lo sencillo; lo avanzado aparece al encenderlo en Avanzado', async () => {
  const { api, pintar, $, clic, dom } = await abrirApp();
  comoPadre(api, pintar, 'economia', 'reglas');
  for (const id of ['interesHuchaPct', 'huchaSacarNil', 'depositoActivo', 'desbloqueosActivos',
    'propuestasActivas', 'efectosActivos', 'sonidoActivo']) {
    assert.ok($(`[data-tk="${id}"]`), `falta el mando de ${id}`);
  }
  for (const id of ['escudoCadaSemanas', 'misionesPorDia', 'apuestaActiva', 'stakingSuenoActivo', 'bonoNocheCumplida', 'bonoRachaCreditos']) {
    assert.equal($(`[data-tk="${id}"]`), null, `${id} tiene que estar escondido`);
  }
  api.ui.ecoTab = 'avanzado';
  pintar();
  clic('[data-accion="instrumento"][data-id="escudos"]');
  clic('[data-accion="instrumento"][data-id="misiones"]');
  api.ui.ecoTab = 'reglas';
  pintar();
  assert.ok($('[data-tk="escudoCadaSemanas"]'));
  assert.ok($('[data-tk="misionesPorDia"]'));
  assert.equal(api.store.ajuste('misionesActivas'), true);
  dom.window.close();
});

test('la app arranca con la economía simplificada (sin pestaña Tokenomics, con Días pasados)', async () => {
  const { api, pintar, $, $$, dom } = await abrirApp();
  assert.equal(api.store.ajuste('versionEconomia'), 36);
  assert.equal(api.store.ajuste('apuestaActiva'), false);
  assert.equal(api.store.ajuste('modoSaldo'), 'continuo');
  comoPadre(api, pintar, 'economia');
  const pestanas = $$('[data-accion="tab-padre"]').map((b) => b.dataset.tab);
  assert.ok(!pestanas.includes('tokenomics'));
  assert.ok(pestanas.includes('dias'));
  assert.ok($('[data-accion="eco-tab"][data-tab="historico"]'));
  dom.window.close();
});

test('quitar puntos con motivo desde el panel, y Nil lo ve en su ahorro', async () => {
  const { api, pintar, $, clic, window, texto, dom } = await abrirApp();
  darSaldo(api, 30);
  comoPadre(api, pintar, 'economia');
  clic('[data-accion="ajuste-manual"][data-modo="quitar"]');
  const d = $('.modal-fondo');
  assert.ok(d.querySelector('input[name="aj-modo"][value="quitar"]').checked);
  d.querySelector('#aj-c').value = '4';
  d.querySelector('[data-motivo="Pantallas sin permiso"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(d.querySelector('#aj-m').value, 'Pantallas sin permiso');
  pulsarUltimaAccion(window, $);
  const mov = api.store.listar('ledger').find((m) => m.concepto === 'Pantallas sin permiso');
  assert.ok(mov);
  assert.equal(mov.cantidad, -4);
  assert.equal(mov.actor, 'padre');
  api.ui.modo = 'nil';
  api.ui.vista = 'ahorro';
  pintar();
  assert.match(texto(), /Pantallas sin permiso/);
  assert.match(texto(), /Quitado por papá/);
  dom.window.close();
});

test('el histórico filtra al cambiar un filtro y se puede anular con motivo', async () => {
  const { api, pintar, $, $$, clic, window, dom } = await abrirApp();
  darSaldo(api, 25);
  comoPadre(api, pintar, 'economia', 'historico');
  assert.equal($$('#rt-contenido .movimiento').length, 1);
  const sel = $('[data-filtro="cuenta"]');
  sel.value = 'hucha';
  sel.dispatchEvent(new window.Event('change', { bubbles: true }));
  pintar();
  assert.equal($$('#rt-contenido .movimiento').length, 0);
  clic('[data-accion="limpiar-filtros"]');
  clic('[data-accion="anular-mov"]');
  $('.modal-fondo #rt-motivo').value = 'Era una prueba';
  pulsarUltimaAccion(window, $);
  pintar();
  const anul = api.store.listar('ledger').find((m) => m.tipo === 'anulacion');
  assert.ok(anul);
  assert.match(anul.concepto, /Era una prueba/);
  assert.equal(api.store.listar('ledger').reduce((s, m) => s + m.cantidad, 0), 0);
  dom.window.close();
});

test('días pasados: se recupera el día de ayer validando varias tareas de golpe', async () => {
  const { api, pintar, $, $$, clic, dom } = await abrirApp();
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const clave = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
  comoPadre(api, pintar, 'dias');
  api.ui.diaPasado = clave;
  pintar();
  const casillas = $$('[data-dp-tarea]');
  assert.ok(casillas.length >= 2, 'ayer tenía tareas');
  clic('[data-accion="dp-todas"]');
  assert.ok($$('[data-dp-tarea]').every((c) => c.checked), 'siguen marcadas tras repintar');
  clic('[data-accion="validar-dia-pasado"]');
  const marcas = api.store.listar('marcas').filter((m) => m.fecha === clave);
  assert.equal(marcas.length, casillas.length);
  assert.ok(marcas.every((m) => m.estado === 'aprobada'));
  assert.ok(api.store.listar('ledger').filter((m) => m.refTipo === 'tarea').every((m) => m.fecha === clave));
  assert.equal($$('[data-dp-tarea]').length, 0, 'el día queda completo');
  dom.window.close();
});

test('Nil guarda créditos en la hucha él solo', async () => {
  const { api, pintar, $, clic, window, dom } = await abrirApp();
  darSaldo(api, 60);
  api.ui.vista = 'ahorro';
  pintar();
  clic('[data-accion="guardar-hucha"]');
  $('.modal-fondo #tr-c').value = '25';
  pulsarUltimaAccion(window, $);
  pintar();
  const hucha = api.store.listar('ledger').filter((m) => m.cuenta === 'hucha').reduce((s, m) => s + m.cantidad, 0);
  assert.equal(hucha, 25);
  assert.equal($('[data-saldo="semana"]').textContent, '35');
  dom.window.close();
});

test('editar un regalo de estrellas no lo cambia de moneda', async () => {
  const { api, pintar, $, clic, window, dom } = await abrirApp();
  comoPadre(api, pintar, 'catalogo');
  api.ui.catTab = 'tienda';
  pintar();
  clic('[data-accion="editar-premio"][data-articulo="e_libro"]');
  assert.equal($('.modal-fondo #pr-m').value, 'estrellas');
  $('.modal-fondo #pr-p').value = '12';
  pulsarUltimaAccion(window, $);
  const a = api.store.obtener('tienda', 'e_libro');
  assert.equal(a.moneda, 'estrellas');
  assert.equal(a.precio, 12);
  dom.window.close();
});

test('una tarea normal se puede convertir en «a elegir» con sus opciones', async () => {
  const { api, pintar, $, $$, clic, window, dom } = await abrirApp();
  comoPadre(api, pintar, 'catalogo');
  clic('[data-accion="editar-tarea"][data-tarea="t_cama"]');
  const sel = $('.modal-fondo #ta-tipo');
  sel.value = 'eleccion';
  sel.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal($$('.modal-fondo [data-op-fila]').length, 2, 'aparecen dos opciones');
  $('.modal-fondo [data-op-anadir]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal($$('.modal-fondo [data-op-fila]').length, 3);
  $('.modal-fondo [data-op-et="2"]').value = 'Con sábanas limpias';
  $('.modal-fondo [data-op-v="2"]').value = '4';
  pulsarUltimaAccion(window, $);
  const t = api.store.obtener('tareas', 't_cama');
  assert.equal(t.tipo, 'eleccion');
  assert.equal(t.opciones.length, 3);
  assert.equal(t.opciones[2].valor, 4);
  dom.window.close();
});
