/**
 * El asistente de primer uso, paso a paso.
 *
 * Seis pantallas, una pregunta por pantalla. Está escrito para que lo pase un
 * padre o una madre en tres minutos, de pie, con el móvil en una mano: nada de
 * formularios largos, todo con valores puestos de antemano, y un botón de
 * "saltar" visible desde el principio porque obligar a nadie a rellenar un
 * cuestionario para ver una app es la forma más rápida de que la cierre.
 *
 * Como el resto de la interfaz, TODO dato que escriba una persona pasa por
 * esc()/escAttr() antes de entrar en el HTML.
 */

import { esc, escAttr } from './dom.js';
import {
  BLOQUES, OCIO, EXTRAS, DIAS_SEMANA, TRATAMIENTOS, resumenDeConfiguracion,
} from '../core/onboarding.js';

export const PASOS = ['bienvenida', 'nombre', 'colegio', 'horas', 'bloques', 'ocio', 'juego', 'listo'];

function barraPasos(indice) {
  return `<div class="asis-pasos" aria-hidden="true">
    ${PASOS.map((_, i) => `<span class="${i <= indice ? 'hecho' : ''}"></span>`).join('')}
  </div>`;
}

function casilla({ grupo, id, marcado, emoji, etiqueta, ayuda }) {
  return `
    <label class="asis-opcion ${marcado ? 'sel' : ''}">
      <input type="checkbox" data-grupo="${escAttr(grupo)}" value="${escAttr(id)}" ${marcado ? 'checked' : ''}>
      <span class="em" aria-hidden="true">${esc(emoji)}</span>
      <span class="txt">
        <b>${esc(etiqueta)}</b>
        ${ayuda ? `<span class="ay">${esc(ayuda)}</span>` : ''}
      </span>
    </label>`;
}

/* ==================================================================== */
/* LOS PASOS                                                             */
/* ==================================================================== */

const CUERPOS = {
  bienvenida: () => `
    <h1>Bienvenido a Rutineitor</h1>
    <p class="asis-entrada">
      Es una app de tareas de casa para un hijo o una hija, con una economía de
      créditos detrás: hace cosas, gana créditos, se los gasta en ratos de ocio
      o los ahorra para algo grande.
    </p>
    <p>
      Viene con un catálogo completo ya montado. En tres minutos lo dejamos a la
      medida de vuestra casa: el nombre, los horarios y qué partes queréis usar.
      Todo esto se puede cambiar después, siempre.
    </p>
    <p class="mini tenue">
      Los datos se quedan en este móvil. No se envía nada a ningún sitio salvo
      que configures tú la sincronización, que es opcional.
    </p>`,

  nombre: (d) => `
    <h1>¿De quién es la app?</h1>
    <p class="asis-entrada">El nombre que verá en su pantalla.</p>
    <label class="campo">
      <span>Su nombre</span>
      <input type="text" data-campo="nombre" maxlength="24" autocomplete="off"
        value="${escAttr(d.nombre)}" placeholder="Nil">
    </label>
    <label class="campo">
      <span>¿Quién aprueba las tareas?</span>
      <select data-campo="tratamiento">
        ${TRATAMIENTOS.map((t) => `
          <option value="${escAttr(t)}" ${d.tratamiento === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
    </label>
    <p class="mini tenue">
      Es solo cómo le habla la app cuando algo está pendiente de aprobar.
    </p>`,

  colegio: (d) => `
    <h1>El colegio</h1>
    <p class="asis-entrada">
      Sirve para una cosa concreta: mientras está en clase, la app no le deja
      empezar un rato de ocio.
    </p>
    <label class="fila sep" style="padding:8px 0">
      <span>Va al colegio</span>
      <input type="checkbox" data-campo="hayColegio" ${d.hayColegio ? 'checked' : ''}>
    </label>
    <div data-si-colegio ${d.hayColegio ? '' : 'hidden'}>
      <div class="asis-dias">
        ${DIAS_SEMANA.map((dia) => `
          <label class="asis-dia ${(d.diasColegio || []).includes(dia.i) ? 'sel' : ''}">
            <input type="checkbox" data-grupo="diasColegio" value="${dia.i}"
              ${(d.diasColegio || []).includes(dia.i) ? 'checked' : ''}
              aria-label="${escAttr(dia.largo)}">
            <span aria-hidden="true">${esc(dia.corto)}</span>
          </label>`).join('')}
      </div>
      <div class="rejilla dos">
        <label class="campo"><span>Entra a las</span>
          <input type="time" data-campo="entradaColegio" value="${escAttr(d.entradaColegio)}">
        </label>
        <label class="campo"><span>Sale a las</span>
          <input type="time" data-campo="salidaColegio" value="${escAttr(d.salidaColegio)}">
        </label>
      </div>
    </div>`,

  horas: (d) => `
    <h1>Las horas de casa</h1>
    <p class="asis-entrada">
      Con esto la app sabe cuándo recordarle las cosas de la noche, y cuándo
      darle el pequeño extra por acostarse a su hora.
    </p>
    <label class="campo"><span>Cena entre semana</span>
      <input type="time" data-campo="cenaEntreSemana" value="${escAttr(d.cenaEntreSemana)}">
    </label>
    <label class="campo"><span>A dormir entre semana</span>
      <input type="time" data-campo="dormirEntreSemana" value="${escAttr(d.dormirEntreSemana)}">
    </label>
    <label class="campo"><span>A dormir el fin de semana</span>
      <input type="time" data-campo="dormirFinde" value="${escAttr(d.dormirFinde)}">
    </label>
    <p class="mini tenue">
      No son alarmas ni castigos: si se pasa de la hora no pierde nada, solo no
      cobra el extra de esa noche.
    </p>`,

  bloques: (d) => `
    <h1>¿Qué queréis trabajar?</h1>
    <p class="asis-entrada">
      Quita lo que en vuestra casa no sea un tema. Poner tareas que nadie va a
      marcar es la forma más rápida de que la app se abandone.
    </p>
    ${BLOQUES.map((b) => casilla({
    grupo: 'bloques',
    id: b.id,
    marcado: (d.bloques || []).includes(b.id),
    emoji: b.emoji,
    etiqueta: b.etiqueta,
    ayuda: b.ayuda,
  })).join('')}
    <p class="mini tenue">
      Lo que quites no se borra: se queda apartado y lo puedes recuperar cuando
      quieras desde el panel.
    </p>`,

  ocio: (d) => `
    <h1>¿Qué ocio hay en casa?</h1>
    <p class="asis-entrada">
      Son las cosas que podrá "comprar" con sus créditos. Lo que no marques no
      aparecerá en su tienda.
    </p>
    ${OCIO.map((o) => casilla({
    grupo: 'ocio',
    id: o.id,
    marcado: (d.ocio || []).includes(o.id),
    emoji: o.emoji,
    etiqueta: o.etiqueta,
    ayuda: '',
  })).join('')}
    <p class="mini tenue">
      Los premios grandes (los que se pagan con la hucha) no dependen de esto:
      esos los pones tú después, en el panel.
    </p>`,

  juego: (d) => `
    <h1>La parte de juego</h1>
    <p class="asis-entrada">
      Esto es lo que hace que no se canse a las tres semanas. Puedes empezar sin
      nada y encenderlo más adelante.
    </p>
    ${EXTRAS.map((e) => casilla({
    grupo: 'juego',
    id: e.id,
    marcado: (d.juego || []).includes(e.id),
    emoji: e.emoji,
    etiqueta: e.etiqueta,
    ayuda: e.ayuda,
  })).join('')}`,

  listo: (d, ctx) => `
    <h1>Todo listo</h1>
    <p class="asis-entrada">Así va a quedar:</p>
    <ul class="asis-resumen">
      ${resumenDeConfiguracion(ctx.estado, d).map((l) => `<li>${esc(l)}</li>`).join('')}
    </ul>
    <p class="mini tenue">
      Lo siguiente será elegir tu clave del panel, la primera vez que entres en
      él. Y todo lo de aquí se puede cambiar después en
      <b>Panel → Sistema → Volver a configurar</b>.
    </p>`,
};

/* ==================================================================== */
/* LA PANTALLA                                                           */
/* ==================================================================== */

export function vistaAsistente(ctx) {
  const { paso, datos, error } = ctx.asistente;
  const i = PASOS.indexOf(paso);
  const primero = i === 0;
  const ultimo = i === PASOS.length - 1;

  return `
    <div class="asistente">
      <div class="asis-tarjeta">
        ${barraPasos(i)}
        <div class="asis-cuerpo">${CUERPOS[paso](datos, ctx)}</div>
        ${error ? `<p class="asis-error" role="alert">${esc(error)}</p>` : ''}
        <div class="asis-botones">
          ${primero ? '' : '<button class="btn fantasma" data-accion="asis-atras">Atrás</button>'}
          <button class="btn crece" data-accion="${ultimo ? 'asis-terminar' : 'asis-siguiente'}">
            ${esc(ultimo ? 'Listo, empezamos' : (primero ? 'Empezar' : 'Siguiente'))}
          </button>
        </div>
        <button class="asis-saltar" data-accion="asis-saltar">
          Saltar y dejarlo como viene de fábrica
        </button>
      </div>
    </div>`;
}
