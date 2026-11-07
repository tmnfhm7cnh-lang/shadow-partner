/**
 * Capoeira pack: the ginga (base loop) and the moves the figure can throw.
 *
 * Every move is authored ONCE, for one side; the library builds the mirrored variant.
 * Coordinates: see src/core/math.js (x = user's right, y = up, z = towards the user).
 * The figure faces the user, so its own right side is on the user's LEFT (-x).
 *
 * `arrivesFrom` is in the user's frame (the side of the screen the strike comes in from) and is
 * checked against the actual animation by test/moves.test.js — it is not just a label.
 *
 * Key poses were authored from technical descriptions of each move, not traced from video.
 * The responses to each move belong to the coach (Daniel); `responses` is left empty on purpose.
 */

import { W, L } from '../pose.js';

/** Guard hands (pelvis-local), reused by several moves. */
const GUARD_L = L(0.26, 0.42, 0.3);
const GUARD_R = L(-0.26, 0.42, 0.3);

/**
 * Ginga, one full cycle: parallel → right foot back → parallel → left foot back.
 * With the right leg back the right arm crosses in front of the face.
 */
export const GINGA = [
  {
    t: 0,
    p: [0, 0.8, 0.05], r: [0, 8, 0], s: [0, 5, 0],
    lf: W(0.26, 0.08, 0.08), rf: W(-0.26, 0.08, 0.08),
    lh: L(0.28, 0.36, 0.3), rh: L(-0.28, 0.36, 0.3),
  },
  {
    t: 0.25,
    p: [0.04, 0.75, -0.13], r: [-25, 16, 0], s: [-6, 8, 0],
    lf: W(0.26, 0.08, 0.08), rf: W(-0.06, 0.08, -0.54),
    lh: L(0.34, 0.12, -0.04), rh: L(-0.04, 0.64, 0.32),
  },
  {
    t: 0.5,
    p: [0, 0.8, 0.05], r: [0, 8, 0], s: [0, 5, 0],
    lf: W(0.26, 0.08, 0.08), rf: W(-0.26, 0.08, 0.08),
    lh: L(0.28, 0.36, 0.3), rh: L(-0.28, 0.36, 0.3),
  },
  {
    t: 0.75,
    p: [-0.04, 0.75, -0.13], r: [25, 16, 0], s: [6, 8, 0],
    lf: W(0.06, 0.08, -0.54), rf: W(-0.26, 0.08, 0.08),
    lh: L(0.04, 0.64, 0.32), rh: L(-0.34, 0.12, -0.04),
  },
];

/** Phase of the ginga with the right foot back (0.25) — kicks with the right leg leave from here. */
const RIGHT_BACK = 0.25;
const PARALLEL = 0;

export const MOVES = [
  {
    id: 'armada',
    name: 'Armada',
    kind: 'attack',
    height: 'high',
    effector: 'rFoot',
    arrivesFrom: 'right',
    launchPhases: [RIGHT_BACK],
    duration: 1.4,
    keys: [
      {
        t: 0.14,
        p: [0.02, 0.84, -0.18], r: [-95, 8, 0], s: [-25, 5, 0],
        lf: W(0.14, 0.08, -0.04), rf: W(-0.06, 0.08, -0.46),
        lh: GUARD_L, rh: GUARD_R,
      },
      {
        t: 0.32,
        p: [0.03, 0.9, -0.22], r: [-180, 5, 0], s: [-30, 0, 0],
        lf: W(0.12, 0.08, -0.06), rf: W(0.32, 0.1, -0.32),
      },
      {
        t: 0.46,
        p: [0.05, 0.95, -0.2], r: [-228, 0, -18], s: [-20, -5, 6],
        rf: L(-0.72, 0.28, 0.2),
        lh: L(0.3, 0.3, 0.25), rh: L(-0.2, 0.5, 0.25),
      },
      {
        t: 0.6,
        p: [0.05, 0.96, -0.18], r: [-285, 0, -24], s: [-15, -5, 8],
        rf: L(-0.8, 0.36, 0.25),
      },
      {
        t: 0.74,
        p: [0.03, 0.92, -0.14], r: [-338, 3, -14], s: [-8, 0, 4],
        rf: L(-0.62, 0.1, 0.25),
      },
      {
        t: 0.86,
        p: [0, 0.82, -0.08], r: [-368, 8, 0], s: [-4, 5, 0],
        lf: W(0.16, 0.08, 0), rf: W(-0.3, 0.08, -0.02),
        lh: GUARD_L, rh: GUARD_R,
      },
    ],
  },
  {
    id: 'meia-lua-de-frente',
    name: 'Meia-lua de frente',
    kind: 'attack',
    height: 'high',
    effector: 'rFoot',
    arrivesFrom: 'left',
    launchPhases: [RIGHT_BACK],
    duration: 1.15,
    keys: [
      {
        t: 0.18,
        p: [0.03, 0.9, -0.06], r: [-12, -4, -4], s: [-4, 0, 0],
        lf: W(0.2, 0.08, 0.04), rf: L(-0.55, -0.15, 0.2),
        lh: GUARD_L, rh: GUARD_R,
      },
      {
        t: 0.36,
        p: [0.04, 0.94, -0.06], r: [-10, -10, -10], s: [-4, 4, 0],
        rf: L(-0.5, 0.45, 0.6),
      },
      {
        t: 0.5,
        p: [0.04, 0.95, -0.06], r: [-4, -14, -10], s: [0, 6, 0],
        rf: L(-0.02, 0.72, 0.6),
      },
      {
        t: 0.64,
        p: [0.04, 0.94, -0.06], r: [4, -10, -8], s: [2, 4, 0],
        rf: L(0.42, 0.42, 0.5),
      },
      {
        t: 0.8,
        p: [0.02, 0.86, -0.04], r: [-6, 4, -2], s: [-2, 4, 0],
        rf: W(-0.12, 0.25, -0.1),
      },
    ],
  },
  {
    id: 'queixada',
    name: 'Queixada',
    kind: 'attack',
    height: 'high',
    effector: 'rFoot',
    arrivesFrom: 'right',
    launchPhases: [RIGHT_BACK],
    duration: 1.3,
    keys: [
      {
        t: 0.16,
        p: [0.1, 0.8, 0.02], r: [32, 10, 0], s: [18, 6, 0],
        lf: W(0.32, 0.08, 0.22), rf: W(-0.04, 0.08, -0.5),
        lh: GUARD_L, rh: GUARD_R,
      },
      {
        t: 0.34,
        p: [0.12, 0.93, 0.02], r: [26, -6, -8], s: [10, 4, 0],
        rf: L(0.22, 0.32, 0.62),
      },
      {
        t: 0.5,
        p: [0.12, 0.95, 0.02], r: [10, -10, -12], s: [0, 4, 0],
        rf: L(-0.05, 0.74, 0.52),
      },
      {
        t: 0.66,
        p: [0.1, 0.93, 0.02], r: [-6, -6, -12], s: [-6, 4, 0],
        rf: L(-0.62, 0.42, 0.35),
      },
      {
        t: 0.82,
        p: [0.05, 0.84, -0.06], r: [-12, 8, -2], s: [-4, 4, 0],
        rf: W(-0.26, 0.08, -0.3),
      },
    ],
  },
  {
    id: 'martelo',
    name: 'Martelo',
    kind: 'attack',
    height: 'high',
    effector: 'rFoot',
    arrivesFrom: 'left',
    launchPhases: [RIGHT_BACK],
    duration: 1.1,
    keys: [
      {
        t: 0.22,
        p: [0.04, 0.9, -0.04], r: [45, 2, -18], s: [10, 4, 6],
        lf: W(0.2, 0.08, 0.04), rf: L(-0.56, 0.26, -0.4), rk: L(-0.25, 0.3, 1),
        lh: GUARD_L, rh: GUARD_R,
      },
      {
        t: 0.42,
        p: [0.05, 0.93, -0.04], r: [80, 0, -34], s: [14, 4, 14],
        rf: L(-0.82, 0.42, 0.08), rk: L(-0.1, 1, 0.3),
      },
      {
        t: 0.58,
        p: [0.04, 0.9, -0.04], r: [55, 2, -20], s: [8, 4, 6],
        rf: L(-0.56, 0.26, -0.4), rk: L(-0.25, 0.3, 1),
      },
      {
        t: 0.78,
        p: [0.02, 0.8, -0.08], r: [-10, 10, 0], s: [-4, 6, 0],
        rf: W(-0.22, 0.08, -0.38), rk: null,
      },
    ],
  },
  {
    id: 'bencao',
    name: 'Bênção',
    kind: 'attack',
    height: 'mid',
    effector: 'rFoot',
    arrivesFrom: 'center',
    launchPhases: [RIGHT_BACK],
    duration: 1.05,
    keys: [
      {
        t: 0.24,
        p: [0.01, 0.9, -0.1], r: [-6, -4, 0], s: [0, 4, 0],
        lf: W(0.18, 0.08, 0.02), rf: L(-0.1, -0.42, 0.42), rk: L(0, 0.8, 0.6),
        lh: GUARD_L, rh: GUARD_R,
      },
      {
        t: 0.44,
        p: [0.01, 0.92, -0.08], r: [-6, -18, 0], s: [0, 6, 0],
        rf: L(-0.1, 0.28, 0.86),
      },
      {
        t: 0.6,
        p: [0.01, 0.9, -0.1], r: [-6, -6, 0], s: [0, 4, 0],
        rf: L(-0.1, -0.42, 0.42),
      },
      {
        t: 0.8,
        p: [0.02, 0.8, -0.1], r: [-12, 10, 0], s: [-4, 6, 0],
        rf: W(-0.12, 0.08, -0.4), rk: null,
      },
    ],
  },
  {
    id: 'meia-lua-de-compasso',
    name: 'Meia-lua de compasso',
    kind: 'attack',
    height: 'mid',
    effector: 'rFoot',
    arrivesFrom: 'right',
    launchPhases: [RIGHT_BACK],
    duration: 1.7,
    keys: [
      {
        t: 0.14,
        p: [0.02, 0.76, -0.16], r: [-70, 25, 0], s: [-15, 15, 0],
        lf: W(0.14, 0.08, -0.02), rf: W(-0.08, 0.08, -0.5),
        lh: GUARD_L, rh: GUARD_R,
      },
      {
        t: 0.3,
        p: [0.04, 0.72, -0.2], r: [-160, 68, 0], s: [-10, 25, 0],
        lh: L(0.24, 0.48, 0.94), rh: L(-0.2, 0.48, 0.94),
      },
      {
        t: 0.48,
        p: [0.05, 0.74, -0.2], r: [-215, 68, -14], s: [-6, 25, 0],
        rf: L(-0.72, 0.02, -0.5),
      },
      {
        t: 0.64,
        p: [0.05, 0.74, -0.18], r: [-272, 64, -20], s: [-4, 25, 0],
        rf: L(-0.72, 0.1, -0.52),
      },
      {
        t: 0.84,
        p: [0, 0.8, -0.1], r: [-345, 22, 0], s: [-4, 10, 0],
        lf: W(0.18, 0.08, 0), rf: W(-0.28, 0.08, -0.06),
        lh: GUARD_L, rh: GUARD_R,
      },
    ],
  },
  {
    id: 'au',
    name: 'Au',
    kind: 'displacement',
    height: 'mid',
    travels: 'right',
    launchPhases: [PARALLEL],
    duration: 2.0,
    endOffset: [1.62, 0, 0],
    // A wheel in the frontal plane, always facing the user. Rolling towards +x (the figure's
    // left): left hand, right hand, right foot, left foot. Legs in the pelvis frame while in the
    // air, so they swing straight with the body instead of folding along a chord.
    keys: [
      {
        t: 0.12,
        p: [0.15, 0.84, 0], r: [0, 0, -12], s: [0, 0, -5],
        lf: W(0.48, 0.08, 0.02), rf: W(-0.2, 0.08, 0.02),
        lh: L(0.35, 1.05, 0.05), rh: L(-0.35, 1.05, 0.05),
      },
      {
        t: 0.3,
        p: [0.18, 0.72, 0], r: [0, 0, -50], s: [0, 0, -30],
        lh: W(0.62, 0.03, 0.02), rh: L(-0.3, 1.0, 0),
        lf: W(0.48, 0.08, 0.02), rf: L(-0.62, -0.58, 0.02),
      },
      {
        t: 0.48,
        p: [0.86, 1.12, 0], r: [0, 0, -180], s: [0, 0, 0],
        lh: W(0.62, 0.03, 0.02), rh: W(1.1, 0.03, 0.02),
        lf: L(0.55, -0.63, 0.02), rf: L(-0.55, -0.63, 0.02),
      },
      {
        t: 0.66,
        p: [1.3, 0.74, 0], r: [0, 0, -272], s: [0, 0, -28],
        lh: L(0.3, 1.0, 0), rh: L(-0.35, 0.95, 0.1),
        lf: L(0.7, -0.4, 0.02), rf: W(1.42, 0.08, 0.04),
      },
      {
        t: 0.84,
        p: [1.62, 0.82, 0.03], r: [0, 6, -352], s: [0, 4, -6],
        lf: W(1.86, 0.08, 0.06), rf: W(1.4, 0.08, 0.06),
        lh: GUARD_L, rh: GUARD_R,
      },
    ],
  },
  {
    id: 'bananeira',
    name: 'Bananeira',
    kind: 'floreio',
    height: 'low',
    arrivesFrom: 'center',
    mirror: false,
    launchPhases: [PARALLEL, 0.5],
    duration: 3.6,
    keys: [
      {
        t: 0.12,
        p: [0, 0.6, 0], r: [0, 60, 0], s: [0, 40, 0],
        lf: W(0.2, 0.08, -0.12), rf: W(-0.2, 0.08, -0.12),
        lh: W(0.2, 0.03, 0.45), rh: W(-0.2, 0.03, 0.45),
      },
      {
        t: 0.25,
        p: [0, 0.95, 0.3], r: [0, 135, 0], s: [0, 25, 0],
        lf: L(0.12, -0.5, 0.55), rf: L(-0.1, -0.86, 0),
      },
      {
        t: 0.37,
        p: [0, 1.1, 0.45], r: [0, 172, 0], s: [0, 8, 0],
        lf: L(0.13, -0.86, 0.05), rf: L(-0.13, -0.86, 0.05),
      },
      {
        t: 0.54,
        p: [0.01, 1.11, 0.45], r: [0, 177, 2], s: [0, 5, 0],
      },
      {
        t: 0.7,
        p: [-0.01, 1.1, 0.45], r: [0, 171, -2], s: [0, 8, 0],
      },
      {
        t: 0.8,
        p: [0, 0.95, 0.3], r: [0, 130, 0], s: [0, 25, 0],
        lf: L(0.12, -0.6, 0.5), rf: L(-0.12, -0.6, 0.5),
      },
      {
        t: 0.9,
        p: [0, 0.64, 0.02], r: [0, 55, 0], s: [0, 35, 0],
        lf: W(0.2, 0.08, -0.15), rf: W(-0.2, 0.08, -0.15),
      },
    ],
  },
  {
    id: 'cabecada',
    name: 'Cabeçada',
    kind: 'attack',
    height: 'mid',
    effector: 'head',
    arrivesFrom: 'center',
    launchPhases: [RIGHT_BACK],
    duration: 1.2,
    keys: [
      {
        t: 0.22,
        p: [0, 0.7, 0.02], r: [-6, 32, 0], s: [0, 18, 0],
        lf: W(0.22, 0.08, 0.08), rf: W(-0.1, 0.08, -0.45),
        lh: L(0.26, 0.3, 0.38), rh: L(-0.26, 0.3, 0.38),
      },
      {
        t: 0.45,
        p: [0, 0.64, 0.42], r: [0, 52, 0], s: [0, 26, 0],
        lf: W(0.2, 0.08, 0.6), rf: W(-0.14, 0.08, -0.22),
      },
      {
        t: 0.64,
        p: [0, 0.74, 0.18], r: [0, 26, 0], s: [0, 10, 0],
        lf: W(0.22, 0.08, 0.2),
      },
    ],
  },
];

export const CAPOEIRA = {
  id: 'capoeira',
  name: 'Capoeira',
  base: GINGA,
  basePeriod: 2.0,
  moves: MOVES,
  defaultActive: ['armada', 'meia-lua-de-frente', 'au', 'bananeira'],
};
