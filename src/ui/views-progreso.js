/**
 * Panel de control de Nil: su progreso, sus gráficas, sus bonos y sus billetes.
 * También el apartado de salud y ritmo natural, y el de ahorro y stakings.
 */

import { esc, escAttr, barra, vacio } from './dom.js';
import {
  formatoFechaLarga, formatoFechaCorta, nombreDiaCorto, weekdayIndex,
  addDays, weekIdOf, horaActual, minutosDeHora, weekDays, textoDuracion,
} from '../core/util.js';
import {
  saldoCreditos, saldoHucha, saldoEstrellas, saldoProvisional, resumenSemana,
  ganadoPorCategoria, serieHucha, movimientos,
} from '../core/ledger.js';
import { puedeSacarNil, ETIQUETA_TIPO } from '../core/gestion.js';
import { cumplimientoDia, cumplimientoSemana, rachaActual, umbralRacha, tareasDelDia, marcaDe } from '../core/tasks.js';
import { estadoObjetivo, precioEfectivo } from '../core/economy.js';
import { ocioDeHoy, comprasDe, comprasDeFecha, modoBuhoActivo } from '../core/leisure.js';
import { proximosEventos } from '../core/calendar.js';
import {
  objetivosDe, proximoHito, consejos, nochesEntre, registroSueno, rachaSueno,
  mediaSueno, minutosNocturnos, evaluacionSueno, EXPLICACION,
} from '../core/circadian.js';
import { habitosDelDia, marcaHabito, resumenDia, rejilla, rachaDiasCompletos, comentarios } from '../core/health.js';
import {
  stakings, stakingsActivos, capitalBloqueado, patrimonio, resumenStaking,
  porcentajeDePlazo, PLAZOS, TIPOS_STAKING,
} from '../core/staking.js';
import { leerParametro } from '../core/tokenomics.js';
import { CATEGORIAS } from '../core/defaults.js';
import {
  barrasCategoria, barrasDia, areaEvolucion, barrasGanadoGastado,
  graficaNoches, rejillaHabitos, aroObjetivo,
} from './charts.js';
import { tarjetaNivel, tarjetaRacha, tarjetaMisiones, tarjetaReto } from './views-juego.js';

/* ------------------------------------------------------------------ */
/* Piezas compartidas                                                  */
/* ------------------------------------------------------------------ */

function cajaMoneda(valor, etiqueta, clase = '', pie = '', ancla = null) {
  return `<div class="moneda-caja ${clase}">
    <div class="cifra"${ancla ? ` data-saldo="${escAttr(ancla)}"` : ''}>${esc(String(valor))}</div>
    <div class="etq">${esc(etiqueta)}</div>
    ${pie ? `<div class="mini tenue" style="margin-top:3px">${esc(pie)}</div>` : ''}
  </div>`;
}

function tarjetaConsejo(c) {
  const icono = { aviso: '⚠️', bien: '✨', info: '💡' }[c.tono] || '💡';
  return `<div class="consejo ${escAttr(c.tono)}">
    <span class="ic" aria-hidden="true">${icono}</span>
    <div class="crece">
      <div class="tit">${esc(c.titulo)}</div>
      <div class="txt">${esc(c.texto)}</div>
    </div>
  </div>`;
}

/** Un billete de compra. El de hoy vale; el de ayer queda sellado de recuerdo. */
export function billete(compra, hoy, { compacto = false } = {}) {
  const tipos = {
    bono: 'Bono', premio: 'Premio', buho: 'Modo Búho',
    pasePc: 'Pase de PC', extraAnime: 'Tiempo extra',
  };
  const esPasado = compra.fecha < hoy;
  const denegado = compra.estado === 'denegada';
  const pendiente = compra.estado === 'pendiente';
  const gastado = !denegado && !pendiente && esPasado;
  const clase = denegado ? 'denegado gastado' : gastado ? 'gastado' : pendiente ? 'pendiente' : 'hoy';
  const codigo = String(compra.id || '').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
  const moneda = compra.moneda === 'estrellas' ? 'estrellas' : compra.moneda === 'hucha' ? 'hucha' : 'créditos';

  return `
    <article class="billete ${clase}">
      <div class="bi-cuerpo">
        <span class="bi-tipo">${esc(tipos[compra.tipo] || 'Premio')}${pendiente ? ' · esperando' : ''}</span>
        <span class="bi-nombre">${esc(compra.nombre)}</span>
        <span class="bi-meta">${esc(esPasado ? formatoFechaLarga(compra.fecha) : 'Válido hoy')}${
          textoDuracion(compra.duracion) ? ` · ⏱ ${esc(textoDuracion(compra.duracion))}` : ''}${
          denegado && compra.motivo ? ` · ${esc(compra.motivo)}` : ''}</span>
        ${compacto ? '' : `<span class="bi-codigo">Nº ${esc(codigo)}</span>`}
      </div>
      <div class="bi-talon">
        <span class="precio">${esc(String(compra.precio))}</span>
        <span class="moneda">${esc(moneda)}</span>
      </div>
      ${gastado || denegado ? `<span class="sello">${denegado ? 'anulado' : 'gastado'}</span>` : ''}
    </article>`;
}

/* ================================================================== */
/* INICIO — el panel de control                                        */
/* ================================================================== */

export function vistaInicio(ctx) {
  const { estado, hoy, weekId } = ctx;
  const nombre = estado.ajustes?.nombreHijo?.valor || 'Nil';
  const saldo = saldoCreditos(estado, hoy);
  const prov = saldoProvisional(estado, weekId);
  const hucha = saldoHucha(estado);
  const estrellas = saldoEstrellas(estado);
  const bloqueado = capitalBloqueado(estado);
  const cumpleHoy = cumplimientoDia(estado, hoy);
  const cumpleSemana = cumplimientoSemana(estado, weekId, hoy);
  const racha = rachaActual(estado);
  const objetivo = estadoObjetivo(estado, hoy);
  const obj = objetivosDe(estado, hoy);
  const hito = proximoHito(estado, hoy, horaActual());
  const pendientes = tareasDelDia(estado, hoy).filter((t) => !marcaDe(estado, hoy, t.id));
  const salud = resumenDia(estado, hoy);
  const tips = [...consejos(estado, hoy, horaActual(), { limite: 2 }), ...comentarios(estado, hoy, { limite: 1 })];
  const activos = stakingsActivos(estado);
  const eventos = proximosEventos(estado, hoy, 10, 2);

  // Gráficas de la semana
  const porCategoria = ganadoPorCategoria(estado, weekId);
  const itemsCat = Object.entries(CATEGORIAS)
    .filter(([k]) => porCategoria[k])
    .map(([k, cat]) => ({ etiqueta: cat.etiqueta, icono: cat.icono, color: cat.color, valor: porCategoria[k] }));
  const diasSemana = cumpleSemana.porDia.map((d) => ({
    etiqueta: nombreDiaCorto(weekdayIndex(d.fecha)),
    valor: d.pct,
  }));

  const billetesHoy = comprasDeFecha(estado, hoy).filter((c) => c.estado !== 'denegada');

  return `
    ${tarjetaReto(ctx)}
    ${tarjetaNivel(ctx, { compacta: true })}
    <div class="tarjeta">
      <div class="hero-monedas">
        ${cajaMoneda(saldo, 'Mis créditos', '', prov > 0 ? `${prov} sin aprobar` : '', 'semana')}
        ${cajaMoneda(estrellas, 'Estrellas', 'estrellas', 'cuidado y buen trato', 'estrellas')}
      </div>
      <div class="rejilla tres" style="margin-top:10px">
        <div class="dato"><div class="v">${hucha}</div><div class="e">Hucha</div></div>
        <div class="dato"><div class="v">${bloqueado}</div><div class="e">Guardado</div></div>
        <div class="dato"><div class="v">${racha}🔥</div><div class="e">Racha</div></div>
      </div>
      <button class="btn bloque pequeno" style="margin-top:10px" data-accion="ir" data-vista="ahorro">🐷 Mi hucha y mis movimientos</button>
    </div>

    <div class="tarjeta">
      <div class="fila" style="gap:14px;align-items:flex-start">
        ${aroObjetivo(cumpleHoy.pct, { centro: `${cumpleHoy.pct}%`, abajo: 'de hoy', color: 'var(--acento)' })}
        <div class="crece">
          <h2 style="margin:0 0 4px">Hola, ${esc(nombre)}</h2>
          <p class="mini tenue" style="margin:0 0 8px">${esc(formatoFechaLarga(hoy))}</p>
          <p class="mini" style="margin:0 0 10px">
            ${cumpleHoy.cumplidas} de ${cumpleHoy.esperadas} tareas.
            ${pendientes.length ? `Te quedan <b>${pendientes.length}</b>.` : '<b>Día completo.</b>'}
            ${salud.total ? `<br>Cuidado: ${salud.hechos}/${salud.total} hábitos.` : ''}
          </p>
          <div class="fila envuelve" style="gap:6px">
            <button class="btn principal pequeno" data-accion="ir" data-vista="tareas">Mis tareas</button>
            <button class="btn pequeno" data-accion="ir" data-vista="salud">🌿 Cuidado</button>
          </div>
        </div>
      </div>
    </div>

    ${tarjetaMisiones(ctx, { compacta: true })}

    ${tips.length ? `<div class="tarjeta">
      <h2>💬 Para hoy</h2>
      ${tips.map(tarjetaConsejo).join('')}
    </div>` : ''}

    ${objetivo && !objetivo.roto ? `
    <div class="tarjeta">
      <div class="fila sep" style="margin-bottom:10px">
        <h2 style="margin:0">🎯 Mi objetivo</h2>
        <button class="btn pequeno fantasma" data-accion="ir" data-vista="tienda">Cambiar</button>
      </div>
      <div class="fila" style="gap:14px">
        ${aroObjetivo(objetivo.progreso * 100, {
          centro: `${objetivo.hucha}`,
          abajo: `de ${objetivo.precio}`,
          color: 'var(--acento2)',
        })}
        <div class="crece">
          <div style="font-weight:700;font-size:1rem">${esc(objetivo.articulo.icono || '⭐')} ${esc(objetivo.articulo.nombre)}</div>
          <p class="mini tenue" style="margin:6px 0 0">
            ${objetivo.faltante === 0
              ? '¡Ya puedes pedirlo!'
              : `Te faltan <b>${objetivo.faltante}</b>.${objetivo.semanasEstimadas !== null
                ? ` A tu ritmo real (${objetivo.ritmoSemanal}/semana), unas <b>${objetivo.semanasEstimadas}</b> semanas.`
                : ' Cierra una semana con saldo para poder estimarlo.'}`}
          </p>
        </div>
      </div>
    </div>` : ''}

    <div class="tarjeta">
      <h2>📈 Mi semana</h2>
      ${barrasDia(diasSemana, { umbral: umbralRacha(estado) })}
      <h3 style="margin-top:16px">De dónde salen los créditos</h3>
      ${barrasCategoria(itemsCat)}
      <div class="fila" style="gap:8px;margin-top:12px">
        <button class="btn crece pequeno" data-accion="ir" data-vista="progreso">Ver todo mi progreso</button>
      </div>
    </div>

    <div class="tarjeta">
      <div class="fila sep" style="margin-bottom:10px">
        <h2 style="margin:0">🎟️ Mis billetes de hoy</h2>
        <button class="btn pequeno fantasma" data-accion="ir" data-vista="billetes">Todos</button>
      </div>
      ${billetesHoy.length
        ? `<div class="billetes">${billetesHoy.map((c) => billete(c, hoy, { compacto: true })).join('')}</div>`
        : '<p class="mini tenue" style="margin:0">Todavía no has comprado nada para hoy.</p>'}
    </div>

    ${activos.length ? `
    <div class="tarjeta">
      <div class="fila sep" style="margin-bottom:10px">
        <h2 style="margin:0">🔒 Lo que tengo guardado</h2>
        <button class="btn pequeno fantasma" data-accion="ir" data-vista="ahorro">Ahorro</button>
      </div>
      ${activos.map((s) => `
        <div class="staking-card">
          <div class="fila sep">
            <span>${esc(TIPOS_STAKING[s.tipo].icono)} ${esc(TIPOS_STAKING[s.tipo].nombre)}</span>
            <span class="cap">${s.capital}</span>
          </div>
          <div class="mini tenue">${esc(resumenStaking(estado, s, hoy))}</div>
        </div>`).join('')}
    </div>` : ''}

    <div class="tarjeta">
      <h2>🌙 Esta noche</h2>
      <div class="rejilla tres">
        <div class="dato"><div class="v">${esc(obj.cena)}</div><div class="e">Cena</div></div>
        <div class="dato"><div class="v">${esc(obj.corte)}</div><div class="e">Pantallas</div></div>
        <div class="dato"><div class="v">${esc(obj.dormir)}</div><div class="e">Dormir</div></div>
      </div>
      <p class="mini tenue" style="margin:10px 0 0">
        ${hito ? `Siguiente: <b>${esc(hito.etiqueta)}</b> a las ${esc(hito.hora)}.` : 'Por hoy ya está todo.'}
        ${modoBuhoActivo(estado, hoy) ? ' <span class="chip ok">🦉 Modo Búho</span>' : ''}
      </p>
      ${registroSueno(estado, hoy)
        ? `<p class="mini" style="margin:8px 0 0">Anoche apuntaste ${esc(registroSueno(estado, hoy).hora)}${
            registroSueno(estado, hoy).cumplida ? ' · a la hora ✅' : ' · algo tarde'}</p>`
        : `<button class="btn bloque pequeno" style="margin-top:10px" data-accion="apuntar-noche">Apuntar a qué hora me duermo</button>`}
    </div>

    ${eventos.length ? `
    <div class="tarjeta">
      <h2>📅 Lo que viene</h2>
      ${eventos.map((e) => `
        <div class="evento">
          <span class="cinta" style="background:${escAttr(e.color)}"></span>
          <div class="crece">
            <div style="font-weight:600">${esc(e.titulo)}</div>
            <div class="mini tenue">${esc(formatoFechaLarga(e.fecha))}${e.hora ? ` · ${esc(e.hora)}` : ''}</div>
          </div>
        </div>`).join('')}
    </div>` : ''}`;
}

/* ================================================================== */
/* PROGRESO — todas las gráficas                                       */
/* ================================================================== */

export function vistaProgreso(ctx) {
  const { estado, hoy, weekId } = ctx;
  const semanas = [];
  for (let i = 7; i >= 0; i--) {
    const wid = addDays(weekId, -7 * i);
    const r = resumenSemana(estado, wid);
    semanas.push({ etiqueta: formatoFechaCorta(wid), ganado: r.ganado, gastado: r.gastado });
  }
  const serie = serieHucha(estado, addDays(hoy, -55), hoy);
  const cumple = cumplimientoSemana(estado, weekId, hoy);
  const porCategoria = ganadoPorCategoria(estado, weekId);
  const itemsCat = Object.entries(CATEGORIAS)
    .filter(([k]) => porCategoria[k])
    .map(([k, cat]) => ({ etiqueta: cat.etiqueta, icono: cat.icono, color: cat.color, valor: porCategoria[k] }));
  const objetivo = estadoObjetivo(estado, hoy);
  const noches = nochesEntre(estado, addDays(hoy, -13), hoy)
    .map((n) => ({ ...n, minutosNocturnos: n.registro ? minutosNocturnos(n.registro.hora) : null }));
  const objMin = minutosNocturnos(objetivosDe(estado, hoy).dormir);
  const r = rejilla(estado, hoy, 14);
  const hayHistoria = semanas.some((s) => s.ganado || s.gastado) || serie.some((p) => p.valor > 0);

  return `
    ${tarjetaNivel(ctx)}
    ${tarjetaRacha(ctx)}
    ${tarjetaMisiones(ctx)}
    ${hayHistoria ? '' : `
    <div class="tarjeta compacta">
      <p class="mini tenue" style="margin:0">
        Esta pantalla se llena sola conforme vayas usando la app: al marcar tareas, al apuntar
        las noches y al cerrar la primera semana. Los primeros días se ve vacía, y es normal.
      </p>
    </div>`}

    <div class="tarjeta">
      <h2>🐷 Cómo crece mi hucha</h2>
      ${areaEvolucion(serie, { etiqueta: 'hucha' })}
      <p class="mini tenue" style="margin:8px 0 0">
        Últimas 8 semanas. Incluye lo que sobra cada semana, los intereses y lo que ganan los stakings.
      </p>
    </div>

    <div class="tarjeta">
      <h2>⚖️ Lo que gano y lo que gasto</h2>
      ${barrasGanadoGastado(semanas)}
      <p class="mini tenue" style="margin:8px 0 0">
        Si la barra verde es más alta que la roja, esa semana algo se quedó en la hucha.
      </p>
    </div>

    <div class="tarjeta">
      <h2>✅ Cumplimiento de la semana</h2>
      ${barrasDia(cumple.porDia.map((d) => ({
        etiqueta: nombreDiaCorto(weekdayIndex(d.fecha)), valor: d.pct,
      })), { umbral: umbralRacha(estado) })}
      <p class="mini tenue" style="margin:8px 0 0">
        La línea de puntos es el ${esc(String(umbralRacha(estado)))}% que hace subir la racha al cerrar la semana.
      </p>
    </div>

    <div class="tarjeta">
      <h2>🧩 De dónde salen los créditos</h2>
      ${barrasCategoria(itemsCat)}
    </div>

    ${objetivo && !objetivo.roto ? `
    <div class="tarjeta">
      <h2>🎯 Camino hacia ${esc(objetivo.articulo.nombre)}</h2>
      ${aroObjetivo(objetivo.progreso * 100, {
        centro: `${Math.round(objetivo.progreso * 100)}%`,
        abajo: `${objetivo.hucha} de ${objetivo.precio}`,
        color: 'var(--acento2)',
      })}
      <p class="mini centro" style="margin:10px 0 0">
        ${objetivo.faltante === 0 ? '¡Ya puedes pedirlo!'
          : `Faltan <b>${objetivo.faltante}</b>${objetivo.semanasEstimadas !== null ? ` · unas ${objetivo.semanasEstimadas} semanas a tu ritmo` : ''}`}
      </p>
    </div>` : ''}

    <div class="tarjeta">
      <h2>🌙 Mi ritmo de sueño</h2>
      ${graficaNoches(noches, { objetivoMin: objMin, margen: Number(leerParametro(estado, 'margenDormirMin', 15)) })}
      <p class="mini tenue" style="margin:8px 0 0">
        Cuanto más abajo del punto, más tarde te dormiste. La zona clara es "a la hora".
      </p>
    </div>

    <div class="tarjeta">
      <h2>🌿 Mis hábitos de cuidado</h2>
      ${rejillaHabitos(r)}
      <p class="nota-metodo">
        Aquí no hay peso, ni calorías, ni comida prohibida: solo si ese día hubo agua, verdura,
        calma, luz y movimiento. Son cosas que se hacen, no cosas que se evitan.
      </p>
    </div>`;
}

/* ================================================================== */
/* BILLETES — la colección                                             */
/* ================================================================== */

export function vistaBilletes(ctx) {
  const { estado, hoy } = ctx;
  const todas = comprasDe(estado).sort((a, b) => (b.solicitadaEn || 0) - (a.solicitadaEn || 0));
  const deHoy = todas.filter((c) => c.fecha === hoy);
  const antiguas = todas.filter((c) => c.fecha !== hoy);
  const gastadoTotal = todas.filter((c) => c.estado !== 'denegada').reduce((s, c) => s + c.precio, 0);

  return `
    <div class="tarjeta compacta">
      <div class="fila sep">
        <span class="mini tenue">${todas.length} billete${todas.length === 1 ? '' : 's'} en total</span>
        <span class="chip">${gastadoTotal} gastados</span>
      </div>
    </div>

    ${deHoy.length ? `
    <div class="tarjeta">
      <h2>Hoy</h2>
      <div class="billetes">${deHoy.map((c) => billete(c, hoy)).join('')}</div>
    </div>` : ''}

    <div class="tarjeta">
      <h2>De recuerdo</h2>
      ${antiguas.length
        ? `<div class="billetes">${antiguas.slice(0, 60).map((c) => billete(c, hoy)).join('')}</div>`
        : vacio('Aún no hay billetes antiguos.', '🎟️')}
      <p class="mini tenue" style="margin:10px 0 0">
        Cuando cambia el día, el billete queda sellado como gastado. No se borra: se queda aquí.
      </p>
    </div>`;
}

/* ================================================================== */
/* SALUD Y RITMO NATURAL                                               */
/* ================================================================== */

export function vistaSalud(ctx) {
  const { estado, hoy } = ctx;
  const habitos = habitosDelDia(estado);
  const dia = resumenDia(estado, hoy);
  const racha = rachaDiasCompletos(estado, hoy);
  const r = rejilla(estado, hoy, 14);
  const tips = comentarios(estado, hoy, { limite: 3 });
  const estrellas = saldoEstrellas(estado);
  const vasos = leerParametro(estado, 'vasosAguaObjetivo', 6);
  const media = mediaSueno(estado, hoy, 14);
  const evaluacion = evaluacionSueno(media);
  const rachaNoches = rachaSueno(estado, hoy);
  const apuntadaHoy = registroSueno(estado, hoy);

  return `
    <div class="tarjeta">
      <div class="fila sep" style="margin-bottom:10px">
        <h2 style="margin:0">🌿 Hoy me cuido</h2>
        <span class="chip">${estrellas} ⭐</span>
      </div>
      ${barra(dia.pct, 'var(--acento)')}
      <p class="mini tenue" style="margin:8px 0 12px">
        ${dia.hechos} de ${dia.total} hábitos${racha > 0 ? ` · ${racha} día${racha === 1 ? '' : 's'} completos seguidos` : ''}
      </p>
      ${habitos.map((h) => {
        const m = marcaHabito(estado, hoy, h.id);
        const hecho = Boolean(m && m.estado !== 'vetada');
        return `
          <div class="habito ${hecho ? 'si' : ''}">
            <button class="marcar ${hecho ? 'on' : ''}"
              data-accion="${hecho ? 'desmarcar' : 'marcar'}" data-tarea="${escAttr(h.id)}" data-fecha="${escAttr(hoy)}"
              aria-label="${escAttr(`${hecho ? 'Quitar' : 'Marcar'} ${h.nombre}`)}">${hecho ? '✓' : ''}</button>
            <span class="ic" aria-hidden="true">${esc(h.icono || '•')}</span>
            <div class="crece">
              <div class="nom">${esc(h.nombre)}</div>
              ${h.referencia === 'agua' ? `<div class="mini tenue">${esc(String(vasos))} vasos repartidos por el día</div>` : ''}
            </div>
            <span class="mini tenue nowrap">+${h.valor} ⭐</span>
          </div>`;
      }).join('') || vacio('No hay hábitos configurados.', '🌿')}
      <p class="nota-metodo">
        Esto no es una dieta ni un control del cuerpo. Son ritmos: agua, comida de verdad,
        calma al comer, luz del día y movimiento. Se paga en estrellas, que solo compran
        regalos físicos: cuidarte nunca compite con tu rato de ocio.
      </p>
    </div>

    <div class="tarjeta">
      <h2>😴 Mi sueño</h2>
      <div class="rejilla tres" style="margin-bottom:10px">
        <div class="dato"><div class="v">${media === null ? '—' : media}</div><div class="e">Horas/noche</div></div>
        <div class="dato"><div class="v">${rachaNoches}</div><div class="e">Noches seguidas</div></div>
        <div class="dato"><div class="v">${esc(objetivosDe(estado, hoy).dormir)}</div><div class="e">Objetivo hoy</div></div>
      </div>
      <p class="mini tenue" style="margin:0 0 10px">${esc(evaluacion.texto)}</p>
      ${apuntadaHoy
        ? `<div class="chip ${apuntadaHoy.cumplida ? 'ok' : 'aviso'}">Hoy: ${esc(apuntadaHoy.hora)}${apuntadaHoy.cumplida ? ' · a la hora' : ' · algo tarde'}</div>
           <button class="btn pequeno fantasma" style="margin-left:8px" data-accion="apuntar-noche" data-forzar="1">Corregir</button>`
        : `<button class="btn principal bloque" data-accion="apuntar-noche">Apuntar mi hora de dormir</button>`}
    </div>

    ${tips.length ? `<div class="tarjeta">
      <h2>💬 Comentarios</h2>
      ${tips.map(tarjetaConsejo).join('')}
    </div>` : ''}

    <div class="tarjeta">
      <h2>📊 Últimas dos semanas</h2>
      ${rejillaHabitos(r)}
    </div>

    <div class="tarjeta">
      <h2>🧠 Por qué todo esto</h2>
      ${EXPLICACION.map((t) => `<p class="mini tenue" style="margin:0 0 8px">${esc(t)}</p>`).join('')}
    </div>`;
}

/* ================================================================== */
/* AHORRO Y STAKINGS                                                   */
/* ================================================================== */

export function vistaAhorro(ctx) {
  const { estado, hoy } = ctx;
  const libre = saldoHucha(estado);
  const bloqueado = capitalBloqueado(estado);
  const total = patrimonio(estado);
  const activos = stakingsActivos(estado);
  const historial = stakings(estado).filter((s) => s.estado !== 'activo').slice(0, 8);
  const interes = Number(leerParametro(estado, 'interesHuchaPct', 0));
  const periodo = leerParametro(estado, 'interesHuchaPeriodo', 'semana');

  const opciones = [
    leerParametro(estado, 'depositoActivo', true) && {
      tipo: 'deposito', icono: '🔒', nombre: 'Depósito a plazo',
      texto: `Bloqueas créditos ${PLAZOS.join(', ')} días y cobras un interés fijo al vencer. Si lo rompes antes, recuperas el capital pero pierdes el interés.`,
      detalle: PLAZOS.map((d) => `${d} d: +${porcentajeDePlazo(estado, d)}%`).join(' · '),
      accion: 'abrir-deposito',
    },
    leerParametro(estado, 'stakingSuenoActivo', true) && {
      tipo: 'sueno', icono: '🌙', nombre: 'Compromiso de sueño',
      texto: `Bloqueas créditos ${leerParametro(estado, 'stakingSuenoNoches', 7)} noches y cobras interés por cada noche que te duermes a tu hora.`,
      detalle: `+${leerParametro(estado, 'stakingSuenoPctNoche', 1.5)}% por noche cumplida`,
      accion: 'abrir-sueno',
    },
    leerParametro(estado, 'apuestaActiva', true) && {
      tipo: 'apuesta', icono: '🎲', nombre: 'Apuesta de racha',
      texto: 'Apuestas a que mantienes la racha varias semanas. Si lo consigues se multiplica; si la rompes, pierdes parte. El único que puede salir mal.',
      detalle: `x${leerParametro(estado, 'apuestaMultiplicador', 1.6)} si ganas · pierdes ${leerParametro(estado, 'apuestaPenalizacionPct', 50)}% si fallas`,
      accion: 'abrir-apuesta',
    },
  ].filter(Boolean);

  const libres = saldoCreditos(estado, hoy);
  const ultimos = movimientos(estado).slice().reverse().slice(0, 15);

  return `
    <div class="tarjeta">
      <h2>🟢 ⇄ 🐷 Mover mis créditos</h2>
      <div class="rejilla dos">
        <div class="dato"><div class="v">${libres}</div><div class="e">Para gastar</div></div>
        <div class="dato"><div class="v">${libre}</div><div class="e">En la hucha</div></div>
      </div>
      <div class="rejilla dos" style="margin-top:10px">
        <button class="btn principal" data-accion="guardar-hucha" ${libres > 0 ? '' : 'disabled'}>Guardar en la hucha</button>
        ${puedeSacarNil(estado) ? `<button class="btn" data-accion="sacar-hucha" ${libre > 0 ? '' : 'disabled'}>Sacar de la hucha</button>` : '<span class="mini tenue">Para sacar, pídeselo a papá.</span>'}
      </div>
      <p class="nota-metodo">Tus créditos no caducan. Lo que guardas en la hucha ya no se gasta sin querer${interes > 0 ? ' y además crece solo' : ''}.</p>
    </div>

    <div class="tarjeta">
      <h2>🐷 Mi ahorro</h2>
      <div class="rejilla tres">
        <div class="dato"><div class="v">${libre}</div><div class="e">Libre</div></div>
        <div class="dato"><div class="v">${bloqueado}</div><div class="e">Guardado</div></div>
        <div class="dato"><div class="v">${total}</div><div class="e">Total</div></div>
      </div>
      ${interes > 0 ? `<p class="mini tenue" style="margin:10px 0 0">
        Tu hucha libre gana un <b>${esc(String(interes))}%</b> cada ${esc(periodo === 'dia' ? 'día' : 'semana')} sin que hagas nada.
      </p>` : ''}
    </div>

    ${activos.length ? `
    <div class="tarjeta">
      <h2>Lo que tengo en marcha</h2>
      ${activos.map((s) => `
        <div class="staking-card">
          <div class="fila sep">
            <span style="font-weight:700">${esc(TIPOS_STAKING[s.tipo].icono)} ${esc(TIPOS_STAKING[s.tipo].nombre)}</span>
            <span class="cap">${s.capital}</span>
          </div>
          <div class="mini tenue" style="margin:4px 0 8px">${esc(resumenStaking(estado, s, hoy))}</div>
          ${s.tipo === 'deposito' ? `<button class="btn pequeno fantasma" data-accion="romper-deposito" data-staking="${escAttr(s.id)}">Romperlo antes de tiempo</button>` : ''}
          ${s.tipo === 'sueno' ? barra((s.nochesCumplidas / Math.max(1, s.noches)) * 100, 'var(--acento2)') : ''}
          ${s.tipo === 'apuesta' ? barra(((s.semanasSuperadas || 0) / Math.max(1, s.semanas)) * 100, 'var(--aviso)') : ''}
        </div>`).join('')}
    </div>` : ''}

    <div class="tarjeta">
      <h2>Formas de hacer crecer la hucha</h2>
      ${opciones.length ? opciones.map((o) => `
        <div class="staking-card">
          <div class="fila sep">
            <span style="font-weight:700">${esc(o.icono)} ${esc(o.nombre)}</span>
            <button class="btn pequeno principal" data-accion="${escAttr(o.accion)}">Abrir</button>
          </div>
          <div class="mini tenue" style="margin-top:4px">${esc(o.texto)}</div>
          <div class="mini" style="margin-top:4px;color:var(--acento2)">${esc(o.detalle)}</div>
        </div>`).join('')
        : vacio('Papá tiene desactivadas todas las opciones de ahorro.', '🔒')}
      <p class="nota-metodo">
        Todo esto sale de la hucha, nunca de tus créditos del día a día: eso no se bloquea.
      </p>
    </div>

    ${historial.length ? `
    <div class="tarjeta">
      <h2>Historial</h2>
      ${historial.map((s) => `
        <div class="staking-card cerrado">
          <div class="fila sep">
            <span>${esc(TIPOS_STAKING[s.tipo].icono)} ${esc(TIPOS_STAKING[s.tipo].nombre)}</span>
            <span class="cap">${s.capital}</span>
          </div>
          <div class="mini tenue">${esc(resumenStaking(estado, s, hoy))}</div>
        </div>`).join('')}
    </div>` : ''}

    <div class="tarjeta">
      <h2>📒 Mis últimos movimientos</h2>
      ${ultimos.length ? ultimos.map((m) => `
        <div class="movimiento${m.anuladoPor ? ' anulado' : ''}">
          <span class="mini tenue nowrap">${esc(formatoFechaCorta(m.fecha))}</span>
          <div class="crece">
            <div class="truncar">${esc({ semana: '🟢', hucha: '🐷', estrellas: '⭐' }[m.cuenta] || '•')} ${esc(m.concepto)}</div>
            <div class="mini tenue">${esc(m.tipo === 'ajuste' ? (m.cantidad >= 0 ? 'Regalo de papá' : 'Quitado por papá') : (ETIQUETA_TIPO[m.tipo] || m.tipo))}${m.provisional ? ' · sin aprobar' : ''}${m.anuladoPor ? ' · anulado' : ''}</div>
          </div>
          <span class="cant ${m.cantidad >= 0 ? 'mas' : 'menos'}">${m.cantidad >= 0 ? '+' : ''}${esc(String(m.cantidad))}</span>
        </div>`).join('') : vacio('Todavía no hay movimientos.', '📒')}
    </div>`;
}
