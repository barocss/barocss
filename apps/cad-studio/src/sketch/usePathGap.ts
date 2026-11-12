import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { nextIdOf } from '@barocss/cad-model/sketch/entityIds';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { detachSketchLink, switchTool } from '../app/sketchControls';
import { preparePathGap, type PathGapPlan, type PreparedPathGap } from './pathGap';

export interface PathGapDraft {
  source: PreparedPathGap;
  length: string;
  notice?: string;
}
interface OwnedDraft extends PathGapDraft {
  doc: StudioDoc;
  sketch: SketchState;
  generation: number;
}

export interface PathGapInput {
  read(owner: SketchState | null): PathGapDraft | null;
  apply(owner: SketchState, draft: PathGapDraft, plan: PathGapPlan | null): void;
}

function constructionFragment(a: P2, b: P2, bulge: number, ids: [string, string]): SketchShape {
  return { kind: 'polygon', points: [a, b], bulges: [bulge, 0], closed: false, pending: false, construction: true, ids };
}

export function usePathGap(doc: StudioDoc, sketch: SketchState | null, docNow: RefObject<StudioDoc>,
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
    return references.length === 1 ? preparePathGap(references[0]) : null;
  }, [sketch]);
  const input: PathGapInput = {
    read,
    apply(owner, expected, plan) {
      const value = read(owner);
      if (!value || value !== expected) return;
      if (!plan) { change({ ...value, notice: `The gap must fit inside the ${value.source.kind}.` }); return; }
      const source = value.source;
      const done = owner.done ?? [], index = done.indexOf(source.shape);
      if (index < 0) return;
      const next = nextIdOf(done);
      const firstCutId = `e${next}`, secondCutId = `e${next + 1}`;
      let fragments: SketchShape[];
      if (source.kind === 'circle' && plan.kind === 'circle') {
        // A closed circle has no old endpoints. Retire its ID and identify both new ends.
        fragments = [constructionFragment(plan.cutB, plan.cutA, plan.bulges[0], [secondCutId, firstCutId])];
      } else if (source.kind !== 'circle' && plan.kind === 'segment') {
        const [a, b] = source.shape.points, [startId, endId] = source.shape.ids;
        fragments = [
          constructionFragment(a, plan.cutA, plan.bulges[0], [startId, firstCutId]),
          constructionFragment(plan.cutB, b, plan.bulges[1], [secondCutId, endId]),
        ];
      } else return;
      const replacement = [...done.slice(0, index), ...fragments, ...done.slice(index + 1)];
      change(null);
      setSketch(ownerNow => ownerNow === owner
        ? switchTool({ ...detachSketchLink(ownerNow), done: replacement }, 'select')
        : ownerNow);
    },
  };
  return {
    input, visible, kind: source?.kind ?? null,
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
