import { BaroCADPixi3DLoader } from '@barocss/cad-interop/pixi3d';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { Application, DRAW_MODES, Graphics } from 'pixi.js';
import { Camera, Light, LightType, LightingEnvironment } from 'pixi3d/pixi7';

const cases = [
  { key: 'quarter-five', file: 'five_quarter_x_copies.barocad', bytes: 819,
    sha: 'f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2', model: 'quarter_pattern', kind: 'curve',
    ids: ['quarter_seed', 'quarter_copy_1', 'quarter_copy_2', 'quarter_copy_3', 'quarter_copy_4'], pose: [-0.011, 0.001, 0] },
  { key: 'surface-five', file: 'maximum16_by16_surface_five_instances.barocad', bytes: 23347,
    sha: 'a54583f9011c2bc194e5e559bc75356a75bbc1a30f4cdda670d3e9dc4c28048f', model: 'wide_surface_pattern', kind: 'surface',
    ids: ['wide_surface_seed', 'wide_surface_copy_1', 'wide_surface_copy_2', 'wide_surface_copy_3', 'wide_surface_copy_4'], pose: [0.003125, -0.001375, 0] },
];
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  nativeCapacity: { version: 1, maximumObjects: 16 },
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const app = new Application({ width: 800, height: 500, resolution: 1, background: '#101b2c',
  antialias: false, preserveDrawingBuffer: true, autoStart: false });
app.stop();
const stage = app.stage, renderer = app.renderer, canvas = app.view;
document.querySelector('#view').append(canvas);
const camera = Camera.main ?? new Camera(renderer);
camera.orthographic = true; camera.orthographicSize = 0.008; camera.position.set(0, 0, 0.05);
const lighting = LightingEnvironment.main ?? new LightingEnvironment(renderer);
const light = new Light(); light.type = LightType.directional; light.intensity = 1;
lighting.lights.push(light); stage.addChild(light);
const marker = new Graphics(); marker.beginFill(0xffb454).drawRect(8, 8, 14, 4).endFill(); stage.addChild(marker);
const gl = renderer.gl;
const loader = new BaroCADPixi3DLoader(options);
const evidence = { engine: 'Pixi3D2.5.0/PixiJS7.2.4',
  publicEntries: ['@barocss/cad-interop/pixi3d', '@barocss/cad-interop/native'],
  unitsPerMillimeter: 0.001, nativeFrame: 'authored XYZ/mm, right-handed Y-up; camera +Z/up+Y',
  nativeUVAuthority: 'retained neutral Surface parameters, not Pixi texture UV',
  hostPoses: cases.map(item => ({ key: item.key, translationSceneUnits: item.pose, role: 'derived display separation' })),
  cases: [], members: [], refusals: [], disposed: false, glErrors: [] };
window.__baroPixiSDKEvidence = evidence;
let accepted = [], members = [], resources = [];
const requireFact = (fact, message) => { if (!fact) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' &&
  typeof b === 'object' && Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const sameBuffer = (a, b) => a?.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
function trackDestroy(resource, key, kind) {
  const record = { resource, key, kind, destroys: 0 };
  const original = resource.destroy;
  resource.destroy = function (...args) { record.destroys++; return original.apply(this, args); };
  return record;
}
const callerResources = Object.entries({ application: app, stage, renderer, camera, lighting, light, marker })
  .map(([key, resource]) => trackDestroy(resource, key, 'caller'));
function callerRetained() {
  return app.stage === stage && app.renderer === renderer && app.view === canvas && !stage.destroyed &&
    !camera.destroyed && !light.destroyed && !marker.destroyed && lighting.valid && lighting.lights.includes(light) &&
    stage.children.includes(light) && stage.children.includes(marker) && canvas.isConnected && !gl.isContextLost() &&
    callerResources.every(record => record.destroys === 0);
}
function frame() {
  renderer.render(stage);
  const bytes = new Uint8Array(800 * 500 * 4);
  gl.readPixels(0, 0, 800, 500, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  const error = gl.getError(); evidence.glErrors.push(error);
  requireFact(error === gl.NO_ERROR, `WebGL error ${error}`);
  return bytes;
}
function changedPixels(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i += 4)
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
  return count;
}
function status(message) {
  document.querySelector('#status').textContent = `${message}\n${cases.flatMap(item => item.ids.map(id => `${item.key}/${id}`)).join('\n')}\nDisplay scale: 0.001 units/mm`;
}
function fail(error) {
  window.__baroPixiSDKError = error.stack ?? String(error);
  status(`Failed: ${error.message}`); console.error(error);
}
async function load() {
  document.querySelector('#load').disabled = true;
  const next = [], nextMembers = [], nextResources = [], caseEvidence = [];
  try {
    requireFact(gl instanceof WebGL2RenderingContext, 'WebGL2 required');
    for (const item of cases) {
      const url = new URL(`./linear-geometry-pattern-babylon-data/${item.file}`, import.meta.url);
      const result = await loader.loadAbortable(url.href, {}); next.push({ item, result });
      const bytes = new TextEncoder().encode(result.source);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        byte => byte.toString(16).padStart(2, '0')).join('');
      requireFact(bytes.length === item.bytes && digest === item.sha, `Complete source bytes changed: ${item.key}`);
      const neutral = parseBaroCadSource(result.source, options);
      requireFact(same(result.model, neutral.model) && result.model.name === item.model &&
        same(result.model.objects.map(object => object.id), item.ids) && result.root.children.length === 5 &&
        result.model.objects.every(object => object.kind === item.kind), `Native Model changed: ${item.key}`);
      requireFact(item.kind === 'curve' ? Object.is(result.model.objects[0].controlPoints[0][1], -0) :
        Object.is(result.model.objects[0].knotsU[0], -0), `Native signed zero changed: ${item.key}`);
      for (const [index, native] of result.model.objects.entries()) {
        const key = `${item.key}/${native.id}`;
        const binding = native.kind === 'curve' ? result.renderedCurves[index] : result.renderedSurfaces[index];
        requireFact(binding && (binding.curveId ?? binding.surfaceId) === native.id, `Native display binding changed: ${key}`);
        const mesh = binding.mesh;
        if (native.kind === 'curve') {
          const preview = neutral.curves[index];
          requireFact(same(preview.sample.curve, native) && mesh.material.drawMode === DRAW_MODES.LINE_STRIP &&
            sameBuffer(mesh.geometry.positions.buffer, preview.positions) && same(binding.nativeParameters, preview.sample.parameters) &&
            same(binding.nativeIntervals, preview.sample.segments.map(segment => segment.domain)) &&
            mesh.geometry.indices.buffer.length === preview.sample.pointsMM.length &&
            mesh.geometry.indices.buffer.every((value, p) => value === p), `Curve strip/native parameters changed: ${key}`);
          for (const [p, point] of preview.sample.pointsMM.entries()) requireFact(point.every((value, axis) =>
            Object.is(Math.fround(value * 0.001), preview.positions[p * 3 + axis])), `Incorrect Curve mm conversion: ${key}`);
        } else {
          const preview = neutral.surfaces[index], retained = result.surfaces[index];
          requireFact(preview.report.vertexCount === 64 && preview.report.triangleCount === 98 &&
            sameBuffer(mesh.geometry.positions.buffer, preview.mesh.positions) && sameBuffer(mesh.geometry.normals.buffer, preview.mesh.normals) &&
            sameBuffer(mesh.geometry.indices.buffer, preview.mesh.indices) && sameBuffer(retained.mesh.parameters, preview.mesh.parameters) &&
            same(retained.packet, preview.packet), `Surface buffers/native parameters changed: ${key}`);
          requireFact(preview.packet.positions.every((value, p) => Object.is(Math.fround(value * 0.001), preview.mesh.positions[p])), `Incorrect Surface mm conversion: ${key}`);
        }
        nextMembers.push({ key, mesh, kind: native.kind });
        for (const [kind, resource] of Object.entries({ mesh, geometry: mesh.geometry, material: mesh.material }))
          nextResources.push(trackDestroy(resource, key, kind));
      }
      nextResources.push(trackDestroy(result.root, item.key, 'root'));
      result.root.position.set(...item.pose);
      caseEvidence.push({ key: item.key, sourceURL: url.href, sourceSHA: item.sha, sourceBytes: bytes.length, model: item.model, ids: item.ids });
    }
    requireFact(nextMembers.length === 10 && nextResources.length === 32 && new Set(nextResources.map(record => record.resource)).size === 32,
      'Expected ten distinct mesh/geometry/material resources and two roots');
    for (const record of accepted) record.result.dispose();
    accepted = next.splice(0); members = nextMembers; resources = nextResources;
    for (const { result } of accepted) stage.addChild(result.root);
    members.forEach(record => { record.mesh.visible = false; });
    const background = frame();
    evidence.members = [];
    for (const member of members) {
      member.mesh.visible = true;
      const pixels = changedPixels(frame(), background);
      requireFact(pixels > 0, `Invisible native member: ${member.key}`);
      evidence.members.push({ key: member.key, kind: member.kind, pixels, bufferMatches: true });
      member.mesh.visible = false;
    }
    members.forEach(record => { record.mesh.visible = true; });
    const pixels = frame();
    evidence.cases = caseEvidence; evidence.combinedPixels = changedPixels(pixels, background); evidence.frameHash = hash(pixels);
    evidence.ownedCounts = { mesh: 10, geometry: 10, material: 10, root: 2 };
    evidence.sourceRetained = true; evidence.disposed = false; evidence.refusals = []; evidence.callerRetained = callerRetained();
    document.querySelector('#reject').disabled = false; document.querySelector('#dispose').disabled = false;
    status('Loaded two complete sources. Five native Curves and five native Surfaces are visible.');
  } finally {
    for (const record of next) record.result.dispose();
    document.querySelector('#load').disabled = false;
  }
}
function reject() {
  requireFact(accepted.length === 2 && !evidence.disposed, 'Load sources first');
  const before = frame(), originals = accepted.map(record => record.result.source);
  const legacy = { ...options }; delete legacy.nativeCapacity;
  const attempts = [
    ['legacy capacity', () => new BaroCADPixi3DLoader(legacy).parse(originals[0])],
    ['invalid source', () => loader.parse('invalid native CAD')],
    ['invalid capacity', () => new BaroCADPixi3DLoader({ ...options, nativeCapacity: { version: 1, maximumObjects: 5 } }).parse(originals[0])],
    ['unsupported Curve version0', () => new BaroCADPixi3DLoader({ ...options,
      curveDisplay: { chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } }).parse(originals[0])],
  ];
  for (const [label, attempt] of attempts) {
    let refused = false;
    try { const unexpected = attempt(); unexpected.dispose(); } catch { refused = true; }
    requireFact(refused && accepted.every((record, index) => record.result.source === originals[index] &&
      record.result.root.parent === stage && !record.result.root.destroyed) && sameBuffer(frame(), before) &&
      resources.every(record => record.destroys === 0) && callerRetained(), 'Refusal changed accepted state');
    evidence.refusals.push(label);
  }
  evidence.refusalSourceRetained = true; evidence.refusalFrameRetained = true;
  status('Four invalid candidates refused. Accepted sources and Stage remain.');
}
function dispose() {
  requireFact(accepted.length === 2, 'Load sources first');
  const originals = accepted.map(record => record.result.source);
  for (const { result } of accepted) { result.dispose(); result.dispose(); }
  requireFact(resources.length === 32 && resources.every(record => record.destroys === 1) &&
    accepted.every((record, index) => record.result.root.destroyed && record.result.root.parent === null && record.result.source === originals[index]) &&
    members.every(record => record.mesh.destroyed) && callerRetained(), 'Result disposal crossed caller ownership');
  frame(); evidence.disposed = true;
  evidence.destroys = resources.map(record => ({ key: record.key, kind: record.kind, count: record.destroys }));
  evidence.callerRetained = true; evidence.callerDestroys = callerResources.map(record => ({ key: record.key, count: record.destroys }));
  document.querySelector('#reject').disabled = true;
  status('Display disposed twice. Caller Application, Stage, renderer, camera, lights, marker and canvas remain live.');
}
document.querySelector('#load').addEventListener('click', () => { load().catch(fail); });
document.querySelector('#reject').addEventListener('click', () => { try { reject(); } catch (error) { fail(error); } });
document.querySelector('#dispose').addEventListener('click', () => { try { dispose(); } catch (error) { fail(error); } });
await load().catch(fail);
