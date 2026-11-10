#!/usr/bin/env node
/**
 * Compilación de Rutineitor v3.
 *
 * Genera los archivos finales a partir de los módulos de src/. NUNCA por
 * recorte de texto ni búsqueda-y-reemplazo sobre un archivo maestro: se usa
 * un empaquetador real (esbuild) y una plantilla con marcadores explícitos.
 * Las diferencias entre los dos builds están declaradas en BUILDS y son
 * verificables una a una.
 */

import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(RAIZ, 'dist');
const VERSION = JSON.parse(await readFile(path.join(RAIZ, 'package.json'), 'utf8')).version;

/* --------- Definición explícita de los dos builds ---------------------- */

const CABECERA_PWA = `<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">`;

const BUILDS = [
  {
    id: 'app',
    archivo: 'index.html',
    titulo: 'Rutineitor',
    demo: false,
    cabecera: CABECERA_PWA,
    // El módulo real de sincronización.
    sustituciones: {},
  },
  {
    id: 'demo',
    archivo: 'rutineitor-demo.html',
    titulo: 'Rutineitor · demo sin conexión',
    demo: true,
    // Sin manifest ni iconos externos: un único archivo que se abre con doble clic.
    cabecera: '',
    // El módulo de red se sustituye por un sustituto sin ninguna llamada de red.
    sustituciones: { './sync.js': path.join(RAIZ, 'src/ui/sync-stub.js') },
  },
];

/**
 * Sustitución de módulos declarada: cambia un import por otro archivo real.
 * Es el mecanismo de "flags de compilación" del proyecto, y deja constancia
 * en consola de cada sustitución aplicada.
 */
function pluginSustituciones(sustituciones) {
  return {
    name: 'sustituciones',
    setup(construccion) {
      for (const [desde, hacia] of Object.entries(sustituciones)) {
        const filtro = new RegExp(`^${desde.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
        construccion.onResolve({ filter: filtro }, () => {
          console.log(`    · sustituido ${desde} → ${path.basename(hacia)}`);
          return { path: hacia };
        });
      }
    },
  };
}

/* ----------------------------- Compilar -------------------------------- */

async function empaquetar(conf) {
  const resultado = await build({
    entryPoints: [path.join(RAIZ, 'src/ui/app.js')],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    minify: true,
    legalComments: 'none',
    write: false,
    charset: 'utf8',
    plugins: [pluginSustituciones(conf.sustituciones || {})],
    define: {
      __DEMO__: String(conf.demo),
      __VERSION__: JSON.stringify(VERSION),
    },
  });
  return resultado.outputFiles[0].text;
}

function rellenar(plantilla, valores) {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (_, clave) => {
    if (!(clave in valores)) throw new Error(`Marcador sin valor en la plantilla: ${clave}`);
    return valores[clave];
  });
}

/* ------------------------------ Service worker -------------------------- */

function serviceWorker(version) {
  return `/* Rutineitor v3 — service worker. Cachea la app para que funcione sin internet. */
const CACHE = 'rutineitor-v${version}';
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET') return;
  // Lo de Supabase nunca se cachea: siempre a la red.
  if (url.origin !== self.location.origin) return;
  ev.respondWith(
    caches.match(ev.request).then((enCache) => {
      const red = fetch(ev.request)
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(ev.request, copia));
          }
          return res;
        })
        .catch(() => enCache);
      return enCache || red;
    }),
  );
});
`;
}

function manifest() {
  return JSON.stringify({
    name: 'Rutineitor',
    short_name: 'Rutineitor',
    description: 'Tareas, rutinas y economía de créditos para casa.',
    start_url: './index.html',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0e2018',
    theme_color: '#0e2018',
    lang: 'es',
    dir: 'ltr',
    categories: ['productivity', 'lifestyle'],
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2);
}

/* -------------------------------- Main ---------------------------------- */

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const plantilla = await readFile(path.join(RAIZ, 'src/index.template.html'), 'utf8');
  const css = await readFile(path.join(RAIZ, 'src/styles.css'), 'utf8');

  console.log(`Rutineitor v${VERSION}`);
  for (const conf of BUILDS) {
    const js = await empaquetar(conf);
    const html = rellenar(plantilla, {
      TITULO: conf.titulo,
      HEAD_EXTRA: conf.cabecera,
      CSS: css,
      JS: js,
    });
    await writeFile(path.join(DIST, conf.archivo), html, 'utf8');
    console.log(`  ${conf.archivo} (${(html.length / 1024).toFixed(0)} KB)`);
  }

  await writeFile(path.join(DIST, 'manifest.webmanifest'), manifest(), 'utf8');
  await writeFile(path.join(DIST, 'sw.js'), serviceWorker(VERSION), 'utf8');
  console.log('  manifest.webmanifest');
  console.log('  sw.js');

  execFileSync('python3', [path.join(RAIZ, 'tools/iconos.py'), DIST], { stdio: 'inherit' });
  console.log('Listo.');
}

main().catch((e) => { console.error(e); process.exit(1); });
