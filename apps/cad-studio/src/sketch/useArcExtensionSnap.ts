import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { arcExtensionGuide, prepareArcExtension, type ArcExtension } from './arcExtension';
import type { P2 } from '@barocss/cad-model/sketch/profile';

type Stage = 'end' | 'guide';
interface Draft {
  doc: StudioDoc;
  sketch: SketchState;
  generation: number;
  stage: Stage;
  arc: ArcExtension;
  guide: P2[];
}

export interface ArcExtensionInput {
  read(sketch: SketchState | null): Draft | null;
  arm(sketch: SketchState): void;
  consume(sketch: SketchState): void;
}

export function useArcExtensionSnap(doc: StudioDoc, sketch: SketchState | null, docNow: RefObject<StudioDoc>, generation: RefObject<number>) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = useRef<Draft | null>(null);
  const change = (next: Draft | null) => { current.current = next; setDraft(next); };
  const read = (owner: SketchState | null) => {
    const value = current.current;
    return value && value.sketch === owner && value.doc === docNow.current && value.generation === generation.current ? value : null;
  };
  const renderedGeneration = generation.current;
  const visible = draft?.sketch === sketch && draft.doc === doc && draft.generation === renderedGeneration ? draft : null;
  useEffect(() => {
    if (draft && !visible && current.current === draft) { current.current = null; setDraft(null); }
  }, [draft, visible]);
  const arc = useMemo(() => {
    if (sketch?.tool !== 'rectangle' || sketch.shape || sketch.construct || sketch.hideConstruction) return null;
    const arcs = (sketch.done ?? []).map(prepareArcExtension).filter(source => source !== null);
    return arcs.length === 1 ? arcs[0] : null;
  }, [sketch]);
  const input: ArcExtensionInput = {
    read,
    arm(owner) {
      const value = read(owner);
      if (value?.stage === 'end') change({ ...value, stage: 'guide' });
    },
    consume(owner) {
      if (read(owner)?.stage === 'guide') change(null);
    },
  };
  return {
    input,
    available: arc !== null,
    stage: visible?.stage,
    toggle() {
      if (read(sketch)) { change(null); return; }
      if (arc && sketch && doc === docNow.current && renderedGeneration === generation.current)
        change({ doc, sketch, generation: renderedGeneration, stage: 'end', arc, guide: arcExtensionGuide(arc) });
    },
    cancel() {
      if (!current.current) return false;
      const owned = read(sketch) !== null;
      change(null);
      return owned;
    },
  };
}
