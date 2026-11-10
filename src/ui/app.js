/**
 * UI: home settings, countdown, training round, pause, summary and the move library.
 * All state that matters lives in the core engine; this file wires it to the screen.
 */

import { buildLibrary, variantSide } from '../core/library.js';
import { createScheduler } from '../core/scheduler.js';
import { createEngine } from '../core/engine.js';
import { sequenceGapCycles } from '../core/tempo.js';
import { computeJoints } from '../core/skeleton.js';
import { CAPOEIRA } from '../core/moves/capoeira.js';
import { createRenderer, STYLES, CORDAO } from '../render/renderer.js';
import { followX } from '../render/camera.js';
import { unlockAudio, beep, go, bell } from './audio.js';

const lib = buildLibrary(CAPOEIRA);
const $ = (id) => document.getElementById(id);

// ── Settings (per device, best effort) ──────────────────────────────────────
const STORE_KEY = 'shadow-partner.settings.v1';
const DEFAULTS = {
  active: CAPOEIRA.defaultActive,
  speed: 4,
  frequency: 5,
  duration: 120,
  help: true,
  sequence: false,
  seqMax: 3,
  style: 'abada',
  cordao: 'amarelo',
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const s = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    s.active = s.active.filter((id) => lib.byMove(id).length);
    if (!s.active.length) s.active = [...DEFAULTS.active];
    if (!STYLES[s.style]) s.style = DEFAULTS.style;
    if (!CORDAO[s.cordao]) s.cordao = DEFAULTS.cordao;
    s.seqMax = Math.min(4, Math.max(2, Math.round(Number(s.seqMax)) || DEFAULTS.seqMax));
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode or storage blocked: settings just won't persist */
  }
}

const settings = loadSettings();

// ── Engines ─────────────────────────────────────────────────────────────────
const idle = createEngine(lib, { speed: settings.speed });
let training = null;
let libraryEngine = null;
let libraryVariant = null;
let libraryRate = 0.5;
let libraryRelaunchAt = null;

// ── Screen state ────────────────────────────────────────────────────────────
let mode = 'home'; // home | countdown | training | paused | summary | library
let elapsed = 0;
let tally = {};
let sequences = 0;
let camX = 0;
let viewLeft = 0;
let viewBottom = 0;
let wakeLock = null;
let cueTimer = null;

const renderer = createRenderer($('stage'));
window.addEventListener('resize', () => renderer.resize());

function show(id, visible) {
  $(id).hidden = !visible;
}

function setMode(next) {
  mode = next;
  show('home', mode === 'home');
  show('summary', mode === 'summary');
  show('library', mode === 'library');
  show('hud', mode === 'training' || mode === 'paused' || mode === 'countdown');
  show('paused', mode === 'paused');
  show('countdown', mode === 'countdown');
  if (mode !== 'training') hideCue();
}

function activeEngine() {
  if (mode === 'library' && libraryEngine) return libraryEngine;
  if ((mode === 'training' || mode === 'paused') && training) return training;
  return idle;
}

// ── Home controls ───────────────────────────────────────────────────────────
function renderMoves() {
  const box = $('moves');
  box.textContent = '';
  for (const m of CAPOEIRA.moves) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip${settings.active.includes(m.id) ? ' on' : ''}`;
    b.textContent = m.name;
    b.setAttribute('aria-pressed', settings.active.includes(m.id));
    b.addEventListener('click', () => {
      const on = settings.active.includes(m.id);
      if (on && settings.active.length === 1) return; // at least one
      settings.active = on ? settings.active.filter((id) => id !== m.id) : [...settings.active, m.id];
      saveSettings();
      renderMoves();
    });
    box.appendChild(b);
  }
  const n = settings.active.length;
  $('moves-count').textContent = `${n} ${n === 1 ? 'activo' : 'activos'}`;
}

function bindRange(id, key) {
  const input = $(id);
  const out = $(`${id}-out`);
  input.value = settings[key];
  out.textContent = settings[key];
  input.addEventListener('input', () => {
    settings[key] = Number(input.value);
    out.textContent = input.value;
    if (key === 'speed') idle.setOptions({ speed: settings.speed });
    saveSettings();
    renderHints();
  });
}

function bindSegmented(id, get, set) {
  const box = $(id);
  const paint = () => {
    for (const b of box.querySelectorAll('button')) {
      const on = String(get()) === b.dataset.v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    }
  };
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    set(b.dataset.v);
    paint();
  });
  paint();
}

function renderSwatches() {
  const styles = $('styles');
  styles.textContent = '';
  for (const [key, st] of Object.entries(STYLES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `swatch${settings.style === key ? ' on' : ''}`;
    b.title = st.name;
    b.setAttribute('aria-label', `Monigote ${st.name}`);
    b.style.background = `radial-gradient(circle at 50% 28%, ${st.skin} 0 18%, transparent 19%),
      linear-gradient(${st.shirt} 0 55%, ${st.pants} 55%)`;
    b.addEventListener('click', () => { settings.style = key; saveSettings(); renderSwatches(); });
    styles.appendChild(b);
  }
  const cords = $('cordoes');
  cords.textContent = '';
  for (const [key, color] of Object.entries(CORDAO)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `swatch${settings.cordao === key ? ' on' : ''}`;
    b.title = key;
    b.setAttribute('aria-label', `Cordão ${key}`);
    b.style.background = color;
    b.addEventListener('click', () => { settings.cordao = key; saveSettings(); renderSwatches(); });
    cords.appendChild(b);
  }
}

renderMoves();
bindRange('speed', 'speed');
bindRange('frequency', 'frequency');

function sequenceOption() {
  return settings.sequence ? { min: 2, max: settings.seqMax } : null;
}

function renderHints() {
  const cycles = sequenceGapCycles(settings.frequency);
  const gingas = cycles < 1.5 ? 'una ginga' : `unas ${Math.round(cycles)} gingas`;
  $('mode-hint').textContent = settings.sequence
    ? `Encadena de 2 a ${settings.seqMax} movimientos sin ginga entre medias, y luego hace ${gingas} antes de la siguiente secuencia (lo marca la frecuencia).`
    : 'Un movimiento, ginga, otro movimiento. Para encadenarlos sin ginga, usa Secuencias.';
  $('frequency-hint').textContent = settings.sequence
    ? 'En Secuencias marca las gingas entre una secuencia y la siguiente.'
    : 'Aunque la pongas al máximo sigue habiendo algo de ginga entre ataques: para quitarla del todo, usa Secuencias.';
  $('seq-box').hidden = !settings.sequence;
}

bindSegmented('mode', () => (settings.sequence ? 'sequence' : 'single'), (v) => {
  settings.sequence = v === 'sequence';
  saveSettings();
  renderHints();
});
bindSegmented('seq-max', () => settings.seqMax, (v) => { settings.seqMax = Number(v); saveSettings(); renderHints(); });
renderHints();
bindSegmented('duration', () => settings.duration, (v) => { settings.duration = Number(v); saveSettings(); });
$('help').checked = settings.help;
$('help').addEventListener('change', () => { settings.help = $('help').checked; saveSettings(); });
renderSwatches();

// ── Wake lock & fullscreen ──────────────────────────────────────────────────
async function holdScreen() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {
    wakeLock = null; // not allowed here (old iOS, iframe…): the round still works
  }
}

function releaseScreen() {
  try { wakeLock?.release(); } catch { /* already released */ }
  wakeLock = null;
}

const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
if (fsEnabled) show('fullscreen', true);
$('fullscreen').addEventListener('click', () => {
  const el = document.documentElement;
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (isFs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch { /* ignore */ }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'training') pause();
  if (!document.hidden && (mode === 'training' || mode === 'countdown')) holdScreen();
});

// ── Cues (help mode) ────────────────────────────────────────────────────────
function hideCue() {
  clearTimeout(cueTimer);
  $('cue').classList.remove('show');
  for (const id of ['glow-left', 'glow-right', 'glow-center']) $(id).classList.remove('show');
}

function showCue(variant, seconds, seqIndex = 0, seqLength = 1) {
  hideCue();
  const side = variantSide(variant);
  $('cue').textContent = seqLength > 1 ? `${variant.label}  ·  ${seqIndex + 1}/${seqLength}` : variant.label;
  $('cue').classList.add('show');
  const glow = variant.travels ? `glow-${variant.travels}` : `glow-${side}`;
  if ($(glow)) $(glow).classList.add('show');
  cueTimer = setTimeout(hideCue, Math.max(700, Math.min(1600, seconds * 1000)));
}

// ── Round ───────────────────────────────────────────────────────────────────
function onTrainingEvent(e) {
  if (e.type !== 'start') return;
  const side = variantSide(e.variant);
  const row = (tally[e.variant.moveId] ??= { left: 0, center: 0, right: 0 });
  row[side] += 1;
  if (e.seqIndex === 0) sequences += 1;
  if (settings.help) showCue(e.variant, training.duration(e.variant), e.seqIndex, e.seqLength);
}

function startRound() {
  unlockAudio();
  holdScreen();
  training = createEngine(lib, {
    speed: settings.speed,
    frequency: settings.frequency,
    sequence: sequenceOption(),
    scheduler: createScheduler(lib, { active: settings.active, seed: (Date.now() ^ 0x5f3759df) >>> 0 }),
    onEvent: onTrainingEvent,
  });
  tally = {};
  sequences = 0;
  elapsed = 0;
  updateTimer();
  setMode('countdown');
  let n = 3;
  const cd = $('countdown');
  const tick = () => {
    if (mode !== 'countdown') return;
    if (n > 0) {
      cd.textContent = n;
      beep();
      n -= 1;
      setTimeout(tick, 1000);
    } else {
      cd.textContent = '';
      go();
      training.start(1.2);
      setMode('training');
    }
  };
  tick();
}

function pause() {
  if (mode !== 'training') return;
  setMode('paused');
}

function resume() {
  if (mode !== 'paused') return;
  holdScreen();
  setMode('training');
}

function finishRound() {
  bell();
  releaseScreen();
  const total = Object.values(tally).reduce((s, r) => s + r.left + r.center + r.right, 0);
  const mins = Math.floor(elapsed / 60);
  const secs = Math.round(elapsed % 60);
  const inSeqs = settings.sequence && sequences ? ` (${sequences} ${sequences === 1 ? 'secuencia' : 'secuencias'})` : '';
  $('summary-line').textContent = `${total} ${total === 1 ? 'movimiento' : 'movimientos'}${inSeqs} en ${mins}:${String(secs).padStart(2, '0')}.`;
  const body = $('summary-body');
  body.textContent = '';
  for (const m of CAPOEIRA.moves) {
    const r = tally[m.id];
    if (!r) continue;
    const tr = document.createElement('tr');
    for (const v of [m.name, r.left || '·', r.center || '·', r.right || '·']) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  setMode('summary');
}

function updateTimer() {
  const d = settings.duration;
  const t = d ? Math.max(0, d - elapsed) : elapsed;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  $('timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

$('start').addEventListener('click', startRound);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('stop').addEventListener('click', finishRound);
$('again').addEventListener('click', startRound);
$('back-home').addEventListener('click', () => { training = null; setMode('home'); });

// ── Library ─────────────────────────────────────────────────────────────────
const KIND_ES = { attack: 'ataque', displacement: 'desplazamiento', floreio: 'floreio' };

function libraryDescribe(v) {
  const parts = [KIND_ES[v.kind] ?? v.kind];
  if (v.arrivesFrom === 'left' || v.arrivesFrom === 'right') parts.push(`viene por tu ${v.arrivesFrom === 'left' ? 'izquierda' : 'derecha'}`);
  if (v.arrivesFrom === 'center') parts.push('de frente');
  if (v.travels) parts.push(`se va hacia tu ${v.travels === 'left' ? 'izquierda' : 'derecha'}`);
  return parts.join(' · ');
}

function selectLibraryMove(moveId, mirrored) {
  const variants = lib.byMove(moveId);
  libraryVariant = variants.find((v) => v.mirrored === mirrored) ?? variants[0];
  libraryEngine = createEngine(lib, { speed: 5 });
  libraryEngine.trigger(libraryVariant);
  libraryRelaunchAt = null;
  for (const b of $('library-list').querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === moveId);
  $('library-info').textContent = `${libraryDescribe(libraryVariant)}.`;
}

function openLibrary() {
  const list = $('library-list');
  list.textContent = '';
  for (const m of CAPOEIRA.moves) {
    const v = lib.byMove(m.id)[0];
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = m.id;
    const name = document.createElement('strong');
    name.textContent = m.name;
    const info = document.createElement('span');
    info.textContent = KIND_ES[v.kind];
    b.append(name, info);
    b.addEventListener('click', () => selectLibraryMove(m.id, libraryMirrored));
    list.appendChild(b);
  }
  setMode('library');
  selectLibraryMove(CAPOEIRA.moves[0].id, false);
}

let libraryMirrored = false;
bindSegmented('library-side', () => (libraryMirrored ? '1' : '0'), (v) => {
  libraryMirrored = v === '1';
  if (libraryVariant) selectLibraryMove(libraryVariant.moveId, libraryMirrored);
});
bindSegmented('library-rate', () => String(libraryRate), (v) => { libraryRate = Number(v); });
$('open-library').addEventListener('click', openLibrary);
$('close-library').addEventListener('click', () => { libraryEngine = null; setMode('home'); });

// ── Main loop ───────────────────────────────────────────────────────────────
let last = performance.now();

function frame(now) {
  const rawDt = Math.max(0, (now - last) / 1000);
  // Animation steps are capped so a hiccup doesn't make the figure jump; the round clock is not,
  // so the timer stays honest even if the device drops frames.
  const dt = Math.min(0.05, rawDt);
  last = now;
  renderer.fit();

  if (mode === 'training') {
    training.update(dt);
    elapsed += Math.min(1, rawDt);
    if (settings.duration && elapsed >= settings.duration) finishRound();
    updateTimer();
  } else if (mode === 'library' && libraryEngine) {
    libraryEngine.update(dt * libraryRate);
    const s = libraryEngine.state;
    if (s.mode === 'base' && !s.pending) {
      if (libraryRelaunchAt === null) libraryRelaunchAt = s.time + 0.9;
      else if (s.time >= libraryRelaunchAt) {
        libraryEngine.trigger(libraryVariant);
        libraryRelaunchAt = null;
      }
    }
  } else if (mode === 'home' || mode === 'countdown' || mode === 'summary') {
    idle.update(dt);
  }

  const eng = activeEngine();
  const { joints, headM } = computeJoints(eng.pose());
  camX = followX(camX, { anchorX: eng.state.anchor[0], pelvisX: joints.pelvis[0], moving: eng.state.mode === 'move', dt });
  // With a side panel open on a wide screen, frame the figure in the free area to its right.
  const panel = ['home', 'summary', 'library'].includes(mode) ? $(mode) : null;
  const wide = window.innerWidth >= 760;
  const targetLeft = panel && wide ? panel.getBoundingClientRect().right : 0;
  // On a phone the library is a bottom sheet: frame the figure in the space above it.
  const targetBottom = mode === 'library' && !wide ? window.innerHeight - $('library').getBoundingClientRect().top : 0;
  const ease = 1 - Math.exp(-dt / 0.25);
  viewLeft += (targetLeft - viewLeft) * ease;
  viewBottom += (targetBottom - viewBottom) * ease;
  renderer.render(joints, {
    headM,
    camX,
    focusX: joints.pelvis[0],
    viewLeft,
    viewBottom,
    style: STYLES[settings.style],
    cordao: CORDAO[settings.cordao],
  });
  requestAnimationFrame(frame);
}

setMode('home');
requestAnimationFrame(frame);

// Read-only peek for debugging from the browser console.
window.__shadow = {
  get mode() { return mode; },
  get tally() { return structuredClone(tally); },
  get elapsed() { return elapsed; },
  get engine() { return activeEngine().state; },
  /** Advance the running round by `seconds` of simulated time (to test without waiting). */
  advance(seconds) {
    if (mode !== 'training') return false;
    for (let t = 0; t < seconds; t += 1 / 60) training.update(1 / 60);
    return true;
  },
};

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is a bonus */ });
}
