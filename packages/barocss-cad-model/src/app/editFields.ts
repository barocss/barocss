import { eligibleFillPatternRegions, fillRegionSnapshot } from '../engine/fillFeaturePattern';
import { eligibleCurvePatternPaths } from '../engine/curveFeaturePattern';
import type { StudioDoc } from '../engine/doc';
// The editable dimensions of a feature, including those of the sketch it is made from: each field
// reads its value from the document's nodes and writes a changed copy of them (sketch edits change the
// sketch node, so every feature made from it follows).
import { frameGeometry, type Axis, type Dim, type FrameCorners, type FrameNotch, type ModelNode, type SketchNode } from '../engine/doc';
import { outlineFields } from '../sketch/outlineFields';
import type { BearingAssemblyContext, BearingAssemblyInput } from '../engine/bearingContext';
import type { StudioFits } from '../engine/fits';
import { bearingHousingOptions, bearingHousingPatch, bearingHousingValue } from './shaftCommands';
import { helixOf } from '../engine/part';
import { spurGearCenterDistance, internalGearCenterDistance, bevelGearDimensions } from '@barocss/cad';

type Nodes = readonly ModelNode[];
export type EditField =
  | { kind: 'number'; key: string; label: string; unit?: 'mm' | '°' | '%'; get(nodes: Nodes): number; set(nodes: Nodes, value: number): ModelNode[] }
  | { kind: 'choice'; key: string; label: string; options: { value: string; label: string }[]; get(nodes: Nodes): string; set(nodes: Nodes, value: string): ModelNode[] }
  | { kind: 'toggle'; key: string; label: string; get(nodes: Nodes): boolean; set(nodes: Nodes, value: boolean): ModelNode[] };

/**
 * A dimension's number. A parameter reference reads as its value while a field with the document's
 * parameters runs (see `editFields`), noting which parameter it read; else NaN (not edited).
 */
let PARAMS: Record<string, number> | null = null, SEEN: string[] = [];
const num = (v: Dim | undefined) => {
  if (typeof v === 'number') return v;
  if (v && PARAMS && v.parameter in PARAMS) { SEEN.push(v.parameter); return PARAMS[v.parameter]; }
  return NaN;
};
function within<T>(params: Record<string, number>, f: () => T): { value: T; seen: string[] } {
  const p = PARAMS, s0 = SEEN; PARAMS = params; SEEN = [];
  try { return { value: f(), seen: SEEN }; } finally { PARAMS = p; SEEN = s0; }
}
/** The one numeric leaf that changed from `a` to `b` (its path), or null when none or several did. */
function changedLeaf(a: unknown, b: unknown, path: (string | number)[] = []): (string | number)[] | null | 'many' {
  if (a === b) return null;
  if (typeof b === 'number') return typeof a === 'number' || (a !== null && typeof a === 'object') ? path : 'many';
  if (!b || typeof b !== 'object' || !a || typeof a !== 'object') return 'many';
  let found: (string | number)[] | null = null;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const r = changedLeaf((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], [...path, Array.isArray(b) ? Number(k) : k]);
    if (r === 'many' || (r && found)) return 'many';
    if (r) found = r;
  }
  return found;
}
const setAt = (root: unknown, path: (string | number)[], value: unknown): unknown => {
  if (!path.length) return value;
  const [k, ...rest] = path, copy = (Array.isArray(root) ? [...root] : { ...(root as object) }) as Record<string | number, unknown>;
  copy[k] = setAt(copy[k], rest, value); return copy;
};
const replace = (nodes: Nodes, i: number, node: ModelNode): ModelNode[] => nodes.map((n, k) => k === i ? node : n);
const axes = (list: string[]) => list.map(v => ({ value: v, label: v.toUpperCase() }));

/** Width, depth and corner of a rectangle; diameter and centre of a circle; a drawn outline's driving dimensions. */
function sketchFields(nodes: Nodes, s: number, prefix: string): EditField[] {
  const sk = nodes[s] as SketchNode | undefined, out: EditField[] = [];
  if (!sk || sk.kind !== 'sketch') return out;
  const at = (n: Nodes) => n[s] as SketchNode;
  if (sk.profile === 'rectangle') {
    const rect = (n: Nodes) => at(n) as Extract<SketchNode, { profile: 'rectangle' }>;
    const put = (n: Nodes, min: Dim[], max: Dim[]) => replace(n, s, { ...rect(n), min: [min[0], min[1]], max: [max[0], max[1]] });
    out.push(
      { kind: 'number', key: prefix + 'w', label: prefix + 'Width', unit: 'mm', get: n => num(rect(n).max[0]) - num(rect(n).min[0]), set: (n, v) => put(n, rect(n).min, [num(rect(n).min[0]) + v, rect(n).max[1]]) },
      { kind: 'number', key: prefix + 'd', label: prefix + 'Depth', unit: 'mm', get: n => num(rect(n).max[1]) - num(rect(n).min[1]), set: (n, v) => put(n, rect(n).min, [rect(n).max[0], num(rect(n).min[1]) + v]) },
      ...[0, 1].map((k): EditField => ({ kind: 'number', key: prefix + 'c' + k, label: prefix + 'Corner ' + 'XY'[k], unit: 'mm', get: n => num(rect(n).min[k]),
        set: (n, v) => { const r = rect(n), d = v - num(r.min[k]), min = [...r.min], max = [...r.max]; min[k] = v; max[k] = num(r.max[k]) + d; return put(n, min, max); } })));
  } else if (sk.profile === 'circle') {
    const circ = (n: Nodes) => at(n) as Extract<SketchNode, { profile: 'circle' }>;
    out.push({ kind: 'number', key: prefix + 'dia', label: prefix + 'Diameter', unit: 'mm', get: n => num(circ(n).radius) * 2, set: (n, v) => replace(n, s, { ...circ(n), radius: v / 2 }) },
      ...[0, 1].map((k): EditField => ({ kind: 'number', key: prefix + 'cc' + k, label: prefix + 'Centre ' + 'XY'[k], unit: 'mm', get: n => num(circ(n).center[k]),
        set: (n, v) => { const c = [...circ(n).center] as [Dim, Dim]; c[k] = v; return replace(n, s, { ...circ(n), center: c }); } })));
  }
  out.push(...outlineFields(nodes, s, prefix));
  return out;
}

/**
 * With the document's parameters, a number field reads parameter references as their values, says
 * which parameter it is bound to, and binds or unbinds one (a field that writes its value to one place,
 * as it is: a diameter stored as a radius cannot take a parameter).
 */
export type BindableField = Extract<EditField, { kind: 'number' }> & { param(nodes: Nodes): string | null; bind(nodes: Nodes, name: string): ModelNode[] | null };
/**
 * Where a part-scoped edit stands (O167, F6), when no assembly input is given: the part draft's bearing context (its
 * occurrence and the other parts, as the bearing command reads it) and the fit tables the draft sees.
 */
export interface EditScope { readonly context?: BearingAssemblyContext; readonly fits?: StudioFits; readonly doc?: Pick<StudioDoc, 'direct'> & Partial<Pick<StudioDoc, 'parameters'>> }
export function editFields(nodes: Nodes, i: number, params?: Record<string, number>, bearingAssembly?: BearingAssemblyInput, scope?: EditScope): EditField[] {
  const raw = editFieldsRaw(nodes, i, bearingAssembly, scope, params ?? scope?.doc?.parameters ?? {});
  if (!params) return raw;
  return raw.map(f => f.kind !== 'number' ? f : {
    ...f,
    get: n => within(params, () => f.get(n)).value,
    set: (n, v) => within(params, () => f.set(n, v)).value,
    param: (n: Nodes) => { const r = within(params, () => f.get(n)); return r.seen.length === 1 ? r.seen[0] : null; },
    bind: (n: Nodes, name: string) => {
      if (((n[i]?.kind === 'linear-feature-pattern' || n[i]?.kind === 'curve-feature-pattern') && f.key === 'count') || ((n[i]?.kind === 'rectangular-feature-pattern' || n[i]?.kind === 'fill-feature-pattern') && (f.key === 'count' || f.key === 'count2'))) return null;
      if (n[i]?.kind === 'fill-feature-pattern' && (f.key === 'anchorX' || f.key === 'anchorY')) return null;
      if (!(name in params)) return null;
      const next = within(params, () => f.set(n, params[name])).value;
      // (The value must land as it is in one place: then that place holds the reference.)
      const where = changedLeaf(n, next);
      if (where === 'many') return null;
      if (where === null) {
        // Already that value somewhere: find the leaf the field reads.
        const probe = within(params, () => f.set(n, params[name] + 1)).value, at = changedLeaf(n, probe);
        if (!at || at === 'many' || getAt(probe, at) !== params[name] + 1) return null;
        return setAt(n, at, { parameter: name }) as ModelNode[];
      }
      return getAt(next, where) === params[name] ? setAt(next, where, { parameter: name }) as ModelNode[] : null;
    },
  } as BindableField);
}
const getAt = (root: unknown, path: (string | number)[]): unknown => path.reduce<unknown>((o, k) => (o as Record<string | number, unknown>)?.[k], root);

/** A member section's dimensions as the feature editor names them (FR1, D123). */
const MEMBER_FIELD_LABELS: Record<string, string> = {
  width: 'Width', height: 'Height', wall: 'Wall', outerRadius: 'Outer corner radius', innerRadius: 'Bore corner radius', diameter: 'Diameter',
  legX: 'Leg along x', legY: 'Leg along y', thickness: 'Thickness', rootRadius: 'Root radius', toeRadius: 'Toe radius', web: 'Web', flange: 'Flange thickness at overhang midpoint', flangeSlope: 'Flange slope (rise/run)',
  size: 'Size', opening: 'Slot opening', lip: 'Slot lip', undercut: 'Slot undercut', depth: 'Slot depth', bore: 'Core bore',
};
function editFieldsRaw(nodes: Nodes, i: number, bearingAssembly?: BearingAssemblyInput, scope?: EditScope, parameters: Record<string, number> = {}): EditField[] {
  const node = nodes[i], out: EditField[] = [];
  if (!node) return out;
  const self = <T extends ModelNode>(n: Nodes) => n[i] as T;
  const number = (key: string, label: string, unit: 'mm' | '°' | '%' | undefined, get: (n: ModelNode) => number, set: (n: ModelNode, v: number) => ModelNode) =>
    out.push({ kind: 'number', key, label, ...(unit ? { unit } : {}), get: n => get(self(n)), set: (n, v) => replace(n, i, set(self(n), v)) });
  switch (node.kind) {
    case 'extrude':
      out.push(...sketchFields(nodes, node.sketch, ''));
      number('h', 'Distance', 'mm', n => num((n as typeof node).height), (n, v) => ({ ...(n as typeof node), height: v }));
      number('from', 'Start Z', 'mm', n => num((n as typeof node).from ?? 0), (n, v) => ({ ...(n as typeof node), from: v }));
      number('draft', 'Draft', '°', n => (n as typeof node).draft ?? 0, (n, v) => ({ ...(n as typeof node), draft: v }));
      break;
    case 'revolve':
      out.push(...sketchFields(nodes, node.sketch, ''));
      number('deg', 'Angle', '°', n => (n as typeof node).angle, (n, v) => ({ ...(n as typeof node), angle: v }));
      break;
    case 'sweep':
      out.push(...sketchFields(nodes, node.sketch, ''));
      node.path.forEach((st, k) => {
        const step = (n: ModelNode) => (n as typeof node).path[k], put = (n: ModelNode, s: typeof st) => ({ ...(n as typeof node), path: (n as typeof node).path.map((x, j) => j === k ? s : x) });
        if (st.kind === 'straight') number('run' + k, `Run ${k + 1}`, 'mm', n => num((step(n) as typeof st).length), (n, v) => put(n, { ...(step(n) as typeof st), length: v }));
        else {
          number('bend' + k, `Bend ${k + 1} radius`, 'mm', n => num((step(n) as typeof st).radius), (n, v) => put(n, { ...(step(n) as typeof st), radius: v }));
          number('bendAngle' + k, `Bend ${k + 1} angle`, '°', n => (step(n) as typeof st).angle, (n, v) => put(n, { ...(step(n) as typeof st), angle: v }));
          out.push({ kind: 'choice', key: 'toward' + k, label: `Bend ${k + 1} toward`, options: [{ value: 'x', label: '+X' }, { value: '-x', label: '−X' }, { value: 'y', label: '+Y' }, { value: '-y', label: '−Y' }],
            get: n => (self<typeof node>(n).path[k] as typeof st).toward, set: (n, v) => replace(n, i, put(self(n), { ...(self<typeof node>(n).path[k] as typeof st), toward: v as typeof st.toward })) });
        }
      });
      break;
    case 'loft':
      node.sections.forEach((sec, k) => {
        out.push(...sketchFields(nodes, sec.sketch, `Section ${k + 1} · `));
        if (!Object.hasOwn(sec, 'frame')) number('z' + k, `Section ${k + 1} · height`, 'mm', n => num((n as typeof node).sections[k].z), (n, v) => ({ ...(n as typeof node), sections: (n as typeof node).sections.map((x, j) => j === k && !Object.hasOwn(x, 'frame') && x.frame === undefined ? { ...x, z: v } : x) }));
      });
      if (node.sections.length >= 3) out.push({ kind: 'toggle', key: 'smooth', label: 'Smooth', get: n => !!self<typeof node>(n).smooth, set: (n, v) => replace(n, i, { ...self<typeof node>(n), smooth: v }) });
      break;
    case 'hole':
      number('dia', 'Diameter', 'mm', n => num((n as typeof node).radius) * 2, (n, v) => ({ ...(n as typeof node), radius: v / 2 }));
      [0, 1].forEach(k => number('c' + k, 'Centre ' + 'XY'[k], 'mm', n => num((n as typeof node).center[k]), (n, v) => { const c = [...(n as typeof node).center] as [Dim, Dim]; c[k] = v; return { ...(n as typeof node), center: c }; }));
      if (node.depth !== undefined) number('depth', 'Depth', 'mm', n => num((n as typeof node).depth), (n, v) => ({ ...(n as typeof node), depth: v }));
      if (node.countersink !== undefined) number('csk', 'Countersink Ø', 'mm', n => (n as typeof node).countersink ?? 0, (n, v) => ({ ...(n as typeof node), countersink: v }));
      if (node.pattern) number('count', 'Copies', undefined, n => (n as typeof node).pattern?.count ?? 1, (n, v) => ({ ...(n as typeof node), pattern: { ...(n as typeof node).pattern!, count: Math.max(1, Math.round(v)) } }));
      break;
    case 'fillet':
      // (A varying radius: its two ends' radii, D100.)
      if (node.radii) {
        const k = (n: ModelNode) => n as typeof node, last = node.radii.length - 1;
        number('r', 'Start radius', 'mm', n => num(k(n).radii![0].radius), (n, v) => ({ ...k(n), radius: v, radii: k(n).radii!.map((p, i) => i === 0 ? { ...p, radius: v } : p) }));
        number('r1', 'End radius', 'mm', n => num(k(n).radii![last].radius), (n, v) => ({ ...k(n), radii: k(n).radii!.map((p, i) => i === last ? { ...p, radius: v } : p) }));
      } else number('r', 'Radius', 'mm', n => num((n as typeof node).radius), (n, v) => ({ ...(n as typeof node), radius: v }));
      // (A conic's rho, a G2 section's tension, R10.5b, D103.)
      if (node.section?.kind === 'conic') number('rho', 'Rho', undefined, n => ((n as typeof node).section as { rho: number }).rho, (n, v) => ({ ...(n as typeof node), section: { kind: 'conic', rho: v } }));
      if (node.section?.kind === 'g2') number('tension', 'Tension', undefined, n => ((n as typeof node).section as { tension?: number }).tension ?? 0.5, (n, v) => ({ ...(n as typeof node), section: { kind: 'g2', tension: v } }));
      break;
    case 'face-fillet': number('r', 'Radius', 'mm', n => num((n as typeof node).radius), (n, v) => ({ ...(n as typeof node), radius: v })); break;
    case 'chamfer': number('d', 'Distance', 'mm', n => num((n as typeof node).distance), (n, v) => ({ ...(n as typeof node), distance: v })); break;
    case 'rack': {
      const k = (n: ModelNode) => n as typeof node;
      number('m', 'Module', 'mm', n => num(k(n).module), (n, v) => ({ ...k(n), module: v }));
      number('z', 'Teeth', undefined, n => k(n).teeth, (n, v) => ({ ...k(n), teeth: Math.round(v) }));
      number('b', 'Face width', 'mm', n => num(k(n).faceWidth), (n, v) => ({ ...k(n), faceWidth: v }));
      number('h', 'Height', 'mm', n => num(k(n).height), (n, v) => ({ ...k(n), height: v }));
      number('ds', 'Thinner by', 'mm', n => num(k(n).thicknessReduction ?? 0), (n, v) => ({ ...k(n), thicknessReduction: v }));
      // The root (R12b.1b, D131): the basic rack's root fillet (spur-rack@1) or the schematic corner (@0).
      out.push({ kind: 'choice', key: 'root', label: 'Root', options: [{ value: 'spur-rack@1', label: 'Filleted (the basic rack)' }, { value: 'spur-rack@0', label: 'Schematic' }], get: n => self<typeof node>(n).generator,
        set: (n, v) => { const next = { ...self<typeof node>(n), generator: v as 'spur-rack@0' | 'spur-rack@1' }; if (v !== 'spur-rack@1') delete next.rootFillet; return replace(n, i, next); } });
      if (node.generator === 'spur-rack@1') number('rf', 'Root fillet', 'mm', n => num(k(n).rootFillet ?? 0.38 * num(k(n).module)), (n, v) => { const next = { ...k(n) }; if (Math.abs(v - 0.38 * num(next.module)) < 1e-12) delete next.rootFillet; else next.rootFillet = v; return next; });
      if (!node.mesh) number('ang', 'Angle', '°', n => k(n).angle ?? 0, (n, v) => ({ ...k(n), angle: v }));
      else {
        number('dir', 'Direction', '°', n => k(n).mesh!.direction ?? -90, (n, v) => ({ ...k(n), mesh: { ...k(n).mesh!, direction: v } }));
        number('ph', 'Slide', 'mm', n => num(k(n).mesh!.phase ?? 0), (n, v) => ({ ...k(n), mesh: { ...k(n).mesh!, phase: v } }));
      }
      break;
    }
    case 'internal-gear': {
      // (R12b.2a, D132.)
      const g = (n: ModelNode) => n as typeof node;
      number('m', node.helixAngle ? 'Normal module' : 'Module', 'mm', n => num(g(n).module), (n, v) => ({ ...g(n), module: v }));
      number('helix', 'Helix angle β', '°', n => g(n).helixAngle ?? 0, (n, v) => { const next = { ...g(n) }; if (v) { next.helixAngle = v; next.hand ??= 'right'; } else { delete next.helixAngle; delete next.hand; } return next; });
      if (node.helixAngle) out.push({ kind: 'choice', key: 'hand', label: 'Hand', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }], get: n => self<typeof node>(n).hand ?? 'right', set: (n, v) => replace(n, i, { ...self<typeof node>(n), hand: v as 'right' | 'left' }) });
      number('z', 'Teeth', undefined, n => g(n).teeth, (n, v) => ({ ...g(n), teeth: Math.round(v) }));
      number('b', 'Face width', 'mm', n => num(g(n).faceWidth), (n, v) => ({ ...g(n), faceWidth: v }));
      number('rim', 'Rim Ø', 'mm', n => num(g(n).rim), (n, v) => ({ ...g(n), rim: v }));
      // (A shift given here is the user's own: the default's flag goes.)
      number('shift', 'Profile shift x', undefined, n => g(n).profileShift ?? 0, (n, v) => { const next = { ...g(n) }; delete next.shiftDefault; if (v) next.profileShift = v; else delete next.profileShift; return next; });
      number('ds', 'Thinner by', 'mm', n => num(g(n).thicknessReduction ?? 0), (n, v) => ({ ...g(n), thicknessReduction: v }));
      number('rot', 'Rotation', '°', n => g(n).rotation ?? 0, (n, v) => ({ ...g(n), rotation: v }));
      // The root (R12b.2b, D133): the one a pinion-type cutter cuts (internal-gear@1) or the schematic one; a straight ring's choice.
      if (!node.helixAngle) {
        out.push({ kind: 'choice', key: 'root', label: 'Root', options: [{ value: 'internal-gear@1', label: 'Cut by a pinion-type cutter' }, { value: 'internal-gear@0', label: 'Schematic' }], get: n => self<typeof node>(n).generator,
          set: (n, v) => { const next = { ...self<typeof node>(n), generator: v as 'internal-gear@0' | 'internal-gear@1' }; if (v === 'internal-gear@1') next.cutter ??= { teeth: 24 }; else delete next.cutter; return replace(n, i, next); } });
        if (node.cutter) {
          number('cz', 'Cutter teeth', undefined, n => g(n).cutter?.teeth ?? 24, (n, v) => ({ ...g(n), cutter: { ...g(n).cutter!, teeth: Math.round(v) } }));
          number('cx', 'Cutter shift x0', undefined, n => g(n).cutter?.shift ?? 0, (n, v) => { const c = { ...g(n).cutter! }; if (v) c.shift = v; else delete c.shift; return { ...g(n), cutter: c }; });
          number('cr', 'Cutter tip radius (0: the estimate)', 'mm', n => num(g(n).cutter?.tipRadius ?? 0), (n, v) => { const c = { ...g(n).cutter! }; if (v) c.tipRadius = v; else delete c.tipRadius; return { ...g(n), cutter: c }; });
        }
      }
      break;
    }
    case 'bearing': {
      const value = (ns: Nodes) => { const n = ns[i] as Extract<ModelNode, { kind: 'bearing' }>; return n.housingRef ? bearingHousingValue(n.housingRef) : n.housing === undefined ? 'none' : String(n.housing); };
      const options = bearingHousingOptions(nodes.slice(0, i), bearingAssembly, bearingAssembly ? undefined : scope?.context), current = value(nodes);
      if (!options.some(o => o.value === current)) options.push({ value: current, label: `Current housing: ${current}` });
      out.push({ kind: 'choice', key: 'housing', label: 'Housing', options, get: value, set: (ns, v) => {
        const n = { ...ns[i] } as Extract<ModelNode, { kind: 'bearing' }>; delete n.housing; delete n.housingRef;
        return replace(ns, i, { ...n, ...bearingHousingPatch(v) });
      } });
      const own = bearingAssembly?.owner === 'base' ? bearingAssembly.root : bearingAssembly?.root.instances?.find(p => p.id === bearingAssembly.owner)?.doc;
      const classes = [...new Set([...(bearingAssembly?.root.fits?.tables ?? []), ...(own?.fits?.tables ?? []), ...(scope?.fits?.tables ?? [])].flatMap(t => t.rows.map(r => r.class)))];
      for (const [key, label, capital] of [['shaftClass', 'Shaft seat class', false], ['housingClass', 'Housing seat class', true]] as const) {
        const current = (node as Extract<ModelNode, { kind: 'bearing' }>)[key], choices = [{ value: 'none', label: 'None' }, ...classes.filter(c => capital ? /^[A-Z]/.test(c) : /^[a-z]/.test(c)).map(c => ({ value: c, label: c }))];
        if (current && !choices.some(c => c.value === current)) choices.push({ value: current, label: current });
        out.push({ kind: 'choice', key, label, options: choices, get: ns => (ns[i] as Extract<ModelNode, { kind: 'bearing' }>)[key] ?? 'none', set: (ns, value) => {
          const next = { ...ns[i] } as Extract<ModelNode, { kind: 'bearing' }>; if (value === 'none') delete next[key]; else next[key] = value;
          return replace(ns, i, next);
        } });
      }
      break;
    }
    case 'shaft': {
      // (R12c.3a, D156: each step's diameter and length; the shoulders' fillets and the chamfers together; the keyseats' and grooves' sizes.)
      const g = (n: ModelNode) => n as typeof node;
      node.steps.forEach((_, k) => {
        const step = (n: ModelNode, patch: Partial<typeof node.steps[number]>) => ({ ...g(n), steps: g(n).steps.map((s, j) => j === k ? { ...s, ...patch } : s) });
        number(`d${k + 1}`, `Step ${k + 1} Ø`, 'mm', n => num(g(n).steps[k].diameter), (n, v) => step(n, { diameter: v }));
        number(`l${k + 1}`, `Step ${k + 1} length`, 'mm', n => num(g(n).steps[k].length), (n, v) => step(n, { length: v }));
        node.steps[k].keyseats?.forEach((_, j) => {
          const seat = (n: ModelNode, patch: Record<string, number>) => step(n, { keyseats: g(n).steps[k].keyseats!.map((x, i) => i === j ? { ...x, ...patch } : x) });
          number(`k${k + 1}.${j + 1}b`, `Keyseat (step ${k + 1}) width`, 'mm', n => g(n).steps[k].keyseats![j].width, (n, v) => seat(n, { width: v }));
          number(`k${k + 1}.${j + 1}t`, `Keyseat (step ${k + 1}) depth`, 'mm', n => g(n).steps[k].keyseats![j].depth, (n, v) => seat(n, { depth: v }));
          number(`k${k + 1}.${j + 1}l`, `Keyseat (step ${k + 1}) length`, 'mm', n => g(n).steps[k].keyseats![j].length, (n, v) => seat(n, { length: v }));
        });
        node.steps[k].grooves?.forEach((_, j) => {
          const groove = (n: ModelNode, patch: Record<string, number>) => step(n, { grooves: g(n).steps[k].grooves!.map((x, i) => i === j ? { ...x, ...patch } : x) });
          number(`g${k + 1}.${j + 1}d`, `Groove (step ${k + 1}) Ø`, 'mm', n => g(n).steps[k].grooves![j].diameter, (n, v) => groove(n, { diameter: v }));
          number(`g${k + 1}.${j + 1}w`, `Groove (step ${k + 1}) width`, 'mm', n => g(n).steps[k].grooves![j].width, (n, v) => groove(n, { width: v }));
        });
      });
      number('r', 'Shoulder fillets', 'mm', n => g(n).steps.find(s => s.fillet)?.fillet ?? 0, (n, v) => ({ ...g(n), steps: g(n).steps.map((s, j) => { const x = { ...s }; if (v > 0 && j < g(n).steps.length - 1) x.fillet = v; else delete x.fillet; return x; }) }));
      number('c', 'End chamfers', 'mm', n => g(n).chamfers?.[0] ?? 0, (n, v) => { const x = { ...g(n) }; if (v > 0) x.chamfers = [v, v]; else delete x.chamfers; return x; });
      number('rot', 'Rotation', '°', n => g(n).rotation ?? 0, (n, v) => ({ ...g(n), rotation: v }));
      break;
    }
    case 'sprocket': case 'pulley': case 'coupling': case 'belt': {
      // (R12c.6b, D161: the sizes the node holds; a belt's rounding of links.)
      const g = (n: ModelNode) => n as Record<string, unknown> & ModelNode, has = (k: string) => (node as Record<string, unknown>)[k] !== undefined;
      const keyed = (key: string, label: string, unit: 'mm' | '°' | undefined, k: string, drop = false) => number(key, label, unit, n => Number(g(n)[k] ?? 0), (n, v) => { const next = { ...g(n) }; if (drop && !(v > 0)) delete next[k]; else next[k] = v; return next as ModelNode; });
      if (node.kind === 'sprocket') { keyed('teeth', 'Teeth', undefined, 'teeth'); keyed('tip', 'Tip Ø', 'mm', 'tip'); keyed('w', 'Tooth width', 'mm', 'width'); }
      if (node.kind === 'pulley') { if (has('teeth')) keyed('teeth', 'Grooves (teeth)', undefined, 'teeth'); if (has('diameter')) keyed('d', 'Diameter', 'mm', 'diameter'); if (has('grooves')) keyed('n', 'Grooves', undefined, 'grooves'); if (has('width')) keyed('w', 'Face width', 'mm', 'width'); }
      if (node.kind === 'sprocket' || node.kind === 'pulley') keyed('bore', 'Bore Ø (0: none)', 'mm', 'bore', true);
      if (node.kind === 'belt') out.push({ kind: 'choice', key: 'links', label: 'Links (a chain)', options: [{ value: 'whole', label: 'Whole' }, { value: 'even', label: 'Even' }], get: n => self<typeof node>(n).rounding ?? 'whole', set: (n, v) => replace(n, i, { ...self<typeof node>(n), rounding: v as 'whole' | 'even' }) });
      if (node.kind !== 'belt') keyed('rot', 'Rotation', '°', 'rotation');
      break;
    }
    case 'cam': {
      // (R12c.6a, D160: the lift scales every position of the program alike; the laws and angles stay.)
      const g = (n: ModelNode) => n as typeof node, top = (n: ModelNode) => Math.max(...g(n).segments.map(x => x.to ?? 0));
      number('rb', 'Base circle radius', 'mm', n => g(n).base, (n, v) => ({ ...g(n), base: v }));
      if (node.follower === 'roller') number('rr', 'Roller radius', 'mm', n => g(n).roller ?? 0, (n, v) => ({ ...g(n), roller: v }));
      number('h', node.motion === 'oscillating' ? 'Swing' : 'Lift', node.motion === 'oscillating' ? '°' : 'mm', top, (n, v) => { const k = top(n) > 0 ? v / top(n) : 0; return { ...g(n), segments: g(n).segments.map(x => x.to === undefined ? x : { ...x, to: x.to * k }) }; });
      number('t', 'Thickness', 'mm', n => g(n).thickness, (n, v) => ({ ...g(n), thickness: v }));
      number('bore', 'Bore Ø (0: none)', 'mm', n => g(n).bore ?? 0, (n, v) => { const next = { ...g(n) }; if (v > 0) next.bore = v; else delete next.bore; return next; });
      number('rot', 'Rotation', '°', n => g(n).rotation ?? 0, (n, v) => ({ ...g(n), rotation: v }));
      break;
    }
    case 'spring': {
      // (R12c.1a, D153: a compression spring; editing G drops its estimate flag — the value is the user's then.)
      const g = (n: ModelNode) => n as typeof node;
      number('d', 'Wire Ø', 'mm', n => num(g(n).wire), (n, v) => ({ ...g(n), wire: v }));
      number('D', 'Mean coil Ø', 'mm', n => num(g(n).diameter), (n, v) => ({ ...g(n), diameter: v }));
      number('n', 'Active coils', undefined, n => g(n).activeCoils, (n, v) => ({ ...g(n), activeCoils: v }));
      if (node.type) {
        // (R12c.1b, D154: an extension or torsion spring is close-wound at pitch 0.)
        number('p', 'Pitch (0: close-wound)', 'mm', n => num(g(n).pitch ?? 0), (n, v) => { const next = { ...g(n) }; if (v > 0) next.pitch = v; else delete next.pitch; return next; });
        if (node.type === 'extension') {
          out.push({ kind: 'choice', key: 'hooks', label: 'Hooks', options: [{ value: 'machine-loop', label: 'Machine loops' }, { value: 'crossover', label: 'Crossover' }], get: n => self<typeof node>(n).hooks ?? 'machine-loop', set: (n, v) => replace(n, i, { ...self<typeof node>(n), hooks: v as 'machine-loop' | 'crossover' }) });
          number('Fi', 'Initial tension (N, yours)', undefined, n => g(n).initialTension ?? 0, (n, v) => { const next = { ...g(n) }; if (v > 0) next.initialTension = v; else delete next.initialTension; return next; });
        } else {
          number('L0', 'Start leg', 'mm', n => (g(n).legLengths ?? [20, 20])[0], (n, v) => ({ ...g(n), legLengths: [v, (g(n).legLengths ?? [20, 20])[1]] }));
          number('L1', 'End leg', 'mm', n => (g(n).legLengths ?? [20, 20])[1], (n, v) => ({ ...g(n), legLengths: [(g(n).legLengths ?? [20, 20])[0], v] }));
        }
      } else if (node.freeLength !== undefined) number('L0', 'Free length', 'mm', n => num(g(n).freeLength ?? 0), (n, v) => ({ ...g(n), freeLength: v }));
      else number('p', 'Pitch', 'mm', n => num(g(n).pitch ?? 0), (n, v) => ({ ...g(n), pitch: v }));
      if (!node.type) out.push({ kind: 'choice', key: 'ends', label: 'Ends', options: [{ value: 'closed-ground', label: 'Closed and ground' }, { value: 'closed', label: 'Closed' }, { value: 'open', label: 'Open' }], get: n => self<typeof node>(n).ends ?? 'closed-ground', set: (n, v) => replace(n, i, { ...self<typeof node>(n), ends: v as typeof node.ends }) });
      out.push({ kind: 'choice', key: 'hand', label: 'Hand', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }], get: n => self<typeof node>(n).hand, set: (n, v) => replace(n, i, { ...self<typeof node>(n), hand: v as 'right' | 'left' }) });
      if (node.type === 'torsion') {
        number('E', "Young's modulus E (MPa)", undefined, n => g(n).youngsModulus ?? 0, (n, v) => { const next = { ...g(n) }; delete next.youngsModulusEstimate; if (v > 0) next.youngsModulus = v; else delete next.youngsModulus; return next; });
        number('M', 'Working moment (N·mm)', undefined, n => g(n).moment ?? 0, (n, v) => { const next = { ...g(n) }; if (v > 0) next.moment = v; else delete next.moment; return next; });
      } else {
        number('G', 'Shear modulus G (MPa)', undefined, n => g(n).shearModulus ?? 0, (n, v) => { const next = { ...g(n) }; delete next.shearModulusEstimate; if (v > 0) next.shearModulus = v; else delete next.shearModulus; return next; });
        number('F', 'Working load (N)', undefined, n => g(n).load ?? 0, (n, v) => { const next = { ...g(n) }; if (v > 0) next.load = v; else delete next.load; return next; });
      }
      number('rot', 'Rotation', '°', n => g(n).rotation ?? 0, (n, v) => ({ ...g(n), rotation: v }));
      break;
    }
    case 'worm-wheel': {
      // (R12b.6, D137: the throated wheel and the worm it is cut for; its worm follows.)
      const g = (n: ModelNode) => n as typeof node;
      number('m', 'Axial module', 'mm', n => num(g(n).module), (n, v) => ({ ...g(n), module: v }));
      number('starts', 'Worm starts', undefined, n => g(n).starts, (n, v) => ({ ...g(n), starts: Math.max(1, Math.min(4, Math.round(v))) }));
      number('d1', 'Worm reference Ø', 'mm', n => num(g(n).diameter), (n, v) => ({ ...g(n), diameter: v }));
      out.push({ kind: 'choice', key: 'hand', label: 'Hand', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }], get: n => self<typeof node>(n).hand, set: (n, v) => replace(n, i, { ...self<typeof node>(n), hand: v as 'right' | 'left' }) });
      number('z', 'Teeth', undefined, n => g(n).teeth, (n, v) => ({ ...g(n), teeth: Math.round(v) }));
      number('b', 'Face width', 'mm', n => num(g(n).faceWidth), (n, v) => ({ ...g(n), faceWidth: v }));
      number('bore', 'Bore', 'mm', n => num(g(n).bore ?? 0), (n, v) => ({ ...g(n), bore: v }));
      number('ds', 'Spaces wider by', 'mm', n => num(g(n).thicknessReduction ?? 0), (n, v) => ({ ...g(n), thicknessReduction: v }));
      number('rot', 'Rotation', '°', n => g(n).rotation ?? 0, (n, v) => ({ ...g(n), rotation: v }));
      break;
    }
    case 'worm': {
      // (R12b.5, D136: its module, diameter and hand are the wheel's — edit the wheel; its own here.)
      const g = (n: ModelNode) => n as typeof node;
      number('starts', 'Starts', undefined, n => g(n).starts, (n, v) => ({ ...g(n), starts: Math.max(1, Math.min(4, Math.round(v))) }));
      out.push({ kind: 'choice', key: 'form', label: 'Worm form', options: [{ value: 'ZI', label: 'ZI (involute helicoid)' }, { value: 'ZA', label: 'ZA (straight axial sides)' }], get: n => self<typeof node>(n).form, set: (n, v) => replace(n, i, { ...self<typeof node>(n), form: v as 'ZI' | 'ZA' }) });
      number('L', 'Length', 'mm', n => num(g(n).length), (n, v) => ({ ...g(n), length: v }));
      number('bore', 'Bore', 'mm', n => num(g(n).bore ?? 0), (n, v) => ({ ...g(n), bore: v }));
      number('ds', 'Thinner by (axial)', 'mm', n => num(g(n).thicknessReduction ?? 0), (n, v) => ({ ...g(n), thicknessReduction: v }));
      number('dir', 'Direction', '°', n => g(n).mesh.direction ?? 0, (n, v) => ({ ...g(n), mesh: { ...g(n).mesh, direction: v } }));
      number('ph', 'Phase', '°', n => g(n).mesh.phase ?? 0, (n, v) => ({ ...g(n), mesh: { ...g(n).mesh, phase: v } }));
      break;
    }
    case 'bevel-gear': {
      // (R12b.3, D134. A meshing gear's module, teeth, mate and shaft angle are its driver's: only its own here.)
      const g = (n: ModelNode) => n as typeof node;
      if (!node.mesh) {
        number('m', 'Module (heel)', 'mm', n => num(g(n).module), (n, v) => ({ ...g(n), module: v }));
        number('z', 'Teeth', undefined, n => g(n).teeth, (n, v) => ({ ...g(n), teeth: Math.round(v) }));
        number('zm', 'Mate\'s teeth', undefined, n => g(n).mateTeeth, (n, v) => ({ ...g(n), mateTeeth: Math.round(v) }));
        number('sigma', 'Shaft angle Σ', '°', n => g(n).shaftAngle ?? 90, (n, v) => { const next = { ...g(n) }; if (v === 90) delete next.shaftAngle; else next.shaftAngle = v; return next; });
        // (R12b.4, D135: the spiral — 0 straight; a cutter radius given is the user's own, the estimate's flag goes.)
        number('beta', 'Spiral angle β', '°', n => g(n).spiral?.angle ?? 0, (n, v) => { const next = { ...g(n) }; if (v > 0) next.spiral = { hand: 'left', cutterRadius: meanConeDistance(next), cutterEstimate: true, ...next.spiral, angle: v }; else delete next.spiral; return next; });
        if (node.spiral) {
          out.push({ kind: 'choice', key: 'hand', label: 'Hand', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }], get: n => self<typeof node>(n).spiral?.hand ?? 'left', set: (n, v) => replace(n, i, { ...self<typeof node>(n), spiral: { ...self<typeof node>(n).spiral!, hand: v as 'right' | 'left' } }) });
          number('rc', 'Cutter radius', 'mm', n => num(g(n).spiral!.cutterRadius), (n, v) => { const s = { ...g(n).spiral!, cutterRadius: v }; delete s.cutterEstimate; return { ...g(n), spiral: s }; });
        }
      }
      number('b', 'Face width', 'mm', n => num(g(n).faceWidth), (n, v) => ({ ...g(n), faceWidth: v }));
      number('bore', 'Bore', 'mm', n => num(g(n).bore ?? 0), (n, v) => ({ ...g(n), bore: v }));
      number('ds', 'Thinner by', 'mm', n => num(g(n).thicknessReduction ?? 0), (n, v) => ({ ...g(n), thicknessReduction: v }));
      if (!node.mesh) number('rot', 'Rotation', '°', n => g(n).rotation ?? 0, (n, v) => ({ ...g(n), rotation: v }));
      else {
        number('dir', 'Direction', '°', n => g(n).mesh!.direction ?? 0, (n, v) => ({ ...g(n), mesh: { ...g(n).mesh!, direction: v } }));
        number('ph', 'Phase', '°', n => g(n).mesh!.phase ?? 0, (n, v) => ({ ...g(n), mesh: { ...g(n).mesh!, phase: v } }));
      }
      break;
    }
    case 'gear': {
      const g = (n: ModelNode) => n as typeof node, helix = helixOf(node, nodes);
      number('m', helix ? 'Normal module' : 'Module', 'mm', n => num(g(n).module), (n, v) => ({ ...g(n), module: v }));
      // A helical gear's helix angle and hand (a meshing gear takes the other's, opposite hand).
      if (!node.mesh) {
        number('helix', 'Helix angle β', '°', n => g(n).helixAngle ?? 0, (n, v) => { const next = { ...g(n) }; if (v) { next.helixAngle = v; next.hand ??= 'right'; } else { delete next.helixAngle; delete next.hand; } return next; });
        if (node.helixAngle) out.push({ kind: 'choice', key: 'hand', label: 'Hand', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }], get: n => self<typeof node>(n).hand ?? 'right', set: (n, v) => replace(n, i, { ...self<typeof node>(n), hand: v as 'right' | 'left' }) });
      }
      number('z', 'Teeth', undefined, n => g(n).teeth, (n, v) => ({ ...g(n), teeth: Math.round(v) }));
      number('b', 'Face width', 'mm', n => num(g(n).faceWidth), (n, v) => ({ ...g(n), faceWidth: v }));
      number('shift', 'Profile shift x', undefined, n => g(n).profileShift ?? 0, (n, v) => { const next = { ...g(n) }; if (v) next.profileShift = v; else delete next.profileShift; return next; });
      number('bore', 'Bore', 'mm', n => num(g(n).bore ?? 0), (n, v) => ({ ...g(n), bore: v }));
      number('ds', 'Thinner by', 'mm', n => num(g(n).thicknessReduction ?? 0), (n, v) => ({ ...g(n), thicknessReduction: v }));
      // The root (R12b.1a, D130; helical too, R12b.1b, D131): the one the basic rack cuts (spur-gear@1) or the schematic one (@0).
      {
        out.push({ kind: 'choice', key: 'root', label: 'Root', options: [{ value: 'spur-gear@1', label: 'Cut by the rack' }, { value: 'spur-gear@0', label: 'Schematic' }], get: n => self<typeof node>(n).generator,
          set: (n, v) => { const next = { ...self<typeof node>(n), generator: v as 'spur-gear@0' | 'spur-gear@1' }; if (v !== 'spur-gear@1') delete next.toolTipRadius; return replace(n, i, next); } });
        if (node.generator === 'spur-gear@1') number('rho', 'Tool tip radius', 'mm', n => num(g(n).toolTipRadius ?? 0.38 * num(g(n).module)), (n, v) => { const next = { ...g(n) }; if (Math.abs(v - 0.38 * num(next.module)) < 1e-12) delete next.toolTipRadius; else next.toolTipRadius = v; return next; });
      }
      // Its turn (a meshing gear: where it stands beside the other gear, and its phase; its turn follows the other's).
      if (!node.mesh) number('rot', 'Rotation', '°', n => g(n).rotation ?? 0, (n, v) => ({ ...g(n), rotation: v }));
      else {
        const other = nodes[node.mesh.gear], nominal = (n: ModelNode) => other?.kind === 'gear' ? meshDistance(other, g(n), nodes) : other?.kind === 'internal-gear' ? insideDistance(other, g(n), nodes) : 0;
        number('dir', 'Direction', '°', n => g(n).mesh!.direction ?? 0, (n, v) => ({ ...g(n), mesh: { ...g(n).mesh!, direction: v } }));
        number('a', 'Centre distance', 'mm', n => num(g(n).mesh!.centerDistance ?? nominal(n)), (n, v) => { const mesh = { ...g(n).mesh! }; if (Math.abs(v - nominal(n)) < 1e-9) delete mesh.centerDistance; else mesh.centerDistance = v; return { ...g(n), mesh }; });
        number('ph', 'Phase', '°', n => g(n).mesh!.phase ?? 0, (n, v) => ({ ...g(n), mesh: { ...g(n).mesh!, phase: v } }));
      }
      break;
    }
    case 'sheet-base': case 'sheet-contour': {
      // (R12.1, D116: the sheet's rules; a profile's width too.)
      type S = Extract<ModelNode, { kind: 'sheet-base' | 'sheet-contour' }>;
      if (node.kind === 'sheet-base') out.push(...sketchFields(nodes, node.sketch, ''));
      number('t', 'Thickness', 'mm', n => num((n as S).thickness), (n, v) => ({ ...(n as S), thickness: v }));
      number('r', 'Bend radius', 'mm', n => num((n as S).bendRadius), (n, v) => ({ ...(n as S), bendRadius: v }));
      // (A bend table instead of one K: no K field; R12.4.)
      if (node.kFactor !== undefined) number('k', 'K-factor', undefined, n => (n as S).kFactor!, (n, v) => ({ ...(n as S), kFactor: v }) as S);
      if (node.kind === 'sheet-contour') number('w', 'Width', 'mm', n => num((n as Extract<ModelNode, { kind: 'sheet-contour' }>).width), (n, v) => ({ ...(n as Extract<ModelNode, { kind: 'sheet-contour' }>), width: v }));
      break;
    }
    case 'frame': {
      // (FR2, D124: the frame's section — editing one drops its estimate flag — its roll, and each skeleton point.)
      type F = Extract<ModelNode, { kind: 'frame' }>;
      if (node.section.kind !== 'sketch') for (const key of [...new Set([...Object.keys(node.section), ...(node.section.kind === 'channel' ? ['toeRadius', 'flangeSlope'] : [])])].filter(k => k !== 'kind' && k !== 'cells' && k !== 'openSlots')) {
        number('s.' + key, MEMBER_FIELD_LABELS[key] ?? key, key === 'flangeSlope' ? undefined : 'mm', n => num(((n as F).section as unknown as Record<string, Dim>)[key] ?? 0), (n, v) => {
          const f = n as F, estimates = f.estimates?.filter(e => e !== key);
          const next: F = { ...f, section: { ...f.section, [key]: v } as F['section'] };
          if (estimates?.length) next.estimates = estimates; else delete next.estimates;
          return next;
        });
      }
      number('roll', 'Roll', '°', n => (n as F).roll ?? 0, (n, v) => { const f = { ...(n as F) }; if (v) f.roll = v; else delete f.roll; return f; });
      // (FR3a, D125: how two members meeting at a point are finished — all of them, then each such point set apart.)
      out.push({ kind: 'choice', key: 'corners', label: 'Corners', options: [{ value: 'mitre', label: 'Mitre' }, { value: 'butt', label: 'Butt' }, { value: 'none', label: 'None (overlap)' }],
        get: n => { const c = self<F>(n).corners; return c ? c.default ?? 'mitre' : 'none'; },
        set: (n, v) => { const f = self<F>(n); return replace(n, i, { ...f, corners: { ...f.corners, default: v as 'mitre' | 'butt' | 'none' } }); } });
      // (FR3b, D126: joints of three or more, and T-joints, for the whole frame.)
      out.push({ kind: 'choice', key: 'multi', label: 'Three or more members', options: [{ value: 'order', label: 'Ordered trim' }, { value: 'none', label: 'None (overlap)' }],
        get: n => self<F>(n).corners?.multi ?? 'none', set: (n, v) => { const f = self<F>(n); return replace(n, i, { ...f, corners: { ...f.corners, multi: v as 'order' | 'none' } }); } });
      out.push({ kind: 'choice', key: 'tee', label: 'T-joints', options: [{ value: 'butt', label: 'Butt' }, { value: 'cope', label: 'Cope' }, { value: 'none', label: 'None (overlap)' }],
        get: n => self<F>(n).corners?.tee ?? 'none', set: (n, v) => { const f = self<F>(n); return replace(n, i, { ...f, corners: { ...f.corners, tee: v as 'butt' | 'cope' | 'none' } }); } });
      number('gap', 'Weld end gap', 'mm', n => num((n as F).corners?.gap ?? 0), (n, v) => {
        const f = n as F; return { ...f, corners: { ...f.corners, gap: v } };
      });
      // (FRf, O121: a frame that follows has its source's points: corners by them; its points are edited at the source.)
      const geo = frameGeometry(nodes, node), gp = 'points' in geo ? geo.points : node.points, gs = 'segments' in geo ? geo.segments : node.segments;
      gp.forEach((_, p) => {
        const meet = gs.flatMap((g, k) => (Array.isArray(g) ? g[0] === p || g[1] === p : 'from' in g && (g.from === p || g.to === p)) ? [k] : []);
        if (!meet.length || meet.length > 2) return;
        const through = meet.length === 2 ? meet : gs.map((_, k) => k).filter(k => !meet.includes(k));
        const options = [{ value: 'default', label: 'As the frame' }, { value: 'mitre', label: 'Mitre' }, ...through.map(k => ({ value: `butt:${k}`, label: `Butt, member ${k + 1} through` })), ...through.map(k => ({ value: `cope:${k}`, label: `Cope, member ${k + 1} through` })), { value: 'none', label: 'None (overlap)' }];
        out.push({ kind: 'choice', key: `corner${p}`, label: `Corner at point ${p + 1}`, options,
          get: n => { const e = self<F>(n).corners?.at?.find(x => x.point === p); return !e ? 'default' : e.kind === 'butt' || e.kind === 'cope' ? `${e.kind}:${e.through ?? through[0]}` : e.kind; },
          set: (n, v) => {
            const f = self<F>(n), rest = (f.corners?.at ?? []).filter(x => x.point !== p);
            const old = f.corners?.at?.find(x => x.point === p), kept = old?.gap !== undefined ? { gap: old.gap } : {};
            const entry = v === 'default' ? [] : v.startsWith('butt:') || v.startsWith('cope:') ? [{ point: p, kind: v.slice(0, 4) as 'butt' | 'cope', through: Number(v.slice(5)), ...kept, ...(v.startsWith('cope:') && old?.notch ? { notch: old.notch } : {}) }] : [{ point: p, kind: v as 'mitre' | 'none', ...kept }];
            const at = [...rest, ...entry], corners = { ...(f.corners ?? {}), ...(at.length ? { at } : {}) };
            if (!at.length) delete corners.at;
            return replace(n, i, { ...f, corners });
          } });
        type Entry = NonNullable<FrameCorners['at']>[number];
        const entryOf = (f: F): Entry => f.corners?.at?.find(x => x.point === p) ?? { point: p, kind: meet.length === 2 ? f.corners?.default ?? 'mitre' : f.corners?.tee ?? 'none' };
        const put = (f: F, entry: Entry): F => ({ ...f, corners: { ...f.corners, at: [...(f.corners?.at ?? []).filter(x => x.point !== p), entry] } });
        number(`corner${p}.gap`, `Point ${p + 1} weld gap`, 'mm', n => num(entryOf(n as F).gap ?? (n as F).corners?.gap ?? 0), (n, v) => put(n as F, { ...entryOf(n as F), gap: v }));
        out.push({ kind: 'choice', key: `corner${p}.notch`, label: `Point ${p + 1} notch`, options: [{ value: 'none', label: 'None' }, { value: 'holesaw', label: 'Hole saw' }, { value: 'v', label: 'V notch' }],
          get: n => entryOf(self<F>(n)).notch?.kind ?? 'none', set: (n, v) => {
            const f = self<F>(n), entry = { ...entryOf(f) };
            if (v === 'none') delete entry.notch;
            else {
              entry.kind = 'cope'; entry.through ??= through[0];
              if (v === 'holesaw') entry.notch = { kind: 'holesaw', diameter: 50, offset: 0 };
              else if (v === 'v') entry.notch = { kind: 'v', depth: 10, angle: 90 };
              else return [...n];
            }
            return replace(n, i, put(f, entry));
          } });
        const notch = entryOf(node).notch;
        const cutterField = (key: string, label: string, unit: 'mm' | '°', field: 'diameter' | 'offset' | 'depth' | 'angle') => number(`corner${p}.${key}`, `Point ${p + 1} ${label}`, unit, n => {
          const cut = entryOf(n as F).notch; return cut ? num((cut as unknown as Record<string, Dim>)[field] ?? 0) : NaN;
        }, (n, v) => {
          const f = n as F, e = entryOf(f); return e.notch ? put(f, { ...e, notch: { ...e.notch, [field]: v } as FrameNotch }) : f;
        });
        if (notch?.kind === 'holesaw') { cutterField('notchDiameter', 'hole saw diameter', 'mm', 'diameter'); cutterField('notchOffset', 'hole saw offset', 'mm', 'offset'); }
        if (notch?.kind === 'v') { cutterField('notchDepth', 'V depth', 'mm', 'depth'); cutterField('notchAngle', 'V included angle', '°', 'angle'); }
      });
      if (!node.follows) node.segments.forEach((g, segment) => {
        if (Array.isArray(g) || !('center' in g)) return;
        (['X', 'Y', 'Z'] as const).forEach((axis, c) => number(`arc${segment}.center.${axis.toLowerCase()}`, `Arc ${segment + 1} center ${axis}`, 'mm', n => {
          const arc = (n as F).segments[segment]; return !Array.isArray(arc) && 'center' in arc ? num(arc.center[c]) : NaN;
        }, (n, v) => {
          const f = n as F, segments = f.segments.map((arc, j) => j === segment && !Array.isArray(arc) && 'center' in arc ? { ...arc, center: arc.center.map((x, k) => k === c ? v : x) as typeof arc.center } : arc);
          return { ...f, segments };
        }));
      });
      node.bends?.forEach((_, bend) => number(`bend${bend}.radius`, `Bend ${bend + 1} radius`, 'mm', n => num((n as F).bends![bend].radius), (n, v) => {
        const f = n as F; return { ...f, bends: f.bends!.map((b, j) => j === bend ? { ...b, radius: v } : b) };
      }));
      if (!node.follows) node.points.forEach((_, p) => (['X', 'Y', 'Z'] as const).forEach((axis, c) => number(`p${p}.${axis.toLowerCase()}`, `Point ${p + 1} ${axis}`, 'mm', n => num((n as F).points[p][c]), (n, v) => {
        const f = n as F, points = f.points.map((q, j) => j === p ? q.map((x, k) => k === c ? v : x) as F['points'][number] : q);
        return { ...f, points };
      })));
      break;
    }
    case 'skeleton': {
      // (FRf, O121: a skeleton's points — every frame on it follows.)
      type S = Extract<ModelNode, { kind: 'skeleton' }>;
      node.points.forEach((_, p) => (['X', 'Y', 'Z'] as const).forEach((axis, c) => number(`p${p}.${axis.toLowerCase()}`, `Point ${p + 1} ${axis}`, 'mm', n => num((n as S).points[p][c]), (n, v) => {
        const f = n as S, points = f.points.map((q, j) => j === p ? q.map((x, k) => k === c ? v : x) as S['points'][number] : q);
        return { ...f, points };
      })));
      break;
    }
    case 'frame-member': {
      // (FR1, D123: the section's dimensions — editing one drops its estimate flag — the member's length along its line, its roll.)
      type M = Extract<ModelNode, { kind: 'frame-member' }>;
      const sec = node.section;
      if (sec.kind !== 'sketch') for (const key of [...new Set([...Object.keys(sec), ...(sec.kind === 'channel' ? ['toeRadius', 'flangeSlope'] : [])])].filter(k => k !== 'kind' && k !== 'cells' && k !== 'openSlots')) {
        number('s.' + key, MEMBER_FIELD_LABELS[key] ?? key, key === 'flangeSlope' ? undefined : 'mm', n => num(((n as M).section as unknown as Record<string, Dim>)[key] ?? 0), (n, v) => {
          const m = n as M, estimates = m.estimates?.filter(e => e !== key);
          const next: M = { ...m, section: { ...m.section, [key]: v } as M['section'] };
          if (estimates?.length) next.estimates = estimates; else delete next.estimates;
          return next;
        });
      }
      if ([...node.start, ...node.end].every(v => typeof v === 'number')) number('len', 'Length', 'mm', n => { const m = n as M, [a, b] = [m.start as number[], m.end as number[]]; return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }, (n, v) => {
        const m = n as M, a = m.start as number[], b = m.end as number[], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        return { ...m, end: [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * v / L) as [number, number, number] };
      });
      number('roll', 'Roll', '°', n => (n as M).roll ?? 0, (n, v) => { const m = { ...(n as M) }; if (v) m.roll = v; else delete m.roll; return m; });
      break;
    }
    case 'sheet-corner-relief': number('size', 'Size', 'mm', n => num((n as Extract<ModelNode, { kind: 'sheet-corner-relief' }>).size), (n, v) => ({ ...(n as Extract<ModelNode, { kind: 'sheet-corner-relief' }>), size: v })); break;
    case 'sheet-flange': {
      // (R12.3, D118: its length, angle, own radius and offsets.)
      type F = Extract<ModelNode, { kind: 'sheet-flange' }>;
      number('length', 'Length', 'mm', n => num((n as F).length), (n, v) => ({ ...(n as F), length: v }));
      number('angle', 'Angle', '°', n => (n as F).angle ?? 90, (n, v) => ({ ...(n as F), angle: v }));
      if (node.offsets) [0, 1].forEach(k => number('o' + k, k ? 'Offset at end' : 'Offset at start', 'mm', n => num((n as F).offsets![k]), (n, v) => { const o = [...(n as F).offsets!] as [Dim, Dim]; o[k] = v; return { ...(n as F), offsets: o }; }));
      break;
    }
    case 'thicken': number('t', 'Thickness', 'mm', n => num((n as typeof node).thickness), (n, v) => ({ ...(n as typeof node), thickness: v })); break;
    case 'sew': number('tol', 'Tolerance', 'mm', n => (n as typeof node).tolerance ?? 0, (n, v) => { const next = { ...(n as typeof node) }; if (v > 0) next.tolerance = Math.min(1, v); else delete next.tolerance; return next; }); break;
    case 'draft':
      number('deg', 'Angle', '°', n => (n as typeof node).angle, (n, v) => ({ ...(n as typeof node), angle: v }));
      if (node.neutral !== undefined) number('neutral', 'Neutral coordinate', 'mm', n => num((n as typeof node).neutral!), (n, v) => ({ ...(n as typeof node), neutral: v }));
      break;
    case 'decimate': {
      // (R9, D85: the keep as a per cent of the triangles; a bound or crease angle of 0 is none.)
      type D = Extract<ModelNode, { kind: 'decimate' }>;
      const without = (n: D, k: 'maxError' | 'featureAngle') => { const o = { ...n }; delete o[k]; return o; };
      number('keep', 'Keep', '%', n => +(100 * ((n as D).ratio ?? 0.25)).toPrecision(6), (n, v) => ({ ...(n as D), ratio: v / 100 }));
      number('maxError', 'Max error', 'mm', n => (n as D).maxError ?? 0, (n, v) => v > 0 ? { ...(n as D), maxError: v } : without(n as D, 'maxError'));
      number('crease', 'Crease angle', '°', n => (n as D).featureAngle ?? 0, (n, v) => v > 0 ? { ...(n as D), featureAngle: v } : without(n as D, 'featureAngle'));
      break;
    }
    case 'shell': number('t', 'Wall', 'mm', n => num((n as typeof node).thickness), (n, v) => ({ ...(n as typeof node), thickness: v })); break;
    case 'translate': [0, 1, 2].forEach(k => number('o' + k, 'Δ' + 'XYZ'[k], 'mm', n => num((n as typeof node).offset[k]), (n, v) => { const o = [...(n as typeof node).offset] as [Dim, Dim, Dim]; o[k] = v; return { ...(n as typeof node), offset: o }; })); break;
    case 'rotate':
      out.push({ kind: 'choice', key: 'axis', label: 'Axis', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis: v as Axis }) });
      number('deg', 'Angle', '°', n => (n as typeof node).angle, (n, v) => ({ ...(n as typeof node), angle: v }));
      if (node.pivot) [0, 1, 2].forEach(k => number('p' + k, 'Pivot ' + 'XYZ'[k], 'mm', n => num((n as typeof node).pivot![k]), (n, v) => { const p = [...(n as typeof node).pivot!] as [Dim, Dim, Dim]; p[k] = v; return { ...(n as typeof node), pivot: p }; }));
      break;
    case 'mirror':
      out.push({ kind: 'choice', key: 'plane', label: 'Plane', options: [{ value: 'yz', label: 'YZ' }, { value: 'xz', label: 'XZ' }, { value: 'xy', label: 'XY' }], get: n => self<typeof node>(n).plane, set: (n, v) => replace(n, i, { ...self<typeof node>(n), plane: v as typeof node.plane }) });
      break;
    case 'scale': number('k', 'Factor', undefined, n => (n as typeof node).factor, (n, v) => ({ ...(n as typeof node), factor: v })); break;
    case 'fill-feature-pattern':
      out.push({ kind: 'choice', key: 'region', label: 'Region snapshot', options: [{ value: '', label: 'Current region snapshot' }, ...eligibleFillPatternRegions({ nodes: [...nodes], parameters })], get: () => '', set: (n, v) => v === '' ? [...n] : replace(n, i, { ...self<typeof node>(n), region: fillRegionSnapshot({ nodes: [...n], parameters }, Number(v)) }) });
      [0, 1].forEach(k => number('anchor' + 'XY'[k], 'Reference ' + 'XY'[k], undefined, n => (n as typeof node).anchor[k], (n, v) => { const anchor = [...(n as typeof node).anchor] as [number, number]; anchor[k] = v; return { ...(n as typeof node), anchor }; }));
      number('spacing', 'X spacing', 'mm', n => num((n as typeof node).spacing), (n, v) => ({ ...(n as typeof node), spacing: v }));
      number('count', 'Columns', undefined, n => (n as typeof node).count, (n, v) => ({ ...(n as typeof node), count: v }));
      number('spacing2', 'Y spacing', 'mm', n => num((n as typeof node).spacing2), (n, v) => ({ ...(n as typeof node), spacing2: v }));
      number('count2', 'Rows', undefined, n => (n as typeof node).count2, (n, v) => ({ ...(n as typeof node), count2: v }));
      break;
    case 'curve-feature-pattern':
      out.push({ kind: 'choice', key: 'path', label: 'Path', options: [...('objectId' in node.path ? [] : [{ value: '', label: 'Inline path' }]), ...eligibleCurvePatternPaths(scope?.doc ?? {})], get: n => { const p = self<typeof node>(n).path; return 'objectId' in p ? p.objectId : ''; }, set: (n, v) => v === '' ? [...n] : replace(n, i, { ...self<typeof node>(n), path: { objectId: v } }) });
      number('spacing', 'Spacing', 'mm', n => num((n as typeof node).spacing), (n, v) => ({ ...(n as typeof node), spacing: v }));
      number('count', 'Count', undefined, n => (n as typeof node).count, (n, v) => ({ ...(n as typeof node), count: v }));
      break;
    case 'rectangular-feature-pattern':
      out.push({ kind: 'choice', key: 'axis', label: 'First direction', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis: v as Axis }) });
      number('spacing', 'First spacing', 'mm', n => num((n as typeof node).spacing), (n, v) => ({ ...(n as typeof node), spacing: v }));
      number('count', 'First count', undefined, n => (n as typeof node).count, (n, v) => ({ ...(n as typeof node), count: v }));
      out.push({ kind: 'choice', key: 'axis2', label: 'Second direction', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis2, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis2: v as Axis }) });
      number('spacing2', 'Second spacing', 'mm', n => num((n as typeof node).spacing2), (n, v) => ({ ...(n as typeof node), spacing2: v }));
      number('count2', 'Second count', undefined, n => (n as typeof node).count2, (n, v) => ({ ...(n as typeof node), count2: v }));
      break;
    case 'linear-feature-pattern':
      out.push({ kind: 'choice', key: 'axis', label: 'Direction', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis: v as Axis }) });
      number('spacing', 'Spacing', 'mm', n => num((n as typeof node).spacing), (n, v) => ({ ...(n as typeof node), spacing: v }));
      number('count', 'Count', undefined, n => (n as typeof node).count, (n, v) => ({ ...(n as typeof node), count: v }));
      break;
    case 'linear-pattern':
      out.push({ kind: 'choice', key: 'axis', label: 'Direction', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis: v as Axis }) });
      number('spacing', 'Spacing', 'mm', n => num((n as typeof node).spacing), (n, v) => ({ ...(n as typeof node), spacing: v }));
      number('count', 'Count', undefined, n => (n as typeof node).count, (n, v) => ({ ...(n as typeof node), count: Math.round(v) }));
      break;
    case 'circular-pattern':
      number('count', 'Count', undefined, n => (n as typeof node).count, (n, v) => ({ ...(n as typeof node), count: Math.round(v), ...((n as typeof node).axis === 'z' ? { angle: 360 / Math.max(1, Math.round(v)) } : {}) }));
      break;
    case 'split':
      if (node.normal) (['x', 'y', 'z'] as const).forEach((a, k) => number('n' + a, `Normal ${a.toUpperCase()}`, undefined, n => (n as typeof node).normal?.[k] ?? 0, (n, v) => { const was = (n as typeof node).normal ?? [0, 0, 0], next = was.map((c, j) => j === k ? v : c) as [number, number, number]; return { ...(n as typeof node), normal: next }; }));
      else out.push({ kind: 'choice', key: 'axis', label: 'Normal', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis: v as Axis }) });
      number('at', 'At', 'mm', n => num((n as typeof node).at), (n, v) => ({ ...(n as typeof node), at: v }));
      break;
  }
  return out;
}

/** The centre distance two gear nodes mesh at without backlash (the kernel's: shifted and helical pairs too); 0 when they do not mesh. */
/** A pinion's working distance inside a ring (R12b.2a). */
/** A bevel gear's mean cone distance R − b/2 (R12b.4: a spiral one's cutter radius by default, an estimate); 0 where the kernel refuses the gear. */
function meanConeDistance(b: Extract<ModelNode, { kind: 'bevel-gear' }>): number {
  try { const d = bevelGearDimensions({ module: num(b.module), teeth: b.teeth, mateTeeth: b.mateTeeth, shaftAngle: b.shaftAngle ?? 90, faceWidth: num(b.faceWidth) }); return +((d.Re + d.Ri) / 2).toFixed(3); } catch { return 0; }
}
function insideDistance(ring: Extract<ModelNode, { kind: 'internal-gear' }>, b: Extract<ModelNode, { kind: 'gear' }>, nodes: Nodes): number {
  try {
    const h = helixOf(b, nodes), m = num(ring.module), mod = h ? { normalModule: m, helixAngle: h.angle, hand: h.hand } : { module: m };
    return internalGearCenterDistance({ ...mod, teeth: b.teeth, faceWidth: num(b.faceWidth), ...(b.profileShift ? { profileShiftCoefficient: b.profileShift } : {}), ...(b.generator === 'spur-gear@1' ? { rootPolicy: 'generated' as const } : {}) },
      { ...(ring.helixAngle ? { normalModule: m, helixAngle: ring.helixAngle, hand: ring.hand ?? 'right' } : { module: m }), teeth: ring.teeth, faceWidth: num(ring.faceWidth), rimDiameter: num(ring.rim), ...(ring.profileShift ? { profileShiftCoefficient: ring.profileShift } : {}) });
  } catch { return 0; }
}
function meshDistance(a: Extract<ModelNode, { kind: 'gear' }>, b: Extract<ModelNode, { kind: 'gear' }>, nodes: Nodes): number {
  const spec = (n: Extract<ModelNode, { kind: 'gear' }>) => {
    const h = helixOf(n, nodes);
    return { ...(h ? { normalModule: num(n.module), helixAngle: h.angle, hand: h.hand } : { module: num(n.module) }), teeth: n.teeth, faceWidth: num(n.faceWidth), ...(n.profileShift ? { profileShiftCoefficient: n.profileShift } : {}) };
  };
  try { return spurGearCenterDistance(spec(a), spec(b)); } catch { return 0; }
}

