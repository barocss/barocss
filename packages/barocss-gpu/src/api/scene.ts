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
import type { GeometryInput } from '../viewer/geometry.js';
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

const finiteAll = (a: ArrayLike<number>) => { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };

function checkMesh(m: SceneMesh, k: number): void {
  if (!m.positions || m.positions.length === 0 || m.positions.length % 3 !== 0) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: positions must be x, y, z per vertex`);
  if (!finiteAll(m.positions)) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: a position is not a finite number`);
  if (m.normals && m.normals.length !== m.positions.length) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: normals must be one per vertex`);
  if (m.topology === 'lines' && !m.indices && m.positions.length % 6 !== 0) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: lines are segment pairs, two vertices each`);
  const vertices = m.positions.length / 3;
  if (m.indices) for (let i = 0; i < m.indices.length; i++) if (!(m.indices[i] >= 0 && m.indices[i] < vertices)) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: index ${m.indices[i]} is past its ${vertices} vertices`);
}

const unit3 = (v: readonly number[], name: string): Vec3 => {
  const l = Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? Math.hypot(v[0], v[1], v[2]) : 0;
  if (!(l > 0)) throw refuse('CAMERA_INVALID', `the camera's ${name} is a non-zero [x, y, z]`);
  return [v[0] / l, v[1] / l, v[2] / l];
};

export class Scene {
  readonly #data: SceneData;
  constructor(data: SceneData) { this.#data = data; }

  /** The plain description (a shallow copy: the mesh arrays are shared, never changed by the scene). */
  get data(): SceneData {
    const d = this.#data;
    return {
      frame: 'z-up', meshes: d.meshes.map(m => ({ ...m })),
      ...(d.materials ? { materials: Object.fromEntries(Object.entries(d.materials).map(([k, m]) => [k, { ...m }])) } : {}),
      ...(d.lights ? { lights: d.lights.map(l => ({ ...l })) } : {}), ...(d.background !== undefined ? { background: d.background } : {}),
      ...(d.camera ? { camera: { ...d.camera, direction: [...d.camera.direction], up: [...d.camera.up] } } : {}),
    };
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
      const look = material ?? (named !== undefined && this.#data.materials?.[named] ? named : undefined);
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
    const v = typeof view === 'string' ? VIEWS[view] : view;
    if (!v) throw refuse('CAMERA_INVALID', `a view is ${Object.keys(VIEWS).join(', ')} or { direction, up? }, not ${String(view)}`);
    const direction = unit3(v.direction, 'direction'), up = unit3(v.up ?? [0, 0, 1], 'up');
    if (Math.abs(direction[0] * up[0] + direction[1] * up[1] + direction[2] * up[2]) > 1 - 1e-9) throw refuse('CAMERA_INVALID', 'the camera\'s up must not lie along its direction');
    const projection = options.projection ?? 'perspective', fovY = options.fovY ?? 40;
    if (projection !== 'perspective' && projection !== 'orthographic') throw refuse('CAMERA_INVALID', `a projection is perspective or orthographic, not ${String(projection)}`);
    if (!(Number.isFinite(fovY) && fovY > 0 && fovY < 180)) throw refuse('CAMERA_INVALID', `fovY is between 0 and 180, not ${fovY}`);
    return new Scene({ ...this.#data, camera: { direction, up, projection, fovY } });
  }

  #known(id: string): void {
    if (!this.#data.materials?.[id]) throw refuse('MATERIAL_UNKNOWN', `no scene material ${id}; register it with material(id, look) first (materials: ${Object.keys(this.#data.materials ?? {}).join(', ') || 'none'})`);
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
