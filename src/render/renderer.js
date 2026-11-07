/**
 * Draws the stage and the figure on a 2D canvas from 3D joint positions.
 * Look: dark stage, warm spotlight on the floor, a soft cast shadow, and a stylised figure made
 * of thick rounded limbs with a dark outline, sorted by depth so near limbs cover far ones.
 */

import { createCamera } from './camera.js';
import { normalize, clamp } from '../core/math.js';

export const STYLES = {
  abada: { name: 'Abadá', shirt: '#f1ede4', pants: '#f6f3ec', skin: '#c68a5a', outline: '#0b0e14' },
  noche: { name: 'Noche', shirt: '#3b82f6', pants: '#e8ecf3', skin: '#e9c29d', outline: '#070a10' },
  fuego: { name: 'Fuego', shirt: '#f97316', pants: '#fde7b0', skin: '#8d5a3b', outline: '#120a06' },
  menta: { name: 'Menta', shirt: '#2dd4bf', pants: '#f1f5f9', skin: '#f2d2b6', outline: '#061210' },
};

export const CORDAO = {
  cru: '#e9dcc0', amarelo: '#f2c230', laranja: '#f28a24', azul: '#2f6fe0', verde: '#2fa84f',
  roxo: '#8b4fd6', marrom: '#7a4a26', vermelho: '#d83a3a', branco: '#fafafa',
};

const LIGHT = normalize([0.35, -1, -0.45]);

function shade(hex, k) {
  // k > 0 lightens, k < 0 darkens (−1..1).
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  r = Math.round(r + (t - r) * a);
  g = Math.round(g + (t - g) * a);
  b = Math.round(b + (t - b) * a);
  return `rgb(${r},${g},${b})`;
}

function onFloor(p) {
  const t = -p[1] / LIGHT[1];
  return [p[0] + LIGHT[0] * t, 0.002, p[2] + LIGHT[2] * t];
}

/** Body parts: [from, to, width in metres, colour key]. Torso, head and hands are handled apart. */
const LIMB_PARTS = [
  ['lHip', 'lKnee', 0.15, 'pants'], ['lKnee', 'lFoot', 0.115, 'pants'], ['lFoot', 'lToe', 0.07, 'skin'],
  ['rHip', 'rKnee', 0.15, 'pants'], ['rKnee', 'rFoot', 0.115, 'pants'], ['rFoot', 'rToe', 0.07, 'skin'],
  ['lShoulder', 'lElbow', 0.095, 'shirt'], ['lElbow', 'lHand', 0.08, 'skin'],
  ['rShoulder', 'rElbow', 0.095, 'shirt'], ['rElbow', 'rHand', 0.08, 'skin'],
  ['chest', 'neck', 0.085, 'skin'],
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const shadowCanvas = document.createElement('canvas');
  const sctx = shadowCanvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    shadowCanvas.width = canvas.width;
    shadowCanvas.height = canvas.height;
  }

  /** Resize only if the canvas's on-screen size changed (rotation, AirPlay, split view…). */
  function fit() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.clientWidth !== w || canvas.clientHeight !== h || ratio !== dpr) resize();
  }

  function drawStage(cam, focusX) {
    const horizon = cam.project([focusX, 0, -40]).y;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#07090d');
    bg.addColorStop(clamp(horizon / h, 0.05, 0.95), '#11151d');
    bg.addColorStop(1, '#0b0e13');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Floor boards: lines fixed in the world, so a camera pan reads as a pan.
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    const step = 0.6;
    const x0 = Math.floor((focusX - 7) / step) * step;
    ctx.beginPath();
    for (let x = x0; x < focusX + 7; x += step) {
      const a = cam.project([x, 0, -8]);
      const b = cam.project([x, 0, 3.8]);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // Spotlight on the floor, following the figure.
    const c = cam.project([focusX, 0, 0]);
    const edge = cam.project([focusX + 1.7, 0, 0]);
    const rx = Math.max(10, edge.x - c.x);
    const ry = rx * 0.32;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(255,214,150,0.22)');
    g.addColorStop(0.55, 'rgba(255,190,120,0.08)');
    g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Soft top light cone.
    const cone = ctx.createRadialGradient(c.x, 0, 0, c.x, 0, h * 1.1);
    cone.addColorStop(0, 'rgba(255,225,180,0.07)');
    cone.addColorStop(1, 'rgba(255,225,180,0)');
    ctx.fillStyle = cone;
    ctx.fillRect(0, 0, w, h);
  }

  function capsule(c, a, b, width, color) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }

  function drawShadow(cam, J) {
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, w, h);
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    const P = (n) => cam.project(onFloor(J[n]));
    for (const [a, b, width] of LIMB_PARTS) {
      const pa = P(a), pb = P(b);
      capsule(sctx, pa, pb, cam.size(width, (pa.z + pb.z) / 2), '#000');
    }
    const quad = ['lHip', 'rHip', 'rShoulder', 'lShoulder'].map(P);
    sctx.fillStyle = '#000';
    sctx.strokeStyle = '#000';
    sctx.lineWidth = cam.size(0.12, quad[0].z);
    sctx.beginPath();
    quad.forEach((p, i) => (i ? sctx.lineTo(p.x, p.y) : sctx.moveTo(p.x, p.y)));
    sctx.closePath();
    sctx.fill();
    sctx.stroke();
    const hd = P('head');
    sctx.beginPath();
    sctx.arc(hd.x, hd.y, cam.size(0.11, hd.z), 0, Math.PI * 2);
    sctx.fill();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.32;
    ctx.drawImage(shadowCanvas, 0, 0);
    ctx.restore();
  }

  function drawFigure(cam, J, style, cordao) {
    const P = {};
    for (const [n, p] of Object.entries(J)) P[n] = cam.project(p);
    const zRef = P.pelvis.z;
    const tone = (hex, z) => shade(hex, clamp((zRef - z) * 0.35, -0.3, 0.12));
    const outlinePx = Math.max(1.5, cam.size(0.018, zRef));
    const items = [];

    for (const [a, b, width, key] of LIMB_PARTS) {
      const z = (P[a].z + P[b].z) / 2;
      items.push({ z, draw: () => {
        const px = cam.size(width, z);
        capsule(ctx, P[a], P[b], px + outlinePx * 2, style.outline);
        capsule(ctx, P[a], P[b], px, tone(style[key], z));
      } });
    }

    for (const side of ['l', 'r']) {
      const hand = P[`${side}Hand`];
      items.push({ z: hand.z - 0.01, draw: () => {
        const r = cam.size(0.055, hand.z);
        ctx.fillStyle = style.outline;
        ctx.beginPath(); ctx.arc(hand.x, hand.y, r + outlinePx, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = tone(style.skin, hand.z);
        ctx.beginPath(); ctx.arc(hand.x, hand.y, r, 0, Math.PI * 2); ctx.fill();
      } });
    }

    // Torso: a quad through hips and shoulders, stroked thick so it keeps volume edge-on.
    const quadNames = ['lHip', 'rHip', 'rShoulder', 'lShoulder'];
    const torsoZ = quadNames.reduce((s, n) => s + P[n].z, 0) / 4;
    items.push({ z: torsoZ, draw: () => {
      const q = quadNames.map((n) => P[n]);
      const path = () => {
        ctx.beginPath();
        q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
      };
      const px = cam.size(0.13, torsoZ);
      ctx.strokeStyle = style.outline;
      ctx.lineWidth = px + outlinePx * 2;
      path(); ctx.stroke();
      const col = tone(style.shirt, torsoZ);
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = px;
      path(); ctx.fill(); ctx.stroke();
      // Waist in pants colour, then the cordão.
      capsule(ctx, P.lHip, P.rHip, cam.size(0.17, torsoZ), tone(style.pants, torsoZ));
      const belt = cam.size(0.04, torsoZ);
      capsule(ctx, P.lHip, P.rHip, belt + outlinePx, style.outline);
      capsule(ctx, P.lHip, P.rHip, belt, cordao);
      // Two tails hanging from the figure's left hip, along the pelvis's down axis.
      const down = [J.lHip[0] - J.chest[0], J.lHip[1] - J.chest[1], J.lHip[2] - J.chest[2]];
      const dn = normalize(down);
      for (const off of [0, 0.035]) {
        const start = [J.lHip[0] + off, J.lHip[1], J.lHip[2] + 0.02];
        const end = [start[0] + dn[0] * 0.2, start[1] + dn[1] * 0.2, start[2] + dn[2] * 0.2];
        const s = cam.project(start), e = cam.project(end);
        capsule(ctx, s, e, cam.size(0.022, torsoZ) + outlinePx, style.outline);
        capsule(ctx, s, e, cam.size(0.022, torsoZ), cordao);
      }
    } });

    const head = P.head;
    items.push({ z: head.z, draw: () => {
      const r = cam.size(0.115, head.z);
      ctx.fillStyle = style.outline;
      ctx.beginPath(); ctx.arc(head.x, head.y, r + outlinePx, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(head.x - r * 0.35, head.y - r * 0.35, r * 0.1, head.x, head.y, r);
      g.addColorStop(0, shade(style.skin, 0.18));
      g.addColorStop(1, tone(style.skin, head.z));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, Math.PI * 2); ctx.fill();
    } });

    items.sort((a, b) => b.z - a.z);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const it of items) it.draw();
  }

  resize();

  return {
    resize,
    fit,
    get size() { return { w, h }; },
    /** joints: from computeJoints; camX: camera's x; focusX: where the spotlight sits. */
    render(joints, { camX = 0, focusX = 0, viewLeft = 0, viewBottom = 0, style = STYLES.abada, cordao = CORDAO.amarelo } = {}) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam = createCamera({ width: w, height: h, targetX: camX, viewLeft, viewBottom });
      drawStage(cam, focusX);
      drawShadow(cam, joints);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFigure(cam, joints, style, cordao);
    },
  };
}
