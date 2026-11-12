import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchState } from '@barocss/cad-model/sketch/types';
import { sketchCutInputs } from '../app/sketchControls';
import { DRAG_TRIM_MAX_PATH_POINTS, planDragTrim } from '../sketch/dragTrimPlan';

const DRAG_PIXELS = 5;

export type DragTrimPlan = ReturnType<typeof planDragTrim>;
export type DragTrimOwner = { sketch: SketchState; doc: StudioDoc; scope: object };
const sameOwner = (a: DragTrimOwner, b: DragTrimOwner | null) =>
  !!b && a.sketch === b.sketch && a.doc === b.doc && a.scope === b.scope;
type Stroke = {
  owner: DragTrimOwner;
  pointer: number;
  frame: string;
  start: P2;
  points: P2[];
  input: ReturnType<typeof sketchCutInputs>;
  dragging: boolean;
  plan: DragTrimPlan | null;
};
export type DragTrimPreview = { path: readonly P2[]; intervals: readonly (readonly [P2, P2])[] };
type Release = { kind: 'click' | 'discard' } | { kind: 'plan'; owner: DragTrimOwner; plan: DragTrimPlan };

export class DragTrimStroke {
  private stroke: Stroke | null = null;
  private ignored = new Map<number, 'press' | 'second'>();

  interceptDown(pointer: number): boolean {
    this.ignored.delete(pointer);
    if (!this.stroke) return false;
    const active = this.stroke.pointer;
    this.cancel();
    if (active !== pointer) this.ignored.set(pointer, 'second');
    return true;
  }

  begin(owner: DragTrimOwner, pointer: number, frame: string, pixel: P2, point: P2) {
    this.stroke = { owner, pointer, frame, start: pixel, points: [point], input: sketchCutInputs(owner.sketch),
      dragging: false, plan: null };
  }

  ignore(pointer: number) { this.ignored.set(pointer, 'press'); }

  owns(pointer: number): boolean {
    return this.stroke?.pointer === pointer || this.ignored.has(pointer);
  }

  cancel(pointer?: number): boolean {
    const s = this.stroke;
    if (!s || (pointer !== undefined && s.pointer !== pointer)) return false;
    this.stroke = null;
    this.ignore(s.pointer);
    return true;
  }

  terminate(pointer: number): boolean {
    if (this.cancel(pointer)) return true;
    return this.ignored.get(pointer) === 'second' && this.ignored.delete(pointer);
  }

  advance(pointer: number, owner: DragTrimOwner | null, frame: string, pixel: P2, point: P2 | null): boolean {
    const s = this.stroke;
    if (!s || s.pointer !== pointer) return this.ignored.has(pointer);
    if (!sameOwner(s.owner, owner) || frame !== s.frame || !point?.every(Number.isFinite)) {
      this.cancel(pointer);
      return true;
    }
    s.dragging ||= Math.hypot(pixel[0] - s.start[0], pixel[1] - s.start[1]) >= DRAG_PIXELS;
    const last = s.points.at(-1)!;
    if (point[0] !== last[0] || point[1] !== last[1]) {
      if (s.points.length >= DRAG_TRIM_MAX_PATH_POINTS) s.plan = { error: 'The Trim stroke has too many points.' };
      else {
        s.points.push(point);
        if (s.dragging) s.plan = planDragTrim(s.input.shapes, s.points, s.input.protectedShapes);
      }
    }
    return s.dragging;
  }

  release(pointer: number, owner: DragTrimOwner | null, frame: string, pixel: P2, point: P2 | null): Release {
    if (this.ignored.delete(pointer)) return { kind: 'discard' };
    const s = this.stroke;
    if (!s || s.pointer !== pointer) return { kind: 'click' };
    this.advance(pointer, owner, frame, pixel, point);
    this.stroke = null;
    if (this.ignored.delete(pointer)) return { kind: 'discard' };
    return s.dragging ? s.plan ? { kind: 'plan', owner: s.owner, plan: s.plan } : { kind: 'discard' } : { kind: 'click' };
  }

  preview(owner: DragTrimOwner | null, frame: () => string): DragTrimPreview | null {
    const s = this.stroke;
    if (!s) return null;
    if (!sameOwner(s.owner, owner) || s.frame !== frame()) { this.cancel(); return null; }
    if (!s.dragging) return null;
    return { path: s.points, intervals: s.plan && 'intervals' in s.plan ? s.plan.intervals : [] };
  }
}
