import { BaroCADLoader } from '@barocss/cad-interop/three';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { Box3, BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial,
  OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';

const sourceURL = new URL('./native-capacity-data/linear-quarter-five.barocad', import.meta.url);
const sourceSHA = 'f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2';
const ids = ['quarter_seed', 'quarter_copy_1', 'quarter_copy_2', 'quarter_copy_3', 'quarter_copy_4'];
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  nativeCapacity: { version: 1, maximumObjects: 16 },
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };

// These host resources have a separate lifetime from each loaded result.
const scene = new Scene();
const renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(800, 350);
renderer.setClearColor(0x101b2c);
document.querySelector('#view').append(renderer.domElement);
const camera = new OrthographicCamera(-0.006, 0.006, 0.002625, -0.002625, 0.0001, 1);
const markerGeometry = new BufferGeometry();
markerGeometry.setAttribute('position', new Float32BufferAttribute([-0.001, -0.0005, 0, -0.0007, -0.0005, 0], 3));
const markerMaterial = new LineBasicMaterial({ color: 0xffb454 });
const marker = new Line(markerGeometry, markerMaterial);
scene.add(marker);
const gl = renderer.getContext();
const loader = new BaroCADLoader(options);
const evidence = { engine: 'Three0.186.1', sourceURL: sourceURL.href, sourceSHA,
  publicEntries: ['@barocss/cad-interop/three', '@barocss/cad-interop/native'],
  ids, unitsPerMillimeter: 0.001, members: [], refusals: [], disposed: false, glErrors: [] };
window.__baroSDKQuickstartEvidence = evidence;
let accepted;
let resources = [];
const requireFact = (fact, message) => { if (!fact) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' &&
  typeof b === 'object' && Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const sameBuffer = (a, b) => a.length === b.length && Array.from(a).every((value, i) => Object.is(value, b[i]));
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
function frame() {
  renderer.render(scene, camera);
  const bytes = new Uint8Array(800 * 350 * 4);
  gl.readPixels(0, 0, 800, 350, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  const error = gl.getError();
  evidence.glErrors.push(error);
  requireFact(error === gl.NO_ERROR, `WebGL error ${error}`);
  return bytes;
}
function changedPixels(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4)
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) changed++;
  return changed;
}
function status(message) {
  document.querySelector('#status').textContent = `${message}\nNative Model: quarter_pattern\n${ids.join('\n')}\nDisplay scale: 0.001 units/mm`;
}
function fail(error) {
  window.__baroSDKQuickstartError = error.stack ?? String(error);
  status(`Failed: ${error.message}`);
  console.error(error);
}
async function load() {
  document.querySelector('#load').disabled = true;
  let next;
  try {
    next = await loader.loadAbortable(sourceURL.href, {});
    const sourceBytes = new TextEncoder().encode(next.source);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', sourceBytes)),
      byte => byte.toString(16).padStart(2, '0')).join('');
    requireFact(sourceBytes.length === 819 && digest === sourceSHA, 'Complete source bytes changed');
    const neutral = parseBaroCadSource(next.source, options);
    requireFact(same(next.model, neutral.model) && next.model.name === 'quarter_pattern' &&
      same(next.model.objects.map(object => object.id), ids) && next.surfaces.length === 0 &&
      next.curves.length === 5 && next.group.children.length === 5, 'Native Model or member order changed');
    requireFact(Object.is(next.model.objects[0].controlPoints[0][1], -0), 'Native signed zero changed');
    const tracked = [];
    evidence.members = next.group.children.map((child, index) => {
      const preview = next.curves[index];
      const reference = neutral.curves[index];
      requireFact(child instanceof Line && child.name === ids[index] &&
        same(preview.sample.curve, next.model.objects[index]) && same(preview.sample, reference.sample) &&
        sameBuffer(child.geometry.getAttribute('position').array, reference.positions) &&
        same(child.userData.barocss.nativeParameters, reference.sample.parameters), 'Native/target binding mismatch');
      for (let p = 0; p < reference.sample.pointsMM.length; p++)
        requireFact(reference.sample.pointsMM[p].every((value, axis) =>
          Object.is(Math.fround(value * 0.001), reference.positions[p * 3 + axis])), 'Incorrect mm conversion');
      for (const resource of [child.geometry, child.material]) {
        const record = { resource, disposals: 0 };
        resource.addEventListener('dispose', () => record.disposals++);
        tracked.push(record);
      }
      return { id: child.name, nativeParameters: [...reference.sample.parameters], bufferMatches: true };
    });
    scene.add(next.group);
    accepted?.dispose();
    accepted = next;
    next = undefined;
    resources = tracked;
    const center = new Box3().setFromObject(accepted.group).getCenter(new Vector3());
    camera.position.set(center.x, center.y, 0.05);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    accepted.group.visible = false;
    const background = frame();
    accepted.group.visible = true;
    accepted.group.children.forEach(child => { child.visible = false; });
    for (const [index, child] of accepted.group.children.entries()) {
      child.visible = true;
      evidence.members[index].pixels = changedPixels(frame(), background);
      requireFact(evidence.members[index].pixels > 0, `Invisible native member ${child.name}`);
      child.visible = false;
    }
    accepted.group.children.forEach(child => { child.visible = true; });
    const pixels = frame();
    evidence.combinedPixels = changedPixels(pixels, background);
    evidence.frameHash = hash(pixels);
    evidence.sourceRetained = true;
    evidence.disposed = false;
    evidence.refusals = [];
    document.querySelector('#reject').disabled = false;
    document.querySelector('#dispose').disabled = false;
    status('Loaded one complete source. Five native Curves are visible.');
  } finally {
    next?.dispose();
    document.querySelector('#load').disabled = false;
  }
}
function reject() {
  requireFact(accepted && !evidence.disposed, 'Load a source first');
  const before = frame();
  const original = accepted.source;
  const legacy = { ...options };
  delete legacy.nativeCapacity;
  const attempts = [
    ['legacy capacity', () => new BaroCADLoader(legacy).parse(original)],
    ['invalid source', () => loader.parse('invalid native CAD')],
    ['invalid capacity', () => new BaroCADLoader({ ...options, nativeCapacity: { version: 1, maximumObjects: 5 } }).parse(original)],
  ];
  for (const [label, attempt] of attempts) {
    let refused = false;
    try { const unexpected = attempt(); unexpected.dispose(); } catch { refused = true; }
    requireFact(refused && accepted.source === original && accepted.group.parent === scene &&
      sameBuffer(frame(), before) && resources.every(record => record.disposals === 0), 'Refusal changed accepted state');
    evidence.refusals.push(label);
  }
  evidence.refusalSourceRetained = true;
  status('Three invalid candidates refused. The accepted source and display remain.');
}
function dispose() {
  requireFact(accepted, 'Load a source first');
  const original = accepted.source;
  accepted.dispose();
  accepted.dispose();
  requireFact(resources.length === 10 && resources.every(record => record.disposals === 1) &&
    accepted.group.parent === null && accepted.source === original && marker.parent === scene &&
    renderer.domElement.isConnected && !gl.isContextLost(), 'Result disposal crossed caller ownership');
  frame();
  evidence.disposed = true;
  evidence.disposals = resources.map(record => record.disposals);
  evidence.callerRetained = true;
  document.querySelector('#reject').disabled = true;
  status('Display disposed twice. Caller Scene, marker, renderer and canvas remain live.');
}
document.querySelector('#load').addEventListener('click', () => { load().catch(fail); });
document.querySelector('#reject').addEventListener('click', () => { try { reject(); } catch (error) { fail(error); } });
document.querySelector('#dispose').addEventListener('click', () => { try { dispose(); } catch (error) { fail(error); } });
await load().catch(fail);
