// Test-only page entry. Actual browser execution requires the coordinator's heavy-slot lease.
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, cylinderPart, withNode } from '@barocss/cad-model/engine/doc';
import { GpuRenderer } from '../../../../apps/cad-studio/src/viewport/gpuRenderer';
import { Renderer, type DisplayMode, type InstanceItem, type ViewState } from '../../../../apps/cad-studio/src/viewport/renderer';
import { OrbitCamera } from '../../../../apps/cad-studio/src/viewport/camera';
import { sectionedBodies, sectionedInstances, sectionHatch, sectionPlanes, type Section } from '../../../../apps/cad-studio/src/viewport/sectionView';
import { motionOf } from '../../../../apps/cad-studio/src/viewport/instancePose';
import { posedBody } from '../../../barocss-cad-model/src/robot/preview';
import type { BodyResult } from '../../../barocss-cad-model/src/engine/evaluate';
import type { DisplayMesh, Vec3 } from '../../../barocss-cad-model/src/engine/mesh';

export const MODES: DisplayMode[] = ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray'];
export const REQUIRED_CHECKS = ['display', 'nativeEdges:occlusion', 'nativeEdges:visibleSolid', 'nativeEdges:hiddenDash6-4', 'nativeEdges:wireframe', 'modes:roundTrip', 'picks:front-cap-roundTrip', 'appearance:lineOnlySuppressionRestore', 'authority:ghost-hidden', 'g20:quarter', 'g20:octant', 'g20:capLeaks', 'unsupported:scope'];
export const REQUIRED_INSTANCE_CHECKS = ['instances:placed-sharing', 'instances:depth-hidden', 'instances:pose-drag', 'instances:source-cap', 'instances:wide-face-id', 'instances:scope', 'instances:modes', 'instances:opacity', 'curves:silhouette', 'instances:isolate'];
export const LIMITS = Object.freeze({ strongRGB: 60, strongFraction: 0.001, capLeaks: 10, minimumCapPixelsAtDpr1: 8000, dash: [6, 4], dashBoundaryCSS: 1, solidCoverage: 0.9, absentCoverage: 0.02, dashOnCoverage: 0.9, dashOffCoverage: 0.1, opacityRGBError: 3 });
const LINE_MODES = MODES.slice(1, 4);
type Check = { name: string; pass: boolean; actual: unknown; expected: unknown };
type Raster = { width: number; height: number; data: Uint8ClampedArray };
type Adapter = Renderer | GpuRenderer;

export function boxBody(key: string, size: Vec3 = [20, 20, 20], center: Vec3 = [0, 0, 0]): BodyResult {
  const p: number[] = [], n: number[] = [], f: number[] = [], indices: number[] = [], faces: DisplayMesh['faces'] = [], edges = new Map<string, { a: Vec3; b: Vec3; faces: number[] }>();
  for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, base = p.length / 3, fi = faces.length, corners: Vec3[] = [];
    const normal: Vec3 = [0, 0, 0]; normal[axis] = sign;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const q = [...center] as Vec3; q[axis] += sign * size[axis] / 2; q[u] += a * size[u] / 2; q[v] += b * sign * size[v] / 2;
      p.push(...q); n.push(...normal); f.push(fi); corners.push(q);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    const centroid = [...center] as Vec3; centroid[axis] += sign * size[axis] / 2;
    faces.push({ index: fi, id: 'native-' + fi, name: 'native-' + fi, kind: 'plane', normal, centroid, areaMM2: size[u] * size[v] });
    for (let k = 0; k < 4; k++) {
      const a = corners[k], b = corners[(k + 1) % 4], id = [a.join(','), b.join(',')].sort().join('/');
      const had = edges.get(id); if (had) had.faces.push(fi); else edges.set(id, { a, b, faces: [fi] });
    }
  }
  const list = [...edges.values()], mesh: DisplayMesh = {
    positions: Float32Array.from(p), normals: Float32Array.from(n), faceOfVertex: Float32Array.from(f), indices: Uint32Array.from(indices), faces,
    edgeLines: Float32Array.from(list.flatMap(e => [...e.a, ...e.b])), edgeOfSegment: Float32Array.from(list.flatMap((_, i) => [i, i])),
    edges: list.map((e, i) => ({ index: i, a: e.a, b: e.b, faces: e.faces as [number, number], straight: true, axis: (['x', 'y', 'z'] as const).find((_, k) => e.a[k] !== e.b[k]) ?? null, names: e.faces.map(x => 'native-' + x) })),
    bounds: { min: center.map((x, k) => x - size[k] / 2) as Vec3, max: center.map((x, k) => x + size[k] / 2) as Vec3 },
  };
  return { key, family: 'planar', mesh, volumeMM3: size[0] * size[1] * size[2], massG: null };
}
/** Test packets use the production convention: bodies already placed in world space, placement only for sharing. */
export function instanceMatrix(angle = 0, center: Vec3 = [0, 0, 0]): Float64Array {
  const c = Math.cos(angle), s = Math.sin(angle);
  return Float64Array.from([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, ...center, 1]);
}
export function instancePacket(id: string, center: Vec3, angle = 0, size: Vec3 = [8, 12, 10]): InstanceItem {
  const placement = instanceMatrix(angle, center);
  return { id, placement, bodies: [posedBody(boxBody('body-' + id, size), motionOf(placement))] };
}
/** One used front face above 4096, not thousands of repeated geometry layers. */
export function wideFaceBody(): BodyResult {
  const body = boxBody('wide-face'), mesh = body.mesh, index = 4097;
  const faces = Array.from({ length: index + 1 }, (_, i) => i < mesh.faces.length ? mesh.faces[i] : { ...mesh.faces[3], index: i, id: 'wide-' + i, name: 'wide-' + i });
  return { ...body, mesh: { ...mesh, faces, faceOfVertex: mesh.faceOfVertex.map(f => f === 3 ? index : f) } };
}
export function volume(mesh: DisplayMesh): number {
  const p = mesh.positions, ix = mesh.indices; let sum = 0;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
    sum += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) + p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return Math.abs(sum / 6);
}
export const sectionOf = (count: 2 | 3): Section => ({ mode: 'cutout', planes: [0, 1, 2].slice(0, count).map(k => ({ normal: [0, 1, 2].map(j => +(j === k)) as Vec3, offset: 0 })) });
export const noEdges = (bodies: BodyResult[]): BodyResult[] => bodies.map(b => ({ ...b, mesh: { ...b.mesh, edges: [], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array() } }));
/** WebGL2 does not cull back faces: isolate one real boundary face for a per-surface alpha witness. */
export function singleOpacityFace(body: BodyResult, cap: boolean): BodyResult {
  const used = new Set(Array.from(body.mesh.indices, i => body.mesh.faceOfVertex[i]));
  const face = body.mesh.faces.find(f => used.has(f.index) && (cap ? f.id === 'section-cap' && f.normal[1] < -0.99 && Math.abs(f.centroid[1]) < 1e-6 : f.id === 'native-1'));
  if (!face) throw new Error('Single-layer opacity face is absent.');
  const indices = body.mesh.indices.filter(i => body.mesh.faceOfVertex[i] === face.index);
  if (indices.length < 3) throw new Error('Opacity face has no triangles.');
  return { ...body, mesh: { ...body.mesh, indices } };
}
export function keptBoxes(count: 2 | 3): { bodies: BodyResult[]; selectedFaces: ViewState['selectedFaces'] } {
  const bodies: BodyResult[] = [], selectedFaces: ViewState['selectedFaces'] = [];
  for (let code = 1; code < 1 << count; code++) {
    const center = [0, 1, 2].map(k => k < count ? ((code >> k) & 1 ? 5 : -5) : 0) as Vec3;
    const size = [0, 1, 2].map(k => k < count ? 10 : 20) as Vec3, body = bodies.length;
    const cell = boxBody('oracle-' + code, size, center);
    // Rasterize only the union boundary. Closed touching cells expose internal
    // accent walls at MSAA boundaries; those walls are not part of the solid.
    const internal = new Set<number>();
    for (let k = 0; k < count; k++) {
      const positive = (code >> k) & 1, neighbour = code ^ (1 << k);
      const face = 2 * k + (positive ? 1 : 0);
      if (neighbour !== 0) internal.add(face);
      else selectedFaces.push({ body, face });
    }
    cell.mesh = { ...cell.mesh, indices: cell.mesh.indices.filter(i => !internal.has(cell.mesh.faceOfVertex[i])) };
    bodies.push(cell);
  }
  return { bodies: noEdges(bodies), selectedFaces };
}
export function difference(a: Raster, b: Raster): { pixels: number; fraction: number } {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Raster sizes differ.');
  let pixels = 0;
  for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > LIMITS.strongRGB) pixels++;
  return { pixels, fraction: pixels / (a.width * a.height) };
}
export function lineCoverage(image: Raster, control: Raster, a: number[], b: number[], dpr: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
  let hits = 0, samples = 0, onHits = 0, on = 0, offHits = 0, off = 0;
  for (let s = 2; s < length - 2; s += 0.5) {
    let hit = false;
    for (let t = -1.5; t <= 1.5; t += 0.5) {
      const x = Math.round((a[0] + dx * s / length + nx * t) * dpr), y = Math.round((a[1] + dy * s / length + ny * t) * dpr);
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const i = (y * image.width + x) * 4;
      if (Math.abs(image.data[i] - control.data[i]) + Math.abs(image.data[i + 1] - control.data[i + 1]) + Math.abs(image.data[i + 2] - control.data[i + 2]) > LIMITS.strongRGB) hit = true;
    }
    samples++; if (hit) hits++;
    const phase = s % 10;
    if (phase >= 1 && phase <= 5) { on++; if (hit) onHits++; }
    if (phase >= 7 && phase <= 9) { off++; if (hit) offHits++; }
  }
  return { lengthCSS: length, samples, coverage: hits / samples, onCoverage: onHits / on, offCoverage: offHits / off, onSamples: on, offSamples: off };
}
export function opacityWitness(opaque: Raster, transparent: Raster, background: Raster, dpr: number) {
  const mean = (image: Raster) => { const sum = [0, 0, 0]; let count = 0; for (let y = image.height / 2 - dpr; y <= image.height / 2 + dpr; y++) for (let x = image.width / 2 - dpr; x <= image.width / 2 + dpr; x++) { const i = (Math.floor(y) * image.width + Math.floor(x)) * 4; for (let k = 0; k < 3; k++) sum[k] += image.data[i + k]; count++; } return sum.map(x => x / count); };
  const o = mean(opaque), actual = mean(transparent), bg = mean(background), expected = o.map((v, k) => 0.25 * v + 0.75 * bg[k]);
  const contrast = o.reduce((s, v, k) => s + Math.abs(v - bg[k]), 0), maxError = Math.max(...actual.map((v, k) => Math.abs(v - expected[k])));
  return { opaque: o, actual, background: bg, expected, contrast, maxError, pass: contrast > LIMITS.strongRGB && maxError <= LIMITS.opacityRGBError };
}
/** Independent analytic box/keep-union oracle, not the production mesh ray or cap code. */
export function analyticBoundary(origin: Vec3, direction: Vec3, min: Vec3, max: Vec3, section: Section): 'front' | 'cap' | null {
  const candidates: { t: number; kind: 'front' | 'cap' }[] = [];
  for (let k = 0; k < 3; k++) if (Math.abs(direction[k]) > 1e-12) for (const side of [min[k], max[k]]) candidates.push({ t: (side - origin[k]) / direction[k], kind: 'front' });
  for (const p of section.planes) { const den = p.normal.reduce((s, v, k) => s + v * direction[k], 0); if (Math.abs(den) > 1e-12) candidates.push({ t: (p.offset - p.normal.reduce((s, v, k) => s + v * origin[k], 0)) / den, kind: 'cap' }); }
  candidates.sort((a, b) => a.t - b.t || (a.kind === 'cap' ? -1 : 1));
  const inside = (t: number) => { const q = origin.map((v, k) => v + t * direction[k]); return q.every((v, k) => v >= min[k] && v <= max[k]) && section.planes.some(p => p.normal.reduce((s, v, k) => s + v * q[k], 0) >= p.offset); };
  for (const c of candidates) if (c.t >= 0 && inside(c.t - 1e-6) !== inside(c.t + 1e-6)) return c.kind;
  return null;
}
function aim(camera: OrbitCamera, eye: Vec3, target: Vec3, ortho = true) {
  const delta = eye.map((x, k) => x - target[k]); camera.target = target; camera.distance = Math.hypot(...delta); camera.yaw = Math.atan2(delta[1], delta[0]); camera.pitch = Math.asin(delta[2] / camera.distance); camera.ortho = ortho;
}
const stateOf = (displayMode: DisplayMode = 'shaded-with-edges'): ViewState => ({ displayMode, hoverFace: null, hoverEdge: null, selectedFaces: [], selectedEdges: [], selectedBodies: [], offsets: new Map(), ghostBodies: new Set(), hiddenBodies: new Set() });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
async function raster(blob: Blob): Promise<Raster> { const bitmap = await createImageBitmap(blob), c = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = c.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close(); return ctx.getImageData(0, 0, c.width, c.height); }
async function dataURL(blob: Blob): Promise<string> { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); }); }

/** Real CAD evaluation fixtures: analytic cylinder and half-disc revolve sphere, never facet imports. */
export function curvedBodies(): { name: string; body: BodyResult }[] {
  let sphere = withNode(emptyDoc(), { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -6], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 6] }] });
  sphere = withNode(sphere, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
  return [{ name: 'cylinder', doc: cylinderPart(6, 12) }, { name: 'sphere', doc: sphere }].map(({ name, doc }) => {
    const result = evaluateDoc(doc, 1);
    if (!result.ok || result.bodies.length !== 1) throw new Error('Actual curved CAD fixture evaluation failed: ' + name);
    const body = result.bodies[0];
    if (!body.mesh.faces.some(f => f.kind === 'curved' && !f.facet)) throw new Error('CAD fixture has no analytic curved display face: ' + name);
    return { name, body };
  });
}

export async function runG21Case({ backend, dpr, instances = false }: { backend: 'webgpu' | 'webgl2'; dpr: 1 | 2; instances?: boolean }) {
  const checks: Check[] = [], instanceChecks: Check[] = [], captures: { name: string; dataUrl: string }[] = [], errors: string[] = [], unsupported: unknown[] = [];
  const canvas = document.querySelector('canvas') ?? document.body.appendChild(document.createElement('canvas')); canvas.style.width = '640px'; canvas.style.height = '480px';
  const camera = new OrbitCamera(); camera.aspect = 640 / 480; aim(camera, [0, -90, 0], [0, 0, 0]);
  let renderer: Adapter | undefined, state = stateOf(), environment: Record<string, unknown> = { backend, fixtureTheme: 'light', grid: 'disabled for isolated raster witnesses', shaderErrors: [] };
  const add = (name: string, pass: boolean, actual: unknown, expected: unknown) => checks.push({ name, pass, actual, expected });
  const phase = async (names: string[], work: () => Promise<void>) => { try { await work(); } catch (e) { const error = String(e); errors.push(error); for (const name of names) if (!checks.some(c => c.name === name)) add(name, false, { error }, 'phase completed'); } };
  try {
    renderer = backend === 'webgpu' ? await GpuRenderer.create(canvas) : new Renderer(canvas);
    const r = renderer as Adapter & Record<string, any>; // Test-only access to renderer diagnostics/control layers.
    r.aoEnabled = false;
    // The existing light palette gives hidden .55-alpha lines sufficient contrast for the fixed
    // L1 RGB > 60 classifier. Do not lower a threshold after seeing actual raster results.
    r.setTheme('light');
    if (backend === 'webgpu') {
      r.viewer.grid = { ...r.viewer.grid, visible: false };
      const info = r.viewer.device.adapterInfo ?? (window as unknown as { __g21AdapterInfo?: Record<string, string> }).__g21AdapterInfo;
      if (!info) throw new Error('Actual viewer device adapter identity was not captured; a second adapter probe is not evidence.');
      environment = { ...environment, adapter: { vendor: info.vendor ?? '', architecture: info.architecture ?? '', device: info.device ?? '', description: info.description ?? '' }, adapterInfoSource: r.viewer.device.adapterInfo ? 'viewer-device' : 'actual-requestDevice-hook', device: true };
    } else {
      r.gridCount = 0; const gl = r.gl, ext = gl.getExtension('WEBGL_debug_renderer_info');
      environment = { ...environment, renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), version: gl.getParameter(gl.VERSION) };
    }
    const draw = async (name: string, mode: DisplayMode = state.displayMode ?? 'shaded-with-edges'): Promise<Raster> => {
      state = { ...state, displayMode: mode };
      if (backend === 'webgpu') r.viewer.device.pushErrorScope('validation');
      r.setState(state); r.render(camera, state);
      const blob = await r.capture(), image = await raster(blob);
      captures.push({ name, dataUrl: await dataURL(blob) });
      if (backend === 'webgpu') { const error = await r.viewer.device.popErrorScope(); if (error) (environment.shaderErrors as string[]).push(error.message); }
      else { const gl = r.gl; for (let k = 0, error = gl.getError(); error !== gl.NO_ERROR && k < 16; error = gl.getError(), k++) (environment.shaderErrors as string[]).push('WebGL error ' + error); }
      return image;
    };
    const install = (bodies: BodyResult[], section: Section | null = null) => {
      const shown = section ? sectionedBodies(bodies, section, backend === 'webgpu', 'g21-section') : bodies;
      r.setBodies(shown); r.setClip?.(section ? { planes: sectionPlanes(section), bodies: true, cutout: true, hatch: 2 } : null);
      r.setSectionHatch(section ? sectionHatch(sectionedBodies(bodies, section, false, 'g21-section'), sectionPlanes(section), 2) : null);
      return shown;
    };
    const pick = async (point: Vec3) => {
      const [x, y] = camera.project(point, 640, 480);
      if (backend === 'webgpu') { const h = await r.viewer.pick(x, y); return h && { body: r.bodies.findIndex((b: any) => b.surface === h.mesh), face: h.face, triangle: h.triangle, scalar: h.scalar, instance: h.instance, cap: h.cap, capPlane: h.capPlane }; }
      const hit = r.pickFace(x, y, camera, state), face = hit && r.bodies[hit.body].result.mesh.faces[hit.face];
      return hit && { ...hit, nativeFace: face?.id ?? null, cap: face?.id === 'section-cap' };
    };
    await phase(['display', 'nativeEdges:occlusion', 'nativeEdges:visibleSolid', 'nativeEdges:hiddenDash6-4', 'nativeEdges:wireframe', 'modes:roundTrip'], async () => {
      const front = boxBody('front'), rear = boxBody('rear', [16, 16, 16], [0, 25, -2]);
      const selectEdge = (body: BodyResult, y: number, z: number) => { const edge = body.mesh.edges.find(e => e.a[1] === y && e.b[1] === y && e.a[2] === z && e.b[2] === z)!; if (!edge) throw new Error('Fixture native edge is absent.'); return { ...body, mesh: { ...body.mesh, edges: [edge], edgeLines: Float32Array.from([...edge.a, ...edge.b]), edgeOfSegment: Float32Array.of(edge.index, edge.index) } }; };
      const bodies = [selectEdge(front, -10, 10), selectEdge(rear, 17, 6)], clean = noEdges(bodies), observations: Record<string, any> = {}, restores = [];
      let wireBackground: ReturnType<typeof difference> | undefined;
      install(bodies); const baseline = await draw('modes-default');
      add('display', canvas.width === 640 * dpr && canvas.height === 480 * dpr && window.devicePixelRatio === dpr, { css: [canvas.clientWidth, canvas.clientHeight], backing: [canvas.width, canvas.height], actualDpr: window.devicePixelRatio, backend: environment }, { css: [640, 480], backing: [640 * dpr, 480 * dpr], dpr });
      for (const mode of MODES) {
        install(bodies); const image = await draw('modes-' + mode, mode); install(clean); const control = await draw('modes-control-' + mode, mode);
        const project = (p: Vec3) => camera.project(p, 640, 480);
        observations[mode] = { visible: lineCoverage(image, control, project(bodies[0].mesh.edges[0].a), project(bodies[0].mesh.edges[0].b), dpr), hidden: lineCoverage(image, control, project(bodies[1].mesh.edges[0].a), project(bodies[1].mesh.edges[0].b), dpr), diagonal: lineCoverage(image, control, project([-5, -10, -5]), project([5, -10, 5]), dpr), status: r.getDisplayModeStatus() };
        if (mode === 'wireframe') { install([]); const empty = await draw('modes-empty-wireframe', mode); wireBackground = difference(control, empty); }
        install(bodies); const restored = await draw('modes-restored-' + mode, 'shaded-with-edges'); restores.push({ mode, ...difference(baseline, restored) });
      }
      // A real native edge on a second kept solid lies behind the first solid's section cap.
      // This distinguishes retained cap depth from surface depth on an uncut box.
      // Rear y=[14,18] is beyond the outer solid's back y=10, so the global cap probe reaches
      // that solid's back face first. Nested-body probe behavior is a separate unsupported fixture.
      const capRear = selectEdge(boxBody('cap-rear', [4, 4, 4], [-5, 16, -2]), 14, 0), capBodies = [noEdges([boxBody('cap-occluder')])[0], capRear], capRows: Record<string, ReturnType<typeof lineCoverage>> = {};
      aim(camera, [-5, -60, -2], [-5, 0, -2]);
      for (const mode of LINE_MODES) {
        install(capBodies, sectionOf(2)); r.setSectionHatch(null); if (backend === 'webgpu') r.setClip({ ...r.clip, hatch: 0 });
        const actual = await draw('cap-depth-' + mode, mode);
        install(noEdges(capBodies), sectionOf(2)); r.setSectionHatch(null); if (backend === 'webgpu') r.setClip({ ...r.clip, hatch: 0 });
        const control = await draw('cap-depth-control-' + mode, mode), edge = capRear.mesh.edges[0];
        capRows[mode] = lineCoverage(actual, control, camera.project(edge.a, 640, 480), camera.project(edge.b, 640, 480), dpr);
      }
      add('nativeEdges:occlusion', observations['hidden-lines-removed'].hidden.coverage <= LIMITS.absentCoverage && capRows['hidden-lines-removed'].coverage <= LIMITS.absentCoverage, { surface: observations['hidden-lines-removed'].hidden, cap: capRows['hidden-lines-removed'] }, { maximumCoverage: LIMITS.absentCoverage });
      add('nativeEdges:visibleSolid', MODES.every(mode => observations[mode].visible.coverage >= LIMITS.solidCoverage), Object.fromEntries(MODES.map(mode => [mode, observations[mode].visible])), { minimumCoverage: LIMITS.solidCoverage });
      const dash = observations['hidden-lines-dashed'].hidden;
      const capDash = capRows['hidden-lines-dashed'];
      add('nativeEdges:hiddenDash6-4', dash.onSamples > 10 && dash.offSamples > 10 && dash.onCoverage >= LIMITS.dashOnCoverage && dash.offCoverage <= LIMITS.dashOffCoverage && capDash.onCoverage >= LIMITS.dashOnCoverage && capDash.offCoverage <= LIMITS.dashOffCoverage, { surface: dash, cap: capDash }, { periodCSS: [6, 4], excludeBoundaryCSS: 1, minimumOn: LIMITS.dashOnCoverage, maximumOff: LIMITS.dashOffCoverage });
      const wire = observations.wireframe;
      add('nativeEdges:wireframe', wire.hidden.coverage >= LIMITS.solidCoverage && capRows.wireframe.coverage >= LIMITS.solidCoverage && wire.diagonal.coverage <= LIMITS.absentCoverage && wireBackground?.pixels === 0, { ...wire, cap: capRows.wireframe, noEdgeVersusEmpty: wireBackground }, { hiddenMinimum: LIMITS.solidCoverage, diagonalMaximum: LIMITS.absentCoverage, noEdgeVersusEmptyStrongPixels: 0 });
      add('modes:roundTrip', restores.every(x => x.pixels === 0) && MODES.every(mode => observations[mode].status.supported && observations[mode].status.effective === mode), { restores, statuses: Object.fromEntries(MODES.map(mode => [mode, observations[mode].status])) }, 'all modes supported on base solids; default has zero strong changed pixels');
    });
    await phase(['picks:front-cap-roundTrip', 'g20:quarter', 'g20:octant'], async () => {
      const source = boxBody('source'), results = [];
      for (const count of [2, 3] as const) {
        const label = count === 2 ? 'quarter' : 'octant', section = sectionOf(count), cpu = sectionedBodies([source], section, false, 'g21-section');
        state = stateOf(); install([source], section); r.aoEnabled = false;
        if (backend === 'webgpu') { const g = r.bodies[0].surface.geometry; g.setScalars(Array(g.data.vertexCount).fill(7), 'vertex'); }
        aim(camera, [-35, -45, -28], [0, 0, 0]);
        const geometryStamp = () => JSON.stringify(r.bodies.map((b: any) => ({ key: b.result.key, positions: Array.from(b.result.mesh.positions), indices: Array.from(b.result.mesh.indices), faces: Array.from(b.result.mesh.faceOfVertex) })));
        const clipSnapshot = JSON.stringify(r.clip ?? section), geometrySnapshot = geometryStamp(), modeRows = [], restores = [];
        for (const mode of MODES) { const image = await draw('section-' + label + '-' + mode, mode); modeRows.push({ mode, width: image.width, height: image.height, status: r.getDisplayModeStatus(), sourceKeys: r.bodies.map((b: any) => b.result.key), geometryUnchanged: geometryStamp() === geometrySnapshot, clipUnchanged: JSON.stringify(r.clip ?? section) === clipSnapshot }); }
        for (const mode of MODES) {
          const row: Record<string, unknown> = { section: label, mode };
          for (const cap of [false, true]) {
            const point: Vec3 = cap ? [-5, 0, -2] : [-10, 1.5, -2], eye: Vec3 = cap ? [-5, -20, -2] : [-60, 16.5, -2]; aim(camera, eye, point);
            await draw('pick-' + label + '-' + mode + '-' + (cap ? 'cap-baseline' : 'front-baseline'), 'shaded-with-edges'); const baseline = await pick(point);
            await draw('pick-' + label + '-' + mode + '-' + (cap ? 'cap' : 'front'), mode); const changed = await pick(point);
            await draw('pick-' + label + '-' + mode + '-' + (cap ? 'cap-restored' : 'front-restored'), 'shaded-with-edges'); const restored = await pick(point);
            row[cap ? 'cap' : 'front'] = { baseline, changed, restored, pass: !!baseline && baseline.cap === cap && (backend === 'webgpu' ? (cap ? baseline.capPlane === 1 && baseline.triangle === null && baseline.scalar === undefined : baseline.face === 1 && Number.isInteger(baseline.triangle) && baseline.scalar === 7) : cap || baseline.nativeFace === 'native-1') && same(baseline, changed) && same(baseline, restored) };
          }
          restores.push(row);
        }
        // Independent 3/7-box kept-volume oracle. Edges/hatch/AO/shadow are disabled on both sides only for this comparison.
        aim(camera, [-35, -45, -28], [0, 0, 0]); state = stateOf(); install(noEdges([source]), section); r.setSectionHatch(null); if (r.clip) r.setClip({ ...r.clip, hatch: 0 });
        const shadow = backend === 'webgpu' ? r.ground.material.opacity : r.theme.shadow; if (backend === 'webgpu') r.ground.material = { opacity: 0 }; else r.theme.shadow = 0;
        if (backend === 'webgl2') state.selectedFaces = cpu[0].mesh.faces.filter(f => f.id === 'section-cap').map(f => ({ body: 0, face: f.index }));
        const actual = await draw('section-' + label + '-comparison', 'shaded-with-edges');
        const oracle = keptBoxes(count); install(oracle.bodies); state = { ...stateOf(), selectedFaces: oracle.selectedFaces };
        if (backend === 'webgpu') r.ground.material = { opacity: 0 }; else r.theme.shadow = 0;
        const reference = await draw('section-' + label + '-oracle', 'shaded-with-edges'), diff = difference(actual, reference);
        if (backend === 'webgpu') r.ground.material = { opacity: shadow }; else r.theme.shadow = shadow;
        const measured = cpu.reduce((s, b) => s + volume(b.mesh), 0), expected = count === 2 ? 6000 : 7000;
        add('g20:' + label, cpu.length === 1 && cpu[0].key === source.key && Math.abs(measured - expected) < 1e-6 && diff.fraction <= LIMITS.strongFraction && modeRows.every(x => x.status.supported && x.clipUnchanged && x.geometryUnchanged && same(x.sourceKeys, [source.key])), { sourceKeys: cpu.map(b => b.key), sourceCount: cpu.length, displayMeshVolumeMM3: measured, expectedAnalyticVolumeMM3: expected, oracleBoxes: oracle.bodies.length, difference: diff, modes: modeRows }, { sourceCount: 1, volumeMM3: expected, maximumStrongFraction: LIMITS.strongFraction, authority: 'display mesh against analytic box decomposition; no kernel/exact acceptance' });
        results.push(...restores);
      }
      add('picks:front-cap-roundTrip', results.every((x: any) => x.front.pass && x.cap.pass), results, 'same backend-native IDs and front/cap classification in each mode and after default restoration; GPU capPlane and WebGL cap face remain distinct');
    });
    await phase(['appearance:lineOnlySuppressionRestore'], async () => {
      const source = noEdges([boxBody('appearance')]), section = sectionOf(2); state = stateOf(); install(source, section); aim(camera, [-35, -45, 28], [0, 0, 0]); r.aoEnabled = true;
      const baseline = await draw('appearance-default'), hatches = sectionHatch(sectionedBodies(source, section, false, 'g21-section'), sectionPlanes(section), 2), negative: Record<string, unknown> = {};
      r.setSectionHatch(null); if (backend === 'webgpu') r.setClip({ ...r.clip, hatch: 0 }); const noHatch = await draw('appearance-no-hatch'); negative.hatch = difference(baseline, noHatch);
      r.setSectionHatch(hatches); if (backend === 'webgpu') r.setClip({ ...r.clip, hatch: 2 });
      r.aoEnabled = false; const noAO = await draw('appearance-no-ao'); negative.ao = difference(baseline, noAO); r.aoEnabled = true;
      const originalShadow = backend === 'webgpu' ? r.ground.material.opacity : r.theme.shadow;
      if (backend === 'webgpu') r.ground.material = { opacity: 0 }; else r.theme.shadow = 0;
      const noShadow = await draw('appearance-no-shadow'); negative.shadow = difference(baseline, noShadow);
      if (backend === 'webgpu') r.ground.material = { opacity: originalShadow }; else r.theme.shadow = originalShadow;
      const rows = [];
      for (const mode of LINE_MODES) {
        const actual = await draw('appearance-' + mode, mode);
        r.aoEnabled = false; r.setSectionHatch(null); if (backend === 'webgpu') { r.setClip({ ...r.clip, hatch: 0 }); r.ground.material = { opacity: 0 }; } else r.theme.shadow = 0;
        const control = await draw('appearance-control-' + mode, mode);
        install([]); const empty = await draw('appearance-empty-' + mode, mode);
        install(source, section);
        r.aoEnabled = true; r.setSectionHatch(hatches); if (backend === 'webgpu') { r.setClip({ ...r.clip, hatch: 2 }); r.ground.material = { opacity: originalShadow }; } else r.theme.shadow = originalShadow;
        const restored = await draw('appearance-restored-' + mode, 'shaded-with-edges');
        rows.push({ mode, suppressedDifference: difference(actual, control), emptyDifference: difference(actual, empty), restoredDifference: difference(baseline, restored) });
      }
      const xray = [];
      for (const cap of [false, true]) {
        const point: Vec3 = cap ? [-5, 0, -2] : [-10, 5, 5], eye: Vec3 = cap ? [-5, -20, -2] : [-60, 5, 5]; aim(camera, eye, point); state = stateOf(); install(source, section); r.setSectionHatch(null); r.aoEnabled = false;
        // A full closed WebGL2 mesh can blend far then near faces. This separate witness keeps only
        // one native/cap face from the same solid; full closed-solid modes/volume remain checked above.
        if (backend === 'webgl2') install([singleOpacityFace(sectionedBodies(source, section, false, 'g21-section')[0], cap)]);
        if (backend === 'webgpu') { r.setClip({ ...r.clip, hatch: 0 }); r.ground.material = { opacity: 0 }; } else r.theme.shadow = 0;
        const opaque = await draw('opacity-' + (cap ? 'cap' : 'surface') + '-opaque', 'shaded-with-edges'), transparent = await draw('opacity-' + (cap ? 'cap' : 'surface') + '-x-ray', 'x-ray');
        install([]); const background = await draw('opacity-' + (cap ? 'cap' : 'surface') + '-empty', 'shaded-with-edges');
        xray.push({ cap, geometry: backend === 'webgl2' ? 'one actual CPU-section native/cap face; no hidden colour layers' : 'closed solid, front/cap ray with one front-facing layer', ...opacityWitness(opaque, transparent, background, dpr) });
      }
      add('appearance:lineOnlySuppressionRestore', Object.values(negative).every((x: any) => x.pixels > 0) && rows.every(x => x.suppressedDifference.pixels === 0 && x.emptyDifference.pixels === 0 && x.restoredDifference.pixels === 0) && xray.every(x => x.pass), { negative, rows, xray }, { lineOnly: 'zero strong surface/cap pixels against empty background; hatch/AO/shadow negative witnesses and default restoration', xray: 'single visible surface/cap over empty background at alpha .25', maximumRGBError: LIMITS.opacityRGBError });
    });
    await phase(['authority:ghost-hidden'], async () => {
      const bodies = [-25, 0, 25].map((x, i) => boxBody('authority-' + i, [16, 16, 16], [x, 0, 0])); state = { ...stateOf(), ghostBodies: new Set([1]), hiddenBodies: new Set([2]) }; install(bodies); aim(camera, [0, -130, 0], [0, 0, 0]); r.aoEnabled = false;
      const rows = [];
      for (const mode of MODES) {
        const actual = await draw('authority-' + mode, mode), ghostPick = await pick([0, -8, 0]), hiddenPick = await pick([25, -8, 0]);
        const saved = state; state = { ...state, ghostBodies: new Set(), hiddenBodies: new Set() }; const negative = await draw('authority-visible-control-' + mode, mode), controlGhostPick = await pick([0, -8, 0]), controlHiddenPick = await pick([25, -8, 0]);
        state = saved; await draw('authority-restored-' + mode, mode); const restoredGhost = await pick([0, -8, 0]), restoredHidden = await pick([25, -8, 0]);
        rows.push({ mode, ghostPick, hiddenPick, restoredGhost, restoredHidden, controlGhostPick, controlHiddenPick, changed: difference(actual, negative) });
      }
      add('authority:ghost-hidden', rows.every(x => !x.ghostPick && !x.hiddenPick && !x.restoredGhost && !x.restoredHidden && x.controlGhostPick?.body === 1 && x.controlHiddenPick?.body === 2 && x.changed.pixels > 0), rows, 'hidden and operation ghosts remain unpickable in all modes; enabling the same targets returns body IDs 1/2 and changes real raster');
    });
    await phase(['g20:capLeaks'], async () => {
      const source = boxBody('leak-plate', [40, 20, 10], [20, 10, 5]), section: Section = { mode: 'cutout', planes: [{ normal: [-1, 0, 0], offset: -20 }, { normal: [0, 1, 0], offset: 10 }] };
      state = stateOf(); const shown = install([source], section); r.setSectionHatch(null); if (backend === 'webgpu') r.setClip({ ...r.clip, hatch: 0 }); r.aoEnabled = false; aim(camera, [61.44, -55.3, 61.19], [20, 10, 5], false);
      r.setState(state);
      if (backend === 'webgpu') { r.bodies[0].surface.capColor = '#ff00ff'; r.bodies[0].surface.material = { color: '#ffffff', unlit: true }; }
      const image = await draw('g20-leak-plate'); let capPixels = 0, leaks = 0;
      let ids: Uint8Array | null = null;
      if (backend === 'webgl2') { r.pickPass(camera, state); const gl = r.gl; ids = new Uint8Array(canvas.width * canvas.height * 4); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, ids); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4;
        let cap = image.data[i] > 150 && image.data[i + 2] > 150 && image.data[i + 1] < 80;
        if (ids) { const j = ((image.height - 1 - y) * image.width + x) * 4, id = ids[j] + 256 * ids[j + 1] + 65536 * ids[j + 2]; cap = id > 0 && shown[0].mesh.faces[(id - 1) % 4096]?.id === 'section-cap'; }
        if (!cap) continue; capPixels++;
        const ray = camera.ray(2 * (x + 0.5) / image.width - 1, 1 - 2 * (y + 0.5) / image.height);
        if (analyticBoundary(ray.origin, ray.dir, source.mesh.bounds.min, source.mesh.bounds.max, section) !== 'cap') leaks++;
      }
      add('g20:capLeaks', capPixels > LIMITS.minimumCapPixelsAtDpr1 * dpr * dpr && leaks <= LIMITS.capLeaks, { capPixels, leaks, mask: ids ? 'actual WebGL2 cap-face ID attachment' : 'actual WebGPU magenta cap raster', oracle: 'independent analytic box/keep-union boundary' }, { minimumCapPixels: LIMITS.minimumCapPixelsAtDpr1 * dpr * dpr, maximumLeaks: LIMITS.capLeaks });
    });
    await phase(['unsupported:scope'], async () => {
      state = stateOf('wireframe'); install([boxBody('unsupported')], sectionOf(2)); await draw('unsupported-baseline', 'wireframe'); const clip = JSON.stringify(r.clip ?? sectionOf(2));
      state = { ...state, displayMode: 'x-ray', displayModeUnsupported: 'Render workspace supports shaded solids only.' }; r.setState(state); const guarded = r.getDisplayModeStatus();
      unsupported.push({ combination: 'explicit unsupported workspace', status: guarded, adapterHasInstanceAPI: typeof r.setInstances === 'function' });
      let sorted = null;
      if (backend === 'webgpu') { r.viewer.orderIndependent = false; state = { ...state, displayModeUnsupported: undefined }; r.setState(state); sorted = r.getDisplayModeStatus(); r.viewer.orderIndependent = true; unsupported.push({ combination: 'x-ray clipped sorted transparency', status: sorted }); }
      add('unsupported:scope', !guarded.supported && guarded.effective === 'wireframe' && (!sorted || !sorted.supported && sorted.effective === 'wireframe') && JSON.stringify(r.clip ?? sectionOf(2)) === clip, unsupported, 'unsupported non-default scope requests preserve wireframe and planes; default instance bridge presence is reported separately');
    });
    if (instances) {
      const addInstance = (name: string, pass: boolean, actual: unknown, expected: unknown) => instanceChecks.push({ name, pass, actual, expected });
      const instancePhase = async (name: string, work: () => Promise<void>) => {
        try { if (typeof r.setInstances !== 'function' || typeof r.pickInstanceFace !== 'function') throw new Error('The actual adapter has no instance bridge; no skip is allowed.'); await work(); }
        catch (e) { const error = String(e); errors.push(error); if (!instanceChecks.some(c => c.name === name)) addInstance(name, false, { error }, 'actual adapter instance phase completed'); }
      };
      const reset = () => { state = stateOf(); r.setInstancePreview?.(null); r.setInstanceTransforms?.(null); r.setInstanceFaces?.([]); r.setInstances?.([], []); install([]); r.aoEnabled = false; };
      const instancePick = (point: Vec3) => { const [x, y] = camera.project(point, 640, 480); return r.pickInstanceFace(x, y, camera); };
      const resource = (index: number) => backend === 'webgpu' ? r.instances[index]?.surfaces[0]?.geometry : r.instances[index]?.bodies[0]?.gpu.geometry;
      await instancePhase('instances:placed-sharing', async () => {
        reset(); aim(camera, [0, -130, 0], [0, 0, 0]);
        const packets = [instancePacket('copy-A', [-22, 0, 0]), instancePacket('copy-B', [22, 0, 0], Math.PI / 2), instancePacket('different', [0, 0, 0], 0, [10, 8, 16])];
        r.setInstances(packets, []); const actual = await draw('instance-placed'), picks = [[-22, 0, 0], [22, 0, 0], [0, 0, 0]].map(p => instancePick(p as Vec3));
        const shared = !!resource(0) && resource(0) === resource(1), different = !!resource(2) && resource(0) !== resource(2), count = r.instances.length;
        r.setInstances([], []); const empty = await draw('instance-placed-empty');
        addInstance('instances:placed-sharing', shared && different && count === 3 && picks.every((p: any, i: number) => p?.id === packets[i].id && p.body === 0 && p.face === [3, 1, 3][i]) && difference(actual, empty).pixels > 0, { shared, different, count, picks, difference: difference(actual, empty), packetBounds: packets.map(p => p.bodies[0].mesh.bounds) }, 'two world-placed rotated/translated copies share immutable geometry; different solid stays distinct; actual native picks return original IDs');
      });
      await instancePhase('instances:depth-hidden', async () => {
        reset(); aim(camera, [0, -130, 0], [0, 0, 0]); const base = boxBody('front-base', [16, 6, 16], [0, -15, 0]); install([base]);
        const rear = instancePacket('occluded', [0, 15, 0]), visible = instancePacket('visible', [-25, 0, 0]), omitted = instancePacket('hidden-omitted', [25, 0, 0]);
        r.setInstances([rear, visible], []); const actual = await draw('instance-depth'), occluded = instancePick([0, 15, 0]), hidden = instancePick([25, 0, 0]), shown = instancePick([-25, 0, 0]);
        const [x, y] = camera.project([0, 15, 0], 640, 480), front = r.pickFace(x, y, camera, state);
        install([]); await draw('instance-depth-no-base'); const noOccluder = instancePick([0, 15, 0]);
        install([base]); r.setInstances([rear, visible, omitted], []); const control = await draw('instance-depth-visibility-control'), enabled = instancePick([25, 0, 0]);
        const modes = [];
        for (const mode of MODES) {
          r.setInstances([rear, visible], []); await draw('instance-mode-depth-' + mode, mode);
          const occluded = instancePick([0, 15, 0]), hidden = instancePick([25, 0, 0]), shown = instancePick([-25, 0, 0]);
          const front = r.pickFace(x, y, camera, state);
          r.setInstances([rear, visible, omitted], []); await draw('instance-mode-visible-' + mode, mode);
          modes.push({ mode, occluded, hidden, shown, front, enabled: instancePick([25, 0, 0]) });
        }
        addInstance('instances:depth-hidden', modes.every(x => !x.occluded && !x.hidden && x.shown?.id === 'visible' && x.front?.body === 0 && x.enabled?.id === 'hidden-omitted') && !occluded && !hidden && shown?.id === 'visible' && front?.body === 0 && noOccluder?.id === 'occluded' && enabled?.id === 'hidden-omitted' && difference(actual, control).pixels > 0, { modes, occluded, hidden, shown, front, noOccluder, enabled, difference: difference(actual, control) }, 'shared base/instance nearest depth; occluded instance reappears only after removing base; omitted hidden packet stays absent until explicitly supplied');
      });
      await instancePhase('instances:pose-drag', async () => {
        reset(); aim(camera, [0, -130, 0], [0, 0, 0]); const packet = instancePacket('posed-copy', [-20, 0, 0]); r.setInstances([packet], []);
        const initial = await draw('instance-pose-initial'), original = instancePick([-20, 0, 0]), geometry = resource(0);
        r.setInstanceTransforms(new Map([[packet.id, instanceMatrix(Math.PI / 2)]])); const posed = await draw('instance-posed'), poseHit = instancePick([0, -20, 0]), oldPoseHit = instancePick([-20, 0, 0]);
        r.setInstancePreview({ id: packet.id, matrix: instanceMatrix(0, [18, 0, 0]) }); const dragged = await draw('instance-drag'), dragHit = instancePick([18, -20, 0]), oldDragHit = instancePick([0, -20, 0]), sameGeometry = !!geometry && resource(0) === geometry;
        r.setInstancePreview(null); r.setInstanceTransforms(null); const restored = await draw('instance-pose-restored'), restoredPick = instancePick([-20, 0, 0]);
        const modes = [];
        for (const mode of MODES) {
          r.setInstanceTransforms(new Map([[packet.id, instanceMatrix(Math.PI / 2)]])); await draw('instance-mode-pose-' + mode, mode);
          const pose = instancePick([0, -20, 0]), poseOld = instancePick([-20, 0, 0]);
          r.setInstancePreview({ id: packet.id, matrix: instanceMatrix(0, [18, 0, 0]) }); await draw('instance-mode-drag-' + mode, mode);
          const drag = instancePick([18, -20, 0]), dragOld = instancePick([0, -20, 0]);
          r.setInstancePreview(null); r.setInstanceTransforms(null); await draw('instance-mode-pose-restore-' + mode, 'shaded-with-edges');
          const restored = instancePick([-20, 0, 0]);
          modes.push({ mode, pose, poseOld, drag, dragOld, restored, sameGeometry: resource(0) === geometry });
        }
        addInstance('instances:pose-drag', modes.every(x => x.pose?.id === packet.id && x.pose.face === 1 && !x.poseOld && x.drag?.id === packet.id && x.drag.face === 1 && !x.dragOld && same(original, x.restored) && x.sameGeometry) && original?.face === 3 && poseHit?.id === packet.id && poseHit.face === 1 && !oldPoseHit && dragHit?.id === packet.id && dragHit.face === 1 && !oldDragHit && sameGeometry && same(original, restoredPick) && difference(initial, posed).pixels > 0 && difference(posed, dragged).pixels > 0 && difference(initial, restored).pixels === 0, { modes, original, poseHit, oldPoseHit, dragHit, oldDragHit, restoredPick, sameGeometry, posedDifference: difference(initial, posed), dragDifference: difference(posed, dragged), restoredDifference: difference(initial, restored) }, 'world placement once; pose then drag; same immutable geometry; original native IDs and default raster restore');
      });
      await instancePhase('instances:source-cap', async () => {
        const rows = [];
        for (const cutout of [false, true]) for (const mode of MODES) {
          reset(); state = stateOf(mode); const section: Section = cutout ? sectionOf(2) : { mode: 'plane', planes: [{ normal: [0, 1, 0], offset: 0 }] };
          const original: InstanceItem[] = [{ id: 'section-instance', bodies: [boxBody('removed-body', [10, 10, 10], [-40, -40, 0]), boxBody('native-body')] }, { id: 'behind-cap', bodies: [boxBody('rear-instance', [4, 4, 4], [-5, 16, -2])] }];
          const packets: InstanceItem[] = backend === 'webgpu' ? original : sectionedInstances(original, new Map(), section, false).map(p => ({ ...p, hatch: sectionHatch(p.bodies, sectionPlanes(section), 2) }));
          r.setInstances(packets, []); if (backend === 'webgpu') r.setClip({ planes: sectionPlanes(section), bodies: false, cutout, hatch: 2 });
          aim(camera, [-5, -20, -2], [-5, 0, -2]); const capImage = await draw('instance-section-' + (cutout ? 'cutout' : 'plane') + (mode === 'shaded-with-edges' ? '' : '-' + mode)), cap = instancePick([-5, 0, -2]);
          if (backend === 'webgpu') r.setClip({ ...r.clip, hatch: 0 }); else r.setInstances(packets.map(p => ({ ...p, hatch: [] })), []);
          const noHatch = await draw('instance-section-no-hatch-' + (cutout ? 'cutout' : 'plane') + (mode === 'shaded-with-edges' ? '' : '-' + mode));
          r.setInstances(packets.slice(1), []); await draw('instance-section-rear-control-' + (cutout ? 'cutout' : 'plane') + (mode === 'shaded-with-edges' ? '' : '-' + mode)); const rearControl = instancePick([-5, 0, -2]);
          r.setInstances(packets, []);
          aim(camera, [-60, 5, -2], [-10, 5, -2]); await draw('instance-section-front-' + (cutout ? 'cutout' : 'plane') + (mode === 'shaded-with-edges' ? '' : '-' + mode)); const native = instancePick([-10, 5, -2]);
          // X-ray attenuates the hatch with the .25 cap opacity. Keep the fixed >60
          // strong-pixel oracle for opaque/default and line-only checks; measure this
          // new transparent witness separately above the RGB rounding tolerance.
          let hatchSignalPixels = 0, maximumHatchRGBL1 = 0;
          for (let i = 0; i < capImage.data.length; i += 4) {
            const delta = Math.abs(capImage.data[i] - noHatch.data[i]) + Math.abs(capImage.data[i + 1] - noHatch.data[i + 1]) + Math.abs(capImage.data[i + 2] - noHatch.data[i + 2]);
            maximumHatchRGBL1 = Math.max(maximumHatchRGBL1, delta);
            if (delta > LIMITS.opacityRGBError) hatchSignalPixels++;
          }
          rows.push({ cutout, mode, cap, native, rearControl, hatchSignalPixels, maximumHatchRGBL1, sourceBodies: packets[0].sourceBodies ?? [0, 1], hatchDifference: difference(capImage, noHatch), pass: cap?.id === 'section-instance' && cap.body === 1 && cap.face === -1 && cap.cap === true && rearControl?.id === 'behind-cap' && native?.id === 'section-instance' && native.body === 1 && native.face === 1 && (LINE_MODES.includes(mode) ? difference(capImage, noHatch).pixels === 0 : mode === 'x-ray' ? hatchSignalPixels >= 100 * dpr * dpr : difference(capImage, noHatch).pixels > 0) });
        }
        addInstance('instances:source-cap', rows.every(row => row.pass), rows, 'CPU plane/cutout packet maps shown body to original body 1 and native face 1; generated cap face is -1; hatch toggles only shaded/xray cap raster and remains suppressed in line-only modes; GPU uses live planes; every mode retains cap/native identity');
      });
      await instancePhase('instances:wide-face-id', async () => {
        reset(); aim(camera, [0, -90, 0], [0, 0, 0]); const body = wideFaceBody(); r.setInstances([{ id: 'wide', bodies: [body] }], []);
        await draw('instance-wide-face'); const hit = instancePick([0, -10, 0]);
        addInstance('instances:wide-face-id', hit?.id === 'wide' && hit.body === 0 && hit.face === 4097, { hit, displayFaceCount: body.mesh.faces.length, usedNativeFrontFace: 4097 }, 'actual native pick returns face 4097 without a fixed 4096-face body stride collision');
      });
      await instancePhase('instances:scope', async () => {
        state = { ...stateOf('wireframe'), displayModeUnsupported: 'Render workspace supports shaded solids only.' }; r.setState(state); const guarded = r.getDisplayModeStatus(); state = stateOf(); r.setState(state); const restored = r.getDisplayModeStatus();
        addInstance('instances:scope', !guarded.supported && guarded.effective === 'shaded-with-edges' && restored.supported && restored.effective === 'shaded-with-edges', { guarded, restored, adapterHasInstanceAPI: typeof r.setInstances === 'function' }, 'explicit unsupported workspace remains guarded; default instance bridge restores');
      });
      await instancePhase('instances:modes', async () => {
        reset(); aim(camera, [0, -130, 0], [0, 0, 0]);
        const selectEdge = (body: BodyResult, y: number, z: number) => {
          const edge = body.mesh.edges.find(e => e.a[1] === y && e.b[1] === y && e.a[2] === z && e.b[2] === z);
          if (!edge) throw new Error('Native instance edge is absent.');
          return { ...body, mesh: { ...body.mesh, edges: [edge], edgeLines: Float32Array.from([...edge.a, ...edge.b]), edgeOfSegment: Float32Array.of(edge.index, edge.index) } };
        };
        const bodies = [selectEdge(boxBody('front'), -10, 10), selectEdge(boxBody('rear', [16, 16, 16], [0, 25, -2]), 17, 6)];
        const packets: InstanceItem[] = bodies.map((b, i) => ({ id: 'mode-' + i, bodies: [b] }));
        // Extra placed packets include a rotated solid and a different shape in the same document.
        packets.push(instancePacket('rotated', [35, 0, 0], Math.PI / 2), instancePacket('different', [-35, 0, 0], 0, [10, 8, 16]));
        const clean = packets.map(p => ({ ...p, bodies: noEdges(p.bodies) })), rows: any[] = [];
        r.setInstances(packets, []); const baseline = await draw('instance-modes-default');
        for (const mode of MODES) {
          r.setInstances(packets, []); const actual = await draw('instance-mode-' + mode, mode), status = r.getDisplayModeStatus();
          const picks = [[0, -10, 0], [35, 0, 0], [-35, 0, 0]].map(p => instancePick(p as Vec3));
          r.setInstances(clean, []); const control = await draw('instance-mode-control-' + mode, mode);
          const project = (p: Vec3) => camera.project(p, 640, 480);
          const visible = lineCoverage(actual, control, project(bodies[0].mesh.edges[0].a), project(bodies[0].mesh.edges[0].b), dpr);
          const hidden = lineCoverage(actual, control, project(bodies[1].mesh.edges[0].a), project(bodies[1].mesh.edges[0].b), dpr);
          const diagonal = lineCoverage(actual, control, project([-5, -10, -5]), project([5, -10, 5]), dpr);
          let emptyDifference: ReturnType<typeof difference> | null = null;
          if (LINE_MODES.includes(mode)) { r.setInstances([], []); const empty = await draw('instance-mode-empty-' + mode, mode); emptyDifference = difference(control, empty); }
          r.setInstances(packets, []); const restored = await draw('instance-mode-restored-' + mode, 'shaded-with-edges');
          rows.push({ mode, status, picks, visible, hidden, diagonal, emptyDifference, restored: difference(baseline, restored) });
        }
        const capRows: Record<string, ReturnType<typeof lineCoverage>> = {}, capEmpty: Record<string, ReturnType<typeof difference>> = {};
        const section = sectionOf(2), rear = selectEdge(boxBody('instance-cap-rear', [4, 4, 4], [-5, 16, -2]), 14, 0);
        const source: InstanceItem[] = [{ id: 'cap-front', bodies: noEdges([boxBody('instance-cap-front')]) }, { id: 'cap-rear', bodies: [rear] }];
        aim(camera, [-5, -60, -2], [-5, 0, -2]);
        for (const mode of LINE_MODES) {
          const packets = backend === 'webgpu' ? source : sectionedInstances(source, new Map(), section, false);
          r.setInstances(packets, []);
          if (backend === 'webgpu') r.setClip({ planes: sectionPlanes(section), bodies: false, cutout: true, hatch: 0 });
          const actual = await draw('instance-cap-depth-' + mode, mode);
          r.setInstances(packets.map(p => ({ ...p, bodies: noEdges(p.bodies) })), []);
          const control = await draw('instance-cap-depth-control-' + mode, mode), edge = rear.mesh.edges[0];
          capRows[mode] = lineCoverage(actual, control, camera.project(edge.a, 640, 480), camera.project(edge.b, 640, 480), dpr);
          r.setInstances([], []); const empty = await draw('instance-cap-depth-empty-' + mode, mode); capEmpty[mode] = difference(control, empty);
        }
        const dash = rows.find(x => x.mode === 'hidden-lines-dashed').hidden;
        addInstance('instances:modes', Object.values(capEmpty).every(x => x.pixels === 0) && capRows['hidden-lines-removed'].coverage <= LIMITS.absentCoverage && capRows.wireframe.coverage >= LIMITS.solidCoverage && capRows['hidden-lines-dashed'].onCoverage >= LIMITS.dashOnCoverage && capRows['hidden-lines-dashed'].offCoverage <= LIMITS.dashOffCoverage && rows.every(x => x.status.supported && x.status.effective === x.mode && x.visible.coverage >= LIMITS.solidCoverage && x.diagonal.coverage <= LIMITS.absentCoverage && x.restored.pixels === 0 && (!x.emptyDifference || x.emptyDifference.pixels === 0) && x.picks.every((p: any, i: number) => p?.id === ['mode-0', 'rotated', 'different'][i] && p.face >= 0)) && rows.find(x => x.mode === 'hidden-lines-removed').hidden.coverage <= LIMITS.absentCoverage && rows.find(x => x.mode === 'wireframe').hidden.coverage >= LIMITS.solidCoverage && dash.onSamples > 10 && dash.offSamples > 10 && dash.onCoverage >= LIMITS.dashOnCoverage && dash.offCoverage <= LIMITS.dashOffCoverage, { rows, capRows, capEmpty }, { visible: LIMITS.solidCoverage, hiddenAbsent: LIMITS.absentCoverage, dashCSS: [6, 4], dashOn: LIMITS.dashOnCoverage, dashOff: LIMITS.dashOffCoverage, nativePicksAndDefaultRestore: true });
      });
      await instancePhase('curves:silhouette', async () => {
        const rows = [];
        for (const { name, body } of curvedBodies()) {
          const center = body.mesh.bounds.min.map((v, i) => (v + body.mesh.bounds.max[i]) / 2) as Vec3;
          const control = { ...body, mesh: { ...body.mesh, faces: body.mesh.faces.map(f => ({ ...f, kind: 'plane' as const })) } };
          for (const [view, delta] of [[0, [-35, -45, 28]], [1, [45, -30, 18]]] as const) {
            reset(); aim(camera, center.map((v, i) => v + delta[i]) as Vec3, center);
            for (const mode of MODES) {
              install([body]); const actual = await draw('curve-' + name + '-view' + view + '-' + mode, mode);
              const q = camera.project(center, 640, 480), hit = r.pickFace(q[0], q[1], camera, state);
              install([control]); const noContour = await draw('curve-control-' + name + '-view' + view + '-' + mode, mode), nativeControl = r.pickFace(q[0], q[1], camera, state);
              rows.push({ name, view, mode, hit, nativeControl, difference: difference(actual, noContour), geometryPositionsUnchanged: body.mesh.positions === control.mesh.positions, pass: !!hit && same(hit, nativeControl) && difference(actual, noContour).pixels >= 20 * dpr * dpr });
            }
          }
        }
        addInstance('curves:silhouette', rows.every(x => x.pass), rows, 'real cylinder/sphere display geometry; same positions/normals/native IDs with curved-kind-disabled control; camera-dependent contour raster in both views and all five modes; no native silhouette selection authority');
      });
      await instancePhase('instances:isolate', async () => {
        reset(); aim(camera, [0, -130, 0], [0, 0, 0]);
        const packets = [instancePacket('focus', [-22, 0, 0]), instancePacket('faded', [22, 0, 0], Math.PI / 2)];
        install([boxBody('base-context', [8, 8, 8], [0, 0, 0])]);r.setInstances(packets, []);
        const geometry = resource(0), rows = [];
        for (const mode of MODES) {
          state = stateOf(mode);const before = await draw('isolate-before-' + mode, mode), original = instancePick([-22, 0, 0]);
          state = { ...state, isolatedInstances: ['focus'] };const isolated = await draw('isolate-mode-' + mode, mode), focus = instancePick([-22, 0, 0]), faded = instancePick([22, 0, 0]);
          const q = camera.project([0, 0, 0], 640, 480), base = r.pickFace(q[0], q[1], camera, state);
          r.setInstanceTransforms(new Map([['focus', instanceMatrix(Math.PI / 2)]]));await draw('isolate-pose-' + mode, mode);const posed = instancePick([0, -22, 0]);r.setInstanceTransforms(null);
          state = { ...state, isolatedInstances: undefined };const restored = await draw('isolate-restored-' + mode, mode), again = instancePick([22, 0, 0]);
          rows.push({ mode, focus, faded, base, posed, again, sameGeometry: resource(0) === geometry, changed: difference(before, isolated), restore: difference(before, restored), pass: original?.id === 'focus' && original.face >= 0 && focus?.id === 'focus' && same(original, focus) && !faded && !base && posed?.id === 'focus' && again?.id === 'faded' && resource(0) === geometry && difference(before, isolated).pixels > 0 && difference(before, restored).pixels === 0 });
        }
        addInstance('instances:isolate', rows.every(x => x.pass), rows, 'session-only .15 fade; focus native identity and pose survive; faded base/instance have no pick authority; original geometry and mode raster restore');
      });
      await instancePhase('instances:opacity', async () => {
        const rows = [];
        for (const cap of [false, true]) {
          reset(); const section = sectionOf(2), source = noEdges([boxBody('instance-opacity')]);
          const point: Vec3 = cap ? [-5, 0, -2] : [-10, 5, 5], eye: Vec3 = cap ? [-5, -20, -2] : [-60, 5, 5]; aim(camera, eye, point);
          const bodies = backend === 'webgl2' ? [singleOpacityFace(sectionedBodies(source, section, false, 'g21-section')[0], cap)] : source;
          r.setInstances([{ id: 'opacity', bodies }], []);
          if (backend === 'webgpu') { r.setClip({ planes: sectionPlanes(section), bodies: false, cutout: true, hatch: 0 }); r.ground.material = { opacity: 0 }; } else r.theme.shadow = 0;
          const opaque = await draw('instance-opacity-' + cap + '-opaque'), transparent = await draw('instance-opacity-' + cap + '-x-ray', 'x-ray');
          r.setInstances([], []); const background = await draw('instance-opacity-' + cap + '-empty', 'shaded-with-edges');
          rows.push({ cap, ...opacityWitness(opaque, transparent, background, dpr) });
        }
        addInstance('instances:opacity', rows.every(x => x.pass), rows, { alpha: 0.25, maximumRGBError: LIMITS.opacityRGBError, geometry: 'same single visible native/cap layer control as base witness' });
      });
    }
  } catch (e) { errors.push(String(e)); }
  finally { (renderer as GpuRenderer | undefined)?.dispose?.(); }
  for (const name of REQUIRED_CHECKS) if (!checks.some(c => c.name === name)) add(name, false, 'blocked before this check', 'actual browser evidence required');
  if (instances) for (const name of REQUIRED_INSTANCE_CHECKS) if (!instanceChecks.some(c => c.name === name)) instanceChecks.push({ name, pass: false, actual: 'blocked before this instance check', expected: 'actual adapter evidence required' });
  return { backend, dpr, display: { css: [canvas.clientWidth, canvas.clientHeight], backing: [canvas.width, canvas.height], actualDpr: window.devicePixelRatio }, environment, checks, unsupported, captures, errors, ...(instances ? { instances: true, instanceChecks } : {}) };
}
if (typeof window !== 'undefined') (window as unknown as { runG21Case: typeof runG21Case }).runG21Case = runG21Case;
