/**
 * CELEBRAR — el momento de marcar una tarea.
 *
 * Hasta ahora, marcar una tarea sacaba un texto que ponía "+8 créditos" y ya.
 * En un juego, ese instante es *el* instante: es donde se decide si apetece
 * volver a hacerlo. Este módulo es todo lo que pasa en ese segundo.
 *
 * Cuatro cosas, en orden de cuánto se notan:
 *   1. El número **sale volando** desde el botón hacia el saldo.
 *   2. El saldo **cuenta hacia arriba** hasta el nuevo valor.
 *   3. Una **vibración corta** (15 ms): el teléfono confirma con el cuerpo.
 *   4. Un **clic** generado con osciladores — nada de archivos de sonido, que
 *      no cabrían en una app que tiene que funcionar sin internet.
 *
 * Y para lo gordo (el día completo, subir de nivel, desbloquear un fondo), la
 * escena del fondo reacciona: el motor recibe un pulso y las escenas lo usan
 * para encenderse un momento.
 *
 * Todo esto se apaga entero desde Ajustes. El sonido, además, **viene apagado
 * por defecto**: un móvil que empieza a hacer ruidos sin avisar se silencia
 * para siempre a los dos minutos.
 */

const REDUCIR = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Las preferencias se leen en vivo, no se copian. Si se guardara una copia y el
 * ajuste cambiara por otro camino —desde el panel del padre, o sincronizado
 * desde el otro móvil— los efectos seguirían saliendo con el interruptor
 * apagado. Leyendo del estado cada vez, eso no puede pasar.
 */
let leerAjustes = () => ({ efectos: true, sonido: false });
let motorRef = null;

export function configurarEfectos({ ajustes = null, motor = null } = {}) {
  if (typeof ajustes === 'function') leerAjustes = ajustes;
  if (motor !== null) motorRef = motor;
}

function prefs() {
  try {
    const a = leerAjustes() || {};
    return { efectos: a.efectos !== false, sonido: Boolean(a.sonido) };
  } catch {
    return { efectos: true, sonido: false };
  }
}

export function efectosActivos() {
  return prefs().efectos && !REDUCIR();
}

/* ====================================================================== */
/* SONIDO                                                                  */
/* ====================================================================== */

let audio = null;

function contexto() {
  if (!prefs().sonido || !efectosActivos()) return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audio) audio = new AC();
    // Los navegadores arrancan el audio suspendido hasta que hay un gesto del
    // usuario. Como esto siempre se dispara desde un toque, se puede reanudar.
    if (audio.state === 'suspended') audio.resume();
    return audio;
  } catch {
    return null;
  }
}

/**
 * Un tono corto. `tipo` cambia el carácter: 'ok' es un clic seco, 'sube' es
 * una tercera ascendente (subir de nivel), 'gordo' un acorde (desbloqueo).
 */
export function sonar(tipo = 'ok') {
  const ctx = contexto();
  if (!ctx) return;
  const notas = {
    ok: [[880, 0, 0.07]],
    doble: [[740, 0, 0.06], [1110, 0.06, 0.08]],
    sube: [[523, 0, 0.09], [659, 0.08, 0.09], [784, 0.16, 0.16]],
    gordo: [[523, 0, 0.2], [659, 0, 0.2], [784, 0, 0.26], [1046, 0.1, 0.3]],
  }[tipo] || [[880, 0, 0.07]];

  const ahora = ctx.currentTime;
  for (const [hz, retraso, dur] of notas) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    // Ataque rapidísimo y caída suave: así suena a "clic" y no a pitido.
    vol.gain.setValueAtTime(0.0001, ahora + retraso);
    vol.gain.exponentialRampToValueAtTime(0.16, ahora + retraso + 0.008);
    vol.gain.exponentialRampToValueAtTime(0.0001, ahora + retraso + dur);
    osc.connect(vol).connect(ctx.destination);
    osc.start(ahora + retraso);
    osc.stop(ahora + retraso + dur + 0.02);
  }
}

/* ====================================================================== */
/* VIBRACIÓN                                                               */
/* ====================================================================== */

export function vibrar(patron = 15) {
  if (!efectosActivos()) return;
  try {
    if (navigator.vibrate) navigator.vibrate(patron);
  } catch { /* algunos navegadores lo tienen pero lanzan; da igual */ }
}

/* ====================================================================== */
/* EL NÚMERO QUE VUELA                                                     */
/* ====================================================================== */

/**
 * Lanza un `+8` desde un elemento hasta otro. Si falta cualquiera de los dos
 * no pasa nada: es un adorno, nunca puede romper el marcado de una tarea.
 */
export function volar(desde, hasta, texto, { color = 'var(--exito)' } = {}) {
  if (!efectosActivos() || !desde || !hasta) return;
  try {
    const a = desde.getBoundingClientRect();
    const b = hasta.getBoundingClientRect();
    const burbuja = document.createElement('div');
    burbuja.className = 'rt-vuela';
    burbuja.textContent = texto;
    burbuja.style.color = color;
    burbuja.style.left = `${a.left + a.width / 2}px`;
    burbuja.style.top = `${a.top + a.height / 2}px`;
    burbuja.style.setProperty('--dx', `${(b.left + b.width / 2) - (a.left + a.width / 2)}px`);
    burbuja.style.setProperty('--dy', `${(b.top + b.height / 2) - (a.top + a.height / 2)}px`);
    document.body.appendChild(burbuja);
    setTimeout(() => burbuja.remove(), 900);
  } catch { /* si el navegador no da medidas, se queda sin adorno */ }
}

/* ====================================================================== */
/* EL SALDO QUE CUENTA                                                     */
/* ====================================================================== */

const contando = new WeakMap();

/**
 * Anima un número de `desde` a `hasta`. Guarda el temporizador por elemento
 * para que dos marcados seguidos no peleen por el mismo hueco.
 */
export function contar(el, desde, hasta, { ms = 520, sufijo = '' } = {}) {
  if (!el) return;
  if (!efectosActivos() || desde === hasta) {
    el.textContent = `${hasta}${sufijo}`;
    return;
  }
  const anterior = contando.get(el);
  if (anterior) cancelAnimationFrame(anterior);

  const t0 = performance.now();
  const paso = (ahora) => {
    const k = Math.min(1, (ahora - t0) / ms);
    // Suavizado de salida: arranca rápido y frena. Se lee mejor el final.
    const suave = 1 - (1 - k) ** 3;
    el.textContent = `${Math.round(desde + (hasta - desde) * suave)}${sufijo}`;
    if (k < 1) contando.set(el, requestAnimationFrame(paso));
    else contando.delete(el);
  };
  contando.set(el, requestAnimationFrame(paso));
}

/* ====================================================================== */
/* REBOTES Y DESTELLOS                                                     */
/* ====================================================================== */

/** Un rebote corto en un elemento. Se limpia solo. */
export function rebotar(el, clase = 'rt-rebote') {
  if (!efectosActivos() || !el) return;
  el.classList.remove(clase);
  // Forzar reflow para poder repetir la animación en el mismo elemento.
  void el.offsetWidth;
  el.classList.add(clase);
  setTimeout(() => el.classList.remove(clase), 700);
}

/**
 * Confeti pobre: unos cuantos trozos de color que caen. No usa librería ni
 * canvas: son divs con una animación CSS, y se borran solos.
 */
export function confeti({ cantidad = 26, origen = null } = {}) {
  if (!efectosActivos()) return;
  const colores = ['#ffd54f', '#4fd6a0', '#7cc6ff', '#ff8ab0', '#c9a7ff'];
  const caja = document.createElement('div');
  caja.className = 'rt-confeti';
  const r = origen ? origen.getBoundingClientRect() : null;
  const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const cy = r ? r.top + r.height / 2 : window.innerHeight * 0.35;

  for (let i = 0; i < cantidad; i++) {
    const trozo = document.createElement('i');
    const ang = (Math.PI * 2 * i) / cantidad + Math.random() * 0.4;
    const dist = 90 + Math.random() * 160;
    trozo.style.background = colores[i % colores.length];
    trozo.style.left = `${cx}px`;
    trozo.style.top = `${cy}px`;
    trozo.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    trozo.style.setProperty('--dy', `${Math.sin(ang) * dist + 120}px`);
    trozo.style.setProperty('--giro', `${Math.random() * 720 - 360}deg`);
    trozo.style.animationDelay = `${Math.random() * 0.12}s`;
    caja.appendChild(trozo);
  }
  document.body.appendChild(caja);
  setTimeout(() => caja.remove(), 1600);
}

/* ====================================================================== */
/* CELEBRACIONES COMPLETAS                                                 */
/* ====================================================================== */

/** Marcar una tarea: lo más frecuente, así que lo más contenido. */
export function celebrarMarca({ boton, destino, texto, saldo = null }) {
  volar(boton, destino, texto);
  rebotar(destino);
  vibrar(15);
  sonar('ok');
  if (saldo) rebotar(saldo, 'rt-late');
}

/** Día completo, nivel nuevo, fondo desbloqueado: aquí sí se tira la casa. */
export function celebrarGrande({ origen = null, tipo = 'gordo', pulso = 1 } = {}) {
  confeti({ origen, cantidad: 34 });
  vibrar([18, 60, 26]);
  sonar(tipo);
  if (motorRef && typeof motorRef.celebrar === 'function') motorRef.celebrar(pulso);
}

/** Subir de nivel: un punto intermedio, con su propio sonido ascendente. */
export function celebrarNivel({ origen = null } = {}) {
  confeti({ origen, cantidad: 22 });
  vibrar([14, 50, 20]);
  sonar('sube');
  if (motorRef && typeof motorRef.celebrar === 'function') motorRef.celebrar(0.75);
}
