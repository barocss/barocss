import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pure compiler/evaluator closure only. No package index, Solid engine or UI build.
const pin = '0c9aa7e159d3713a70a4b67631715e027da28fef';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const git = args => execFileSync('git', args, {cwd:root, encoding:'utf8', maxBuffer:4*1024*1024});
assert.equal(git(['rev-parse', `${pin}^{commit}`]).trim(), pin);
const inputs = new Set();
const built = await build({stdin:{contents:`export {compileCadModel} from 'cad:model-compiler'; export {evaluateCurve,evaluateSurface} from 'cad:math';`,resolveDir:root},bundle:true,platform:'node',format:'esm',target:'node22',write:false,plugins:[{name:'pinned-cad-source',setup(b){
  b.onResolve({filter:/^cad:/}, a=>({path:`packages/barocss-cad/src/${a.path.slice(4)}.ts`,namespace:'pinned'}));
  b.onResolve({filter:/^\./,namespace:'pinned'}, a=>({path:posix.normalize(posix.join(posix.dirname(a.importer),a.path)).replace(/\.js$/,'.ts'),namespace:'pinned'}));
  b.onLoad({filter:/.*/,namespace:'pinned'}, a=>{assert.ok(a.path.startsWith('packages/barocss-cad/src/'));assert.ok(!a.path.endsWith('/index.ts'));inputs.add(a.path);return {contents:git(['show',`${pin}:${a.path}`]),loader:'ts'};});
}}]});
const bundle=built.outputFiles[0].contents;
const {compileCadModel,evaluateCurve,evaluateSurface}=await import(`data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`);
const sources=[0,1,2,3].map(v=>readFileSync(resolve(app,`docs/public/examples/source${v}.cad.css`),'utf8'));
const expected=[[10,0,0],[10,0,15],[50,0,15],[50,0,100]];
const compiled=sources.map((source,version)=>{const r=compileCadModel(source,{sourceVersion:version});assert.equal(r.ok,true);return r;});
const results=compiled.map((r,version)=>{const midpoint=version===0?evaluateCurve(r.model.objects[0],.5):evaluateSurface(r.model.objects[1],.5,.5);assert.deepEqual(midpoint,expected[version]);return {sourceVersion:version,irSchemaVersion:r.ir.schemaVersion,modelVersion:r.model.version,objects:r.model.objects.map(({id,kind})=>({id,kind})),midpointMM:midpoint};});
const edited=compileCadModel(sources[3].replace('10 cm','12 cm'),{sourceVersion:3});assert.equal(edited.ok,true);assert.deepEqual(evaluateSurface(edited.model.objects[1],.5,.5),[60,0,120]);assert.deepEqual(evaluateSurface(compiled[3].model.objects[1],.5,.5),[50,0,100]);
const errors=[];
function reject(label,source,version,code){const r=compileCadModel(source,{sourceVersion:version});assert.equal(r.ok,false);assert.equal(r.diagnostics[0].code,code);assert.equal('model' in r,false);const d=r.diagnostics[0];errors.push({label,sourceVersion:version,code:d.code,message:d.message,range:d.range,text:source.slice(d.range.start,d.range.end)});}
for(const kind of ['sketch','constraint','split','intersection','subtract','chamfer','mass','mesh'])reject(`unsupported @${kind}`,sources[3].replace(/}\s*$/,`  @${kind} #operation {}\n}\n`),3,'KIND');
reject('header mismatch',sources[0].replace('version:0','version:1'),0,'VERSION');
reject('Source3 function with Source2 option',sources[3],2,'KIND');
reject('global length parameter needs a unit',sources[3].replace('10 cm','10'),3,'UNIT');
reject('wrong function argument kind',sources[3].replace('scaleLength(value:$width)','scaleLength(value:2)'),3,'FUNCTION_TYPE');
reject('function cannot capture global parameter',sources[3].replace('return:$value*$factor','return:$width*$factor'),3,'FUNCTION_CAPTURE');
reject('division by zero',sources[2].replace('10 cm','10 cm / 0'),2,'DIVISION_ZERO');
const surface='@surface #plane { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[0,0,0],[0,1,0]],[[1,0,0],[1,1,0]]]; weights:[[1,1],[1,1]]; }';
assert.equal(compileCadModel(`@model plane {version:0;length-unit:mm;${surface}}`,{sourceVersion:0}).ok,true);
reject('Source1 does not admit literal surfaces',`@model plane {version:1;length-unit:mm;${surface}}`,1,'KIND');
// Verify the download against only the native demo's pure authored-data factory.
// This is deliberately not parseXYAffinePrismFeatureDocument or a Solid evaluation.
const demo=git(['show',`${pin}:examples/cad-nurbs/xy-affine-prism-feature-document-demo.mjs`]);
const factory=demo.slice(demo.indexOf('function recipe('),demo.indexOf('const edits ='));
assert.ok(factory.startsWith('function recipe('));
const authored=runInNewContext(`${factory} document()`,{}, {timeout:1000});
const fixtureBytes=readFileSync(resolve(app,'docs/public/examples/cad-prism-feature-v0-authored.json'));
const fixture=JSON.parse(fixtureBytes.toString());
// Cross-realm prototype identity is irrelevant; compare canonical JSON and signed zero explicitly.
assert.equal(JSON.stringify(fixture),JSON.stringify(authored));
assert.ok(Object.is(fixture.nodes[0].document.points[0].position[0],-0));
assert.ok(Object.is(fixture.nodes[0].document.constraints[0].target[0],-0));
const page=readFileSync(resolve(app,'docs/packages/cad/language-workflows.md'),'utf8');
for(const error of errors.filter(e=>!e.label.startsWith('unsupported @')||['unsupported @sketch','unsupported @chamfer'].includes(e.label))) {
  if(error.label==='Source1 does not admit literal surfaces') continue;
  assert.ok(page.includes(error.message),`Documented exact diagnostic missing: ${error.label}`);
}
for(let v=0;v<4;v++)assert.ok(page.includes(`<<< ../../public/examples/source${v}.cad.css{css}`));
console.log(JSON.stringify({sourcePin:pin,node:process.versions.node,scope:'pure compiler and geometry evaluation; no Solid engine, full docs build, browser, GPU or file picker',authoredFixture:{bytes:fixtureBytes.length,sha256:createHash('sha256').update(fixtureBytes).digest('hex'),sourceFactoryMatched:true,engineEvaluation:'not run'},sourceInputs:[...inputs].sort(),bundleSha256:createHash('sha256').update(bundle).digest('hex'),results,parameterEdit:{before:[50,0,100],after:[60,0,120],priorResultRetained:true},errors},null,2));
