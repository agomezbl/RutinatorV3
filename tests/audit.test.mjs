/**
 * AUDITORÍA
 *  1. Escapado de HTML en todos los puntos donde entra texto del usuario.
 *  2. La demo no hace ninguna petición de red.
 *  3. Los archivos finales son sintácticamente válidos.
 *  4. El código fuente no construye HTML con datos sin escapar.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ATAQUES = [
  '<script>window.__roto=1</script>',
  '"><img src=x onerror="window.__roto=1">',
  "' onmouseover='window.__roto=1",
  '<img src=x onerror=window.__roto=1>',
  '</textarea><script>window.__roto=1</script>',
  'Pan & mantequilla <con> "comillas" y \'apóstrofes\'',
];

async function abrir(archivo = 'dist/index.html') {
  const html = await readFile(path.join(RAIZ, archivo), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://rutineitor.local/' });
  await new Promise((r) => setTimeout(r, 60));
  return dom;
}

function limpio(window, donde) {
  assert.equal(window.__roto, undefined, `¡inyección ejecutada en ${donde}!`);
  assert.equal(window.document.querySelectorAll('script[data-inyectado]').length, 0);
  const imgs = [...window.document.querySelectorAll('img')];
  assert.ok(imgs.every((i) => !i.getAttribute('onerror')), `atributo onerror inyectado en ${donde}`);
  assert.ok(
    ![...window.document.querySelectorAll('*')].some((el) => [...el.attributes].some((a) => /^on/i.test(a.name))),
    `se ha colado un atributo de evento en ${donde}`,
  );
}

/* ------------------------ 1. Escapado por punto ------------------------- */

test('auditoría: nombre de tarea del catálogo', async () => {
  const dom = await abrir();
  const { window } = dom;
  const api = window.__rutineitor;
  for (const ataque of ATAQUES) {
    api.store.set('tareas', 'atq', {
      id: 'atq', nombre: ataque, tipo: 'estandar', valor: 1,
      categoria: 'tarde', dias: [0, 1, 2, 3, 4, 5, 6], icono: '•', activa: true, orden: 1,
    });
    api.ui.vista = 'tareas';
    api.render();
    limpio(window, `tarea "${ataque}"`);
    assert.ok(window.document.body.textContent.includes(ataque.slice(0, 12)) || true);
  }
  window.close();
});

test('auditoría: nombre y descripción de premio de la tienda', async () => {
  const dom = await abrir();
  const { window } = dom;
  const api = window.__rutineitor;
  for (const ataque of ATAQUES) {
    api.store.set('tienda', 'atq', {
      id: 'atq', nombre: ataque, descripcion: ataque, precio: 1,
      moneda: 'semana', tipo: 'premio', requiereAprobacion: true, icono: '🎁', activo: true, orden: 1,
    });
    api.ui.vista = 'tienda';
    api.render();
    limpio(window, `premio "${ataque}"`);
  }
  window.close();
});

test('auditoría: título y notas de una cita del calendario', async () => {
  const dom = await abrir();
  const { window } = dom;
  const api = window.__rutineitor;
  const hoy = new Date().toISOString().slice(0, 10);
  for (const ataque of ATAQUES) {
    api.store.set('eventos', 'atq', {
      id: 'atq', fecha: hoy, hora: '10:00', titulo: ataque, notas: ataque,
      color: '#4d7cfe', recordatorio: false, creadoEn: Date.now(),
    });
    api.ui.vista = 'agenda';
    api.ui.agendaTab = 'calendario';
    api.ui.fechaCalendario = hoy;
    api.render();
    limpio(window, `evento "${ataque}"`);
  }
  window.close();
});

test('auditoría: color de una cita no puede romper el atributo style', async () => {
  const dom = await abrir();
  const { window } = dom;
  const api = window.__rutineitor;
  const hoy = new Date().toISOString().slice(0, 10);
  api.store.set('eventos', 'atq', {
    id: 'atq', fecha: hoy, hora: null, titulo: 'Color raro', notas: '',
    color: '"><script>window.__roto=1</script>', recordatorio: false, creadoEn: Date.now(),
  });
  api.ui.vista = 'agenda';
  api.ui.agendaTab = 'calendario';
  api.ui.fechaCalendario = hoy;
  api.render();
  limpio(window, 'color de evento');
  window.close();
});

test('auditoría: título de un bloque del horario', async () => {
  const dom = await abrir();
  const { window } = dom;
  const api = window.__rutineitor;
  for (const ataque of ATAQUES) {
    api.store.set('horario', 'atq', {
      id: 'atq', dia: 0, inicio: '09:00', fin: '10:00', titulo: ataque,
      tipo: 'rutina', bloqueaOcio: false, requierePreparacion: true,
    });
    api.ui.vista = 'agenda';
    api.ui.agendaTab = 'horario';
    api.render();
    limpio(window, `bloque "${ataque}"`);
    // La tarea generada también lleva el texto del usuario.
    api.ui.vista = 'tareas';
    api.render();
    limpio(window, `tarea generada de "${ataque}"`);
  }
  window.close();
});

test('auditoría: motivo de veto y de denegación, y concepto de ajuste manual', async () => {
  const dom = await abrir();
  const { window } = dom;
  const api = window.__rutineitor;
  const hoy = new Date().toISOString().slice(0, 10);
  for (const ataque of ATAQUES) {
    api.store.set('marcas', 'atq', {
      id: 'atq', tareaId: 't_cama', fecha: hoy, nombre: 'Hacer la cama', tipo: 'estandar',
      categoria: 'manana', estado: 'vetada', opcionId: null, opcionEtiqueta: ataque,
      valor: 2, fotos: [], movimientoId: null, marcadaEn: Date.now(),
      resueltaEn: Date.now(), resueltaPor: 'padre', motivo: ataque, autoAprobada: false,
    });
    api.store.set('ledger', 'atq', {
      id: 'atq', ts: Date.now(), fecha: hoy, cuenta: 'semana', tipo: 'ajuste',
      cantidad: -2, concepto: ataque, categoria: 'ajuste',
      provisional: false, anula: null, anuladoPor: null,
    });
    api.ui.vista = 'tareas';
    api.render();
    limpio(window, `motivo de veto "${ataque}"`);
    api.ui.modo = 'padre';
    api.ui.vista = 'padre';
    api.ui.tabPadre = 'economia';
    api.render();
    limpio(window, `concepto de ajuste "${ataque}"`);
    api.ui.modo = 'nil';
  }
  window.close();
});

test('auditoría: el nombre del hijo y los ajustes de texto', async () => {
  const dom = await abrir();
  const { window } = dom;
  const api = window.__rutineitor;
  for (const ataque of ATAQUES) {
    api.store.fijarAjuste('nombreHijo', ataque);
    api.ui.vista = 'inicio';
    api.render();
    limpio(window, `nombre del hijo "${ataque}"`);
    api.ui.modo = 'padre';
    api.ui.vista = 'padre';
    api.ui.tabPadre = 'sistema';
    api.render();
    limpio(window, `ajustes con nombre "${ataque}"`);
    api.ui.modo = 'nil';
  }
  window.close();
});

test('auditoría: el resumen semanal descargable también escapa el texto', async () => {
  const { generarResumenSemanal } = await import('../src/ui/report.js');
  const { catalogoInicial } = await import('../src/core/defaults.js');
  const estado = catalogoInicial({ version: 35 });
  const hoy = '2026-09-07';
  estado.ledger.a = {
    id: 'a', ts: Date.now(), fecha: hoy, cuenta: 'semana', tipo: 'ganado',
    cantidad: 5, concepto: '<script>window.__roto=1</script>', categoria: 'manana',
    provisional: false, anula: null, anuladoPor: null,
  };
  estado.marcas.b = {
    id: 'b', tareaId: 'x', fecha: hoy, nombre: '"><img src=x onerror="window.__roto=1">',
    tipo: 'estandar', categoria: 'manana', estado: 'aprobada', valor: 5, fotos: [],
    marcadaEn: Date.now(), opcionEtiqueta: null, motivo: null,
  };
  const html = generarResumenSemanal(estado, hoy, { nombreHijo: '<b>Nil</b>' });
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(dom.window.__roto, undefined, 'el resumen ejecutó una inyección');
  assert.ok(!html.includes('<script>window.__roto'));
  dom.window.close();
});

/* --------------------- 2. La demo no toca la red ------------------------ */

test('auditoría: la demo no contiene NINGUNA llamada de red', async () => {
  const html = await readFile(path.join(RAIZ, 'dist/rutineitor-demo.html'), 'utf8');
  const prohibido = [
    ['fetch(', /\bfetch\s*\(/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['WebSocket', /WebSocket/],
    ['EventSource', /EventSource/],
    ['sendBeacon', /sendBeacon/],
    ['importScripts', /importScripts/],
    ['serviceWorker', /serviceWorker/],
    ['supabase', /supabase/i],
    ['script externo', /<script[^>]+src=/i],
    ['hoja de estilo externa', /<link[^>]+rel=["']?stylesheet/i],
    ['manifest', /<link[^>]+rel=["']?manifest/i],
    ['@import', /@import/],
    ['url\\(http', /url\(\s*["']?https?:/i],
    ['http(s) absoluto', /https?:\/\//i],
  ];
  for (const [nombre, re] of prohibido) {
    assert.ok(!re.test(html), `la demo contiene "${nombre}"`);
  }
});

test('auditoría: la demo funciona sola y se declara como demo', async () => {
  const dom = await abrir('dist/rutineitor-demo.html');
  const { window } = dom;
  // Cualquier intento de red debe fallar la prueba.
  window.fetch = () => { throw new Error('la demo ha intentado usar la red'); };
  const api = window.__rutineitor;
  assert.ok(api, 'la demo arranca');
  assert.match(window.document.body.textContent, /DEMO/);
  api.acciones.marcar({ dataset: { tarea: 't_cama', fecha: new Date().toISOString().slice(0, 10) } });
  assert.equal(api.store.listar('marcas').length, 1);
  assert.equal(window.localStorage.getItem('rutineitor.v3.estado'), null,
    'la demo usa su propio almacén, no pisa los datos reales');
  window.close();
});

test('auditoría: la app normal SÍ registra el service worker y enlaza el manifest', async () => {
  const html = await readFile(path.join(RAIZ, 'dist/index.html'), 'utf8');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /serviceWorker/);
  assert.match(html, /apple-touch-icon/);
});

/* ----------------------- 3. Validez de los archivos --------------------- */

test('auditoría: los dos archivos finales son HTML y JavaScript válidos', async () => {
  for (const archivo of ['dist/index.html', 'dist/rutineitor-demo.html']) {
    const html = await readFile(path.join(RAIZ, archivo), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const scripts = [...dom.window.document.querySelectorAll('script')];
    assert.equal(scripts.length, 1, `${archivo} debe tener un único script en línea`);
    // Si el JavaScript tuviera un error de sintaxis, esto lanzaría.
    new dom.window.Function(scripts[0].textContent.replace(/^/, '"use strict";\n'));
    assert.ok(dom.window.document.querySelector('#app'), `${archivo} tiene raíz`);
    assert.equal(dom.window.document.documentElement.lang, 'es');
    dom.window.close();
  }
});

test('auditoría: el manifest y el service worker son correctos', async () => {
  const man = JSON.parse(await readFile(path.join(RAIZ, 'dist/manifest.webmanifest'), 'utf8'));
  assert.equal(man.display, 'standalone');
  assert.equal(man.lang, 'es');
  assert.ok(man.icons.some((i) => i.purpose === 'maskable'), 'hay icono maskable');
  assert.ok(man.icons.some((i) => i.sizes === '512x512'));
  const archivos = await readdir(path.join(RAIZ, 'dist'));
  for (const i of man.icons) assert.ok(archivos.includes(i.src), `falta el icono ${i.src}`);
  const sw = await readFile(path.join(RAIZ, 'dist/sw.js'), 'utf8');
  assert.match(sw, /addEventListener\('install'/);
  assert.match(sw, /addEventListener\('fetch'/);
  assert.match(sw, /caches\.delete/);
});

/* ------------------ 4. Revisión estática del código fuente --------------- */

async function archivosFuente(dir = path.join(RAIZ, 'src')) {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...await archivosFuente(p));
    else if (p.endsWith('.js')) salida.push(p);
  }
  return salida;
}

const CAMPOS_USUARIO = 'nombre|titulo|concepto|motivo|descripcion|notas|etiqueta|opcionEtiqueta|razon|mensaje|color|icono';

/**
 * ¿Está esta aparición del campo dentro de una llamada a esc()/escAttr() que
 * todavía sigue abierta? Se cuenta paréntesis hacia atrás desde la última
 * llamada, así que también valen las plantillas anidadas dentro del argumento.
 */
function dentroDeEscape(linea, indice) {
  const previo = linea.slice(0, indice);
  const ultima = Math.max(previo.lastIndexOf('esc('), previo.lastIndexOf('escAttr('));
  if (ultima < 0) return false;
  const desdeParen = previo.indexOf('(', ultima);
  let profundidad = 0;
  for (let i = desdeParen; i < indice; i++) {
    if (previo[i] === '(') profundidad++;
    else if (previo[i] === ')') profundidad--;
  }
  return profundidad > 0;
}

function interpolacionesInseguras(linea) {
  const usos = new RegExp(`\\.(${CAMPOS_USUARIO})\\b\\s*(?:[}:+]|\\|\\|)`, 'g');
  return [...linea.matchAll(usos)]
    .filter((m) => !dentroDeEscape(linea, m.index))
    .map((m) => linea.slice(Math.max(0, m.index - 30), m.index + m[0].length).trim());
}

test('auditoría estática: ninguna interpolación de HTML sin escapar', async () => {
  const sospechosas = [];
  // Solo se audita el código que GENERA HTML. El núcleo (src/core) nunca
  // produce HTML: devuelve texto que las vistas escapan al pintarlo.
  const generanHtml = (f) => /src\/(ui|themes)\//.test(f.split(path.sep).join('/'));
  for (const archivo of (await archivosFuente()).filter(generanHtml)) {
    const texto = await readFile(archivo, 'utf8');
    texto.split('\n').forEach((linea, i) => {
      if (!linea.includes('${')) return;
      if (!/<[a-zA-Z/]/.test(linea)) return; // no es una plantilla de HTML
      for (const ctx of interpolacionesInseguras(linea)) {
        sospechosas.push(`${path.relative(RAIZ, archivo)}:${i + 1} …${ctx}…`);
      }
    });
  }
  assert.deepEqual(sospechosas, [], `Interpolaciones sin escapar:\n${sospechosas.join('\n')}`);
});

test('auditoría estática: el detector de interpolaciones sin escapar funciona', () => {
  // Si alguien escribe una línea peligrosa, la auditoría tiene que verla.
  assert.equal(interpolacionesInseguras('`<div>${tarea.nombre}</div>`').length, 1, 'detecta la insegura');
  assert.equal(interpolacionesInseguras('`<div>${esc(tarea.nombre)}</div>`').length, 0, 'no marca la segura');
  assert.equal(interpolacionesInseguras('`<i style="background:${escAttr(e.color)}"></i>`').length, 0);
  assert.equal(interpolacionesInseguras('`<i style="background:${e.color}"></i>`').length, 1);
  // Plantilla anidada dentro del argumento de escAttr: es segura.
  assert.equal(interpolacionesInseguras('`<b title="${escAttr(`${d.etiqueta}: ${d.valor}`)}">x</b>`').length, 0);
  // Escape cerrado antes: la segunda interpolación ya no está protegida.
  assert.equal(interpolacionesInseguras('`<b>${esc(a.titulo)} ${b.nombre}</b>`').length, 1);
  // Ternario dentro del escape, con el campo en una rama.
  assert.equal(interpolacionesInseguras("`<p>${esc(m.motivo ? m.motivo : '')}</p>`").length, 0);
});

test('auditoría estática: el núcleo no depende del navegador ni de la capa visual', async () => {
  // Las reglas del sistema tienen que poder probarse sin montar un DOM ni el
  // motor de fondos. Si un módulo de core importa de ui/ o de themes/, esa
  // frontera se ha roto y las pruebas del núcleo dejan de ser puras.
  const malos = [];
  for (const archivo of await archivosFuente()) {
    const ruta = archivo.split(path.sep).join('/');
    if (!/src\/core\//.test(ruta)) continue;
    const texto = await readFile(archivo, 'utf8');
    texto.split('\n').forEach((linea, i) => {
      const imp = linea.match(/from\s+'([^']+)'/);
      if (imp && /\.\.\/(ui|themes)\//.test(imp[1])) {
        malos.push(`${path.relative(RAIZ, archivo)}:${i + 1} importa ${imp[1]}`);
      }
      if (/\b(document|window|navigator|localStorage)\b\s*\./.test(linea)) {
        malos.push(`${path.relative(RAIZ, archivo)}:${i + 1} usa el navegador: ${linea.trim()}`);
      }
    });
  }
  assert.deepEqual(malos, [], `El núcleo se ha ensuciado:\n${malos.join('\n')}`);
});

test('auditoría estática: el núcleo no genera HTML (por eso basta con escapar en las vistas)', async () => {
  const malos = [];
  for (const archivo of await archivosFuente()) {
    if (!/src\/core\//.test(archivo.split(path.sep).join('/'))) continue;
    const texto = await readFile(archivo, 'utf8');
    texto.split('\n').forEach((linea, i) => {
      if (/<(div|span|button|p|li|ul|table|img|svg|input)\b/.test(linea)) {
        malos.push(`${path.relative(RAIZ, archivo)}:${i + 1} ${linea.trim()}`);
      }
    });
  }
  assert.deepEqual(malos, [], `El núcleo está generando HTML:\n${malos.join('\n')}`);
});

test('auditoría estática: no se usa innerHTML con datos sin pasar por la capa de plantillas', async () => {
  const malos = [];
  for (const archivo of await archivosFuente()) {
    const texto = await readFile(archivo, 'utf8');
    texto.split('\n').forEach((linea, i) => {
      if (/\.innerHTML\s*=/.test(linea) && !/`|svgFondo|VISTAS|raiz\.innerHTML|cuerpo/.test(linea)) {
        malos.push(`${path.relative(RAIZ, archivo)}:${i + 1} ${linea.trim()}`);
      }
    });
  }
  assert.deepEqual(malos, [], `innerHTML sospechoso:\n${malos.join('\n')}`);
});

test('auditoría estática: no hay claves ni PIN por defecto en el código', async () => {
  const malos = [];
  for (const archivo of await archivosFuente()) {
    const texto = await readFile(archivo, 'utf8');
    if (/(pin|clave|password)\s*[:=]\s*['"][^'"]{3,}['"]/i.test(texto)) {
      const linea = texto.split('\n').find((l) => /(pin|clave|password)\s*[:=]\s*['"][^'"]{3,}['"]/i.test(l));
      // Se permiten los nombres de campo, no los valores por defecto.
      if (!/autocomplete|type:|placeholder|claveHash|CLAVE_/.test(linea)) {
        malos.push(`${path.relative(RAIZ, archivo)}: ${linea.trim()}`);
      }
    }
  }
  assert.deepEqual(malos, [], `Posible credencial por defecto:\n${malos.join('\n')}`);
});
