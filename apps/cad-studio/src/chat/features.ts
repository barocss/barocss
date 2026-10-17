// Feature nodes written by the model (add_features / edit_feature), checked before the kernel sees
// them: every field of the node's kind with the right type, references to earlier sketches and to
// bodies that are still visible, and no unknown fields. Also deleting a feature (with the sketches only
// it used), renumbering the later ones and the persistent face and edge names that carry their index.
import { leafBodies, parentsOf, prefixDoc, type BodyRef, type ModelNode, type StudioDoc } from '../engine/doc';
import { BASE, mateLabel } from '../assembly/mates';
import type { DrawingDimension } from '../drawing/types';

type Spec = Record<string, string>;
/** `?` marks an optional field. */
const SPECS: Record<string, Spec> = {
  extrude: { sketch: 'sketch', height: 'dim', 'from?': 'dim', 'draft?': 'num' },
  revolve: { sketch: 'sketch', axis: 'enum:x|y', 'origin?': 'dim2', angleDegrees: 'num' },
  sweep: { sketch: 'sketch', path: 'path' },
  loft: { sections: 'sections', 'smooth?': 'bool' },
  translate: { parent: 'ref', offset: 'dim3' },
  rotate: { parent: 'ref', axis: 'enum:x|y|z', angleDegrees: 'num', 'pivot?': 'dim3' },
  mirror: { parent: 'ref', plane: 'enum:xy|xz|yz' },
  scale: { parent: 'ref', factor: 'pos', 'pivot?': 'dim3' },
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
      if (!isObj(v) || !Number.isInteger(v.node) || !(sides.includes(String(v.side)) || /^part\d+$/.test(String(v.side)))) return 'a body reference {node, side: "solid"} (split halves: "negative" / "positive"; solids of a STEP file: "part0", "part1", …)';
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
  if (n.kind === 'loft') { (n as { sections: { sketch: number; z: unknown }[] }).sections = n.sections.map(s => ({ ...s, sketch: map(s.sketch) })); if (n.from) (n as { from: number[] }).from = n.from.map(map); }
  if (n.kind === 'sketch' && n.on) (n as { on: BodyRef }).on = ref(n.on);
  for (const key of ['parent', 'left', 'right', 'tool'] as const) if (isObj(n[key])) (n as Record<string, unknown>)[key] = ref(n[key] as unknown as BodyRef);
  if (n.kind === 'fillet' || n.kind === 'chamfer') (n as { edges: string[] }).edges = n.edges.map(e => renameIds(e, map));
  if (n.kind === 'shell') (n as { open: string[] }).open = n.open.map(e => renameIds(e, map));
  return n;
}

/** A drawing dimension's edge names, renamed (null when one of them is gone). */
function renameDimension(d: DrawingDimension, rename: (name: string) => string | null): DrawingDimension | null {
  if ('edge' in d) { const edge = rename(d.edge); return edge === null ? null : { ...d, edge }; }
  const a = rename(d.a.edge), b = rename(d.b.edge);
  return a === null || b === null ? null : { ...d, a: { ...d.a, edge: a }, b: { ...d.b, edge: b } } as DrawingDimension;
}
/** Records by body key (`b<i>`, `b<i>_<side>`), renumbered; the removed features' bodies dropped. */
function renameKeys<T>(rec: Record<string, T>, removed: Set<number>, map: (i: number) => number): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).flatMap(([k, v]) => {
    const m = /^b(\d+)(_.*)?$/.exec(k);
    return !m ? [[k, v]] : removed.has(Number(m[1])) ? [] : [[`b${map(Number(m[1]))}${m[2] ?? ''}`, v]];
  }));
}

/**
 * The document without feature `index` (and the sketches only it used), or why it cannot go. Everything
 * that names features by index follows: later nodes, mates on the part's own faces, drawing dimensions
 * (those that measured a removed feature are dropped: `droppedDimensions`) and render settings by body.
 */
export function deleteFeature(doc: StudioDoc, index: number): { doc: StudioDoc; removed: number[]; droppedDimensions: number } | { error: string } {
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
  const map = (old: number) => newIndex.get(old) ?? old;
  const gone = (name: string) => [...name.matchAll(/\bn(\d+)(?=[._|/#]|$)/g)].find(m => removed.has(Number(m[1])))?.[1];
  for (const [k, mate] of (doc.mates ?? []).entries()) for (const r of [mate.a, mate.b]) {
    const by = r.part === BASE ? gone(r.face) : undefined;
    if (by !== undefined) return { error: `${mateLabel(mate, k)} uses the face "${r.face}" made by feature ${by}; delete that mate first.` };
  }
  const next = kept.map(i => renumber(nodes[i], map));
  const out: StudioDoc = { ...doc, nodes: next };
  if (doc.mates) out.mates = doc.mates.map(m => ({ ...m, ...[m.a, m.b].reduce((o, r, j) => ({ ...o, [j ? 'b' : 'a']: r.part === BASE ? { ...r, face: renameIds(r.face, map) } : r }), {}) }));
  let droppedDimensions = 0;
  if (doc.drawing) {
    const dimensions = doc.drawing.dimensions.flatMap(d => { const r = renameDimension(d, name => gone(name) !== undefined ? null : renameIds(name, map)); if (!r) droppedDimensions++; return r ? [r] : []; });
    out.drawing = { ...doc.drawing, dimensions };
  }
  if (doc.render) out.render = { ...doc.render, appearances: renameKeys(doc.render.appearances, removed, map), animation: { ...doc.render.animation, tracks: renameKeys(doc.render.animation.tracks, removed, map) } };
  if (doc.bodies) out.bodies = renameKeys(doc.bodies, removed, map);
  return { doc: prefixDoc(out, next.length), removed: [...removed].sort((a, b) => a - b), droppedDimensions };
}

/**
 * The nodes that make a body (`top`, its node) and nothing else uses: deleting them all removes the body
 * and the features and sketches only it was built from.
 */
export function bodyNodes(nodes: readonly ModelNode[], top: number): number[] {
  const users = (i: number) => nodes.flatMap((n, k) => parentsOf(n).includes(i) ? [k] : []);
  if (!nodes[top] || users(top).length) return [];
  const set = new Set([top]);
  for (let grew = true; grew;) {
    grew = false;
    for (const i of [...set]) for (const p of parentsOf(nodes[i])) if (!set.has(p) && users(p).every(k => set.has(k))) { set.add(p); grew = true; }
  }
  return [...set].sort((a, b) => b - a);
}
/** The document without these features, deleted last first (so earlier indices hold), or why one cannot go. */
/**
 * The features that depend on feature `index`, directly or through others: built on it, or naming a
 * face or edge it made (a fillet's edges, a shell's open faces). Sketches are left out (a deleted
 * feature takes its own sketch with it).
 */
export function featureDependents(doc: StudioDoc, index: number): number[] {
  const nodes = doc.nodes, gone = new Set([index]);
  const named = (n: ModelNode) => n.kind === 'fillet' || n.kind === 'chamfer' ? n.edges : n.kind === 'shell' ? n.open : [];
  for (let k = index + 1; k < nodes.length; k++) {
    const n = nodes[k];
    if (parentsOf(n).some(p => gone.has(p)) || named(n).some(name => [...name.matchAll(/\bn(\d+)(?=[._|/#]|$)/g)].some(m => gone.has(Number(m[1]))))) gone.add(k);
  }
  return [...gone].filter(k => k !== index && nodes[k].kind !== 'sketch').sort((a, b) => a - b);
}

export function deleteFeatures(doc: StudioDoc, indices: readonly number[]): { doc: StudioDoc; droppedDimensions: number } | { error: string } {
  let cur = doc, dropped = 0;
  const left = new Set(indices);
  for (const i of [...indices].sort((a, b) => b - a)) {
    if (!left.has(i)) continue;
    const r = deleteFeature(cur, i);
    if ('error' in r) return r;
    r.removed.forEach(k => left.delete(k));
    cur = r.doc; dropped += r.droppedDimensions;
  }
  return { doc: cur, droppedDimensions: dropped };
}

/**
 * A copy of a body as a body of its own: every feature it is built from, appended again (renumbered, its
 * face and edge names too), then moved by `offset`. Its look (colour) comes along. `top`: its new node.
 */
export function duplicateBody(doc: StudioDoc, body: BodyRef, offset: [number, number, number] | ((copy: BodyRef) => ModelNode)): { doc: StudioDoc; top: number } {
  const nodes = doc.nodes, chain = new Set<number>(), stack = [body.node];
  while (stack.length) { const i = stack.pop()!; if (chain.has(i) || !nodes[i]) continue; chain.add(i); stack.push(...parentsOf(nodes[i])); }
  const order = [...chain].sort((a, b) => a - b), at = new Map(order.map((old, k) => [old, nodes.length + k]));
  const map = (i: number) => at.get(i) ?? i;
  const copies = order.map(i => renumber(nodes[i], map));
  const top = nodes.length + order.length;
  const copy: BodyRef = { node: map(body.node), side: body.side };
  let out: StudioDoc = { ...doc, nodes: [...nodes, ...copies, typeof offset === 'function' ? offset(copy) : { kind: 'translate', parent: copy, offset }] };
  // The copy's look: the original's colour (not its name), keyed by the copy's first feature.
  const looks = doc.bodies ?? {}, rootKey = Object.keys(looks).find(k => { const m = /^b(\d+)/.exec(k); return m && chain.has(Number(m[1])) && !/_/.test(k); });
  if (rootKey && looks[rootKey].color) { const m = /^b(\d+)/.exec(rootKey)!; out = { ...out, bodies: { ...looks, [`b${map(Number(m[1]))}`]: { color: looks[rootKey].color } } }; }
  return { doc: prefixDoc(out, out.nodes.length), top };
}

/**
 * The document with nodes `start … start + count − 1` replaced by `next` (a shape rebuilt with a different
 * number of steps): later nodes, names in them and body looks are renumbered; what pointed into the old
 * range points at its last node's replacement (the shape's solid).
 */
export function replaceRange(doc: StudioDoc, start: number, count: number, next: ModelNode[]): StudioDoc {
  const shift = next.length - count, top = start + next.length - 1;
  const map = (i: number) => i < start ? i : i < start + count ? top : i + shift;
  const after = doc.nodes.slice(start + count).map(n => renumber(n, map));
  const out: StudioDoc = { ...doc, nodes: [...doc.nodes.slice(0, start), ...next, ...after] };
  if (doc.bodies && shift) out.bodies = renameKeys(doc.bodies, new Set(), map);
  return prefixDoc(out, out.nodes.length);
}
