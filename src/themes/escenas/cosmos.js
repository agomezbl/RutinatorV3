/**
 * Escenas de universo: nebulosa profunda y sistema orbital.
 */

import { festejar,
  cuantosDe, rgba, resplandor, mancha, chispa, destello, cieloVertical, cuantos,
} from '../motor.js';
import { vinieta } from './digital.js';

/** Campo de estrellas con profundidad: se reutiliza en las dos escenas. */
function crearEstrellas(w, h, rnd, total) {
  return Array.from({ length: total }, () => {
    const prof = rnd();
    return {
      x: rnd() * w,
      y: rnd() * h,
      r: 0.25 + prof * 1.3,
      prof,
      fase: rnd() * 10,
      vel: 0.6 + rnd() * 2.4,
      tono: rnd() > 0.82 ? (rnd() > 0.5 ? '#ffd9b0' : '#b9d8ff') : '#ffffff',
    };
  });
}

function dibujarEstrellas(ctx, e, lista, { brillo = 1 } = {}) {
  const { t, px, py } = e;
  const n = cuantosDe(lista, e);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const s = lista[i];
    const x = s.x + px * 26 * s.prof;
    const y = s.y + py * 18 * s.prof;
    const titila = 0.45 + 0.55 * Math.abs(Math.sin(t * s.vel + s.fase));
    const a = (0.2 + s.prof * 0.8) * titila * brillo;
    if (s.prof > 0.85 && e.nivel.resplandores) {
      resplandor(ctx, x, y, s.r * 9, s.tono, a * 0.35);
    }
    ctx.fillStyle = rgba(s.tono, a);
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ================================================================== */
/* NEBULOSA                                                            */
/* ================================================================== */

export const nebulosa = {
  id: 'nebulosa',
  nombre: 'Nebulosa',
  emoji: '🌌',
  familia: 'espacio',
  paleta: {
    fondo: '#05050f', fondo2: '#0f0d28', panel: 'rgba(16,14,42,.52)', panelAlto: 'rgba(16,14,42,.88)', panelSolido: '#100e2c',
    texto: '#ecebff', tenue: '#9a97cc', acento: '#9a7bff', acento2: '#ff9ad5',
    exito: '#5fe0b0', aviso: '#ffd36e', peligro: '#ff7b9c', borde: 'rgba(150,130,255,.26)',
  },
  cielo: {
    amanecer: ['#161436', '#241f54', '#070616'],
    dia: ['#191a44', '#2b2a66', '#08081c'],
    atardecer: ['#231240', '#3a1c5e', '#0a0618'],
    noche: ['#05050f', '#131132', '#020208'],
  },

  crear({ w, h, rnd }) {
    const nubes = [];
    const paleta = ['#8a4fff', '#ff5aa8', '#3f8aff', '#ff9a4f', '#3fe8c8'];
    for (let i = 0; i < 20; i++) {
      nubes.push({
        x: rnd() * w,
        y: rnd() * h,
        rx: h * (0.16 + rnd() * 0.44),
        ry: h * (0.1 + rnd() * 0.32),
        rot: rnd() * Math.PI,
        color: paleta[Math.floor(rnd() * paleta.length)],
        a: 0.07 + rnd() * 0.13,
        prof: rnd(),
        fase: rnd() * 10,
      });
    }
    // Un núcleo de emisión: el corazón brillante que ordena toda la escena.
    const nucleo = {
      x: w * (0.3 + rnd() * 0.42),
      y: h * (0.3 + rnd() * 0.35),
      r: h * (0.16 + rnd() * 0.1),
      fase: rnd() * 10,
    };
    // Vetas de polvo: manchas oscuras que recortan el gas y dan volumen.
    const polvo = Array.from({ length: 9 }, () => ({
      x: rnd() * w, y: rnd() * h,
      rx: h * (0.1 + rnd() * 0.26), ry: h * (0.02 + rnd() * 0.07),
      rot: rnd() * Math.PI, a: 0.2 + rnd() * 0.3,
    }));
    // Estrellas grandes en primer plano, con puntas.
    const joyas = Array.from({ length: 5 }, () => ({
      x: rnd() * w, y: rnd() * h, r: 1.4 + rnd() * 1.6,
      color: ['#ffffff', '#bcd8ff', '#ffe0b0'][Math.floor(rnd() * 3)],
      fase: rnd() * 10,
    }));
    const estrellas = crearEstrellas(w, h, rnd, 260);
    const fugaces = Array.from({ length: 3 }, () => ({
      x: rnd() * w, y: rnd() * h * 0.5, vida: rnd() * 8, largo: 60 + rnd() * 120,
      ang: 2.2 + rnd() * 0.5, v: 420 + rnd() * 380,
    }));
    const galaxia = {
      x: w * (0.2 + rnd() * 0.6),
      y: h * (0.2 + rnd() * 0.5),
      r: h * 0.1,
      rot: rnd() * Math.PI,
      brazos: 2 + Math.floor(rnd() * 2),
    };
    return { nubes, nucleo, polvo, joyas, estrellas, fugaces, galaxia };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);

    // Nubes de gas: varias capas que respiran.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const n of estado.nubes) {
      const respira = 1 + Math.sin(t * 0.14 + n.fase) * 0.07;
      mancha(
        ctx,
        n.x + px * 30 * n.prof + Math.sin(t * 0.05 + n.fase) * 10,
        n.y + py * 22 * n.prof,
        n.rx * respira,
        n.ry * respira,
        n.color,
        n.a,
        n.rot + t * 0.006,
      );
    }
    // Núcleo de emisión.
    const nu = estado.nucleo;
    const late = 1 + Math.sin(t * 0.22 + nu.fase) * 0.06;
    mancha(ctx, nu.x + px * 16, nu.y + py * 12, nu.r * 2.3 * late, nu.r * 1.7 * late, '#ff7ad0', 0.1);
    mancha(ctx, nu.x + px * 16, nu.y + py * 12, nu.r * 1.3 * late, nu.r * 1.05 * late, '#9ab4ff', 0.13);
    if (nivel.resplandores) resplandor(ctx, nu.x + px * 16, nu.y + py * 12, nu.r * 0.7, '#ffffff', 0.16);
    ctx.restore();

    // Vetas de polvo: restan luz, así que van en modo normal y en oscuro.
    for (const d of estado.polvo) {
      mancha(ctx, d.x + px * 18, d.y + py * 13, d.rx, d.ry, '#07030f', d.a * 1.3, d.rot);
    }

    dibujarEstrellas(ctx, e, estado.estrellas);

    // Galaxia espiral de fondo.
    const g = estado.galaxia;
    const gx = g.x + px * 12;
    const gy = g.y + py * 9;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(gx, gy);
    ctx.rotate(g.rot + t * 0.01);
    ctx.scale(1, 0.42);
    for (let b = 0; b < g.brazos; b++) {
      ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const f = i / 90;
        const ang = f * Math.PI * 2.4 + (b / g.brazos) * Math.PI * 2;
        const r = f * g.r * 2.4;
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const gr = ctx.createLinearGradient(-g.r * 2.4, 0, g.r * 2.4, 0);
      gr.addColorStop(0, 'rgba(150,190,255,.05)');
      gr.addColorStop(0.5, 'rgba(230,215,255,.24)');
      gr.addColorStop(1, 'rgba(255,170,220,.08)');
      ctx.strokeStyle = gr;
      ctx.lineWidth = 7;
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const j of estado.joyas) {
      const centelleo = 0.6 + 0.4 * Math.sin(t * 1.1 + j.fase);
      destello(ctx, j.x + px * 20, j.y + py * 15, j.r, j.color, centelleo, t * 0.05 + j.fase);
    }
    resplandor(ctx, gx, gy, g.r * 1.4, '#e8dcff', 0.2);
    ctx.restore();

    // Estrellas fugaces.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of estado.fugaces) {
      f.vida += e.dt / 1000;
      if (f.vida > 6) {
        f.vida = 0;
        f.x = rnd() * w;
        f.y = rnd() * h * 0.5;
        f.ang = 2.2 + rnd() * 0.5;
      }
      if (f.vida > 1.1) continue;
      const rec = f.vida * f.v;
      const x = f.x + Math.cos(f.ang) * rec;
      const y = f.y + Math.sin(f.ang) * rec;
      const a = Math.sin(Math.min(1, f.vida / 1.1) * Math.PI);
      const gx2 = ctx.createLinearGradient(x - Math.cos(f.ang) * f.largo, y - Math.sin(f.ang) * f.largo, x, y);
      gx2.addColorStop(0, 'rgba(255,255,255,0)');
      gx2.addColorStop(1, `rgba(255,255,255,${(a * 0.85).toFixed(3)})`);
      ctx.strokeStyle = gx2;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(f.ang) * f.largo, y - Math.sin(f.ang) * f.largo);
      ctx.lineTo(x, y);
      ctx.stroke();
      chispa(ctx, x, y, 1.4, '#ffffff', a);
    }
    ctx.restore();
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.5);
  },
};

/* ================================================================== */
/* SISTEMA ORBITAL                                                     */
/* ================================================================== */

export const orbital = {
  id: 'orbital',
  nombre: 'Órbitas',
  emoji: '🪐',
  familia: 'espacio',
  paleta: {
    fondo: '#060814', fondo2: '#0e1430', panel: 'rgba(14,20,48,.52)', panelAlto: 'rgba(14,20,48,.88)', panelSolido: '#0e1530',
    texto: '#e9ecff', tenue: '#98a2d0', acento: '#ffb347', acento2: '#6fd0ff',
    exito: '#5fe0b0', aviso: '#ffd36e', peligro: '#ff7b8a', borde: 'rgba(140,160,255,.24)',
  },
  cielo: {
    amanecer: ['#12183c', '#1e2a58', '#070a1c'],
    dia: ['#141c44', '#233066', '#080c20'],
    atardecer: ['#1a1440', '#2e1f58', '#070818'],
    noche: ['#060814', '#101736', '#03040c'],
  },

  crear({ w, h, rnd }) {
    const cx = w * 0.5;
    const cy = h * 0.52;
    const base = Math.min(w, h) * 0.1;
    const planetas = [
      { r: 10, color: '#ff8a5c', anillo: false },
      { r: 14, color: '#6fd0ff', anillo: false, luna: true },
      { r: 9, color: '#c8a2ff', anillo: false },
      { r: 20, color: '#ffd08a', anillo: true },
      { r: 12, color: '#7ef0c0', anillo: false },
    ].map((p, i) => ({
      ...p,
      a: base * (1.5 + i * 0.75),
      b: base * (1.5 + i * 0.75) * (0.3 + rnd() * 0.12),
      vel: 0.42 / (1 + i * 0.8),
      fase: rnd() * Math.PI * 2,
      incl: -0.18 + rnd() * 0.12,
      lunaFase: rnd() * 10,
      estela: [],
    }));
    const asteroides = Array.from({ length: 90 }, () => {
      const rad = base * (4.6 + rnd() * 0.7);
      return { rad, ang: rnd() * Math.PI * 2, vel: 0.06 + rnd() * 0.05, r: 0.5 + rnd() * 1.4, achata: 0.3 };
    });
    return { cx, cy, base, planetas, asteroides, estrellas: crearEstrellas(w, h, rnd, 180) };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);
    dibujarEstrellas(ctx, e, estado.estrellas, { brillo: 0.85 });

    const cx = estado.cx + px * 16;
    const cy = estado.cy + py * 12;

    // El sol, con corona que respira.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulso = 1 + Math.sin(t * 0.7) * 0.05;
    resplandor(ctx, cx, cy, estado.base * 3.4 * pulso, '#ffb347', 0.38);
    resplandor(ctx, cx, cy, estado.base * 1.5 * pulso, '#fff0c0', 0.6);
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath();
    ctx.arc(cx, cy, estado.base * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (const p of estado.planetas) {
      // Órbita.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(p.incl);
      ctx.strokeStyle = 'rgba(160,180,255,.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.a, p.b, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const ang = t * p.vel + p.fase;
      const lx = Math.cos(ang) * p.a;
      const ly = Math.sin(ang) * p.b;
      const x = cx + lx * Math.cos(p.incl) - ly * Math.sin(p.incl);
      const y = cy + lx * Math.sin(p.incl) + ly * Math.cos(p.incl);
      const delante = Math.sin(ang) > 0;
      const escala = 0.82 + (Math.sin(ang) + 1) * 0.12;

      if (nivel.estelas) {
        p.estela.push({ x, y });
        if (p.estela.length > 26) p.estela.shift();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        p.estela.forEach((s, i) => (i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y)));
        ctx.strokeStyle = rgba(p.color, 0.18);
        ctx.lineWidth = p.r * 0.4;
        ctx.stroke();
        ctx.restore();
      }

      if (p.anillo && !delante) dibujarAnillo(ctx, x, y, p, escala, 0.45);

      // Planeta con luz por un lado.
      const g = ctx.createRadialGradient(
        x - p.r * 0.4 * escala, y - p.r * 0.4 * escala, p.r * 0.1,
        x, y, p.r * escala,
      );
      g.addColorStop(0, rgba('#ffffff', 0.55));
      g.addColorStop(0.4, p.color);
      g.addColorStop(1, 'rgba(0,0,0,.75)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, p.r * escala, 0, Math.PI * 2);
      ctx.fill();

      if (p.anillo && delante) dibujarAnillo(ctx, x, y, p, escala, 0.8);

      if (p.luna) {
        const la = t * 1.6 + p.lunaFase;
        const lxm = x + Math.cos(la) * p.r * 2.4;
        const lym = y + Math.sin(la) * p.r * 1.1;
        ctx.fillStyle = 'rgba(230,238,255,.9)';
        ctx.beginPath();
        ctx.arc(lxm, lym, 2.4 * escala, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Cinturón de asteroides.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = cuantosDe(estado.asteroides, e);
    for (let i = 0; i < n; i++) {
      const a = estado.asteroides[i];
      a.ang += a.vel * e.dt / 1000;
      const x = cx + Math.cos(a.ang) * a.rad;
      const y = cy + Math.sin(a.ang) * a.rad * a.achata;
      ctx.fillStyle = 'rgba(210,200,190,.5)';
      ctx.beginPath();
      ctx.arc(x, y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.45);
  },
};

function dibujarAnillo(ctx, x, y, p, escala, alfa) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.4);
  ctx.strokeStyle = rgba('#ffe6b0', alfa * 0.55);
  ctx.lineWidth = 3.2 * escala;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r * 2.1 * escala, p.r * 0.62 * escala, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba('#ffd08a', alfa * 0.3);
  ctx.lineWidth = 1.4 * escala;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r * 2.7 * escala, p.r * 0.82 * escala, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
