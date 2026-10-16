// The studio viewport on the @barocss/gpu viewer (WebGPU): the same interface as the WebGL2 Renderer, so
// the viewport keeps its own camera, pointer handling and overlays. Bodies are lit meshes with their edges
// as lines; hovered and selected faces are vertex colours, hovered and selected edges a wider line on top,
// selected bodies an outline; ghost bodies are see-through. Picking is on the CPU (synchronous for hover).
import { createViewer, translation, type Geometry, type Light, type Mesh, type Viewer } from '@barocss/gpu/viewer';
import type { BodyResult } from '../engine/evaluate';
import type { Vec3 } from '../engine/mesh';
import type { OrbitCamera } from './camera';
import type { EdgeRef, FaceRef, ThemeName, ViewRenderer, ViewState } from './renderer';

interface Theme { bgTop: Vec3; bgBottom: Vec3; grid: Vec3; gridOpacity: number; base: Vec3; edge: Vec3; ao: number; shadow: number }
const THEMES: Record<ThemeName, Theme> = {
  dark: { bgTop: [0.180, 0.188, 0.208], bgBottom: [0.094, 0.098, 0.106], grid: [0.55, 0.55, 0.57], gridOpacity: 0.16, base: [0.74, 0.75, 0.78], edge: [0.05, 0.05, 0.06], ao: 0.9, shadow: 0.45 },
  light: { bgTop: [0.965, 0.972, 0.980], bgBottom: [0.780, 0.812, 0.851], grid: [0.30, 0.34, 0.40], gridOpacity: 0.14, base: [0.70, 0.74, 0.80], edge: [0.11, 0.14, 0.19], ao: 0.8, shadow: 0.28 },
};
const ACCENT: Vec3 = [0.910, 0.761, 0.353];
const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

interface Body { result: BodyResult; surface: Mesh; edges: Mesh | null; highlight: Mesh | null; geometries: Geometry[] }


export class GpuRenderer implements ViewRenderer {
  aoEnabled = true;
  private theme: Theme = THEMES.dark;
  private bodies: Body[] = [];
  /** A shadow catcher under the bodies (the ground their shadow falls on). */
  private ground: Mesh | null = null;

  private constructor(readonly canvas: HTMLCanvasElement, private readonly viewer: Viewer) {}

  /** A renderer on the canvas, or an error when WebGPU is not available (the caller falls back). */
  static async create(canvas: HTMLCanvasElement): Promise<GpuRenderer> {
    const viewer = await createViewer(canvas, { controls: false, camera: { up: [0, 0, 1] } });
    viewer.outlineWidth = 2;
    const r = new GpuRenderer(canvas, viewer);
    r.setTheme('dark');
    return r;
  }

  setTheme(name: ThemeName): void {
    const t = this.theme = THEMES[name];
    this.viewer.setBackground({ top: t.bgTop, bottom: t.bgBottom });
    this.viewer.grid = { visible: true, cell: 10, major: 5, color: t.grid, opacity: t.gridOpacity };
    for (const b of this.bodies) {
      if (b.edges) b.edges.material = { color: t.edge };
      this.paint(b, new Map());
    }
    if (this.ground) this.ground.material = { opacity: t.shadow };
  }

  setBodies(results: BodyResult[]): void {
    for (const b of this.bodies) { b.surface.remove(); b.edges?.remove(); this.dropHighlight(b); b.geometries.forEach(g => g.dispose()); }
    this.bodies = results.map(result => {
      const m = result.mesh, I = m.indices, faces = new Uint32Array(I.length / 3);
      for (let t = 0; t < faces.length; t++) faces[t] = m.faceOfVertex[I[3 * t]];
      const surfaceGeometry = this.viewer.createGeometry({ positions: m.positions, normals: m.normals, indices: I, faces });
      const surface = this.viewer.add(surfaceGeometry, { material: { color: '#ffffff', roughness: 0.62 } });
      const geometries = [surfaceGeometry];
      let edges: Mesh | null = null;
      if (m.edgeLines.length) {
        const ids = new Uint32Array(m.edgeLines.length / 6);
        for (let s = 0; s < ids.length; s++) ids[s] = m.edgeOfSegment[2 * s];
        const g = this.viewer.createGeometry({ positions: m.edgeLines, topology: 'lines', edges: ids });
        geometries.push(g);
        edges = this.viewer.add(g, { material: { color: this.theme.edge, unlit: true, lineWidth: 1.2 }, castShadow: false });
      }
      const body: Body = { result, surface, edges, highlight: null, geometries };
      this.paint(body, new Map());
      return body;
    });
    this.ground?.remove(); this.ground?.geometry.dispose(); this.ground = null;
    const b = this.bounds();
    if (b) {
      const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, r = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) * 1.5 + 20, z = b.min[2] - 0.02;
      this.ground = this.viewer.add({ positions: [cx - r, cy - r, z, cx + r, cy - r, z, cx + r, cy + r, z, cx - r, cy + r, z], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] },
        { material: { shadowOnly: true, opacity: this.theme.shadow }, pickable: false, castShadow: false });
    }
  }

  /** Face colours: the theme's base, mixed with the accent for hovered (1) and selected (2) faces. */
  private paint(b: Body, faceState: Map<number, number>): void {
    const m = b.result.mesh, n = m.positions.length / 3, colors = new Float32Array(n * 3);
    const shade = [this.theme.base, mix(this.theme.base, ACCENT, 0.2), mix(this.theme.base, ACCENT, 0.42)];
    for (let v = 0; v < n; v++) colors.set(shade[faceState.get(m.faceOfVertex[v]) ?? 0], v * 3);
    b.surface.geometry.setColors(colors);
  }

  setState(view: ViewState): void {
    this.bodies.forEach((b, bi) => {
      const faceState = new Map<number, number>();
      if (view.hoverFace?.body === bi) faceState.set(view.hoverFace.face, 1);
      for (const f of view.selectedFaces) if (f.body === bi) faceState.set(f.face, 2);
      this.paint(b, faceState);
      // Hovered and selected edges: their segments again, wider and in the accent colour.
      const edgeState = new Map<number, number>();
      if (view.hoverEdge?.body === bi) edgeState.set(view.hoverEdge.edge, 1);
      for (const e of view.selectedEdges) if (e.body === bi) edgeState.set(e.edge, 2);
      this.dropHighlight(b);
      if (edgeState.size) {
        const L = b.result.mesh.edgeLines, E = b.result.mesh.edgeOfSegment, pts: number[] = [], colors: number[] = [];
        for (let s = 0; s < L.length / 6; s++) {
          const st = edgeState.get(E[2 * s]);
          if (!st) continue;
          for (let k = 0; k < 6; k++) pts.push(L[6 * s + k]);
          const c = st > 1 ? [1, 0.84, 0.36] : [0.95, 0.78, 0.36];
          colors.push(...c, ...c);
        }
        const g = this.viewer.createGeometry({ positions: pts, colors, topology: 'lines' });
        b.highlight = this.viewer.add(g, { material: { color: '#ffffff', unlit: true, lineWidth: view.selectedEdges.length ? 2.6 : 2.2 }, pickable: false, castShadow: false });
      }
      const ghost = view.ghostBodies.has(bi), offset = view.offsets.get(bi) ?? [0, 0, 0];
      b.surface.material = { opacity: ghost ? 0.35 : 1 };
      b.surface.pickable = !ghost;
      b.surface.outline = view.selectedBodies.includes(bi) ? ACCENT : null;
      for (const mesh of [b.surface, b.edges, b.highlight]) if (mesh) mesh.transform = translation(offset);
      if (b.edges) { b.edges.material = { opacity: ghost ? 0.35 : 0.9 }; b.edges.pickable = !ghost; }
    });
  }

  private dropHighlight(b: Body): void {
    if (!b.highlight) return;
    b.highlight.remove(); b.highlight.geometry.dispose(); b.highlight = null;
  }

  /** Lights that follow the camera, as the WebGL renderer's: a key from upper left, a fill from the right. */
  private lights(camera: OrbitCamera): Light[] {
    const { right, up, forward } = camera.basis();
    const toward = (x: number, y: number, z: number): Vec3 => [0, 1, 2].map(k => -(x * right[k] + y * up[k] - z * forward[k])) as unknown as Vec3;
    return [
      { kind: 'directional', direction: toward(-0.45, 0.55, 0.70), intensity: 0.8 },
      { kind: 'directional', direction: toward(0.6, -0.2, 0.5), intensity: 0.22 },
      // No light, only a shadow from nearly overhead (fixed, so it stays put as the view turns).
      { kind: 'directional', direction: [0.12, 0.18, -1], intensity: 0, castShadow: true },
    ];
  }

  render(camera: OrbitCamera, _view: ViewState): void {
    const v = this.viewer, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    camera.aspect = w / Math.max(1, h);
    Object.assign(v.camera, { position: camera.eye(), target: [...camera.target], up: [0, 0, 1], fovY: (camera.fovY * 180) / Math.PI, projection: camera.ortho ? 'orthographic' : 'perspective' });
    v.lights = this.lights(camera);
    const b = this.bounds(), size = b ? Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) : 50;
    v.environment = { sky: [0.95, 0.96, 1], ground: [0.55, 0.53, 0.5], ambient: 0.4, ambientOcclusion: this.aoEnabled ? { radius: Math.max(1, size * 0.045), strength: this.theme.ao } : false };
    v.resize();
    v.render();
  }

  pickFace(x: number, y: number, camera: OrbitCamera, _view: ViewState): FaceRef | null {
    this.sync(camera);
    const hit = this.viewer.raycast(x, y);
    if (!hit || hit.face === null) return null;
    const body = this.bodies.findIndex(b => b.surface === hit.mesh);
    return body < 0 ? null : { body, face: hit.face };
  }

  pickEdge(x: number, y: number, camera: OrbitCamera, _view: ViewState, radius = 6): EdgeRef | null {
    this.sync(camera);
    const hit = this.viewer.pickLine(x, y, radius);
    if (!hit || hit.edge === null) return null;
    const body = this.bodies.findIndex(b => b.edges === hit.mesh);
    return body < 0 ? null : { body, edge: hit.edge };
  }

  /** The viewer's camera as the studio camera stands (picks may come between frames). */
  private sync(camera: OrbitCamera): void {
    camera.aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    Object.assign(this.viewer.camera, { position: camera.eye(), target: [...camera.target], up: [0, 0, 1], fovY: (camera.fovY * 180) / Math.PI, projection: camera.ortho ? 'orthographic' : 'perspective' });
  }

  bounds(): { min: Vec3; max: Vec3 } | null {
    if (!this.bodies.length) return null;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const b of this.bodies) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.result.mesh.bounds.min[k]); max[k] = Math.max(max[k], b.result.mesh.bounds.max[k]); }
    return { min, max };
  }

  dispose(): void { this.viewer.dispose(); }
}
