import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browserTestFiles, checkBrowserEnvironment, parseTapSummary, assertRealRun, loadKnownFailures, runBrowserSuites, chromeFlagSets, selectChromeFlags } from './browser-ci.mjs';

const clean = { tests: 3, pass: 3, fail: 0, cancelled: 0, skipped: 0, todo: 0, skips: [] };
const tap = `TAP version 13
# Subtest: gpu renders
    ok 1 - draws a triangle
      ---
      duration_ms: 12.5
      ...
    ok 2 - reads back pixels # SKIP no adapter
    ok 3 - recovers after loss
1..3
ok 1 - suite
# tests 3
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 1
# todo 0
# duration_ms 123.4
`;

test('browserTestFiles keeps only sorted browser tests and rejects empty sets', () => {
  assert.deepEqual(browserTestFiles(['b-browser.test.mjs', 'a-browser.test.mjs', 'c.test.mjs', 'cad-dist.mjs', 'x-browser.test.mjs.bak']), ['tests/a-browser.test.mjs', 'tests/b-browser.test.mjs']);
  assert.throws(() => browserTestFiles(['c.test.mjs']), /no browser test files/);
});

test('checkBrowserEnvironment runs, fails in CI and reports not-run locally', () => {
  assert.equal(checkBrowserEnvironment({ CHROME: '/c', PW_DIR: '/p' }), 'run');
  assert.throws(() => checkBrowserEnvironment({ CI: 'true' }), /CI requires CHROME and PW_DIR/);
  assert.throws(() => checkBrowserEnvironment({ BAROCSS_BROWSER_REQUIRED: '1', CHROME: '/c' }), /CI requires CHROME and PW_DIR/);
  assert.equal(checkBrowserEnvironment({}), 'not-run');
  assert.equal(checkBrowserEnvironment({ CHROME: '/c' }), 'not-run');
});

test('parseTapSummary reads the last totals and collects skipped names', () => {
  const summary = parseTapSummary(tap);
  assert.deepEqual(summary, { tests: 3, pass: 2, empty: [], fail: 0, cancelled: 0, skipped: 1, todo: 0, skips: [{ name: 'reads back pixels', reason: 'no adapter' }], failed: [], passed: ['suite'] });
  assert.equal(parseTapSummary('# tests 1\n# pass 1\n# skip 0\n# tests 2\n# pass 2\n').tests, 2);
  assert.throws(() => parseTapSummary('ok 1 - x\n'), /missing TAP summary/);
  // A file that registers no test is one top-level result named after the file; its counts still balance.
  const emptyFile = parseTapSummary('ok 1 - draws\nok 2 - tests/empty-browser.test.mjs\n  ok 1 - nested.test.mjs\n1..2\n# tests 2\n# pass 2\n# fail 0\n');
  assert.deepEqual(emptyFile.empty, ['tests/empty-browser.test.mjs']);
  assert.throws(() => assertRealRun(emptyFile, 'gpu'), /files without tests: tests\/empty-browser\.test\.mjs/);
});

test('assertRealRun rejects skip, todo, fail, cancel, zero pass and mismatched counts', () => {
  assert.deepEqual(assertRealRun(clean, 'gpu'), { ...clean, known: [] });
  for (const bad of [{ skipped: 1, skips: [{ name: 'a', reason: '' }] }, { todo: 1 }, { fail: 1 }, { cancelled: 1 }, { tests: 0, pass: 0 }, { tests: 4 }]) {
    assert.throws(() => assertRealRun({ ...clean, ...bad }, 'gpu'), /gpu: browser suite not a real pass/);
  }
});

test('runBrowserSuites reports NOT_RUN locally and fails in CI before spawning', () => {
  const lines = [];
  assert.deepEqual(runBrowserSuites(['@barocss/gpu'], { env: {}, log: (line) => lines.push(line) }), { status: 'NOT_RUN', results: [] });
  assert.match(lines.join('\n'), /NOT_RUN/);
  assert.throws(() => runBrowserSuites(['@barocss/gpu'], { env: { CI: 'true' }, log: () => {} }), /CI requires CHROME and PW_DIR/);
});

test('chromeFlagSets are ordered and each later set extends the first', () => {
  assert.deepEqual(chromeFlagSets.map(({ name }) => name), ['swiftshader-gl', 'swiftshader-angle', 'swiftshader-vulkan', 'swiftshader-vulkan-nosurface', 'swiftshader-angle-gl', 'xvfb-headed', 'xvfb-headed-angle', 'xvfb-headed-vulkan']);
  assert.deepEqual(chromeFlagSets.map(({ headed }) => headed === true), [false, false, false, false, false, true, true, true]);
  for (const { flags } of chromeFlagSets) assert.ok(flags === chromeFlagSets[0].flags || flags.startsWith(chromeFlagSets[0].flags + ' '));
  assert.match(chromeFlagSets[3].flags, /--enable-features=Vulkan .*--disable-vulkan-surface$/);
});

test('selectChromeFlags probes each set in order with the wrapper and keeps the first pass', () => {
  const seen = [];
  const spawn = (_, __, options) => { seen.push(options.env.WEBGPU_CHROME_FLAGS); return { status: seen.length === 2 ? 0 : 1 }; };
  const env = { WEBGPU_REAL_CHROME: '/chrome' }; const lines = [];
  assert.equal(selectChromeFlags(env, { spawn, log: (line) => lines.push(line) }), 'swiftshader-angle');
  assert.deepEqual(seen, [chromeFlagSets[0].flags, chromeFlagSets[1].flags]);
  assert.equal(env.WEBGPU_CHROME_FLAGS, chromeFlagSets[1].flags);
  assert.match(lines.join(), /swiftshader-angle/);
  const all = [];
  assert.throws(() => selectChromeFlags({ WEBGPU_REAL_CHROME: '/chrome' }, { spawn: (_, __, o) => (all.push(o.env.WEBGPU_CHROME_FLAGS), { status: 1 }), log: () => {} }), /no Chrome flag set presents a WebGPU canvas/);
  assert.equal(all.length, chromeFlagSets.filter(({ headed }) => !headed).length);
});

test('selectChromeFlags skips headed sets without DISPLAY and tries them with it', () => {
  const run = (env) => { const seen = []; const lines = []; assert.throws(() => selectChromeFlags(env, { spawn: (_, __, o) => (seen.push(o.env), { status: 1 }), log: (line) => lines.push(line) })); return { seen, lines }; };
  const bare = run({ WEBGPU_REAL_CHROME: '/chrome' });
  assert.equal(bare.seen.length, 5);
  assert.equal(bare.lines.filter((line) => line.includes('no DISPLAY')).length, 3);
  const shown = run({ WEBGPU_REAL_CHROME: '/chrome', DISPLAY: ':99' });
  assert.equal(shown.seen.length, 8);
  assert.deepEqual(shown.seen.map((e) => e.WEBGPU_CHROME_HEADED), ['', '', '', '', '', '1', '1', '1']);
  assert.ok(shown.seen.every((e) => e.DEBUG === 'pw:browser'));
});

test('selectChromeFlags records a headed pass on childEnv', () => {
  let calls = 0;
  const env = { WEBGPU_REAL_CHROME: '/chrome', DISPLAY: ':99' };
  assert.equal(selectChromeFlags(env, { spawn: () => ({ status: ++calls === 6 ? 0 : 1 }), log: () => {} }), 'xvfb-headed');
  assert.equal(env.WEBGPU_CHROME_HEADED, '1');
  assert.equal(env.WEBGPU_CHROME_FLAGS, chromeFlagSets[5].flags);
});

test('selectChromeFlags runs one probe when flags are pinned or no wrapper is in use', () => {
  for (const env of [{ WEBGPU_REAL_CHROME: '/chrome', WEBGPU_CHROME_FLAGS: '--x' }, { CHROME: '/c' }]) {
    let calls = 0;
    assert.equal(selectChromeFlags(env, { spawn: () => (calls++, { status: 0 }), log: () => {} }), null);
    assert.equal(calls, 1);
    assert.throws(() => selectChromeFlags(env, { spawn: () => ({ status: 1 }), log: () => {} }), /WebGPU probe failed/);
  }
});

test('parseTapSummary names top-level failed and passed tests', () => {
  const text = 'ok 1 - plain\nnot ok 2 - broken # time out\nok 3 - skipped one # SKIP why\nnot ok 4 - a \\# b \\\\ c\n    not ok 1 - nested\n    ok 2 - nested ok\nok 5 - todo # TODO later\n# tests 5\n# pass 2\n# fail 2\n';
  const { failed, passed } = parseTapSummary(text);
  assert.deepEqual(failed, ['broken', 'a # b \\ c']);
  assert.deepEqual(passed, ['plain']);
});

test('loadKnownFailures validates the file and the profile', () => {
  const entry = { suite: 's', file: 'f', name: 'n', mode: 'fails', reason: 'r', owner: 'o' };
  const file = (list) => JSON.stringify({ version: 1, profiles: { p: list } });
  assert.deepEqual(loadKnownFailures('', file([entry])), []);
  assert.deepEqual(loadKnownFailures('p', file([entry])), [entry]);
  assert.throws(() => loadKnownFailures('q', file([entry])), /unknown known-failures profile: q/);
  assert.throws(() => loadKnownFailures('p', file([{ ...entry, mode: 'maybe' }])), /mode/);
  assert.throws(() => loadKnownFailures('p', file([{ ...entry, reason: '' }])), /reason/);
  assert.throws(() => loadKnownFailures('p', file([entry, entry])), /duplicate/);
  assert.throws(() => loadKnownFailures('p', JSON.stringify({ version: 2, profiles: {} })), /version/);
  const real = loadKnownFailures('linux-swiftshader', readFileSync(new URL('../browser-known-failures.json', import.meta.url), 'utf8'));
  assert.equal(real.length, 3);
});

test('assertRealRun accepts listed failures, reports them and blocks everything else', () => {
  const entry = (name, mode) => ({ suite: 'gpu', file: 'f', name, mode, reason: 'r', owner: 'GPU' });
  const run = { tests: 3, pass: 2, fail: 1, cancelled: 0, skipped: 0, todo: 0, skips: [], empty: [], failed: ['a'], passed: ['b', 'c'] };
  const result = assertRealRun(run, 'gpu', [entry('a', 'fails'), entry('b', 'may-fail')]);
  assert.deepEqual(result.known, [{ name: 'a', mode: 'fails', owner: 'GPU', outcome: 'failed' }, { name: 'b', mode: 'may-fail', owner: 'GPU', outcome: 'passed' }]);
  assert.throws(() => assertRealRun(run, 'gpu'), /gpu: browser suite not a real pass.*unexpected failures: a/);
  assert.throws(() => assertRealRun(run, 'gpu', [entry('x', 'may-fail'), entry('a', 'fails')]), /known failure not found/);
  assert.throws(() => assertRealRun({ ...run, tests: 3, pass: 3, fail: 0, failed: [], passed: ['a', 'b', 'c'] }, 'gpu', [entry('a', 'fails')]), /known failure now passes; remove it/);
  assert.equal(assertRealRun({ ...run, pass: 3, fail: 0, failed: [], passed: ['a', 'b', 'c'] }, 'gpu', [entry('a', 'may-fail')]).known[0].outcome, 'passed');
  // A timed-out test counts as cancelled and is still named; one we cannot name blocks.
  assert.equal(assertRealRun({ ...run, fail: 0, cancelled: 1 }, 'gpu', [entry('a', 'fails')]).known[0].outcome, 'failed');
  assert.throws(() => assertRealRun({ ...run, fail: 2 }, 'gpu', [entry('a', 'fails')]), /not a real pass/);
  assert.throws(() => assertRealRun({ ...run, tests: 4 }, 'gpu', [entry('a', 'fails')]), /not a real pass/);
});
