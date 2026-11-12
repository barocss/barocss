import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { nextIdOf } from '@barocss/cad-model/sketch/entityIds';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { detachSketchLink, switchTool } from '../app/sketchControls';
import { prepareArcPathGap, type ArcPathGapPlan, type PreparedArcPathGap } from './arcPathGap';

export interface ArcPathGapDraft {
  source: PreparedArcPathGap;
  length: string;
  notice?: string;
}
interface OwnedDraft extends ArcPathGapDraft {
  doc: StudioDoc;
  sketch: SketchState;
  generation: number;
}

export interface ArcPathGapInput {
  read(owner: SketchState | null): ArcPathGapDraft | null;
  apply(owner: SketchState, draft: ArcPathGapDraft, plan: ArcPathGapPlan | null): void;
}

export function useArcPathGap(doc: StudioDoc, sketch: SketchState | null, docNow: RefObject<StudioDoc>,
  generation: RefObject<number>, setSketch: Dispatch<SetStateAction<SketchState | null>>) {
  const [draft, setDraft] = useState<OwnedDraft | null>(null);
  const current = useRef<OwnedDraft | null>(null);
  const change = (next: OwnedDraft | null) => { current.current = next; setDraft(next); };
  const read = (owner: SketchState | null) => {
    const value = current.current;
    return value && value.sketch === owner && value.doc === docNow.current && value.generation === generation.current ? value : null;
  };
  const renderedGeneration = generation.current;
  const visible = draft?.sketch === sketch && draft.doc === doc && draft.generation === renderedGeneration ? draft : null;
  useEffect(() => {
    if (draft && !visible && current.current === draft) { current.current = null; setDraft(null); }
  }, [draft, visible]);
  const source = useMemo(() => {
    if (sketch?.tool !== 'trim' || sketch.shape || sketch.hideConstruction) return null;
    const references = (sketch.done ?? []).filter(shape => shape.construction);
    return references.length === 1 ? prepareArcPathGap(references[0]) : null;
  }, [sketch]);
  const input: ArcPathGapInput = {
    read,
    apply(owner, expected, plan) {
      const value = read(owner);
      if (!value || value !== expected) return;
      if (!plan) { change({ ...value, notice: 'The gap must fit inside the arc.' }); return; }
      const shape = value.source.shape;
      const done = owner.done ?? [], index = done.indexOf(shape);
      if (index < 0) return;
      const [a, b] = shape.points, [startId, endId] = shape.ids;
      const next = nextIdOf(done);
      const first: SketchShape = { kind: 'polygon', points: [a, plan.cutA], bulges: [plan.bulges[0], 0],
        closed: false, pending: false, construction: true, ids: [startId, `e${next}`] };
      const last: SketchShape = { kind: 'polygon', points: [plan.cutB, b], bulges: [plan.bulges[1], 0],
        closed: false, pending: false, construction: true, ids: [`e${next + 1}`, endId] };
      const replacement = [...done.slice(0, index), first, last, ...done.slice(index + 1)];
      change(null);
      setSketch(ownerNow => ownerNow === owner
        ? switchTool({ ...detachSketchLink(ownerNow), done: replacement }, 'select')
        : ownerNow);
    },
  };
  return {
    input, visible, available: source !== null,
    toggle() {
      if (read(sketch)) { change(null); return; }
      if (source && sketch && docNow.current === doc && generation.current === renderedGeneration)
        change({ doc, sketch, generation: renderedGeneration, source, length: '4' });
    },
    setLength(length: string) {
      const value = read(sketch);
      if (value) change({ ...value, length, notice: undefined });
    },
    cancel() {
      if (!current.current) return false;
      const owned = read(sketch) !== null;
      change(null);
      return owned;
    },
  };
}
