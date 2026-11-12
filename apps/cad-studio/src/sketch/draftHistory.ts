import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { detachSketchLink } from '../app/sketchControls';

type OutlineStep = { kind: 'outline'; shape: SketchShape };
type DraftStep = Pick<SketchState, 'shape' | 'done' | 'association' | 'associationDetached' | 'plane' | 'editNode'> & {
  kind: 'draft';
  doc: StudioDoc;
};
type SketchStep = OutlineStep | DraftStep;

export function outlineHistoryState(shape: SketchShape): OutlineStep {
  return { kind: 'outline', shape };
}

export function draftHistoryState(doc: StudioDoc, sketch: SketchState, shape = sketch.shape): DraftStep {
  return { kind: 'draft', doc, shape, done: sketch.done, plane: sketch.plane, editNode: sketch.editNode,
    association: sketch.association, associationDetached: sketch.associationDetached };
}

function matches(expected: SketchStep, current: SketchStep): boolean {
  if (expected.shape !== current.shape) return false;
  if (expected.kind === 'outline') return true;
  return current.kind === 'draft' && expected.doc === current.doc && expected.plane === current.plane
    && expected.editNode === current.editNode && expected.done === current.done
    && expected.association === current.association && expected.associationDetached === current.associationDetached;
}

type Edit = { before: SketchStep; after: SketchStep };

class DraftHistory {
  private done: Edit[] = [];
  private undone: Edit[] = [];

  push(before: SketchStep, after: SketchStep) {
    if (matches(before, after)) return;
    this.done.push({ before, after });
    this.undone = [];
    if (this.done.length > 100) this.done.shift();
  }

  undo(current: DraftStep): SketchStep | null {
    const step = this.done.at(-1);
    if (!step) return null;
    if (!matches(step.after, current)) { this.clear(); return null; }
    this.done.pop();
    this.undone.push(step);
    return step.before;
  }

  redo(current: DraftStep): SketchStep | null {
    const step = this.undone.at(-1);
    if (!step || !matches(step.before, current)) { this.undone = []; return null; }
    this.undone.pop();
    this.done.push(step);
    return step.after;
  }

  available(current: DraftStep): { undo: boolean; redo: boolean } {
    const undo = this.done.at(-1), redo = this.undone.at(-1);
    return { undo: !!undo && matches(undo.after, current), redo: !!redo && matches(redo.before, current) };
  }

  clear() {
    this.done = [];
    this.undone = [];
  }
}

export function createDraftHistory() {
  return new DraftHistory();
}

export function restoreDraftHistory(sketch: SketchState, step: SketchStep): SketchState {
  if (step.kind === 'outline') return { ...detachSketchLink(sketch), shape: step.shape, picked: [], editDim: null };
  return { ...sketch, shape: step.shape, done: step.done, association: step.association,
    associationDetached: step.associationDetached, picked: [], editDim: null };
}
