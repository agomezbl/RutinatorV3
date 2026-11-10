/**
 * Escenas de naturaleza y del tema sobrio: bosque con rayos de luz, fondo
 * marino, aurora boreal, volcán, sakura y el plano técnico.
 */

import { festejar, cuantosDe,
  rgba, resplandor, mancha, chispa, cieloVertical, cuantos, silueta, ruido1D,
} from '../motor.js';
import { vinieta } from './digital.js';

/* ================================================================== */
/* BOSQUE — capas, niebla, rayos de luz y luciérnagas                  */
/* ================================================================== */

export const bosque = {
  id: 'bosque',
  nombre: 'Bosque',
  emoji: '🌲',
  familia: 'naturaleza',
  paleta: {
    fondo: '#0a1a12', fondo2: '#12301f', panel: 'rgba(16,42,28,.52)', panelAlto: 'rgba(16,42,28,.88)', panelSolido: '#122c1e',
    texto: '#e8f5ec', tenue: '#9dc0ac', acento: '#5fd68a', acento2: '#c8e06a',
    exito: '#5fd68a', aviso: '#f2c14e', peligro: '#ef6b6b', borde: 'rgba(150,220,180,.22)',
  },
  cielo: {
    amanecer: ['#5b6b4e', '#8aa06a', '#1d2e1d'],
    dia: ['#4e7d84', '#82ac7a', '#15301d'],
    atardecer: ['#7a5a45', '#a5714a', '#1b2a1a'],
    noche: ['#0c1a26', '#13261b', '#050d0a'],
  },

  crear({ w, h, rnd }) {
    const capas = [0, 1, 2, 3].map((i) => {
      const arboles = [];
      const sep = 26 + i * 16;
      for (let x = -40; x < w + 60; x += sep * (0.65 + rnd() * 0.75)) {
        arboles.push({
          x,
          alto: h * (0.28 + i * 0.13) * (0.7 + rnd() * 0.7),
          ancho: (6 + i * 5) * (0.7 + rnd() * 0.7),
          inclina: (rnd() - 0.5) * 0.06,
          ramas: 3 + Math.floor(rnd() * 3),
          fase: rnd() * 10,
        });
      }
      return { arboles, prof: 0.2 + i * 0.28 };
    });
    const luciernagas = Array.from({ length: 46 }, () => ({
      x: rnd() * w, y: h * (0.35 + rnd() * 0.55),
      fase: rnd() * 10, v: 4 + rnd() * 10, r: 0.9 + rnd() * 1.2, prof: rnd(),
    }));
    const hojas = Array.from({ length: 30 }, () => ({
      x: rnd() * w, y: rnd() * h, giro: rnd() * 6,
      v: 12 + rnd() * 26, vx: -6 - rnd() * 14, tam: 3 + rnd() * 4,
      color: ['#4f7a3a', '#7a8c34', '#a06a2c'][Math.floor(rnd() * 3)],
    }));
    const rayos = Array.from({ length: 5 }, () => ({
      x: rnd() * w, ancho: 30 + rnd() * 90, fase: rnd() * 10, incl: 0.15 + rnd() * 0.22,
    }));
    return { capas, luciernagas, hojas, rayos, suelo: h * 0.88 };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, momento, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);
    const noche = momento === 'noche';

    // Sol o luna filtrándose entre los árboles.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const alto = { amanecer: 0.34, dia: 0.16, atardecer: 0.38, noche: 0.2 }[momento];
    const ladoX = { amanecer: 0.22, dia: 0.72, atardecer: 0.8, noche: 0.68 }[momento];
    const colorAstro = noche ? '#cfe4ff' : momento === 'atardecer' ? '#ff9a54' : '#ffe6a8';
    resplandor(ctx, w * ladoX + px * 8, h * alto + py * 6, Math.min(w, h) * 0.55, colorAstro, noche ? 0.16 : 0.3);
    ctx.restore();

    // Capas de árboles, de lejos a cerca, con niebla entre ellas.
    estado.capas.forEach((capa, i) => {
      const tono = noche
        ? ['#0f2018', '#0c1a14', '#091510', '#061009'][i]
        : ['#2c4a34', '#22402b', '#183221', '#0f2417'][i];
      const dx = px * (6 + i * 15);
      const dy = py * (2 + i * 5);
      ctx.save();
      ctx.translate(dx, dy);
      for (const a of capa.arboles) {
        const balanceo = Math.sin(t * 0.5 + a.fase) * (1 + i) * 0.8;
        const baseY = estado.suelo + i * 12;
        const cima = baseY - a.alto;
        ctx.fillStyle = tono;
        // Tronco.
        ctx.beginPath();
        ctx.moveTo(a.x - a.ancho * 0.12, baseY + 30);
        ctx.lineTo(a.x + balanceo * 0.4, cima);
        ctx.lineTo(a.x + a.ancho * 0.12 + balanceo * 0.4, cima);
        ctx.lineTo(a.x + a.ancho * 0.12, baseY + 30);
        ctx.closePath();
        ctx.fill();
        // Copa en pisos: forma de conífera.
        for (let r = 0; r < a.ramas; r++) {
          const f = r / a.ramas;
          const y = cima + a.alto * (0.12 + f * 0.62);
          const ancho = a.ancho * (1.1 + f * 2.2);
          const altoPiso = a.alto * 0.3;
          ctx.beginPath();
          ctx.moveTo(a.x + balanceo * (1 - f), y - altoPiso * 0.5);
          ctx.lineTo(a.x - ancho, y + altoPiso * 0.5);
          ctx.lineTo(a.x + ancho, y + altoPiso * 0.5);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

      // Niebla entre capa y capa: es lo que da la sensación de profundidad.
      if (i < 3) {
        const g = ctx.createLinearGradient(0, estado.suelo - h * 0.4, 0, estado.suelo + 40);
        const nieblaColor = noche ? 'rgba(120,150,170,' : 'rgba(210,230,220,';
        g.addColorStop(0, `${nieblaColor}0)`);
        g.addColorStop(1, `${nieblaColor}${(0.1 + i * 0.03).toFixed(2)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, estado.suelo - h * 0.4, w, h * 0.4 + 40);
      }
    });

    // Suelo.
    ctx.fillStyle = noche ? '#050d09' : '#0d1c12';
    ctx.fillRect(0, estado.suelo + 26, w, h - estado.suelo);

    // Rayos de luz entre los árboles.
    if (!noche && nivel.resplandores) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const r of estado.rayos) {
        const vaiven = Math.sin(t * 0.25 + r.fase) * 12;
        const x = r.x + vaiven + px * 10;
        const g = ctx.createLinearGradient(x, 0, x + r.incl * h, h);
        g.addColorStop(0, rgba(colorAstro, 0.14));
        g.addColorStop(1, rgba(colorAstro, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - r.ancho / 2, -10);
        ctx.lineTo(x + r.ancho / 2, -10);
        ctx.lineTo(x + r.incl * h + r.ancho * 1.4, h);
        ctx.lineTo(x + r.incl * h - r.ancho * 0.6, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Hojas cayendo.
    const nHojas = cuantosDe(estado.hojas, e);
    for (let i = 0; i < nHojas; i++) {
      const hj = estado.hojas[i];
      hj.y += hj.v * e.dt / 1000;
      hj.x += (hj.vx + Math.sin(t + hj.giro) * 18) * e.dt / 1000;
      hj.giro += e.dt / 620;
      if (hj.y > h + 10) { hj.y = -10; hj.x = rnd() * (w + 80); }
      if (hj.x < -20) hj.x = w + 20;
      ctx.save();
      ctx.translate(hj.x + px * 12, hj.y);
      ctx.rotate(hj.giro);
      ctx.fillStyle = rgba(hj.color, noche ? 0.35 : 0.72);
      ctx.beginPath();
      ctx.ellipse(0, 0, hj.tam, hj.tam * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Luciérnagas: solo de noche y al atardecer.
    if (noche || momento === 'atardecer') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const n = cuantosDe(estado.luciernagas, e);
      for (let i = 0; i < n; i++) {
        const l = estado.luciernagas[i];
        const x = l.x + Math.sin(t * 0.3 + l.fase) * 26 + px * 14 * l.prof;
        const y = l.y + Math.cos(t * 0.24 + l.fase * 1.7) * 18 + py * 10 * l.prof;
        const brillo = Math.max(0, Math.sin(t * l.v * 0.22 + l.fase));
        if (brillo < 0.05) continue;
        chispa(ctx, x, y, l.r, '#d8ff7a', brillo * (0.4 + l.prof * 0.6));
      }
      ctx.restore();
    }
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.42);
  },
};

/* ================================================================== */
/* FONDO MARINO                                                        */
/* ================================================================== */

export const oceano = {
  id: 'oceano',
  nombre: 'Océano',
  emoji: '🌊',
  familia: 'naturaleza',
  paleta: {
    fondo: '#04182a', fondo2: '#07263f', panel: 'rgba(9,44,68,.52)', panelAlto: 'rgba(9,44,68,.88)', panelSolido: '#07263f',
    texto: '#e4f6ff', tenue: '#8fc0d8', acento: '#31c8e0', acento2: '#6ff0c4',
    exito: '#6ff0c4', aviso: '#ffd166', peligro: '#ff7b8a', borde: 'rgba(90,200,230,.22)',
  },
  cielo: {
    amanecer: ['#1d6a86', '#0d3f5e', '#021520'],
    dia: ['#2a93b8', '#0f5680', '#03202f'],
    atardecer: ['#2f5f78', '#123f5c', '#02151f'],
    noche: ['#062a42', '#04182a', '#010a11'],
  },

  crear({ w, h, rnd }) {
    const bancos = Array.from({ length: 4 }, () => {
      const total = 9 + Math.floor(rnd() * 12);
      return {
        x: rnd() * w,
        y: h * (0.25 + rnd() * 0.5),
        v: (rnd() > 0.5 ? 1 : -1) * (14 + rnd() * 26),
        prof: 0.3 + rnd() * 0.85,
        color: ['#9ff0ff', '#ffd18a', '#b8ffd9'][Math.floor(rnd() * 3)],
        peces: Array.from({ length: total }, () => ({
          dx: (rnd() - 0.5) * 70, dy: (rnd() - 0.5) * 42, fase: rnd() * 10, tam: 2.6 + rnd() * 2.6,
        })),
      };
    });
    const burbujas = Array.from({ length: 60 }, () => ({
      x: rnd() * w, y: rnd() * h, r: 1 + rnd() * 3.6, v: 16 + rnd() * 42, fase: rnd() * 10,
    }));
    const algas = Array.from({ length: 16 }, () => ({
      x: rnd() * w, alto: h * (0.12 + rnd() * 0.26), ancho: 3 + rnd() * 7,
      fase: rnd() * 10, color: rnd() > 0.5 ? '#0f5f4a' : '#16714f',
    }));
    const nieve = Array.from({ length: 90 }, () => ({
      x: rnd() * w, y: rnd() * h, r: 0.4 + rnd() * 1.2, v: 5 + rnd() * 14, prof: rnd(),
    }));
    const medusas = Array.from({ length: 4 }, () => ({
      x: rnd() * w, y: rnd() * h * 0.8, r: 8 + rnd() * 14, fase: rnd() * 10,
      v: 5 + rnd() * 9, prof: 0.3 + rnd() * 0.7,
    }));
    return { bancos, burbujas, algas, nieve, medusas, lecho: h * 0.94 };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, momento, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);
    const luz = momento === 'noche' ? 0.35 : 1;

    // Cáusticas: la luz de la superficie temblando.
    if (nivel.resplandores) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const f = i / 9;
        const x = (ruido1D(t * 0.25 + i * 3.7, i) * 1.4 - 0.2) * w;
        const g = ctx.createLinearGradient(x, 0, x + 40, h * 0.75);
        g.addColorStop(0, rgba('#bff4ff', 0.13 * luz));
        g.addColorStop(1, rgba('#bff4ff', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 18 - f * 10, -10);
        ctx.lineTo(x + 18 + f * 10, -10);
        ctx.lineTo(x + 60 + f * 40, h * 0.8);
        ctx.lineTo(x + 20 + f * 40, h * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Nieve marina.
    ctx.save();
    const nNieve = cuantosDe(estado.nieve, e);
    for (let i = 0; i < nNieve; i++) {
      const s = estado.nieve[i];
      s.y += s.v * e.dt / 1000;
      if (s.y > h + 4) { s.y = -4; s.x = rnd() * w; }
      ctx.fillStyle = rgba('#dff6ff', 0.1 + s.prof * 0.3);
      ctx.beginPath();
      ctx.arc(s.x + px * 10 * s.prof + Math.sin(t * 0.4 + s.prof * 9) * 6, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Medusas.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of estado.medusas) {
      m.y -= m.v * e.dt / 1000;
      if (m.y < -40) m.y = h + 40;
      const late = Math.sin(t * 1.4 + m.fase);
      const x = m.x + Math.sin(t * 0.3 + m.fase) * 14 + px * 16 * m.prof;
      const y = m.y + py * 10 * m.prof;
      const r = m.r * (0.85 + late * 0.12);
      ctx.fillStyle = rgba('#a7d8ff', 0.1 + m.prof * 0.14);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.72, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = rgba('#cfeaff', 0.12 + m.prof * 0.16);
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * r * 0.3, y);
        ctx.quadraticCurveTo(
          x + i * r * 0.3 + late * 4, y + r * 0.9,
          x + i * r * 0.3 - late * 5, y + r * 1.8,
        );
        ctx.stroke();
      }
      if (nivel.resplandores) resplandor(ctx, x, y, r * 2.6, '#79c8ff', 0.12 * m.prof);
    }
    ctx.restore();

    // Bancos de peces.
    for (const b of estado.bancos) {
      b.x += b.v * e.dt / 1000;
      if (b.x > w + 120) b.x = -120;
      if (b.x < -120) b.x = w + 120;
      const dir = Math.sign(b.v);
      for (const p of b.peces) {
        const x = b.x + p.dx + Math.sin(t * 1.1 + p.fase) * 5 + px * 14 * b.prof;
        const y = b.y + p.dy + Math.cos(t * 0.9 + p.fase) * 6 + py * 10 * b.prof;
        const tam = p.tam * (0.5 + b.prof * 0.8);
        ctx.fillStyle = rgba(b.color, (0.25 + b.prof * 0.5) * luz);
        ctx.beginPath();
        ctx.moveTo(x + dir * tam * 1.9, y);
        ctx.quadraticCurveTo(x, y - tam * 0.75, x - dir * tam * 1.3, y);
        ctx.quadraticCurveTo(x, y + tam * 0.75, x + dir * tam * 1.9, y);
        ctx.closePath();
        ctx.fill();
        // Cola.
        const aleteo = Math.sin(t * 8 + p.fase) * tam * 0.5;
        ctx.beginPath();
        ctx.moveTo(x - dir * tam * 1.3, y);
        ctx.lineTo(x - dir * tam * 2.3, y - tam * 0.55 + aleteo);
        ctx.lineTo(x - dir * tam * 2.3, y + tam * 0.55 + aleteo);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Lecho y algas.
    const gl = ctx.createLinearGradient(0, estado.lecho - h * 0.18, 0, h);
    gl.addColorStop(0, 'rgba(3,26,40,0)');
    gl.addColorStop(1, 'rgba(2,16,26,1)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, estado.lecho - h * 0.18, w, h - estado.lecho + h * 0.18);

    for (const a of estado.algas) {
      const x = a.x + px * 18;
      ctx.strokeStyle = rgba(a.color, 0.75);
      ctx.lineWidth = a.ancho;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, h + 6);
      const mecer = Math.sin(t * 0.8 + a.fase) * a.alto * 0.16;
      ctx.quadraticCurveTo(x + mecer, h - a.alto * 0.55, x + mecer * 1.8, h - a.alto);
      ctx.stroke();
    }

    // Burbujas.
    ctx.save();
    const nB = cuantosDe(estado.burbujas, e);
    for (let i = 0; i < nB; i++) {
      const b = estado.burbujas[i];
      b.y -= b.v * e.dt / 1000;
      if (b.y < -6) { b.y = h + 6; b.x = rnd() * w; }
      const x = b.x + Math.sin(t * 1.1 + b.fase) * 7 + px * 12;
      ctx.strokeStyle = rgba('#d8f8ff', 0.3);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.12);
      ctx.beginPath();
      ctx.arc(x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.45);
  },
};

/* ================================================================== */
/* AURORA BOREAL                                                       */
/* ================================================================== */

export const aurora = {
  id: 'aurora',
  nombre: 'Aurora',
  emoji: '🌌',
  familia: 'naturaleza',
  paleta: {
    fondo: '#050d1c', fondo2: '#0c1c34', panel: 'rgba(12,28,52,.52)', panelAlto: 'rgba(12,28,52,.88)', panelSolido: '#0c1d36',
    texto: '#e9f3ff', tenue: '#9db9d6', acento: '#5ef2b4', acento2: '#8fb6ff',
    exito: '#5ef2b4', aviso: '#ffd166', peligro: '#ff7b8a', borde: 'rgba(120,220,190,.24)',
  },
  cielo: {
    amanecer: ['#22304f', '#3c5578', '#0a1220'],
    dia: ['#2f5480', '#6b93bc', '#111f33'],
    atardecer: ['#2a2f52', '#4e4573', '#0c1220'],
    noche: ['#050d1c', '#0b1a33', '#02060d'],
  },

  crear({ w, h, rnd }) {
    const cintas = Array.from({ length: 4 }, (_, i) => ({
      semilla: rnd() * 100,
      base: h * (0.16 + i * 0.07),
      alto: h * (0.18 + rnd() * 0.22),
      vel: 0.05 + rnd() * 0.09,
      color: ['#5ef2b4', '#6fd0ff', '#b46fff', '#9dff6a'][i % 4],
      a: 0.16 + rnd() * 0.12,
      onda: 26 + rnd() * 50,
    }));
    const estrellas = Array.from({ length: 150 }, () => ({
      x: rnd() * w, y: rnd() * h * 0.7, r: 0.3 + rnd() * 1.1, fase: rnd() * 10, v: 0.8 + rnd() * 2,
    }));
    const copos = Array.from({ length: 70 }, () => ({
      x: rnd() * w, y: rnd() * h, r: 0.7 + rnd() * 1.8, v: 10 + rnd() * 26, fase: rnd() * 10, prof: rnd(),
    }));
    return { cintas, estrellas, copos, horizonte: h * 0.74 };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, momento, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);
    const noche = momento === 'noche' || momento === 'amanecer';

    if (noche) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of estado.estrellas) {
        const a = (0.3 + 0.7 * Math.abs(Math.sin(t * s.v + s.fase))) * 0.75;
        ctx.fillStyle = rgba('#ffffff', a);
        ctx.beginPath();
        ctx.arc(s.x + px * 12, s.y + py * 8, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Las cintas de aurora: bandas onduladas con degradado vertical.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const intensidad = noche ? 1 : 0.3;
    for (const c of estado.cintas) {
      const puntos = [];
      const paso = Math.max(10, w / 26);
      for (let x = -paso; x <= w + paso; x += paso) {
        const n = ruido1D(x / c.onda + t * c.vel * 3, c.semilla) - 0.5;
        const n2 = ruido1D(x / (c.onda * 2.6) + t * c.vel, c.semilla + 31) - 0.5;
        puntos.push({ x, y: c.base + n * c.alto * 0.55 + n2 * c.alto * 0.9 + py * 10 });
      }
      const g = ctx.createLinearGradient(0, c.base - c.alto * 0.4, 0, c.base + c.alto);
      g.addColorStop(0, rgba(c.color, 0));
      g.addColorStop(0.28, rgba(c.color, c.a * intensidad));
      g.addColorStop(1, rgba(c.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(puntos[0].x, puntos[0].y);
      for (let i = 1; i < puntos.length; i++) {
        const p = puntos[i];
        const ant = puntos[i - 1];
        ctx.quadraticCurveTo(ant.x, ant.y, (ant.x + p.x) / 2, (ant.y + p.y) / 2);
      }
      ctx.lineTo(w + paso, c.base + c.alto);
      ctx.lineTo(-paso, c.base + c.alto);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Montañas nevadas en dos planos.
    silueta(ctx, w, h, {
      base: estado.horizonte + py * 4, altura: h * 0.22, rugosidad: 150,
      color: noche ? '#0a1626' : '#243a52', semilla: 7,
    });
    silueta(ctx, w, h, {
      base: estado.horizonte + 34 + py * 8, altura: h * 0.16, rugosidad: 90,
      color: noche ? '#060f1c' : '#1a2b3e', semilla: 21,
    });

    // Llanura de nieve, con el reflejo de la aurora.
    const sueloY = estado.horizonte + 64;
    const gs = ctx.createLinearGradient(0, sueloY, 0, h);
    gs.addColorStop(0, noche ? '#152a42' : '#cfe3f5');
    gs.addColorStop(1, noche ? '#060d18' : '#8fb0c8');
    ctx.fillStyle = gs;
    ctx.fillRect(0, sueloY, w, h - sueloY);
    if (noche && nivel.resplandores) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const c of estado.cintas) {
        mancha(ctx, w * 0.5, sueloY + 30, w * 0.7, 40, c.color, 0.05);
      }
      ctx.restore();
    }

    // Nieve cayendo.
    const n = cuantosDe(estado.copos, e);
    for (let i = 0; i < n; i++) {
      const c = estado.copos[i];
      c.y += c.v * e.dt / 1000;
      c.x += Math.sin(t * 0.6 + c.fase) * 12 * e.dt / 1000;
      if (c.y > h + 4) { c.y = -4; c.x = rnd() * w; }
      ctx.fillStyle = rgba('#ffffff', 0.25 + c.prof * 0.6);
      ctx.beginPath();
      ctx.arc(c.x + px * 14 * c.prof, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.4);
  },
};

/* ================================================================== */
/* VOLCÁN                                                              */
/* ================================================================== */

export const volcan = {
  id: 'volcan',
  nombre: 'Volcán',
  emoji: '🌋',
  familia: 'calor',
  paleta: {
    fondo: '#170a0c', fondo2: '#2a1114', panel: 'rgba(42,17,20,.52)', panelAlto: 'rgba(42,17,20,.88)', panelSolido: '#2a1114',
    texto: '#ffe9e2', tenue: '#cfa093', acento: '#ff6b3c', acento2: '#ffc93c',
    exito: '#7bd88f', aviso: '#ffc93c', peligro: '#ff4f5a', borde: 'rgba(255,140,90,.26)',
  },
  cielo: {
    amanecer: ['#3d1a20', '#6b2a24', '#1a0a0c'],
    dia: ['#4a2420', '#7d3a28', '#1d0c0d'],
    atardecer: ['#4a1220', '#a13418', '#1c0809'],
    noche: ['#170a0c', '#2e1014', '#0a0405'],
  },

  crear({ w, h, rnd }) {
    const brasas = Array.from({ length: 150 }, () => ({
      x: rnd() * w, y: h * (0.5 + rnd() * 0.6), v: 18 + rnd() * 60,
      r: 0.6 + rnd() * 1.8, fase: rnd() * 10, vida: rnd(),
    }));
    const ceniza = Array.from({ length: 60 }, () => ({
      x: rnd() * w, y: rnd() * h, v: 8 + rnd() * 20, r: 0.6 + rnd() * 1.6, fase: rnd() * 10,
    }));
    const coladas = Array.from({ length: 4 }, () => ({
      offset: (rnd() - 0.5) * 60,
      curva: (rnd() - 0.5) * 90,
      ancho: 2 + rnd() * 4,
      fase: rnd() * 10,
    }));
    return {
      brasas, ceniza, coladas,
      cráterX: w * 0.58, cráterY: h * 0.42, base: h * 0.95,
    };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);

    // Resplandor del cráter contra el cielo.
    const late = 0.82 + Math.sin(t * 1.3) * 0.1 + Math.sin(t * 3.7) * 0.05;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    mancha(ctx, estado.cráterX + px * 8, estado.cráterY - h * 0.08, w * 0.6, h * 0.34, '#ff5a1e', 0.2 * late);
    ctx.restore();

    // Montañas de fondo.
    silueta(ctx, w, h, {
      base: h * 0.7 + py * 4, altura: h * 0.16, rugosidad: 130, color: '#3a1a1c', semilla: 5,
    });

    // El cono del volcán.
    const cx = estado.cráterX + px * 6;
    const cy = estado.cráterY + py * 4;
    ctx.fillStyle = '#2a1114';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.62, estado.base);
    ctx.lineTo(cx - 44, cy + 6);
    ctx.lineTo(cx + 40, cy);
    ctx.lineTo(cx + w * 0.6, estado.base);
    ctx.closePath();
    ctx.fill();

    // Lava del cráter y coladas bajando.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    resplandor(ctx, cx, cy + 4, 56 * late, '#ff7a2c', 0.7);
    ctx.fillStyle = rgba('#ffd06a', 0.9);
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy + 4, 34, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const c of estado.coladas) {
      const grad = ctx.createLinearGradient(cx, cy, cx + c.curva, estado.base);
      grad.addColorStop(0, rgba('#fff0b0', 0.85));
      grad.addColorStop(0.45, rgba('#ff6b2c', 0.6));
      grad.addColorStop(1, rgba('#a02010', 0.05));
      ctx.strokeStyle = grad;
      ctx.lineWidth = c.ancho + Math.sin(t * 1.4 + c.fase) * 0.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + c.offset * 0.3, cy + 6);
      ctx.quadraticCurveTo(
        cx + c.offset + c.curva * 0.4 + Math.sin(t * 0.7 + c.fase) * 6,
        (cy + estado.base) / 2,
        cx + c.curva,
        estado.base,
      );
      ctx.stroke();
    }
    ctx.restore();

    // Brasas subiendo.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = cuantosDe(estado.brasas, e);
    for (let i = 0; i < n; i++) {
      const b = estado.brasas[i];
      b.vida += e.dt / 3200;
      b.y -= b.v * e.dt / 1000;
      b.x += Math.sin(t * 0.8 + b.fase) * 16 * e.dt / 1000;
      if (b.vida > 1 || b.y < -10) {
        b.vida = 0;
        b.y = h * (0.55 + rnd() * 0.45);
        b.x = cx + (rnd() - 0.5) * w * 0.7;
      }
      const a = Math.sin(b.vida * Math.PI) * 0.9;
      const color = b.vida < 0.4 ? '#ffd86a' : '#ff6b2c';
      chispa(ctx, b.x + px * 10, b.y, b.r, color, a);
    }
    ctx.restore();

    // Ceniza cayendo por delante.
    const nc = cuantosDe(estado.ceniza, e);
    for (let i = 0; i < nc; i++) {
      const c = estado.ceniza[i];
      c.y += c.v * e.dt / 1000;
      c.x += Math.sin(t * 0.4 + c.fase) * 9 * e.dt / 1000;
      if (c.y > h + 4) { c.y = -4; c.x = rnd() * w; }
      ctx.fillStyle = 'rgba(60,40,38,.55)';
      ctx.beginPath();
      ctx.arc(c.x + px * 14, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.5);
  },
};

/* ================================================================== */
/* PLANO TÉCNICO — el tema sobrio: un cianotipo que se va dibujando    */
/* ================================================================== */

export const pizarra = {
  id: 'pizarra',
  nombre: 'Plano Técnico',
  emoji: '📐',
  familia: 'sobrio',
  paleta: {
    fondo: '#0a1622', fondo2: '#0f2033', panel: 'rgba(14,32,50,.52)', panelAlto: 'rgba(14,32,50,.88)', panelSolido: '#102336',
    texto: '#e4f0fb', tenue: '#8fb0ca', acento: '#58b6ff', acento2: '#6fd0a0',
    exito: '#4cc38a', aviso: '#e2b341', peligro: '#e5534b', borde: 'rgba(120,170,215,.24)',
  },
  cielo: {
    amanecer: ['#122438', '#16304a', '#0a1420'],
    dia: ['#14293f', '#1a3753', '#0b1724'],
    atardecer: ['#122132', '#1a3048', '#0a131d'],
    noche: ['#0a1622', '#0f2334', '#060d15'],
  },

  crear({ w, h, rnd }) {
    const rejilla = 30;

    // Piezas de plano: alzados, plantas y secciones repartidos por la hoja.
    const piezas = [];
    const sitios = [
      { x: 0.22, y: 0.16, s: 0.3 }, { x: 0.74, y: 0.3, s: 0.24 },
      { x: 0.3, y: 0.56, s: 0.26 }, { x: 0.76, y: 0.78, s: 0.22 },
      { x: 0.2, y: 0.87, s: 0.2 },
    ];
    for (const p of sitios) {
      const tipo = Math.floor(rnd() * 3);
      const r = Math.min(w, h) * p.s * 0.5;
      const anillos = Array.from({ length: 3 + Math.floor(rnd() * 3) }, (_, i) => ({
        r: r * (0.25 + i * 0.22),
        dientes: 8 + Math.floor(rnd() * 14),
      }));
      piezas.push({
        x: p.x * w, y: p.y * h, r, tipo, anillos,
        v: (rnd() - 0.5) * 0.35,
        fase: rnd() * 10,
        // Cada pieza se "dibuja" con una fase distinta: la hoja nunca está quieta.
        traza: rnd() * 10,
      });
    }

    // Cotas y líneas auxiliares.
    const cotas = Array.from({ length: 9 }, () => ({
      x: rnd() * w, y: rnd() * h, largo: 40 + rnd() * 110,
      vertical: rnd() > 0.5, fase: rnd() * 10,
    }));

    // Curva de datos con su área: el único elemento "vivo" de la hoja.
    const semilla = rnd() * 100;
    const serie = Array.from({ length: 40 }, (_, i) => ({
      x: i / 39,
      // Ruido suave, no un valor suelto por punto: así sale una curva y no
      // una sierra. Amplitud corta, que esto es un plano, no un electro.
      base: 0.42 + (ruido1D(i / 5.5, semilla) - 0.5) * 0.26 + (ruido1D(i / 2.2, semilla + 7) - 0.5) * 0.07,
      amp: 0.008 + rnd() * 0.012,
      fase: rnd() * 10,
    }));

    return { rejilla, piezas, cotas, serie };
  },

  dibujar(ctx, e) {
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);

    // Iluminación de la hoja: una luz suave arriba a la izquierda.
    if (nivel.resplandores) {
      mancha(ctx, w * 0.2, h * 0.12, w * 0.9, h * 0.5, '#3f7fc0', 0.16);
      mancha(ctx, w * 0.85, h * 0.9, w * 0.6, h * 0.3, '#2b5a86', 0.12);
    }

    ctx.save();
    ctx.translate(px * 5, py * 4);

    // Retícula doble: fina y, cada cinco, más marcada. Es lo que hace que
    // parezca papel milimetrado y no un cuadriculado cualquiera.
    const paso = estado.rejilla * (nivel.factor >= 0.6 ? 1 : 2);
    ctx.strokeStyle = 'rgba(150,195,235,.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -paso; x < w + paso * 2; x += paso / 3) { ctx.moveTo(x, -30); ctx.lineTo(x, h + 30); }
    for (let y = -paso; y < h + paso * 2; y += paso / 3) { ctx.moveTo(-30, y); ctx.lineTo(w + 30, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,195,235,.13)';
    ctx.beginPath();
    for (let x = -paso; x < w + paso * 2; x += paso) { ctx.moveTo(x, -30); ctx.lineTo(x, h + 30); }
    for (let y = -paso; y < h + paso * 2; y += paso) { ctx.moveTo(-30, y); ctx.lineTo(w + 30, y); }
    ctx.stroke();

    // Piezas técnicas.
    ctx.lineCap = 'round';
    for (const p of estado.piezas) {
      const giro = p.v * t * 0.35;
      // El trazo "se dibuja": el arco visible crece y decrece muy despacio.
      const avance = 0.55 + 0.45 * Math.sin(t * 0.25 + p.traza);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(giro);
      ctx.strokeStyle = rgba('#8fd0ff', 0.3);
      ctx.lineWidth = 1.1;

      if (p.tipo === 0) {
        // Engranaje: círculos concéntricos y dientes.
        for (const a of p.anillos) {
          ctx.beginPath();
          ctx.arc(0, 0, a.r, 0, Math.PI * 2 * avance);
          ctx.stroke();
        }
        const fuera = p.anillos[p.anillos.length - 1];
        ctx.beginPath();
        for (let i = 0; i < fuera.dientes; i++) {
          const ang = (i / fuera.dientes) * Math.PI * 2;
          ctx.moveTo(Math.cos(ang) * fuera.r, Math.sin(ang) * fuera.r);
          ctx.lineTo(Math.cos(ang) * (fuera.r + p.r * 0.12), Math.sin(ang) * (fuera.r + p.r * 0.12));
        }
        ctx.stroke();
      } else if (p.tipo === 1) {
        // Planta acotada: un rectángulo con ejes y diagonales.
        const a = p.r * 1.25;
        const b = p.r * 0.8;
        ctx.strokeRect(-a / 2, -b / 2, a, b);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(-a * 0.62, 0); ctx.lineTo(a * 0.62, 0);
        ctx.moveTo(0, -b * 0.72); ctx.lineTo(0, b * 0.72);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(-a / 2, -b / 2); ctx.lineTo(a / 2, b / 2);
        ctx.stroke();
      } else {
        // Sección: un perfil poligonal con rayado interior.
        const lados = 6;
        ctx.beginPath();
        for (let i = 0; i <= lados; i++) {
          const ang = (i / lados) * Math.PI * 2;
          const x = Math.cos(ang) * p.r;
          const y = Math.sin(ang) * p.r * 0.82;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = rgba('#6fd0a0', 0.18);
        ctx.beginPath();
        for (let i = -6; i <= 6; i++) {
          ctx.moveTo(i * p.r * 0.18 - p.r * 0.3, -p.r * 0.5);
          ctx.lineTo(i * p.r * 0.18 + p.r * 0.3, p.r * 0.5);
        }
        ctx.stroke();
      }

      // Punto de referencia en el centro.
      ctx.fillStyle = rgba('#8fd0ff', 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (nivel.resplandores) resplandor(ctx, p.x, p.y, p.r * 1.6, '#58b6ff', 0.07);
    }

    // Cotas.
    ctx.strokeStyle = rgba('#a8c8e0', 0.16);
    ctx.lineWidth = 1;
    for (const c of estado.cotas) {
      const l = c.largo * (0.7 + 0.3 * Math.sin(t * 0.3 + c.fase));
      ctx.beginPath();
      if (c.vertical) {
        ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y + l);
        ctx.moveTo(c.x - 4, c.y); ctx.lineTo(c.x + 4, c.y);
        ctx.moveTo(c.x - 4, c.y + l); ctx.lineTo(c.x + 4, c.y + l);
      } else {
        ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + l, c.y);
        ctx.moveTo(c.x, c.y - 4); ctx.lineTo(c.x, c.y + 4);
        ctx.moveTo(c.x + l, c.y - 4); ctx.lineTo(c.x + l, c.y + 4);
      }
      ctx.stroke();
    }

    // Curva de datos con área bajo la línea.
    const puntos = estado.serie.map((s) => ({
      x: s.x * w,
      y: h * (s.base + Math.sin(t * 0.3 + s.fase) * s.amp),
    }));
    const g = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.8);
    g.addColorStop(0, rgba('#58b6ff', 0.16));
    g.addColorStop(1, rgba('#58b6ff', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, h);
    for (const p of puntos) ctx.lineTo(p.x, p.y);
    ctx.lineTo(puntos[puntos.length - 1].x, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba('#7fc8ff', 0.5);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    puntos.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();

    ctx.restore();
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.34);
  },
};

/* ================================================================== */
/* SAKURA — cerezo en flor, farolillos y pétalos                       */
/* ================================================================== */

export const sakura = {
  id: 'sakura',
  nombre: 'Sakura',
  emoji: '🌸',
  familia: 'anime',
  paleta: {
    fondo: '#26121c', fondo2: '#3a1c2a', panel: 'rgba(58,28,42,.52)', panelAlto: 'rgba(58,28,42,.88)', panelSolido: '#3a1c2a',
    texto: '#ffeef4', tenue: '#d9aec0', acento: '#ff85b3', acento2: '#ffd6e6',
    exito: '#7ddba0', aviso: '#ffd07a', peligro: '#ff6b8a', borde: 'rgba(255,160,195,.26)',
  },
  cielo: {
    amanecer: ['#8a4f68', '#d78fa4', '#3a1f2c'],
    dia: ['#7f5f8e', '#e0a6bd', '#3a2230'],
    atardecer: ['#6b2a48', '#e0704f', '#2c1220'],
    noche: ['#1d0f1a', '#3a1c34', '#0d0710'],
  },

  crear({ w, h, rnd }) {
    // El cerezo se genera una vez: ramas recursivas con semilla fija.
    const ramas = [];
    const crecer = (x, y, ang, largo, grosor, nivel) => {
      if (nivel > 5 || largo < 6) return;
      const x2 = x + Math.cos(ang) * largo;
      const y2 = y + Math.sin(ang) * largo;
      ramas.push({ x, y, x2, y2, grosor, nivel, fase: rnd() * 10 });
      const hijos = nivel < 2 ? 2 : (rnd() > 0.35 ? 2 : 1);
      for (let i = 0; i < hijos; i++) {
        const giro = (i === 0 ? -1 : 1) * (0.28 + rnd() * 0.42);
        crecer(x2, y2, ang + giro, largo * (0.62 + rnd() * 0.2), grosor * 0.66, nivel + 1);
      }
    };
    crecer(-14, h * 1.02, -Math.PI / 2.35, h * 0.2, 13, 0);

    const flores = ramas
      .filter((r) => r.nivel >= 3)
      .map((r) => ({ x: r.x2, y: r.y2, r: 3 + rnd() * 5, fase: rnd() * 10, tono: rnd() }));

    const petalos = Array.from({ length: 80 }, () => ({
      x: rnd() * w, y: rnd() * h, v: 18 + rnd() * 34, vx: -10 - rnd() * 26,
      giro: rnd() * 6, tam: 2.4 + rnd() * 3.4, prof: rnd(),
    }));

    const farolillos = Array.from({ length: 5 }, () => ({
      x: rnd() * w, y: h * (0.2 + rnd() * 0.3), fase: rnd() * 10, r: 5 + rnd() * 5,
    }));

    return { ramas, flores, petalos, farolillos, suelo: h * 0.9 };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, momento, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);
    const noche = momento === 'noche';

    // Luna o sol bajo, grande y suave.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ax = w * 0.74 + px * 10;
    const ay = h * (noche ? 0.2 : 0.3) + py * 6;
    resplandor(ctx, ax, ay, Math.min(w, h) * 0.34, noche ? '#ffe6f2' : '#ffd9c2', 0.3);
    ctx.fillStyle = rgba(noche ? '#fff0f8' : '#ffe2c8', 0.85);
    ctx.beginPath();
    ctx.arc(ax, ay, Math.min(w, h) * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Colinas y torii al fondo.
    silueta(ctx, w, h, {
      base: estado.suelo - 40 + py * 5, altura: h * 0.11, rugosidad: 170,
      color: noche ? '#2a1428' : '#5a3450', semilla: 11,
    });
    const tx = w * 0.3 + px * 12;
    const ty = estado.suelo - 40;
    ctx.fillStyle = noche ? '#1c0d1a' : '#4a2038';
    ctx.fillRect(tx - 26, ty - 44, 5, 46);
    ctx.fillRect(tx + 22, ty - 44, 5, 46);
    ctx.fillRect(tx - 36, ty - 50, 72, 5);
    ctx.fillRect(tx - 30, ty - 38, 60, 4);

    // Suelo.
    const g = ctx.createLinearGradient(0, estado.suelo - 30, 0, h);
    g.addColorStop(0, noche ? '#180c16' : '#3a1c2a');
    g.addColorStop(1, noche ? '#0b0510' : '#24121c');
    ctx.fillStyle = g;
    ctx.fillRect(0, estado.suelo - 30, w, h - estado.suelo + 30);

    // Farolillos flotando.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of estado.farolillos) {
      const x = f.x + Math.sin(t * 0.25 + f.fase) * 16 + px * 14;
      const y = f.y + Math.cos(t * 0.19 + f.fase) * 12 + py * 8;
      resplandor(ctx, x, y, f.r * 5, '#ffb46a', 0.3);
      ctx.fillStyle = rgba('#ffd9a0', 0.75);
      ctx.beginPath();
      ctx.ellipse(x, y, f.r * 0.7, f.r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // El cerezo.
    ctx.save();
    ctx.translate(px * 20, py * 8);
    for (const r of estado.ramas) {
      const mecer = Math.sin(t * 0.55 + r.fase) * r.nivel * 0.9;
      ctx.strokeStyle = noche ? '#2e1522' : '#4a2233';
      ctx.lineWidth = r.grosor;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x2 + mecer, r.y2);
      ctx.stroke();
    }
    for (const f of estado.flores) {
      const mecer = Math.sin(t * 0.55 + f.fase) * 4.5;
      const color = f.tono > 0.75 ? '#fff0f6' : f.tono > 0.4 ? '#ffb3d1' : '#ff85b3';
      if (nivel.resplandores && noche) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        resplandor(ctx, f.x + mecer, f.y, f.r * 3.4, color, 0.14);
        ctx.restore();
      }
      ctx.fillStyle = rgba(color, 0.9);
      ctx.beginPath();
      ctx.arc(f.x + mecer, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Pétalos cayendo.
    const n = cuantosDe(estado.petalos, e);
    for (let i = 0; i < n; i++) {
      const p = estado.petalos[i];
      p.y += p.v * e.dt / 1000;
      p.x += (p.vx + Math.sin(t * 1.2 + p.giro) * 24) * e.dt / 1000;
      p.giro += e.dt / 520;
      if (p.y > h + 10) { p.y = -10; p.x = rnd() * (w + 120); }
      if (p.x < -20) p.x = w + 20;
      ctx.save();
      ctx.translate(p.x + px * 12 * p.prof, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = rgba(p.prof > 0.6 ? '#ffd6e6' : '#ff9ec4', 0.35 + p.prof * 0.55);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.tam, p.tam * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.4);
  },
};
