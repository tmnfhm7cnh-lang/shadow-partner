/**
 * Turns a sport pack (moves authored once) into playable variants: complete keys, the mirrored
 * side, and the labels the user reads. No DOM.
 */

import { completeKeys, mirrorKeys } from './pose.js';

const OTHER = { left: 'right', right: 'left', center: 'center' };
const SIDE_ES = { left: 'izquierda', right: 'derecha' };
const MIRROR_EFFECTOR = { rFoot: 'lFoot', lFoot: 'rFoot', rHand: 'lHand', lHand: 'rHand', head: 'head' };

/** Side of the user that a variant concerns: where it comes from, or where it travels to. */
export function variantSide(v) {
  return v.arrivesFrom ?? v.travels ?? 'center';
}

export function variantLabel(v) {
  if (v.kind === 'displacement' && v.travels) return `${v.name} hacia tu ${SIDE_ES[v.travels]}`;
  if (v.arrivesFrom === 'left' || v.arrivesFrom === 'right') return `${v.name} · por tu ${SIDE_ES[v.arrivesFrom]}`;
  return v.name;
}

function buildVariant(move, keys, mirrored) {
  const v = {
    moveId: move.id,
    name: move.name,
    kind: move.kind,
    height: move.height,
    effector: mirrored ? MIRROR_EFFECTOR[move.effector] : move.effector,
    arrivesFrom: move.arrivesFrom ? (mirrored ? OTHER[move.arrivesFrom] : move.arrivesFrom) : undefined,
    travels: move.travels ? (mirrored ? OTHER[move.travels] : move.travels) : undefined,
    launchPhases: move.launchPhases.map((p) => (mirrored ? (p + 0.5) % 1 : p)),
    duration: move.duration,
    tempoWeight: move.tempoWeight ?? 1,
    chainIn: move.chainIn !== false,
    hipDrive: move.hipDrive === true,
    endOffset: move.endOffset
      ? (mirrored ? [-move.endOffset[0], move.endOffset[1], move.endOffset[2]] : move.endOffset)
      : [0, 0, 0],
    keys,
    mirrored,
  };
  v.entry = move.entry;
  v.variantId = `${move.id}${move.entry && move.entry !== move.entryDefault ? `.${move.entry}` : ''}${mirrored ? ':m' : ''}`;
  v.label = variantLabel(v);
  return v;
}

/** All variants of a sport pack, plus the completed base loop. */
export function buildLibrary(sport) {
  const variants = [];
  for (const base of sport.moves) {
    // a move may list `alt`: other ways of doing it (own keys / duration), drawn like any variant
    const forms = [{ ...base, alt: undefined, entryDefault: base.entry }];
    for (const a of base.alt ?? []) forms.push({ ...base, ...a, alt: undefined, entryDefault: base.entry });
    for (const move of forms) {
      const keys = completeKeys(move.keys);
      variants.push(buildVariant(move, keys, false));
      if (move.mirror !== false) variants.push(buildVariant(move, mirrorKeys(keys), true));
    }
  }
  return {
    sport,
    base: completeKeys(sport.base),
    variants,
    byMove(moveId) {
      return variants.filter((v) => v.moveId === moveId);
    },
    get(variantId) {
      return variants.find((v) => v.variantId === variantId);
    },
  };
}
