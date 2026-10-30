// The feature editor's fields for a sketch drawn as a constrained outline: one per driving dimension kept
// in the sketch node. Changing one re-solves the outline with all its constraints and rewrites the
// profile; a value the constraints cannot take leaves the nodes unchanged.
import { NODE_EXTRA_FIELDS, type ModelNode, type SketchNode, type SketchOutline } from '../engine/doc';
import type { EditField } from '../app/editFields';
import { profileOf } from './loops';
import { commitDimension, dimensionLabel, dimensionValue } from './rules';
import { outlinePolygon, sketchShapes } from './reopen';
export { outlinePolygon };

type Nodes = readonly ModelNode[];

/** The driving dimensions' keys of a kept outline, in the order the sketch panel lists them. */
export function drivingDimensions(o: SketchOutline): string[] {
  return [...Object.keys(o.lengths ?? {}).map(i => 'len' + i), ...Object.keys(o.radii ?? {}).map(i => 'rad' + i),
    ...(o.rules ?? []).flatMap(r => r.kind === 'distance' ? [`dist${r.a}_${r.b}`] : r.kind === 'dx' || r.kind === 'dy' || r.kind === 'angle' ? [`${r.kind === 'angle' ? 'ang' : r.kind}${r.a}_${r.b}`]
      : r.kind === 'cdist' || r.kind === 'cdx' || r.kind === 'cdy' ? [`${r.kind}${r.a}_${r.circle}`] : r.kind === 'cedge' ? [`cedge${r.edge}_${r.circle}`]
      : r.kind === 'ccdist' || r.kind === 'ccdx' || r.kind === 'ccdy' ? [`${r.kind}${r.a}_${r.b}`] : []),
    ...(o.circles ?? []).map((_, j) => 'cdia' + j)];
}

/** A driving dimension's value as typed (lengths, radii, distances, angles), not as re-measured from the solved points. */
export function drivingValue(o: SketchOutline, key: string): number | null {
  const m = /^(len|rad)(\d+)$/.exec(key);
  if (m) return (m[1] === 'len' ? o.lengths : o.radii)?.[Number(m[2])] ?? null;
  const ce = /^cedge(\d+)_(\d+)$/.exec(key);
  if (ce) { const r = (o.rules ?? []).find(x => x.kind === 'cedge' && x.edge === Number(ce[1]) && x.circle === Number(ce[2])); return r && 'value' in r ? r.value : null; }
  const cc = /^(ccdist|ccdx|ccdy)(\d+)_(\d+)$/.exec(key);
  if (cc) { const r = (o.rules ?? []).find(x => x.kind === cc[1] && 'b' in x && x.a === Number(cc[2]) && x.b === Number(cc[3])); return r && 'value' in r ? r.value : null; }
  const cd = /^(cdist|cdx|cdy)(\d+)_(\d+)$/.exec(key);
  if (cd) { const r = (o.rules ?? []).find(x => x.kind === cd[1] && 'circle' in x && 'a' in x && x.a === Number(cd[2]) && x.circle === Number(cd[3])); return r && 'value' in r ? r.value : null; }
  const cdia = /^cdia(\d+)$/.exec(key); if (cdia) { const c = o.circles?.[Number(cdia[1])]; return c ? c.r * 2 : null; }
  const d = /^(dist|dx|dy|ang)(\d+)_(\d+)$/.exec(key); if (!d) return null;
  const kind = ({ dist: 'distance', dx: 'dx', dy: 'dy', ang: 'angle' } as const)[d[1] as 'dist' | 'dx' | 'dy' | 'ang'];
  const r = (o.rules ?? []).find(x => x.kind === kind && 'b' in x && x.a === Number(d[2]) && x.b === Number(d[3]));
  return r && 'value' in r ? r.value : null;
}

/**
 * The node after a dimension edit: the re-solved geometry (profile kind, points, regions, holes, outline, side ids) with
 * what is not geometry kept from the old node — its plane, body target, construction shapes and the generic node fields
 * (id, suppressed, …). A node from before side ids gets none from the edit, so its positional names are not renamed (D348:
 * profileOf orders an outline's attached circles before loops drawn earlier, so such an old node's hole numbers can still shift).
 */
function replaced(old: SketchNode, next: SketchNode): SketchNode {
  const out: Record<string, unknown> = { ...next };
  if (!old.sideTags) delete out.sideTags;
  const from = old as unknown as Record<string, unknown>;
  for (const key of ['plane', 'on', 'construction', ...NODE_EXTRA_FIELDS]) if (from[key] !== undefined) out[key] = from[key];
  return out as unknown as SketchNode;
}

export function outlineFields(nodes: Nodes, s: number, prefix: string): EditField[] {
  const sk = nodes[s] as SketchNode | undefined;
  if (!sk || sk.kind !== 'sketch' || !sk.outline) return [];
  const outline = (n: Nodes) => (n[s] as SketchNode).outline!;
  return drivingDimensions(sk.outline).map((key): EditField => {
    const label = dimensionLabel(outlinePolygon(sk.outline!), key);
    return {
      kind: 'number', key: prefix + 'o' + key, label: prefix + label, unit: key.startsWith('ang') ? '°' : 'mm',
      get: n => drivingValue(outline(n), key) ?? dimensionValue(outlinePolygon(outline(n)), key) ?? NaN,
      set: (n, v) => {
        // The reopened main shape: the outline with its side ids and attached circles' ids, so the edit renumbers nothing.
        const old = n[s] as SketchNode, { shape, done } = sketchShapes(old);
        if (!shape || shape.kind !== 'polygon') return n as ModelNode[];
        const r = commitDimension(shape, key, v);
        if (!r.ok) return n as ModelNode[];
        // The whole profile again: the re-solved outline (its circles with it) and the sketch's other loops.
        const next = profileOf([r.shape, ...done]);
        if ('error' in next) return n as ModelNode[];
        return n.map((x, k) => k === s ? replaced(old, next.node) : x);
      },
    };
  });
}
