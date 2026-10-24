// R7 (gpu's facade): a scene as an immutable object — meshes with their materials, lights and a background — whose
// `.data` is the plain description. `show(viewer, scene)` presents it through the Viewer's public methods only (clear,
// add, lights, setBackground, fit); the Viewer stays the one stateful object (api-conventions.md §3).
// Meshes come in as plain data: cad's and cad-model's facades' `.meshes()` match GeometryInput by shape, so this
// package imports neither. The frame is Z-up as given (the Viewer's camera up is +Z, the studio feeds CAD XYZ in mm
// unconverted): no axis conversion and no axis option here; `frame: 'z-up'` records it.
import type { Viewer, BackgroundInput, Material } from '../viewer/viewer.js';
import type { GeometryInput } from '../viewer/geometry.js';
import type { Light } from '../viewer/lights.js';
import { refuse } from './refusal.js';

/** A mesh as data: GeometryInput's fields, a key to name it by, and its material. */
export interface SceneMesh extends GeometryInput { key?: string; material?: Material }
/** The scene's plain description. Typed arrays appear only in the meshes (conventions §2). */
export interface SceneData { frame: 'z-up'; meshes: SceneMesh[]; lights?: Light[]; background?: BackgroundInput }

const finiteAll = (a: ArrayLike<number>) => { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };

function checkMesh(m: SceneMesh, k: number): void {
  if (!m.positions || m.positions.length === 0 || m.positions.length % 3 !== 0) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: positions must be x, y, z per vertex`);
  if (!finiteAll(m.positions)) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: a position is not a finite number`);
  if (m.normals && m.normals.length !== m.positions.length) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: normals must be one per vertex`);
  const vertices = m.positions.length / 3;
  if (m.indices) for (let i = 0; i < m.indices.length; i++) if (!(m.indices[i] >= 0 && m.indices[i] < vertices)) throw refuse('MESH_INVALID', `mesh ${m.key ?? k}: index ${m.indices[i]} is past its ${vertices} vertices`);
}

export class Scene {
  readonly #data: SceneData;
  constructor(data: SceneData) { this.#data = data; }

  /** The plain description (a shallow copy: the mesh arrays are shared, never changed by the scene). */
  get data(): SceneData {
    return { frame: 'z-up', meshes: this.#data.meshes.map(m => ({ ...m })), ...(this.#data.lights ? { lights: this.#data.lights.map(l => ({ ...l })) } : {}), ...(this.#data.background !== undefined ? { background: this.#data.background } : {}) };
  }

  /** Adds meshes — one, or a facade's `.meshes()` — each with the material given. */
  add(meshes: GeometryInput | readonly (GeometryInput & { key?: string })[], material?: Material): Scene {
    const list = (Array.isArray(meshes) ? meshes : [meshes]) as (GeometryInput & { key?: string })[];
    const added = list.map((m, k) => { const mesh: SceneMesh = material ? { ...m, material } : { ...m }; checkMesh(mesh, this.#data.meshes.length + k); return mesh; });
    return new Scene({ ...this.#data, meshes: [...this.#data.meshes, ...added] });
  }

  /** Adds a light, given in the Viewer's own terms (directional, point or spot). */
  light(light: Light): Scene {
    if (!light || !['directional', 'point', 'spot'].includes(light.kind)) throw refuse('LIGHT_INVALID', 'a light is directional, point or spot');
    return new Scene({ ...this.#data, lights: [...(this.#data.lights ?? []), light] });
  }

  /** The background: a colour, a top/bottom gradient, or 'transparent'. */
  background(background: BackgroundInput): Scene { return new Scene({ ...this.#data, background }); }
}

/** A new, empty scene. */
export function scene(): Scene { return new Scene({ frame: 'z-up', meshes: [] }); }

/**
 * Shows a scene in a Viewer: what it showed is cleared, the scene's lights (when it has any) and background set, each
 * mesh added under its key, and the view fitted to them. Uses only the Viewer's public methods.
 */
export function show(viewer: Viewer, view: Scene): void {
  const data = view.data;
  viewer.clear();
  if (data.lights) viewer.lights = data.lights;
  if (data.background !== undefined) viewer.setBackground(data.background);
  for (const m of data.meshes) {
    const { key, material, ...geometry } = m;
    viewer.add(geometry, { ...(material ? { material } : {}), ...(key !== undefined ? { name: key } : {}) });
  }
  viewer.fit();
}
