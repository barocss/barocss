import { parseBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '../../packages/barocss-cad-interop/src/document.js';
import { createNativeSurfaceUV01WebGPUViewer } from '../../packages/barocss-viewer/src/index.js';
import type { ViewerGeometryRef, ViewerNativeSurfaceUV01Input, ViewerNativeSurfaceUV01Pick,
  ViewerNativeSurfaceUV01WebGPU } from '../../packages/barocss-viewer/src/index.js';

/** Tiny original CAD documents, not synthetic preview packets or prepared GPU inputs. */
export function createSeedInput(): ViewerNativeSurfaceUV01Input {
  const sources = [
    '/* Original left Surface */\r\n@model left_original { version:0; length-unit:mm; @surface #shared_patch { type:nurbs; degree-u:1; degree-v:1; knots-u:[-3,-3,7,7]; knots-v:[2,2,5,5]; control-points:[[[0,0,-0],[0,3,0]],[[2,0,1],[2,3,1]]]; weights:[[1,1],[1,1]]; } }\r\n',
    '/* Original right Surface */\n@model right_original { version:0; length-unit:mm; @surface #shared_patch { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[3,3,11,11]; control-points:[[[0,0,0],[0,3,1]],[[2,0,1],[2,3,2]]]; weights:[[1,1.25],[.75,1.5]]; } }\n',
  ];
  const frame = 'authored-xyz-no-axis-conversion';
  const document = { schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
    documentId: 'two_original_uv01_surfaces', revision: 5, units: { length: 'mm', angle: 'rad' }, nativeFrame: frame,
    assets: sources.map((source, index) => ({ id: index ? 'asset-right' : 'asset-left', revision: index ? 7 : 2,
      role: 'authored-native-source', sourceVersion: 0, sourceFrame: frame, source })),
    bodies: sources.map((_, index) => ({ id: `body_${index}`, name: `Original Surface ${index + 1}`,
      kind: 'direct-geometry-object', assetId: index ? 'asset-right' : 'asset-left', geometryId: 'shared_patch' })),
    features: [], parameters: [], constraints: [], placements: [], derivedCaches: [] };
  const result = parseBaroCadDocument(JSON.stringify(document));
  const options = { native: { sourceVersion: 0 as const, countU: 5, countV: 5, unitsPerMillimeter: 1 },
    basis: 'authored-xyz-matches-rhyup' as const };
  const entries = prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options);
  const refs = entries.map(entry => ({ kind: 'surface' as const, modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId }));
  const materials = [
    '// Left: normalized native U; amount uses its omitted default\r\n@shader #native_left { @uniform amount:float(-0,1,.9); @fragment { color:mix(#154779,#f7cf70,surface_u01*amount); } }\r\n',
    '// Right: normalized native V, with an exact signed-zero override\n@shader #native_right { @uniform offset:float(-0,1,-0); @fragment { color:mix(#663f87,#7ce1bd,(surface_v01+offset)*.5); } }\n',
  ];
  return { format: 'barocss-viewer-native-surface-uv01-input', version: 0,
    owner: { id: 'two-surface-uv01-study', revision: -0 },
    source: { kind: 'document', result, options, bindings: entries.map(entry => entry.binding) },
    display: { visibleGeometry: refs,
      camera: { eye: [0, 2, 11], target: [0, 1, 0], up: [0, 1, 0], fovY: 45, near: .1, far: 100 },
      motion: { frame: { contextId: 'example-pose', timeSeconds: -0, poses: [
        { targetId: 'left', translation: [-3, -1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        { targetId: 'right', translation: [.5, -.5, -1], rotation: [0, 0, .25881904510252074, .9659258262890683], scale: [1.1, .9, 1] },
      ] }, bindings: refs.map((ref, index) => ({ contextId: 'example-pose', targetId: index ? 'right' : 'left', ref })),
      basis: 'part-xyz-matches-rhyup' } },
    materials: refs.map((ref, index) => ({ ref: { modelId: ref.modelId, surfaceId: ref.surfaceId }, source: materials[index],
      ...(index ? { uniforms: { offset: -0 } } : {}) })),
    lighting: { direction: [1, 2, 4], ambientStrength: .35, directionalStrength: .65 },
    context: { mmToSceneUnit: 1, background: [.035, .045, .065] } };
}

const describe = (error: unknown): string => error instanceof Error
  ? `${error.name}: ${error.message}` : 'Operation refused without an Error diagnostic';
function sameRef(left: ViewerGeometryRef, right: ViewerGeometryRef | null): boolean {
  return left.kind === 'surface' && right?.kind === 'surface'
    && left.modelId === right.modelId && left.surfaceId === right.surfaceId;
}

/** Example-owned lifetime. Tests may mock the module import; no renderer injection API. */
export function setupExample(root: HTMLElement) {
  function element<T extends HTMLElement>(id: string): T {
    const value = root.querySelector<T>(`#${id}`);
    if (!value) throw new Error('Missing example element: ' + id);
    return value;
  }
  const canvas = element<HTMLCanvasElement>('viewport');
  const source = element<HTMLTextAreaElement>('material-source');
  const materials = element<HTMLSelectElement>('materials');
  const surfaces = element<HTMLSelectElement>('surfaces');
  const startButton = element<HTMLButtonElement>('start');
  const applyButton = element<HTMLButtonElement>('apply');
  const disposeButton = element<HTMLButtonElement>('dispose');
  const cleanups = new Set<() => void>();
  const drafts = new Map<number, string>();
  let viewer: ViewerNativeSurfaceUV01WebGPU | null = null;
  let pending = false, closed = false, epoch = 0, materialIndex = 0;
  let error: unknown = null, picked: ViewerNativeSurfaceUV01Pick | null = null;
  const window = root.ownerDocument.defaultView;
  function option(label: string, value: string) {
    const node = root.ownerDocument.createElement('option'); node.textContent = label; node.value = value; return node;
  }
  function render() {
    const accepted = viewer?.accepted, selected = viewer?.selected ?? null;
    const enabled = !!viewer && !closed && !pending && viewer.status.state === 'ready';
    startButton.disabled = !!viewer || closed || pending;
    applyButton.disabled = materials.disabled = source.disabled = surfaces.disabled = !enabled;
    disposeButton.disabled = closed;
    element('status').textContent = viewer ? `${pending ? 'Working… ' : ''}${JSON.stringify(viewer.status)}`
      : closed ? 'Disposed' : pending ? 'Starting required WebGPU…' : 'Not started. A WebGPU-capable browser/device is required.';
    element('error').textContent = error === null ? '' : describe(error);
    const binding = accepted?.bindings.find(row => sameRef(row.ref, selected))?.binding ?? null;
    element('identity').textContent = accepted ? JSON.stringify({ owner: accepted.owner, document: accepted.document,
      generation: accepted.generation, selected, TEN: binding, picked }, null, 2) : 'No accepted scene';
    surfaces.replaceChildren(option('No selection', ''), ...(accepted?.visibleGeometry ?? []).map((ref, index) =>
      option(`${ref.modelId} / ${ref.kind === 'surface' ? ref.surfaceId : ref.curveId}`, String(index))));
    const index = accepted?.visibleGeometry.findIndex(ref => sameRef(ref, selected)) ?? -1;
    surfaces.value = index < 0 ? '' : String(index);
  }
  function available() {
    if (closed) throw new Error('Example is disposed');
    if (pending) throw new Error('An example operation is pending');
  }
  function ready() {
    available(); if (!viewer) throw new Error('Start the WebGPU viewer first'); return viewer;
  }
  function current(token: number) {
    if (closed || token !== epoch) throw new Error('Example was disposed during the operation');
  }
  async function operation<T>(action: (token: number) => Promise<T>): Promise<T> {
    available(); pending = true; error = null; const token = ++epoch; render();
    try { return await action(token); }
    catch (cause) { if (!closed && token === epoch) error = cause; throw cause; }
    finally { if (!closed && token === epoch) { pending = false; render(); } }
  }
  function showMaterial() { source.value = drafts.get(materialIndex) ?? ''; materials.value = String(materialIndex); }
  function readDraftSource() {
    const original = drafts.get(materialIndex) ?? '';
    // Textarea values normalize CRLF. An untouched editor must retain the exact original source.
    return source.value === original || source.value === original.replace(/\r\n?/g, '\n') ? original : source.value;
  }
  async function start() {
    available(); if (viewer) throw new Error('Example already started');
    return operation(async token => {
      const mounted = await createNativeSurfaceUV01WebGPUViewer(canvas, createSeedInput(), { width: 800, height: 600 });
      // A factory can resolve after pagehide/Dispose; never adopt or leak that backend.
      if (closed || token !== epoch) { mounted.dispose(); return; }
      viewer = mounted;
      const originals = mounted.originals;
      materials.replaceChildren(...originals.materials.map((material, index) => {
        drafts.set(index, material.source); return option(`${material.ref.modelId} / ${material.ref.surfaceId}`, String(index));
      }));
      materialIndex = 0; showMaterial();
    });
  }
  async function apply() {
    const target = ready(), index = materialIndex, text = readDraftSource();
    drafts.set(index, text);
    return operation(async token => {
      const accepted = target.originals;
      if (accepted.owner.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Composition revision exhausted');
      // Spread accepted own data: preserve signed Numbers, complete sources, TEN and omitted uniforms.
      const candidate: ViewerNativeSurfaceUV01Input = { ...accepted, owner: { ...accepted.owner, revision: accepted.owner.revision + 1 },
        materials: accepted.materials.map((material, i) => i === index ? { ...material, source: text } : material) };
      const result = await target.replace(candidate); current(token);
      if (!result.ok) throw result.error;
      picked = null;
    });
  }
  function select(ref: ViewerGeometryRef | null) {
    const target = ready(); error = null;
    const result = target.select(ref);
    if (!result.ok) { error = result.error; render(); throw result.error; }
    render();
  }
  async function pick(x: number, y: number) {
    const target = ready();
    return operation(async token => {
      const result = await target.pick(x, y); current(token);
      const selection = target.select(result.ref); if (!selection.ok) throw selection.error;
      picked = result; return result;
    });
  }
  function dispose() {
    if (closed) return; closed = true; pending = false; epoch++;
    const failures: unknown[] = [];
    try { viewer?.dispose(); } catch (cause) { failures.push(cause); }
    for (const cleanup of cleanups) { try { cleanup(); } catch (cause) { failures.push(cause); } }
    cleanups.clear(); drafts.clear(); picked = null;
    if (failures.length) error = new AggregateError(failures, 'Example cleanup failed');
    render();
    if (failures.length) throw error;
  }
  function listen(target: EventTarget, name: string, action: (event: Event) => unknown) {
    const listener = (event: Event) => {
      try {
        Promise.resolve(action(event)).catch(cause => { if (!closed) { error = cause; render(); } });
      } catch (cause) { if (!closed) { error = cause; render(); } }
    };
    target.addEventListener(name, listener); cleanups.add(() => target.removeEventListener(name, listener));
  }
  listen(startButton, 'click', start);
  listen(applyButton, 'click', apply);
  listen(disposeButton, 'click', dispose);
  listen(source, 'input', () => { drafts.set(materialIndex, readDraftSource()); });
  listen(materials, 'change', () => {
    ready(); const next = Number(materials.value);
    if (!Number.isInteger(next) || !drafts.has(next)) throw new Error('Unknown material');
    drafts.set(materialIndex, readDraftSource()); materialIndex = next; showMaterial();
  });
  listen(surfaces, 'change', () => {
    const target = ready(), value = surfaces.value;
    if (value === '') return select(null);
    const ref = target.accepted.visibleGeometry[Number(value)];
    if (!ref) throw new Error('Unknown Surface');
    select(ref);
  });
  listen(canvas, 'click', event => {
    if (pending || closed || !viewer) return;
    const pointer = event as MouseEvent, bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const x = Math.floor((pointer.clientX - bounds.left) * canvas.width / bounds.width);
    const y = Math.floor((pointer.clientY - bounds.top) * canvas.height / bounds.height);
    if (x >= 0 && y >= 0 && x < canvas.width && y < canvas.height) return pick(x, y);
  });
  if (window) listen(window, 'pagehide', dispose);
  render();
  return { start, apply, pick, select, dispose,
    get state() { return { pending, closed, error, accepted: viewer?.accepted ?? null,
      selected: viewer?.selected ?? null, status: viewer?.status ?? null, picked }; } };
}
