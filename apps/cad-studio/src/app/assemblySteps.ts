import type { Command } from '@barocss/cad-model/app/commands';
import type { AssemblyStep, StudioDoc } from '@barocss/cad-model/engine/doc';
import type { RenderCamera } from '@barocss/cad-model/engine/render';
import { stepOfOccurrence, stepStateOf, stepsOf, type StepState } from '@barocss/cad-model/assembly/steps';
import { OrbitCamera } from '../viewport/camera';
import { singleTop } from '../assembly/nestedSelection';

// Roadmap 10 ⑥: the Steps panel's pure rules — which parts a step shows, hides, highlights and fades, the explode scale and the camera it
// recommends, and what the selection offers. Display only: nothing here reads or writes a placement, a body, the BOM or an export; the
// session's position (which step is shown) is the panel's own and is never saved.

type Vec3 = [number, number, number];
/** The studio's own palette command that opens the Steps panel (the palette lists it after the model's). */
export const STEPS_COMMAND: Command = {
  id: 'assembly-steps', label: 'Assembly steps', icon: 'open_with', group: 'inspect', keywords: 'steps instructions assembly sequence order guide manual',
  hint: 'Explain how the assembly goes together, step by step: the parts each step adds, a view and an explode scale (display only)',
  available: ctx => ctx.doc.instances?.length ? { ok: true } : { ok: false, reason: 'Assembly steps need placed parts: add a part to the assembly first.' },
};

/** What the viewport shows for one step. */
export interface StepsDisplay {
  state: StepState;
  /** Placed parts left out of the view (waiting parts, unless they are shown faded). */
  hidden: ReadonlySet<string>;
  /** Parts kept opaque while the others fade (the viewer's isolate), or undefined when nothing fades. */
  opaque: readonly string[] | undefined;
  /** The step's own parts, drawn highlighted. */
  highlight: readonly string[];
  /** The display-only explode scale: the step's, or 0. */
  explode: number;
}
/** The step `index` (clamped into the steps) as the viewport shows it; null when the document has no steps. `faded`: waiting parts drawn faded instead of left out. */
export function stepsDisplay(doc: Pick<StudioDoc, 'assemblySteps' | 'instances'>, index: number, faded: boolean): StepsDisplay | null {
  const n = stepsOf(doc).length; if (!n) return null;
  const state = stepStateOf(doc, clampStep(index, n)), waiting = state.waiting;
  return { state, hidden: faded ? new Set() : new Set(waiting), opaque: faded && waiting.length ? [...state.installed, ...state.active] : undefined, highlight: state.active, explode: state.step.explode ?? 0 };
}
/** A position kept among `count` steps (0 when there are none). */
export const clampStep = (index: number, count: number): number => count > 0 ? Math.max(0, Math.min(count - 1, Math.trunc(Number.isFinite(index) ? index : 0))) : 0;
/** The position after moving `by` steps, kept among the steps (Prev and Next stop at the ends). */
export const stepAfter = (index: number, by: number, count: number): number => clampStep(index + by, count);

/** The orbit camera a recommended view means: the eye's distance and direction from the target. (The orbit camera does not roll, so `up` is kept in the file but the viewer's own up, +Z, is used.) */
export function cameraOfView(view: NonNullable<AssemblyStep['view']>, now: Pick<RenderCamera, 'fovY' | 'ortho'>): RenderCamera {
  const d: Vec3 = [view.eye[0] - view.target[0], view.eye[1] - view.target[1], view.eye[2] - view.target[2]], distance = Math.max(1, Math.hypot(d[0], d[1], d[2]));
  return { target: [...view.target], distance, yaw: Math.atan2(d[1], d[0]), pitch: Math.asin(Math.max(-1, Math.min(1, d[2] / distance))), fovY: now.fovY, ortho: now.ortho };
}
/** The recommended view that records a camera: where its eye is, what it looks at and which way is up. */
export function viewOfCamera(camera: RenderCamera): NonNullable<AssemblyStep['view']> {
  const c = new OrbitCamera(); c.target = [...camera.target]; c.distance = camera.distance; c.yaw = camera.yaw; c.pitch = camera.pitch;
  const b = c.basis(), r = (v: number[]) => v.map(x => +x.toFixed(4)) as Vec3;
  return { eye: r(b.eye), target: r(camera.target), up: r(b.up) };
}

/** What the selection offers while the panel is open: the step that introduces the one selected part (when it is not the shown one), or that it is in no step. */
export type StepOffer = { kind: 'go'; index: number; name: string; part: string } | { kind: 'none'; part: string } | null;
export function stepOffer(doc: Pick<StudioDoc, 'assemblySteps' | 'instances'>, selection: readonly string[], shown: number): StepOffer {
  const id = singleTop(selection); if (!id || !doc.instances?.some(i => i.id === id)) return null;
  const at = stepOfOccurrence(doc, id);
  if (!at) return stepsOf(doc).length ? { kind: 'none', part: id } : null;
  return at.index === shown ? null : { kind: 'go', index: at.index, name: at.step.name, part: id };
}

/** The selection the viewport lights (outline and gizmo) while a step is shown: entries on a hidden (waiting) part are left out, host or nested path alike. */
export const shownSelection = (selection: readonly string[], hidden: ReadonlySet<string>): readonly string[] =>
  hidden.size ? selection.filter(id => !hidden.has(id.split('/')[0])) : selection;
