// Dedicated G21 harness. --prepare only bundles current source; it starts no server/browser.
// --run requires a coordinator lease, exact clean SHA, CHROME and PW_DIR. Never skips an adapter.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { arch, loadavg, platform, release } from 'node:os';

const MODES = Object.freeze(['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']);
const runnerFile = fileURLToPath(import.meta.url);
export const REQUIRED_CHECKS = Object.freeze(['display', 'nativeEdges:occlusion', 'nativeEdges:visibleSolid', 'nativeEdges:hiddenDash6-4', 'nativeEdges:wireframe', 'modes:roundTrip', 'picks:front-cap-roundTrip', 'appearance:lineOnlySuppressionRestore', 'authority:ghost-hidden', 'g20:quarter', 'g20:octant', 'g20:capLeaks', 'unsupported:scope']);
export const REQUIRED_INSTANCE_CHECKS = Object.freeze(['instances:placed-sharing', 'instances:depth-hidden', 'instances:pose-drag', 'instances:source-cap', 'instances:wide-face-id', 'instances:scope', 'instances:modes', 'instances:opacity', 'curves:silhouette', 'instances:isolate']);
export const REQUIRED_INSTANCE_CAPTURES = Object.freeze([...['cylinder', 'sphere'].flatMap(name => MODES.map(mode => 'curve-' + name + '-view0-' + mode)), ...MODES.map(mode => 'isolate-mode-' + mode), 'instance-placed', 'instance-depth', 'instance-posed', 'instance-drag', 'instance-section-plane', 'instance-section-cutout', 'instance-wide-face', ...MODES.map(mode => 'instance-mode-' + mode), ...[false, true].flatMap(cap => ['opaque', 'x-ray', 'empty'].map(kind => 'instance-opacity-' + cap + '-' + kind))]);
export const CASES = Object.freeze(['webgpu', 'webgl2'].flatMap(backend => [1, 2].map(dpr => Object.freeze({ backend, dpr }))));
export const REQUIRED_CAPTURES = Object.freeze(['modes-default', ...MODES.map(mode => `modes-${mode}`), ...['quarter', 'octant'].flatMap(section => MODES.map(mode => `section-${section}-${mode}`))]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const stamp = () => new Date().toISOString();
const caseId = (item = {}) => `${item?.backend}-dpr${item?.dpr}`;
const saveJson = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

export function validateCase(report, expected, { instances = false } = {}) {
  const errors = [], fail = message => errors.push(`${caseId(expected)}: ${message}`);
  if (!report || typeof report !== 'object') return ['Missing case report.'];
  if (report.backend !== expected.backend || report.dpr !== expected.dpr) fail('case identity differs from the requested backend/DPR');
  const display = report.display;
  if (JSON.stringify(display?.css) !== '[640,480]' || JSON.stringify(display?.backing) !== JSON.stringify([640 * expected.dpr, 480 * expected.dpr]) || display?.actualDpr !== expected.dpr) fail('CSS/backing size or actual DPR mismatch');
  if (report.environment?.backend !== expected.backend) fail('actual backend identity is missing or differs');
  if (expected.backend === 'webgpu' && (report.environment?.device !== true || !report.environment?.adapter || typeof report.environment.adapter !== 'object' || !Object.values(report.environment.adapter).some(value => typeof value === 'string' && value.trim()))) fail('WebGPU adapter/device identity is missing');
  if (expected.backend === 'webgl2' && (!report.environment?.renderer || !/WebGL\s*2/i.test(report.environment?.version ?? ''))) fail('WebGL2 renderer/version identity is missing');
  if (!Array.isArray(report.environment?.shaderErrors) || report.environment.shaderErrors.length) fail('shader errors are present or shader error collection is missing');
  const rows = report.checks;
  if (!Array.isArray(rows) || rows.length !== REQUIRED_CHECKS.length) fail('required check count differs');
  const names = (Array.isArray(rows) ? rows : []).map(row => row?.name);
  if (new Set(names).size !== names.length) fail('duplicate check name');
  for (const name of REQUIRED_CHECKS) {
    const row = Array.isArray(rows) ? rows.find(item => item?.name === name) : null;
    if (!row) { fail(`missing check ${name}`); continue; }
    if (row.pass !== true || row.skipped === true || row.unsupported === true || ['skipped', 'unsupported'].includes(row.status)) fail(`check did not execute/pass: ${name}`);
    if (row.actual === undefined || row.expected === undefined) fail(`missing actual/expected evidence: ${name}`);
  }
  if (names.some(name => !REQUIRED_CHECKS.includes(name))) fail('unexpected check name');
  if (!Array.isArray(report.errors) || report.errors.length) fail('device/shader/fixture errors are present or error collection is missing');
  if (!Array.isArray(report.unsupported) || !report.unsupported.length) fail('unsupported-scope diagnostics are missing');
  if (!Array.isArray(report.captures) || !report.captures.length) fail('no captured frames');
  const captures = Array.isArray(report.captures) ? report.captures : [];
  const captureNames = captures.map(c => c?.name);
  if (new Set(captureNames).size !== captureNames.length || captureNames.some(n => typeof n !== 'string' || !n.trim())) fail('duplicate or empty capture names');
  for (const capture of captures) if (typeof capture?.dataUrl !== 'string' || !capture.dataUrl.startsWith('data:image/png;base64,')) fail(`missing PNG capture ${capture?.name}`);
  for (const name of REQUIRED_CAPTURES) if (!captureNames.includes(name)) fail(`missing required mode/section capture ${name}`);
  if (instances) {
    if (report.instances !== true) fail('instance extension did not execute');
    const extra = report.instanceChecks, extraRows = Array.isArray(extra) ? extra : [], extraNames = extraRows.map(row => row?.name);
    if (!Array.isArray(extra) || extra.length !== REQUIRED_INSTANCE_CHECKS.length || new Set(extraNames).size !== extraNames.length) fail('instance check count/uniqueness differs');
    for (const name of REQUIRED_INSTANCE_CHECKS) {
      const row = extraRows.find(item => item?.name === name);
      if (!row || row.pass !== true || row.skipped === true || row.unsupported === true || ['skipped', 'unsupported'].includes(row.status) || row.actual === undefined || row.expected === undefined) fail(`instance check did not execute/pass: ${name}`);
    }
    if (extraNames.some(name => !REQUIRED_INSTANCE_CHECKS.includes(name))) fail('unexpected instance check name');
    for (const name of REQUIRED_INSTANCE_CAPTURES) if (!captureNames.includes(name)) fail(`missing instance capture ${name}`);
  }
  return errors;
}

export function validateMatrix(reports, options = {}) {
  if (!Array.isArray(reports)) return ['Missing matrix.'];
  const errors = [];
  if (reports.length !== CASES.length) errors.push('The required four-case matrix is incomplete.');
  const names = reports.map(caseId);
  if (new Set(names).size !== names.length) errors.push('Duplicate backend/DPR matrix entry.');
  for (const expected of CASES) {
    const report = reports.find(row => row?.backend === expected.backend && row?.dpr === expected.dpr);
    if (!report) errors.push(`Missing ${caseId(expected)}.`); else errors.push(...validateCase(report, expected, options));
  }
  return errors;
}

export function parseArgs(argv, environment = process.env) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--prepare' || key === '--run') { if (options.mode) throw new Error('Select exactly one of --prepare or --run.'); options.mode = key.slice(2); }
    else if (key === '--instances') { if (options.instances) throw new Error('Repeated --instances.'); options.instances = true; }
    else if (['--out', '--lease', '--sha'].includes(key)) { if (options[key.slice(2)] || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing or repeated ${key}.`); options[key.slice(2)] = argv[++i]; }
    else throw new Error(`Unknown option ${key}.`);
  }
  if (!options.mode || !options.out || !isAbsolute(options.out)) throw new Error('Specify --prepare or --run and an absolute --out directory.');
  if (options.mode === 'run' && (!options.lease?.trim() || !/^[a-f0-9]{40}$/.test(options.sha ?? '') || !environment.CHROME || !environment.PW_DIR)) throw new Error('--run requires --lease, full immutable --sha, CHROME and PW_DIR.');
  return options;
}

function gitState(root) {
  try {
    const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return { sha: git(['rev-parse', 'HEAD']), status: git(['status', '--porcelain', '--untracked-files=all']) };
  } catch (error) { return { sha: null, status: null, error: error.message }; }
}

export function assertRunAuthority(options, state, environment = process.env) {
  if (!options.lease?.trim() || !environment.CHROME || !environment.PW_DIR) throw new Error('A lease, CHROME and PW_DIR are required before browser startup.');
  if (!/^[a-f0-9]{40}$/.test(options.sha ?? '') || state.sha !== options.sha || state.status !== '') throw new Error('Actual execution requires the exact clean immutable SHA, including no untracked files.');
}

async function freshDirectory(outDir) {
  await mkdir(outDir, { recursive: true });
  if ((await readdir(outDir)).length) throw new Error(`Output directory must be empty: ${outDir}`);
}

export async function prepareHarness({ root = resolve(dirname(runnerFile), '../../..'), outDir, fixture = resolve(root, 'packages/barocss-gpu/tests/fixtures/cad-display-browser.ts'), instances = false }) {
  await freshDirectory(outDir);
  const { build } = await import('esbuild');
  const startedAt = stamp(), state = gitState(root), bundle = join(outDir, 'fixture.js');
  const result = await build({
    absWorkingDir: root, entryPoints: [fixture], outfile: bundle, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', metafile: true, logLevel: 'silent',
    alias: { '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
  });
  const sources = [];
  for (const input of [...Object.keys(result.metafile.inputs).map(path => resolve(root, path)), runnerFile].sort()) {
    if (sources.some(source => source.path === input)) continue;
    if (/[/\\]packages[/\\][^/\\]+[/\\]dist[/\\]/.test(input)) throw new Error(`Stale workspace dist input is forbidden: ${input}`);
    sources.push({ path: input, relative: relative(root, input), sha256: sha256(await readFile(input)) });
  }
  const html = '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>G21 bounded display qualification</title><style>html,body{margin:0;width:640px;height:480px;background:#333}canvas{width:640px;height:480px;display:block}</style><script type="module" src="/fixture.js"></script>\n';
  await writeFile(join(outDir, 'index.html'), html);
  const manifest = { kind: 'preparation-only', actualBrowserExecuted: false, root, fixture, sha: state.sha, dirty: state.status !== '', git: state, startedAt, finishedAt: stamp(), runnerPid: process.pid, argv: process.argv, sources, outputs: [{ path: 'fixture.js', sha256: sha256(await readFile(bundle)) }, { path: 'index.html', sha256: sha256(html) }], requiredChecks: REQUIRED_CHECKS, matrix: CASES, ...(instances ? { instances: true, requiredInstanceChecks: REQUIRED_INSTANCE_CHECKS, requiredInstanceCaptures: REQUIRED_INSTANCE_CAPTURES } : {}) };
  await saveJson(join(outDir, 'prepare.json'), manifest);
  return manifest;
}

// The server serves exactly these files; it cannot expose the checkout or arbitrary paths.
export function routeFile(url) {
  if (url === '/') return 'index.html';
  if (url === '/fixture.js') return 'fixture.js';
  return null;
}

async function runHarness(options, environment = process.env) {
  const root = resolve(dirname(runnerFile), '../../..');
  assertRunAuthority(options, gitState(root), environment);
  await freshDirectory(options.out);
  const record = { kind: 'actual-browser-run', instances: options.instances === true, lease: options.lease, sha: options.sha, root, startedAt: stamp(), runnerPid: process.pid, argv: process.argv, node: process.version, host: { platform: platform(), arch: arch(), release: release(), loadStart: loadavg() }, chrome: environment.CHROME, pwDir: environment.PW_DIR, cases: [], errors: [] };
  let browser, server;
  try {
    record.preparation = await prepareHarness({ root, outDir: join(options.out, 'harness'), instances: options.instances === true });
    assertRunAuthority(options, gitState(root), environment);
    const { chromium } = createRequire(join(environment.PW_DIR, 'package.json'))('playwright');
    server = createServer(async (req, res) => {
      const file = req.method === 'GET' && routeFile(req.url);
      if (!file) { res.writeHead(404); res.end(); return; }
      try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html'); res.end(await readFile(join(options.out, 'harness', file))); } catch { res.writeHead(500); res.end(); }
    });
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
    record.server = { pid: process.pid, host: '127.0.0.1', port: server.address().port };
    browser = await chromium.launch({ executablePath: environment.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
    record.browserVersion = browser.version();
    const cdp = await browser.newBrowserCDPSession();
    record.browserProcesses = (await cdp.send('SystemInfo.getProcessInfo')).processInfo;
    await cdp.detach();
    for (const expected of CASES) {
      const destination = join(options.out, caseId(expected)); await mkdir(destination);
      const item = { ...expected, sha: options.sha, lease: options.lease, runnerPid: process.pid, server: record.server, argv: process.argv, sources: record.preparation.sources, startedAt: stamp(), consoleErrors: [], pageErrors: [], deviceErrors: [], errors: [], captures: [] };
      record.cases.push(item);
      let context, page;
      try {
        context = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: expected.dpr });
        page = await context.newPage();
        page.on('pageerror', error => item.pageErrors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') item.consoleErrors.push(message.text()); });
        await page.addInitScript(() => {
          window.__g21DeviceErrors = [];
          const proto = globalThis.GPUAdapter?.prototype, original = proto?.requestDevice;
          if (original) proto.requestDevice = async function (...args) {
            // Record the adapter that creates the renderer's device, before the request. A fresh
            // requestAdapter() here could select a different GPU on a machine with two adapters.
            const info = this.info;
            window.__g21AdapterInfo = { vendor: info?.vendor ?? '', architecture: info?.architecture ?? '', device: info?.device ?? '', description: info?.description ?? '' };
            const device = await original.apply(this, args);
            device.addEventListener('uncapturederror', event => window.__g21DeviceErrors.push(String(event.error?.message ?? event.error)));
            device.lost.then(info => { if (info.reason !== 'destroyed') window.__g21DeviceErrors.push(`Device lost: ${info.message}`); });
            return device;
          };
        });
        await page.goto(`http://127.0.0.1:${record.server.port}/`, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => typeof window.runG21Case === 'function', null, { timeout: 30000 });
        const caseCdp = await browser.newBrowserCDPSession();
        item.browserProcesses = (await caseCdp.send('SystemInfo.getProcessInfo')).processInfo; await caseCdp.detach();
        let deadline;
        try { item.report = await Promise.race([page.evaluate(config => window.runG21Case(config), { ...expected, instances: options.instances === true }), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Case exceeded the fixed 180000 ms limit.')), 180000); })]); }
        finally { clearTimeout(deadline); }
        item.errors.push(...validateCase(item.report, expected, options));
        const written = new Set();
        for (const capture of item.report?.captures ?? []) {
          const file = `${capture.name.replace(/[^a-z0-9._-]/gi, '_')}.png`;
          if (written.has(file)) throw new Error(`Capture filename collision: ${file}`); written.add(file);
          const bytes = Buffer.from(capture.dataUrl.split(',')[1] ?? '', 'base64');
          if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`Invalid PNG bytes: ${capture.name}`);
          await writeFile(join(destination, file), bytes); item.captures.push({ name: capture.name, file, sha256: sha256(bytes), bytes: bytes.length });
        }
      } catch (error) { item.errors.push(error.stack ?? error.message); }
      finally {
        if (page) { try { item.deviceErrors = await page.evaluate(() => window.__g21DeviceErrors ?? []); } catch (error) { item.errors.push(`Device-error readback: ${error.message}`); } }
        item.errors.push(...item.consoleErrors, ...item.pageErrors, ...item.deviceErrors);
        if (item.errors.length && page) { try { await page.screenshot({ path: join(destination, 'failure-page.png') }); } catch (error) { item.errors.push(`Failure capture: ${error.message}`); } }
        if (context) { try { await context.close(); } catch (error) { item.errors.push(`Context close: ${error.message}`); } }
        for (const error of [...item.consoleErrors, ...item.pageErrors]) if (!item.errors.includes(error)) item.errors.push(error);
        item.finishedAt = stamp();
        await saveJson(join(destination, 'case.json'), item);
      }
    }
    record.errors.push(...validateMatrix(record.cases.map(item => item.report), options), ...record.cases.flatMap(item => item.errors));
  } catch (error) { record.errors.push(error.stack ?? error.message); }
  finally {
    try { if (browser) await browser.close(); } catch (error) { record.errors.push(`Browser close: ${error.message}`); }
    if (server) await new Promise(ok => server.close(ok));
    record.finishedAt = stamp(); record.host.loadEnd = loadavg(); record.gitEnd = gitState(root);
    if (record.gitEnd.sha !== options.sha || record.gitEnd.status !== '') record.errors.push('Clean immutable SHA changed during execution.');
    record.pass = record.cases.length === CASES.length && record.errors.length === 0;
    await saveJson(join(options.out, 'run.json'), record);
  }
  if (!record.pass) throw new Error(`G21 browser qualification failed; artifacts preserved at ${options.out}`);
  return record;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.mode === 'prepare') {
    const manifest = await prepareHarness({ outDir: options.out, instances: options.instances === true });
    console.log(`Prepared ${manifest.sources.length} source hashes at ${options.out}; no browser/server executed.`);
    return manifest;
  }
  const result = await runHarness(options);
  console.log(`G21 actual browser matrix passed at ${options.out}`);
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error.message); process.exitCode = 1; });
