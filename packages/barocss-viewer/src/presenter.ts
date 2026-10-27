// How the Viewer draws: what it shows (surfaces, curves, points; colours, poses and materials) as
// meshes of the @barocss/gpu viewer core. The Viewer keeps the CPU state, picking and measurement;
// Geometry changes rebuild the drawing (scenes are bounded to a few thousand vertices).
import { createViewer as createCore } from '@barocss/gpu/viewer';
import type { Viewer as Core, Mesh, ShaderMaterial, Light, Environment } from '@barocss/gpu/viewer';
import { bindingShader } from '@barocss/gpu';
import type { MeshCamera, MeshLighting, PrimitiveSceneEntryV1, PrimitiveSceneEntryV2, PrimitiveSceneMaterial,
  ParticleLayerV0, ClothLayerV0 } from '@barocss/gpu';
import type { ViewerDeviceEvent } from './index.js';

type Vec3 = [number, number, number];
/** A vector only read (gpu's readonly Vec3 passes as one, R7.3c). */
type ReadVec3 = readonly [number, number, number];
type Quat = [number, number, number, number];

/** A display pose in authored millimetres: scale, then rotation, then translation. */
export interface DrawnPose { translation: ReadVec3; rotationXYZW: Quat; scale: ReadVec3 }
export interface DrawnTriangles {
  kind: 'triangles';
  /** Authored millimetres (with `mm`) or scene units. */
  positions: ArrayLike<number>; normals?: ArrayLike<number>; indices?: ArrayLike<number>; uvs?: ArrayLike<number>;
  color: Vec3;
  /** Positions are in millimetres: the pose and the Viewer's mm-to-scene scale place them. */
  mm?: boolean; pose?: DrawnPose | null;
  shader?: ShaderMaterial; doubleSided?: boolean; unlit?: boolean; name?: string;
}
export interface DrawnLines {
  kind: 'lines';
  /** A polyline (consecutive points) unless indices give segment pairs. */
  positions: ArrayLike<number>; indices?: ArrayLike<number>;
  color: Vec3; mm?: boolean; pose?: DrawnPose | null; name?: string;
}
/** Round dots of a fixed screen size (CSS pixels) at scene-unit positions. */
export interface DrawnPoints { kind: 'points'; positions: ArrayLike<number>; color: Vec3; sizePx: number }
export type DrawnItem = DrawnTriangles | DrawnLines | DrawnPoints;
export interface Drawing {
  items: DrawnItem[]; camera: MeshCamera; lighting: MeshLighting | null; background: Vec3;
  /** Scene units per authored millimetre, and a scene-unit offset after it. */
  mmToScene: number; translate?: ReadVec3;
  /** Lights and environment in place of the ones from `lighting`. */
  lights?: { lights: Light[]; environment: Environment };
}

const CLOTH_COLOR: Vec3 = [0.76, 0.52, 0.22], PARTICLE_COLOR: Vec3 = [0.1, 0.7, 1.0];
const refKey = (r: { modelId: string; geometryId: string }) => `${r.modelId}\0${r.geometryId}`;

/** Scene entries (surfaces and curves, with colours and poses), materials by surface, particles and cloth. */
export function itemsOf(entries: readonly (PrimitiveSceneEntryV1 | PrimitiveSceneEntryV2)[],
  materials: readonly PrimitiveSceneMaterial[] = [], particles: ParticleLayerV0 | null = null,
  cloth: ClothLayerV0 | null = null): DrawnItem[] {
  const shaders = new Map(materials.map(m => [refKey(m.ref), bindingShader(m.binding)]));
  const items: DrawnItem[] = entries.map((entry): DrawnItem => {
    const ref = 'ref' in entry ? entry.ref : null, name = ref ? refKey(ref) : undefined;
    if (entry.kind === 'surface') {
      const shader = ref ? shaders.get(refKey(ref)) : undefined;
      // A material gives the colour itself (the palette colour would tint it).
      return { kind: 'triangles', positions: entry.packet.positions, normals: entry.packet.normals, indices: entry.packet.indices,
        color: shader ? [1, 1, 1] : entry.color as Vec3, mm: true, pose: entry.transform ?? null, ...(shader ? { shader } : {}), name };
    }
    return { kind: 'lines', positions: entry.sample.pointsMM.flat(), color: entry.color as Vec3, mm: true, pose: entry.transform ?? null, name };
  });
  if (particles && particles.positions.length) items.push({ kind: 'points', positions: particles.positions, color: PARTICLE_COLOR, sizePx: 6 });
  if (cloth) items.push({ kind: 'triangles', positions: cloth.positions, indices: cloth.indices, color: CLOTH_COLOR, doubleSided: true });
  return items;
}

/** The lighting the Viewer had without an authored one: from the upper left front, mostly diffuse. */
export const DEFAULT_LIGHTING: MeshLighting = { ambientStrength: 0.35, directionalStrength: 0.65, direction: [-0.6, 0.8, 1] };

/** Column-major T(offset) · S(mm) · T(t) · R(q) · S(s). */
export function poseMatrix(pose: DrawnPose | null | undefined, mmToScene: number, offset: ReadVec3 = [0, 0, 0]): number[] {
  const [x, y, z, w] = pose?.rotationXYZW ?? [0, 0, 0, 1], s = pose?.scale ?? [1, 1, 1], t = pose?.translation ?? [0, 0, 0];
  const r = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
  const m = new Array<number>(16).fill(0);
  for (let c = 0; c < 3; c++) for (let row = 0; row < 3; row++) m[c * 4 + row] = r[c * 3 + row] * s[c] * mmToScene;
  for (let row = 0; row < 3; row++) m[12 + row] = t[row] * mmToScene + offset[row];
  m[15] = 1;
  return m;
}

/** The old MeshLighting (a direction towards the light, ambient + Lambert) as core lights. */
export function lightsOf(lighting: MeshLighting | null): { lights: Light[]; environment: Environment } {
  const l = lighting ?? DEFAULT_LIGHTING, d = l.direction, n = Math.hypot(d[0], d[1], d[2]) || 1;
  return {
    lights: l.directionalStrength > 0 ? [{ kind: 'directional', direction: [-d[0] / n, -d[1] / n, -d[2] / n], intensity: l.directionalStrength }] : [],
    environment: { sky: [1, 1, 1], ground: [1, 1, 1], ambient: l.ambientStrength, toneMapping: 'none', exposure: 1, ambientOcclusion: false },
  };
}

/** An octahedron of unit radius: the shape of a dot. */
const DOT = {
  positions: [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1],
  indices: [0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5],
};

export class Presenter {
  private meshes: Mesh[] = [];
  private disposed = false;
  private watchedDevice: object | null = null;
  private reportedLosses = 0;
  private awaitingRecreation = false;
  private constructor(readonly core: Core, private readonly onDeviceEvent?: (event: ViewerDeviceEvent) => void) {
    if (!onDeviceEvent) return;
    core.onRecover = () => {
      if (this.disposed) return;
      this.watchDevice();
      if (this.awaitingRecreation) {
        this.awaitingRecreation = false;
        this.emitDeviceEvent({ type: 'recreated' });
      }
    };
    core.onRecoverError = error => {
      if (this.disposed) return;
      this.awaitingRecreation = false;
      this.emitDeviceEvent({ type: 'recovery-failed', message: error.message, cause: error.cause });
    };
    // A loss can occur before createCore resolves and this listener is attached.
    if (core.stats.deviceLosses > 0) {
      this.reportedLosses = core.stats.deviceLosses;
      this.awaitingRecreation = true;
      this.emitDeviceEvent({ type: 'lost' });
      // (A recovery that already failed before this listener was attached: nothing is drawing.)
      if (core.ready === false && core.recovery === null) this.emitDeviceEvent({ type: 'recovery-failed', message: 'The GPU device was lost and could not be recreated.', cause: null });
    }
    this.watchDevice();
  }

  private emitDeviceEvent(event: ViewerDeviceEvent): void {
    if (this.disposed) return;
    try { this.onDeviceEvent?.(event); } catch { /* Host callbacks must not interrupt GPU recovery. */ }
  }

  private watchDevice(): void {
    const device = this.core.computeDevice;
    if (!device || device === this.watchedDevice) return;
    this.watchedDevice = device;
    const lost = (device as { lost?: PromiseLike<unknown> }).lost;
    if (!lost || typeof lost.then !== 'function') return;
    void Promise.resolve(lost).then(() => {
      if (this.disposed || this.watchedDevice !== device) return;
      const losses = this.core.stats.deviceLosses;
      if (losses <= this.reportedLosses) return;
      this.reportedLosses = losses;
      this.awaitingRecreation = true;
      this.emitDeviceEvent({ type: 'lost' });
    }, () => { /* A rejected non-WebGPU promise is not a device-loss event. */ });
  }

  static async create(canvas: HTMLCanvasElement, background: Vec3,
    onDeviceEvent?: (event: ViewerDeviceEvent) => void): Promise<Presenter> {
    const core = await createCore(canvas, { controls: false, autoResize: false, background, pixelRatio: 1 });
    try {
      core.setSize(canvas.width, canvas.height);
      return new Presenter(core, onDeviceEvent);
    } catch (error) {
      core.onRecover = null; core.onRecoverError = null;
      try { core.dispose(); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Viewer creation and cleanup failed'); }
      throw error;
    }
  }

  /** Replace what is drawn. */
  show(drawing: Drawing): void {
    const core = this.core;
    for (const m of this.meshes) m.remove();
    this.meshes = [];
    const cam = drawing.camera;
    Object.assign(core.camera, { projection: 'perspective', position: [...cam.eye], target: [...cam.target], up: [...cam.up], fovY: cam.fovY });
    const { lights, environment } = drawing.lights ?? lightsOf(drawing.lighting);
    core.lights = lights; core.environment = environment;
    core.setBackground(drawing.background);
    // A pixel at the target, for dots of a screen size.
    const distance = Math.hypot(cam.eye[0] - cam.target[0], cam.eye[1] - cam.target[1], cam.eye[2] - cam.target[2]);
    const pixel = (2 * distance * Math.tan((cam.fovY * Math.PI) / 360)) / Math.max(1, core.canvas.height);
    for (const item of drawing.items) {
      if (item.kind === 'points') {
        const count = item.positions.length / 3;
        if (!count) continue;
        const r = (item.sizePx / 2) * pixel, transforms = new Float32Array(count * 16);
        for (let i = 0; i < count; i++) {
          transforms.set([r, 0, 0, 0, 0, r, 0, 0, 0, 0, r, 0, item.positions[i * 3], item.positions[i * 3 + 1], item.positions[i * 3 + 2], 1], i * 16);
        }
        this.meshes.push(core.add(DOT, { material: { color: item.color, unlit: true }, instances: { transforms }, pickable: false, castShadow: false }));
        continue;
      }
      const transform = item.mm ? poseMatrix(item.pose, drawing.mmToScene, drawing.translate) : undefined;
      if (item.kind === 'lines') {
        const count = item.positions.length / 3;
        if (count < 2) continue;
        const indices = item.indices ?? Array.from({ length: (count - 1) * 2 }, (_, i) => (i >> 1) + (i & 1));
        this.meshes.push(core.add({ positions: item.positions, indices, topology: 'lines' },
          { material: { color: item.color, unlit: true, lineWidth: 1 }, ...(transform ? { transform } : {}), name: item.name, pickable: false, castShadow: false }));
        continue;
      }
      this.meshes.push(core.add({ positions: item.positions, normals: item.normals, indices: item.indices, uvs: item.uvs }, {
        material: { color: item.color, metallic: 0, roughness: 1, doubleSided: item.doubleSided ?? true, unlit: item.unlit, shader: item.shader ?? null },
        ...(transform ? { transform } : {}), name: item.name, castShadow: false, receiveShadow: false,
      }));
    }
    core.requestRender();
  }

  /** Change only the existing core lights. Keep every mesh and camera object. */
  setLighting(lighting: MeshLighting | null): void {
    const candidate = lightsOf(lighting), core = this.core;
    const previousLights = core.lights, previousEnvironment = core.environment;
    try {
      core.lights = candidate.lights;
      core.environment = candidate.environment;
      core.requestRender();
    } catch (error) {
      try {
        core.lights = previousLights;
        core.environment = previousEnvironment;
        core.requestRender();
      } catch (recoveryError) {
        throw new AggregateError([error, recoveryError], 'Lighting update and recovery failed');
      }
      throw error;
    }
  }

  setSize(width: number, height: number): void { this.core.setSize(width, height); }

  /** The name of the drawn item under a canvas point (CSS pixels), if it was given one. */
  async pickName(x: number, y: number): Promise<string | null> {
    await this.core.frame();
    return (await this.core.pick(x, y))?.mesh.name ?? null;
  }

  /** The drawn pixels, RGBA rows from the top. */
  async readPixels(): Promise<Uint8Array> { await this.core.frame(); return (await this.core.capture()).data; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.watchedDevice = null; this.core.onRecover = null; this.core.onRecoverError = null;
    this.meshes = []; this.core.dispose();
  }
}
