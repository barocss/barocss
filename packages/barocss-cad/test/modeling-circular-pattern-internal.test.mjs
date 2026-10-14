import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// ZERO-NATIVE wrapper controls. Synthetic data below is deliberately NOT a
// qualified Solid, native Face, native rotation or geometric lineage proof.
// Only validateConvexPlanarSolid and buildModelingRotation are replaced.
// The actual occurrence ledger, comparison/error helpers and rational context
// remain in the bundle. Default execution checks source AND checked emit.
const root = fileURLToPath(new URL('../../..', import.meta.url));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const { build } = require('esbuild');
const entries = process.env.CAD_MODEL_CIRCULAR_PATTERN_INTERNAL_ENTRY
  ? [resolve(process.env.CAD_MODEL_CIRCULAR_PATTERN_INTERNAL_ENTRY)]
  : ['../src/modeling-circular-pattern-internal.ts', '../dist/modeling-circular-pattern-internal.js'].map(path => fileURLToPath(new URL(path, import.meta.url)));
const allowed = new Set(['modeling-circular-pattern-internal', 'convex-planar-solid-proof-internal', 'section-rational-internal']);
const providers = new Map([['convex-planar-solid', 'validateConvexPlanarSolid'], ['modeling-rotation-internal', 'buildModelingRotation']]);
const marker = 'INERT_PATTERN_WRAPPER_CONTROL_NOT_GEOMETRY';
const clone = value => structuredClone(value);
const keys = [];

// One synthetic triangle and one global edge/vertex are intentionally not a
// closed Solid. A validator trap admits it only to exercise wrapper decisions.
function inertParent(x = 0) {
  const points = [[x, -0, 0], [x + 1, -0, 0], [x, -0, 1]];
  const edges = points.map((point, i) => ({ kind: 'curve', id: 'c' + i, degree: 1, knots: [0, 0, 1, 1],
    controlPoints: [point, points[(i + 1) % points.length]], weights: [1, 1] }));
  const face = { plane: { kind: 'surface', id: 'surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[points[0], points[1]], [points[2], points[0]]], weights: [[1, 1], [1, 1]] },
    loop: { id: 'loop', edges }, options: { faceId: 'face', evaluationId: 'model', resultIdPrefix: 'local', orientation: 'forward' },
    topology: { vertices: points.map((point, i) => ({ id: 'lv' + i, point })),
      edges: edges.map((edge, i) => ({ id: 'le' + i, curveId: edge.id, vertexIds: ['lv' + i, 'lv' + (i + 1) % points.length] })),
      loop: { uses: edges.map((edge, i) => ({ id: 'use' + i, edgeId: 'le' + i, curveId: edge.id, pcurveId: 'uv' + i,
        vertexIds: ['lv' + i, 'lv' + (i + 1) % points.length], sense: 'forward', interval: [0, 1] })) } },
    pcurves: edges.map((edge, i) => ({ id: 'uv' + i, curveId: edge.id, edgeId: 'le' + i })) };
  return { controlOnly: marker, request: { options: { solidId: 'parent_solid', resultIdPrefix: 'parent' },
    assets: [{ sourceId: 'source', face }], edgePairs: [] },
    graph: { edges: [{ id: 'global_edge' }], vertices: [{ id: 'global_vertex', pointMM: points[0] }] },
    certificate: { solid: false, controlOnly: marker }, report: { solid: true, controlOnly: marker } };
}
// Independent table, separate from the production signed-axis/sign pairs.
const MAPS = { x: { 90: [1,-3,2], 180: [1,-2,-3], 270: [1,3,-2] },
  y: { 90: [3,2,-1], 180: [-1,2,-3], 270: [-3,2,1] }, z: { 90: [-2,1,3], 180: [-1,-2,3], 270: [2,-1,3] } };
const mapped = (source, spec) => MAPS[spec.axis][spec.degrees].map(entry => entry > 0 ? source[entry-1] : -source[-entry-1]);
function inertChild(parent, spec, prefix) {
  const facePrefix = prefix + '_f0', original = parent.request.assets[0].face;
  const point = source => mapped(source, spec);
  const edges = original.loop.edges.map((edge, i) => ({ ...clone(edge), id: facePrefix + '_curve_' + i, controlPoints: edge.controlPoints.map(point) }));
  const face = { plane: { ...clone(original.plane), id: facePrefix + '_surface', controlPoints: original.plane.controlPoints.map(row => row.map(point)) },
    loop: { id: facePrefix + '_loop', edges }, options: { faceId: facePrefix + '_face', evaluationId: facePrefix + '_model',
      resultIdPrefix: facePrefix, orientation: original.options.orientation },
    topology: { vertices: original.topology.vertices.map((vertex, i) => ({ id: facePrefix + '_v_' + i, point: point(vertex.point) })),
      edges: original.topology.edges.map((edge, i) => ({ id: facePrefix + '_e_' + i, curveId: edges[i].id,
        vertexIds: [facePrefix + '_v_' + i, facePrefix + '_v_' + (i + 1) % edges.length] })),
      loop: { uses: original.topology.loop.uses.map((use, i) => ({ ...clone(use), id: facePrefix + '_use_' + i,
        edgeId: facePrefix + '_e_' + i, curveId: edges[i].id, pcurveId: facePrefix + '_uv_' + i,
        vertexIds: [facePrefix + '_v_' + i, facePrefix + '_v_' + (i + 1) % edges.length] })) } },
    pcurves: original.pcurves.map((curve, i) => ({ id: facePrefix + '_uv_' + i, curveId: edges[i].id, edgeId: facePrefix + '_e_' + i })) };
  const targetReport = { solid: true, controlOnly: marker };
  return { controlOnly: marker, request: { parent: clone(parent), spec: clone(spec), prefix },
    solid: { controlOnly: marker, request: { options: { solidId: prefix + '_solid', resultIdPrefix: prefix + '_s' },
      assets: [{ sourceId: facePrefix + '_src', face }], edgePairs: [] },
      graph: { edges: parent.graph.edges.map((_, i) => ({ id: prefix + '_s_e_' + i })),
        vertices: parent.graph.vertices.map((vertex, i) => ({ id: prefix + '_s_v_' + i, pointMM: point(vertex.pointMM) })) },
      certificate: { solid: true, controlOnly: marker }, report: targetReport },
    lineage: Object.fromEntries(['faces', 'curves', 'pcurves', 'uses', 'localEdges', 'localVertices', 'edges', 'vertices'].map(key => [key, []])),
    report: { controlOnly: marker, parentValidation: clone(parent.report), targetQualification: targetReport,
      directCalls: { parentValidationCount: 1, initialFaceConstructionCount: 1, targetQualificationCount: 1, retries: 0 } } };
}

async function harness(entry) {
  assert.ok(existsSync(entry), 'Checked source/emitted leaf must exist: ' + entry);
  assert.match(basename(entry), /^modeling-circular-pattern-internal\.(?:ts|js)$/);
  const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
  const trapKey = Symbol.for('barocss.circular-pattern-internal.zero-native.' + mode);
  assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap'); keys.push(trapKey);
  const state = { open: false, calls: [], unexpected: [], validatorError: undefined, secondError: undefined, thirdError: undefined, alterChild: undefined };
  const dispatch = (binding, args) => {
    if (!state.open) { state.unexpected.push(binding); throw new Error('UNEXPECTED_PROVIDER_ATTEMPT: ' + binding); }
    const call = { binding, args }; state.calls.push(call);
    if (binding === 'validateConvexPlanarSolid') {
      if (state.validatorError) throw state.validatorError;
      return call.result = clone(args[0].report);
    }
    if (binding === 'buildModelingRotation') {
      const instance = state.calls.filter(call => call.binding === binding).length;
      if (instance === 2 && state.secondError) throw state.secondError;
      if (instance === 3 && state.thirdError) throw state.thirdError;
      call.result = inertChild(...args);
      if (state.alterChild) state.alterChild(call.result, instance);
      return call.result;
    }
    state.unexpected.push(binding); throw new Error('UNKNOWN_PROVIDER_ATTEMPT: ' + binding);
  };
  globalThis[trapKey] = { dispatch };
  const replaced = new Set();
  const bundle = await build({ stdin: { contents: `export * from ${JSON.stringify(entry)};
    export {SolidSnapshotLedger,ConvexPlanarSolidError} from './convex-planar-solid-proof-internal.js';
    export {SectionRationalContext} from './section-rational-internal.js';`, resolveDir: dirname(entry), loader: 'js' },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
    plugins: [{ name: 'pattern-wrapper-native-traps', setup(build) {
      build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
        const key = basename(args.path, extname(args.path));
        if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'pattern-trap' }; }
        assert.ok(allowed.has(key), 'Unreviewed implementation cannot enter wrapper control: ' + args.path);
      });
      build.onLoad({ filter: /.*/, namespace: 'pattern-trap' }, args => ({ contents:
        `export function ${providers.get(args.path)}(...args){return globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(trapKey))})].dispatch(${JSON.stringify(providers.get(args.path))},args);}`, loader: 'js' }));
    } }] });
  assert.deepEqual([...replaced].sort(), [...providers.keys()].sort());
  const actual = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('pattern-trap:') && path !== '<stdin>')
    .map(path => basename(path, extname(path))).sort();
  assert.deepEqual(actual, [...allowed].sort(), 'Only actual leaf, ledger/proof and rational implementations remain');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  return { mode, state, api, run(action, options = {}) {
    state.calls = []; state.validatorError = options.validatorError; state.secondError = options.secondError; state.thirdError = options.thirdError; state.alterChild = options.alterChild;
    state.open = true;
    try { return action(api.buildModelingCircularPattern); } finally { state.open = false; }
  } };
}
function refusal(action, code, stage) {
  let error;
  try { action(); } catch (cause) { error = cause; }
  assert.equal(error?.name, 'ModelingCircularPatternError'); assert.equal(error.code, code);
  if (stage) assert.equal(error.stage, stage);
  assert.equal(Object.hasOwn(error, 'copies'), false, 'No partially accepted pattern');
  assert.ok(Object.isFrozen(error.report)); assert.ok(Object.isFrozen(error.report.completedChildReports));
  return error;
}
const controls = await Promise.all(entries.map(harness));
for (const control of controls) {
  const { mode, state, api, run } = control;
  const calls = binding => state.calls.filter(call => call.binding === binding);
  const noChildren = () => { assert.equal(calls('validateConvexPlanarSolid').length, 1); assert.equal(calls('buildModelingRotation').length, 0); };
  test(mode + ': all axes and signs route the same original to two canonical signed rotations', () => {
    for (const axis of ['x','y','z']) for (const angleDegrees of [90,-90]) {
      const parent = inertParent(2), before = clone(parent), spec = {axis,angleDegrees};
      const result = run(build => build(parent, spec, 'p'));
      assert.equal(calls('validateConvexPlanarSolid').length, 1); const children = calls('buildModelingRotation'); assert.equal(children.length, 2);
      assert.equal(children[0].args[0], children[1].args[0]); assert.notEqual(children[0].args[0], parent);
      assert.ok(Object.isFrozen(children[0].args[0]));
      const specs = [{axis,degrees:angleDegrees === 90 ? 90 : 270},{axis,degrees:180}];
      assert.deepEqual(children.map(call => call.args[1]), specs); assert.deepEqual(result.report.childSpecs, specs);
      assert.deepEqual(children.map(call => call.args[2]), ['p_i1','p_i2']);
      for (const [i,child] of result.copies.entries()) {
        assert.deepEqual(child.solid.request.assets[0].face.plane.controlPoints,
          parent.request.assets[0].face.plane.controlPoints.map(row => row.map(point => mapped(point,specs[i]))));
        assert.deepEqual(child.solid.request.assets[0].face.loop.edges.map(curve => curve.controlPoints),
          parent.request.assets[0].face.loop.edges.map(curve => curve.controlPoints.map(point => mapped(point,specs[i]))));
      }
      assert.deepEqual(result.request.spec, spec); assert.deepEqual(spec,{axis,angleDegrees}); assert.equal(Object.isFrozen(spec),false);
      assert.deepEqual(result.report.directCalls,{parentValidationCount:1,rotationCount:2,retries:0});
      assert.deepEqual(result.report.totalNativeCalls,{parentValidationCount:3,initialFaceConstructionCount:2,targetQualificationCount:2,retries:0});
      assert.deepEqual(result.report.preflight,{copyCount:2,faceCount:2,surfaceCoordinateCount:24,curveCoordinateCount:36});
      assert.equal(result.report.exactWork.operations,0); assert.equal(result.report.exactWork.floatConversions,0);
      assert.deepEqual(parent,before); assert.equal(Object.isFrozen(parent),false); assert.equal(result.copies[0].controlOnly,marker);
    }
  });
  test(mode + ': signed zeros are preserved and sign-mapped in every component', () => {
    const parent = inertParent();
    parent.request.assets[0].face.plane.controlPoints[0][0] = [0,-0,-0];
    for (const axis of ['x','y','z']) for (const angleDegrees of [90,-90]) {
      const result = run(build => build(parent,{axis,angleDegrees},'p'));
      for (const [i,copy] of result.copies.entries()) {
        const actual = copy.solid.request.assets[0].face.plane.controlPoints[0][0], expected = mapped([0,-0,-0],result.report.childSpecs[i]);
        actual.forEach((value,j) => assert.ok(Object.is(value,expected[j])));
      }
    }
  });
  test(mode + ': every stored pole is bounded before either child constructor', () => {
    for (const field of ['surface','curve']) {
      const parent = inertParent();
      if (field === 'surface') parent.request.assets[0].face.plane.controlPoints[1][1][2] = 10001;
      else parent.request.assets[0].face.loop.edges.at(-1).controlPoints.at(-1)[2] = 10001;
      const error = refusal(() => run(build => build(parent,{axis:'z',angleDegrees:90},'p')),'REPRESENTABILITY','stage-coefficients');
      noChildren(); assert.equal(error.report.directCalls.rotationCount,0); assert.equal(error.report.exactWork.operations,0);
    }
  });
  test(mode + ': full global and local namespace collisions refuse before children', () => {
    for (const alter of [parent => {parent.graph.edges[0].id='p_i2_s_e_0';}, parent => {parent.request.assets[0].face.pcurves[0].id='p_i1_f0_uv_0';}]) {
      const parent=inertParent(); alter(parent);
      refusal(() => run(build => build(parent,{axis:'x',angleDegrees:90},'p')),'IDENTITY','identity'); noChildren();
    }
  });
  test(mode + ': own parent and spec getters are refused without execution', () => {
    let reads=0; const parent=inertParent(); Object.defineProperty(parent,'report',{enumerable:true,get(){reads++;return {};}});
    refusal(() => run(build => build(parent,{axis:'x',angleDegrees:90},'p')),'INPUT','snapshot');
    assert.equal(state.calls.length,0); assert.equal(reads,0);
    const spec={axis:'x',angleDegrees:90}; Object.defineProperty(spec,'angleDegrees',{enumerable:true,get(){reads++;return 90;}});
    refusal(() => run(build => build(inertParent(),spec,'p')),'INPUT','snapshot'); assert.equal(state.calls.length,0); assert.equal(reads,0);
  });
  test(mode + ': second child failure preserves first report and original cause', () => {
    const progress={directCalls:{parentValidationCount:1,initialFaceConstructionCount:0,targetQualificationCount:0,retries:0}};
    const cause=Object.assign(new Error('inert second rotation refusal'),{code:'OWNED',report:progress});
    const parent=inertParent(), before=clone(parent);
    const error=refusal(() => run(build => build(parent,{axis:'y',angleDegrees:-90},'p'),{secondError:cause}),'OWNED','copy-construction');
    assert.equal(error.cause,cause); assert.equal(cause.report,progress); assert.equal(Object.isFrozen(progress),false);
    const children=calls('buildModelingRotation'); assert.equal(children.length,2); assert.equal(error.report.directCalls.rotationCount,2);
    assert.equal(error.report.completedChildReports.length,1); assert.equal(error.report.completedChildReports[0],children[0].result.report);
    assert.ok(Object.isFrozen(error.report.completedChildReports[0])); assert.equal(error.entity,'p_i2'); assert.deepEqual(parent,before);
  });
  test(mode + ': both actual child coefficient sets must match preflight including zero signs', () => {
    for (const field of ['surface','curve']) for (const alteration of ['value','zero-sign']) {
      const parent=inertParent(); parent.request.assets[0].face.plane.controlPoints[0][0]=[0,-0,-0];
      parent.request.assets[0].face.loop.edges[0].controlPoints[0]=[0,-0,-0];
      const error=refusal(() => run(build => build(parent,{axis:'z',angleDegrees:90},'p'),{alterChild(child,instance){
        if(instance===2) {
          const face=child.solid.request.assets[0].face, pole=field==='surface' ? face.plane.controlPoints[0][0] : face.loop.edges[0].controlPoints[0];
          pole[0]=alteration==='value' ? 1 : -pole[0];
        }
      }}),'BINDING','copy-binding');
      assert.equal(error.report.directCalls.rotationCount,2); assert.equal(error.report.completedChildReports.length,2);
    }
  });
  test(mode + ': actual child spec and namespace changes are refused', () => {
    for (const alteration of ['spec','namespace']) {
      const error=refusal(() => run(build => build(inertParent(),{axis:'x',angleDegrees:90},'p'),{alterChild(child,instance){
        if(instance===2) { if(alteration==='spec') child.request.spec.degrees=90; else child.solid.graph.edges[0].id='unexpected'; }
      }}),alteration==='spec' ? 'OWNED' : 'IDENTITY','copy-binding');
      assert.equal(error.report.directCalls.rotationCount,2);
    }
  });
  test(mode + ': both copies require complete actual qualification flags', () => {
    for (const field of ['certificate','parentValidation','targetQualification']) {
      const error=refusal(() => run(build => build(inertParent(),{axis:'x',angleDegrees:90},'p'),{alterChild(child,instance){
        if(instance===2) { if(field==='certificate') child.solid.certificate.solid=false; else child.report[field].solid=false; }
      }}),'OWNED','copy-binding');
      assert.equal(error.report.completedChildReports.length,2); assert.equal(error.report.directCalls.rotationCount,2);
    }
  });
  test(mode + ': inventory and occurrence budgets remain real ledger refusals', () => {
    const parent=inertParent(); parent.request.assets=Array.from({length:11},()=>parent.request.assets[0]);
    refusal(() => run(build => build(parent,{axis:'x',angleDegrees:90},'p')),'BUDGET','admission'); noChildren();
    const excessive=inertParent(); excessive.extra='x'.repeat(262145);
    refusal(() => run(build => build(excessive,{axis:'x',angleDegrees:90},'p')),'BUDGET','snapshot'); assert.equal(state.calls.length,0);
    const ledger=new api.SolidSnapshotLedger(), aliases=['q'.repeat(262144),'q'.repeat(262144)];
    ledger.copy(aliases,true,true); assert.ok(ledger.bytes>524288); assert.equal(ledger.retainedBytes,0);
  });
  test(mode + ': parent validator cause and completion boundary remain unchanged', () => {
    const cause=new api.ConvexPlanarSolidError('CONVEXITY','inert parent validator refusal');
    const error=refusal(() => run(build => build(inertParent(),{axis:'x',angleDegrees:90},'p'),{validatorError:cause}),'CONVEXITY','parent-validation');
    noChildren(); assert.equal(error.cause,cause); assert.equal(error.report.parentValidation,null);
    assert.deepEqual(error.report.completedChildReports,[]); assert.equal(error.report.exactWork.operations,0);
  });
  test(mode + ': legacy three-instance data keeps its exact v0 field inventory', () => {
    const parent=inertParent(),spec={axis:'x',angleDegrees:90},result=run(build=>build(parent,spec,'p'));
    assert.deepEqual(Object.keys(result).sort(),['copies','report','request']);
    assert.deepEqual(Object.keys(result.request).sort(),['parent','prefix','spec']);
    assert.deepEqual(Object.keys(result.request.spec).sort(),['angleDegrees','axis']);
    assert.deepEqual(Object.keys(result.report).sort(),['childReports','childSpecs','count','dataCharge','directCalls','exactWork','lengthUnit','limits',
      'numericPolicy','parentValidation','persistentNamingCertified','preflight','preservation','schema','totalNativeCalls','validationScope','version']);
    assert.deepEqual(Object.keys(result.report),['schema','version','lengthUnit','count','parentValidation','childSpecs','childReports','directCalls',
      'totalNativeCalls','preflight','exactWork','preservation','limits','numericPolicy','validationScope','persistentNamingCertified','dataCharge']);
    assert.deepEqual(Object.keys(result.report.preservation),['sameOriginalParent','bothCopiesPreflighted','independentSourceNamespaces','completeQualifiedCopies','originalPreserved']);
    assert.deepEqual(result.report.preservation,{sameOriginalParent:true,bothCopiesPreflighted:true,independentSourceNamespaces:true,completeQualifiedCopies:true,originalPreserved:true});
    assert.equal(result.report.schema,'barocss-modeling-circular-pattern');assert.equal(result.report.version,0);assert.equal(result.report.count,3);
    assert.deepEqual(result.copies,[inertChild(parent,{axis:'x',degrees:90},'p_i1'),inertChild(parent,{axis:'x',degrees:180},'p_i2')]);
    assert.equal(result.copies.length,2);assert.equal(Object.hasOwn(result.copies,'2'),false);
    const checkDefined=value=>{if(value!==null&&typeof value==='object')for(const child of Object.values(value)){assert.notEqual(child,undefined);checkDefined(child);}};
    checkDefined(result);
  });
  test(mode + ': four instances route three canonical copies from the same original for all axes and signs', () => {
    for(const axis of ['x','y','z'])for(const angleDegrees of [90,-90]){
      const parent=inertParent(2),before=clone(parent),spec={axis,angleDegrees,count:4},result=run(build=>build(parent,spec,'p'));
      const children=calls('buildModelingRotation'),degrees=angleDegrees===90?[90,180,270]:[270,180,90],specs=degrees.map(degrees=>({axis,degrees}));
      assert.equal(calls('validateConvexPlanarSolid').length,1);assert.equal(children.length,3);
      assert.ok(children.every(child=>child.args[0]===children[0].args[0]));assert.notEqual(children[0].args[0],parent);assert.ok(Object.isFrozen(children[0].args[0]));
      assert.deepEqual(children.map(child=>child.args[1]),specs);assert.deepEqual(result.report.childSpecs,specs);
      assert.deepEqual(children.map(child=>child.args[2]),['p_i1','p_i2','p_i3']);
      assert.equal(result.copies.length,3);assert.deepEqual(result.request.spec,spec);assert.deepEqual(parent,before);assert.equal(Object.isFrozen(parent),false);
      assert.deepEqual(result.report.childReports,result.copies.map(copy=>copy.report));
      assert.deepEqual(result.report.directCalls,{parentValidationCount:1,rotationCount:3,retries:0});
      assert.deepEqual(result.report.totalNativeCalls,{parentValidationCount:4,initialFaceConstructionCount:3,targetQualificationCount:3,retries:0});
      assert.deepEqual(result.report.preflight,{copyCount:3,faceCount:3,surfaceCoordinateCount:36,curveCoordinateCount:54});
      assert.deepEqual(result.report.preservation,{sameOriginalParent:true,allCopiesPreflighted:true,independentSourceNamespaces:true,completeQualifiedCopies:true,originalPreserved:true});
      assert.equal(result.report.count,4);assert.equal(Object.hasOwn(result.report.preservation,'bothCopiesPreflighted'),false);
      assert.deepEqual(result.report.exactWork,{operations:0,gcdSteps:0,floatSearchSteps:0,floatConversions:0,maximumObservedBits:0});
      for(const [i,child]of result.copies.entries()){
        assert.deepEqual(child.solid.request.assets[0].face.plane.controlPoints,parent.request.assets[0].face.plane.controlPoints.map(row=>row.map(p=>mapped(p,specs[i]))));
        assert.deepEqual(child.solid.request.assets[0].face.loop.edges.map(curve=>curve.controlPoints),parent.request.assets[0].face.loop.edges.map(curve=>curve.controlPoints.map(p=>mapped(p,specs[i]))));
      }
    }
  });
  test(mode + ': all three-copy stored Surface and Curve signs match the independent table', () => {
    const parent=inertParent();parent.request.assets[0].face.plane.controlPoints[0][0]=[0,-0,-0];parent.request.assets[0].face.loop.edges[0].controlPoints[0]=[0,-0,-0];
    for(const axis of ['x','y','z'])for(const angleDegrees of [90,-90]){
      const result=run(build=>build(parent,{axis,angleDegrees,count:4},'p'));
      for(const [i,copy]of result.copies.entries())for(const point of [copy.solid.request.assets[0].face.plane.controlPoints[0][0],copy.solid.request.assets[0].face.loop.edges[0].controlPoints[0]]){
        const expected=mapped([0,-0,-0],result.report.childSpecs[i]);point.forEach((value,j)=>assert.ok(Object.is(value,expected[j])));
      }
    }
  });
  test(mode + ': third-copy namespaces are reserved before the first child constructor', () => {
    for(const alter of [parent=>{parent.graph.vertices[0].id='p_i3_s_v_0';},parent=>{parent.request.assets[0].face.topology.loop.uses[0].id='p_i3_f0_use_0';}]){
      const parent=inertParent();alter(parent);
      const error=refusal(()=>run(build=>build(parent,{axis:'z',angleDegrees:-90,count:4},'p')),'IDENTITY','identity');
      noChildren();assert.equal(error.report.directCalls.rotationCount,0);
    }
  });
  test(mode + ': four-instance coefficient and budget refusals precede all child constructors', () => {
    const parent=inertParent();parent.request.assets[0].face.loop.edges.at(-1).controlPoints.at(-1)[2]=10001;
    refusal(()=>run(build=>build(parent,{axis:'y',angleDegrees:90,count:4},'p')),'REPRESENTABILITY','stage-coefficients');noChildren();
    const excessive=inertParent();excessive.extra='x'.repeat(262145);
    refusal(()=>run(build=>build(excessive,{axis:'x',angleDegrees:90,count:4},'p')),'BUDGET','snapshot');assert.equal(state.calls.length,0);
  });
  test(mode + ': third-child failure keeps two complete reports and the untouched original cause', () => {
    const progress={directCalls:{parentValidationCount:1,initialFaceConstructionCount:0,targetQualificationCount:0,retries:0}};
    const cause=Object.assign(new Error('inert third rotation refusal'),{code:'OWNED',report:progress});const parent=inertParent(),before=clone(parent);
    const error=refusal(()=>run(build=>build(parent,{axis:'y',angleDegrees:-90,count:4},'p'),{thirdError:cause}),'OWNED','copy-construction');
    const children=calls('buildModelingRotation');assert.equal(children.length,3);assert.equal(error.cause,cause);assert.equal(error.cause.report,progress);assert.equal(Object.isFrozen(progress),false);
    assert.equal(error.report.completedChildReports.length,2);assert.equal(error.report.directCalls.rotationCount,3);assert.equal(error.entity,'p_i3');
    error.report.completedChildReports.forEach((report,i)=>{assert.equal(report,children[i].result.report);assert.ok(Object.isFrozen(report));});assert.deepEqual(parent,before);
  });
  test(mode + ': third-copy coefficient, qualification and namespace tampering never return a partial pattern', () => {
    for(const field of ['surface','curve','qualification','namespace']){
      const parent=inertParent();parent.request.assets[0].face.plane.controlPoints[0][0]=[0,-0,-0];parent.request.assets[0].face.loop.edges[0].controlPoints[0]=[0,-0,-0];
      const code=field==='qualification'?'OWNED':field==='namespace'?'IDENTITY':'BINDING';
      const error=refusal(()=>run(build=>build(parent,{axis:'z',angleDegrees:90,count:4},'p'),{alterChild(child,instance){if(instance===3){
        if(field==='qualification')child.report.targetQualification.solid=false;
        else if(field==='namespace')child.solid.graph.edges[0].id='p_i1_s_e_0';
        else {const face=child.solid.request.assets[0].face,pole=field==='surface'?face.plane.controlPoints[0][0]:face.loop.edges[0].controlPoints[0];pole[0]=-pole[0];}
      }}}),code,'copy-binding');assert.equal(error.report.completedChildReports.length,3);assert.equal(error.report.directCalls.rotationCount,3);
    }
  });
  test(mode + ': four-instance count getters and hidden or foreign specs refuse before validation', () => {
    let reads=0;const spec={axis:'x',angleDegrees:90};Object.defineProperty(spec,'count',{enumerable:true,get(){reads++;return 4;}});
    refusal(()=>run(build=>build(inertParent(),spec,'p')),'INPUT','snapshot');assert.equal(reads,0);assert.equal(state.calls.length,0);
    const hidden={axis:'x',angleDegrees:90};Object.defineProperty(hidden,'count',{value:4,enumerable:false});
    const foreign=Object.assign(Object.create({}),{axis:'x',angleDegrees:90,count:4});
    for(const input of [hidden,foreign]){refusal(()=>run(build=>build(inertParent(),input,'p')),'INPUT','snapshot');assert.equal(state.calls.length,0);}
  });
  test(mode + ': malformed specs and long prefixes refuse before parent validation', () => {
    for(const spec of [null,[],{}, {axis:'x',angleDegrees:90,count:3},{axis:'x',angleDegrees:90,count:5},{axis:'x',angleDegrees:90,count:0}, {axis:'w',angleDegrees:90},{axis:'x',angleDegrees:180}, {axis:'x',angleDegrees:0},
      {axis:'x',degrees:90},{axis:'x',angleDegrees:90,extra:true}]) {
      refusal(() => run(build => build(inertParent(),spec,'p')),'INPUT','admission'); assert.equal(state.calls.length,0);
    }
    refusal(() => run(build => build(inertParent(),{axis:'x',angleDegrees:90},'abcdefghijklmn')),'IDENTITY','admission'); assert.equal(state.calls.length,0);
  });
}

after(() => {
  for (const { state } of controls) { assert.deepEqual(state.unexpected, []); assert.equal(state.open, false); }
  for (const key of keys) delete globalThis[key];
});
