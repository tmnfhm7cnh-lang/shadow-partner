# shadow-partner ("Sombra")

A shadow-sparring partner for solo training. A stylised 3D figure does the base movement of the
sport (capoeira: a continuous ginga) and throws random moves at an adjustable speed; the athlete
responds for real — dodges, enters or mirrors. Capoeira first; the engine is sport-agnostic so
boxing can be added as another move pack.

Installable PWA, no dependencies, no server, no accounts, nothing leaves the device.

## Run

```bash
node scripts/dev-server.mjs   # http://localhost:8095
npm test                      # node:test, core only (no DOM)
```

Dev helper: `dev/sheet.html?v=armada&n=6&from=0&to=1` renders frames of one move, from the user's
point of view and in profile, to review key poses.

## Layout

- `src/core/` — no DOM, fully tested.
  - `math.js` — vectors and the Euler convention (`x` = user's right, `y` up, `z` towards the user).
  - `skeleton.js` — proportions, two-bone IK with soft extension, forward kinematics, feet.
  - `interp.js` — monotone cubic (PCHIP) interpolation: holds don't wobble, nothing overshoots.
  - `pose.js` — key-pose format (world or pelvis-local targets), evaluation, blending, mirroring.
  - `moves/capoeira.js` — the ginga and the moves, authored once per side.
  - `library.js` — builds playable variants (mirrors, labels in the user's frame).
  - `scheduler.js` — seeded random choice: active moves only, no long repeats, sides balanced.
  - `tempo.js` — speed / frequency controls (1–10) → timings; per-move sensitivity to speed.
  - `engine.js` — the clock: base loop, launch windows, move playback, return to the base, and
    sequences (moves chained with no ginga between them, then a gap of ginga).
  - `secondary.js` — secondary motion on top of the authored pose: the head looks at the user and
    stays level, chest / hands / feet follow with a small lag (limbs on the floor never move).
- `src/render/` — perspective camera and canvas renderer (stage, shadow, depth-sorted limbs).
- `src/ui/` — screens, wake lock, fullscreen, audio cues.

## Adding a move

Write its key poses in a pack (see the header of `src/core/pose.js` for the format), give it
`arrivesFrom` / `travels` in the user's frame, and run `npm test`: the suite checks that the side
it announces is the side the animation actually comes from, that nothing goes through the floor,
that planted hands and feet really reach the floor and that nothing teleports between frames.

Optional fields on a move:

- `tempoWeight` (default 1): how much the move follows the speed control. A wheel or a handstand
  has a physical floor on how fast it can be done, so it follows only partly (au 0.35).
- `chainIn: false`: the move cannot come in the middle of a sequence (a handstand needs the ginga's
  stance); it opens the next sequence instead.

## Publishing

Bump `CACHE` in `sw.js` on every change, or installed copies keep serving the old version.
`test/sw.test.js` fails if a file the app loads is missing from the cache list.

## Status

Key poses were authored from technical descriptions, not traced from video. Secondary motion
(head, lags) is procedural, tuned by eye on a desktop browser, not on a device. The responses to each
move are the coach's to define and are deliberately absent from the data.
