/**
 * MOTOR DE FONDOS — canvas 2D con presupuesto de rendimiento.
 *
 * Los fondos ya no son SVG plano: cada tema es una escena que se dibuja
 * fotograma a fotograma en un canvas. Eso permite partículas de verdad, luz,
 * desenfoque, profundidad y estelas, que es lo que separa un dibujo vectorial
 * de algo que parece vivo.
 *
 * Las tres reglas que hacen que esto no se coma la batería del móvil de Nil:
 *
 *  1. **Se para cuando no se ve.** Al ocultar la app, el bucle se detiene del
 *     todo (no es que dibuje menos: es que no dibuja).
 *  2. **Se mide y se baja solo.** Se vigila la velocidad real. Si el móvil no
 *     llega, la escena baja de nivel de detalle sola, hasta apagarse si hace
 *     falta. Y si va sobrada, vuelve a subir.
 *  3. **Se respeta al sistema.** Con "reducir movimiento" activado se dibuja un
 *     único fotograma quieto y no se vuelve a tocar.
 *
 * Nada de librerías, nada de red: solo canvas y matemáticas.
 */

/* ------------------------------------------------------------------ */
/* Ruido determinista y color                                          */
/* ------------------------------------------------------------------ */

/** PRNG determinista: la misma escena se genera igual siempre. */
export function prng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function semillaDe(texto) {
  let h = 2166136261;
  for (let i = 0; i < String(texto).length; i++) {
    h ^= String(texto).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ruido de valor suavizado en 1D: sirve para movimientos orgánicos. */
export function ruido1D(x, semilla = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  const a = ((Math.sin((i + semilla) * 127.1) * 43758.5453) % 1 + 1) % 1;
  const b = ((Math.sin((i + 1 + semilla) * 127.1) * 43758.5453) % 1 + 1) % 1;
  return a + (b - a) * s;
}

/**
 * Pasa un color a [r,g,b]. Acepta hexadecimal (#abc o #aabbcc) y también
 * rgb()/rgba(), que es justo lo que devuelve `mezclar`: así se pueden encadenar
 * mezclas sin que salga un color roto.
 */
export function hexARgb(color) {
  const s = String(color).trim();
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0] | 0, p[1] | 0, p[2] | 0];
  }
  const h = s.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
  // Nunca devolver NaN: un color roto no pinta y deja el lienzo a medias.
  return n.map((x) => (Number.isFinite(x) ? x : 0));
}

export function rgba(hex, alpha = 1) {
  const [r, g, b] = hexARgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Mezcla dos colores hex. t=0 devuelve a, t=1 devuelve b. */
export function mezclar(a, b, t) {
  const [r1, g1, b1] = hexARgb(a);
  const [r2, g2, b2] = hexARgb(b);
  const k = Math.max(0, Math.min(1, t));
  const c = (x, y) => Math.round(x + (y - x) * k);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
}

/* ------------------------------------------------------------------ */
/* Pinceles reutilizables                                              */
/* ------------------------------------------------------------------ */

/** Degradado vertical de fondo. */
export function cieloVertical(ctx, w, h, colores) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  colores.forEach((c, i) => g.addColorStop(i / Math.max(1, colores.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Halo suave: un punto de luz que se desvanece. */
export function resplandor(ctx, x, y, r, color, alpha = 0.5) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.28));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Mancha difusa (nebulosas, niebla, humo). */
export function mancha(ctx, x, y, rx, ry, color, alpha, rotacion = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotacion);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.6, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Punto brillante con núcleo y halo: estrellas, luciérnagas, sinapsis. */
export function chispa(ctx, x, y, r, color, alpha = 1) {
  resplandor(ctx, x, y, r * 4.5, color, alpha * 0.5);
  ctx.fillStyle = rgba('#ffffff', Math.min(1, alpha));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Silueta de montaña / horizonte con ruido, desde la base del lienzo. */
export function silueta(ctx, w, h, { base, altura, rugosidad, color, semilla, paso = 8 }) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + paso; x += paso) {
    const n = ruido1D(x / rugosidad, semilla) * 0.65
      + ruido1D(x / (rugosidad * 0.35), semilla + 9) * 0.35;
    ctx.lineTo(x, base - n * altura);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

/** Estrella con puntas de difracción: el brillo que "pincha". */
export function destello(ctx, x, y, r, color, alpha = 1, giro = 0) {
  resplandor(ctx, x, y, r * 6, color, alpha * 0.45);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  const g = ctx.createLinearGradient(-r * 7, 0, r * 7, 0);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba('#ffffff', alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-r * 7, -r * 0.16, r * 14, r * 0.32);
  ctx.fillRect(-r * 0.16, -r * 4.5, r * 0.32, r * 9);
  ctx.restore();
  ctx.fillStyle = rgba('#ffffff', Math.min(1, alpha));
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

/** Haz de luz volumétrico: un cono que se desvanece. */
export function haz(ctx, x, y, largo, ancho, angulo, color, alpha = 0.16) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angulo);
  const g = ctx.createLinearGradient(0, 0, 0, largo);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.55, rgba(color, alpha * 0.4));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-ancho * 0.12, 0);
  ctx.lineTo(ancho * 0.12, 0);
  ctx.lineTo(ancho, largo);
  ctx.lineTo(-ancho, largo);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Bruma horizontal: separa planos y da sensación de aire y distancia. */
export function bruma(ctx, w, y, alto, color, alpha = 0.22) {
  const g = ctx.createLinearGradient(0, y - alto, 0, y + alto);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y - alto, w, alto * 2);
}

/**
 * Traza un camino con halo: se dibuja dos veces, ancho y tenue por debajo y
 * fino y brillante por encima. Es lo que hace que una línea "emita" luz.
 */
export function trazoBrillante(ctx, camino, color, { ancho = 1.4, alpha = 1, halo = 5, nivel } = {}) {
  if (!nivel || nivel.resplandores) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(color, alpha * 0.16);
    ctx.lineWidth = ancho + halo;
    ctx.beginPath();
    camino(ctx);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = ancho;
  ctx.beginPath();
  camino(ctx);
  ctx.stroke();
}

/**
 * Destello de celebración: lo pinta cada escena al final si `e.festejo > 0`.
 * Es el mismo gesto en las diecisiete —un golpe de luz desde abajo y unas
 * chispas que suben— con el color que cada escena elija, para que se reconozca
 * como "algo bueno ha pasado" sin importar el fondo que tenga puesto.
 */
export function festejar(ctx, e, color = null) {
  const tono = color || e.acento || '#ffd76a';
  const f = e.festejo || 0;
  if (f <= 0) return;
  const { w, h } = e;
  const subida = 1 - f;             // 0 al empezar, 1 al terminar
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Golpe de luz que barre de abajo arriba.
  const g = ctx.createLinearGradient(0, h, 0, h * (1 - subida * 1.25));
  g.addColorStop(0, rgba(tono, 0.3 * f));
  g.addColorStop(1, rgba(tono, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Chispas subiendo, deterministas (misma celebración, mismo dibujo).
  const rnd = prng(semillaDe('festejo'));
  const n = Math.round(26 * (e.nivel ? Math.max(0.4, e.nivel.factor) : 1));
  for (let i = 0; i < n; i++) {
    const x = rnd() * w;
    const salida = h * (0.72 + rnd() * 0.25);
    const alto = h * (0.2 + rnd() * 0.5);
    const y = salida - alto * subida * (0.6 + rnd() * 0.7);
    const r = 1 + rnd() * 2.2;
    chispa(ctx, x, y, r, i % 3 === 0 ? '#ffffff' : tono, f * (0.4 + rnd() * 0.6));
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Niveles de calidad                                                  */
/* ------------------------------------------------------------------ */

export const NIVELES = {
  alta: { id: 'alta', factor: 1, resplandores: true, estelas: true, dpr: 2 },
  media: { id: 'media', factor: 0.6, resplandores: true, estelas: true, dpr: 1.5 },
  baja: { id: 'baja', factor: 0.32, resplandores: false, estelas: false, dpr: 1 },
  apagado: { id: 'apagado', factor: 0, resplandores: false, estelas: false, dpr: 1 },
};

export const ORDEN_NIVELES = ['alta', 'media', 'baja', 'apagado'];

/**
 * Escalera que usa la calidad automática. No baja hasta 'apagado' a propósito:
 * un fondo congelado parece que la app se ha colgado. Si ni en 'baja' va fino,
 * se queda en 'baja' y ya está; apagarlo es decisión de Nil, no del motor.
 */
export const ORDEN_AUTO = ['alta', 'media', 'baja'];

/** Cuántos elementos dibujar: depende del nivel y del tamaño de pantalla. */
export function cuantos(base, e) {
  const areaRef = 390 * 844;
  const escala = Math.sqrt((e.w * e.h) / areaRef);
  return Math.max(0, Math.round(base * e.nivel.factor * Math.min(1.7, Math.max(0.6, escala))));
}

/**
 * Lo mismo, pero sobre una lista ya construida: nunca devuelve más elementos
 * de los que hay. En pantallas anchas (una tablet en horizontal) el factor de
 * escala pasa de 1 y sin este tope se leerían posiciones que no existen.
 */
export function cuantosDe(lista, e) {
  return Math.min(lista.length, cuantos(lista.length, e));
}

/* ------------------------------------------------------------------ */
/* El motor                                                            */
/* ------------------------------------------------------------------ */

/**
 * Crea el motor sobre un contenedor. `opciones.escenaDe(id)` devuelve la escena
 * y `opciones.cieloDe(id, momento)` los colores del cielo.
 */
export function crearMotor(contenedor, {
  escenaDe,
  alCambiarNivel = () => {},
  calidadInicial = 'auto',
} = {}) {
  if (!contenedor) return null;

  const lienzo = document.createElement('canvas');
  lienzo.className = 'rt-lienzo';
  lienzo.setAttribute('aria-hidden', 'true');
  contenedor.replaceChildren(lienzo);

  const ctx = lienzo.getContext && lienzo.getContext('2d');
  if (!ctx) return null; // sin canvas, queda el degradado CSS del tema

  const reducir = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let temaId = null;
  let momento = 'dia';
  let escena = null;
  let estadoEscena = null;
  let rndAnim = prng(1);
  let fotogramas = 0;
  // Pulso de celebración: sube a 1 y cae solo. Las escenas lo leen para
  // encenderse un momento cuando pasa algo bueno en la app.
  let festejo = 0;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let rafId = null;
  let ultimo = 0;
  let tiempo = 0;
  let px = 0;
  let py = 0;
  let pxObjetivo = 0;
  let pyObjetivo = 0;
  let calidad = calidadInicial;
  let nivelId = calidad === 'auto' ? 'alta' : calidad;
  let muestras = [];
  let ultimoCambioNivel = 0;
  let vivo = false;

  function nivel() { return NIVELES[nivelId] || NIVELES.media; }

  function medir() {
    const rect = contenedor.getBoundingClientRect();
    const anchoCss = Math.max(1, Math.round(rect.width || window.innerWidth || 390));
    const altoCss = Math.max(1, Math.round(rect.height || window.innerHeight || 844));
    dpr = Math.min(nivel().dpr, window.devicePixelRatio || 1);
    w = anchoCss;
    h = altoCss;
    lienzo.width = Math.round(w * dpr);
    lienzo.height = Math.round(h * dpr);
    lienzo.style.width = `${w}px`;
    lienzo.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function entorno(dt) {
    return {
      rnd: rndAnim,
      festejo,
      acento: escena ? (escena.paleta.acento2 || escena.paleta.acento) : '#ffd76a',
      t: tiempo,
      dt,
      w,
      h,
      px,
      py,
      nivel: nivel(),
      momento,
      cielo: escena ? escena.cielo[momento] : ['#111', '#000'],
      estado: estadoEscena,
      quieto: reducir,
    };
  }

  function construir() {
    if (!escena) return;
    const rnd = prng(semillaDe(`${escena.id}|${w}x${h}`));
    estadoEscena = escena.crear ? escena.crear({ w, h, rnd, nivel: nivel(), momento }) : {};
    // El azar de la animación también es determinista: una escena reconstruida
    // igual se comporta igual. Dentro de un fotograma nunca se usa Math.random.
    rndAnim = prng(semillaDe(`${escena.id}|anim`));
  }

  function pintarFotograma(dt) {
    if (!escena) return;
    fotogramas++;
    // La celebración dura poco más de un segundo y se apaga sola.
    if (festejo > 0) festejo = Math.max(0, festejo - dt / 1300);
    ctx.clearRect(0, 0, w, h);
    escena.dibujar(ctx, entorno(dt));
  }

  function vigilarRendimiento(dt) {
    if (calidad !== 'auto' || reducir) return;
    muestras.push(dt);
    if (muestras.length < 45) return;
    const media = muestras.reduce((s, x) => s + x, 0) / muestras.length;
    muestras = [];
    const ahora = performance.now();
    if (ahora - ultimoCambioNivel < 2500) return;

    const i = ORDEN_AUTO.indexOf(nivelId);
    if (i < 0) return;
    if (media > 27 && i < ORDEN_AUTO.length - 1) {
      // Menos de ~37 fotogramas por segundo: bajamos un escalón.
      nivelId = ORDEN_AUTO[i + 1];
      ultimoCambioNivel = ahora;
      medir();
      construir();
      alCambiarNivel(nivelId, 'bajado');
    } else if (media < 15 && i > 0) {
      nivelId = ORDEN_AUTO[i - 1];
      ultimoCambioNivel = ahora;
      medir();
      construir();
      alCambiarNivel(nivelId, 'subido');
    }
  }

  function bucle(ahora) {
    if (!vivo) return;
    const dt = Math.min(64, ahora - (ultimo || ahora));
    ultimo = ahora;
    tiempo += dt / 1000;
    // Suavizado del parallax: nunca salta, siempre persigue.
    px += (pxObjetivo - px) * 0.06;
    py += (pyObjetivo - py) * 0.06;
    pintarFotograma(dt);
    vigilarRendimiento(dt);
    rafId = requestAnimationFrame(bucle);
  }

  function arrancar() {
    if (vivo || !escena) return;
    if (reducir || nivelId === 'apagado') {
      pintarFotograma(16);
      return;
    }
    vivo = true;
    ultimo = 0;
    rafId = requestAnimationFrame(bucle);
  }

  function parar() {
    vivo = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ----------------------------- Entradas ----------------------------- */

  const alInclinar = (ev) => {
    if (ev.gamma === null && ev.beta === null) return;
    pxObjetivo = Math.max(-1, Math.min(1, (ev.gamma || 0) / 35));
    pyObjetivo = Math.max(-1, Math.min(1, ((ev.beta || 0) - 45) / 45));
  };
  const alMover = (ev) => {
    if (ev.pointerType === 'touch') return;
    pxObjetivo = (ev.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    pyObjetivo = (ev.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
  };
  const alRedimensionar = () => { medir(); construir(); if (!vivo) pintarFotograma(16); };
  const alVisibilidad = () => { if (document.hidden) parar(); else arrancar(); };

  window.addEventListener('deviceorientation', alInclinar, { passive: true });
  window.addEventListener('pointermove', alMover, { passive: true });
  window.addEventListener('resize', alRedimensionar);
  document.addEventListener('visibilitychange', alVisibilidad);

  const api = {
    get nivel() { return nivelId; },
    get calidad() { return calidad; },
    // Ventanas al motor para poder comprobarlo desde fuera (revisión en navegador).
    get vivo() { return vivo; },
    get fotogramas() { return fotogramas; },
    get parallax() { return { px, py }; },
    get festejo() { return festejo; },

    /**
     * Una celebración: la escena se enciende un momento. Si el fondo estaba
     * parado (calidad apagada o pantalla oculta) se pinta un fotograma suelto
     * para que al menos se vea el destello.
     */
    celebrar(fuerza = 1) {
      festejo = Math.max(festejo, Math.min(1, Number(fuerza) || 1));
      if (!vivo) pintarFotograma(16);
    },
    get lienzo() { return lienzo; },
    get escena() { return escena && escena.id; },

    fijarTema(id, nuevoMomento = momento) {
      const nueva = escenaDe(id);
      const cambia = !escena || escena.id !== (nueva && nueva.id) || nuevoMomento !== momento;
      escena = nueva;
      temaId = id;
      momento = nuevoMomento;
      if (!escena) return;
      if (cambia) { medir(); construir(); }
      if (!vivo) { arrancar(); if (!vivo) pintarFotograma(16); }
    },

    fijarCalidad(nueva) {
      calidad = nueva || 'auto';
      nivelId = calidad === 'auto' ? 'alta' : calidad;
      muestras = [];
      ultimoCambioNivel = performance.now();
      parar();
      medir();
      construir();
      if (nivelId === 'apagado') { ctx.clearRect(0, 0, w, h); return; }
      arrancar();
      if (!vivo) pintarFotograma(16);
    },

    arrancar,
    parar,

    destruir() {
      parar();
      window.removeEventListener('deviceorientation', alInclinar);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('resize', alRedimensionar);
      document.removeEventListener('visibilitychange', alVisibilidad);
      lienzo.remove();
    },
  };

  medir();
  return api;
}

/**
 * Dibuja UN fotograma quieto de una escena en un canvas pequeño.
 * Es lo que usa el selector de temas: nada de catorce bucles a la vez.
 */
export function pintarMiniatura(lienzo, escena, momento = 'dia', { t = 6 } = {}) {
  const ctx = lienzo.getContext && lienzo.getContext('2d');
  if (!ctx || !escena) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = lienzo.clientWidth || 160;
  const h = lienzo.clientHeight || 120;
  lienzo.width = Math.round(w * dpr);
  lienzo.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rnd = prng(semillaDe(`${escena.id}|mini`));
  const estado = escena.crear ? escena.crear({ w, h, rnd, nivel: NIVELES.media, momento }) : {};
  escena.dibujar(ctx, {
    t, dt: 16, w, h, px: 0, py: 0, nivel: NIVELES.media,
    momento, cielo: escena.cielo[momento], estado, quieto: true,
    rnd: prng(semillaDe(`${escena.id}|mini-anim`)),
  });
  return true;
}
