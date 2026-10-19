// Sheet metal (R12.1, D116): a plate from a finished sketch, and a bent profile (L, U, Z or hat) standing on the XZ
// plane. Each carries the sheet's rules — thickness, the bends' inner radius and the K-factor. The prefilled rules
// (1.5 mm, R = T, K 0.5) are estimates, not material data (D115): the K-factor's prefill is the sheet's middle, and a
// real air bend's neutral layer lies lower; the body's panel says so.
import { withNode, type ModelNode } from '../engine/doc';
import { oneProfile } from './profileCommands';
import type { Command, Field, Values } from './commands';

const ok = { ok: true as const }, no = (reason: string) => ({ ok: false as const, reason });
/** The sheet's rules as fields: the K-factor's label says its prefill is an estimate. */
const ruleFields: Field[] = [
  { key: 't', label: 'Thickness', kind: 'mm', min: 0.1 }, { key: 'r', label: 'Bend radius (inner)', kind: 'mm', min: 0.1 },
  { key: 'k', label: 'K-factor (0.5: estimate)', kind: 'ratio', min: 0, max: 1, step: 0.01 },
];
const RULES = { t: 1.5, r: 1.5, k: 0.5 } as const;
function rulesOf(v: Values): { thickness: number; bendRadius: number; kFactor: number } {
  const thickness = Number(v.t), bendRadius = Number(v.r), kFactor = Number(v.k);
  if (!(thickness > 0) || !(bendRadius > 0)) throw new Error('Give the sheet a thickness and a bend radius above 0.');
  if (!(kFactor >= 0 && kFactor <= 1)) throw new Error('The K-factor lies from 0 (the inner face) to 1 (the outer face); 0.3–0.5 is usual.');
  return { thickness, bendRadius, kFactor };
}

export const sheetPlateCommand: Command = {
  id: 'sheet-plate', label: 'Sheet plate', icon: 'cad-sheet-plate', group: 'create', keywords: 'sheet metal base flange plate blank tab',
  hint: 'A sheet-metal plate from a finished sketch, carrying the sheet’s rules (thickness, bend radius, K-factor; the prefilled values are estimates)',
  available: ctx => oneProfile(ctx) ? ok : no('Finish a sketch first, or pick one sketch (in the viewport or the History).'),
  fields: () => [...ruleFields, { key: 'side', label: 'Side', kind: 'choice', options: [{ value: 'up', label: 'Along the normal' }, { value: 'down', label: 'Against it' }] }],
  defaults: () => ({ ...RULES, side: 'up' }),
  steps: ctx => { const p = oneProfile(ctx); return [{ label: 'Profile', text: p ? `Sketch ${p.index + 1}` : 'pick a finished sketch', done: !!p }]; },
  build: (ctx, v) => {
    const p = oneProfile(ctx); if (!p) throw new Error('Pick one finished sketch.');
    return withNode(ctx.doc, { kind: 'sheet-base', sketch: p.index, ...rulesOf(v), ...(v.side === 'down' ? { reverse: true } : {}) });
  },
};

/**
 * The path of a bent profile in its plane (x along X, y up Z), the side its material lies on, and the dimensions it
 * takes to the outside of its bends: an L (its leg turned `angle` from the base), a U, a Z (outside at its first bend,
 * inside at its second) or a hat (the crown's outside).
 */
export function profilePath(shape: string, a: number, b: number, c: number, angle: number): { path: [number, number][]; side: 'left' | 'right' } {
  const th = angle * Math.PI / 180;
  switch (shape) {
    case 'u': return { path: [[0, b], [0, 0], [a, 0], [a, b]], side: 'left' };
    case 'z': return { path: [[0, b], [0, 0], [a, 0], [a, -c]], side: 'left' };
    case 'hat': return { path: [[-c, 0], [0, 0], [0, b], [a, b], [a, 0], [a + c, 0]], side: 'right' };
    default: return { path: [[-b * Math.cos(th), b * Math.sin(th)], [0, 0], [a, 0]], side: 'left' };
  }
}

export const sheetProfileCommand: Command = {
  id: 'sheet-profile', label: 'Sheet profile', icon: 'cad-sheet-profile', group: 'create', keywords: 'sheet metal bracket angle channel l u z hat contour flange bend',
  hint: 'A bent sheet-metal profile — an L bracket, a U channel, a Z or a hat — its bends at the sheet’s radius, standing on the XZ plane',
  available: () => ok,
  fields: () => [
    { key: 'shape', label: 'Shape', kind: 'choice', options: [{ value: 'l', label: 'L bracket' }, { value: 'u', label: 'U channel' }, { value: 'z', label: 'Z' }, { value: 'hat', label: 'Hat' }] },
    { key: 'a', label: 'Base (outside)', kind: 'mm', min: 1 }, { key: 'b', label: 'Leg (outside)', kind: 'mm', min: 1 },
    { key: 'c', label: 'Lip', kind: 'mm', min: 1, when: (v: Values) => v.shape === 'z' || v.shape === 'hat' },
    { key: 'angle', label: 'Bend angle', kind: 'deg', min: 1, max: 179, step: 5, when: (v: Values) => v.shape === 'l' },
    { key: 'w', label: 'Width (along Y)', kind: 'mm', min: 1 },
    ...ruleFields,
    { key: 'x', label: 'At X', kind: 'mm' }, { key: 'y', label: 'At Y', kind: 'mm' }, { key: 'z', label: 'At Z', kind: 'mm' },
  ],
  defaults: ctx => {
    const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity);
    return { shape: 'l', a: 40, b: 30, c: 12, angle: 90, w: 30, ...RULES, x: Number.isFinite(right) ? Math.round(right + 16) : 0, y: 0, z: 0 };
  },
  build: (ctx, v) => {
    const [a, b, c, angle, w, x, y, z] = ['a', 'b', 'c', 'angle', 'w', 'x', 'y', 'z'].map(k => Number(v[k]));
    if (!(a > 0 && b > 0 && w > 0) || ((v.shape === 'z' || v.shape === 'hat') && !(c > 0))) throw new Error('Give the profile a base, a leg, a width (and a lip) above 0.');
    if (v.shape === 'l' && !(angle > 0 && angle < 180)) throw new Error('An L bends between 0 and 180°.');
    const { path, side } = profilePath(String(v.shape), a, b, c, angle);
    // (The plane's normal −Y with its X along X: the profile stands up, extruded from y + w back to y.)
    const node: ModelNode = { kind: 'sheet-contour', path, side, width: w, ...rulesOf(v), plane: { origin: [x, y + w, z], normal: [0, -1, 0], xAxis: [1, 0, 0] } };
    return withNode(ctx.doc, node);
  },
};

export const sheetCommands = [sheetPlateCommand, sheetProfileCommand];
