/**
 * Vistas de Nil. Cada vista devuelve HTML; la interacción va por
 * atributos data-accion que resuelve app.js. Todo dato de usuario pasa por
 * esc()/escAttr().
 */

import {
  esc, escAttr, anilloProgreso, barra, vacio, dato,
} from './dom.js';
import {
  formatoFechaLarga, formatoFechaCorta, nombreDia, nombreDiaCorto, weekdayIndex,
  minutosDeHora, horaActual, toDateKey, addDays, fromDateKey, nombreMes, textoDuracion,
} from '../core/util.js';
import { saldoCreditos, saldoHucha, saldoProvisional, saldoEstrellas } from '../core/ledger.js';
import { tiendaPausada } from '../core/gestion.js';
import {
  tareasDelDia, marcaDe, cumplimientoDia, cumplimientoSemana, rachaActual, umbralRacha,
} from '../core/tasks.js';
import { estadoObjetivo, precioEfectivo, valorTareaEn } from '../core/economy.js';
import {
  puedeComprar, ocioDeHoy, sesionPcAbierta, puedeUsarPc, minutosPcDe, modoBuhoActivo,
} from '../core/leisure.js';
import {
  bloquesDeDia, HORA_INICIO_REJILLA, HORA_FIN_REJILLA, TIPOS_BLOQUE, bloqueActual,
} from '../core/schedule.js';
import {
  rejillaMes, eventosDeFecha, proximosEventos, COLORES_EVENTO,
} from '../core/calendar.js';
import { objetivosDe, proximoHito, horasDeSuenoPrevistas, evaluacionSueno, EXPLICACION } from '../core/circadian.js';
import { CATEGORIAS } from '../core/defaults.js';
import { CALIDADES } from '../themes/themes.js';
import { selectorTemas } from './views-juego.js';

/* =============================== TAREAS ================================= */

export function vistaTareas(ctx) {
  const { estado, hoy, ui } = ctx;
  const fecha = ui.fechaTareas || hoy;
  const tareas = tareasDelDia(estado, fecha);
  const esHoy = fecha === hoy;
  const grupos = {};
  for (const t of tareas) (grupos[t.categoria] = grupos[t.categoria] || []).push(t);

  const orden = ['manana', 'preparacion', 'tarde', 'noche', 'semanal', 'puntual', 'otros'];
  const cumple = cumplimientoDia(estado, fecha);

  return `
    <div class="tarjeta compacta">
      <div class="fila sep">
        <button class="btn pequeno fantasma" data-accion="dia-tareas" data-delta="-1" aria-label="Día anterior">←</button>
        <div class="centro crece">
          <div style="font-weight:700">${esc(esHoy ? 'Hoy' : formatoFechaLarga(fecha))}</div>
          <div class="mini tenue">${cumple.cumplidas}/${cumple.esperadas} · ${cumple.pct}%</div>
        </div>
        <button class="btn pequeno fantasma" data-accion="dia-tareas" data-delta="1" aria-label="Día siguiente"
          ${fecha >= hoy ? 'disabled' : ''}>→</button>
      </div>
      <div style="margin-top:8px">${barra(cumple.pct)}</div>
    </div>

    ${tareas.length === 0 ? vacio('No hay tareas para este día.', '🎉') : ''}

    ${orden.filter((k) => grupos[k]).map((k) => {
      const cat = CATEGORIAS[k] || CATEGORIAS.otros;
      return `
        <div class="grupo-titulo">${esc(cat.icono)} ${esc(cat.etiqueta)}</div>
        <div class="tarjeta compacta">
          ${grupos[k].map((t) => filaTarea(ctx, t, fecha)).join('')}
        </div>`;
    }).join('')}
  `;
}

function filaTarea(ctx, tarea, fecha) {
  const { estado } = ctx;
  const marca = marcaDe(estado, fecha, tarea.id);
  const hecha = marca && (marca.estado === 'aprobada' || marca.estado === 'pendiente');
  const vetada = marca && (marca.estado === 'vetada' || marca.estado === 'nocumplida');
  const valor = valorTareaEn(estado, tarea, fecha, tarea.tipo === 'eleccion' ? (tarea.opciones?.[0]?.id) : null);
  const esObligatoria = tarea.tipo === 'obligatoria';

  let meta = '';
  if (marca) {
    if (marca.estado === 'pendiente') meta = 'Esperando a que papá lo revise';
    else if (marca.estado === 'aprobada') {
      meta = marca.autoAprobada ? 'Aprobada automáticamente' : 'Aprobada';
      if (marca.nota) meta = `Papá: “${marca.nota}”`;
    }
    else if (marca.estado === 'vetada') meta = `Vetada${marca.motivo ? `: ${marca.motivo}` : ''}`;
    else if (marca.estado === 'nocumplida') meta = `No cumplida${marca.motivo ? `: ${marca.motivo}` : ''}`;
    if (marca.opcionEtiqueta) meta = `${marca.opcionEtiqueta} · ${meta}`;
  } else if (tarea.tipo === 'eleccion') {
    meta = (tarea.opciones || []).map((o) => `${o.etiqueta} (${o.valor})`).join(' · ');
  } else if (esObligatoria) {
    meta = 'Obligatoria: no da créditos, pero cuenta';
  }

  const etiquetaValor = esObligatoria ? 'obligatoria'
    : tarea.tipo === 'eleccion' && !marca ? `${Math.min(...(tarea.opciones || [{ valor: 0 }]).map((o) => o.valor))}-${Math.max(...(tarea.opciones || [{ valor: 0 }]).map((o) => o.valor))}`
    : `+${marca ? marca.valor : valor}`;

  return `
    <div class="tarea ${hecha ? 'hecha' : ''} ${vetada ? 'vetada' : ''} ${esObligatoria ? 'obligatoria' : ''}">
      <button class="marcar ${hecha ? 'on' : ''}"
        data-accion="${hecha ? 'desmarcar' : 'marcar'}"
        data-tarea="${escAttr(tarea.id)}" data-fecha="${escAttr(fecha)}"
        aria-label="${escAttr(hecha ? 'Quitar la marca de' : 'Marcar')} ${escAttr(tarea.nombre)}">
        ${hecha ? '✓' : ''}
      </button>
      <span class="ic" aria-hidden="true">${esc(tarea.icono || '•')}</span>
      <div class="crece">
        <div class="nom">${esc(tarea.nombre)}</div>
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
        ${(marca?.fotos || []).length ? `<div class="miniaturas">${marca.fotos.map((f, i) => `
          <img src="${escAttr(f)}" alt="Foto ${i + 1} de ${escAttr(tarea.nombre)}" data-accion="ver-foto" data-src-idx="${i}" data-marca="${escAttr(marca.id)}">
        `).join('')}</div>` : ''}
      </div>
      <div class="val">${esc(etiquetaValor)}</div>
      ${!marca ? `<button class="btn pequeno fantasma" data-accion="foto-tarea"
        data-tarea="${escAttr(tarea.id)}" data-fecha="${escAttr(fecha)}" aria-label="Añadir foto">📷</button>` : ''}
    </div>`;
}

/* =============================== HORARIO ================================ */

export function vistaHorario(ctx) {
  const { estado, hoy, modo } = ctx;
  const horas = [];
  for (let h = HORA_INICIO_REJILLA; h <= HORA_FIN_REJILLA; h++) horas.push(h);
  const totalMin = (HORA_FIN_REJILLA - HORA_INICIO_REJILLA + 1) * 60;
  const altoFila = 26;
  const diaHoy = weekdayIndex(hoy);

  const columnas = [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const bloques = bloquesDeDia(estado, d);
    return `<div class="celda-dia" style="position:relative;grid-column:${d + 2};grid-row:2 / span ${horas.length}">
      ${bloques.map((b) => {
        const ini = minutosDeHora(b.inicio) ?? 0;
        const fin = minutosDeHora(b.fin) ?? 0;
        const top = ((ini - HORA_INICIO_REJILLA * 60) / totalMin) * (horas.length * altoFila);
        const alto = Math.max(18, ((fin - ini) / totalMin) * (horas.length * altoFila) - 2);
        const color = (TIPOS_BLOQUE[b.tipo] || TIPOS_BLOQUE.rutina).color;
        return `<div class="bloque-h" style="top:${top.toFixed(1)}px;height:${alto.toFixed(1)}px;background:${escAttr(color)}"
          data-accion="editar-bloque" data-bloque="${escAttr(b.id)}" role="button" tabindex="0"
          title="${escAttr(`${b.titulo} · ${b.inicio}-${b.fin}`)}">
          ${esc(b.titulo)}<br><span style="opacity:.8">${esc(b.inicio)}</span>
          ${b.bloqueaOcio ? ' 🔒' : ''}${b.requierePreparacion ? ' 🎒' : ''}
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  return `
    <div class="tarjeta compacta">
      <div class="fila sep">
        <div>
          <h2 style="margin:0">Horario semanal</h2>
          <p class="mini tenue" style="margin:2px 0 0">Se repite todas las semanas. 🔒 bloquea el ocio · 🎒 genera tarea de preparación.</p>
        </div>
        <button class="btn pequeno principal" data-accion="nuevo-bloque">+ Bloque</button>
      </div>
    </div>

    <div class="tarjeta compacta horario-scroll">
      <div class="rejilla-horario">
        <div class="cab" style="grid-column:1;grid-row:1"></div>
        ${[0, 1, 2, 3, 4, 5, 6].map((d) => `<div class="cab" style="grid-column:${d + 2};grid-row:1;${d === diaHoy ? 'color:var(--acento)' : ''}">${esc(nombreDiaCorto(d))}</div>`).join('')}
        ${horas.map((h, i) => `
          <div class="hora" style="grid-column:1;grid-row:${i + 2};height:${altoFila}px">${String(h).padStart(2, '0')}</div>
          ${[0, 1, 2, 3, 4, 5, 6].map((d) => `<div class="celda" style="grid-column:${d + 2};grid-row:${i + 2};height:${altoFila}px"></div>`).join('')}
        `).join('')}
        ${columnas}
      </div>
    </div>

    <div class="tarjeta compacta">
      <p class="mini tenue" style="margin:0">
        ${modo === 'padre'
          ? 'Como padre puedes corregir cualquier bloque, aunque lo haya puesto Nil.'
          : 'Puedes editarlo tú mismo: toca un bloque para cambiarlo.'}
      </p>
    </div>`;
}

/* ============================= CALENDARIO =============================== */

export function vistaCalendario(ctx) {
  const { estado, hoy, ui } = ctx;
  const sel = ui.fechaCalendario || hoy;
  const d = fromDateKey(sel);
  const anio = ui.anioCalendario ?? d.getFullYear();
  const mes = ui.mesCalendario ?? d.getMonth();
  const celdas = rejillaMes(anio, mes);
  const eventosDia = eventosDeFecha(estado, sel);

  return `
    <div class="tarjeta compacta">
      <div class="fila sep">
        <button class="btn pequeno fantasma" data-accion="mes" data-delta="-1" aria-label="Mes anterior">←</button>
        <div class="centro crece" style="font-weight:700">${esc(nombreMes(mes))} ${anio}</div>
        <button class="btn pequeno fantasma" data-accion="mes" data-delta="1" aria-label="Mes siguiente">→</button>
      </div>
    </div>

    <div class="tarjeta compacta">
      <div class="mes">
        ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="dow">${esc(nombreDiaCorto(i))}</div>`).join('')}
        ${celdas.map((c) => {
          const evs = eventosDeFecha(estado, c.fecha);
          return `<button class="dia-mes ${c.delMes ? '' : 'fuera'} ${c.fecha === hoy ? 'hoy' : ''} ${c.fecha === sel ? 'sel' : ''}"
            data-accion="dia-calendario" data-fecha="${escAttr(c.fecha)}">
            ${fromDateKey(c.fecha).getDate()}
            ${evs.length ? `<span class="puntos">${evs.slice(0, 3).map((e) => `<i style="background:${escAttr(e.color)}"></i>`).join('')}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>

    <div class="tarjeta">
      <div class="fila sep" style="margin-bottom:10px">
        <h2 style="margin:0">${esc(formatoFechaLarga(sel))}</h2>
        <button class="btn pequeno principal" data-accion="nuevo-evento" data-fecha="${escAttr(sel)}">+ Cita</button>
      </div>
      ${eventosDia.length ? eventosDia.map((e) => `
        <div class="evento">
          <span class="cinta" style="background:${escAttr(e.color)}"></span>
          <div class="crece">
            <div style="font-weight:600">${esc(e.titulo)}</div>
            <div class="mini tenue">${e.hora ? `${esc(e.hora)}` : 'Todo el día'}${e.recordatorio ? ' · 🔔 aviso 5 min antes' : ''}</div>
            ${e.notas ? `<div class="mini" style="margin-top:3px">${esc(e.notas)}</div>` : ''}
          </div>
          <button class="btn pequeno fantasma" data-accion="editar-evento" data-evento="${escAttr(e.id)}" aria-label="Editar">✏️</button>
        </div>`).join('')
        : vacio('Nada apuntado este día.', '🗓️')}
    </div>

    <div class="tarjeta compacta">
      <p class="mini tenue" style="margin:0">
        El calendario es distinto del horario: aquí van citas con fecha concreta
        (un cumpleaños, el dentista) y no se borran nunca al cerrar la semana.
      </p>
    </div>`;
}

/* =============================== TIENDA ================================= */

export function vistaTienda(ctx) {
  const { estado, hoy } = ctx;
  const articulos = Object.values(estado.tienda || {}).filter((a) => a.activo !== false);
  const semana = articulos.filter((a) => (a.moneda || 'semana') === 'semana').sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const hucha = articulos.filter((a) => a.moneda === 'hucha').sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const conEstrellas = articulos.filter((a) => a.moneda === 'estrellas').sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const objetivoId = estado.ajustes?.objetivoAhorroId?.valor || null;
  const sesion = sesionPcAbierta(estado);
  const pc = puedeUsarPc(estado, hoy, horaActual());

  return `
    <div class="tarjeta compacta">
      <div class="rejilla tres">
        ${dato(saldoCreditos(estado, hoy), 'Créditos')}
        ${dato(saldoHucha(estado), 'Hucha')}
        ${dato(saldoEstrellas(estado), 'Estrellas')}
      </div>
      ${tiendaPausada(estado) ? '<p class="mini" style="color:var(--aviso);margin:8px 0 0">⏸️ La tienda está en pausa ahora mismo. Tus créditos siguen ahí.</p>' : ''}
    </div>

    ${estado.ajustes?.avisoTiendaVisto?.valor ? '' : `
    <div class="tarjeta aviso-familias" role="note">
      <h2 style="margin:0 0 4px">💡 Para las familias</h2>
      <p class="mini" style="margin:0">Estos premios, textos, precios y tiempos son <b>ejemplos para empezar</b>.
        Adaptadlos a vuestro hijo en <b>Más → 🔐 Panel de papá → Catálogo → Tienda</b>:</p>
      <ul class="mini" style="margin:6px 0 0;padding-left:18px">
        <li><b>✏️</b> en cada premio cambia el nombre, la descripción, el precio, el tiempo, la moneda y el tope por semana.</li>
        <li><b>＋</b> añade premios vuestros.</li>
        <li>Desmarcar <b>«Visible en la tienda»</b> lo oculta sin borrarlo; <b>％</b> sube o baja todos los precios a la vez.</li>
      </ul>
      <div class="fila" style="justify-content:flex-end;margin-top:8px">
        <button class="btn pequeno" data-accion="aviso-tienda-visto">Entendido</button>
      </div>
    </div>`}

    <div class="tarjeta">
      <div class="fila sep" style="margin-bottom:6px">
        <h2 style="margin:0">🖥️ PC</h2>
        <span class="mini tenue">${minutosPcDe(estado, hoy)} min hoy</span>
      </div>
      ${sesion
        ? `<div class="fila sep">
             <span class="chip ok">Sesión abierta desde las ${esc(new Date(sesion.inicio).toTimeString().slice(0, 5))}</span>
             <button class="btn peligro pequeno" data-accion="parar-pc">Parar</button>
           </div>
           <p class="mini tenue" style="margin:8px 0 0">Se cobra por bloques de ${esc(String(estado.ajustes?.pcBloqueMinutos?.valor ?? 30))} min empezados.</p>`
        : `<div class="fila sep">
             <span class="mini ${pc.ok ? 'tenue' : ''}">${esc(pc.ok ? 'Puedes empezar cuando quieras.' : pc.razon)}</span>
             <button class="btn principal pequeno" data-accion="iniciar-pc" ${pc.ok ? '' : 'disabled'}>Empezar</button>
           </div>`}
    </div>

    <div class="seccion-tienda"><h2 style="margin:0">Con mis créditos</h2>
      <p class="mini tenue" style="margin:2px 0 0">Bonos de ocio y premios del día a día.</p></div>
    <div class="tarjeta compacta">
      ${semana.map((a) => filaArticulo(ctx, a)).join('') || vacio('Nada por aquí.')}
    </div>

    <div class="seccion-tienda hucha"><h2 style="margin:0">Con la hucha</h2>
      <p class="mini tenue" style="margin:2px 0 0">Premios grandes: varias semanas de ahorro real.</p></div>
    <div class="tarjeta compacta">
      ${hucha.map((a) => filaArticulo(ctx, a, objetivoId)).join('') || vacio('Nada por aquí.')}
    </div>

    <div class="seccion-tienda estrellas"><h2 style="margin:0">Con las estrellas</h2>
      <p class="mini tenue" style="margin:2px 0 0">Regalos físicos. Las estrellas se ganan cuidándote y tratando bien, y no se mezclan con los créditos.</p></div>
    <div class="tarjeta compacta">
      ${conEstrellas.map((a) => filaArticulo(ctx, a)).join('') || vacio('Nada por aquí.')}
    </div>`;
}

function filaArticulo(ctx, articulo, objetivoId = null) {
  const { estado, hoy } = ctx;
  const check = puedeComprar(estado, articulo, hoy, horaActual());
  const precio = precioEfectivo(articulo);
  const esObjetivo = objetivoId === articulo.id;
  return `
    <div class="articulo ${check.ok ? '' : 'no'}">
      <span class="ic" aria-hidden="true">${esc(articulo.icono || '🎁')}</span>
      <div class="crece">
        <div style="font-weight:600">${esc(articulo.nombre)}${textoDuracion(articulo.duracion) ? ` <span class="chip tiempo" aria-label="Duración: ${escAttr(textoDuracion(articulo.duracion))}">⏱ ${esc(textoDuracion(articulo.duracion))}</span>` : ''}${esObjetivo ? ' <span class="chip">🎯 objetivo</span>' : ''}</div>
        <div class="mini tenue">${esc(articulo.descripcion || '')}</div>
        ${!check.ok ? `<div class="mini" style="color:var(--aviso)">${esc(check.razon)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div class="precio">${precio}${articulo.moneda === 'estrellas' ? ' ⭐' : ''}</div>
        <button class="btn pequeno ${check.ok ? 'principal' : ''}" data-accion="comprar"
          data-articulo="${escAttr(articulo.id)}" ${check.ok ? '' : 'disabled'}>Pedir</button>
        ${articulo.moneda === 'hucha' ? `<button class="btn pequeno fantasma" style="margin-top:4px"
          data-accion="fijar-objetivo" data-articulo="${escAttr(articulo.id)}">${esObjetivo ? 'Quitar' : 'Objetivo'}</button>` : ''}
      </div>
    </div>`;
}

/* ================================ JUEGO ================================= */

export function vistaJuego(ctx) {
  const { ui, hoy } = ctx;
  const j = ui.sudoku;
  if (!j) return '<div class="tarjeta">Cargando…</div>';
  const sel = ui.sudokuSel;

  return `
    <div class="tarjeta compacta">
      <div class="fila sep">
        <div>
          <h2 style="margin:0">Sudoku del día</h2>
          <p class="mini tenue" style="margin:2px 0 0">${esc(formatoFechaLarga(hoy))} · ${esc(j.dificultad)} · el mismo para todos hoy</p>
        </div>
        <button class="btn pequeno fantasma" data-accion="reiniciar-sudoku">Reiniciar</button>
      </div>
    </div>

    <div class="tarjeta">
      <div class="sudoku">
        ${j.tablero.map((fila, r) => fila.map((v, c) => {
          const fija = j.fijas[r][c];
          const esSel = sel && sel[0] === r && sel[1] === c;
          const err = v && !fija && v !== j.solucion[r][c] && ui.sudokuComprobado;
          const bordes = (c % 3 === 2 && c !== 8) || (r % 3 === 2 && r !== 8);
          return `<button class="${fija ? 'fija' : ''} ${esSel ? 'sel' : ''} ${err ? 'err' : ''} ${bordes ? 'bx' : ''}"
            data-accion="celda-sudoku" data-r="${r}" data-c="${c}"
            aria-label="Fila ${r + 1} columna ${c + 1}${v ? `, valor ${v}` : ', vacía'}">${v || ''}</button>`;
        }).join('')).join('')}
      </div>
      <div class="teclado-sudoku">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="btn" data-accion="num-sudoku" data-n="${n}">${n}</button>`).join('')}
        <button class="btn fantasma" data-accion="num-sudoku" data-n="0">✕</button>
      </div>
      <div class="fila" style="gap:8px;margin-top:12px">
        <button class="btn crece" data-accion="comprobar-sudoku">Comprobar</button>
        <button class="btn fantasma" data-accion="pista-sudoku">Una pista</button>
      </div>
      ${ui.sudokuMensaje ? `<p class="mini centro" style="margin:10px 0 0">${esc(ui.sudokuMensaje)}</p>` : ''}
    </div>`;
}

/* ================================ GUÍA ================================== */

export function vistaGuia(ctx) {
  const { estado, modo } = ctx;
  const nombre = estado.ajustes?.nombreHijo?.valor || 'Nil';
  const umbral = umbralRacha(estado);
  const horas = estado.ajustes?.autoAprobacionHoras?.valor ?? 12;

  const paraNil = `
    <details class="guia" open><summary>Cómo marco mis tareas</summary>
      <p>Entra en <b>Tareas</b> y toca el círculo de la izquierda de cada tarea. Se pone verde
      y los créditos aparecen al momento en tu saldo.</p>
      <ul>
        <li>Mientras papá no la revise, pone <i>esperando</i>. Si no hace nada en ${esc(String(horas))} horas, se aprueba sola.</li>
        <li>Si te has equivocado y aún está pendiente, vuelve a tocar el círculo para quitarla.</li>
        <li>Si papá la veta, los créditos se van solos y verás el motivo.</li>
        <li>Puedes añadir hasta 2 fotos con el botón 📷 (por ejemplo, la habitación recogida).</li>
      </ul>
    </details>
    <details class="guia"><summary>Tareas de doble opción</summary>
      <p>Algunas tareas, como vaciar el lavavajillas, tienen dos formas de hacerse y valen distinto.
      <b>Eliges tú</b>: papá solo puede aprobar o vetar lo que has elegido, nunca elegir por ti.</p>
    </details>
    <details class="guia"><summary>Tareas obligatorias</summary>
      <p>Lavarte los dientes o ducharte no dan créditos: son cosas que hay que hacer y ya está.
      Pero <b>sí cuentan</b> para el porcentaje de la semana, así que saltártelas te baja la racha.</p>
    </details>
    <details class="guia"><summary>Créditos y hucha</summary>
      <ul>
        <li><b>Créditos</b>: para el día a día (bonos de ocio, premios pequeños). <b>No caducan</b>: lo que no gastas sigue ahí la semana siguiente.</li>
        <li><b>Hucha</b>: tú decides qué guardas. En <b>Mi ahorro</b> pasas créditos a la hucha (y de vuelta, si papá lo permite). Lo de la hucha no se gasta sin querer, crece con el interés y sirve para los premios grandes.</li>
        <li>Guardar o sacar no es ganar ni gastar: los créditos solo cambian de sitio.</li>
      </ul>
      <p>Idea del reparto: de lo que ganas en un día, más o menos un tercio se te va en lo básico de hoy,
      otro tercio en un extra que elijas, y el otro tercio se queda ahí sumando.</p>
    </details>
    <details class="guia"><summary>Bonos de ocio</summary>
      <p>El móvil, la tele y el anime se compran <b>por adelantado</b>, como una entrada de cine para hoy.
      No hay cronómetro: una vez aprobado el bono, el tiempo lo lleváis en casa.</p>
      <ul>
        <li>El bono de móvil tiene un tope de días por semana.</li>
        <li>El tiempo extra de anime solo se puede pedir si ya tienes el bono de anime de hoy.</li>
        <li>El <b>PC sí</b> es una sesión cronometrada: le das a empezar y a parar, y se cobra por bloques.</li>
      </ul>
    </details>
    <details class="guia"><summary>Ritmo circadiano y Modo Búho</summary>
      ${EXPLICACION.map((t) => `<p>${esc(t)}</p>`).join('')}
      <p>A partir de la hora de corte no se puede ni empezar a comprar ocio. La excepción es el
      <b>Modo Búho</b>: se compra en la tienda, lo aprueba papá y vale <b>solo esa noche</b>.</p>
    </details>
    <details class="guia"><summary>Horario y Calendario: no son lo mismo</summary>
      <ul>
        <li><b>Horario</b>: lo que se repite todas las semanas (cole, entrenos). Los bloques con 🔒 no dejan empezar ocio mientras duran.</li>
        <li><b>Calendario</b>: citas con fecha concreta (el dentista el día 14). No se borran al cerrar la semana.</li>
      </ul>
    </details>
    <details class="guia"><summary>Racha</summary>
      <p>Al cerrar la semana, si tu cumplimiento llega al <b>${esc(String(umbral))}%</b> la racha sube. Si no, vuelve a cero.
      Si un día se os olvidó marcar algo, papá puede recuperarlo y la racha se recalcula sola.</p>
    </details>
    <details class="guia"><summary>Las estrellas ⭐</summary>
      <p>Son la <b>segunda moneda</b>, y no se mezclan con los créditos. Se ganan cuidándote
      (lavarte los dientes, ducharte, los hábitos de la pantalla de Cuidado) y tratando bien
      en casa. Solo compran <b>regalos físicos</b>.</p>
      <p>La idea es que cuidarte no compita nunca con tu rato de ocio: son bolsillos distintos.</p>
    </details>
    <details class="guia"><summary>Cuidado: agua, comida real, luz y movimiento</summary>
      <p>En <b>Cuidado</b> marcas los hábitos del día. Cada uno da una estrella, y si los haces
      todos hay premio extra.</p>
      <p>Importante: aquí <b>no</b> se mide tu cuerpo. No hay peso, ni calorías, ni comida
      prohibida. Solo si ese día hubo agua, verdura o fruta, calma al comer, un rato de luz
      y movimiento. Son cosas que se hacen, no cosas que se evitan.</p>
    </details>
    <details class="guia"><summary>Apuntar la hora de dormir</summary>
      <p>Cuando te acuestes, apunta la hora: es lo que dibuja tu gráfica de sueño.</p>
      <p>No es para vigilarte: es lo que dibuja tu gráfica de sueño y lo que te deja ver si
      estás durmiendo lo que tu cuerpo pide.</p>
    </details>
    <details class="guia"><summary>Hacer crecer la hucha</summary>
      <ul>
        <li><b>Interés de la hucha</b>: lo que guardas gana un poco solo, sin hacer nada.</li>
        <li><b>Depósito a plazo</b>: bloqueas créditos de la hucha unos días y cobras un interés al vencer.
        Si lo rompes antes, recuperas tu dinero pero pierdes el interés.</li>
      </ul>
      <p>Si papá enciende algo más, aparece en <b>Mi ahorro</b> con su explicación.</p>
    </details>
    <details class="guia"><summary>Los billetes</summary>
      <p>Cada cosa que compras es un billete. El de hoy vale hoy; cuando cambia el día se queda
      sellado como <b>gastado</b>, pero no se borra: se queda en tu colección, de recuerdo.</p>
    </details>
    <details class="guia"><summary>Avisos</summary>
      <p>Los avisos del móvil solo funcionan con la app abierta: no hay servidor que te avise
      si la cierras. Es así de verdad, no te prometemos lo que no se puede cumplir.</p>
    </details>`;

  const paraPadre = `
    <details class="guia" open><summary>Aprobar y vetar</summary>
      <p>En <b>Panel → Aprobaciones</b> tienes todo lo pendiente en una sola lista.
      Aprobar consolida el crédito; vetar lo revierte con un movimiento de anulación
      (nada se borra, todo queda en el histórico). Puedes vetar incluso algo ya aprobado.</p>
      <p>Lo que no toques se auto-aprueba a las ${esc(String(horas))} horas. Es configurable en Ajustes.</p>
    </details>
    <details class="guia"><summary>Economía (v3.5)</summary>
      <p>Desde la v3.5 la economía vuelve a ser sencilla, como la v2: <b>créditos que no caducan</b>,
      estrellas, hucha con interés y depósito a plazo. Todo está en <b>Panel → Economía</b>:</p>
      <ul>
        <li><b>Resumen</b>: los tres saldos, la salud económica y los últimos movimientos.</li>
        <li><b>Histórico</b>: todo lo que ha pasado, filtrable por cuenta, tipo, fechas y texto, con el saldo tras cada movimiento. Se descarga en CSV.</li>
        <li><b>Herramientas</b>: añadir o quitar puntos, mover a la hucha, tarea puntual, multiplicador (también entre dos fechas), precios en bloque y pausar la tienda.</li>
        <li><b>Reglas</b>: los valores de siempre, con una simulación arriba.</li>
        <li><b>Avanzado</b>: lo que la v3 tenía de más (apuestas, staking de sueño, misiones, escudos, bonus de racha, cierre semanal). Está apagado, no borrado: se enciende con un botón.</li>
      </ul>
    </details>
    <details class="guia"><summary>Días pasados</summary>
      <p>En <b>Panel → Días pasados</b> eliges un día de las dos últimas semanas, marcas las tareas
      que se hicieron y las validas juntas. Los créditos quedan con la fecha de ese día y la racha
      se recalcula sola. Si faltaba una tarea, créala como puntual para ese día.</p>
    </details>
    <details class="guia"><summary>Las dos monedas</summary>
      <p><b>Créditos</b> para el ocio y los premios; <b>estrellas</b> para la higiene, el buen
      trato y los hábitos de cuidado, y solo compran regalos físicos. No se convierten entre sí
      en ningún caso, ni siquiera con un ajuste manual: son cuentas distintas.</p>
      <p>El multiplicador no toca las estrellas a propósito: el cuidado del cuerpo no debería
      tener promociones de fin de semana.</p>
    </details>
    <details class="guia"><summary>Salud y ritmo natural</summary>
      <p>Está construido a propósito como <b>presencias y ritmos</b>, no como control: nada de
      peso, calorías ni alimentos prohibidos, y nada que premie comer menos. Hay pruebas
      automáticas que fallan si alguien mete esas palabras en el catálogo.</p>
      <p>Puedes añadir, editar o quitar hábitos desde Catálogo, igual que cualquier tarea.</p>
    </details>
    <details class="guia"><summary>Herramientas de Economía</summary>
      <ul>
        <li><b>Histórico</b>: una sola lista con todo. Si un número no cuadra, está aquí la razón. Nada se borra: ↩︎ anula con motivo.</li>
        <li><b>Añadir o quitar puntos</b>: en créditos, hucha o estrellas, hoy o hasta 14 días atrás, con motivo obligatorio visible para ${esc(nombre)}.</li>
        <li><b>Multiplicador</b>: multiplica solo lo <i>ganado</i>, nunca lo gastado. Siempre, fines de semana, hoy o entre dos fechas.</li>
        <li><b>Tarea puntual</b>: de un solo uso, con su valor y su día (también un día pasado).</li>
        <li><b>Catálogo</b>: todo se edita: tareas (tipo, valor, moneda, opciones, días, aprobación), grupos de tareas, ocio (con el tiempo que da cada bono), premios, premios grandes y regalos. Lo que viene de fábrica es un ejemplo: cambiadlo a vuestra medida.</li>
        <li><b>Salud económica</b>: diagnóstico simple de si el sistema va equilibrado.</li>
      </ul>
    </details>
    <details class="guia"><summary>Cerrar la semana</summary>
      <p>Al cerrar se archiva la semana, se calcula el cumplimiento y se actualiza la racha. Los
      créditos <b>no se tocan</b> (saldo continuo). Si enciendes el «cierre semanal» en Avanzado,
      vuelve el sistema antiguo: lo que sobra pasa a la hucha. <b>No se borra</b> ni el calendario,
      ni el horario, ni los precios.</p>
      <p>Puedes descargar el resumen en cualquier momento sin cerrar nada.</p>
    </details>
    <details class="guia"><summary>Horario y Calendario</summary>
      <p>El horario es la plantilla semanal; tú eres master y puedes corregir cualquier bloque
      que haya puesto ${esc(nombre)}. El calendario son citas con fecha real y sobrevive a todo.</p>
    </details>
    <details class="guia"><summary>Clave del panel</summary>
      <p>La clave del panel no viene con ningún valor por defecto: la creas tú la primera vez.
      Cámbiala desde Ajustes cuando quieras. Si la pierdes, se puede reiniciar borrando los datos
      de la app en el navegador (se pierde lo local, no lo que ya esté sincronizado).</p>
    </details>
    <details class="guia"><summary>Qué hay que saber del riesgo técnico</summary>
      <p>La lógica de créditos vive en el móvil (no hay servidor propio). Alguien con conocimientos
      técnicos podría manipular su saldo desde el navegador. Es un riesgo asumido y conocido para
      una app familiar de dos usuarios, no un descuido.</p>
    </details>`;

  return `
    <div class="tarjeta">
      <h2>📖 Guía de uso</h2>
      <div class="pestanas" role="tablist">
        <button role="tab" aria-selected="${ctx.ui.guiaTab !== 'padre'}" data-accion="guia-tab" data-tab="nil">Para ${esc(nombre)}</button>
        <button role="tab" aria-selected="${ctx.ui.guiaTab === 'padre'}" data-accion="guia-tab" data-tab="padre">Para el padre</button>
      </div>
      ${ctx.ui.guiaTab === 'padre' ? paraPadre : paraNil}
    </div>`;
}

/* =============================== AJUSTES ================================ */

export function vistaAjustesNil(ctx) {
  const { estado, modo } = ctx;
  const temaActual = modo === 'padre'
    ? (estado.ajustes?.temaPadre?.valor || 'pizarra')
    : (estado.ajustes?.temaNil?.valor || 'bosque');
  const calidad = estado.ajustes?.calidadFondo?.valor || 'auto';

  return `
    <div class="tarjeta">
      <h2>🎨 Tema</h2>
      <p class="mini tenue" style="margin:0 0 12px">
        ${modo === 'padre' ? 'Tema de tu panel, independiente del de Nil.' : 'Elige el tuyo: es tu app.'}
        Cada escena cambia sola según la hora del día.
      </p>
      ${selectorTemas(ctx, { idActual: temaActual })}
    </div>

    <div class="tarjeta">
      <h2>⚙️ Calidad del fondo</h2>
      <p class="mini tenue" style="margin:0 0 10px">
        Los fondos son escenas animadas de verdad. En automático empiezan al máximo
        y bajan solas si el móvil no llega; también se paran del todo cuando la app
        no está a la vista.
      </p>
      <div class="pestanas" role="tablist">
        ${CALIDADES.map((c) => `<button role="tab" aria-selected="${c.id === calidad}"
          data-accion="calidad" data-calidad="${escAttr(c.id)}">${esc(c.etiqueta)}</button>`).join('')}
      </div>
      <p class="mini tenue" style="margin:8px 0 0">
        ${esc((CALIDADES.find((c) => c.id === calidad) || CALIDADES[0]).ayuda)}
      </p>
    </div>

    <div class="tarjeta">
      <h2>✨ Efectos</h2>
      <p class="mini tenue" style="margin:0 0 10px">
        Los números que vuelan, la vibración y el confeti al conseguir algo.
        Si molestan o el móvil va justo, se apagan aquí y la app funciona igual.
      </p>
      <label class="fila sep" style="padding:6px 0">
        <span>Animaciones y vibración</span>
        <input type="checkbox" data-ajuste="efectosActivos" data-tipo="bool"
          ${estado.ajustes?.efectosActivos?.valor === false ? '' : 'checked'}>
      </label>
      <label class="fila sep" style="padding:6px 0">
        <span>Sonido</span>
        <input type="checkbox" data-ajuste="sonidoActivo" data-tipo="bool"
          ${estado.ajustes?.sonidoActivo?.valor ? 'checked' : ''}>
      </label>
    </div>

    <div class="tarjeta">
      <h2>🔔 Avisos</h2>
      <p class="mini tenue" style="margin:0 0 10px">
        Avisos del ritmo circadiano y de las citas marcadas. Solo funcionan con la app abierta:
        no hay servidor de notificaciones push.
      </p>
      <button class="btn" data-accion="permiso-notificaciones">Activar avisos</button>
      <span class="chip" style="margin-left:8px" id="rt-estado-notif"></span>
    </div>

    <div class="tarjeta">
      <h2>📲 Instalar en el móvil</h2>
      <p class="mini tenue" style="margin:0 0 10px">
        En Android: menú ⋮ del navegador → <b>Instalar aplicación</b> (o "Añadir a pantalla de inicio").
        Se abre a pantalla completa, con su icono, y funciona aunque no haya internet.
      </p>
      <button class="btn principal" data-accion="instalar" id="rt-btn-instalar">Instalar</button>
    </div>

    ${modo !== 'padre' ? `
    <div class="tarjeta">
      <h2>👤 Panel de papá</h2>
      <p class="mini tenue" style="margin:0 0 10px">Necesita la clave. Nil no tiene que entrar aquí.</p>
      <button class="btn" data-accion="entrar-padre">Entrar con clave</button>
    </div>` : ''}
  `;
}
