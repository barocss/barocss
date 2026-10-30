import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { EvalResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import type { TransformGizmo } from '../viewport/Viewport';
export type RouteBundleSession = {
  token: number; accepted: StudioDoc; acceptedIdentity: string;
  frozenStart: StudioDoc; frozenIdentity: string; bindings: string; bundleId: string;
  gesture: number; pointerId: number | null; sequence: number;
  purpose: 'draft' | 'preview' | 'final' | 'ready' | 'cancelled';
  delta: Vec3; gestureBase: Vec3;
  ready?: { candidate: StudioDoc; identity: string; evaluatedIdentity: string; result: Extract<EvalResult, { ok: true }>; sequence: number; gesture: number; pointerId: number | null };
};
// Optional GPU bridge contract; the GPU owner supplies these fields in the shared viewport.
export type RouteTransformGizmo = TransformGizmo & {
  sessionKey: string;
  onStart(pointerId: number): void;
  onCancel(pointerId: number, reason: 'pointercancel' | 'lostpointercapture' | 'session-change' | 'unmount'): void;
  onMove(delta: Vec3, done: boolean, pointerId?: number): void;
};
export const routeBindings = (doc: StudioDoc) => JSON.stringify(doc.routeBundles?.map(b => ({ id: b.id, tie: b.tie, members: b.members })) ?? []);
export const routeNumbers = (values: [string, string, string]): Vec3 => {
  if (values.some(v => !v.trim() || !Number.isFinite(Number(v)))) throw new Error('Enter three finite coordinates in mm.');
  return values.map(Number) as Vec3;
};
export const routeMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);

