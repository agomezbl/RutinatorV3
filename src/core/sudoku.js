/**
 * SUDOKU DIARIO — 9x9, generado de forma determinista a partir de la fecha.
 * Mismo puzzle para todo el mundo el mismo día, distinto cada día.
 * Cero dependencias externas y cero peticiones de red: se resuelve offline.
 */

/** PRNG determinista (mulberry32). */
function prng(semilla) {
  let a = semilla >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function semillaDeFecha(fechaKey) {
  let h = 2166136261;
  const s = String(fechaKey);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function barajar(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Patrón base válido: fila(r), columna(c) → valor. */
function patron(r, c) {
  return (3 * (r % 3) + Math.floor(r / 3) + c) % 9;
}

/** Cuadrícula completa válida, barajando bandas, filas, columnas y símbolos. */
export function cuadriculaCompleta(fechaKey) {
  const rnd = prng(semillaDeFecha(fechaKey));
  const numeros = barajar([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd);
  const bandas = barajar([0, 1, 2], rnd);
  const pilas = barajar([0, 1, 2], rnd);
  const filas = [];
  for (const b of bandas) for (const r of barajar([0, 1, 2], rnd)) filas.push(b * 3 + r);
  const cols = [];
  for (const p of pilas) for (const c of barajar([0, 1, 2], rnd)) cols.push(p * 3 + c);

  const g = [];
  for (let r = 0; r < 9; r++) {
    const fila = [];
    for (let c = 0; c < 9; c++) fila.push(numeros[patron(filas[r], cols[c])]);
    g.push(fila);
  }
  return g;
}

function esValido(g, r, c, v) {
  for (let i = 0; i < 9; i++) {
    if (g[r][i] === v || g[i][c] === v) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (g[br + i][bc + j] === v) return false;
    }
  }
  return true;
}

/** Cuenta soluciones hasta un máximo (para garantizar solución única). */
function contarSoluciones(g, max = 2) {
  let r = -1;
  let c = -1;
  for (let i = 0; i < 9 && r === -1; i++) {
    for (let j = 0; j < 9; j++) {
      if (g[i][j] === 0) { r = i; c = j; break; }
    }
  }
  if (r === -1) return 1;
  let total = 0;
  for (let v = 1; v <= 9; v++) {
    if (!esValido(g, r, c, v)) continue;
    g[r][c] = v;
    total += contarSoluciones(g, max - total);
    g[r][c] = 0;
    if (total >= max) break;
  }
  return total;
}

export const DIFICULTADES = {
  facil: { etiqueta: 'Fácil', huecos: 40 },
  medio: { etiqueta: 'Medio', huecos: 48 },
  dificil: { etiqueta: 'Difícil', huecos: 54 },
};

/**
 * Puzzle del día. Devuelve { tablero, solucion, pistas, dificultad }.
 * `tablero` usa 0 para las casillas vacías.
 */
export function puzzleDelDia(fechaKey, dificultad = 'medio') {
  const solucion = cuadriculaCompleta(fechaKey);
  const rnd = prng(semillaDeFecha(`${fechaKey}#${dificultad}`));
  const objetivo = (DIFICULTADES[dificultad] || DIFICULTADES.medio).huecos;
  const tablero = solucion.map((f) => f.slice());

  const posiciones = barajar(
    Array.from({ length: 81 }, (_, i) => i).filter((i) => i < 41),
    rnd,
  );

  let huecos = 0;
  for (const p of posiciones) {
    if (huecos >= objetivo) break;
    const r = Math.floor(p / 9);
    const c = p % 9;
    const r2 = 8 - r;
    const c2 = 8 - c;
    const guardados = [tablero[r][c], tablero[r2][c2]];
    if (guardados[0] === 0 && guardados[1] === 0) continue;
    tablero[r][c] = 0;
    tablero[r2][c2] = 0;
    const copia = tablero.map((f) => f.slice());
    if (contarSoluciones(copia, 2) !== 1) {
      tablero[r][c] = guardados[0];
      tablero[r2][c2] = guardados[1];
    } else {
      huecos += (r === r2 && c === c2) ? 1 : 2;
    }
  }

  return {
    fecha: fechaKey,
    dificultad,
    tablero,
    solucion,
    huecos,
    pistas: 81 - huecos,
  };
}

/** Comprueba un tablero jugado contra la solución. */
export function comprobar(tablero, solucion) {
  let correctas = 0;
  let erroneas = 0;
  let vacias = 0;
  const errores = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = tablero[r][c];
      if (!v) { vacias++; continue; }
      if (v === solucion[r][c]) correctas++;
      else { erroneas++; errores.push([r, c]); }
    }
  }
  return { correctas, erroneas, vacias, errores, resuelto: vacias === 0 && erroneas === 0 };
}
