/**
 * Catálogo y ajustes por defecto.
 *
 * Calibración de referencia (sección 8 del encargo): un día entre semana
 * reparte ~36-38 créditos, que se dividen aproximadamente en tercios:
 *   · un tercio para lo esencial de hoy (un bono de ocio básico)
 *   · un tercio para un extra del mismo día (otra categoría, a elegir)
 *   · un tercio que se queda acumulando (fin de semana o hucha)
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
  // --- Otros ---
  valorPreparacion: 3,
  nombreHijo: 'Nil',
  tratamientoAdulto: 'papá',     // cómo se refiere la app al adulto que aprueba
  configurado: false,            // el asistente de primer uso aún no se ha pasado
  configuradoEn: null,
  claveHash: null,             // sin clave por defecto: se obliga a crearla en el primer uso
  claveCreada: false,
  autoAprobacionHoras: 12,
  umbralRacha: 70,             // % de cumplimiento semanal para que suba la racha
  inicioSemanaDia: 0,          // 0 = lunes
  // Ritmo circadiano
  cenaEntreSemana: '20:30',
  cenaFinde: '21:15',
  dormirEntreSemana: '22:30',
  dormirFinde: '23:45',
  horaCorteOcio: '21:00',
  // Ocio
  topeMovilPorSemana: 2,
  precioMinimoAnime: 6,        // suelo real: el panel no deja bajar de aquí
  pcBloqueMinutos: 30,
  pcCreditosPorBloque: 5,
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

export const TODOS = [0, 1, 2, 3, 4, 5, 6];
export const LABORABLES = [0, 1, 2, 3, 4];

/** tipo: estandar | eleccion | obligatoria | circadiana | puntual | preparacion */
export const TAREAS_POR_DEFECTO = [
  // ---------- Mañana ----------
  { id: 't_levantarse', nombre: 'Levantarme a la hora sin que me insistan', tipo: 'estandar', valor: 3, categoria: 'manana', dias: LABORABLES, icono: '⏰', orden: 10 },
  { id: 't_cama', nombre: 'Hacer la cama', tipo: 'estandar', valor: 2, categoria: 'manana', dias: TODOS, icono: '🛏️', orden: 20 },
  { id: 't_desayuno', nombre: 'Desayunar y recoger lo mío', tipo: 'estandar', valor: 2, categoria: 'manana', dias: TODOS, icono: '🥣', orden: 30 },
  { id: 't_dientes_m', nombre: 'Lavarme los dientes (mañana)', tipo: 'obligatoria', valor: 0, categoria: 'manana', dias: TODOS, icono: '🪥', orden: 40 },
  { id: 't_mochila', nombre: 'Preparar la mochila', tipo: 'estandar', valor: 3, categoria: 'manana', dias: LABORABLES, icono: '🎒', orden: 50 },

  // ---------- Tarde ----------
  { id: 't_deberes', nombre: 'Deberes y estudio', tipo: 'estandar', valor: 6, categoria: 'tarde', dias: LABORABLES, icono: '📚', orden: 60 },
  { id: 't_habitacion', nombre: 'Dejar la habitación recogida', tipo: 'estandar', valor: 3, categoria: 'tarde', dias: TODOS, icono: '🧺', orden: 70 },
  { id: 't_mesa', nombre: 'Poner y quitar la mesa', tipo: 'estandar', valor: 3, categoria: 'tarde', dias: TODOS, icono: '🍽️', orden: 80 },
  {
    id: 't_lavavajillas', nombre: 'Vaciar el lavavajillas', tipo: 'eleccion', valor: 0,
    categoria: 'tarde', dias: TODOS, icono: '🍶', orden: 90,
    opciones: [
      { id: 'solo', etiqueta: 'Yo solo, entero', valor: 4 },
      { id: 'ayuda', etiqueta: 'Con ayuda', valor: 2 },
    ],
  },
  { id: 't_basura', nombre: 'Sacar la basura', tipo: 'estandar', valor: 2, categoria: 'tarde', dias: TODOS, icono: '🗑️', orden: 100 },
  { id: 't_ducha', nombre: 'Ducharme', tipo: 'obligatoria', valor: 0, categoria: 'tarde', dias: TODOS, icono: '🚿', orden: 110 },

  // ---------- Noche (ritmo circadiano) ----------
  { id: 't_cena_hora', nombre: 'Cenar a la hora', tipo: 'circadiana', valor: 3, categoria: 'noche', dias: TODOS, icono: '🍲', orden: 120, referencia: 'cena' },
  { id: 't_pantallas', nombre: 'Dejar las pantallas a la hora', tipo: 'circadiana', valor: 3, categoria: 'noche', dias: TODOS, icono: '📵', orden: 130, referencia: 'corte' },
  { id: 't_luces', nombre: 'Luces apagadas a la hora', tipo: 'circadiana', valor: 3, categoria: 'noche', dias: TODOS, icono: '💤', orden: 140, referencia: 'dormir' },
  { id: 't_auditoria', nombre: 'Auditoría del día con papá (5-10 min)', tipo: 'estandar', valor: 1, categoria: 'noche', dias: TODOS, icono: '🤝', orden: 150 },
  { id: 't_dientes_n', nombre: 'Lavarme los dientes (noche)', tipo: 'obligatoria', valor: 0, categoria: 'noche', dias: TODOS, icono: '🪥', orden: 160 },

  // ---------- Semanales ----------
  { id: 't_compra', nombre: 'Ayudar con la compra', tipo: 'estandar', valor: 5, categoria: 'semanal', dias: [5], icono: '🛒', orden: 170 },
  { id: 't_bano', nombre: 'Limpiar el baño', tipo: 'estandar', valor: 6, categoria: 'semanal', dias: [5], icono: '🧽', orden: 180 },
  { id: 't_plantas', nombre: 'Regar las plantas', tipo: 'estandar', valor: 2, categoria: 'semanal', dias: [2, 6], icono: '🪴', orden: 190 },

  // ---------- Buen trato (se paga en estrellas, lo valora el padre) ----------
  { id: 'e_trato', nombre: 'Buen trato en casa hoy', tipo: 'estandar', moneda: 'estrellas', valor: 2, categoria: 'salud', dias: TODOS, icono: '🤍', orden: 195 },

  // ---------- Hábitos de cuidado (estrellas, se aprueban solos) ----------
  // Son presencias, no restricciones: cosas que se hacen, nunca cosas que se
  // evitan. Aquí no hay peso, ni calorías, ni comida "prohibida".
  { id: 'h_agua', nombre: 'Beber agua a lo largo del día', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '💧', orden: 210, referencia: 'agua' },
  { id: 'h_planta', nombre: 'Fruta o verdura de verdad', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '🥗', orden: 220, referencia: 'planta' },
  { id: 'h_calma', nombre: 'Comer con calma y sin pantallas', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '🍽️', orden: 230, referencia: 'calma' },
  { id: 'h_sol', nombre: 'Un rato fuera, a la luz del día', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '☀️', orden: 240, referencia: 'sol' },
  { id: 'h_mover', nombre: 'Mover el cuerpo un rato', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '🏃', orden: 250, referencia: 'movimiento' },
  { id: 'h_cocina', nombre: 'Echar una mano en la cocina', tipo: 'habito', valor: 1, categoria: 'salud', dias: TODOS, icono: '🥕', orden: 260, referencia: 'cocina' },
];

/**
 * Tienda. `moneda`: 'semana' (saldo semanal) o 'hucha' (ahorro persistente).
 * `tipo`: bono | premio | buho | pasePc | extraAnime
 */
export const TIENDA_POR_DEFECTO = [
  // --- Bonos de ocio (un día concreto, aprobados por el padre) ---
  { id: 'b_tv', nombre: 'Bono TV', descripcion: 'Tele hoy, el tiempo que marca el bono.', duracion: 60, precio: 10, moneda: 'semana', tipo: 'bono', categoriaOcio: 'tv', requiereAprobacion: true, icono: '📺', orden: 10 },
  { id: 'b_movil', nombre: 'Bono Móvil', descripcion: 'Móvil hoy, el tiempo que marca el bono. Tope de días por semana.', duracion: 60, precio: 14, moneda: 'semana', tipo: 'bono', categoriaOcio: 'movil', requiereAprobacion: true, topeSemanal: 2, icono: '📱', orden: 20 },
  { id: 'b_anime', nombre: 'Bono Anime', descripcion: 'Uno o dos episodios hoy.', duracion: 60, precio: 12, precioMinimo: 6, moneda: 'semana', tipo: 'bono', categoriaOcio: 'anime', requiereAprobacion: true, icono: '🌸', orden: 30 },
  { id: 'b_anime_extra', nombre: 'Anime: tiempo extra', descripcion: 'Un rato más, solo si ya tienes el bono de anime de hoy.', duracion: 30, precio: 6, moneda: 'semana', tipo: 'extraAnime', categoriaOcio: 'anime', requiereBase: 'b_anime', requiereAprobacion: true, icono: '➕', orden: 40 },
  { id: 'b_pc', nombre: 'Pase de PC (entre semana)', descripcion: 'Desbloquea la sesión de PC de hoy si es día de diario.', precio: 14, moneda: 'semana', tipo: 'pasePc', categoriaOcio: 'pc', requiereAprobacion: true, icono: '🖥️', orden: 50 },
  { id: 'b_buho', nombre: 'Modo Búho', descripcion: 'Levanta el toque de queda solo esta noche. Lo aprueba papá.', precio: 18, moneda: 'semana', tipo: 'buho', requiereAprobacion: true, icono: '🦉', orden: 60 },

  // --- Premios cotidianos (saldo semanal) ---
  { id: 'p_peli', nombre: 'Noche de película', descripcion: 'Eliges la peli y se ve en familia.', precio: 15, moneda: 'semana', tipo: 'premio', requiereAprobacion: true, icono: '🎬', orden: 70 },
  { id: 'p_amigos', nombre: 'Tarde con amigos', descripcion: 'Salida extra con tus amigos.', precio: 18, moneda: 'semana', tipo: 'premio', requiereAprobacion: true, icono: '🧑‍🤝‍🧑', orden: 80 },
  { id: 'p_menu', nombre: 'Eliges la cena', descripcion: 'Tú decides el menú de una cena.', precio: 10, moneda: 'semana', tipo: 'premio', requiereAprobacion: true, icono: '🍕', orden: 90 },
  { id: 'p_sintareas', nombre: 'Día sin tareas', descripcion: 'Un día libre de tareas estándar (las obligatorias siguen).', precio: 25, moneda: 'semana', tipo: 'premio', requiereAprobacion: true, icono: '🏖️', orden: 100 },

  // --- Premios grandes (hucha) ---
  { id: 'g_libro', nombre: 'Libro o manga a elegir', descripcion: 'El que tú quieras, sin discusión.', precio: 150, moneda: 'hucha', tipo: 'premio', requiereAprobacion: true, icono: '📖', orden: 110 },
  { id: 'g_juego', nombre: 'Videojuego', descripcion: 'Un juego de los que llevas tiempo mirando.', precio: 350, moneda: 'hucha', tipo: 'premio', requiereAprobacion: true, icono: '🎮', orden: 120 },
  { id: 'g_auriculares', nombre: 'Auriculares buenos', descripcion: 'De los de verdad, no los de propina.', precio: 500, moneda: 'hucha', tipo: 'premio', requiereAprobacion: true, icono: '🎧', orden: 130 },
  { id: 'g_excursion', nombre: 'Excursión / plan grande', descripcion: 'Un plan de día entero elegido por ti.', precio: 650, moneda: 'hucha', tipo: 'premio', requiereAprobacion: true, icono: '🏔️', orden: 140 },

  // --- Regalos físicos (solo con estrellas) ---
  // Deliberadamente no hay comida entre los premios: el cuidado del cuerpo no
  // se premia con comida.
  { id: 'e_semillas', nombre: 'Semillas y una maceta', descripcion: 'Para plantar lo que quieras y verlo crecer.', precio: 10, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '🌱', orden: 150 },
  { id: 'e_libreta', nombre: 'Libreta o material de dibujo', descripcion: 'El que elijas tú.', precio: 15, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '📓', orden: 160 },
  { id: 'e_mineral', nombre: 'Un mineral para la colección', descripcion: 'Uno que te guste de verdad.', precio: 18, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '💎', orden: 170 },
  { id: 'e_planta', nombre: 'Una planta para tu cuarto', descripcion: 'Tuya, y la cuidas tú.', precio: 22, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '🪴', orden: 180 },
  { id: 'e_salida', nombre: 'Salida a la naturaleza', descripcion: 'Un día fuera, donde tú digas.', precio: 40, moneda: 'estrellas', tipo: 'premio', requiereAprobacion: true, icono: '🏞️', orden: 190 },
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

export function catalogoInicial() {
  const estado = {
    version: 3,
    ajustes: {}, tareas: {}, marcas: {}, ledger: {}, tienda: {},
    compras: {}, horario: {}, eventos: {}, sesiones: {}, semanas: {},
  };
  for (const [clave, valor] of Object.entries(AJUSTES_POR_DEFECTO)) {
    estado.ajustes[clave] = { id: clave, valor };
  }
  for (const t of TAREAS_POR_DEFECTO) {
    estado.tareas[t.id] = { activa: true, ...t };
  }
  for (const p of TIENDA_POR_DEFECTO) {
    estado.tienda[p.id] = { activo: true, ...p };
  }
  for (const h of HORARIO_POR_DEFECTO) {
    estado.horario[h.id] = { ...h };
  }
  return estado;
}
