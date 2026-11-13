import type { SketchState, SketchTool } from '../viewport/Viewport';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { boxOnPlane, type SketchPlane } from '@barocss/cad-model/sketch/plane';
import { shapeNode } from '@barocss/cad-model/sketch/loops';
import { reopenedOrder } from '@barocss/cad-model/sketch/reopen';
import { joinOpen } from '@barocss/cad-model/sketch/trim';
import { startPicking } from '@barocss/cad-model/sketch/select';
import { bezierError } from '@barocss/cad-model/sketch/bezier';
import type { SketchShape } from '@barocss/cad-model/sketch/types';

/** Use the same ordered inputs for sketch hover and click. Hidden construction remains a boundary. */
export function sketchCutInputs(sketch: SketchState) {
  const shapes = sketch.editNode === undefined ? [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])]
    : reopenedOrder(sketch.shape, sketch.done ?? [], sketch.mainIds);
  const protectedShapes = sketch.hideConstruction ? new Set(shapes.filter(shape => shape !== sketch.shape && shape.construction)) : undefined;
  return { shapes, protectedShapes };
}
/** The outline order and joined open chains that Finish will assign side IDs to. */
export function sketchFinishInputs(sketch: SketchState) {
  const { shapes: authored, protectedShapes } = sketchCutInputs(sketch);
  const ready = authored.map(shape => shape.kind === 'polygon' && !shape.closed && !protectedShapes?.has(shape)
    ? { ...shape, pending: false } : shape);
  return { authored, protectedShapes, joined: joinOpen(ready, undefined, protectedShapes) };
}
/** A Bézier shape about to be shown (tool click or panel edit): refused with the reason when it makes no curve, else without `construction` (a Bézier is never one, D354). */
export function bezierEdit(shape: Extract<SketchShape, { kind: 'bezier' }>): { shape: SketchShape } | { error: string } {
  const why = bezierError(shape.poles); if (why) return { error: why };
  if (!shape.construction) return { shape };
  return { shape: (({ construction: _c, ...rest }) => rest as SketchShape)(shape) };
}
export const TOOLS: { tool: SketchTool; key: string; label: string; icon: string; hint: string }[] = [
  { tool: 'rectangle', key: 'R', label: 'Rectangle', icon: 'cad-sk-rect', hint: 'Click two corners' },
  { tool: 'circle', key: 'C', label: 'Circle', icon: 'cad-sk-circle', hint: 'Click centre, then radius' },
  { tool: 'polygon', key: 'L', label: 'Line', icon: 'cad-sk-line', hint: 'Click points, click the first point to close · A switches to arcs' },
  { tool: 'arc', key: 'A', label: 'Arc', icon: 'cad-sk-arc', hint: 'Click the arc end, move to bend it, click to place · L back to lines' },
  { tool: 'carc', key: 'Q', label: 'Centre arc', icon: 'cad-sk-carc', hint: 'Click the centre, then the start (the radius), then turn to the end and click · it joins lines that meet its ends' },
  { tool: 'ellipse', key: 'I', label: 'Ellipse', icon: 'cad-sk-ellipse', hint: 'Click the centre, the end of the first axis, then a point that sets the other semi-axis · kept as tangent arcs; Make curves keeps it exact' },
  { tool: 'slot', key: 'O', label: 'Slot', icon: 'cad-sk-slot', hint: 'Click both centres, then the width' },
  { tool: 'spline', key: 'P', label: 'Spline', icon: 'cad-sk-spline', hint: 'Click points the curve runs smoothly through · click the first point to close it · it is kept as tangent arcs' },
  { tool: 'bezier', key: 'B', label: 'Bézier', icon: 'cad-sk-spline', hint: 'Click control points: three make a quadratic, a fourth a cubic; the curve does not pass through the middle points' },
  { tool: 'band', key: 'M', label: 'Band', icon: 'cad-sk-band', hint: 'Click closed shapes (construction circles, slots, polygons) to pick them, then Make band · one outline wraps them all; it follows when they move' },
  { tool: 'trim', key: 'T', label: 'Trim', icon: 'cad-sk-trim', hint: 'Click to trim one piece, or drag across up to three straight lines' },
  { tool: 'extend', key: 'E', label: 'Extend', icon: 'cad-sk-extend', hint: 'Click near the open end of a line or arc to run it on to the next piece it meets' },
  { tool: 'split', key: 'K', label: 'Split', icon: 'cad-sk-split', hint: 'Click a line, arc or circle to split it in two there (a new point to constrain or trim to)' },
  { tool: 'select', key: 'S', label: 'Select', icon: 'cad-sk-select', hint: 'Click points and edges (Shift adds), then constrain them in the panel' },
  { tool: 'dimension', key: 'D', label: 'Dimension', icon: 'cad-sk-dim', hint: 'Click an edge, an arc or two points, type the value, Enter · double-click to edit' },
];
/**
 * What the sketch camera frames: the bodies' XY extent (at least 60 mm, so the 1 mm snap stays usable),
 * or a 120 × 80 mm working area with the origin near the lower left when the part is empty.
 */
/** The bodies' extent seen on a sketch plane (plane coordinates), at least 60 mm across. */
export function sketchRegion(bodies: BodyResult[], plane: SketchPlane): [[number, number], [number, number]] {
  if (!bodies.length) return [[-20, -20], [100, 60]];
  const min: [number, number] = [Infinity, Infinity], max: [number, number] = [-Infinity, -Infinity];
  for (const b of bodies) { const [lo, hi] = boxOnPlane(plane, b.mesh.bounds.min, b.mesh.bounds.max); for (const k of [0, 1]) { min[k] = Math.min(min[k], lo[k]); max[k] = Math.max(max[k], hi[k]); } }
  for (const k of [0, 1]) { const c = (min[k] + max[k]) / 2, half = Math.max(30, (max[k] - min[k]) / 2); min[k] = c - half; max[k] = c + half; }
  return [min, max];
}
/** Line and arc tools share one open chain; switching between them keeps it. */
export const switchTool = (s: SketchState, tool: SketchTool): SketchState => {
  if (tool === 'select' || tool === 'dimension') return startPicking(s, tool);
  s = { ...s, picked: [], editDim: null };
  if (tool !== 'band' && s.bandPicks) { s = { ...s }; delete s.bandPicks; } // (Picks belong to the Band tool.)
  const chain = s.shape?.kind === 'polygon' && !s.shape.closed && (tool === 'polygon' || tool === 'arc') && (s.tool === 'polygon' || s.tool === 'arc');
  if (chain && s.shape?.kind === 'polygon') return { ...s, tool, shape: { ...s.shape, pending: false } };
  // A closed shape stays in the sketch beside the next one; so does a construction line (open or not).
  // (So do open lines and arcs: pieces meeting end to end join into an outline, and Trim works on them.)
  const keep = s.shape && (shapeNode(s.shape) || ((s.shape.construction || s.shape.kind === 'bezier' || s.shape.kind === 'polygon') && (s.shape.kind !== 'polygon' || s.shape.points.length > 1)));
  if (!keep) return { ...s, tool, shape: null };
  const protectedShapes = s.hideConstruction && (tool === 'trim' || tool === 'extend' || tool === 'split')
    ? new Set((s.done ?? []).filter(shape => shape.construction)) : undefined;
  const done = joinOpen([...(s.done ?? []), { ...s.shape!, ...(s.shape!.kind === 'polygon' ? { pending: false } : {}) }], undefined, protectedShapes);
  return { ...s, tool, shape: null, done };
};

export const detachSketchLink = (s: SketchState): SketchState => s.association ? { ...s, association: undefined, associationDetached: true } : s;

