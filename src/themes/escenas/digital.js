/**
 * Escenas digitales: ciudad cyberpunk, atardecer de neón, lluvia de código,
 * túnel de datos y placa de circuitos.
 *
 * Todas comparten la misma idea de dibujo: primero el aire (cielo, bruma,
 * haces de luz), luego los planos de fondo a poco contraste, y al final el
 * primer plano con luz aditiva. Lo que hace que se vean "de verdad" no es el
 * número de partículas, es que haya varios planos con niebla entre ellos.
 */

import {
  rgba, resplandor, mancha, chispa, destello, haz, bruma, trazoBrillante,
  cieloVertical, festejar, cuantos, cuantosDe, ruido1D, prng, semillaDe, mezclar,
} from '../motor.js';

/** Viñeta: oscurece las esquinas para que el texto de la app se lea. */
export function vinieta(ctx, w, h, fuerza = 0.42) {
  const g = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${fuerza})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Líneas de barrido de pantalla vieja. Muy sutiles, pero cambian el carácter. */
function barrido(ctx, w, h, alpha = 0.055, paso = 3) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < h; y += paso) ctx.fillRect(0, y, w, 1);
}

/* ================================================================== */
/* CIUDAD NEÓN — cyberpunk con lluvia, rótulos, reflejos y tráfico     */
/* ================================================================== */

const ROTULOS = ['ラーメン', '電脳', '24h', 'SAKE', '珈琲', 'NEO', '寿司', 'BAR', '未来'];

export const neon = {
  id: 'neon',
  nombre: 'Ciudad Neón',
  emoji: '🌃',
  familia: 'cyberpunk',
  paleta: {
    fondo: '#07060f', fondo2: '#120c22', panel: 'rgba(18,12,34,.52)', panelAlto: 'rgba(18,12,34,.88)', panelSolido: '#140e26',
    texto: '#eaf2ff', tenue: '#9a93c8', acento: '#00e5ff', acento2: '#ff2fa0',
    exito: '#3ef2a5', aviso: '#ffd53e', peligro: '#ff3e6a', borde: 'rgba(120,120,255,.26)',
  },
  cielo: {
    amanecer: ['#2b1d55', '#63357a', '#1b1030', '#0b0718'],
    dia: ['#2f2a6b', '#6a4a96', '#1d1436', '#0d0a1d'],
    atardecer: ['#43125c', '#a52577', '#2a0a33', '#100515'],
    noche: ['#0c0a26', '#2a1450', '#120a26', '#05040d'],
  },

  crear({ w, h, rnd }) {
    const horizonte = h * 0.6;
    // Cuatro planos de ciudad: cuanto más lejos, más pequeño y más brumoso.
    const capas = [0.18, 0.38, 0.66, 1].map((prof, i) => {
      const edificios = [];
      let x = -60;
      const altoMax = (0.14 + i * 0.1) * h;
      while (x < w + 80) {
        const ancho = 20 + rnd() * (30 + i * 34);
        const alto = (0.35 + rnd() * 0.65) * altoMax;
        const ventanas = [];
        if (i >= 1) {
          const paso = 9 + i * 3;
          for (let vy = 10; vy < alto - 6; vy += paso + 5) {
            for (let vx = 4; vx < ancho - 5; vx += paso) {
              if (rnd() > 0.38) continue;
              ventanas.push({ x: vx, y: vy, fase: rnd() * 100, calido: rnd() > 0.5, alto: paso * 0.45 });
            }
          }
        }
        edificios.push({
          x, ancho, alto,
          ventanas,
          antena: rnd() > 0.7 ? 8 + rnd() * 26 : 0,
          faroFase: rnd() * 10,
          // Franja de luz en la coronilla: da silueta reconocible.
          corona: rnd() > 0.55 ? (rnd() > 0.5 ? '#00e5ff' : '#ff2fa0') : null,
        });
        x += ancho + 2 + rnd() * 10;
      }
      return { prof, edificios, base: horizonte + i * h * 0.075 };
    });

    // Rótulos verticales de neón, con texto: son el sello de la escena.
    const carteles = Array.from({ length: 11 }, () => ({
      x: rnd() * w,
      y: horizonte - h * (0.02 + rnd() * 0.3),
      alto: 30 + rnd() * 90,
      ancho: 9 + rnd() * 9,
      color: [' #00e5ff', '#ff2fa0', '#ffd53e', '#7c4dff'][Math.floor(rnd() * 4)].trim(),
      texto: ROTULOS[Math.floor(rnd() * ROTULOS.length)],
      fase: rnd() * 10,
      parpadeo: rnd() > 0.7,
      prof: 0.45 + rnd() * 0.75,
    }));

    const lluvia = Array.from({ length: 300 }, () => ({
      x: rnd() * (w + 140) - 70,
      y: rnd() * h,
      v: 460 + rnd() * 780,
      largo: 9 + rnd() * 24,
      a: 0.1 + rnd() * 0.32,
    }));

    const naves = Array.from({ length: 5 }, () => ({
      x: rnd() * w,
      y: h * (0.06 + rnd() * 0.3),
      v: (rnd() > 0.5 ? 1 : -1) * (26 + rnd() * 60),
      color: rnd() > 0.5 ? '#ff2fa0' : '#7ef0ff',
      escala: 0.5 + rnd() * 1,
    }));

    // Charcos del suelo mojado que devuelven el neón.
    const charcos = Array.from({ length: 7 }, () => ({
      x: rnd() * w, y: h * (0.87 + rnd() * 0.12),
      rx: 24 + rnd() * 80, ry: 4 + rnd() * 9,
      color: rnd() > 0.5 ? '#00e5ff' : '#ff2fa0',
    }));

    return { capas, carteles, lluvia, naves, charcos, horizonte };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, px, py, nivel, estado } = e;
    const { horizonte } = estado;
    cieloVertical(ctx, w, h, e.cielo);

    // Resplandor de la ciudad contra las nubes bajas: la luz sube desde abajo.
    if (nivel.resplandores) {
      mancha(ctx, w * 0.3, horizonte + h * 0.02, w * 0.75, h * 0.3, '#ff2fa0', 0.16);
      mancha(ctx, w * 0.78, horizonte - h * 0.01, w * 0.6, h * 0.24, '#00e5ff', 0.14);
      // Haces de los focos de la ciudad barriendo el cielo.
      for (let i = 0; i < 2; i++) {
        const ang = Math.sin(t * 0.13 + i * 2.1) * 0.5 - 0.2 + i * 0.7;
        haz(ctx, w * (0.2 + i * 0.6), horizonte, -h * 0.62, 46, ang, '#8fd8ff', 0.09);
      }
    }

    // Planos de ciudad, del fondo al frente.
    estado.capas.forEach((capa, i) => {
      const desliz = px * (2 + capa.prof * 12);
      const tono = mezclar('#1a1038', '#000008', capa.prof * 0.75);
      ctx.save();
      ctx.translate(desliz, py * capa.prof * 4);

      for (const ed of capa.edificios) {
        const alto = ed.alto;
        const base = capa.base;
        // Cuerpo con degradado: arriba recoge la luz del cielo, abajo es negro.
        const g = ctx.createLinearGradient(0, base - alto, 0, base);
        g.addColorStop(0, mezclar(tono, '#3a2a6e', 0.35 - capa.prof * 0.28));
        g.addColorStop(1, tono);
        ctx.fillStyle = g;
        ctx.fillRect(ed.x, base - alto, ed.ancho, alto + h);

        if (ed.corona && nivel.resplandores) {
          ctx.fillStyle = rgba(ed.corona, 0.7 - capa.prof * 0.3);
          ctx.fillRect(ed.x, base - alto, ed.ancho, 1.6);
          resplandor(ctx, ed.x + ed.ancho / 2, base - alto, ed.ancho * 0.9, ed.corona, 0.2);
        }
        if (ed.antena) {
          ctx.strokeStyle = rgba('#5a4a8a', 0.8);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ed.x + ed.ancho / 2, base - alto);
          ctx.lineTo(ed.x + ed.ancho / 2, base - alto - ed.antena);
          ctx.stroke();
          const faro = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.6 + ed.faroFase));
          chispa(ctx, ed.x + ed.ancho / 2, base - alto - ed.antena, 1.1, '#ff3e6a', faro * 0.9);
        }

        // Ventanas: puntos de luz que parpadean muy despacio.
        if (ed.ventanas.length && nivel.factor > 0.3) {
          const nV = Math.max(1, Math.round(ed.ventanas.length * nivel.factor));
          for (let k = 0; k < nV; k++) {
            const v = ed.ventanas[k];
            const br = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.5 + v.fase));
            if (br < 0.33) continue;
            ctx.fillStyle = rgba(v.calido ? '#ffd9a0' : '#9fe8ff', br * (0.9 - capa.prof * 0.35));
            ctx.fillRect(ed.x + v.x, base - alto + v.y, 2.2, v.alto);
          }
        }
      }
      ctx.restore();

      // Niebla entre planos: es lo que crea la profundidad.
      if (i < estado.capas.length - 1) {
        bruma(ctx, w, capa.base - h * 0.02, h * 0.1, i === 0 ? '#4a2a70' : '#2a1a48', 0.3 - i * 0.06);
      }
    });

    // Rótulos de neón con su texto.
    ctx.save();
    ctx.translate(px * 9, py * 5);
    ctx.textAlign = 'center';
    for (const c of estado.carteles) {
      const vivo = c.parpadeo ? (Math.sin(t * 7 + c.fase) > -0.55 ? 1 : 0.15) : 0.75 + 0.25 * Math.sin(t * 1.4 + c.fase);
      if (nivel.resplandores) resplandor(ctx, c.x, c.y - c.alto / 2, c.ancho * 3.4, c.color, 0.32 * vivo);
      ctx.fillStyle = rgba(c.color, 0.5 * vivo);
      ctx.fillRect(c.x - c.ancho / 2, c.y - c.alto, c.ancho, c.alto);
      ctx.fillStyle = rgba('#ffffff', 0.85 * vivo);
      ctx.font = `${Math.round(c.ancho * 0.72)}px system-ui, sans-serif`;
      const letras = [...c.texto].slice(0, Math.floor(c.alto / (c.ancho * 0.95)));
      letras.forEach((l, i) => {
        ctx.fillText(l, c.x, c.y - c.alto + (i + 0.85) * c.ancho * 0.95);
      });
    }
    ctx.restore();

    // Suelo mojado: reflejos estirados del neón.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of estado.charcos) {
      mancha(ctx, p.x + Math.sin(t * 0.4 + p.x) * 2, p.y, p.rx, p.ry, p.color, 0.2);
    }
    ctx.restore();

    // Tráfico aéreo con estela.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const n of estado.naves) {
      n.x += n.v * e.dt / 1000;
      if (n.x > w + 70) n.x = -70;
      if (n.x < -70) n.x = w + 70;
      const x = n.x + px * 16;
      const y = n.y + Math.sin(t * 0.7 + n.x * 0.01) * 3 + py * 8;
      if (nivel.estelas) {
        const g = ctx.createLinearGradient(x - Math.sign(n.v) * 52 * n.escala, y, x, y);
        g.addColorStop(0, rgba(n.color, 0));
        g.addColorStop(1, rgba(n.color, 0.5));
        ctx.fillStyle = g;
        ctx.fillRect(Math.min(x, x - Math.sign(n.v) * 52 * n.escala), y - 0.9, 52 * n.escala, 1.8);
      }
      chispa(ctx, x, y, 1.5 * n.escala, n.color, 0.95);
    }
    ctx.restore();

    // Lluvia delante de todo.
    const gotas = cuantosDe(estado.lluvia, e);
    ctx.strokeStyle = 'rgba(190,225,255,.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < gotas; i++) {
      const g2 = estado.lluvia[i];
      g2.y += g2.v * e.dt / 1000;
      g2.x -= g2.v * 0.2 * e.dt / 1000;
      if (g2.y > h) { g2.y = -20; g2.x = rnd() * (w + 140) - 70; }
      if (g2.x < -70) g2.x = w + 70;
      ctx.globalAlpha = g2.a;
      ctx.moveTo(g2.x, g2.y);
      ctx.lineTo(g2.x - g2.largo * 0.2, g2.y + g2.largo);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    festejar(ctx, e);

    vinieta(ctx, w, h, 0.4);
  },
};

/* ================================================================== */
/* ATARDECER DE NEÓN — retrowave: sol de rayas, rejilla y montañas     */
/* ================================================================== */

export const synthwave = {
  id: 'synthwave',
  nombre: 'Atardecer Neón',
  emoji: '🌅',
  familia: 'cyberpunk',
  paleta: {
    fondo: '#10032a', fondo2: '#2a0745', panel: 'rgba(32,8,58,.52)', panelAlto: 'rgba(32,8,58,.88)', panelSolido: '#240742',
    texto: '#ffeaf7', tenue: '#c69ad6', acento: '#ff4fd8', acento2: '#31e5ff',
    exito: '#4df0b0', aviso: '#ffc93c', peligro: '#ff5470', borde: 'rgba(255,79,216,.3)',
  },
  cielo: {
    amanecer: ['#2a0a4e', '#7a2a86', '#ff8a6a', '#2a0a3a'],
    dia: ['#1d0a52', '#5b2a96', '#c94fb0', '#22083a'],
    atardecer: ['#1a0340', '#7a1070', '#ff5a5a', '#2a0538'],
    noche: ['#0d0228', '#3a0a5c', '#8a1a6a', '#150330'],
  },

  crear({ w, h, rnd }) {
    const horizonte = h * 0.58;
    const montes = [
      { base: horizonte + 2, altura: h * 0.1, color: '#2a0a4a', semilla: 3, rugosidad: 90 },
      { base: horizonte + 1, altura: h * 0.17, color: '#1a0530', semilla: 11, rugosidad: 150 },
    ];
    const estrellas = Array.from({ length: 90 }, () => ({
      x: rnd() * w, y: rnd() * horizonte * 0.75, r: 0.4 + rnd() * 1.1, fase: rnd() * 10,
    }));
    const nubes = Array.from({ length: 6 }, () => ({
      x: rnd() * w, y: horizonte * (0.2 + rnd() * 0.5),
      rx: w * (0.18 + rnd() * 0.3), ry: h * (0.012 + rnd() * 0.02),
      v: 3 + rnd() * 7,
    }));
    return { horizonte, montes, estrellas, nubes, solR: Math.min(w, h) * 0.19 };
  },

  dibujar(ctx, e) {
    const { w, h, t, px, py, nivel, estado } = e;
    const { horizonte, solR } = estado;
    cieloVertical(ctx, w, h, e.cielo);

    // Estrellas altas.
    for (const s of estado.estrellas) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.fase));
      ctx.fillStyle = rgba('#ffffff', a * 0.75);
      ctx.beginPath();
      ctx.arc(s.x + px * 2, s.y + py * 2, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // El sol de rayas, el icono del género.
    const solX = w * 0.5 + px * 6;
    const solY = horizonte - solR * 0.42;
    if (nivel.resplandores) resplandor(ctx, solX, solY, solR * 3, '#ff4fd8', 0.3);
    ctx.save();
    ctx.beginPath();
    ctx.arc(solX, solY, solR, 0, Math.PI * 2);
    ctx.clip();
    const gs = ctx.createLinearGradient(0, solY - solR, 0, solY + solR);
    gs.addColorStop(0, '#ffe35a');
    gs.addColorStop(0.45, '#ff8a3c');
    gs.addColorStop(1, '#ff2f8e');
    ctx.fillStyle = gs;
    ctx.fillRect(solX - solR, solY - solR, solR * 2, solR * 2);
    // Las rayas horizontales que lo cortan, más juntas hacia abajo.
    ctx.fillStyle = rgba('#1a0340', 0.92);
    for (let i = 0; i < 9; i++) {
      const y = solY + solR * (0.06 + i * 0.115);
      ctx.fillRect(solX - solR, y, solR * 2, solR * (0.016 + i * 0.012));
    }
    ctx.restore();

    // Montañas recortadas contra el sol.
    for (const m of estado.montes) {
      ctx.save();
      ctx.translate(px * 3, 0);
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(-10, h);
      for (let x = -10; x <= w + 10; x += 7) {
        const n = ruido1D(x / m.rugosidad, m.semilla) * 0.7 + ruido1D(x / (m.rugosidad * 0.3), m.semilla + 4) * 0.3;
        ctx.lineTo(x, m.base - n * m.altura);
      }
      ctx.lineTo(w + 10, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Línea del horizonte encendida.
    if (nivel.resplandores) bruma(ctx, w, horizonte, h * 0.03, '#ff4fd8', 0.4);
    ctx.fillStyle = rgba('#ffd9f5', 0.8);
    ctx.fillRect(0, horizonte - 0.8, w, 1.6);

    // Rejilla en perspectiva que se desplaza hacia el espectador.
    ctx.save();
    ctx.globalCompositeOperation = nivel.resplandores ? 'lighter' : 'source-over';
    ctx.strokeStyle = rgba('#31e5ff', 0.5);
    ctx.lineWidth = 1;
    const fugaX = w / 2 + px * 10;
    ctx.beginPath();
    for (let i = -14; i <= 14; i++) {
      ctx.moveTo(fugaX + i * (w * 0.055), horizonte);
      ctx.lineTo(fugaX + i * w * 0.9, h + 10);
    }
    ctx.stroke();
    ctx.strokeStyle = rgba('#ff4fd8', 0.42);
    ctx.beginPath();
    const desfase = (t * 0.35) % 1;
    for (let i = 0; i < 16; i++) {
      const k = (i + desfase) / 16;
      const y = horizonte + (h - horizonte) * k * k * 1.05;
      if (y > h + 4) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();

    // Nubes finas cruzando.
    for (const n of estado.nubes) {
      n.x += n.v * e.dt / 1000;
      if (n.x - n.rx > w) n.x = -n.rx;
      mancha(ctx, n.x, n.y + py * 3, n.rx, n.ry, '#ff9ad8', 0.13);
    }

    if (nivel.factor > 0.3) barrido(ctx, w, h, 0.05);
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.42);
  },
};

/* ================================================================== */
/* LLUVIA DE CÓDIGO — matrix, con cabeza brillante y cola que muere    */
/* ================================================================== */

const GLIFOS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789=*+<>/\\'.split('');

export const matrix = {
  id: 'matrix',
  nombre: 'Lluvia de Código',
  emoji: '💾',
  familia: 'cyberpunk',
  paleta: {
    fondo: '#020806', fondo2: '#04140c', panel: 'rgba(6,26,16,.52)', panelAlto: 'rgba(6,26,16,.88)', panelSolido: '#062015',
    texto: '#d8ffe8', tenue: '#6fbf8f', acento: '#3dff88', acento2: '#9dff5e',
    exito: '#3dff88', aviso: '#e8ff5e', peligro: '#ff6b6b', borde: 'rgba(61,255,136,.24)',
  },
  cielo: {
    amanecer: ['#04180e', '#06240f', '#010805'],
    dia: ['#052012', '#083018', '#020a06'],
    atardecer: ['#04160c', '#0a2a14', '#010806'],
    noche: ['#010604', '#031409', '#000302'],
  },

  crear({ w, h, rnd }) {
    const tam = Math.max(11, Math.min(17, w / 26));
    const cols = Math.ceil(w / tam) + 1;
    const columnas = Array.from({ length: cols }, (_, i) => {
      const largo = 10 + Math.floor(rnd() * 26);
      return {
        x: i * tam + tam * 0.5,
        // Repartidas por toda la altura desde el principio: la lluvia se ve
        // llena desde el primer fotograma, no a los diez segundos.
        y: rnd() * (h + largo * tam),
        v: 55 + rnd() * 190,
        largo,
        prof: rnd(),
        // Algunas columnas son más blancas: rompe el verde plano.
        palida: rnd() > 0.78,
        glifos: Array.from({ length: 40 }, () => GLIFOS[Math.floor(rnd() * GLIFOS.length)]),
      };
    });
    return { columnas, tam, cols };
  },

  dibujar(ctx, e) {
    const rnd = e.rnd;
    const { w, h, t, py, nivel, estado } = e;
    const { tam } = estado;
    cieloVertical(ctx, w, h, e.cielo);

    // Un poco de verde ambiente para que el negro no sea un agujero.
    if (nivel.resplandores) {
      mancha(ctx, w * 0.5, h * 0.35, w * 0.85, h * 0.45, '#0aff7a', 0.055);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nCols = Math.max(6, Math.round(estado.columnas.length * Math.min(1, 0.45 + nivel.factor * 0.55)));

    for (let i = 0; i < nCols; i++) {
      const c = estado.columnas[i];
      c.y += c.v * (0.5 + c.prof * 0.9) * e.dt / 1000;
      const alturaTotal = c.largo * tam;
      if (c.y - alturaTotal > h) {
        c.y = -rnd() * h * 0.35;
        c.largo = 10 + Math.floor(rnd() * 26);
        c.v = 55 + rnd() * 190;
        c.palida = rnd() > 0.78;
      }
      // De vez en cuando muta un glifo: el detalle que da vida al código.
      if (rnd() > 1 - 0.06 * nivel.factor) {
        c.glifos[Math.floor(rnd() * c.glifos.length)] = GLIFOS[Math.floor(rnd() * GLIFOS.length)];
      }

      const escala = 0.72 + c.prof * 0.42;
      ctx.font = `${Math.round(tam * escala)}px ui-monospace, "Courier New", monospace`;
      const x = c.x + py * (2 + c.prof * 4);

      for (let k = 0; k < c.largo; k++) {
        const y = c.y - k * tam;
        if (y < -tam || y > h + tam) continue;
        const g = c.glifos[(k + i) % c.glifos.length];
        if (k === 0) {
          // La cabeza: blanca y con halo. Es lo que hace que "caiga".
          if (nivel.resplandores) resplandor(ctx, x, y, tam * 1.05, '#3dff88', 0.3);
          ctx.fillStyle = 'rgba(232,255,240,.98)';
        } else {
          const vida = 1 - k / c.largo;
          const tono = c.palida ? '#c9ffdd' : (k < 3 ? '#9dff5e' : '#3dff88');
          ctx.fillStyle = rgba(tono, vida * vida * (0.35 + c.prof * 0.6));
        }
        ctx.fillText(g, x, y);
      }
    }
    ctx.textBaseline = 'alphabetic';

    if (nivel.factor > 0.3) barrido(ctx, w, h, 0.07);
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.46);
  },
};

/* ================================================================== */
/* TÚNEL DE DATOS — matrix en 3D: anillos que vienen hacia ti          */
/* ================================================================== */

export const datos = {
  id: 'datos',
  nombre: 'Túnel de Datos',
  emoji: '🛰️',
  familia: 'cyberpunk',
  paleta: {
    fondo: '#02080f', fondo2: '#04141f', panel: 'rgba(5,22,34,.52)', panelAlto: 'rgba(5,22,34,.88)', panelSolido: '#062232',
    texto: '#dff4ff', tenue: '#7aa8c4', acento: '#2fe0ff', acento2: '#7cffd4',
    exito: '#4df0b0', aviso: '#ffd35e', peligro: '#ff6b81', borde: 'rgba(47,224,255,.26)',
  },
  cielo: {
    amanecer: ['#062030', '#03141f', '#010609'],
    dia: ['#07283a', '#041a26', '#01090d'],
    atardecer: ['#0a2036', '#051624', '#01080c'],
    noche: ['#021019', '#010a11', '#000406'],
  },

  crear({ w, h, rnd }) {
    const anillos = Array.from({ length: 18 }, (_, i) => ({
      z: i / 18,
      lados: 6 + Math.floor(rnd() * 3),
      giro: rnd() * Math.PI,
      tono: rnd() > 0.72 ? '#7cffd4' : '#2fe0ff',
    }));
    const paquetes = Array.from({ length: 30 }, () => ({
      z: rnd(), ang: rnd() * Math.PI * 2, v: 0.09 + rnd() * 0.3, color: rnd() > 0.6 ? '#ffd35e' : '#2fe0ff',
    }));
    const lineas = Array.from({ length: 26 }, () => ({
      ang: rnd() * Math.PI * 2, z: rnd(), largo: 0.05 + rnd() * 0.16, v: 0.13 + rnd() * 0.3,
    }));
    return { anillos, paquetes, lineas };
  },

  dibujar(ctx, e) {
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);
    const cx = w / 2 + px * 14;
    const cy = h * 0.42 + py * 12;
    const R = Math.max(w, h) * 0.95;
    // Perspectiva: z=0 es el fondo lejano, z=1 te pasa por la cara.
    const proy = (z) => 0.055 + Math.pow(z, 2.6) * 1.15;

    if (nivel.resplandores) resplandor(ctx, cx, cy, Math.min(w, h) * 0.5, '#2fe0ff', 0.2);

    ctx.save();
    ctx.globalCompositeOperation = nivel.resplandores ? 'lighter' : 'source-over';

    // Anillos del túnel.
    for (const a of estado.anillos) {
      a.z += 0.085 * e.dt / 1000;
      if (a.z > 1) a.z -= 1;
      const k = proy(a.z);
      const r = R * k;
      if (r < 4) continue;
      const alpha = Math.min(0.75, a.z * 0.9) * (1 - Math.max(0, a.z - 0.9) * 8);
      if (alpha <= 0) continue;
      const giro = a.giro + t * 0.06;
      trazoBrillante(ctx, (c) => {
        for (let i = 0; i <= a.lados; i++) {
          const ang = giro + (i / a.lados) * Math.PI * 2;
          const x = cx + Math.cos(ang) * r;
          const y = cy + Math.sin(ang) * r * 0.82;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
      }, a.tono, { ancho: 0.8 + a.z * 2, alpha: alpha * 0.8, halo: 7, nivel });
    }

    // Nervios longitudinales que corren hacia fuera.
    ctx.lineCap = 'round';
    for (const l of estado.lineas) {
      l.z += l.v * e.dt / 1000;
      if (l.z > 1.05) l.z -= 1.1;
      const z1 = Math.max(0, l.z);
      const z2 = Math.max(0, l.z - l.largo);
      const r1 = R * proy(z1);
      const r2 = R * proy(z2);
      const ang = l.ang + t * 0.06;
      const g = ctx.createLinearGradient(
        cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2 * 0.82,
        cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.82,
      );
      g.addColorStop(0, rgba('#2fe0ff', 0));
      g.addColorStop(1, rgba('#7cffd4', 0.5 * Math.min(1, z1 * 1.4)));
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.7 + z1 * 2.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2 * 0.82);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.82);
      ctx.stroke();
    }

    // Paquetes de datos volando hacia ti.
    const nP = cuantosDe(estado.paquetes, e);
    for (let i = 0; i < nP; i++) {
      const p = estado.paquetes[i];
      p.z += p.v * e.dt / 1000;
      if (p.z > 1) p.z -= 1;
      const r = R * proy(p.z);
      const ang = p.ang + t * 0.06;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * 0.82;
      if (x < -30 || x > w + 30 || y < -30 || y > h + 30) continue;
      chispa(ctx, x, y, 0.6 + p.z * 2.2, p.color, Math.min(1, p.z * 1.3));
    }
    ctx.restore();

    if (nivel.factor > 0.3) barrido(ctx, w, h, 0.05);
    festejar(ctx, e);
    vinieta(ctx, w, h, 0.4);
  },
};

/* ================================================================== */
/* PLACA DE CIRCUITOS — pistas de cobre con pulsos que las recorren    */
/* ================================================================== */

export const circuito = {
  id: 'circuito',
  nombre: 'Placa de Circuitos',
  emoji: '🔌',
  familia: 'cyberpunk',
  paleta: {
    fondo: '#04100f', fondo2: '#08201d', panel: 'rgba(8,32,29,.52)', panelAlto: 'rgba(8,32,29,.88)', panelSolido: '#082622',
    texto: '#dff5ee', tenue: '#7fb3a4', acento: '#2fe6c0', acento2: '#ffc65e',
    exito: '#2fe6c0', aviso: '#ffc65e', peligro: '#ff6b6b', borde: 'rgba(47,230,192,.24)',
  },
  cielo: {
    amanecer: ['#08221e', '#0b2c26', '#03100e'],
    dia: ['#0a2a24', '#0e362d', '#04140f'],
    atardecer: ['#0a221c', '#123029', '#040f0d'],
    noche: ['#040f0d', '#071b17', '#020807'],
  },

  crear({ w, h, rnd }) {
    const rejilla = 26;
    const pistas = [];
    for (let i = 0; i < 46; i++) {
      const puntos = [];
      let x = Math.round(rnd() * (w / rejilla)) * rejilla;
      let y = Math.round(rnd() * (h / rejilla)) * rejilla;
      puntos.push({ x, y });
      const pasos = 3 + Math.floor(rnd() * 6);
      for (let k = 0; k < pasos; k++) {
        if (rnd() > 0.5) x += (rnd() > 0.5 ? 1 : -1) * rejilla * (1 + Math.floor(rnd() * 3));
        else y += (rnd() > 0.5 ? 1 : -1) * rejilla * (1 + Math.floor(rnd() * 3));
        puntos.push({ x, y });
      }
      pistas.push({
        puntos,
        color: rnd() > 0.68 ? '#ffc65e' : '#2fe6c0',
        pulso: rnd(),
        v: 0.09 + rnd() * 0.3,
        activa: rnd() > 0.25,
      });
    }
    const chips = Array.from({ length: 7 }, () => ({
      x: Math.round(rnd() * (w / rejilla)) * rejilla,
      y: Math.round(rnd() * (h / rejilla)) * rejilla,
      ancho: rejilla * (2 + Math.floor(rnd() * 2)),
      alto: rejilla * (1 + Math.floor(rnd() * 2)),
      fase: rnd() * 10,
    }));
    return { pistas, chips, rejilla };
  },

  dibujar(ctx, e) {
    const { w, h, t, px, py, nivel, estado } = e;
    cieloVertical(ctx, w, h, e.cielo);
    if (nivel.resplandores) mancha(ctx, w * 0.35, h * 0.3, w * 0.7, h * 0.4, '#2fe6c0', 0.07);

    ctx.save();
    ctx.translate(px * 5, py * 4);

    // Retícula de fondo.
    ctx.strokeStyle = 'rgba(80,180,160,.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w + estado.rejilla; x += estado.rejilla) { ctx.moveTo(x, -20); ctx.lineTo(x, h + 20); }
    for (let y = 0; y < h + estado.rejilla; y += estado.rejilla) { ctx.moveTo(-20, y); ctx.lineTo(w + 20, y); }
    ctx.stroke();

    // Pistas.
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const p of estado.pistas) {
      ctx.strokeStyle = rgba(p.color, 0.2);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      p.puntos.forEach((n, i) => (i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y)));
      ctx.stroke();
      // Almohadillas en cada vértice.
      ctx.fillStyle = rgba(p.color, 0.3);
      for (const n of p.puntos) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pulsos que recorren las pistas activas: la señal viajando.
    if (nivel.factor > 0.25) {
      ctx.save();
      ctx.globalCompositeOperation = nivel.resplandores ? 'lighter' : 'source-over';
      for (const p of estado.pistas) {
        if (!p.activa) continue;
        p.pulso += p.v * e.dt / 1000;
        if (p.pulso > 1) p.pulso -= 1;
        const tramos = p.puntos.length - 1;
        const pos = p.pulso * tramos;
        const i = Math.min(tramos - 1, Math.floor(pos));
        const f = pos - i;
        const a = p.puntos[i];
        const b = p.puntos[i + 1];
        const x = a.x + (b.x - a.x) * f;
        const y = a.y + (b.y - a.y) * f;
        // Estela corta por detrás del pulso.
        if (nivel.estelas) {
          const g = ctx.createLinearGradient(a.x, a.y, x, y);
          g.addColorStop(0, rgba(p.color, 0));
          g.addColorStop(1, rgba(p.color, 0.55));
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        chispa(ctx, x, y, 1.5, p.color, 0.95);
      }
      ctx.restore();
    }

    // Chips con sus patillas.
    for (const c of estado.chips) {
      ctx.fillStyle = 'rgba(4,20,18,.9)';
      ctx.strokeStyle = 'rgba(120,220,200,.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.ancho, c.alto, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(180,230,215,.32)';
      for (let i = 0; i < Math.floor(c.ancho / 7); i++) {
        ctx.fillRect(c.x + 4 + i * 7, c.y - 3, 3, 3);
        ctx.fillRect(c.x + 4 + i * 7, c.y + c.alto, 3, 3);
      }
      const lat = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + c.fase));
      chispa(ctx, c.x + c.ancho - 5, c.y + 5, 1.1, '#ffc65e', lat);
    }
    ctx.restore();

    festejar(ctx, e);

    vinieta(ctx, w, h, 0.4);
  },
};
