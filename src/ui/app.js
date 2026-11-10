/**
 * Rutineitor v3 — arranque y orquestación.
 * Una sola raíz, un solo render, delegación de eventos por data-accion.
 */

import {
  esc, escAttr, $, aviso, modal, cerrarModal, confirmar, visorFoto, vacio,
} from './dom.js';
import {
  toDateKey, weekIdOf, addDays, fromDateKey, horaActual, creditos, hashClave, formatoFechaLarga, textoDuracion,
} from '../core/util.js';
import { crearStore, estadoVacio, COLECCIONES } from '../core/store.js';
import { catalogoInicial, CATEGORIAS } from '../core/defaults.js';
import {
  marcarTarea, desmarcarTarea, aprobarMarca, vetarMarca, evaluarObligatoria,
  procesarAutoAprobaciones, pendientesDeAprobacion, crearTareaPuntual,
  tareaPorId, marcaDe,
} from '../core/tasks.js';
import {
  solicitarCompra, aprobarCompra, denegarCompra, iniciarSesionPc, pararSesionPc, comprasDe,
} from '../core/leisure.js';
import { cerrarSemana, semanasPendientesDeCierre } from '../core/week.js';
import { AMBITOS_MULTIPLICADOR } from '../core/economy.js';
import { crearBloque, validarBloque, TIPOS_BLOQUE } from '../core/schedule.js';
import { crearEvento, validarEvento, recordatoriosInminentes, COLORES_EVENTO, mesAnterior, mesSiguiente } from '../core/calendar.js';
import { objetivosDe } from '../core/circadian.js';
import { puzzleDelDia, comprobar } from '../core/sudoku.js';
import {
  TEMAS, variablesTema, tema, momentoDelDia, crearMotor, escenaDe,
  fondoDeRespaldo, pintarMiniatura, idReal,
} from '../themes/themes.js';
import {
  cargarEstado, guardarEstado, guardarEstadoYa, borrarAlmacen, comprimirFoto,
  pedirPermisoNotificaciones, permisoNotificaciones, notificar, descargarTexto,
} from './services.js';
import { crearSync, abrirConfiguracionSync } from './sync.js';
import { generarResumenSemanal, nombreArchivoResumen } from './report.js';
import {
  vistaTareas, vistaHorario, vistaCalendario, vistaTienda,
  vistaJuego, vistaGuia, vistaAjustesNil,
} from './views-nil.js';
import {
  vistaInicio, vistaProgreso, vistaBilletes, vistaSalud, vistaAhorro,
} from './views-progreso.js';
import { vistaPadre } from './views-padre.js';
import {
  procesarStakings, abrirDeposito, romperDeposito, abrirApuesta, abrirStakingSueno,
  puedeAbrirDeposito, puedeApostar, puedeAbrirStakingSueno, porcentajeDePlazo, PLAZOS,
} from '../core/staking.js';
import { registrarSueno, registroSueno } from '../core/circadian.js';
import { registrarNocheEnStaking } from '../core/staking.js';
import { validarParametro, leerParametro } from '../core/tokenomics.js';
import { saldoHucha, saldoEstrellas, saldoCreditos, modoSaldo } from '../core/ledger.js';
import {
  migrarEconomia, migrarTienda, ajusteCuenta, anularMovimiento, historicoCSV, guardarEnHucha, sacarDeHucha,
  validarDiaPasado, fechaRecuperable, ajustarPrecios, tiendaPausada, cambiarInstrumento,
  MOTIVOS_FRECUENTES, DIAS_ATRAS, aplicarCategorias, editarCategoria, restaurarCategoria,
  esCategoriaDeFabrica, puedeSacarNil, ETIQUETA_CUENTA,
} from '../core/gestion.js';
import {
  nivelDe, registrarLogros, resumenRacha,
} from '../core/progreso.js';
import {
  misionesDelDia, misionSemanal, bonificacionDeMisiones, registrarMisionesCompletadas,
} from '../core/misiones.js';
import {
  estadoDeTemas, contarAbiertos, temaAbierto, temasNuevos, sembrarTemasVistos, regalarTema,
} from '../core/desbloqueos.js';
import {
  crearPropuesta, retirarPropuesta, aceptarPropuesta, rechazarPropuesta,
  contraofertar, aceptarContraoferta, esperandoAlPadre, esperandoANil,
  TIPOS_PROPUESTA, crearReto, retoDeLaSemana, RETOS,
} from '../core/propuestas.js';
import {
  tarjetaNivel, tarjetaRacha, tarjetaMisiones, vistaLogros, vistaPropuestas, tarjetaReto,
} from './views-juego.js';
import {
  configurarEfectos, celebrarMarca, celebrarGrande, celebrarNivel, contar, rebotar,
} from './celebrar.js';
import {
  necesitaConfiguracion, configuracionInicial, aplicarConfiguracion,
  saltarConfiguracion, reabrirConfiguracion, validarPaso,
} from '../core/onboarding.js';
import { vistaAsistente, PASOS } from './views-onboarding.js';

// __DEMO__ y __VERSION__ los fija el compilador (build.mjs) como literales,
// para que el código del build de demo se elimine de verdad y no quede ni
// mencionado en el archivo final.
export const ES_DEMO = __DEMO__;
export const VERSION = __VERSION__;

/* ------------------------------- Estado UI ------------------------------ */

const ui = {
  vista: 'inicio',
  modo: 'nil',
  // El asistente de primer uso vive aquí mientras se rellena: no se guarda
  // nada en el estado hasta que se confirma, para que salirse a medias no deje
  // la app medio configurada.
  asistente: { paso: 'bienvenida', datos: null, error: null },
  agendaTab: 'horario',
  tabPadre: 'aprobaciones',
  guiaTab: 'nil',
  fechaTareas: null,
  fechaCalendario: null,
  anioCalendario: null,
  mesCalendario: null,
  sudoku: null,
  sudokuSel: null,
  sudokuComprobado: false,
  sudokuMensaje: '',
  tkAbiertos: ['monedas'],
  // Economía (v3.5)
  ecoTab: 'resumen',
  ecoFiltros: {},
  ecoLimite: 60,
  diaPasado: null,
  catTab: 'tareas',
  dpSel: {},
  dpOp: {},
};

let store = null;
let sync = null;
let eventoInstalacion = null;
let motor = null;

function hoy() { return toDateKey(new Date()); }

function idTemaActual() {
  return idReal(ui.modo === 'padre'
    ? store.ajuste('temaPadre', 'pizarra')
    : store.ajuste('temaNil', 'bosque'));
}

function ctx() {
  const h = hoy();
  return {
    estado: store.estado, store, ui, sync,
    hoy: h, weekId: weekIdOf(h), modo: ui.modo,
  };
}

/* ------------------------------ Navegación ------------------------------ */

const NAV_NIL = [
  { id: 'inicio', ic: '🏠', et: 'Inicio' },
  { id: 'tareas', ic: '✅', et: 'Tareas' },
  { id: 'tienda', ic: '🎁', et: 'Tienda' },
  { id: 'agenda', ic: '📅', et: 'Agenda' },
  { id: 'mas', ic: '⚙️', et: 'Más' },
];

const NAV_PADRE = [
  { id: 'padre', ic: '🔐', et: 'Panel' },
  { id: 'tareas', ic: '✅', et: 'Tareas' },
  { id: 'agenda', ic: '📅', et: 'Agenda' },
  { id: 'guia', ic: '📖', et: 'Guía' },
  { id: 'mas', ic: '⚙️', et: 'Más' },
];

const TITULOS = {
  inicio: 'Mi panel', tareas: 'Mis tareas', tienda: 'Tienda', agenda: 'Agenda',
  mas: 'Más', progreso: 'Mi progreso', billetes: 'Mis billetes', salud: 'Cuidado',
  ahorro: 'Mi ahorro', juego: 'Sudoku del día', guia: 'Guía', ajustes: 'Ajustes',
  padre: 'Panel', logros: 'Mis logros', propuestas: 'Mis propuestas',
};

/* -------------------------------- Vistas -------------------------------- */

function vistaAgenda(c) {
  return `
    <div class="pestanas" role="tablist">
      <button role="tab" aria-selected="${ui.agendaTab === 'horario'}" data-accion="agenda-tab" data-tab="horario">Horario semanal</button>
      <button role="tab" aria-selected="${ui.agendaTab === 'calendario'}" data-accion="agenda-tab" data-tab="calendario">Calendario de citas</button>
    </div>
    ${ui.agendaTab === 'calendario' ? vistaCalendario(c) : vistaHorario(c)}`;
}

function vistaMas(c) {
  return `
    <div class="tarjeta">
      <h2>Más cosas</h2>
      <div class="rejilla dos">
        <button class="btn" data-accion="ir" data-vista="progreso">📊 Mi progreso</button>
        <button class="btn" data-accion="ir" data-vista="salud">🌿 Cuidado</button>
        <button class="btn" data-accion="ir" data-vista="ahorro">🐷 Ahorro y stakings</button>
        <button class="btn" data-accion="ir" data-vista="billetes">🎟️ Mis billetes</button>
        <button class="btn" data-accion="ir" data-vista="logros">🏅 Mis logros</button>
        <button class="btn" data-accion="ir" data-vista="propuestas">💡 Mis propuestas</button>
        <button class="btn" data-accion="ir" data-vista="juego">🧩 Sudoku del día</button>
        <button class="btn" data-accion="ir" data-vista="guia">📖 Guía de uso</button>
        <button class="btn" data-accion="ir" data-vista="ajustes">🎨 Tema y avisos</button>
        ${ui.modo === 'padre'
          ? '<button class="btn" data-accion="ir" data-vista="padre">🔐 Panel</button>'
          : '<button class="btn" data-accion="entrar-padre">🔐 Panel de papá</button>'}
      </div>
    </div>
    <div class="tarjeta compacta">
      <p class="mini tenue" style="margin:0">Rutineitor v${esc(VERSION)}${ES_DEMO ? ' · demo sin conexión' : ''}</p>
    </div>`;
}

const VISTAS = {
  inicio: vistaInicio,
  tareas: vistaTareas,
  tienda: vistaTienda,
  agenda: vistaAgenda,
  mas: vistaMas,
  progreso: vistaProgreso,
  billetes: vistaBilletes,
  salud: vistaSalud,
  ahorro: vistaAhorro,
  juego: vistaJuego,
  guia: vistaGuia,
  ajustes: vistaAjustesNil,
  logros: vistaLogros,
  propuestas: vistaPropuestas,
  padre: vistaPadre,
};

/* -------------------------------- Render -------------------------------- */

let pendienteRender = false;

export function render() {
  if (pendienteRender) return;
  pendienteRender = true;
  requestAnimationFrame(() => {
    pendienteRender = false;
    pintar();
  });
}

export function pintar() {
  // Los nombres e iconos propios de los grupos de tareas, antes de pintar nada.
  aplicarCategorias(store.estado);
  const c = ctx();
  const idTema = ui.modo === 'padre'
    ? (c.estado.ajustes?.temaPadre?.valor || 'pizarra')
    : (c.estado.ajustes?.temaNil?.valor || 'bosque');

  const raiz = $('#app');
  if (!raiz) return;
  raiz.setAttribute('style', variablesTema(idTema));
  raiz.classList.toggle('modo-padre', ui.modo === 'padre');

  // El fondo lo pinta el motor de escenas en su propio canvas. Aquí solo se
  // le dice qué escena y qué momento del día, y se deja un degradado de
  // respaldo por si el canvas no estuviera disponible.
  const fondo = $('#rt-fondo');
  const momento = momentoDelDia();
  if (fondo && (fondo.dataset.tema !== idTema || fondo.dataset.momento !== momento)) {
    fondo.style.background = fondoDeRespaldo(idTema, momento);
    fondo.dataset.tema = idTema;
    fondo.dataset.momento = momento;
    if (motor) motor.fijarTema(idTema, momento);
  }
  const metaTema = document.querySelector('meta[name="theme-color"]');
  if (metaTema) metaTema.setAttribute('content', tema(idTema).paleta.fondo);

  // Mientras la app no esté configurada, el asistente ocupa la pantalla entera:
  // sin barra de navegación ni cabecera, porque todavía no hay nada que navegar.
  if (necesitaConfiguracion(c.estado)) {
    if (!ui.asistente.datos) ui.asistente.datos = configuracionInicial(c.estado);
    raiz.innerHTML = vistaAsistente({ ...c, asistente: ui.asistente });
    return;
  }

  const nav = ui.modo === 'padre' ? NAV_PADRE : NAV_NIL;
  const vista = VISTAS[ui.vista] ? ui.vista : 'inicio';
  const nombre = c.estado.ajustes?.nombreHijo?.valor || 'Nil';
  const pendientes = ui.modo === 'padre'
    ? pendientesDeAprobacion(c.estado).length + comprasDe(c.estado).filter((x) => x.estado === 'pendiente').length
    : 0;
  // El saldo va en la cabecera, siempre a la vista. Además de ser útil, es lo
  // que le da un sitio fijo al número que sale volando al marcar una tarea:
  // antes solo existía en el panel de inicio y desde Tareas no volaba a ningún
  // sitio, que es justo la pantalla donde más se marca.
  const saldoCab = saldoCreditos(c.estado, c.hoy);
  const estrellasCab = saldoEstrellas(c.estado);

  raiz.innerHTML = `
    <header class="cabecera">
      <div class="crece">
        <h1>${esc(TITULOS[vista] || 'Rutineitor')}</h1>
        <div class="sub">${esc(ui.modo === 'padre' ? 'Modo padre' : `Hola, ${nombre}`)} · ${esc(formatoFechaLarga(c.hoy))}</div>
      </div>
      ${ES_DEMO ? '<span class="chip aviso">DEMO</span>' : ''}
      ${ui.modo === 'padre' ? '' : `
        <button class="saldo-cabecera" data-accion="ir" data-vista="inicio"
          aria-label="Mi saldo: ${escAttr(`${saldoCab} créditos y ${estrellasCab} estrellas`)}">
          <span class="par"><span aria-hidden="true">🟢</span><b data-saldo="semana">${esc(String(saldoCab))}</b></span>
          <span class="par"><span aria-hidden="true">⭐</span><b data-saldo="estrellas">${esc(String(estrellasCab))}</b></span>
        </button>
        <button class="ojo" data-accion="escaparate"
          title="Ver el fondo" aria-label="Ver el fondo a pantalla completa">👁</button>`}
    </header>
    <main class="contenido" id="rt-contenido">${VISTAS[vista](c)}</main>
    <nav class="nav" aria-label="Navegación principal">
      ${nav.map((n) => `<button data-accion="nav" data-vista="${escAttr(n.id)}"
        ${vista === n.id ? 'aria-current="page"' : ''}>
        <span class="ic" aria-hidden="true">${esc(n.ic)}</span>${esc(n.et)}
        ${n.id === 'padre' && pendientes ? `<span class="pastilla">${pendientes}</span>` : ''}
      </button>`).join('')}
    </nav>`;

  // Miniaturas del selector de temas: un único fotograma quieto por tema.
  for (const mini of document.querySelectorAll('canvas[data-tema-mini]')) {
    if (mini.dataset.pintada === '1') continue;
    if (pintarMiniatura(mini, escenaDe(mini.dataset.temaMini), 'noche')) {
      mini.dataset.pintada = '1';
    }
  }

  const chip = $('#rt-estado-notif');
  if (chip) {
    const p = permisoNotificaciones();
    chip.textContent = { granted: 'activados', denied: 'bloqueados', default: 'sin activar', unsupported: 'no disponibles' }[p] || p;
  }
}

/* ------------------------------- Acciones ------------------------------- */

function refrescar() { render(); }

const acciones = {
  nav(el) { ui.vista = el.dataset.vista; ui.sudokuMensaje = ''; if (ui.vista === 'juego') prepararSudoku(); refrescar(); },
  ir(el) { acciones.nav(el); },
  'agenda-tab': (el) => { ui.agendaTab = el.dataset.tab; refrescar(); },
  'tab-padre': (el) => { ui.tabPadre = el.dataset.tab; refrescar(); },
  'guia-tab': (el) => { ui.guiaTab = el.dataset.tab; refrescar(); },

  /**
   * Escaparate: aparta la interfaz durante unos segundos para ver el fondo
   * entero. Se sale tocando en cualquier sitio. Los fondos están muy
   * trabajados y detrás de las tarjetas solo se intuyen: esto es para verlos.
   */
  escaparate() {
    const app = document.querySelector('.app');
    if (!app || app.classList.contains('escaparate')) return;
    store.fijarAjuste('vecesEscaparate', Number(store.ajuste('vecesEscaparate', 0)) + 1);
    app.classList.add('escaparate');
    const salir = () => {
      app.classList.remove('escaparate');
      clearTimeout(reloj);
      document.removeEventListener('pointerdown', salir, true);
    };
    const reloj = setTimeout(salir, 6000);
    setTimeout(() => document.addEventListener('pointerdown', salir, true), 60);
  },

  'dia-tareas': (el) => {
    const base = ui.fechaTareas || hoy();
    const nueva = addDays(base, Number(el.dataset.delta));
    if (nueva > hoy()) return;
    ui.fechaTareas = nueva === hoy() ? null : nueva;
    refrescar();
  },

  /* ---------------------------- Tareas ---------------------------- */

  marcar(el) {
    const { tarea: tareaId, fecha } = el.dataset;
    const t = tareaPorId(store.estado, fecha, tareaId);
    if (!t) return;
    if (t.tipo === 'eleccion') { modalEleccion(t, fecha, [], el); return; }
    marcarConEfecto({ fecha, tareaId, boton: el });
  },

  desmarcar(el) {
    const marca = marcaDe(store.estado, el.dataset.fecha, el.dataset.tarea);
    if (!marca) return;
    const r = desmarcarTarea(store, marca.id);
    if (!r.ok) { aviso(r.razon, 'mal'); return; }
    refrescar();
  },

  'foto-tarea': (el) => {
    const { tarea: tareaId, fecha } = el.dataset;
    pedirFotos(2).then((fotos) => {
      if (!fotos.length) return;
      const t = tareaPorId(store.estado, fecha, tareaId);
      if (t && t.tipo === 'eleccion') { modalEleccion(t, fecha, fotos, el); return; }
      marcarConEfecto({ fecha, tareaId, fotos, boton: el, texto: 'Marcada con foto' });
    }).catch((e) => aviso(e.message, 'mal'));
  },

  'ver-foto': (el) => {
    const marca = store.obtener('marcas', el.dataset.marca);
    const idx = Number(el.dataset.srcIdx || 0);
    if (marca && marca.fotos && marca.fotos[idx]) visorFoto(marca.fotos[idx]);
  },

  /* ---------------------------- Tienda ---------------------------- */

  comprar(el) {
    const articulo = store.estado.tienda[el.dataset.articulo];
    if (!articulo) return;
    confirmar({
      titulo: `Pedir "${articulo.nombre}"`,
      texto: `${textoDuracion(articulo.duracion) ? `Son ${textoDuracion(articulo.duracion)}. ` : ''}Cuesta ${articulo.precio} ${articulo.moneda === 'estrellas' ? 'estrellas' : `créditos de ${articulo.moneda === 'hucha' ? 'la hucha' : 'tu saldo'}`}. ${articulo.requiereAprobacion === false ? '' : 'Papá tiene que aprobarlo.'}`,
      textoSi: 'Pedirlo',
    }).then((si) => {
      if (!si) return;
      const r = solicitarCompra(store, { itemId: articulo.id, fecha: hoy(), hora: horaActual() });
      aviso(r.ok ? 'Pedido. A esperar a papá.' : r.razon, r.ok ? 'bien' : 'mal');
      refrescar();
    });
  },

  'fijar-objetivo': (el) => {
    const actual = store.ajuste('objetivoAhorroId', null);
    const nuevo = actual === el.dataset.articulo ? null : el.dataset.articulo;
    store.fijarAjuste('objetivoAhorroId', nuevo);
    aviso(nuevo ? 'Objetivo fijado 🎯' : 'Objetivo quitado');
    refrescar();
  },

  'iniciar-pc': () => {
    const r = iniciarSesionPc(store, { fecha: hoy(), hora: horaActual() });
    aviso(r.ok ? 'Sesión de PC empezada' : r.razon, r.ok ? 'bien' : 'mal');
    refrescar();
  },

  'parar-pc': () => {
    const r = pararSesionPc(store, {});
    aviso(r.ok ? `${r.minutos} min · ${r.coste} créditos` : r.razon, r.ok ? 'bien' : 'mal');
    refrescar();
  },

  /* --------------------------- Calendario -------------------------- */

  mes(el) {
    const base = fromDateKey(ui.fechaCalendario || hoy());
    const anio = ui.anioCalendario ?? base.getFullYear();
    const mes = ui.mesCalendario ?? base.getMonth();
    const n = Number(el.dataset.delta) < 0 ? mesAnterior(anio, mes) : mesSiguiente(anio, mes);
    ui.anioCalendario = n.anio;
    ui.mesCalendario = n.mes;
    refrescar();
  },

  'dia-calendario': (el) => {
    ui.fechaCalendario = el.dataset.fecha;
    const d = fromDateKey(el.dataset.fecha);
    ui.anioCalendario = d.getFullYear();
    ui.mesCalendario = d.getMonth();
    refrescar();
  },

  'nuevo-evento': (el) => modalEvento(null, el.dataset.fecha || hoy()),
  'editar-evento': (el) => modalEvento(store.obtener('eventos', el.dataset.evento)),

  /* ---------------------------- Horario ---------------------------- */

  'nuevo-bloque': () => modalBloque(null),
  'editar-bloque': (el) => modalBloque(store.obtener('horario', el.dataset.bloque)),

  /* --------------------- Asistente de primer uso -------------------- */

  'asis-siguiente': () => {
    recogerAsistente();
    const problema = validarPaso(ui.asistente.paso, ui.asistente.datos);
    if (problema) { ui.asistente.error = problema; pintar(); return; }
    const i = PASOS.indexOf(ui.asistente.paso);
    ui.asistente.paso = PASOS[Math.min(PASOS.length - 1, i + 1)];
    ui.asistente.error = null;
    pintar();
  },

  'asis-atras': () => {
    recogerAsistente();
    const i = PASOS.indexOf(ui.asistente.paso);
    ui.asistente.paso = PASOS[Math.max(0, i - 1)];
    ui.asistente.error = null;
    pintar();
  },

  'asis-terminar': () => {
    recogerAsistente();
    const r = aplicarConfiguracion(store, ui.asistente.datos);
    if (!r.ok) {
      ui.asistente.paso = r.paso;
      ui.asistente.error = r.razon;
      pintar();
      return;
    }
    ui.asistente = { paso: 'bienvenida', datos: null, error: null };
    ui.vista = 'inicio';
    aviso(`¡Listo! La app ya es de ${store.ajuste('nombreHijo', 'Nil')} 🎉`, 'bien');
    refrescar();
    celebrarGrande({ pulso: 1 });
  },

  'asis-saltar': () => {
    saltarConfiguracion(store);
    ui.asistente = { paso: 'bienvenida', datos: null, error: null };
    aviso('Puedes configurarlo cuando quieras desde el panel', '');
    refrescar();
  },

  'reabrir-asistente': async () => {
    const si = await confirmar({
      titulo: 'Volver a configurar',
      texto: 'Se abre otra vez el asistente del principio. No se pierde nada de lo ya conseguido: los créditos, la racha y el historial se quedan como están.',
      textoSi: 'Abrir el asistente',
    });
    if (!si) return;
    reabrirConfiguracion(store);
    ui.asistente = { paso: 'bienvenida', datos: null, error: null };
    refrescar();
  },

  /* ------------------------- Propuestas de Nil ---------------------- */

  'nueva-propuesta': () => modalPropuesta(),

  'retirar-propuesta': (el) => {
    const r = retirarPropuesta(store, el.dataset.id);
    aviso(r.ok ? 'Propuesta retirada' : r.razon, r.ok ? '' : 'mal');
    refrescar();
  },

  'aceptar-contra': (el) => {
    const p = store.obtener('propuestas', el.dataset.id);
    if (!p) return;
    confirmar({
      titulo: 'Trato hecho',
      texto: `Papá te ofrece ${p.contraoferta} en vez de ${p.valor}. ¿Lo aceptas?`,
      textoSi: 'Trato hecho',
    }).then((si) => {
      if (!si) return;
      const r = aceptarContraoferta(store, el.dataset.id);
      aviso(r.ok ? '¡Hecho! Ya está en la app' : r.razon, r.ok ? 'bien' : 'mal');
      refrescar();
      revisarProgreso({ origen: el });
    });
  },

  /* --------------- Propuestas: lo que hace el padre ----------------- */

  'aceptar-propuesta': (el) => {
    const r = aceptarPropuesta(store, el.dataset.id);
    aviso(r.ok ? 'Aceptada y aplicada' : r.razon, r.ok ? 'bien' : 'mal');
    refrescar();
  },

  'rechazar-propuesta': (el) => modalRespuestaPropuesta(el.dataset.id, 'rechazar'),
  'contraofertar': (el) => modalRespuestaPropuesta(el.dataset.id, 'contraoferta'),

  /* ------------------------ Reto de la casa ------------------------- */

  'nuevo-reto': () => modalReto(),

  /* ----------------------------- Tema ------------------------------ */

  tema(el) {
    const id = el.dataset.tema;
    // El padre puede usar cualquiera; Nil, solo los que tenga desbloqueados.
    if (ui.modo !== 'padre' && !temaAbierto(store.estado, id, TEMAS)) {
      aviso('Ese fondo todavía no está desbloqueado', 'mal');
      return;
    }
    store.fijarAjuste(ui.modo === 'padre' ? 'temaPadre' : 'temaNil', id);
    if (motor) motor.fijarTema(id, momentoDelDia());
    refrescar();
  },

  calidad(el) {
    const v = el.dataset.calidad;
    store.fijarAjuste('calidadFondo', v);
    if (motor) motor.fijarCalidad(v);
    aviso('Calidad del fondo actualizada', 'bien');
    refrescar();
  },

  'permiso-notificaciones': async () => {
    const p = await pedirPermisoNotificaciones();
    store.fijarAjuste('notificaciones', p === 'granted');
    aviso(p === 'granted' ? 'Avisos activados (solo con la app abierta)' : 'No se han activado', p === 'granted' ? 'bien' : 'mal');
    refrescar();
  },

  instalar: () => {
    if (!eventoInstalacion) {
      aviso('Usa el menú del navegador → Instalar aplicación', '');
      return;
    }
    eventoInstalacion.prompt();
    eventoInstalacion = null;
  },

  /* ----------------------------- Padre ----------------------------- */

  'entrar-padre': () => modalClave(),
  'salir-padre': () => { ui.modo = 'nil'; ui.vista = 'inicio'; refrescar(); },

  'aprobar-marca': (el) => {
    const marca = store.obtener('marcas', el.dataset.marca);
    if (!marca) return;
    const antes = instantaneaProgreso();
    if (marca.tipo === 'obligatoria') evaluarObligatoria(store, marca.id, true);
    else aprobarMarca(store, marca.id);
    refrescar();
    revisarProgreso({ antes, origen: el });
  },

  'aprobar-con-nota': (el) => {
    const marca = store.obtener('marcas', el.dataset.marca);
    if (!marca) return;
    modalNotaAprobacion(marca, el);
  },

  'vetar-marca': (el) => {
    const marca = store.obtener('marcas', el.dataset.marca);
    if (!marca) return;
    modalMotivo({
      titulo: `Vetar "${marca.nombre}"`,
      texto: marca.tipo === 'obligatoria'
        ? 'No mueve créditos, pero contará como no cumplida. Nil verá el motivo.'
        : 'Se revierte el crédito automáticamente. Nil verá el motivo.',
      al: (motivo) => {
        if (marca.tipo === 'obligatoria') evaluarObligatoria(store, marca.id, false, motivo);
        else vetarMarca(store, marca.id, motivo);
        refrescar();
      },
    });
  },

  'aprobar-todo': async () => {
    const lista = pendientesDeAprobacion(store.estado);
    const si = await confirmar({ titulo: 'Aprobar todas', texto: `Se aprobarán ${lista.length} tareas pendientes.`, textoSi: 'Aprobar' });
    if (!si) return;
    store.lote(() => {
      for (const m of lista) {
        if (m.tipo === 'obligatoria') evaluarObligatoria(store, m.id, true);
        else aprobarMarca(store, m.id);
      }
    });
    aviso(`${lista.length} aprobadas`, 'bien');
    refrescar();
  },

  'aprobar-compra': (el) => { aprobarCompra(store, el.dataset.compra); refrescar(); },

  'denegar-compra': (el) => {
    const compra = store.obtener('compras', el.dataset.compra);
    if (!compra) return;
    modalMotivo({
      titulo: `Denegar "${compra.nombre}"`,
      texto: 'Se le devuelven los créditos al momento. Nil verá el motivo.',
      al: (motivo) => { denegarCompra(store, compra.id, motivo); refrescar(); },
    });
  },

  'ajuste-manual': (el) => modalAjuste({
    modo: el?.dataset?.modo || 'sumar', fecha: el?.dataset?.fecha || null, cuenta: el?.dataset?.cuenta || 'semana',
  }),
  'tarea-puntual': (el) => modalTareaPuntual(el?.dataset?.fecha || null),

  /* ------------------------- Economía (v3.5) ---------------------- */

  'eco-tab': (el) => { ui.tabPadre = 'economia'; ui.ecoTab = el.dataset.tab; ui.ecoLimite = 60; refrescar(); },
  'cat-tab': (el) => { ui.catTab = el.dataset.tab; refrescar(); },
  'limpiar-filtros': () => { ui.ecoFiltros = {}; ui.ecoLimite = 60; refrescar(); },
  'mas-movimientos': () => { ui.ecoLimite = (ui.ecoLimite || 60) + 60; refrescar(); },
  'exportar-csv': () => {
    descargarTexto(`rutineitor-historico-${hoy()}.csv`, `\ufeff${historicoCSV(store.estado, ui.ecoFiltros || {})}`, 'text/csv;charset=utf-8');
    aviso('Histórico descargado', 'bien');
  },
  'anular-mov': (el) => {
    const m = store.obtener('ledger', el.dataset.mov);
    if (!m) return;
    modalMotivo({
      titulo: 'Anular un movimiento',
      texto: `«${m.concepto}» (${m.cantidad >= 0 ? '+' : ''}${m.cantidad} en ${ETIQUETA_CUENTA[m.cuenta] || m.cuenta}). No se borra: se añade una anulación con tu motivo, y Nil la verá.`,
      al: (motivo) => {
        const r = anularMovimiento(store, m.id, motivo);
        if (!r.ok) { aviso(r.razon, 'mal'); return; }
        aviso('Movimiento anulado', 'bien');
        refrescar();
      },
    });
  },
  'traspaso-padre': () => modalTraspaso({ actor: 'padre' }),
  'guardar-hucha': () => modalTraspaso({ actor: 'nil', direccion: 'guardar' }),
  'sacar-hucha': () => modalTraspaso({ actor: 'nil', direccion: 'sacar' }),
  'precios-bloque': () => modalPreciosBloque(),
  'pausar-tienda': () => {
    const pausada = tiendaPausada(store.estado);
    store.fijarAjuste('tiendaPausada', !pausada);
    aviso(pausada ? 'Tienda abierta otra vez' : 'Tienda en pausa', 'bien');
    refrescar();
  },
  instrumento: (el) => {
    const r = cambiarInstrumento(store, el.dataset.id, el.dataset.on === '1');
    if (!r.ok) { aviso(r.razon, 'mal'); return; }
    aviso(el.dataset.on === '1' ? 'Encendido' : 'Apagado', 'bien');
    refrescar();
  },
  'dia-pasado': (el) => { ui.diaPasado = el.dataset.fecha; refrescar(); },
  'dp-todas': () => {
    for (const x of document.querySelectorAll('[data-dp-tarea]')) {
      x.checked = true;
      ui.dpSel[`${x.dataset.dpFecha}|${x.dataset.dpTarea}`] = true;
    }
    refrescar();
  },
  'validar-dia-pasado': (el) => {
    const fecha = el.dataset.fecha;
    const items = [...document.querySelectorAll('[data-dp-tarea]')].filter((x) => x.checked).map((x) => {
      const op = [...document.querySelectorAll('[data-dp-op]')].find((o) => o.dataset.dpOp === x.dataset.dpTarea);
      return { tareaId: x.dataset.dpTarea, opcionId: op ? op.value : null };
    });
    if (!items.length) { aviso('Marca al menos una tarea', 'mal'); return; }
    const r = validarDiaPasado(store, { fecha, items, hoy: hoy() });
    if (!r.ok) { aviso(r.razon || (r.errores || []).join(' · '), 'mal'); return; }
    ui.dpSel = {};
    ui.dpOp = {};
    aviso(`${r.hechas} tarea${r.hechas === 1 ? '' : 's'} validada${r.hechas === 1 ? '' : 's'} · +${creditos(r.creditos)}${r.racha !== null && r.racha !== undefined ? ` · racha ${r.racha}` : ''}`, 'bien');
    if (r.errores && r.errores.length) aviso(r.errores.join(' · '), 'mal');
    refrescar();
  },
  'editar-categoria': (el) => modalCategoria(el.dataset.cat),
  'nueva-categoria': () => modalCategoria(null),
  multiplicador: () => modalMultiplicador(),
  'descargar-resumen': () => {
    const wid = weekIdOf(hoy());
    const html = generarResumenSemanal(store.estado, wid, {
      hastaFecha: hoy(),
      nombreHijo: store.ajuste('nombreHijo', 'Nil'),
    });
    descargarTexto(nombreArchivoResumen(wid), html);
    aviso('Resumen descargado', 'bien');
  },

  'nueva-tarea': (el) => modalTarea(null, { categoria: el?.dataset?.cat || null }),
  'editar-tarea': (el) => modalTarea(store.obtener('tareas', el.dataset.tarea)),
  'aviso-tienda-visto': () => { store.fijarAjuste('avisoTiendaVisto', true); refrescar(); },
  'nuevo-premio': (el) => modalPremio(null, { moneda: el?.dataset?.moneda || null, tipo: el?.dataset?.tipo || null }),
  'editar-premio': (el) => modalPremio(store.obtener('tienda', el.dataset.articulo)),

  'cerrar-semana': async () => {
    const si = await confirmar({
      titulo: 'Cerrar la semana',
      texto: modoSaldo(store.estado) === 'semanal'
        ? 'Lo que sobre del saldo de la semana pasará a la hucha y se actualizará la racha. El calendario, el horario y los precios no se tocan.'
        : 'Se archiva la semana y se actualiza la racha. Los créditos de Nil se quedan donde están. El calendario, el horario y los precios no se tocan.',
      textoSi: 'Cerrar',
    });
    if (!si) return;
    const wid = weekIdOf(hoy());
    const antes = instantaneaProgreso();
    const r = cerrarSemana(store, { fecha: hoy() });
    if (r.ok) {
      // Al cerrar se descarga el resumen automáticamente: queda archivado
      // aunque después se reinicie la app.
      descargarTexto(
        nombreArchivoResumen(wid),
        generarResumenSemanal(store.estado, wid, { nombreHijo: store.ajuste('nombreHijo', 'Nil') }),
      );
    }
    aviso(r.ok
      ? `Semana cerrada · ${r.traspasado > 0 ? `+${r.traspasado} a la hucha` : 'sin sobrante'} · racha ${r.racha}`
      : r.razon, r.ok ? 'bien' : 'mal');
    if (r.ok) {
      // El escudo se gasta solo, sin preguntar. Pero hay que contarlo: si no,
      // parece que la racha aguantó por arte de magia y el escudo no enseña nada.
      if (r.escudoUsado) {
        aviso('Un escudo te ha salvado la racha 🛡️ Te queda ' + r.escudos, 'bien');
      }
      if (r.escudoGanado) aviso('Has ganado un escudo de racha 🛡️', 'bien');
      if (r.hito) {
        aviso(`¡Hito de ${r.hito} semanas! 🔥`, 'bien');
        celebrarGrande({ pulso: 1 });
      }
      if (r.reto) {
        aviso(r.reto.estado === 'ganado'
          ? `Reto de la casa ganado: ${r.reto.premio} 🎉`
          : 'El reto de la casa se ha quedado a medias. La semana que viene, otro.',
        r.reto.estado === 'ganado' ? 'bien' : '');
        if (r.reto.estado === 'ganado') celebrarGrande({ pulso: 1 });
      }
      revisarProgreso({ antes });
    }
    refrescar();
  },

  'cerrar-pendientes': async () => {
    const pend = semanasPendientesDeCierre(store.estado, hoy());
    const si = await confirmar({ titulo: 'Cerrar semanas anteriores', texto: `Se cerrarán ${pend.length}: ${pend.join(', ')}.`, textoSi: 'Cerrar todas' });
    if (!si) return;
    for (const w of pend) cerrarSemana(store, { fecha: w });
    aviso('Semanas cerradas', 'bien');
    refrescar();
  },

  'config-sync': () => abrirConfiguracionSync({ sync, alGuardar: refrescar }),

  /* ------------------------- Sueño y stakings ---------------------- */

  'apuntar-noche': (el) => modalNoche(Boolean(el.dataset.forzar)),
  'abrir-deposito': () => modalDeposito(),
  'abrir-sueno': () => modalStakingSueno(),
  'abrir-apuesta': () => modalApuesta(),
  'romper-deposito': async (el) => {
    const st = store.obtener('stakings', el.dataset.staking);
    if (!st) return;
    const devuelve = leerParametro(store.estado, 'depositoRescateDevuelveCapital', true);
    const si = await confirmar({
      titulo: 'Romper el depósito',
      texto: devuelve
        ? `Recuperas los ${st.capital} créditos, pero pierdes el interés que ibas a cobrar.`
        : `Perderías el interés y el capital. Piénsatelo.`,
      textoSi: 'Romperlo', peligro: true,
    });
    if (!si) return;
    const r = romperDeposito(store, st.id, { fecha: hoy() });
    aviso(r.ok ? `Depósito roto · vuelven ${r.devuelto}` : r.razon, r.ok ? 'bien' : 'mal');
    refrescar();
  },
  'sincronizar-ya': async () => { await sync.sincronizarAhora(); aviso(sync.estado.mensaje); refrescar(); },
  'cambiar-clave': () => modalClave({ cambiar: true }),
  exportar: () => {
    descargarTexto(
      `rutineitor-copia-${hoy()}.json`,
      JSON.stringify(store.instantanea(), null, 1),
      'application/json',
    );
    aviso('Copia descargada', 'bien');
  },
  importar: () => modalImportar(),
  reiniciar: () => modalReinicio(),

  /* ----------------------------- Sudoku ---------------------------- */

  'celda-sudoku': (el) => {
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    if (ui.sudoku.fijas[r][c]) return;
    ui.sudokuSel = [r, c];
    refrescar();
  },

  'num-sudoku': (el) => {
    if (!ui.sudokuSel) { aviso('Elige primero una casilla'); return; }
    const [r, c] = ui.sudokuSel;
    ui.sudoku.tablero[r][c] = Number(el.dataset.n);
    guardarSudoku();
    refrescar();
  },

  'comprobar-sudoku': () => {
    const res = comprobar(ui.sudoku.tablero, ui.sudoku.solucion);
    ui.sudokuComprobado = true;
    ui.sudokuMensaje = res.resuelto
      ? '¡Resuelto! 🎉'
      : `${res.correctas} bien, ${res.erroneas} mal, ${res.vacias} por poner.`;
    if (res.resuelto) {
      store.fijarAjuste('sudokusResueltos', Number(store.ajuste('sudokusResueltos', 0)) + 1);
      celebrarGrande({ tipo: 'doble', pulso: 0.6 });
      revisarProgreso({});
    }
    refrescar();
  },

  'pista-sudoku': () => {
    const vacias = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!ui.sudoku.tablero[r][c]) vacias.push([r, c]);
    if (!vacias.length) { aviso('No queda ninguna vacía'); return; }
    const [r, c] = vacias[Math.floor(Math.random() * vacias.length)];
    ui.sudoku.tablero[r][c] = ui.sudoku.solucion[r][c];
    ui.sudoku.fijas[r][c] = true;
    guardarSudoku();
    refrescar();
  },

  'reiniciar-sudoku': async () => {
    const si = await confirmar({ titulo: 'Reiniciar el sudoku', texto: 'Se borra lo que llevas de hoy.', textoSi: 'Reiniciar' });
    if (!si) return;
    localStorage.removeItem(claveSudoku());
    ui.sudoku = null;
    prepararSudoku();
    refrescar();
  },
};

/* -------------------------------- Modales ------------------------------- */

/** Lee de Ajustes si el juice y el sonido están encendidos y se lo dice al módulo. */
function aplicarPreferenciasDeEfectos() {
  configurarEfectos({
    ajustes: () => ({
      efectos: store.ajuste('efectosActivos', true),
      sonido: store.ajuste('sonidoActivo', false),
    }),
    motor,
  });
}

/**
 * Aprobar diciendo algo. Aprobar a secas es un sello de goma; una frase de
 * cuatro palabras convierte el panel en una persona. Hay atajos para que no
 * cueste más que pulsar dos veces, y se puede escribir lo que sea.
 */
const NOTAS_RAPIDAS = [
  '¡Muy bien!', 'Gracias, de verdad', 'Te ha quedado genial',
  'Sin que te lo dijera 👏', 'Qué rápido', 'Me has ayudado mucho hoy',
];

function modalNotaAprobacion(marca, origen) {
  const m = modal({
    titulo: `Aprobar "${marca.nombre}"`,
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">Nil verá esto en su lista, debajo de la tarea.</p>
      <div class="pila" style="margin-bottom:10px">
        ${NOTAS_RAPIDAS.map((n) => `
          <button class="btn pequeno fantasma" data-rapida="${escAttr(n)}">${esc(n)}</button>`).join('')}
      </div>
      <label class="campo"><span>O escríbele tú</span>
        <input type="text" data-nota maxlength="140" placeholder="Lo de la cocina estaba impecable">
      </label>`,
    acciones: [
      { texto: 'Aprobar sin nota', clase: 'fantasma' },
      { texto: 'Aprobar' },
    ],
  });

  const campo = m.querySelector('[data-nota]');
  m.addEventListener('click', (ev) => {
    const r = ev.target.closest('[data-rapida]');
    if (!r) return;
    campo.value = r.dataset.rapida;
  });

  const cerrarYAprobar = (nota) => {
    const antes = instantaneaProgreso();
    cerrarModal();
    if (marca.tipo === 'obligatoria') evaluarObligatoria(store, marca.id, true);
    else aprobarMarca(store, marca.id, { nota });
    aviso(nota ? 'Aprobada, con tu nota' : 'Aprobada', 'bien');
    refrescar();
    revisarProgreso({ antes, origen });
  };

  const botones = m.querySelectorAll('[data-accion-modal]');
  botones[0].addEventListener('click', () => cerrarYAprobar(''));
  botones[1].addEventListener('click', () => cerrarYAprobar(campo.value));
}

/**
 * Lee del DOM lo que haya escrito en el paso actual del asistente. Se llama
 * antes de cualquier cambio de paso, para que volver atrás no borre nada de lo
 * ya puesto.
 */
function recogerAsistente() {
  const d = ui.asistente.datos;
  if (!d) return;
  for (const el of document.querySelectorAll('[data-campo]')) {
    const k = el.dataset.campo;
    d[k] = el.type === 'checkbox' ? el.checked : el.value;
  }
  const grupos = new Set();
  for (const el of document.querySelectorAll('[data-grupo]')) grupos.add(el.dataset.grupo);
  for (const g of grupos) {
    const marcados = [...document.querySelectorAll(`[data-grupo="${g}"]:checked`)]
      .map((el) => (g === 'diasColegio' ? Number(el.value) : el.value));
    d[g] = marcados;
  }
}

/* ------------------------- Modales de propuestas ----------------------- */

/**
 * Nil propone algo. El formulario cambia según qué esté proponiendo, pero el
 * motivo es obligatorio siempre: es lo que convierte "quiero más" en un
 * argumento, y lo que le da al padre algo a lo que contestar.
 */
function modalPropuesta() {
  const tareas = Object.values(store.estado.tareas || {})
    .filter((t) => t.tipo !== 'habito')
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));

  const m = modal({
    titulo: 'Proponer algo',
    cuerpo: `
      <label class="campo">
        <span>¿Qué quieres proponer?</span>
        <select data-tipo>
          ${Object.values(TIPOS_PROPUESTA).map((t) => `
            <option value="${escAttr(t.id)}">${esc(`${t.emoji} ${t.etiqueta}`)}</option>`).join('')}
        </select>
      </label>
      <p class="mini tenue" data-ayuda style="margin:-4px 0 10px">${esc(TIPOS_PROPUESTA.tarea.ayuda)}</p>

      <div data-campo="nombre">
        <label class="campo"><span>¿Cómo se llama?</span>
          <input type="text" data-nombre maxlength="60" placeholder="Recoger la mesa del salón">
        </label>
      </div>

      <div data-campo="tarea" hidden>
        <label class="campo"><span>¿Cuál?</span>
          <select data-tarea>
            ${tareas.map((t) => `<option value="${escAttr(t.id)}">${esc(`${t.nombre} (ahora ${t.valor})`)}</option>`).join('')}
          </select>
        </label>
      </div>

      <label class="campo"><span data-etq-valor>¿Cuánto crees que debería valer?</span>
        <input type="number" data-valor min="0" max="900" step="1" value="5">
      </label>

      <div data-campo="moneda" hidden>
        <label class="campo"><span>¿Con qué se paga?</span>
          <select data-moneda>
            <option value="semana">Créditos de la semana</option>
            <option value="hucha">Créditos de la hucha</option>
            <option value="estrellas">Estrellas</option>
          </select>
        </label>
      </div>

      <label class="campo"><span>¿Por qué? (esto lo lee papá)</span>
        <textarea data-motivo rows="3" maxlength="300"
          placeholder="Lo hago casi todos los días y no está en la lista..."></textarea>
      </label>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      { texto: 'Enviar a papá' },
    ],
  });

  const sel = (q) => m.querySelector(q);
  const refrescarCampos = () => {
    const tipo = sel('[data-tipo]').value;
    sel('[data-ayuda]').textContent = TIPOS_PROPUESTA[tipo].ayuda;
    sel('[data-campo="nombre"]').hidden = tipo === 'valor';
    sel('[data-campo="tarea"]').hidden = tipo !== 'valor';
    sel('[data-campo="moneda"]').hidden = tipo !== 'premio';
    sel('[data-etq-valor]').textContent = tipo === 'premio'
      ? '¿Cuánto debería costar?'
      : '¿Cuánto crees que debería valer?';
  };
  sel('[data-tipo]').addEventListener('change', refrescarCampos);
  refrescarCampos();

  m.querySelectorAll('[data-accion-modal]')[1].addEventListener('click', () => {
    const r = crearPropuesta(store, {
      tipo: sel('[data-tipo]').value,
      nombre: sel('[data-nombre]').value,
      tareaId: sel('[data-tarea]') ? sel('[data-tarea]').value : null,
      valor: Number(sel('[data-valor]').value),
      moneda: sel('[data-moneda]') ? sel('[data-moneda]').value : 'semana',
      motivo: sel('[data-motivo]').value,
      fecha: hoy(),
    });
    if (!r.ok) { aviso(r.razon, 'mal'); return; }
    cerrarModal();
    aviso('Enviada. Papá te contesta pronto 💡', 'bien');
    refrescar();
    revisarProgreso({});
  });
}

/** El padre rechaza (con motivo obligatorio) o contraoferta. */
function modalRespuestaPropuesta(id, accion) {
  const p = store.obtener('propuestas', id);
  if (!p) return;
  const esRechazo = accion === 'rechazar';

  const m = modal({
    titulo: esRechazo ? 'Decir que no' : 'Hacer una contraoferta',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">${esc(p.motivo)}</p>
      ${esRechazo ? '' : `<label class="campo"><span>Tu número</span>
        <input type="number" data-valor min="0" max="900" step="1" value="${escAttr(String(p.valor))}">
      </label>`}
      <label class="campo">
        <span>${esc(esRechazo ? 'Por qué no (obligatorio)' : 'Una nota, si quieres')}</span>
        <textarea data-nota rows="3" maxlength="300"
          placeholder="${escAttr(esRechazo
    ? 'Un no sin explicación no enseña nada. Dile por qué.'
    : 'Me parece bien la idea, pero...')}"></textarea>
      </label>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      { texto: esRechazo ? 'Rechazar' : 'Enviar contraoferta', clase: esRechazo ? 'peligro' : '' },
    ],
  });

  m.querySelectorAll('[data-accion-modal]')[1].addEventListener('click', () => {
    const nota = m.querySelector('[data-nota]').value;
    const r = esRechazo
      ? rechazarPropuesta(store, id, nota)
      : contraofertar(store, id, { valor: Number(m.querySelector('[data-valor]').value), nota });
    if (!r.ok) { aviso(r.razon, 'mal'); return; }
    cerrarModal();
    aviso(esRechazo ? 'Rechazada, con tu explicación' : 'Contraoferta enviada', 'bien');
    refrescar();
  });
}

/** El reto semanal de la casa. */
function modalReto() {
  const m = modal({
    titulo: 'Reto de la casa',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">
        Un reto para toda la semana, que Nil ve avanzar en su pantalla. Si no sale
        no pasa nada: no hay castigo, solo el premio que pongas en juego.
      </p>
      <label class="campo"><span>¿Qué se mide?</span>
        <select data-tipo>
          ${Object.values(RETOS).map((r) => `
            <option value="${escAttr(r.id)}">${esc(`${r.emoji} ${r.etiqueta}`)}</option>`).join('')}
        </select>
      </label>
      <label class="campo"><span>¿Cuántos hacen falta?</span>
        <input type="number" data-meta min="1" max="100" step="1" value="5">
      </label>
      <label class="campo"><span>¿Qué hay en juego?</span>
        <input type="text" data-premio maxlength="80" placeholder="Pizza y peli el sábado">
      </label>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      { texto: 'Lanzar el reto' },
    ],
  });

  m.querySelectorAll('[data-accion-modal]')[1].addEventListener('click', () => {
    const r = crearReto(store, {
      tipo: m.querySelector('[data-tipo]').value,
      meta: Number(m.querySelector('[data-meta]').value),
      premio: m.querySelector('[data-premio]').value,
      fecha: hoy(),
    });
    if (!r.ok) { aviso(r.razon, 'mal'); return; }
    cerrarModal();
    aviso('Reto lanzado 🎯', 'bien');
    refrescar();
  });
}

/* ---------------------- Marcar, con todo el ruido ---------------------- */

/**
 * Marcar una tarea es el gesto que más veces se repite en la app, así que es
 * donde más se nota el cuidado. Aquí va todo lo que pasa en ese segundo:
 * se aplica la bonificación de las misiones, vuela el número hasta el saldo,
 * el saldo cuenta hacia arriba, vibra, suena, y si eso ha cerrado el día o ha
 * subido de nivel, se celebra de verdad.
 *
 * Nada de esto puede impedir que la tarea se marque: los efectos son la
 * guinda, el registro es lo importante.
 */
function marcarConEfecto({ fecha, tareaId, opcionId = null, fotos = [], boton = null, texto = null }) {
  const antes = instantaneaProgreso();
  // Las misiones cumplidas hacen que lo de hoy valga más. Se calcula aquí,
  // en la capa de acciones, para que el núcleo siga sin dependencias cruzadas.
  const bonificacion = bonificacionDeMisiones(store.estado, fecha).extra;
  const r = marcarTarea(store, { fecha, tareaId, opcionId, fotos, bonificacion });
  if (!r.ok) { aviso(r.razon, 'mal'); return; }

  const esEstrella = r.moneda === 'estrellas';
  const cartel = texto || (r.valor > 0
    ? `+${r.valor} ${esEstrella ? 'estrellas' : 'créditos'}`
    : 'Marcada');
  aviso(cartel, 'bien');
  refrescar();
  efectosDeMarcado({ antes, valor: r.valor, esEstrella, boton, fecha });
}

/** Lo que había antes de marcar, para saber qué ha cambiado y celebrarlo. */
function instantaneaProgreso() {
  const e = store.estado;
  return {
    semana: saldoCreditos(e, hoy()),
    estrellas: saldoEstrellas(e),
    nivel: nivelDe(e).nivel,
    temas: contarAbiertos(e, TEMAS).abiertos,
    misiones: bonificacionDeMisiones(e, hoy()).completadas,
  };
}

function efectosDeMarcado({ antes, valor, esEstrella, boton, fecha }) {
  const ahora = instantaneaProgreso();
  const destino = document.querySelector(esEstrella
    ? '[data-saldo="estrellas"]'
    : '[data-saldo="semana"]');

  if (valor > 0 && destino) {
    celebrarMarca({
      boton,
      destino,
      texto: `+${valor}`,
      saldo: destino,
    });
    const desde = esEstrella ? antes.estrellas : antes.semana;
    const hasta = esEstrella ? ahora.estrellas : ahora.semana;
    contar(destino, desde, hasta);
  } else {
    celebrarMarca({ boton, destino, texto: '✓' });
  }

  // Las misiones que se hayan completado con este marcado.
  registrarMisionesCompletadas(store, fecha);
  if (ahora.misiones > antes.misiones) {
    aviso('¡Misión cumplida! Lo de hoy vale más 📜', 'bien');
    celebrarGrande({ origen: boton, tipo: 'doble', pulso: 0.6 });
  }

  revisarProgreso({ antes, origen: boton });
}

/**
 * Comprueba si se ha subido de nivel, si se ha desbloqueado un fondo o si hay
 * logros nuevos, y lo celebra. Se llama después de cualquier cosa que pueda
 * hacer progresar: marcar, aprobar, cerrar la semana.
 */
function revisarProgreso({ antes = null, origen = null } = {}) {
  const e = store.estado;
  const n = nivelDe(e);

  if (antes && n.nivel > antes.nivel) {
    aviso(`¡Nivel ${n.nivel}: ${n.nombre}! 🎉`, 'bien');
    celebrarNivel({ origen });
  }

  const nuevos = temasNuevos(store, TEMAS);
  for (const t of nuevos) {
    aviso(`Fondo desbloqueado: ${t.nombre} ${t.emoji}`, 'bien');
  }
  if (nuevos.length) celebrarGrande({ origen, pulso: 1 });

  const { abiertos, total } = contarAbiertos(e, TEMAS);
  const logros = registrarLogros(store, {
    hucha: saldoHucha(e),
    nivel: n.nivel,
    temasDesbloqueados: abiertos,
    temasTotales: total,
  }, hoy());
  for (const l of logros) aviso(`Logro: ${l.nombre} ${l.emoji}`, 'bien');
  if (logros.length && !nuevos.length) celebrarGrande({ origen, tipo: 'doble', pulso: 0.7 });

  if (nuevos.length || logros.length) refrescar();
}

function modalEleccion(tarea, fecha, fotos = [], boton = null) {
  const m = modal({
    titulo: tarea.nombre,
    cuerpo: `<p class="mini tenue" style="margin-top:0">Elige tú cómo lo has hecho. Papá solo puede aprobar o vetar tu elección.</p>
      <div class="pila">
        ${(tarea.opciones || []).map((o) => `
          <button class="btn bloque" data-opcion="${escAttr(o.id)}">
            ${esc(o.etiqueta)} <b style="margin-left:6px">+${o.valor}</b>
          </button>`).join('')}
      </div>`,
  });
  m.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-opcion]');
    if (!b) return;
    cerrarModal();
    marcarConEfecto({ fecha, tareaId: tarea.id, opcionId: b.dataset.opcion, fotos, boton });
  });
}

function modalMotivo({ titulo, texto, al }) {
  modal({
    titulo,
    cuerpo: `<p class="mini tenue" style="margin-top:0">${esc(texto)}</p>
      <label for="rt-motivo">Motivo (obligatorio)</label>
      <textarea id="rt-motivo" maxlength="180" placeholder="Para que Nil sepa por qué"></textarea>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Confirmar',
        clase: 'peligro',
        al: (raiz, cerrar) => {
          const motivo = raiz.querySelector('#rt-motivo').value.trim();
          if (!motivo) { aviso('El motivo es obligatorio', 'mal'); return; }
          al(motivo);
          cerrar();
        },
      },
    ],
  });
}

function modalEvento(evento, fechaPorDefecto = null) {
  const e = evento || crearEvento({ fecha: fechaPorDefecto || hoy() });
  modal({
    titulo: evento ? 'Editar cita' : 'Nueva cita',
    cuerpo: `
      <label for="ev-t">Título</label>
      <input id="ev-t" type="text" maxlength="60" value="${escAttr(e.titulo)}" placeholder="Dentista, cumple de…">
      <div class="rejilla dos">
        <div><label for="ev-f">Fecha</label><input id="ev-f" type="date" value="${escAttr(e.fecha)}"></div>
        <div><label for="ev-h">Hora (opcional)</label><input id="ev-h" type="time" value="${escAttr(e.hora || '')}"></div>
      </div>
      <label for="ev-n">Notas</label>
      <textarea id="ev-n" maxlength="220">${esc(e.notas)}</textarea>
      <label>Color</label>
      <div class="fila envuelve" style="gap:8px">
        ${COLORES_EVENTO.map((c) => `<button class="tema-opcion" style="width:38px;height:38px;aspect-ratio:auto;background:${escAttr(c)};border-radius:50%"
          data-color="${escAttr(c)}" aria-label="Color ${escAttr(c)}"></button>`).join('')}
      </div>
      <div class="campo-linea" style="margin-top:12px">
        <input type="checkbox" id="ev-r" ${e.recordatorio ? 'checked' : ''}>
        <label for="ev-r">Avisarme 5 minutos antes (solo con la app abierta)</label>
      </div>`,
    acciones: [
      ...(evento ? [{ texto: 'Borrar', clase: 'peligro', al: async (_, cerrar) => {
        cerrar();
        const si = await confirmar({ titulo: 'Borrar la cita', texto: `Se borrará "${e.titulo}".`, textoSi: 'Borrar', peligro: true });
        if (si) { store.remove('eventos', e.id); aviso('Cita borrada'); refrescar(); }
      } }] : []),
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Guardar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const nuevo = {
            ...e,
            titulo: raiz.querySelector('#ev-t').value.trim(),
            fecha: raiz.querySelector('#ev-f').value,
            hora: raiz.querySelector('#ev-h').value || null,
            notas: raiz.querySelector('#ev-n').value.trim(),
            recordatorio: raiz.querySelector('#ev-r').checked,
            color: raiz.dataset.color || e.color,
          };
          const error = validarEvento(nuevo);
          if (error) { aviso(error, 'mal'); return; }
          store.set('eventos', nuevo.id, nuevo);
          ui.fechaCalendario = nuevo.fecha;
          cerrar();
          aviso('Cita guardada', 'bien');
          refrescar();
        },
      },
    ],
  }).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-color]');
    if (!b) return;
    ev.currentTarget.dataset.color = b.dataset.color;
    [...ev.currentTarget.querySelectorAll('[data-color]')].forEach((x) => x.classList.toggle('sel', x === b));
  });
}

function modalBloque(bloque) {
  const b = bloque || crearBloque({});
  modal({
    titulo: bloque ? 'Editar bloque' : 'Nuevo bloque del horario',
    cuerpo: `
      <label for="bl-t">Nombre</label>
      <input id="bl-t" type="text" maxlength="40" value="${escAttr(b.titulo)}">
      <label for="bl-d">Día</label>
      <select id="bl-d">
        ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
          .map((n, i) => `<option value="${i}" ${i === b.dia ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      <div class="rejilla dos">
        <div><label for="bl-i">Empieza</label><input id="bl-i" type="time" value="${escAttr(b.inicio)}"></div>
        <div><label for="bl-f">Acaba</label><input id="bl-f" type="time" value="${escAttr(b.fin)}"></div>
      </div>
      <label for="bl-tipo">Tipo</label>
      <select id="bl-tipo">
        ${Object.entries(TIPOS_BLOQUE).map(([k, v]) => `<option value="${escAttr(k)}" ${k === b.tipo ? 'selected' : ''}>${esc(v.etiqueta)}</option>`).join('')}
      </select>
      <div class="campo-linea" style="margin-top:12px">
        <input type="checkbox" id="bl-bloq" ${b.bloqueaOcio ? 'checked' : ''}>
        <label for="bl-bloq">🔒 Bloquea el ocio mientras dura</label>
      </div>
      <div class="campo-linea" style="margin-top:8px">
        <input type="checkbox" id="bl-prep" ${b.requierePreparacion ? 'checked' : ''}>
        <label for="bl-prep">🎒 Genera una tarea "Preparar…" ese día</label>
      </div>`,
    acciones: [
      ...(bloque ? [{ texto: 'Borrar', clase: 'peligro', al: async (_, cerrar) => {
        cerrar();
        const si = await confirmar({ titulo: 'Borrar el bloque', texto: `Se borrará "${b.titulo}" y su tarea de preparación si la tenía.`, textoSi: 'Borrar', peligro: true });
        if (si) { store.remove('horario', b.id); aviso('Bloque borrado'); refrescar(); }
      } }] : []),
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Guardar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const nuevo = {
            ...b,
            titulo: raiz.querySelector('#bl-t').value.trim(),
            dia: Number(raiz.querySelector('#bl-d').value),
            inicio: raiz.querySelector('#bl-i').value,
            fin: raiz.querySelector('#bl-f').value,
            tipo: raiz.querySelector('#bl-tipo').value,
            bloqueaOcio: raiz.querySelector('#bl-bloq').checked,
            requierePreparacion: raiz.querySelector('#bl-prep').checked,
          };
          const error = validarBloque(nuevo);
          if (error) { aviso(error, 'mal'); return; }
          store.set('horario', nuevo.id, nuevo);
          cerrar();
          aviso('Horario actualizado', 'bien');
          refrescar();
        },
      },
    ],
  });
}

/* ------------------------- Economía: puntos y hucha ------------------------- */

function opcionesCuenta(actual) {
  const e = store.estado;
  const cuentas = [
    ['semana', `Créditos (tiene ${saldoCreditos(e, hoy())})`],
    ['hucha', `Hucha (tiene ${saldoHucha(e)})`],
    ['estrellas', `Estrellas (tiene ${saldoEstrellas(e)})`],
  ];
  return cuentas.map(([id, et]) => `<option value="${escAttr(id)}" ${id === actual ? 'selected' : ''}>${esc(et)}</option>`).join('');
}

/**
 * Añadir o quitar puntos, en cualquier cuenta, con motivo obligatorio y en
 * cualquier día de los últimos DIAS_ATRAS.
 */
function modalAjuste({ modo = 'sumar', fecha = null, cuenta = 'semana' } = {}) {
  const f = fecha && fechaRecuperable(fecha, hoy()) ? fecha : hoy();
  const chips = (grupo) => MOTIVOS_FRECUENTES[grupo].map((m) => `<button type="button" class="chip" data-motivo="${escAttr(m)}" data-grupo-motivo="${escAttr(grupo)}" ${grupo !== modo ? 'hidden' : ''}>${esc(m)}</button>`).join('');
  const fondo = modal({
    titulo: 'Añadir o quitar puntos',
    cuerpo: `
      <div class="segmento" role="radiogroup" aria-label="Añadir o quitar">
        <label><input type="radio" name="aj-modo" value="sumar" ${modo !== 'quitar' ? 'checked' : ''}> ＋ Añadir</label>
        <label><input type="radio" name="aj-modo" value="quitar" ${modo === 'quitar' ? 'checked' : ''}> － Quitar</label>
      </div>
      <div class="rejilla dos">
        <div><label for="aj-c">Cantidad</label>
          <input id="aj-c" type="number" min="0.5" step="0.5" value="5" inputmode="decimal"></div>
        <div><label for="aj-f">Día</label>
          <input id="aj-f" type="date" value="${escAttr(f)}" min="${escAttr(addDays(hoy(), -DIAS_ATRAS))}" max="${escAttr(hoy())}"></div>
      </div>
      <label for="aj-cu">Cuenta</label>
      <select id="aj-cu">${opcionesCuenta(cuenta)}</select>
      <label for="aj-m">Motivo (obligatorio, lo verá Nil)</label>
      <input id="aj-m" type="text" maxlength="80" placeholder="Ayudó con la mudanza">
      <div class="fila envuelve motivos" style="gap:6px;margin-top:8px">${chips('sumar')}${chips('quitar')}</div>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Aplicar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const quitar = raiz.querySelector('input[name="aj-modo"]:checked')?.value === 'quitar';
          const cant = Math.abs(Number(raiz.querySelector('#aj-c').value));
          const r = ajusteCuenta(store, {
            cantidad: quitar ? -cant : cant,
            motivo: raiz.querySelector('#aj-m').value,
            fecha: raiz.querySelector('#aj-f').value || hoy(),
            cuenta: raiz.querySelector('#aj-cu').value,
            hoy: hoy(),
          });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          cerrar();
          aviso(`${r.cantidad > 0 ? '+' : ''}${r.cantidad} apuntado`, 'bien');
          refrescar();
        },
      },
    ],
  });
  fondo.addEventListener('change', (ev) => {
    if (ev.target.name !== 'aj-modo') return;
    for (const c of fondo.querySelectorAll('[data-grupo-motivo]')) c.hidden = c.dataset.grupoMotivo !== ev.target.value;
  });
  fondo.addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-motivo]');
    if (c) fondo.querySelector('#aj-m').value = c.dataset.motivo;
  });
}

/** Guardar en la hucha o sacar de ella. Lo usan Nil y el padre. */
function modalTraspaso({ actor = 'nil', direccion = 'guardar' } = {}) {
  const e = store.estado;
  const libres = saldoCreditos(e, hoy());
  const hucha = saldoHucha(e);
  const sacarPermitido = actor === 'padre' || puedeSacarNil(e);
  const interes = Number(leerParametro(e, 'interesHuchaPct', 0));
  const periodo = leerParametro(e, 'interesHuchaPeriodo', 'semana') === 'dia' ? 'día' : 'semana';
  const fondo = modal({
    titulo: '🐷 Hucha',
    cuerpo: `
      <div class="rejilla dos" style="margin-bottom:10px">
        <div class="dato"><div class="v">${esc(String(libres))}</div><div class="e">Créditos</div></div>
        <div class="dato"><div class="v">${esc(String(hucha))}</div><div class="e">Hucha</div></div>
      </div>
      <div class="segmento" role="radiogroup" aria-label="Dirección">
        <label><input type="radio" name="tr-dir" value="guardar" ${direccion !== 'sacar' ? 'checked' : ''}> Guardar</label>
        ${sacarPermitido ? `<label><input type="radio" name="tr-dir" value="sacar" ${direccion === 'sacar' ? 'checked' : ''}> Sacar</label>` : ''}
      </div>
      <label for="tr-c">Cantidad</label>
      <input id="tr-c" type="number" min="1" step="1" value="${escAttr(String(Math.max(1, Math.min(10, Math.floor(direccion === 'sacar' ? hucha : libres)))))}" inputmode="numeric">
      <div class="fila envuelve" style="gap:6px;margin-top:8px">
        <button type="button" class="chip" data-tr-pct="25">25 %</button>
        <button type="button" class="chip" data-tr-pct="50">50 %</button>
        <button type="button" class="chip" data-tr-pct="100">Todo</button>
      </div>
      <p class="mini tenue" style="margin:10px 0 0">No es ganar ni gastar: los créditos solo cambian de sitio.${interes > 0 ? ` En la hucha ganan un ${esc(String(interes))} % cada ${esc(periodo)}.` : ''}</p>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Mover',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const dir = raiz.querySelector('input[name="tr-dir"]:checked')?.value || 'guardar';
          const cantidad = Number(raiz.querySelector('#tr-c').value);
          const r = dir === 'sacar'
            ? sacarDeHucha(store, { cantidad, fecha: hoy(), actor })
            : guardarEnHucha(store, { cantidad, fecha: hoy(), actor });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          cerrar();
          aviso(dir === 'sacar' ? `${r.cantidad} sacados de la hucha` : `${r.cantidad} guardados en la hucha`, 'bien');
          refrescar();
        },
      },
    ],
  });
  fondo.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tr-pct]');
    if (!b) return;
    const dir = fondo.querySelector('input[name="tr-dir"]:checked')?.value || 'guardar';
    const base = dir === 'sacar' ? hucha : libres;
    fondo.querySelector('#tr-c').value = String(Math.max(0, Math.floor((base * Number(b.dataset.trPct)) / 100)));
  });
}

function modalPreciosBloque() {
  modal({
    titulo: 'Subir o bajar precios',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">Cambia de golpe los precios de un grupo de la tienda. Se redondea y se respetan los precios mínimos.</p>
      <label for="pb-p">Porcentaje (negativo para bajar)</label>
      <input id="pb-p" type="number" min="-80" max="300" step="5" value="10">
      <label for="pb-m">Qué artículos</label>
      <select id="pb-m">
        <option value="semana">Los que se pagan con créditos</option>
        <option value="hucha">Premios grandes (hucha)</option>
        <option value="estrellas">Regalos (estrellas)</option>
        <option value="todas">Toda la tienda</option>
      </select>
      <div class="campo-linea" style="margin-top:12px">
        <input type="checkbox" id="pb-o">
        <label for="pb-o">Solo el ocio del día (no los premios)</label>
      </div>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Aplicar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const r = ajustarPrecios(store, {
            pct: Number(raiz.querySelector('#pb-p').value),
            moneda: raiz.querySelector('#pb-m').value,
            soloOcio: raiz.querySelector('#pb-o').checked,
          });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          cerrar();
          aviso(`${r.cambiados} precio${r.cambiados === 1 ? '' : 's'} cambiado${r.cambiados === 1 ? '' : 's'}`, 'bien');
          refrescar();
        },
      },
    ],
  });
}

function modalCategoria(id) {
  const cat = id ? CATEGORIAS[id] : null;
  const fabrica = id && esCategoriaDeFabrica(id);
  modal({
    titulo: id ? 'Editar el grupo' : 'Nuevo grupo de tareas',
    cuerpo: `
      <div class="rejilla dos">
        <div><label for="ca-n">Nombre</label><input id="ca-n" type="text" maxlength="24" value="${escAttr(cat ? cat.etiqueta : '')}"></div>
        <div><label for="ca-i">Icono</label><input id="ca-i" type="text" maxlength="3" value="${escAttr(cat ? cat.icono || '•' : '📌')}"></div>
      </div>
      <p class="mini tenue" style="margin:8px 0 0">Cambia solo cómo se llama y se ve: las tareas y el histórico siguen igual.</p>`,
    acciones: [
      ...(fabrica ? [{ texto: 'Nombre original', clase: 'fantasma', al: (_, cerrar) => { restaurarCategoria(store, id); cerrar(); refrescar(); } }] : []),
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Guardar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const r = editarCategoria(store, id, { etiqueta: raiz.querySelector('#ca-n').value, icono: raiz.querySelector('#ca-i').value });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          cerrar();
          aviso('Grupo guardado', 'bien');
          refrescar();
        },
      },
    ],
  });
}

function modalTareaPuntual(fecha = null) {
  const f = fecha || hoy();
  modal({
    titulo: 'Tarea puntual',
    cuerpo: `
      <label for="tp-n">Nombre</label>
      <input id="tp-n" type="text" maxlength="60" placeholder="Ayudar a ordenar el trastero">
      <div class="rejilla dos">
        <div><label for="tp-v">Créditos</label><input id="tp-v" type="number" min="0" value="8"></div>
        <div><label for="tp-f">Día</label><input id="tp-f" type="date" value="${escAttr(f)}" min="${escAttr(addDays(hoy(), -DIAS_ATRAS))}"></div>
      </div>
      <p class="mini tenue" style="margin:8px 0 0">Si es de un día pasado, se valida después en «Días pasados».</p>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Crear',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const fe = raiz.querySelector('#tp-f').value;
          const r = crearTareaPuntual(store, {
            nombre: raiz.querySelector('#tp-n').value,
            valor: Number(raiz.querySelector('#tp-v').value),
            fecha: fe,
          });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          if (fe && fe < hoy() && ui.modo === 'padre') { ui.vista = 'padre'; ui.tabPadre = 'dias'; ui.diaPasado = fe; }
          cerrar();
          aviso('Tarea creada', 'bien');
          refrescar();
        },
      },
    ],
  });
}

function modalMultiplicador() {
  const valor = store.ajuste('multiplicadorValor', 1);
  const ambito = store.ajuste('multiplicadorAmbito', 'siempre');
  const desde = store.ajuste('multiplicadorDesde', null) || hoy();
  const hasta = store.ajuste('multiplicadorHasta', null) || addDays(hoy(), 6);
  const fondo = modal({
    titulo: 'Multiplicador de lo ganado',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">Multiplica solo los créditos <b>ganados</b>. Nunca los gastados ni las estrellas.</p>
      <label for="mu-v">Multiplicador</label>
      <input id="mu-v" type="number" min="0.5" max="5" step="0.5" value="${escAttr(String(valor))}">
      <label for="mu-a">Cuándo</label>
      <select id="mu-a">
        ${AMBITOS_MULTIPLICADOR.map((a) => `<option value="${escAttr(a.id)}" ${a.id === ambito ? 'selected' : ''}>${esc(a.etiqueta)}</option>`).join('')}
      </select>
      <div class="rejilla dos" data-mu-rango ${ambito === 'rango' ? '' : 'hidden'}>
        <div><label for="mu-d">Desde</label><input id="mu-d" type="date" value="${escAttr(desde)}"></div>
        <div><label for="mu-h">Hasta</label><input id="mu-h" type="date" value="${escAttr(hasta)}"></div>
      </div>`,
    acciones: [
      { texto: 'Quitar', clase: 'fantasma', al: (_, cerrar) => {
        store.lote((s) => { s.fijarAjuste('multiplicadorValor', 1); s.fijarAjuste('multiplicadorAmbito', 'siempre'); });
        cerrar(); aviso('Multiplicador quitado', 'bien'); refrescar();
      } },
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Aplicar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const v = validarParametro('multiplicadorValor', raiz.querySelector('#mu-v').value);
          if (!v.ok) { aviso(v.razon, 'mal'); return; }
          const amb = raiz.querySelector('#mu-a').value;
          const d = raiz.querySelector('#mu-d').value;
          const h = raiz.querySelector('#mu-h').value;
          if (amb === 'rango' && (!d || !h || h < d)) { aviso('Revisa las fechas: «hasta» no puede ser antes de «desde».', 'mal'); return; }
          store.lote((s) => {
            s.fijarAjuste('multiplicadorValor', v.valor);
            s.fijarAjuste('multiplicadorAmbito', amb);
            s.fijarAjuste('multiplicadorFecha', hoy());
            if (amb === 'rango') { s.fijarAjuste('multiplicadorDesde', d); s.fijarAjuste('multiplicadorHasta', h); }
          });
          cerrar();
          aviso('Multiplicador actualizado', 'bien');
          refrescar();
        },
      },
    ],
  });
  fondo.querySelector('#mu-a').addEventListener('change', (ev) => {
    fondo.querySelector('[data-mu-rango]').hidden = ev.target.value !== 'rango';
  });
}

/* ----------------------------- Catálogo: tareas ----------------------------- */

const TIPOS_EDITABLES = [
  { id: 'estandar', etiqueta: 'Normal: da créditos o estrellas' },
  { id: 'eleccion', etiqueta: 'A elegir: Nil escoge una opción' },
  { id: 'obligatoria', etiqueta: 'Obligatoria: no da créditos, da una estrella' },
  { id: 'puntual', etiqueta: 'Puntual: solo un día' },
];
const ETIQUETA_TIPO_FIJO = {
  circadiana: 'De horario (cena, pantallas, dormir): el tipo no se cambia.',
  habito: 'Hábito de cuidado (estrellas, sin aprobación): el tipo no se cambia.',
  preparacion: 'De preparación (la genera el horario): el tipo no se cambia.',
};

/** Lee el formulario de tarea sin guardarlo (sirve también para repintarlo). */
function leerFormularioTarea(raiz, t) {
  const q = (sel) => raiz.querySelector(sel);
  const tipo = q('#ta-tipo') ? q('#ta-tipo').value : t.tipo;
  const filas = [...raiz.querySelectorAll('[data-op-fila]')];
  const opciones = filas.map((fila, i) => ({
    id: (t.opciones || [])[i]?.id || `op${i + 1}_${Date.now().toString(36)}`,
    etiqueta: fila.querySelector('[data-op-et]').value.trim(),
    valor: creditos(fila.querySelector('[data-op-v]').value),
  }));
  const b = {
    ...t,
    nombre: q('#ta-n').value,
    tipo,
    valor: q('#ta-v') ? creditos(q('#ta-v').value) : Number(t.valor || 0),
    icono: q('#ta-i').value || '•',
    categoria: q('#ta-c').value,
    moneda: q('#ta-mo') ? q('#ta-mo').value : t.moneda,
    requiereAprobacion: q('#ta-ap') ? q('#ta-ap').checked : t.requiereAprobacion,
    activa: q('#ta-a').checked,
    opciones: filas.length ? opciones : t.opciones,
  };
  if (q('#ta-f')) b.fecha = q('#ta-f').value;
  const dias = [...raiz.querySelectorAll('[data-dia]')];
  if (dias.length) b.dias = dias.filter((x) => x.checked).map((x) => Number(x.dataset.dia));
  return b;
}

function opcionesDeEleccion(t) {
  const ops = (t.opciones || []).slice(0, 4);
  while (ops.length < 2) {
    ops.push({ id: `op_${ops.length}_${Date.now().toString(36)}`, etiqueta: ops.length ? 'Opción B' : 'Opción A', valor: Math.max(1, Number(t.valor || 3) - ops.length) });
  }
  return ops;
}

function modalTarea(tarea, { categoria = null, borrador = null } = {}) {
  const t = borrador || tarea || {
    id: null, nombre: '', tipo: 'estandar', valor: 3, categoria: categoria || 'tarde',
    dias: [0, 1, 2, 3, 4, 5, 6], icono: '•', activa: true, orden: 300, requiereAprobacion: true,
  };
  const dias = Array.isArray(t.dias) ? t.dias : [0, 1, 2, 3, 4, 5, 6];
  const tipoFijo = ETIQUETA_TIPO_FIJO[t.tipo];
  const opciones = t.tipo === 'eleccion' ? opcionesDeEleccion(t) : [];
  const sinValor = t.tipo === 'obligatoria' || t.tipo === 'eleccion';
  const fondo = modal({
    titulo: tarea ? 'Editar tarea' : 'Nueva tarea',
    cuerpo: `
      <label for="ta-n">Nombre</label>
      <input id="ta-n" type="text" maxlength="70" value="${escAttr(t.nombre)}">
      <label for="ta-tipo">Tipo</label>
      ${tipoFijo ? `<p class="mini tenue" style="margin:4px 0 0">${esc(tipoFijo)}</p>` : `<select id="ta-tipo">
        ${TIPOS_EDITABLES.map((x) => `<option value="${escAttr(x.id)}" ${x.id === t.tipo ? 'selected' : ''}>${esc(x.etiqueta)}</option>`).join('')}
      </select>`}
      <div class="rejilla dos">
        ${sinValor ? '' : `<div><label for="ta-v">Valor</label>
          <input id="ta-v" type="number" min="0" max="99" step="0.5" value="${escAttr(String(t.valor || 0))}"></div>`}
        <div><label for="ta-i">Icono</label><input id="ta-i" type="text" maxlength="3" value="${escAttr(t.icono || '•')}"></div>
        ${t.tipo === 'obligatoria' || t.tipo === 'habito' ? '' : `<div><label for="ta-mo">Paga en</label>
          <select id="ta-mo">
            <option value="semana" ${t.moneda !== 'estrellas' ? 'selected' : ''}>Créditos</option>
            <option value="estrellas" ${t.moneda === 'estrellas' ? 'selected' : ''}>Estrellas</option>
          </select></div>`}
      </div>
      <label for="ta-c">Grupo</label>
      <select id="ta-c">
        ${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${escAttr(k)}" ${k === t.categoria ? 'selected' : ''}>${esc(`${v.icono || ''} ${v.etiqueta}`.trim())}</option>`).join('')}
      </select>
      ${t.tipo === 'eleccion' ? `
        <label>Opciones (Nil elige una)</label>
        ${opciones.map((o, i) => `
          <div class="fila" data-op-fila="${escAttr(String(i))}" style="gap:6px;margin-bottom:6px">
            <input class="crece" type="text" data-op-et="${escAttr(String(i))}" value="${escAttr(o.etiqueta)}" maxlength="40" aria-label="Opción">
            <input type="number" data-op-v="${escAttr(String(i))}" value="${escAttr(String(o.valor))}" min="0" step="0.5" style="width:84px" aria-label="Valor">
            ${opciones.length > 2 ? `<button type="button" class="btn pequeno fantasma" data-op-quitar="${escAttr(String(i))}" aria-label="Quitar opción">✕</button>` : ''}
          </div>`).join('')}
        ${opciones.length < 4 ? '<button type="button" class="btn pequeno" data-op-anadir>＋ Opción</button>' : ''}` : ''}
      ${t.tipo !== 'puntual' ? `
        <label>Días</label>
        <div class="fila envuelve" style="gap:6px">
          ${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((n, i) => `
            <label class="chip" style="cursor:pointer">
              <input type="checkbox" data-dia="${i}" ${dias.includes(i) ? 'checked' : ''} style="width:16px;height:16px">
              ${esc(n)}
            </label>`).join('')}
        </div>` : `
        <label for="ta-f">Fecha</label>
        <input id="ta-f" type="date" value="${escAttr(t.fecha || hoy())}">`}
      ${t.tipo === 'habito' ? '' : `<div class="campo-linea" style="margin-top:12px">
        <input type="checkbox" id="ta-ap" ${t.requiereAprobacion !== false ? 'checked' : ''}>
        <label for="ta-ap">Necesita tu aprobación (si no, cuenta al marcarla)</label>
      </div>`}
      <div class="campo-linea" style="margin-top:8px">
        <input type="checkbox" id="ta-a" ${t.activa !== false ? 'checked' : ''}>
        <label for="ta-a">Activa</label>
      </div>
      <p class="mini tenue" style="margin:10px 0 0">Los cambios valen desde ahora: lo ya ganado no se toca.</p>`,
    acciones: [
      ...(tarea ? [{ texto: 'Borrar', clase: 'peligro', al: async (_, cerrar) => {
        cerrar();
        const si = await confirmar({ titulo: 'Borrar la tarea', texto: `Se borrará "${t.nombre}" del catálogo. El histórico de créditos no se toca.`, textoSi: 'Borrar', peligro: true });
        if (si) { store.remove('tareas', t.id); aviso('Tarea borrada'); refrescar(); }
      } }] : []),
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Guardar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const b = leerFormularioTarea(raiz, t);
          const nombre = String(b.nombre || '').trim();
          if (!nombre) { aviso('Ponle un nombre', 'mal'); return; }
          const nuevo = { ...b, nombre, id: t.id || `tc_${Date.now().toString(36)}` };
          if (nuevo.tipo === 'obligatoria') { nuevo.valor = 0; delete nuevo.moneda; }
          if (nuevo.tipo === 'eleccion') {
            nuevo.valor = 0;
            nuevo.opciones = (b.opciones || []).filter((o) => o.etiqueta);
            if (nuevo.opciones.length < 2) { aviso('Una tarea a elegir necesita al menos dos opciones con nombre', 'mal'); return; }
          } else delete nuevo.opciones;
          if (nuevo.tipo === 'puntual') { nuevo.fecha = nuevo.fecha || hoy(); delete nuevo.dias; } else {
            delete nuevo.fecha;
            if (!nuevo.dias || !nuevo.dias.length) { aviso('Elige al menos un día', 'mal'); return; }
          }
          if (nuevo.moneda !== 'estrellas') delete nuevo.moneda;
          store.set('tareas', nuevo.id, nuevo);
          cerrar();
          aviso('Tarea guardada', 'bien');
          refrescar();
        },
      },
    ],
  });
  // Cambiar el tipo o las opciones repinta el formulario sin perder lo escrito.
  const repintar = (cambio) => {
    const b = leerFormularioTarea(fondo, t);
    cambio(b);
    modalTarea(tarea, { borrador: b });
  };
  const sel = fondo.querySelector('#ta-tipo');
  if (sel) sel.addEventListener('change', () => repintar(() => {}));
  fondo.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-op-anadir]')) {
      repintar((b) => { b.opciones = [...(b.opciones || []), { id: `op_${Date.now().toString(36)}`, etiqueta: '', valor: 2 }]; });
      return;
    }
    const q = ev.target.closest('[data-op-quitar]');
    if (q) repintar((b) => { b.opciones = (b.opciones || []).filter((_, i) => i !== Number(q.dataset.opQuitar)); });
  });
}

/* ----------------------------- Catálogo: tienda ----------------------------- */

const ETIQUETA_TIPO_ARTICULO = {
  bono: 'Bono de ocio', extraAnime: 'Tiempo extra de anime', pasePc: 'Pase de PC', buho: 'Modo Búho', premio: 'Premio',
};

function modalPremio(articulo, { moneda = null, tipo = null } = {}) {
  const a = articulo || {
    id: null, nombre: '', descripcion: '', precio: moneda === 'hucha' ? 150 : 10, moneda: moneda || 'semana',
    tipo: tipo || 'premio', requiereAprobacion: true, icono: tipo === 'bono' ? '🎟️' : '🎁',
    activo: true, orden: 300, ...(tipo === 'bono' ? { categoriaOcio: 'otro' } : {}),
  };
  const suelo = Number(a.precioMinimo || 0);
  const mon = a.moneda || 'semana';
  modal({
    titulo: articulo ? 'Editar' : 'Nuevo en la tienda',
    cuerpo: `
      <label for="pr-n">Nombre</label>
      <input id="pr-n" type="text" maxlength="60" value="${escAttr(a.nombre)}">
      <label for="pr-d">Descripción</label>
      <input id="pr-d" type="text" maxlength="110" value="${escAttr(a.descripcion || '')}">
      <div class="rejilla dos">
        <div><label for="pr-p">Precio</label><input id="pr-p" type="number" min="${escAttr(String(suelo || 1))}" value="${escAttr(String(a.precio))}"></div>
        <div><label for="pr-i">Icono</label><input id="pr-i" type="text" maxlength="3" value="${escAttr(a.icono || '🎁')}"></div>
      </div>
      <label for="pr-du">Tiempo que da, en minutos (0 = no se indica)</label>
      <input id="pr-du" type="number" min="0" max="720" step="5" value="${escAttr(String(a.duracion || 0))}">
      <p class="mini tenue" style="margin:4px 0 0">Para bonos de pantalla o de ocio: Nil lo ve en la tienda (por ejemplo, «⏱ 1 h»).</p>
      ${suelo ? `<p class="mini" style="color:var(--aviso);margin:6px 0 0">Este artículo tiene un precio mínimo de ${esc(String(suelo))}: no puede costar menos, ni por error.</p>` : ''}
      <label for="pr-m">Se paga con</label>
      <select id="pr-m">
        <option value="semana" ${mon === 'semana' ? 'selected' : ''}>Créditos</option>
        <option value="hucha" ${mon === 'hucha' ? 'selected' : ''}>Hucha</option>
        <option value="estrellas" ${mon === 'estrellas' ? 'selected' : ''}>Estrellas</option>
      </select>
      ${a.tipo !== 'premio' ? `<p class="mini tenue" style="margin:6px 0 0">Tipo: ${esc(ETIQUETA_TIPO_ARTICULO[a.tipo] || a.tipo)}.</p>` : ''}
      <label for="pr-t">Tope por semana (0 = sin tope)</label>
      <input id="pr-t" type="number" min="0" max="7" value="${escAttr(String(a.topeSemanal || 0))}">
      <div class="campo-linea" style="margin-top:12px">
        <input type="checkbox" id="pr-ap" ${a.requiereAprobacion !== false ? 'checked' : ''}>
        <label for="pr-ap">Necesita tu aprobación</label>
      </div>
      <div class="campo-linea" style="margin-top:8px">
        <input type="checkbox" id="pr-ac" ${a.activo !== false ? 'checked' : ''}>
        <label for="pr-ac">Visible en la tienda</label>
      </div>`,
    acciones: [
      ...(articulo ? [{ texto: 'Borrar', clase: 'peligro', al: async (_, cerrar) => {
        cerrar();
        const esObjetivo = store.ajuste('objetivoAhorroId', null) === a.id;
        const si = await confirmar({
          titulo: 'Borrar de la tienda',
          texto: esObjetivo
            ? `"${a.nombre}" está fijado como objetivo de ahorro de Nil. Si lo borras, el objetivo se quitará también.`
            : `Se borrará "${a.nombre}" de la tienda. Lo ya comprado no se toca.`,
          textoSi: 'Borrar', peligro: true,
        });
        if (!si) return;
        store.lote((s) => {
          s.remove('tienda', a.id);
          if (esObjetivo) s.fijarAjuste('objetivoAhorroId', null);
        });
        aviso('Borrado');
        refrescar();
      } }] : []),
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Guardar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const nombre = raiz.querySelector('#pr-n').value.trim();
          if (!nombre) { aviso('Ponle un nombre', 'mal'); return; }
          const precio = creditos(raiz.querySelector('#pr-p').value);
          if (!(precio > 0)) { aviso('El precio tiene que ser mayor que 0', 'mal'); return; }
          if (suelo && precio < suelo) { aviso(`El mínimo de este artículo es ${suelo}`, 'mal'); return; }
          const tope = Number(raiz.querySelector('#pr-t').value) || 0;
          const duracion = Math.max(0, Math.min(720, Math.round(Number(raiz.querySelector('#pr-du').value) || 0)));
          const nuevo = {
            ...a,
            id: a.id || `pc_${Date.now().toString(36)}`,
            nombre,
            descripcion: raiz.querySelector('#pr-d').value.trim(),
            precio,
            icono: raiz.querySelector('#pr-i').value || '🎁',
            moneda: raiz.querySelector('#pr-m').value,
            topeSemanal: tope || null,
            duracion: duracion || null,
            requiereAprobacion: raiz.querySelector('#pr-ap').checked,
            activo: raiz.querySelector('#pr-ac').checked,
          };
          store.set('tienda', nuevo.id, nuevo);
          cerrar();
          aviso('Guardado', 'bien');
          refrescar();
        },
      },
    ],
  });
}

function modalClave({ cambiar = false } = {}) {
  const hay = Boolean(store.ajuste('claveHash', null));
  const crear = !hay || cambiar;
  modal({
    titulo: crear ? (hay ? 'Cambiar la clave' : 'Crear la clave del panel') : 'Clave del panel',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">
        ${crear
          ? 'La app no trae ninguna clave por defecto: la eliges tú ahora. Mínimo 6 caracteres.'
          : 'Escribe la clave del panel del padre.'}
      </p>
      ${hay && cambiar ? '<label for="cl-v">Clave actual</label><input id="cl-v" type="password" autocomplete="current-password">' : ''}
      <label for="cl-1">${crear ? 'Clave nueva' : 'Clave'}</label>
      <input id="cl-1" type="password" autocomplete="${crear ? 'new-password' : 'current-password'}">
      ${crear ? '<label for="cl-2">Repítela</label><input id="cl-2" type="password" autocomplete="new-password">' : ''}`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: crear ? 'Guardar clave' : 'Entrar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const c1 = raiz.querySelector('#cl-1').value;
          if (crear) {
            if (hay && cambiar) {
              const actual = raiz.querySelector('#cl-v').value;
              if (hashClave(actual) !== store.ajuste('claveHash', null)) { aviso('La clave actual no es correcta', 'mal'); return; }
            }
            const c2 = raiz.querySelector('#cl-2').value;
            if (c1.length < 6) { aviso('Mínimo 6 caracteres', 'mal'); return; }
            if (c1 !== c2) { aviso('Las dos claves no coinciden', 'mal'); return; }
            store.lote((s) => {
              s.fijarAjuste('claveHash', hashClave(c1));
              s.fijarAjuste('claveCreada', true);
            });
            ui.modo = 'padre';
            ui.vista = 'padre';
            cerrar();
            aviso('Clave guardada', 'bien');
            refrescar();
            return;
          }
          if (hashClave(c1) !== store.ajuste('claveHash', null)) { aviso('Clave incorrecta', 'mal'); return; }
          ui.modo = 'padre';
          ui.vista = 'padre';
          cerrar();
          refrescar();
        },
      },
    ],
  });
}


/* ---------------------- Sueño, depósitos y apuestas --------------------- */

function modalNoche(forzar = false) {
  const objetivo = objetivosDe(store.estado, hoy()).dormir;
  modal({
    titulo: 'A qué hora me he dormido',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">
        Tu hora de hoy es las <b>${esc(objetivo)}</b>. Hay un margen de
        ${esc(String(leerParametro(store.estado, 'margenDormirMin', 15)))} minutos de cortesía.
      </p>
      <label for="sn-h">Hora</label>
      <input id="sn-h" type="time" value="${escAttr(objetivo)}">
      <p class="mini tenue" style="margin:10px 0 0">
        Esto no es para controlarte: es lo que hace que veas tu ritmo en la gráfica
        y lo que cuenta para el bonus de la noche.
      </p>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Apuntar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const hora = raiz.querySelector('#sn-h').value;
          const r = registrarSueno(store, { fecha: hoy(), hora, forzar });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          registrarNocheEnStaking(store, { fecha: hoy(), cumplida: r.cumplida });
          cerrar();
          aviso(r.cumplida
            ? `A la hora · +${r.bono}${r.bonusRacha ? ` y +${r.bonusRacha} por ${r.racha} noches` : ''}`
            : 'Apuntado. Mañana lo intentas otra vez.', r.cumplida ? 'bien' : '');
          refrescar();
        },
      },
    ],
  });
}

function modalDeposito() {
  const libre = saldoHucha(store.estado);
  const minimo = Number(leerParametro(store.estado, 'depositoMinimo', 20));
  modal({
    titulo: 'Depósito a plazo',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">
        Bloqueas créditos de la hucha y cobras un interés al vencer. Tienes <b>${libre}</b> libres.
        Si lo rompes antes, recuperas el capital pero pierdes el interés.
      </p>
      <label for="dp-c">Cuántos créditos</label>
      <input id="dp-c" type="number" min="${minimo}" max="${libre}" value="${Math.max(minimo, Math.min(libre, 40))}">
      <label for="dp-d">Plazo</label>
      <select id="dp-d">
        ${PLAZOS.map((d) => `<option value="${d}">${d} días · +${porcentajeDePlazo(store.estado, d)}%</option>`).join('')}
      </select>
      <p class="mini" id="dp-info" style="margin:10px 0 0"></p>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Bloquear',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const capital = Number(raiz.querySelector('#dp-c').value);
          const dias = Number(raiz.querySelector('#dp-d').value);
          const r = abrirDeposito(store, { capital, dias, fecha: hoy() });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          cerrar();
          aviso(`Depósito abierto · vence el ${r.vencimiento} · +${r.interesPrevisto}`, 'bien');
          refrescar();
        },
      },
    ],
  });
}

function modalStakingSueno() {
  const libre = saldoHucha(store.estado);
  const noches = Number(leerParametro(store.estado, 'stakingSuenoNoches', 7));
  const pct = Number(leerParametro(store.estado, 'stakingSuenoPctNoche', 1.5));
  const minimo = Number(leerParametro(store.estado, 'stakingSuenoMinimo', 15));
  modal({
    titulo: 'Compromiso de sueño',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">
        Bloqueas créditos <b>${noches} noches</b> y cobras un <b>${pct}%</b> por cada noche que
        apuntes que te has dormido a tu hora. No se pierde nada: si fallas noches, simplemente
        cobras menos interés. Tienes <b>${libre}</b> libres.
      </p>
      <label for="ss-c">Cuántos créditos</label>
      <input id="ss-c" type="number" min="${minimo}" max="${libre}" value="${Math.max(minimo, Math.min(libre, 30))}">`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Empezar',
        clase: 'principal',
        al: (raiz, cerrar) => {
          const capital = Number(raiz.querySelector('#ss-c').value);
          const r = abrirStakingSueno(store, { capital, fecha: hoy() });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          cerrar();
          aviso(`Compromiso abierto · hasta +${r.interesMaximo} en ${r.noches} noches`, 'bien');
          refrescar();
        },
      },
    ],
  });
}

function modalApuesta() {
  const libre = saldoHucha(store.estado);
  const max = Number(leerParametro(store.estado, 'apuestaMaxima', 60));
  const mult = Number(leerParametro(store.estado, 'apuestaMultiplicador', 1.6));
  const pena = Number(leerParametro(store.estado, 'apuestaPenalizacionPct', 50));
  const semanasMax = Number(leerParametro(store.estado, 'apuestaSemanasMax', 4));
  modal({
    titulo: 'Apuesta de racha',
    cuerpo: `
      <p class="mini" style="margin-top:0;color:var(--aviso)">
        Ojo: esta es la única que puede salir mal. Si rompes la racha, pierdes el <b>${pena}%</b>
        de lo apostado.
      </p>
      <p class="mini tenue">
        Si mantienes la racha las semanas que elijas, lo apostado se multiplica por <b>${mult}</b>.
        Tienes ${libre} créditos libres y el tope por apuesta es ${max}.
      </p>
      <label for="ap-c">Cuántos créditos apuestas</label>
      <input id="ap-c" type="number" min="1" max="${Math.min(max, libre)}" value="${Math.min(max, libre, 20)}">
      <label for="ap-s">Cuántas semanas aguantas la racha</label>
      <input id="ap-s" type="number" min="1" max="${semanasMax}" value="2">`,
    acciones: [
      { texto: 'Mejor no', clase: 'fantasma' },
      {
        texto: 'Apostar',
        clase: 'peligro',
        al: (raiz, cerrar) => {
          const capital = Number(raiz.querySelector('#ap-c').value);
          const semanas = Number(raiz.querySelector('#ap-s').value);
          const r = abrirApuesta(store, { capital, semanas, fecha: hoy() });
          if (!r.ok) { aviso(r.razon, 'mal'); return; }
          cerrar();
          aviso(`Apuesta hecha · premio ${r.premioPrevisto} si aguantas`, 'bien');
          refrescar();
        },
      },
    ],
  });
}

function modalImportar() {
  modal({
    titulo: 'Importar copia',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">Sustituye TODOS los datos de este dispositivo por los del archivo.</p>
      <input id="im-f" type="file" accept="application/json,.json">`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Importar',
        clase: 'peligro',
        al: async (raiz, cerrar) => {
          const f = raiz.querySelector('#im-f').files[0];
          if (!f) { aviso('Elige un archivo', 'mal'); return; }
          try {
            const datos = JSON.parse(await f.text());
            if (!datos || typeof datos !== 'object' || !datos.ledger) throw new Error('formato');
            const limpio = estadoVacio();
            for (const col of COLECCIONES) {
              if (datos[col] && typeof datos[col] === 'object') limpio[col] = datos[col];
            }
            store.reemplazar(limpio);
            guardarEstadoYa(store.estado);
            cerrar();
            aviso('Copia importada', 'bien');
            refrescar();
          } catch (e) {
            aviso('Ese archivo no es una copia válida', 'mal');
          }
        },
      },
    ],
  });
}

function modalReinicio() {
  modal({
    titulo: 'Reinicio completo',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">Marca exactamente qué quieres borrar. Lo que no marques se conserva.</p>
      ${[
        ['ledger', 'Créditos e historial de movimientos (saldo y hucha)'],
        ['marcas', 'Tareas marcadas y su histórico'],
        ['compras', 'Compras de la tienda'],
        ['sesiones', 'Sesiones de PC'],
        ['semanas', 'Semanas cerradas y racha'],
        ['eventos', 'Citas del calendario'],
        ['horario', 'Horario semanal'],
        ['tareas', 'Catálogo de tareas (vuelve al de fábrica)'],
        ['tienda', 'Tienda y precios (vuelve al de fábrica)'],
      ].map(([k, t]) => `
        <div class="campo-linea" style="margin-top:8px">
          <input type="checkbox" id="ri-${escAttr(k)}" data-borrar="${escAttr(k)}" ${['ledger', 'marcas', 'compras', 'sesiones', 'semanas'].includes(k) ? 'checked' : ''}>
          <label for="ri-${escAttr(k)}">${esc(t)}</label>
        </div>`).join('')}
      <p class="mini" style="margin-top:12px;color:var(--aviso)">La clave del panel y el tema nunca se borran aquí.</p>`,
    acciones: [
      { texto: 'Cancelar', clase: 'fantasma' },
      {
        texto: 'Continuar',
        clase: 'peligro',
        al: async (raiz, cerrar) => {
          const marcados = [...raiz.querySelectorAll('[data-borrar]')].filter((x) => x.checked).map((x) => x.dataset.borrar);
          if (!marcados.length) { aviso('No has marcado nada', 'mal'); return; }
          cerrar();
          const si = await confirmar({
            titulo: '¿Seguro del todo?',
            texto: `Se borrará: ${marcados.join(', ')}. Esto no se puede deshacer.`,
            textoSi: 'Sí, borrar', peligro: true,
          });
          if (!si) return;
          const si2 = await confirmar({
            titulo: 'Última confirmación',
            texto: 'Escríbelo en la cabeza y confirma: después de esto no hay vuelta atrás.',
            textoSi: 'Borrar definitivamente', peligro: true,
          });
          if (!si2) return;
          const base = catalogoInicial();
          store.lote((s) => {
            for (const col of marcados) {
              for (const id of Object.keys(s.estado[col] || {})) s.remove(col, id);
              if (col === 'tareas' || col === 'tienda') {
                for (const [id, reg] of Object.entries(base[col])) s.set(col, id, reg);
              }
            }
            s.fijarAjuste('objetivoAhorroId', null);
            if (marcados.includes('semanas')) s.fijarAjuste('racha', 0);
          });
          guardarEstadoYa(store.estado);
          aviso('Reinicio hecho', 'bien');
          refrescar();
        },
      },
    ],
  });
}

/* --------------------------------- Fotos -------------------------------- */

function pedirFotos(max = 2) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = max > 1;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const archivos = [...input.files].slice(0, max);
      input.remove();
      try {
        const fotos = [];
        for (const a of archivos) fotos.push(await comprimirFoto(a));
        resolve(fotos);
      } catch (e) {
        reject(e);
      }
    });
    input.click();
  });
}

/* -------------------------------- Sudoku -------------------------------- */

function claveSudoku() { return `rutineitor.v3.sudoku.${hoy()}`; }

function guardarSudoku() {
  try {
    localStorage.setItem(claveSudoku(), JSON.stringify({ tablero: ui.sudoku.tablero, fijas: ui.sudoku.fijas }));
  } catch (e) { /* sin espacio: no es crítico */ }
}

export function prepararSudoku() {
  if (ui.sudoku && ui.sudoku.fecha === hoy()) return;
  const p = puzzleDelDia(hoy(), 'medio');
  const fijas = p.tablero.map((f) => f.map((v) => v !== 0));
  let tablero = p.tablero.map((f) => f.slice());
  try {
    const guardado = JSON.parse(localStorage.getItem(claveSudoku()) || 'null');
    if (guardado && Array.isArray(guardado.tablero) && guardado.tablero.length === 9) {
      tablero = guardado.tablero;
      if (Array.isArray(guardado.fijas)) {
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (guardado.fijas[r][c]) fijas[r][c] = true;
      }
    }
  } catch (e) { /* empezamos de cero */ }
  ui.sudoku = { fecha: hoy(), dificultad: p.dificultad, tablero, fijas, solucion: p.solucion };
  ui.sudokuSel = null;
  ui.sudokuComprobado = false;
}

/* ------------------------------ Avisos vivos ---------------------------- */

function comprobarAvisos() {
  if (!store.ajuste('notificaciones', false)) return;
  const ahora = new Date();
  for (const e of recordatoriosInminentes(store.estado, ahora, 5)) {
    notificar('Rutineitor', `${e.titulo} · ${e.hora}`, `evt-${e.id}-${toDateKey(ahora)}`);
  }
  const o = objetivosDe(store.estado, hoy());
  const h = horaActual();
  if (h === o.corte) notificar('Rutineitor', 'Hora de dejar las pantallas.', `corte-${hoy()}`);
  if (h === o.cena) notificar('Rutineitor', 'Hora de cenar.', `cena-${hoy()}`);
  if (h === o.dormir) notificar('Rutineitor', 'Hora de apagar la luz.', `dormir-${hoy()}`);
}


/* -------------------------------- Arranque ------------------------------ */

export function iniciar({ raizId = 'app' } = {}) {
  const estadoInicial = cargarEstado();
  // La demo entra directa: es para enseñársela a alguien en treinta segundos,
  // no para que configure la casa de otro. El asistente es cosa de la app real.
  if (__DEMO__) estadoInicial.ajustes.configurado = { id: 'configurado', valor: true };
  store = crearStore(estadoInicial);
  sync = crearSync(store, { alCambiarEstadoSync: () => { if (ui.vista === 'padre' && ui.tabPadre === 'sistema') render(); } });

  store.suscribir((estado) => guardarEstado(estado));
  store.suscribirOps((op) => sync.encolar(op));
  // v3.5: la economía vuelve a ser como la de la v2. Una sola vez por
  // instalación (y se sube a la nube como cualquier ajuste); lo avanzado queda
  // apagado, no borrado, en Economía → Avanzado.
  migrarEconomia(store);
  // v3.5.1: los bonos de pantalla dicen cuánto tiempo dan (sin tocar lo que
  // haya cambiado el padre).
  migrarTienda(store);

  document.addEventListener('rt:almacen-lleno', () => {
    aviso('No cabe más en el móvil: borra fotos antiguas desde el panel.', 'mal');
  });

  // Un único listener para toda la app.
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-accion]');
    if (!el || el.closest('.modal-fondo')) {
      if (!el) return;
      // Dentro de un modal solo dejamos pasar acciones explícitas conocidas.
      if (!acciones[el.dataset.accion]) return;
    }
    const fn = acciones[el.dataset.accion];
    if (!fn) return;
    ev.preventDefault();
    fn(el, ev);
  });

  // Los grupos de tokenomics recuerdan si están abiertos (el evento toggle no
  // burbujea, por eso se escucha en fase de captura).
  document.addEventListener('toggle', (ev) => {
    const det = ev.target;
    if (!det || !det.dataset || !det.dataset.grupoTk) return;
    const id = det.dataset.grupoTk;
    const abiertos = new Set(ui.tkAbiertos);
    if (det.open) abiertos.add(id); else abiertos.delete(id);
    ui.tkAbiertos = [...abiertos];
  }, true);

  // Ajustes del panel: se guardan al cambiar el campo.
  document.addEventListener('change', (ev) => {
    // El asistente repinta al marcar una casilla, para que se vea el cambio.
    // Los campos de texto y de hora NO repintan: perderían el foco al escribir.
    if (ev.target.closest('.asistente') && ev.target.type === 'checkbox') {
      recogerAsistente();
      ui.asistente.error = null;
      pintar();
      return;
    }
    const tk = ev.target.closest('[data-tk]');
    if (tk) {
      const bruto = tk.type === 'checkbox' ? tk.checked : tk.value;
      const r = validarParametro(tk.dataset.tk, bruto);
      if (!r.ok) {
        aviso(r.razon, 'mal');
        render();
        return;
      }
      store.fijarAjuste(tk.dataset.tk, r.valor);
      if (tk.dataset.tk === 'efectosActivos' || tk.dataset.tk === 'sonidoActivo') {
        aplicarPreferenciasDeEfectos();
      }
      aviso('Guardado', 'bien');
      // Un cambio de tokenomics mueve la simulación: se repinta la pestaña.
      if (ui.vista === 'padre' && ui.tabPadre === 'economia') render();
      return;
    }
    const dp = ev.target.closest('[data-dp-tarea], [data-dp-op]');
    if (dp) {
      const clave = `${dp.dataset.dpFecha}|${dp.dataset.dpTarea || dp.dataset.dpOp}`;
      if (dp.dataset.dpTarea) ui.dpSel[clave] = dp.checked;
      else { ui.dpOp[clave] = dp.value; ui.dpSel[clave] = true; render(); }
      return;
    }
    const filtro = ev.target.closest('[data-filtro]');
    if (filtro) {
      ui.ecoFiltros = { ...(ui.ecoFiltros || {}), [filtro.dataset.filtro]: filtro.value };
      ui.ecoLimite = 60;
      render();
      return;
    }
    const el = ev.target.closest('[data-ajuste]');
    if (!el) return;
    const tipo = el.dataset.tipo;
    let valor = el.value;
    if (tipo === 'numero') valor = Number(valor);
    if (tipo === 'bool') valor = el.checked;
    store.fijarAjuste(el.dataset.ajuste, valor);
    if (el.dataset.ajuste === 'efectosActivos' || el.dataset.ajuste === 'sonidoActivo') {
      aplicarPreferenciasDeEfectos();
    }
    aviso('Guardado', 'bien');
  });

  procesarAutoAprobaciones(store);
  procesarStakings(store, { fecha: hoy() });
  prepararSudoku();

  motor = crearMotor($('#rt-fondo'), {
    escenaDe,
    calidadInicial: store.ajuste('calidadFondo', 'auto'),
    alCambiarNivel: (n, direccion) => {
      // Solo se avisa cuando el móvil no da para más: que se entere, sin drama.
      if (direccion === 'bajado' && n === 'baja') {
        aviso('Fondo en modo ligero para que la app vaya fina', '');
      }
    },
  });
  if (motor) motor.fijarTema(idTemaActual(), momentoDelDia());

  // Los efectos de celebración: se configuran con lo que diga Ajustes y se
  // vuelven a configurar cada vez que cambian esas preferencias.
  aplicarPreferenciasDeEfectos();

  // Los cinco fondos de salida no se anuncian como desbloqueo: si no, la
  // primera vez que se abre la app saltarían cinco celebraciones por nada.
  sembrarTemasVistos(store, TEMAS);
  // Y lo que ya estuviera conseguido antes de esta versión se da por visto.
  registrarLogros(store, {
    hucha: saldoHucha(store.estado),
    nivel: nivelDe(store.estado).nivel,
    temasDesbloqueados: contarAbiertos(store.estado, TEMAS).abiertos,
    temasTotales: TEMAS.length,
  }, hoy());

  pintar();

  setInterval(() => {
    const antes = hoy();
    procesarAutoAprobaciones(store);
    procesarStakings(store, { fecha: hoy() });
    comprobarAvisos();
    registrarMisionesCompletadas(store, hoy());
    if (antes !== hoy()) { prepararSudoku(); }
    render();
  }, 60000);

  if (!__DEMO__) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      eventoInstalacion = e;
    });
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* sin sw: la app sigue */ });
      });
    }
    sync.arrancar();
  }

  window.addEventListener('beforeunload', () => guardarEstadoYa(store.estado));

  // Para las pruebas automáticas.
  window.__rutineitor = { store, ui, acciones, render: pintar, prepararSudoku, VERSION, momentoDelDia, get motor() { return motor; } };
}

if (typeof document !== 'undefined' && document.getElementById('app')) {
  iniciar();
}
