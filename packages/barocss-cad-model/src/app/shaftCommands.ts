// Shafts (R12c.3a, D156): steps along an axis with shoulder fillets and end chamfers, a keyseat on one step and a ring
// groove on another. Every size is the user's: the prefills (a 6 × 3.5 seat on Ø20, a Ø19 × 1.3 groove on Ø20) are
// estimates for a first try, said so in their labels — key and ring sizes come from the user's own rows (none built in).
import { featureLabel, withNode, type ModelNode } from '../engine/doc';
import { ringRowsFor } from '../engine/rings';
import type { Command, Ctx, Field, Values } from './commands';

const ok = { ok: true as const };
const MAX = 5;
const n = (v: Values, k: string) => Number(v[k]);
const count = (v: Values | undefined) => Math.max(1, Math.min(MAX, Math.round(Number(v?.n ?? 3)) || 3));

const shaftCommand: Command = {
  id: 'shaft', label: 'Shaft', icon: 'cad-shaft', group: 'create', keywords: 'shaft stepped axle turned',
  hint: 'A stepped shaft along Z, revolved exactly: steps of your diameters and lengths, shoulder fillets, end chamfers, a keyseat on one step and a ring groove on another (cut by exact Booleans). The prefilled key and ring sizes are estimates: your own rows give them. Not validated for manufacturing',
  available: () => ok,
  fields: () => {
    // (Five steps' fields, each shown while the count reaches it.)
    const steps: Field[] = [];
    for (let i = 1; i <= MAX; i++) { const when = (v: Values) => count(v) >= i; steps.push({ key: `d${i}`, label: `Step ${i} Ø`, kind: 'mm', min: 0.5, when }, { key: `l${i}`, label: `Step ${i} length`, kind: 'mm', min: 0.5, when }); }
    const on = (key: string) => (v: Values) => Number(v[key]) > 0;
    return [{ key: 'n', label: 'Steps', kind: 'count', min: 1, max: MAX }, ...steps,
      { key: 'r', label: 'Shoulder fillets (0: none)', kind: 'mm', min: 0 }, { key: 'c', label: 'End chamfers (0: none)', kind: 'mm', min: 0 },
      { key: 'ks', label: 'Keyseat on step (0: none)', kind: 'count', min: 0, max: MAX },
      { key: 'kb', label: 'Keyseat width (estimate)', kind: 'mm', min: 0.1, when: on('ks') }, { key: 'kt', label: 'Keyseat depth t1 (estimate)', kind: 'mm', min: 0.1, when: on('ks') },
      { key: 'kl', label: 'Keyseat length', kind: 'mm', min: 0.1, when: on('ks') }, { key: 'ko', label: 'Keyseat from the step\'s start', kind: 'mm', min: 0, when: on('ks') },
      { key: 'ke', label: 'Keyseat ends', kind: 'choice', options: [{ value: 'end-mill', label: 'End-milled (rounded)' }, { value: 'square', label: 'Square' }, { value: 'disc', label: 'Disc cutter run-out' }], when: on('ks') },
      { key: 'kr', label: 'Disc cutter radius', kind: 'mm', min: 0.1, when: v => on('ks')(v) && v.ke === 'disc' },
      { key: 'gs', label: 'Ring groove on step (0: none)', kind: 'count', min: 0, max: MAX },
      { key: 'gd', label: 'Groove Ø (estimate)', kind: 'mm', min: 0.1, when: on('gs') }, { key: 'gw', label: 'Groove width (estimate)', kind: 'mm', min: 0.1, when: on('gs') }, { key: 'ga', label: 'Groove from the step\'s start', kind: 'mm', min: 0, when: on('gs') },
      { key: 'x', label: 'Axis X', kind: 'mm' }, { key: 'y', label: 'Axis Y', kind: 'mm' }, { key: 'z', label: 'At Z', kind: 'mm' }];
  },
  // (An output shaft: a keyed Ø20 seat for a hub, a Ø25 bearing journal shouldered both ways, a Ø20 end with a ring groove.)
  defaults: () => ({ n: 3, d1: 20, l1: 30, d2: 25, l2: 40, d3: 20, l3: 25, d4: 20, l4: 20, d5: 20, l5: 20, r: 0.5, c: 0.5, ks: 1, kb: 6, kt: 3.5, kl: 18, ko: 6, ke: 'end-mill', kr: 8, gs: 3, gd: 19, gw: 1.3, ga: 18, x: 0, y: 0, z: 0 }),
  build: (ctx, v) => {
    const k = count(v), r = n(v, 'r'), c = n(v, 'c'), ks = Math.round(n(v, 'ks')), gs = Math.round(n(v, 'gs'));
    const steps = Array.from({ length: k }, (_, i) => {
      const s: { diameter: number; length: number; fillet?: number; grooves?: { diameter: number; width: number; at: number }[]; keyseats?: { width: number; depth: number; length: number; offset: number; ends: 'square' | 'end-mill' | 'disc'; cutterRadius?: number }[] } = { diameter: n(v, `d${i + 1}`), length: n(v, `l${i + 1}`) };
      if (r > 0 && i < k - 1) s.fillet = r;
      if (ks === i + 1) { const ends = v.ke === 'square' || v.ke === 'disc' ? v.ke : 'end-mill'; s.keyseats = [{ width: n(v, 'kb'), depth: n(v, 'kt'), length: n(v, 'kl'), offset: n(v, 'ko'), ends, ...(ends === 'disc' ? { cutterRadius: n(v, 'kr') } : {}) }]; }
      if (gs === i + 1) s.grooves = [{ diameter: n(v, 'gd'), width: n(v, 'gw'), at: n(v, 'ga') }];
      return s;
    });
    return withNode(ctx.doc, { kind: 'shaft', steps, ...(c > 0 ? { chamfers: [c, c] as [number, number] } : {}), center: [n(v, 'x'), n(v, 'y')], ...(n(v, 'z') ? { from: n(v, 'z') } : {}), generator: 'shaft@0' });
  },
};


// ---- R12c.3b (D157): what goes on a shaft ----------------------------------------------------------------------------

/** The one picked body when it is a shaft as made: its node and index. */
function pickedShaft(ctx: Ctx): { node: Extract<ModelNode, { kind: 'shaft' }>; index: number } | null {
  const picked = new Set<number>(ctx.selection.bodies); ctx.selection.faces.forEach(f => picked.add(f.body));
  if (picked.size !== 1) return null;
  const ref = ctx.bodies[[...picked][0]]?.ref, node = ref ? ctx.doc.nodes[ref.node] : undefined;
  return node?.kind === 'shaft' && ref!.side === 'solid' ? { node, index: ref!.node } : null;
}
const seatsOf = (s: Extract<ModelNode, { kind: 'shaft' }>) => s.steps.flatMap(x => x.keyseats ?? []);
/** Each step's ring grooves, in order, with the step's diameter (a ring row's shaft size, O139). */
const groovesOf = (s: Extract<ModelNode, { kind: 'shaft' }>) => s.steps.flatMap(x => (x.grooves ?? []).map(g => ({ ...g, shaftDiameter: Number(x.diameter) })));
const no = (reason: string) => ({ ok: false as const, reason });

const keyCommand: Command = {
  id: 'key', label: 'Key', icon: 'cad-key', group: 'create', keywords: 'key parallel feather',
  hint: 'A parallel key in a keyseat of the selected shaft — its height yours, its width and length the seat\'s unless given — checked against the seat and, with a hub keyway, against its width and the clearance over its top. Not validated for manufacturing',
  available: ctx => { const s = pickedShaft(ctx); return !s ? no('Select a shaft (from the Shaft command).') : seatsOf(s.node).length ? ok : no('The shaft has no keyseat: give it one (edit the shaft).'); },
  fields: ctx => {
    const ways = ctx.doc.nodes.map((n, i) => ({ n, i })).filter(x => x.n.kind === 'keyway');
    return [{ key: 'seat', label: 'Keyseat', kind: 'count', min: 1, max: Math.max(1, seatsOf(pickedShaft(ctx)?.node ?? { kind: 'shaft', steps: [], center: [0, 0], generator: 'shaft@0' }).length) },
      { key: 'h', label: 'Height (estimate)', kind: 'mm', min: 0.1 }, { key: 'b', label: 'Width (0: the seat\'s)', kind: 'mm', min: 0 }, { key: 'l', label: 'Length (0: the seat\'s)', kind: 'mm', min: 0 },
      { key: 'ends', label: 'Ends', kind: 'choice', options: [{ value: 'auto', label: 'The seat\'s (round in an end-milled seat)' }, { value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] },
      { key: 'hub', label: 'Hub keyway', kind: 'choice', options: [{ value: 'none', label: 'None' }, ...ways.map(w => ({ value: String(w.i), label: `n${w.i}: ${featureLabel(w.n, w.i, ctx.doc.nodes)}` }))] }];
  },
  defaults: ctx => { const ways = ctx.doc.nodes.map((n, i) => ({ n, i })).filter(x => x.n.kind === 'keyway'); return { seat: 1, h: 6, b: 0, l: 0, ends: 'auto', hub: ways.length ? String(ways[ways.length - 1].i) : 'none' }; },
  build: (ctx, v) => {
    const s = pickedShaft(ctx)!, b = n(v, 'b'), l = n(v, 'l');
    return withNode(ctx.doc, { kind: 'key', shaft: s.index, keyseat: Math.round(n(v, 'seat')), height: n(v, 'h'), ...(b > 0 ? { width: b } : {}), ...(l > 0 ? { length: l } : {}), ...(v.ends === 'round' || v.ends === 'square' ? { ends: v.ends } : {}), ...(v.hub !== 'none' && v.hub !== undefined ? { hub: Number(v.hub) } : {}) });
  },
};

/** The one picked face when it is a bore (a cylinder whose material lies outside it): its body's ref and name. */
function pickedBore(ctx: Ctx): { ref: NonNullable<Ctx['bodies'][number]['ref']>; name: string } | null {
  if (ctx.selection.faces.length !== 1) return null;
  const f = ctx.selection.faces[0], body = ctx.bodies[f.body], face = body?.mesh.faces[f.face];
  if (!body?.ref || face?.exact?.kind !== 'cylinder') return null;
  const e = face.exact, d = [face.centroid[0] - e.c[0], face.centroid[1] - e.c[1], face.centroid[2] - e.c[2]], along = d[0] * e.a[0] + d[1] * e.a[1] + d[2] * e.a[2], radial = [d[0] - e.a[0] * along, d[1] - e.a[1] * along, d[2] - e.a[2] * along];
  // (A bore's outward normal points to its axis.)
  return radial[0] * face.normal[0] + radial[1] * face.normal[1] + radial[2] * face.normal[2] < 0 ? { ref: body.ref, name: face.name } : null;
}
const keywayCommand: Command = {
  id: 'keyway', label: 'Keyway', icon: 'cad-key', group: 'modify', keywords: 'keyway hub broach',
  hint: 'A keyway cut into the selected bore of a hub, through its length: its width and depth t2 from the bore\'s surface are yours (the prefills are estimates); a key in the shaft\'s seat is checked against it',
  available: ctx => pickedBore(ctx) ? ok : no('Select one bore (a cylindrical hole\'s face) of the hub.'),
  fields: () => [{ key: 'b', label: 'Width (estimate)', kind: 'mm', min: 0.1 }, { key: 't2', label: 'Depth t2 (estimate)', kind: 'mm', min: 0.1 }, { key: 'angle', label: 'Angle about the bore', kind: 'deg' }],
  defaults: () => ({ b: 6, t2: 2.8, angle: 0 }),
  build: (ctx, v) => { const p = pickedBore(ctx)!; return withNode(ctx.doc, { kind: 'keyway', parent: { node: p.ref.node, side: p.ref.side }, face: p.name, width: n(v, 'b'), depth: n(v, 't2'), ...(n(v, 'angle') ? { angle: n(v, 'angle') } : {}) }); },
};

const ringCommand: Command = {
  id: 'retaining-ring', label: 'Retaining ring', icon: 'cad-key', group: 'create', keywords: 'retaining ring circlip snap ring',
  hint: 'A retaining ring\'s envelope in a groove of the selected shaft — its thickness and outer diameter from your ring\'s row (the prefills are estimates) — checked against the groove\'s width',
  available: ctx => { const s = pickedShaft(ctx); return !s ? no('Select a shaft (from the Shaft command).') : groovesOf(s.node).length ? ok : no('The shaft has no ring groove: give it one (edit the shaft).'); },
  fields: ctx => [{ key: 'groove', label: 'Groove', kind: 'count', min: 1, max: Math.max(1, groovesOf(pickedShaft(ctx)?.node ?? { kind: 'shaft', steps: [], center: [0, 0], generator: 'shaft@0' }).length) },
    { key: 's', label: 'Thickness (estimate)', kind: 'mm', min: 0.05 }, { key: 'D', label: 'Outer Ø (estimate)', kind: 'mm', min: 0.5 },
    // (O139: the user's ring row it is checked against — none built in; none: an estimate.)
    { key: 'row', label: 'Ring row', kind: 'choice', options: [...(ctx.doc.rings?.rows ?? []).map(r => ({ value: r.id, label: `${r.designation ?? r.id} · Ø${r.shaftDiameterMM} shaft, groove Ø${r.grooveDiameterMM} × ${r.grooveWidthMM}${r.estimate ? ' (estimate)' : ''}` })), { value: 'none', label: 'None (an estimate)' }] }],
  defaults: ctx => {
    const s = pickedShaft(ctx), g = groovesOf(s?.node ?? { kind: 'shaft', steps: [], center: [0, 0], generator: 'shaft@0' })[0];
    // (The row for the first groove's sizes, when the person has one.)
    const row = g && s ? ringRowsFor(ctx.doc, g.shaftDiameter, Number(g.diameter))[0]?.id : undefined;
    return { groove: 1, s: g ? Math.max(0.1, +(g.width - 0.1).toFixed(3)) : 1.2, D: g ? +(g.diameter + 5).toFixed(3) : 24, row: row ?? 'none' };
  },
  build: (ctx, v) => withNode(ctx.doc, { kind: 'retaining-ring', shaft: pickedShaft(ctx)!.index, groove: Math.round(n(v, 'groove')), thickness: n(v, 's'), outerDiameter: n(v, 'D'), ...(v.row && v.row !== 'none' ? { row: String(v.row) } : {}) }),
};

const pinCommand: Command = {
  id: 'pin', label: 'Dowel pin', icon: 'cad-key', group: 'create', keywords: 'dowel pin',
  hint: 'A pin in a cross hole of the selected shaft — the hole\'s diameter and the step\'s length unless given; its fit on the hole by fit classes (Fit class, Fit pair) from your tables',
  available: ctx => { const s = pickedShaft(ctx); return !s ? no('Select a shaft (from the Shaft command).') : s.node.holes?.length ? ok : no('The shaft has no cross hole: give it one.'); },
  fields: ctx => [{ key: 'hole', label: 'Cross hole', kind: 'count', min: 1, max: Math.max(1, pickedShaft(ctx)?.node.holes?.length ?? 1) }, { key: 'd', label: 'Ø (0: the hole\'s)', kind: 'mm', min: 0 }, { key: 'L', label: 'Length (0: flush)', kind: 'mm', min: 0 }],
  defaults: () => ({ hole: 1, d: 0, L: 0 }),
  build: (ctx, v) => { const d = n(v, 'd'), L = n(v, 'L'); return withNode(ctx.doc, { kind: 'pin', shaft: pickedShaft(ctx)!.index, hole: Math.round(n(v, 'hole')), ...(d > 0 ? { diameter: d } : {}), ...(L > 0 ? { length: L } : {}) }); },
};

// ---- R12c.4 (D158): a bearing on a shaft's seat ----------------------------------------------------------------------

const bearingCommand: Command = {
  id: 'bearing', label: 'Bearing', icon: 'cad-bearing', group: 'create', keywords: 'bearing rolling ball roller',
  hint: 'A rolling bearing\'s envelope from your catalogue rows (none built in) on a step of the selected shaft, against a shoulder: the shoulder checked against the row\'s da and ra, the other side\'s location, an optional housing\'s bore and the seats\' fit classes from your fit tables. Not for structural calculation',
  available: ctx => !ctx.doc.bearings?.rows.length ? no('Load your bearing rows first (Library panel, BEARINGS): none is built in.') : pickedShaft(ctx) ? ok : no('Select a shaft (from the Shaft command).'),
  fields: ctx => {
    const rows = ctx.doc.bearings?.rows ?? [], bodies = ctx.doc.nodes.map((n, i) => ({ n, i })).filter(x => x.n.kind !== 'sketch' && x.i !== pickedShaft(ctx)?.index), classes = [...new Set((ctx.doc.fits?.tables ?? []).flatMap(t => t.rows.map(r => r.class)))];
    return [{ key: 'row', label: 'Bearing row', kind: 'choice', options: rows.map(r => ({ value: r.id, label: `${r.designation ?? r.id} · Ø${r.boreMM} × Ø${r.outsideMM} × ${r.widthMM}${r.estimate ? ' (estimate)' : ''}` })) },
      { key: 'step', label: 'On step', kind: 'count', min: 1, max: Math.max(1, pickedShaft(ctx)?.node.steps.length ?? 1) },
      { key: 'against', label: 'Against the shoulder at', kind: 'choice', options: [{ value: 'start', label: 'The step\'s start' }, { value: 'end', label: 'The step\'s end' }] },
      { key: 'housing', label: 'Housing', kind: 'choice', options: [{ value: 'none', label: 'None' }, ...bodies.map(b => ({ value: String(b.i), label: `n${b.i}: ${featureLabel(b.n, b.i, ctx.doc.nodes)}` }))] },
      { key: 'sc', label: 'Shaft seat class', kind: 'choice', options: [{ value: 'none', label: 'None' }, ...classes.filter(c => /^[a-z]/.test(c)).map(c => ({ value: c, label: c }))] },
      { key: 'hc', label: 'Housing seat class', kind: 'choice', options: [{ value: 'none', label: 'None' }, ...classes.filter(c => /^[A-Z]/.test(c)).map(c => ({ value: c, label: c }))] }];
  },
  defaults: ctx => {
    // (The first step and side whose shoulder holds the first row's bore: else step 1 against its end.)
    const s = pickedShaft(ctx)?.node, row = ctx.doc.bearings?.rows[0], d = (x: { diameter: unknown }) => Number(x.diameter);
    let step = 1, against: 'start' | 'end' = 'end';
    if (s && row) for (let k = 0; k < s.steps.length; k++) if (Math.abs(d(s.steps[k]) - row.boreMM) < 1e-6) { if (k > 0 && d(s.steps[k - 1]) > row.boreMM) { step = k + 1; against = 'start'; break; } if (k + 1 < s.steps.length && d(s.steps[k + 1]) > row.boreMM) { step = k + 1; against = 'end'; break; } }
    return { row: row?.id ?? '', step, against, housing: 'none', sc: 'none', hc: 'none' };
  },
  build: (ctx, v) => withNode(ctx.doc, { kind: 'bearing', row: String(v.row), shaft: pickedShaft(ctx)!.index, step: Math.round(n(v, 'step')), against: v.against === 'start' ? 'start' : 'end', ...(v.housing !== 'none' && v.housing !== undefined ? { housing: Number(v.housing) } : {}), ...(v.sc !== 'none' && v.sc ? { shaftClass: String(v.sc) } : {}), ...(v.hc !== 'none' && v.hc ? { housingClass: String(v.hc) } : {}) }),
};

export const shaftCommands: Command[] = [shaftCommand, keyCommand, keywayCommand, ringCommand, pinCommand, bearingCommand];
