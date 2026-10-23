import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import { build } from 'esbuild';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const index = process.argv.indexOf('--output');
assert(index >= 0 && process.argv[index + 1], '--output <directory> required');
const output = resolve(process.argv[index + 1]);
await mkdir(output, {recursive: true});
const root = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
// (R6: the package's TypeScript sources bundled, as the other flows do: Node does not load them as they are.)
const bundle = async (from, name) => { const outfile = resolve(output, name); await build({ entryPoints: [from], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile, logLevel: 'warning' }); return outfile; };
const entry = await bundle(resolve(root, manifest.exports['.'].import), 'gpu-source.mjs');
const entrySha256 = createHash('sha256').update(await readFile(entry)).digest('hex');
const gpu = await import(pathToFileURL(entry).href);
// The binding validator is compiled internal code, not a public package export.
const bindingEntry = await bundle(resolve(root, 'src/material/mesh-material.ts'), 'mesh-material-source.mjs');
const bindingEntrySha256 = createHash('sha256').update(await readFile(bindingEntry)).digest('hex');
const {validateMeshMaterialBinding} = await import(pathToFileURL(bindingEntry).href);
const source = color => `/* original source */ @shader #abc { @fragment { color: ${color}; } }`;
const compile = text => {
  const result = gpu.compileMeshMaterial(text);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.material.source, text);
  assert.equal(result.material.shaderId, 'abc');
  return result.material;
};
const cases = [
  {name: 'black', short: source('#000'), long: source('#000000'), hex: '#000000'},
  {name: 'white', short: source('#FFF'), long: source('#FFFFFF'), hex: '#FFFFFF'},
  {name: 'mixed', short: source('#aBc'), long: source('#AABBCC'), hex: '#AABBCC'},
  {name: 'blue', short: source('#12f'), long: source('#1122FF'), hex: '#1122FF'},
  {name: 'nested', short: '@shader #abc { @uniform amount:float(0,1,0.25); @fragment { color:mix(#aBc,#12f,clamp(amount,0,1)); } }', long: '@shader #abc { @uniform amount:float(0,1,0.25); @fragment { color:mix(#AABBCC,#1122FF,clamp(amount,0,1)); } }'},
];
const receipts = [];
for (const fixture of cases) {
  const short = compile(fixture.short), long = compile(fixture.long);
  assert.deepEqual(short.expression, long.expression);
  assert.deepEqual(short.uniforms, long.uniforms);
  const lowered = gpu.lowerMeshMaterial(short);
  assert.deepEqual(lowered, gpu.lowerMeshMaterial(long));
  if (fixture.hex) {
    assert.equal(short.expression.hex, fixture.hex);
    const channels = [1,3,5].map(i => Number.parseInt(fixture.hex.slice(i,i+2),16));
    assert.deepEqual(short.expression.linear, channels.map(n => (n/255)**2.2));
  }
  if (fixture.name === 'white') assert.equal(lowered.expression, 'clamp(vec3(1.0000000000000000,1.0000000000000000,1.0000000000000000),vec3(0.0),vec3(1.0))');
  await writeFile(resolve(output, fixture.name + '.source.css'), fixture.short);
  await writeFile(resolve(output, fixture.name + '.ir.json'), JSON.stringify(short,null,2)+'\n');
  const reopened = JSON.parse(await readFile(resolve(output,fixture.name+'.ir.json'),'utf8'));
  const validated = gpu.validateMeshMaterialIR(reopened);
  assert.deepEqual(validated, short);
  const caller = {material: reopened, uniforms: fixture.name === 'nested' ? {amount: 0.75} : {}};
  const before = JSON.stringify(caller);
  const binding = validateMeshMaterialBinding(caller);
  assert.equal(JSON.stringify(caller), before);
  assert(Object.isFrozen(binding) && Object.isFrozen(binding.material.expression));
  reopened.expression.type = 'tampered';
  if (fixture.name === 'nested') {
    caller.uniforms.amount = 1;
    assert.equal(binding.uniforms.amount, 0.75);
    assert.equal(validateMeshMaterialBinding({material: short, uniforms: {}}).uniforms.amount, 0.25);
  }
  assert.deepEqual(binding.material, short);
  assert.deepEqual(gpu.lowerMeshMaterial(binding.material), lowered);
  await writeFile(resolve(output,fixture.name+'.lowered.json'),JSON.stringify(lowered,null,2)+'\n');
  receipts.push({name: fixture.name, sourcePreserved: true, equivalentTypedIR: true, equivalentLowering: true, reopened: true, copiedBinding: true});
}
const accepted = compile(cases[2].short), before = JSON.stringify(accepted), refusals = [];
for (const token of ['#','#1','#12','#1234','#12345','#1234567','#12345678','#ggg','#1gF']) {
  const text = source(token), result = gpu.compileMeshMaterial(text);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, 'SYNTAX');
  assert.equal(text.slice(result.diagnostics[0].start,result.diagnostics[0].end),token);
  refusals.push({kind: 'color', token, diagnostic: result.diagnostics[0]});
}
for (const [name, mutate] of [
  ['source', value => {value.source = source('#000');}],
  ['hex', value => {value.expression.hex = '#000000';}],
  ['linear', value => {value.expression.linear[0] = 0;}],
  ['version', value => {value.version = 1;}],
]) {
  const value = structuredClone(accepted); mutate(value);
  assert.throws(() => gpu.validateMeshMaterialIR(value), error => error.code === 'IR');
  refusals.push({kind: 'forged-' + name, code: 'IR'});
}
let getterCalls = 0;
const getterIR = {...accepted};
Object.defineProperty(getterIR,'source',{enumerable: true,get(){getterCalls++;return accepted.source;}});
assert.throws(() => gpu.validateMeshMaterialIR(getterIR), error => error.code === 'INPUT');
const getterBinding = {material: accepted, uniforms: {}};
Object.defineProperty(getterBinding,'uniforms',{enumerable: true,get(){getterCalls++;return {};}});
assert.throws(() => validateMeshMaterialBinding(getterBinding), error => error.code === 'INPUT');
assert.equal(getterCalls,0);
refusals.push({kind:'getter-ir',code:'INPUT'},{kind:'getter-binding',code:'INPUT'});
assert.equal(JSON.stringify(accepted),before);
const result = {ok:true,entry,entrySha256,bindingEntry,bindingEntrySha256,profile:accepted.profile,version:accepted.version,cases:receipts,refusals,getterCalls,limits:'Opaque #RGB and #RRGGBB only; original source retained, normalized existing IR/lowering. Public compiler/IR/lowering and separate compiled internal binding witness. CPU/file proof, no new GL/runtime/consumer adoption.'};
await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ok:true,cases:receipts.length,refusals:refusals.length,getterCalls,entrySha256}));
