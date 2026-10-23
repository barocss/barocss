import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import type { ViewState } from './renderer';

// How the studio shows its display modes and its picks (R2): the same on both renderers, WebGL2's (renderer.ts) and
// WebGPU's (gpuRenderer.ts). Each renderer keeps what is tuned for it (its ambient, shadow and AO, its shaders).

/** A surface in x-ray: its opacity (at most). */
export const XRAY_OPACITY = 0.25;
/** What is faded — the parts outside an isolation, a faded instance: its opacity times this. */
export const FADED = 0.15;
/** A ghost body's opacity (at most). */
export const GHOST_OPACITY = 0.35;
/** Edges' opacity. */
export const EDGE_OPACITY = 0.9;
/** Hidden lines dashed: the hidden part's share of the line's opacity, and its dash (CSS pixels on, off). */
export const HIDDEN_LINE_SHARE = 0.55;
export const HIDDEN_DASH: readonly [number, number] = [6, 4];
/** The section's hatch over a cut face: black at this opacity (its colour × 0.45 however it is lit). */
export const HATCH_OPACITY = 0.55;
/** Thread lines' opacity. */
export const THREAD_OPACITY = 0.55;
/** The accent, and a selected face's (and cap's) share of it. */
export const ACCENT: Vec3 = [0.910, 0.761, 0.353];
export const SELECT_MIX = 0.42;

/** The colours both renderers' themes share. */
export const PALETTE = {
  dark: { bgTop: [0.180, 0.188, 0.208] as Vec3, bgBottom: [0.094, 0.098, 0.106] as Vec3, grid: [0.55, 0.55, 0.57] as Vec3, base: [0.74, 0.75, 0.78] as Vec3, edge: [0.05, 0.05, 0.06] as Vec3 },
  light: { bgTop: [0.965, 0.972, 0.980] as Vec3, bgBottom: [0.780, 0.812, 0.851] as Vec3, grid: [0.30, 0.34, 0.40] as Vec3, base: [0.70, 0.74, 0.80] as Vec3, edge: [0.11, 0.14, 0.19] as Vec3 },
};

/** A body's faces as hovered (1) and selected (2): selection over hover. */
export function faceStateOf(view: ViewState, bi: number): Map<number, number> {
  const faceState = new Map<number, number>();
  if (view.hoverFace?.body === bi) faceState.set(view.hoverFace.face, 1);
  for (const f of view.selectedFaces) if (f.body === bi) faceState.set(f.face, 2);
  return faceState;
}
/** A body's edges as hovered (1) and selected (2): selection over hover. */
export function edgeStateOf(view: ViewState, bi: number): Map<number, number> {
  const edgeState = new Map<number, number>();
  if (view.hoverEdge?.body === bi) edgeState.set(view.hoverEdge.edge, 1);
  for (const e of view.selectedEdges) if (e.body === bi) edgeState.set(e.edge, 2);
  return edgeState;
}
