/**
 * SINCRONIZACIÓN CON SUPABASE — opcional y granular.
 *
 * La app funciona entera sin conexión: el estado vive en el móvil. Si se
 * configura Supabase, cada operación (un registro concreto, no el estado
 * entero) se sube a una tabla común y se baja lo que hayan escrito los demás
 * dispositivos. Dos dispositivos que tocan registros distintos no se pisan.
 *
 * No se usa ninguna librería externa: solo la API REST de Supabase con fetch.
 * La configuración (URL, clave pública, correo) se guarda SOLO en este
 * dispositivo y nunca se sincroniza.
 */

import { esc, escAttr, modal, aviso } from './dom.js';

const CLAVE_CONF = 'rutineitor.v3.sync';
const TABLA = 'rutineitor_registros';

export function leerConfig() {
  try {
    const t = localStorage.getItem(CLAVE_CONF);
    return t ? JSON.parse(t) : null;
  } catch (e) {
    return null;
  }
}

export function guardarConfig(conf) {
  try {
    if (conf) localStorage.setItem(CLAVE_CONF, JSON.stringify(conf));
    else localStorage.removeItem(CLAVE_CONF);
    return true;
  } catch (e) {
    return false;
  }
}

function normalizarUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function crearSync(store, { alCambiarEstadoSync = () => {} } = {}) {
  let conf = leerConfig();
  let sesion = null;
  let cola = [];
  let ultimaBajada = null;
  let temporizador = null;
  let enMarcha = false;
  let estadoSync = { activo: false, conectado: false, mensaje: 'Sin configurar', pendientes: 0 };

  function anunciar(parcial) {
    estadoSync = { ...estadoSync, ...parcial, pendientes: cola.length };
    alCambiarEstadoSync(estadoSync);
  }

  async function peticion(ruta, opciones = {}) {
    const base = normalizarUrl(conf.url);
    const cabeceras = {
      apikey: conf.anonKey,
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    };
    if (sesion?.access_token) cabeceras.Authorization = `Bearer ${sesion.access_token}`;
    const res = await fetch(`${base}${ruta}`, { ...opciones, headers: cabeceras });
    if (!res.ok) {
      const texto = await res.text().catch(() => '');
      const err = new Error(`${res.status} ${texto.slice(0, 180)}`);
      err.estado = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  async function entrar() {
    const datos = await peticion('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: conf.email, password: conf.password }),
    });
    sesion = datos;
    return datos;
  }

  async function asegurarSesion() {
    if (sesion?.access_token) return;
    await entrar();
  }

  function filaDe(op) {
    return {
      hogar: conf.hogar || 'casa',
      coleccion: op.coleccion,
      reg_id: op.id,
      datos: op.tipo === 'remove' ? null : op.registro,
      borrado: op.tipo === 'remove',
      actualizado: new Date().toISOString(),
    };
  }

  async function subir() {
    if (!cola.length) return;
    const lote = cola.slice(0, 60);
    await peticion(`/rest/v1/${TABLA}?on_conflict=hogar,coleccion,reg_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(lote.map(filaDe)),
    });
    cola = cola.slice(lote.length);
  }

  async function bajar() {
    const hogar = encodeURIComponent(conf.hogar || 'casa');
    const desde = ultimaBajada ? `&actualizado=gt.${encodeURIComponent(ultimaBajada)}` : '';
    const filas = await peticion(
      `/rest/v1/${TABLA}?hogar=eq.${hogar}${desde}&order=actualizado.asc&limit=2000`,
      { method: 'GET' },
    );
    if (!Array.isArray(filas) || filas.length === 0) return 0;
    store.lote((s) => {
      for (const f of filas) {
        if (f.borrado) s.remove(f.coleccion, f.reg_id, { remoto: true });
        else if (f.datos) s.set(f.coleccion, f.reg_id, f.datos, { remoto: true });
      }
    });
    ultimaBajada = filas[filas.length - 1].actualizado;
    return filas.length;
  }

  async function ciclo() {
    if (!conf || enMarcha) return;
    enMarcha = true;
    try {
      await asegurarSesion();
      await subir();
      await bajar();
      anunciar({ activo: true, conectado: true, mensaje: 'Sincronizado' });
    } catch (e) {
      if (e.estado === 401 || e.estado === 403) sesion = null;
      anunciar({ activo: true, conectado: false, mensaje: `Sin conexión (${e.message.slice(0, 60)})` });
    } finally {
      enMarcha = false;
    }
  }

  const api = {
    get estado() { return estadoSync; },

    configurado() { return Boolean(conf && conf.url && conf.anonKey && conf.email); },

    configurar(nueva) {
      conf = nueva;
      guardarConfig(nueva);
      sesion = null;
      ultimaBajada = null;
      if (nueva) {
        anunciar({ activo: true, conectado: false, mensaje: 'Conectando…' });
        api.arrancar();
      } else {
        api.parar();
        anunciar({ activo: false, conectado: false, mensaje: 'Sin configurar' });
      }
    },

    /** Prueba la configuración sin guardarla. */
    async probar(candidata) {
      const anterior = conf;
      const sesionAnterior = sesion;
      conf = candidata;
      sesion = null;
      try {
        await entrar();
        await peticion(`/rest/v1/${TABLA}?select=reg_id&limit=1`, { method: 'GET' });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      } finally {
        conf = anterior;
        sesion = sesionAnterior;
      }
    },

    encolar(op) {
      if (!api.configurado()) return;
      if (op.tipo === 'reemplazo') {
        // Un reemplazo completo sube registro a registro, nunca de golpe.
        for (const coleccion of Object.keys(store.estado)) {
          if (coleccion === 'version') continue;
          for (const [id, registro] of Object.entries(store.estado[coleccion] || {})) {
            cola.push({ tipo: 'set', coleccion, id, registro });
          }
        }
      } else {
        cola.push(op);
      }
      anunciar({});
    },

    /** Sube TODO el estado local (primera sincronización de este dispositivo). */
    async empujarTodo() {
      api.encolar({ tipo: 'reemplazo' });
      await ciclo();
      return cola.length === 0;
    },

    arrancar(intervaloMs = 20000) {
      if (!api.configurado()) return;
      clearInterval(temporizador);
      temporizador = setInterval(ciclo, intervaloMs);
      document.addEventListener('visibilitychange', api.alVolver);
      ciclo();
    },

    parar() {
      clearInterval(temporizador);
      temporizador = null;
      document.removeEventListener('visibilitychange', api.alVolver);
    },

    alVolver() {
      if (document.visibilityState === 'visible') ciclo();
    },

    sincronizarAhora: ciclo,
  };

  if (api.configurado()) anunciar({ activo: true, conectado: false, mensaje: 'Conectando…' });
  return api;
}

/**
 * Diálogo de configuración. Vive aquí, junto al código de red, para que el
 * build de demo (que sustituye este módulo entero) no lleve ni el formulario
 * ni una sola mención a un servicio externo.
 */
export function abrirConfiguracionSync({ sync, alGuardar = () => {} }) {
  const conf = leerConfig() || {};
  modal({
    titulo: 'Sincronizar con Supabase',
    cuerpo: `
      <p class="mini tenue" style="margin-top:0">
        Opcional. Sin esto la app funciona igual, pero los datos se quedan en este dispositivo.
      </p>
      <label for="sy-u">URL del proyecto</label>
      <input id="sy-u" type="url" placeholder="https://xxxx.supabase.co" value="${escAttr(conf.url || '')}">
      <label for="sy-k">Clave pública (anon key)</label>
      <input id="sy-k" type="text" value="${escAttr(conf.anonKey || '')}">
      <label for="sy-e">Correo de acceso</label>
      <input id="sy-e" type="email" value="${escAttr(conf.email || '')}" autocomplete="username">
      <label for="sy-p">Contraseña</label>
      <input id="sy-p" type="password" value="${escAttr(conf.password || '')}" autocomplete="current-password">
      <label for="sy-h">Identificador de la casa</label>
      <input id="sy-h" type="text" value="${escAttr(conf.hogar || 'casa')}">
      <details class="guia" style="margin-top:12px"><summary>SQL que hay que pegar una vez en Supabase</summary>
        <textarea readonly style="min-height:180px;font-family:ui-monospace,monospace;font-size:12px">${esc(SQL_SUPABASE)}</textarea>
        <p class="mini tenue">Supabase → SQL Editor → pegar → Run. Después, en Authentication → Providers,
        desactiva el registro público de usuarios y crea a mano las dos cuentas.</p>
      </details>
      <p class="mini" id="sy-estado" style="margin-top:10px"></p>`,
    acciones: [
      {
        texto: 'Desconectar',
        clase: 'fantasma',
        al: (_, cerrar) => { sync.configurar(null); cerrar(); aviso('Sincronización desconectada'); alGuardar(); },
      },
      {
        texto: 'Probar y guardar',
        clase: 'principal',
        al: async (raiz, cerrar) => {
          const candidata = {
            url: raiz.querySelector('#sy-u').value.trim(),
            anonKey: raiz.querySelector('#sy-k').value.trim(),
            email: raiz.querySelector('#sy-e').value.trim(),
            password: raiz.querySelector('#sy-p').value,
            hogar: raiz.querySelector('#sy-h').value.trim() || 'casa',
          };
          const est = raiz.querySelector('#sy-estado');
          est.textContent = 'Probando…';
          const r = await sync.probar(candidata);
          if (!r.ok) { est.textContent = `No ha funcionado: ${r.error}`; return; }
          sync.configurar(candidata);
          await sync.empujarTodo();
          cerrar();
          aviso('Sincronización configurada', 'bien');
          alGuardar();
        },
      },
    ],
  });
}

/** SQL que hay que pegar una sola vez en Supabase (se muestra en Ajustes). */
export const SQL_SUPABASE = `-- Rutineitor v3 · pegar entero en Supabase → SQL Editor → Run
create table if not exists public.rutineitor_registros (
  hogar       text        not null default 'casa',
  coleccion   text        not null,
  reg_id      text        not null,
  datos       jsonb,
  borrado     boolean     not null default false,
  actualizado timestamptz not null default now(),
  primary key (hogar, coleccion, reg_id)
);

create index if not exists rutineitor_registros_actualizado_idx
  on public.rutineitor_registros (hogar, actualizado);

alter table public.rutineitor_registros enable row level security;

drop policy if exists "familia lee" on public.rutineitor_registros;
create policy "familia lee" on public.rutineitor_registros
  for select to authenticated using (true);

drop policy if exists "familia escribe" on public.rutineitor_registros;
create policy "familia escribe" on public.rutineitor_registros
  for insert to authenticated with check (true);

drop policy if exists "familia actualiza" on public.rutineitor_registros;
create policy "familia actualiza" on public.rutineitor_registros
  for update to authenticated using (true) with check (true);

-- La marca de tiempo la pone siempre el servidor, no el móvil.
create or replace function public.rutineitor_marca_tiempo()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists rutineitor_marca on public.rutineitor_registros;
create trigger rutineitor_marca before insert or update
  on public.rutineitor_registros
  for each row execute function public.rutineitor_marca_tiempo();`;
