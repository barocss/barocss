/** #1456 ONE color-return source/API/file/cold qualifier. Node22 after GPU build.
 * node examples/gpu-scene/material-color-return-function-flow.mjs --output ABS_FRESH
 * CPU only; no native evaluator, linked shader, resource or pixel claim.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';
assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
const parent = 'b1ee4444fe7dd674956ac063d408be820e170af2', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8')), hash = v => createHash('sha256').update(v).digest('hex');
const ordinary = resolve(output, 'ordinary-public.mjs');
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundled.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/mesh-material.ts')));
assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.equal(namespace.length, 128); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
const parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
assert.equal(await readFile(resolve(pkg, 'src/index.ts'), 'utf8'), parentFile('src/index.ts')); assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));
const parentFolder = resolve(output, 'fixed-parent-declarations'); await mkdir(parentFolder);
const parentLeaf = resolve(parentFolder, 'mesh-material.ts'); await writeFile(parentLeaf, parentFile('src/mesh-material.ts'), { flag: 'wx' });
const program = ts.createProgram([parentLeaf], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], strict: true, skipLibCheck: true, declaration: true, emitDeclarationOnly: true, outDir: parentFolder });
const diagnostics = ts.getPreEmitDiagnostics(program); assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics,
  { getCurrentDirectory: () => repo, getCanonicalFileName: x => x, getNewLine: () => '\n' })); assert.equal(program.emit().emitSkipped, false);
const parentDTS = await readFile(resolve(parentFolder, 'mesh-material.d.ts'), 'utf8'), currentDTS = await readFile(resolve(pkg, 'dist/mesh-material.d.ts'), 'utf8'); assert.equal(currentDTS, parentDTS);
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); } if (v === null || typeof v !== 'object') return JSON.stringify(v);
  assert.ok(!ArrayBuffer.isView(v)); return Array.isArray(v) ? '[' + v.map(signed).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
function frozen(v) { if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(x => refs(x, out)); } return out; }
function independent(a, b) { const right = refs(b); for (const ref of refs(a)) assert.ok(!right.has(ref)); }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const profiles = [
  { name: 'mesh', compile: 'compileMeshMaterial', validate: 'validateMeshMaterialIR', lower: 'lowerMeshMaterial', u: 'amount', v: '.5' },
  { name: 'uv', compile: 'compileEngineUVMaterial', validate: 'validateEngineUVMaterialIR', lower: 'lowerEngineUVMaterial', u: 'clamp(uv_u,0,1)', v: 'clamp(uv_v,0,1)' },
  { name: 'repeating', compile: 'compileEngineUVRepeatingMaterial', validate: 'validateEngineUVRepeatingMaterialIR', lower: 'lowerEngineUVRepeatingMaterial', u: 'fract(clamp(uv_u,-999,999))', v: 'fract(clamp(uv_v,-999,999))' },
  { name: 'native', compile: 'compileNativeSurfaceUV01Material', validate: 'validateNativeSurfaceUV01MaterialIR', lower: 'lowerNativeSurfaceUV01Material', u: 'surface_u01', v: 'surface_v01' },
];
const header = '// Original é😀 palette retained.\r\n@shader #palette { @uniform amount:float(-0,1,.25); ';
const authored = p => header + '@fn fade(s:float(0,1)):float(s*.5+.25); @fn tint(t:float(0,1)):color(mix(#203040,#FFEEDD,t)); @let shade:color(tint(fade(' + p.u + '))); @fragment { color:mix(shade,tint(fade(' + p.v + ')),amount); } }\r\n';
// Independently authored full color expressions. No transformation of the function source is used.
const manual = p => header + '@let shade:color(mix(#203040,#FFEEDD,(' + p.u + ')*.5+.25)); @fragment { color:mix(shade,mix(#203040,#FFEEDD,(' + p.v + ')*.5+.25),amount); } }\r\n';
const paletteA = [32, 48, 64].map(n => Math.pow(n / 255, 2.2)), paletteB = [255, 238, 221].map(n => Math.pow(n / 255, 2.2));
function paletteRGB(u, v, amount) { const tu = u * .5 + .25, tv = v * .5 + .25;
  const left = paletteA.map((n, axis) => n * (1 - tu) + paletteB[axis] * tu), right = paletteA.map((n, axis) => n * (1 - tv) + paletteB[axis] * tv);
  return left.map((n, axis) => { const x = Math.min(Math.max(n * (1 - amount) + right[axis] * amount, 0), 1); return x === 0 ? 0 : x; }); }
const document = JSON.parse(await readFile(resolve(repo, 'examples/gpu-scene/fixtures/area-revision1.cad-document.json'), 'utf8'));
const geometry = { format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0, source: document.assets[0].source,
  surfaceId: 'plane_nonunit', countU: 9, countV: 9, revision: 0 };
assert.equal(hash(geometry.source), '56985f37e763f01325ac7e91ba2cf251accfa92efad9e5200b8619dc58545dc8');
let accepted = 0, refused = 0, getters = 0, reflections = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, admissions = [], failures = [], retained = [];
  const compile = (p, source) => { const result = gpu[p.compile](source); assert.equal(result.ok, true, JSON.stringify(result)); return result.material; };
  for (const p of profiles) {
    const source = authored(p), ir = compile(p, source), explicit = compile(p, manual(p));
    assert.equal(ir.source, source); assert.deepEqual(ir.expression, explicit.expression); assert.deepEqual(ir.uniforms, explicit.uniforms);
    const validated = gpu[p.validate](clone(ir)), lowered = gpu[p.lower](ir); assert.deepEqual(validated, ir); independent(validated, ir); assert.deepEqual(lowered, gpu[p.lower](explicit));
    frozen(ir); frozen(validated); assert.equal(ir.uniforms.length, 1); assert.equal(ir.uniforms[0].name, 'amount'); assert.ok(Object.is(ir.uniforms[0].min, +0));
    assert.ok(source.includes('float(-0,1,.25)')); assert.ok(!/\b(?:tint|fade)\s*\(/.test(lowered.expression)); assert.equal(lowered.uniformLayout[0].glslName, 'mat_u_0');
    assert.equal(ir.expression.type, 'color'); assert.equal(ir.expression.kind, 'call'); assert.equal(ir.expression.name, 'mix');
    assert.deepEqual(ir.expression.args[0].args[0].linear, paletteA); assert.deepEqual(ir.expression.args[0].args[1].linear, paletteB);
    const prefix = resolve(output, provider.label + '.' + p.name), sourcePath = prefix + '.palette.css', manualPath = prefix + '.manual.css', irPath = prefix + '.ir.json', lowerPath = prefix + '.lower.json';
    const files = [await save(sourcePath, source), await save(manualPath, manual(p)), await save(irPath, signed(ir) + '\n'), await save(lowerPath, signed(lowered) + '\n')];
    const requests = [];
    for (const amount of [undefined, .75]) {
      const values = amount === undefined ? {} : { amount }, actualAmount = amount === undefined ? .25 : amount;
      if (p.name !== 'native') {
        const input = { material: clone(ir), uniforms: values, ...(p.name === 'mesh' ? {} : { uv: [.2, .8] }) }, before = signed(input), sample = gpu.evaluateAuthoredMaterial(input);
        assert.equal(signed(input), before); assert.equal(Object.isFrozen(input), false); independent(sample, input); frozen(sample); assert.deepEqual(sample.uniforms, { amount: actualAmount });
        assert.deepEqual(sample.linearRGB, paletteRGB(p.name === 'mesh' ? actualAmount : .2, p.name === 'mesh' ? .5 : .8, actualAmount));
        const path = prefix + '.' + (amount === undefined ? 'default' : 'update') + '.request.json'; files.push(await save(path, signed(input) + '\n')); requests.push({ path, linearRGB: sample.linearRGB, amount: actualAmount });
      } else {
        const input = { format: 'barocss-gpu-native-surface-uv01-binding-request', version: 0, geometry: clone(geometry), material: clone(ir), uniforms: values }, before = signed(input);
        const binding = gpu.prepareNativeSurfaceUV01MaterialBinding(input); assert.equal(signed(input), before); assert.equal(Object.isFrozen(input), false); independent(binding, input); frozen(binding);
        assert.deepEqual(binding.material, ir); assert.deepEqual(binding.uniforms, { amount: actualAmount }); assert.deepEqual(binding.lowered, lowered);
        assert.deepEqual(binding.geometry.domain, { u: [-3, 7], v: [2, 5] }); assert.equal(binding.geometry.uv01.byteLength, 648); assert.equal(binding.geometry.request.source, geometry.source);
        assert.ok(Object.is(binding.geometry.model.objects[0].controlPoints[0][0][2], -0));
        const old = binding.geometry.uv01[0]; binding.geometry.uv01[0] = .5; assert.equal(binding.geometry.normalizedParameters[0], 0); binding.geometry.uv01[0] = old;
        const path = prefix + '.' + (amount === undefined ? 'default' : 'update') + '.request.json'; files.push(await save(path, signed(input) + '\n')); requests.push({ path, amount: actualAmount, nativeViewBytes: 648 });
      }
      accepted++;
    }
    if (p.name === 'native') files.push(await save(prefix + '.geometry.css', geometry.source));
    const item = { provider: provider.label, profile: p.name, sourcePath, manualPath, irPath, lowerPath, files, requests, expressionSHA: hash(signed(ir.expression)), loweringSHA: hash(signed(lowered)) };
    admissions.push(item); coldCases.push(item); retained.push({ ir, digest: hash(signed(ir)), files }); accepted++;
  }
  const native = profiles[3];
  const eight = Array.from({ length: 8 }, (_, i) => '@fn f' + i + '(p' + i + ':float(0,1)):' + (i % 2 ? 'color(mix(#203040,#FFEEDD,p' + i + '))' : 'float(p' + i + ')') + ';').join(' ');
  const mixedSource = '@shader #mixed { ' + eight + ' @fragment { color:f1(f0(.5)); } }';
  const mixed = compile(native, mixedSource), mixedManual = compile(native, '@shader #mixed { @fragment { color:mix(#203040,#FFEEDD,.5); } }');
  assert.deepEqual(mixed.expression, mixedManual.expression); assert.deepEqual(gpu[native.lower](mixed), gpu[native.lower](mixedManual)); accepted++;
  const mixedPath = resolve(output, provider.label + '.eight-mixed.css'), mixedIRPath = resolve(output, provider.label + '.eight-mixed.ir.json');
  retained.push({ ir: mixed, digest: hash(signed(mixed)), files: [await save(mixedPath, mixedSource), await save(mixedIRPath, signed(mixed) + '\n')] });
  const declaration = text => '// Original UTF16 é😀\r\n@shader #negative { ' + text + ' @fragment { color:#fff; } }';
  const checks = [
    ['color_return_float_body', declaration('@fn tint(t:float(0,1)):color(t);'), 'TYPE', '):color('],
    ['float_return_color_body', declaration('@fn scalar(t:float(0,1)):float(#fff);'), 'TYPE', '):float('],
    ['color_argument', '@shader #negative { @fn tint(t:float(0,1)):color(mix(#000,#fff,t)); @fragment { color:tint(#fff); } }', 'TYPE'],
    ['color_call_in_float_context', '@shader #negative { @fn tint(t:float(0,1)):color(mix(#000,#fff,t)); @let value:float(tint(.5)); @fragment { color:#fff; } }', 'TYPE'],
    ['capture_uniform', declaration('@uniform amount:float(0,1,.5); @fn tint(t:float(0,1)):color(mix(#000,#fff,amount));'), 'TYPE'],
    ['capture_coordinate', declaration('@fn tint(t:float(0,1)):color(mix(#000,#fff,surface_u01));'), 'TYPE'],
    ['recursive_color_call', declaration('@fn tint(t:float(0,1)):color(tint(t));'), 'SYNTAX'],
    ['float_call_inside_color_body', declaration('@fn fade(s:float(0,1)):float(s); @fn tint(t:float(0,1)):color(mix(#000,#fff,fade(t)));'), 'SYNTAX'],
    ['local_collision', declaration('@fn tint(t:float(0,1)):color(mix(#000,#fff,t)); @let tint:color(#fff);'), 'TYPE'],
    ['ninth_shared_definition', declaration(eight + ' @fn ninth(t:float(0,1)):color(#fff);'), 'BUDGET'],
    ['expanded_color_depth', '@shader #negative { @fn tint(t:float(0,1)):color(mix(#000,#fff,t)); @fragment { color:mix(tint(.5' + '+0'.repeat(14) + '),#F00,.5); } }', 'BUDGET'],
    ['expanded_color_work', '@shader #negative { @fn tint(t:float(0,1)):color(mix(mix(#000,#fff,t),mix(#F00,#0F0,t),t)); @fragment { color:tint(' + balanced(4) + '); } }', 'BUDGET'],
  ];
  async function retention() { assert.equal(getters, 0); for (const item of retained) { assert.equal(hash(signed(item.ir)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  for (const [name, source, code, typeAnchor] of checks) {
    const result = gpu.compileNativeSurfaceUV01Material(source); assert.equal(result.ok, false, name); const diagnostic = result.diagnostics[0]; assert.equal(diagnostic.code, code, name); assert.ok(diagnostic.message.length <= 1024);
    assert.ok(diagnostic.start >= 0 && diagnostic.end <= source.length && diagnostic.end >= diagnostic.start);
    if (typeAnchor) { const start = source.indexOf(typeAnchor) + 2; assert.equal(diagnostic.start, start, name); assert.equal(diagnostic.end, start + 5, name); }
    const path = resolve(output, provider.label + '.refused.' + name + '.css'); failures.push({ name, diagnostic, file: await save(path, source) }); refused++; await retention();
  }
  const ir = retained[3].ir, forged = clone(ir); forged.expression.args[0] = { kind: 'color', type: 'color', hex: '#000000', linear: [0, 0, 0] };
  const getter = clone(ir); Object.defineProperty(getter, 'source', { enumerable: true, get() { getters++; return ir.source; } });
  const marker = new gpu.MeshMaterialError('UNIFORM', 'caller palette reflection', 17, 29);
  for (const [name, input, code, exactCause] of [['forged_color_IR', forged, 'IR'], ['source_getter0', getter, 'INPUT'],
    ['same_class_reflection', new Proxy(clone(ir), { ownKeys() { reflections++; throw marker; } }), 'INPUT', marker]]) {
    let error; try { gpu.validateNativeSurfaceUV01MaterialIR(input); } catch (cause) { error = cause; } assert.ok(error instanceof gpu.MeshMaterialError, name); assert.equal(error.code, code);
    if (exactCause) { assert.notStrictEqual(error, exactCause); assert.strictEqual(error.cause, exactCause); assert.equal(error.start, 0); assert.equal(error.end, 0); }
    failures.push({ name, code: error.code, start: error.start, end: error.end, exactReflectionCause: Boolean(exactCause) }); refused++; await retention();
  }
  rows.push({ provider: provider.label, admissions, failures, eightSharedFloatAndColorDefinitions: true });
}
function balanced(depth) { return depth ? '(' + balanced(depth - 1) + '+' + balanced(depth - 1) + ')/2' : '.5'; }
for (let i = 0; i < 4; i++) { assert.equal(rows[0].admissions[i].expressionSHA, rows[1].admissions[i].expressionSHA); assert.equal(rows[0].admissions[i].loweringSHA, rows[1].admissions[i].loweringSHA); }
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const c of cfg.cases.filter(c=>c.provider===provider.label)){for(const file of c.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const p=cfg.profiles.find(p=>p.name===c.profile),source=readFileSync(c.sourcePath,'utf8'),saved=JSON.parse(readFileSync(c.irPath,'utf8')),compiled=gpu[p.compile](source);assert.equal(compiled.ok,true);assert.deepEqual(compiled.material,saved);const validated=gpu[p.validate](saved),lowered=gpu[p.lower](validated);assert.equal(hash(signed(validated.expression)),c.expressionSHA);assert.equal(hash(signed(lowered)),c.loweringSHA);assert.deepEqual(lowered,JSON.parse(readFileSync(c.lowerPath,'utf8')));for(const r of c.requests){const input=JSON.parse(readFileSync(r.path,'utf8'));assert.equal(input.material.source,source);if(c.profile==='native'){const binding=gpu.prepareNativeSurfaceUV01MaterialBinding(input);assert.deepEqual(binding.material,saved);assert.deepEqual(binding.lowered,lowered);assert.deepEqual(binding.uniforms,{amount:r.amount});assert.equal(binding.geometry.uv01.byteLength,648);}else{const sample=gpu.evaluateAuthoredMaterial(input);assert.deepEqual(sample.linearRGB,r.linearRGB);assert.deepEqual(sample.uniforms,{amount:r.amount});}}rows.push({provider:provider.label,profile:c.profile,expressionSHA:c.expressionSHA,loweringSHA:c.loweringSHA});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentPreparedAuthority:false,nativeEvaluator:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-color-return-reopen.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' }); await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, profiles, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' });
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 8);
for (const c of coldCases) for (const file of c.files) assert.equal(hash(await readFile(file.path)), file.sha256);
const report = { issue: 1456, stage: 'MATERIAL_COLOR_RETURN_FUNCTION_SOURCE_CPU', parent, node: process.version, namespaceCount: namespace.length, namespace, sourceGraph,
  accepted, refused, getters, reflections, rows, cold, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path),
  declarationCompatibility: { parent, barrelByteExact: true, manifestUnchanged: true, materialLeafDTSByteExact: true, parentSHA: hash(parentDTS), currentSHA: hash(currentDTS), newPublicTypesOrExports: false },
  actualGL: false, nativeEvaluator: false, linkedShader: false, newShaderSourceFlow: false,
  support: 'Four existing profiles expand pure float-argument/color-return palettes into unchanged IR; independent manual expressions/lowering and scalar-color operation order, actual default/update evaluation only for supported profiles, source-native binding, full original files and genuine cold reconstruction. No vector/noise/texture/layer/generation/graphics/publication claim.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1456, accepted, refused, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
