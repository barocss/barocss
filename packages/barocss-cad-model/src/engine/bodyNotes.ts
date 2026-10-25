// The body panel's notes on what the kernel made (R4 C3: split out of engine/evaluate.ts, unchanged): a member's,
// a sheet's and its flat pattern, a gear's and its mesh's, a worm's, a spring's, a cam's, a drive's, a connector's,
// a gusset's, an end cap's, a bead's, a shaft's and its parts', a bearing's, a gland's, a rack's, a SubD's, a decimation's.
import { followedStale, staleText } from '../frames/skeleton';
import { flatPatternOf, checkPlacedSpurGears, checkPlacedSpurRack, checkPlacedInternalGears, checkPlacedBevelGears, checkPlacedWormPair, checkPlacedThroatedPair, spurGearDimensions, type Brep, type CadPartSnapshot, type FlatPattern, type GearPlacement, type RackPlacement } from '@barocss/cad';
import { frameSegmentCount, frameSegmentEnds, type FrameSectionRow, type ModelNode, type StudioDoc } from './doc';
import type { BodyResult } from './evaluate';

const flats = new WeakMap<Brep, { flat: FlatPattern } | { refused: string }>();

const AXES: [string, number[]][] = [['+X', [1, 0, 0]], ['−X', [-1, 0, 0]], ['+Y', [0, 1, 0]], ['−Y', [0, -1, 0]], ['+Z', [0, 0, 1]], ['−Z', [0, 0, -1]]];
/** A direction as an axis (`+Z`) when it is one, else its components. */
const direction = (v: readonly number[]): string => AXES.find(([, a]) => a.every((x, k) => Math.abs(x - v[k]) < 1e-12))?.[0] ?? `(${v.map(x => +x.toFixed(4)).join(', ')})`;
/**
 * A structural member's section, length and frame as lines for its panel (FR1, D123); the section fields still at the
 * palette's first-try values flagged as estimates (D122: no section data is built in).
 */
/** A frame's output member count, once an evaluation when `counts` is its record (R4 C4: else per member body). */
function segmentCount(nodes: readonly ModelNode[], node: Extract<ModelNode, { kind: 'frame' }>, counts?: Map<ModelNode, number>): number {
  if (!counts) return frameSegmentCount(nodes, node);
  let n = counts.get(node); if (n === undefined) { n = frameSegmentCount(nodes, node); counts.set(node, n); }
  return n;
}
export function memberNotes(m: NonNullable<CadPartSnapshot['outputs'][number]['member']>, node: ModelNode | undefined, rows: readonly FrameSectionRow[] = [], nodesNow: readonly ModelNode[] = [], stale?: string, counts?: Map<ModelNode, number>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => `${+x.toFixed(3)} mm`;
  // (A frame's member: its own section when an override gives one — no estimates then — else the frame's, FR2.)
  const own = node?.kind === 'frame' && m.frame ? node.overrides?.find(o => o.member === m.frame!.member)?.section : undefined;
  const section = own ?? (node?.kind === 'frame-member' || node?.kind === 'frame' ? node.section : undefined);
  const est = own ? [] : node?.kind === 'frame-member' || node?.kind === 'frame' ? node.estimates ?? [] : [], sec = (section ?? {}) as unknown as Record<string, unknown>;
  return [
    ...(m.frame && node?.kind === 'frame' ? [{ text: `Frame member ${m.frame.member + 1}${node.bends?.length ? ` (${segmentCount(nodesNow, node, counts)} output members)` : ` of ${segmentCount(nodesNow, node, counts)}`}: point ${m.frame.from + 1} → point ${m.frame.to + 1}${m.mirrored ? ', mirrored' : ''}` }] : []),
    { text: `Member: ${m.section} · section ${+m.area.toFixed(3)} mm² · length ${mm(m.length)}` },
    { text: `Line through its ${m.anchor}${m.offset[0] || m.offset[1] ? `, moved (${m.offset.map(x => +x.toFixed(3)).join(', ')})` : ''}; section x ${direction(m.xAxis)}, y ${direction(m.yAxis)}${m.roll ? ` (rolled ${+m.roll.toFixed(3)}°)` : ''}${m.upFallback ? `; the line runs along up, so y follows ${direction(m.upFallback)}` : ''}` },
    // (FRf2, O125: a frame following a placed part's sketch — which; changed since linked, said until relinked.)
    ...(node?.kind === 'frame' && node.follows && 'part' in node.follows ? [stale ? { text: `${stale[0].toUpperCase()}${stale.slice(1)}`, warning: true } : { text: `Follows ${node.follows.part}'s sketch ${node.follows.sketch} (revision ${node.follows.revision ?? 'not pinned'})` }] : []),
    // (FRc, O117: a section from the library — its row, and where its sizes come from; an estimate row said as one.)
    ...(section?.kind === 'library' ? [libraryNote(section.id, rows)] : []),
    ...(m.ends && node?.kind === 'frame' ? endNotes(m.ends, node) : []),
    ...(est.length ? [{ text: `Estimates, not your stock's: ${est.map(k => `${k} ${typeof sec[k] === 'number' ? mm(sec[k] as number) : '(parameter)'}`).join(', ')} — the palette's first try${section?.kind === 'tslot' ? ' (the tslot-20 library\u2019s slot sizes)' : ''}. Use your supplier's.`, warning: true }] : []),
  ];
}

/** A library section's row in words: its name and source, or a warning when its sizes are estimates. */
/** FRf2: each base frame's staleness text by node index, once a document. */
const staleCache = new WeakMap<StudioDoc, Map<number, string>>();
export function staleOf(doc: StudioDoc): Map<number, string> {
  let m = staleCache.get(doc);
  if (!m) { m = new Map(followedStale(doc).map(x => [x.frame, staleText(x)])); staleCache.set(doc, m); }
  return m;
}
function libraryNote(id: string, rows: readonly FrameSectionRow[]): { text: string; warning?: boolean } {
  const r = rows.find(x => x.id === id);
  if (!r) return { text: `Section library row ${id}: not in the document's library`, warning: true };
  return r.source ? { text: `From your section library: ${r.name ?? r.id} (${r.source})` } : { text: `From your section library: ${r.name ?? r.id} — its sizes are estimates, not your stock's`, warning: true };
}

/**
 * A frame member's ends at its corners (FR3a, D125): each end's finish; an end left square where three or more members
 * meet (overlapping until an ordered trim, FR3b) said so as a warning.
 */
function endNotes(ends: NonNullable<NonNullable<CadPartSnapshot['outputs'][number]['member']>['ends']>, node: Extract<ModelNode, { kind: 'frame' }>): { text: string; warning?: boolean }[] {
  const meeting = (p: number) => node.segments.reduce((n, g) => n + frameSegmentEnds(g).filter(i => i === p).length, 0);
  const what = (e: (typeof ends)[number]) => e.kind === 'mitre' ? `mitre ${+e.angle!.toFixed(3)}° with member ${e.with! + 1}`
    : e.kind === 'butt' ? `butt on member ${e.with! + 1}${e.angle ? ` (${+e.angle.toFixed(3)}° from square)` : ''}`
    : e.kind === 'through' ? `through, ${+e.extended!.toFixed(3)} mm past point ${e.point + 1} over member ${e.with! + 1}`
    : e.kind === 'cope' ? `coped to member ${e.with! + 1}`
    : e.kind === 'trim' ? (e.against ? `trimmed to member${e.against.length > 1 ? 's' : ''} ${e.against.map(m => m + 1).join(', ')} (${e.rank! + 1} in order)` : e.plane ? `trimmed to a plane${e.angle ? ` (${+e.angle.toFixed(3)}° from square)` : ''}` : 'trimmed to a body')
    : e.kind === 'notch' ? 'notch' : 'square';
  const detail = (e: (typeof ends)[number]) => `${what(e)}${e.gap ? `, weld gap ${e.gap} mm` : ''}${e.notch ? e.notch.kind === 'holesaw' ? `, hole saw diameter ${e.notch.diameter} mm, signed offset ${e.notch.offset} mm` : `, V depth ${e.notch.depth} mm, included angle ${e.notch.angle}°` : ''}`;
  const out: { text: string; warning?: boolean }[] = [{ text: `Ends: ${ends.map(e => `${e.end} ${detail(e)}`).join('; ')}` }];
  for (const e of ends) if (e.kind === 'square' && meeting(e.point) >= 3) out.push({ text: `Point ${e.point + 1}: ${meeting(e.point)} members meet, left square and overlapping (set "Three or more members" to an ordered trim)`, warning: true });
  return out;
}

/** A sheet's notes and its flat pattern (worked out once a B-rep), or the flat's refusal as a warning. */
export function sheetOf(o: CadPartSnapshot['outputs'][number]): Pick<BodyResult, 'notes' | 'flat' | 'flatRefused' | 'sheet'> {
  let f = flats.get(o.brep);
  if (!f) { try { f = { flat: flatPatternOf(o) }; } catch (e) { f = { refused: e instanceof Error ? e.message.replace(/^[^:]*: /, '') : String(e) }; } flats.set(o.brep, f); }
  const notes = sheetNotes(o.sheet!), sheet = { thickness: o.sheet!.thickness, bendRadius: o.sheet!.bendRadius, ...(o.sheet!.bendTable ? { bendTable: o.sheet!.bendTable.id } : { kFactor: o.sheet!.kFactor }) };
  if ('flat' in f) {
    const b = f.flat.box.max, n = f.flat.bends.length;
    return { notes: [...notes, { text: `Flat pattern ${+b[0].toFixed(3)} × ${+b[1].toFixed(3)} mm, ${n} bend${n === 1 ? '' : 's'}` }], flat: f.flat, sheet };
  }
  return { notes: [...notes, { text: `No flat pattern: ${f.refused}`, warning: true }], flatRefused: f.refused, sheet };
}

/**
 * A sheet-metal body's rules and bends as lines for its panel (R12.1, D116). A K-factor of 0.5 (the studio's prefill)
 * is the sheet's middle, no material data: said so, as an estimate.
 */
function sheetNotes(s: NonNullable<CadPartSnapshot['outputs'][number]['sheet']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => `${+x.toFixed(3)} mm`;
  // (A bend table: each bend says the rows its K came from, and an estimate among them as a warning; R12.4, D120.)
  const t = s.bendTable, short = oneFeature(s.bends);
  return [
    { text: `Sheet metal: ${mm(s.thickness)} thick, bends of inner radius ${mm(s.bendRadius)}, ${t ? `K from bend table ${t.id} (${t.rows.length} rows)` : `K-factor ${s.kFactor}`}` },
    ...(s.kFactor === 0.5 ? [{ text: 'K 0.5 is an estimate (the sheet\u2019s middle, no material data): real air bends lie lower, so the flat is long. Use your shop\u2019s value.', warning: true }] : []),
    ...s.bends.map(b => ({ text: `${bendLabel(b.name, short)}: ${+b.angle.toFixed(3)}°, allowance ${mm(b.allowance)}, setback ${mm(b.setback)}, deduction ${mm(b.deduction)}${b.table ? `; K ${+b.kFactor.toFixed(4)} from ${b.table.how === 'exact' ? 'row' : 'rows'} ${b.table.rows.join(', ')}${b.table.how === 'interpolated' ? ' (interpolated)' : ''}${b.table.estimate ? ', an estimate among them' : ''}` : ''}`, ...(b.table?.estimate ? { warning: true } : {}) })),
  ];
}

/** A bend's feature: its name before the last `.` (`n4` of `n4.bend`, of a contour's `n0.bend1`). */
const bendFeature = (name: string): string => name.slice(0, Math.max(0, name.lastIndexOf('.')));
/** Whether every bend comes from one feature (a contour's bends, or one flange): then each reads by its last part. */
function oneFeature(bends: readonly { name: string }[]): boolean {
  for (let i = 1; i < bends.length; i++) if (bendFeature(bends[i].name) !== bendFeature(bends[0].name)) return false;
  return true;
}
/**
 * A bend's label in the notes: its last part (`bend1`) when the sheet's bends are all one feature's; otherwise its
 * whole name (`n4.bend`), the feature its faces carry when picked, so several flanges' bends are told apart.
 */
const bendLabel = (name: string, short: boolean): string => short ? name.slice(name.lastIndexOf('.') + 1) : name;


/**
 * A SubD body's caps as lines for its panel (R7, D79): how near the limit surface they are, and a warning where the
 * caps at crease, corner or boundary vertices are past 0.2% of the body's size (their limit's edges are not evenly
 * spread there; the caps use even angles — the limit's own characteristic map is to do).
 */
export const SUBD_CREASE_WARN = 0.002;
export function subdNotes(s: NonNullable<CadPartSnapshot['outputs'][number]['subd']>): { text: string; warning?: boolean }[] {
  const pct = (x: number) => `${+(100 * x / s.size).toPrecision(2)}% of its size`;
  const out: { text: string; warning?: boolean }[] = [{ text: `Caps: G1 at ${s.irregularVertices} irregular ${s.irregularVertices === 1 ? 'vertex' : 'vertices'} (${s.caps} caps, ${s.steps} Catmull–Clark step${s.steps === 1 ? '' : 's'}); max deviation from the limit surface ${+s.maxDeviation.toPrecision(2)} mm (${pct(s.maxDeviation)})` }];
  if (s.creaseDeviation > SUBD_CREASE_WARN * s.size) out.push({ text: `At crease, corner or boundary vertices the caps are ${+s.creaseDeviation.toPrecision(2)} mm from the limit (${pct(s.creaseDeviation)}, past 0.2%): the limit's edges there are not evenly spread and the caps use even angles (to do: the limit's own characteristic map)`, warning: true });
  return out;
}
/**
 * A simplified mesh's report as lines for its panel (R9, D85): the triangles before and after and why it stopped, and
 * the distance measured both ways — a measurement over the meshes' vertices and triangle centres, not a bound.
 */
export function decimateNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['decimate']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => `${+x.toPrecision(2)} mm`, count = (x: number) => x.toLocaleString('en-US'), d = r.distance;
  const why = r.stoppedBy === 'target' ? 'the asked count' : r.stoppedBy === 'error' ? 'the error bound' : 'as far as its regions’ boundaries and open edges let it';
  return [
    { text: `Simplified: ${count(r.trianglesBefore)} → ${count(r.trianglesAfter)} triangles (stopped at ${why})` },
    ...(d ? [{ text: `Measured distance from the original: at most ${mm(d.hausdorff)} (${mm(d.toResultMax)} to it, ${mm(d.toOriginalMax)} back; RMS ${mm(d.rms)}, over ${count(d.samples)} points)` }] : []),
    ...(r.refused.flip + r.refused.topology ? [{ text: `${count(r.refused.flip + r.refused.topology)} collapses refused: they would fold a triangle or break the surface` }] : []),
  ];
}
/** A gear's report as lines for the body's panel (R6a, D54). */
export function gearNotes(g: NonNullable<CadPartSnapshot['outputs'][number]['gear']>): { text: string; warning?: boolean }[] {
  const d = g.dimensions, mm = (x: number) => +x.toFixed(4);
  return [
    { text: `${g.profileShift ? `Profile shift x ${g.profileShift}: ` : ''}Reference Ø${mm(d.referenceDiameter)}, tip Ø${mm(d.tipDiameter)}, root Ø${mm(d.rootDiameter)}, base Ø${mm(d.baseDiameter)} mm; tooth ${mm(d.toothThickness)} mm at the reference circle` },
    ...(g.helix ? [{ text: `Helical β ${g.helix.helixAngle}° ${g.helix.hand} hand: normal module ${mm(g.helix.normalModule)}, transverse ${mm(g.helix.transverseModule)} mm at α_t ${g.helix.transversePressureAngle.toFixed(3)}°; lead ${mm(g.helix.lead)} mm, ${mm(g.helix.twist)}° over the face, the twist within ${g.helix.twistDeviation.toExponential(1)} mm${g.helix.axialSegments > 1 ? ` (${g.helix.axialSegments} axial segments)` : ''}` }] : []),
    { text: `Flanks within ${g.profileDeviation.toExponential(1)} mm of the involute (${g.flankPieces} cubic piece${g.flankPieces > 1 ? 's' : ''}; asked ${g.profileTolerance.toExponential(1)})` },
    // (R12b.1a, D130: the root the basic rack cuts.)
    ...(g.generatedRoot ? [{ text: `Root cut by the basic rack (tip radius ${mm(g.generatedRoot.toolTipRadius)} mm): the involute from Ø${mm(g.generatedRoot.formDiameter)}${g.generatedRoot.undercut ? ' (undercut)' : ' (the form circle)'}; fillets within ${g.generatedRoot.filletDeviation.toExponential(1)} mm of the tool's envelope (${g.generatedRoot.filletPieces} cubic pieces). Not validated for manufacturing` }] : []),
    ...g.diagnostics.map(x => ({ text: x.code === 'ROOT_TRANSITION_UNVALIDATED' ? 'Schematic root: not the cutting tool\'s, not validated for manufacturing' : x.message, warning: x.severity === 'warning' })),
  ];
}

/**
 * A meshing gear's pair check against the gear it meshes with, for the body's panel (R6a.4b, D56): the verdict mode
 * (stopping at the first crossing; the kernel caches it by both gears, the centre distance and the phase), its time.
 */
export function meshNotes(g: GearPlacement | undefined): { text: string; warning?: boolean }[] {
  if (g?.ring) return insideNotes(g);
  if (!g?.driver) return [];
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedSpurGears>;
  try { c = checkPlacedSpurGears(g.driver, g, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh with ${g.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  const head = `Meshes with ${g.meshesWith}: centre distance ${mm(c.centerDistance)} mm, ratio −${g.driver.spec.teeth}:${g.spec.teeth}, backlash ${mm(c.backlash)} mm, contact ratio ${c.usableContactRatio.toFixed(3)}${c.axialContactRatio ? ` + overlap ${c.axialContactRatio.toFixed(3)} = ${c.totalContactRatio.toFixed(3)}` : ''}`;
  return [{ text: head },
    c.sweep.interference ? { text: `The teeth cross at ${c.sweep.at.toFixed(2)}° of ${g.meshesWith} (phase ${c.relativePhase.toFixed(2)}°): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over a full tooth period (checked in ${ms.toFixed(0)} ms)` },
    ...(c.axialThrust ? [{ text: `Axial thrust: ${c.axialThrust.replace(/^gear 1/, g.meshesWith ?? 'gear 1').replace('gear 2', 'this gear')}` }] : []),
    ...c.diagnostics.filter(x => x.code !== 'SELF_INTERSECTION' && x.code !== 'ROOT_TRANSITION_UNVALIDATED').map(x => ({ text: x.message, warning: x.severity === 'warning' }))];
}

/** An internal gear's report as lines for the body's panel (R12b.2a, D132). */
export function internalGearNotes(g: NonNullable<CadPartSnapshot['outputs'][number]['internalGear']>, node?: ModelNode): { text: string; warning?: boolean }[] {
  const d = g.dimensions, mm = (x: number) => +x.toFixed(4);
  // (The command's default shift said as one, D132: not a standard.)
  const shift = node?.kind === 'internal-gear' && node.shiftDefault ? `Profile shift ${g.profileShift} (default: clears rack-cut pinions; see D132): ` : g.profileShift ? `Profile shift x ${g.profileShift}: ` : '';
  return [
    { text: `${shift}Internal: reference Ø${mm(d.referenceDiameter)}, tip Ø${mm(d.tipDiameter)} (inside), root Ø${mm(d.rootDiameter)}, base Ø${mm(d.baseDiameter)}, rim Ø${mm(d.rimDiameter)} mm; space ${mm(d.spaceWidth)} mm at the reference circle` },
    ...(g.helix ? [{ text: `Helical β ${g.helix.helixAngle}° ${g.helix.hand} hand: normal module ${mm(g.helix.normalModule)}, transverse ${mm(g.helix.transverseModule)} mm; its pinion takes the same hand` }] : []),
    { text: `Flanks within ${g.profileDeviation.toExponential(1)} mm of the involute (${g.flankPieces} cubic piece${g.flankPieces > 1 ? 's' : ''}; asked ${g.profileTolerance.toExponential(1)})` },
    // (R12b.2b, D133: the root a pinion-type cutter cuts, or the schematic one.)
    ...(g.shaperRoot ? [{ text: `Root cut by a ${g.shaperRoot.cutterTeeth}-tooth pinion-type cutter${g.shaperRoot.cutterShift ? ` (x0 ${g.shaperRoot.cutterShift})` : ''}, tip radius ${mm(g.shaperRoot.cutterTipRadius)} mm, at ${mm(g.shaperRoot.cuttingCenterDistance)} mm: the involute to Ø${mm(g.shaperRoot.formDiameter)}; fillets within ${g.shaperRoot.filletDeviation.toExponential(1)} mm of its envelope (${g.shaperRoot.filletPieces} cubic pieces). Not validated for manufacturing` },
      ...g.diagnostics.map(x => ({ text: x.message, warning: x.severity === 'warning' }))]
      : [{ text: 'Schematic root: not the cutting tool\'s (a pinion-type cutter), not validated for manufacturing', warning: true }]),
  ];
}
/**
 * A pinion inside a ring: the pair's check in verdict mode (R12b.2a, D132) — the centre distance, ratio +z1:z2,
 * backlash, contact ratio, the verdict, and the interference conditions and the radial assembly as warnings.
 */
function insideNotes(g: GearPlacement): { text: string; warning?: boolean }[] {
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedInternalGears>;
  try { c = checkPlacedInternalGears(g.ring!, g, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh inside ${g.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  return [{ text: `Meshes inside ${g.meshesWith}: centre distance ${mm(c.centerDistance)} mm, ratio +${g.spec.teeth}:${g.ring!.spec.teeth} (the same way), backlash ${mm(c.backlash)} mm, contact ratio ${c.usableContactRatio.toFixed(3)}${c.axialContactRatio ? ` + overlap ${c.axialContactRatio.toFixed(3)} = ${c.totalContactRatio.toFixed(3)}` : ''}` },
    c.sweep.interference ? { text: `The teeth cross at ${c.sweep.at.toFixed(2)}° of this gear (phase ${c.relativePhase.toFixed(2)}°): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over a full tooth period (checked in ${ms.toFixed(0)} ms)` },
    c.interference.trimming.interference ? { text: c.interference.trimming.possible ? `Radial assembly: the teeth cross moving in ${mm(c.interference.trimming.atOffset)} mm from the ring's centre — assemble it axially` : 'Radial assembly impossible: its tip circle does not fit inside the ring\'s — assemble it axially', warning: true }
      : { text: 'Radial assembly clear: it can be moved in from the ring\'s centre' },
    ...c.diagnostics.filter(x => x.code === 'INVOLUTE_INTERFERENCE' || x.code === 'TROCHOID_INTERFERENCE').map(x => ({ text: x.message, warning: true }))];
}

/** A worm's report as lines for the body's panel (R12b.5, D136). */
export function wormNotes(w: NonNullable<CadPartSnapshot['outputs'][number]['worm']>): { text: string; warning?: boolean }[] {
  const d = w.dimensions, mm = (x: number) => +x.toFixed(4);
  return [
    { text: `Worm ${w.form}${w.form === 'ZI' ? ' (involute helicoid)' : ' (straight axial sides)'}: reference Ø${mm(d.referenceDiameter)}, tip Ø${mm(d.tipDiameter)}, root Ø${mm(d.rootDiameter)} (q ${mm(d.diameterQuotient)}); lead angle γ ${mm(d.leadAngle)}°, lead ${mm(d.lead)} mm, axial pitch ${mm(d.axialPitch)} mm; ${w.form === 'ZI' ? `base Ø${mm(d.baseDiameter!)}, α_t ${mm(d.transversePressureAngle!)}°` : `axial sides at α_x ${mm(d.axialPressureAngle!)}°`}` },
    { text: `Flanks within ${w.profileDeviation.toExponential(1)} mm (${w.flankPieces} cubic piece${w.flankPieces > 1 ? 's' : ''}${w.flankFaces > 1 ? ` on ${w.flankFaces} faces` : ''}), the thread's twist ${mm(w.twist.turns)} turns within ${w.twist.deviation.toExponential(1)} mm (${w.twist.pieces} pieces in ${w.twist.axialSegments} axial segments). Not validated for manufacturing` },
    ...w.diagnostics.map(x => ({ text: x.code === 'ROOT_TRANSITION_UNVALIDATED' ? 'Schematic root: not the thread tool\'s, not validated for manufacturing' : x.message, warning: x.severity === 'warning' })),
  ];
}
/** A compression spring's report as lines for the body's panel (R12c.1a, D153): its sizes, solid heights, rate and load. */
export function springNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['spring']>): { text: string; warning?: boolean }[] {
  if (r.type !== 'compression') return hookedSpringNotes(r);
  const s = r, d = s.dimensions, mm = (x: number) => +x.toFixed(4), ends = s.ends === 'open' ? 'open' : s.ends === 'closed' ? 'closed' : 'closed and ground';
  return [
    { text: `Compression spring, ${s.hand} hand, ends ${ends}: wire Ø${mm(d.wireDiameter)}, mean Ø${mm(d.meanDiameter)} (outer ${mm(d.outerDiameter)}, inner ${mm(d.innerDiameter)}), index C ${mm(d.springIndex)}; ${mm(d.activeCoils)} active of ${mm(d.totalCoils)} coils, pitch ${mm(d.pitch)} mm (helix angle ${mm(d.helixAngle)}°), free length ${mm(d.freeLength)} mm (L0/D ${mm(d.slenderness)})` },
    { text: `Solid height ${mm(d.solidHeight)} mm (turns a wire Ø apart at pitch ${mm(d.solidPitch)}); ${mm(d.supplierSolidHeight)} mm by the supplier's rule ${d.supplierSolidHeightRule}; travel to solid ${mm(d.travelToSolid)} mm` },
    ...(d.rate !== undefined ? [{ text: `Rate ${mm(d.rate)} N/mm (Gd⁴/8D³n, G ${d.shearModulus} MPa${d.shearModulusEstimate ? ', an estimate for steel: the rate is one too' : ''})`, ...(d.shearModulusEstimate ? { warning: true } : {}) }] : [{ text: 'No rate: give the shear modulus G' }]),
    ...(d.load ? [{ text: `At ${mm(d.load.force)} N: ${d.load.deflection !== undefined ? `deflection ${mm(d.load.deflection)} mm, length ${mm(d.load.length!)} mm, ` : ''}shear stress ${mm(d.load.shearStress)} MPa (Wahl K_W ${mm(d.wahlFactor)}; uncorrected ${mm(d.load.uncorrectedShearStress)})` }] : []),
    { text: `Wire within ${s.sweep.profileDeviation.toExponential(1)} mm of the exact pipe (${s.sweep.pieces} cubic pieces on ${s.sweep.segments} segments); wire length ${mm(s.sweep.wireLength)} mm` },
    { text: 'Not validated for manufacturing: no buckling, fatigue or relaxation check', warning: true },
    ...s.diagnostics.map(x => ({ text: x.message.replace(/^spring: /, ''), warning: x.severity === 'warning' })),
  ];
}
/** A gusset's report as lines (FRk1, D165): where it sits, its size, its seams (the weld list's). */
export function gussetNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['gusset']>): { text: string }[] {
  const mm = (x: number) => +x.toFixed(4);
  return [{ text: `Gusset at point ${r.point}, between members ${r.members[0] + 1} and ${r.members[1] + 1} (${mm(r.angle)}°): legs ${mm(r.legs[0])} and ${mm(r.legs[1])}${r.clip ? `, corner clipped ${mm(r.clip)}` : ''}, ${mm(r.thickness)} thick${r.offset ? `, ${mm(r.offset)} off the members' plane` : ''}` },
    { text: `Plate ${mm(r.area)} mm² × ${mm(r.thickness)}: ${mm(r.volume)} mm³` },
    { text: `Seams: ${r.seams.map(s => `${mm(s.length)} on member ${s.member + 1}${s.face ? ` (${s.face})` : ''}`).join(', ')}` }];
}
/** An end cap's report as lines (FRk1, D165). */
export function endCapNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['endCap']>): { text: string }[] {
  const mm = (x: number) => +x.toFixed(4);
  return [{ text: `End cap ${r.fit === 'over' ? 'over' : 'inset in the bore of'} member ${r.member + 1}'s ${r.end}: ${mm(r.thickness)} thick, ${mm(r.area)} mm², ${mm(r.volume)} mm³` },
    { text: `Seam ${mm(r.seam.length)} mm round its ${r.fit === 'over' ? 'outline' : 'bore'} (exact)` }];
}
/** A weld bead's report as lines (FRk2, D166): where it is, its leg and throat, its seam and the part of it flush. */
export function beadNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['bead']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4), on = 'gusset' in r.on ? `gusset ${r.on.gusset}'s seams, both faces` : `member ${r.on.member + 1}'s ${r.on.end}`;
  return [{ text: `Fillet weld on ${on}: leg ${mm(r.leg)}, throat ${mm(r.throat)}, on member${r.meets.length > 1 ? 's' : ''} ${r.meets.map(k => k + 1).join(', ')}` },
    { text: `Seam ${mm(r.seam.length)} mm${r.seam.inner ? ' with the bore' : ''}; owned bead ${mm(r.volume)} mm³; nominal ${mm(r.nominalVolume)} mm³${r.sharedSeams.length ? `; ${r.sharedSeams.length} shared seam` : ''}` },
    ...(r.seam.flush > 0 ? [{ text: `${mm(r.seam.flush)} mm of it flush with the edge of the face it lands on: no fillet there (a corner weld, not modelled)`, warning: true }] : [])];
}
/** A connector opening's report as lines (R12c.7, D162): the opening, the body's fit, the keep-out. */
export function connectorNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['connector']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4), shape = (s: { shape: string; width: number; height: number }) => s.shape === 'round' ? `round Ø${mm(s.width)}` : `${s.shape} ${mm(s.width)} × ${mm(s.height)}`;
  return [{ text: `Connector opening ${r.name ?? r.row} (${r.estimate ? 'an estimate' : `your row, ${r.source}`}): ${shape(r.opening)}, ${mm(r.opening.depth)} deep, ${mm(r.opening.area)} mm²` },
    ...(r.body ? [{ text: `Its body ${shape(r.body)} × ${mm(r.body.length)}: gaps ${mm(r.body.gapWidth)} and ${mm(r.body.gapHeight)} each side, standing ${mm(r.body.standsOut)} out of the face` }] : []),
    ...(r.keepOut ? [{ text: `Keep-out in front of it: ${mm(r.keepOut.size[0])} × ${mm(r.keepOut.size[1])}, ${mm(r.keepOut.size[2])} out from the seated body's front (the part's keep-outs, when the command added it)` }] : []),
    { text: 'Envelopes only: not the receptacle\'s housing, contacts or tongue', warning: true }];
}
/** A drive element's report as lines (R12c.6b, D161): a sprocket's, a pulley's, a belt's or chain's, a coupling's. */
export function driveNotes(o: CadPartSnapshot['outputs'][number]): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4), d1 = (x: number) => +x.toFixed(1), whose = (est: boolean, src?: string) => est ? 'an estimate' : `your row, ${src}`;
  const tail = (ws: readonly string[]) => ws.map(w => ({ text: w, warning: true }));
  const not = { text: 'Not validated for manufacturing: no strength, wear or life check', warning: true };
  if (o.sprocket) {
    const r = o.sprocket;
    return [{ text: `Sprocket z${r.teeth} for chain ${r.chain} (${whose(r.chainEstimate, r.chainSource)}): pitch ${mm(r.pitch)}, roller Ø${mm(r.rollerDiameter)}; pitch Ø${mm(r.pitchDiameter)}` },
      { text: `Tooth form pivot-clearance (derived here, not ISO 606's): seats Ø${mm(r.seatDiameter)}, root Ø${mm(r.rootDiameter)}, flanks r ${mm(r.flankRadius)} about the neighbouring seats, tip Ø${mm(r.tipDiameter)} (pointed at Ø${mm(r.pointedTipDiameter)})` },
      { text: `A roller turning out of its seat clears the teeth by ${mm(r.engagementClearance)} mm (measured on the built teeth)` }, ...tail(r.warnings.filter(w => !/is an estimate$/.test(w))), not];
  }
  if (o.pulley) {
    const r = o.pulley, what = r.type === 'timing' ? `Timing pulley z${r.teeth}: pitch Ø${mm(r.pitchDiameter)}, outside Ø${mm(r.outsideDiameter)}, grooves to Ø${mm(r.grooveBottomDiameter!)}` : r.type === 'v' ? `V pulley, ${r.grooves} groove${r.grooves === 1 ? '' : 's'}: datum Ø${mm(r.pitchDiameter)}, outside Ø${mm(r.outsideDiameter)}, grooves to Ø${mm(r.grooveBottomDiameter!)}` : `Flat pulley Ø${mm(r.outsideDiameter)}${r.crown ? `, crowned ${mm(r.crown)}` : ''}`;
    return [{ text: `${what}, ${mm(r.width)} wide, for belt ${r.belt} (${whose(r.beltEstimate, r.beltSource)})` }, ...tail(r.warnings.filter(w => !/is an estimate$/.test(w))), not];
  }
  if (o.belt) {
    const r = o.belt, kind = r.kind === 'chain' ? 'Chain' : r.kind === 'timing-belt' ? 'Timing belt' : r.kind === 'v-belt' ? 'V-belt' : 'Flat belt';
    return [{ text: `${kind} ${r.row} (${whose(r.rowEstimate, r.rowSource)}): length ${mm(r.length)} mm on pitch radii ${mm(r.pitchRadii[0])} and ${mm(r.pitchRadii[1])} at ${mm(r.centerDistance)}; wraps ${d1(r.wrap[0])}° and ${d1(r.wrap[1])}°` },
      ...(r.chain ? [{ text: `${mm(r.chain.pitches)} pitches: ${r.chain.links} links (their centre distance ${mm(r.chain.centerDistance)}); the chain's polygon on the sprockets (the chordal effect) is not modelled` }] : []),
      { text: `Shown as a band ${mm(r.bandThickness)} × ${mm(r.bandWidth)} about its pitch path` }, ...tail(r.warnings)];
  }
  const r = o.coupling!;
  return [{ text: `Coupling ${r.row}${r.type ? ` (${r.type})` : ''} (${whose(r.estimate, r.source)}): Ø${mm(r.outside)} × ${mm(r.length)}, bores Ø${mm(r.bore[0])}${r.bore[0] !== r.bore[1] ? ` and Ø${mm(r.bore[1])} stepped at ${mm(r.boreStep)}` : ''}; its envelope only` },
    { text: `Bought${r.bought.partNumber ? `: part ${r.bought.partNumber}` : ''}${r.bought.supplier ? ` from ${r.bought.supplier}` : ''}${!r.bought.partNumber && !r.bought.supplier ? ' (no part number or supplier in its row)' : ''}` }];
}
/** A disc cam's report as lines (R12c.6a, D160): its follower, program, pressure angle, curvature and the fit. */
export function camNotes(r: NonNullable<CadPartSnapshot['outputs'][number]['cam']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4), d1 = (x: number) => +x.toFixed(1), u = r.units === 'deg' ? '°' : ' mm', osc = r.motion === 'oscillating', flat = r.follower === 'flat';
  const who = flat ? `${osc ? 'an oscillating' : 'a translating'} flat-faced follower` : `${osc ? 'an oscillating' : 'a translating'} roller follower (r ${mm(r.rollerRadius!)}, prime circle R ${mm(r.primeRadius!)})`;
  const where = osc ? `, pivot ${mm(r.pivotDistance!)} off the centre${r.armLength !== undefined ? `, arm ${mm(r.armLength)}` : ''}${r.faceOffset ? `, the face ${mm(r.faceOffset)} from the pivot` : ''}, at rest ${d1(r.restAngle!)}°` : r.offset ? `, offset ${mm(r.offset)}` : '';
  const program = r.segments.map(g => g.motion === 'dwell' ? `dwell to ${d1(g.end)}°` : `${g.motion} to ${mm(g.to)}${u} over ${d1(g.start)}–${d1(g.end)}° (${g.law})`).join(', ');
  const c = r.curvature, pa = r.pressureAngle;
  return [
    { text: `Disc cam for ${who}${where}: base R ${mm(r.baseRadius)}, ${osc ? 'swing' : 'lift'} ${mm(r.stroke)}${u}` },
    { text: `Motion: ${program}` },
    { text: `Peak velocity ${r.segments.filter(g => g.law).map(g => `${mm(g.peakVelocity)}`).join(' / ')} ${r.units}/rad, acceleration ${r.segments.filter(g => g.law).map(g => `${mm(g.peakAcceleration)}`).join(' / ')} ${r.units}/rad² (rise / return, per radian of the cam's turn)` },
    { text: flat && !osc ? 'Pressure angle 0° (the face square to the follower\'s motion)' : `Pressure angle at most ${mm(pa.max)}° at ${d1(pa.at)}°, against ${pa.limit}°${pa.limitEstimate ? ' (a rule of thumb, an estimate)' : ''}`, ...(pa.max > pa.limit ? { warning: true } : {}) },
    { text: flat ? `Least radius of curvature ${mm(c.leastProfileRadius)} at ${d1(c.at)}° (ρ = h + h_ββ > 0: no undercut); the face touches from ${mm(r.faceContact![0])} to ${mm(r.faceContact![1])} mm ${osc ? 'from the pivot' : 'about the follower\'s line'}`
      : `The pitch curve's least convex radius ${mm(c.leastPitchRadius!)} at ${d1(c.at)}°, above the roller's ${mm(r.rollerRadius!)}: no undercut (the profile's ${mm(c.leastProfileRadius)})` },
    { text: `Profile within ${r.profileDeviation.toExponential(1)} mm of its closed form (${r.profilePieces} cubic pieces, tolerance ${r.profileTolerance.toExponential(1)}); the follower found on the built profile within ${r.sweep.deviation.toExponential(1)} mm of the law (${r.sweep.samples} positions)` },
    ...r.warnings.filter(w => w.code !== 'PRESSURE_ANGLE').map(w => ({ text: w.message, warning: true })),
    { text: 'Not validated for manufacturing: no forces, contact stress, wear or follower dynamics', warning: true },
  ];
}
/** An O-ring gland's report as lines (R12c.5, D159). */
export function glandNotes(g: NonNullable<CadPartSnapshot['outputs'][number]['gland']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4), p = (x: number) => +x.toFixed(1), out: { text: string; warning?: boolean }[] = [];
  out.push({ text: `O-ring gland (${g.kind}) for ${g.ring}: ID ${mm(g.insideDiameter)} × CS ${mm(g.crossSection)} (${g.ringEstimate ? 'an estimate' : `your row, ${g.ringSource}`}); groove Ø${mm(g.grooveDiameter)} × ${mm(g.width)}, ${mm(g.depth)} deep${g.sealDiameter !== undefined ? ` to the Ø${mm(g.sealDiameter)} ${g.kind === 'piston' ? 'bore' : 'rod'}` : ''}`, ...(g.ringEstimate ? { warning: true } : {}) });
  out.push({ text: `Stretch ${p(g.stretchPercent)} %, the section ${mm(g.stretchedCrossSection)} stretched; squeeze ${p(g.squeezePercent)} % (${p(g.squeezeStretchedPercent)} % stretched${g.squeezeRangePercent ? `, ${p(g.squeezeRangePercent[0])}–${p(g.squeezeRangePercent[1])} % at the fit's extremes` : ''}); fill ${p(g.fillStretchedPercent)} %` });
  out.push({ text: `Against squeeze ${g.ranges.squeezePercent[0]}–${g.ranges.squeezePercent[1]} %, fill ${g.ranges.fillPercent[0]}–${g.ranges.fillPercent[1]} %, stretch ≤ ${g.ranges.stretchMaxPercent} % (${g.ranges.estimate ? `estimates: ${g.ranges.source}` : `yours: ${g.ranges.source}`})`, ...(g.ranges.estimate ? { warning: true } : {}) });
  for (const w of g.warnings) out.push({ text: `${w.code}: ${w.message}`, warning: true });
  return out;
}
/** A bearing's report as lines (R12c.4, D158). */
export function bearingNotes(b: NonNullable<CadPartSnapshot['outputs'][number]['bearing']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4), um = (x: number) => `${x > 0 ? '+' : ''}${+(x * 1000).toFixed(3)}`, out: { text: string; warning?: boolean }[] = [];
  out.push({ text: `Bearing ${b.designation ?? b.row}: Ø${mm(b.bore)} × Ø${mm(b.outside)} × ${mm(b.width)}, corners r ${mm(b.chamfer)} (${b.estimate ? 'an estimate' : `your row, ${b.source}`})`, ...(b.estimate ? { warning: true } : {}) });
  if (b.seat) out.push({ text: `On step ${b.seat.step} from ${mm(b.seat.from)} to ${mm(b.seat.to)}, against the Ø${mm(b.seat.shoulder)} shoulder${b.seat.shoulderFillet ? ` (fillet r ${mm(b.seat.shoulderFillet)})` : ''}; ${b.seat.located ? `its other side by ${b.seat.located}` : 'its other side not located'}; no overlap with the shaft` });
  // (FRk8a, D181: the housing's shoulder from its faces, at the bearing's start or end; none is said by the kernel's warning.)
  if (b.housing) { const sh = b.housing.shoulder; out.push({ text: `In the housing's Ø${mm(b.housing.bore)} bore${sh ? ` against its Ø${mm(sh.diameter)} shoulder at the bearing's ${sh.at}` : ''}${b.housing.covered ? '' : ' (not covering it)'}; no overlap` }); }
  const fit = (what: string, f: NonNullable<typeof b.shaftFit>) => ({ text: `${what} ${f.limit.class}: ${mm(f.limit.min)} to ${mm(f.limit.max)}${f.kind ? ` — ${f.kind} ${um(f.clearanceMin!)} to ${um(f.clearanceMax!)} µm with the ring` : ' (the ring\'s tolerance is not in its row)'}${f.limit.estimate ? ', an estimate' : ''}`, ...(f.limit.estimate ? { warning: true } : {}) });
  if (b.shaftFit) out.push(fit('Shaft seat', b.shaftFit));
  if (b.housingFit) out.push(fit('Housing seat', b.housingFit));
  for (const w of b.warnings) out.push({ text: w, warning: true });
  out.push({ text: 'A simplified envelope: not for structural calculation (no load ratings or life)', warning: true });
  return out;
}
/** A key's, a keyway's, a ring's or a pin's report as lines (R12c.3b, D157). */
export function shaftPartNotes(o: CadPartSnapshot['outputs'][number]): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4), out: { text: string; warning?: boolean }[] = [];
  if (o.key) {
    const k = o.key;
    out.push({ text: `Key ${mm(k.width)} × ${mm(k.height)} × ${mm(k.length)} (${k.ends} ends) in keyseat ${k.keyseat}: ${mm(k.seatPlay)} play in the seat's width, ${mm(k.lengthRoom)} to spare in its length; it stands ${mm(k.stands)} above the shaft` });
    if (k.hub) out.push({ text: `In the hub's keyway: ${mm(k.hub.keywayPlay)} play in its width, ${mm(k.hub.topClearance)} under its floor` });
    else out.push({ text: 'No hub keyway given: the key\'s top clearance is not checked', warning: true });
    // (O138: the width fits from the classes on the key's, the seat's and the keyway's sides — the user's tables.)
    const deviation = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${mm(Math.abs(x))}`;
    for (const [where, f] of [['seat', k.seatFit], ['hub\'s keyway', k.hubFit]] as const) if (f) out.push({ text: `Width fit in the ${where}: ${f.hole.class}/${f.shaft.class} at ${mm(k.width)} mm — ${f.kind}, ${deviation(f.clearanceMin)} to ${deviation(f.clearanceMax)} mm clearance${f.estimate ? ' (an estimate)' : ''}`, ...(f.estimate ? { warning: true } : {}) });
  }
  if (o.keyway) { const w = o.keyway; out.push({ text: `Keyway ${mm(w.width)} wide, ${mm(w.depth)} deep in the Ø${mm(2 * w.boreRadius)} bore (its floor ${mm(w.floorRadius)} from the axis), ${mm(w.to - w.from)} long at ${mm(w.angle)}°` }); }
  if (o.ring) { const r = o.ring; out.push({ text: `Retaining ring ${mm(r.thickness)} thick, Ø${mm(r.innerDiameter)} to Ø${mm(r.outerDiameter)} in groove ${r.groove}: ${mm(r.axialPlay)} axial play` }); if (r.estimate) out.push({ text: 'The ring\'s sizes are an estimate: your ring\'s row gives them', warning: true }); else if (r.source) out.push({ text: `Its groove checked against your ring row (${r.source})` }); }
  if (o.pin) { const p = o.pin; out.push({ text: `Pin Ø${mm(p.diameter)} × ${mm(p.length)} in cross hole ${p.hole} (Ø${mm(p.holeDiameter)}): ${mm(p.clearance)} clearance` }); }
  out.push({ text: 'Sizes are yours (your own rows: none built in); not validated for manufacturing', warning: true });
  return out;
}
/** A shaft's report as lines (R12c.3a, D156): its steps, keyseats, grooves and holes. */
export function shaftNotes(s: NonNullable<CadPartSnapshot['outputs'][number]['shaft']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4);
  return [
    { text: `Shaft ${mm(s.length)} mm: ${s.steps.map(x => `Ø${mm(x.diameter)} from ${mm(x.from)} to ${mm(x.to)}`).join('; ')}` },
    ...s.keyseats.map(k => ({ text: `Keyseat ${k.index} (step ${k.step}, ${k.ends}${k.cutterRadius ? ` R${mm(k.cutterRadius)}` : ''}): ${mm(k.width)} wide, ${mm(k.depth)} deep (floor ${mm(k.floorRadius)} from the axis), ${mm(k.length)} long from ${mm(k.from)}${k.surfaceLength !== k.length ? `, ${mm(k.surfaceLength)} at the surface` : ''}, at ${mm(k.angle)}°` })),
    ...s.grooves.map(g => ({ text: `Groove ${g.index} (step ${g.step}): Ø${mm(g.diameter)}, ${mm(g.width)} wide from ${mm(g.from)}` })),
    ...s.holes.map(h => ({ text: `Cross hole ${h.index}: Ø${mm(h.diameter)} at ${mm(h.at)}, at ${mm(h.angle)}°` })),
    { text: 'Sizes are yours (keys, rings and pins from your own rows: none built in); not validated for manufacturing', warning: true },
  ];
}
/** An extension or torsion spring's report as lines (R12c.1b, D154). */
function hookedSpringNotes(s: Extract<NonNullable<CadPartSnapshot['outputs'][number]['spring']>, { type: 'extension' | 'torsion' }>): { text: string; warning?: boolean }[] {
  const d = s.dimensions, mm = (x: number) => +x.toFixed(4), close = s.dimensions.pitch < s.dimensions.wireDiameter * 1.01;
  const head = `${s.type === 'extension' ? 'Extension' : 'Torsion'} spring, ${s.hand} hand${s.hooks ? `, ${s.hooks === 'crossover' ? 'crossover hooks' : 'machine loops'}` : ''}: wire Ø${mm(d.wireDiameter)}, mean Ø${mm(d.meanDiameter)} (outer ${mm(d.outerDiameter)}, inner ${mm(d.innerDiameter)}), index C ${mm(d.springIndex)}; ${mm(d.activeCoils)} coils${close ? ' close-wound' : ''} at pitch ${mm(d.pitch)} mm, coil length ${mm(d.bodyLength)} mm`;
  const lines: { text: string; warning?: boolean }[] = [{ text: head }];
  if (s.type === 'extension') {
    lines.push({ text: `Length inside the hooks ${mm(d.lengthInsideHooks!)} mm; initial tension ${mm(d.initialTension ?? 0)} N (your figure: no data behind it)` });
    lines.push(d.rate !== undefined ? { text: `Rate ${mm(d.rate)} N/mm (Gd⁴/8D³n, G ${d.shearModulus} MPa${d.shearModulusEstimate ? ', an estimate for steel: the rate is one too' : ''})`, ...(d.shearModulusEstimate ? { warning: true } : {}) } : { text: 'No rate: give the shear modulus G' });
    if (d.load) lines.push({ text: `At ${mm(d.load.force)} N: ${d.load.extension !== undefined ? `extension ${mm(d.load.extension)} mm past the initial tension, ` : ''}shear stress ${mm(d.load.shearStress)} MPa in the coil (Wahl K_W ${mm(d.wahlFactor!)}); the hooks' stresses not computed` });
  } else {
    lines.push({ text: `Legs ${mm(d.legLengths![0])} and ${mm(d.legLengths![1])} mm along the coil's tangent, ${mm(d.legAngle!)}° apart seen along the axis` });
    lines.push(d.torsionalRate !== undefined ? { text: `Rate ${mm(d.torsionalRate!)} N·mm/° (Ed⁴π/(64Dn·180); E ${d.youngsModulus} MPa${d.youngsModulusEstimate ? ', an estimate for steel: the rate is one too' : ''})`, ...(d.youngsModulusEstimate ? { warning: true } : {}) } : { text: 'No rate: give Young\'s modulus E' });
    if (d.moment) lines.push({ text: `At ${mm(d.moment.moment)} N·mm: ${d.moment.turn !== undefined ? `turn ${mm(d.moment.turn)}°, ` : ''}bending stress ${mm(d.moment.bendingStress)} MPa (K_b ${mm(d.bendingFactor!)})` });
  }
  lines.push({ text: `Wire within ${s.sweep.profileDeviation.toExponential(1)} mm of the exact pipe (${s.sweep.pieces} cubic pieces on the coil; ends exact); wire length ${mm(d.wireLength)} mm; the ${s.type === 'extension' ? 'hooks' : 'legs'} clear the wire by ${mm(d.leastClearance - d.wireDiameter)} mm` });
  lines.push({ text: 'Not validated for manufacturing: no fatigue, relaxation or hook-stress check', warning: true });
  return lines;
}
/** A throated worm wheel's report as lines for the body's panel (R12b.6, D137). */
export function wormWheelNotes(w: NonNullable<CadPartSnapshot['outputs'][number]['wormWheel']>): { text: string; warning?: boolean }[] {
  const d = w.dimensions, mm = (x: number) => +x.toFixed(4);
  return [
    { text: `Throated worm wheel, cut by a hob of its ZA worm's thread: reference Ø${mm(d.referenceDiameter)}, throat Ø${mm(d.throatDiameter)} (its surface radius ${mm(d.throatRadius)}), root Ø${mm(d.rootDiameter)}, centre distance ${mm(d.centerDistance)} mm; at its faces tip Ø${mm(d.tipDiameterAtFaces)}, root Ø${mm(d.rootDiameterAtFaces)}` },
    { text: `Flanks within ${w.flank.deviation.toExponential(1)} mm of the generated surface in every plane (${w.flank.piecesAcross} × ${w.flank.piecesAlong} bicubic pieces), root fillets within ${w.fillet.deviation.toExponential(1)} (asked ${w.profileTolerance.toExponential(1)}); tips and roots on their tori exactly. Not validated for manufacturing` },
    ...w.diagnostics.map(x => ({ text: x.message, warning: x.severity === 'warning' })),
  ];
}
/** A worm meshing with its wheel: the pair's check in verdict mode (R12b.5, D136) — the sections square to the wheel's axis. */
export function wormMeshNotes(p: CadPartSnapshot['outputs'][number]['wormPlacement']): { text: string; warning?: boolean }[] {
  if (!p?.wheel && !p?.throatedWheel) return [];
  // (D240: the pair's check is ~0.5 s and depends only on the pair as placed — its notes, exactly as first computed
  // (the time they took included), are kept by that input, so an evaluation that leaves the pair alone does not redo it.)
  const key = pairKey(p), kept = meshNotesKept.get(key);
  if (kept) { meshNotesKept.delete(key); meshNotesKept.set(key, kept); return kept.map(n => ({ ...n })); }
  const notes = p.throatedWheel ? throatedMeshNotes(p) : spurWheelMeshNotes(p);
  meshNotesKept.set(key, notes.map(n => ({ ...n })));
  if (meshNotesKept.size > MESH_NOTES_KEPT) meshNotesKept.delete(meshNotesKept.keys().next().value!);
  return notes;
}
const MESH_NOTES_KEPT = 32, meshNotesKept = new Map<string, { text: string; warning?: boolean }[]>();
/** The pair as placed, as a key (typed arrays as their numbers). */
const pairKey = (p: NonNullable<CadPartSnapshot['outputs'][number]['wormPlacement']>) => JSON.stringify(p, (_k, v: unknown) => ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v);
/** Test-only: forget the kept notes (a check from nothing). */
export function forgetMeshNotes(): void { meshNotesKept.clear(); }
function spurWheelMeshNotes(p: NonNullable<CadPartSnapshot['outputs'][number]['wormPlacement']>): { text: string; warning?: boolean }[] {
  if (!p.wheel) return [];
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedWormPair>;
  try { c = checkPlacedWormPair(p.wheel, p, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh with ${p.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4), side = mm(p.wheel.spec.faceWidth / 3);
  return [{ text: `Meshes with ${p.meshesWith}: crossed at 90°, centre distance ${mm(c.centerDistance)} mm, ratio ${p.wheel.spec.teeth}:${p.spec.starts} (${mm(c.speedRatio)}:1), backlash ${mm(c.backlash)} mm along the worm's axis, mid-plane contact ratio ${c.midPlaneContactRatio.toFixed(3)}` },
    c.interference ? { text: `The thread and the wheel's teeth cross (${c.planes.filter(x => x.interference).map(x => `${mm(x.offset)} mm`).join(', ')} from the wheel's mid-plane): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over an axial pitch in the wheel's mid-plane and ±${side} mm (checked in ${ms.toFixed(0)} ms)` },
    ...c.diagnostics.filter(x => x.code !== 'SELF_INTERSECTION').map(x => ({ text: x.message, warning: x.severity === 'warning' }))];
}

/** A worm meshing with its throated wheel (R12b.6, D137): the sections square to the wheel's axis, verdict mode. */
function throatedMeshNotes(p: NonNullable<CadPartSnapshot['outputs'][number]['wormPlacement']>): { text: string; warning?: boolean }[] {
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedThroatedPair>;
  try { c = checkPlacedThroatedPair(p.throatedWheel!, p, { mode: 'verdict', samples: 16 }); }
  catch (cause) { return [{ text: `Does not mesh with ${p.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  return [{ text: `Meshes with ${p.meshesWith}, enveloping it: crossed at 90°, centre distance ${mm(c.centerDistance)} mm, ratio ${p.throatedWheel!.spec.teeth}:${p.spec.starts} (${mm(c.speedRatio)}:1), backlash ${mm(c.backlash)} mm along the worm's axis` },
    c.interference ? { text: `The thread and the wheel's teeth cross (${c.planes.filter(x => x.interference).map(x => `${mm(x.offset)} mm`).join(', ')} from its mid-plane): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `In contact along lines across the face — touching or clear in the mid-plane and ${c.planes.length - 1} sections either side (checked in ${ms.toFixed(0)} ms)` }];
}

/** A bevel gear's report as lines for the body's panel (R12b.3, D134). */
export function bevelGearNotes(g: NonNullable<CadPartSnapshot['outputs'][number]['bevelGear']>, node?: ModelNode): { text: string; warning?: boolean }[] {
  const d = g.dimensions, mm = (x: number) => +x.toFixed(4), dg = (x: number) => +x.toFixed(4), sp = g.spiral;
  // (R12b.4, D135: a spiral one is an ideal model — said first, as a warning; its cutter radius an estimate when the command's default.)
  const estimate = node?.kind === 'bevel-gear' && node.spiral?.cutterEstimate;
  return [
    ...(sp ? [{ text: 'Ideal model: a spiral bevel gear in line contact — the conjugate of its mate on every sphere about the apex, not a face-milled or face-hobbed tooth (no crowning, no machine settings)', warning: true },
      { text: `Spiral β_m ${dg(sp.meanSpiralAngle)}° ${sp.hand} hand on a ${mm(sp.cutterRadius)} mm cutter radius${estimate ? ' (an estimate: the mean cone distance; give the shop\'s)' : ''}: β ${dg(sp.spiralAngleAtToe)}° at the toe to ${dg(sp.spiralAngleAtHeel)}° at the heel; transverse α_t ${dg(sp.transversePressureAngle)}° (normal ${dg(sp.normalPressureAngleAtToe)}° to ${dg(sp.normalPressureAngleAtHeel)}°); the section turns ${dg(sp.twist)}° from the toe to the heel, within ${sp.twistDeviation.toExponential(1)} mm (${sp.twistPieces} cubic piece${sp.twistPieces > 1 ? 's' : ''})`, ...(estimate ? { warning: true } : {}) }] : []),
    { text: `${sp ? 'Spiral' : 'Straight'} bevel, spherical involute: reference Ø${mm(d.referenceDiameter)} at the heel, pitch cone ${dg(d.pitchAngle)}° (shaft angle ${dg(d.shaftAngle)}°), cone distance ${mm(d.coneDistance)} mm (toe ${mm(d.innerConeDistance)}); tip Ø${mm(d.tipDiameterAtHeel)}, root Ø${mm(d.rootDiameterAtHeel)} at the heel; addendum and dedendum angles ${dg(d.addendumAngle)}° and ${dg(d.dedendumAngle)}°, the cones through the apex` },
    { text: `Flanks within ${g.profileDeviation.toExponential(1)} mm of the spherical involute, exactly on the spheres about the apex (${g.flankPieces} conic piece${g.flankPieces > 1 ? 's' : ''}; asked ${g.profileTolerance.toExponential(1)}); heel and toe are spheres about the apex` },
    { text: `Tredgold's virtual spur gear: ${g.virtualTeeth.toFixed(2)} teeth (an estimate; the gear is the exact spherical involute)` },
    ...g.diagnostics.filter(x => x.code !== 'IDEAL_MODEL').map(x => ({ text: x.code === 'ROOT_TRANSITION_UNVALIDATED' ? 'Schematic root: not the generating tool\'s, not validated for manufacturing' : x.message, warning: x.severity === 'warning' })),
  ];
}
/** A bevel gear meshing with another: the pair's check in verdict mode (R12b.3, D134) — ratio, backlash, contact ratio, the verdict. */
export function bevelMeshNotes(g: CadPartSnapshot['outputs'][number]['bevelGearPlacement']): { text: string; warning?: boolean }[] {
  if (!g?.driver) return [];
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedBevelGears>;
  try { c = checkPlacedBevelGears(g.driver, g, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh with ${g.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  return [{ text: `Meshes with ${g.meshesWith}: the same apex, shaft angle ${+c.shaftAngle.toFixed(4)}°, ratio ${g.driver.spec.teeth}:${g.spec.teeth}, backlash ${mm(c.backlash)} mm at the heel, contact ratio ${c.usableContactRatio.toFixed(3)} (spherical; Tredgold's estimate ${c.tredgoldContactRatio.toFixed(3)})${c.faceContactRatio !== undefined ? ` + face ${c.faceContactRatio.toFixed(3)} = ${c.totalContactRatio!.toFixed(3)}` : ''}` },
    c.sweep.interference ? { text: `The teeth cross at ${c.sweep.at.toFixed(2)}° of ${g.meshesWith} (phase ${c.relativePhase.toFixed(2)}°): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over a full tooth period ${c.spheres ? `on ${c.spheres.length} spheres from the toe to the heel` : 'on the heel sphere'} (checked in ${ms.toFixed(0)} ms)` },
    ...(c.spheres ? [{ text: `Axial thrust: ${c.axialThrust.replace(/gear 1/g, g.meshesWith ?? 'gear 1').replace(/gear 2/g, 'this gear')}` }] : [])];
}

/** A rack's report as lines for the body's panel (R6a.5b, D58). */
export function rackNotes(k: NonNullable<CadPartSnapshot['outputs'][number]['rack']>): { text: string; warning?: boolean }[] {
  const mm = (x: number) => +x.toFixed(4);
  return [...(k.helix ? [{ text: `Helical rack β ${k.helix.helixAngle}° ${k.helix.hand} hand (normal module ${mm(k.helix.normalModule)}): its teeth slide ${mm(k.helix.shear)} mm along per mm up the face` }] : []),
    { text: `Length ${mm(k.length)} mm, pitch ${mm(k.pitch)} mm; tooth ${mm(k.toothThickness)} mm on the pitch line, tip ${mm(k.tipWidth)}, root gap ${mm(k.rootWidth)} mm` },
    // (R12b.1b, D131: the basic rack's root fillet, or the schematic corner.)
    k.rootFillet ? { text: `Root fillets ${mm(k.rootFillet.radius)} mm (the basic rack's): the straight flank ends ${mm(k.rootFillet.flankEndDepth)} mm below the pitch line. Not validated for manufacturing` }
      : { text: 'Schematic root: not the cutting tool\'s, not validated for manufacturing', warning: true }];
}
/** A rack meshing with a gear: the pair's check in verdict mode, its time (as meshNotes). */
export function rackMeshNotes(k: RackPlacement | undefined): { text: string; warning?: boolean }[] {
  if (!k?.driver) return [];
  const t0 = performance.now();
  let c: ReturnType<typeof checkPlacedSpurRack>;
  try { c = checkPlacedSpurRack(k.driver, k, { mode: 'verdict' }); }
  catch (cause) { return [{ text: `Does not mesh with ${k.meshesWith}: ${cause instanceof Error ? cause.message.replace(/^gear: /, '') : String(cause)}`, warning: true }]; }
  const ms = performance.now() - t0, mm = (x: number) => +x.toFixed(4);
  return [{ text: `Meshes with ${k.meshesWith}: pitch line ${mm(c.centerDistance)} mm from its axis, ${mm(Math.PI * spurGearDimensions(k.driver.spec).referenceDiameter)} mm a turn, backlash ${mm(c.backlash)} mm, contact ratio ${c.usableContactRatio.toFixed(3)}${c.axialContactRatio ? ` + overlap ${c.axialContactRatio.toFixed(3)} = ${c.totalContactRatio.toFixed(3)}` : ''}` },
    c.sweep.interference ? { text: `The teeth cross at ${c.sweep.at.toFixed(2)}° of ${k.meshesWith} (slid ${c.rackPhase.toFixed(3)} mm): interference (${ms.toFixed(0)} ms)`, warning: true }
      : { text: `Clear over a full tooth period (checked in ${ms.toFixed(0)} ms)` }];
}
