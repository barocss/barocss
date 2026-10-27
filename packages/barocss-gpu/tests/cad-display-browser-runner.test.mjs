// Synthetic runner/preparation contracts. These tests never load Playwright or run a browser/server.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-display-browser-runner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertRunAuthority, CASES, parseArgs, prepareHarness, REQUIRED_CAPTURES, REQUIRED_CHECKS, REQUIRED_INSTANCE_CAPTURES, REQUIRED_INSTANCE_CHECKS, routeFile, validateCase, validateMatrix } from './cad-display-browser.mjs';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5e8AAAAASUVORK5CYII=';
const synthetic = ({ backend, dpr }) => ({
  backend, dpr, display: { css: [640, 480], backing: [640 * dpr, 480 * dpr], actualDpr: dpr },
  environment: { backend, ...(backend === 'webgpu' ? { adapter: { vendor: 'synthetic-validation-only' }, device: true } : { renderer: 'synthetic-validation-only', version: 'WebGL 2.0 (synthetic)' }), shaderErrors: [] },
  checks: REQUIRED_CHECKS.map(name => ({ name, pass: true, actual: { synthetic: true }, expected: { synthetic: true } })),
  unsupported: [{ combination: 'synthetic-scope', supported: false }], captures: REQUIRED_CAPTURES.map(name => ({ name, dataUrl: png })), errors: [],
});
const copy = value => structuredClone(value);
const syntheticInstance = expected => ({ ...synthetic(expected), instances: true, instanceChecks: REQUIRED_INSTANCE_CHECKS.map(name => ({ name, pass: true, actual: { synthetic: true }, expected: { synthetic: true } })), captures: [...synthetic(expected).captures, ...REQUIRED_INSTANCE_CAPTURES.map(name => ({ name, dataUrl: png }))] });

test('instance extension is explicit; default retains thirteen rows and flag requires six retained controls and four feature checks across all four cases', () => {
  assert.equal(REQUIRED_CHECKS.length, 13); assert.equal(REQUIRED_CAPTURES.length, 16); assert.equal(REQUIRED_INSTANCE_CHECKS.length, 10);
  assert.deepEqual(validateMatrix(CASES.map(synthetic)), []);
  assert.deepEqual(validateMatrix(CASES.map(syntheticInstance), { instances: true }), []);
  assert.ok(validateMatrix(CASES.map(synthetic), { instances: true }).length);
  for (const mutate of [
    r => { delete r.instances; }, r => { r.instances = false; }, r => { delete r.instanceChecks; }, r => { r.instanceChecks = {}; },
    r => { r.instanceChecks.pop(); }, r => { r.instanceChecks[1] = copy(r.instanceChecks[0]); },
    r => { r.instanceChecks[0].pass = false; }, r => { r.instanceChecks[0].skipped = true; }, r => { r.instanceChecks[0].unsupported = true; }, r => { r.instanceChecks[0].status = 'unsupported'; },
    r => { delete r.instanceChecks[0].actual; }, r => { delete r.instanceChecks[0].expected; },
    r => { r.captures = r.captures.filter(c => c.name !== REQUIRED_INSTANCE_CAPTURES[0]); },
  ]) { const report = syntheticInstance(CASES[0]); mutate(report); assert.ok(validateCase(report, CASES[0], { instances: true }).length); }
  const matrix = CASES.map(syntheticInstance); delete matrix[2].instanceChecks; assert.ok(validateMatrix(matrix, { instances: true }).length);
});

test('--instances parses as an explicit opt-in and duplicate flags fail without loading the browser', () => {
  assert.deepEqual(parseArgs(['--prepare', '--instances', '--out', '/tmp/instances-preparation'], {}), { mode: 'prepare', instances: true, out: '/tmp/instances-preparation' });
  assert.throws(() => parseArgs(['--prepare', '--instances', '--instances', '--out', '/tmp/no'], {}), /Repeated/);
  assert.throws(() => parseArgs(['--run', '--instances', '--out', '/tmp/no'], {}), /requires/);
});

test('synthetic validation requires exactly the serial WebGPU/WebGL2 x DPR1/2 matrix with all 13 named checks', () => {
  assert.equal(CASES.length, 4); assert.equal(REQUIRED_CHECKS.length, 13); assert.equal(REQUIRED_CAPTURES.length, 16);
  assert.deepEqual(validateMatrix(CASES.map(synthetic)), []);
  for (const reports of [[], CASES.slice(0, 3).map(synthetic), [...CASES.map(synthetic), synthetic(CASES[0])], [synthetic(CASES[0]), synthetic(CASES[0]), synthetic(CASES[2]), synthetic(CASES[3])], [undefined, ...CASES.slice(1).map(synthetic)]]) assert.ok(validateMatrix(reports).length);
});

test('synthetic validation rejects missing, duplicate, skipped, unsupported-only or failed check rows', () => {
  for (const mutate of [
    r => { r.checks = []; }, r => { r.checks.pop(); }, r => { r.checks[1] = copy(r.checks[0]); },
    r => { r.checks[0].pass = false; }, r => { delete r.checks[0].pass; }, r => { delete r.checks[0].actual; }, r => { delete r.checks[0].expected; },
    r => { r.checks.forEach(row => { row.status = 'unsupported'; }); }, r => { r.checks[0].skipped = true; }, r => { r.checks[0].unsupported = true; },
  ]) { const report = synthetic(CASES[0]); mutate(report); assert.ok(validateCase(report, CASES[0]).length); }
});

test('synthetic validation rejects adapter fallback, wrong actual DPR/backing and shader/device error evidence', () => {
  for (const mutate of [
    r => { r.backend = 'webgl2'; }, r => { r.dpr = 2; }, r => { r.display.actualDpr = 2; }, r => { r.display.backing = [640, 481]; },
    r => { r.environment.backend = 'webgl2'; }, r => { delete r.environment.adapter; }, r => { r.environment.adapter = {}; }, r => { r.environment.device = false; },
    r => { r.environment.shaderErrors.push('WGSL error'); }, r => { delete r.environment.shaderErrors; }, r => { r.errors.push('Device lost'); }, r => { delete r.errors; },
  ]) { const report = synthetic(CASES[0]); mutate(report); assert.ok(validateCase(report, CASES[0]).length); }
  const gl = synthetic(CASES[2]); gl.environment.version = 'WebGL 1.0'; assert.ok(validateCase(gl, CASES[2]).length);
});

test('synthetic validation requires all mode and quarter/octant PNG captures and scope diagnostics', () => {
  for (const mutate of [
    r => { r.captures = []; }, r => { r.captures.pop(); }, r => { r.captures[1].name = r.captures[0].name; },
    r => { r.captures[0].dataUrl = 'data:image/jpeg;base64,no'; }, r => { delete r.unsupported; }, r => { r.unsupported = []; },
  ]) { const report = synthetic(CASES[0]); mutate(report); assert.ok(validateCase(report, CASES[0]).length); }
});

test('argument/authority helpers enforce preparation and exact clean immutable run authorization without loading Playwright', () => {
  assert.deepEqual(parseArgs(['--prepare', '--out', '/tmp/only-preparation'], {}), { mode: 'prepare', out: '/tmp/only-preparation' });
  const sha = 'a'.repeat(40), env = { CHROME: '/tmp/chrome', PW_DIR: '/tmp/playwright' };
  const options = parseArgs(['--run', '--out', '/tmp/not-executed', '--lease', 'coordinator-slot', '--sha', sha], env);
  assert.doesNotThrow(() => assertRunAuthority(options, { sha, status: '' }, env));
  for (const args of [[], ['--prepare'], ['--prepare', '--run', '--out', '/tmp/no'], ['--prepare', '--out', 'relative'], ['--run', '--out', '/tmp/no'], ['--prepare', '--out', '/tmp/no', '--unknown']]) assert.throws(() => parseArgs(args, {}));
  assert.throws(() => assertRunAuthority(options, { sha, status: '?? untracked.txt' }, env));
  assert.throws(() => assertRunAuthority(options, { sha: 'b'.repeat(40), status: '' }, env));
  assert.throws(() => assertRunAuthority({ ...options, lease: '' }, { sha, status: '' }, env));
  assert.throws(() => assertRunAuthority(options, { sha, status: '' }, {}));
});

test('exact local routes deny traversal, query and checkout access', () => {
  assert.equal(routeFile('/'), 'index.html'); assert.equal(routeFile('/fixture.js'), 'fixture.js');
  for (const route of ['/index.html', '/favicon.ico', '/fixture.js?x=1', '/../package.json', '/%2e%2e/package.json', '/packages/barocss-gpu/src/index.ts']) assert.equal(routeFile(route), null);
});

test('prepareHarness bundles synthetic source and records source/output hashes without executing fixture, browser or server', async () => {
  const root = await mkdtemp(join(tmpdir(), 'g21-prepare-unit-'));
  try {
    const fixture = join(root, 'fixture.ts'), outDir = join(root, 'prepared');
    const source = 'const neverRun: string = "preparation-only"; throw new Error(neverRun); export const marker = true;\n';
    await writeFile(fixture, source);
    const manifest = await prepareHarness({ root, outDir, fixture });
    assert.equal(manifest.kind, 'preparation-only'); assert.equal(manifest.actualBrowserExecuted, false); assert.equal(manifest.runnerPid, process.pid);
    assert.equal(manifest.sources.find(item => item.path === fixture).sha256, createHash('sha256').update(source).digest('hex'));
    for (const output of manifest.outputs) assert.equal(output.sha256, createHash('sha256').update(await readFile(join(outDir, output.path))).digest('hex'));
    const persisted = JSON.parse(await readFile(join(outDir, 'prepare.json'), 'utf8'));
    assert.deepEqual(persisted.requiredChecks, REQUIRED_CHECKS); assert.equal(persisted.actualBrowserExecuted, false);
    assert.match(await readFile(join(outDir, 'fixture.js'), 'utf8'), /preparation-only/);
    assert.match(await readFile(join(outDir, 'index.html'), 'utf8'), /src="\/fixture.js"/);
    await assert.rejects(prepareHarness({ root, outDir, fixture }), /must be empty/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
