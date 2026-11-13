import type { ModelNode, SketchNode } from '@barocss/cad-model/engine/doc';
import { outlineOf } from '@barocss/cad-model/sketch/loops';
import { isDefaultPlane } from '@barocss/cad-model/sketch/plane';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { commitDimension, commitInlineDimension, isVerifiedFixedTriangleEdit, type Polygon } from '@barocss/cad-model/sketch/rules';

/** The authored recipe and the native polygon must name the same literal triangle. */
export function matchesStoredTriangle(node: Extract<SketchNode, { profile: 'polygon' }>, source: Polygon): boolean {
  const { outline, sideTags } = node;
  const fix = outline?.rules?.[0];
  return !!source.ids && source.ids.length === 3 && sideTags?.outer.length === 3 &&
    source.ids.every((id, i) => id === sideTags.outer[i]) &&
    source.points.length === 3 && node.points.length === 3 && outline?.points.length === 3 &&
    source.points.every((point, i) => point.length === 2 && node.points[i].length === 2 && outline.points[i].length === 2 &&
      point.every((coordinate, axis) => Number.isFinite(coordinate) && coordinate === node.points[i][axis] && coordinate === outline.points[i][axis])) &&
    Number.isFinite(outline.lengths?.[1]) && outline.lengths?.[1] === source.lengths?.[1] &&
    Number.isFinite(outline.lengths?.[2]) && outline.lengths?.[2] === source.lengths?.[2] &&
    outline.rules?.length === 1 && fix?.kind === 'fix' && fix.point === 1 && fix.at.length === 2 &&
    fix.at.every((coordinate, axis) => Number.isFinite(coordinate) && coordinate === source.points[1][axis]);
}

function isStraightTriangle(shape: Polygon): boolean {
  return !shape.construction && shape.closed && !shape.pending && !shape.bulges?.some(Boolean)
    && !shape.spline && !shape.ellipse && !shape.circles?.length
    && !shape.tangents?.length && !shape.equalRadii?.length && !shape.concentric?.length
    && !Object.keys(shape.radii ?? {}).length && Object.keys(shape.lengths ?? {}).length === 2
    && !!shape.hv && !shape.hv.h.length && !shape.hv.v.length
    && shape.rules?.length === 1 && shape.rules[0].kind === 'fix' && shape.rules[0].point === 1;
}

type FeatureLengthEdit = { nodes: ModelNode[] } | { reason: string };

/** The Extrude editor can recover only its owned, literal third-edge dimension. */
export function editExtrudeTriangleLength(original: ModelNode[], draft: ModelNode[], index: number,
  value: number, params: Record<string, number>, recovered: WeakSet<SketchNode>): FeatureLengthEdit | null {
  const feature = original[index];
  if (feature?.kind !== 'extrude' || draft[index]?.kind !== 'extrude' || draft[index].sketch !== feature.sketch) return null;
  const saved = original[feature.sketch], node = draft[feature.sketch];
  if (saved?.kind !== 'sketch' || saved.profile !== 'polygon' || node?.kind !== 'sketch' || node.profile !== 'polygon'
    || saved.on || saved.association || saved.regions?.length || saved.holes?.length || saved.construction?.length
    || (saved.plane && !isDefaultPlane(saved.plane))) return null;

  const read = (entry: SketchNode) => {
    try { return sketchShapes(entry, params); } catch { return null; }
  };
  const initial = read(saved);
  if (!initial || initial.done.length || initial.shape?.kind !== 'polygon' || !isStraightTriangle(initial.shape) || !matchesStoredTriangle(saved, initial.shape)) return null;
  const current = node === saved ? initial : read(node);
  if (!current || current.done.length || current.shape?.kind !== 'polygon' || !isStraightTriangle(current.shape) || !matchesStoredTriangle(node, current.shape)) return null;
  const shape = current.shape;
  if (!Number.isFinite(value)) return { reason: 'Enter a length for edge 3.' };
  if (value === shape.lengths?.[2]) return { nodes: draft };
  const solve = node === saved || recovered.has(node) ? commitInlineDimension : commitDimension;
  const result = solve(shape, 'len2', value);
  if (!result.ok) return { reason: result.reason };
  const outline = outlineOf(result.shape);
  if (!outline) return { reason: 'The edited triangle has no driving outline.' };
  const next = { ...node, points: outline.points, outline };
  if (isVerifiedFixedTriangleEdit(result.shape, shape)) recovered.add(next);
  return { nodes: draft.map((item, position) => position === feature.sketch ? next : item) };
}
