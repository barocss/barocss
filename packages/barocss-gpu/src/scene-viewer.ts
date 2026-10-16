// The CSS-shaped scene language on the viewer: compile a source (`#cube { size: 1 2 1; translate: 1 0 0;
// color: #4090e0; }`), then show each object as a mesh with its transform and colour. The scene is
// right-handed Y-up; its primitives are tessellated by the package's geometry builders (shared between
// objects of the same shape).
import { compileGpu, type GpuCompileResult, type GpuDiagnostic, type GpuRenderIR } from './gpu-compiler.js';
import { prepareBoxGeometry } from './box-geometry.js';
import { prepareSphereGeometry } from './sphere-geometry.js';
import { prepareCylinderGeometry } from './cylinder-geometry.js';
import { prepareCapsuleGeometry } from './capsule-geometry.js';
import { prepareRoundedBoxGeometry } from './rounded-box-geometry.js';
import { prepareTorusGeometry } from './torus-geometry.js';
import type { PreparedTriangleGeometry } from './triangle-geometry.js';
import type { Geometry, Mesh, Viewer } from './viewer/viewer.js';
import { multiply, rotation, translation, type Mat4 } from './viewer/math.js';

type Draw = Extract<GpuRenderIR, { pipeline: 'sdf' }>['draws'][number];
type V3 = [number, number, number];

export interface SceneViewOptions {
  /** Tessellation: segments around a curved primitive (default 48). */
  segments?: number;
  /** Frame the scene when it is first shown (default true). */
  fit?: boolean;
}
export interface SceneView {
  /** The meshes by object id. */
  readonly meshes: ReadonlyMap<string, Mesh>;
  /** The last successful compile. */
  readonly result: Extract<GpuCompileResult, { ok: true }>;
  /** Compile a new source and show it; on errors the shown scene stays and the diagnostics come back. */
  update(source: string): { ok: true } | { ok: false; diagnostics: GpuDiagnostic[] };
  dispose(): void;
}

export class SceneViewError extends Error {
  constructor(readonly diagnostics: GpuDiagnostic[]) { super(diagnostics.map(d => `${d.code}: ${d.message}`).join('; ') || 'Scene refused'); this.name = 'SceneViewError'; }
}

/** Source 1 (rotation and the further primitives) when its header says so. */
const compileSource = (source: string) => compileGpu({ kind: 'scene', source, ...(/\bversion\s*:\s*1\s*;/.test(source) ? { sourceVersion: 1 as const } : {}) });

const base = (id: string) => ({ version: 0, id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene' });

/** The primitive of a draw in its own frame, and the local transform that places it before rotation. */
function primitive(d: Draw, n: number): { key: string; build: () => PreparedTriangleGeometry; local: Mat4 | null } {
  const half = Math.max(8, n >> 1);
  switch (d.kind) {
    case 'sphere': return { key: `sphere:${d.radius}:${n}`, build: () => prepareSphereGeometry({ format: 'barocss-gpu-sphere-geometry', ...base('sphere'), radius: d.radius, longitudeSegments: n, latitudeSegments: half }).prepared, local: null };
    case 'box': return { key: `box:${d.size}`, build: () => prepareBoxGeometry({ format: 'barocss-gpu-box-geometry', ...base('box'), sizeXYZ: [...d.size] }).prepared, local: null };
    case 'rounded-box': return { key: `rbox:${d.size}:${d.radius}:${n}`, build: () => prepareRoundedBoxGeometry({ format: 'barocss-gpu-rounded-box-geometry', ...base('rounded-box'), sizeXYZ: [...d.size], cornerRadius: d.radius, segments: Math.max(2, n >> 3) }).prepared, local: null };
    case 'cylinder': return { key: `cyl:${d.radius}:${d.height}:${n}`, build: () => prepareCylinderGeometry({ format: 'barocss-gpu-cylinder-geometry', ...base('cylinder'), radius: d.radius, height: d.height, radialSegments: n, heightSegments: 1 }).prepared, local: null };
    case 'torus': return { key: `torus:${d.majorRadius}:${d.minorRadius}:${n}`, build: () => prepareTorusGeometry({ format: 'barocss-gpu-torus-geometry', ...base('torus'), majorRadius: d.majorRadius, minorRadius: d.minorRadius, majorSegments: n, minorSegments: half }).prepared, local: null };
    case 'capsule': {
      // A capsule along local Y, turned and moved onto its start–end segment.
      const s = d.start as V3, e = d.end as V3, axis: V3 = [e[0] - s[0], e[1] - s[1], e[2] - s[2]], len = Math.hypot(...axis), mid: V3 = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2, (s[2] + e[2]) / 2];
      const dir: V3 = len > 0 ? [axis[0] / len, axis[1] / len, axis[2] / len] : [0, 1, 0], c = dir[1];
      const turn: V3 = [dir[2], 0, -dir[0]], turnLen = Math.hypot(...turn);
      const align = turnLen > 1e-12 ? rotation(turn, Math.acos(Math.max(-1, Math.min(1, c)))) : c < 0 ? rotation([1, 0, 0], Math.PI) : null;
      const local = align ? multiply(translation(mid), align) : translation(mid);
      return { key: `capsule:${d.radius}:${len}:${n}`, build: () => prepareCapsuleGeometry({ format: 'barocss-gpu-capsule-geometry', ...base('capsule'), radius: d.radius, halfLength: len / 2, radialSegments: n, bodySegments: 1, capSegments: Math.max(2, n >> 2) }).prepared, local };
    }
  }
}

/** Translation, then X, Y and Z rotation (applied in that order to the object), as the scene language reads them. */
function placement(d: Draw): Mat4 {
  let m = translation(d.translate as V3);
  if ('rotateDegrees' in d) {
    const [x, y, z] = d.rotateDegrees.map(a => (a * Math.PI) / 180);
    m = multiply(m, multiply(rotation([0, 0, 1], z), multiply(rotation([0, 1, 0], y), rotation([1, 0, 0], x))));
  }
  return m;
}

/** Show a CSS-shaped scene source on a viewer. Throws a SceneViewError when the first source does not compile. */
export function showScene(viewer: Viewer, source: string, options: SceneViewOptions = {}): SceneView {
  const n = Math.max(8, Math.min(128, Math.round(options.segments ?? 48)));
  const geometries = new Map<string, Geometry>(), meshes = new Map<string, Mesh>();
  let result: Extract<GpuCompileResult, { ok: true }>;
  let first = true, disposed = false;
  const geometry = (key: string, build: () => PreparedTriangleGeometry): Geometry => {
    let g = geometries.get(key);
    if (!g) { const p = build(); g = viewer.createGeometry({ positions: p.positions, normals: p.normals, uvs: p.uvs, indices: p.indices }); geometries.set(key, g); }
    return g;
  };
  const show = (compiled: Extract<GpuCompileResult, { ok: true }>) => {
    for (const m of meshes.values()) m.remove();
    meshes.clear();
    const ir = compiled.ir, used = new Set<string>();
    if (ir.pipeline === 'sdf') {
      for (const d of ir.draws) {
        const p = primitive(d, n), place = placement(d);
        used.add(p.key);
        meshes.set(d.id, viewer.add(geometry(p.key, p.build), { name: d.id, transform: p.local ? multiply(place, p.local) : place, material: { color: d.color as V3, roughness: 0.5 } }));
      }
    }
    // Shapes no longer used are released.
    for (const [key, g] of geometries) if (!used.has(key)) { g.dispose(); geometries.delete(key); }
    viewer.setBackground(ir.background as V3);
    if (first && options.fit !== false) { viewer.camera.up = [0, 1, 0]; viewer.fit(); }
    first = false;
    result = compiled;
  };
  const compiled = compileSource(source);
  if (!compiled.ok) throw new SceneViewError(compiled.diagnostics);
  show(compiled);
  return {
    meshes,
    get result() { return result; },
    update(next: string) {
      if (disposed) throw new SceneViewError([{ code: 'STATE', severity: 'error', message: 'The scene view is disposed', range: null }]);
      const c = compileSource(next);
      if (!c.ok) return { ok: false, diagnostics: c.diagnostics };
      show(c);
      return { ok: true };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const m of meshes.values()) m.remove();
      for (const g of geometries.values()) g.dispose();
      meshes.clear(); geometries.clear();
    },
  };
}
