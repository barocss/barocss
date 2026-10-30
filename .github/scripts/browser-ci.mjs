import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const browserSuites = Object.freeze({
  '@barocss/gpu': { directory: 'packages/barocss-gpu', imports: ['./tests/cad-dist.mjs'] },
  '@barocss/viewer': { directory: 'packages/barocss-viewer', imports: [] },
});
export const browserEvidenceVariables = ['D324_ARTIFACT_DIR', 'VIEWER_D319_ARTIFACT_DIR', 'VIEWER_D325_ARTIFACT_DIR', 'GPU_DEVICE_RECOVERY_EVIDENCE_DIR', 'GPU_MATERIAL_MAPS_EVIDENCE_DIR', 'GPU_SHADOW_MULTI_EVIDENCE_DIR', 'GPU_SHADOW_POINT_EVIDENCE_DIR', 'GPU_SHADOW_POINT_SOFT_EVIDENCE_DIR', 'GPU_SHADOW_SPOT_EVIDENCE_DIR', 'GPU_SHADOW_SPOT_SOFT_EVIDENCE_DIR'];

export function browserTestFiles(names) {
  const files = names.filter((name) => /^[A-Za-z0-9_.-]+-browser\.test\.mjs$/.test(name)).sort().map((name) => `tests/${name}`);
  if (!files.length) throw new Error('no browser test files');
  return files;
}
export const browserRequired = (env) => env.CI === 'true' || env.BAROCSS_BROWSER_REQUIRED === '1';
export function checkBrowserEnvironment(env) {
  if (env.CHROME && env.PW_DIR) return 'run';
  if (browserRequired(env)) throw new Error('CI requires CHROME and PW_DIR for the WebGPU browser suites; a missing browser fails instead of skipping');
  return 'not-run';
}

export function parseTapSummary(text) {
  const last = (key) => { const found = [...text.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))]; return found.length ? Number(found.at(-1)[1]) : undefined; };
  const tests = last('tests'); const pass = last('pass');
  if (tests === undefined || pass === undefined) throw new Error('missing TAP summary');
  const skips = [...text.matchAll(/^\s*ok \d+ - (.*?) # SKIP\b(.*)$/gm)].map((match) => ({ name: match[1], reason: match[2].trim() }));
  // A file that registers no test shows up as one top-level result named after the file.
  const empty = [...text.matchAll(/^(?:not )?ok \d+ - (\S+\.test\.mjs)\b/gm)].map((match) => match[1]);
  return { tests, pass, empty, fail: last('fail') ?? 0, cancelled: last('cancelled') ?? 0, skipped: last('skipped') ?? last('skip') ?? 0, todo: last('todo') ?? 0, skips };
}
export function assertRealRun(summary, label) {
  const { tests, pass, fail, cancelled, skipped, todo, skips, empty = [] } = summary;
  if (fail || cancelled || skipped || todo || !pass || pass !== tests || empty.length) {
    throw new Error(`${label}: browser suite not a real pass (tests ${tests}, pass ${pass}, fail ${fail}, cancelled ${cancelled}, skipped ${skipped}, todo ${todo}; skipped: ${skips.map(({ name }) => name).join(', ') || 'none'}; files without tests: ${empty.join(', ') || 'none'})`);
  }
  return summary;
}

export async function probe(env) {
  const { chromium } = createRequire(join(env.PW_DIR, 'package.json'))('playwright');
  // navigator.gpu needs a secure context; the suites serve from 127.0.0.1, so the probe does too.
  const server = createServer((_, response) => response.end('<!doctype html>'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: env.CHROME, headless: true, args: env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const adapter = await page.evaluate(async () => {
      const found = await navigator.gpu?.requestAdapter();
      if (!found) return null;
      return { info: found.info ? { vendor: found.info.vendor, architecture: found.info.architecture, device: found.info.device, description: found.info.description } : null, features: [...found.features].sort().slice(0, 64) };
    });
    console.log(JSON.stringify({ webgpuProbe: { chrome: browser.version(), adapter } }));
    if (!adapter) throw new Error(`no WebGPU adapter in ${env.CHROME}`);
  } finally { await browser.close(); server.close(); }
}

export function runBrowserSuites(names, { env = process.env, root = process.cwd(), log = console.log } = {}) {
  const state = checkBrowserEnvironment(env);
  if (state === 'not-run') { log('WebGPU browser suites NOT_RUN: set CHROME and PW_DIR (local runs may skip; CI fails)'); return { status: 'NOT_RUN', results: [] }; }
  const evidenceRoot = env.BROWSER_EVIDENCE_DIR ? (mkdirSync(env.BROWSER_EVIDENCE_DIR, { recursive: true }), env.BROWSER_EVIDENCE_DIR) : mkdtempSync(join(tmpdir(), 'barocss-browser-'));
  const childEnv = { ...env };
  for (const name of browserEvidenceVariables) if (!childEnv[name]) childEnv[name] = join(evidenceRoot, name.toLowerCase());
  const probed = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'probe'], { env: childEnv, stdio: 'inherit' });
  if (probed.status !== 0) throw new Error('WebGPU probe failed');
  const results = []; const failures = [];
  for (const name of names) {
    const suite = browserSuites[name];
    if (!suite) throw new Error(`unknown browser suite: ${name}`);
    const directory = join(root, suite.directory);
    const files = browserTestFiles(readdirSync(`${directory}/tests`));
    const tapFile = join(evidenceRoot, `${name.replace('@', '').replace('/', '-')}.tap`);
    const args = [...suite.imports.flatMap((value) => ['--import', value]), '--test', '--test-concurrency=1', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=tap', `--test-reporter-destination=${tapFile}`, ...files];
    const start = Date.now();
    log(`::group::${name} browser suites`);
    const result = spawnSync(process.execPath, args, { cwd: directory, env: childEnv, stdio: 'inherit' });
    log(`::endgroup::\n${JSON.stringify({ suite: name, files: files.length, seconds: (Date.now() - start) / 1000, status: result.status })}`);
    if (result.status !== 0) failures.push(new Error(`${name} exited ${result.status}`));
    let summary;
    try { summary = parseTapSummary(readFileSync(tapFile, 'utf8')); } catch (error) { failures.push(new Error(`${name}: ${error.message}`)); continue; }
    log(JSON.stringify({ suite: name, ...summary }));
    results.push({ name, summary });
  }
  for (const { name, summary } of results) { try { assertRealRun(summary, name); } catch (error) { failures.unshift(error); } }
  if (failures.length) throw failures[0];
  return { status: 'PASS', evidenceRoot, results };
}

async function main() {
  const [first, ...rest] = process.argv.slice(2);
  if (first === 'probe') { await probe(process.env); return; }
  const selectors = { gpu: ['@barocss/gpu'], viewer: ['@barocss/viewer'], all: Object.keys(browserSuites) };
  const picked = [first, ...rest].filter(Boolean);
  const names = [...new Set((picked.length ? picked : ['all']).flatMap((selector) => { if (!selectors[selector]) throw new Error(`unknown selector: ${selector}`); return selectors[selector]; }))];
  const result = runBrowserSuites(names);
  console.log(JSON.stringify({ status: result.status, evidenceRoot: result.evidenceRoot ?? null }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
