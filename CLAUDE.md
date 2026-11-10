# Rutineitor v3 — ficha para Claude

App de rutinas y tareas de Nil con créditos, hucha, estrellas, tienda de premios, horario y panel de papá.
Versión **3.7.0** (economía por tiempo: 1 crédito = 5 min de tarea, 1 h de ocio = 12; hucha con cuenta,
depósito de plazo libre, fondo variable, freno semanal y pausa en `banco.js` y `freno.js`). Este repositorio tiene a la vez **la web publicada** (raíz) y **el código fuente** (`src/`, `tests/`, `tools/`).
En Curionauta: `/rutinator/` (clave `rutineitor.v3.estado`; la Estación lee créditos, hucha, tareas y horario).

## Construir, probar y publicar
```
npm install
npm run verificar          # build + 306 pruebas + revisión en navegador real
cp dist/* .                # la web publicada vive en la raíz (GitHub Pages)
```
- Código: `src/core/` (lógica: store, ledger, leisure, gestion, defaults) y `src/ui/` (vistas). Ver `ARQUITECTURA.md`.
- Cambios de datos para casas ya instaladas: migración idempotente en `src/core/gestion.js` (p. ej. `migrarTienda`),
  sin pisar lo que el padre haya editado.
- Historial en `CAMBIOS-v3.7.md`, `CAMBIOS-v3.6.md` y `CAMBIOS-v3.5.md`. Las pruebas del motor usan el catálogo antiguo
  (`catalogoInicial({ version: 35 })`, en `src/core/catalogo-v35.js`); las casas nuevas y migradas, el de `defaults.js`.
- Rutinator v2 (Supabase, cuentas) es otro proyecto: `rutinatorv2`.

## Cómo trabajar con Alejandro
- Escribe en **español**, para alguien que **no programa**: pasos numerados, sin jerga, y di qué botón pulsar.
- Pregunta antes de construir algo grande o caro de rehacer; lo pequeño, hazlo directamente.
- Nivel de producto profesional: probar en navegador real (PC y móvil) antes de dar algo por terminado.
- Idiomas: **francés y español** como mínimo (público: Francia y España); inglés más adelante.
- Diseño para niños: sin ansiedad, sin perseguir al niño, sin publicidad ni rastreadores.
- Los repositorios son **públicos**: nada de datos personales de la familia ni del niño.
- **Nunca** guardes ni pidas claves secretas en el chat o en el repositorio (ElevenLabs, Gemini, `service_role` de Supabase).
  Las claves van como secretos de GitHub Actions. La clave `sb_publishable_…` de Supabase sí es pública.
- Commits: `git -c user.name="agomezbl" -c user.email="agomezbl@users.noreply.github.com" commit …`.
- Después de publicar un cambio aquí, la web **curionauta** no se actualiza sola: hay que subir un commit
  (aunque sea vacío) a `agomezbl/curionauta` para que Cloudflare vuelva a montarla.
