// Frames (FR1, D123): a structural member — a section square to a line from one point to another, extruded its length.
// The kernel takes no section size and no radius by default (D122: a catalogue of sizes is the user's own data); the
// palette's prefills are estimates for a first try, said so in their labels, and every one is a field to change.
import { withNode, type FrameAnchor, type MemberSection, type ModelNode } from '../engine/doc';
import type { Command, Field, Values } from './commands';

const ok = { ok: true as const };
const KINDS = [{ value: 'rect-tube', label: 'Rectangular tube' }, { value: 'round-tube', label: 'Round tube' }, { value: 'angle', label: 'Angle' }, { value: 'channel', label: 'Channel' }, { value: 'tslot', label: 'T-slot (20 class)' }];
const ANCHORS: FrameAnchor[] = ['centroid', 'origin', 'bottom-left', 'bottom', 'bottom-right', 'left', 'center', 'right', 'top-left', 'top', 'top-right'];
const is = (...kinds: string[]) => (v: Values) => kinds.includes(String(v.section));

/** The section's fields by kind; a radius prefill's label says it is an estimate. */
const sectionFields: Field[] = [
  { key: 'section', label: 'Section', kind: 'choice', options: KINDS },
  { key: 'w', label: 'Width', kind: 'mm', min: 0.1, when: is('rect-tube', 'channel') },
  { key: 'h', label: 'Height', kind: 'mm', min: 0.1, when: is('rect-tube', 'channel') },
  { key: 't', label: 'Wall', kind: 'mm', min: 0.1, when: is('rect-tube', 'round-tube') },
  { key: 'ro', label: 'Outer corner radius (estimate)', kind: 'mm', min: 0, when: is('rect-tube') },
  { key: 'd', label: 'Diameter', kind: 'mm', min: 0.1, when: is('round-tube') },
  { key: 'a', label: 'Leg along x', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'b', label: 'Leg along y', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'th', label: 'Thickness', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'tw', label: 'Web', kind: 'mm', min: 0.1, when: is('channel') },
  { key: 'tf', label: 'Flanges', kind: 'mm', min: 0.1, when: is('channel') },
  { key: 'r1', label: 'Root radius (estimate)', kind: 'mm', min: 0, when: is('angle', 'channel') },
  { key: 'r2', label: 'Toe radius (estimate)', kind: 'mm', min: 0, when: is('angle') },
  { key: 'cells', label: 'Size', kind: 'choice', options: [{ value: '1', label: '20 × 20' }, { value: '2', label: '20 × 40' }], when: is('tslot') },
];
/** First-try values for each kind: sizes to start from, the radii and the T-slot's slot estimates (the tslot-20 library's). */
const PREFILL = { section: 'rect-tube', w: 40, h: 40, t: 3, ro: 6, d: 33.7, a: 50, b: 50, th: 5, tw: 5, tf: 8, r1: 6, r2: 3, cells: '1' } as const;
/** The tslot-20 library part's slot sizes, every one an estimate there (D122): written out as the section's own. */
const TSLOT = { size: 20, opening: 6.2, lip: 1.8, undercut: 11, depth: 6.1, bore: 4.2 } as const;

/** The section of the values; throws with a reason the HUD shows. */
export function sectionOf(v: Values): MemberSection {
  const n = (k: string) => Number(v[k]);
  switch (String(v.section)) {
    case 'rect-tube': return { kind: 'rect-tube', width: n('w'), height: n('h'), wall: n('t'), outerRadius: n('ro') };
    case 'round-tube': return { kind: 'round-tube', diameter: n('d'), wall: n('t') };
    case 'angle': return { kind: 'angle', legX: n('a'), legY: n('b'), thickness: n('th'), rootRadius: n('r1'), toeRadius: n('r2') };
    case 'channel': return { kind: 'channel', height: n('h'), width: n('w'), web: n('tw'), flange: n('tf'), rootRadius: n('r1') };
    case 'tslot': return v.cells === '2' ? { kind: 'tslot', cells: 2, ...TSLOT } : { kind: 'tslot', cells: 1, openSlots: 4, ...TSLOT };
  }
  throw new Error('Pick a section kind.');
}

/** The section's fields still at the palette's estimate: a radius left at its prefill, and the T-slot's slot sizes. */
function estimatesOf(v: Values): string[] {
  switch (String(v.section)) {
    case 'rect-tube': return Number(v.ro) === PREFILL.ro ? ['outerRadius'] : [];
    case 'angle': return [...(Number(v.r1) === PREFILL.r1 ? ['rootRadius'] : []), ...(Number(v.r2) === PREFILL.r2 ? ['toeRadius'] : [])];
    case 'channel': return Number(v.r1) === PREFILL.r1 ? ['rootRadius'] : [];
    case 'tslot': return ['opening', 'lip', 'undercut', 'depth', 'bore'];
  }
  return [];
}

export const memberCommand: Command = {
  id: 'frame-member', label: 'Structural member', icon: 'cad-frame-member', group: 'create', keywords: 'frame weldment member tube rhs shs pipe angle channel t-slot extrusion profile beam',
  hint: 'A structural member: a tube, angle, channel or T-slot section along a line between two points (the prefilled sizes and radii are estimates)',
  available: () => ok,
  fields: () => [
    ...sectionFields,
    { key: 'x0', label: 'Start X', kind: 'mm' }, { key: 'y0', label: 'Start Y', kind: 'mm' }, { key: 'z0', label: 'Start Z', kind: 'mm' },
    { key: 'x1', label: 'End X', kind: 'mm' }, { key: 'y1', label: 'End Y', kind: 'mm' }, { key: 'z1', label: 'End Z', kind: 'mm' },
    { key: 'anchor', label: 'Line through', kind: 'choice', options: ANCHORS.map(a => ({ value: a, label: a })) },
    { key: 'roll', label: 'Roll', kind: 'deg', min: -360, max: 360, step: 15 },
  ],
  defaults: ctx => {
    const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity), x = Number.isFinite(right) ? Math.round(right + 40) : 0;
    return { ...PREFILL, x0: x, y0: 0, z0: 0, x1: x, y1: 300, z1: 0, anchor: 'centroid', roll: 0 };
  },
  build: (ctx, v) => {
    const start = (['x0', 'y0', 'z0'] as const).map(k => Number(v[k])) as [number, number, number], end = (['x1', 'y1', 'z1'] as const).map(k => Number(v[k])) as [number, number, number];
    if (!(Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]) > 0)) throw new Error('Give the member a start and an end apart.');
    const roll = Number(v.roll) || 0, anchor = String(v.anchor) as FrameAnchor;
    const section = sectionOf(v), estimates = estimatesOf(v);
    const node: ModelNode = { kind: 'frame-member', section, start, end, ...(anchor !== 'centroid' ? { anchor } : {}), ...(roll ? { roll } : {}), ...(estimates.length ? { estimates } : {}) };
    return withNode(ctx.doc, node);
  },
};

export const frameCommands: Command[] = [memberCommand];
