import type { Dispatch, RefObject, SetStateAction } from 'react';
import { toggleBandPick } from '@barocss/cad-model/sketch/band';
import type { SketchNode } from '@barocss/cad-model/engine/doc';
import { ellipseMatches } from '@barocss/cad-model/sketch/ellipse';
import { isDefaultPlane } from '@barocss/cad-model/sketch/plane';
import { commitDimension, commitInlineDimension, dimensionValue, drivingDimensionValue, isVerifiedFixedTriangleEdit, type Polygon } from '@barocss/cad-model/sketch/rules';
import { sketchClick } from '@barocss/cad-model/sketch/select';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { matchesStoredTriangle } from '../sketch/fixedTriangleEditor';
import type { SceneSketchActions } from './SceneViewport';

interface ReopenedSketchSource { source: SketchNode; recoveredLengths: WeakSet<Polygon> }

interface SketchViewportInputs {
  liveShape: RefObject<SketchShape | null>;
  sketch: SketchState | null;
  currentSketchSource(): ReopenedSketchSource | undefined;
  setSketch: Dispatch<SetStateAction<SketchState | null>>;
  setSketchError(reason: string): void;
  updateShape: SceneSketchActions['onSketchShape'];
  trimSketch: NonNullable<SceneSketchActions['onSketchTrim']>;
}

/** Authoring may recover only the stored, literal main outline of a single XY sketch. */
function canRecoverLength(sketch: SketchState | null, opened: ReopenedSketchSource | undefined, source: Polygon): boolean {
  const node = opened?.source;
  if (!sketch || sketch.shape !== source || !isDefaultPlane(sketch.plane) ||
    sketch.done?.length || sketch.band || sketch.association || sketch.associationDetached ||
    node?.profile !== 'polygon' || node.on || node.association ||
    node.regions?.length || node.holes?.length || node.construction?.length) return false;

  // A recovered shape is admitted only by identity in the edit session that produced it.
  if (opened?.recoveredLengths.has(source)) return true;
  return matchesStoredTriangle(node, source);
}

/** Viewport gestures use Studio's existing sketch state and shape history. */
export function studioSketchViewportActions({ liveShape, sketch, currentSketchSource, setSketch, setSketchError, updateShape, trimSketch }: SketchViewportInputs): SceneSketchActions & { recoverPanelLength(source: Polygon, edge: number, value: number): boolean } {
  const applyDimension = (opened: ReopenedSketchSource | undefined, source: Polygon, key: string, value: number) => {
    const result = opened ? commitInlineDimension(source, key, value) : commitDimension(source, key, value);
    if (!result.ok) { setSketchError(result.reason); return; }
    if (opened && isVerifiedFixedTriangleEdit(result.shape, source)) opened.recoveredLengths.add(result.shape);
    updateShape(result.shape);
  };
  return {
    recoverPanelLength(source: Polygon, edge: number, value: number): boolean {
      if (edge !== 2) return false;
      if (liveShape.current !== source) return true;
      const opened = currentSketchSource();
      if (!opened || !canRecoverLength(sketch, opened, source)) return false;
      if (value !== source.lengths?.[edge]) applyDimension(opened, source, 'len2', value);
      return true;
    },
    onSketchShape: updateShape,
    onSketchTrim: trimSketch,
    onSketchPick(hit, additive) {
      const source = liveShape.current;
      if (sketch?.tool === 'dimension' && hit?.kind === 'edge' && source === sketch.shape
        && source?.kind === 'polygon' && ellipseMatches(source)) {
        setSketchError('Edit Rx or Ry in the Ellipse section.');
        setSketch(current => current === sketch ? { ...current, picked: [], editDim: null } : current);
        return;
      }
      setSketch(current => current && sketchClick(current, hit, additive));
    },
    onSketchBandPick: index => setSketch(sketch => sketch && index !== null ? toggleBandPick(sketch, index) : sketch),
    onDimClick(key) {
      const input = document.getElementById('sk-' + key) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    },
    onDimEdit: editDim => setSketch(sketch => sketch && { ...sketch, editDim }),
    onDimCommit(key, value, source) {
      if (liveShape.current !== source) return;
      const opened = key === 'len2' ? currentSketchSource() : undefined;
      setSketch(sketch => sketch && { ...sketch, editDim: null });
      if (value === drivingDimensionValue(source, key)) return;
      // An attached circle already stores its size. Confirming it adds no constraint.
      if (key.startsWith('cdia') && value === dimensionValue(source, key)) return;
      applyDimension(canRecoverLength(sketch, opened, source) ? opened : undefined, source, key, value);
    },
  };
}
