// How a placed occurrence's effective looks reach the renderers (roadmap 10 ①): its bodies drawn in the definition's colours
// (or the occurrence's own), face colours and hidden bodies as own bodies are. Pure and shared by the WebGL2 and WebGPU
// viewers, so the mapping is tested once; the renderers resolve it when the instances are set, never in a frame.
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { rgbOf } from '@barocss/cad-model/app/bodies';
import type { EffectiveLook } from '@barocss/cad-model/assembly/looks';

/** A body's look as drawn: its colour, its faces' colours by face name, and whether it is left out. */
export interface InstanceRenderLook { color?: Vec3; faces?: ReadonlyMap<string, Vec3>; hidden?: boolean }
/** The looks of an occurrence's bodies, by body key (a body with no look of its own has no entry). */
export type InstanceRenderLooks = ReadonlyMap<string, InstanceRenderLook>;

/** One effective look as drawn, or null when it changes nothing. */
export function renderLookOf(look: Pick<EffectiveLook, 'color' | 'faces' | 'hidden'>): InstanceRenderLook | null {
  const out: { color?: Vec3; faces?: ReadonlyMap<string, Vec3>; hidden?: boolean } = {};
  if (look.color) out.color = rgbOf(look.color) as Vec3;
  if (look.faces) { const faces = new Map<string, Vec3>(); for (const [name, c] of Object.entries(look.faces)) faces.set(name, rgbOf(c) as Vec3); if (faces.size) out.faces = faces; }
  if (look.hidden) out.hidden = true;
  return out.color || out.faces || out.hidden ? out : null;
}
/** The looks of bodies (effective, in the bodies' order) by body key; undefined when none has one. */
export function renderLooksOf(effective: readonly Pick<EffectiveLook, 'color' | 'faces' | 'hidden'>[], bodies: readonly Pick<BodyResult, 'key'>[]): InstanceRenderLooks | undefined {
  let out: Map<string, InstanceRenderLook> | undefined;
  bodies.forEach((b, k) => { const l = effective[k] && renderLookOf(effective[k]); if (l) (out ??= new Map()).set(b.key, l); });
  return out;
}
/** Each body's look, in order: the lookup the renderers keep beside their bodies (once per set, not per frame). */
export const bodyLooksOf = (bodies: readonly Pick<BodyResult, 'key'>[], looks: InstanceRenderLooks | undefined): (InstanceRenderLook | undefined)[] => bodies.map(b => looks?.get(b.key));
/** The face colours of a mesh by face index (its faces' names looked up); null when none of them is coloured. */
export function faceColorsOfMesh(look: InstanceRenderLook | undefined, mesh: Pick<DisplayMesh, 'faces'>): Map<number, Vec3> | null {
  if (!look?.faces) return null;
  const out = new Map<number, Vec3>();
  for (const f of mesh.faces) { const c = look.faces.get(f.name); if (c) out.set(f.index, c); }
  return out.size ? out : null;
}
/** A look's key as text: equal for equal looks, to tell whether a body must be painted again. */
export const lookKeyOf = (look: InstanceRenderLook | undefined): string => look ? JSON.stringify([look.color ?? null, look.faces ? [...look.faces] : null, look.hidden === true]) : '';
