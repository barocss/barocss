// The studio viewport on the @barocss/gpu viewer (WebGPU): the same interface as the WebGL2 Renderer, so
// the viewport keeps its own camera, pointer handling and overlays. Bodies are lit meshes with their edges
// as lines; hovered and selected faces are vertex colours, hovered and selected edges a wider line on top,
// selected bodies an outline; ghost bodies are see-through. Picking is on the CPU (synchronous for hover).
// With render settings (the Render workspace) bodies take their appearances, and the lights, environment
// and ground come from the settings instead of the theme's modelling look.
import { createViewer, multiply, rotation, translation, type Geometry, type Light, type Mesh, type Viewer } from '@barocss/gpu/viewer';
import { materialShader, showScene, type MaterialShaderResult, type SceneView } from '@barocss/gpu';
import type { BodyResult } from '../engine/evaluate';
import { appearanceOf, type RenderSettings } from '../engine/render';
import type { DirectDisplay } from '../engine/direct';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import type { OrbitCamera } from './camera';
import type { EdgeRef, FaceRef, ThemeName, ViewRenderer, ViewState } from './renderer';

interface Theme { bgTop: Vec3; bgBottom: Vec3; grid: Vec3; gridOpacity: number; base: Vec3; edge: Vec3; ao: number; shadow: number }
const THEMES: Record<ThemeName, Theme> = {
  dark: { bgTop: [0.180, 0.188, 0.208], bgBottom: [0.094, 0.098, 0.106], grid: [0.55, 0.55, 0.57], gridOpacity: 0.16, base: [0.74, 0.75, 0.78], edge: [0.05, 0.05, 0.06], ao: 0.9, shadow: 0.45 },
  light: { bgTop: [0.965, 0.972, 0.980], bgBottom: [0.780, 0.812, 0.851], grid: [0.30, 0.34, 0.40], gridOpacity: 0.14, base: [0.70, 0.74, 0.80], edge: [0.11, 0.14, 0.19], ao: 0.8, shadow: 0.28 },
};
const ACCENT: Vec3 = [0.910, 0.761, 0.353];
const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

interface Body { result: BodyResult; surface: Mesh; edges: Mesh | null; highlight: Mesh | null; geometries: Geometry[]; sig: string }

/** A mesh's content in a few numbers (sizes, bounds and a sample of positions): equal for a re-evaluation that changed nothing. */
function signature(r: BodyResult): string {
  const m = r.mesh, p = m.positions, step = Math.max(1, Math.floor(p.length / 997));
  let h = 2166136261;
  for (let i = 0; i < p.length; i += step) { h ^= Math.round(p[i] * 1e4); h = Math.imul(h, 16777619); }
  return [r.key, p.length, m.indices.length, m.edgeLines.length, ...m.bounds.min, ...m.bounds.max, h >>> 0].join(',');
}


export class GpuRenderer implements ViewRenderer {
  aoEnabled = true;
  private theme: Theme = THEMES.dark;
  private bodies: Body[] = [];
  /** A shadow catcher under the bodies (the ground their shadow falls on). */
  private ground: Mesh | null = null;
  private settings: RenderSettings | null = null;
  /** The props scene (render settings' CSS source), and what it was made from. */
  private props: { view: SceneView; source: string; scale: number } | null = null;
  private shaders = new Map<string, MaterialShaderResult>();
  /** Direct curves and surfaces: their meshes by object id, and the control nets of the selected ones. */
  private direct: { id: string; mesh: Mesh; kind: 'curve' | 'surface' }[] = [];
  private controls: Mesh[] = [];
  /** Placed instances of other parts: their bodies' surfaces and edges. */
  private instances: { id: string; surfaces: Mesh[]; edges: Mesh[] }[] = [];
  private instanceSelection: readonly string[] = [];
  /** Instances' display meshes (for the face under a pick). */
  private instanceMeshes = new Map<string, DisplayMesh[]>();
  /** Faces of instances shown picked (mate faces). */
  private instanceFaces: readonly { id: string; body: number; face: number }[] = [];
  private view: ViewState | null = null;

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
    this.theme = THEMES[name];
    this.applyLook();
  }

  /** Render settings (the Render workspace), or null for the modelling look. */
  setRender(settings: RenderSettings | null): void {
    this.settings = settings;
    this.applyLook();
    if (this.view) this.setState(this.view);
  }

  /** Background, grid, edges and ground of the modelling look or of the render settings. */
  private applyLook(): void {
    const t = this.theme, r = this.settings, env = r?.environment;
    this.viewer.setBackground(env ? { top: env.top, bottom: env.bottom } : { top: t.bgTop, bottom: t.bgBottom });
    this.viewer.grid = { visible: env ? env.grid : true, cell: 10, major: 5, color: t.grid, opacity: t.gridOpacity };
    for (const b of this.bodies) {
      if (b.edges) { b.edges.material = { color: t.edge }; b.edges.visible = env ? env.edges : true; }
      this.paint(b, new Map());
    }
    if (this.ground) { this.ground.material = { opacity: env ? 0.55 : t.shadow }; this.ground.visible = env ? env.ground : true; }
    this.showProps();
    this.paintInstances();
    this.viewer.requestRender();
  }

  setBodies(results: BodyResult[]): void {
    // The same bodies again (a re-evaluation, a preview becoming the part): keep their GPU meshes, so
    // nothing is rebuilt and the frame does not flash.
    const sigs = results.map(signature);
    if (sigs.length === this.bodies.length && sigs.every((s, i) => s === this.bodies[i].sig)) {
      this.bodies.forEach((b, i) => { b.result = results[i]; });
      return;
    }
    for (const b of this.bodies) { b.surface.remove(); b.edges?.remove(); this.dropHighlight(b); b.geometries.forEach(g => g.dispose()); }
    this.bodies = results.map((result, bi) => {
      const m = result.mesh, I = m.indices, faces = new Uint32Array(I.length / 3);
      for (let t = 0; t < faces.length; t++) faces[t] = m.faceOfVertex[I[3 * t]];
      const surfaceGeometry = this.viewer.createGeometry({ positions: m.positions, normals: m.normals, uvs: boxUVs(m.positions, m.normals, m.bounds), indices: I, faces });
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
      const body: Body = { result, surface, edges, highlight: null, geometries, sig: sigs[bi] };
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
    this.applyLook();
  }

  /**
   * The props of the render settings: their CSS scene, Y up, turned into the part's Z-up world at
   * sceneScale mm to the unit. A source that does not compile keeps the props shown before.
   */
  private showProps(): void {
    const r = this.settings, source = r?.scene.trim() ?? '';
    if (!r || !source) { this.props?.view.dispose(); this.props = null; return; }
    if (this.props && this.props.source === source && this.props.scale === r.sceneScale) return;
    const k = r.sceneScale, place = multiply(rotation([1, 0, 0], Math.PI / 2), Float64Array.from([k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1]));
    if (this.props && this.props.scale === r.sceneScale) {
      if (this.props.view.update(source).ok) this.props.source = source;
      return;
    }
    try {
      const view = showScene(this.viewer, source, { fit: false, background: false, transform: place });
      this.props?.view.dispose();
      this.props = { view, source, scale: k };
    } catch { /* A refused source: the panel shows its diagnostics. */ }
  }

  /** A material's shader (compiled once per source), or nothing when it does not compile. */
  private shaderOf(name: string | undefined) {
    const source = name ? this.settings?.materials[name] : undefined;
    if (!source) return null;
    let compiled = this.shaders.get(source);
    if (!compiled) { compiled = materialShader(source); this.shaders.set(source, compiled); }
    return compiled.ok ? compiled.shader : null;
  }

  /** Face colours: the theme's base, mixed with the accent for hovered (1) and selected (2) faces. */
  private paint(b: Body, faceState: Map<number, number>): void {
    const m = b.result.mesh, n = m.positions.length / 3, colors = new Float32Array(n * 3);
    // (Rendering: the appearance is the material colour, so faces are white unless picked.)
    const base: Vec3 = this.settings ? [1, 1, 1] : this.theme.base;
    const shade = [base, mix(base, ACCENT, 0.2), mix(base, ACCENT, 0.42)];
    for (let v = 0; v < n; v++) colors.set(shade[faceState.get(m.faceOfVertex[v]) ?? 0], v * 3);
    b.surface.geometry.setColors(colors);
  }

  setState(view: ViewState): void {
    this.view = view;
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
      const look = this.settings ? appearanceOf(this.settings, b.result.key) : null;
      b.surface.material = look
        ? { color: look.color, metallic: look.metallic, roughness: look.roughness, opacity: ghost ? Math.min(0.35, look.opacity) : look.opacity, shader: this.shaderOf(look.shader) }
        : { color: '#ffffff', metallic: 0, roughness: 0.62, opacity: ghost ? 0.35 : 1, shader: null };
      b.surface.pickable = !ghost;
      b.surface.outline = view.selectedBodies.includes(bi) ? ACCENT : null;
      const moved = view.transforms?.get(bi) ?? translation(offset);
      for (const mesh of [b.surface, b.edges, b.highlight]) if (mesh) mesh.transform = moved;
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
    const b = this.bounds(), size = b ? Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) : 50;
    const r = this.settings;
    if (r) {
      // The settings' lights; the first directional one that casts a shadow casts it on the ground.
      v.lights = r.lights.map((l): Light => l.kind === 'directional' ? { ...l }
        : l.kind === 'point' ? { kind: 'point', position: l.position, color: l.color, intensity: l.intensity * size * size * 0.05, range: l.range }
          : { kind: 'spot', position: l.position, direction: l.direction, color: l.color, intensity: l.intensity * size * size * 0.05, range: l.range, angle: l.angle, penumbra: l.penumbra });
      const e = r.environment;
      v.environment = { sky: [0.95, 0.96, 1], ground: [0.55, 0.53, 0.5], ambient: e.ambient, exposure: e.exposure, toneMapping: e.toneMapping, ambientOcclusion: e.occlusion ? { radius: Math.max(1, size * 0.045), strength: 0.9 } : false };
    } else {
      v.lights = this.lights(camera);
      v.environment = { sky: [0.95, 0.96, 1], ground: [0.55, 0.53, 0.5], ambient: 0.4, ambientOcclusion: this.aoEnabled ? { radius: Math.max(1, size * 0.045), strength: this.theme.ao } : false };
    }
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

  /** The box around the bodies and the direct curves and surfaces. */
  bounds(): { min: Vec3; max: Vec3 } | null {
    if (!this.bodies.length && !this.direct.length && !this.instances.length) return null;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    const grow = (b: { min: readonly number[]; max: readonly number[] }) => { for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); } };
    for (const b of this.bodies) grow(b.result.mesh.bounds);
    for (const d of this.direct) { const b = d.mesh.bounds; if (b) grow(b); }
    for (const it of this.instances) for (const m of it.surfaces) { const b = m.bounds; if (b) grow(b); }
    return { min, max };
  }

  /** Direct geometry: surfaces as two-sided meshes, curves as lines; the selected ones outlined with their control nets. */
  setDirect(items: DirectDisplay[], selected: readonly string[]): void {
    for (const d of this.direct) { d.mesh.remove(); d.mesh.geometry.dispose(); }
    for (const c of this.controls) { c.remove(); c.geometry.dispose(); }
    this.direct = []; this.controls = [];
    for (const it of items) {
      const on = selected.includes(it.id);
      const mesh = it.kind === 'surface'
        ? this.viewer.add({ positions: it.positions, normals: it.normals, indices: it.indices }, { name: 'direct:' + it.id, material: { color: on ? '#e8c25a' : '#8fb3d9', roughness: 0.5, doubleSided: true } })
        : this.viewer.add({ positions: it.positions, topology: 'lines' }, { name: 'direct:' + it.id, material: { color: on ? '#ffd35c' : '#5ec8e5', unlit: true, lineWidth: on ? 3 : 2 }, castShadow: false });
      if (on && it.kind === 'surface') mesh.outline = ACCENT;
      this.direct.push({ id: it.id, mesh, kind: it.kind });
      if (on && it.controls.length) this.controls.push(this.viewer.add({ positions: it.controls, topology: 'lines' }, { material: { color: '#c9a3ff', unlit: true, lineWidth: 1.2 }, pickable: false, castShadow: false }));
    }
    this.viewer.requestRender();
  }

  /** Instances of other parts: lit like bodies, with their edges; the selected ones outlined. */
  setInstances(items: { id: string; bodies: BodyResult[] }[], selected: readonly string[]): void {
    for (const it of this.instances) for (const m of [...it.surfaces, ...it.edges]) { m.remove(); m.geometry.dispose(); }
    this.instanceMeshes = new Map(items.map(it => [it.id, it.bodies.map(b => b.mesh)]));
    this.instances = items.map(it => ({
      id: it.id,
      surfaces: it.bodies.map(b => this.viewer.add({ positions: b.mesh.positions, normals: b.mesh.normals, indices: b.mesh.indices }, { name: 'inst:' + it.id })),
      edges: it.bodies.filter(b => b.mesh.edgeLines.length).map(b => this.viewer.add({ positions: b.mesh.edgeLines, topology: 'lines' }, { name: 'inst:' + it.id, material: { color: this.theme.edge, unlit: true, lineWidth: 1.2 }, castShadow: false, pickable: false })),
    }));
    this.instanceSelection = selected;
    this.paintInstances(); this.placePreview();
  }

  /** Instances' look: the modelling base, or their render appearance (by key inst:<id>). */
  private paintInstances(): void {
    const r = this.settings, env = r?.environment;
    for (const it of this.instances) {
      const look = r ? appearanceOf(r, 'inst:' + it.id) : null;
      it.surfaces.forEach((m, bi) => {
        m.material = look ? { color: look.color, metallic: look.metallic, roughness: look.roughness, opacity: look.opacity, shader: this.shaderOf(look.shader) }
          : { color: '#ffffff', metallic: 0, roughness: 0.62, opacity: 1, shader: null };
        m.outline = this.instanceSelection.includes(it.id) ? ACCENT : null;
        // Face colours as the bodies' (paint): the base, picked faces mixed with the accent.
        const mesh = this.instanceMeshes.get(it.id)?.[bi];
        if (!mesh) return;
        const base: Vec3 = look ? [1, 1, 1] : this.theme.base, on = mix(base, ACCENT, 0.42), picked = new Set(this.instanceFaces.filter(f => f.id === it.id && f.body === bi).map(f => f.face));
        const colors = new Float32Array(mesh.positions.length);
        for (let v = 0; v < colors.length / 3; v++) colors.set(picked.has(mesh.faceOfVertex[v]) ? on : base, v * 3);
        m.geometry.setColors(colors);
      });
      for (const e of it.edges) { e.material = { color: this.theme.edge }; e.visible = env ? env.edges : true; }
    }
    this.viewer.requestRender();
  }

  /** An instance dragged with the gizmo: its meshes moved by the drag until it is evaluated where it lands. */
  setInstancePreview(preview: { id: string; matrix: Float64Array } | null): void {
    this.instancePreview = preview; this.placePreview();
  }
  private instancePreview: { id: string; matrix: Float64Array } | null = null;
  private placePreview(): void {
    const p = this.instancePreview;
    for (const it of this.instances) for (const m of [...it.surfaces, ...it.edges]) m.transform = p && p.id === it.id ? p.matrix : translation([0, 0, 0]);
    this.viewer.requestRender();
  }

  /** Shows faces of instances as picked. */
  setInstanceFaces(faces: readonly { id: string; body: number; face: number }[]): void {
    this.instanceFaces = faces; this.paintInstances();
  }

  /** The instance under a point. */
  pickInstance(x: number, y: number, camera: OrbitCamera): string | null {
    return this.pickInstanceFace(x, y, camera)?.id ?? null;
  }

  /** The instance under a point, and which of its bodies' display faces (by the triangle hit). */
  pickInstanceFace(x: number, y: number, camera: OrbitCamera): { id: string; body: number; face: number } | null {
    if (!this.instances.length) return null;
    this.sync(camera);
    const hit = this.viewer.raycast(x, y), name = hit?.mesh.name;
    if (!hit || !name?.startsWith('inst:')) return null;
    const it = this.instances.find(i => i.id === name.slice(5)), body = it ? it.surfaces.indexOf(hit.mesh) : -1;
    const mesh = body >= 0 ? this.instanceMeshes.get(it!.id)?.[body] : undefined;
    const face = mesh && hit.triangle !== null ? mesh.faceOfVertex[mesh.indices[hit.triangle * 3]] : -1;
    return { id: name.slice(5), body: Math.max(0, body), face: face ?? -1 };
  }

  /** The direct object under a point: a surface hit, else a curve within a few pixels. */
  pickDirect(x: number, y: number, camera: OrbitCamera): string | null {
    if (!this.direct.length) return null;
    this.sync(camera);
    const hit = this.viewer.raycast(x, y), line = this.viewer.pickLine(x, y, 6);
    const of = (m: Mesh | undefined) => m?.name?.startsWith('direct:') ? m.name.slice(7) : null;
    return of(line?.mesh) ?? of(hit?.mesh);
  }

  /** The frame as drawn, as a PNG. */
  async capture(): Promise<Blob> {
    const img = await this.viewer.capture(), c = new OffscreenCanvas(img.width, img.height);
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    return c.convertToBlob({ type: 'image/png' });
  }

  dispose(): void { this.viewer.dispose(); }
}

/** Texture coordinates by box projection: each vertex across the body's box on its face's two other axes. */
function boxUVs(P: Float32Array, N: Float32Array, b: { min: Vec3; max: Vec3 }): Float32Array {
  const uv = new Float32Array((P.length / 3) * 2), span = [0, 1, 2].map(k => Math.max(1e-9, b.max[k] - b.min[k]));
  for (let v = 0; v < P.length / 3; v++) {
    const n = [Math.abs(N[3 * v]), Math.abs(N[3 * v + 1]), Math.abs(N[3 * v + 2])], k = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2;
    const [a, c] = k === 0 ? [1, 2] : k === 1 ? [0, 2] : [0, 1];
    uv[2 * v] = (P[3 * v + a] - b.min[a]) / span[a]; uv[2 * v + 1] = (P[3 * v + c] - b.min[c]) / span[c];
  }
  return uv;
}
