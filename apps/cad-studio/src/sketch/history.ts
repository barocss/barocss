// Undo / redo of edits to a closed outline while sketching (constraints, dimensions, typed values). Each
// step remembers the outline before and after; a step applies only while the sketch still shows the shape
// it left, so a new shape or a cleared profile never brings an old one back over it.
import type { SketchShape } from '../viewport/Viewport';

interface Step { before: SketchShape; after: SketchShape }

export class SketchHistory {
  private done: Step[] = [];
  private undone: Step[] = [];

  /** An edit of an outline that took `before` to `after`. */
  push(before: SketchShape, after: SketchShape) {
    if (before === after) return;
    this.done.push({ before, after }); this.undone = [];
    if (this.done.length > 100) this.done.shift();
  }
  /** The shape before the last edit, when `current` is what that edit left (null: nothing to undo). */
  undo(current: SketchShape | null): SketchShape | null {
    const step = this.done[this.done.length - 1];
    if (!step) return null;
    if (step.after !== current) { this.clear(); return null; }
    this.done.pop(); this.undone.push(step); return step.before;
  }
  /** The shape after the last undone edit, when `current` is what the undo left (null: nothing to redo). */
  redo(current: SketchShape | null): SketchShape | null {
    const step = this.undone[this.undone.length - 1];
    if (!step || step.before !== current) { this.undone = []; return null; }
    this.undone.pop(); this.done.push(step); return step.after;
  }
  clear() { this.done = []; this.undone = []; }
  get canUndo() { return this.done.length > 0; }
}
