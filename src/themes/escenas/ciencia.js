/**
 * Escenas de ciencia y biología: red neuronal, doble hélice, microcosmos
 * celular y partículas.
 */

import { festejar, cuantosDe, rgba, resplandor, mancha, chispa, cieloVertical, cuantos } from '../motor.js';
import { vinieta } from './digital.js';

/* ================================================================== */
/* RED NEURONAL — dendritas densas y pulsos que viajan por los axones  */
/* ================================================================== */

export const neuronas = {
  id: 'neuronas',
  nombre: 'Neuronas',
  emoji: '🧠',
  familia: 'ciencia',
  paleta: {
    fondo: '#06060f', fondo2: '#0f0c22', panel: 'rgba(16,14,36,.52)', panelAlto: 'rgba(16,14,36,.88)', panelSolido: '#100e26',
    texto: '#eae6ff', tenue: '#a096d0', acento: '#7c6bff', acento2: '#4be3ff',
    exito: '#4bffc3', aviso: '#ffc861', peligro: '#ff6b93', borde: 'rgba(124,107,255,.26)',
  },
  cielo: {
    amanecer: ['#1b1442', '#2e2166', '#0a0720'],
    dia: ['#201856', '#372878', '#0b0822'],
    atardecer: ['#2a1450', '#4a1f70', '#0d0620'],
    noche: ['#0a0820', '#1c1445', '#040310'],
  },

  crear({ w, h, rnd }) {
    // Somas repartidos con un poco de orden: ni rejilla ni amontonados.
    const filas = 7;
    const cols = 4;
    const somas = [];
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        somas.push({
          x: (c + 0.5 + (rnd() - 0.5) * 0.7) * (w / cols),
          y: (f + 0.5 + (rnd() - 0.5) * 0.7) * (h / filas),
          r: 3 + rnd() * 4.5,
          prof: 0.35 + rnd() * 0.65,
          fase: rnd() * 10,
          // Dendritas cortas alrededor del cuerpo: es lo que hace que
          // parezca una neurona y no un punto con cables.
          dendritas: Array.from({ length: 4 + Math.floor(rnd() * 4) }, () => ({
            ang: rnd() * Math.PI * 2,
            largo: 12 + rnd() * 30,
            curva: (rnd() - 0.5) * 1.1,
            ramas: rnd() > 0.45,
          })),
        });
      }
    }

    // Axones: cada soma se conecta con sus vecinos cercanos.
    const axones = [];
    somas.forEach((a, i) => {
      const cerca = somas
        .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3);
      for (const { j, d } of cerca) {
        if (j < i) continue;
        const b = somas[j];
        const mx = (a.x + b.x) / 2 + (rnd() - 0.5) * d * 0.45;
        const my = (a.y + b.y) / 2 + (rnd() - 0.5) * d * 0.45;
        axones.push({ a: i, b: j, mx, my, prof: Math.min(a.prof, b.prof) });
      }
    });

    // Impulsos que recorren los axones y encienden el soma al llegar.
    const pulsos = Array.from({ length: 22 }, () => ({
      axon: Math.floor(rnd() * axones.length),
      p: rnd(),
      v: 0.2 + rnd() * 0.5,
      color: rnd() > 0.55 ? '#4be3ff' : '#c08bff',
    }));

    const polvo = Array.from({ length: 90 }, () => ({
      x: rnd() * w, y: rnd() * h, r: 0.5 + rnd() * 1.4,
      fase: rnd() * 10, vy: -2 - rnd() * 6,
    }));

    return { somas, axones, pulsos, polvo, encendido: somas.map(() => 0) };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);

    // Campo de fondo: la "materia" en la que flota la red.
    if (nivel.resplandores) {
      mancha(ctx, w * 0.3, h * 0.28, w * 0.7, h * 0.4, '#5b3bd6', 0.16);
      mancha(ctx, w * 0.75, h * 0.72, w * 0.62, h * 0.36, '#2a6fd6', 0.13);
    }

    const punto = (n, k = 1) => ({
      x: n.x + px * 7 * n.prof * k,
      y: n.y + py * 6 * n.prof * k + Math.sin(t * 0.35 + n.fase) * 2.5 * n.prof,
    });

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Axones: primero el trazo grueso y tenue, luego el fino brillante.
    for (const ax of estado.axones) {
      const a = punto(estado.somas[ax.a]);
      const b = punto(estado.somas[ax.b]);
      const mx = ax.mx + px * 6 * ax.prof;
      const my = ax.my + py * 5 * ax.prof;
      ctx.strokeStyle = rgba('#7c6bff', 0.1 + ax.prof * 0.16);
      ctx.lineWidth = 0.6 + ax.prof * 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
    }

    // Dendritas alrededor de cada soma.
    for (const n of estado.somas) {
      const c = punto(n);
      ctx.strokeStyle = rgba('#8f7fff', 0.14 + n.prof * 0.2);
      ctx.lineWidth = 0.6 + n.prof;
      for (const d of n.dendritas) {
        const ang = d.ang + Math.sin(t * 0.2 + n.fase) * 0.06;
        const ex = c.x + Math.cos(ang) * d.largo * n.prof;
        const ey = c.y + Math.sin(ang) * d.largo * n.prof;
        const cx = c.x + Math.cos(ang + d.curva) * d.largo * 0.6 * n.prof;
        const cy = c.y + Math.sin(ang + d.curva) * d.largo * 0.6 * n.prof;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.stroke();
        if (d.ramas && nivel.factor > 0.3) {
          for (const s of [-0.5, 0.5]) {
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + Math.cos(ang + s) * d.largo * 0.35 * n.prof,
              ey + Math.sin(ang + s) * d.largo * 0.35 * n.prof);
            ctx.stroke();
          }
        }
      }
    }

    // Impulsos viajando.
    ctx.save();
    ctx.globalCompositeOperation = nivel.resplandores ? 'lighter' : 'source-over';
    const nP = cuantosDe(estado.pulsos, e);
    for (let i = 0; i < nP; i++) {
      const p = estado.pulsos[i];
      const ax = estado.axones[p.axon];
      if (!ax) continue;
      p.p += p.v * e.dt / 1000;
      if (p.p > 1) {
        p.p -= 1;
        // Al llegar enciende el soma de destino: la cadena de sinapsis.
        estado.encendido[ax.b] = 1;
        p.axon = Math.floor(rnd() * estado.axones.length);
      }
      const a = punto(estado.somas[ax.a]);
      const b = punto(estado.somas[ax.b]);
      const mx = ax.mx + px * 6 * ax.prof;
      const my = ax.my + py * 5 * ax.prof;
      const u = p.p;
      const q = (k) => (1 - k) * (1 - k);
      const x = q(u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x;
      const y = q(u) * a.y + 2 * (1 - u) * u * my + u * u * b.y;
      if (nivel.estelas) {
        const u2 = Math.max(0, u - 0.09);
        const x2 = q(u2) * a.x + 2 * (1 - u2) * u2 * mx + u2 * u2 * b.x;
        const y2 = q(u2) * a.y + 2 * (1 - u2) * u2 * my + u2 * u2 * b.y;
        const g = ctx.createLinearGradient(x2, y2, x, y);
        g.addColorStop(0, rgba(p.color, 0));
        g.addColorStop(1, rgba(p.color, 0.7));
        ctx.strokeStyle = g;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      chispa(ctx, x, y, 1.6, p.color, 0.95);
    }

    // Somas: brillan solos y más fuerte justo al recibir un impulso.
    estado.somas.forEach((n, i) => {
      const c = punto(n);
      estado.encendido[i] = Math.max(0, estado.encendido[i] - e.dt / 520);
      const base = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.9 + n.fase));
      const brillo = Math.min(1, base + estado.encendido[i] * 0.9);
      if (nivel.resplandores) resplandor(ctx, c.x, c.y, n.r * (5 + estado.encendido[i] * 6), '#7c6bff', 0.32 * brillo);
      ctx.fillStyle = rgba('#e9e2ff', 0.55 + brillo * 0.45);
      ctx.beginPath();
      ctx.arc(c.x, c.y, n.r * (0.75 + n.prof * 0.35), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Polvo en suspensión: da aire y escala.
    const nD = cuantosDe(estado.polvo, e);
    for (let i = 0; i < nD; i++) {
      const d = estado.polvo[i];
      d.y += d.vy * e.dt / 1000;
      if (d.y < -6) { d.y = h + 6; d.x = rnd() * w; }
      ctx.fillStyle = rgba('#c9c2ff', 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(t + d.fase)));
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    festejar(ctx, e);

    vinieta(ctx, w, h, 0.4);
  },
};

/* ================================================================== */
/* DOBLE HÉLICE — ADN girando                                          */
/* ================================================================== */

const BASES = [
  ['#ff5d8f', '#ffd166'], // A - T
  ['#4be3ff', '#7cff9b'], // C - G
];

export const adn = {
  id: 'adn',
  nombre: 'Hélice',
  emoji: '🧬',
  familia: 'ciencia',
  paleta: {
    fondo: '#050d16', fondo2: '#0a1c2c', panel: 'rgba(10,28,44,.52)', panelAlto: 'rgba(10,28,44,.88)', panelSolido: '#0a1f30',
    texto: '#e4f5ff', tenue: '#87b6cf', acento: '#39d7ff', acento2: '#ff6ea8',
    exito: '#5ef2b4', aviso: '#ffd166', peligro: '#ff6ea8', borde: 'rgba(60,200,255,.24)',
  },
  cielo: {
    amanecer: ['#0e2740', '#164058', '#051119'],
    dia: ['#103352', '#1b5070', '#06151f'],
    atardecer: ['#17283f', '#2d3f60', '#06121b'],
    noche: ['#050d16', '#0b2236', '#02080d'],
  },

  crear({ w, h, rnd }) {
    const pasos = Math.max(26, Math.round(h / 16));
    const moleculas = Array.from({ length: 46 }, () => ({
      x: rnd() * w,
      y: rnd() * h,
      r: 1 + rnd() * 3.4,
      v: 4 + rnd() * 16,
      fase: rnd() * 10,
      color: rnd() > 0.5 ? '#39d7ff' : '#ff6ea8',
      prof: rnd(),
    }));
    return { pasos, moleculas, giro: rnd() * 6 };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    mancha(ctx, w * 0.5 + px * 12, h * 0.45, w * 0.55, h * 0.55, '#1268a8', 0.2);
    ctx.restore();

    const cx = w * 0.5 + px * 22;
    const radio = Math.min(w * 0.27, 110);
    const giro = t * 0.55 + estado.giro;
    const pasoY = h / estado.pasos;

    const puntos = [];
    for (let i = 0; i <= estado.pasos; i++) {
      const y = i * pasoY + (py * 10);
      const ang = giro + i * 0.42;
      const x1 = cx + Math.sin(ang) * radio;
      const x2 = cx + Math.sin(ang + Math.PI) * radio;
      const z1 = Math.cos(ang);
      const z2 = Math.cos(ang + Math.PI);
      puntos.push({ y, x1, x2, z1, z2, i });
    }

    // Travesaños (pares de bases), dibujados de atrás hacia delante.
    const orden = puntos.slice().sort((a, b) => Math.min(a.z1, a.z2) - Math.min(b.z1, b.z2));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of orden) {
      if (p.i % 2) continue;
      const par = BASES[p.i % 4 < 2 ? 0 : 1];
      const prof = (Math.max(p.z1, p.z2) + 1) / 2;
      const a = 0.12 + prof * 0.4;
      const g = ctx.createLinearGradient(p.x1, p.y, p.x2, p.y);
      g.addColorStop(0, rgba(par[0], a));
      g.addColorStop(0.5, rgba('#ffffff', a * 0.35));
      g.addColorStop(1, rgba(par[1], a));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.2 + prof * 2.4;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y);
      ctx.lineTo(p.x2, p.y);
      ctx.stroke();
    }
    ctx.restore();

    // Las dos cadenas.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lado of [1, 2]) {
      ctx.beginPath();
      puntos.forEach((p, i) => {
        const x = lado === 1 ? p.x1 : p.x2;
        if (i === 0) ctx.moveTo(x, p.y);
        else ctx.lineTo(x, p.y);
      });
      ctx.strokeStyle = rgba(lado === 1 ? '#39d7ff' : '#ff6ea8', 0.5);
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Nucleótidos como esferas, con tamaño según profundidad.
    for (const p of orden) {
      for (const lado of [1, 2]) {
        const x = lado === 1 ? p.x1 : p.x2;
        const z = lado === 1 ? p.z1 : p.z2;
        const prof = (z + 1) / 2;
        const r = 1.6 + prof * 3.2;
        const color = lado === 1 ? '#39d7ff' : '#ff6ea8';
        if (nivel.resplandores && prof > 0.55) resplandor(ctx, x, p.y, r * 5, color, 0.22 * prof);
        ctx.fillStyle = rgba(color, 0.35 + prof * 0.6);
        ctx.beginPath();
        ctx.arc(x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Moléculas sueltas subiendo.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = cuantosDe(estado.moleculas, e);
    for (let i = 0; i < n; i++) {
      const m = estado.moleculas[i];
      m.y -= m.v * e.dt / 1000;
      if (m.y < -10) { m.y = h + 10; m.x = rnd() * w; }
      const x = m.x + Math.sin(t * 0.5 + m.fase) * 10 + px * 10 * m.prof;
      ctx.fillStyle = rgba(m.color, 0.18 + m.prof * 0.3);
      ctx.beginPath();
      ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.42);
  },
};

/* ================================================================== */
/* MICROCOSMOS — células al microscopio                                */
/* ================================================================== */

export const celula = {
  id: 'celula',
  nombre: 'Microcosmos',
  emoji: '🔬',
  familia: 'ciencia',
  paleta: {
    fondo: '#0a1210', fondo2: '#12241f', panel: 'rgba(16,36,31,.52)', panelAlto: 'rgba(16,36,31,.88)', panelSolido: '#12271f',
    texto: '#e8fff4', tenue: '#8fc2ae', acento: '#43e0a0', acento2: '#ffd06b',
    exito: '#43e0a0', aviso: '#ffd06b', peligro: '#ff7d8f', borde: 'rgba(70,220,160,.24)',
  },
  cielo: {
    amanecer: ['#142f28', '#1d4438', '#081513'],
    dia: ['#173a30', '#245544', '#0a1c17'],
    atardecer: ['#1b2f26', '#2e4534', '#091714'],
    noche: ['#0a1210', '#132821', '#050b09'],
  },

  crear({ w, h, rnd }) {
    const celulas = Array.from({ length: 13 }, () => {
      const r = 26 + rnd() * 74;
      const lobulos = 7 + Math.floor(rnd() * 5);
      return {
        x: rnd() * w,
        y: rnd() * h,
        r,
        prof: 0.25 + rnd() * 0.95,
        vx: (rnd() - 0.5) * 9,
        vy: (rnd() - 0.5) * 9,
        fase: rnd() * 10,
        lobulos,
        deform: Array.from({ length: lobulos }, () => 0.82 + rnd() * 0.3),
        nucleoX: (rnd() - 0.5) * 0.35,
        nucleoY: (rnd() - 0.5) * 0.35,
        organelos: Array.from({ length: 3 + Math.floor(rnd() * 5) }, () => ({
          a: rnd() * Math.PI * 2, d: 0.28 + rnd() * 0.5, r: 2 + rnd() * 4, v: (rnd() - 0.5) * 0.5,
        })),
        color: ['#43e0a0', '#5ad1e0', '#a5e06b'][Math.floor(rnd() * 3)],
      };
    });
    const bokeh = Array.from({ length: 34 }, () => ({
      x: rnd() * w, y: rnd() * h, r: 6 + rnd() * 34, a: 0.03 + rnd() * 0.07, fase: rnd() * 10,
    }));
    return { celulas, bokeh };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);

    // Bokeh: fuera de foco, da sensación de microscopio.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of estado.bokeh) {
      const x = b.x + Math.sin(t * 0.12 + b.fase) * 14 + px * 6;
      const y = b.y + Math.cos(t * 0.09 + b.fase) * 12 + py * 5;
      mancha(ctx, x, y, b.r, b.r, '#7fffc8', b.a);
    }
    ctx.restore();

    const ordenadas = estado.celulas.slice().sort((a, b) => a.prof - b.prof);
    for (const c of ordenadas) {
      c.x += c.vx * e.dt / 1000;
      c.y += c.vy * e.dt / 1000;
      const m = c.r + 30;
      if (c.x < -m) c.x = w + m;
      if (c.x > w + m) c.x = -m;
      if (c.y < -m) c.y = h + m;
      if (c.y > h + m) c.y = -m;

      const x = c.x + px * 20 * c.prof;
      const y = c.y + py * 14 * c.prof;
      const r = c.r * (0.55 + c.prof * 0.6);
      const alfa = 0.1 + c.prof * 0.26;

      // Membrana ondulante.
      ctx.beginPath();
      for (let i = 0; i <= c.lobulos; i++) {
        const a = (i / c.lobulos) * Math.PI * 2;
        const onda = c.deform[i % c.lobulos] + Math.sin(t * 0.8 + c.fase + i) * 0.05;
        const rr = r * onda;
        const pxp = x + Math.cos(a) * rr;
        const pyp = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(pxp, pyp);
        else {
          const aPrev = ((i - 1) / c.lobulos) * Math.PI * 2;
          const rPrev = r * (c.deform[(i - 1) % c.lobulos] + Math.sin(t * 0.8 + c.fase + i - 1) * 0.05);
          const mx = (x + Math.cos(aPrev) * rPrev + pxp) / 2;
          const my = (y + Math.sin(aPrev) * rPrev + pyp) / 2;
          ctx.quadraticCurveTo(mx, my, pxp, pyp);
        }
      }
      ctx.closePath();

      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, rgba(c.color, alfa * 1.5));
      g.addColorStop(0.75, rgba(c.color, alfa * 0.4));
      g.addColorStop(1, rgba(c.color, alfa * 0.1));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(c.color, alfa * 1.9);
      ctx.lineWidth = 1 + c.prof;
      ctx.stroke();

      if (c.prof > 0.5) {
        // Núcleo.
        const nx = x + c.nucleoX * r;
        const ny = y + c.nucleoY * r;
        ctx.fillStyle = rgba('#0c2a20', 0.5);
        ctx.beginPath();
        ctx.arc(nx, ny, r * 0.26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(c.color, 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Organelos orbitando.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const o of c.organelos) {
          const a = o.a + t * o.v;
          const ox = x + Math.cos(a) * r * o.d;
          const oy = y + Math.sin(a) * r * o.d * 0.8;
          ctx.fillStyle = rgba('#d8ffe8', 0.28 * c.prof);
          ctx.beginPath();
          ctx.ellipse(ox, oy, o.r, o.r * 0.6, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        if (nivel.resplandores) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          resplandor(ctx, x, y, r * 1.5, c.color, 0.08 * c.prof);
          ctx.restore();
        }
      }
    }
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.5);
  },
};

/* ================================================================== */
/* PARTÍCULAS — un átomo grande con capas de electrones y estelas      */
/* ================================================================== */

export const atomos = {
  id: 'atomos',
  nombre: 'Partículas',
  emoji: '⚛️',
  familia: 'ciencia',
  paleta: {
    fondo: '#080a14', fondo2: '#101630', panel: 'rgba(16,22,48,.52)', panelAlto: 'rgba(16,22,48,.88)', panelSolido: '#101733',
    texto: '#e6ecff', tenue: '#94a0cc', acento: '#5aa8ff', acento2: '#ffcf5a',
    exito: '#4fe3b0', aviso: '#ffcf5a', peligro: '#ff6f8a', borde: 'rgba(90,168,255,.24)',
  },
  cielo: {
    amanecer: ['#1a2450', '#2b3a72', '#090d1f'],
    dia: ['#1d2a5c', '#31447f', '#0a0f22'],
    atardecer: ['#241d54', '#432b74', '#0a0a1e'],
    noche: ['#0a0d1e', '#161f45', '#040610'],
  },

  crear({ w, h, rnd }) {
    const cx = w * 0.5;
    const cy = h * 0.42;
    const R = Math.min(w, h) * 0.3;

    // Tres capas de electrones, cada una con su inclinación.
    const capas = [0.55, 0.82, 1.12].map((k, i) => ({
      rx: R * k,
      ry: R * k * (0.3 + rnd() * 0.22),
      rot: (i * Math.PI) / 3 + rnd() * 0.5,
      v: (i % 2 ? -1 : 1) * (0.5 + rnd() * 0.45),
      color: ['#5aa8ff', '#ffcf5a', '#4fe3b0'][i],
      electrones: Array.from({ length: 2 + i }, () => ({ f: rnd() * Math.PI * 2 })),
    }));

    // Protones y neutrones apretados en el núcleo.
    const nucleones = Array.from({ length: 14 }, () => {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * R * 0.17;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: R * 0.05, carga: rnd() > 0.5, fase: rnd() * 10 };
    });

    // Átomos pequeños de fondo, fuera de foco.
    const lejanos = Array.from({ length: 7 }, () => ({
      x: rnd() * w, y: rnd() * h, r: R * (0.1 + rnd() * 0.16),
      rot: rnd() * Math.PI, v: (rnd() - 0.5) * 0.7, fase: rnd() * 10,
      color: rnd() > 0.5 ? '#5aa8ff' : '#b58bff',
    }));

    // Trazas de cámara de burbujas: partículas que cruzan y se curvan.
    const trazas = Array.from({ length: 10 }, () => ({
      x: rnd() * w, y: rnd() * h, ang: rnd() * Math.PI * 2,
      v: 26 + rnd() * 70, giro: (rnd() - 0.5) * 0.5, vida: rnd(),
      color: rnd() > 0.6 ? '#ff8ab0' : '#8fd0ff',
    }));

    return { cx, cy, R, capas, nucleones, lejanos, trazas };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, nivel, estado } = e;
    const { R } = estado;
    cieloVertical(ctx, w, h, e.cielo);
    if (nivel.resplandores) {
      mancha(ctx, w * 0.5, h * 0.4, w * 0.8, h * 0.45, '#2f4fae', 0.18);
      mancha(ctx, w * 0.18, h * 0.82, w * 0.5, h * 0.3, '#7a3fb0', 0.12);
    }

    // Átomos pequeños de fondo.
    for (const a of estado.lejanos) {
      const x = a.x + px * 4;
      const y = a.y + py * 3;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a.rot + t * a.v * 0.3);
      ctx.strokeStyle = rgba(a.color, 0.16);
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, a.r, a.r * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      chispa(ctx, x, y, 1, a.color, 0.3 + 0.25 * Math.sin(t + a.fase));
    }

    // Trazas de partículas.
    ctx.save();
    ctx.globalCompositeOperation = nivel.resplandores ? 'lighter' : 'source-over';
    ctx.lineCap = 'round';
    const nT = cuantosDe(estado.trazas, e);
    for (let i = 0; i < nT; i++) {
      const tr = estado.trazas[i];
      tr.ang += tr.giro * e.dt / 1000;
      tr.x += Math.cos(tr.ang) * tr.v * e.dt / 1000;
      tr.y += Math.sin(tr.ang) * tr.v * e.dt / 1000;
      tr.vida += e.dt / 4200;
      if (tr.vida > 1 || tr.x < -40 || tr.x > w + 40 || tr.y < -40 || tr.y > h + 40) {
        tr.vida = 0;
        tr.x = rnd() * w;
        tr.y = rnd() * h;
        tr.ang = rnd() * Math.PI * 2;
      }
      const alfa = Math.sin(tr.vida * Math.PI) * 0.55;
      const largo = 26 + tr.v * 0.22;
      const g = ctx.createLinearGradient(tr.x - Math.cos(tr.ang) * largo, tr.y - Math.sin(tr.ang) * largo, tr.x, tr.y);
      g.addColorStop(0, rgba(tr.color, 0));
      g.addColorStop(1, rgba(tr.color, alfa));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tr.x - Math.cos(tr.ang) * largo, tr.y - Math.sin(tr.ang) * largo);
      ctx.lineTo(tr.x, tr.y);
      ctx.stroke();
      chispa(ctx, tr.x, tr.y, 1, tr.color, alfa * 1.6);
    }
    ctx.restore();

    // El átomo grande.
    const cx = estado.cx + px * 12;
    const cy = estado.cy + py * 10;
    ctx.save();
    ctx.translate(cx, cy);

    // Capas: la órbita se dibuja y el electrón deja estela sobre ella.
    for (const capa of estado.capas) {
      const giro = capa.rot + t * capa.v * 0.22;
      ctx.save();
      ctx.rotate(giro);
      ctx.strokeStyle = rgba(capa.color, 0.3);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, capa.rx, capa.ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.globalCompositeOperation = nivel.resplandores ? 'lighter' : 'source-over';
      for (const el of capa.electrones) {
        const a = el.f + t * capa.v * 1.5;
        if (nivel.estelas) {
          ctx.strokeStyle = rgba(capa.color, 0.5);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, 0, capa.rx, capa.ry, 0, a - 0.55, a);
          ctx.stroke();
        }
        chispa(ctx, Math.cos(a) * capa.rx, Math.sin(a) * capa.ry, 2.1, capa.color, 1);
      }
      ctx.restore();
      ctx.restore();
    }

    // Núcleo.
    if (nivel.resplandores) resplandor(ctx, 0, 0, R * 0.62, '#ffd98a', 0.4);
    for (const n of estado.nucleones) {
      const vib = 1 + Math.sin(t * 3 + n.fase) * 0.07;
      const g = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.3, 0, n.x, n.y, n.r * 1.3);
      g.addColorStop(0, n.carga ? '#ffe9b0' : '#cfe0ff');
      g.addColorStop(1, n.carga ? 'rgba(255,140,60,.85)' : 'rgba(90,140,220,.85)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x * vib, n.y * vib, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    festejar(ctx, e);

    vinieta(ctx, w, h, 0.42);
  },
};

