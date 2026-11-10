/**
 * Pruebas de lo añadido en la v3.1: segunda moneda, stakings, sueño,
 * hábitos de cuidado, tokenomics y escenas de los temas.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readdir, readFile } from 'node:fs/promises';

import { crearStore } from '../src/core/store.js';
import { catalogoInicial } from '../src/core/defaults.js';
import { saldoSemana, saldoHucha, saldoEstrellas, serieHucha } from '../src/core/ledger.js';
import {
  marcarTarea, aprobarMarca, vetarMarca, evaluarObligatoria, desmarcarTarea,
  ajusteManual, marcaDe, tareasDelDia, monedaDeTarea, seAutoAprueba,
} from '../src/core/tasks.js';
import {
  abrirDeposito, romperDeposito, procesarStakings, abonarInteresHucha,
  abrirApuesta, resolverApuestasTrasCierre, abrirStakingSueno,
  registrarNocheEnStaking, capitalBloqueado, patrimonio, stakingsActivos,
  puedeAbrirDeposito, puedeApostar, porcentajeDePlazo, resumenStaking,
} from '../src/core/staking.js';
import {
  registrarSueno, registroSueno, rachaSueno, mediaSueno, consejos,
  minutosNocturnos, nochesEntre,
} from '../src/core/circadian.js';
import {
  habitosDelDia, resumenDia, rejilla, rachaDiasCompletos, comentarios, marcaHabito,
} from '../src/core/health.js';
import { validarParametro, simular, GRUPOS, CAMPOS_POR_ID, leerParametro } from '../src/core/tokenomics.js';
import { cerrarSemana } from '../src/core/week.js';
import { valorTareaEn } from '../src/core/economy.js';
import { solicitarCompra, aprobarCompra } from '../src/core/leisure.js';
import {
  momentoDelDia, TEMAS, MOMENTOS, ESCENAS, ESCENAS_POR_ID, FAMILIAS, ALIAS,
  idReal, tema, escenaDe, variablesTema, fondoDeRespaldo, CALIDADES,
} from '../src/themes/themes.js';
import { NIVELES, ORDEN_NIVELES, ORDEN_AUTO, prng, semillaDe } from '../src/themes/motor.js';
import {
  barrasCategoria, barrasDia, areaEvolucion, barrasGanadoGastado,
  graficaNoches, rejillaHabitos, aroObjetivo,
} from '../src/ui/charts.js';
import { addDays } from '../src/core/util.js';

const LUNES = '2026-09-07';
const MARTES = '2026-09-08';
const SABADO = '2026-09-12';

function nuevoStore() { return crearStore(catalogoInicial()); }
function darCreditos(s, fecha, cantidad, cuenta = 'semana') {
  ajusteManual(s, { cantidad, motivo: 'saldo de prueba', fecha, cuenta });
}

/* ====================== SEGUNDA MONEDA: ESTRELLAS ====================== */

test('las estrellas son una cuenta aparte y no se mezclan con los créditos', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 50, 'semana');
  darCreditos(s, LUNES, 7, 'estrellas');
  assert.equal(saldoSemana(s.estado, LUNES), 50);
  assert.equal(saldoEstrellas(s.estado), 7);
  assert.equal(saldoHucha(s.estado), 0);
});

test('una tarea obligatoria da estrellas al aprobarse, nunca créditos', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_dientes_m' });
  const marca = marcaDe(s.estado, LUNES, 't_dientes_m');
  assert.equal(saldoEstrellas(s.estado), 0, 'todavía no, está pendiente');
  aprobarMarca(s, marca.id);
  assert.equal(saldoEstrellas(s.estado), 1);
  assert.equal(saldoSemana(s.estado, LUNES), 0, 'ni un crédito');
});

test('vetar una obligatoria ya aprobada devuelve las estrellas', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 't_ducha' });
  const marca = marcaDe(s.estado, LUNES, 't_ducha');
  aprobarMarca(s, marca.id);
  assert.equal(saldoEstrellas(s.estado), 1);
  evaluarObligatoria(s, marca.id, false, 'no se duchó');
  assert.equal(saldoEstrellas(s.estado), 0);
  assert.equal(s.obtener('marcas', marca.id).estado, 'nocumplida');
});

test('los hábitos de cuidado se aprueban solos y pagan en estrellas', () => {
  const s = nuevoStore();
  const r = marcarTarea(s, { fecha: LUNES, tareaId: 'h_agua' });
  assert.equal(r.ok, true);
  assert.equal(r.moneda, 'estrellas');
  assert.equal(r.autoAprobada, true);
  assert.equal(marcaDe(s.estado, LUNES, 'h_agua').estado, 'aprobada');
  assert.equal(saldoEstrellas(s.estado), 1);
  assert.equal(saldoSemana(s.estado, LUNES), 0);
});

test('los hábitos no aparecen entre las tareas de casa ni cuentan en el cumplimiento', () => {
  const s = nuevoStore();
  const ids = tareasDelDia(s.estado, LUNES).map((t) => t.id);
  assert.ok(!ids.includes('h_agua'));
  assert.ok(habitosDelDia(s.estado).some((h) => h.id === 'h_agua'));
});

test('completar todos los hábitos del día da el premio, y solo una vez', () => {
  const s = nuevoStore();
  const habitos = habitosDelDia(s.estado);
  for (const h of habitos) marcarTarea(s, { fecha: LUNES, tareaId: h.id });
  const esperado = habitos.length * 1 + 3; // 1 por hábito + premio de día completo
  assert.equal(saldoEstrellas(s.estado), esperado);
  assert.equal(resumenDia(s.estado, LUNES).completo, true);

  // Desmarcar y volver a marcar no vuelve a pagar el premio.
  const ultima = marcaDe(s.estado, LUNES, habitos[0].id);
  desmarcarTarea(s, ultima.id);
  marcarTarea(s, { fecha: LUNES, tareaId: habitos[0].id });
  assert.equal(saldoEstrellas(s.estado), esperado);
});

test('el multiplicador de créditos nunca toca las estrellas', () => {
  const s = nuevoStore();
  s.fijarAjuste('multiplicadorValor', 3);
  s.fijarAjuste('multiplicadorAmbito', 'siempre');
  assert.equal(valorTareaEn(s.estado, s.estado.tareas.h_agua, LUNES), 1);
  assert.equal(valorTareaEn(s.estado, s.estado.tareas.t_cama, LUNES), 6);
  assert.equal(monedaDeTarea(s.estado.tareas.h_agua), 'estrellas');
  assert.equal(seAutoAprueba(s.estado.tareas.h_agua), true);
});

test('un regalo físico se paga con estrellas y no con créditos', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 500, 'semana');
  const sinEstrellas = solicitarCompra(s, { itemId: 'e_semillas', fecha: LUNES, hora: '17:00' });
  assert.equal(sinEstrellas.ok, false);
  assert.match(sinEstrellas.razon, /estrellas/);

  darCreditos(s, LUNES, 12, 'estrellas');
  const r = solicitarCompra(s, { itemId: 'e_semillas', fecha: LUNES, hora: '17:00' });
  assert.equal(r.ok, true);
  assert.equal(saldoEstrellas(s.estado), 2);
  assert.equal(saldoSemana(s.estado, LUNES), 500, 'los créditos ni se tocan');
});

/* ============================== STAKINGS =============================== */

test('depósito a plazo: bloquea, vence y paga el interés', () => {
  const s = nuevoStore();
  s.fijarAjuste('interesHuchaPct', 0); // aislamos el depósito del interés automático
  darCreditos(s, LUNES, 200, 'hucha');
  const r = abrirDeposito(s, { capital: 100, dias: 30, fecha: LUNES });
  assert.equal(r.ok, true);
  assert.equal(saldoHucha(s.estado), 100, 'la hucha libre baja al bloquear');
  assert.equal(capitalBloqueado(s.estado), 100);
  assert.equal(patrimonio(s.estado), 200, 'el total no cambia: solo se mueve');

  // Antes de vencer no pasa nada.
  procesarStakings(s, { fecha: addDays(LUNES, 29) });
  assert.equal(s.obtener('stakings', r.id).estado, 'activo');

  procesarStakings(s, { fecha: addDays(LUNES, 30) });
  const st = s.obtener('stakings', r.id);
  assert.equal(st.estado, 'cobrado');
  assert.equal(st.interesPagado, 12); // 12 % a 30 días
  assert.equal(saldoHucha(s.estado), 212);
  assert.equal(capitalBloqueado(s.estado), 0);
});

test('romper un depósito devuelve el capital pero no el interés', () => {
  const s = nuevoStore();
  s.fijarAjuste('interesHuchaPct', 0);
  darCreditos(s, LUNES, 100, 'hucha');
  const r = abrirDeposito(s, { capital: 60, dias: 14, fecha: LUNES });
  const rot = romperDeposito(s, r.id, { fecha: addDays(LUNES, 3) });
  assert.equal(rot.ok, true);
  assert.equal(rot.devuelto, 60);
  assert.equal(saldoHucha(s.estado), 100);
  assert.equal(s.obtener('stakings', r.id).estado, 'roto');
  // Y vencido ya no paga nada.
  procesarStakings(s, { fecha: addDays(LUNES, 20) });
  assert.equal(saldoHucha(s.estado), 100);
});

test('no se puede bloquear más de lo que hay en la hucha libre', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 50, 'hucha');
  assert.equal(puedeAbrirDeposito(s.estado, { capital: 80, dias: 7 }).ok, false);
  assert.equal(puedeAbrirDeposito(s.estado, { capital: 5, dias: 7 }).ok, false, 'por debajo del mínimo');
  assert.equal(puedeAbrirDeposito(s.estado, { capital: 40, dias: 7 }).ok, true);
  assert.equal(porcentajeDePlazo(s.estado, 7), 2);
});

test('los depósitos se pueden desactivar desde el panel', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 200, 'hucha');
  s.fijarAjuste('depositoActivo', false);
  assert.equal(abrirDeposito(s, { capital: 50, dias: 7, fecha: LUNES }).ok, false);
});

test('el interés de la hucha se abona una vez por periodo', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 300, 'hucha');
  s.fijarAjuste('interesHuchaPct', 2);
  s.fijarAjuste('interesHuchaPeriodo', 'semana');
  const a = abonarInteresHucha(s, { fecha: LUNES });
  assert.equal(a.ok, true);
  assert.equal(a.interes, 6);
  assert.equal(saldoHucha(s.estado), 306);
  assert.equal(abonarInteresHucha(s, { fecha: MARTES }).ok, false, 'misma semana: no repite');
  const otra = abonarInteresHucha(s, { fecha: addDays(LUNES, 7) });
  assert.equal(otra.ok, true);
});

test('el interés respeta el tope por abono', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 5000, 'hucha');
  s.fijarAjuste('interesHuchaPct', 5);
  s.fijarAjuste('interesHuchaTope', 25);
  const a = abonarInteresHucha(s, { fecha: LUNES });
  assert.equal(a.interes, 25);
});

test('apuesta de racha: se gana manteniendo la racha las semanas pactadas', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 100, 'hucha');
  const r = abrirApuesta(s, { capital: 40, semanas: 2, fecha: LUNES });
  assert.equal(r.ok, true);
  assert.equal(saldoHucha(s.estado), 60);

  resolverApuestasTrasCierre(s, { subioRacha: true, fecha: LUNES });
  assert.equal(s.obtener('stakings', r.id).semanasSuperadas, 1);
  assert.equal(s.obtener('stakings', r.id).estado, 'activo');

  resolverApuestasTrasCierre(s, { subioRacha: true, fecha: addDays(LUNES, 7) });
  const st = s.obtener('stakings', r.id);
  assert.equal(st.estado, 'cobrado');
  assert.equal(saldoHucha(s.estado), 60 + 64); // 40 x 1.6
});

test('apuesta de racha: al romper la racha se pierde el porcentaje configurado', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 100, 'hucha');
  const r = abrirApuesta(s, { capital: 40, semanas: 3, fecha: LUNES });
  resolverApuestasTrasCierre(s, { subioRacha: false, fecha: LUNES });
  const st = s.obtener('stakings', r.id);
  assert.equal(st.estado, 'roto');
  assert.equal(st.perdido, 20); // 50 %
  assert.equal(saldoHucha(s.estado), 80);
});

test('la apuesta tiene tope y solo se admite una a la vez', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 500, 'hucha');
  assert.equal(puedeApostar(s.estado, { capital: 500 }).ok, false, 'por encima del tope');
  abrirApuesta(s, { capital: 20, semanas: 1, fecha: LUNES });
  assert.equal(puedeApostar(s.estado, { capital: 20 }).ok, false, 'ya hay una abierta');
});

test('staking de sueño: paga por noche cumplida y no castiga las falladas', () => {
  const s = nuevoStore();
  s.fijarAjuste('interesHuchaPct', 0);
  darCreditos(s, LUNES, 200, 'hucha');
  const r = abrirStakingSueno(s, { capital: 100, fecha: LUNES });
  assert.equal(r.ok, true);
  assert.equal(r.noches, 7);
  for (let i = 0; i < 7; i++) {
    registrarNocheEnStaking(s, { fecha: addDays(LUNES, i), cumplida: i < 4 });
  }
  procesarStakings(s, { fecha: addDays(LUNES, 8) });
  const st = s.obtener('stakings', r.id);
  assert.equal(st.nochesCumplidas, 4);
  assert.equal(st.estado, 'cobrado');
  assert.equal(st.interesPagado, 6); // 100 * 1.5 % * 4
  assert.equal(saldoHucha(s.estado), 206); // 100 que quedaron libres + 100 + 6
});

test('una misma noche no se cuenta dos veces en el staking de sueño', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 100, 'hucha');
  const r = abrirStakingSueno(s, { capital: 50, fecha: LUNES });
  registrarNocheEnStaking(s, { fecha: LUNES, cumplida: true });
  registrarNocheEnStaking(s, { fecha: LUNES, cumplida: true });
  assert.equal(s.obtener('stakings', r.id).nochesCumplidas, 1);
});

test('el cierre de semana paga el bonus de racha y resuelve la apuesta', () => {
  const s = nuevoStore();
  s.fijarAjuste('umbralRacha', 1);
  darCreditos(s, LUNES, 100, 'hucha');
  const ap = abrirApuesta(s, { capital: 20, semanas: 1, fecha: LUNES });
  marcarTarea(s, { fecha: LUNES, tareaId: 't_cama' });
  const r = cerrarSemana(s, { fecha: LUNES });
  assert.equal(r.subioRacha, true);
  assert.equal(r.bonoRacha, 20);
  assert.equal(r.apuestas[0].resultado, 'ganada');
  assert.equal(s.obtener('stakings', ap.id).estado, 'cobrado');
});

/* =============================== SUEÑO ================================= */

test('apuntar la hora de dormir dentro del margen da el bonus', () => {
  const s = nuevoStore();
  const r = registrarSueno(s, { fecha: LUNES, hora: '22:40' }); // objetivo 22:30 + 15 min
  assert.equal(r.ok, true);
  assert.equal(r.cumplida, true);
  assert.equal(r.bono, 2);
  assert.equal(saldoSemana(s.estado, LUNES), 2);
  assert.equal(registroSueno(s.estado, LUNES).cumplida, true);
});

test('pasarse del margen no da bonus, pero tampoco quita nada', () => {
  const s = nuevoStore();
  const r = registrarSueno(s, { fecha: LUNES, hora: '23:30' });
  assert.equal(r.cumplida, false);
  assert.equal(saldoSemana(s.estado, LUNES), 0);
});

test('la madrugada cuenta como la noche anterior, no como la mañana', () => {
  assert.ok(minutosNocturnos('00:30') > minutosNocturnos('23:00'));
  const s = nuevoStore();
  const r = registrarSueno(s, { fecha: SABADO, hora: '00:40' }); // objetivo finde 23:45
  assert.equal(r.cumplida, false, 'las 00:40 es más tarde que las 23:45, no más pronto');
});

test('la racha de noches suma y paga el bonus extra cada N noches', () => {
  const s = nuevoStore();
  let bonus = 0;
  for (let i = 0; i < 5; i++) {
    const r = registrarSueno(s, { fecha: addDays(LUNES, i), hora: '22:20' });
    bonus += r.bonusRacha;
  }
  assert.equal(rachaSueno(s.estado, addDays(LUNES, 4)), 5);
  assert.equal(bonus, 15, 'el premio de racha salta a la quinta noche');
  assert.equal(saldoHucha(s.estado), 15, 'y va a la hucha, no al saldo semanal');
});

test('una noche fallada corta la racha', () => {
  const s = nuevoStore();
  registrarSueno(s, { fecha: LUNES, hora: '22:20' });
  registrarSueno(s, { fecha: MARTES, hora: '23:59' });
  registrarSueno(s, { fecha: addDays(LUNES, 2), hora: '22:20' });
  assert.equal(rachaSueno(s.estado, addDays(LUNES, 2)), 1);
});

test('no se puede apuntar dos veces la misma noche, salvo corrigiendo', () => {
  const s = nuevoStore();
  registrarSueno(s, { fecha: LUNES, hora: '22:20' });
  assert.equal(registrarSueno(s, { fecha: LUNES, hora: '23:00' }).ok, false);
  const r = registrarSueno(s, { fecha: LUNES, hora: '23:59', forzar: true });
  assert.equal(r.ok, true);
  assert.equal(r.cumplida, false);
  assert.equal(saldoSemana(s.estado, LUNES), 0, 'el bonus anterior se anula');
  assert.equal(Object.keys(s.estado.ledger).length, 2, 'nada se borra: se anula');
});

test('la media de sueño sale de las noches apuntadas', () => {
  const s = nuevoStore();
  registrarSueno(s, { fecha: LUNES, hora: '22:00' });
  registrarSueno(s, { fecha: MARTES, hora: '23:00' });
  const media = mediaSueno(s.estado, MARTES, 14, '07:00');
  assert.equal(media, 8.5); // 9 h y 8 h
  assert.equal(nochesEntre(s.estado, LUNES, MARTES).length, 2);
});

test('los consejos cambian según la hora y lo que ha pasado', () => {
  const s = nuevoStore();
  const antes = consejos(s.estado, LUNES, '20:50');
  assert.ok(antes.some((c) => c.id === 'corte-cerca'), 'avisa antes del corte');
  const despues = consejos(s.estado, LUNES, '21:30');
  assert.ok(despues.some((c) => c.id === 'corte-pasado'));
  for (let i = 0; i < 3; i++) registrarSueno(s, { fecha: addDays(LUNES, i), hora: '22:10' });
  const conRacha = consejos(s.estado, addDays(LUNES, 3), '18:00');
  assert.ok(conRacha.some((c) => c.id === 'racha-sueno'));
  assert.ok(conRacha.every((c) => c.titulo && c.texto));
});

/* ========================= SALUD Y RITMO NATURAL ======================= */

test('el apartado de salud mide presencias, nunca el cuerpo', () => {
  const s = nuevoStore();
  const habitos = habitosDelDia(s.estado);
  assert.ok(habitos.length >= 5);
  const texto = JSON.stringify(habitos).toLowerCase();
  for (const prohibido of ['peso', 'kilo', 'caloría', 'caloria', 'dieta', 'adelgaz', 'grasa', 'imc']) {
    assert.ok(!texto.includes(prohibido), `el catálogo de hábitos menciona "${prohibido}"`);
  }
  // Tampoco hay comida entre los premios que se compran con estrellas.
  const premios = Object.values(s.estado.tienda).filter((a) => a.moneda === 'estrellas');
  assert.ok(premios.length > 0);
  const textoPremios = JSON.stringify(premios).toLowerCase();
  for (const prohibido of ['postre', 'chuche', 'golosina', 'helado', 'pizza']) {
    assert.ok(!textoPremios.includes(prohibido), `hay comida como premio: "${prohibido}"`);
  }
});

test('el resumen del día y la racha de días completos', () => {
  const s = nuevoStore();
  const habitos = habitosDelDia(s.estado);
  assert.equal(resumenDia(s.estado, LUNES).hechos, 0);
  marcarTarea(s, { fecha: LUNES, tareaId: habitos[0].id });
  assert.equal(resumenDia(s.estado, LUNES).hechos, 1);
  assert.equal(resumenDia(s.estado, LUNES).completo, false);
  for (const h of habitos) marcarTarea(s, { fecha: LUNES, tareaId: h.id });
  assert.equal(resumenDia(s.estado, LUNES).completo, true);
  assert.equal(rachaDiasCompletos(s.estado, LUNES), 1);
});

test('la rejilla de hábitos tiene un día por columna y un hábito por fila', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 'h_agua' });
  const r = rejilla(s.estado, LUNES, 14);
  assert.equal(r.fechas.length, 14);
  assert.equal(r.celdas.length, habitosDelDia(s.estado).length);
  const fila = r.celdas.find((c) => c.habito.id === 'h_agua');
  assert.equal(fila.dias[13].hecho, true);
  assert.equal(fila.dias[0].hecho, false);
});

test('los comentarios de salud no hablan del cuerpo', () => {
  const s = nuevoStore();
  const c = comentarios(s.estado, LUNES);
  const texto = JSON.stringify(c).toLowerCase();
  for (const prohibido of ['peso', 'caloría', 'caloria', 'dieta', 'gordo', 'delgado']) {
    assert.ok(!texto.includes(prohibido));
  }
});

/* ============================= TOKENOMICS ============================== */

test('cada parámetro de tokenomics valida sus límites de verdad', () => {
  assert.equal(validarParametro('umbralRacha', 5).ok, false, 'por debajo del mínimo');
  assert.equal(validarParametro('umbralRacha', 500).ok, false);
  assert.equal(validarParametro('umbralRacha', 80).valor, 80);
  assert.equal(validarParametro('interesHuchaPct', 1.5).valor, 1.5);
  assert.equal(validarParametro('interesHuchaPct', 'hola').ok, false);
  assert.equal(validarParametro('pcLibreFinde', true).valor, true);
  assert.equal(validarParametro('cenaEntreSemana', '25:00').ok, false);
  assert.equal(validarParametro('cenaEntreSemana', '20:45').valor, '20:45');
  assert.equal(validarParametro('multiplicadorAmbito', 'inventado').ok, false);
  assert.equal(validarParametro('multiplicadorAmbito', 'finde').valor, 'finde');
  assert.equal(validarParametro('nombreEstrellas', '   ').ok, false);
  assert.equal(validarParametro('noExiste', 1).ok, false);
});

test('todos los campos declarados tienen una etiqueta y un tipo conocido', () => {
  const tipos = ['numero', 'decimal', 'texto', 'bool', 'hora', 'opcion'];
  for (const g of GRUPOS) {
    assert.ok(g.titulo && g.resumen, `el grupo ${g.id} necesita título y resumen`);
    for (const c of g.campos) {
      assert.ok(c.etiqueta, `${c.id} sin etiqueta`);
      assert.ok(tipos.includes(c.tipo), `${c.id} tiene un tipo raro: ${c.tipo}`);
      if (c.tipo === 'opcion') assert.ok((c.opciones || []).length >= 2);
    }
  }
  assert.ok(Object.keys(CAMPOS_POR_ID).length >= 30);
});

test('los parámetros del panel existen de verdad en los ajustes por defecto', () => {
  const s = nuevoStore();
  for (const id of Object.keys(CAMPOS_POR_ID)) {
    assert.notEqual(leerParametro(s.estado, id, undefined), undefined, `falta el ajuste ${id}`);
  }
});

test('la simulación avisa cuando la economía no deja ahorrar', () => {
  const s = nuevoStore();
  const dias = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(LUNES, i));
  const base = simular(s.estado, { tareasDelDiaFn: tareasDelDia, diasMuestra: dias });
  assert.ok(base.ganadoSemana > 0);
  assert.ok(base.sobrante > 0, 'el catálogo de fábrica sí deja margen');

  // Si se encarecen los bonos, el sobrante se hunde.
  s.patch('tienda', 'b_tv', { precio: 60 });
  s.patch('tienda', 'b_anime', { precio: 60 });
  s.patch('tienda', 'b_movil', { precio: 60 });
  s.patch('tienda', 'b_pc', { precio: 60 });
  const caro = simular(s.estado, { tareasDelDiaFn: tareasDelDia, diasMuestra: dias });
  assert.ok(caro.sobrante < base.sobrante);
});

/* ========================== TEMAS Y ESCENAS ============================ */

/**
 * Lienzo de mentira: jsdom no sabe dibujar, así que aquí se anota cada
 * llamada y se comprueba que ninguna coordenada sale rara (NaN, infinito)
 * y que ningún color queda a medias. Es la forma de probar quince escenas
 * enteras sin abrir un navegador.
 */
function contextoDeMentira() {
  const fallos = [];
  const cuenta = { fill: 0, stroke: 0, fillRect: 0, gradientes: 0, formas: 0 };
  let llamada = '';

  const mira = (v) => {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      fallos.push(`${llamada}: número no finito (${v})`);
    }
  };
  const miraColor = (v) => {
    const s = String(v);
    if (s.includes('NaN') || s.includes('undefined') || s.includes('Infinity')) {
      fallos.push(`${llamada}: color roto (${s})`);
    }
  };

  const degradado = () => ({
    addColorStop(p, c) {
      llamada = 'addColorStop';
      mira(p);
      miraColor(c);
      if (p < 0 || p > 1) fallos.push(`addColorStop fuera de rango (${p})`);
    },
  });

  const metodos = {
    beginPath: 'formas', closePath: null, save: null, restore: null,
    moveTo: null, lineTo: null, arc: null, ellipse: null, rect: null,
    quadraticCurveTo: null, bezierCurveTo: null, roundRect: null,
    translate: null, rotate: null, scale: null, setTransform: null,
    clearRect: null, clip: null, fillText: null, strokeText: null,
    setLineDash: null, drawImage: null, arcTo: null, transform: null,
  };

  const ctx = {
    canvas: { width: 390, height: 844 },
    measureText: () => ({ width: 10 }),
    createLinearGradient(...a) { llamada = 'createLinearGradient'; a.forEach(mira); cuenta.gradientes++; return degradado(); },
    createRadialGradient(...a) { llamada = 'createRadialGradient'; a.forEach(mira); cuenta.gradientes++; return degradado(); },
    createPattern() { return null; },
    fill(...a) { llamada = 'fill'; a.forEach(mira); cuenta.fill++; },
    stroke(...a) { llamada = 'stroke'; a.forEach(mira); cuenta.stroke++; },
    fillRect(...a) { llamada = 'fillRect'; a.forEach(mira); cuenta.fillRect++; },
    strokeRect(...a) { llamada = 'strokeRect'; a.forEach(mira); },
  };

  for (const nombre of Object.keys(metodos)) {
    ctx[nombre] = (...a) => {
      llamada = nombre;
      a.forEach(mira);
      if (metodos[nombre]) cuenta[metodos[nombre]]++;
    };
  }

  for (const prop of ['fillStyle', 'strokeStyle', 'shadowColor']) {
    let valor = '#000';
    Object.defineProperty(ctx, prop, {
      get: () => valor,
      set: (v) => { llamada = prop; valor = v; if (typeof v === 'string') miraColor(v); },
    });
  }
  for (const prop of ['lineWidth', 'globalAlpha', 'shadowBlur', 'miterLimit']) {
    let valor = 1;
    Object.defineProperty(ctx, prop, {
      get: () => valor,
      set: (v) => { llamada = prop; valor = v; mira(v); if (prop === 'globalAlpha' && (v < 0 || v > 1)) fallos.push(`globalAlpha fuera de rango (${v})`); },
    });
  }
  for (const prop of ['globalCompositeOperation', 'lineCap', 'lineJoin', 'font', 'textAlign', 'textBaseline', 'filter']) {
    ctx[prop] = prop === 'globalCompositeOperation' ? 'source-over' : '';
  }

  return { ctx, fallos, cuenta };
}

/** Un fotograma de una escena contra el lienzo de mentira. */
function dibujaEscena(escena, momento, { t = 4, nivel = NIVELES.alta, w = 390, h = 844, veces = 1 } = {}) {
  const { ctx, fallos, cuenta } = contextoDeMentira();
  const rnd = prng(semillaDe(`${escena.id}|prueba`));
  const rndAnim = prng(semillaDe(`${escena.id}|anim`));
  const estado = escena.crear ? escena.crear({ w, h, rnd, nivel, momento }) : {};
  for (let i = 0; i < veces; i++) {
    escena.dibujar(ctx, {
      t: t + i * 0.7, dt: 16, w, h, px: (i % 3) - 1, py: 1 - (i % 3),
      nivel, momento, cielo: escena.cielo[momento], estado, quieto: false,
      rnd: rndAnim,
      acento: escena.paleta.acento2 || escena.paleta.acento,
      // La mitad de los fotogramas se piden en plena celebración: el destello
      // se dibuja encima de todo y tiene que aguantar igual.
      festejo: i % 2 === 0 ? 0 : 1 - (i / Math.max(1, veces)),
    });
  }
  return { fallos, cuenta, estado };
}

test('el momento del día se reparte en cuatro tramos', () => {
  assert.equal(momentoDelDia(new Date(2026, 8, 7, 7, 0)), 'amanecer');
  assert.equal(momentoDelDia(new Date(2026, 8, 7, 12, 0)), 'dia');
  assert.equal(momentoDelDia(new Date(2026, 8, 7, 19, 0)), 'atardecer');
  assert.equal(momentoDelDia(new Date(2026, 8, 7, 23, 0)), 'noche');
  assert.equal(momentoDelDia(new Date(2026, 8, 7, 3, 0)), 'noche');
});

test('el catálogo tiene diecisiete escenas completas y de familias variadas', () => {
  assert.equal(ESCENAS.length, 17);
  assert.equal(TEMAS.length, ESCENAS.length);
  const ids = new Set();
  for (const s of ESCENAS) {
    assert.ok(s.id && !ids.has(s.id), `id repetido o ausente: ${s.id}`);
    ids.add(s.id);
    assert.ok(s.nombre && s.emoji, `${s.id} sin nombre o emoji`);
    assert.equal(typeof s.crear, 'function', `${s.id} no construye su escena`);
    assert.equal(typeof s.dibujar, 'function', `${s.id} no se dibuja`);
    for (const m of MOMENTOS) {
      assert.ok(Array.isArray(s.cielo[m]) && s.cielo[m].length >= 2, `${s.id} no tiene cielo de ${m}`);
    }
    for (const c of ['fondo', 'panel', 'texto', 'acento', 'exito', 'aviso', 'peligro', 'borde']) {
      assert.ok(s.paleta[c], `${s.id} no define el color ${c}`);
    }
  }
  const familias = new Set(ESCENAS.map((s) => FAMILIAS[s.familia]));
  for (const f of ['Cyberpunk', 'Ciencia y biología', 'Universo', 'Naturaleza']) {
    assert.ok(familias.has(f), `falta la familia ${f}`);
  }
  // Pidió varias de estilo cyberpunk/matrix, no una: se comprueba que sigan ahí.
  const ciber = ESCENAS.filter((s) => s.familia === 'cyberpunk');
  assert.ok(ciber.length >= 5, `solo hay ${ciber.length} escenas cyberpunk`);
});

test('todas las escenas dibujan varios fotogramas sin romperse, en los cuatro momentos', () => {
  for (const escena of ESCENAS) {
    for (const m of MOMENTOS) {
      const { fallos, cuenta } = dibujaEscena(escena, m, { veces: 3 });
      assert.deepEqual(fallos.slice(0, 3), [], `${escena.id}/${m}: ${fallos[0]}`);
      assert.ok(
        cuenta.fill + cuenta.stroke + cuenta.fillRect > 20,
        `${escena.id}/${m} pinta demasiado poco (${cuenta.fill + cuenta.stroke + cuenta.fillRect} trazos)`,
      );
      assert.ok(cuenta.gradientes > 0, `${escena.id}/${m} no usa ni un degradado: se verá plano`);
    }
  }
});

test('las escenas aguantan pantallas raras, muy estrechas y muy anchas', () => {
  for (const escena of ESCENAS) {
    for (const [w, h] of [[280, 480], [1280, 700], [390, 390]]) {
      const { fallos } = dibujaEscena(escena, 'noche', { w, h });
      assert.deepEqual(fallos.slice(0, 2), [], `${escena.id} a ${w}x${h}: ${fallos[0]}`);
    }
  }
});

test('bajar la calidad quita trabajo de verdad y apagado no anima', () => {
  for (const escena of ESCENAS) {
    const alta = dibujaEscena(escena, 'noche', { nivel: NIVELES.alta }).cuenta;
    const baja = dibujaEscena(escena, 'noche', { nivel: NIVELES.baja }).cuenta;
    const trazos = (c) => c.fill + c.stroke + c.fillRect + c.formas;
    assert.ok(trazos(baja) < trazos(alta), `${escena.id} no aligera en calidad baja`);
    const { fallos } = dibujaEscena(escena, 'dia', { nivel: NIVELES.apagado });
    assert.deepEqual(fallos.slice(0, 2), [], `${escena.id} falla con la animación apagada`);
  }
  assert.equal(NIVELES.apagado.factor, 0);
  assert.ok(NIVELES.alta.dpr >= NIVELES.baja.dpr);
});

test('la misma escena se dibuja igual siempre: nada de azar sin semilla', () => {
  for (const escena of ESCENAS) {
    const construir = () => {
      const rnd = prng(semillaDe(`${escena.id}|prueba`));
      return JSON.stringify(escena.crear({ w: 390, h: 844, rnd, nivel: NIVELES.alta, momento: 'noche' }));
    };
    assert.equal(construir(), construir(), `${escena.id} cambia entre construcciones`);
    // Y diez fotogramas después, dos partidas idénticas siguen coincidiendo.
    const a = JSON.stringify(dibujaEscena(escena, 'noche', { veces: 10 }).estado);
    const b = JSON.stringify(dibujaEscena(escena, 'noche', { veces: 10 }).estado);
    assert.equal(a, b, `${escena.id} se desvía al animar`);
  }
});

test('ninguna escena usa azar sin semilla dentro de un fotograma', async () => {
  const dir = new URL('../src/themes/escenas/', import.meta.url);
  for (const f of await readdir(dir)) {
    const texto = await readFile(new URL(f, dir), 'utf8');
    assert.ok(!texto.includes('Math.random'), `${f} usa Math.random: la escena no sería reproducible`);
  }
});

test('los temas antiguos siguen funcionando y uno inventado no deja la app en gris', () => {
  for (const [viejo, nuevo] of Object.entries(ALIAS)) {
    assert.equal(idReal(viejo), nuevo);
    assert.ok(escenaDe(viejo), `el tema antiguo ${viejo} no resuelve`);
  }
  assert.ok(ESCENAS_POR_ID[idReal('loquesea')], 'un tema desconocido debe caer en uno válido');
  assert.equal(tema('cosmos').id, 'nebulosa');
});

test('cada tema deja la interfaz vestida y con degradado de respaldo', () => {
  for (const t of TEMAS) {
    const vars = variablesTema(t.id);
    for (const v of ['--fondo', '--panel', '--texto', '--acento', '--borde']) {
      assert.ok(vars.includes(`${v}:`), `${t.id} no define ${v}`);
    }
    assert.ok(!vars.includes('undefined'), `${t.id} tiene una variable vacía`);
    for (const m of MOMENTOS) {
      const g = fondoDeRespaldo(t.id, m);
      assert.ok(g.startsWith('linear-gradient('), `${t.id}/${m} sin respaldo`);
      assert.ok(!g.includes('undefined'), `${t.id}/${m} respaldo roto`);
    }
  }
  assert.ok(fondoDeRespaldo('bosque', 'inventado').startsWith('linear-gradient('));
});

test('ninguna escena pide nada a internet', async () => {
  const dir = new URL('../src/themes/escenas/', import.meta.url);
  for (const f of await readdir(dir)) {
    const texto = await readFile(new URL(f, dir), 'utf8');
    assert.ok(!/https?:\/\//.test(texto), `${f} apunta fuera de la app`);
    assert.ok(!/fetch\(|XMLHttpRequest|new Image\(/.test(texto), `${f} carga algo de fuera`);
  }
});

test('las calidades que puede elegir Nil existen todas en el motor', () => {
  assert.deepEqual(CALIDADES.map((c) => c.id), ['auto', 'alta', 'media', 'baja', 'apagado']);
  for (const c of CALIDADES) {
    assert.ok(c.etiqueta && c.ayuda, `la calidad ${c.id} no se explica`);
    if (c.id !== 'auto') assert.ok(NIVELES[c.id], `la calidad ${c.id} no tiene nivel`);
  }
  assert.deepEqual(ORDEN_NIVELES, ['alta', 'media', 'baja', 'apagado']);
  // La calidad automática nunca congela el fondo sola: apagarlo lo decide Nil.
  assert.deepEqual(ORDEN_AUTO, ['alta', 'media', 'baja']);
  assert.ok(!ORDEN_AUTO.includes('apagado'));
});

/* ============================== GRÁFICAS =============================== */

function pintaSVG(html) {
  const dom = new JSDOM(`<div id="c">${html}</div>`);
  const nodo = dom.window.document.getElementById('c');
  const salida = {
    svgs: nodo.querySelectorAll('svg').length,
    textos: [...nodo.querySelectorAll('text')].map((t) => t.textContent),
    html: nodo.innerHTML,
  };
  dom.window.close();
  return salida;
}

test('las gráficas producen SVG válido y etiquetan los valores', () => {
  const cat = pintaSVG(barrasCategoria([
    { etiqueta: 'Mañana', icono: '🌅', color: '#d95926', valor: 12 },
    { etiqueta: 'Tarde', icono: '🏠', color: '#3987e5', valor: 20 },
  ]));
  assert.match(cat.html, /Mañana/);
  assert.match(cat.html, /20/);

  const dias = pintaSVG(barrasDia(
    [{ etiqueta: 'Lun', valor: 80 }, { etiqueta: 'Mar', valor: 40 }], { umbral: 70 },
  ));
  assert.equal(dias.svgs, 1);
  assert.ok(dias.textos.includes('80'));
  assert.ok(dias.textos.some((t) => t.includes('objetivo')));

  const area = pintaSVG(areaEvolucion([
    { fecha: '2026-09-01', valor: 10 }, { fecha: '2026-09-02', valor: 30 },
    { fecha: '2026-09-03', valor: 25 },
  ]));
  assert.equal(area.svgs, 1);
  assert.ok(area.textos.includes('25'), 'etiqueta el último valor');

  const gg = pintaSVG(barrasGanadoGastado([{ etiqueta: '07/09', ganado: 30, gastado: 12 }]));
  assert.match(gg.html, /Ganado/);
  assert.match(gg.html, /Gastado/);
});

test('la gráfica de noches marca el objetivo y distingue las cumplidas', () => {
  const noches = [
    { fecha: '2026-09-07', registro: { hora: '22:10', cumplida: true }, minutosNocturnos: 1330 },
    { fecha: '2026-09-08', registro: { hora: '23:40', cumplida: false }, minutosNocturnos: 1420 },
    { fecha: '2026-09-09', registro: null, minutosNocturnos: null },
  ];
  const r = pintaSVG(graficaNoches(noches, { objetivoMin: 1350, margen: 15 }));
  assert.equal(r.svgs, 1);
  assert.ok(r.textos.includes('22:30'), 'rotula la hora objetivo');
  assert.match(r.html, /var\(--exito\)/);
  assert.match(r.html, /var\(--aviso\)/);
});

test('la rejilla de hábitos y el aro de progreso se pintan', () => {
  const s = nuevoStore();
  marcarTarea(s, { fecha: LUNES, tareaId: 'h_agua' });
  const r = pintaSVG(rejillaHabitos(rejilla(s.estado, LUNES, 7)));
  assert.match(r.html, /gh-celda/);
  assert.match(r.html, /si/);
  const aro = pintaSVG(aroObjetivo(42, { centro: '42%', abajo: 'de hoy' }));
  assert.equal(aro.svgs, 1);
  assert.match(aro.html, /42%/);
});

test('las gráficas aguantan quedarse sin datos', () => {
  for (const html of [
    barrasCategoria([]), barrasDia([]), areaEvolucion([]),
    barrasGanadoGastado([]), graficaNoches([], { objetivoMin: 1350 }),
    rejillaHabitos({ habitos: [], fechas: [], celdas: [] }),
  ]) {
    assert.equal(typeof html, 'string');
    assert.ok(html.length > 0);
    assert.ok(!html.includes('undefined'), `hay un hueco sin rellenar: ${html.slice(0, 80)}`);
    assert.ok(!html.includes('NaN'), `hay un NaN: ${html.slice(0, 80)}`);
  }
});

test('la serie de la hucha rellena todos los días, también los que no hay movimiento', () => {
  const s = nuevoStore();
  darCreditos(s, LUNES, 40, 'hucha');
  darCreditos(s, addDays(LUNES, 3), 10, 'hucha');
  const serie = serieHucha(s.estado, LUNES, addDays(LUNES, 5));
  assert.equal(serie.length, 6);
  assert.equal(serie[0].valor, 40);
  assert.equal(serie[2].valor, 40);
  assert.equal(serie[3].valor, 50);
  assert.equal(serie[5].valor, 50);
});
