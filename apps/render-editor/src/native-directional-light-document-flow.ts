import {prepareRenderNativeDirectionalLightDocument, parseRenderNativeDirectionalLightDocument,
  serializeRenderNativeDirectionalLightDocument, upgradeRenderNativeSceneToDirectionalLights,
  createRenderNativeDirectionalLightRequest, parseRenderNativeSceneDocument, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeDirectionalLightDocumentV1} from '@barocss/render-editor';
import {prepareNativeDirectionalLights} from '@barocss/gpu';

function check(ok: unknown, message: string): asserts ok {if (!ok) throw Error(message);}
function equal(a: unknown, b: unknown, path = 'value'): void {
  if (Object.is(a, b)) return;
  check(a !== null && b !== null && typeof a === 'object' && typeof b === 'object', path + ' differs');
  const keys = Object.keys(a), other = Object.keys(b);
  check(keys.length === other.length && keys.every(key => other.includes(key)), path + ' keys differ');
  for (const key of keys) equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], path + '.' + key);
}
/** Pass the existing small native-scene-document-v0 fixture; no browser or renderer involved. */
export function runNativeDirectionalLightDocumentFlow(text: string) {
  let refusals = 0, admissions = 0, getterCalls = 0;
  function refuses(operation: () => unknown, label: string, code?: string): void {
    try {operation();} catch (error) {
      check(error instanceof RenderEditorError, label + ' did not return RenderEditorError');
      if (code) check(error.code === code, label + ' wrong code: ' + error.code);
      refusals++; return;
    }
    throw Error('Expected refusal: ' + label);
  }
  const raw = JSON.parse(text) as RenderNativeSceneDocument;
  check(raw.surfaceMaterials.length === 2, 'Fixture needs two qualified material bindings.');
  const seed = {...raw, revision: -0, display: {...raw.display,
    lighting: {ambientStrength: -0, directionalStrength: -0, direction: [2, -0, -4]}},
    surfaceMaterials: raw.surfaceMaterials.map((item, index) => ({...item, material: {...item.material,
      uniforms: index === 0 ? {edge: -0} : item.material.uniforms}}))} as RenderNativeSceneDocument;
  const before = structuredClone(seed), upgraded = upgradeRenderNativeSceneToDirectionalLights(seed);
  admissions++;
  equal(seed, before, 'Upgrade caller retention');
  equal(upgraded.lights.lights[0], {nodeId: 'legacy-directional', label: 'Legacy directional', enabled: true,
    directionScene: [2, -0, -4], colorLinearRGB: [1, 1, 1], intensity: -0}, 'Upgrade original light');
  check(Object.is(upgraded.lights.ambientStrength, -0) && Object.is(upgraded.revision, -0)
    && Object.is(upgraded.lights.revision, -0), 'Upgrade signed metadata/ambient lost');
  check(!Object.hasOwn(upgraded.display, 'lighting'), 'Singleton leaked into new display');
  equal(upgraded.nativeDocument, seed.nativeDocument, 'Complete original native authority');
  equal(upgraded.surfaceMaterials, seed.surfaceMaterials, 'Material authority');
  const {lighting: ignored, ...display} = seed.display; void ignored;
  equal(upgraded.display, display, 'Camera pose visibility authority');
  const light = upgraded.lights.lights[0];
  const second = {...light, nodeId: 'fill', label: '蓝 fill', enabled: false, directionScene: [-3, 5, -0] as [number, number, number],
    colorLinearRGB: [.2, .4, 1] as [number, number, number], intensity: .75};
  const document = prepareRenderNativeDirectionalLightDocument({...upgraded,
    lights: {...upgraded.lights, ambientStrength: .2, lights: [light, second]}}).document;
  admissions++;
  const wire = serializeRenderNativeDirectionalLightDocument(document), parsed = parseRenderNativeDirectionalLightDocument(wire);
  equal(parsed, document, 'Complete signed canonical roundtrip'); admissions++;
  check(serializeRenderNativeDirectionalLightDocument(parsed) === wire, 'Canonical output not stable');
  check(parsed.nativeDocument.assets[0].source === raw.nativeDocument.assets[0].source
    && parsed.surfaceMaterials[0].material.shaderSource === raw.surfaceMaterials[0].material.shaderSource
    && !Object.hasOwn(parsed.surfaceMaterials[0].material.uniforms, 'amount')
    && Object.is(parsed.surfaceMaterials[0].material.uniforms.edge, -0), 'Source/override omission changed');
  check(Object.isFrozen(parsed) && Object.isFrozen(parsed.lights.lights[1].directionScene)
    && Object.isFrozen(parsed.nativeDocument.assets), 'Output must be deeply immutable');
  const mutable = structuredClone(document), isolated = prepareRenderNativeDirectionalLightDocument(mutable).document;
  mutable.lights.lights[0].directionScene[0] = 42;
  check(isolated.lights.lights[0].directionScene[0] === 2, 'Output aliases caller data'); admissions++;
  const request = createRenderNativeDirectionalLightRequest(parsed);
  equal(request.owner, {id: parsed.documentId, revision: -0}, 'Viewer owner');
  equal(request.lights, parsed.lights, 'Viewer original catalog');
  check(!Object.hasOwn(request, 'appearance') && !Object.hasOwn(request, 'lighting'), 'Singleton appeared in Viewer input');
  check(request.source.kind === 'document', 'Real original document source required');
  equal(request.source.result.document, parsed.nativeDocument, 'Viewer original document');
  equal(request.source.options, parsed.nativeOptions, 'Viewer native options');
  check(request.source.bindings.length === 2 && request.materials.length === 2, 'Full inventory/materials required');
  request.materials.forEach((material, index) => {
    const authored = parsed.surfaceMaterials[index];
    equal(material.binding.uniforms, authored.material.uniforms, 'Raw supplied override map');
    check(material.binding.material.source === authored.material.shaderSource, 'Material compiler lost authored source');
    check(material.ref.surfaceId === authored.target.geometryId
      && material.ref.modelId === authored.target.assetId.replaceAll('-', '.'), 'Full material ref pairing changed');
    const binding = request.source.bindings[index];
    for (const [key, value] of Object.entries(authored.target))
      equal(binding[key as keyof typeof binding], value, 'TEN ' + key);
  });
  check(request.materials[0].ref.surfaceId === request.materials[1].ref.surfaceId
    && request.materials[0].ref.modelId !== request.materials[1].ref.modelId, 'Fixture must test shared geometry IDs across assets');
  equal(request.display.camera, parsed.display.camera, 'Viewer camera');
  check(request.display.motion !== null && request.display.motion !== undefined, 'Complete posed request required');
  const motion = request.display.motion;
  parsed.display.poses.forEach((pose, index) => {
    equal(motion.frame.poses[index], {targetId: 'body:' + pose.bodyId, translation: pose.translationMM, rotation: pose.rotationXYZW, scale: pose.scale}, 'Viewer original pose');
  });
  request.source.bindings.forEach(binding => {
    check(binding.nativeFrame === parsed.nativeDocument.nativeFrame && binding.sourceFrame === parsed.nativeDocument.assets.find(asset => asset.id === binding.assetId)?.sourceFrame
      && binding.geometryKind === 'surface', 'Remaining TEN frame/kind fields differ');
  });
  equal(request.context, {mmToSceneUnit: parsed.display.mmToSceneUnit, background: parsed.display.background}, 'Viewer scale/background');
  check(Object.isFrozen(request.source) && Object.isFrozen(request.lights), 'Request must own immutable values'); admissions++;
  for (const count of [0, 4]) {
    const next = {...document, lights: {...document.lights,
      lights: Array.from({length: count}, (_, index) => ({...light, nodeId: 'light-' + index}))}};
    const result = parseRenderNativeDirectionalLightDocument(serializeRenderNativeDirectionalLightDocument(next));
    check(result.lights.lights.length === count, 'Catalog count changed');
    check(prepareNativeDirectionalLights(result.lights).catalog.lights.length === count, 'Actual catalog refused supported count'); admissions++;
  }
  const invalid = [
    {...document, revision: 0}, {...document, lights: {...document.lights, sourceId: 'another'}},
    {...document, lights: {...document.lights, revision: 0}},
    {...document, lights: {...document.lights, lights: [light, {...light}]}},
    {...document, lights: {...document.lights, lights: [{...light, directionScene: [0, -0, 0]}]}},
    {...document, lights: {...document.lights, lights: [{...light, directionScene: [1001, 0, 1]}]}},
    {...document, lights: {...document.lights, lights: [{...light, intensity: 1.1}]}},
    {...document, lights: {...document.lights, lights: [{...light, colorLinearRGB: [-.1, 0, 1]}]}},
    {...document, lights: {...document.lights, ambientStrength: -1}},
    {...document, lights: {...document.lights, lights: [{...light, enabled: 1}]}},
    {...document, display: {...document.display, lighting: raw.display.lighting}},
    {...document, display: {...document.display, visibleBodyIds: []}, surfaceMaterials: []},
    {...document, unexpected: true}, {...document, revision: Infinity}, {...document, title: ''},
  ];
  for (const input of invalid) refuses(() => prepareRenderNativeDirectionalLightDocument(input), 'invalid authored input', 'DOCUMENT_INPUT');
  for (const input of [{...document, version: 2}, {...document, profile: 'future'},
    {...document, lights: {...document.lights, version: 1}}, {...document, lights: {...document.lights, profile: 'future'}}])
    refuses(() => prepareRenderNativeDirectionalLightDocument(input), 'version boundary', 'DOCUMENT_VERSION');
  refuses(() => parseRenderNativeDirectionalLightDocument(text), 'No automatic legacy migration', 'DOCUMENT_VERSION');
  refuses(() => parseRenderNativeSceneDocument(wire), 'Legacy parser unchanged');
  refuses(() => parseRenderNativeDirectionalLightDocument('{bad'), 'Malformed JSON', 'DOCUMENT_INPUT');
  refuses(() => parseRenderNativeDirectionalLightDocument(' '.repeat(2097153)), 'UTF16 text budget', 'DOCUMENT_BYTES');
  refuses(() => parseRenderNativeDirectionalLightDocument('é'.repeat(1048577)), 'UTF8 text budget', 'DOCUMENT_BYTES');
  refuses(() => prepareRenderNativeDirectionalLightDocument({...document, title: '\u0001'.repeat(400000)}), 'Escaped output charged first', 'DOCUMENT_BYTES');
  const getter = Object.defineProperty({...document}, 'title', {enumerable: true, get() {getterCalls++; return 'unsafe';}});
  refuses(() => prepareRenderNativeDirectionalLightDocument(getter), 'Getter refusal', 'DOCUMENT_INPUT');
  refuses(() => prepareRenderNativeDirectionalLightDocument({...document, [Symbol('extra')]: 1}), 'Symbol refusal', 'DOCUMENT_INPUT');
  refuses(() => prepareRenderNativeDirectionalLightDocument(Object.defineProperty({...document}, 'hidden', {value: 1})), 'Hidden refusal', 'DOCUMENT_INPUT');
  const cyclic: Record<string, unknown> = {...document}; cyclic.title = cyclic;
  refuses(() => prepareRenderNativeDirectionalLightDocument(cyclic), 'Cycle refusal', 'DOCUMENT_INPUT');
  refuses(() => prepareRenderNativeDirectionalLightDocument({...document, lights: {...document.lights, lights: new Array(2)}}), 'Sparse refusal', 'DOCUMENT_INPUT');
  const large = new Proxy(new Array(5), {ownKeys() {getterCalls++; throw Error('Count must precede reflection');}});
  for (const input of [{...document, lights: {...document.lights, lights: large}}, {...document, surfaceMaterials: large},
    {...document, display: {...document.display, visibleBodyIds: large}}, {...document, display: {...document.display, poses: large}},
    {...document, nativeOptions: {...document.nativeOptions, bodyIds: large}}])
    refuses(() => prepareRenderNativeDirectionalLightDocument(input), 'Outer cardinality before contents', 'DOCUMENT_INPUT');
  check(getterCalls === 0, 'Rejected input executed accessors or visited oversized array keys');
  let nested: unknown = null; for (let depth = 0; depth < 26; depth++) nested = {child: nested};
  refuses(() => prepareRenderNativeDirectionalLightDocument({...document, extra: nested}), 'Depth preflight', 'DOCUMENT_INPUT');
  refuses(() => prepareRenderNativeDirectionalLightDocument({...document, extra: new Array(65).fill(0)}), 'Generic array limit', 'DOCUMENT_INPUT');
  const many = Object.fromEntries(Array.from({length: 33}, (_, index) => ['field' + index, index]));
  refuses(() => prepareRenderNativeDirectionalLightDocument({...document, extra: many}), 'Record field limit', 'DOCUMENT_INPUT');
  const thrown = new Error('Reflection sentinel');
  try {prepareRenderNativeDirectionalLightDocument(new Proxy({}, {getPrototypeOf() {throw thrown;}})); throw Error('Expected reflection refusal');}
  catch (error) {check(error instanceof RenderEditorError && error.cause === thrown, 'Reflection cause not retained'); refusals++;}
  for (const cause of [undefined, new RenderEditorError('DISPOSED', 'Foreign error'),
    new Proxy({}, {getOwnPropertyDescriptor() {throw Error('Must not inspect hostile thrown values');}, getPrototypeOf() {throw Error('Must not inspect thrown prototypes');}})]) {
    try {prepareRenderNativeDirectionalLightDocument(new Proxy(document, {ownKeys() {throw cause;}})); throw Error('Expected ownKeys refusal');}
    catch (error) {check(error instanceof RenderEditorError && error.code === 'DOCUMENT_INPUT' && Object.hasOwn(error, 'cause') && error.cause === cause,
      'Foreign reflection failure escaped or changed classification/cause'); refusals++;}
  }
  const curve = {...document, nativeOptions: {...document.nativeOptions, bodyIds: ['body_0_curve']}, surfaceMaterials: [],
    display: {...document.display, visibleBodyIds: ['body_0_curve'], poses: []}};
  refuses(() => prepareRenderNativeDirectionalLightDocument(curve), 'Curve inventory refusal');
  const invalidUpgrade = {...seed, display: {...seed.display, lighting: {...seed.display.lighting, direction: [0, 0, 0]}}} as RenderNativeSceneDocument;
  refuses(() => upgradeRenderNativeSceneToDirectionalLights(invalidUpgrade), 'Unsupported legacy direction refusal');
  equal(document, parsed, 'All refusals retain existing authority');
  return {scope: 'CPU canonical persistence and real source/TEN request mapping; no renderer, browser or physical file acceptance',
    admissions, refusals, bytes: new TextEncoder().encode(wire).length, wire,
    document: parsed as RenderNativeDirectionalLightDocumentV1, request};
}
