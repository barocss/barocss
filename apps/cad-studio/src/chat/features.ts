// Feature nodes written by the model (add_features / edit_feature), checked before the kernel sees
// them: every field of the node's kind with the right type, references to earlier sketches and to
// bodies that are still visible, and no unknown fields. Also deleting a feature (with the sketches only
// it used), renumbering the later ones and the persistent face and edge names that carry their index.
import { leafBodies, parentsOf, prefixDoc, type BodyRef, type ModelNode, type StudioDoc } from '../engine/doc';

type Spec = Record<string, string>;
/** `?` marks an optional field. */
const SPECS: Record<string, Spec> = {
  extrude: { sketch: 'sketch', height: 'dim', 'from?': 'dim', 'draft?': 'num' },
  revolve: { sketch: 'sketch', axis: 'enum:x|y', 'origin?': 'dim2', angleDegrees: 'num' },
  sweep: { sketch: 'sketch', path: 'path' },
  loft: { sections: 'sections', 'smooth?': 'bool' },
  translate: { parent: 'ref', offset: 'dim3' },
  rotate: { parent: 'ref', axis: 'enum:x|y|z', angleDegrees: 'num' },
  mirror: { parent: 'ref', plane: 'enum:xy|xz|yz' },
  scale: { parent: 'ref', factor: 'pos' },
  'linear-pattern': { parent: 'ref', axis: 'enum:x|y|z', spacing: 'dim', count: 'count' },
  'circular-pattern': { parent: 'ref', axis: 'enum:x|y|z', angleDegrees: 'num', count: 'count' },
  union: { left: 'ref', right: 'ref' },
  intersect: { left: 'ref', right: 'ref' },
  difference: { parent: 'ref', tool: 'ref' },
  split: { parent: 'ref', at: 'dim', axis: 'enum:x|y|z' },
  shell: { parent: 'ref', thickness: 'dim', open: 'names' },
  chamfer: { parent: 'ref', edges: 'names1', distance: 'dim' },
  fillet: { parent: 'ref', edges: 'names1', radius: 'dim' },
  hole: { parent: 'ref', center: 'dim2', radius: 'dim', 'axis?': 'enum:x|y|z', 'side?': 'enum:min|max', 'depth?': 'dim' },
};
const PROFILE: Record<string, Spec> = {
  rectangle: { min: 'dim2', max: 'dim2' },
  circle: { center: 'dim2', radius: 'dim' },
  polygon: { points: 'points' },
  loop: { segments: 'loop' },
};
const ON_PLANE: Spec = { 'plane?': 'plane', 'regions?': 'loops', 'holes?': 'loops' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const sideOf = (r: BodyRef) => r.side === 'solid' ? `b${r.node}` : `b${r.node}_${r.side}`;

/** Why the node cannot be appended to `nodes`, or null. */
export function checkNode(node: unknown, nodes: readonly ModelNode[], parameters: Record<string, number>): string | null {
  if (!isObj(node)) return 'A feature is an object with a "kind".';
  const kind = String(node.kind);
  if (kind === 'import') return 'STEP imports are opened from a file, not written in chat.';
  let spec: Spec;
  if (kind === 'sketch') {
    const p = PROFILE[String(node.profile)];
    if (!p) return `A sketch's "profile" is one of ${Object.keys(PROFILE).join(', ')}.`;
    spec = { profile: 'any', ...p, ...ON_PLANE };
  } else {
    if (!SPECS[kind]) return `Unknown feature kind "${kind}". Kinds: sketch, ${Object.keys(SPECS).join(', ')}.`;
    spec = SPECS[kind];
  }
  const fields = new Map(Object.entries(spec).map(([k, t]) => [k.replace(/\?$/, ''), { type: t, optional: k.endsWith('?') }]));
  for (const key of Object.keys(node)) if (key !== 'kind' && !fields.has(key)) return `${kind}: unknown field "${key}" (fields: ${[...fields.keys()].join(', ')}).`;
  const leaves = leafBodies(nodes).map(sideOf);
  for (const [key, { type, optional }] of fields) {
    const v = node[key];
    if (v === undefined) { if (optional) continue; return `${kind}: "${key}" is required.`; }
    const why = checkValue(v, type, nodes, parameters, leaves);
    if (why) return `${kind}.${key}: ${why}`;
  }
  return null;
}

function checkValue(v: unknown, type: string, nodes: readonly ModelNode[], parameters: Record<string, number>, leaves: string[]): string | null {
  const dim = (x: unknown) => typeof x === 'number' ? Number.isFinite(x) : isObj(x) && typeof x.parameter === 'string' && x.parameter in parameters;
  const pair = (x: unknown) => Array.isArray(x) && x.length === 2 && x.every(dim);
  const loop = (x: unknown): string | null => {
    if (!Array.isArray(x) || x.length < 2) return 'a loop is a list of at least two segments';
    for (const g of x) {
      if (!isObj(g) || !pair(g.start)) return 'each segment has a "start" [x, y]';
      if (g.kind === 'line') { if (Object.keys(g).some(k => k !== 'kind' && k !== 'start')) return 'a line segment has only kind and start'; }
      else if (g.kind === 'arc') { if (!pair(g.center) || (g.direction !== 'ccw' && g.direction !== 'cw')) return 'an arc segment has start, center [x, y] and direction "ccw" or "cw"'; }
      else return 'a segment kind is "line" or "arc"';
    }
    return null;
  };
  if (type.startsWith('enum:')) return type.slice(5).split('|').includes(String(v)) ? null : `one of ${type.slice(5).split('|').join(', ')}`;
  switch (type) {
    case 'any': return null;
    case 'num': return typeof v === 'number' && Number.isFinite(v) ? null : 'a number';
    case 'pos': return typeof v === 'number' && v > 0 ? null : 'a positive number';
    case 'bool': return typeof v === 'boolean' ? null : 'true or false';
    case 'count': return Number.isInteger(v) && (v as number) >= 2 ? null : 'a whole number of at least 2';
    case 'dim': return dim(v) ? null : 'a number (mm) or {"parameter": name} of a defined parameter';
    case 'dim2': return pair(v) ? null : 'two numbers [a, b]';
    case 'dim3': return Array.isArray(v) && v.length === 3 && v.every(dim) ? null : 'three numbers [x, y, z]';
    case 'points': return Array.isArray(v) && v.length >= 3 && v.every(pair) ? null : 'at least three [x, y] points';
    case 'loop': return loop(v);
    case 'loops': { if (!Array.isArray(v)) return 'a list of loops'; for (const l of v) { const w = loop(l); if (w) return w; } return null; }
    case 'plane': {
      const v3 = (x: unknown) => Array.isArray(x) && x.length === 3 && x.every(n => typeof n === 'number' && Number.isFinite(n));
      return isObj(v) && v3(v.origin) && v3(v.normal) && v3(v.xAxis) ? null : 'a plane {origin, normal, xAxis}, each [x, y, z]';
    }
    case 'names': return Array.isArray(v) && v.every(n => typeof n === 'string') ? null : 'a list of face or edge names';
    case 'names1': return Array.isArray(v) && v.length > 0 && v.every(n => typeof n === 'string') ? null : 'a non-empty list of edge names';
    case 'sketch': {
      if (!Number.isInteger(v) || (v as number) < 0 || (v as number) >= nodes.length) return `the index of an earlier sketch (0–${nodes.length - 1})`;
      return nodes[v as number].kind === 'sketch' ? null : `feature ${v} is a ${nodes[v as number].kind}, not a sketch`;
    }
    case 'sections': {
      if (!Array.isArray(v) || v.length < 2) return 'at least two {sketch, z} sections';
      for (const s of v) { if (!isObj(s) || !dim(s.z)) return 'each section is {sketch, z}'; const w = checkValue(s.sketch, 'sketch', nodes, parameters, leaves); if (w) return w; }
      return null;
    }
    case 'path': {
      if (!Array.isArray(v) || !v.length) return 'a list of steps';
      for (const s of v) {
        if (isObj(s) && s.kind === 'straight' && dim(s.length)) continue;
        if (isObj(s) && s.kind === 'bend' && dim(s.radius) && typeof s.angleDegrees === 'number' && ['x', '-x', 'y', '-y'].includes(String(s.toward))) continue;
        return 'each step is {kind:"straight", length} or {kind:"bend", radius, angleDegrees, toward: "x"|"-x"|"y"|"-y"}';
      }
      return null;
    }
    case 'ref': {
      const sides = ['solid', 'negative', 'positive', 'instance1', 'instance2', 'instance3'];
      if (!isObj(v) || !Number.isInteger(v.node) || !sides.includes(String(v.side))) return 'a body reference {node, side: "solid"} (split halves: "negative" / "positive")';
      const key = sideOf(v as unknown as BodyRef);
      return leaves.includes(key) ? null : `${key} is not a visible body${leaves.length ? ` (bodies now: ${leaves.join(', ')})` : ' (there are no bodies yet)'}`;
    }
  }
  return `unchecked type ${type}`;
}

/** Feature ids `n<i>` inside persistent names, renumbered. */
const renameIds = (name: string, map: (i: number) => number) => name.replace(/\bn(\d+)(?=[._|/#]|$)/g, (_, i) => `n${map(Number(i))}`);

function renumber(node: ModelNode, map: (i: number) => number): ModelNode {
  const ref = (r: BodyRef): BodyRef => ({ ...r, node: map(r.node) });
  const n = { ...node } as Record<string, unknown> & ModelNode;
  if ('sketch' in n && typeof n.sketch === 'number') n.sketch = map(n.sketch);
  if (n.kind === 'loft') (n as { sections: { sketch: number; z: unknown }[] }).sections = n.sections.map(s => ({ ...s, sketch: map(s.sketch) }));
  for (const key of ['parent', 'left', 'right', 'tool'] as const) if (isObj(n[key])) (n as Record<string, unknown>)[key] = ref(n[key] as unknown as BodyRef);
  if (n.kind === 'fillet' || n.kind === 'chamfer') (n as { edges: string[] }).edges = n.edges.map(e => renameIds(e, map));
  if (n.kind === 'shell') (n as { open: string[] }).open = n.open.map(e => renameIds(e, map));
  return n;
}

/** The document without feature `index` (and the sketches only it used), or why it cannot go. */
export function deleteFeature(doc: StudioDoc, index: number): { doc: StudioDoc; removed: number[] } | { error: string } {
  const nodes = doc.nodes;
  if (!Number.isInteger(index) || index < 0 || index >= nodes.length) return { error: `There is no feature ${index} (features 0–${nodes.length - 1}).` };
  const users = (i: number) => nodes.flatMap((n, k) => parentsOf(n).includes(i) ? [k] : []);
  const removed = new Set([index]);
  for (const s of parentsOf(nodes[index])) if (nodes[s]?.kind === 'sketch' && users(s).every(k => k === index)) removed.add(s);
  const blocking = [...removed].flatMap(users).filter(k => !removed.has(k));
  if (blocking.length) return { error: `Feature ${index} is used by feature${blocking.length > 1 ? 's' : ''} ${[...new Set(blocking)].join(', ')}; delete ${blocking.length > 1 ? 'those' : 'that'} first.` };
  const kept = nodes.map((_, i) => i).filter(i => !removed.has(i));
  const newIndex = new Map(kept.map((old, k) => [old, k]));
  const named = (n: ModelNode) => n.kind === 'fillet' || n.kind === 'chamfer' ? n.edges : n.kind === 'shell' ? n.open : [];
  for (const i of kept) for (const name of named(nodes[i])) for (const m of name.matchAll(/\bn(\d+)(?=[._|/#]|$)/g)) {
    if (removed.has(Number(m[1]))) return { error: `Feature ${i} refers to the face or edge "${name}" made by feature ${m[1]}; delete or edit feature ${i} first.` };
  }
  const next = kept.map(i => renumber(nodes[i], old => newIndex.get(old) ?? old));
  return { doc: prefixDoc({ ...doc, nodes: next }, next.length), removed: [...removed].sort((a, b) => a - b) };
}
