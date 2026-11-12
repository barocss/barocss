import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { pointAlongSnap, shapeSnaps, type SnapPoint } from '@barocss/cad-model/sketch/osnap';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import type { ViewportHandle } from '../viewport/Viewport';

type Point = SnapPoint['at'];
type Mode = 'ratio' | 'distance';
interface Draft {
  doc: StudioDoc;
  sketch: SketchState;
  generation: number;
  points: SnapPoint[];
  a?: Point;
  b?: Point;
  mode: Mode;
  value: string;
  problem?: string;
}

function result(draft: Draft): Point | null {
  const { a, b, value, mode } = draft;
  if (!a || !b || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  return pointAlongSnap(a, b, mode, Number(value));
}

export interface TwoPointSnapInput {
  read(): { points: readonly SnapPoint[]; picking: boolean; preview: Point | null } | null;
  pick(point: SnapPoint | null): void;
}

export function useTwoPointSnap(doc: StudioDoc, sketch: SketchState | null, docNow: RefObject<StudioDoc>,
  generation: RefObject<number>, viewport: RefObject<ViewportHandle | null>) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = useRef<Draft | null>(null);
  const change = (next: Draft | null) => { current.current = next; setDraft(next); };
  const owned = () => {
    const value = current.current;
    return value && value.doc === docNow.current && value.generation === generation.current ? value : null;
  };
  const renderedGeneration = generation.current;
  const visible = draft?.doc === doc && draft.sketch === sketch && draft.generation === renderedGeneration ? draft : null;
  useEffect(() => {
    if (draft && !visible && current.current === draft) { current.current = null; setDraft(null); }
  }, [draft, visible]);
  const points = useMemo(() => sketch?.tool === 'rectangle' && !sketch.shape && !sketch.construct && !sketch.hideConstruction
    ? (sketch.done ?? []).flatMap(shape => shape.construction ? shapeSnaps(shape).filter(point => point.kind === 'end') : [])
    : [], [sketch]);
  const available = points.length > 1;
  const input: TwoPointSnapInput = {
    read() {
      const value = owned();
      return value ? { points: value.points, picking: !value.b, preview: result(value) } : null;
    },
    pick(point) {
      const value = owned();
      if (!value || value.b) return;
      if (!point) { change({ ...value, problem: 'Pick a construction endpoint.' }); return; }
      if (!value.a) { change({ ...value, a: point.at, problem: undefined }); return; }
      if (!pointAlongSnap(value.a, point.at, 'ratio', 0)) {
        change({ ...value, problem: 'Pick a different endpoint.' });
        return;
      }
      change({ ...value, b: point.at, problem: undefined });
    },
  };
  return {
    visible, available, input,
    preview: visible ? result(visible) : null,
    begin() {
      if (sketch && available && docNow.current === doc && generation.current === renderedGeneration) change({ doc, sketch, points: [...points], generation: renderedGeneration, mode: 'ratio', value: '0.5' });
    },
    cancel() { if (!owned()) return false; change(null); return true; },
    setMode(mode: Mode) { const value = owned(); if (value) change({ ...value, mode }); },
    setValue(value: string) { const draft = owned(); if (draft) change({ ...draft, value }); },
    apply() {
      const value = owned(), at = value && result(value);
      if (!value || !at) return;
      // Retire before handing the point to the drawing gesture, including repeated submit events.
      change(null);
      if (!viewport.current?.startRectangleAt(value.sketch, at) && docNow.current === value.doc && generation.current === value.generation)
        change({ ...value, problem: 'Start a new rectangle before using the point.' });
    },
  };
}
