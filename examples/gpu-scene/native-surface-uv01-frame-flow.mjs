/** #1569 ONE native frame source/emitted/API/original-file/cold acceptance.
 * node examples/gpu-scene/native-surface-uv01-frame-flow.mjs --output ABS_FRESH
 * CPU observations and prospective charges only; no browser, GPU, pixels or mocks.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';

assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]);
await mkdir(output, { recursive: false });
const parent = '69b70d24793a6ccc0b73f7543a7385e81c99ca64', pkg = resolve(repo, 'packages/barocss-gpu');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const gitFile = path => execFileSync('git', ['show', parent + ':' + path], { cwd: repo, encoding: 'utf8' });
const hash = value => createHash('sha256').update(value).digest('hex');
function signed(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return Array.isArray(value) || ArrayBuffer.isView(value) ? '[' + Array.from(value, signed).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}';
}
const clone = value => JSON.parse(signed(value));
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
function frozen(value, seen = new Set()) {
  if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); if (ArrayBuffer.isView(value)) return;
    assert.ok(Object.isFrozen(value)); Object.values(value).forEach(child => frozen(child, seen)); }
}
function refs(value, seen = new Set()) {
  if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); if (ArrayBuffer.isView(value)) seen.add(value.buffer);
    else Object.values(value).forEach(child => refs(child, seen)); } return seen;
}
function independent(a, b) { const right = refs(b); for (const object of refs(a)) assert.ok(!right.has(object), 'No caller/cross-call graph or buffer aliases'); }
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(name, text) { const path = resolve(output, name); await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const owned = ['packages/barocss-gpu/src/native/uv01/native-surface-uv01-frame.ts', 'packages/barocss-gpu/src/native/uv01/native-surface-uv01-frame-pack.ts', 'packages/barocss-gpu/src/index.ts', 'packages/barocss-gpu/README.md', 'examples/gpu-scene/native-surface-uv01-frame-flow.mjs'];
const delta = [...new Set([...git('diff', '--name-only', parent).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean))].sort();

const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const ordinary = resolve(output, 'ordinary-public.mjs');
const bundle = await build({ absWorkingDir: repo, alias: { '@barocss/cad': resolve(repo, 'packages/barocss-cad/src/index.ts') }, entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = [], physicalRepo = await realpath(repo);
for (const path of Object.keys(bundle.metafile.inputs).sort()) {
  const absolute = resolve(repo, path), bytes = await readFile(absolute), start = path.indexOf('packages/barocss-'), packagePath = start < 0 ? null : path.slice(start).replaceAll('\\', '/');
  if (packagePath !== null) { assert.ok(!/(?:^|\/)dist\//.test(packagePath)); assert.equal(relative(repo, absolute).replaceAll('\\', '/'), packagePath);
    assert.ok((await realpath(absolute)).startsWith(physicalRepo + sep)); }
  sourceGraph.push({ path, bytes: bytes.length, sha256: hash(bytes) });
}
for (const leaf of ['native-surface-uv01-frame.ts', 'native-surface-uv01-frame-pack.ts', 'native-surface-uv01-binding.ts', 'native-surface-uv01-program-wgsl.ts', 'primitive-frame-preflight.ts']) assert.ok(sourceGraph.some(row => (row.path.includes('/src/') && row.path.endsWith('/' + leaf))));
const parentBarrel = gitFile('packages/barocss-gpu/src/index.ts'), ast = ts.createSourceFile('parent.ts', parentBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = ast.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)).flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text));

const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const additions = ['prepareNativeSurfaceUV01Frame', 'NativeSurfaceUV01FrameError', 'NativeSurfaceUV01FrameDiagnosticCode'];
const namespace = Object.keys(providers[0].gpu).sort();
assert.ok(additions.every(x => namespace.includes(x))); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
const dts = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), leafDts = await readFile(resolve(pkg, 'dist/native-surface-uv01-frame.d.ts'), 'utf8');
for (const name of [...additions, 'NativeSurfaceUV01FrameRequest', 'NativeSurfaceUV01FrameEntry', 'NativeSurfaceUV01FrameOptions', 'NativeSurfaceUV01FrameDraw', 'NativeSurfaceUV01FrameResources', 'PreparedNativeSurfaceUV01Frame']) {
  assert.ok(new RegExp('\\b' + name + '\\b').test(dts), name); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDts), name);
}
const fixturePath = 'examples/gpu-scene/fixtures/area-revision1.cad-document.json';
const fixtureText = await readFile(resolve(repo, fixturePath), 'utf8'); assert.equal(fixtureText, gitFile(fixturePath));
const sourceA = JSON.parse(fixtureText).assets[0].source;
assert.equal(hash(sourceA), '56985f37e763f01325ac7e91ba2cf251accfa92efad9e5200b8619dc58545dc8');
const sourceB = '@model tilted_original { version:0; length-unit:mm;\n@curve #retained_sibling { type:nurbs; degree:1; knots:[-0,-0,1,1]; control-points:[[-0,0,-0],[1,0,-0]]; weights:[1,1]; }\n@surface #plane_nonunit { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[3,3,11,11]; control-points:[[[0,0,0],[0,3,1]],[[2,0,1],[2,3,2]]]; weights:[[1,1],[1,1]]; }\n}\n';
const sourceEdited = sourceA.replace('knots-u:[-3,-3,7,7]', 'knots-u:[-5,-5,5,5]').replace('[[2,0,-0],[2,3,-0]]', '[[4,0,-0],[4,3,-0]]');
assert.notEqual(sourceEdited, sourceA);
const materialSources = [
  '// Original A é\r\n@shader #native_A { @uniform zeta:float(0,1,.25); @uniform alpha:float(-0,1,-0); @fragment { color:mix(#000,#fff,(surface_u01*zeta+surface_v01*alpha)*.5); } }\r\n',
  '// Original B\n@shader #native_B { @uniform zeta:float(0,1,.5); @uniform alpha:float(-0,1,-0); @fragment { color:mix(#000,#fff,(surface_v01*zeta+surface_u01*alpha)*.5); } }\n',
];
const width = 320, height = 180;
const geometry = source => ({ format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0, source, surfaceId: 'plane_nonunit', countU: 5, countV: 3, revision: 7 });
const options = { mmToSceneUnit: .125, translate: [1, -2, .5], background: [.1, .2, .3], camera: { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 2, 0], fovYDegrees: 60, near: .1, far: 100 }, lighting: { direction: [2, -3, 6], ambientStrength: .2, directionalStrength: .6 } };
const transforms = [{ translationMm: [4, -2, 8], rotationXYZW: [0, 0, 1, 0], scale: [2, 3, 4] }, { translationMm: [-4, 2, -8], rotationXYZW: [1, 0, 0, 0], scale: [2, 3, 4] }];
const indices = []; for (let u = 0; u < 4; u++) for (let v = 0; v < 2; v++) { const a = u * 3 + v, b = a + 3; indices.push(a, b, a + 1, b, b + 1, a + 1); }
function f32Bytes(values) { const bytes = new Uint8Array(values.length * 4), view = new DataView(bytes.buffer); values.forEach((value, index) => view.setFloat32(index * 4, value, true)); return bytes; }
function close(actual, expected, label) { assert.equal(actual.length, expected.length, label); actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= 1e-6 * Math.max(1, Math.abs(expected[index])), label + ':' + index)); }
function verify(result, input, variant) {
  keys(result, ['format', 'version', 'profile', 'request', 'bindings', 'frame', 'draws', 'resources', 'viewport']);
  assert.equal(result.format, 'barocss-gpu-native-surface-uv01-frame'); assert.equal(result.version, 0); assert.equal(result.profile, 'source0-native-surface-uv01-frame-v0');
  assert.equal(signed(result.request), signed(input)); assert.deepEqual(result.viewport, { width, height }); frozen(result); independent(result, input);
  assert.equal(result.frame.profile, 'qualified-v2'); assert.equal(result.frame.frame.version, 0); assert.equal(result.frame.frame.scene.version, 2);
  assert.equal(result.frame.frame.particles, null); assert.deepEqual(result.frame.frame.materials, []); assert.equal(result.draws.length, 2);
  const buffers = new Set(); let geometryBytes = 0, uniformBytes = 0;
  const register = array => { assert.ok(ArrayBuffer.isView(array)); assert.ok(!buffers.has(array.buffer), 'Independent mutable views across entries and representations'); buffers.add(array.buffer); };
  for (let i = 0; i < 2; i++) {
    const entry = input.entries[i], binding = result.bindings[i], g = binding.geometry, packet = g.preview.packet, primitive = result.frame.primitives[i], draw = result.draws[i];
    const expectedDomain = i ? { u: [-2, 6], v: [3, 11] } : variant === 'source-edit' ? { u: [-5, 5], v: [2, 5] } : { u: [-3, 7], v: [2, 5] };
    assert.deepEqual(g.request, entry.geometry); assert.deepEqual(g.domain, expectedDomain); assert.equal(g.model.name, i ? 'tilted_original' : 'plane_original');
    assert.notEqual(entry.ref.modelId, g.model.name); assert.equal(g.selectedObjectIndex, i ? 1 : 0);
    if (i) { assert.equal(g.model.objects[0].id, 'retained_sibling'); assert.ok(Object.is(g.model.objects[0].controlPoints[0][0], -0)); }
    assert.equal(packet.surfaceId, 'plane_nonunit'); assert.equal(packet.revision, 7); assert.equal(packet.lengthUnit, 'mm');
    const raw = [], uv = [], native = [], world = [], worldNormals = [];
    const sizeX = !i && variant === 'source-edit' ? 4 : 2;
    const unnormalized = i ? [-3 / 2, 2 / 3, -6 / 4] : [0, 0, 1], normalLength = Math.hypot(...unnormalized);
    for (let u = 0; u < 5; u++) for (let v = 0; v < 3; v++) {
      const U = u / 4, V = v / 2, p = [sizeX * U, 3 * V, i ? U + V : 0]; native.push(...p);
      raw.push(expectedDomain.u[0] + U * (expectedDomain.u[1] - expectedDomain.u[0]), expectedDomain.v[0] + V * (expectedDomain.v[1] - expectedDomain.v[0])); uv.push(U, V);
      const rotated = i ? [p[0] * 2, -p[1] * 3, -p[2] * 4] : [-p[0] * 2, -p[1] * 3, p[2] * 4];
      world.push(...rotated.map((n, axis) => .125 * (transforms[i].translationMm[axis] + n) + options.translate[axis]));
      worldNormals.push(...unnormalized.map(n => n / normalLength));
    }
    assert.deepEqual(packet.parameters, raw); close(packet.positions, native, 'authentic native points'); assert.deepEqual(g.normalizedParameters, uv); assert.deepEqual(Array.from(g.uv01), uv);
    assert.deepEqual(packet.indices, indices); assert.deepEqual(primitive.entry.packet, packet); assert.deepEqual(primitive.entry.ref, entry.ref); assert.deepEqual(primitive.entry.color, [1, 1, 1]);
    assert.deepEqual(primitive.entry.transform, entry.transform); close(Array.from(primitive.positions), world.map(Math.fround), 'once-mm posed points'); close(Array.from(primitive.normals), worldNormals.map(Math.fround), 'inverse-transpose normalized normals');
    assert.deepEqual(Array.from(primitive.indices), indices); register(g.uv01); register(primitive.positions); register(primitive.normals); register(primitive.indices);
    keys(draw, ['ref', 'identity', 'program', 'indexCount', 'positions', 'normals', 'indices', 'uv01', 'uniforms']); assert.deepEqual(draw.ref, entry.ref); assert.equal(draw.identity, i + 1); assert.equal(draw.indexCount, indices.length);
    for (const name of ['positions', 'normals', 'indices', 'uv01']) { assert.ok(draw[name] instanceof Uint8Array); register(draw[name]); geometryBytes += draw[name].byteLength; }
    assert.deepEqual(draw.positions, f32Bytes(world)); assert.deepEqual(draw.normals, f32Bytes(worldNormals)); assert.deepEqual(draw.uv01, f32Bytes(uv));
    const indexView = new DataView(draw.indices.buffer, draw.indices.byteOffset, draw.indices.byteLength); assert.equal(draw.indices.byteLength, Math.ceil(indices.length * 2 / 4) * 4);
    indices.forEach((n, j) => assert.equal(indexView.getUint16(j * 2, true), n)); for (let j = indices.length * 2; j < draw.indices.length; j++) assert.equal(draw.indices[j], 0);
    const program = draw.program; assert.equal(program.profile, 'native-surface-opaque-uv01-program-wgsl-v0'); assert.equal(program.lowered.material.source, entry.material.source);
    assert.deepEqual(program.lowered.material, binding.material); assert.equal(program.abi.frame.byteLength, 160); assert.equal(program.abi.material.byteLength, 64); assert.equal(program.abi.draw.byteLength, 16);
    assert.deepEqual(program.entryPoints, { vertex: 'native_surface_uv01_vertex', fragment: 'native_surface_uv01_fragment' });
    assert.deepEqual(program.targets.map(t => t.format), ['rgba8unorm', 'r32uint']);
    const code = program.code.replace(/\s+/g, ''); for (const text of ['frameParams.projection*frameParams.view*vec4<f32>(position,1.0)', 'output.uv01=uv01;', 'output.normal=normal;', '(clip.z+clip.w)*0.5', 'output.identity=drawParams.identity.x;']) assert.ok(code.includes(text));
    assert.ok(!/textureSample|worldMatrix|mmToScene/.test(code)); assert.ok(binding.lowered.inputDeclarations.includes('v_native_surface_uv01'));
    keys(draw.uniforms, ['frame', 'material', 'draw']); const expected = { frame: new Uint8Array(160), material: new Uint8Array(64), draw: new Uint8Array(16) };
    const frameView = new DataView(expected.frame.buffer), focal = 1 / Math.tan(Math.PI / 6), near = .1, far = 100;
    const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0, -0, -6, 1];
    const projection = [focal / (width / height), 0, 0, 0, 0, focal, 0, 0, 0, 0, -(far + near) / (far - near), -1, 0, 0, -2 * far * near / (far - near), 0];
    [...view, ...projection, 2 / 7, -3 / 7, 6 / 7, .6, 0, 0, 0, .2].forEach((n, j) => frameView.setFloat32(j * 4, n, true));
    assert.deepEqual(program.lowered.uniformLayout.map(u => [u.name, u.byteOffset]), [['zeta', 0], ['alpha', 4]]);
    const materialView = new DataView(expected.material.buffer); const rawZeta = Object.hasOwn(entry.uniforms, 'zeta') ? entry.uniforms.zeta : i ? .5 : .25; const values = [rawZeta === 0 ? 0 : rawZeta, 0];
    values.forEach((n, j) => materialView.setFloat32(j * 4, n, true)); assert.deepEqual(binding.uniforms, { zeta: values[0], alpha: 0 });
    new DataView(expected.draw.buffer).setUint32(0, i + 1, true);
    for (const name of ['frame', 'material', 'draw']) { assert.ok(draw.uniforms[name] instanceof Uint8Array); register(draw.uniforms[name]); assert.deepEqual(draw.uniforms[name], expected[name], name + ' complete LE ABI/reserved bytes'); uniformBytes += draw.uniforms[name].byteLength; }
  }
  assert.ok(Object.is(result.request.entries[1].uniforms.zeta, variant === 'override-edit' ? .75 : -0));
  const pixels = width * height; assert.equal(geometryBytes, 2 * (15 * 32 + 48 * 2)); assert.equal(uniformBytes, 480);
  assert.deepEqual(result.resources, { geometryBytes, uniformBytes, colorIdentityBytes: 8 * pixels, depthTexels: pixels, depthBudgetBytes: 4 * pixels, chargedBytes: geometryBytes + uniformBytes + 12 * pixels, readbackBytes: Math.ceil(4 * width / 256) * 256 * height, buffers: 14, textures: 3, bindGroups: 2, pipelines: 2 });
}
let accepted = 0, refused = 0, getters = 0, reflections = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu; assert.deepEqual(gpu.NativeSurfaceUV01FrameDiagnosticCode, Object.fromEntries(['INPUT', 'BUDGET', 'REFERENCE', 'OPTIONS', 'BINDING', 'PROGRAM', 'FRAME', 'REPRESENTATION'].map(code => [code, code])));
  const compile = source => { const compiled = gpu.compileNativeSurfaceUV01Material(source); assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics)); return clone(compiled.material); };
  // (Since acbf60deb (G5) an f32-underflow literal is refused at compile time, so no frame can carry one.)
  { const t = gpu.compileNativeSurfaceUV01Material('@shader #tiny { @fragment { color:mix(#000,#fff,1e-50); } }'); assert.deepEqual([t.ok, t.diagnostics?.map(d => d.code)], [false, ['RANGE']], 'program_literal_f32_underflow'); }
  const input = { format: 'barocss-gpu-native-surface-uv01-frame-request', version: 0, entries: [sourceA, sourceB].map((source, i) => ({ ref: { modelId: i ? 'asset_right' : 'asset_left', geometryId: 'plane_nonunit' }, geometry: geometry(source), material: compile(materialSources[i]), uniforms: i ? { zeta: -0, alpha: -0 } : {}, transform: clone(transforms[i]) })), options: clone(options) };
  const retained = [], failures = [];
  for (const variant of ['original', 'source-edit', 'override-edit']) {
    const request = clone(input); if (variant === 'source-edit') request.entries[0].geometry.source = sourceEdited; if (variant === 'override-edit') request.entries[1].uniforms.zeta = .75;
    const before = signed(request), result = gpu.prepareNativeSurfaceUV01Frame(request, width, height); accepted++; verify(result, request, variant); assert.equal(signed(request), before); assert.equal(Object.isFrozen(request), false);
    for (const prior of retained) independent(result, prior.result);
    const prefix = provider.label + '.' + variant, requestFile = await save(prefix + '.raw-request.json', before + '\n'), files = [requestFile], sources = [];
    for (let i = 0; i < 2; i++) { const native = await save(prefix + '.' + i + '.source0.css', request.entries[i].geometry.source), material = await save(prefix + '.' + i + '.material.css', request.entries[i].material.source), ir = await save(prefix + '.' + i + '.material-ir.json', signed(request.entries[i].material) + '\n'); files.push(native, material, ir); sources.push({ native, material, ir }); }
    const signature = hash(signed(result)), observation = await save(prefix + '.complete-observation.json', signed(result) + '\n'); files.push(observation);
    for (let i = 0; i < 2; i++) for (const [name, bytes] of Object.entries({ positions: result.draws[i].positions, normals: result.draws[i].normals, indices: result.draws[i].indices, uv01: result.draws[i].uv01, ...result.draws[i].uniforms })) files.push(await save(prefix + '.' + i + '.' + name + '.bin', bytes));
    const record = { provider: provider.label, variant, requestFile, sources, files, signature }; coldCases.push(record); retained.push({ result, request, record });
  }
  assert.equal(signed(retained[0].result.bindings[1]), signed(retained[1].result.bindings[1])); assert.equal(signed(retained[0].result.draws[1]), signed(retained[1].result.draws[1]));
  assert.equal(signed(retained[0].result.bindings[0]), signed(retained[2].result.bindings[0])); assert.equal(signed(retained[0].result.draws[0]), signed(retained[2].result.draws[0]));
  assert.notEqual(hash(retained[0].result.draws[0].positions), hash(retained[1].result.draws[0].positions)); assert.notEqual(hash(retained[0].result.draws[1].uniforms.material), hash(retained[2].result.draws[1].uniforms.material));
  const mutable = gpu.prepareNativeSurfaceUV01Frame(input, width, height), again = gpu.prepareNativeSurfaceUV01Frame(input, width, height); accepted += 2; independent(mutable, again);
  mutable.bindings[0].geometry.uv01[0] = .75; mutable.frame.primitives[0].positions[0] = 99; mutable.draws[0].uv01[0] = 255; mutable.draws[0].uniforms.frame[0] = 255;
  verify(again, input, 'original'); assert.equal(mutable.draws[1].uv01[0], 0); assert.equal(mutable.draws[0].positions[0], again.draws[0].positions[0]);
  const caller = clone(input), ownedResult = gpu.prepareNativeSurfaceUV01Frame(caller, width, height), ownedSignature = hash(signed(ownedResult)); accepted++;
  caller.entries[0].geometry.source += '\n'; caller.entries[1].uniforms.zeta = .8; caller.options.translate[0] = 9; assert.equal(hash(signed(ownedResult)), ownedSignature);
  const nullPoseRequest = clone(input); nullPoseRequest.entries[0].transform = null;
  const nullPose = gpu.prepareNativeSurfaceUV01Frame(nullPoseRequest, width, height); accepted++;
  assert.equal(nullPose.request.entries[0].transform, null); assert.equal(Object.hasOwn(nullPose.frame.primitives[0].entry, 'transform'), false);
  const unposedPoints = []; for (let u = 0; u < 5; u++) for (let v = 0; v < 3; v++) unposedPoints.push(1 + .125 * 2 * u / 4, -2 + .125 * 3 * v / 2, .5);
  assert.deepEqual(nullPose.draws[0].positions, f32Bytes(unposedPoints)); assert.equal(signed(nullPose.draws[1]), signed(again.draws[1]));
  const tinyLightRequest = clone(input); tinyLightRequest.options.lighting.direction = [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];
  const tinyLight = gpu.prepareNativeSurfaceUV01Frame(tinyLightRequest, width, height); accepted++;
  for (let i = 0; i < 2; i++) {
    const expected = again.draws[i].uniforms.frame.slice(), view = new DataView(expected.buffer);
    for (let axis = 0; axis < 3; axis++) view.setFloat32(128 + axis * 4, 1 / Math.sqrt(3), true);
    assert.deepEqual(tinyLight.draws[i].uniforms.frame, expected, 'Subnormal raw light normalizes robustly before F32');
    assert.deepEqual(tinyLight.draws[i].positions, again.draws[i].positions);
  }
  async function retention() { assert.equal(getters, 0); for (const { result, record } of retained) { assert.equal(hash(signed(result)), record.signature); for (const file of record.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  async function reject(name, value, code, inspect, w = width, h = height) {
    let error; try { gpu.prepareNativeSurfaceUV01Frame(value, w, h); } catch (cause) { error = cause; }
    assert.ok(error instanceof gpu.NativeSurfaceUV01FrameError, name); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024); assert.equal(Object.hasOwn(error, 'start'), false); assert.equal(Object.hasOwn(error, 'end'), false);
    if (inspect) inspect(error); else assert.equal(Object.hasOwn(error, 'cause'), false, name + ' local guard has no fabricated cause'); failures.push({ name, code: error.code, message: error.message, causeCode: error.cause?.code ?? null }); refused++; await retention();
  }
  const bad = edit => { const value = clone(input); edit(value); return value; };
  const nested = (first, second) => error => { assert.ok(error.cause instanceof gpu.NativeSurfaceUV01BindingError); assert.equal(error.cause.code, first); if (second) assert.equal(error.cause.cause.code, second); };
  for (const [name, edit, code, inspect] of [
    ['duplicate_full_alias_pair', r => r.entries[1].ref.modelId = 'asset_left', 'REFERENCE'],
    ['qualified_selector_mismatch', r => r.entries[0].ref.geometryId = 'other', 'REFERENCE'],
    ['missing_native_selector', r => { r.entries[0].geometry.surfaceId = 'missing'; r.entries[0].ref.geometryId = 'missing'; }, 'BINDING', nested('GEOMETRY', 'SELECTOR')],
    ['negative_revision', r => r.entries[0].geometry.revision = -1, 'BINDING', nested('GEOMETRY')],
    ['native_count_overflow', r => r.entries[0].geometry.countU = 65, 'BINDING', nested('GEOMETRY')],
    ['wrong_material_source_IR', r => r.entries[0].material.source = materialSources[1], 'BINDING', nested('MATERIAL', 'IR')],
    ['unknown_uniform', r => r.entries[0].uniforms.unknown = .2, 'BINDING', nested('UNIFORM')],
    ['out_of_range_uniform', r => r.entries[0].uniforms.zeta = 2, 'BINDING', nested('UNIFORM')],
    ['malformed_original_source', r => r.entries[0].geometry.source = sourceA.replace('degree-u:1', 'degree-u:unknown'), 'BINDING', nested('GEOMETRY', 'SOURCE')],
    ['pose_nonunit_quaternion', r => r.entries[0].transform.rotationXYZW = [0, 0, 0, 2], 'OPTIONS', e => assert.ok(e.cause instanceof Error)],
    ['camera_singular', r => r.options.camera.target = [0, 0, 6], 'OPTIONS', e => assert.ok(e.cause instanceof Error)],
    ['world_coordinate_overflow', r => r.options.mmToSceneUnit = 1000, 'FRAME', e => assert.ok(e.cause instanceof Error)],
    ['light_direction_underflow_before_F32', r => r.options.lighting.direction = [Number.MIN_VALUE, 1000, 0], 'REPRESENTATION'],
    ['override_f32_nonzero_underflow', r => r.entries[0].uniforms.zeta = 1e-50, 'REPRESENTATION', e => assert.equal(Object.hasOwn(e, 'cause'), false)],
    ['input_nonfinite', r => r.entries[0].uniforms.zeta = Infinity, 'INPUT'],
    ['root_extra', r => r.accepted = true, 'INPUT'],
    ['empty_entries', r => r.entries = [], 'BUDGET'],
    ['too_many_entries', r => r.entries = [...r.entries, ...r.entries, r.entries[0]], 'BUDGET'],
    ['raw_string_cap', r => r.entries[0].geometry.source = ' '.repeat(65537), 'BUDGET'],
    ['own_getter', r => Object.defineProperty(r.entries[0].material, 'source', { enumerable: true, get() { getters++; return materialSources[0]; } }), 'INPUT'],
    ['hidden_field', r => Object.defineProperty(r.entries[0], 'hidden', { value: 1 }), 'INPUT'],
    ['sparse_entries', r => delete r.entries[0], 'INPUT'],
    ['cyclic_source', r => r.entries[0].material.expression = r, 'INPUT'],
  ]) await reject(name, bad(edit), code, inspect);
  // These are raw bounded structures, not provider injections. Repeated paths count repeatedly.
  for (const [label, text] of [['UTF16', 'x'.repeat(65536)], ['UTF8', 'é'.repeat(32768)]]) {
    await reject('raw_aggregate_' + label, bad(r => r.entries[0].material.extra = Array(34).fill(text)), 'BUDGET', error => {
      assert.equal(Object.hasOwn(error, 'cause'), false); assert.ok(error.message.includes(label));
    });
  }
  await reject('raw_depth48', bad(r => { let deep = 0; for (let i = 0; i < 50; i++) deep = { child: deep }; r.entries[0].material.extra = deep; }), 'BUDGET');
  await reject('raw_array24576', bad(r => r.entries[0].material.extra = Array(24577).fill(0)), 'BUDGET');
  await reject('raw_record16', bad(r => r.entries[0].material.extra = Object.fromEntries(Array.from({ length: 17 }, (_, i) => ['field' + i, i]))), 'BUDGET');
  await reject('raw_visits262144_repeated_paths', bad(r => { const repeated = Array(24500).fill(0); r.entries[0].material.extra = Array(12).fill(repeated); }), 'BUDGET');
  let earlyDescendants = 0;
  const optionsFirst = { options: new Proxy(clone(options), { getPrototypeOf() { earlyDescendants++; throw new Error('Entry cap must precede descendants'); } }), entries: Array(5).fill(null), version: 0, format: input.format };
  await reject('entries_count_before_options_first_descendant', optionsFirst, 'BUDGET'); assert.equal(earlyDescendants, 0);
  const highResolution = clone(input); highResolution.entries = Array.from({ length: 4 }, (_, i) => {
    const entry = clone(input.entries[i % 2]); entry.ref.modelId = 'high_resolution_' + i; entry.geometry.countU = 64; entry.geometry.countV = 64; return entry;
  });
  await reject('authentic_owned_aggregate_after_providers', highResolution, 'BUDGET', error => {
    assert.equal(Object.hasOwn(error, 'cause'), false); assert.ok(error.message.includes('aggregate'), 'Actual providers must reach owned aggregate admission');
  });
  for (const operation of ['ownKeys', 'getOwnPropertyDescriptor']) {
    const marker = new gpu.NativeSurfaceUV01FrameError('BINDING', 'Exact ' + operation + ' reflection cause');
    const proxy = new Proxy(clone(input), { [operation]() { reflections++; throw marker; } });
    await reject('reflection_exact_' + operation, proxy, 'INPUT', error => { assert.notStrictEqual(error, marker); assert.strictEqual(Object.getOwnPropertyDescriptor(error, 'cause').value, marker); });
  }
  await reject('prepared_observation_is_not_authority', retained[0].result, 'INPUT');
  await reject('width_noninteger', input, 'INPUT', undefined, 1.5); await reject('width_budget', input, 'BUDGET', undefined, 1025);
  for (const marker of [new Error('raw reflection'), new gpu.NativeSurfaceUV01FrameError('PROGRAM', 'branded reflection'), undefined]) {
    const value = new Proxy(clone(input), { getPrototypeOf() { reflections++; throw marker; } });
    await reject('reflection_exact_' + (marker?.code ?? marker?.name ?? 'undefined'), value, 'INPUT', error => { assert.notStrictEqual(error, marker); const descriptor = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(descriptor && 'value' in descriptor); assert.strictEqual(descriptor.value, marker); });
  }
  await retention(); rows.push({ provider: provider.label, records: retained.map(r => r.record), failures });
}
for (let i = 0; i < 3; i++) assert.equal(rows[0].records[i].signature, rows[1].records[i].signature);
const coldCode = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8')), hash = value => createHash('sha256').update(value).digest('hex');
function signed(value) { if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value); if (value === null || typeof value !== 'object') return JSON.stringify(value); return Array.isArray(value) || ArrayBuffer.isView(value) ? '[' + Array.from(value, signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}'; }
const rows = [];
for (const provider of cfg.providers) {
  const gpu = await import(pathToFileURL(provider.path).href); assert.deepEqual(Object.keys(gpu).sort(), cfg.namespace);
  for (const record of cfg.cases.filter(row => row.provider === provider.label)) {
    for (const file of record.files) assert.equal(hash(readFileSync(file.path)), file.sha256);
    const request = JSON.parse(readFileSync(record.requestFile.path, 'utf8'));
    for (let i = 0; i < request.entries.length; i++) {
      const source = readFileSync(record.sources[i].native.path, 'utf8'), css = readFileSync(record.sources[i].material.path, 'utf8');
      assert.equal(request.entries[i].geometry.source, source); assert.equal(request.entries[i].material.source, css);
      const compiled = gpu.compileNativeSurfaceUV01Material(css); assert.equal(compiled.ok, true);
      assert.equal(signed(compiled.material), signed(JSON.parse(readFileSync(record.sources[i].ir.path, 'utf8'))));
      request.entries[i].geometry.source = source; request.entries[i].material = compiled.material;
    }
    const result = gpu.prepareNativeSurfaceUV01Frame(request, cfg.width, cfg.height);
    assert.equal(hash(signed(result)), record.signature); assert.equal(result.draws.length, 2);
    assert.deepEqual(result.draws.map(draw => draw.identity), [1, 2]); assert.equal(result.resources.uniformBytes, 480);
    rows.push({ provider: provider.label, variant: record.variant, signature: record.signature });
  }
}
console.log(JSON.stringify({ node: process.version, pid: process.pid, ppid: process.ppid, rows, authority: 'Full RAW request and original Source0/material CSS reconstructed; IR/result/packed bytes are observations', actualGPU: false, fakeGPU: false }));
`;
const coldScript = await save('cold-native-surface-uv01-frame.mjs', coldCode), config = await save('cold-config.json', JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases, width, height }, null, 2) + '\n');
const stdout = execFileSync(process.execPath, [coldScript.path, config.path], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); await save('cold.stdout', stdout);
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 6);
const report = { issue: 1569, parent, head: git('rev-parse', 'HEAD'), stage: 'NATIVE_SOURCE_UV01_FRAME_SOURCE_EMITTED_API_ORIGINAL_FILE_COLD', node: process.version, accepted, refused, getters, reflections, namespace, delta, sourceGraph, rows, cold,
  actualGPU: false, fakeGPU: false, browser: false, sampledPixels: false, publication: false,
  support: 'CPU source-derived native frame, independent native/domain/order/posed point/normal/LE ABI/resource/copy assertions; original files retained through genuine refusals; one fresh child rebuilds raw requests from original sources. Caller owns external asset/TEN/current-document/display correspondence. Logical resource ledger is prospective, not allocated GPU memory. Device/pipeline/interpolation/pixel/physical identity/lifecycle/residency and Integration adoption remain separate and unrun.',
  unforcedDefensiveCeilings: ['owned aggregate UTF8 independently of UTF16', 'owned aggregate 262144 visits and depth48 independently of byte cap', '32MiB candidate cap', 'future 64MiB accepted/candidate/readback residency'] };
const result = await save('actual-result.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ issue: 1569, accepted, refused, getters, reflections, coldRows: cold.rows.length, actualGPU: false, result }));
