import { useEffect, useRef, useState, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { circleFromChord } from './circleFromChord';

export interface CircleChordDraft {
  first?: P2;
  second?: P2;
  radius: string;
  preview?: { radius: number; centers: readonly P2[] };
  problem?: string;
}

interface OwnedDraft extends CircleChordDraft {
  doc: StudioDoc;
  sketch: SketchState;
  generation: number;
}

export interface CircleChordInput {
  read(owner: SketchState | null): CircleChordDraft | null;
  pick(owner: SketchState, expected: CircleChordDraft, at: P2): void;
}

const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function useCircleFromChord(doc: StudioDoc, sketch: SketchState | null, docNow: RefObject<StudioDoc>,
  generation: RefObject<number>, draw: (shape: SketchShape, fresh: boolean) => void) {
  const [draft, setDraft] = useState<OwnedDraft | null>(null);
  const current = useRef<OwnedDraft | null>(null);
  const escaped = useRef(false);
  const change = (next: OwnedDraft | null) => { current.current = next; setDraft(next); };
  const read = (owner: SketchState | null) => {
    const value = current.current;
    return value && value.sketch === owner && value.doc === docNow.current && value.generation === generation.current ? value : null;
  };
  const renderedGeneration = generation.current;
  const visible = draft?.doc === doc && draft.sketch === sketch && draft.generation === renderedGeneration ? draft : null;
  useEffect(() => {
    if (draft && !visible && current.current === draft) { current.current = null; setDraft(null); }
  }, [draft, visible]);
  const available = sketch?.tool === 'circle' && !sketch.shape && !sketch.construct && !sketch.band;

  function cancel() {
    if (!read(sketch)) return false;
    change(null);
    return true;
  }

  const input: CircleChordInput = {
    read,
    pick(owner, expected, at) {
      const value = read(owner);
      if (!value || value !== expected || value.second) return;
      if (!value.first) { change({ ...value, first: [...at] }); return; }
      if (value.first[0] === at[0] && value.first[1] === at[1]) {
        change({ ...value, problem: 'Pick a different point.' });
        return;
      }
      change({ ...value, second: [...at], problem: undefined });
    },
  };

  return {
    input, available, visible, cancel,
    begin() {
      if (read(sketch) || !sketch || !available || docNow.current !== doc || generation.current !== renderedGeneration) return;
      change({ doc, sketch, generation: renderedGeneration, radius: '' });
    },
    escape(repeat: boolean) {
      if (!repeat) escaped.current = cancel();
      return escaped.current;
    },
    setRadius(text: string) {
      const value = read(sketch);
      if (!value?.first || !value.second) return;
      const raw = text.trim(), radius = decimal.test(raw) ? Number(raw) : NaN;
      const result = Number.isFinite(radius) ? circleFromChord(value.first, value.second, radius) : { error: 'Enter a finite radius.' };
      change({ ...value, radius: text, preview: 'centers' in result ? { radius, centers: result.centers } : undefined,
        problem: raw && 'error' in result ? result.error : undefined });
    },
    choose(expected: CircleChordDraft, index: number) {
      const value = read(sketch), preview = value?.preview, center = preview?.centers[index];
      if (!value || value !== expected || !preview || !center) return;
      change(null);
      draw({ kind: 'circle', c: [...center], r: preview.radius }, true);
    },
  };
}
