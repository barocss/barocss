import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Scalar controls only. The bundle allowlist excludes every geometry provider.
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const { build } = require('esbuild');
const entries = process.env.CAD_BERNSTEIN_ROOT_TEST_ENTRY
  ? [resolve(process.env.CAD_BERNSTEIN_ROOT_TEST_ENTRY)]
  : ['../src/own-homogeneous-bernstein-roots.ts', '../dist/own-homogeneous-bernstein-roots.js'].map(p => fileURLToPath(new URL(p, import.meta.url)));
const allowed = new Set(['own-homogeneous-bernstein-roots', 'section-rational-internal']);
const load = async entry => {
  const bundled = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
    plugins: [{ name: 'scalar-only-boundary', setup(builder) {
      builder.onLoad({ filter: /\.[cm]?[jt]s$/ }, args => {
        assert.ok(allowed.has(basename(args.path, extname(args.path))), 'No Native geometry or provider module admitted: ' + args.path);
        return undefined;
      });
    } }] });
  assert.ok(Object.keys(bundled.metafile.inputs).every(p => allowed.has(basename(p, extname(p)))));
  return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
};

// Independent exact dyadic oracle; production uses the existing rational context.
function dyadic(value) {
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false), exponent = Number(bits >> 52n & 2047n);
  const fraction = bits & 0xfffffffffffffn, significand = exponent ? (1n << 52n) + fraction : fraction;
  const power = exponent ? exponent - 1075 : -1074, signed = bits >> 63n ? -significand : significand;
  return power >= 0 ? { n: signed << BigInt(power), d: 1n } : { n: signed, d: 1n << BigInt(-power) };
}
const add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const mul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
const negative = a => ({ n: -a.n, d: a.d });
function exactSign(values, parameter) {
  const t = dyadic(parameter), s = add({ n: 1n, d: 1n }, negative(t));
  const f = values.map(dyadic);
  const value = values.length === 2 ? add(mul(f[0], s), mul(f[1], t))
    : add(add(mul(f[0], mul(s, s)), mul({ n: 2n, d: 1n }, mul(f[1], mul(s, t)))), mul(f[2], mul(t, t)));
  return value.n < 0n ? -1 : value.n > 0n ? 1 : 0;
}
function inspectRecovery(equation, roots, width) {
  assert.equal(roots.length, 1); const root = roots[0], recovery = equation.endpointCrossingRecovery;
  assert.ok(recovery); assert.equal(recovery.policy, 'exact-stored-binary64-Bernstein-sign-isolation');
  assert.deepEqual(Object.keys(root), ['t', 'bracket', 'iterations', 'touch']);
  assert.equal(root.touch, false); assert.ok(root.bracket[0] > 0 && root.bracket[1] < 1);
  assert.ok(root.bracket[0] < root.t && root.t < root.bracket[1]); assert.ok(root.bracket[1] - root.bracket[0] <= width);
  assert.ok(root.iterations > 0 && root.iterations <= 64); assert.deepEqual(recovery.bracket, root.bracket);
  assert.equal(recovery.iterations, root.iterations); assert.equal(recovery.parameterWidthTarget, width);
  const signs = root.bracket.map(t => exactSign(equation.bernstein, t));
  assert.deepEqual(signs, recovery.originalEndpointSigns); assert.equal(signs[0], -signs[1]);
  assert.ok(recovery.exactWork.operations > 0 && recovery.exactWork.operations <= 200000);
  assert.ok(recovery.exactWork.maximumObservedBits <= 8192);
  assert.equal(recovery.exactWork.floatConversions, 0); assert.equal(recovery.exactWork.floatSearchSteps, 0);
  assert.ok(Buffer.byteLength(JSON.stringify(recovery)) < 1024, 'Recovery exposes bounded numeric evidence, never raw BigInt');
}
// Captured from immutable c0cf5f86 before the first implementation edit.
const goldens = [
  { f: [-1,0,1], e: { bernstein:[-1,0,1],power:[0,2,-1],degree:'linear',discriminant:null,uncertainty:2.842170943040401e-14 },
    roots:[{t:.5,bracket:[.49999999999954525,.5000000000004547],iterations:40,touch:false}] },
  { f:[1,-2,1],e:{bernstein:[1,-2,1],power:[6,-6,1],degree:'quadratic',discriminant:12,uncertainty:4.263256414560601e-13},
    roots:[{t:.21132486540545867,bracket:[.21132486540500392,.21132486540591341],iterations:39,touch:false},{t:.7886751345945413,bracket:[.7886751345940866,.788675134594996],iterations:39,touch:false}] },
  { f:[0,-1,1],e:{bernstein:[0,-1,1],power:[3,-2,0],degree:'quadratic',discriminant:4,uncertainty:2.842170943040401e-14},
    roots:[{t:0,bracket:[0,0],iterations:0,touch:false},{t:.6666666666663635,bracket:[.6666666666660603,.6666666666666667],iterations:40,touch:false}] },
  { f:[1,-1,0],e:{bernstein:[1,-1,0],power:[3,-4,1],degree:'quadratic',discriminant:4,uncertainty:1.9895196601282805e-13},
    roots:[{t:.33333333333303017,bracket:[.333333333332727,.33333333333333337],iterations:40,touch:false},{t:1,bracket:[1,1],iterations:0,touch:false}] },
  { f:[0,0,1],e:{bernstein:[0,0,1],power:[1,0,0],degree:'quadratic',discriminant:0,uncertainty:0},roots:[{t:0,bracket:[0,0],iterations:0,touch:true}] },
  { f:[1,0,0],e:{bernstein:[1,0,0],power:[1,-2,1],degree:'quadratic',discriminant:0,uncertainty:5.684341886080802e-14},roots:[{t:1,bracket:[1,1],iterations:0,touch:true}] },
  { f:[1,2,3],e:{bernstein:[1,2,3],power:[0,2,1],degree:'linear',discriminant:null,uncertainty:2.842170943040401e-14,exclusionPolicy:'strict-Bernstein-sign-control-hull-exclusion'},roots:[] },
  { f:[-4.2e-8,34.3,260000000],e:{bernstein:[-4.2e-8,34.3,260000000],power:[259999931.39999995,68.600000084,-4.2e-8],degree:'quadratic',discriminant:4749.64,uncertainty:3.3748221994756025e-11},
    roots:[{t:6.107256922405213e-10,bracket:[6.102709448896348e-10,6.111804395914078e-10],iterations:40,touch:false}] },
];
for (const entry of entries) {
  const api = await load(entry), equation = api.createHomogeneousBernsteinEquation, solve = api.solveHomogeneousBernsteinEquation;
  const mode = entry.endsWith('.ts') ? 'source' : 'emitted';
  for (const [i, golden] of goldens.entries()) test(mode + ' original profile ' + i + ' exact bytes/order', () => {
    const e = equation([...golden.f]), roots = solve(e);
    assert.deepEqual(e, golden.e); assert.deepEqual(roots, golden.roots);
    assert.equal(JSON.stringify(e), JSON.stringify(golden.e)); assert.equal(JSON.stringify(roots), JSON.stringify(golden.roots));
    assert.deepEqual(Object.keys(e), Object.keys(golden.e)); assert.equal(Object.hasOwn(e, 'endpointCrossingRecovery'), false);
  });
  for (const scale of [1,-1,2,-.5]) test(mode + ' C1 exact crossing scale ' + scale, () => {
    const values = [260000000,34.3,-4.2e-8].map(v => v * scale), e = equation(values), before = structuredClone(e);
    const roots = solve(e); inspectRecovery(e, roots, 1e-12);
    for (const key of Object.keys(before)) assert.deepEqual(e[key], before[key]);
    assert.equal(roots[0].t, .9999999993892743); assert.ok(roots[0].t !== 1);
  });
  test(mode + ' loose target still obtains strict interior endpoint bracket', () => {
    const e = equation([260000000,34.3,-4.2e-8]), roots = solve(e, { parameterWidthTarget:.9 });
    inspectRecovery(e,roots,.9); assert.ok(roots[0].iterations > 1);
  });
  test(mode + ' unrepresentable fine midpoint refuses without endpoint clamp', () => {
    const e = equation([260000000,34.3,-4.2e-8]);
    assert.throws(() => solve(e,{parameterWidthTarget:Number.MIN_VALUE,label:'bounded scalar'}), /bounded scalar: exact crossing.*representable|bounded scalar: exact crossing.*within64/);
    assert.equal(Object.hasOwn(e,'endpointCrossingRecovery'),false);
  });
  test(mode + ' old endpoint-rounding and tangent refusals remain', () => {
    assert.throws(() => solve(equation([1,.25,-Number.MIN_VALUE])), /interior root rounded to quarter end/);
    assert.throws(() => solve(equation([-Number.MIN_VALUE,2,1])), /interior root rounded to quarter start/);
    const e = equation([1,-1,1]); assert.throws(() => solve(e), /unresolved interior tangent\/discriminant ambiguity/);
    assert.deepEqual(e,{bernstein:[1,-1,1],power:[4,-4,1],degree:'quadratic',discriminant:0,uncertainty:2.2737367544323206e-13});
    assert.equal(Object.hasOwn(e,'endpointCrossingRecovery'),false);
  });
  test(mode + ' old strict negative hull and coincident profiles retain empty result', () => {
    for (const f of [[-1,-2,-3],[0,0,0],[-0,-0,-0]]) {
      const e = equation(f); assert.deepEqual(solve(e),[]); assert.equal(Object.hasOwn(e,'endpointCrossingRecovery'),false);
      assert.deepEqual(e.bernstein,f);
    }
  });
  test(mode + ' every old false-empty exit obeys original coefficient crossing proof', () => {
    // Alter only derived classifications to exercise false-empty branches.
    // These are scalar branch controls, not genuine Native equations.
    for (const degree of ['constant','zero','quadratic']) {
      const e = equation([260000000,34.3,-4.2e-8]); e.degree = degree;
      if (degree === 'quadratic') e.discriminant = -e.uncertainty * 2;
      inspectRecovery(e,solve(e),1e-12);
    }
  });
  test(mode + ' exact midpoint zero obtains opposite quarter signs', () => {
    const e = equation([-1,0,1]); e.degree = 'constant'; const roots = solve(e);
    inspectRecovery(e,roots,1e-12); assert.equal(roots[0].t,.5);
  });
  test(mode + ' scalar input/width guards retain original refusal labels', () => {
    for (const width of [0,1,NaN,Infinity]) assert.throws(() => solve(equation([1,0,-1]),{parameterWidthTarget:width,label:'scalar control'}), /^Error: scalar control: finite positive subspan root-width target required$/);
    assert.throws(() => equation([1,NaN,-1]), /degree1\/2 finite Bernstein coefficients required/);
    assert.throws(() => equation([Number.MAX_VALUE,0,-1]), /finite native root\/coefficient arithmetic required/);
  });
}
const rationalEntry = fileURLToPath(new URL('../src/section-rational-internal.ts',import.meta.url));
const rationalAPI = await load(rationalEntry);
test('existing exact context retains integer8192 and operation200000 ceilings', () => {
  const fail = (code,detail) => { throw new Error(code+': '+detail); };
  const bits = new rationalAPI.SectionRationalContext(fail);
  assert.throws(() => bits.rat(1n<<8192n),/BUDGET: Exact rational integer bit budget exceeded/);
  const operations = new rationalAPI.SectionRationalContext(fail);
  assert.throws(() => { for(let i=0;i<200001;i++)operations.integer(0); },/BUDGET: Exact rational operation budget exceeded/);
});
