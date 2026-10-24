// Drive elements (R12c.6b, D161): sprockets for the user's chain rows, pulleys for their belt rows (timing, V or flat:
// the row says which), a belt or chain on two picked wheels of one row, and couplings' envelopes — none of their sizes
// built in. A sprocket's tooth form is derived (pivot-clearance); its tip Ø is the user's, prefilled three quarters of
// the way from the seats' edge to the point (a starting value, said so in its label).
import { sprocketLimits, chainLinks, sprocketPitchDiameter, type ChainRow, type DriveRow } from '@barocss/cad';
import { withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import type { Command, Ctx, Field, Values } from './commands';
import { r3Signed as r3 } from '../util/round';

const ok = { ok: true as const };
const no = (reason: string) => ({ ok: false as const, reason });
const rowsOf = (doc: StudioDoc, kinds: readonly DriveRow['kind'][]) => (doc.drives?.rows ?? []).filter(r => kinds.includes(r.kind));
const label = (r: DriveRow) => `${r.id}${r.estimate ? ' (estimate)' : ''}`;
const at: Field[] = [{ key: 'x', label: 'Centre X', kind: 'mm' }, { key: 'y', label: 'Centre Y', kind: 'mm' }, { key: 'z', label: 'At Z', kind: 'mm' }];
const beside = (ctx: Ctx, gap: number) => { const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity); return { x: Number.isFinite(right) ? r3(right + gap) : 0, y: 0, z: 0 }; };
const place = (v: Values) => ({ center: [Number(v.x), Number(v.y)] as [number, number], ...(Number(v.z) ? { from: Number(v.z) } : {}) });
const none = (what: string, panel = 'DRIVES') => no(`Load your ${what} rows first (Library panel, ${panel}): none is built in.`);

const sprocketCommand: Command = {
  id: 'sprocket', label: 'Sprocket', icon: 'cad-sprocket', group: 'create', keywords: 'sprocket',
  hint: 'A sprocket for one of your chain rows (none built in): seats on the pitch circle p/sin(180°/z), the tooth form derived (the flank clears a roller turning out about its neighbour; not ISO 606\'s), your tip Ø and width. Not validated for manufacturing',
  available: ctx => rowsOf(ctx.doc, ['chain']).length ? ok : none('chain'),
  fields: ctx => [{ key: 'row', label: 'Chain row', kind: 'choice', options: rowsOf(ctx.doc, ['chain']).map(r => ({ value: r.id, label: label(r) })) },
    { key: 'teeth', label: 'Teeth', kind: 'count', min: 6, max: 200 }, { key: 'tip', label: 'Tip Ø (prefilled ¾ of the way to the point)', kind: 'mm', min: 1 },
    { key: 'w', label: 'Tooth width', kind: 'mm', min: 0.5 }, { key: 'seat', label: 'Seat Ø (at least the roller\'s)', kind: 'mm', min: 0.5 }, { key: 'bore', label: 'Bore Ø (0: none)', kind: 'mm', min: 0 }, ...at],
  defaults: ctx => {
    const row = rowsOf(ctx.doc, ['chain'])[0] as ChainRow, z = 17, l = sprocketLimits(row, z);
    return { row: row.id, teeth: z, tip: r3(l.seatEdgeDiameter + 0.75 * (l.pointedTipDiameter - l.seatEdgeDiameter)), w: r3((row.innerWidth ?? 6) * 0.9), seat: row.rollerDiameter, bore: 0, ...beside(ctx, 10 + l.pitchDiameter / 2) };
  },
  build: (ctx, v) => withNode(ctx.doc, { kind: 'sprocket', row: String(v.row), teeth: Math.round(Number(v.teeth)), tip: Number(v.tip), width: Number(v.w), ...(Number(v.seat) ? { seat: Number(v.seat) } : {}), ...(Number(v.bore) > 0 ? { bore: Number(v.bore) } : {}), ...place(v), generator: 'sprocket@0' }),
};

const pulleyCommand: Command = {
  id: 'pulley', label: 'Pulley', icon: 'cad-pulley', group: 'create', keywords: 'pulley sheave',
  hint: 'A pulley for one of your belt rows (none built in): timing (the row\'s groove profile on pitch Ø pz/π), V (its grooves revolved round your datum Ø) or flat (a face, crowned if you say). Not validated for manufacturing',
  available: ctx => rowsOf(ctx.doc, ['timing-belt', 'v-belt', 'flat-belt']).length ? ok : none('belt'),
  fields: ctx => {
    const rows = rowsOf(ctx.doc, ['timing-belt', 'v-belt', 'flat-belt']), kind = (v: Values) => rows.find(r => r.id === v.row)?.kind;
    return [{ key: 'row', label: 'Belt row', kind: 'choice', options: rows.map(r => ({ value: r.id, label: `${label(r)} · ${r.kind.replace('-belt', '')}` })) },
      { key: 'teeth', label: 'Grooves (teeth)', kind: 'count', min: 6, max: 400, when: v => kind(v) === 'timing-belt' },
      { key: 'd', label: 'Datum Ø', kind: 'mm', min: 1, when: v => kind(v) === 'v-belt' }, { key: 'd', label: 'Face Ø', kind: 'mm', min: 1, when: v => kind(v) === 'flat-belt' },
      { key: 'n', label: 'Grooves', kind: 'count', min: 1, max: 20, when: v => kind(v) === 'v-belt' },
      { key: 'w', label: 'Face width', kind: 'mm', min: 0.5, when: v => kind(v) !== 'v-belt' }, { key: 'crown', label: 'Crown height (0: flat)', kind: 'mm', min: 0, when: v => kind(v) === 'flat-belt' },
      { key: 'bore', label: 'Bore Ø', kind: 'mm', min: 0 }, ...at];
  },
  defaults: ctx => {
    const row = rowsOf(ctx.doc, ['timing-belt', 'v-belt', 'flat-belt'])[0], wide = row.kind === 'flat-belt' ? row.width * 1.25 : 10;
    return { row: row.id, teeth: 20, d: 80, n: 1, w: r3(wide), crown: 0, bore: 12, ...beside(ctx, 50) };
  },
  build: (ctx, v) => {
    const row = rowsOf(ctx.doc, ['timing-belt', 'v-belt', 'flat-belt']).find(r => r.id === v.row)!, n = (k: string) => Number(v[k]);
    const sizes = row.kind === 'timing-belt' ? { teeth: Math.round(n('teeth')), width: n('w') } : row.kind === 'v-belt' ? { diameter: n('d'), grooves: Math.round(n('n')) } : { diameter: n('d'), width: n('w'), ...(n('crown') > 0 ? { crown: n('crown') } : {}) };
    return withNode(ctx.doc, { kind: 'pulley', row: row.id, ...sizes, ...(n('bore') > 0 ? { bore: n('bore') } : {}), ...place(v), generator: 'pulley@0' });
  },
};

/** The two picked wheels (sprocket or pulley nodes as made) of one row: their node indices and the row. */
function pickedWheels(ctx: Ctx): { a: number; b: number; row: DriveRow } | null {
  if (ctx.selection.bodies.length !== 2) return null;
  const idx = ctx.selection.bodies.map(i => ctx.bodies[i]?.ref?.node), nodes = idx.map(i => i === undefined ? undefined : ctx.doc.nodes[i]);
  const wheel = (n: ModelNode | undefined): n is Extract<ModelNode, { kind: 'sprocket' | 'pulley' }> => n?.kind === 'sprocket' || n?.kind === 'pulley';
  if (!wheel(nodes[0]) || !wheel(nodes[1]) || nodes[0].row !== nodes[1].row) return null;
  const row = ctx.doc.drives?.rows.find(r => r.id === (nodes[0] as { row: string }).row);
  return row ? { a: idx[0]!, b: idx[1]!, row } : null;
}
const beltCommand: Command = {
  id: 'belt-drive', label: 'Belt or chain', icon: 'cad-belt', group: 'create', keywords: 'belt chain drive',
  hint: 'A belt or chain on the two picked wheels of one row, as a band about its pitch path: its length 2C cos β + (π + 2β)R + (π − 2β)r; a chain rounded to whole links, the second sprocket moved to the distance they need (or left, with a warning)',
  available: ctx => pickedWheels(ctx) ? ok : no('Pick two sprockets (or two pulleys) made for one chain or belt row.'),
  fields: ctx => pickedWheels(ctx)?.row.kind === 'chain' ? [{ key: 'links', label: 'Links', kind: 'choice', options: [{ value: 'whole', label: 'Whole' }, { value: 'even', label: 'Even (no offset link)' }] },
    { key: 'snap', label: 'Second sprocket', kind: 'choice', options: [{ value: 'move', label: 'Moved to the links\' distance' }, { value: 'stay', label: 'Left where it is (a warning)' }] }] : [],
  defaults: () => ({ links: 'whole', snap: 'move' }),
  build: (ctx, v) => {
    const w = pickedWheels(ctx)!, rounding = v.links === 'even' ? 'even' as const : 'whole' as const;
    let doc = ctx.doc;
    if (w.row.kind === 'chain' && v.snap !== 'stay') {
      // (The distance for whole links along the line between the wheels: the second wheel moved there.)
      const A = doc.nodes[w.a] as Extract<ModelNode, { kind: 'sprocket' }>, B = doc.nodes[w.b] as Extract<ModelNode, { kind: 'sprocket' }>;
      const dx = B.center[0] - A.center[0], dy = B.center[1] - A.center[1], C = Math.hypot(dx, dy), p = w.row.pitch;
      const c = chainLinks(p, sprocketPitchDiameter(p, A.teeth) / 2, sprocketPitchDiameter(p, B.teeth) / 2, C, rounding).centerDistance;
      doc = { ...doc, nodes: doc.nodes.map((n, i) => i === w.b ? { ...B, center: [A.center[0] + dx / C * c, A.center[1] + dy / C * c] as [number, number] } : n) };
    }
    return withNode(doc, { kind: 'belt', row: w.row.id, wheels: [w.a, w.b], ...(w.row.kind === 'chain' && rounding === 'even' ? { rounding } : {}), generator: 'belt@0' });
  },
};

const couplingCommand: Command = {
  id: 'coupling', label: 'Coupling', icon: 'cad-coupling', group: 'create', keywords: 'coupling',
  hint: 'A coupling\'s envelope from one of your coupling rows (none built in): its outside, length and two bores; a bought item, its part number and supplier from the row for the bill of materials',
  available: ctx => rowsOf(ctx.doc, ['coupling']).length ? ok : none('coupling'),
  fields: ctx => [{ key: 'row', label: 'Coupling row', kind: 'choice', options: rowsOf(ctx.doc, ['coupling']).map(r => ({ value: r.id, label: label(r) })) }, ...at, { key: 'rot', label: 'Rotation', kind: 'deg' }],
  defaults: ctx => ({ row: rowsOf(ctx.doc, ['coupling'])[0].id, rot: 0, ...beside(ctx, 20) }),
  build: (ctx, v) => withNode(ctx.doc, { kind: 'coupling', row: String(v.row), ...place(v), ...(Number(v.rot) ? { rotation: Number(v.rot) } : {}), generator: 'coupling@0' }),
};

export const driveCommands: Command[] = [sprocketCommand, pulleyCommand, beltCommand, couplingCommand];
