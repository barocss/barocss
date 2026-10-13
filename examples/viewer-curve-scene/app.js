import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const canvas = document.querySelector('#view');
const output = document.querySelector('#state');
const lit = new URLSearchParams(location.search).get('lighting') === 'directional';
const lightingInput = lit ? { ambientStrength: 0.12, directionalStrength: 0.78,
  direction: [0.8, 0.4, -0.7] } : null;
const viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.055, 0.09],
  ...(lightingInput ? { lighting: lightingInput } : {}) });
const sources = Object.fromEntries(await Promise.all(['mixed', 'curves-only', 'wide-64'].map(async name =>
  [name, await (await fetch(`/${name}.barocad`)).text()])));
const options = { sourceVersion: 0, countU: 8, countV: 8,
  curveDisplay: { chordToleranceMM: 2, maxSegments: 256, maxDepth: 10 } };
const wideOptions = { sourceVersion: 0, countU: 8, countV: 8,
  curveDisplay: { version: 1, chordToleranceMM: 0.002, maxSegments: 4092, maxDepth: 10 } };
let message = '';
let lastHit = null;
let pendingUrlController = null;

function describe(next = message) {
  message = next;
  const state = viewer.getState();
  output.textContent = [
    `Status: ${state.status}`,
    `Native model: ${state.native?.model.name ?? 'none'}`,
    `Surfaces: ${state.surfaces.map(ref => ref.surfaceId).join(', ') || 'none'}`,
    `Displayed Curves: ${state.curves.map(ref => ref.curveId).join(', ') || 'none'}`,
    `Curve sample version: ${state.curveSampleVersion ?? 'none'}`,
    `Lighting: ${state.lighting ? 'directional' : 'default'}`,
    `Selected Surface: ${state.selected?.surfaceId ?? 'none'}`,
    `Selected geometry: ${state.selectedGeometry
      ? `${state.selectedGeometry.kind} ${state.selectedGeometry.kind === 'curve'
        ? state.selectedGeometry.curveId : state.selectedGeometry.surfaceId}` : 'none'}`,
    `Motion: ${state.geometryMotion ? 'all geometry' : state.motion ? 'Surfaces' : 'none'}`,
    `Camera: ${state.camera.eye.map(value => value.toFixed(3)).join(', ')}`,
    next,
  ].join('\n');
}
function load(name) {
  viewer.loadNative(sources[name], name === 'wide-64' ? wideOptions : options);
  lastHit = null;
  describe(`${name} accepted. Original Curve parameters and native source remain in getState().native.`);
}
load('mixed');

async function loadUrl(name = 'mixed') {
  const controller = new AbortController();
  pendingUrlController = controller;
  let loadedBytes = 0;
  describe(`Loading ${name} from URL…`);
  try {
    await viewer.loadNativeUrl(`/${name}.barocad`, name === 'wide-64' ? wideOptions : options, {
      signal: controller.signal,
      onProgress(event) { loadedBytes = event.loadedBytes; describe(`Received ${loadedBytes} bytes…`); },
    });
    lastHit = null;
    describe(`${name} URL accepted (${loadedBytes} bytes). Native source and IDs are unchanged.`);
  } catch (error) { describe(`URL load refused: ${error.message}`); }
  finally { if (pendingUrlController === controller) pendingUrlController = null; }
}

document.querySelector('#mixed').addEventListener('click', () => load('mixed'));
document.querySelector('#curves-only').addEventListener('click', () => load('curves-only'));
document.querySelector('#wide-64').addEventListener('click', () => load('wide-64'));
document.querySelector('#load-url').addEventListener('click', () => loadUrl('mixed'));
document.querySelector('#cancel-url').addEventListener('click', () => pendingUrlController?.abort());
document.querySelector('#fit').addEventListener('click', () => { viewer.fit(); describe('Fitted visible geometry.'); });
document.querySelector('#fit-selection').addEventListener('click', () => {
  const ref = viewer.getState().selectedGeometry;
  if (!ref) { describe('Select a displayed Surface or Curve first.'); return; }
  viewer.fitGeometry(ref);
  describe(`Fitted displayed ${ref.kind} only. Selection and native source are unchanged.`);
});
document.querySelector('#orbit').addEventListener('click', () => { viewer.orbit(0.3, 0.1); describe('Orbited camera.'); });
document.querySelector('#pose').addEventListener('click', () => {
  const refs = viewer.getState().surfaces;
  if (!refs.length) { describe('Load mixed geometry before posing Surfaces.'); return; }
  viewer.applyMotionFrame({ contextId: 'native_mixed', timeSeconds: 1,
    poses: refs.map((ref, index) => ({ targetId: `panel-${index}`,
      translation: [index ? 60 : -60, 0, 0] })) },
  refs.map((ref, index) => ({ contextId: 'native_mixed', targetId: `panel-${index}`, ref })),
  { basis: 'part-xyz-matches-rhyup' });
  describe('Posed Surfaces; native Curves stay in authored XYZ/mm.');
});
document.querySelector('#pose-geometry').addEventListener('click', () => {
  const state = viewer.getState();
  const refs = [...state.surfaces.map(ref => ({ kind: 'surface', ...ref })),
    ...state.curves.map(ref => ({ kind: 'curve', ...ref }))];
  const contextId = state.native.model.name;
  viewer.applyGeometryMotionFrame({ contextId, timeSeconds: 1,
    poses: refs.map((ref, index) => ({ targetId: `object-${index}`,
      translation: [ref.kind === 'curve' ? 80 : 0, 0, 0] })) },
  refs.map((ref, index) => ({ contextId, targetId: `object-${index}`, ref })),
  { basis: 'part-xyz-matches-rhyup' });
  describe('Displayed Curves moved 80 mm. Native source and measurements remain unchanged.');
});
document.querySelector('#reset-pose').addEventListener('click', () => {
  viewer.resetMotion();
  describe('Display poses reset.');
});
document.querySelector('#invalid').addEventListener('click', () => {
  try { viewer.loadNative(sources.mixed, { ...options,
    curveDisplay: { ...options.curveDisplay, maxSegments: 0 } }); }
  catch (error) { describe(`Rejected without scene replacement: ${error.message}`); }
});
document.querySelector('#select-hit').addEventListener('click', () => {
  if (!lastHit) { describe('Click visible geometry first.'); return; }
  viewer.selectGeometry({ kind: lastHit.kind, ...lastHit.ref });
  describe(`Selected displayed ${lastHit.kind}. The native Model is unchanged.`);
});
document.querySelector('#clear-selection').addEventListener('click', () => {
  viewer.selectGeometry(null);
  describe('Display selection cleared.');
});
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  const hit = viewer.pickGeometry({ xCss: event.clientX - rect.left, yCss: event.clientY - rect.top });
  lastHit = hit;
  if (hit?.kind === 'surface') describe(`Surface ${hit.ref.surfaceId}: approximate UV ${hit.parameterUV.join(', ')}`);
  else if (hit?.kind === 'curve') describe(`Curve ${hit.ref.curveId}: segment ${hit.segmentIndex}, approximate t ${hit.parameterApprox.toFixed(6)}, native XYZ/mm ${hit.nativePointMM.map(value => value.toFixed(3)).join(', ')}, screen distance ${hit.screenDistancePx.toFixed(2)} CSS px`);
  else describe('No visible geometry near this point.');
});

// Opt-in real-browser timing probe. It never changes the accepted scene or selection.
function benchmarkCurvePicking({ repetitions = 3, columns = 8, rows = 6 } = {}) {
  if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 10
      || !Number.isSafeInteger(columns) || columns < 1 || columns > 32
      || !Number.isSafeInteger(rows) || rows < 1 || rows > 32)
    throw new RangeError('Benchmark counts must be positive bounded integers');
  const stateBefore = viewer.getState();
  if (stateBefore.status !== 'ready') throw new Error('Load a ready Curve scene first');
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) throw new Error('Canvas must have CSS dimensions');
  const points = Array.from({ length: rows * columns }, (_, index) => ({
    xCss: (index % columns + 0.5) * rect.width / columns,
    yCss: (Math.floor(index / columns) + 0.5) * rect.height / rows,
  }));
  const signature = hit => hit === null ? 'none' : hit.kind === 'curve'
    ? ['curve', hit.ref.modelId, hit.ref.curveId, hit.segmentIndex,
      hit.parameterApprox, hit.screenDistancePx, hit.ambiguous].join('|')
    : ['surface', hit.ref.modelId, hit.ref.surfaceId, hit.ambiguous].join('|');
  const scan = () => points.map(point => signature(viewer.pickGeometry(point, { kinds: ['curve'] })));
  // Warm up outside timing. Every subsequent scan must return identical results.
  const expected = scan(), timingsMs = [];
  for (let iteration = 0; iteration < repetitions; iteration++) {
    const start = performance.now();
    const actual = scan();
    timingsMs.push(performance.now() - start);
    if (actual.length !== expected.length || actual.some((value, i) => value !== expected[i]))
      throw new Error('Curve picks changed between equivalent benchmark scans');
  }
  const stateAfter = viewer.getState();
  if (JSON.stringify(stateBefore) !== JSON.stringify(stateAfter))
    throw new Error('Benchmark unexpectedly modified Viewer accepted state');
  const sorted = [...timingsMs].sort((a, b) => a - b);
  return Object.freeze({
    sampleVersion: stateBefore.curveSampleVersion,
    curveCount: stateBefore.curves.length,
    canvasCss: [rect.width, rect.height],
    pointsPerScan: points.length,
    hits: expected.filter(value => value !== 'none').length,
    repetitions, timingsMs,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    // Timing measures the current build only, not old-versus-new speedup.
    note: 'Browser-local timing; same-build determinism only; not a baseline comparison',
  });
}
window.viewerCurveDemo = { viewer, createViewer, lightingInput, sources, options, wideOptions, load, loadUrl, describe,
  benchmarkCurvePicking, get lastHit() { return lastHit; } };
