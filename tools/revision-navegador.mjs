#!/usr/bin/env node
/**
 * Revisión en un navegador real (Chromium) sobre los archivos publicados.
 * Comprueba: que no hay errores de consola, que no hay desbordamiento
 * horizontal en pantalla de móvil, que el service worker se registra, que el
 * manifest es válido y que cada pantalla se pinta. Guarda capturas.
 */

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');
const CAPTURAS = process.argv[2] || path.join(RAIZ, 'capturas');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

function ejecutable() {
  // Se puede indicar a mano el Chromium a usar (útil fuera del entorno habitual).
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  for (const base of ['/opt/pw-browsers']) {
    if (!existsSync(base)) continue;
    const candidatos = [
      path.join(base, 'chromium', 'chrome-linux', 'chrome'),
      ...['chromium-1243', 'chromium-1194'].map((d) => path.join(base, d, 'chrome-linux', 'chrome')),
      ...['chromium-1243', 'chromium-1194'].map((d) => path.join(base, d, 'chrome-linux64', 'chrome')),
    ];
    for (const c of candidatos) if (existsSync(c)) return c;
  }
  return undefined;
}

async function servidor(puerto = 0) {
  const s = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const archivo = path.join(DIST, rel);
    try {
      const datos = await fs.readFile(archivo);
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
      res.end(datos);
    } catch (e) {
      res.writeHead(404);
      res.end('no');
    }
  });
  await new Promise((r) => s.listen(puerto, r));
  return { servidor: s, puerto: s.address().port };
}

const PANTALLAS = [
  { id: '1-inicio', nav: null },
  { id: '2-tareas', nav: 'tareas' },
  { id: '3-tienda', nav: 'tienda' },
  { id: '4-agenda-horario', nav: 'agenda' },
  { id: '5-agenda-calendario', nav: 'agenda', extra: '[data-accion="agenda-tab"][data-tab="calendario"]' },
  { id: '6-mas', nav: 'mas' },
  { id: '7-progreso', nav: 'mas', extra: '[data-accion="ir"][data-vista="progreso"]' },
  { id: '8-salud', nav: 'mas', extra: '[data-accion="ir"][data-vista="salud"]' },
  { id: '9-ahorro', nav: 'mas', extra: '[data-accion="ir"][data-vista="ahorro"]' },
  { id: '10-billetes', nav: 'mas', extra: '[data-accion="ir"][data-vista="billetes"]' },
];

async function main() {
  await fs.mkdir(CAPTURAS, { recursive: true });
  const { servidor: srv, puerto } = await servidor();
  const base = `http://127.0.0.1:${puerto}`;
  const navegador = await chromium.launch({ executablePath: ejecutable(), args: ['--no-sandbox'] });
  const contexto = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
  });
  const pagina = await contexto.newPage();

  const errores = [];
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  pagina.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  const peticiones = [];
  pagina.on('request', (r) => peticiones.push(r.url()));

  await pagina.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

  const problemas = [];

  // ---- Lo primero que ve cualquiera que instale la app: el asistente.
  await pagina.waitForSelector('.asistente', { timeout: 10000 });
  const PASOS_ASIS = ['bienvenida', 'nombre', 'colegio', 'horas', 'bloques', 'ocio', 'juego', 'listo'];
  for (let i = 0; i < PASOS_ASIS.length; i++) {
    const estado = await pagina.evaluate(() => {
      const caja = document.querySelector('.asis-tarjeta');
      return {
        titulo: (caja.querySelector('h1') || {}).textContent || '',
        texto: caja.textContent,
        ancho: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
        haySalir: Boolean(document.querySelector('[data-accion="asis-saltar"]')),
      };
    });
    if (!estado.titulo.trim()) problemas.push(`el paso ${PASOS_ASIS[i]} del asistente no tiene título`);
    if (!estado.haySalir) problemas.push(`el paso ${PASOS_ASIS[i]} no deja saltarse el asistente`);
    if (estado.ancho > estado.ventana + 1) {
      problemas.push(`el paso ${PASOS_ASIS[i]} del asistente se sale de la pantalla`);
    }
    if (/undefined|NaN|\[object/.test(estado.texto)) {
      problemas.push(`el paso ${PASOS_ASIS[i]} tiene un hueco sin rellenar`);
    }
    await pagina.screenshot({ path: path.join(CAPTURAS, `0${i}-asistente-${PASOS_ASIS[i]}.png`) });

    if (i === 1) await pagina.fill('[data-campo="nombre"]', 'Marta');
    if (i < PASOS_ASIS.length - 1) {
      await pagina.click('[data-accion="asis-siguiente"]');
      await pagina.waitForTimeout(180);
    }
  }

  // Sin nombre no deja pasar: se comprueba volviendo atrás y vaciándolo.
  const frena = await pagina.evaluate(async () => {
    const api = window.__rutineitor;
    api.ui.asistente.paso = 'nombre';
    api.render();
    document.querySelector('[data-campo="nombre"]').value = '';
    document.querySelector('[data-accion="asis-siguiente"]').click();
    await new Promise((r) => setTimeout(r, 80));
    return {
      error: Boolean(document.querySelector('.asis-error')),
      sigueAqui: api.ui.asistente.paso === 'nombre',
    };
  });
  if (!frena.error || !frena.sigueAqui) problemas.push('el asistente deja pasar sin nombre');

  // Se termina de verdad y se comprueba que la app queda a medida.
  const configurada = await pagina.evaluate(async () => {
    const api = window.__rutineitor;
    api.ui.asistente.datos.nombre = 'Marta';
    api.ui.asistente.datos.bloques = ['tarde', 'noche', 'cuidado'];
    api.ui.asistente.datos.entradaColegio = '09:00';
    api.ui.asistente.datos.salidaColegio = '14:00';
    api.ui.asistente.paso = 'listo';
    api.render();
    document.querySelector('[data-accion="asis-terminar"]').click();
    await new Promise((r) => setTimeout(r, 250));
    return {
      nombre: api.store.ajuste('nombreHijo'),
      configurado: api.store.ajuste('configurado'),
      hayNav: Boolean(document.querySelector('.nav button')),
      hayAsistente: Boolean(document.querySelector('.asistente')),
      mananaApartada: api.store.listar('tareas')
        .filter((t) => t.categoria === 'manana').every((t) => t.activa === false),
      colegio: api.store.listar('horario').filter((b) => b.tipo === 'colegio').length,
    };
  });
  if (configurada.nombre !== 'Marta') problemas.push('el asistente no guarda el nombre');
  if (!configurada.configurado) problemas.push('el asistente no se marca como terminado');
  if (configurada.hayAsistente || !configurada.hayNav) problemas.push('tras terminar no se entra en la app');
  if (!configurada.mananaApartada) problemas.push('quitar un bloque no aparta sus tareas');
  if (configurada.colegio !== 5) problemas.push(`quedan ${configurada.colegio} bloques de colegio, deberían ser 5`);

  // A partir de aquí se revisa la app ya configurada, con el nombre de siempre.
  await pagina.evaluate(() => {
    window.__rutineitor.store.fijarAjuste('nombreHijo', 'Nil');
    for (const t of window.__rutineitor.store.listar('tareas')) {
      window.__rutineitor.store.patch('tareas', t.id, { activa: true });
    }
    window.__rutineitor.ui.vista = 'inicio';
    window.__rutineitor.render();
  });
  await pagina.waitForSelector('.nav button');

  for (const p of PANTALLAS) {
    if (p.nav) await pagina.click(`.nav button[data-vista="${p.nav}"]`);
    if (p.extra) await pagina.click(p.extra);
    await pagina.waitForTimeout(240);
    await pagina.screenshot({ path: path.join(CAPTURAS, `${p.id}.png`) });

    const medidas = await pagina.evaluate(() => ({
      ancho: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      vacio: document.getElementById('rt-contenido').textContent.trim().length,
      botonesPequenos: [...document.querySelectorAll('button')]
        .filter((b) => b.offsetParent !== null)
        .filter((b) => b.getBoundingClientRect().height < 30).length,
    }));
    if (medidas.ancho > medidas.ventana + 1) {
      problemas.push(`${p.id}: desborde horizontal (${medidas.ancho} > ${medidas.ventana})`);
    }
    if (medidas.vacio < 40) problemas.push(`${p.id}: pantalla vacía`);
    if (medidas.botonesPequenos > 0) {
      problemas.push(`${p.id}: ${medidas.botonesPequenos} botones de menos de 30px de alto`);
    }
  }

  // Panel del padre: crear clave y recorrer las pestañas.
  await pagina.click('.nav button[data-vista="mas"]');
  await pagina.click('[data-accion="entrar-padre"]');
  await pagina.fill('#cl-1', 'clave-de-prueba');
  await pagina.fill('#cl-2', 'clave-de-prueba');
  await pagina.click('.modal .acciones .btn.principal');
  await pagina.waitForTimeout(240);
  for (const tab of ['aprobaciones', 'propuestas', 'economia', 'dias', 'catalogo', 'semana', 'sistema']) {
    await pagina.click(`[data-accion="tab-padre"][data-tab="${tab}"]`);
    await pagina.waitForTimeout(220);
    await pagina.screenshot({ path: path.join(CAPTURAS, `11-padre-${tab}.png`) });
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 391) problemas.push(`padre/${tab}: desborde horizontal (${ancho})`);
  }

  // Economía (v3.5): cada subpestaña, y los diálogos principales.
  await pagina.click('[data-accion="tab-padre"][data-tab="economia"]');
  for (const sub of ['resumen', 'historico', 'herramientas', 'reglas', 'avanzado']) {
    await pagina.click(`[data-accion="eco-tab"][data-tab="${sub}"]`);
    await pagina.waitForTimeout(200);
    await pagina.screenshot({ path: path.join(CAPTURAS, `12-economia-${sub}.png`), fullPage: true });
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > 391) problemas.push(`economía/${sub}: desborde horizontal (${ancho})`);
  }
  const dialogos = [
    ['herramientas', '[data-accion="ajuste-manual"][data-modo="quitar"]', 'quitar-puntos'],
    ['herramientas', '[data-accion="traspaso-padre"]', 'hucha'],
    ['herramientas', '[data-accion="multiplicador"]', 'multiplicador'],
    ['herramientas', '[data-accion="precios-bloque"]', 'precios'],
  ];
  for (const [sub, sel, nombre] of dialogos) {
    await pagina.click(`[data-accion="eco-tab"][data-tab="${sub}"]`);
    await pagina.waitForTimeout(150);
    await pagina.click(sel);
    await pagina.waitForTimeout(200);
    await pagina.screenshot({ path: path.join(CAPTURAS, `13-dialogo-${nombre}.png`) });
    const ancho = await pagina.evaluate(() => document.querySelector('.modal').scrollWidth - document.querySelector('.modal').clientWidth);
    if (ancho > 1) problemas.push(`diálogo ${nombre}: desborde horizontal (${ancho})`);
    await pagina.click('.modal [data-cerrar-modal]');
    await pagina.waitForTimeout(120);
  }
  await pagina.click('[data-accion="tab-padre"][data-tab="catalogo"]');
  await pagina.click('[data-accion="editar-tarea"][data-tarea="t_lavavajillas"]');
  await pagina.waitForTimeout(200);
  await pagina.screenshot({ path: path.join(CAPTURAS, '13-dialogo-tarea.png') });
  await pagina.click('.modal [data-cerrar-modal]');
  await pagina.click('[data-accion="cat-tab"][data-tab="tienda"]');
  await pagina.waitForTimeout(200);
  await pagina.screenshot({ path: path.join(CAPTURAS, '12-catalogo-tienda.png'), fullPage: true });

  // Las reglas tienen que escribir de verdad en los ajustes.
  await pagina.click('[data-accion="tab-padre"][data-tab="economia"]');
  await pagina.click('[data-accion="eco-tab"][data-tab="reglas"]');
  await pagina.waitForTimeout(200);
  await pagina.click('details.tk-grupo >> nth=2');
  await pagina.waitForTimeout(150);
  await pagina.fill('#tk-umbralRacha', '85');
  await pagina.dispatchEvent('#tk-umbralRacha', 'change');
  await pagina.waitForTimeout(250);
  const umbral = await pagina.evaluate(() => window.__rutineitor.store.ajuste('umbralRacha'));
  if (umbral !== 85) problemas.push(`reglas: el umbral no se guardó (${umbral})`);
  await pagina.fill('#tk-umbralRacha', '5');
  await pagina.dispatchEvent('#tk-umbralRacha', 'change');
  await pagina.waitForTimeout(250);
  const umbral2 = await pagina.evaluate(() => window.__rutineitor.store.ajuste('umbralRacha'));
  if (umbral2 !== 85) problemas.push(`reglas: aceptó un valor fuera de límites (${umbral2})`);

  // Volvemos a la vista de Nil.
  await pagina.click('[data-accion="salir-padre"]');
  await pagina.waitForTimeout(200);

  // ---- El fondo animado: lienzo vivo, con relieve, que reacciona y que se para.
  const fondo = await pagina.evaluate(() => {
    const c = document.querySelector('#rt-fondo canvas.rt-lienzo');
    const motor = window.__rutineitor.motor;
    if (!c || !motor) return { falta: true };
    return {
      ancho: c.width, alto: c.height,
      anchoCss: c.clientWidth, altoCss: c.clientHeight,
      nivel: motor.nivel, vivo: motor.vivo, escena: motor.escena,
    };
  });
  if (fondo.falta) problemas.push('no hay lienzo de fondo ni motor');
  else {
    if (fondo.ancho < fondo.anchoCss) problemas.push(`el lienzo no usa la densidad de pantalla (${fondo.ancho}<${fondo.anchoCss})`);
    if (fondo.altoCss < 400) problemas.push(`el lienzo no cubre la pantalla (${fondo.altoCss}px de alto)`);
    if (!fondo.vivo) problemas.push('el fondo no está animándose');
  }

  // El fotograma tiene que tener contenido de verdad: color variado, no un liso.
  const riqueza = await pagina.evaluate(() => {
    const c = document.querySelector('#rt-fondo canvas.rt-lienzo');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const vistos = new Set();
    let sumaL = 0, n = 0, maxL = 0, minL = 255;
    for (let i = 0; i < d.length; i += 4 * 97) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      vistos.add(`${r >> 3},${g >> 3},${b >> 3}`);
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumaL += l; n++;
      if (l > maxL) maxL = l;
      if (l < minL) minL = l;
    }
    return { colores: vistos.size, medio: sumaL / n, rango: maxL - minL };
  });
  if (riqueza.colores < 40) problemas.push(`el fondo es casi liso (${riqueza.colores} colores)`);
  if (riqueza.rango < 40) problemas.push(`el fondo no tiene relieve (rango de luz ${Math.round(riqueza.rango)})`);
  if (riqueza.medio > 150) problemas.push(`el fondo está demasiado claro y se comerá el texto (${Math.round(riqueza.medio)})`);

  // Se mueve: dos fotogramas separados en el tiempo no pueden ser iguales.
  const semejanza = await pagina.evaluate(async () => {
    const c = document.querySelector('#rt-fondo canvas.rt-lienzo');
    const ctx = c.getContext('2d');
    const toma = () => ctx.getImageData(0, 0, c.width, c.height).data;
    const a = toma().slice(0);
    await new Promise((r) => setTimeout(r, 420));
    const b = toma();
    let iguales = 0, total = 0;
    for (let i = 0; i < a.length; i += 4 * 53) {
      total++;
      if (Math.abs(a[i] - b[i]) < 3 && Math.abs(a[i + 1] - b[i + 1]) < 3) iguales++;
    }
    return iguales / total;
  });
  if (semejanza > 0.995) problemas.push('el fondo no se mueve entre fotogramas');

  // Rinde: los fotogramas avanzan a un ritmo razonable.
  const fps = await pagina.evaluate(async () => {
    const m = window.__rutineitor.motor;
    const a = m.fotogramas;
    await new Promise((r) => setTimeout(r, 1000));
    return m.fotogramas - a;
  });
  if (fps < 24) problemas.push(`el fondo va a trompicones (${fps} fotogramas por segundo)`);

  // Parallax: el fondo acompaña al puntero.
  await pagina.mouse.move(20, 100);
  await pagina.waitForTimeout(260);
  await pagina.mouse.move(360, 700);
  await pagina.waitForTimeout(260);
  const par = await pagina.evaluate(() => window.__rutineitor.motor.parallax);
  if (Math.abs(par.px) < 0.05 && Math.abs(par.py) < 0.05) problemas.push('el parallax no reacciona al movimiento');

  // Al ocultar la app, la animación se para (batería).
  await pagina.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pagina.waitForTimeout(200);
  const parado = await pagina.evaluate(async () => {
    const m = window.__rutineitor.motor;
    const a = m.fotogramas;
    await new Promise((r) => setTimeout(r, 400));
    return { vivo: m.vivo, avanza: m.fotogramas - a };
  });
  if (parado.vivo || parado.avanza > 0) problemas.push('la animación no se para cuando la app no se ve');
  await pagina.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pagina.waitForTimeout(300);
  if (!(await pagina.evaluate(() => window.__rutineitor.motor.vivo))) {
    problemas.push('la animación no vuelve al mostrar la app otra vez');
  }

  // Bajar la calidad se nota y apagarla deja el fondo quieto.
  const calidades = await pagina.evaluate(async () => {
    const m = window.__rutineitor.motor;
    m.fijarCalidad('baja');
    await new Promise((r) => setTimeout(r, 300));
    const baja = m.nivel;
    m.fijarCalidad('apagado');
    await new Promise((r) => setTimeout(r, 200));
    const a = m.fotogramas;
    await new Promise((r) => setTimeout(r, 400));
    const quieto = m.fotogramas - a;
    m.fijarCalidad('auto');
    await new Promise((r) => setTimeout(r, 300));
    return { baja, quieto, auto: m.nivel, vivo: m.vivo };
  });
  if (calidades.baja !== 'baja') problemas.push('la calidad baja no se aplica');
  if (calidades.quieto > 0) problemas.push('con la animación apagada el fondo sigue dibujando');
  if (!calidades.vivo) problemas.push('al volver a automática el fondo no arranca');

  // ---- Una captura de cada escena, en el momento del día que mejor la luce.
  const ESCAPARATE = [
    ['neon', 'noche'], ['synthwave', 'atardecer'], ['matrix', 'noche'],
    ['datos', 'noche'], ['circuito', 'noche'],
    ['neuronas', 'noche'], ['adn', 'dia'], ['celula', 'dia'], ['atomos', 'noche'],
    ['nebulosa', 'noche'], ['orbital', 'noche'],
    ['bosque', 'atardecer'], ['oceano', 'dia'], ['aurora', 'noche'],
    ['volcan', 'noche'], ['sakura', 'amanecer'], ['pizarra', 'dia'],
  ];
  await pagina.evaluate(() => { window.__rutineitor.ui.vista = 'inicio'; window.__rutineitor.render(); });
  for (const [temaId, momento] of ESCAPARATE) {
    const ok = await pagina.evaluate(([t, m]) => {
      const api = window.__rutineitor;
      api.store.fijarAjuste('temaNil', t);
      api.render();
      api.motor.fijarTema(t, m);
      return api.motor.escena === t;
    }, [temaId, momento]);
    if (!ok) problemas.push(`la escena ${temaId} no se activa`);
    await pagina.waitForTimeout(700);
    const liso = await pagina.evaluate(() => {
      const c = document.querySelector('#rt-fondo canvas.rt-lienzo');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const s = new Set();
      for (let i = 0; i < d.length; i += 4 * 211) s.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
      return s.size;
    });
    if (liso < 30) problemas.push(`la escena ${temaId} se ve plana (${liso} colores)`);
    // Encima del fondo va texto blanco: ninguna escena puede aclararse tanto
    // que se lo coma, sobre todo en la franja de la cabecera.
    const luz = await pagina.evaluate(() => {
      const c = document.querySelector('#rt-fondo canvas.rt-lienzo');
      const d = c.getContext('2d').getImageData(0, 0, c.width, Math.round(c.height * 0.18)).data;
      let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 37) {
        s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        n++;
      }
      return s / n;
    });
    if (luz > 120) problemas.push(`la escena ${temaId} está tan clara que se come el título (${Math.round(luz)})`);
    await pagina.screenshot({ path: path.join(CAPTURAS, `14-escena-${temaId}-${momento}.png`) });
  }
  await pagina.evaluate(() => {
    window.__rutineitor.store.fijarAjuste('temaNil', 'bosque');
    window.__rutineitor.render();
  });

  // ---- La capa de juego: nivel, logros, misiones y propuestas.
  // Se vuelve a modo Nil a propósito: antes se ha estado en el panel del padre.
  await pagina.evaluate(() => {
    window.__rutineitor.ui.modo = 'nil';
    window.__rutineitor.ui.vista = 'inicio';
    window.__rutineitor.render();
  });
  await pagina.waitForTimeout(220);

  const panel = await pagina.evaluate(() => {
    const t = document.getElementById('app').textContent;
    return {
      ancla: Boolean(document.querySelector('[data-saldo="semana"]')),
      barraNivel: Boolean(document.querySelector('.nivel-barra')),
      misiones: document.querySelectorAll('.mision').length,
      diceNivel: /nivel\s*1/i.test(t),
    };
  });
  if (!panel.ancla) problemas.push('el saldo no tiene ancla para el número que vuela');
  if (!panel.barraNivel) problemas.push('el panel de inicio no enseña la barra de nivel');
  if (!panel.diceNivel) problemas.push('el panel no dice en qué nivel va');
  if (panel.misiones < 1) problemas.push('no se pinta ninguna misión del día');

  for (const [vista, captura] of [['logros', '15-logros'], ['propuestas', '16-propuestas']]) {
    await pagina.evaluate((v) => {
      window.__rutineitor.ui.modo = 'nil';
      window.__rutineitor.ui.vista = v;
      window.__rutineitor.render();
    }, vista);
    await pagina.waitForTimeout(260);
    await pagina.screenshot({ path: path.join(CAPTURAS, `${captura}.png`), fullPage: true });
  }

  const juego = await pagina.evaluate(() => {
    window.__rutineitor.ui.vista = 'logros';
    window.__rutineitor.render();
    const texto = document.getElementById('app').textContent;
    return {
      logros: document.querySelectorAll('.logro').length,
      secretos: /Secreto/.test(texto),
    };
  });
  if (juego.logros < 30) problemas.push(`solo se pintan ${juego.logros} logros`);
  if (!juego.secretos) problemas.push('los logros secretos enseñan su pista antes de tiempo');

  // Marcar una tarea tiene que lanzar el número que vuela.
  const juice = await pagina.evaluate(async () => {
    const api = window.__rutineitor;
    api.ui.vista = 'tareas';
    api.render();
    await new Promise((r) => setTimeout(r, 80));
    const boton = document.querySelector('[data-accion="marcar"]');
    if (!boton) return { sinTareas: true };
    boton.click();
    await new Promise((r) => setTimeout(r, 120));
    return { vuela: document.querySelectorAll('.rt-vuela').length };
  });
  if (juice.sinTareas) problemas.push('no hay ninguna tarea que marcar');
  else if (juice.vuela < 1) problemas.push('marcar una tarea no lanza el número');

  // Y la celebración enciende la escena del fondo.
  const celebra = await pagina.evaluate(async () => {
    const m = window.__rutineitor.motor;
    if (!m) return -1;
    m.celebrar(1);
    await new Promise((r) => setTimeout(r, 120));
    return m.festejo;
  });
  if (celebra <= 0) problemas.push('la celebración no llega al fondo');

  // Con los efectos apagados no se dibuja ninguno.
  const apagados = await pagina.evaluate(async () => {
    const api = window.__rutineitor;
    // Los números del marcado anterior viven casi un segundo: hay que esperar
    // a que se limpien o se contarían como si fueran nuevos.
    await new Promise((r) => setTimeout(r, 1100));
    api.store.fijarAjuste('efectosActivos', false);
    api.ui.vista = 'tareas';
    api.render();
    await new Promise((r) => setTimeout(r, 80));
    const boton = document.querySelector('[data-accion="marcar"]');
    if (boton) boton.click();
    await new Promise((r) => setTimeout(r, 140));
    const n = document.querySelectorAll('.rt-vuela').length;
    api.store.fijarAjuste('efectosActivos', true);
    api.ui.vista = 'inicio';
    api.render();
    return n;
  });
  if (apagados > 0) problemas.push('los efectos siguen saliendo con el interruptor apagado');

  // Sudoku
  await pagina.click('.nav button[data-vista="mas"]');
  await pagina.click('[data-accion="ir"][data-vista="juego"]');
  await pagina.waitForTimeout(200);
  await pagina.screenshot({ path: path.join(CAPTURAS, '8-sudoku.png') });

  // Temas: el selector es ahora un mapa de progreso, con candados.
  await pagina.click('.nav button[data-vista="mas"]');
  await pagina.click('[data-accion="ir"][data-vista="ajustes"]');
  await pagina.waitForTimeout(250);
  await pagina.screenshot({ path: path.join(CAPTURAS, '9-temas.png'), fullPage: true });

  const coleccion = await pagina.evaluate(() => ({
    abiertos: document.querySelectorAll('[data-accion="tema"]').length,
    cerrados: document.querySelectorAll('.tema-opcion.bloqueado').length,
    conRequisito: [...document.querySelectorAll('.tema-candado .rq')]
      .every((n) => n.textContent.trim().length > 4),
  }));
  if (coleccion.abiertos !== 5) problemas.push(`de salida hay ${coleccion.abiertos} fondos abiertos, deberían ser 5`);
  if (coleccion.cerrados !== 12) problemas.push(`hay ${coleccion.cerrados} fondos bloqueados, deberían ser 12`);
  if (!coleccion.conRequisito) problemas.push('algún fondo bloqueado no dice qué falta para abrirlo');

  // Un fondo bloqueado no se puede elegir ni forzando la acción.
  const forzado = await pagina.evaluate(() => {
    const api = window.__rutineitor;
    api.acciones.tema({ dataset: { tema: 'synthwave' } });
    return api.store.ajuste('temaNil');
  });
  if (forzado === 'synthwave') problemas.push('un fondo bloqueado se puede poner a la fuerza');

  // Y uno abierto sí, con su fondo cambiando de verdad.
  await pagina.click('[data-accion="tema"][data-tema="neon"]');
  await pagina.click('.nav button[data-vista="inicio"]');
  await pagina.waitForTimeout(500);
  await pagina.screenshot({ path: path.join(CAPTURAS, '10-tema-neon.png') });

  // Al desbloquear, el selector se abre entero.
  await pagina.evaluate(() => {
    window.__rutineitor.store.fijarAjuste('desbloqueosActivos', false);
    window.__rutineitor.ui.vista = 'ajustes';
    window.__rutineitor.render();
  });
  await pagina.waitForTimeout(250);
  const todos = await pagina.evaluate(() => document.querySelectorAll('[data-accion="tema"]').length);
  if (todos !== 17) problemas.push(`al apagar los desbloqueos deberían verse 17, se ven ${todos}`);
  await pagina.evaluate(() => {
    window.__rutineitor.store.fijarAjuste('desbloqueosActivos', true);
    window.__rutineitor.ui.vista = 'inicio';
    window.__rutineitor.render();
  });

  // ---- Con datos de verdad: las gráficas y los billetes hay que verlos llenos.
  await pagina.evaluate(() => {
    const api = window.__rutineitor;
    const { store } = api;
    const hoy = new Date();
    const clave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const menos = (n) => { const d = new Date(hoy); d.setDate(d.getDate() - n); return clave(d); };

    store.lote((s) => {
      // Historial de créditos de seis semanas.
      for (let i = 42; i >= 0; i--) {
        const f = menos(i);
        const gana = 20 + ((i * 7) % 18);
        s.set('ledger', `h${i}`, {
          id: `h${i}`, ts: Date.now() - i * 86400000, fecha: f, cuenta: 'semana', tipo: 'ganado',
          cantidad: gana, concepto: 'Tareas del día',
          categoria: ['manana', 'tarde', 'noche', 'semanal'][i % 4],
          provisional: false, anula: null, anuladoPor: null,
        });
        if (i % 7 === 0) {
          s.set('ledger', `hh${i}`, {
            id: `hh${i}`, ts: Date.now() - i * 86400000, fecha: f, cuenta: 'hucha', tipo: 'traspaso',
            cantidad: 30 + (i % 20), concepto: 'Cierre de semana', categoria: 'cierre',
            provisional: false, anula: null, anuladoPor: null,
          });
        }
        if (i % 3 === 0) {
          s.set('ledger', `g${i}`, {
            id: `g${i}`, ts: Date.now() - i * 86400000, fecha: f, cuenta: 'semana', tipo: 'gastado',
            cantidad: -12, concepto: 'Bono TV', categoria: 'tienda',
            provisional: false, anula: null, anuladoPor: null,
          });
        }
      }
      s.set('ledger', 'est1', {
        id: 'est1', ts: Date.now(), fecha: menos(0), cuenta: 'estrellas', tipo: 'ganado',
        cantidad: 24, concepto: 'Cuidado', categoria: 'salud',
        provisional: false, anula: null, anuladoPor: null,
      });
      // Noches apuntadas.
      for (let i = 13; i >= 0; i--) {
        const cumplida = i % 4 !== 0;
        s.set('sueno', menos(i), {
          id: menos(i), fecha: menos(i), hora: cumplida ? '22:20' : '23:35',
          cumplida, objetivo: '22:30', desfaseMin: cumplida ? -10 : 65, bono: cumplida ? 2 : 0,
          movimientoId: null, apuntadoEn: Date.now(),
        });
      }
      // Hábitos de los últimos días.
      for (const h of ['h_agua', 'h_planta', 'h_sol', 'h_mover']) {
        for (let i = 9; i >= 0; i--) {
          if ((i + h.length) % 3 === 0) continue;
          const id = `${menos(i)}__${h}`;
          s.set('marcas', id, {
            id, tareaId: h, fecha: menos(i), nombre: h, tipo: 'habito', categoria: 'salud',
            moneda: 'estrellas', estado: 'aprobada', valor: 1, fotos: [],
            movimientoId: null, marcadaEn: Date.now(),
          });
        }
      }
      // Billetes: uno de hoy y varios antiguos.
      const compras = [
        { id: 'c1', itemId: 'b_tv', nombre: 'Bono TV', tipo: 'bono', precio: 10, fecha: menos(0), estado: 'aprobada' },
        { id: 'c2', itemId: 'b_anime', nombre: 'Bono Anime', tipo: 'bono', precio: 12, fecha: menos(0), estado: 'pendiente' },
        { id: 'c3', itemId: 'p_peli', nombre: 'Noche de película', tipo: 'premio', precio: 15, fecha: menos(2), estado: 'aprobada' },
        { id: 'c4', itemId: 'b_buho', nombre: 'Modo Búho', tipo: 'buho', precio: 18, fecha: menos(4), estado: 'aprobada' },
        { id: 'c5', itemId: 'b_movil', nombre: 'Bono Móvil', tipo: 'bono', precio: 14, fecha: menos(6), estado: 'denegada', motivo: 'Hoy no tocaba' },
      ];
      for (const c of compras) {
        s.set('compras', c.id, { ...c, moneda: 'semana', solicitadaEn: Date.now(), resueltaEn: Date.now(), categoriaOcio: null });
      }
      // Un objetivo y un staking en marcha.
      s.fijarAjuste('objetivoAhorroId', 'g_juego');
      s.fijarAjuste('racha', 3);
      s.set('stakings', 'stk1', {
        id: 'stk1', tipo: 'deposito', estado: 'activo', capital: 60, dias: 14, pct: 5,
        interesPrevisto: 3, fechaInicio: menos(5), fechaVencimiento: menos(-9),
        abiertoEn: Date.now(), movimientoBloqueoId: null, movimientoLiquidacionId: null,
        interesPagado: 0, cerradoEn: null,
      });
    });
    api.ui.vista = 'inicio';
    api.render();
  });
  await pagina.waitForTimeout(400);

  for (const [id, vista, extra] of [
    ['20-lleno-inicio', 'inicio'], ['21-lleno-progreso', 'progreso'],
    ['22-lleno-billetes', 'billetes'], ['23-lleno-salud', 'salud'],
    ['24-lleno-ahorro', 'ahorro'],
  ]) {
    await pagina.evaluate((v) => { window.__rutineitor.ui.vista = v; window.__rutineitor.render(); }, vista);
    await pagina.waitForTimeout(320);
    await pagina.screenshot({ path: path.join(CAPTURAS, `${id}.png`), fullPage: true });
    const m = await pagina.evaluate(() => ({
      ancho: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
      nan: document.body.textContent.includes('NaN') || document.body.innerHTML.includes('undefined'),
      svgs: document.querySelectorAll('#rt-contenido svg').length,
    }));
    if (m.ancho > m.ventana + 1) problemas.push(`${id}: desborde horizontal (${m.ancho})`);
    if (m.nan) problemas.push(`${id}: hay un NaN o un undefined en pantalla`);
    if (vista === 'progreso' && m.svgs < 4) problemas.push(`${id}: faltan gráficas (${m.svgs})`);
  }

  // Escritorio
  const anchoGrande = await contexto.newPage();
  await anchoGrande.setViewportSize({ width: 1280, height: 900 });
  await anchoGrande.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await anchoGrande.waitForTimeout(400);
  await anchoGrande.evaluate(() => {
    window.__rutineitor.store.fijarAjuste('configurado', true);
    window.__rutineitor.render();
  });
  await anchoGrande.waitForSelector('.nav button');
  await anchoGrande.screenshot({ path: path.join(CAPTURAS, '11-escritorio.png') });
  await anchoGrande.close();

  // Service worker y manifest
  const sw = await pagina.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'sin soporte';
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? 'registrado' : 'no registrado';
  });
  const manifest = await pagina.evaluate(async () => {
    const l = document.querySelector('link[rel="manifest"]');
    if (!l) return null;
    const r = await fetch(l.href);
    return r.ok ? await r.json() : null;
  });
  if (sw !== 'registrado') problemas.push(`service worker: ${sw}`);
  if (!manifest) problemas.push('manifest no accesible');

  // Funcionamiento sin conexión: se corta la red y debe seguir abriendo.
  await contexto.setOffline(true);
  const sinRed = await contexto.newPage();
  let offlineOk = true;
  try {
    await sinRed.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sinRed.waitForSelector('.nav button', { timeout: 8000 });
    await sinRed.screenshot({ path: path.join(CAPTURAS, '12-sin-internet.png') });
  } catch (e) {
    offlineOk = false;
    problemas.push(`sin conexión: la app no abre (${e.message.split('\n')[0]})`);
  }
  await sinRed.close();
  await contexto.setOffline(false);

  // La demo: se abre como archivo local, sin servidor ni red.
  const demo = await contexto.newPage();
  const pedidasDemo = [];
  demo.on('request', (r) => { if (!r.url().startsWith('file://')) pedidasDemo.push(r.url()); });
  const erroresDemo = [];
  demo.on('pageerror', (e) => erroresDemo.push(e.message));
  await demo.goto(`file://${path.join(DIST, 'rutineitor-demo.html')}`, { waitUntil: 'load' });
  await demo.waitForSelector('.nav button');
  await demo.screenshot({ path: path.join(CAPTURAS, '13-demo.png') });
  if (pedidasDemo.length) problemas.push(`la demo pidió a la red: ${pedidasDemo.join(', ')}`);
  if (erroresDemo.length) problemas.push(`errores en la demo: ${erroresDemo.join(' | ')}`);
  await demo.close();

  const externas = peticiones.filter((u) => !u.startsWith(base) && !u.startsWith('data:'));
  if (externas.length) problemas.push(`peticiones externas en la app: ${externas.join(', ')}`);
  if (errores.length) problemas.push(`errores de consola: ${errores.join(' | ')}`);

  await navegador.close();
  srv.close();

  console.log('--- Revisión en navegador real ---');
  console.log(`Service worker: ${sw}`);
  console.log(`Manifest: ${manifest ? manifest.name : 'no'}`);
  console.log(`Abre sin internet: ${offlineOk ? 'sí' : 'NO'}`);
  console.log(`Peticiones externas: ${externas.length}`);
  console.log(`Errores de consola: ${errores.length}`);
  console.log(`Capturas en: ${CAPTURAS}`);
  if (problemas.length) {
    console.log('\nPROBLEMAS:');
    for (const p of problemas) console.log(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log('\nSin problemas.');
}

main().catch((e) => { console.error(e); process.exit(1); });
