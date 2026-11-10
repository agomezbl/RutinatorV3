/**
 * Catálogo y ajustes por defecto.
 *
 * Calibración (v3.6): 1 crédito por cada 5 minutos de tarea, y 1 h de ocio
 * cuesta 12 créditos. Una hora de tareas paga una hora de ocio (1:1); las
 * rebajas del padre lo abaratan. Una semana normal reparte ~145 créditos y
 * ~30 estrellas, como la v2 una vez convertida (×1,5).
 * Todo esto es editable por el padre desde el panel, sin tocar código.
 */

export const AJUSTES_POR_DEFECTO = {
  // --- Monedas ---
  nombreCreditos: 'créditos',
  nombreEstrellas: 'estrellas',
  iconoEstrellas: '⭐',
  estrellasPorObligatoria: 1,
  // --- Hucha e interés ---
  interesHuchaPct: 1,
  interesHuchaPeriodo: 'semana',
  interesHuchaTope: 25,
  ultimoInteresHucha: null,
  huchaSacarNil: true,         // v3.5: Nil mueve sus créditos a la hucha y de vuelta
  categoriasPersonalizadas: null, // nombres e iconos propios de los grupos de tareas
  // --- Staking: depósito a plazo ---
  depositoActivo: true,
  depositoMinimo: 20,
  deposito7Pct: 2,
  deposito14Pct: 5,
  deposito30Pct: 12,
  depositoRescateDevuelveCapital: true,
  // --- Staking: apuesta de racha ---
  apuestaActiva: true,
  apuestaMaxima: 60,
  apuestaMultiplicador: 1.6,
  apuestaPenalizacionPct: 50,
  apuestaSemanasMax: 4,
  // --- Staking: sueño ---
  stakingSuenoActivo: true,
  stakingSuenoNoches: 7,
  stakingSuenoPctNoche: 1.5,
  stakingSuenoMinimo: 15,
  // --- Bonificaciones circadianas ---
  margenDormirMin: 15,
  bonoNocheCumplida: 2,
  bonoRachaSuenoNoches: 5,
  bonoRachaSueno: 15,
  bonoRachaCreditos: 20,
  // --- Salud y ritmo natural ---
  estrellasPorHabito: 1,
  estrellasDiaCompleto: 3,
  vasosAguaObjetivo: 6,
  // --- Tiempo (v3.6): 1 crédito por cada 5 minutos de tarea ---
  minutosPorCredito: 5,
  // --- Otros ---
  valorPreparacion: 3,
  nombreHijo: 'Nil',
  tratamientoAdulto: 'papá',     // cómo se refiere la app al adulto que aprueba
  configurado: false,            // el asistente de primer uso aún no se ha pasado
  configuradoEn: null,
  claveHash: null,             // sin clave por defecto: se obliga a crearla en el primer uso
  claveCreada: false,
  autoAprobacionHoras: 6,
  umbralRacha: 70,             // % de cumplimiento semanal para que suba la racha
  inicioSemanaDia: 0,          // 0 = lunes
  // Ritmo circadiano
  cenaEntreSemana: '20:30',
  cenaFinde: '21:00',
  dormirEntreSemana: '22:00',
  dormirFinde: '23:00',
  horaCorteOcio: '21:30',
  horaCorteOcioFinde: '22:30',
  // Ocio
  topeMovilPorSemana: 2,
  precioMinimoAnime: 5,        // suelo real: el panel no deja bajar de aquí
  pcBloqueMinutos: 30,
  pcCreditosPorBloque: 6,      // 12 créditos la hora, como el resto del ocio
  pcLibreFinde: true,
  // Economía (v3.5: saldo continuo como la v2; ver gestion.js)
  modoSaldo: 'continuo',       // continuo | semanal
  tiendaPausada: false,
  multiplicadorDesde: null,         // ámbito 'rango'
  multiplicadorHasta: null,
  multiplicadorValor: 1,
  multiplicadorAmbito: 'siempre',   // siempre | finde | entresemana | hoy | rango
  multiplicadorFecha: null,         // fecha para el ámbito 'hoy'
  objetivoAhorroId: null,
  // --- Progresión (v3.3) ---
  racha: 0,
  escudos: 0,                  // escudos de racha disponibles
  escudosMaximos: 2,           // no se acumulan más de estos
  escudoCadaSemanas: 4,        // uno cada N semanas de racha seguidas
  // --- Misiones ---
  misionesActivas: true,
  misionesPorDia: 3,
  topeBonificacionMisiones: 1, // el multiplicador extra nunca pasa de +100 %
  // --- Desbloqueos ---
  desbloqueosActivos: true,    // apágalo y todos los fondos quedan abiertos
  // --- Propuestas de Nil ---
  propuestasActivas: true,
  limitePropuestas: 3,         // cuántas puede tener esperando a la vez
  // --- Efectos ---
  efectosActivos: true,        // el "juice": números que vuelan, vibración, sonido
  sonidoActivo: false,         // el sonido va aparte: por defecto, en silencio
  // Contadores de curiosidades (para logros secretos)
  vecesEscaparate: 0,
  sudokusResueltos: 0,
  // Personalización
  temaNil: 'bosque',
  temaPadre: 'pizarra',
  calidadFondo: 'auto',
  notificaciones: false,
  // Sincronización (no se sincroniza a sí misma)
  sync: null,
};

/**
 * Paleta de categorías. No está elegida a ojo: son los pasos validados para
 * fondo oscuro, en el orden en que pasan las comprobaciones de separación para
 * daltonismo y de contraste (ΔE adyacente 8.4 protan, 19.3 visión normal).
 * Si se cambia un color hay que volver a validar la lista entera.
 * Además, en las gráficas cada barra lleva SIEMPRE su icono, su nombre y su
 * número: el color refuerza, nunca es el único canal de identidad.
 */
export const PALETA_CATEGORIAS = [
  '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9',
];

export const CATEGORIAS = {
  tarde: { etiqueta: 'Tarde', color: PALETA_CATEGORIAS[0], icono: '🏠', orden: 1 },
  manana: { etiqueta: 'Mañana', color: PALETA_CATEGORIAS[1], icono: '🌅', orden: 2 },
  salud: { etiqueta: 'Cuidado', color: PALETA_CATEGORIAS[2], icono: '🌿', orden: 3 },
  semanal: { etiqueta: 'Semanal', color: PALETA_CATEGORIAS[3], icono: '📅', orden: 4 },
  puntual: { etiqueta: 'Puntual', color: PALETA_CATEGORIAS[4], icono: '⭐', orden: 5 },
  preparacion: { etiqueta: 'Preparación', color: PALETA_CATEGORIAS[5], icono: '🎒', orden: 6 },
  noche: { etiqueta: 'Noche', color: PALETA_CATEGORIAS[6], icono: '🌙', orden: 7 },
  staking: { etiqueta: 'Ahorro', color: '#ffb74d', icono: '🔒' },
  tienda: { etiqueta: 'Tienda', color: '#ef6b6b', icono: '🛍️' },
  ajuste: { etiqueta: 'Ajuste', color: '#b0bec5', icono: '±' },
  cierre: { etiqueta: 'Cierre', color: '#78909c', icono: '📦' },
  otros: { etiqueta: 'Otros', color: '#90a4ae', icono: '•' },
};

import { TAREAS_V35, TIENDA_V35, AJUSTES_V35 } from './catalogo-v35.js';

export const TODOS = [0, 1, 2, 3, 4, 5, 6];
export const LABORABLES = [0, 1, 2, 3, 4];

/**
 * Tareas (v3.6). El valor sale del TIEMPO: 1 crédito por cada 5 minutos
 * empezados, con un mínimo de 1 (`minutosPorCredito`). `minutos` es una
 * estimación fija, no un cronómetro: a Nil no se le mide el tiempo.
 * Las de puntualidad (cena, luces) valen fijo: no se hacen "durante" un rato.
 * Las obligatorias no dan créditos: dan `estrellas` (1 si no se indica).
 *
 * tipo: estandar | eleccion | obligatoria | circadiana | puntual | preparacion | habito
 */
const DOMINGO = [6];
const LUN_SAB = [0, 1, 2, 3, 4, 5];

export const TAREAS_POR_DEFECTO = [
  // ---------- Mañana ----------
  { id: 't_cama', nombre: 'Cama hecha', tipo: 'estandar', minutos: 5, valor: 1, categoria: 'manana', dias: TODOS, icono: '🛏️', orden: 10 },
  { id: 't_habitacion', nombre: 'Cuarto ordenado', tipo: 'estandar', minutos: 10, valor: 2, categoria: 'manana', dias: TODOS, icono: '🧹', orden: 20 },
  { id: 't_desayuno', nombre: 'Desayuno recogido y limpio', tipo: 'estandar', minutos: 5, valor: 1, categoria: 'manana', dias: TODOS, icono: '🥣', orden: 30 },
  { id: 't_higiene', nombre: 'Higiene y aseo personal', tipo: 'obligatoria', valor: 0, estrellas: 1, categoria: 'manana', dias: TODOS, icono: '🧼', orden: 40, nota: 'Ducha o lavado, dientes, desodorante y peinado.' },
  { id: 't_limpieza', nombre: 'Limpieza profunda', tipo: 'estandar', minutos: 60, valor: 12, categoria: 'semanal', dias: DOMINGO, icono: '🧽', orden: 45 },
  { id: 't_sabanas', nombre: 'Sábanas y toalla al lavado', tipo: 'obligatoria', valor: 0, estrellas: 1, categoria: 'semanal', dias: DOMINGO, icono: '🧺', orden: 46, nota: 'Cada domingo. Se nota al meterse en la cama.' },

  // ---------- Tarde ----------
  {
    id: 't_lavavajillas', nombre: 'Vaciar el lavavajillas', tipo: 'eleccion', valor: 0,
    categoria: 'tarde', dias: TODOS, icono: '🍶', orden: 60,
    opciones: [
      { id: 'solo', etiqueta: 'Yo solo, entero', minutos: 15, valor: 3 },
      { id: 'ayuda', etiqueta: 'Con ayuda', minutos: 10, valor: 2 },
    ],
  },
  { id: 't_basura', nombre: 'Basura al contenedor', tipo: 'estandar', minutos: 5, valor: 1, categoria: 'tarde', dias: LUN_SAB, icono: '🗑️', orden: 70 },
  { id: 't_mochila', nombre: 'Pronote + mochila', tipo: 'estandar', minutos: 15, valor: 3, categoria: 'tarde', dias: LABORABLES, icono: '📚', orden: 80, nota: 'Antes de cenar.' },
  { id: 't_contenedor', nombre: 'Contenedor a la calle', tipo: 'estandar', minutos: 5, valor: 1, categoria: 'tarde', dias: [1, 3], icono: '♻️', orden: 90 },
  { id: 't_marron', nombre: 'Entrar el contenedor marrón', tipo: 'estandar', minutos: 5, valor: 1, categoria: 'tarde', dias: [4], icono: '♻️', orden: 95, nota: 'El de la basura orgánica.' },
  { id: 't_ropa', nombre: 'La ropa de ayer en su sitio', tipo: 'obligatoria', valor: 0, estrellas: 1, categoria: 'tarde', dias: [0], icono: '👕', orden: 100, nota: 'La sucia al cesto, la limpia doblada. Ninguna en el suelo.' },
  { id: 't_mano', nombre: 'Echar una mano sin que te la pidan', tipo: 'obligatoria', valor: 0, estrellas: 2, categoria: 'tarde', dias: [2], icono: '🙌', orden: 105, nota: 'A quien sea, en lo que sea. Luego cuenta a quién y en qué.' },
  { id: 't_bano', nombre: 'El baño como te lo encontraste', tipo: 'obligatoria', valor: 0, estrellas: 1, categoria: 'tarde', dias: [4], icono: '🚿', orden: 110, nota: 'Sin pelos, sin toalla en el suelo, el lavabo limpio.' },
  { id: 't_mediahora', nombre: 'Media hora con alguien de casa', tipo: 'obligatoria', valor: 0, estrellas: 2, categoria: 'tarde', dias: [5], icono: '🫶', orden: 115, nota: 'Sin pantallas y sin que sea una tarea. Solo estar.' },
  { id: 't_auditoria_sem', nombre: 'Auditoría semanal', tipo: 'estandar', minutos: 30, valor: 6, categoria: 'semanal', dias: DOMINGO, icono: '📋', orden: 120, nota: 'Revisión de los números de la semana.' },

  // ---------- Noche (ritmo circadiano) ----------
  { id: 't_mesa', nombre: 'Poner la mesa de la cena', tipo: 'estandar', minutos: 5, valor: 1, categoria: 'noche', dias: TODOS, icono: '🍽️', orden: 130, nota: 'Antes de la cena, sin que te avisen.' },
  { id: 't_cocina', nombre: 'Recoger y limpiar mesa y cocina', tipo: 'estandar', minutos: 15, valor: 3, categoria: 'noche', dias: TODOS, icono: '🧽', orden: 135, nota: 'Después de cenar.' },
  { id: 't_recoger_cont', nombre: 'Recoger el contenedor', tipo: 'estandar', minutos: 5, valor: 1, categoria: 'noche', dias: [1, 3], icono: '♻️', orden: 138 },
  { id: 't_cena_hora', nombre: 'Cenar a la hora', tipo: 'circadiana', valor: 1, categoria: 'noche', dias: TODOS, icono: '🍲', orden: 140, referencia: 'cena' },
  { id: 't_luces', nombre: 'Luces apagadas a la hora', tipo: 'circadiana', valor: 1, categoria: 'noche', dias: TODOS, icono: '💤', orden: 145, referencia: 'dormir' },
  { id: 't_trato', nombre: 'Buen trato y modales', tipo: 'obligatoria', valor: 0, estrellas: 1, categoria: 'noche', dias: TODOS, icono: '🤝', orden: 150, nota: 'Cómo has tratado hoy a la gente de casa. Se mira al acabar el día.' },
  { id: 't_dientes_n', nombre: 'Dientes antes de dormir', tipo: 'obligatoria', valor: 0, estrellas: 1, categoria: 'noche', dias: TODOS, icono: '🦷', orden: 155, nota: 'Dos minutos de verdad.' },
  { id: 't_llamada', nombre: 'Llamar a alguien de la familia', tipo: 'obligatoria', valor: 0, estrellas: 2, categoria: 'noche', dias: [1], icono: '📞', orden: 160, nota: 'Que no viva aquí. Cinco minutos, y preguntarle algo tú.' },
  { id: 't_gracias', nombre: 'Dar las gracias de verdad', tipo: 'obligatoria', valor: 0, estrellas: 1, categoria: 'noche', dias: [3], icono: '💬', orden: 165, nota: 'A alguien, por algo concreto, y diciéndole por qué.' },
  { id: 't_auditoria', nombre: 'Auditoría del día con papá', tipo: 'estandar', minutos: 5, valor: 1, categoria: 'noche', dias: LUN_SAB, icono: '🤝', orden: 170, nota: 'Cinco minutos para repasar el día juntos.' },
  { id: 't_acompanamiento', nombre: 'Acompañamiento en la auditoría', tipo: 'estandar', minutos: 30, valor: 6, categoria: 'noche', dias: DOMINGO, icono: '🧭', orden: 175, nota: 'Media hora: revisamos la semana juntos.' },

  // ---------- Hábitos de cuidado (estrellas, se aprueban solos) ----------
  // Apagados de fábrica desde la v3.6 para que las estrellas valgan lo mismo
  // que en la v2 (unas 30 a la semana). Se encienden en Catálogo.
  // Son presencias, no restricciones: aquí no hay peso, ni calorías, ni comida "prohibida".
  { id: 'h_agua', nombre: 'Beber agua a lo largo del día', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '💧', orden: 210, referencia: 'agua', activa: false },
  { id: 'h_planta', nombre: 'Fruta o verdura de verdad', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '🥗', orden: 220, referencia: 'planta', activa: false },
  { id: 'h_calma', nombre: 'Comer con calma y sin pantallas', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '🍽️', orden: 230, referencia: 'calma', activa: false },
  { id: 'h_sol', nombre: 'Un rato fuera, a la luz del día', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '☀️', orden: 240, referencia: 'sol', activa: false },
  { id: 'h_mover', nombre: 'Mover el cuerpo un rato', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '🏃', orden: 250, referencia: 'movimiento', activa: false },
  { id: 'h_cocina', nombre: 'Echar una mano en la cocina', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '🥕', orden: 260, referencia: 'cocina', activa: false },
];

/**
 * Tienda (v3.6). Regla: 1 h de ocio = 12 créditos = 1 h de tareas.
 * Las rebajas del padre (Economía → Herramientas) son las que lo abaratan.
 * Los premios que se negocian (salidas, caprichos…) no vienen de fábrica:
 * se pactan con el hijo y se crean en Catálogo o desde sus propuestas.
 * `moneda`: 'semana' (saldo), 'hucha' (ahorro) o 'estrellas'.
 * `tipo`: bono | premio | buho | pasePc | extraAnime
 */
export const TIENDA_POR_DEFECTO = [
  // --- Ocio del día (aprobado por el padre) ---
  { id: 'b_tv', nombre: 'Bono TV', descripcion: 'Tele hoy, el tiempo que marca el bono.', duracion: 60, precio: 12, moneda: 'semana', tipo: 'bono', categoriaOcio: 'tv', requiereAprobacion: true, icono: '📺', orden: 10 },
  { id: 'b_movil', nombre: 'Bono Móvil', descripcion: 'Móvil hoy, el tiempo que marca el bono. Tope de días por semana.', duracion: 30, precio: 6, moneda: 'semana', tipo: 'bono', categoriaOcio: 'movil', requiereAprobacion: true, topeSemanal: 2, icono: '📱', orden: 20 },
  { id: 'b_anime', nombre: 'Bono Anime', descripcion: 'Dos episodios hoy.', duracion: 45, precio: 9, precioMinimo: 5, moneda: 'semana', tipo: 'bono', categoriaOcio: 'anime', requiereAprobacion: true, icono: '🌸', orden: 30 },
  { id: 'b_anime_extra', nombre: 'Anime: tiempo extra', descripcion: 'Un rato más, solo si ya tienes el bono de anime de hoy.', duracion: 30, precio: 6, moneda: 'semana', tipo: 'extraAnime', categoriaOcio: 'anime', requiereBase: 'b_anime', requiereAprobacion: true, icono: '➕', orden: 40 },
  { id: 'b_pc', nombre: 'Permiso de PC (entre semana)', descripcion: 'Abre el PC hoy aunque sea día de diario. El tiempo se paga aparte: 6 créditos cada 30 min.', precio: 0, moneda: 'semana', tipo: 'pasePc', categoriaOcio: 'pc', requiereAprobacion: true, icono: '🖥️', orden: 50 },
  { id: 'b_buho', nombre: 'Modo Búho', descripcion: 'Una hora más despierto, solo esta noche. Lo aprueba papá.', duracion: 60, precio: 12, moneda: 'semana', tipo: 'buho', requiereAprobacion: true, icono: '🦉', orden: 60 },
  { id: 'b_hora', nombre: 'Hora de ocio a elegir', descripcion: 'Una hora de lo que pactéis: consola, un juego, una actividad…', duracion: 60, precio: 12, moneda: 'semana', tipo: 'bono', categoriaOcio: 'otro', requiereAprobacion: true, icono: '🎟️', orden: 65 },

  // --- Premios (saldo) ---
  { id: 'p_sobre_op', nombre: 'Sobre One Piece TCG', descripcion: 'Un sobre.', precio: 27, moneda: 'semana', tipo: 'premio', requiereAprobacion: true, icono: '🏴‍☠️', orden: 70 },
  { id: 'p_sobre_pk', nombre: 'Sobre Pokémon TCG', descripcion: 'Un sobre.', precio: 54, moneda: 'semana', tipo: 'premio', requiereAprobacion: true, icono: '🃏', orden: 80 },

  // --- Premios grandes (hucha) ---
  { id: 'g_caja', nombre: 'Caja de sobres TCG (x6)', descripcion: 'Seis sobres de golpe.', precio: 180, moneda: 'hucha', tipo: 'premio', requiereAprobacion: true, icono: '📦', orden: 110 },
  { id: 'g_juego', nombre: 'Juego nuevo (Steam/Epic)', descripcion: 'Un juego de los que llevas tiempo mirando.', precio: 420, moneda: 'hucha', tipo: 'premio', requiereAprobacion: true, icono: '🎮', orden: 120 },

  // --- Regalos físicos (solo con estrellas) ---
  // Deliberadamente no hay comida entre los premios: el cuidado del cuerpo no
  // se premia con comida.
  { id: 'e_libro', nombre: 'Un libro o un cómic que elijas tú', descripcion: 'El que tú quieras.', precio: 90, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '📚', orden: 150 },
  { id: 'e_juegomesa', nombre: 'Un juego de mesa para toda la casa', descripcion: 'Para jugar juntos.', precio: 200, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '🎲', orden: 160 },
  { id: 'e_ropa', nombre: 'Esa camiseta o esas zapatillas', descripcion: 'Las que llevas tiempo queriendo.', precio: 330, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '👟', orden: 170 },
  { id: 'e_grande', nombre: 'El regalo grande del año', descripcion: 'Se pacta con papá.', precio: 550, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '🎁', orden: 180 },
];

export const HORARIO_POR_DEFECTO = [
  { id: 'h_cole_l', dia: 0, inicio: '08:00', fin: '17:00', titulo: 'Colegio', tipo: 'colegio', bloqueaOcio: true, requierePreparacion: false },
  { id: 'h_cole_m', dia: 1, inicio: '08:00', fin: '17:00', titulo: 'Colegio', tipo: 'colegio', bloqueaOcio: true, requierePreparacion: false },
  { id: 'h_cole_x', dia: 2, inicio: '08:00', fin: '17:00', titulo: 'Colegio', tipo: 'colegio', bloqueaOcio: true, requierePreparacion: false },
  { id: 'h_cole_j', dia: 3, inicio: '08:00', fin: '17:00', titulo: 'Colegio', tipo: 'colegio', bloqueaOcio: true, requierePreparacion: false },
  { id: 'h_cole_v', dia: 4, inicio: '08:00', fin: '17:00', titulo: 'Colegio', tipo: 'colegio', bloqueaOcio: true, requierePreparacion: false },
  { id: 'h_depor_m', dia: 1, inicio: '18:00', fin: '19:30', titulo: 'Entreno', tipo: 'extraescolar', bloqueaOcio: true, requierePreparacion: true },
  { id: 'h_depor_j', dia: 3, inicio: '18:00', fin: '19:30', titulo: 'Entreno', tipo: 'extraescolar', bloqueaOcio: true, requierePreparacion: true },
  { id: 'h_estudio', dia: 6, inicio: '11:00', fin: '12:00', titulo: 'Repaso tranquilo', tipo: 'rutina', bloqueaOcio: false, requierePreparacion: false },
];

/**
 * Estado de una casa nueva. `{ version: 35 }` da el catálogo antiguo (lo usan
 * las pruebas del motor, calibradas con aquellos números).
 */
export function catalogoInicial({ version = 36 } = {}) {
  const v35 = version === 35;
  const tareas = v35 ? TAREAS_V35 : TAREAS_POR_DEFECTO;
  const tienda = v35 ? TIENDA_V35 : TIENDA_POR_DEFECTO;
  const ajustes = v35 ? { ...AJUSTES_POR_DEFECTO, ...AJUSTES_V35 } : AJUSTES_POR_DEFECTO;
  const estado = {
    version: 3,
    ajustes: {}, tareas: {}, marcas: {}, ledger: {}, tienda: {},
    compras: {}, horario: {}, eventos: {}, sesiones: {}, semanas: {},
  };
  for (const [clave, valor] of Object.entries(ajustes)) {
    estado.ajustes[clave] = { id: clave, valor };
  }
  for (const t of tareas) {
    estado.tareas[t.id] = { activa: true, ...t };
  }
  for (const p of tienda) {
    estado.tienda[p.id] = { activo: true, ...p };
  }
  for (const h of HORARIO_POR_DEFECTO) {
    estado.horario[h.id] = { ...h };
  }
  return estado;
}
