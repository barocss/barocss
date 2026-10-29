import type { SketchState, SketchTool } from '../viewport/Viewport';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { boxOnPlane, type SketchPlane } from '@barocss/cad-model/sketch/plane';
import { shapeNode } from '@barocss/cad-model/sketch/loops';
import { joinOpen } from '@barocss/cad-model/sketch/trim';
import { startPicking } from '@barocss/cad-model/sketch/select';
export const TOOLS: { tool: SketchTool; key: string; label: string; icon: string; hint: string }[] = [
  { tool: 'rectangle', key: 'R', label: 'Rectangle', icon: 'cad-sk-rect', hint: 'Click two corners' },
  { tool: 'circle', key: 'C', label: 'Circle', icon: 'cad-sk-circle', hint: 'Click centre, then radius' },
  { tool: 'polygon', key: 'L', label: 'Line', icon: 'cad-sk-line', hint: 'Click points, click the first point to close · A switches to arcs' },
  { tool: 'arc', key: 'A', label: 'Arc', icon: 'cad-sk-arc', hint: 'Click the arc end, move to bend it, click to place · L back to lines' },
  { tool: 'carc', key: 'Q', label: 'Centre arc', icon: 'cad-sk-carc', hint: 'Click the centre, then the start (the radius), then turn to the end and click · it joins lines that meet its ends' },
  { tool: 'slot', key: 'O', label: 'Slot', icon: 'cad-sk-slot', hint: 'Click both centres, then the width' },
  { tool: 'spline', key: 'P', label: 'Spline', icon: 'cad-sk-spline', hint: 'Click points the curve runs smoothly through · click the first point to close it · it is kept as tangent arcs' },
  { tool: 'trim', key: 'T', label: 'Trim', icon: 'cad-sk-trim', hint: 'Click a piece to cut it back to where it crosses others · pieces meeting end to end join into one outline' },
  { tool: 'extend', key: 'E', label: 'Extend', icon: 'cad-sk-extend', hint: 'Click near the open end of a line or arc to run it on to the next piece it meets' },
  { tool: 'split', key: 'K', label: 'Split', icon: 'cad-sk-split', hint: 'Click a line, arc or circle to split it in two there (a new point to constrain or trim to)' },
  { tool: 'select', key: 'S', label: 'Select', icon: 'cad-sk-select', hint: 'Click points and edges (Shift adds), then constrain them in the panel' },
  { tool: 'dimension', key: 'D', label: 'Dimension', icon: 'cad-sk-dim', hint: 'Click an edge, an arc or two points, type the value, Enter · double-click to edit' },
];
/** Floating panels over the viewport while sketching: toolbar on the left, sketch panel on the right (CSS px). */
export const SKETCH_INSETS = { left: 64, right: 272 };
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
  const chain = s.shape?.kind === 'polygon' && !s.shape.closed && (tool === 'polygon' || tool === 'arc') && (s.tool === 'polygon' || s.tool === 'arc');
  if (chain && s.shape?.kind === 'polygon') return { ...s, tool, shape: { ...s.shape, pending: false } };
  // A closed shape stays in the sketch beside the next one; so does a construction line (open or not).
  // (So do open lines and arcs: pieces meeting end to end join into an outline, and Trim works on them.)
  const keep = s.shape && (shapeNode(s.shape) || ((s.shape.construction || s.shape.kind === 'polygon') && (s.shape.kind !== 'polygon' || s.shape.points.length > 1)));
  return { ...s, tool, shape: null, ...(keep ? { done: joinOpen([...(s.done ?? []), { ...s.shape!, ...(s.shape!.kind === 'polygon' ? { pending: false } : {}) }]) } : {}) };
};

export const detachSketchLink = (s: SketchState): SketchState => s.association ? { ...s, association: undefined, associationDetached: true } : s;

