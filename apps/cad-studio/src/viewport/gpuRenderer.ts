// The studio viewport on the @barocss/gpu viewer (WebGPU): the same interface as the WebGL2 Renderer, so
// the viewport keeps its own camera, pointer handling and overlays. Bodies are lit meshes with their edges
// as lines; hovered and selected faces are vertex colours, hovered and selected edges a wider line on top,
// selected bodies an outline; ghost bodies are see-through. Picking is on the CPU (synchronous for hover).
// With render settings (the Render workspace) bodies take their appearances, and the lights, environment
// and ground come from the settings instead of the theme's modelling look.
import { clipBox, createViewer, multiply, rotation, translation, type Geometry, type ImageTexture, type Light, type Mesh, type ShaderMaterial, type Viewer } from '@barocss/gpu/viewer';
import { curvature, overhang, zebra, type Analysis } from './analysis';
import { faceRuns, paintFaces, type FaceRuns, type Painted } from './facePaint';

const ZEBRA = zebra(), CURVATURE = curvature();
import { materialShader, showScene, type MaterialShaderResult, type SceneView } from '@barocss/gpu';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { appearanceOf, tiledUVs, type Appearance, type RenderSettings } from '@barocss/cad-model/engine/render';
import type { DirectDisplay } from '@barocss/cad-model/engine/direct';
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import type { OrbitCamera } from './camera';
import type { EdgeRef, FaceRef, InstanceItem, MouldShown, OverlayLines, OverlayPoints, SectionClip, ThemeName, ViewRenderer, ViewState } from './renderer';
import type { ScalarMap } from './scalarMaps';

/** Device pixels per CSS pixel, up to 3 (a high-density screen with the page zoomed in). */
const pixelRatio = () => Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));

interface Theme { bgTop: Vec3; bgBottom: Vec3; grid: Vec3; gridOpacity: number; base: Vec3; edge: Vec3; ao: number; shadow: number }
const THEMES: Record<ThemeName, Theme> = {
  dark: { bgTop: [0.180, 0.188, 0.208], bgBottom: [0.094, 0.098, 0.106], grid: [0.55, 0.55, 0.57], gridOpacity: 0.16, base: [0.74, 0.75, 0.78], edge: [0.05, 0.05, 0.06], ao: 0.9, shadow: 0.45 },
  light: { bgTop: [0.965, 0.972, 0.980], bgBottom: [0.780, 0.812, 0.851], grid: [0.30, 0.34, 0.40], gridOpacity: 0.14, base: [0.70, 0.74, 0.80], edge: [0.11, 0.14, 0.19], ao: 0.8, shadow: 0.28 },
};
const ACCENT: Vec3 = [0.910, 0.761, 0.353];
const HOVER: Vec3 = [0.62, 0.55, 0.36];
/** A direction in the camera's frame (x right, y up, z toward the eye) as the world's, negated: where a light shines (PERF3 C17: module level). */
const toward = (right: Vec3, up: Vec3, forward: Vec3, x: number, y: number, z: number): Vec3 => [-(x * right[0] + y * up[0] - z * forward[0]), -(x * right[1] + y * up[1] - z * forward[1]), -(x * right[2] + y * up[2] - z * forward[2])];
/** The identity transform: a mesh as placed. */
const IDENTITY = translation([0, 0, 0]);
/** Whether a mesh's transform is already `m` (setting it marks the mesh's block to send again). */
const sameTransform = (a: ArrayLike<number>, m: ArrayLike<number>) => { for (let i = 0; i < 16; i++) if (a[i] !== m[i]) return false; return true; };
/** A mesh moved to `m`, when it is not there already. */
const place = (mesh: Mesh, m: ArrayLike<number>) => { if (!sameTransform(mesh.transform, m)) mesh.transform = m; };
/** The same rings (by identity, or by content). */
const sameLines = (a: Float32Array | undefined, b: Float32Array | undefined) => { if (a === b) return true; if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
/** A box grown to hold another. */
const grow = (min: Vec3, max: Vec3, b: { min: readonly number[]; max: readonly number[] }) => { for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); } };
const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** `state`: what setState last showed it as (hover, picks, colours, ghost, placement), so an unchanged body is left alone. */
/** `runs` and `painted`: the surface's vertices by face, and what its colours show (a hover repaints only what changed). */
interface PlacedInstance { id: string; sigs: string[]; threadLines: Float32Array | undefined; surfaces: Mesh[]; edges: Mesh[]; threads: Mesh | null }
interface Body { result: BodyResult; surface: Mesh; edges: Mesh | null; highlight: Mesh | null; geometries: Geometry[]; sig: string; state: string; tile?: number; runs: FaceRuns; painted: Painted | null }

/** A mesh's content in a few numbers (sizes, bounds and a sample of positions): equal for a re-evaluation that changed nothing. */
function signature(r: BodyResult): string {
  const m = r.mesh, p = m.positions, step = Math.max(1, Math.floor(p.length / 997));
  let h = 2166136261;
  for (let i = 0; i < p.length; i += step) { h ^= Math.round(p[i] * 1e4); h = Math.imul(h, 16777619); }
  return [r.key, p.length, m.indices.length, m.edgeLines.length, ...m.bounds.min, ...m.bounds.max, h >>> 0].join(',');
}


export class GpuRenderer implements ViewRenderer {
  aoEnabled = true;
  interacting = false;
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
  private regions: Mesh[] = [];
  /** A surface analysis look (zebra, curvature) for the modelling view, or none. */
  private analysis: ShaderMaterial | null = null;
  private analysisKey: string | null = null;
  /** Colour maps by image (null while one loads), and the tiling each instance surface has. */
  private maps = new Map<string, ImageTexture | null>();
  private instanceTiles = new WeakMap<Mesh, { tile?: number }>();
  /** What each instance surface's vertex colours show (the display mesh and its colours' key). */
  private instancePainted = new WeakMap<Mesh, { mesh: DisplayMesh; key: string }>();
  private threads: Mesh | null = null;
  /**
   * Placed instances of other parts: their bodies' surfaces and edges and their thread rings, and what they were made from
   * (the bodies' signatures and the rings), so an unchanged instance keeps its meshes (G1).
   */
  private instances: PlacedInstance[] = [];
  /** The instances shown moved (posed, exploded): a matrix each on their meshes (G1). */
  private poses: ReadonlyMap<string, Float64Array> | null = null;
  /** The section's clip plane (G2), or none. */
  private clip: SectionClip | null = null;
  /** Analysis maps on the bodies (G6), and which map each body's surface shows now. */
  private scalarMaps: readonly ScalarMap[] | null = null;
  private mapShown = new WeakMap<Mesh, ScalarMap | null>();
  /** The mould's view (G6): its loops' line mesh and its halves' meshes, and what they were made from. */
  private mould: { from: MouldShown; lines: Mesh | null; halves: { half: '+' | '-'; index: number; surface: Mesh; edges: Mesh | null }[] } | null = null;
  private instanceSelection: readonly string[] = [];
  /** Instances' display meshes (for the face under a pick). */
  private instanceMeshes = new Map<string, DisplayMesh[]>();
  /** Faces of instances shown picked (mate faces). */
  private instanceFaces: readonly { id: string; body: number; face: number }[] = [];
  private view: ViewState | null = null;

  private host: { request: () => void } = { request: () => {} };
  private constructor(readonly canvas: HTMLCanvasElement, private readonly viewer: Viewer) {}
  /** Where the viewer's frame requests go: the viewport's request (one draw per animation frame). */
  setRequestHost(request: () => void): void { this.host.request = request; }

  /** A renderer on the canvas, or an error when WebGPU is not available (the caller falls back). */
  static async create(canvas: HTMLCanvasElement): Promise<GpuRenderer> {
    // (Host-driven frames: the viewer's own requests go to the viewport's frame loop, which draws once per animation
    // frame; the viewer scheduling its own as well drew every change twice, PERF3 A2.)
    const host = { request: () => {} };
    const viewer = await createViewer(canvas, { controls: false, camera: { up: [0, 0, 1] }, pixelRatio: pixelRatio(), onRequestRender: () => host.request() });
    viewer.outlineWidth = 2;
    const r = new GpuRenderer(canvas, viewer);
    r.host = host;
    r.setTheme('dark');
    return r;
  }

  setTheme(name: ThemeName): void {
    this.theme = THEMES[name];
    this.applyLook();
    // (The cap takes the theme's colour.)
    if (this.clip) this.setClip(this.clip);
  }

  /** Render settings (the Render workspace), or null for the modelling look. */
  setRender(settings: RenderSettings | null): void {
    this.settings = settings;
    for (const b of this.bodies) b.state = '';
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
      this.paint(b, new Map()); b.state = '';
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
    // Otherwise each body whose mesh is unchanged keeps its GPU meshes (wherever it now stands in the
    // list); only new ones are built, and gone ones released. (setState paints them: state '' is unpainted.)
    const pool = new Map<string, Body[]>();
    for (const b of this.bodies) pool.set(b.sig, [...(pool.get(b.sig) ?? []), b]);
    const was = this.bodies;
    this.bodies = results.map((result, bi) => {
      const old = pool.get(sigs[bi])?.shift();
      if (old) { if (was[bi] !== old) old.state = ''; old.result = result; return old; }
      return this.makeBody(result, sigs[bi]);
    });
    for (const list of pool.values()) for (const b of list) { b.surface.remove(); b.edges?.remove(); this.dropHighlight(b); b.geometries.forEach(g => g.dispose()); }
    this.placeGround();
    this.applyClip();
    this.applyMaps();
    this.viewer.requestRender();
  }

  /** Analysis maps on the bodies (G6). */
  setScalarMaps(maps: readonly ScalarMap[] | null): void { this.scalarMaps = maps; this.applyMaps(); this.viewer.requestRender(); }
  /** Each body's surface showing its map (its field set once per map), or its own look again. */
  private applyMaps(): void {
    for (const b of this.bodies) {
      const map = this.scalarMaps?.find(m => m.body === b.result.key && m.values.length === (m.per === 'vertex' ? b.result.mesh.positions.length / 3 : b.result.mesh.indices.length / 3)) ?? null;
      // (Never shown and none now: nothing to clear.)
      if ((this.mapShown.get(b.surface) ?? null) === map) continue;
      this.mapShown.set(b.surface, map);
      b.surface.geometry.setScalars(map ? map.values : null, map?.per ?? 'vertex');
      b.surface.colorMap = map ? { stops: map.legend.stops, above: map.above ?? null, below: map.below ?? null, missing: map.missing } : null;
    }
  }
  /**
   * The mould's view (G6): the loops as one line mesh (the accent, 2.4 px, depth-tested), each half's bodies see-through in
   * its colour (+ along the pull blue, − against it amber) with their edges, spread ± along the pull; made again only when
   * the loops or halves change, moved when only the spread does. While halves show, the part's bodies are not picked.
   */
  setMould(view: MouldShown | null): void {
    const had = this.mould;
    if (had && view && had.from.loops === view.loops && had.from.plus === view.plus && had.from.minus === view.minus) { had.from = view; this.placeHalves(); this.viewer.requestRender(); return; }
    if (had) { for (const m of [had.lines, ...had.halves.flatMap(h => [h.surface, h.edges])]) if (m) { m.remove(); m.geometry.dispose(); } }
    this.mould = null;
    if (view) {
      const segs: number[] = [];
      for (const l of view.loops) for (let i = 0; i + 1 < l.points.length + (l.closed ? 1 : 0); i++) { const a = l.points[i], b = l.points[(i + 1) % l.points.length]; segs.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
      const lines = segs.length ? this.viewer.add({ positions: segs, topology: 'lines' }, { name: 'mould:parting', material: { color: ACCENT, unlit: true, lineWidth: 2.4 }, pickable: false, castShadow: false }) : null;
      const halves = (['+', '-'] as const).flatMap(half => (half === '+' ? view.plus : view.minus).map((b, index) => {
        const surface = this.viewer.add({ positions: b.mesh.positions, normals: b.mesh.normals, indices: b.mesh.indices }, { name: `half:${half}:${index}`, material: { color: half === '+' ? '#5b9bd5' : '#e0a040', roughness: 0.6, opacity: 0.6 }, castShadow: false });
        const edges = b.mesh.edgeLines.length ? this.viewer.add({ positions: b.mesh.edgeLines, topology: 'lines' }, { material: { color: this.theme.edge, unlit: true, lineWidth: 1, opacity: 0.6 }, pickable: false, castShadow: false }) : null;
        return { half, index, surface, edges };
      }));
      this.mould = { from: view, lines, halves };
      this.placeHalves();
    }
    // (While halves show, picks reach only them.)
    if (this.view) { for (const b of this.bodies) b.state = ''; this.setState(this.view); }
    this.applyClip();
    this.viewer.requestRender();
  }
  /** Each half moved ± along the pull by the spread. */
  private placeHalves(): void {
    const m = this.mould; if (!m) return;
    const p = m.from.pull, k = m.from.spread;
    for (const h of m.halves) { const s = h.half === '+' ? k : -k, t = translation([p[0] * s, p[1] * s, p[2] * s]); place(h.surface, t); if (h.edges) place(h.edges, t); }
  }
  /** Isoclines (G6): one line mesh (white, 1.6 px, depth-tested), made again when they change. */
  setIsoclines(lines: readonly { points: readonly Vec3[]; closed: boolean }[] | null): void {
    if (this.isoclines) { this.isoclines.remove(); this.isoclines.geometry.dispose(); this.isoclines = null; }
    const segs: number[] = [];
    for (const l of lines ?? []) for (let i = 0; i + 1 < l.points.length + (l.closed ? 1 : 0); i++) { const a = l.points[i], b = l.points[(i + 1) % l.points.length]; segs.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    if (segs.length) this.isoclines = this.viewer.add({ positions: segs, topology: 'lines' }, { name: 'isoclines', material: { color: '#ffffff', unlit: true, lineWidth: 1.6 }, pickable: false, castShadow: false });
    this.applyClip(); this.viewer.requestRender();
  }
  private isoclines: Mesh | null = null;

  /** Overlay lines by key (G7): one line mesh each, made when they change, never per frame. */
  setOverlayLines(key: string, lines: OverlayLines | null): void {
    const had = this.overlays.get(key);
    if (had) { had.remove(); had.geometry.dispose(); this.overlays.delete(key); }
    if (lines && lines.segments.length >= 6) {
      this.overlays.set(key, this.viewer.add({ positions: lines.segments, topology: 'lines' }, {
        name: 'overlay:' + key, pickable: false, castShadow: false, receiveShadow: false, clipped: false, bounded: false,
        material: { color: lines.color, unlit: true, lineWidth: lines.width, opacity: lines.opacity ?? 1, lineDash: lines.dash ?? null, lineOver: !!lines.over, lineHidden: lines.hidden ?? 0 },
      }));
    }
    this.viewer.requestRender();
  }
  /** Overlay points by key (G8): one point mesh each, made when they change. */
  setOverlayPoints(key: string, points: OverlayPoints | null): void {
    const had = this.overlays.get(key);
    if (had) { had.remove(); had.geometry.dispose(); this.overlays.delete(key); }
    if (points && points.positions.length >= 3) {
      this.overlays.set(key, this.viewer.add({ positions: points.positions, colors: points.colors, topology: 'points' }, {
        name: 'overlay:' + key, pickable: false, castShadow: false, receiveShadow: false, clipped: false, bounded: false,
        material: { color: points.color ?? '#ffffff', unlit: true, pointSize: points.size, pointShape: points.shape ?? 'circle', pointBorder: points.border ?? null, opacity: points.opacity ?? 1, lineOver: !!points.over, lineHidden: points.hidden ?? 0 },
      }));
    }
    this.viewer.requestRender();
  }
  overlayLines(): Record<string, number> { return Object.fromEntries([...this.overlays].map(([k, m]) => [k, m.geometry.topology === 'points' ? m.geometry.data.elementCount : m.geometry.data.elementCount / 2])); }
  private overlays = new Map<string, Mesh>();

  /** The half under a point (G6), or null. */
  pickHalf(x: number, y: number, camera: OrbitCamera): { half: '+' | '-'; index: number } | null {
    if (!this.mould?.halves.length) return null;
    this.sync(camera);
    const hit = this.viewer.raycast(x, y), h = hit && this.mould.halves.find(q => q.surface === hit.mesh);
    return h ? { half: h.half, index: h.index } : null;
  }

  /** The map's value under a point (G6): the ray's hit on a mapped body, or null. */
  scalarAt(x: number, y: number, camera: OrbitCamera): number | null {
    if (!this.scalarMaps?.length) return null;
    this.sync(camera);
    const hit = this.viewer.raycast(x, y);
    return hit && hit.scalar !== undefined && Number.isFinite(hit.scalar) && this.mapShown.get(hit.mesh) ? hit.scalar : null;
  }

  /**
   * The section's clip plane (G2): the viewer's plane; each mesh's cap in its own colour (G2b: set where it is painted),
   * the theme's base mixed with the accent where none is; the part's bodies cut by it only while their exact section is not
   * shown.
   */
  setClip(clip: SectionClip | null): void {
    this.clip = clip;
    // (The ground under what is shown, as the CPU's clipped bodies put it.)
    this.placeGround();
    this.viewer.clipPlane = clip ? { normal: clip.normal, offset: clip.offset, cap: mix(this.theme.base, ACCENT, 0.42) } : null;
    this.applyClip();
    this.viewer.requestRender();
  }
  /**
   * Which meshes the plane cuts, as the CPU section cut them: the bodies' surfaces, edges and highlights (while not exact)
   * and the placed parts' surfaces, edges and rings, their surfaces capped; nothing else (the ground, direct objects,
   * regions, rings, props).
   */
  private applyClip(): void {
    if (!this.clip) return;
    const bodies = this.clip.bodies, cut = new Set<Mesh>();
    for (const b of this.bodies) for (const m of [b.surface, b.edges, b.highlight]) if (m) { m.clipped = bodies; cut.add(m); }
    for (const b of this.bodies) b.surface.cap = true;
    for (const it of this.instances) { for (const m of [...it.surfaces, ...it.edges, ...(it.threads ? [it.threads] : [])]) { m.clipped = true; cut.add(m); } for (const m of it.surfaces) m.cap = true; }
    for (const m of this.viewer.meshList) if (!cut.has(m)) m.clipped = false;
  }

  /**
   * The shadow catcher under the bodies (and the placed parts), 1.5 times their spread and 20 mm more each way, just
   * below them: one unit square made once, placed by its transform (G2: it follows the section's cut without a new mesh).
   */
  private placeGround(): void {
    const b = this.bounds();
    if (!b) { if (this.ground) this.ground.visible = false; return; }
    const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, r = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) * 1.5 + 20, z = b.min[2] - 0.02;
    this.ground ??= this.viewer.add({ positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3] },
      { material: { shadowOnly: true, opacity: this.settings ? 0.55 : this.theme.shadow }, pickable: false, castShadow: false, clipped: false });
    place(this.ground, [r, 0, 0, 0, 0, r, 0, 0, 0, 0, 1, 0, cx, cy, z, 1]);
    this.ground.visible = this.settings ? this.settings.environment.ground : true;
  }

  private makeBody(result: BodyResult, sig: string): Body {
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
      edges = this.viewer.add(g, { material: { color: this.theme.edge, unlit: true, lineWidth: 1.2 }, castShadow: false, visible: this.settings ? this.settings.environment.edges : true });
    }
    return { result, surface, edges, highlight: null, geometries, sig, state: '', runs: faceRuns(m.faceOfVertex), painted: null };
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
  private paint(b: Body, faceState: Map<number, number>, own?: Vec3, faces?: Map<number, Vec3>): void {
    // (Rendering: the appearance is the material colour, so faces are white unless picked — a face's
    // own colour tints it; modelling: the body's own colour when it has one, a face's own over it.)
    const base: Vec3 = this.settings ? [1, 1, 1] : own ?? this.theme.base;
    const shade = [base, mix(base, ACCENT, 0.2), mix(base, ACCENT, 0.42)], shades = new Map<number, Vec3[]>();
    for (const [f, c] of faces ?? []) shades.set(f, [c, mix(c, ACCENT, 0.2), mix(c, ACCENT, 0.42)]);
    // (The same colours as last time: only the faces whose hover or selection changed are written.)
    const key = JSON.stringify([base, faces ? [...faces] : null]);
    b.painted = paintFaces(b.surface.geometry, b.runs, b.painted, key, faceState, shade, shades);
  }

  setState(view: ViewState): void {
    this.view = view;
    this.bodies.forEach((b, bi) => {
      const faceState = new Map<number, number>();
      if (view.hoverFace?.body === bi) faceState.set(view.hoverFace.face, 1);
      for (const f of view.selectedFaces) if (f.body === bi) faceState.set(f.face, 2);
      // Hovered and selected edges: their segments again, wider and in the accent colour.
      const edgeState = new Map<number, number>();
      if (view.hoverEdge?.body === bi) edgeState.set(view.hoverEdge.edge, 1);
      for (const e of view.selectedEdges) if (e.body === bi) edgeState.set(e.edge, 2);
      // (Only a body whose look changed is painted again: a hover repaints one body, not all.)
      const t = view.transforms?.get(bi), faces = view.faceColors?.get(bi);
      const state = JSON.stringify([[...faceState], [...edgeState], view.selectedEdges.length > 0, view.bodyColors?.get(bi) ?? null, faces ? [...faces] : null,
        view.ghostBodies.has(bi), !!view.hiddenBodies?.has(bi), view.selectedBodies.includes(bi) ? 2 : view.hoverBody === bi ? 1 : 0, t ? Array.from(t) : view.offsets.get(bi) ?? null]);
      if (state === b.state) return;
      b.state = state;
      this.paint(b, faceState, view.bodyColors?.get(bi), faces);
      // (Its cap as the CPU's section painted its cut face: selected, the body's own colour or the base mixed with the accent; G2b.)
      b.surface.capColor = mix(this.settings ? [1, 1, 1] : view.bodyColors?.get(bi) ?? this.theme.base, ACCENT, 0.42);
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
        ? { color: look.color, metallic: look.metallic, roughness: look.roughness, opacity: ghost ? Math.min(0.35, look.opacity) : look.opacity, shader: this.shaderOf(look.shader), doubleSided: !!look.twoSided, map: this.mapFor(b.surface.geometry, b.result.mesh, look, b), alphaCutoff: look.cutout ?? 0 }
        : { color: '#ffffff', metallic: 0, roughness: 0.62, opacity: ghost ? 0.35 : 1, shader: this.analysis, unlit: !!this.analysis, map: this.mapFor(b.surface.geometry, b.result.mesh, null, b), alphaCutoff: 0 };
      const hidden = !!view.hiddenBodies?.has(bi);
      // (While the mould's halves show, picks reach only them, G6.)
      const halvesOn = !!this.mould?.halves.length;
      b.surface.pickable = !ghost && !hidden && !halvesOn; b.surface.visible = !hidden;
      b.surface.outline = view.selectedBodies.includes(bi) ? ACCENT : view.hoverBody === bi ? HOVER : null;
      const moved = view.transforms?.get(bi) ?? translation(offset);
      for (const mesh of [b.surface, b.edges, b.highlight]) if (mesh) mesh.transform = moved;
      if (b.edges) { b.edges.material = { opacity: ghost ? 0.35 : 0.9 }; b.edges.pickable = !ghost && !hidden && !halvesOn; b.edges.visible = !hidden && (this.settings ? this.settings.environment.edges : true); }
    });
    this.applyClip();
  }

  private dropHighlight(b: Body): void {
    if (!b.highlight) return;
    b.highlight.remove(); b.highlight.geometry.dispose(); b.highlight = null;
  }

  /** Lights that follow the camera, as the WebGL renderer's: a key from upper left, a fill from the right. */
  private lights(camera: OrbitCamera): Light[] {
    const { right, up, forward } = camera.basis();
    return [
      { kind: 'directional', direction: toward(right, up, forward, -0.45, 0.55, 0.70), intensity: 0.8 },
      { kind: 'directional', direction: toward(right, up, forward, 0.6, -0.2, 0.5), intensity: 0.22 },
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
      const envMap = e.map ? this.imageTexture(e.map.image) : null;
      v.environment = { sky: [0.95, 0.96, 1], ground: [0.55, 0.53, 0.5], ambient: e.ambient, exposure: e.exposure, toneMapping: e.toneMapping, ambientOcclusion: e.occlusion && !this.interacting ? { radius: Math.max(1, size * 0.045), strength: 0.9 } : false, ...(envMap ? { map: envMap, mapIntensity: e.map!.intensity } : {}) };
    } else {
      v.lights = this.lights(camera);
      v.environment = { sky: [0.95, 0.96, 1], ground: [0.55, 0.53, 0.5], ambient: 0.4, ambientOcclusion: this.aoEnabled && !this.interacting ? { radius: Math.max(1, size * 0.045), strength: this.theme.ao } : false };
    }
    // The display's pixel ratio as it is now (it changes with the browser zoom, or on another screen).
    v.resize(pixelRatio());
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
    // (Cut by the section's plane where it cuts them, as the CPU's clipped meshes' boxes are: the ambient occlusion and the fit follow it.)
    const c = this.clip;
    for (const b of this.bodies) { const x = c?.bodies ? clipBox(b.result.mesh.bounds, c) : b.result.mesh.bounds; if (x) grow(min, max, x); }
    for (const d of this.direct) { const b = d.mesh.bounds; if (b) grow(min, max, b); }
    for (const it of this.instances) for (const m of it.surfaces) { const b = c ? clipBox(m.bounds, c) : m.bounds; if (b) grow(min, max, b); }
    return min[0] <= max[0] ? { min, max } : null;
  }

  /** Cosmetic threads: thin rings in the edge colour, a little faded. */
  setThreads(lines: Float32Array): void {
    if (this.threads) { this.threads.remove(); this.threads.geometry.dispose(); this.threads = null; }
    if (lines.length) this.threads = this.viewer.add({ positions: lines, topology: 'lines' }, { material: { color: this.theme.edge, unlit: true, lineWidth: 1, opacity: 0.55 }, pickable: false, castShadow: false });
    this.applyClip(); this.viewer.requestRender();
  }

  /**
   * A look's colour map, loaded once per image (the bodies are painted again when it arrives), and the
   * geometry's texture coordinates to match: tiled every `scale` mm with a map, else as made (the
   * part's box, which shader materials read).
   */
  private mapFor(g: Geometry, mesh: DisplayMesh, look: Appearance | null, keep: { tile?: number }) {
    const t = look?.texture, tile = t ? t.scale : undefined;
    if (keep.tile !== tile) { g.setUVs(t ? tiledUVs(mesh.positions, mesh.normals, t.scale) : boxUVs(mesh.positions, mesh.normals, mesh.bounds)); keep.tile = tile; }
    return t ? this.imageTexture(t.image) : null;
  }

  /** An image (a data URL) as a texture, loaded once (null while it loads: the bodies are painted again when it arrives). */
  private imageTexture(url: string): ImageTexture | null {
    if (this.maps.has(url)) return this.maps.get(url) ?? null;
    this.maps.set(url, null);
    void (async () => {
      try {
        const bitmap = await createImageBitmap(await (await fetch(url)).blob());
        this.maps.set(url, this.viewer.createTexture(bitmap));
        for (const b of this.bodies) b.state = '';
        if (this.view) this.setState(this.view);
        this.paintInstances(); this.viewer.requestRender();
      } catch { /* not an image the browser reads: drawn without it */ }
    })();
    return null;
  }

  /** Zebra stripes or the curvature map on every body in the modelling view (null: the plain look). */
  setAnalysis(mode: Analysis | null): void {
    const key = mode && typeof mode === 'object' ? `overhang:${mode.sinLimit}:${mode.bedZ}` : mode;
    if (key === this.analysisKey) return;
    this.analysisKey = key;
    const next = mode === 'zebra' ? ZEBRA : mode === 'curvature' ? CURVATURE : mode && typeof mode === 'object' ? overhang(mode.sinLimit, mode.bedZ) : null;
    this.analysis = next;
    for (const b of this.bodies) b.state = '';
    if (this.view) this.setState(this.view);
    this.paintInstances(); this.viewer.requestRender();
  }

  /** Tool regions: a see-through blue surface and its rims. */
  setRegions(mesh: { positions: Float32Array; normals: Float32Array; indices: Uint32Array; rims: Float32Array } | null): void {
    for (const m of this.regions) { m.remove(); m.geometry.dispose(); }
    this.regions = [];
    if (mesh && mesh.indices.length) {
      this.regions.push(this.viewer.add({ positions: mesh.positions, normals: mesh.normals, indices: mesh.indices }, { material: { color: '#4aa8ff', roughness: 0.6, opacity: 0.22, doubleSided: true }, pickable: false, castShadow: false }));
      this.regions.push(this.viewer.add({ positions: mesh.rims, topology: 'lines' }, { material: { color: '#6cbcff', unlit: true, lineWidth: 1.4, opacity: 0.9 }, pickable: false, castShadow: false }));
    }
    this.applyClip(); this.viewer.requestRender();
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
      if (on && it.isos?.length) this.controls.push(this.viewer.add({ positions: it.isos, topology: 'lines' }, { material: { color: '#f3f5f7', unlit: true, lineWidth: 1, opacity: 0.55 }, pickable: false, castShadow: false }));
      if (on && it.controls.length) this.controls.push(this.viewer.add({ positions: it.controls, topology: 'lines' }, { material: { color: '#c9a3ff', unlit: true, lineWidth: 1.2 }, pickable: false, castShadow: false }));
    }
    this.applyClip(); this.viewer.requestRender();
  }

  /**
   * Instances of other parts: lit like bodies, with their edges and thread rings; the selected ones outlined. An instance
   * whose bodies and rings are as they were keeps its meshes (a new selection, a re-evaluation that changed nothing, G1):
   * only new or changed ones are made, and gone ones released.
   */
  setInstances(items: InstanceItem[], selected: readonly string[]): void {
    const had = new Map(this.instances.map(it => [it.id, it]));
    this.instanceMeshes = new Map(items.map(it => [it.id, it.bodies.map(b => b.mesh)]));
    this.instances = items.map(it => {
      const sigs = it.bodies.map(signature), old = had.get(it.id);
      if (old && old.sigs.length === sigs.length && old.sigs.every((x, i) => x === sigs[i]) && sameLines(old.threadLines, it.threads)) { had.delete(it.id); return old; }
      return this.makeInstance(it, sigs);
    });
    for (const it of had.values()) this.dropInstance(it);
    this.instanceSelection = selected;
    this.paintInstances(); this.placePreview(); this.applyClip();
  }

  private makeInstance(it: InstanceItem, sigs: string[]): PlacedInstance {
    return {
      id: it.id, sigs, threadLines: it.threads,
      surfaces: it.bodies.map(b => this.viewer.add({ positions: b.mesh.positions, normals: b.mesh.normals, indices: b.mesh.indices }, { name: 'inst:' + it.id })),
      edges: it.bodies.filter(b => b.mesh.edgeLines.length).map(b => this.viewer.add({ positions: b.mesh.edgeLines, topology: 'lines' }, { name: 'inst:' + it.id, material: { color: this.theme.edge, unlit: true, lineWidth: 1.2 }, castShadow: false, pickable: false })),
      threads: it.threads?.length ? this.viewer.add({ positions: it.threads, topology: 'lines' }, { material: { color: this.theme.edge, unlit: true, lineWidth: 1, opacity: 0.55 }, pickable: false, castShadow: false }) : null,
    };
  }

  private dropInstance(it: PlacedInstance): void {
    for (const m of [...it.surfaces, ...it.edges, ...(it.threads ? [it.threads] : [])]) { m.remove(); m.geometry.dispose(); }
  }

  /** The instances shown moved, by a matrix each (G1): their meshes' transforms only, nothing made or uploaded. */
  setInstanceTransforms(transforms: ReadonlyMap<string, Float64Array> | null): void {
    this.poses = transforms; this.placePreview();
  }

  /** Instances' look: the modelling base, or their render appearance (by key inst:<id>). */
  private paintInstances(): void {
    const r = this.settings, env = r?.environment;
    for (const it of this.instances) {
      const look = r ? appearanceOf(r, 'inst:' + it.id) : null;
      it.surfaces.forEach((m, bi) => {
        const tiles = this.instanceTiles.get(m) ?? {}; this.instanceTiles.set(m, tiles);
        const dm = this.instanceMeshes.get(it.id)?.[bi];
        m.material = look ? { color: look.color, metallic: look.metallic, roughness: look.roughness, opacity: look.opacity, shader: this.shaderOf(look.shader), doubleSided: !!look.twoSided, map: dm ? this.mapFor(m.geometry, dm, look, tiles) : null, alphaCutoff: look.cutout ?? 0 }
          : { color: '#ffffff', metallic: 0, roughness: 0.62, opacity: 1, shader: this.analysis, unlit: !!this.analysis, map: null, alphaCutoff: 0 };
        m.outline = this.instanceSelection.includes(it.id) ? ACCENT : null;
        // Face colours as the bodies' (paint): the base, picked faces mixed with the accent.
        const mesh = this.instanceMeshes.get(it.id)?.[bi];
        if (!mesh) return;
        const base: Vec3 = look ? [1, 1, 1] : this.theme.base, on = mix(base, ACCENT, 0.42), picked = new Set(this.instanceFaces.filter(f => f.id === it.id && f.body === bi).map(f => f.face));
        // (Its cap as the CPU's section painted it: an instance's cut face was never selected, the base colour; G2b.)
        m.capColor = base;
        // (The same colours on the same mesh as last time: nothing written. A new selection repaints none of them.)
        const key = JSON.stringify([base, [...picked]]);
        if (this.instancePainted.get(m)?.mesh === mesh && this.instancePainted.get(m)?.key === key) return;
        this.instancePainted.set(m, { mesh, key });
        const colors = new Float32Array(mesh.positions.length);
        for (let v = 0; v < colors.length / 3; v++) colors.set(picked.has(mesh.faceOfVertex[v]) ? on : base, v * 3);
        m.geometry.setColors(colors);
      });
      for (const e of it.edges) { e.material = { color: this.theme.edge }; e.visible = env ? env.edges : true; }
      if (it.threads) it.threads.material = { color: this.theme.edge };
    }
    this.viewer.requestRender();
  }

  /** An instance dragged with the gizmo: its meshes moved by the drag until it is evaluated where it lands. */
  setInstancePreview(preview: { id: string; matrix: Float64Array } | null): void {
    this.instancePreview = preview; this.placePreview();
  }
  private instancePreview: { id: string; matrix: Float64Array } | null = null;
  /** Each instance's meshes where it is shown: its pose (if any), then the gizmo's drag of it (if it is the one dragged). */
  private placePreview(): void {
    const p = this.instancePreview;
    for (const it of this.instances) {
      const pose = this.poses?.get(it.id), drag = p && p.id === it.id ? p.matrix : null;
      const m = drag && pose ? multiply(drag, pose) : drag ?? pose ?? IDENTITY;
      for (const mesh of it.surfaces) place(mesh, m);
      for (const mesh of it.edges) place(mesh, m);
      if (it.threads) place(it.threads, m);
    }
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
