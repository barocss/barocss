import test from 'node:test';
import assert from 'node:assert/strict';
import { browserTestFiles, checkBrowserEnvironment, parseTapSummary, assertRealRun, runBrowserSuites, chromeFlagSets, selectChromeFlags } from './browser-ci.mjs';

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
  assert.deepEqual(summary, { tests: 3, pass: 2, empty: [], fail: 0, cancelled: 0, skipped: 1, todo: 0, skips: [{ name: 'reads back pixels', reason: 'no adapter' }] });
  assert.equal(parseTapSummary('# tests 1\n# pass 1\n# skip 0\n# tests 2\n# pass 2\n').tests, 2);
  assert.throws(() => parseTapSummary('ok 1 - x\n'), /missing TAP summary/);
  // A file that registers no test is one top-level result named after the file; its counts still balance.
  const emptyFile = parseTapSummary('ok 1 - draws\nok 2 - tests/empty-browser.test.mjs\n  ok 1 - nested.test.mjs\n1..2\n# tests 2\n# pass 2\n# fail 0\n');
  assert.deepEqual(emptyFile.empty, ['tests/empty-browser.test.mjs']);
  assert.throws(() => assertRealRun(emptyFile, 'gpu'), /files without tests: tests\/empty-browser\.test\.mjs/);
});

test('assertRealRun rejects skip, todo, fail, cancel, zero pass and mismatched counts', () => {
  assert.equal(assertRealRun(clean, 'gpu'), clean);
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
  assert.deepEqual(chromeFlagSets.map(({ name }) => name), ['swiftshader-gl', 'swiftshader-angle', 'swiftshader-vulkan', 'swiftshader-vulkan-nosurface']);
  for (const { flags } of chromeFlagSets.slice(1)) assert.ok(flags.startsWith(chromeFlagSets[0].flags + ' '));
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
  assert.equal(all.length, chromeFlagSets.length);
});

test('selectChromeFlags runs one probe when flags are pinned or no wrapper is in use', () => {
  for (const env of [{ WEBGPU_REAL_CHROME: '/chrome', WEBGPU_CHROME_FLAGS: '--x' }, { CHROME: '/c' }]) {
    let calls = 0;
    assert.equal(selectChromeFlags(env, { spawn: () => (calls++, { status: 0 }), log: () => {} }), null);
    assert.equal(calls, 1);
    assert.throws(() => selectChromeFlags(env, { spawn: () => ({ status: 1 }), log: () => {} }), /WebGPU probe failed/);
  }
});
