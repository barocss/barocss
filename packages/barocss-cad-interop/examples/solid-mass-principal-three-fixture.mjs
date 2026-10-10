import { measureAxisBoxSolidBooleanMass, validateAxisBoxSolidBooleanMass, analyzeAxisBoxSolidPrincipalInertia, validateAxisBoxSolidPrincipalInertia, validateAxisBoxSolidBoolean, compileCadModel } from '@barocss/cad';

export const GEOMETRY_KEYS = Object.freeze(['rect', 'disjoint', 'cube', 'empty']);
export const CASE_KEYS = Object.freeze(['analytical_box_zero_rotations', 'disconnected_total_parallel_axis', 'disconnected_body_0', 'disconnected_body_1', 'isotropic_cube_nonunique_axes', 'empty_total_no_axes']);
export const PINS = Object.freeze([
  {
    "file": "a.six-manual-supports-whole.source0.css",
    "bytes": 1207,
    "sha256": "b8736a9617d754497fc04be98f4192ad6102990323d15e3e7592eca9ea7dfe58"
  },
  {
    "file": "analytical_box_zero_rotations.authored-principal-request.json",
    "bytes": 112443,
    "sha256": "ad3ebbc4966b72a4222b9128682dedd97e41de7b5230222070079bbf233ab6a8"
  },
  {
    "file": "analytical_box_zero_rotations.owned-principal.json",
    "bytes": 118966,
    "sha256": "8dee487c5e36acc6f5e82704bb22b1ba4f952bb5af9b2281c9a47a7cf7592ead"
  },
  {
    "file": "cube.actual-boolean.json",
    "bytes": 100422,
    "sha256": "8687dd6efda74bcc2e15fb9dc019707c3cb721bbd8aa32b677dd77729da4229e"
  },
  {
    "file": "cube.actual-panel_0.source0.css",
    "bytes": 672,
    "sha256": "7114a2ab8a39c283ac4cb544d2210186918596c01c8325f2ca35977c836b2a75"
  },
  {
    "file": "cube.actual-panel_1.source0.css",
    "bytes": 672,
    "sha256": "28bfa642bc85ba81fa7067a565d6a0bad2ad11b938ec35ccf4e5f5203a1182b5"
  },
  {
    "file": "cube.actual-panel_2.source0.css",
    "bytes": 672,
    "sha256": "2b4086c1d3313c1ecc2c5f5e108df2cdbce7d7fa5f0754f5f5b371a2acae43fc"
  },
  {
    "file": "cube.actual-panel_3.source0.css",
    "bytes": 672,
    "sha256": "0de139f8404a2a8bf7f8c5f3a6b114182fc2d3c44e91126de84623f3d9691c39"
  },
  {
    "file": "cube.actual-panel_4.source0.css",
    "bytes": 672,
    "sha256": "29068d22fa80ed3dc5376451453bd7dea58512bbfb6999eaf817562b9b7d9029"
  },
  {
    "file": "cube.actual-panel_5.source0.css",
    "bytes": 672,
    "sha256": "93620933196d2501b99d4605179687bad8b93a60a831a4c5486eac75ab528304"
  },
  {
    "file": "cube.authored-boolean-request.json",
    "bytes": 33739,
    "sha256": "d5ede7d100e977f2642100fcd83a9af07d537db0cbf479e729e549c874163d7f"
  },
  {
    "file": "cube_a.six-manual-supports-whole.source0.css",
    "bytes": 1207,
    "sha256": "63708174fe748871ef00273df13d7aba39024eef4125a74a1d44ee33721b04e5"
  },
  {
    "file": "cube_b.six-manual-supports-whole.source0.css",
    "bytes": 1207,
    "sha256": "63708174fe748871ef00273df13d7aba39024eef4125a74a1d44ee33721b04e5"
  },
  {
    "file": "disconnected_body_0.authored-principal-request.json",
    "bytes": 182628,
    "sha256": "706ff80ea373e4d244e0f8871f3b84d6103d19e6c00b81b96e54ca60fb1b181f"
  },
  {
    "file": "disconnected_body_0.owned-principal.json",
    "bytes": 189725,
    "sha256": "f555c0dcff130d26fb822f693203c5ed45a0d9e397ccb8ede59f00ccc4657106"
  },
  {
    "file": "disconnected_body_1.authored-principal-request.json",
    "bytes": 182628,
    "sha256": "ad6b09c821c146afe9437bb862b704500bf8d5a06841f57b53bc63e76bcf4e78"
  },
  {
    "file": "disconnected_body_1.owned-principal.json",
    "bytes": 189745,
    "sha256": "e887021990bd530a694b357d35cc04442b9eb57965bf53012c6d39cb3a7ad730"
  },
  {
    "file": "disconnected_total_parallel_axis.authored-principal-request.json",
    "bytes": 182604,
    "sha256": "d3e10e94a76260f0659617074c68f3350287c711ec52794c1c6786c5b5083d9e"
  },
  {
    "file": "disconnected_total_parallel_axis.owned-principal.json",
    "bytes": 192929,
    "sha256": "c088d3a8d0ddd99079bbf259c078a9d8e4b43a4ec27c172161ea2d707cb48994"
  },
  {
    "file": "disjoint.actual-boolean.json",
    "bytes": 166812,
    "sha256": "72cc1973c8710ac2285eb6c30204423655f83859d61aff15591a10754a4d5fae"
  },
  {
    "file": "disjoint.actual-panel_0.source0.css",
    "bytes": 692,
    "sha256": "908775f3e5a5c4073dcb9eb6050b667f0a4bcdaac6fd98ea283a4ce50e990cfc"
  },
  {
    "file": "disjoint.actual-panel_1.source0.css",
    "bytes": 692,
    "sha256": "1054cdff003052d7924bc32f3ffe7eeb75f5fbd609e060a0cd897c999e8d8daf"
  },
  {
    "file": "disjoint.actual-panel_10.source0.css",
    "bytes": 709,
    "sha256": "08bda1a68273367078fe53a2417a66030e4c70770506ad3fa5fb995d826de5de"
  },
  {
    "file": "disjoint.actual-panel_11.source0.css",
    "bytes": 721,
    "sha256": "689c56f4fa6823aa8038e19a5294a86ac89b6d454f260e19c88d1678425a4911"
  },
  {
    "file": "disjoint.actual-panel_2.source0.css",
    "bytes": 692,
    "sha256": "8346f535aa111cdf4e9f651d480ac85dfa16a1d0ed8594737774a1076dbf824d"
  },
  {
    "file": "disjoint.actual-panel_3.source0.css",
    "bytes": 692,
    "sha256": "18ecd4af3d15b6a68f3993154feff62533526981c6685ae1376ebd26489b3406"
  },
  {
    "file": "disjoint.actual-panel_4.source0.css",
    "bytes": 692,
    "sha256": "f12784b98001ae31b765659a2d90b24dff2ea61d300356ff24a5a6d423d7f19d"
  },
  {
    "file": "disjoint.actual-panel_5.source0.css",
    "bytes": 692,
    "sha256": "5fd3c6fa015f6efe093bbb38a1499f9f4f49221ab844cab22246c17a94f39204"
  },
  {
    "file": "disjoint.actual-panel_6.source0.css",
    "bytes": 704,
    "sha256": "43bf5da9ada99a6def525b95a7f9dccc889d0a69701261aec89bbaebbcac49c8"
  },
  {
    "file": "disjoint.actual-panel_7.source0.css",
    "bytes": 716,
    "sha256": "e88e9536a8bce5f3b15f2f5780047983c35c100cb57aeeac5ced2ec186bd9864"
  },
  {
    "file": "disjoint.actual-panel_8.source0.css",
    "bytes": 704,
    "sha256": "e9e4f7b9674a1c813d89c6232557cd4c9d5252ddfd95be607265c8e5bb1657fc"
  },
  {
    "file": "disjoint.actual-panel_9.source0.css",
    "bytes": 716,
    "sha256": "4c6d8ac4b8234e00f9fc303cdb933cba275ea9dabbda031531c8f4febb6e1a0f"
  },
  {
    "file": "disjoint.authored-boolean-request.json",
    "bytes": 33934,
    "sha256": "7f3ddceb2901715746f1c6b1b07da5569b9ef7f34c4ac68745fb0b09857beb69"
  },
  {
    "file": "empty.actual-boolean.json",
    "bytes": 40542,
    "sha256": "6fb29a0951c0f3d43894d15c9130d9665a259fdd4aa94fe96be4c3789fade2bf"
  },
  {
    "file": "empty.authored-boolean-request.json",
    "bytes": 33739,
    "sha256": "c5bf9b85804b69e89f9f1aca85b1dec5a9ce198657d8e3199569abfbf22f25d3"
  },
  {
    "file": "empty_total_no_axes.authored-principal-request.json",
    "bytes": 44431,
    "sha256": "7d1d24f7ff908a3bb74d383b3a02fed06e36033a9aeda031d9e9512e14465126"
  },
  {
    "file": "empty_total_no_axes.owned-principal.json",
    "bytes": 47976,
    "sha256": "58a0740e2b3317106ec4d01271cb5c2550e491de8f70ba62e60ecac6e202bfb8"
  },
  {
    "file": "isotropic_cube_nonunique_axes.authored-principal-request.json",
    "bytes": 110911,
    "sha256": "85bf842bd88a1bbeae1e58e84999d41e02ccc35565de8c88adaa86a3def1e791"
  },
  {
    "file": "isotropic_cube_nonunique_axes.owned-principal.json",
    "bytes": 117633,
    "sha256": "80f83abd5b3fafc900d24c9bd73f71f1cd674117920248b3a5d4326060b8aa80"
  },
  {
    "file": "rect.actual-boolean.json",
    "bytes": 102056,
    "sha256": "6ea6afcffb9eed5d0038ebda2d25dcea43d0332417c55702019a202624a27823"
  },
  {
    "file": "rect.actual-panel_0.source0.css",
    "bytes": 684,
    "sha256": "675e88f4e50a18589a208fbdad493d236b12bc1da6fb0dc8b6572d42b6794ef4"
  },
  {
    "file": "rect.actual-panel_1.source0.css",
    "bytes": 696,
    "sha256": "3affd4fd2ae1126c0b1756affcf95837861526c9f02448026dd2fc5b62745cdc"
  },
  {
    "file": "rect.actual-panel_2.source0.css",
    "bytes": 684,
    "sha256": "eaf41baaf194156b5a5d1569061d911878e1f293ecbc5980be0bf0561b329209"
  },
  {
    "file": "rect.actual-panel_3.source0.css",
    "bytes": 696,
    "sha256": "ef6f88c8f5aa2ca26f97ed3c213f243c993ff8bbbadebbe7336d1bd20f482767"
  },
  {
    "file": "rect.actual-panel_4.source0.css",
    "bytes": 684,
    "sha256": "fc9b8c5537c66797dddd1e4d0dcde9f0e9480304597eb0f4463b4a88da3f38d4"
  },
  {
    "file": "rect.actual-panel_5.source0.css",
    "bytes": 696,
    "sha256": "5e49814f9572d4c6c1c29a603ca01467e9e37d93abd1fd35b2ec6cc118a522c8"
  },
  {
    "file": "rect.authored-boolean-request.json",
    "bytes": 34235,
    "sha256": "f0c144d454ac44f7009ce30a91d7fe7074aeb4a6d79c9a65dcb60eec3dfc6247"
  },
  {
    "file": "rect_a.six-manual-supports-whole.source0.css",
    "bytes": 1255,
    "sha256": "9275ff7ddceb6abc0fee99ffab2fa96d6e80d43370accd1fcdaf3321237d029e"
  },
  {
    "file": "rect_b.six-manual-supports-whole.source0.css",
    "bytes": 1255,
    "sha256": "9275ff7ddceb6abc0fee99ffab2fa96d6e80d43370accd1fcdaf3321237d029e"
  },
  {
    "file": "remote.six-manual-supports-whole.source0.css",
    "bytes": 1243,
    "sha256": "0e9b6f3819bfdae84785f41b176e05dfb492a7f125d140d8e2f25c2f85352304"
  },
  {
    "file": "same.six-manual-supports-whole.source0.css",
    "bytes": 1207,
    "sha256": "b8736a9617d754497fc04be98f4192ad6102990323d15e3e7592eca9ea7dfe58"
  }
]);

export const DEFAULT_CASES = Object.freeze({ rect: CASE_KEYS[0], disjoint: CASE_KEYS[1], cube: CASE_KEYS[4], empty: CASE_KEYS[5] });
const GEOMETRY_CASES = { rect: [CASE_KEYS[0]], disjoint: CASE_KEYS.slice(1, 4), cube: [CASE_KEYS[4]], empty: [CASE_KEYS[5]] };
const OPERANDS = { rect: ['rect_a.six-manual-supports-whole.source0.css', 'rect_b.six-manual-supports-whole.source0.css'],
  disjoint: ['a.six-manual-supports-whole.source0.css', 'remote.six-manual-supports-whole.source0.css'],
  cube: ['cube_a.six-manual-supports-whole.source0.css', 'cube_b.six-manual-supports-whole.source0.css'],
  empty: ['a.six-manual-supports-whole.source0.css', 'same.six-manual-supports-whole.source0.css'] };
const PANEL_COUNTS = { rect: 6, disjoint: 12, cube: 6, empty: 0 };
export function requireFact(value, message) { if (!value) throw new Error(message); }
export function sameNative(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => sameNative(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameNative(a[key], b[key]));
  }
  return Object.is(a, b);
}
export function assertNative(a, b, label) { requireFact(sameNative(a, b), label); }
export function assertBuffer(a, b, label) { requireFact(a?.length === b?.length && Array.from(a).every((value, index) => Object.is(value, b[index])), label); }
export function createNativeOptions() { return { sourceVersion: 0, countU: 2, countV: 2, unitsPerMillimeter: 0.001, nativeCapacity: { version: 1, maximumObjects: 16 } }; }
export function coldModel(source) {
  const result = compileCadModel(source, { sourceVersion: 0 });
  requireFact(result.ok, 'Actual complete original compiler refused: ' + JSON.stringify(result.diagnostics));
  return result.model;
}
export function panelQualification(boolean, panel) {
  const matches = boolean.shells.filter(shell => shell.panelIds.includes(panel.id));
  requireFact(matches.length === 1, 'Each panel must retain exactly one qualified Shell');
  const shell = matches[0], body = boolean.bodies.find(body => body.id === panel.bodyId);
  requireFact(body && body.shellIds.includes(shell.id) && shell.bodyId === body.id && shell.emptyRegionId === panel.emptyRegionId, 'Body/Shell/panel native binding changed');
  return { panelId: panel.id, sourceId: panel.sourceId, bodyId: body.id, shellId: shell.id,
    emptyRegionId: panel.emptyRegionId, shellRole: shell.role, localFaceId: panel.bundle.topology.face.id, surfaceId: panel.bundle.topology.face.surfaceId };
}
export async function loadGeometry(key, readText) {
  requireFact(GEOMETRY_KEYS.includes(key), 'Unknown whole property geometry family');
  const caseKeys = GEOMETRY_CASES[key];
  const pins = PINS.filter(pin => pin.file.startsWith(key + '.') || OPERANDS[key].includes(pin.file) || caseKeys.some(caseKey => pin.file.startsWith(caseKey + '.')));
  const originalTexts = new Map(await Promise.all(pins.map(async pin => {
    const text = await readText(pin.file); requireFact(typeof text === 'string', 'Expected original text');
    const bytes = new TextEncoder().encode(text); requireFact(bytes.length <= 2 * 1024 * 1024, 'Host per-file limit exceeded');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    requireFact(bytes.length === pin.bytes && sha256 === pin.sha256, 'Original property input bytes/hash changed: ' + pin.file);
    return [pin.file, text];
  })));
  const boolean = JSON.parse(originalTexts.get(key + '.actual-boolean.json'));
  const booleanRequest = JSON.parse(originalTexts.get(key + '.authored-boolean-request.json'));
  const principalInputsMap = new Map(caseKeys.map(caseKey => [caseKey, {
    request: JSON.parse(originalTexts.get(caseKey + '.authored-principal-request.json')),
    owned: JSON.parse(originalTexts.get(caseKey + '.owned-principal.json')),
  }]));
  const panelSourcesMap = new Map(boolean.panels.map((panel, index) => {
    const stored = boolean.sources.find(source => source.panelId === panel.id);
    requireFact(stored, 'Qualified full panel source absent');
    return [panel.id, { panelId: panel.id, sourceId: stored.sourceId,
      source: originalTexts.get(key + '.actual-panel_' + index + '.source0.css'), model: stored.model }];
  }));
  return { key, boolean, booleanRequest, panelSourcesMap,
    operandSources: OPERANDS[key].map(file => originalTexts.get(file)), principalInputsMap, originalTexts, pins };
}
export function proveGeometry(asset) {
  const saved = asset.principalInputsMap.get(DEFAULT_CASES[asset.key]);
  requireFact(saved, 'Original default principal case absent');
  assertNative(saved.request.mass.boolean, asset.boolean, 'Complete mass parent Boolean changed');
  assertNative(validateAxisBoxSolidBoolean(asset.boolean), asset.boolean.report, 'Whole Boolean validator differs');
  assertNative(asset.booleanRequest.a, asset.boolean.a, 'Whole original operand A changed');
  assertNative(asset.booleanRequest.b, asset.boolean.b, 'Whole original operand B changed');
  assertNative(asset.booleanRequest.options, asset.boolean.options, 'Original Boolean options changed');
  const mass = measureAxisBoxSolidBooleanMass(asset.boolean, saved.request.mass.options);
  assertNative(mass, saved.request.mass, 'Whole actual mass differs from saved full mass');
  assertNative(validateAxisBoxSolidBooleanMass(mass), mass.report, 'Whole mass validator differs');
  for (const input of asset.principalInputsMap.values()) {
    assertNative(input.request.mass, mass, 'Total/Body selection must retain the same complete mass parent');
    assertNative(input.owned.mass, mass, 'Whole owned principal mass parent changed');
  }
  const operandModels = asset.operandSources.map((source, index) => {
    requireFact(source === (index ? asset.boolean.b.source : asset.boolean.a.source), 'Complete operand source differs');
    const model = coldModel(source); requireFact(model.version === 0 && model.objects.length === 7, 'Expected complete original operand Model7/version0');
    assertNative(model, asset.boolean.originalModels[index], 'Whole original operand Model differs'); return model;
  });
  requireFact(asset.boolean.panels.length === PANEL_COUNTS[asset.key] && asset.panelSourcesMap.size === PANEL_COUNTS[asset.key], 'Complete original panel inventory changed');
  const panelModels = asset.boolean.panels.map(panel => {
    const actual = asset.panelSourcesMap.get(panel.id), stored = asset.boolean.sources.find(source => source.panelId === panel.id);
    requireFact(actual && actual.panelId === panel.id && actual.sourceId === panel.sourceId && actual.source === stored.source, 'Qualified full panel source changed');
    const model = coldModel(actual.source); assertNative(model, stored.model, 'Actual panel cold Model differs');
    assertNative(model, panel.bundle.geometry, 'Panel original FaceBundle geometry differs');
    requireFact(model.version === 0 && model.objects.length === 5 && model.objects.filter(object => object.kind === 'surface').length === 1 && model.objects.filter(object => object.kind === 'curve').length === 4, 'Complete panel must retain Surface and four native Curves');
    return { panelId: panel.id, sourceId: panel.sourceId, source: actual.source, model, qualification: panelQualification(asset.boolean, panel) };
  });
  return { boolean: asset.boolean, mass, operandModels, panelModels };
}
export function provePrincipal(asset, caseKey) {
  const input = asset.principalInputsMap.get(caseKey); requireFact(input, 'Principal selection must belong to complete current geometry');
  const requestBefore = structuredClone(input.request), ownedBefore = structuredClone(input.owned);
  assertNative(input.request.mass.boolean, asset.boolean, 'Principal full Boolean differs');
  const mass = measureAxisBoxSolidBooleanMass(asset.boolean, input.request.mass.options);
  assertNative(mass, input.request.mass, 'Principal reconstructed complete mass differs');
  assertNative(validateAxisBoxSolidBooleanMass(mass), mass.report, 'Principal mass whole validator differs');
  const result = analyzeAxisBoxSolidPrincipalInertia(mass, input.request.options);
  assertNative(result, input.owned, 'Actual complete principal result differs from saved original');
  assertNative(validateAxisBoxSolidPrincipalInertia(result), result.report, 'Principal whole validator differs');
  const selected = result.options.selection.kind === 'total' ? mass.total : mass.bodies.find(measure => measure.bodyId === result.options.selection.bodyId);
  assertNative(result.measure, selected, 'Selected complete measure binding differs');
  assertNative(result.measure.inertiaCentroidKgM2, result.report.inputTensorKgM2, 'Selected stored tensor authority differs');
  if (result.report.empty) {
    requireFact(result.measure.massKG === 0 && result.measure.centroidMM === null && result.measure.inertiaCentroidKgM2 === null && result.measure.positiveDefinite === null && result.principal === null && result.report.axesXYZ === null && result.report.axesUnique === null, 'Empty native null fields must remain null');
  } else {
    requireFact(result.measure.positiveDefinite !== null && result.principal !== null, 'Nonempty full PD/principal proof required');
    assertNative(result.principal.momentsKgM2, result.report.sortedMomentsKgM2, 'Sorted actual moments differ');
    assertNative(result.principal.axesXYZ, result.report.axesXYZ, 'Actual canonical axes differ');
  }
  assertNative(input.request, requestBefore, 'Original request mutated');
  assertNative(input.owned, ownedBefore, 'Original full principal file mutated');
  return result;
}
