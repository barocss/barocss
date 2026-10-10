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
'Usage: node source-surface-knot-insertion-demo.mjs --source <output-directory>');
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
for (const leaf of ['source-surface-knot-insertion.ts',
'curve-knot-insertion.ts',
'source-surface-control-net-wide.ts',
'index.ts']) assert.ok(cadInputs.includes(resolve(repo,
'packages/barocss-cad/src',
leaf)),
leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo,
'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {
  insertSourceSurfaceKnot:insert,
  validateSourceSurfaceKnotInsertion:validate,
  SourceSurfaceKnotInsertionError:InsertionError,
  SourceSurfaceKnotInsertionDiagnosticCode:codes,
  compileCadModel,
  evaluateSurface,
  evaluateSurfaceD1,
  editSourceSurfaceControlNetWide,
  validateSourceSurfaceControlNetWideEdit
}
= api;
const runtimeNames = ['insertSourceSurfaceKnot',
'validateSourceSurfaceKnotInsertion',
'SourceSurfaceKnotInsertionError',
'SourceSurfaceKnotInsertionDiagnosticCode'];
const typeNames = ['SourceSurfaceKnotInsertionRequest',
'SourceSurfaceKnotInsertionPatch',
'SourceSurfaceKnotInsertionReport',
'SourceSurfaceKnotInsertionResult'];
for (const name of runtimeNames) assert.equal(typeof api[name],
name.endsWith('Code') ? 'object' : 'function');
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
  assert.ok(text.length <= 4194304 && Buffer.byteLength(text,
  'utf8') <= 4194304,
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
// Demo-only exact arithmetic. The product API performs no exact proof.
let operations = 0,
maximumBits = 0;
const work = () => assert.ok(++operations <= 20000000,
'Demo exact-operation cap');
function sized(n) {
  work();
  const bits = (n < 0n ? -n : n).toString(2).length;
  maximumBits = Math.max(maximumBits,
  bits);
  assert.ok(bits <= 8192);
  return n;
}
function fraction(n,
d = 1n) {
  work();
  sized(n);
  sized(d);
  assert.notEqual(d,
  0n);
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  let a = n < 0n ? -n : n,
  b = d;
  while (b) {
    work();
    [a,
    b] = [b,
    a % b];
  }
  return n === 0n ? [0n,
  1n] : [n / a,
  d / a];
}
const zero = [0n,
1n],
one = [1n,
1n];
const add = (a,
b) => {
  work();
  return fraction(sized(sized(a[0]*b[1])+sized(b[0]*a[1])),
  sized(a[1]*b[1]));
};
const neg = a => {
  work();
  return [-a[0],
  a[1]];
},
sub = (a,
b) => add(a,
neg(b));
const mul = (a,
b) => {
  work();
  return fraction(sized(a[0]*b[0]),
  sized(a[1]*b[1]));
};
const div = (a,
b) => {
  work();
  return fraction(sized(a[0]*b[1]),
  sized(a[1]*b[0]));
};
const abs = a => a[0] < 0n ? neg(a) : a;
const compare = (a,
b) => {
  work();
  const x=sized(a[0]*b[1]),
  y=sized(b[0]*a[1]);
  return x<y?-1:x>y?1:0;
};
const asDTO = a => {
  work();
  const value={
    numerator:a[0].toString(),
    denominator:a[1].toString()
  }
  ;
  assert.ok(value.numerator.length<=5000&&value.denominator.length<=5000);
  return value;
};
function represented(value) {
  work();
  if (value === 0) return zero;
  const view=new DataView(new ArrayBuffer(8));
  view.setFloat64(0,
  value,
  false);
  const bits=view.getBigUint64(0,
  false),
  exponent=Number((bits>>52n)&2047n),
  mantissa=(bits&((1n<<52n)-1n))+(exponent?1n<<52n:0n),
  power=exponent?exponent-1075:-1074;
  return fraction((bits>>63n?-mantissa:mantissa)*(power>=0?1n<<BigInt(power):1n),
  power<0?1n<<BigInt(-power):1n);
}
const polyAdd=(a,
b)=>Array.from({
  length:Math.max(a.length,
  b.length)
},
(_,
i)=>add(a[i]??zero,
b[i]??zero));
const polyScale=(a,
c)=>a.map(v=>mul(v,
c));
function polyProduct(a,
b) {
  const out=Array.from({
    length:a.length+b.length-1
  }
  ,
  ()=>zero);
  for(let i=0;
  i<a.length;
  i++) for(let j=0;
  j<b.length;
  j++) if(a[i][0]&&b[j][0]) out[i+j]=add(out[i+j],
  mul(a[i],
  b[j]));
  return out;
}
const polyAt=(p,
t)=>p.reduceRight((out,
v)=>add(mul(out,
t),
v),
zero);
const polyDerivative=p=>p.slice(1).map((v,
i)=>mul(v,
[BigInt(i+1),
1n]));
const distinct = values => {
  const out=[];
  for(const v of values) if(!out.some(x=>x===v)) out.push(v);
  return out.sort((a,
  b)=>a<b?-1:a>b?1:0);
};
const basisCache = new Map();
function basis(knots,
degree,
a,
b) {
  const cacheKey = JSON.stringify([knots,
  degree,
  a,
  b]);
  if(basisCache.has(cacheKey)) return basisCache.get(cacheKey);
  const U=knots.map(represented),
  start=represented(a),
  width=sub(represented(b),
  start),
  mid=div(add(start,
  represented(b)),
  [2n,
  1n]);
  let N=U.slice(0,
  -1).map((v,
  i)=>[compare(mid,
  v)>=0&&compare(mid,
  U[i+1])<0?one:zero]);
  for(let k=1;
  k<=degree;
  k++) N=Array.from({
    length:N.length-1
  }
  ,
  (_,
  i)=>{
    let left=[zero],
    right=[zero];
    const dl=sub(U[i+k],
    U[i]),
    dr=sub(U[i+k+1],
    U[i+1]);
    if(dl[0]&&N[i].some(v=>v[0])) left=polyProduct(N[i],
    [div(sub(start,
    U[i]),
    dl),
    div(width,
    dl)]);
    if(dr[0]&&N[i+1].some(v=>v[0])) right=polyProduct(N[i+1],
    [div(sub(U[i+k+1],
    start),
    dr),
    neg(div(width,
    dr))]);
    return polyAdd(left,
    right);
  }
  );
  const sparse=N.flatMap((p,
  index)=>p.some(v=>v[0])?[{
    index,
    coefficients:p
  }
  ]:[]);
  basisCache.set(cacheKey,
  sparse);
  return sparse;
}
const lift = s => s.controlPoints.map((row,
i)=>row.map((p,
j)=>[...p.map(v=>mul(represented(v),
represented(s.weights[i][j]))),
represented(s.weights[i][j])]));
function tensor(s,
H,
ud,
vd) {
  const U=basis(s.knotsU,
  s.degreeU,
  ...ud),
  V=basis(s.knotsV,
  s.degreeV,
  ...vd),
  out=Array.from({
    length:4
  }
  ,
  ()=>Array.from({
    length:s.degreeU+1
  }
  ,
  ()=>Array.from({
    length:s.degreeV+1
  }
  ,
  ()=>zero)));
  for(const u of U) for(const v of V) for(let i=0;
  i<u.coefficients.length;
  i++) for(let j=0;
  j<v.coefficients.length;
  j++) if(u.coefficients[i][0]&&v.coefficients[j][0]) {
    const factor=mul(u.coefficients[i],
    v.coefficients[j]);
    for(let axis=0;
    axis<4;
    axis++) if(H[u.index][v.index][axis][0]) out[axis][i][j]=add(out[axis][i][j],
    mul(factor,
    H[u.index][v.index][axis]));
  }
  return out;
}
function idealInsertion(result) {
  const s=result.originalSurface,
  axis=result.request.axis,
  knots=axis==='u'?s.knotsU:s.knotsV,
  degree=axis==='u'?s.degreeU:s.degreeV,
  count=axis==='u'?s.controlPoints.length:s.controlPoints[0].length,
  knot=result.request.knot,
  H=storedLift(s),
  prior=knots.filter(v=>v===knot).length;
  let span=-1;
  for(let i=degree;
  i<count;
  i++) if(knots[i]<=knot&&knot<knots[i+1]) span=i;
  assert.ok(span>=degree);
  const stripCount=axis==='u'?s.controlPoints[0].length:s.controlPoints.length,
  next=Array.from({
    length:s.controlPoints.length+(axis==='u'?1:0)
  }
  ,
  ()=>Array(s.controlPoints[0].length+(axis==='v'?1:0))),
  generated=[],
  unchanged=[];
  assert.equal(result.provenance.strips.length,
  stripCount);
  for(let fixed=0;
  fixed<stripCount;
  fixed++) {
    const strip=result.provenance.strips[fixed],
    points=axis==='u'?s.controlPoints.map(r=>r[fixed]):s.controlPoints[fixed],
    weights=axis==='u'?s.weights.map(r=>r[fixed]):s.weights[fixed],
    old=axis==='u'?H.map(r=>r[fixed]):H[fixed],
    newH=Array(count+1),
    maps=[];
    assert.equal(strip.fixedPoleIndex,
    fixed);
    assert.deepEqual(strip.originalCurve,
    {
      kind:'curve',
      id:'surface_strip_'+fixed,
      degree,
      knots,
      controlPoints:points,
      weights
    }
    );
    for(let i=0;
    i<=span-degree;
    i++){
      newH[i]=old[i];
      maps.push({
        originalPoleIndex:i,
        refinedPoleIndex:i
      }
      );
    }
    for(let i=span-prior;
    i<count;
    i++){
      newH[i+1]=old[i];
      maps.push({
        originalPoleIndex:i,
        refinedPoleIndex:i+1
      }
      );
    }
    maps.sort((a,
    b)=>a.refinedPoleIndex-b.refinedPoleIndex);
    assert.deepEqual(strip.calculation.unchangedPoles,
    maps);
    const step=strip.calculation.steps[0],
    hStep=strip.calculation.homogeneousSteps[0];
    assert.equal(step.spanIndex,
    span);
    assert.equal(step.priorMultiplicity,
    prior);
    for(let i=span-degree+1;
    i<=span-prior;
    i++) {
      const alpha=div(sub(represented(knot),
      represented(knots[i])),
      sub(represented(knots[i+degree]),
      represented(knots[i])));
      newH[i]=old[i].map((v,
      k)=>add(mul(alpha,
      v),
      mul(sub(one,
      alpha),
      old[i-1][k])));
      const actual=step.generatedPoles.find(p=>p.refinedPoleIndex===i),
      h=hStep.generatedPoles.find(p=>p.refinedPoleIndex===i);
      assert.ok(actual&&h);
      assert.equal(actual.leftPriorPoleIndex,
      i-1);
      assert.equal(actual.rightPriorPoleIndex,
      i);
      assert.ok(Object.is(actual.alpha,
      (knot-knots[i])/(knots[i+degree]-knots[i])));
      assert.deepEqual(h.left,
      [...points[i-1].map(v=>v*weights[i-1]),
      weights[i-1]]);
      assert.deepEqual(h.right,
      [...points[i].map(v=>v*weights[i]),
      weights[i]]);
      assert.deepEqual(h.generated,
      h.right.map((v,
      k)=>h.alpha*v+(1-h.alpha)*h.left[k]));
      const candidate=strip.calculation.candidate,
      stored=[...candidate.controlPoints[i].map(v=>mul(represented(v),
      represented(candidate.weights[i]))),
      represented(candidate.weights[i])];
      generated.push({
        fixedPoleIndex:fixed,
        index:i,
        idealAlpha:asDTO(alpha),
        alphaResidual:asDTO(sub(represented(actual.alpha),
        alpha)),
        nativeBlendResidual:h.generated.map((v,
        k)=>asDTO(sub(represented(v),
        newH[i][k]))),
        storedResidual:stored.map((v,
        k)=>asDTO(sub(v,
        newH[i][k])))
      }
      );
    }
    for(let i=0;
    i<newH.length;
    i++) {
      if(axis==='u')next[i][fixed]=newH[i];
      else next[fixed][i]=newH[i];
    }
    for(const map of maps) {
      const record=axis==='u'?{
        originalUIndex:map.originalPoleIndex,
        originalVIndex:fixed,
        refinedUIndex:map.refinedPoleIndex,
        refinedVIndex:fixed
      }
      :{
        originalUIndex:fixed,
        originalVIndex:map.originalPoleIndex,
        refinedUIndex:fixed,
        refinedVIndex:map.refinedPoleIndex
      }
      ;
      unchanged.push(record);
      assert.deepEqual(s.controlPoints[record.originalUIndex][record.originalVIndex],
      result.surface.controlPoints[record.refinedUIndex][record.refinedVIndex]);
      assert.ok(Object.is(s.weights[record.originalUIndex][record.originalVIndex],
      result.surface.weights[record.refinedUIndex][record.refinedVIndex]));
    }
    for(let i=0;
    i<strip.calculation.candidate.controlPoints.length;
    i++) {
      const u=axis==='u'?i:fixed,
      v=axis==='u'?fixed:i;
      assert.deepEqual(result.surface.controlPoints[u][v],
      strip.calculation.candidate.controlPoints[i]);
      assert.ok(Object.is(result.surface.weights[u][v],
      strip.calculation.candidate.weights[i]));
    }
  }
  assert.deepEqual(result.provenance.unchangedPoles,
  unchanged);
  const maps=knots.map((_,
  originalKnotIndex)=>({
    originalKnotIndex,
    refinedKnotIndex:originalKnotIndex<=span?originalKnotIndex:originalKnotIndex+1
  }
  ));
  assert.deepEqual(result.provenance.unchangedKnots,
  maps);
  const refinedKnots=axis==='u'?result.surface.knotsU:result.surface.knotsV;
  assert.deepEqual(refinedKnots,
  [...knots.slice(0,
  span+1),
  knot,
  ...knots.slice(span+1)]);
  const other=axis==='u'?'knotsV':'knotsU';
  assert.deepEqual(result.surface[other],
  s[other]);
  return {
    originalH:H,
    idealH:next,
    generated,
    spanIndex:span,
    priorMultiplicity:prior
  }
  ;
}
function wholeIdentity(result,
ideal) {
  const u=distinct([...result.originalSurface.knotsU,
  ...result.surface.knotsU]),
  v=distinct([...result.originalSurface.knotsV,
  ...result.surface.knotsV]),
  storedH=storedLift(result.surface),
  cells=[];
  let coefficientCount=0,
  storedNonzero=0;
  for(let i=0;
  i<u.length-1;
  i++)for(let j=0;
  j<v.length-1;
  j++){
    const ud=[u[i],
    u[i+1]],
    vd=[v[j],
    v[j+1]],
    before=cachedTensor(result.originalSurface,
    ideal.originalH,
    ud,
    vd),
    after=cachedTensor(result.surface,
    ideal.idealH,
    ud,
    vd),
    actual=cachedTensor(result.surface,
    storedH,
    ud,
    vd);
    let maximum=zero,
    witness=null,
    nonzero=0;
    const hash=createHash('sha256');
    for(let axis=0;
    axis<4;
    axis++)for(let a=0;
    a<=result.surface.degreeU;
    a++)for(let b=0;
    b<=result.surface.degreeV;
    b++){
      const exactResidual=sub(after[axis][a][b],
      before[axis][a][b]);
      assert.equal(exactResidual[0],
      0n);
      coefficientCount++;
      const residual=sub(actual[axis][a][b],
      before[axis][a][b]);
      hash.update(nativeJSON(asDTO(residual))+'\n');
      if(residual[0]){
        nonzero++;
        storedNonzero++;
        if(compare(abs(residual),
        maximum)>0){
          maximum=abs(residual);
          witness={
            axis,
            uPower:a,
            vPower:b,
            residual:asDTO(residual)
          }
          ;
        }
      }
    }
    cells.push({
      uDomain:ud,
      vDomain:vd,
      idealAllCoefficientsZero:true,
      coefficientCount:4*(result.surface.degreeU+1)*(result.surface.degreeV+1),
      actualNonzeroCoefficients:nonzero,
      maximumActualResidual:asDTO(maximum),
      witness,
      actualResidualSHA256:hash.digest('hex')
    }
    );
  }
  return {
    cellCount:cells.length,
    coefficientCount,
    storedNonzero,
    wholeIdealTensorIdentity:true,
    cells
  }
  ;
}
const liftCache=new WeakMap(),
tensorCache=new WeakMap();
function storedLift(s){
  if(!liftCache.has(s))liftCache.set(s,
  lift(s));
  return liftCache.get(s);
}
function cachedTensor(s,
H,
ud,
vd){
  let cache=tensorCache.get(H);
  if(!cache){
    cache=new Map();
    tensorCache.set(H,
    cache);
  }
  const key=JSON.stringify([ud,
  vd]);
  if(!cache.has(key))cache.set(key,
  tensor(s,
  H,
  ud,
  vd));
  return cache.get(key);
}
function exactNativeValue(s,
uBreaks,
vBreaks,
u,
v,
withD1){
  const pick=(breaks,
  t)=>{
    const i=breaks.findIndex((a,
    i)=>i<breaks.length-1&&t>=a&&t<=breaks[i+1]);
    assert.ok(i>=0);
    return [breaks[i],
    breaks[i+1]];
  }
  ,
  ud=pick(uBreaks,
  u),
  vd=pick(vBreaks,
  v),
  du=sub(represented(ud[1]),
  represented(ud[0])),
  dv=sub(represented(vd[1]),
  represented(vd[0])),
  tu=div(sub(represented(u),
  represented(ud[0])),
  du),
  tv=div(sub(represented(v),
  represented(vd[0])),
  dv),
  H=cachedTensor(s,
  storedLift(s),
  ud,
  vd),
  at=p=>polyAt(p.map(row=>polyAt(row,
  tv)),
  tu),
  values=H.map(at),
  w=values[3],
  point=values.slice(0,
  3).map(x=>div(x,
  w));
  if(!withD1)return {
    point
  }
  ;
  const U=H.map(p=>div(polyAt(polyDerivative(p.map(row=>polyAt(row,
  tv))),
  tu),
  du)),
  V=H.map(p=>div(polyAt(p.map(row=>polyAt(polyDerivative(row),
  tv)),
  tu),
  dv));
  return {
    point,
    du:values.slice(0,
    3).map((x,
    i)=>div(sub(mul(U[i],
    w),
    mul(x,
    U[3])),
    mul(w,
    w))),
    dv:values.slice(0,
    3).map((x,
    i)=>div(sub(mul(V[i],
    w),
    mul(x,
    V[3])),
    mul(w,
    w)))
  }
  ;
}
function axisStations(knots,
refined=null,
degree,
count){
  const domain=[knots[degree],
  knots[count]],
  values=[...domain];
  for(const list of refined?[knots,
  refined]:[knots]){
    const breaks=distinct(list.filter(v=>v>=domain[0]&&v<=domain[1]));
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
function d1State(s,
u,
v){
  try{
    return {
      status:'evaluated',
      value:evaluateSurfaceD1(s,
      u,
      v)
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
  const before=result.originalSurface,
  after=result.surface,
  axis=result.request.axis,
  U=axisStations(before.knotsU,
  axis==='u'?after.knotsU:null,
  before.degreeU,
  before.controlPoints.length),
  V=axisStations(before.knotsV,
  axis==='v'?after.knotsV:null,
  before.degreeV,
  before.controlPoints[0].length),
  ub=distinct([...before.knotsU,
  ...after.knotsU]),
  vb=distinct([...before.knotsV,
  ...after.knotsV]);
  assert.deepEqual(result.report.stations,
  {
    u:U,
    v:V
  }
  );
  let index=0,
  evaluated=0,
  refused=0,
  maxPoint=0,
  maxDu=0,
  maxDv=0;
  for(const u of U)for(const v of V){
    const originalPointMM=evaluateSurface(before,
    u,
    v),
    refinedPointMM=evaluateSurface(after,
    u,
    v),
    originalD1=d1State(before,
    u,
    v),
    refinedD1=d1State(after,
    u,
    v),
    pointDifferenceMM=Math.hypot(...refinedPointMM.map((x,
    k)=>x-originalPointMM[k]));
    let relativeDuDifference=null,
    relativeDvDifference=null;
    if(originalD1.status==='evaluated'&&refinedD1.status==='evaluated')for(const field of ['du',
    'dv']){
      const a=originalD1.value[field],
      b=refinedD1.value[field],
      delta=Math.hypot(...b.map((x,
      k)=>x-a[k])),
      aNorm=Math.hypot(...a),
      bNorm=Math.hypot(...b),
      scale=Math.max(1,
      aNorm,
      bNorm);
      assert.ok([delta,
      aNorm,
      bNorm,
      scale].every(Number.isFinite));
      const value=delta/scale;
      assert.ok(value<=1e-7);
      if(field==='du')relativeDuDifference=value;
      else relativeDvDifference=value;
    }
    assert.ok(pointDifferenceMM<=1e-7);
    for(const [s,
    point,
    state]of [[before,
    originalPointMM,
    originalD1],
    [after,
    refinedPointMM,
    refinedD1]]){
      const exact=exactNativeValue(s,
      ub,
      vb,
      u,
      v,
      state.status==='evaluated');
      for(let k=0;
      k<3;
      k++)assert.ok(compare(abs(sub(represented(point[k]),
      exact.point[k])),
      represented(1e-7))<=0);
      if(state.status==='evaluated'){
        evaluated++;
        for(const field of ['du',
        'dv'])for(let k=0;
        k<3;
        k++)assert.ok(compare(abs(sub(represented(state.value[field][k]),
        exact[field][k])),
        mul(represented(1e-7),
        add(one,
        abs(exact[field][k]))))<=0);
      }
      else refused++;
    }
    assert.deepEqual(result.report.observations[index++],
    {
      u,
      v,
      originalPointMM,
      refinedPointMM,
      pointDifferenceMM,
      originalD1,
      refinedD1,
      relativeDuDifference,
      relativeDvDifference
    }
    );
    maxPoint=Math.max(maxPoint,
    pointDifferenceMM);
    maxDu=Math.max(maxDu,
    relativeDuDifference??0);
    maxDv=Math.max(maxDv,
    relativeDvDifference??0);
  }
  assert.equal(result.report.observations.length,
  index);
  assert.ok(Object.is(result.report.maximumPointDifferenceMM,
  maxPoint));
  assert.ok(Object.is(result.report.maximumRelativeDuDifference,
  maxDu));
  assert.ok(Object.is(result.report.maximumRelativeDvDifference,
  maxDv));
  return {
    count:index,
    evaluated,
    refused
  }
  ;
}
function mixedSource(s,
axis){
  const list=a=>'[ '+a.map(decimal).join(' , ')+' ]',
  points=a=>'[ '+a.map(list).join(' , ')+' ]',
  net='[\r\n'+s.controlPoints.map(points).join(' ,\r\n')+'\r\n]',
  weights='[ '+s.weights.map(list).join(' , ')+' ]',
  other=axis==='u'?'v':'u',
  knotValue=(name,
  values)=>name===other?'[ /* untouched other-axis knots π */ '+values.map(decimal).join(' , ')+' ]':list(values);
  return '/* original complete π source with CRLF */\r\n@model surface_model {version:0;length-unit:mm;\r\n'+
  '@curve #surface_strip_0 {type:nurbs;degree:1;knots:[-0,-0,1,1];control-points:[[-0,-0,-0],[+2.000,3,4]];weights:[1.000,1];}\r\n'+
  '@surface #'+s.id+' { /* headers are preserved */ type:nurbs;degree-u:'+s.degreeU+';degree-v:'+s.degreeV+';\r\nweights:'+weights+';\r\ncontrol-points:'+net+';\r\nknots-u:'+knotValue('u',
  s.knotsU)+';\r\nknots-v:'+knotValue('v',
  s.knotsV)+';}\r\n'+
  '@surface #unused_surface {type:nurbs;degree-u:1;degree-v:1;knots-u:[-0,-0,1,1];knots-v:[0,0,1,1];control-points:[[[-0,-0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}\r\n/* unchanged Ω footer */\r\n}\r\n';
}
function sourceOracle(result){
  const original=compileCadModel(result.request.source,
  {
    sourceVersion:0
  }
  );
  assert.equal(original.ok,
  true);
  assert.deepEqual(original.model,
  result.originalModel);
  const selected=original.ast.declarations.find(d=>d.kind==='surface'&&d.id===result.request.surfaceId),
  patches=result.provenance.patches,
  selectedField=result.request.axis==='u'?'knots-u':'knots-v';
  assert.equal(result.provenance.selectedObjectIndex,
  1);
  assert.deepEqual(patches.map(p=>p.field).sort(),
  [selectedField,
  'control-points',
  'weights'].sort());
  let previous=0,
  shift=0;
  for(const patch of patches){
    const node=selected.fields.find(f=>f.name===patch.field).value;
    assert.equal(patch.startUTF16,
    node.range.start);
    assert.equal(patch.endUTF16,
    node.range.end);
    assert.ok(patch.startUTF16>=previous);
    assert.equal(result.request.source.slice(patch.startUTF16,
    patch.endUTF16),
    patch.originalText);
    assert.equal(result.request.source.slice(previous,
    patch.startUTF16),
    result.source.slice(previous+shift,
    patch.startUTF16+shift));
    assert.equal(result.source.slice(patch.startUTF16+shift,
    patch.startUTF16+shift+patch.replacementText.length),
    patch.replacementText);
    shift+=patch.replacementText.length-(patch.endUTF16-patch.startUTF16);
    previous=patch.endUTF16;
  }
  assert.equal(result.request.source.slice(previous),
  result.source.slice(previous+shift));
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
  true);
  const expected=structuredClone(original.model);
  expected.objects[1]=structuredClone(result.surface);
  assert.deepEqual(candidate.model,
  expected);
  assert.deepEqual(candidate.model,
  result.model);
  assert.deepEqual(result.originalSurface,
  original.model.objects[1]);
  assert.deepEqual(result.provenance.parameterMap,
  {
    kind:'identity',
    formula:'u=s;v=t',
    uD1Factor:1,
    vD1Factor:1
  }
  );
  assert.deepEqual(result.model.objects[0],
  result.originalModel.objects[0]);
  assert.equal(result.model.objects.filter(o=>o.id==='surface_strip_0').length,
  1);
}
const requestFor=(source,
surfaceId,
axis,
knot)=>({
  source,
  sourceVersion:0,
  surfaceId,
  axis,
  knot,
  maximumObservations:1024
});
function positive(name,
surface,
axis,
knot,
expected){
  const source=mixedSource(surface,
  axis),
  request=requestFor(source,
  surface.id,
  axis,
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
  surface);
  const originalFile=sourceFile(name+'.original',
  source,
  cold.model),
  requestFile=jsonFile(name+'.request',
  request),
  before=structuredClone(request),
  result=insert(request);
  assert.deepEqual(request,
  before);
  ownership([request],
  result);
  assert.deepEqual(Object.keys(result).sort(),
  ['request',
  'source',
  'originalModel',
  'model',
  'originalSurface',
  'surface',
  'provenance',
  'report'].sort());
  sourceOracle(result);
  const startOps=operations,
  ideal=idealInsertion(result),
  identity=wholeIdentity(result,
  ideal),
  native=nativeOracle(result),
  refU=result.surface.controlPoints.length,
  refV=result.surface.controlPoints[0].length,
  stripCount=axis==='u'?surface.controlPoints[0].length:surface.controlPoints.length,
  selectedCount=(axis==='u'?result.surface.knotsU:result.surface.knotsV).length,
  report=result.report;
  assert.deepEqual([native.count,
  stripCount,
  4*refU*refV+selectedCount,
  identity.cellCount,
  identity.coefficientCount],
  expected);
  const originalU=surface.controlPoints.length,
  originalV=surface.controlPoints[0].length,
  domain={
    u:[surface.knotsU[surface.degreeU],
    surface.knotsU[originalU]],
    v:[surface.knotsV[surface.degreeV],
    surface.knotsV[originalV]]
  }
  ;
  assert.equal(report.axis,
  axis);
  assert.deepEqual(report.degrees,
  {
    u:surface.degreeU,
    v:surface.degreeV
  }
  );
  assert.deepEqual(report.domain,
  domain);
  assert.deepEqual(result.provenance.domain,
  domain);
  assert.ok(Object.is(report.knot,
  knot));
  assert.ok(Object.is(result.provenance.knot,
  knot));
  assert.deepEqual(report.grids,
  {
    original:{
      u:originalU,
      v:originalV,
      total:originalU*originalV
    }
    ,
    refined:{
      u:refU,
      v:refV,
      total:refU*refV
    }
  }
  );
  assert.deepEqual(report.knotCounts,
  {
    original:{
      u:surface.knotsU.length,
      v:surface.knotsV.length
    }
    ,
    refined:{
      u:result.surface.knotsU.length,
      v:result.surface.knotsV.length
    }
  }
  );
  assert.equal(report.priorMultiplicity,
  ideal.priorMultiplicity);
  assert.equal(report.refinedMultiplicity,
  ideal.priorMultiplicity+1);
  assert.deepEqual(report.directCounts,
  {
    originalCompileCount:1,
    candidateCompileCount:1,
    coefficientInsertionCallCount:stripCount,
    insertedAxisKnotCount:1,
    nativeSurfaceValidationCount:2,
    domainQueryCount:2,
    patchCount:3,
    decimalEmissionCount:4*refU*refV+selectedCount,
    observationCount:native.count,
    surfaceD0Count:2*native.count,
    surfaceD1AttemptCount:2*native.count,
    surfaceD1EvaluatedCount:native.evaluated,
    surfaceD1RefusedCount:native.refused,
    curveD0Count:0,
    curveD1AttemptCount:0,
    sourceWriterCallCount:0,
    publicRefinementCallCount:0,
    rationalOperationCount:0
  }
  );
  const size=x=>({
    utf16:x.length,
    utf8:Buffer.byteLength(x)
  }
  );
  assert.deepEqual(report.sourceSizes,
  {
    original:size(source),
    candidate:size(result.source)
  }
  );
  assert.deepEqual(report.fileSizes,
  {
    request:size(nativeJSON(request)+'\n'),
    result:size(nativeJSON(result)+'\n')
  }
  );
  for(const value of Object.values(report.preservation))assert.equal(value,
  true);
  assert.equal(report.quality.geometricValidity,
  'not-certified');
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
  const candidateFile=sourceFile(name+'.candidate',
  result.source,
  result.model),
  saved=jsonFile(name+'.result',
  result);
  jsonFile(name+'.independent-tensor-identity',
  identity);
  jsonFile(name+'.independent-strip-rounding',
  {
    spanIndex:ideal.spanIndex,
    priorMultiplicity:ideal.priorMultiplicity,
    generated:ideal.generated
  }
  );
  jsonFile(name+'.oracle-work',
  {
    operations:operations-startOps,
    cumulativeOperations:operations,
    maximumBits,
    basisCacheSize:basisCache.size
  }
  );
  retained.push({
    value:request,
    before
  }
  );
  accepted.push({
    result,
    before:structuredClone(result)
  }
  );
  cases.push({
    name,
    requestFile:requestFile.file,
    resultFile:saved.file,
    originalFile,
    candidateFile,
    axis,
    grids:report.grids,
    samples:native.count,
    helperCalls:stripCount,
    emissions:report.directCounts.decimalEmissionCount,
    idealCells:identity.cellCount,
    idealCoefficientResiduals:identity.coefficientCount,
    actualStoredNonzero:identity.storedNonzero,
    oracleOperations:operations-startOps
  }
  );
  return {
    request,
    result,
    identity,
    native
  }
  ;
}
const makeNet=(id,
pu,
pv,
U,
V,
nu,
nv,
unit=false)=>({
  kind:'surface',
  id,
  degreeU:pu,
  degreeV:pv,
  knotsU:U,
  knotsV:V,
  controlPoints:Array.from({
    length:nu
  }
  ,
  (_,
  i)=>Array.from({
    length:nv
  }
  ,
  (_,
  j)=>unit?[i+j/4,
  -0,
  i/8+j/16+i*j/64]:[2*i+j/4+i*j/16,
  ((i+j)%2?-1:1)*(i+1)+j/2+i*j/8,
  i*i/4+j*j/8+i*j/32])),
  weights:Array.from({
    length:nu
  }
  ,
  (_,
  i)=>Array.from({
    length:nv
  }
  ,
  (_,
  j)=>unit?1:1+2*(i%2)+(j%3)/4+((i*j)%5)/8))
});
const U=[...Array(6).fill(-3),
-1,
2,
...Array(6).fill(5)],
V=[...Array(5).fill(-2),
-0,
...Array(5).fill(3)];
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
makeNet('main_surface',
5,
4,
U,
V,
8,
6),
'u',
.5,
[45,
6,
231,
8,
960]);
const secondary=positive('secondary',
makeNet('secondary_surface',
5,
4,
U,
V,
8,
6),
'v',
1,
[56,
8,
236,
9,
1080]);
const c0=positive('c0',
makeNet('c0_surface',
5,
1,
[...Array(6).fill(-2),
...Array(4).fill(-0),
...Array(6).fill(2)],
[0,
0,
1,
1],
10,
2),
'u',
-0,
[15,
2,
105,
2,
96]);
for(const row of c0.result.report.observations.filter(o=>o.u===0)){
  assert.equal(row.originalD1.status,
  'evaluated');
  assert.equal(row.refinedD1.status,
  'refused-c0');
  assert.equal(row.refinedD1.value,
  null);
  assert.equal(row.relativeDuDifference,
  null);
  assert.equal(row.relativeDvDifference,
  null);
}
const capacity=positive('capacity',
makeNet('capacity_surface',
1,
1,
[-0,
-0,
...Array.from({
  length:13
},
(_,
i)=>i+1),
14,
14],
[0,
0,
...Array.from({
  length:14
},
(_,
i)=>i+1),
15,
15],
15,
16,
true),
'u',
.125,
[992,
16,
1042,
225,
3600]);
assert.equal(capacity.native.refused,
1355);
assert.equal(capacity.native.evaluated,
629);
assert.equal(capacity.identity.storedNonzero,
0);
for(const row of capacity.result.report.observations){
  assert.ok(Object.is(row.originalPointMM[1],
  -0));
  assert.ok(Object.is(row.refinedPointMM[1],
  -0));
  for(const state of [row.originalD1,
  row.refinedD1])if(state.status==='evaluated'){
    assert.ok(Object.is(state.value.du[1],
    0));
    assert.ok(Object.is(state.value.dv[1],
    0));
  }
  else assert.equal(state.value,
  null);
}
assert.equal(cases.reduce((n,
c)=>n+c.idealCells,
0),
244);
assert.equal(cases.reduce((n,
c)=>n+c.idealCoefficientResiduals,
0),
5736);
assert.ok(main.identity.storedNonzero>0);
assert.ok(secondary.identity.storedNonzero>0);
assert.deepEqual(validate(main.result),
main.result.report);
const newU=main.result.provenance.strips[0].calculation.steps[0].generatedPoles[0].refinedPoleIndex,
newV=2,
editRequest={
  source:main.result.source,
  sourceVersion:0,
  surfaceId:main.result.surface.id,
  edits:{
    poleEdits:[{
      uIndex:newU,
      vIndex:newV,
      xMM:main.result.surface.controlPoints[newU][newV][0]+.25
    }
    ]
  }
},
edit=editSourceSurfaceControlNetWide(editRequest);
assert.deepEqual(validateSourceSurfaceControlNetWideEdit(edit),
edit.report);
assert.notEqual(edit.source,
main.result.source);
assert.ok(edit.report.maximumObservedChangeMM>0);
assert.deepEqual(edit.surface.knotsU,
main.result.surface.knotsU);
assert.deepEqual(edit.surface.knotsV,
main.result.surface.knotsV);
assert.deepEqual(edit.model.objects[0],
main.result.model.objects[0]);
assert.deepEqual(edit.model.objects[2],
main.result.model.objects[2]);
sourceFile('actual1147-generated-pole-edit',
edit.source,
edit.model);
jsonFile('actual1147-generated-pole-edit-request',
editRequest);
jsonFile('actual1147-generated-pole-edit',
edit);
function intact(){
  for(const row of retained)assert.deepEqual(row.value,
  row.before);
  for(const row of accepted)assert.deepEqual(row.result,
  row.before);
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
  maximumObservations:1023
}
),
'BUDGET');
reject('wrong-axis',
()=>insert({
  ...main.request,
  axis:'w'
}
),
'REQUEST');
reject('wrong-kind-target',
()=>insert({
  ...main.request,
  surfaceId:'surface_strip_0'
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
reject('opposite-existing-zero',
()=>insert({
  ...c0.request,
  knot:+0
}
),
'REQUEST');
reject('actual-selected-axis-16-overflow',
()=>insert(requestFor(capacity.result.source,
capacity.result.surface.id,
'u',
.25)),
'BUDGET');
reject('actual-selected-multiplicity-overflow',
()=>insert(requestFor(c0.result.source,
c0.result.surface.id,
'u',
-0)),
'REQUEST');
const commentCold=compileCadModel(main.request.source,
{
  sourceVersion:0
});
assert.equal(commentCold.ok,
true);
const selected=commentCold.ast.declarations.find(d=>d.kind==='surface'&&d.id===main.request.surfaceId),
start=selected.fields.find(f=>f.name==='control-points').value.range.start,
commented=main.request.source.slice(0,
start+1)+'/* legal selected-array comment */'+main.request.source.slice(start+1),
commentedModel=compileCadModel(commented,
{
  sourceVersion:0
});
assert.equal(commentedModel.ok,
true);
assert.deepEqual(commentedModel.model,
main.result.originalModel);
sourceFile('genuine-selected-array-comment',
commented,
commentedModel.model);
reject('selected-array-comment',
()=>insert({
  ...main.request,
  source:commented
}
),
'TARGET');
const unsafe=makeNet('unsafe_surface',
1,
1,
[0,
0,
8,
8],
[0,
0,
1,
1],
2,
2,
true),
unsafeSource=mixedSource(unsafe,
'u'),
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
'u',
2*Number.MIN_VALUE)),
'REPRESENTABILITY');
assert.match(failures.at(-1).causeMessage,
/strict convex insertion coefficient is not representable/);
const norm=makeNet('norm_surface',
1,
1,
[0,
0,
3e-308,
3e-308],
[0,
0,
1,
1],
2,
2,
true);
norm.controlPoints=[[[-1.65,
-1.65,
-1.65],
[-1.65,
-1.5,
-1.65]],
[[1.65,
1.65,
1.65],
[1.65,
1.8,
1.65]]];
const normSource=mixedSource(norm,
'u'),
normCold=compileCadModel(normSource,
{
  sourceVersion:0
});
assert.equal(normCold.ok,
true);
sourceFile('genuine-finite-component-norm-overflow',
normSource,
normCold.model);
let normError;
try{
  insert(requestFor(normSource,
  norm.id,
  'u',
  1.5e-308));
}
catch(error){
  normError=error;
}
assert.ok(normError instanceof InsertionError);
assert.ok(['REPRESENTABILITY',
'NATIVE'].includes(normError.code));
failures.push({
  name:'genuine-partial-norm-overflow-or-actual-upstream-native-refusal',
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
const cycle={
  ...main.request
};
cycle.cycle=cycle;
reject('cyclic-request',
()=>insert(cycle),
'INPUT');
const sparse={
  ...main.request,
  extra:[1,
  2]
};
delete sparse.extra[0];
reject('sparse-request',
()=>insert(sparse),
'INPUT');
const foreign={
  ...main.request
};
Object.setPrototypeOf(foreign,
Date.prototype);
reject('foreign-request',
()=>insert(foreign),
'INPUT');
const hidden={
  ...main.request
};
Object.defineProperty(hidden,
'hidden',
{
  value:1
});
reject('hidden-request',
()=>insert(hidden),
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
['unused-sibling',
r=>{
  r.model.objects[0].controlPoints[0][0]=.125;
}
],
['nonselected-knot',
r=>{
  r.surface.knotsV[5]=.125;
}
],
['generated-pole',
r=>{
  r.surface.controlPoints[2][2][0]+=.125;
}
],
['strip-weight',
r=>{
  r.provenance.strips[1].calculation.candidate.weights[2]+=.125;
}
],
['private-working-id',
r=>{
  r.provenance.strips[0].originalCurve.id+='x';
}
],
['row-map',
r=>{
  r.provenance.unchangedPoles[0].refinedUIndex++;
}
],
['alpha',
r=>{
  r.provenance.strips[0].calculation.steps[0].generatedPoles[0].alpha+=.01;
}
],
['homogeneous-blend',
r=>{
  r.provenance.strips[1].calculation.homogeneousSteps[0].generatedPoles[0].generated[0]+=.125;
}
],
['patch-range',
r=>{
  r.provenance.patches[0].startUTF16++;
}
],
['native-d0',
r=>{
  r.report.observations[0].refinedPointMM[0]+=.125;
}
],
['native-du',
r=>{
  r.report.observations[0].originalD1.value.du[0]+=.125;
}
],
['counter',
r=>{
  r.report.directCounts.curveD0Count++;
}
],
['file-size',
r=>{
  r.report.fileSizes.result.utf8++;
}
],
['global-error-claim',
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
  'Non-noop '+name);
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
'dist/source-surface-knot-insertion.d.ts'),
publicAPI=await import(pathToFileURL(runtimePath).href);
for(const name of runtimeNames)assert.equal(typeof publicAPI[name],
name.endsWith('Code')?'object':'function');
assert.deepEqual(publicAPI.SourceSurfaceKnotInsertionDiagnosticCode,
codes);
assert.ok(readFileSync(declarationPath,
'utf8').includes('./source-surface-knot-insertion.js'));
for(const name of [...runtimeNames,
...typeNames])assert.ok(readFileSync(leafDeclarationPath,
'utf8').includes(name),
name);
const currentRequest=JSON.parse(readFileSync(cases[0].requestFile,
'utf8')),
currentResult=JSON.parse(readFileSync(cases[0].resultFile,
'utf8'));
assert.deepEqual(publicAPI.insertSourceSurfaceKnot(currentRequest),
currentResult);
assert.deepEqual(publicAPI.validateSourceSurfaceKnotInsertion(currentResult),
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
'source-surface-knot-insertion.js',
'source-surface-knot-insertion.d.ts'].map(name=>{
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
}
),
compiledConsumer={
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
assert.ok(operations<=20000000&&maximumBits<=8192);
jsonFile('independent-proof-total-work',
{
  operations,
  maximumBits,
  basisCacheSize:basisCache.size,
  idealCells:244,
  idealResidualCoefficients:5736,
  limits:{
    primitiveOperations:20000000,
    integerBits:8192,
    fractionCharacters:5000
  }
});
const summary={
  sourceMode:true,
  cases,
  failures,
  priorRefusals,
  compiledConsumer,
  getterCalls,
  actual1147GeneratedPole:{
    uIndex:newU,
    vIndex:newV
  }
  ,
  oracleOperations:operations,
  maximumOracleBits:maximumBits,
  scope:'Complete-source one-axis Surface insertion and local native observations; independent ideal whole tensor identity and actual stored rounding are separate. No global shape/error, continuity, regularity, normals, embedding, topology, Body/Solid, manufacturing, editor/renderer/persistence or publication acceptance.'
};
jsonFile('summary',
summary);
intact();
console.log(JSON.stringify(summary));
