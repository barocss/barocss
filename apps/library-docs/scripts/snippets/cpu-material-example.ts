import { compileEngineUVRepeatingMaterial, evaluateAuthoredMaterial, AuthoredMaterialEvaluationError } from '@barocss/gpu';
import { deepStrictEqual } from 'node:assert';
import { writeFile } from 'node:fs/promises';
import type { AuthoredMaterialSample } from '@barocss/gpu';

const source = `
@shader #phase {
  @uniform phase: float(-1,1,0);
  @let ratio: float(fract(clamp(uv_u,-999,999)+phase));
  @fragment { color: mix(#000000,#FFFFFF,ratio); }
}`;
const compiled = compileEngineUVRepeatingMaterial(source);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (value !== null && typeof value === 'object' && !found.has(value)) {
    found.add(value);
    for (const child of Object.values(value)) objects(child, found);
  }
  return found;
}
const requests = {
  defaults: { material: compiled.material, uniforms: {}, uv: [-0.25, 0] as [number, number] },
  phaseHalf: { material: compiled.material, uniforms: { phase: 0.5 }, uv: [-0.25, 0] as [number, number] },
  negativeZero: { material: compiled.material, uniforms: { phase: -0 }, uv: [-0, -0] as [number, number] },
};
const callersBefore = structuredClone(requests);
const callerObjects = objects(requests);
const sampleObjects = new Set<object>();
const samples = {
  defaults: evaluateAuthoredMaterial(requests.defaults),
  phaseHalf: evaluateAuthoredMaterial(requests.phaseHalf),
  negativeZero: evaluateAuthoredMaterial(requests.negativeZero),
};
for (const [name, sample] of Object.entries(samples)) {
  check(sample.format === 'barocss-gpu-authored-material-sample' && sample.version === 0, `${name}: sample format`);
  check(sample.profile === 'binary64-linear-rgb-v0' && sample.colorSpace === 'linear-rgb' && sample.uvUnit === 'dimensionless', `${name}: sample profile/units`);
  check(sample.source === source && sample.material.source === source, `${name}: original source`);
  check(sample.material !== compiled.material && sample.uv !== null, `${name}: fresh material/UV`);
  for (const object of objects(sample)) {
    check(Object.isFrozen(object), `${name}: sample is not deeply frozen`);
    check(!callerObjects.has(object), `${name}: caller object alias`);
    check(!sampleObjects.has(object), `${name}: shared sample object`);
    sampleObjects.add(object);
  }
}
deepStrictEqual(samples.defaults.linearRGB, [0.75, 0.75, 0.75]);
deepStrictEqual(samples.phaseHalf.linearRGB, [0.25, 0.25, 0.25]);
check(samples.defaults.uniforms.phase === 0 && samples.phaseHalf.uniforms.phase === 0.5, 'Resolved phase values');
check(samples.negativeZero.uv?.every(value => Object.is(value, -0)), 'UV negative zero was lost');
check(Object.is(samples.negativeZero.uniforms.phase, 0), 'Resolved phase must be positive zero');
check(samples.negativeZero.linearRGB.every(value => Object.is(value, 0)), 'Final RGB must be positive zero');
deepStrictEqual(requests, callersBefore);

let accepted = samples.phaseHalf;
const priorAccepted = accepted;
const acceptedBefore = structuredClone(accepted);
let refusal: { name: string; code: string; message: string } | undefined;
try {
  accepted = evaluateAuthoredMaterial({ material: compiled.material, uniforms: { phase: 2 }, uv: [-0.25, 0] });
} catch (error) {
  if (!(error instanceof AuthoredMaterialEvaluationError)) throw error;
  check(error.code === 'UNIFORM', 'Expected declared phase-range refusal');
  refusal = { name: error.name, code: error.code, message: error.message };
}
check(refusal !== undefined && accepted === priorAccepted, 'Accepted sample was not retained');
deepStrictEqual(accepted, acceptedBefore);
deepStrictEqual(requests, callersBefore);
function summarize(sample: AuthoredMaterialSample) {
  return {
    uniforms: sample.uniforms,
    uv: sample.uv,
    linearRGB: sample.linearRGB,
    uvNegativeZero: sample.uv?.map(value => Object.is(value, -0)),
    uniformPhaseNegativeZero: Object.is(sample.uniforms.phase, -0),
    rgbNegativeZero: sample.linearRGB.map(value => Object.is(value, -0)),
  };
}
const summary = {
  format: 'barocss-docs-cpu-material-consumer', status: 'passed',
  package: '@barocss/gpu', packageVersion: '0.0.0', shaderId: samples.defaults.material.shaderId,
  sampleFormat: samples.defaults.format, sampleVersion: samples.defaults.version,
  sampleProfile: samples.defaults.profile, colorSpace: samples.defaults.colorSpace, uvUnit: samples.defaults.uvUnit,
  materialFormat: samples.defaults.material.format, materialProfile: samples.defaults.material.profile,
  sourceMatched: true,
  cases: { defaults: summarize(samples.defaults), phaseHalf: summarize(samples.phaseHalf), negativeZero: summarize(samples.negativeZero) },
  negativeZeroRequest: { uv: requests.negativeZero.uv.map(value => Object.is(value, -0)), phase: Object.is(requests.negativeZero.uniforms.phase, -0) },
  verification: { deeplyFrozen: true, freshIndependentSamples: true, noCallerObjectAliases: true, callerDataRetained: true },
  refusal, acceptedSampleRetained: true,
  scope: 'Binary64 authored linear RGB CPU evaluation; no renderer, lighting, gamma, texture, Float32 or pixels.',
};
check(process.cwd().endsWith('/apps/library-docs'), 'Selected consumer requires the documentation app working directory');
await writeFile('evidence/cpu-material-consumer.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
