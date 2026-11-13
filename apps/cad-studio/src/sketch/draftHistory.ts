import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { reopenedOrder } from '@barocss/cad-model/sketch/reopen';
import { isSettled } from '@barocss/cad-model/sketch/rules';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { detachSketchLink } from '../app/sketchControls';

type OutlineStep = { kind: 'outline'; shape: SketchShape };
type DraftStep = Pick<SketchState, 'shape' | 'done' | 'association' | 'associationDetached' | 'plane' | 'editNode' | 'mainIds' | 'tool'> & {
  kind: 'draft';
  doc: StudioDoc;
};
type SketchStep = OutlineStep | DraftStep;

export function outlineHistoryState(shape: SketchShape): OutlineStep {
  return { kind: 'outline', shape };
}

export function draftHistoryState(doc: StudioDoc, sketch: SketchState, shape = sketch.shape): DraftStep {
  return { kind: 'draft', doc, shape, done: sketch.done, plane: sketch.plane, editNode: sketch.editNode,
    mainIds: sketch.mainIds, tool: sketch.tool, association: sketch.association, associationDetached: sketch.associationDetached };
}

function orderedStraightDraft(step: Omit<DraftStep, 'kind' | 'doc'>): SketchShape[] | null {
  const ids = step.mainIds;
  if (step.editNode === undefined || !ids?.length
    || (step.tool !== 'trim' && step.tool !== 'select' && step.tool !== 'dimension')) return null;
  const ordered = reopenedOrder(step.shape, step.done ?? [], ids), main = ordered[0];
  if (!isSettled(main) || main.construction || main.bulges?.some(Boolean) || main.spline || main.ellipse || main.circles?.length
    || main.ids?.length !== ids.length || !ids.every((id, i) => main.ids?.[i] === id)) return null;
  return ordered;
}

function sameMainOutline(a: SketchShape, b: SketchShape): boolean {
  if (a === b) return true;
  if (!isSettled(a) || !isSettled(b)) return false;
  // Trim can copy a settled polygon and set pending to false when it moves into done.
  const left = Object.entries(a).filter(([key]) => key !== 'pending');
  const right = Object.entries(b).filter(([key]) => key !== 'pending');
  return left.length === right.length && left.every(([key, value]) =>
    Object.hasOwn(b, key) && Object.is(value, (b as unknown as Record<string, unknown>)[key]));
}

function matches(expected: SketchStep, current: SketchStep): boolean {
  if (expected.kind === 'outline') {
    if (expected.shape === current.shape) return true;
    const main = current.kind === 'draft' ? orderedStraightDraft(current)?.[0] : undefined;
    return !!main && sameMainOutline(expected.shape, main);
  }
  if (current.kind !== 'draft' || expected.doc !== current.doc || expected.plane !== current.plane
    || expected.editNode !== current.editNode || expected.mainIds !== current.mainIds
    || expected.association !== current.association || expected.associationDetached !== current.associationDetached) return false;
  if (expected.shape === current.shape && expected.done === current.done) return true;
  const a = orderedStraightDraft(expected), b = orderedStraightDraft(current);
  return !!a && !!b && a.length === b.length && sameMainOutline(a[0], b[0])
    && a.slice(1).every((shape, i) => shape === b[i + 1]);
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
  if (step.kind === 'outline') {
    const restored = { ...detachSketchLink(sketch), shape: step.shape, picked: [], editDim: null };
    if (sketch.tool !== 'trim' || sketch.shape) return restored;
    const main = orderedStraightDraft(sketch)?.[0];
    return main ? { ...restored, shape: null, done: sketch.done?.map(shape => shape === main ? step.shape : shape) } : restored;
  }
  const restored = { ...sketch, shape: step.shape, done: step.done, association: step.association,
    associationDetached: step.associationDetached, picked: [], editDim: null };
  if (step.tool === sketch.tool || (sketch.tool !== 'select' && sketch.tool !== 'dimension')) return restored;
  const ordered = orderedStraightDraft(step);
  return ordered ? { ...restored, shape: ordered[0], done: ordered.slice(1) } : restored;
}
