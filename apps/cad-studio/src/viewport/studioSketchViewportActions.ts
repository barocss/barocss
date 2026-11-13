import type { Dispatch, RefObject, SetStateAction } from 'react';
import { toggleBandPick } from '@barocss/cad-model/sketch/band';
import type { ModelNode } from '@barocss/cad-model/engine/doc';
import { isDefaultPlane } from '@barocss/cad-model/sketch/plane';
import { commitDimension, commitInlineDimension, dimensionValue, drivingDimensionValue, type Polygon } from '@barocss/cad-model/sketch/rules';
import { sketchClick } from '@barocss/cad-model/sketch/select';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import type { SceneSketchActions } from './SceneViewport';

interface SketchViewportInputs {
  liveShape: RefObject<SketchShape | null>;
  sketch: SketchState | null;
  currentSketchSource(): ModelNode | undefined;
  setSketch: Dispatch<SetStateAction<SketchState | null>>;
  setSketchError(reason: string): void;
  updateShape: SceneSketchActions['onSketchShape'];
  trimSketch: NonNullable<SceneSketchActions['onSketchTrim']>;
}

/** Authoring may recover only the stored, literal main outline of a single XY sketch. */
function canRecoverLength(sketch: SketchState | null, node: ModelNode | undefined, source: Polygon): boolean {
  if (!sketch || sketch.shape !== source || !isDefaultPlane(sketch.plane) ||
    sketch.done?.length || sketch.band || sketch.association || sketch.associationDetached ||
    node?.kind !== 'sketch' || node.profile !== 'polygon' || node.on || node.association ||
    node.regions?.length || node.holes?.length || node.construction?.length) return false;

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

/** Viewport gestures use Studio's existing sketch state and shape history. */
export function studioSketchViewportActions({ liveShape, sketch, currentSketchSource, setSketch, setSketchError, updateShape, trimSketch }: SketchViewportInputs): SceneSketchActions & { recoverPanelLength(source: Polygon, edge: number, value: number): boolean } {
  return {
    recoverPanelLength(source: Polygon, edge: number, value: number): boolean {
      if (edge !== 2) return false;
      if (liveShape.current !== source) return true;
      if (!canRecoverLength(sketch, currentSketchSource(), source)) return false;
      if (value === source.lengths?.[edge]) return true;
      const result = commitInlineDimension(source, 'len2', value);
      if (result.ok) updateShape(result.shape);
      else setSketchError(result.reason);
      return true;
    },
    onSketchShape: updateShape,
    onSketchTrim: trimSketch,
    onSketchPick: (hit, additive) => setSketch(sketch => sketch && sketchClick(sketch, hit, additive)),
    onSketchBandPick: index => setSketch(sketch => sketch && index !== null ? toggleBandPick(sketch, index) : sketch),
    onDimClick(key) {
      const input = document.getElementById('sk-' + key) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    },
    onDimEdit: editDim => setSketch(sketch => sketch && { ...sketch, editDim }),
    onDimCommit(key, value, source) {
      if (liveShape.current !== source) return;
      const rawSource = key === 'len2' ? currentSketchSource() : undefined;
      setSketch(sketch => sketch && { ...sketch, editDim: null });
      if (value === drivingDimensionValue(source, key)) return;
      // An attached circle already stores its size. Confirming it adds no constraint.
      if (key.startsWith('cdia') && value === dimensionValue(source, key)) return;
      const edit = rawSource && canRecoverLength(sketch, rawSource, source) ? commitInlineDimension : commitDimension;
      const result = edit(source, key, value);
      if (result.ok) updateShape(result.shape);
      else setSketchError(result.reason);
    },
  };
}
