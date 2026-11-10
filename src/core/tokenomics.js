/**
 * TOKENOMICS — registro central de TODO lo que se puede tocar de la economía.
 *
 * Aquí no hay lógica: hay una descripción de cada parámetro (qué es, qué tipo
 * de valor admite, entre qué límites y qué significa en lenguaje normal). El
 * panel del padre se dibuja solo a partir de esta lista, así que añadir un
 * parámetro nuevo es añadir una línea aquí, no tocar la interfaz.
 *
 * Los límites no son decorativos: `validarParametro` los aplica de verdad, y
 * por eso no se puede dejar el bono de anime a 0 ni poner una racha imposible.
 */

import { minutosDeHora } from './util.js';

export const GRUPOS = [
  {
    id: 'monedas',
    titulo: 'Monedas',
    resumen: 'Cómo se llaman y qué pinta tienen las dos monedas del sistema.',
    campos: [
      { id: 'nombreCreditos', etiqueta: 'Nombre de los créditos', tipo: 'texto', max: 20, ayuda: 'Cómo los llama la app en todas las pantallas.' },
      { id: 'nombreEstrellas', etiqueta: 'Nombre de las estrellas', tipo: 'texto', max: 20, ayuda: 'La segunda moneda: higiene, buen trato y cuidado. Solo compra regalos físicos.' },
      { id: 'iconoEstrellas', etiqueta: 'Icono de las estrellas', tipo: 'texto', max: 3 },
    ],
  },
  {
    id: 'ritmo',
    titulo: 'Ritmo de la economía',
    resumen: 'Cuánto se gana y con qué multiplicadores.',
    campos: [
      { id: 'multiplicadorValor', etiqueta: 'Multiplicador de lo ganado', tipo: 'decimal', min: 0.5, max: 5, paso: 0.5, ayuda: 'Multiplica solo lo que se GANA. Nunca lo que se gasta.' },
      { id: 'multiplicadorAmbito', etiqueta: 'Cuándo se aplica', tipo: 'opcion', opciones: [
        { id: 'siempre', etiqueta: 'Siempre' },
        { id: 'finde', etiqueta: 'Solo fin de semana' },
        { id: 'entresemana', etiqueta: 'Solo entre semana' },
        { id: 'hoy', etiqueta: 'Solo hoy' },
        { id: 'rango', etiqueta: 'Entre dos fechas' },
      ] },
      { id: 'minutosPorCredito', etiqueta: 'Minutos de tarea por crédito', tipo: 'numero', min: 1, max: 60, sufijo: 'min', ayuda: 'La regla del tiempo: con 5, una tarea de 15 min vale 3 créditos y una hora de tareas, 12. Sirve para calcular el valor de las tareas nuevas y de las propuestas de Nil; no cambia lo ya guardado.' },
      { id: 'valorPreparacion', etiqueta: 'Valor de una tarea de preparación', tipo: 'numero', min: 0, max: 30, ayuda: 'Las que genera solo el horario cuando un bloque pide preparación.' },
    ],
  },
  {
    id: 'semana',
    titulo: 'Semana, racha y aprobación',
    resumen: 'Cómo se cierra la semana y qué hace subir la racha.',
    campos: [
      { id: 'autoAprobacionHoras', etiqueta: 'Auto-aprobación', tipo: 'numero', min: 1, max: 72, sufijo: 'h', ayuda: 'Si no actúas en este tiempo, la tarea marcada se da por buena.' },
      { id: 'umbralRacha', etiqueta: 'Umbral de racha', tipo: 'numero', min: 10, max: 100, sufijo: '%', ayuda: 'Cumplimiento mínimo de la semana para que la racha suba.' },
      { id: 'bonoRachaCreditos', etiqueta: 'Bonus al subir la racha', tipo: 'numero', min: 0, max: 200, ayuda: 'Créditos que se abonan a la hucha cada vez que la racha sube.' },
    ],
  },
  {
    id: 'hucha',
    titulo: 'Hucha e interés',
    resumen: 'Lo que no se gasta trabaja solo.',
    campos: [
      { id: 'interesHuchaPct', etiqueta: 'Interés de la hucha', tipo: 'decimal', min: 0, max: 10, paso: 0.1, sufijo: '%', ayuda: 'Se abona automáticamente sobre el saldo libre de la hucha. Ponlo a 0 para desactivarlo.' },
      { id: 'interesHuchaPeriodo', etiqueta: 'Cada cuánto se abona', tipo: 'opcion', opciones: [
        { id: 'dia', etiqueta: 'Cada día' },
        { id: 'semana', etiqueta: 'Cada semana' },
      ] },
      { id: 'interesHuchaTope', etiqueta: 'Tope de interés por abono', tipo: 'numero', min: 0, max: 500, ayuda: 'Para que una hucha muy grande no dispare la economía. 0 = sin tope.' },
      { id: 'huchaSacarNil', etiqueta: 'Nil puede sacar de la hucha', tipo: 'bool', ayuda: 'Si lo apagas, solo tú puedes pasar créditos de la hucha al saldo (Economía → Herramientas).' },
    ],
  },
  {
    id: 'deposito',
    titulo: 'Staking · depósito a plazo',
    resumen: 'Bloquear créditos de la hucha un tiempo a cambio de interés.',
    campos: [
      { id: 'depositoActivo', etiqueta: 'Disponible', tipo: 'bool' },
      { id: 'depositoMinimo', etiqueta: 'Depósito mínimo', tipo: 'numero', min: 1, max: 1000 },
      { id: 'deposito7Pct', etiqueta: 'Interés a 7 días', tipo: 'decimal', min: 0, max: 50, paso: 0.5, sufijo: '%' },
      { id: 'deposito14Pct', etiqueta: 'Interés a 14 días', tipo: 'decimal', min: 0, max: 50, paso: 0.5, sufijo: '%' },
      { id: 'deposito30Pct', etiqueta: 'Interés a 30 días', tipo: 'decimal', min: 0, max: 80, paso: 0.5, sufijo: '%' },
      { id: 'depositoRescateDevuelveCapital', etiqueta: 'Si lo rompe antes, recupera el capital', tipo: 'bool', ayuda: 'Recomendado dejarlo activado: pierde el interés, no el dinero. Enseña paciencia sin castigar.' },
    ],
  },
  {
    id: 'apuesta',
    titulo: 'Staking · apuesta de racha',
    resumen: 'Apostar a que la racha aguanta. El único que puede salir mal.',
    campos: [
      { id: 'apuestaActiva', etiqueta: 'Disponible', tipo: 'bool' },
      { id: 'apuestaMaxima', etiqueta: 'Apuesta máxima', tipo: 'numero', min: 1, max: 1000, ayuda: 'Techo para que una mala semana no se lleve meses de ahorro.' },
      { id: 'apuestaMultiplicador', etiqueta: 'Se multiplica por', tipo: 'decimal', min: 1.1, max: 4, paso: 0.1, ayuda: 'Lo que cobra si mantiene la racha las semanas apostadas.' },
      { id: 'apuestaPenalizacionPct', etiqueta: 'Si falla, pierde', tipo: 'numero', min: 0, max: 100, sufijo: '%', ayuda: 'Porcentaje de lo apostado que se pierde al romper la racha. 50 % es un buen punto de partida.' },
      { id: 'apuestaSemanasMax', etiqueta: 'Semanas máximas por apuesta', tipo: 'numero', min: 1, max: 12 },
    ],
  },
  {
    id: 'sueno',
    titulo: 'Staking · sueño',
    resumen: 'Bloquear créditos y cobrar por cada noche cumplida.',
    campos: [
      { id: 'stakingSuenoActivo', etiqueta: 'Disponible', tipo: 'bool' },
      { id: 'stakingSuenoNoches', etiqueta: 'Noches del compromiso', tipo: 'numero', min: 3, max: 30 },
      { id: 'stakingSuenoPctNoche', etiqueta: 'Interés por noche cumplida', tipo: 'decimal', min: 0, max: 10, paso: 0.5, sufijo: '%' },
      { id: 'stakingSuenoMinimo', etiqueta: 'Mínimo a bloquear', tipo: 'numero', min: 1, max: 1000 },
    ],
  },
  {
    id: 'circadiano',
    titulo: 'Ritmo circadiano',
    resumen: 'Horas objetivo y qué se bonifica.',
    campos: [
      { id: 'cenaEntreSemana', etiqueta: 'Cena entre semana', tipo: 'hora' },
      { id: 'cenaFinde', etiqueta: 'Cena fin de semana', tipo: 'hora' },
      { id: 'dormirEntreSemana', etiqueta: 'Dormir entre semana', tipo: 'hora' },
      { id: 'dormirFinde', etiqueta: 'Dormir fin de semana', tipo: 'hora' },
      { id: 'horaCorteOcio', etiqueta: 'Corte del ocio entre semana', tipo: 'hora' },
      { id: 'horaCorteOcioFinde', etiqueta: 'Corte del ocio fin de semana', tipo: 'hora', ayuda: 'Viernes y sábado por la noche.' },
      { id: 'margenDormirMin', etiqueta: 'Margen de cortesía al dormir', tipo: 'numero', min: 0, max: 60, sufijo: 'min', ayuda: 'Hasta cuántos minutos después de la hora sigue contando como noche cumplida.' },
      { id: 'bonoNocheCumplida', etiqueta: 'Bonus por noche cumplida', tipo: 'numero', min: 0, max: 20, ayuda: 'Créditos por apuntar que se durmió a la hora.' },
      { id: 'bonoRachaSuenoNoches', etiqueta: 'Racha de noches para bonus extra', tipo: 'numero', min: 2, max: 30 },
      { id: 'bonoRachaSueno', etiqueta: 'Bonus por esa racha', tipo: 'numero', min: 0, max: 100 },
    ],
  },
  {
    id: 'salud',
    titulo: 'Salud y ritmo natural',
    resumen: 'Hábitos de cuidado. Se pagan en estrellas, no en créditos.',
    campos: [
      { id: 'estrellasPorHabito', etiqueta: 'Estrellas por hábito marcado', tipo: 'numero', min: 0, max: 10 },
      { id: 'estrellasDiaCompleto', etiqueta: 'Estrellas por día completo', tipo: 'numero', min: 0, max: 20, ayuda: 'Si marca todos los hábitos del día.' },
      { id: 'vasosAguaObjetivo', etiqueta: 'Vasos de agua al día', tipo: 'numero', min: 2, max: 12 },
    ],
  },
  {
    id: 'ocio',
    titulo: 'Ocio',
    resumen: 'Los topes y el precio del PC.',
    campos: [
      { id: 'topeMovilPorSemana', etiqueta: 'Días de móvil por semana', tipo: 'numero', min: 0, max: 7 },
      { id: 'precioMinimoAnime', etiqueta: 'Suelo del bono de anime', tipo: 'numero', min: 1, max: 100, ayuda: 'Nunca puede costar menos que esto, ni por error desde el panel.' },
      { id: 'pcBloqueMinutos', etiqueta: 'Minutos por bloque de PC', tipo: 'numero', min: 5, max: 120, sufijo: 'min' },
      { id: 'pcCreditosPorBloque', etiqueta: 'Créditos por bloque de PC', tipo: 'numero', min: 0, max: 60 },
      { id: 'pcLibreFinde', etiqueta: 'PC libre el fin de semana', tipo: 'bool' },
    ],
  },
  {
    id: 'progresion',
    titulo: 'Progresión y racha',
    resumen: 'El nivel, los escudos de racha y los fondos que se desbloquean.',
    campos: [
      { id: 'escudoCadaSemanas', etiqueta: 'Un escudo cada N semanas de racha', tipo: 'numero', min: 1, max: 20, ayuda: 'El escudo salva un fallo solo, sin que Nil tenga que hacer nada. Es lo que evita que una mala semana se lleve dos meses de constancia.' },
      { id: 'escudosMaximos', etiqueta: 'Escudos que puede acumular', tipo: 'numero', min: 0, max: 5, ayuda: 'Ponlo a 0 para quitar los escudos del todo.' },
      { id: 'desbloqueosActivos', etiqueta: 'Fondos que se desbloquean', tipo: 'bool', ayuda: 'Apágalo y los diecisiete fondos quedan abiertos desde el primer día.' },
    ],
  },
  {
    id: 'misiones',
    titulo: 'Misiones',
    resumen: 'Los retos diarios. No dan créditos: hacen que lo del día valga más.',
    campos: [
      { id: 'misionesActivas', etiqueta: 'Misiones encendidas', tipo: 'bool' },
      { id: 'misionesPorDia', etiqueta: 'Misiones al día', tipo: 'numero', min: 0, max: 4 },
      { id: 'topeBonificacionMisiones', etiqueta: 'Tope del extra que dan', tipo: 'decimal', min: 0, max: 3, paso: 0.25, ayuda: 'En multiplicador: 1 significa que como mucho suman un +100 % a lo que se gane ese día.' },
    ],
  },
  {
    id: 'propuestas',
    titulo: 'Propuestas de Nil',
    resumen: 'Si Nil puede proponer tareas, valores y premios, y cuántas a la vez.',
    campos: [
      { id: 'propuestasActivas', etiqueta: 'Nil puede proponer', tipo: 'bool', ayuda: 'Nunca aplica nada él solo: propone, y tú aceptas, rechazas con motivo o contraofertas.' },
      { id: 'limitePropuestas', etiqueta: 'Propuestas abiertas a la vez', tipo: 'numero', min: 1, max: 10 },
    ],
  },
  {
    id: 'efectos',
    titulo: 'Efectos',
    resumen: 'Las animaciones al marcar, la vibración y el sonido.',
    campos: [
      { id: 'efectosActivos', etiqueta: 'Animaciones y vibración', tipo: 'bool', ayuda: 'Si el móvil va justo o simplemente molestan, se apagan aquí. La app funciona igual.' },
      { id: 'sonidoActivo', etiqueta: 'Sonido', tipo: 'bool', ayuda: 'Viene apagado a propósito: un móvil que empieza a sonar sin avisar se silencia para siempre.' },
    ],
  },
];

export const CAMPOS_POR_ID = Object.fromEntries(
  GRUPOS.flatMap((g) => g.campos.map((c) => [c.id, { ...c, grupo: g.id }])),
);

/**
 * Valida y normaliza un valor antes de guardarlo.
 * Devuelve { ok, valor } o { ok:false, razon }.
 */
export function validarParametro(id, valorBruto) {
  const campo = CAMPOS_POR_ID[id];
  if (!campo) return { ok: false, razon: 'Ese parámetro no existe.' };

  if (campo.tipo === 'bool') return { ok: true, valor: Boolean(valorBruto) };

  if (campo.tipo === 'texto') {
    const t = String(valorBruto ?? '').trim();
    if (!t) return { ok: false, razon: 'No puede quedar vacío.' };
    return { ok: true, valor: t.slice(0, campo.max || 40) };
  }

  if (campo.tipo === 'hora') {
    // No basta con el formato: 25:00 tiene la forma correcta y no existe.
    const t = String(valorBruto || '');
    if (!/^\d{2}:\d{2}$/.test(t) || minutosDeHora(t) === null) {
      return { ok: false, razon: 'La hora no es válida.' };
    }
    return { ok: true, valor: t };
  }

  if (campo.tipo === 'opcion') {
    const existe = (campo.opciones || []).some((o) => o.id === valorBruto);
    if (!existe) return { ok: false, razon: 'Esa opción no existe.' };
    return { ok: true, valor: valorBruto };
  }

  const n = Number(valorBruto);
  if (!Number.isFinite(n)) return { ok: false, razon: 'Tiene que ser un número.' };
  const v = campo.tipo === 'numero' ? Math.round(n) : Math.round(n * 100) / 100;
  if (campo.min !== undefined && v < campo.min) return { ok: false, razon: `El mínimo es ${campo.min}.` };
  if (campo.max !== undefined && v > campo.max) return { ok: false, razon: `El máximo es ${campo.max}.` };
  return { ok: true, valor: v };
}

/** Lee un parámetro del estado con su valor por defecto. */
export function leerParametro(estado, id, porDefecto = null) {
  const r = estado.ajustes?.[id];
  return r === undefined || r === null ? porDefecto : r.valor;
}

/**
 * Simulación honesta de la economía: con los valores actuales, cuánto puede
 * ganar Nil en una semana y cuánto cuesta un día de ocio típico.
 * Sirve para que el padre vea el efecto de un cambio ANTES de guardarlo.
 */
export function simular(estado, { tareasDelDiaFn, diasMuestra }) {
  let ganadoSemana = 0;
  const porDia = [];
  for (const fecha of diasMuestra) {
    let dia = 0;
    for (const t of tareasDelDiaFn(estado, fecha)) {
      if (t.tipo === 'obligatoria') continue;
      if (t.tipo === 'eleccion') {
        const valores = (t.opciones || []).map((o) => Number(o.valor) || 0);
        dia += valores.length ? Math.max(...valores) : 0;
      } else {
        dia += Number(t.valor) || 0;
      }
    }
    porDia.push({ fecha, creditos: dia });
    ganadoSemana += dia;
  }

  const tienda = Object.values(estado.tienda || {}).filter((a) => a.activo !== false);
  const ocioDia = tienda
    .filter((a) => a.tipo === 'bono' && (a.moneda || 'semana') === 'semana')
    .map((a) => Math.max(Number(a.precio) || 0, Number(a.precioMinimo) || 0))
    .sort((a, b) => a - b);
  const ocioBasico = ocioDia[0] || 0;
  const ocioExtra = ocioDia[1] || 0;

  const gastoSemanaTipico = (ocioBasico + ocioExtra) * 5;
  const sobrante = ganadoSemana - gastoSemanaTipico;

  const grandes = tienda
    .filter((a) => a.moneda === 'hucha')
    .map((a) => Math.max(Number(a.precio) || 0, Number(a.precioMinimo) || 0));
  const premioMedio = grandes.length ? grandes.reduce((s, v) => s + v, 0) / grandes.length : 0;

  return {
    ganadoSemana,
    porDia,
    tercio: Math.round(ganadoSemana / 7 / 3),
    ocioBasico,
    ocioExtra,
    gastoSemanaTipico,
    sobrante,
    semanasPremioMedio: sobrante > 0 ? Math.ceil(premioMedio / sobrante) : null,
    premioMedio: Math.round(premioMedio),
  };
}
