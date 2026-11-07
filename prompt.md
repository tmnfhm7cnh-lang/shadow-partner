# Prompt de construcción — shadow-partner

> **2026-11-07: superado.** Daniel pidió la v1 directamente y se construyó en la misma sesión (LOTE 0 y LOTE 1
> juntos). Se conserva como referencia de las reglas y la arquitectura; los lotes siguientes se escriben a partir de
> lo que él diga al probarla.

**Cómo se usa:** abre una sesión en `C:\Users\usuario\OneDrive\Claude`, di *«frente app development»* y
pega **el encabezado + un lote**. Un lote por sesión; cada uno cabe en 2 h y acaba en algo que puedes ver
en tu pantalla.

**No se pega todavía.** Antes tienen que estar contestadas las preguntas del §8 de [plan.md](plan.md):
los huecos marcados `[DANIEL: …]` se rellenan con tus respuestas.

El texto entre las líneas `━━━` es lo que se pega.

---

## Encabezado — va en TODOS los lotes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Frente de esta sesión: **app development**. Trabaja solo este frente.

**Qué construimos.** `shadow-partner`: un compañero de sombra para entrenar capoeira solo (boxeo y otros
deportes más adelante). En una pantalla a 2–3 m, un monigote estilizado hace la postura base del deporte
(en capoeira, ginga continua) y lanza movimientos del deporte **al azar**, a velocidad regulable. El
usuario responde de verdad: esquiva, entra o imita. Lee entero `frentes/app-development/shadow-partner/plan.md`
antes de tocar nada; ahí están el porqué de cada decisión y lo que la app **no** entrena.

**Decisiones ya tomadas:**

- Render: **[DANIEL: opción A — esqueleto 3D propio proyectado en un canvas 2D, sin librerías]**.
- Pantalla principal de uso y de prueba: **[DANIEL: …]**.
- Movimientos de la primera versión y sus respuestas válidas: **[DANIEL: tabla del §8.1 corregida]**.
  Las respuestas son de Daniel; no inventes ni añadas ninguna.
- Música: **[DANIEL: grabación suya / sin música y metrónomo]**.

**Arquitectura** (la misma disciplina que `frentes/app-development/angle-lab/`, léela como modelo):

- JavaScript sin dependencias, módulos ES, PWA. Vive en `frentes/app-development/shadow-partner/`.
- `src/core/` **nunca toca el DOM** y tiene tests con el runner de Node (`node --test`):
  - `skeleton` — unas 15 articulaciones, jerarquía y cinemática directa (ángulos → posiciones 3D).
  - `moves/` — un paquete por deporte. Cada movimiento es **datos**: `id`, `sport`, `kind`
    (`attack` | `displacement` | `floreio` | `neutral`), `arrivesFrom` (`left` | `right` | `center`) y
    `height` (`high` | `low`) **en el marco del usuario** (lo que ve en la pantalla, no la pierna del
    monigote), duración base, poses clave con su tiempo, fases de la postura base desde las que puede
    salir, y `responses` (texto de Daniel, para el modo ayuda).
  - `scheduler` — RNG con semilla; pesos; máximo N repeticiones seguidas; lados equilibrados; solo
    lanza en la fase de postura base permitida; solo entre los movimientos activos.
  - `tempo` — un mando 1–10 que reparte en tres: tempo de la postura base, duración del movimiento
    y densidad (postura base entre movimientos). Separables en «avanzado».
- `src/render/` — canvas con proyección en perspectiva, miembros como cápsulas gruesas ordenadas por
  profundidad, sombra en el suelo. `src/ui/` — menús, mandos, pantalla completa, Wake Lock.
- Todo en inglés: código, archivos, commits. La interfaz que ve el usuario, en español.

**Reglas innegociables:**

1. **No entregues código sin ejecutarlo.** Tests en verde **y** comprobado en el navegador con
   `preview_start`. Di cuál de las dos comprobaciones has hecho. Lo que dependa del iPhone/iPad
   (Wake Lock, pantalla completa, AirPlay) márcalo como **no comprobado** hasta que Daniel lo pruebe.
2. **El juicio sobre si un movimiento «se ve bien» es de Daniel, no tuyo.** Enséñaselo (captura o, mejor,
   la página publicada como Artifact o abierta en su pantalla) y espera su respuesta antes de darlo por bueno.
3. **Sin dependencias nuevas sin su sí.** Sin vídeos ni fotos de personas reales en el repositorio.
4. **No publiques** sin pedírselo. Commit local por ruta, nunca `git add -A`.
5. **Un lote por sesión.** Al cerrar: `ESTADO.md`, journal y commit (skill `cierre`).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## LOTE 0 — Prueba: ¿se ve creíble?

*Motivo: todo lo demás es fácil; si las animaciones no convencen, la app no sirve. Se comprueba lo
arriesgado primero y con lo mínimo.*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[pega aquí el encabezado]

**LOTE 0 — esqueleto, ginga y una armada.**

1. `skeleton` con sus tests (longitudes de segmento constantes en cualquier pose; una pose neutra conocida
   da posiciones conocidas).
2. Interpolación entre poses clave con suavizado (sin saltos de velocidad al empezar y acabar), con test.
3. Render en canvas: monigote estilizado, escenario oscuro, foco y sombra.
4. **Ginga** en bucle, a dos tempos, y una **armada** que llega por la derecha, lanzada con un botón.
5. Enséñaselo a Daniel en su pantalla. Pregúntale exactamente: «¿se entiende de dónde viene la armada?» y
   «¿la ginga parece ginga?». Apunta sus respuestas en `ESTADO.md`.

**Terminado cuando:** Daniel ha visto las dos animaciones y ha dicho si siguen por este camino. Si dice que
no, **no sigas puliendo**: escribe qué falla y propón el paso siguiente (más poses, poses sacadas de vídeo
con `venv-vision`, o la opción C del plan, que necesita su sí por la dependencia).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## LOTE 1 — Mínima usable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[pega aquí el encabezado]

**LOTE 1 — los movimientos de la primera versión, el sorteo y el asalto.**

1. El resto de movimientos de la tabla de Daniel, como datos, en el paquete de capoeira. Si alguno
   tiene la cabeza abajo (au, bananeira), sus poses van a mano: MediaPipe falla boca abajo.
2. `scheduler` y `tempo` con sus tests: misma semilla → misma secuencia; nunca más de N iguales seguidos;
   en 200 sorteos, los lados quedan equilibrados dentro de un margen fijado en el test.
3. Pantalla de inicio: qué movimientos están activos (casillas), velocidad 1–10, duración del asalto.
   Cuenta atrás de 3 s, asalto, resumen final (cuántos de cada uno).
4. Pantalla completa donde exista y Wake Lock, con su comprobación en navegador y la del iPhone pendiente.

**Terminado cuando:** Daniel hace un asalto real de 3 min solo con la app y dice qué le sobra o le falta.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## Lotes 2 y 3 — se escriben después

No se redactan ahora: dependen de lo que salga del LOTE 0 y del asalto real del LOTE 1. Su contenido
previsto está en el §6 del plan (escenario y monigotes con cordão, modo ayuda; música y publicación).
