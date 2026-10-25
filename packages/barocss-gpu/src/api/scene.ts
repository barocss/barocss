// R7 (gpu's facade): a scene as an immutable object — meshes with their materials, display lines, lights, a background
// and a camera view — whose `.data` is the plain description. `show(viewer, scene)` presents it through the Viewer's
// public methods and its camera's public fields only (clear, add, lights, setBackground, camera, fit); the Viewer stays
// the one stateful object (api-conventions.md §3).
// Meshes come in as plain data: cad's and cad-model's facades' `.meshes()` match GeometryInput by shape, so this
// package imports neither. The frame is Z-up as given (the Viewer's camera up is +Z, the studio feeds CAD XYZ in mm
// unconverted): no axis conversion and no axis option here; `frame: 'z-up'` records it.
// R7.5b: materials by id (§10.6) — the scene's own looks, registered by the material id a part's body names (al6061);
// a facade mesh's `lines` (its display edges as segment pairs) drawn as line geometry; a camera view kept to fit().
import type { Viewer, BackgroundInput, Material } from '../viewer/viewer.js';
import { prepareGeometry, type GeometryInput } from '../viewer/geometry.js';
import { ViewerError } from '../viewer/viewer-error.js';
import { refusalText } from '../core/barocss-error.js';
import type { Light } from '../viewer/lights.js';
import type { Projection } from '../viewer/camera.js';
import type { Vec3 } from '../core/geometry-types.js';
import { refuse } from './refusal.js';

/** A mesh as data: GeometryInput's fields, a key to name it by, and its material — a Material, or a scene material's id. */
export interface SceneMesh extends GeometryInput { key?: string; material?: Material | string }
/** A facade's mesh (§10.3): triangles, with its display lines as segment pairs and its body's material id when it has them. */
export type FacadeMesh = GeometryInput & { key?: string; lines?: ArrayLike<number>; material?: string };
/** A camera view: the direction from the scene towards the eye, and the up it keeps; fit() then frames the scene from there. */
export interface SceneCamera { direction: Vec3; up: Vec3; projection: Projection; fovY: number }
/** The scene's plain description. Typed arrays appear only in the meshes (conventions §2). */
export interface SceneData {
  frame: 'z-up'; meshes: SceneMesh[]; materials?: Record<string, Material>; lights?: Light[]; background?: BackgroundInput; camera?: SceneCamera;
}

/** The standard views, Z up: the direction to the eye, and the up a top or bottom view keeps (+Y), else +Z. */
export const VIEWS = {
  iso: { direction: [1, -1, 1], up: [0, 0, 1] }, front: { direction: [0, -1, 0], up: [0, 0, 1] }, back: { direction: [0, 1, 0], up: [0, 0, 1] },
  right: { direction: [1, 0, 0], up: [0, 0, 1] }, left: { direction: [-1, 0, 0], up: [0, 0, 1] },
  top: { direction: [0, 0, 1], up: [0, 1, 0] }, bottom: { direction: [0, 0, -1], up: [0, 1, 0] },
} as const satisfies Record<string, { direction: readonly number[]; up: readonly number[] }>;
export type ViewName = keyof typeof VIEWS;

/** Display lines drawn when `add` is asked for them with `true`: thin and dark, depth-tested. */
export const LINE_MATERIAL: Material = { color: '#1d2126', unlit: true, lineWidth: 1 };

function checkMesh(m: SceneMesh, k: number, where: 'facade' | 'show' = 'facade'): void {
  if (!m.positions || (m.topology !== 'labels' && m.positions.length === 0)) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: positions must be x, y, z per vertex`, where);
  // Use the Viewer's CPU input contract, including contour triangles and label anchors. The prepared buffers are
  // discarded: Scene keeps the caller's original arrays, as CAD facade consumers require.
  try { prepareGeometry(m); }
  catch (error) {
    if (!(error instanceof ViewerError && error.code === 'GEOMETRY_INVALID')) throw error;
    throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: ${refusalText(error)}`, where);
  }
}

const unit3 = (v: readonly number[], name: string): Vec3 => {
  const scale = Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) : 0;
  if (!(scale > 0)) throw refuse('CAMERA_INVALID', `the camera's ${name} is a non-zero [x, y, z]`);
  const x = v[0] / scale, y = v[1] / scale, z = v[2] / scale, l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};

// Only value settings are copied. Geometry arrays and Viewer-owned texture/shader resources keep their identity.
const colorCopy = <T extends string | Vec3 | undefined>(c: T): T => (Array.isArray(c) ? [...c] : c) as T;
function materialCopy(m: Material): Material {
  return { ...m,
    ...(m.color !== undefined ? { color: colorCopy(m.color) } : {}),
    ...(m.lineDash ? { lineDash: [...m.lineDash] as [number, number] } : {}),
    ...(m.lineHiddenDash ? { lineHiddenDash: [...m.lineHiddenDash] as [number, number] } : {}),
    ...(m.pointBorder ? { pointBorder: { ...m.pointBorder, color: colorCopy(m.pointBorder.color) } } : {}),
    ...(m.finish ? { finish: { ...m.finish, ...(m.finish.axis ? { axis: [...m.finish.axis] as Vec3 } : {}), ...(m.finish.origin ? { origin: [...m.finish.origin] as Vec3 } : {}) } } : {}),
  };
}
function lightCopy(l: Light): Light {
  if (!l || !['directional', 'point', 'spot'].includes(l.kind)) throw refuse('LIGHT_INVALID', 'a light is directional, point or spot');
  const vector = (v: unknown, name: string): Vec3 => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) throw refuse('LIGHT_INVALID', `a light's ${name} is a finite [x, y, z]`);
    return [v[0], v[1], v[2]];
  };
  return { ...l, ...(l.color !== undefined ? { color: colorCopy(l.color) } : {}),
    ...(l.kind !== 'point' ? { direction: vector(l.direction, 'direction') } : {}),
    ...(l.kind !== 'directional' ? { position: vector(l.position, 'position') } : {}),
  } as Light;
}
function backgroundCopy(b: BackgroundInput): BackgroundInput {
  if (b === null || typeof b !== 'object') return b; // Preserve the Viewer's handling of JS primitive input.
  if ('top' in b && 'bottom' in b) return { top: colorCopy(b.top), bottom: colorCopy(b.bottom) };
  return colorCopy(b);
}
function cameraCopy(c: SceneCamera): SceneCamera {
  const direction = unit3(c.direction, 'direction'), up = unit3(c.up, 'up');
  if (Math.abs(direction[0] * up[0] + direction[1] * up[1] + direction[2] * up[2]) > 1 - 1e-9) throw refuse('CAMERA_INVALID', 'the camera\'s up must not lie along its direction');
  if (c.projection !== 'perspective' && c.projection !== 'orthographic') throw refuse('CAMERA_INVALID', `a projection is perspective or orthographic, not ${String(c.projection)}`);
  if (!(Number.isFinite(c.fovY) && c.fovY > 0 && c.fovY < 180)) throw refuse('CAMERA_INVALID', `fovY is between 0 and 180, not ${String(c.fovY)}`);
  return { ...c, direction: [...c.direction], up: [...c.up] };
}
function dataCopy(d: SceneData): SceneData {
  return { ...d, meshes: d.meshes.map(m => ({ ...m, ...(m.material && typeof m.material !== 'string' ? { material: materialCopy(m.material) } : {}) })),
    ...(d.materials ? { materials: Object.fromEntries(Object.entries(d.materials).map(([k, m]) => [k, materialCopy(m)])) } : {}),
    ...(d.lights ? { lights: d.lights.map(lightCopy) } : {}),
    ...(d.background !== undefined ? { background: backgroundCopy(d.background) } : {}),
    ...(d.camera ? { camera: cameraCopy(d.camera) } : {}),
  };
}

export class Scene {
  readonly #data: SceneData;
  constructor(data: SceneData) { this.#data = dataCopy(data); }

  /** The plain description (a shallow copy: the mesh arrays are shared, never changed by the scene). */
  get data(): SceneData {
    return { ...dataCopy(this.#data), frame: 'z-up' };
  }

  /** A material registered under an id — a part's material id (al6061) or one of your own — for meshes to name. */
  material(id: string, material: Material): Scene {
    if (typeof id !== 'string' || !id) throw refuse('MATERIAL_INVALID', 'a scene material has a non-empty id');
    if (!material || typeof material !== 'object') throw refuse('MATERIAL_INVALID', `material ${id} is a Material ({ color, metallic, roughness, … })`);
    return new Scene({ ...this.#data, materials: { ...this.#data.materials, [id]: { ...material } } });
  }

  /**
   * Adds meshes — one, or a facade's `.meshes()` — each with the material given (a Material, or a scene material's id),
   * else the scene material its body names. `lines: true` (or a Material) also adds each mesh's display lines.
   */
  add(meshes: FacadeMesh | readonly FacadeMesh[], material?: Material | string, options: { lines?: boolean | Material } = {}): Scene {
    const list = (Array.isArray(meshes) ? meshes : [meshes]) as FacadeMesh[], out: SceneMesh[] = [];
    if (typeof material === 'string') this.#known(material);
    const lineLook = options.lines === true ? LINE_MATERIAL : options.lines || null;
    for (const m of list) {
      const { lines, material: named, ...geometry } = m;
      const look = material ?? (named !== undefined && this.#data.materials && Object.hasOwn(this.#data.materials, named) ? named : undefined);
      const mesh: SceneMesh = look !== undefined ? { ...geometry, material: look } : { ...geometry };
      checkMesh(mesh, this.#data.meshes.length + out.length);
      out.push(mesh);
      if (lineLook && lines && lines.length) {
        const edges: SceneMesh = { ...(m.key !== undefined ? { key: `${m.key}/lines` } : {}), positions: lines, topology: 'lines', material: lineLook };
        checkMesh(edges, this.#data.meshes.length + out.length);
        out.push(edges);
      }
    }
    return new Scene({ ...this.#data, meshes: [...this.#data.meshes, ...out] });
  }

  /** Adds a light, given in the Viewer's own terms (directional, point or spot). */
  light(light: Light): Scene {
    if (!light || !['directional', 'point', 'spot'].includes(light.kind)) throw refuse('LIGHT_INVALID', 'a light is directional, point or spot');
    return new Scene({ ...this.#data, lights: [...(this.#data.lights ?? []), light] });
  }

  /** The background: a colour, a top/bottom gradient, or 'transparent'. */
  background(background: BackgroundInput): Scene { return new Scene({ ...this.#data, background }); }

  /**
   * The camera's view: a standard one (iso, front, back, right, left, top, bottom) or a direction to the eye (and the
   * up it keeps, +Z unless given), perspective (fovY 40) or orthographic. show() frames the scene from it.
   */
  camera(view: ViewName | { direction: readonly number[]; up?: readonly number[] }, options: { projection?: Projection; fovY?: number } = {}): Scene {
    const v = typeof view === 'string' ? (Object.hasOwn(VIEWS, view) ? VIEWS[view] : undefined) : view;
    if (!v) throw refuse('CAMERA_INVALID', `a view is ${Object.keys(VIEWS).join(', ')} or { direction, up? }, not ${String(view)}`);
    const direction = unit3(v.direction, 'direction'), up = unit3(v.up ?? [0, 0, 1], 'up');
    if (Math.abs(direction[0] * up[0] + direction[1] * up[1] + direction[2] * up[2]) > 1 - 1e-9) throw refuse('CAMERA_INVALID', 'the camera\'s up must not lie along its direction');
    const projection = options.projection ?? 'perspective', fovY = options.fovY ?? 40;
    if (projection !== 'perspective' && projection !== 'orthographic') throw refuse('CAMERA_INVALID', `a projection is perspective or orthographic, not ${String(projection)}`);
    if (!(Number.isFinite(fovY) && fovY > 0 && fovY < 180)) throw refuse('CAMERA_INVALID', `fovY is between 0 and 180, not ${String(fovY)}`);
    return new Scene({ ...this.#data, camera: { direction, up, projection, fovY } });
  }

  #known(id: string): void {
    if (!this.#data.materials || !Object.hasOwn(this.#data.materials, id)) throw refuse('MATERIAL_UNKNOWN', `no scene material ${id}; register it with material(id, look) first (materials: ${Object.keys(this.#data.materials ?? {}).join(', ') || 'none'})`);
  }
}

/** A new, empty scene. */
export function scene(): Scene { return new Scene({ frame: 'z-up', meshes: [] }); }

/**
 * Shows a scene in a Viewer: what it showed is cleared, the scene's lights (when it has any) and background set, each
 * mesh added under its key with its material (a scene material by id resolved), the camera set to the scene's view,
 * and the view fitted to the meshes. Uses only the Viewer's public methods and its camera's public fields.
 */
export function show(viewer: Viewer, view: Scene): void {
  const data = view.data;
  // A direct Scene constructor or a caller's later shared-array edits can bypass add(). Reject invalid geometry
  // before touching the Viewer. Material/device failures during presentation retain their existing behavior.
  data.meshes.forEach((m, k) => checkMesh(m, k, 'show'));
  viewer.clear();
  if (data.lights) viewer.lights = data.lights;
  if (data.background !== undefined) viewer.setBackground(data.background);
  for (const m of data.meshes) {
    const { key, material, ...geometry } = m;
    const look = typeof material === 'string' ? data.materials![material] : material;
    viewer.add(geometry, { ...(look ? { material: look } : {}), ...(key !== undefined ? { name: key } : {}) });
  }
  // (fit() keeps the view's direction and frames the scene's box from it, recentring on the box and backing off to fit:
  // so the eye is put one unit along the view from the current target only to give fit() that direction — the unit
  // distance is meant, not a bug.)
  if (data.camera) {
    const c = viewer.camera, t = c.target, d = data.camera.direction;
    c.projection = data.camera.projection; c.fovY = data.camera.fovY; c.up = [...data.camera.up];
    c.position = [t[0] + d[0], t[1] + d[1], t[2] + d[2]];
  }
  viewer.fit();
}
