/** Example-only original-composition codec and editor lifetime. No renderer injection. */
import { parseBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '../../packages/barocss-cad-interop/src/document.js';
import { compileMeshMaterial, prepareNativeDirectionalLights } from '../../packages/barocss-gpu/src/index.js';
import type { NativeDirectionalLightV0, NativeDirectionalLightsV0 } from '../../packages/barocss-gpu/src/index.js';
import { createNativeDirectionalLightWebGPUViewer } from '../../packages/barocss-viewer/src/index.js';
import type { ViewerNativeDirectionalLightInput, ViewerNativeDirectionalLightWebGPU, ViewerGeometryRef, ViewerWebGPUOptions } from '../../packages/barocss-viewer/src/index.js';

const FILE_LIMIT = 4 * 1024 * 1024;
const encoder = new TextEncoder();
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new TypeError(message);
}
/** Stream-charged signed JSON: descriptors only, bounded before joining, never calls toJSON. */
function signedJSON(input: unknown): string {
  let visits = 0, bytes = 0, units = 0;
  const chunks: string[] = [], active = new Set<object>();
  const append = (text: string) => {
    units += text.length; bytes += encoder.encode(text).length;
    requireValue(units <= FILE_LIMIT && bytes <= FILE_LIMIT, 'Composition exceeds 4 MiB');
    chunks.push(text);
  };
  const string = (text: string) => {
    requireValue(text.length <= 262144 && encoder.encode(text).length <= 262144, 'String budget exceeded');
    append(JSON.stringify(text));
  };
  const visit = (value: unknown, depth: number): void => {
    requireValue(++visits <= 327680 && depth <= 32, 'Composition value/depth budget exceeded');
    if (typeof value === 'number') {
      requireValue(Number.isFinite(value), 'Numbers must be finite');
      append(Object.is(value, -0) ? '-0' : String(value)); return;
    }
    if (typeof value === 'string') { string(value); return; }
    if (value === null || typeof value === 'boolean') { append(String(value)); return; }
    requireValue(typeof value === 'object', 'Only ordinary own data is supported');
    const array = Array.isArray(value);
    requireValue(Object.getPrototypeOf(value) === (array ? Array.prototype : Object.prototype), 'Foreign data prototype');
    requireValue(!active.has(value), 'Cyclic data'); active.add(value);
    try {
      const keys = Reflect.ownKeys(value);
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
        requireValue(Number.isInteger(length) && length >= 0 && length <= 4096 && keys.length === length + 1,
          'Array must be dense and within budget');
        append('[');
        for (let i = 0; i < length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
          requireValue(descriptor && 'value' in descriptor && descriptor.enumerable, 'Array must have own data entries');
          if (i) append(','); visit(descriptor.value, depth + 1);
        }
        append(']');
      } else {
        requireValue(keys.length <= 64, 'Record field budget exceeded'); append('{');
        keys.forEach((key, index) => {
          requireValue(typeof key === 'string', 'Symbol fields are unsupported');
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          requireValue(descriptor && 'value' in descriptor && descriptor.enumerable, 'Accessor/hidden fields unsupported');
          if (index) append(','); string(key); append(':'); visit(descriptor.value, depth + 1);
        });
        append('}');
      }
    } finally { active.delete(value); }
  };
  visit(input, 0); return chunks.join('');
}
function copy<T>(value: T): T { return JSON.parse(signedJSON(value)) as T; }
function exact(value: unknown, fields: string[], label: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), label + ' must be a record');
  const keys = Object.keys(value);
  requireValue(keys.length === fields.length && keys.every(key => fields.includes(key)), label + ' has unsupported/missing fields');
  return value as Record<string, unknown>;
}
function catalog(input: ViewerNativeDirectionalLightInput): void {
  exact(input.owner, ['id', 'revision'], 'Owner');
  requireValue(typeof input.owner.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(input.owner.id)
    && Number.isSafeInteger(input.owner.revision) && input.owner.revision >= 0, 'Invalid composition owner');
  requireValue(input.owner.id === input.lights.sourceId && Object.is(input.owner.revision, input.lights.revision),
    'Composition owner and light catalog must match');
  prepareNativeDirectionalLights(input.lights);
}

export function encodeComposition(input: ViewerNativeDirectionalLightInput): string {
  // Snapshot first so even a direct utility caller cannot execute a getter.
  const raw = copy(input);
  return signedJSON({ format: 'barocss-viewer-native-directional-light-example', version: 0,
    owner: raw.owner, document: raw.source.result.document, nativeOptions: raw.source.options,
    bindings: raw.source.bindings, display: raw.display,
    materials: raw.materials.map(item => ({ ref: item.ref, source: item.binding.material.source, uniforms: item.binding.uniforms })),
    lights: raw.lights, context: raw.context });
}
export function decodeComposition(text: string): ViewerNativeDirectionalLightInput {
  requireValue(typeof text === 'string' && text.length <= FILE_LIMIT && encoder.encode(text).length <= FILE_LIMIT,
    'Composition exceeds 4 MiB');
  const parsed = exact(JSON.parse(text), ['format','version','owner','document','nativeOptions','bindings','display','materials','lights','context'], 'Composition');
  // Reject outer counts before traversing potentially expensive element subtrees.
  const display = exact(parsed.display, ['motion','visibleGeometry','camera'], 'Display');
  const lights = exact(parsed.lights, ['format','version','profile','sourceId','revision','ambientStrength','lights'], 'Lights');
  for (const [label, values, minimum] of [['materials', parsed.materials, 0], ['bindings', parsed.bindings, 1],
    ['visibleGeometry', display.visibleGeometry, 1], ['lights', lights.lights, 0]] as const) {
    requireValue(Array.isArray(values) && values.length >= minimum && values.length <= 4, label + ' count is outside the supported range');
  }
  const raw = copy(parsed);
  requireValue(raw.format === 'barocss-viewer-native-directional-light-example' && raw.version === 0, 'Unsupported composition format/version');
  requireValue(Array.isArray(raw.materials) && raw.materials.length <= 4, 'At most four materials');
  requireValue(Array.isArray(raw.bindings) && raw.bindings.length >= 1 && raw.bindings.length <= 4, 'One to four TEN bindings required');
  const materials = raw.materials.map(value => {
    const material = exact(value, ['ref','source','uniforms'], 'Material');
    requireValue(typeof material.source === 'string', 'Original material source required');
    const result = compileMeshMaterial(material.source);
    if (!result.ok) throw new Error('Original material compilation refused', { cause: result.diagnostics });
    return { ref: material.ref, binding: { material: result.material, uniforms: material.uniforms } };
  });
  const input = { format: 'barocss-viewer-native-directional-light-input', version: 0, owner: raw.owner,
    source: { kind: 'document', result: parseBaroCadDocument(signedJSON(raw.document)), options: raw.nativeOptions, bindings: raw.bindings },
    display: raw.display, materials, lights: raw.lights, context: raw.context } as ViewerNativeDirectionalLightInput;
  catalog(input);
  // Complete TEN, selected/hidden source and display validation belongs to the actual Viewer replacement.
  return input;
}

export function createSeedInput(): ViewerNativeDirectionalLightInput {
  const sources = [
    '@model left_original { version:0; length-unit:mm; @surface #shared_patch { type:nurbs; degree-u:1; degree-v:1; knots-u:[-3,-3,7,7]; knots-v:[2,2,5,5]; control-points:[[[0,0,-0],[0,3,0]],[[2,0,1],[2,3,1]]]; weights:[[1,1],[1,1]]; } }',
    '@model right_original { version:0; length-unit:mm; @surface #shared_patch { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[3,3,11,11]; control-points:[[[0,0,0],[0,3,1]],[[2,0,1],[2,3,2]]]; weights:[[1,1.25],[.75,1.5]]; } }',
  ];
  const frame = 'authored-xyz-no-axis-conversion';
  const document = { schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
    documentId: 'two_original_surfaces', revision: 5, units: { length: 'mm', angle: 'rad' }, nativeFrame: frame,
    assets: sources.map((source, index) => ({ id: index ? 'asset_right' : 'asset_left', revision: index ? 7 : 2,
      role: 'authored-native-source', sourceVersion: 0, sourceFrame: frame, source })),
    bodies: sources.map((_, index) => ({ id: `body_${index}`, name: `Original surface ${index + 1}`,
      kind: 'direct-geometry-object', assetId: index ? 'asset_right' : 'asset_left', geometryId: 'shared_patch' })),
    features: [], parameters: [], constraints: [], placements: [], derivedCaches: [] };
  const result = parseBaroCadDocument(signedJSON(document));
  const options = { native: { sourceVersion: 0 as const, countU: 5, countV: 5, unitsPerMillimeter: 1 },
    basis: 'authored-xyz-matches-rhyup' as const };
  const entries = prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options);
  const refs = entries.map(entry => ({ kind: 'surface' as const, modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId }));
  const compiled = compileMeshMaterial('/* Original material; default amount intentionally omitted */\r\n@shader #original_white { @uniform amount:float(-0,1,.8); @fragment {color:mix(#888,#fff,amount);} }\r\n');
  if (!compiled.ok) throw new Error('Seed material compilation refused', { cause: compiled.diagnostics });
  return { format: 'barocss-viewer-native-directional-light-input', version: 0,
    owner: { id: 'two-surface-light-study', revision: -0 }, source: { kind: 'document', result, options, bindings: entries.map(entry => entry.binding) },
    display: { visibleGeometry: refs, camera: { eye: [0, 2, 11], target: [0, 1, 0], up: [0, 1, 0], fovYDegrees: 45, near: .1, far: 100 },
      motion: { frame: { contextId: 'example-pose', timeSeconds: -0, poses: [
        { targetId: 'left', translation: [-3, -1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        { targetId: 'right', translation: [.5, -.5, -1], rotation: [0, 0, .25881904510252074, .9659258262890683], scale: [1.1, .9, 1] },
      ] }, bindings: refs.map((ref, index) => ({ contextId: 'example-pose', targetId: index ? 'right' : 'left', ref })), basis: 'part-xyz-matches-rhyup' } },
    materials: refs.map((ref, index) => ({ ref: { modelId: ref.modelId, surfaceId: ref.surfaceId }, binding: { material: compiled.material, uniforms: (index ? { amount: -0 } : {}) as Record<string, number> } })),
    lights: { format: 'barocss-gpu-native-directional-lights', version: 0, profile: 'native-world-directional-linear-v0',
      sourceId: 'two-surface-light-study', revision: -0, ambientStrength: .15, lights: [
        { nodeId: 'red-key', label: 'Red +X', enabled: true, directionScene: [1, -0, 0], colorLinearRGB: [1, 0, -0], intensity: .9 },
        { nodeId: 'blue-fill', label: 'Blue +Z', enabled: true, directionScene: [0, -0, 1], colorLinearRGB: [-0, 0, 1], intensity: .8 },
      ] }, context: { mmToSceneUnit: 1, background: [.035, .045, .065] } };
}

export function createLightEditorController(canvas: HTMLCanvasElement, options: ViewerWebGPUOptions) {
  let viewer: ViewerNativeDirectionalLightWebGPU | null = null;
  let draft: NativeDirectionalLightsV0 | null = null, selectedLightId: string | null = null;
  let pending = false, closed = false, epoch = 0, nextId = 1, error: unknown = null;
  let notificationError: unknown = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    const failures: unknown[] = [];
    for (const listener of [...listeners]) { try { listener(); } catch (cause) { failures.push(cause); } }
    notificationError = failures.length ? new AggregateError(failures, 'Editor notification failed') : null;
  };
  function available() { requireValue(!closed, 'Editor is disposed'); requireValue(!pending, 'Editor is busy'); }
  function ready() { available(); requireValue(viewer && draft, 'Start the WebGPU viewer first'); return viewer; }
  async function operation<T>(action: (token: number) => Promise<T>): Promise<T> {
    available(); pending = true; error = null; const token = ++epoch; emit();
    try { current(token); return await action(token); }
    catch (cause) { if (!closed && token === epoch) error = cause; throw cause; }
    finally { if (!closed && token === epoch) { pending = false; emit(); } }
  }
  function current(token: number) { requireValue(!closed && epoch === token, 'Editor operation was disposed or superseded'); }
  function prepareDraft(input: ViewerNativeDirectionalLightInput) { return copy(input.lights); }
  async function replace(input: ViewerNativeDirectionalLightInput, token: number) {
    requireValue(viewer, 'Start the WebGPU viewer first');
    const nextDraft = prepareDraft(input), nextSelected = nextDraft.lights[0]?.nodeId ?? null;
    current(token); const result = await viewer.replace(input); current(token);
    if (!result.ok) throw result.error;
    draft = nextDraft; selectedLightId = nextSelected;
  }
  return {
    get state() { return { pending, closed, error: error !== null && notificationError !== null
      ? new AggregateError([error, notificationError], 'Editor operation and notification failed') : error ?? notificationError, draft: draft ? copy(draft) : null, selectedLightId,
      accepted: viewer?.accepted ?? null, selected: viewer?.selected ?? null, status: viewer?.status ?? null }; },
    subscribe(listener: () => void) { requireValue(!closed, 'Editor is disposed'); requireValue(listeners.size < 128, 'Subscriber budget exceeded'); listeners.add(listener); return () => { listeners.delete(listener); }; },
    start(input?: ViewerNativeDirectionalLightInput) {
      requireValue(!viewer, 'Editor already started');
      return operation(async token => {
        const candidate = copy(input ?? createSeedInput());
        const nextDraft = prepareDraft(candidate), nextSelected = nextDraft.lights[0]?.nodeId ?? null;
        const mounted = await createNativeDirectionalLightWebGPUViewer(canvas, candidate, options);
        if (closed || epoch !== token) { mounted.dispose(); return; }
        viewer = mounted; draft = nextDraft; selectedLightId = nextSelected;
      });
    },
    selectLight(nodeId: string) { ready(); requireValue(draft!.lights.some(light => light.nodeId === nodeId), 'Unknown light'); selectedLightId = nodeId; emit(); },
    edit(nodeId: string, patch: Partial<Omit<NativeDirectionalLightV0, 'nodeId'>>) {
      ready(); const owned = copy(patch);
      requireValue(Object.keys(owned).every(key => ['label','enabled','directionScene','colorLinearRGB','intensity'].includes(key)), 'Unsupported light field');
      const index = draft!.lights.findIndex(light => light.nodeId === nodeId); requireValue(index >= 0, 'Unknown light');
      draft!.lights[index] = { ...draft!.lights[index], ...owned }; emit();
    },
    ambient(value: number) { ready(); requireValue(Number.isFinite(value), 'Ambient must be finite'); draft!.ambientStrength = value; emit(); },
    add() { ready(); requireValue(draft!.lights.length < 4, 'Four lights maximum, including disabled lights');
      let nodeId: string; do { nodeId = `light-${nextId++}`; } while (draft!.lights.some(light => light.nodeId === nodeId));
      draft!.lights.push({ nodeId, label: 'New directional light', enabled: true, directionScene: [0, 0, 1], colorLinearRGB: [1, 1, 1], intensity: .5 });
      selectedLightId = nodeId; emit(); return nodeId;
    },
    remove(nodeId: string) { ready(); const index = draft!.lights.findIndex(light => light.nodeId === nodeId); requireValue(index >= 0, 'Unknown light');
      draft!.lights.splice(index, 1); if (selectedLightId === nodeId) selectedLightId = draft!.lights[0]?.nodeId ?? null; emit(); },
    apply() { const target = ready(); return operation(async token => {
      const input = copy(target.originals), nextDraft = copy(draft!);
      requireValue(input.owner.revision < Number.MAX_SAFE_INTEGER, 'Composition revision exhausted');
      input.owner.revision += 1; nextDraft.revision = input.owner.revision; input.lights = nextDraft;
      catalog(input); const result = await target.replace(input); current(token); if (!result.ok) throw result.error;
      draft = nextDraft;
    }); },
    open(file: Pick<File, 'size' | 'text'>) { ready(); return operation(async token => {
      requireValue(Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= FILE_LIMIT, 'File exceeds 4 MiB');
      const text = await file.text(); current(token); const input = decodeComposition(text); current(token); await replace(input, token);
    }); },
    openText(text: string) { ready(); return operation(async token => { const input = decodeComposition(text); await replace(input, token); }); },
    save() { return encodeComposition(ready().originals); },
    selectSurface(ref: ViewerGeometryRef | null) { const result = ready().select(ref); if (!result.ok) throw result.error; emit(); },
    pick(x: number, y: number) { const target = ready(); return operation(async token => {
      const picked = await target.pick(x, y); current(token); const result = target.select(picked.ref); if (!result.ok) throw result.error; return picked;
    }); },
    resize(width: number, height: number) { const target = ready(); return operation(async token => {
      const result = await target.resize(width, height); current(token); if (!result.ok) throw result.error;
    }); },
    dispose() { if (closed) return; closed = true; epoch++; pending = false;
      try { viewer?.dispose(); } catch (cause) { error = cause; throw cause; }
      finally { emit(); listeners.clear(); viewer = null; draft = null; }
    },
  };
}
