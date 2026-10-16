// The feature editor's fields for a sketch drawn as a constrained outline: one per driving dimension kept
// in the sketch node. Changing one re-solves the outline with all its constraints and rewrites the
// profile; a value the constraints cannot take leaves the nodes unchanged.
import type { ModelNode, SketchNode, SketchOutline } from '../engine/doc';
import type { EditField } from '../app/editFields';
import { shapeNode } from './loops';
import { commitDimension, dimensionLabel, dimensionValue, type Polygon } from './rules';

type Nodes = readonly ModelNode[];

/** A kept outline as the sketcher's closed polygon. */
export const outlinePolygon = (o: SketchOutline): Polygon => ({
  kind: 'polygon', closed: true, points: o.points.map(p => [p[0], p[1]] as [number, number]), bulges: o.bulges ? [...o.bulges] : o.points.map(() => 0),
  ...(o.lengths ? { lengths: o.lengths } : {}), ...(o.radii ? { radii: o.radii } : {}), ...(o.tangents ? { tangents: o.tangents } : {}),
  ...(o.equalRadii ? { equalRadii: o.equalRadii } : {}), ...(o.concentric ? { concentric: o.concentric } : {}), ...(o.hv ? { hv: o.hv } : {}), ...(o.rules ? { rules: o.rules } : {}),
});

/** The driving dimensions' keys of a kept outline, in the order the sketch panel lists them. */
export function drivingDimensions(o: SketchOutline): string[] {
  return [...Object.keys(o.lengths ?? {}).map(i => 'len' + i), ...Object.keys(o.radii ?? {}).map(i => 'rad' + i),
    ...(o.rules ?? []).flatMap(r => r.kind === 'distance' ? [`dist${r.a}_${r.b}`] : r.kind === 'dx' || r.kind === 'dy' || r.kind === 'angle' ? [`${r.kind === 'angle' ? 'ang' : r.kind}${r.a}_${r.b}`] : [])];
}

/** A driving dimension's value as typed (lengths, radii, distances, angles), not as re-measured from the solved points. */
export function drivingValue(o: SketchOutline, key: string): number | null {
  const m = /^(len|rad)(\d+)$/.exec(key);
  if (m) return (m[1] === 'len' ? o.lengths : o.radii)?.[Number(m[2])] ?? null;
  const d = /^(dist|dx|dy|ang)(\d+)_(\d+)$/.exec(key); if (!d) return null;
  const kind = ({ dist: 'distance', dx: 'dx', dy: 'dy', ang: 'angle' } as const)[d[1] as 'dist' | 'dx' | 'dy' | 'ang'];
  const r = (o.rules ?? []).find(x => x.kind === kind && 'a' in x && x.a === Number(d[2]) && x.b === Number(d[3]));
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
        const old = n[s] as SketchNode, next = shapeNode(r.shape);
        if (!next) return n as ModelNode[];
        const keep = { ...(old.plane ? { plane: old.plane } : {}), ...(old.regions ? { regions: old.regions } : {}), ...(old.holes ? { holes: old.holes } : {}) };
        return n.map((x, k) => k === s ? { ...next, ...keep } as SketchNode : x);
      },
    };
  });
}
