// The feature editor's fields for a sketch drawn as a constrained outline: one per driving dimension kept
// in the sketch node. Changing one re-solves the outline with all its constraints and rewrites the
// profile; a value the constraints cannot take leaves the nodes unchanged.
import type { ModelNode, SketchNode, SketchOutline } from '../engine/doc';
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
      : r.kind === 'cdist' || r.kind === 'cdx' || r.kind === 'cdy' ? [`${r.kind}${r.a}_${r.circle}`] : []),
    ...(o.circles ?? []).map((_, j) => 'cdia' + j)];
}

/** A driving dimension's value as typed (lengths, radii, distances, angles), not as re-measured from the solved points. */
export function drivingValue(o: SketchOutline, key: string): number | null {
  const m = /^(len|rad)(\d+)$/.exec(key);
  if (m) return (m[1] === 'len' ? o.lengths : o.radii)?.[Number(m[2])] ?? null;
  const cd = /^(cdist|cdx|cdy)(\d+)_(\d+)$/.exec(key);
  if (cd) { const r = (o.rules ?? []).find(x => x.kind === cd[1] && 'circle' in x && x.a === Number(cd[2]) && x.circle === Number(cd[3])); return r && 'value' in r ? r.value : null; }
  const cdia = /^cdia(\d+)$/.exec(key); if (cdia) { const c = o.circles?.[Number(cdia[1])]; return c ? c.r * 2 : null; }
  const d = /^(dist|dx|dy|ang)(\d+)_(\d+)$/.exec(key); if (!d) return null;
  const kind = ({ dist: 'distance', dx: 'dx', dy: 'dy', ang: 'angle' } as const)[d[1] as 'dist' | 'dx' | 'dy' | 'ang'];
  const r = (o.rules ?? []).find(x => x.kind === kind && 'b' in x && x.a === Number(d[2]) && x.b === Number(d[3]));
  return r && 'value' in r ? r.value : null;
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
        const r = commitDimension(outlinePolygon(outline(n)), key, v);
        if (!r.ok) return n as ModelNode[];
        // The whole profile again: the re-solved outline (its circles with it) and the sketch's other loops.
        const old = n[s] as SketchNode, next = profileOf([r.shape, ...sketchShapes(old).done]);
        if ('error' in next) return n as ModelNode[];
        return n.map((x, k) => k === s ? { ...next.node, ...(old.plane ? { plane: old.plane } : {}) } as SketchNode : x);
      },
    };
  });
}
