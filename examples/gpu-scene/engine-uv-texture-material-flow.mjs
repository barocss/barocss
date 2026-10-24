/** #1508 ONE EngineUV texture source/IR/GLSL-text/file/cold qualifier. Node22 after build.
 * node examples/gpu-scene/engine-uv-texture-material-flow.mjs --output ABS_FRESH
 * Resource originals are copied only; no texture admission replay, sample RGB or GL.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
const parent = '23321ac563f7ec5335d755239534d0a17da303d2', reference = '61d68692de98fc777cdf2c0d1e9e987a916c69a6', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8')), hash = value => createHash('sha256').update(value).digest('hex');
const gitFile = (commit, path) => execFileSync('git', ['show', commit + ':' + path], { cwd: repo, encoding: 'utf8' }), parentFile = path => gitFile(parent, 'packages/barocss-gpu/' + path);
const barrel = parentFile('src/index.ts'), barrelAST = ts.createSourceFile('parent.ts', barrel, ts.ScriptTarget.Latest, true);
const parentRuntime = barrelAST.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)).flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort(); assert.equal(parentRuntime.length, 145);
const ordinary = resolve(output, 'ordinary-public.mjs'), bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs); assert.ok(sourceGraph.some(path => path.endsWith('/src/material/mesh-material.ts'))); assert.ok(sourceGraph.some(path => path.endsWith('/src/material/material-texture-shader-body.ts'))); assert.ok(!sourceGraph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }]; for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const additions = ['compileEngineUVTextureMaterial', 'validateEngineUVTextureMaterialIR', 'lowerEngineUVTextureMaterial'], namespace = Object.keys(providers[0].gpu).sort(); assert.ok([...additions].sort().every(x => namespace.includes(x))); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);


const parentDir = resolve(output, 'fixed-parent-material'); await mkdir(parentDir); const parentLeaf = resolve(parentDir, 'mesh-material.ts'); await writeFile(parentLeaf, parentFile('src/mesh-material.ts'), { flag: 'wx' });
const program = ts.createProgram([parentLeaf], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], strict: true, skipLibCheck: true, declaration: true, emitDeclarationOnly: true, outDir: parentDir });
const typeDiagnostics = ts.getPreEmitDiagnostics(program); assert.equal(typeDiagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(typeDiagnostics, { getCurrentDirectory: () => repo, getCanonicalFileName: path => path, getNewLine: () => '\n' })); assert.equal(program.emit().emitSkipped, false);
const printer = ts.createPrinter({ removeComments: true });
function declarations(text) { const file = ts.createSourceFile('material.d.ts', text, ts.ScriptTarget.Latest, true); return Object.fromEntries(file.statements.filter(node => node.name && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)).map(node => [node.name.text, printer.printNode(ts.EmitHint.Unspecified, node, file)])); }
const oldDeclarations = declarations(await readFile(resolve(parentDir, 'mesh-material.d.ts'), 'utf8')), newDeclarations = declarations(await readFile(resolve(pkg, 'dist/material/mesh-material.d.ts'), 'utf8'));

const newTypes = ['EngineMaterialSampler', 'EngineUVTextureMaterialExpression', 'EngineUVTextureMaterialIR', 'LoweredEngineUVTextureMaterial'];
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'); for (const name of newTypes) assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(!namespace.includes('engineUVTextureSamplingHelpers'));
const parentModulePath = resolve(parentDir, 'mesh-material.mjs'); await build({ entryPoints: [parentLeaf], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: parentModulePath }); const parentMaterial = await import(pathToFileURL(parentModulePath).href);
const referenceSource = gitFile(reference, 'packages/barocss-gpu/src/engine-textured-scene-shaders.ts'), decoder = referenceSource.match(/vec3 decodeSRGB\(vec3 encodedColor\)\s*\{[\s\S]*?\n\}/); assert.ok(decoder, 'Immutable1184 decodeSRGB body must exist'); const expectedHelpers = decoder[0] + '\n';
function signed(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || typeof value !== 'object') return JSON.stringify(value); return Array.isArray(value) ? '[' + value.map(signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}'; }
const clone = value => JSON.parse(signed(value));
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, seen = new Set()) { if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); Object.values(value).forEach(child => refs(child, seen)); } return seen; }
function independent(left, right) { const rightRefs = refs(right); for (const ref of refs(left)) assert.ok(!rightRefs.has(ref)); }
function keys(value, names) { assert.deepEqual(Object.keys(value).sort(), [...names].sort()); }
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const controlDir = '/Users/user/.barocss-ai/v3/evidence-texture-authoring-controls-gpu/control.first', resourceFiles = [];
assert.equal(hash(await readFile(resolve(controlDir, 'result.json'))), '3e1736cd24f3322c2c9a45897edaa53e28ccb0a3dab1502953a780e993137bc2');
for (const name of ['original.scene.json', 'original.catalog.json']) resourceFiles.push(await save(resolve(output, name), await readFile(resolve(controlDir, name), 'utf8')));
const rawCatalog = JSON.parse(await readFile(resourceFiles[1].path, 'utf8')); assert.equal(rawCatalog.textures[0].pixels.length, 16); assert.ok(Object.is(rawCatalog.textures[0].pixels[1], -0)); assert.equal(rawCatalog.textures[0].id, 'image');
const float = value => ({ kind: 'float', type: 'float', value: value === 0 ? 0 : value }), input = name => ({ kind: 'input', type: 'float', name }), uniform = name => ({ kind: 'uniform', type: 'float', name });
const unary = (operator, value) => ({ kind: 'unary', type: 'float', operator, value }), binary = (operator, left, right) => ({ kind: 'binary', type: 'float', operator, left, right });
const call = (name, type, args) => ({ kind: 'call', type, name, args }), sample = (sampler, u, v) => ({ kind: 'sample', type: 'color', sampler, u, v });
function color(hex) { const canonical = hex.toUpperCase(); return { kind: 'color', type: 'color', hex: canonical, linear: [1, 3, 5].map(index => Math.pow(parseInt(canonical.slice(index, index + 2), 16) / 255, 2.2)) }; }
const u = input('uv_u'), v = input('uv_v'), rawSample = sample('image', u, v), amount = [{ name: 'amount', type: 'float', min: 0, max: 1, default: .25 }];
const css = (body, declarations = '@sampler image:sampler2d;') => '// Original texture é😀\r\n@shader #texture { ' + declarations + ' @fragment{color:' + body + ';} }\r\n';
const localSample = sample('image', unary('-', float(0)), v);
const fixtures = [
  { name: 'direct_original_uv', source: css('sample(image,uv_u,uv_v)'), alias: 'image', uniforms: [], expression: rawSample },
  { name: 'uniform_sampler_local_mix', source: css('mix(texel,#204080,amount)', '@uniform amount:float(-0,1,.25);@sampler image:sampler2d;@let texel:color(sample(image,uv_u,uv_v));'), alias: 'image', uniforms: amount, expression: call('mix', 'color', [rawSample, color('#204080'), uniform('amount')]) },
  { name: 'coordinate_pure_function', source: css('sample(image,half(uv_u),clamp(uv_v,0,1))', '@sampler image:sampler2d;@fn half(t:float(-1000,1000)):float(t*.5);'), alias: 'image', uniforms: [], expression: sample('image', binary('*', u, float(.5)), call('clamp', 'float', [v, float(0), float(1)])) },
  { name: 'repeated_local_independent_samples', source: css('mix(tile,tile,.5)', '@sampler image:sampler2d;@let tile:color(sample(image,-0,uv_v));'), alias: 'image', uniforms: [], expression: call('mix', 'color', [localSample, clone(localSample), float(.5)]) },
  { name: 'source_alias_edit_external_image_unchanged', source: css('mix(texel,#204080,amount)', '@uniform amount:float(-0,1,.25);@sampler albedo:sampler2d;@let texel:color(sample(albedo,uv_u,uv_v));'), alias: 'albedo', uniforms: amount, expression: call('mix', 'color', [sample('albedo', u, v), color('#204080'), uniform('amount')]) },
  { name: 'unused_sampler_stays_in_layout', source: css('#204080'), alias: 'image', uniforms: [], expression: color('#204080') },
];
function expectedLower(expression, uniforms, alias) {
  const layout = uniforms.map((entry, index) => ({ ...entry, glslName: 'mat_u_' + index }));
  const lower = node => { if (node.kind === 'float') return node.value.toPrecision(17); if (node.kind === 'color') return 'vec3(' + node.linear.map(value => value.toPrecision(17)).join(',') + ')'; if (node.kind === 'uniform') return layout.find(entry => entry.name === node.name).glslName; if (node.kind === 'input') return node.name === 'uv_u' ? 'v_engine_uv.x' : 'v_engine_uv.y'; if (node.kind === 'unary') return '(' + node.operator + lower(node.value) + ')'; if (node.kind === 'binary') return '(' + lower(node.left) + node.operator + lower(node.right) + ')'; if (node.kind === 'sample') return 'decodeSRGB(texture(mat_s_0,clamp(vec2(' + lower(node.u) + ',' + lower(node.v) + '),vec2(0.0),vec2(1.0))).rgb)'; assert.equal(node.kind, 'call'); const args = node.args.map(lower); if (node.name === 'mix') args[2] = 'clamp(' + args[2] + ',0.0,1.0)'; return node.name + '(' + args.join(',') + ')'; };
  return { expression: 'clamp(' + lower(expression) + ',vec3(0.0),vec3(1.0))', uniformDeclarations: layout.map(entry => 'uniform float ' + entry.glslName + ';').join('\n'), uniformLayout: layout,
    inputDeclarations: 'in vec2 v_engine_uv;', samplerDeclarations: 'uniform highp sampler2D mat_s_0;', samplerLayout: [{ name: alias, type: 'sampler2d', glslName: 'mat_s_0', colorSpace: 'srgb', rowOrigin: 'bottom-left', filter: 'nearest', wrapS: 'clamp-to-edge', wrapT: 'clamp-to-edge' }], samplingHelpers: expectedHelpers };
}
function samples(node, out = []) { if (node.kind === 'sample') { out.push(node); samples(node.u, out); samples(node.v, out); } else if (node.kind === 'unary') samples(node.value, out); else if (node.kind === 'binary') { samples(node.left, out); samples(node.right, out); } else if (node.kind === 'call') node.args.forEach(child => samples(child, out)); return out; }
const balanced = depth => depth ? '(' + balanced(depth - 1) + '+' + balanced(depth - 1) + ')' : '.001';
let accepted = 0, refused = 0, getters = 0, reflections = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  for (const fixture of fixtures) {
    const compiled = gpu.compileEngineUVTextureMaterial(fixture.source); assert.equal(compiled.ok, true, fixture.name + ':' + JSON.stringify(compiled));
    const ir = compiled.material, caller = clone(ir), before = signed(caller), reconstructed = gpu.validateEngineUVTextureMaterialIR(caller), lowered = gpu.lowerEngineUVTextureMaterial(ir);
    keys(ir, ['format', 'version', 'profile', 'source', 'shaderId', 'uniforms', 'samplers', 'expression']); assert.equal(ir.format, 'barocss-gpu-engine-uv-texture-material'); assert.equal(ir.version, 0); assert.equal(ir.profile, 'engine-opaque-uv-texture-fragment-v0'); assert.equal(ir.source, fixture.source); assert.equal(ir.shaderId, 'texture');
    assert.deepEqual(ir.uniforms, fixture.uniforms); assert.deepEqual(ir.samplers, [{ name: fixture.alias, type: 'sampler2d' }]); assert.deepEqual(ir.expression, fixture.expression); assert.deepEqual(reconstructed, ir); independent(ir, reconstructed); independent(caller, reconstructed); assert.equal(signed(caller), before); assert.equal(Object.isFrozen(caller), false);
    keys(lowered, ['expression', 'uniformDeclarations', 'uniformLayout', 'inputDeclarations', 'samplerDeclarations', 'samplerLayout', 'samplingHelpers']); assert.deepEqual(lowered, expectedLower(fixture.expression, fixture.uniforms, fixture.alias)); keys(lowered.samplerLayout[0], ['name', 'type', 'glslName', 'colorSpace', 'rowOrigin', 'filter', 'wrapS', 'wrapT']); assert.equal(lowered.samplingHelpers, expectedHelpers);
    frozen(ir); frozen(reconstructed); frozen(lowered); independent(lowered, ir); for (const previous of retained) independent(ir, previous.ir);
    for (const node of samples(ir.expression)) { keys(node, ['kind', 'type', 'sampler', 'u', 'v']); assert.equal(node.type, 'color'); assert.equal(node.sampler, fixture.alias); assert.equal(node.u.type, 'float'); assert.equal(node.v.type, 'float'); }
    if (fixture.name === 'direct_original_uv') { assert.deepEqual(ir.expression.u, u); assert.deepEqual(ir.expression.v, v); }
    if (fixture.name === 'repeated_local_independent_samples') { assert.equal(samples(ir.expression).length, 2); independent(ir.expression.args[0], ir.expression.args[1]); assert.equal(ir.expression.args[0].u.kind, 'unary'); assert.ok(fixture.source.includes('sample(image,-0')); }
    if (fixture.name === 'unused_sampler_stays_in_layout') { assert.equal(samples(ir.expression).length, 0); assert.equal(lowered.samplerLayout.length, 1); assert.ok(!lowered.expression.includes('texture(')); }
    const prefix = resolve(output, provider.label + '.' + fixture.name), sourcePath = prefix + '.css', irPath = prefix + '.ir.json', lowerPath = prefix + '.lower.json';
    const files = [await save(sourcePath, fixture.source), await save(irPath, signed(ir) + '\n'), await save(lowerPath, signed(lowered) + '\n'), await save(prefix + '.expression.glsl', lowered.expression), await save(prefix + '.sampling-helpers.glsl', lowered.samplingHelpers), await save(prefix + '.layout.json', signed({ uniforms: lowered.uniformLayout, sampler: lowered.samplerLayout }) + '\n')];
    const record = { provider: provider.label, name: fixture.name, sourcePath, irPath, lowerPath, files, irSHA: hash(signed(ir)), lowerSHA: hash(signed(lowered)), alias: fixture.alias, sampleCount: samples(ir.expression).length }; records.push(record); coldCases.push(record); retained.push({ ir, digest: record.irSHA, files }); accepted++;
  }
  assert.equal(retained[1].ir.samplers[0].name, 'image'); assert.equal(retained[4].ir.samplers[0].name, 'albedo'); assert.equal(rawCatalog.textures[0].id, 'image'); assert.equal(records[1].sampleCount, records[4].sampleCount);
  assert.equal(gpu.lowerEngineUVTextureMaterial(retained[1].ir).expression, gpu.lowerEngineUVTextureMaterial(retained[4].ir).expression);
  async function retention() { assert.equal(getters, 0); for (const item of retained) { assert.equal(hash(signed(item.ir)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); } for (const file of resourceFiles) assert.equal(hash(await readFile(file.path)), file.sha256); }
  const checks = [
    ['unknown_alias', css('sample(missing,uv_u,uv_v)'), 'TYPE'], ['alias_expression', css('sample((image),uv_u,uv_v)'), 'TYPE'],
    ['alias_uniform_collision', css('#204080', '@uniform image:float(0,1,.5);@sampler image:sampler2d;'), 'TYPE'], ['alias_coordinate_collision', css('#204080', '@sampler uv_u:sampler2d;'), 'TYPE'],
    ['missing_sampler', css('#204080', ''), 'SYNTAX'], ['second_sampler_priority', css('#204080', '@sampler image:sampler2d;@sampler 9bad:float;'), 'BUDGET'],
    ['uniform_after_sampler', css('#204080', '@sampler image:sampler2d;@uniform gain:float(0,1,.5);'), 'SYNTAX'], ['sampler_after_function', css('#204080', '@fn half(t:float(0,1)):float(t);@sampler image:sampler2d;'), 'SYNTAX'],
    ['missing_coordinate', css('sample(image,uv_u)'), 'SYNTAX'], ['extra_coordinate', css('sample(image,uv_u,uv_v,0)'), 'SYNTAX'],
    ['color_coordinate', css('sample(image,#fff,uv_v)'), 'TYPE'], ['coordinate_interval', css('sample(image,uv_u*2,uv_v)'), 'RANGE'],
    ['pure_sample_before_bad_alias', css('#204080', '@sampler image:sampler2d;@fn hidden(t:float(0,1)):color(sample(missing,t,t));'), 'TYPE'],
    ['function_alias_shadow', css('#204080', '@sampler image:sampler2d;@fn image(t:float(0,1)):float(t);'), 'TYPE'], ['parameter_alias_shadow', css('#204080', '@sampler image:sampler2d;@fn half(image:float(0,1)):float(image);'), 'TYPE'], ['local_alias_shadow', css('#204080', '@sampler image:sampler2d;@let image:float(.5);'), 'TYPE'],
    ['expanded_coordinate_work', css('sample(image,' + balanced(7) + ',uv_v)'), 'BUDGET'], ['coordinate_parse_depth', css('sample(image,' + '('.repeat(18) + '.5' + ')'.repeat(18) + ',uv_v)'), 'BUDGET'],
  ];
  for (const [name, authored, code] of checks) {
    const result = gpu.compileEngineUVTextureMaterial(authored); assert.equal(result.ok, false, name); frozen(result.diagnostics); const diagnostic = result.diagnostics[0]; keys(diagnostic, ['code', 'message', 'start', 'end']); assert.equal(diagnostic.code, code, name); assert.ok(diagnostic.message.length <= 1024); assert.ok(diagnostic.start >= 0 && diagnostic.end <= authored.length);
    if (name === 'second_sampler_priority') { const start = authored.lastIndexOf('@sampler') + 1; assert.equal(diagnostic.start, start); assert.equal(diagnostic.end, start + 7); }
    if (name === 'pure_sample_before_bad_alias') { const start = authored.indexOf('sample('); assert.equal(diagnostic.start, start); assert.equal(diagnostic.end, start + 6); }
    failures.push({ name, diagnostic, file: await save(resolve(output, provider.label + '.refused.' + name + '.css'), authored) }); refused++; await retention();
  }
  const ir = retained[0].ir, forged = clone(ir); forged.expression.sampler = 'missing'; const forgedCoordinate = clone(ir); forgedCoordinate.expression.u = float(.5); const wrongProfile = clone(ir); wrongProfile.profile = 'engine-opaque-uv-fragment-v0'; const malformed = clone(ir); malformed.source = css('sample(image,#fff,uv_v)');
  for (const method of ['validateEngineUVTextureMaterialIR', 'lowerEngineUVTextureMaterial']) {
    for (const [name, value] of [['forged_alias', forged], ['forged_coordinate', forgedCoordinate], ['wrong_profile', wrongProfile], ['malformed_source', malformed]]) {
      let error; try { gpu[method](value); } catch (caught) { error = caught; } assert.ok(error instanceof gpu.MeshMaterialError, name); assert.equal(error.code, 'IR', name);
      if (name === 'malformed_source') { const result = gpu.compileEngineUVTextureMaterial(malformed.source); assert.equal(result.ok, false); assert.deepEqual(error.cause, result.diagnostics[0]); assert.equal(error.start, result.diagnostics[0].start); assert.equal(error.end, result.diagnostics[0].end); frozen(error.cause); } else assert.equal(Object.hasOwn(error, 'cause'), false);
      failures.push({ name: method + '.' + name, code: error.code, start: error.start, end: error.end }); refused++; await retention();
    }
    const getter = clone(ir); Object.defineProperty(getter, 'source', { enumerable: true, get() { getters++; return ir.source; } }); const hidden = clone(ir); Object.defineProperty(hidden, 'source', { value: ir.source, enumerable: false }); const symbol = clone(ir); symbol[Symbol('unsupported')] = true;
    const inconsistent = new Proxy(clone(ir), { getOwnPropertyDescriptor(target, key) { return key === 'source' ? undefined : Reflect.getOwnPropertyDescriptor(target, key); } });
    for (const [name, value] of [['getter0', getter], ['hidden', hidden], ['symbol', symbol], ['inconsistent_snapshot', inconsistent]]) { let error; try { gpu[method](value); } catch (caught) { error = caught; } assert.ok(error instanceof gpu.MeshMaterialError, name); assert.equal(error.code, 'INPUT'); assert.equal(Object.hasOwn(error, 'cause'), false); failures.push({ name: method + '.' + name, code: error.code }); refused++; await retention(); }
    for (const operation of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) for (const causeKind of ['branded', 'undefined']) {
      const marker = causeKind === 'undefined' ? undefined : new gpu.MeshMaterialError('UNIFORM', 'Caller texture reflection sentinel', 17, 29), proxy = new Proxy(clone(ir), { [operation]() { reflections++; throw marker; } }); let error; try { gpu[method](proxy); } catch (caught) { error = caught; }
      assert.ok(error instanceof gpu.MeshMaterialError); assert.equal(error.code, 'INPUT'); assert.notStrictEqual(error, marker); assert.equal(error.start, 0); assert.equal(error.end, 0); const cause = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(cause && 'value' in cause); assert.strictEqual(cause.value, marker); failures.push({ name: method + '.' + operation + '.' + causeKind, freshOwnExactCause: true }); refused++; await retention();
    }
  }
  const legalSample = '@shader #old_sample {@fn sample(t:float(0,1)):float(t);@fragment{color:mix(#000,#fff,sample(.25));}}', oldControls = [];
  for (const [compile, validate, lower] of [['compileMeshMaterial', 'validateMeshMaterialIR', 'lowerMeshMaterial'], ['compileEngineUVMaterial', 'validateEngineUVMaterialIR', 'lowerEngineUVMaterial'], ['compileEngineUVRepeatingMaterial', 'validateEngineUVRepeatingMaterialIR', 'lowerEngineUVRepeatingMaterial'], ['compileNativeSurfaceUV01Material', 'validateNativeSurfaceUV01MaterialIR', 'lowerNativeSurfaceUV01Material'], ['compileDiscreteMeshMaterial', 'validateDiscreteMeshMaterialIR', 'lowerDiscreteMeshMaterial']]) {
    const actual = gpu[compile](legalSample), prior = parentMaterial[compile](legalSample); assert.equal(actual.ok, true); assert.deepEqual(actual, prior); assert.deepEqual(gpu[lower](actual.material), parentMaterial[lower](prior.material));
    let error; try { gpu[validate](clone(ir)); } catch (caught) { error = caught; } assert.ok(error instanceof gpu.MeshMaterialError); assert.equal(error.code, 'IR'); refused++; oldControls.push({ compile, legalAuthoredSamplePreserved: true, newProfileRejected: error.code }); await retention();
  }
  const object = {}; Object.defineProperty(object, 'toString', { get() { getters++; throw new Error('No source coercion'); } }); for (const value of [object, null]) { const result = gpu.compileEngineUVTextureMaterial(value); assert.equal(result.ok, false); assert.equal(result.diagnostics[0].code, 'INPUT'); frozen(result.diagnostics); refused++; await retention(); }
  rows.push({ provider: provider.label, records, failures, oldControls });
}
for (let index = 0; index < fixtures.length; index++) { assert.equal(rows[0].records[index].irSHA, rows[1].records[index].irSHA); assert.equal(rows[0].records[index].lowerSHA, rows[1].records[index].lowerSHA); } assert.equal(reflections, 24); assert.equal(getters, 0);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=value=>createHash('sha256').update(value).digest('hex');function signed(value){if(typeof value==='number'){assert.ok(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}if(value===null||typeof value!=='object')return JSON.stringify(value);return Array.isArray(value)?'['+value.map(signed).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+signed(value[key])).join(',')+'}';}
for(const file of cfg.resources)assert.equal(hash(readFileSync(file.path)),file.sha256);const scene=JSON.parse(readFileSync(cfg.resources[0].path,'utf8')),catalog=JSON.parse(readFileSync(cfg.resources[1].path,'utf8'));assert.equal(scene.id,catalog.sceneId);assert.equal(catalog.textures[0].pixels.length,16);assert.ok(Object.is(catalog.textures[0].pixels[1],-0));
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const fixture of cfg.cases.filter(fixture=>fixture.provider===provider.label)){for(const file of fixture.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(fixture.sourcePath,'utf8'),compiled=gpu.compileEngineUVTextureMaterial(source);assert.equal(compiled.ok,true);const ir=compiled.material,lowered=gpu.lowerEngineUVTextureMaterial(ir);assert.equal(ir.source,source);assert.equal(hash(signed(ir)),fixture.irSHA);assert.equal(hash(signed(lowered)),fixture.lowerSHA);assert.deepEqual(ir,JSON.parse(readFileSync(fixture.irPath,'utf8')));assert.deepEqual(lowered,JSON.parse(readFileSync(fixture.lowerPath,'utf8')));rows.push({provider:provider.label,name:fixture.name,irSHA:fixture.irSHA,lowerSHA:fixture.lowerSHA});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'whole original material source; resource originals read separately without provider replay',sampledRGB:false,actualGL:false}));`;
const coldPath = resolve(output, 'cold-texture-source.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' }); await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases, resources: resourceFiles }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, fixtures.length * providers.length);
const report = { issue: 1508, stage: 'ENGINE_UV_TEXTURE_SOURCE_IR_GLSL_TEXT_CPU', parent, node: process.version, accepted, refused, getters, reflections, namespace, namespaceCount: namespace.length, newTypes, sourceGraph, rows, cold, resourceFiles,
  immutableDecoder: { commit: reference, path: 'packages/barocss-gpu/src/engine-textured-scene-shaders.ts', sourceSHA: hash(referenceSource), exactBodyWithOneFinalNewlineSHA: hash(expectedHelpers) }, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), oldPublicMaterialDeclarationsPreserved: true, oldManifestAndBarrelPrefixPreserved: true,
  resourceProvidersReplayed: false, sampledRGB: false, actualGL: false, deviceTextureUnitAssigned: false, resourceJoinAvailable: false, publication: false,
  support: 'One declared sampler and coordinate-free resource alias metadata plus original EngineUV coefficient trees, trusted clamp/texture/piecewise-decode text, old literal pow2.2 policy, original-source cold reconstruction and unchanged resource originals. No catalog join/upload/link/pixel/runtime/nativeUV/frame/lifetime or consumer adoption.', unforcedDefensiveGuards: ['validIR2MiB', 'validText64KiB', 'validLowered128KiB'] };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ issue: 1508, accepted, refused, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), sampledRGB: false, actualGL: false }));
