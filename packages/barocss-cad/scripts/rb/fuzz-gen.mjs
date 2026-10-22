// The L4 fuzz's generator (RB5, K10, D188): seeded random CSG trees as plain data, their part documents, and smaller
// trees for shrinking. Leaves: box, cylinder, sphere, cone or frustum, the rounded box (its vertical edges filleted)
// and the shelled box; Booleans union, difference, intersect; a linear or circular pattern of a subtree. Half the
// cases are generic (sizes to 3 decimals, any angle); half agent-like (whole millimetres, quarter turns, flush faces).

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

/** A number in [lo, hi]: to 3 decimals (generic), or a whole number (snapped). */
const num = (rnd, lo, hi, snap) => snap ? Math.round(lo + (hi - lo) * rnd()) : Math.round((lo + (hi - lo) * rnd()) * 1000) / 1000;
function leafOf(rnd, snap) {
  const kind = pick(rnd, ['box', 'box', 'cyl', 'cyl', 'sphere', 'cone', 'rbox', 'hbox']), n = (lo, hi) => num(rnd, lo, hi, snap);
  let leaf;
  if (kind === 'box') leaf = { kind, w: n(1, 8), d: n(1, 8), h: n(1, 8) };
  else if (kind === 'cyl') leaf = { kind, r: n(1, 4), h: n(1, 8) };
  else if (kind === 'sphere') leaf = { kind, r: n(1, 4) };
  else if (kind === 'cone') { const r1 = n(1, 4); leaf = { kind, r1, r2: rnd() < 0.3 ? 0 : Math.min(r1 - (snap ? 1 : 0.2), n(0.5, 4)), h: n(1, 6) }; if (leaf.r2 < 0) leaf.r2 = 0; }
  else if (kind === 'rbox') { const w = n(2, 8), d = n(2, 8); leaf = { kind, w, d, h: n(1, 8), r: Math.max(0.2, Math.round(Math.min(w, d) * 0.45 * rnd() * 1000) / 1000) }; if (snap) leaf.r = Math.max(0.5, Math.round(leaf.r * 2) / 2); if (leaf.r >= Math.min(w, d) / 2) leaf.r = Math.min(w, d) / 4; }
  else { const w = n(3, 8), d = n(3, 8), h = n(2, 8); leaf = { kind, w, d, h, t: snap ? 0.5 : Math.round((0.2 + 0.8 * rnd()) * 1000) / 1000, open: rnd() < 0.5 }; }
  const rot = [];
  for (let k = 0, m = Math.floor(rnd() * 3); k < m; k++) rot.push({ axis: pick(rnd, ['x', 'y', 'z']), deg: snap ? pick(rnd, [90, 180, 270]) : num(rnd, 3, 357, false) });
  return { ...leaf, rot, move: [n(-3, 3), n(-3, 3), n(-3, 3)] };
}
/** A tree of depth at most `depth`, its leaves counted in `count` (at most 6). */
function treeOf(rnd, depth, snap, count) {
  if (depth === 0 || count.n >= 5 || (count.n > 0 && rnd() < 0.3)) { count.n++; return { leaf: leafOf(rnd, snap) }; }
  if (count.n < 4 && rnd() < 0.15) {
    const child = treeOf(rnd, depth - 1, snap, count), linear = rnd() < 0.5;
    return { pattern: linear ? { kind: 'linear', axis: pick(rnd, ['x', 'y', 'z']), spacing: num(rnd, 2, 9, snap) * (rnd() < 0.5 ? -1 : 1), count: 2 + Math.floor(rnd() * 3) }
      : { kind: 'circular', axis: 'z', deg: snap ? pick(rnd, [90, 120, 180]) : num(rnd, 20, 180, false), count: 2 + Math.floor(rnd() * 3), pivot: [num(rnd, -3, 3, snap), num(rnd, -3, 3, snap), 0] }, child };
  }
  return { op: pick(rnd, ['union', 'union', 'difference', 'intersect']), a: treeOf(rnd, depth - 1, snap, count), b: treeOf(rnd, depth - 1, snap, count) };
}
/** A case: { snap, tree }. */
export function caseOf(rnd) { const snap = rnd() < 0.5; return { snap, tree: treeOf(rnd, 3, snap, { n: 0 }) }; }

/** The tree's part document; its root feature id is `root`. */
export function documentOf(tree) {
  const features = [];
  let k = 0;
  const leafFeatures = (L, id) => {
    const body = `${id}b`;
    if (L.kind === 'box' || L.kind === 'rbox' || L.kind === 'hbox') {
      features.push({ id: `${id}s`, kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [L.w, L.d] }, { id: body, kind: 'extrude', sketch: `${id}s`, height: L.h });
      if (L.kind === 'rbox') features.push({ id: `${id}f`, kind: 'fillet', target: body, edges: [`${body}.side0|${body}.side1`, `${body}.side1|${body}.side2`, `${body}.side2|${body}.side3`, `${body}.side0|${body}.side3`], radius: L.r });
      if (L.kind === 'hbox') features.push({ id: `${id}f`, kind: 'shell', target: body, thickness: L.t, open: L.open ? [`${body}.top`] : [] });
    } else if (L.kind === 'cyl') features.push({ id: `${id}s`, kind: 'sketch', profile: 'circle', center: [0, 0], radius: L.r }, { id: body, kind: 'extrude', sketch: `${id}s`, height: L.h });
    else if (L.kind === 'sphere') features.push({ id: `${id}s`, kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, -L.r] }, { kind: 'arc', start: [0, L.r], center: [0, 0], direction: 'cw' }], plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } },
      { id: body, kind: 'revolve', sketch: `${id}s`, axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 });
    else {
      const loop = L.r2 > 0 ? [[0, 0], [L.r1, 0], [L.r2, L.h], [0, L.h]] : [[0, 0], [L.r1, 0], [0, L.h]];
      features.push({ id: `${id}s`, kind: 'sketch', profile: 'loop', segments: loop.map(start => ({ kind: 'line', start })), plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } },
        { id: body, kind: 'revolve', sketch: `${id}s`, axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 });
    }
    let last = features[features.length - 1].id;
    L.rot.forEach((r, j) => { features.push({ id: `${id}r${j}`, kind: 'rotate', target: last, axis: r.axis, angleDegrees: r.deg, pivot: [0, 0, 0] }); last = `${id}r${j}`; });
    features.push({ id, kind: 'translate', target: last, offset: L.move });
  };
  const walk = node => {
    const id = `n${k++}`;
    if (node.leaf) { leafFeatures(node.leaf, id); return id; }
    if (node.pattern) {
      const child = walk(node.child), p = node.pattern;
      features.push(p.kind === 'linear' ? { id, kind: 'linear-pattern', target: child, axis: p.axis, spacing: p.spacing, count: p.count }
        : { id, kind: 'circular-pattern', target: child, axis: p.axis, angleDegrees: p.deg, count: p.count, pivot: p.pivot });
      return id;
    }
    const a = walk(node.a), b = walk(node.b);
    features.push({ id, kind: node.op, target: a, tool: b });
    return id;
  };
  const root = walk(tree);
  return { document: D(features), root };
}

/** Smaller trees: each Boolean by either operand, a pattern by its child or fewer copies, a leaf's rotations dropped, its numbers rounded. */
export function shrinkTree(tree) {
  const out = [];
  if (tree.leaf) {
    const L = tree.leaf;
    if (L.rot.length) out.push({ leaf: { ...L, rot: L.rot.slice(0, -1) } });
    const rounded = Object.fromEntries(Object.entries(L).map(([key, v]) => [key, typeof v === 'number' && key !== 'deg' ? Math.round(v * 2) / 2 || v : v]));
    if (JSON.stringify(rounded) !== JSON.stringify(L)) out.push({ leaf: { ...rounded, move: L.move.map(x => Math.round(x * 2) / 2) } });
    return out;
  }
  if (tree.pattern) {
    out.push(tree.child);
    if (tree.pattern.count > 2) out.push({ ...tree, pattern: { ...tree.pattern, count: tree.pattern.count - 1 } });
    for (const c of shrinkTree(tree.child)) out.push({ ...tree, child: c });
    return out;
  }
  out.push(tree.a, tree.b);
  for (const c of shrinkTree(tree.a)) out.push({ ...tree, a: c });
  for (const c of shrinkTree(tree.b)) out.push({ ...tree, b: c });
  return out;
}
/** Leaves in a tree. */
export const leavesOf = tree => tree.leaf ? 1 : tree.pattern ? leavesOf(tree.child) : leavesOf(tree.a) + leavesOf(tree.b);
