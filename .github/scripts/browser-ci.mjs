import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync, mkdirSync, mkdtempSync } from 'node:fs';
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

// TAP escapes `\` and `#` in names; a directive is the first unescaped ` #`.
const untap = (value) => value.replace(/\\([\\#])/g, '$1');
function tapResults(text) {
  const failed = []; const passed = [];
  for (const match of text.matchAll(/^(not )?ok \d+ - (.*)$/gm)) {
    const cut = match[2].indexOf(' #'); const name = cut < 0 ? match[2] : match[2].slice(0, cut); const directive = cut < 0 ? '' : match[2].slice(cut + 2);
    if (match[1]) failed.push(untap(name));
    else if (!/^\s*(SKIP|TODO)\b/i.test(directive)) passed.push(untap(name));
  }
  return { failed, passed };
}
export function parseTapSummary(text) {
  const last = (key) => { const found = [...text.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))]; return found.length ? Number(found.at(-1)[1]) : undefined; };
  const tests = last('tests'); const pass = last('pass');
  if (tests === undefined || pass === undefined) throw new Error('missing TAP summary');
  const skips = [...text.matchAll(/^\s*ok \d+ - (.*?) # SKIP\b(.*)$/gm)].map((match) => ({ name: match[1], reason: match[2].trim() }));
  // A file that registers no test shows up as one top-level result named after the file.
  const empty = [...text.matchAll(/^(?:not )?ok \d+ - (\S+\.test\.mjs)\b/gm)].map((match) => match[1]);
  return { tests, pass, empty, fail: last('fail') ?? 0, cancelled: last('cancelled') ?? 0, skipped: last('skipped') ?? last('skip') ?? 0, todo: last('todo') ?? 0, skips, ...tapResults(text) };
}

export function loadKnownFailures(profile, text) {
  const data = JSON.parse(text);
  if (data?.version !== 1) throw new Error('known-failures file: version must be 1');
  if (!profile) return [];
  const list = data.profiles?.[profile];
  if (!Array.isArray(list)) throw new Error(`unknown known-failures profile: ${profile}`);
  const seen = new Set();
  for (const entry of list) {
    for (const key of ['suite', 'file', 'name', 'reason', 'owner']) if (typeof entry?.[key] !== 'string' || !entry[key]) throw new Error(`known-failures ${profile}: entry needs a non-empty ${key}`);
    if (!['fails', 'may-fail'].includes(entry.mode)) throw new Error(`known-failures ${profile}: mode must be fails or may-fail (${entry.name})`);
    const id = `${entry.suite}\0${entry.name}`;
    if (seen.has(id)) throw new Error(`known-failures ${profile}: duplicate entry ${entry.suite} - ${entry.name}`);
    seen.add(id);
  }
  return list;
}

export function assertRealRun(summary, label, known = []) {
  const { tests, pass, fail, cancelled, skipped, todo, skips, empty = [], failed = [], passed = [] } = summary;
  const listed = new Set(known.map((entry) => entry.name));
  const unexpected = failed.filter((name) => !listed.has(name));
  const stale = [];
  for (const entry of known) {
    if (entry.mode === 'fails' && passed.includes(entry.name)) stale.push(`${entry.name}: known failure now passes; remove it from .github/browser-known-failures.json`);
    else if (!failed.includes(entry.name) && !passed.includes(entry.name)) stale.push(`${entry.name}: known failure not found; the test was renamed or removed`);
  }
  const unnamed = fail + cancelled !== failed.length;
  if (skipped || todo || empty.length || !pass || unexpected.length || unnamed || pass + failed.length !== tests || stale.length) {
    throw new Error(`${label}: browser suite not a real pass (tests ${tests}, pass ${pass}, fail ${fail}, cancelled ${cancelled}, skipped ${skipped}, todo ${todo}; unexpected failures: ${unexpected.join(' | ') || (unnamed ? 'unnamed failures' : 'none')}; skipped: ${skips.map(({ name }) => name).join(', ') || 'none'}; files without tests: ${empty.join(', ') || 'none'}; stale known failures: ${stale.join(' | ') || 'none'})`);
  }
  return { ...summary, known: known.map((entry) => ({ name: entry.name, mode: entry.mode, owner: entry.owner, outcome: failed.includes(entry.name) ? 'failed' : 'passed' })) };
}

const swiftshaderGl = '--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader --ignore-gpu-blocklist';
const swiftshaderAngle = `${swiftshaderGl} --use-angle=swiftshader --enable-unsafe-swiftshader`;
const swiftshaderVulkan = `${swiftshaderGl} --enable-features=Vulkan --use-vulkan=swiftshader`;
// Tried in order on the CI runner; the first set that presents a canvas wins. The first four all failed in remote run 2
// and stay for the comparison log.
export const chromeFlagSets = Object.freeze([
  { name: 'swiftshader-gl', flags: swiftshaderGl },
  { name: 'swiftshader-angle', flags: swiftshaderAngle },
  { name: 'swiftshader-vulkan', flags: swiftshaderVulkan },
  { name: 'swiftshader-vulkan-nosurface', flags: `${swiftshaderVulkan} --disable-vulkan-surface` },
  // GPU compositing forced through ANGLE's SwiftShader GL: without GPU compositing a WebGPU canvas present loses the device.
  { name: 'swiftshader-angle-gl', flags: `${swiftshaderAngle} --use-gl=angle --enable-gpu-compositing` },
  // Headed Chrome under Xvfb (chrome.sh drops --headless); skipped without DISPLAY.
  { name: 'xvfb-headed', flags: swiftshaderGl, headed: true },
  { name: 'xvfb-headed-angle', flags: `${swiftshaderAngle} --use-gl=angle`, headed: true },
  { name: 'xvfb-headed-vulkan', flags: swiftshaderVulkan, headed: true },
]);

// Runs in the page: present a canvas for 3 frames, map a buffer and read a canvas pixel back; a dropped instance shows up in any of these.
async function canvasProbe() {
  const found = await navigator.gpu?.requestAdapter();
  if (!found) return { adapter: null };
  const info = found.info ?? {};
  const out = { adapter: { vendor: info.vendor, architecture: info.architecture }, lost: null, mapped: false, pixel: null, error: null };
  try {
    const device = await found.requestDevice();
    device.lost.then((value) => { out.lost = { reason: value.reason, message: value.message }; });
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; document.body.append(canvas);
    const context = canvas.getContext('webgpu');
    const flat = document.createElement('canvas'); flat.width = flat.height = 64;
    const two = flat.getContext('2d', { willReadFrequently: true });
    context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    for (let frame = 0; frame < 3; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const encoder = device.createCommandEncoder();
      encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 1, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] }).end();
      device.queue.submit([encoder.finish()]);
      // A presented canvas expires after its task, so the last frame is copied to a 2D canvas in the same task.
      if (frame === 2) { two.drawImage(canvas, 0, 0); out.pixel = [...two.getImageData(32, 32, 1, 1).data]; }
    }
    await device.queue.onSubmittedWorkDone();
    const source = device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const target = device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(source, 0, new Uint8Array([1, 2, 3, 4]));
    const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(source, 0, target, 0, 4); device.queue.submit([encoder.finish()]);
    await target.mapAsync(GPUMapMode.READ);
    out.mapped = [...new Uint8Array(target.getMappedRange())].join() === '1,2,3,4';
    target.unmap();
  } catch (error) { out.error = String(error?.message ?? error); }
  return out;
}

export async function probe(env) {
  const { chromium } = createRequire(join(env.PW_DIR, 'package.json'))('playwright');
  // navigator.gpu needs a secure context; the suites serve from 127.0.0.1, so the probe does too.
  const server = createServer((_, response) => response.end('<!doctype html>'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser; let timer;
  const verbose = String(env.DEBUG ?? '').includes('pw:browser');
  const run = async () => {
    browser = await chromium.launch({ executablePath: env.CHROME, headless: true, args: [...(env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu']), ...(verbose ? ['--enable-logging=stderr', '--v=0'] : [])] });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    return { chrome: browser.version(), result: await page.evaluate(canvasProbe) };
  };
  let chrome = null; let result;
  try {
    ({ chrome, result } = await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('probe timed out after 60 s')), 60000); })]));
  } catch (error) { result = { adapter: null, error: String(error?.message ?? error) }; }
  finally { clearTimeout(timer); }
  const [r, g, b] = result.pixel ?? [];
  const ok = Boolean(result.adapter && !result.lost && result.mapped && !result.error && r > 200 && g < 50 && b < 50);
  const headed = env.WEBGPU_CHROME_HEADED === '1';
  // Failure diagnostics only (never change ok): chrome://gpu text, bounded to 15 s.
  if (!ok && browser) {
    let gpuTimer;
    const collect = async () => {
      const page = await browser.newPage();
      await page.goto('chrome://gpu');
      await page.waitForSelector('info-view', { timeout: 5000 }).catch(() => {});
      // The shadow root opens with its stylesheet; drop styles so the GPU feature status and log fit the cap.
      const text = await page.evaluate(() => {
        const root = document.querySelector('info-view')?.shadowRoot;
        if (!root) return document.body.innerText;
        const copy = document.createElement('div'); copy.append(...[...root.childNodes].map((node) => node.cloneNode(true)));
        copy.querySelectorAll('style, script').forEach((node) => node.remove());
        return copy.textContent;
      });
      return String(text).replace(/\s+/g, ' ').slice(0, 8000);
    };
    try { console.log(JSON.stringify({ webgpuGpuPage: { flags: env.WEBGPU_CHROME_FLAGS ?? null, headed, text: await Promise.race([collect(), new Promise((_, reject) => { gpuTimer = setTimeout(() => reject(new Error('chrome://gpu timed out after 15 s')), 15000); })]) } })); }
    catch (error) { console.log(JSON.stringify({ webgpuGpuPage: { error: String(error?.message ?? error) } })); }
    finally { clearTimeout(gpuTimer); }
  }
  await browser?.close().catch(() => {}); server.close();
  console.log(JSON.stringify({ webgpuProbe: { flags: env.WEBGPU_CHROME_FLAGS ?? null, headed, ok, chrome, result } }));
  return { ok, chrome, result };
}

// With the CI wrapper and no pinned flags, spawn the probe per flag set and keep the first that really presents a canvas.
export function selectChromeFlags(childEnv, { spawn = spawnSync, log = console.log } = {}) {
  const probeWith = (env) => spawn(process.execPath, [fileURLToPath(import.meta.url), 'probe'], { env, stdio: 'inherit', timeout: 90000 });
  if (childEnv.WEBGPU_REAL_CHROME && !childEnv.WEBGPU_CHROME_FLAGS) {
    for (const { name, flags, headed } of chromeFlagSets) {
      if (headed && !childEnv.DISPLAY) { log(JSON.stringify({ chromeFlags: name, skipped: 'no DISPLAY' })); continue; }
      if (probeWith({ ...childEnv, WEBGPU_CHROME_FLAGS: flags, WEBGPU_CHROME_HEADED: headed ? '1' : '', DEBUG: 'pw:browser' }).status !== 0) continue;
      childEnv.WEBGPU_CHROME_FLAGS = flags;
      if (headed) childEnv.WEBGPU_CHROME_HEADED = '1';
      log(JSON.stringify({ chromeFlags: name }));
      return name;
    }
    throw new Error('no Chrome flag set presents a WebGPU canvas; see the webgpuProbe lines');
  }
  if (probeWith(childEnv).status !== 0) throw new Error('WebGPU probe failed');
  return null;
}

export function runBrowserSuites(names, { env = process.env, root = process.cwd(), log = console.log } = {}) {
  const state = checkBrowserEnvironment(env);
  if (state === 'not-run') { log('WebGPU browser suites NOT_RUN: set CHROME and PW_DIR (local runs may skip; CI fails)'); return { status: 'NOT_RUN', results: [] }; }
  const evidenceRoot = env.BROWSER_EVIDENCE_DIR ? (mkdirSync(env.BROWSER_EVIDENCE_DIR, { recursive: true }), env.BROWSER_EVIDENCE_DIR) : mkdtempSync(join(tmpdir(), 'barocss-browser-'));
  const childEnv = { ...env };
  for (const name of browserEvidenceVariables) if (!childEnv[name]) childEnv[name] = join(evidenceRoot, name.toLowerCase());
  selectChromeFlags(childEnv, { log });
  // Unset profile = strict; a profile names a list in .github/browser-known-failures.json.
  const profile = env.BROWSER_KNOWN_FAILURES_PROFILE;
  const knownAll = profile ? loadKnownFailures(profile, readFileSync(join(root, '.github/browser-known-failures.json'), 'utf8')) : [];
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
  const reports = [];
  for (const { name, summary } of results) {
    const known = knownAll.filter((entry) => entry.suite === name);
    try {
      const checked = assertRealRun(summary, name, known);
      reports.push({ name, summary: checked, known: known.map((entry, index) => ({ ...entry, outcome: checked.known[index].outcome })) });
    } catch (error) { failures.unshift(error); reports.push({ name, summary, known: known.map((entry) => ({ ...entry, outcome: summary.failed?.includes(entry.name) ? 'failed' : summary.passed?.includes(entry.name) ? 'passed' : 'missing' })) }); }
  }
  for (const { name, known } of reports) {
    if (!known.length) continue;
    log(JSON.stringify({ suite: name, knownFailures: known.map(({ name: test, mode, owner, outcome }) => ({ name: test, mode, owner, outcome })) }));
    for (const entry of known) log(`KNOWN FAILURE (not counted, owner ${entry.owner}): ${name} \u2014 ${entry.name} \u2014 ${entry.reason}`);
  }
  if (env.GITHUB_STEP_SUMMARY) {
    const cell = (value) => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const lines = ['## WebGPU browser suites', ''];
    if (childEnv.WEBGPU_CHROME_FLAGS) lines.push(`Chrome flags: \`${childEnv.WEBGPU_CHROME_FLAGS}\`${childEnv.WEBGPU_CHROME_HEADED === '1' ? ' (headed)' : ''}`, '');
    lines.push('| suite | tests | pass | fail | cancelled | skipped |', '| --- | --- | --- | --- | --- | --- |');
    for (const { name, summary } of reports) lines.push(`| ${cell(name)} | ${summary.tests} | ${summary.pass} | ${summary.fail} | ${summary.cancelled} | ${summary.skipped} |`);
    const listedAll = reports.flatMap(({ name, known }) => known.map((entry) => ({ suite: name, ...entry })));
    if (listedAll.length) {
      lines.push('', '### Known failures (not counted)', '');
      for (const entry of listedAll) lines.push(`- ${cell(entry.suite)}: ${cell(entry.name)} \u2014 outcome ${entry.outcome}, mode ${entry.mode}, owner ${entry.owner}. ${cell(entry.reason)}`);
    }
    try { appendFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`); } catch (error) { log(`step summary not written: ${error.message}`); }
  }
  if (failures.length) throw failures[0];
  return { status: 'PASS', evidenceRoot, results };
}

async function main() {
  const [first, ...rest] = process.argv.slice(2);
  if (first === 'probe') { if (!(await probe(process.env)).ok) process.exitCode = 1; return; }
  const selectors = { gpu: ['@barocss/gpu'], viewer: ['@barocss/viewer'], all: Object.keys(browserSuites) };
  const picked = [first, ...rest].filter(Boolean);
  const names = [...new Set((picked.length ? picked : ['all']).flatMap((selector) => { if (!selectors[selector]) throw new Error(`unknown selector: ${selector}`); return selectors[selector]; }))];
  const result = runBrowserSuites(names);
  console.log(JSON.stringify({ status: result.status, evidenceRoot: result.evidenceRoot ?? null }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
