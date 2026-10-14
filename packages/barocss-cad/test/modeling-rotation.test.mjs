import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #1949. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_ROTATION_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_ROTATION_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-rotation.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
  ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
  ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
  ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
  ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
  ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
  ['modeling-translation-internal', 'buildModelingTranslation'], ['modeling-rotation-internal', 'buildModelingRotation'], ['modeling-mirror-internal', 'buildModelingMirror'], ['modeling-scale-internal', 'buildModelingScale'], ['modeling-linear-pattern-internal', 'buildModelingLinearPattern'], ['modeling-circular-pattern-internal', 'buildModelingCircularPattern'], ['modeling-stl-internal', 'buildModelingStl'],
  ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ['convex-planar-solid-mass', 'measureConvexPlanarSolidMass'], ['axis-box-solid-mass', 'measureAxisBoxSolidBooleanMass'],
]);
const pureModules = new Set(['modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], rotationError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_ROTATION_CONTROL_NOT_GEOMETRY';
// Selector-routing data only. These four vertices/two edges are deliberately
// not a closed Solid and never establish native finishing/copy correctness.
function inertFinishedSolid(solidId) {
  const vertices = [[0, 0, 8], [32, 0, 8], [0, 24, 8], [32, 24, 8]].map((pointMM, i) => ({ id: 'v' + i, pointMM }));
  const edges = [[0, 1], [2, 3]].map((pair, i) => ({ id: 'e' + i, vertexIds: pair.map(j => 'v' + j),
    uses: [0, 1].map(j => ({ sourceId: solidId + '_src' + j, faceId: 'face' + j, surfaceId: 'surface' + j,
      loopId: 'loop' + j, use: { id: 'use' + i + j, curveId: 'curve' + i + j, pcurveId: 'uv' + i + j } })) }));
  return { controlOnly: marker, request: { options: { solidId } }, graph: { vertices, edges } };
}
function dispatch(binding, args) {
  if (state.phase !== 'mock-native') {
    state.unexpected.push(binding); throw new Error('UNEXPECTED_PROVIDER_ATTEMPT: ' + binding);
  }
  const call = { binding, args }; state.calls.push(call);
  if (binding === 'buildXYAffineSketch') return call.result = { controlOnly: marker, document: clone(args[0]),
    solution: { points: clone(args[0].points) }, report: { controlOnly: marker, fullyConstrained: true, degreesOfFreedom: 0 } };
  if (binding === 'buildXYAffineSketchPrism') return call.result = { controlOnly: marker,
    request: { sketch: clone(args[0]), options: clone(args[1]) },
    solid: state.finished ? inertFinishedSolid(args[1].solidId)
      : { controlOnly: marker, sourceId: args[1].sourceId, solidId: args[1].solidId, authoredOptions: clone(args[1]) },
    report: { controlOnly: marker }, lineage: { controlOnly: marker } };
  if (binding === 'chamferConvexPlanarSolid' && state.finished) {
    if (state.chamferError) throw state.chamferError;
    return call.result = { controlOnly: marker, request: { parent: args[0] },
      split: { negative: { kind: 'solid', solid: inertFinishedSolid(args[3].retainedSolidId) } } };
  }
  if (binding === 'buildModelingRotation') {
    if (state.rotationError !== undefined) throw state.rotationError;
    return call.result = { controlOnly: marker, request: { parent: clone(args[0]), spec: clone(args[1]), prefix: args[2] },
      solid: { controlOnly: marker, solidId: args[2] + '_inert_solid' },
      report: { controlOnly: marker, nested: { sentinel: 'complete-inert-report' } },
      lineage: { controlOnly: marker, sentinel: ['not-a-geometric-correspondence'] } };
  }
  if (binding === 'buildXYArc') return call.result = { controlOnly: marker, curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
  if (binding === 'buildXYCirclePrismShell' || binding === 'qualifyStoredCirclePrismSolid') return call.result = { controlOnly: marker };
  state.unexpected.push(binding); throw new Error('UNUSED_MOCK_PROVIDER: ' + binding);
}
globalThis[trapKey] = { dispatch };
const virtualEntry = `export * from ${JSON.stringify(entry)};
export { modelingGraphKey, modelingNodeParameters, modelingReusablePrefix } from './modeling-regeneration-internal.js';
export { signedJson } from './xy-affine-prism-feature-document-internal.js';`;
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'rotation-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-rotation-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'rotation-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'rotation-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-rotation.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('rotation-trap:') && !path.endsWith('rotation-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-rotation-admission-' + mode);
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory);
  const save = (name, bytes) => { writeFileSync(resolve(directory, name), bytes, { flag: 'wx' }); return { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; };
  provenance = { directory, entry, mode, testSHA256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    virtualEntry: save('entry.mjs', virtualEntry), bundle: save('bundle.mjs', bundle.outputFiles[0].text),
    metafile: save('bundle.metafile.json', JSON.stringify(bundle.metafile, null, 2) + '\n'),
    inputs: save('input-hashes.json', JSON.stringify(Object.fromEntries(inputPaths.map(path => [path, sha256(readFileSync(resolve(path)))])), null, 2) + '\n'),
    replacedProviderBindings: [...providers.values()].sort() };
}
after(() => {
  const counts = Object.fromEntries([...new Set(state.calls.map(call => call.binding))].sort().map(binding => [binding, state.calls.filter(call => call.binding === binding).length]));
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1949,
    scope: 'Actual modeling facade and unchanged pure helpers; isolated inert providers; admission and routing only, no geometric acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertProviderCalls: counts,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function mockNative(action, error) {
  assert.equal(state.phase, 'closed'); state.phase = 'mock-native'; state.rotationError = error;
  try { return action(); } finally { state.phase = 'closed'; state.rotationError = undefined; }
}
function mockFinishing(action, chamferError) {
  assert.equal(state.finished, undefined); state.finished = true; state.chamferError = chamferError;
  try { return mockNative(action); } finally { delete state.finished; delete state.chamferError; }
}
function refuses(action, code, operation, noProvider = true) {
  const before = state.calls.length; let caught;
  assert.throws(action, error => {
    caught = error; assert.ok(error instanceof CadModelError, String(error));
    if (code) assert.ok((Array.isArray(code) ? code : [code]).includes(error.code), `Expected ${code}, received ${error.code}: ${error.message}`);
    else assert.notEqual(error.code, 'NATIVE');
    if (operation) assert.equal(error.operation, operation); return true;
  });
  if (noProvider) assert.equal(state.calls.length, before, 'Admission refusal must precede every provider');
  assert.deepEqual(state.unexpected, []); return caught;
}
function frozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child, seen);
}
function retained(snapshot) {
  return { save: snapshot.save(), json: JSON.stringify(snapshot), identities: Object.fromEntries(
    ['bodies', 'parameters', 'suppression', 'features', 'evidence', 'recomputation'].map(key => [key, snapshot[key]])) };
}
function unchanged(snapshot, before) {
  assert.equal(snapshot.save(), before.save); assert.equal(JSON.stringify(snapshot), before.json);
  for (const [key, value] of Object.entries(before.identities)) assert.equal(snapshot[key], value);
  frozen(snapshot);
}
const rectangle = model => model.sketch.rectangle({ width: 32, height: 24 });
function fixedPolygon(builder) {
  return [[0, 0], [32, 0], [32, 24], [0, 24]].map(value => { const point = builder.point(value); builder.fixed(point); return point; });
}

const options = (axis='x',angleDegrees=90) => ({axis,angleDegrees});
const aliases = new Map([[90,90],[180,180],[270,270],[-90,270],[-180,180],[-270,90]]);
const doc = (axis='x',angleDegrees=90) => ({format:'barocss-cad-model',schema:1,units:'mm',parameters:{},nodes:[
  {kind:'sketch',profile:'rectangle',min:[-0,0],max:[32,24]},{kind:'extrude',sketch:0,height:8},
  {kind:'rotate',parent:{node:1,side:'solid'},axis,angleDegrees}],outputs:{flat:{node:1,side:'solid'},upright:{node:2,side:'solid'}}});
const part = () => {const model=createCadModel();return {model,flat:rectangle(model).extrude(8)};};
function pair(axis,angleDegrees) {const {model,flat}=part(),upright=flat.rotate(options(axis,angleDegrees));return mockNative(()=>model.build({flat,upright}));}

test('all twenty-four facade providers are replaced; direct source provenance excludes native implementations',()=>{
  assert.equal(replaced.size,24);assert.equal(inputPaths.length,pureModules.size);
  const start=state.calls.length,snapshot=pair('x',90),calls=state.calls.slice(start);
  assert.deepEqual(calls.map(c=>c.binding),['buildXYAffineSketch','buildXYAffineSketchPrism','buildModelingRotation']);
  assert.equal(calls[2].args[0],snapshot.bodies.flat.native);assert.deepEqual(calls[2].args[1],{axis:'x',degrees:90});assert.equal(calls[2].args[2],'m2');
  assert.equal(snapshot.bodies.upright.native,calls[2].result.solid);assert.equal(snapshot.bodies.upright.family,'convex-planar');assert.equal(snapshot.evidence[2].native,calls[2].result);
  assert.deepEqual(snapshot.features.map(f=>[f.kind,f.dependencies]),[['sketch',[]],['extrude',[0]],['rotate',[1]]]);assert.equal(CadModelLimits.nodes,6);frozen(snapshot);
});
test('all axes and six explicit aliases retain authored angle and route separate canonical maps',()=>{
  for(const axis of ['x','y','z'])for(const [angleDegrees,degrees]of aliases){
    const snapshot=pair(axis,angleDegrees),saved=JSON.parse(snapshot.save());
    assert.equal(saved.nodes[2].angleDegrees,angleDegrees);assert.deepEqual(snapshot.evidence[2].native.request.spec,{axis,degrees});
    const cold=mockNative(()=>loadCadModel(snapshot.save()));assert.equal(cold.save(),snapshot.save());
    assert.deepEqual(cold.bodies,snapshot.bodies);assert.deepEqual(cold.evidence,snapshot.evidence);
  }
});
test('exact one-record admission rejects malformed data without consuming a node',()=>{
  const {model,flat}=part();let reads=0;
  const getter={axis:'x'};Object.defineProperty(getter,'angleDegrees',{enumerable:true,get(){reads++;return 90;}});
  const hidden=options();Object.defineProperty(hidden,'hidden',{value:1});const symbol=options();symbol[Symbol('x')]=1;
  const hostile=Object.create({axis:'x',angleDegrees:90});const revoked=Proxy.revocable(options(),{});revoked.revoke();
  const args=[[],[undefined],[null],[options(),undefined],[[]],[getter],[hidden],[symbol],[hostile],[revoked.proxy],
    [{axis:'x'}],[{angleDegrees:90}],[{axis:'w',angleDegrees:90}],[{axis:[1,0,0],angleDegrees:90}],
    [{...options(),pivot:[0,0]}],[{...options(),degrees:90}]];
  for(const angleDegrees of [0,-0,360,-360,45,89.99999999999999,NaN,Infinity,'90',{parameter:'angle'}])args.push([options('x',angleDegrees)]);
  for(const value of args)refuses(()=>flat.rotate(...value));assert.equal(reads,0);
  const snapshot=mockNative(()=>model.build({upright:flat.rotate(options())}));assert.deepEqual(JSON.parse(snapshot.save()).nodes.map(n=>n.kind),['sketch','extrude','rotate']);
});
test('own-data options are snapshotted without invoking Proxy get traps',()=>{
  for(const replacement of [45,'throw']){
    const {model,flat}=part();let reads=0;
    const value=new Proxy(options(),{get(){reads++;if(replacement==='throw')throw Error('hostile-get');return replacement;}});
    const upright=flat.rotate(value),snapshot=mockNative(()=>model.build({upright}));
    assert.equal(reads,0);assert.equal(JSON.parse(snapshot.save()).nodes[2].angleDegrees,90);
    assert.deepEqual(snapshot.evidence[2].native.request.spec,{axis:'x',degrees:90});
  }
});
test('borrowed receivers and length dimensions refuse before routing',()=>{
  const {model,flat}=part();const f=flat.rotate;refuses(()=>f(options()));refuses(()=>f.call({},options()));
  const other=part().flat;refuses(()=>f.call(other,options()));refuses(()=>flat.rotate(options('x',model.parameter('angle',90))));
  const data=Object.assign(Object.create(null),options());flat.rotate(data);
});
test('world-origin terminal copy blocks chaining and later features on retained handles',()=>{
  const {model,flat}=part(),upright=flat.rotate(options());
  for(const shape of [flat,upright]){refuses(()=>shape.rotate(options()));if(shape===flat)refuses(()=>shape.translate([1,0,0]));refuses(()=>shape.hole({center:[1,1],radius:1}));refuses(()=>shape.split({axis:'z',at:4}));}
  refuses(()=>model.sketch.rectangle({width:2,height:2}));
  refuses(()=>model.sketch.polygon([[0,0],[2,0],[0,2]]));
  const translated=part().flat.translate([1,0,0]);refuses(()=>translated.rotate(options()));
});
test('supported affine provenance includes placed extrusion and complete finishing prefix',()=>{
  for(const profile of ['rectangle','polygon','constrained']){
    const model=createCadModel(),sketch=profile==='rectangle'?rectangle(model):profile==='polygon'?model.sketch.polygon([[0,0],[32,0],[32,24],[0,24]]):model.sketch.constrainedPolygon(fixedPolygon);
    const flat=sketch.extrude(8,{from:-2}),upright=flat.rotate(options('y',180));
    const snapshot=mockNative(()=>model.build({flat,upright}));assert.equal(JSON.parse(snapshot.save()).nodes[1].from,-2);
  }
  for(const count of [1,2]){
    const {model,flat}=part(),front=flat.chamfer(flat.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
    const finished=count===1?front:front.chamfer(front.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),2);
    const upright=finished.rotate(options());const snapshot=mockFinishing(()=>model.build({flat:finished,upright}));
    assert.deepEqual(snapshot.features.map(f=>f.kind),['sketch','extrude',...Array(count).fill('chamfer'),'rotate']);
  }
});
test('unsupported ancestry and finishing siblings refuse without provider calls',()=>{
  {const model=createCadModel(),circle=model.sketch.circle({center:[0,0],radius:4}).extrude(8);refuses(()=>circle.rotate(options()));}
  {const {flat}=part();refuses(()=>flat.hole({center:[8,8],radius:2}).rotate(options()));}
  {const {flat}=part();refuses(()=>flat.split({axis:'z',at:4}).negative.rotate(options()));}
  for(const operation of ['union','intersect','cut']){const {model,flat}=part(),tool=rectangle(model).extrude(4);refuses(()=>flat[operation](tool).rotate(options()));}
  {const {flat}=part();const front=flat.chamfer(flat.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
    refuses(()=>flat.chamfer(flat.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),2));refuses(()=>flat.rotate(options()));assert.ok(front);}
});
test('same-model callback fences already-held rotation handles; failed callback preserves admission',()=>{
  const {model,flat}=part();let callback=false;
  model.sketch.constrainedPolygon(s=>{callback=true;refuses(()=>flat.rotate(options()));return fixedPolygon(s);});assert.equal(callback,true);
  const upright=flat.rotate(options());assert.ok(upright);
  const other=part();const otherShape=other.flat.rotate(options());assert.ok(otherShape);
});
test('strict codec rejects missing/extra fields, invalid angle, parent and later nodes before evaluation',()=>{
  const mutations=[d=>delete d.nodes[2].axis,d=>delete d.nodes[2].angleDegrees,d=>d.nodes[2].pivot=[0,0],d=>d.nodes[2].angleDegrees=0,
    d=>d.nodes[2].angleDegrees={parameter:'x'},d=>d.nodes[2].axis='w',d=>d.nodes[2].parent.side='negative',d=>d.nodes[2].parent.node=0,
    d=>d.nodes.push({kind:'extrude',sketch:0,height:4}),d=>d.nodes.push({...d.nodes[2],parent:{node:2,side:'solid'}}),d=>d.nodes[2].kind='affine'];
  for(const edit of mutations){const d=doc();edit(d);refuses(()=>loadCadModel(signedJson(d)));}
  const old=doc();old.nodes.pop();old.outputs={flat:{node:1,side:'solid'}};const snapshot=mockNative(()=>loadCadModel(signedJson(old)));assert.equal(Object.hasOwn(JSON.parse(snapshot.save()).nodes[1],'from'),false);
  const duplicate=signedJson(doc()).replace('"angleDegrees":90','"angleDegrees":90,"angleDegrees":90');refuses(()=>loadCadModel(duplicate));
});
test('native refusal retains complete original cause and leaves accepted snapshot unchanged',()=>{
  const snapshot=pair('x',90),held=retained(snapshot),cause=new Error('native Gram refusal');cause.report={completed:'parent-validation',retries:0};
  const error=refuses(()=>mockNative(()=>loadCadModel(snapshot.save()),cause),'NATIVE','rotate',false);assert.equal(error.cause,cause);assert.equal(error.cause.report,cause.report);unchanged(snapshot,held);
});

// Pure mapping exports from the actual internal source. Every imported native
// binding is replaced by a throwing trap, and the exact bundle is retained.
const mapEntry=resolve(dirname(entry),'modeling-rotation-internal'+extname(entry));
const mapBindings={ 'own-convex-planar-face':['buildConvexPlanarFace'], 'convex-planar-solid':['qualifyConvexPlanarSolid','validateConvexPlanarSolid'],
  'convex-planar-solid-proof-internal':['check','id','same','SolidSnapshotLedger','ConvexPlanarSolidError'], 'section-rational-internal':['SectionRationalContext'] };
let mapAttempts=0;const mapKey=Symbol.for('barocss.modeling-rotation.coefficient-trap');globalThis[mapKey]=()=>{mapAttempts++;throw Error('UNEXPECTED_MAP_NATIVE');};
const mapBundle=await build({stdin:{contents:`export { rotateCardinalPoint, rotateCardinalCurve, rotateCardinalSurface } from ${JSON.stringify(mapEntry)};`,resolveDir:dirname(entry),sourcefile:'rotation-map-entry.mjs',loader:'js'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true,
 plugins:[{name:'rotation-map-native-trap',setup(b){b.onResolve({filter:/\.(?:ts|js)$/},args=>{const key=basename(args.path,extname(args.path));if(mapBindings[key])return{path:key,namespace:'map-trap'};assert.equal(key,'modeling-rotation-internal');});b.onLoad({filter:/.*/,namespace:'map-trap'},args=>({loader:'js',contents:mapBindings[args.path].map(name=>`export const ${name}=function(){return globalThis[Symbol.for('barocss.modeling-rotation.coefficient-trap')]();};`).join('\n')}));}}]});
const {rotateCardinalPoint:rotate,rotateCardinalCurve,rotateCardinalSurface}=await import('data:text/javascript;base64,'+Buffer.from(mapBundle.outputFiles[0].text).toString('base64'));
if(provenance){const dir=provenance.directory;writeFileSync(resolve(dir,'map-bundle.mjs'),mapBundle.outputFiles[0].text,{flag:'wx'});writeFileSync(resolve(dir,'map-metafile.json'),JSON.stringify(mapBundle.metafile,null,2)+'\n',{flag:'wx'});provenance.map={entry:mapEntry,sourceSHA256:sha256(readFileSync(mapEntry)),bundleSHA256:sha256(mapBundle.outputFiles[0].text),nativeBindingsReplaced:mapBindings};}
after(()=>{delete globalThis[mapKey];assert.equal(mapAttempts,0);});
const MAPS={x:{90:[1,-3,2],180:[1,-2,-3],270:[1,3,-2]},y:{90:[3,2,-1],180:[-1,2,-3],270:[-3,2,1]},z:{90:[-2,1,3],180:[-1,-2,3],270:[2,-1,3]}};
const oracle=(point,axis,degrees)=>MAPS[axis][degrees].map(c=>c>0?point[c-1]:-point[-c-1]);
test('nine proper cardinal maps and every authored alias have exact bitwise coefficient controls',()=>{
 for(const axis of ['x','y','z'])for(const [,degrees]of aliases)for(const point of [[2,3,5],[0,-0,0],[-0,0,-0],[Number.MIN_VALUE,-Number.MIN_VALUE,-0],[10000,-10000,0]]){
  const actual=rotate(point,{axis,degrees}),expected=oracle(point,axis,degrees);actual.forEach((value,i)=>assert.ok(Object.is(value,expected[i])));
 }
 for(const axis of ['x','y','z'])for(const degrees of [90,180,270]){
  const permutation=MAPS[axis][degrees];let inversions=0;for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(Math.abs(permutation[i])>Math.abs(permutation[j]))inversions++;
  assert.equal((-1)**inversions*permutation.reduce((v,c)=>v*Math.sign(c),1),1);
 }
});
test('curves and surfaces retain copied basis and exact signed coefficient grids',()=>{
 const c={kind:'curve',id:'c',degree:1,knots:[-0,0,1,1],weights:[1,1],controlPoints:[[-0,2,3],[4,-0,6]]};
 const s={kind:'surface',id:'s',degreeU:1,degreeV:1,knotsU:[-0,0,1,1],knotsV:[0,0,1,1],weights:[[1,1],[1,1]],controlPoints:[[c.controlPoints[0],c.controlPoints[1]],[[7,8,-0],[10,11,12]]]};
 for(const axis of ['x','y','z'])for(const degrees of [90,180,270]){const spec={axis,degrees},a=rotateCardinalCurve(c,spec),b=rotateCardinalSurface(s,spec);
  assert.deepEqual(a.controlPoints,c.controlPoints.map(p=>oracle(p,axis,degrees)));assert.deepEqual(b.controlPoints,s.controlPoints.map(row=>row.map(p=>oracle(p,axis,degrees))));
  for(const field of ['degree','knots','weights'])assert.deepEqual(a[field],c[field]);for(const field of ['degreeU','degreeV','knotsU','knotsV','weights'])assert.deepEqual(b[field],s[field]);
  assert.notEqual(a.knots,c.knots);assert.notEqual(a.weights,c.weights);assert.notEqual(b.weights[0],s.weights[0]);a.controlPoints[0][0]=999;assert.ok(Object.is(c.controlPoints[0][0],-0));
 }
});
test('pure maps refuse nonfinite/unsupported data without reading property getters',()=>{
 for(const degrees of [0,45,360,-90])assert.throws(()=>rotate([1,2,3],{axis:'x',degrees}),RangeError);
 for(const point of [[NaN,2,3],[Infinity,2,3],[10001,2,3],[1,2]])assert.throws(()=>rotate(point,{axis:'x',degrees:90}),RangeError);
 let reads=0;const point=new Proxy([1,2,3],{get(){reads++;throw Error('get');}}),spec=new Proxy({axis:'x',degrees:90},{get(){reads++;throw Error('get');}});
 assert.deepEqual(rotate(point,spec),[1,-3,2]);assert.equal(reads,0);
 const getter=[1,2,3];Object.defineProperty(getter,'0',{enumerable:true,get(){reads++;return 1;}});assert.throws(()=>rotate(getter,{axis:'x',degrees:90}),RangeError);assert.equal(reads,0);
 const revoked=Proxy.revocable([1,2,3],{});revoked.revoke();assert.throws(()=>rotate(revoked.proxy,{axis:'x',degrees:90}),RangeError);
});
