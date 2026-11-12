import type { ConstraintEntry } from '@barocss/cad-model/sketch/rules';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { createValueStore, type ValueStore } from '../state/valueStore';

export interface ConstraintInspection {
  owner: SketchState;
  entry: ConstraintEntry;
  input: 'pointer' | 'focus';
}

export type ConstraintInspectionStore = ValueStore<ConstraintInspection | null>;
export const createConstraintInspection = () => createValueStore<ConstraintInspection | null>(null);

export function clearConstraintInspection(store: ConstraintInspectionStore, owner: SketchState | null): boolean {
  const current = store.get();
  if (current?.owner !== owner) return false;
  store.set(null);
  return true;
}

/** A dimension draft stays open while focus moves between its editor and constraint inspection. */
export function keepsDimensionDraft(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-sketch-dimension-focus]');
}
