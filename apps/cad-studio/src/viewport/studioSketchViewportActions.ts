import type { Dispatch, RefObject, SetStateAction } from 'react';
import { toggleBandPick } from '@barocss/cad-model/sketch/band';
import { commitDimension, isSettled } from '@barocss/cad-model/sketch/rules';
import { sketchClick } from '@barocss/cad-model/sketch/select';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import type { SceneSketchActions } from './SceneViewport';

interface SketchViewportInputs {
  liveShape: RefObject<SketchShape | null>;
  setSketch: Dispatch<SetStateAction<SketchState | null>>;
  setSketchError(reason: string): void;
  updateShape: SceneSketchActions['onSketchShape'];
  trimSketch: NonNullable<SceneSketchActions['onSketchTrim']>;
}

/** Viewport gestures use Studio's existing sketch state and shape history. */
export function studioSketchViewportActions({ liveShape, setSketch, setSketchError, updateShape, trimSketch }: SketchViewportInputs): SceneSketchActions {
  return {
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
    onDimCommit(key, value) {
      const shape = liveShape.current;
      setSketch(sketch => sketch && { ...sketch, editDim: null });
      if (!isSettled(shape)) return;
      const result = commitDimension(shape, key, value);
      if (result.ok) updateShape(result.shape);
      else setSketchError(result.reason);
    },
  };
}
