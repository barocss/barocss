import assert from 'node:assert/strict';
import {
  createHash
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import {
  createRequire
} from 'node:module';
import {
  resolve
} from 'node:path';
import {
  fileURLToPath,
  pathToFileURL
} from 'node:url';
const args = process.argv.slice(2);
assert.equal(args.length,
2,
'Usage: node source-curve-knot-insertion-demo.mjs --source <output-directory>');
assert.equal(args[0],
'--source');
const repo = resolve(fileURLToPath(new URL('../../',
import.meta.url))),
output = resolve(args[1]);
mkdirSync(output,
{
  recursive: true
});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo,
'package.json')),
esbuild = require('esbuild'),
entry = resolve(repo,
'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({
  absWorkingDir: repo,
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  write: false,
  metafile: true
});
assert.equal(bundle.outputFiles.length,
1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo,
path)),
cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for(const leaf of ['source-curve-knot-insertion.ts',
'curve-knot-insertion.ts',
'source-curve-control-polygon.ts',
'index.ts'])assert.ok(cadInputs.includes(resolve(repo,
'packages/barocss-cad/src',
leaf)),
leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo,
'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {
  insertSourceCurveKnot:insert,
  validateSourceCurveKnotInsertion:validate,
  SourceCurveKnotInsertionError:InsertionError,
  SourceCurveKnotInsertionDiagnosticCode:codes,
  compileCadModel,
  evaluateCurve,
  evaluateCurveD1,
  editSourceCurveControlPolygon,
  validateSourceCurveControlPolygonEdit,
  insertCurveKnot:oldInsert
} = api;
const runtimeNames=['insertSourceCurveKnot',
'validateSourceCurveKnotInsertion',
'SourceCurveKnotInsertionError',
'SourceCurveKnotInsertionDiagnosticCode'];
const typeNames=['SourceCurveKnotInsertionRequest',
'SourceCurveKnotInsertionPatch',
'SourceCurveKnotInsertionReport',
'SourceCurveKnotInsertionResult'];
for(const name of runtimeNames)assert.equal(typeof api[name],
name.endsWith('Code')?'object':'function');
assert.deepEqual(Object.keys(codes).sort(),
['INPUT',
'VERSION',
'IDENTITY',
'SOURCE',
'TARGET',
'REQUEST',
'BUDGET',
'REPRESENTABILITY',
'BINDING',
'NATIVE',
'OWNED',
'FILE'].sort());
const files = new Map(),
retained = [],
accepted = [],
cases = [],
failures = [],
priorRefusals = [];
function nativeJSON(value) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value));
    return Object.is(value,
    -0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || ['string',
  'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key,
  child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function jsonFile(name,
value) {
  const file = resolve(output,
  name + '.json');
  const text = nativeJSON(value) + '\n';
  assert.ok(text.length <= 2097152 && Buffer.byteLength(text,
  'utf8') <= 2097152,
  name + ' file size');
  writeFileSync(file,
  text);
  files.set(file,
  readFileSync(file));
  const reopened = JSON.parse(readFileSync(file,
  'utf8'));
  assert.deepEqual(reopened,
  value);
  return {
    file,
    reopened
  }
  ;
}
function sourceFile(name,
source,
model) {
  const file = resolve(output,
  name + '.source0.css');
  assert.ok(source.length <= 262144 && Buffer.byteLength(source,
  'utf8') <= 262144,
  name + ' source size');
  writeFileSync(file,
  source);
  files.set(file,
  readFileSync(file));
  const cold = compileCadModel(readFileSync(file,
  'utf8'),
  {
    sourceVersion: 0
  }
  );
  assert.equal(cold.ok,
  true,
  JSON.stringify(cold.diagnostics));
  assert.deepEqual(cold.model,
  model);
  return file;
}
function ownership(inputs,
result) {
  const caller = new WeakSet(),
  seen = new WeakSet();
  const collect = value => {
    if (value && typeof value === 'object' && !caller.has(value)) {
      caller.add(value);
      Object.values(value).forEach(collect);
    }
  }
  ;
  inputs.forEach(collect);
  const visit = value => {
    if (value && typeof value === 'object') {
      assert.ok(!caller.has(value),
      'Caller alias');
      assert.ok(!seen.has(value),
      'Repeated result occurrence');
      seen.add(value);
      Object.values(value).forEach(visit);
    }
  }
  ;
  visit(result);
}
function decimal(value) {
  if (Object.is(value,
  -0)) return '-0';
  const text = String(value);
  if (!text.includes('e')) return text;
  const [mantissa,
  exponentText] = text.split('e'),
  negative = mantissa.startsWith('-'),
  raw = negative ? mantissa.slice(1) : mantissa,
  [whole,
  fraction = ''] = raw.split('.'),
  digits = whole + fraction,
  place = whole.length + Number(exponentText),
  expanded = place <= 0 ? '0.' + '0'.repeat(-place) + digits : place >= digits.length ? digits + '0'.repeat(place - digits.length) : digits.slice(0,
  place) + '.' + digits.slice(place);
  return (negative ? '-' : '') + expanded;
}
function modelSource(model) {
  const list = values => '[' + values.map(decimal).join(',') + ']',
  poles = points => '[' + points.map(list).join(',') + ']';
  const object = item => item.kind === 'curve' ? '@curve #' + item.id + ' {type:nurbs;degree:' + item.degree + ';knots:' + list(item.knots) + ';control-points:' + poles(item.controlPoints) + ';weights:' + list(item.weights) + ';}' : '@surface #' + item.id + ' {type:nurbs;degree-u:' + item.degreeU + ';degree-v:' + item.degreeV + ';knots-u:' + list(item.knotsU) + ';knots-v:' + list(item.knotsV) + ';control-points:[' + item.controlPoints.map(poles).join(',') + '];weights:[' + item.weights.map(list).join(',') + '];}';
  return '/* #1327 original π source; preserve sibling bits */\r\n@model ' + model.name + ' {version:0;length-unit:mm;' + model.objects.map(object).join('') + '}\r\n';
}
function asset(sourceId,
model,
surface,
name = sourceId) {
  const source = modelSource(model);
  sourceFile(name + '.original-whole',
  source,
  model);
  const result = {
    sourceId,
    source,
    surface
  }
  ;
  retained.push({
    value: result,
    before: structuredClone(result)
  }
  );
  return result;
}
const gcd = (a,
b) => {
  a = a < 0n ? -a : a;
  while (b) [a,
  b] = [b,
  a % b];
  return a;
},
fraction = (n,
d = 1n) => {
  assert.ok(d > 0n);
  const g = gcd(n,
  d);
  return [n / g,
  d / g];
};
const add = (a,
b) => fraction(a[0] * b[1] + b[0] * a[1],
a[1] * b[1]),
sub = (a,
b) => add(a,
[-b[0],
b[1]]),
mul = (a,
b) => fraction(a[0] * b[0],
a[1] * b[1]),
divide = (a,
b) => {
  assert.notEqual(b[0],
  0n);
  return b[0] > 0n ? fraction(a[0] * b[1],
  a[1] * b[0]) : fraction(-a[0] * b[1],
  -a[1] * b[0]);
},
abs = a => [a[0] < 0n ? -a[0] : a[0],
a[1]];
const compare = (a,
b) => a[0] * b[1] < b[0] * a[1] ? -1 : a[0] * b[1] > b[0] * a[1] ? 1 : 0,
published = value => {
  assert.deepEqual(Object.keys(value).sort(),
  ['numerator',
  'denominator'].sort());
  const result = fraction(BigInt(value.numerator),
  BigInt(value.denominator));
  assert.equal(result[0].toString(),
  value.numerator);
  assert.equal(result[1].toString(),
  value.denominator);
  return result;
};
function represented(value) {
  if (value === 0) return [0n,
  1n];
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0,
  value,
  false);
  const raw = view.getBigUint64(0,
  false),
  negative = raw >> 63n,
  exponent = Number((raw >> 52n) & 2047n),
  mantissa = (raw & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n),
  power = exponent ? exponent - 1075 : -1074;
  return fraction((negative ? -mantissa : mantissa) * (power >= 0 ? 1n << BigInt(power) : 1n),
  power < 0 ? 1n << BigInt(-power) : 1n);
}
function auditProof(value) {
  assert.notEqual(typeof value,
  'bigint');
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value,
  'numerator') && Object.hasOwn(value,
  'denominator')) published(value);
  if (Object.hasOwn(value,
  'exact') && Object.hasOwn(value,
  'upper')) {
    const exact = published(value.exact);
    assert.ok(exact[0] >= 0n);
    assert.ok(Number.isFinite(value.upper));
    assert.ok(compare(represented(value.upper),
    exact) >= 0);
    if (exact[0] === 0n) assert.ok(Object.is(value.upper,
    0));
    else {
      const view = new DataView(new ArrayBuffer(8));
      view.setFloat64(0,
      value.upper,
      false);
      view.setBigUint64(0,
      view.getBigUint64(0,
      false) - 1n,
      false);
      assert.ok(compare(represented(view.getFloat64(0,
      false)),
      exact) < 0);
    }
  }
  Object.values(value).forEach(auditProof);
}
const asDTO = value => ({
  numerator: value[0].toString(),
  denominator: value[1].toString()
});
const z=[0n,
1n],
o=[1n,
1n],
sum=values=>values.reduce(add,
z),
neg=a=>[-a[0],
a[1]],
zero=value=>assert.deepEqual(value,
asDTO(z));
const polyAdd=(a,
b)=>Array.from({
  length:Math.max(a.length,
  b.length)
},
(_,
i)=>add(a[i]??z,
b[i]??z));
const polyScale=(a,
c)=>a.map(v=>mul(v,
c));
function polyProduct(a,
b){
  const values=Array.from({
    length:a.length+b.length-1
  }
  ,
  ()=>z);
  for(let i=0;
  i<a.length;
  i++)for(let j=0;
  j<b.length;
  j++)values[i+j]=add(values[i+j],
  mul(a[i],
  b[j]));
  return values;
}
const polyAt=(a,
t)=>a.reduceRight((result,
v)=>add(mul(result,
t),
v),
z),
polyDerivative=a=>a.slice(1).map((v,
i)=>mul(v,
[BigInt(i+1),
1n]));
// Exact Cox basis polynomials on one union span, in its local coordinate.
function basisPolynomials(knots,
degree,
a,
b){
  const U=knots.map(represented),
  mid=divide(add(a,
  b),
  [2n,
  1n]),
  width=sub(b,
  a);
  let N=U.slice(0,
  -1).map((v,
  i)=>[compare(mid,
  v)>=0&&compare(mid,
  U[i+1])<0?o:z]);
  for(let k=1;
  k<=degree;
  k++)N=Array.from({
    length:N.length-1
  }
  ,
  (_,
  i)=>{
    let left=[z],
    right=[z];
    const dl=sub(U[i+k],
    U[i]),
    dr=sub(U[i+k+1],
    U[i+1]);
    if(dl[0]!==0n)left=polyProduct(N[i],
    [divide(sub(a,
    U[i]),
    dl),
    divide(width,
    dl)]);
    if(dr[0]!==0n)right=polyProduct(N[i+1],
    [divide(sub(U[i+k+1],
    a),
    dr),
    neg(divide(width,
    dr))]);
    return polyAdd(left,
    right);
  }
  );
  return N;
}
const lift=curve=>curve.controlPoints.map((p,
i)=>[...p.map(v=>mul(represented(v),
represented(curve.weights[i]))),
represented(curve.weights[i])]);
function homogeneousPolynomial(curve,
H,
a,
b){
  const basis=basisPolynomials(curve.knots,
  curve.degree,
  a,
  b);
  assert.equal(basis.length,
  H.length);
  return [0,
  1,
  2,
  3].map(axis=>basis.reduce((result,
  N,
  i)=>polyAdd(result,
  polyScale(N,
  H[i][axis])),
  [z]));
}
function distinct(values){
  const result=[];
  for(const value of values)if(!result.some(v=>v===value))result.push(value);
  return result.sort((a,
  b)=>a<b?-1:a>b?1:0);
}
// Ideal insertion identity and actual represented rounding are separate outputs.
function idealOracle(result){
  const c=result.originalCurve,
  knot=result.request.knot,
  p=c.degree,
  U=c.knots,
  H=lift(c),
  n=H.length-1,
  s=U.filter(v=>v===knot).length;
  let span=-1;
  for(let i=p;
  i<=n;
  i++)if(U[i]<=knot&&knot<U[i+1])span=i;
  assert.ok(span>=p);
  const next=Array(H.length+1),
  unchangedPoles=[];
  for(let i=0;
  i<=span-p;
  i++){
    next[i]=H[i];
    unchangedPoles.push({
      originalPoleIndex:i,
      refinedPoleIndex:i
    }
    );
  }
  for(let i=span-s;
  i<=n;
  i++){
    next[i+1]=H[i];
    unchangedPoles.push({
      originalPoleIndex:i,
      refinedPoleIndex:i+1
    }
    );
  }
  unchangedPoles.sort((a,
  b)=>a.refinedPoleIndex-b.refinedPoleIndex);
  const generated=[],
  actualStep=result.provenance.steps[0],
  homStep=result.provenance.homogeneousSteps[0];
  assert.equal(actualStep.insertion,
  1);
  assert.equal(actualStep.spanIndex,
  span);
  assert.equal(actualStep.priorMultiplicity,
  s);
  for(let i=span-p+1;
  i<=span-s;
  i++){
    const alpha=divide(sub(represented(knot),
    represented(U[i])),
    sub(represented(U[i+p]),
    represented(U[i])));
    next[i]=H[i].map((v,
    axis)=>add(mul(alpha,
    v),
    mul(sub(o,
    alpha),
    H[i-1][axis])));
    const entry=actualStep.generatedPoles.find(e=>e.refinedPoleIndex===i),
    h=homStep.generatedPoles.find(e=>e.refinedPoleIndex===i);
    assert.ok(entry&&h);
    assert.equal(entry.leftPriorPoleIndex,
    i-1);
    assert.equal(entry.rightPriorPoleIndex,
    i);
    assert.ok(Object.is(entry.alpha,
    (knot-U[i])/(U[i+p]-U[i])));
    assert.deepEqual(h.left,
    c.controlPoints[i-1].map(v=>v*c.weights[i-1]).concat(c.weights[i-1]));
    assert.deepEqual(h.right,
    c.controlPoints[i].map(v=>v*c.weights[i]).concat(c.weights[i]));
    assert.deepEqual(h.generated,
    h.right.map((v,
    axis)=>h.alpha*v+(1-h.alpha)*h.left[axis]));
    const actual=lift(result.curve)[i];
    generated.push({
      index:i,
      idealAlpha:asDTO(alpha),
      storedAlphaResidual:asDTO(sub(represented(entry.alpha),
      alpha)),
      idealH:next[i].map(asDTO),
      nativeBlendResidual:h.generated.map((v,
      axis)=>asDTO(sub(represented(v),
      next[i][axis]))),
      storedCartesianWeightResidual:actual.map((v,
      axis)=>asDTO(sub(v,
      next[i][axis])))
    }
    );
  }
  assert.deepEqual(result.provenance.unchangedPoles,
  unchangedPoles);
  const unchangedKnots=U.map((_,
  originalKnotIndex)=>({
    originalKnotIndex,
    refinedKnotIndex:originalKnotIndex<=span?originalKnotIndex:originalKnotIndex+1
  }
  ));
  assert.deepEqual(result.provenance.unchangedKnots,
  unchangedKnots);
  for(const map of unchangedPoles){
    assert.deepEqual(c.controlPoints[map.originalPoleIndex],
    result.curve.controlPoints[map.refinedPoleIndex]);
    assert.ok(Object.is(c.weights[map.originalPoleIndex],
    result.curve.weights[map.refinedPoleIndex]));
  }
  for(const map of unchangedKnots)assert.ok(Object.is(U[map.originalKnotIndex],
  result.curve.knots[map.refinedKnotIndex]));
  const refinedKnots=[...U.slice(0,
  span+1),
  knot,
  ...U.slice(span+1)];
  assert.deepEqual(result.curve.knots,
  refinedKnots);
  const breaks=distinct([...U,
  ...refinedKnots]),
  spans=[];
  for(let i=0;
  i<breaks.length-1;
  i++){
    if(!(breaks[i+1]>breaks[i]))continue;
    const a=represented(breaks[i]),
    b=represented(breaks[i+1]),
    before=homogeneousPolynomial(c,
    H,
    a,
    b),
    ideal=homogeneousPolynomial(result.curve,
    next,
    a,
    b),
    stored=homogeneousPolynomial(result.curve,
    lift(result.curve),
    a,
    b),
    idealResidual=before.map((poly,
    axis)=>polyAdd(ideal[axis],
    polyScale(poly,
    [-1n,
    1n]))),
    storedResidual=before.map((poly,
    axis)=>polyAdd(stored[axis],
    polyScale(poly,
    [-1n,
    1n])));
    assert.ok(idealResidual.flat().every(v=>v[0]===0n));
    spans.push({
      domain:[breaks[i],
      breaks[i+1]],
      originalH:before.map(poly=>poly.map(asDTO)),
      idealRefinedH:ideal.map(poly=>poly.map(asDTO)),
      actualStoredH:stored.map(poly=>poly.map(asDTO)),
      idealResidual:idealResidual.map(poly=>poly.map(asDTO)),
      actualStoredResidual:storedResidual.map(poly=>poly.map(asDTO))
    }
    );
  }
  return {
    spanIndex:span,
    priorMultiplicity:s,
    generated,
    spans,
    idealWholePiecewiseHomogeneousIdentity:true,
    actualStoredExact:spans.every(s=>s.actualStoredResidual.flat().every(v=>v.numerator==='0'))
  }
  ;
}
function exactPointDerivative(curve,
parameter){
  const breaks=distinct(curve.knots),
  at=represented(parameter);
  let index=breaks.findIndex((v,
  i)=>i<breaks.length-1&&parameter>=v&&parameter<=breaks[i+1]);
  assert.ok(index>=0);
  const a=represented(breaks[index]),
  b=represented(breaks[index+1]),
  width=sub(b,
  a),
  local=divide(sub(at,
  a),
  width),
  H=homogeneousPolynomial(curve,
  lift(curve),
  a,
  b),
  values=H.map(poly=>polyAt(poly,
  local)),
  derivatives=H.map(poly=>divide(polyAt(polyDerivative(poly),
  local),
  width)),
  w=values[3],
  dw=derivatives[3];
  return {
    point:values.slice(0,
    3).map(v=>divide(v,
    w)),
    derivative:values.slice(0,
    3).map((v,
    i)=>divide(sub(mul(derivatives[i],
    w),
    mul(v,
    dw)),
    mul(w,
    w)))
  }
  ;
}
function stations(a,
b){
  const domain=[a.knots[a.degree],
  a.knots[a.controlPoints.length]],
  values=[...domain];
  for(const curve of [a,
  b]){
    const breaks=distinct(curve.knots.filter(v=>v>=domain[0]&&v<=domain[1]));
    for(let i=0;
    i<breaks.length;
    i++){
      if(!values.some(v=>v===breaks[i]))values.push(breaks[i]);
      if(i+1<breaks.length){
        const mid=breaks[i]+(breaks[i+1]-breaks[i])/2;
        assert.ok(mid>breaks[i]&&mid<breaks[i+1]);
        if(!values.some(v=>v===mid))values.push(mid);
      }
    }
  }
  return values.sort((a,
  b)=>a<b?-1:a>b?1:0);
}
function d1State(curve,
t){
  try{
    return {
      status:'evaluated',
      value:evaluateCurveD1(curve,
      t)
    }
    ;
  }
  catch(error){
    assert.ok(error instanceof Error);
    assert.match(error.message,
    /exact C0 interior knot/);
    return {
      status:'refused-c0',
      name:error.name,
      reason:error.message,
      value:null
    }
    ;
  }
}
function nativeOracle(result){
  const parameters=stations(result.originalCurve,
  result.curve),
  observations=[];
  let evaluated=0,
  refused=0,
  maxPoint=0,
  maxDerivative=0;
  for(const [i,
  parameter]of parameters.entries()){
    const originalPointMM=evaluateCurve(result.originalCurve,
    parameter),
    refinedPointMM=evaluateCurve(result.curve,
    parameter),
    originalD1=d1State(result.originalCurve,
    parameter),
    refinedD1=d1State(result.curve,
    parameter),
    pointDifferenceMM=Math.hypot(...refinedPointMM.map((v,
    k)=>v-originalPointMM[k]));
    let relativeDerivativeDifference=null;
    if(originalD1.status==='evaluated'&&refinedD1.status==='evaluated')relativeDerivativeDifference=Math.hypot(...refinedD1.value.derivative.map((v,
    k)=>v-originalD1.value.derivative[k]))/Math.max(1,
    Math.hypot(...originalD1.value.derivative),
    Math.hypot(...refinedD1.value.derivative));
    assert.ok(pointDifferenceMM<=1e-7);
    assert.ok(relativeDerivativeDifference===null||relativeDerivativeDifference<=1e-7);
    for(const [curve,
    point,
    state]of [[result.originalCurve,
    originalPointMM,
    originalD1],
    [result.curve,
    refinedPointMM,
    refinedD1]]){
      const ideal=exactPointDerivative(curve,
      parameter);
      for(let k=0;
      k<3;
      k++)assert.ok(compare(abs(sub(represented(point[k]),
      ideal.point[k])),
      represented(1e-7))<=0);
      if(state.status==='evaluated'){
        evaluated++;
        for(let k=0;
        k<3;
        k++)assert.ok(compare(abs(sub(represented(state.value.derivative[k]),
        ideal.derivative[k])),
        mul(represented(1e-7),
        add(o,
        abs(ideal.derivative[k]))))<=0);
      }
      else refused++;
    }
    maxPoint=Math.max(maxPoint,
    pointDifferenceMM);
    maxDerivative=Math.max(maxDerivative,
    relativeDerivativeDifference??0);
    const observation={
      parameter,
      originalPointMM,
      refinedPointMM,
      pointDifferenceMM,
      originalD1,
      refinedD1,
      relativeDerivativeDifference
    }
    ;
    assert.deepEqual(result.report.observations[i],
    observation);
    observations.push(observation);
  }
  assert.equal(result.report.observations.length,
  parameters.length);
  assert.ok(Object.is(result.report.maximumPointDifferenceMM,
  maxPoint));
  assert.ok(Object.is(result.report.maximumRelativeDerivativeDifference,
  maxDerivative));
  return {
    count:parameters.length,
    evaluated,
    refused,
    observations
  }
  ;
}
function mixedSource(curve){
  const values=a=>'[ '+a.map(decimal).join(' , ')+ ' ]';
  const points=a=>'[\r\n'+a.map(p=>'  '+values(p)).join(' ,\r\n')+'\r\n]';
  return '/* complete original π source — preserve CRLF and sibling spellings */\r\n'+
  '@model knot_model { version: 0; length-unit: mm;\r\n'+
  '/* unrelated Curve before selected declaration */\r\n'+
  '@curve #unused_curve {type:nurbs;degree:1;knots:[-0,-0,+1.000,1];control-points:[[-0,-0,-0],[+2.000,3,4]];weights:[1.000,1];}\r\n'+
  '@curve #'+curve.id+' { /* fields outside the arrays remain unchanged */ type:nurbs;degree:'+curve.degree+';\r\n'+
  'weights: '+values(curve.weights)+';\r\ncontrol-points: '+points(curve.controlPoints)+';\r\nknots: '+values(curve.knots)+'; }\r\n'+
  '@surface #unused_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[-0,-0,1,1];knots-v:[0,0,1,1];control-points:[[[-0,-0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}\r\n'+
  '/* unchanged closing source Ω */\r\n}\r\n';
}
function sourceOracle(result){
  const original=compileCadModel(result.request.source,
  {
    sourceVersion:0
  }
  );
  assert.equal(original.ok,
  true,
  JSON.stringify(original.diagnostics));
  assert.deepEqual(original.model,
  result.originalModel);
  const index=result.originalModel.objects.findIndex(o=>o.id===result.request.curveId);
  assert.equal(index,
  1);
  assert.deepEqual(result.originalModel.objects[index],
  result.originalCurve);
  const declaration=original.ast.declarations.find(d=>d.kind==='curve'&&d.id===result.request.curveId);
  const patches=result.provenance.patches;
  assert.equal(patches.length,
  3);
  assert.deepEqual(patches.map(p=>p.field).sort(),
  ['control-points',
  'knots',
  'weights']);
  let last=0,
  shift=0;
  for(const patch of patches){
    const node=declaration.fields.find(f=>f.name===patch.field).value;
    assert.equal(patch.startUTF16,
    node.range.start);
    assert.equal(patch.endUTF16,
    node.range.end);
    assert.ok(patch.startUTF16>=last);
    assert.equal(result.request.source.slice(patch.startUTF16,
    patch.endUTF16),
    patch.originalText);
    assert.equal(result.request.source.slice(last,
    patch.startUTF16),
    result.source.slice(last+shift,
    patch.startUTF16+shift));
    assert.equal(result.source.slice(patch.startUTF16+shift,
    patch.startUTF16+shift+patch.replacementText.length),
    patch.replacementText);
    shift+=patch.replacementText.length-(patch.endUTF16-patch.startUTF16);
    last=patch.endUTF16;
  }
  assert.equal(result.request.source.slice(last),
  result.source.slice(last+shift));
  let applied=result.request.source;
  for(const patch of patches.slice().reverse())applied=applied.slice(0,
  patch.startUTF16)+patch.replacementText+applied.slice(patch.endUTF16);
  assert.equal(applied,
  result.source);
  const candidate=compileCadModel(result.source,
  {
    sourceVersion:0
  }
  );
  assert.equal(candidate.ok,
  true,
  JSON.stringify(candidate.diagnostics));
  assert.deepEqual(candidate.model,
  result.model);
  const expected=structuredClone(original.model);
  expected.objects[index]=structuredClone(result.curve);
  assert.deepEqual(candidate.model,
  expected);
  assert.equal(result.curve.id,
  result.originalCurve.id);
  assert.equal(result.curve.degree,
  result.originalCurve.degree);
  assert.deepEqual(result.provenance.domain,
  [result.originalCurve.knots[result.originalCurve.degree],
  result.originalCurve.knots[result.originalCurve.controlPoints.length]]);
  assert.deepEqual(result.provenance.parameterMap,
  {
    kind:'identity',
    formula:'u=t',
    d1Factor:1
  }
  );
  return {
    selectedObjectIndex:index,
    threeActualArrayPatches:true,
    allOutsideCodeUnitsPreserved:true,
    allSiblingsAndHeaderBitsPreserved:true
  }
  ;
}
const requestFor=(source,
curveId,
knot)=>({
  source,
  sourceVersion:0,
  curveId,
  knot,
  maximumObservations:128
});
function positive(name,
curve,
knot){
  const source=mixedSource(curve),
  request=requestFor(source,
  curve.id,
  knot),
  cold=compileCadModel(source,
  {
    sourceVersion:0
  }
  );
  assert.equal(cold.ok,
  true,
  JSON.stringify(cold.diagnostics));
  assert.deepEqual(cold.model.objects[1],
  curve);
  const originalFile=sourceFile(name+'.original',
  source,
  cold.model),
  before=structuredClone(request),
  requestFile=jsonFile(name+'.request',
  request);
  const result=insert(request);
  assert.deepEqual(request,
  before);
  ownership([request],
  result);
  assert.deepEqual(Object.keys(result).sort(),
  ['request',
  'source',
  'originalModel',
  'model',
  'originalCurve',
  'curve',
  'provenance',
  'report'].sort());
  assert.deepEqual(result.request,
  request);
  const ideal=idealOracle(result),
  native=nativeOracle(result),
  sourceProof=sourceOracle(result),
  report=result.report;
  assert.deepEqual(report.directCounts,
  {
    originalCompileCount:1,
    candidateCompileCount:1,
    coefficientInsertionCallCount:1,
    insertedKnotCount:1,
    nativeCurveValidationCount:2,
    domainQueryCount:2,
    patchCount:3,
    decimalEmissionCount:4*result.curve.controlPoints.length+result.curve.knots.length,
    observationCount:native.count,
    curveD0Count:2*native.count,
    curveD1AttemptCount:2*native.count,
    curveD1EvaluatedCount:native.evaluated,
    curveD1RefusedCount:native.refused,
    sourceWriterCallCount:0,
    publicRefinementCallCount:0,
    loftCallCount:0,
    rationalOperationCount:0
  }
  );
  assert.deepEqual(report.sourceSizes,
  {
    original:{
      utf16:source.length,
      utf8:Buffer.byteLength(source)
    }
    ,
    candidate:{
      utf16:result.source.length,
      utf8:Buffer.byteLength(result.source)
    }
  }
  );
  assert.deepEqual(report.fileSizes,
  {
    request:{
      utf16:(nativeJSON(request)+'\n').length,
      utf8:Buffer.byteLength(nativeJSON(request)+'\n')
    }
    ,
    result:{
      utf16:(nativeJSON(result)+'\n').length,
      utf8:Buffer.byteLength(nativeJSON(result)+'\n')
    }
  }
  );
  for(const field of ['topologyCertified',
  'solid',
  'globalShapeErrorCertified',
  'globalBinary64ErrorCertified',
  'g1g2Certified',
  'manufacturingToleranceCertified',
  'editorDisplayCertified',
  'persistentTopologyBindingCertified',
  'publication'])assert.equal(report.quality[field],
  false);
  assert.equal(report.quality.geometricValidity,
  'not-certified');
  assert.equal(report.quality.localShapeObservations,
  true);
  for(const value of Object.values(report.preservation))assert.equal(value,
  true);
  const candidateFile=sourceFile(name+'.candidate',
  result.source,
  result.model),
  saved=jsonFile(name+'.result',
  result);
  jsonFile(name+'.independent-math-oracle',
  ideal);
  jsonFile(name+'.independent-native-oracle',
  native);
  jsonFile(name+'.independent-source-oracle',
  sourceProof);
  retained.push({
    value:request,
    before
  }
  );
  accepted.push({
    result,
    beforeResult:structuredClone(result)
  }
  );
  cases.push({
    name,
    requestFile:requestFile.file,
    resultFile:saved.file,
    originalFile,
    candidateFile,
    degree:curve.degree,
    originalPoles:curve.controlPoints.length,
    refinedPoles:result.curve.controlPoints.length,
    observations:native.count,
    idealIdentity:ideal.idealWholePiecewiseHomogeneousIdentity,
    actualStoredExact:ideal.actualStoredExact
  }
  );
  return {
    request,
    result,
    ideal,
    native
  }
  ;
}
const poles=count=>Array.from({
  length:count
},
(_,
i)=>[2*i,
(i%2?-1:1)*(i+1),
i*i/4]),
weights=count=>Array.from({
  length:count
},
(_,
i)=>i%2?3:1),
curve=(id,
degree,
knots,
controlPoints,
w)=>({
  kind:'curve',
  id,
  degree,
  knots,
  controlPoints,
  weights:w
});
jsonFile('source-api.inputs',
{
  entry,
  sourceInputs,
  cadInputs,
  sourceOnly:true,
  write:false,
  esbuildVersion:esbuild.version
});
jsonFile('source-api.metafile',
bundle.metafile);
const main=positive('main',
curve('main_quintic',
5,
[...Array(6).fill(-3),
-1,
2,
...Array(6).fill(5)],
poles(8),
weights(8)),
.5);
assert.equal(main.ideal.actualStoredExact,
false);
assert.deepEqual(main.ideal.generated.map(g=>g.idealAlpha),
[fraction(7n,
10n),
fraction(7n,
16n),
fraction(7n,
16n),
fraction(7n,
16n),
fraction(1n,
4n)].map(asDTO));
const quartic=positive('quartic',
curve('quartic_exact',
4,
[...Array(5).fill(-2),
...Array(5).fill(3)],
poles(5),
weights(5)),
.5);
assert.equal(quartic.ideal.actualStoredExact,
true);
const c0=positive('c0',
curve('quintic_c0',
5,
[...Array(6).fill(-2),
...Array(4).fill(-0),
...Array(6).fill(2)],
poles(10),
weights(10)),
-0);
assert.equal(c0.ideal.actualStoredExact,
true);
const c0At=c0.result.report.observations.find(v=>v.parameter===0);
assert.equal(c0At.originalD1.status,
'evaluated');
assert.equal(c0At.refinedD1.status,
'refused-c0');
assert.ok(Object.is(c0.result.request.knot,
-0));
const capacity=positive('capacity',
curve('capacity_line',
1,
[-0,
-0,
...Array.from({
  length:61
},
(_,
i)=>i+1),
62,
62],
Array.from({
  length:63
},
(_,
i)=>[i===0?-0:i,
-0,
i===0?-0:i/8]),
Array(63).fill(1)),
.125);
assert.equal(capacity.result.curve.controlPoints.length,
64);
assert.equal(capacity.native.count,
128);
assert.equal(capacity.ideal.actualStoredExact,
true);
for(const observation of capacity.result.report.observations){
  assert.ok(Object.is(observation.originalPointMM[1],
  -0));
  assert.ok(Object.is(observation.refinedPointMM[1],
  -0));
  for(const state of [observation.originalD1,
  observation.refinedD1])if(state.status==='evaluated')assert.ok(Object.is(state.value.derivative[1],
  0));
}
assert.deepEqual(validate(main.result),
main.result.report);
const newPoleIndex=main.result.provenance.steps[0].generatedPoles[0].refinedPoleIndex;
assert.ok(!main.result.provenance.unchangedPoles.some(p=>p.refinedPoleIndex===newPoleIndex));
const editRequest={
  source:main.result.source,
  sourceVersion:0,
  curveId:main.result.curve.id,
  edits:{
    poleEdits:[{
      index:newPoleIndex,
      xMM:main.result.curve.controlPoints[newPoleIndex][0]+.25
    }
    ]
  }
},
edit=editSourceCurveControlPolygon(editRequest);
assert.deepEqual(validateSourceCurveControlPolygonEdit(edit),
edit.report);
assert.notEqual(edit.source,
main.result.source);
assert.ok(edit.report.maximumObservedChangeMM>0);
assert.deepEqual(edit.curve.knots,
main.result.curve.knots);
assert.equal(edit.curve.degree,
5);
assert.deepEqual(edit.model.objects[0],
main.result.model.objects[0]);
assert.deepEqual(edit.model.objects[2],
main.result.model.objects[2]);
sourceFile('actual1134-new-pole-edit',
edit.source,
edit.model);
jsonFile('actual1134-new-pole-edit-request',
editRequest);
jsonFile('actual1134-new-pole-edit',
edit);
function intact(){
  for(const row of retained)assert.deepEqual(row.value,
  row.before);
  for(const row of accepted)assert.deepEqual(row.result,
  row.beforeResult);
  for(const [file,
  bytes]of files)assert.deepEqual(readFileSync(file),
  bytes,
  file);
}
function reject(name,
action,
code){
  assert.throws(action,
  error=>{
    assert.ok(error instanceof InsertionError);
    assert.equal(error.code,
    code,
    name);
    assert.ok(error.message.length<=1024);
    failures.push({
      name,
      code:error.code,
      message:error.message,
      causeName:error.cause?.name??null,
      causeMessage:error.cause?.message??null
    }
    );
    intact();
    return true;
  }
  );
}
reject('fixed-observation-budget',
()=>insert({
  ...main.request,
  maximumObservations:127
}
),
'BUDGET');
reject('wrong-source-version',
()=>insert({
  ...main.request,
  sourceVersion:1
}
),
'VERSION');
reject('extra-request-field',
()=>insert({
  ...main.request,
  insertions:1
}
),
'INPUT');
reject('missing-curve',
()=>insert({
  ...main.request,
  curveId:'missing_curve'
}
),
'TARGET');
reject('surface-target',
()=>insert({
  ...main.request,
  curveId:'unused_surface'
}
),
'TARGET');
reject('endpoint-knot',
()=>insert({
  ...main.request,
  knot:-3
}
),
'REQUEST');
reject('outside-knot',
()=>insert({
  ...main.request,
  knot:6
}
),
'REQUEST');
reject('opposite-existing-zero',
()=>insert({
  ...c0.request,
  knot:+0
}
),
'REQUEST');
reject('actual-capacity-64-to-65',
()=>insert(requestFor(capacity.result.source,
capacity.result.curve.id,
.25)),
'BUDGET');
reject('actual-multiplicity-five-overflow',
()=>insert(requestFor(c0.result.source,
c0.result.curve.id,
-0)),
'REQUEST');
const commentOriginal=compileCadModel(main.request.source,
{
  sourceVersion:0
});
assert.equal(commentOriginal.ok,
true);
const selectedDeclaration=commentOriginal.ast.declarations.find(d=>d.kind==='curve'&&d.id===main.request.curveId);
const listStart=selectedDeclaration.fields.find(f=>f.name==='control-points').value.range.start;
const commented=main.request.source.slice(0,
listStart+1)+'/* legal selected-array comment */'+main.request.source.slice(listStart+1),
commentCold=compileCadModel(commented,
{
  sourceVersion:0
});
assert.equal(commentCold.ok,
true);
assert.deepEqual(commentCold.model,
main.result.originalModel);
sourceFile('genuine-selected-array-comment',
commented,
commentCold.model);
reject('selected-array-comment',
()=>insert({
  ...main.request,
  source:commented
}
),
'TARGET');
const unsafe=curve('unsafe_alpha',
1,
[0,
0,
8,
8],
[[0,
0,
0],
[1,
2,
3]],
[1,
1]),
unsafeSource=mixedSource(unsafe),
unsafeCold=compileCadModel(unsafeSource,
{
  sourceVersion:0
});
assert.equal(unsafeCold.ok,
true);
sourceFile('native-valid-unsafe-alpha',
unsafeSource,
unsafeCold.model);
reject('genuine-unsafe-alpha',
()=>insert(requestFor(unsafeSource,
unsafe.id,
2*Number.MIN_VALUE)),
'REPRESENTABILITY');
assert.match(failures.at(-1).causeMessage,
/strict convex insertion coefficient is not representable/);
const normCurve=curve('norm_overflow',
1,
[0,
0,
3e-308,
3e-308],
[[-1.65,
-1.65,
-1.65],
[1.65,
1.65,
1.65]],
[1,
1]),
normSource=mixedSource(normCurve),
normCold=compileCadModel(normSource,
{
  sourceVersion:0
});
assert.equal(normCold.ok,
true);
sourceFile('genuine-norm-overflow-source',
normSource,
normCold.model);
let normError;
try{
  insert(requestFor(normSource,
  normCurve.id,
  1.5e-308));
}
catch(error){
  normError=error;
}
assert.ok(normError instanceof InsertionError);
assert.ok(['REPRESENTABILITY',
'NATIVE'].includes(normError.code));
failures.push({
  name:'genuine-D1-norm-overflow-or-actual-upstream-native-refusal',
  code:normError.code,
  message:normError.message,
  causeName:normError.cause?.name??null,
  causeMessage:normError.cause?.message??null
});
intact();
let getterCalls=0;
const getterRequest={
  ...main.request
};
Object.defineProperty(getterRequest,
'knot',
{
  enumerable:true,
  get(){
    getterCalls++;
    return .5;
  }
});
reject('request-getter',
()=>insert(getterRequest),
'INPUT');
assert.equal(getterCalls,
0);
const foreignRequest={
  ...main.request
};
Object.setPrototypeOf(foreignRequest,
Date.prototype);
reject('foreign-request',
()=>insert(foreignRequest),
'INPUT');
const hiddenRequest={
  ...main.request
};
Object.defineProperty(hiddenRequest,
'hidden',
{
  value:1
});
reject('hidden-request',
()=>insert(hiddenRequest),
'INPUT');
const cyclicRequest={
  ...main.request
};
cyclicRequest.cycle=cyclicRequest;
reject('cyclic-request',
()=>insert(cyclicRequest),
'INPUT');
const sparseRequest={
  ...main.request,
  extra:[1,
  2]
};
delete sparseRequest.extra[0];
reject('sparse-extra-request',
()=>insert(sparseRequest),
'INPUT');
const symbolRequest={
  ...main.request
};
symbolRequest[Symbol('extra')]=1;
reject('symbol-request',
()=>insert(symbolRequest),
'INPUT');
for(const [name,
mutate]of [
['request-source',
r=>{
  r.request.source+=' ';
}
],
['candidate-source',
r=>{
  r.source+=' ';
}
],
['generated-pole',
r=>{
  r.curve.controlPoints[2][0]+=.125;
}
],
['generated-weight',
r=>{
  r.curve.weights[2]+=.125;
}
],
['new-knot',
r=>{
  r.curve.knots[7]+=.01;
}
],
['sibling-model',
r=>{
  r.model.objects[0].controlPoints[0][0]=.125;
}
],
['patch-range',
r=>{
  r.provenance.patches[0].startUTF16++;
}
],
['patch-replacement',
r=>{
  r.provenance.patches[0].replacementText+=' ';
}
],
['unchanged-map',
r=>{
  r.provenance.unchangedPoles[0].refinedPoleIndex++;
}
],
['generated-alpha',
r=>{
  r.provenance.steps[0].generatedPoles[0].alpha+=.01;
}
],
['homogeneous-blend',
r=>{
  r.provenance.homogeneousSteps[0].generatedPoles[0].generated[0]+=.125;
}
],
['native-d0',
r=>{
  r.report.observations[0].refinedPointMM[0]+=.125;
}
],
['native-d1',
r=>{
  r.report.observations[0].originalD1.value.derivative[0]+=.125;
}
],
['counter',
r=>{
  r.report.directCounts.rationalOperationCount++;
}
],
['file-size',
r=>{
  r.report.fileSizes.result.utf8++;
}
],
['global-shape-claim',
r=>{
  r.report.quality.globalShapeErrorCertified=true;
}
]
]){
  const changed=structuredClone(main.result),
  before=nativeJSON(changed);
  mutate(changed);
  assert.notEqual(nativeJSON(changed),
  before,
  'Non-noop mutation '+name);
  reject('owned-'+name,
  ()=>validate(changed),
  'OWNED');
}
let previous=main.result;
reject('atomic-previous-retention',
()=>{
  previous=insert({
    ...main.request,
    knot:6
  }
  );
},
'REQUEST');
assert.strictEqual(previous,
main.result);
jsonFile('atomic-retention',
{
  previousObjectAndFilesRetained:true,
  getterCalls
});
for(const selected of [main.result.originalCurve,
quartic.result.originalCurve])assert.throws(()=>oldInsert(selected,
{
  knot:.5,
  insertions:1
}
),
error=>error instanceof Error&&/degree1\.\.3 required/.test(error.message));
const packageRoot=resolve(repo,
'packages/barocss-cad'),
manifest=JSON.parse(readFileSync(resolve(packageRoot,
'package.json'),
'utf8')),
declared=manifest.publishConfig?.exports?.['.']??manifest.exports['.'],
runtimePath=resolve(packageRoot,
declared.import),
declarationPath=resolve(packageRoot,
declared.types),
leafDeclarationPath=resolve(packageRoot,
'dist/nurbs/source-wide/source-curve-knot-insertion.d.ts');
const publicAPI=await import(pathToFileURL(runtimePath).href);
for(const name of runtimeNames)assert.equal(typeof publicAPI[name],
name.endsWith('Code')?'object':'function');
assert.deepEqual(publicAPI.SourceCurveKnotInsertionDiagnosticCode,
codes);
assert.ok(readFileSync(declarationPath,
'utf8').includes('./source-curve-knot-insertion.js'));
for(const name of [...runtimeNames,
...typeNames])assert.ok(readFileSync(leafDeclarationPath,
'utf8').includes(name),
name);
const currentRequest=JSON.parse(readFileSync(cases[0].requestFile,
'utf8')),
currentResult=JSON.parse(readFileSync(cases[0].resultFile,
'utf8'));
assert.deepEqual(publicAPI.insertSourceCurveKnot(currentRequest),
currentResult);
assert.deepEqual(publicAPI.validateSourceCurveKnotInsertion(currentResult),
currentResult.report);
for(const [source,
model]of [[currentRequest.source,
currentResult.originalModel],
[currentResult.source,
currentResult.model]]){
  const cold=publicAPI.compileCadModel(source,
  {
    sourceVersion:0
  }
  );
  assert.equal(cold.ok,
  true);
  assert.deepEqual(cold.model,
  model);
}
const emittedArtifacts=['index.js',
'index.d.ts',
'source-curve-knot-insertion.js',
'source-curve-knot-insertion.d.ts'].map(name=>{
  const path=resolve(packageRoot,
  'dist',
  name);
  assert.ok(existsSync(path));
  const bytes=readFileSync(path);
  return {
    path,
    bytes:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex')
  }
  ;
});
const compiledConsumer={
  runtimePath,
  declarationPath,
  leafDeclarationPath,
  runtimeNames,
  typeNames,
  publicNameCount:8,
  currentReplayCount:1,
  emittedArtifacts
};
jsonFile('compiled-consumer',
compiledConsumer);
intact();
assert.equal(cases.length,
4);
const summary={
  sourceMode:true,
  cases,
  failures,
  priorRefusals,
  compiledConsumer,
  getterCalls,
  actual1134GeneratedPoleIndex:newPoleIndex,
  scope:'Complete-source one-knot insertion and local native observations; independent ideal homogeneous identity and actual stored rounding are separate. No global shape or binary64 error, continuity, topology, Solid, editor, renderer, persistence, manufacturing, or publication acceptance.'
};
jsonFile('summary',
summary);
intact();
console.log(JSON.stringify(summary));
