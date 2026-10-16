// The drawing behind the native authored-light and UV01 viewers: their prepared requests (a native
// frame with a light catalog, or UV01 surfaces with materials) as a Presenter drawing, with a generation
// that counts accepted frames and sizes, picking by surface and a selection kept as metadata.
import { prepareNativeSurfaceUV01Geometry, uv01Shader } from '@barocss/gpu';
import type { MeshCamera, MeshLighting, PrimitiveSceneEntryV2, PrimitiveSceneMaterial, PrimitiveSceneRef,
  NativeDirectionalLightsV0, NativePointLightsV0, NativeSurfaceUV01FrameRequest } from '@barocss/gpu';
import type { Light, Environment } from '@barocss/gpu/viewer';
import { Presenter, itemsOf } from './presenter.js';
import type { Drawing, DrawnItem } from './presenter.js';

type Vec3 = [number, number, number];
export type UpdateResult = { ok: true } | { ok: false; error: Error };
export interface ViewerWebGPUStatus {
  readonly backend: 'webgpu'; readonly state: 'ready' | 'disposed';
  readonly generation: number; readonly width: number; readonly height: number;
}
export interface ViewerWebGPUOptions { readonly width: number; readonly height: number }
export interface NativeBackendPick { readonly generation: number; readonly ref: PrimitiveSceneRef | null }
export interface NativeBackend {
  readonly status: ViewerWebGPUStatus;
  updateFrame(request: unknown): Promise<UpdateResult>;
  resize(width: number, height: number): Promise<UpdateResult>;
  readPixels(): Promise<Uint8Array>;
  pick(x: number, y: number): Promise<NativeBackendPick>;
  select(ref: PrimitiveSceneRef | null): UpdateResult;
  dispose(): void;
}
interface NativeFrame {
  scene: { entries: PrimitiveSceneEntryV2[] }; materials: PrimitiveSceneMaterial[];
  options: { mmToSceneUnit: number; translate: Vec3; background: Vec3; camera: MeshCamera; lighting?: MeshLighting };
}

const toSrgb = (c: number) => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const srgb = (c: readonly number[]): Vec3 => [toSrgb(c[0]), toSrgb(c[1]), toSrgb(c[2])];
const flat = (ambient: number): Environment => ({ sky: [1, 1, 1], ground: [1, 1, 1], ambient, toneMapping: 'none', exposure: 1, ambientOcclusion: false });
const named = (ref: PrimitiveSceneRef) => `${ref.modelId}\0${ref.geometryId}`;

/** A native frame lit by its authored directional lights (each pointing towards its light). */
export function directionalDrawing(request: { frame: NativeFrame; lights: NativeDirectionalLightsV0 }): Drawing {
  const lights: Light[] = request.lights.lights.filter(l => l.enabled).map(l => {
    const d = l.directionScene, n = Math.hypot(d[0], d[1], d[2]) || 1;
    return { kind: 'directional', direction: [-d[0] / n, -d[1] / n, -d[2] / n], color: srgb(l.colorLinearRGB), intensity: l.intensity };
  });
  return frameDrawing(request.frame, { lights, environment: flat(request.lights.ambientStrength) });
}
/**
 * A native frame lit by its authored point lights. Their catalog has no inverse-square falloff (only the
 * range window) and the viewer's lights do, so each light is as bright as authored at the camera target.
 */
export function pointDrawing(request: { frame: NativeFrame; lights: NativePointLightsV0 }): Drawing {
  const target = request.frame.options.camera.target;
  const lights: Light[] = request.lights.lights.filter(l => l.enabled).map(l => {
    const d = Math.hypot(l.positionScene[0] - target[0], l.positionScene[1] - target[1], l.positionScene[2] - target[2]);
    return { kind: 'point', position: [...l.positionScene] as Vec3, color: srgb(l.colorLinearRGB), intensity: l.intensity * Math.max(d * d, 1e-6), range: l.rangeScene };
  });
  return frameDrawing(request.frame, { lights, environment: flat(request.lights.ambientStrength) });
}
function frameDrawing(frame: NativeFrame, lights: Drawing['lights']): Drawing {
  const o = frame.options;
  return { items: itemsOf(frame.scene.entries, frame.materials), camera: o.camera, lighting: null, background: o.background,
    mmToScene: o.mmToSceneUnit, translate: o.translate, lights };
}
/** UV01 surfaces from their native source, each with its material over the surface's 0–1 parameters. */
export function uv01Drawing(request: NativeSurfaceUV01FrameRequest): Drawing {
  const o = request.options;
  const items = request.entries.map((entry): DrawnItem => {
    const geometry = prepareNativeSurfaceUV01Geometry(entry.geometry), packet = geometry.preview.packet;
    return { kind: 'triangles', positions: packet.positions, normals: packet.normals, indices: packet.indices, uvs: geometry.uv01,
      color: [1, 1, 1], mm: true, pose: entry.transform, shader: uv01Shader(entry.material, entry.uniforms), name: named(entry.ref) };
  });
  return { items, camera: o.camera, lighting: o.lighting, background: o.background, mmToScene: o.mmToSceneUnit, translate: o.translate };
}

/** A backend drawing each accepted request; `prepare` admits a request (throwing on a refused one). */
export async function mountNativeBackend<R>(canvas: HTMLCanvasElement, request: R, options: ViewerWebGPUOptions,
  prepare: (request: unknown) => R, drawingOf: (request: R) => Drawing): Promise<NativeBackend> {
  const size = (w: number, h: number) => {
    if (!(Number.isInteger(w) && Number.isInteger(h) && w >= 1 && h >= 1 && w <= 4096 && h <= 4096)) throw new RangeError('Viewport size must be integers in 1..4096');
  };
  size(options.width, options.height);
  canvas.width = options.width; canvas.height = options.height;
  const drawing = drawingOf(request);
  const presenter = await Presenter.create(canvas, drawing.background);
  presenter.show(drawing);
  let state: 'ready' | 'disposed' = 'ready', generation = 1;
  const live = () => { if (state !== 'ready') throw new Error('Viewport is disposed'); };
  const attempt = async (run: () => void): Promise<UpdateResult> => {
    try { live(); run(); generation++; return { ok: true }; }
    catch (cause) { return { ok: false, error: cause instanceof Error ? cause : new Error(String(cause)) }; }
  };
  return {
    get status() { return Object.freeze({ backend: 'webgpu' as const, state, generation, width: canvas.width, height: canvas.height }); },
    updateFrame: next => attempt(() => presenter.show(drawingOf(prepare(next)))),
    resize: (width, height) => attempt(() => { size(width, height); presenter.setSize(width, height); }),
    async readPixels() { live(); return presenter.readPixels(); },
    async pick(x, y) {
      live();
      const at = generation, name = await presenter.pickName(x, y);
      if (name === null) return { generation: at, ref: null };
      const [modelId, geometryId] = name.split('\0');
      return { generation: at, ref: { modelId, geometryId } };
    },
    select() { try { live(); return { ok: true }; } catch (cause) { return { ok: false, error: cause as Error }; } },
    dispose() { if (state === 'disposed') return; state = 'disposed'; presenter.dispose(); },
  };
}
