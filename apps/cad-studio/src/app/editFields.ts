// The editable dimensions of a feature, including those of the sketch it is made from: each field
// reads its value from the document's nodes and writes a changed copy of them (sketch edits change the
// sketch node, so every feature made from it follows).
import type { Axis, Dim, ModelNode, SketchNode } from '../engine/doc';
import { outlineFields } from '../sketch/outlineFields';

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
export function editFields(nodes: Nodes, i: number, params?: Record<string, number>): EditField[] {
  const raw = editFieldsRaw(nodes, i);
  if (!params) return raw;
  return raw.map(f => f.kind !== 'number' ? f : {
    ...f,
    get: n => within(params, () => f.get(n)).value,
    set: (n, v) => within(params, () => f.set(n, v)).value,
    param: (n: Nodes) => { const r = within(params, () => f.get(n)); return r.seen.length === 1 ? r.seen[0] : null; },
    bind: (n: Nodes, name: string) => {
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

function editFieldsRaw(nodes: Nodes, i: number): EditField[] {
  const node = nodes[i], out: EditField[] = [];
  if (!node) return out;
  const self = <T extends ModelNode>(n: Nodes) => n[i] as T;
  const number = (key: string, label: string, unit: 'mm' | '°' | undefined, get: (n: ModelNode) => number, set: (n: ModelNode, v: number) => ModelNode) =>
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
      number('deg', 'Angle', '°', n => (n as typeof node).angleDegrees, (n, v) => ({ ...(n as typeof node), angleDegrees: v }));
      break;
    case 'sweep':
      out.push(...sketchFields(nodes, node.sketch, ''));
      node.path.forEach((st, k) => {
        const step = (n: ModelNode) => (n as typeof node).path[k], put = (n: ModelNode, s: typeof st) => ({ ...(n as typeof node), path: (n as typeof node).path.map((x, j) => j === k ? s : x) });
        if (st.kind === 'straight') number('run' + k, `Run ${k + 1}`, 'mm', n => num((step(n) as typeof st).length), (n, v) => put(n, { ...(step(n) as typeof st), length: v }));
        else {
          number('bend' + k, `Bend ${k + 1} radius`, 'mm', n => num((step(n) as typeof st).radius), (n, v) => put(n, { ...(step(n) as typeof st), radius: v }));
          number('bendDeg' + k, `Bend ${k + 1} angle`, '°', n => (step(n) as typeof st).angleDegrees, (n, v) => put(n, { ...(step(n) as typeof st), angleDegrees: v }));
          out.push({ kind: 'choice', key: 'toward' + k, label: `Bend ${k + 1} toward`, options: [{ value: 'x', label: '+X' }, { value: '-x', label: '−X' }, { value: 'y', label: '+Y' }, { value: '-y', label: '−Y' }],
            get: n => (self<typeof node>(n).path[k] as typeof st).toward, set: (n, v) => replace(n, i, put(self(n), { ...(self<typeof node>(n).path[k] as typeof st), toward: v as typeof st.toward })) });
        }
      });
      break;
    case 'loft':
      node.sections.forEach((sec, k) => {
        out.push(...sketchFields(nodes, sec.sketch, `Section ${k + 1} · `));
        number('z' + k, `Section ${k + 1} · height`, 'mm', n => num((n as typeof node).sections[k].z), (n, v) => ({ ...(n as typeof node), sections: (n as typeof node).sections.map((x, j) => j === k ? { ...x, z: v } : x) }));
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
    case 'fillet': number('r', 'Radius', 'mm', n => num((n as typeof node).radius), (n, v) => ({ ...(n as typeof node), radius: v })); break;
    case 'chamfer': number('d', 'Distance', 'mm', n => num((n as typeof node).distance), (n, v) => ({ ...(n as typeof node), distance: v })); break;
    case 'gear': {
      const g = (n: ModelNode) => n as typeof node;
      number('m', 'Module', 'mm', n => num(g(n).module), (n, v) => ({ ...g(n), module: v }));
      number('z', 'Teeth', undefined, n => g(n).teeth, (n, v) => ({ ...g(n), teeth: Math.round(v) }));
      number('b', 'Face width', 'mm', n => num(g(n).faceWidth), (n, v) => ({ ...g(n), faceWidth: v }));
      number('bore', 'Bore', 'mm', n => num(g(n).bore ?? 0), (n, v) => ({ ...g(n), bore: v }));
      number('ds', 'Thinner by', 'mm', n => num(g(n).thicknessReduction ?? 0), (n, v) => ({ ...g(n), thicknessReduction: v }));
      // Its turn (a meshing gear: where it stands beside the other gear, and its phase; its turn follows the other's).
      if (!node.mesh) number('rot', 'Rotation', '°', n => g(n).rotation ?? 0, (n, v) => ({ ...g(n), rotation: v }));
      else {
        const other = nodes[node.mesh.gear], nominal = (n: ModelNode) => other?.kind === 'gear' ? num(other.module) * (other.teeth + g(n).teeth) / 2 : 0;
        number('dir', 'Direction', '°', n => g(n).mesh!.direction ?? 0, (n, v) => ({ ...g(n), mesh: { ...g(n).mesh!, direction: v } }));
        number('a', 'Centre distance', 'mm', n => num(g(n).mesh!.centerDistance ?? nominal(n)), (n, v) => { const mesh = { ...g(n).mesh! }; if (Math.abs(v - nominal(n)) < 1e-9) delete mesh.centerDistance; else mesh.centerDistance = v; return { ...g(n), mesh }; });
        number('ph', 'Phase', '°', n => g(n).mesh!.phase ?? 0, (n, v) => ({ ...g(n), mesh: { ...g(n).mesh!, phase: v } }));
      }
      break;
    }
    case 'thicken': number('t', 'Thickness', 'mm', n => num((n as typeof node).thickness), (n, v) => ({ ...(n as typeof node), thickness: v })); break;
    case 'sew': number('tol', 'Tolerance', 'mm', n => (n as typeof node).tolerance ?? 0, (n, v) => { const next = { ...(n as typeof node) }; if (v > 0) next.tolerance = Math.min(1, v); else delete next.tolerance; return next; }); break;
    case 'draft': number('deg', 'Angle', '°', n => (n as typeof node).angleDegrees, (n, v) => ({ ...(n as typeof node), angleDegrees: v })); break;
    case 'shell': number('t', 'Wall', 'mm', n => num((n as typeof node).thickness), (n, v) => ({ ...(n as typeof node), thickness: v })); break;
    case 'translate': [0, 1, 2].forEach(k => number('o' + k, 'Δ' + 'XYZ'[k], 'mm', n => num((n as typeof node).offset[k]), (n, v) => { const o = [...(n as typeof node).offset] as [Dim, Dim, Dim]; o[k] = v; return { ...(n as typeof node), offset: o }; })); break;
    case 'rotate':
      out.push({ kind: 'choice', key: 'axis', label: 'Axis', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis: v as Axis }) });
      number('deg', 'Angle', '°', n => (n as typeof node).angleDegrees, (n, v) => ({ ...(n as typeof node), angleDegrees: v }));
      if (node.pivot) [0, 1, 2].forEach(k => number('p' + k, 'Pivot ' + 'XYZ'[k], 'mm', n => num((n as typeof node).pivot![k]), (n, v) => { const p = [...(n as typeof node).pivot!] as [Dim, Dim, Dim]; p[k] = v; return { ...(n as typeof node), pivot: p }; }));
      break;
    case 'mirror':
      out.push({ kind: 'choice', key: 'plane', label: 'Plane', options: [{ value: 'yz', label: 'YZ' }, { value: 'xz', label: 'XZ' }, { value: 'xy', label: 'XY' }], get: n => self<typeof node>(n).plane, set: (n, v) => replace(n, i, { ...self<typeof node>(n), plane: v as typeof node.plane }) });
      break;
    case 'scale': number('k', 'Factor', undefined, n => (n as typeof node).factor, (n, v) => ({ ...(n as typeof node), factor: v })); break;
    case 'linear-pattern':
      out.push({ kind: 'choice', key: 'axis', label: 'Direction', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis: v as Axis }) });
      number('spacing', 'Spacing', 'mm', n => num((n as typeof node).spacing), (n, v) => ({ ...(n as typeof node), spacing: v }));
      number('count', 'Count', undefined, n => (n as typeof node).count, (n, v) => ({ ...(n as typeof node), count: Math.round(v) }));
      break;
    case 'circular-pattern':
      number('count', 'Count', undefined, n => (n as typeof node).count, (n, v) => ({ ...(n as typeof node), count: Math.round(v), ...((n as typeof node).axis === 'z' ? { angleDegrees: 360 / Math.max(1, Math.round(v)) } : {}) }));
      break;
    case 'split':
      if (node.normal) (['x', 'y', 'z'] as const).forEach((a, k) => number('n' + a, `Normal ${a.toUpperCase()}`, undefined, n => (n as typeof node).normal?.[k] ?? 0, (n, v) => { const was = (n as typeof node).normal ?? [0, 0, 0], next = was.map((c, j) => j === k ? v : c) as [number, number, number]; return { ...(n as typeof node), normal: next }; }));
      else out.push({ kind: 'choice', key: 'axis', label: 'Normal', options: axes(['x', 'y', 'z']), get: n => self<typeof node>(n).axis, set: (n, v) => replace(n, i, { ...self<typeof node>(n), axis: v as Axis }) });
      number('at', 'At', 'mm', n => num((n as typeof node).at), (n, v) => ({ ...(n as typeof node), at: v }));
      break;
  }
  return out;
}
