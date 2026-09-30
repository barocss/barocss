import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(here, '../..');
const depsRoot = process.env.REPO_DEPS_ROOT ?? repo;
const reactRoot = process.env.REACT_ROOT ?? process.env.JR_ROOT ?? path.join(depsRoot, 'packages/barocss-render');
const typesRoot = process.env.REACT_TYPES_ROOT ?? reactRoot;
const deps = createRequire(path.join(depsRoot, 'package.json'));
const peers = createRequire(path.join(reactRoot, 'package.json'));
const { build } = deps('esbuild');
let prepared;

async function consumer() {
  if (prepared) return prepared;
  prepared = (async () => {
    assert(reactRoot, 'Set REACT_ROOT (or JR_ROOT) to already installed React assets');
    const scratch = fs.mkdtempSync(path.join(process.env.CONSUMER_RESULT_ROOT ?? os.tmpdir(), 'barocss-render-consumer-'));
    const dir = path.join(scratch, 'consumer');
    const packageDir = path.join(dir, 'node_modules/@barocss/render');
    fs.mkdirSync(packageDir, { recursive: true });
    await exec(process.execPath, [path.join(here, 'build.mjs')], { env: process.env, timeout: 30_000 });
    fs.cpSync(path.join(here, 'dist'), path.join(packageDir, 'dist'), { recursive: true });
    fs.copyFileSync(path.join(here, 'package.json'), path.join(packageDir, 'package.json'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    fs.copyFileSync(path.join(here, 'examples/profile-form.tsx'), path.join(dir, 'profile-form.tsx'));
    for (const name of ['react']) {
      const from = path.dirname(peers.resolve(`${name}/package.json`));
      assert.equal(JSON.parse(fs.readFileSync(path.join(from, 'package.json'))).version, '19.2.3', 'Expected the supported React peer');
      fs.symlinkSync(from, path.join(dir, 'node_modules', name), 'dir');
    }
    assert(!fs.existsSync(path.join(packageDir, 'src')));
    assert(!fs.existsSync(path.join(dir, 'scripts')));
    const { stdout: commit } = await exec('git', ['rev-parse', 'HEAD'], { cwd: repo });
    const { stdout: status } = await exec('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: repo });
    const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
    const metadata = { candidateCommit: commit.trim(), worktreeClean: status.trim() === '',
      artifactHashes: Object.fromEntries(['dist/index.js', 'dist/index.d.ts', 'package.json'].map((name) => [name, digest(path.join(packageDir, name))])),
      kind: 'barocss-render-local-consumer-v1', source: 'authored-profile-form',
      modelCalls: 0, packageEntries: ['dist/index.js', 'dist/index.d.ts'],
      runtimeSourceCopied: false, researchScriptsImported: false, packagePrivate: JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'))).private === true };
    return { scratch, dir, packageDir, metadata };
  })();
  return prepared;
}

async function bundleExample(dir, entry, outfile) {
  const result = await build({ entryPoints: [entry], outfile, bundle: true, format: 'esm',
    platform: 'browser', jsx: 'automatic', target: 'es2022', metafile: true });
  const inputs = Object.keys(result.metafile.inputs).map((name) => fs.realpathSync(path.resolve(name)));
  assert(inputs.includes(fs.realpathSync(path.join(dir, 'node_modules/@barocss/render/dist/index.js'))));
  const domPackage = peers.resolve('react-dom/package.json');
  const domPeers = createRequire(domPackage);
  const assets = [peers.resolve('react/package.json'), domPackage, domPeers.resolve('scheduler/package.json')]
    .map((manifest) => fs.realpathSync(path.dirname(manifest)) + path.sep);
  assert(inputs.every((name) => name.startsWith(fs.realpathSync(dir) + path.sep)
    || assets.some((root) => name.startsWith(root))));
  return result.metafile;
}

test('TypeScript consumer resolves built exports and rejects unsupported contract shapes', async () => {
  const { dir, packageDir } = await consumer();
  assert(typesRoot, 'Set REACT_TYPES_ROOT to already installed React type assets');
  const types = createRequire(path.join(typesRoot, 'package.json'));
  fs.mkdirSync(path.join(dir, 'node_modules/@types'), { recursive: true });
  for (const name of ['react']) {
    fs.symlinkSync(path.dirname(types.resolve(`@types/${name}/package.json`)),
      path.join(dir, 'node_modules/@types', name), 'dir');
  }
  fs.writeFileSync(path.join(dir, 'contract-check.ts'), `
import { validateSpec, classesFor } from '@barocss/render';
import type { ButtonNode, InputNode, LayoutNode, ScreenNode } from '@barocss/render';
const checked = validateSpec({ arbitrary: 'untrusted input' });
const errors: { path: string; message: string }[] = checked.errors;
void errors;
const layout: LayoutNode = { type: 'Layout', props: { id: 'layout', columns: 'single', gap: 'wide' }, children: [] };
const className: string = classesFor(layout);
void className;
// @ts-expect-error only reviewed layout choices are supported
const badColumns: LayoutNode['props']['columns'] = 'custom';
// @ts-expect-error only the named form binding is supported
const badBinding: InputNode['props']['value'] = { $bindState: '/password' };
// @ts-expect-error only the named save action is supported
const badAction: ButtonNode['on'] = { press: { action: 'execute' } };
// @ts-expect-error no generated HTML/script component is supported
const badType: ScreenNode['type'] = 'Script';
void [badColumns, badBinding, badAction, badType];
`);
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext',
      moduleResolution: 'NodeNext', jsx: 'react-jsx', types: ['react'],
      lib: ['ES2022', 'DOM'], skipLibCheck: false }, include: ['*.tsx', '*.ts'],
  }));
  const compiler = deps.resolve('typescript/bin/tsc');
  await exec(process.execPath, [compiler, '-p', path.join(dir, 'tsconfig.json')], { timeout: 30_000 });
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json')));
  assert.notEqual(pkg.private, true);
  assert.deepEqual(pkg.exports['.'], { types: './dist/index.d.ts', import: './dist/index.js' });
});

test('separate built-package browser consumer preserves host input/actions and last valid spec', async () => {
  const { dir, scratch, metadata } = await consumer();
  const dom = path.dirname(peers.resolve('react-dom/package.json'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dom, 'package.json'))).version, '19.2.3', 'Expected matching installed React DOM');
  fs.symlinkSync(dom, path.join(dir, 'node_modules/react-dom'), 'dir');
  assert(process.env.PW_DIR, 'Set PW_DIR to the already installed Playwright assets');
  const pw = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright-core');
  const entry = path.join(dir, 'app.tsx');
  const bundle = path.join(dir, 'app.js');
  fs.writeFileSync(entry, `
import { createRoot } from 'react-dom/client';
import { Renderer, validateSpec } from '@barocss/render';
import { FORM_SPEC, ProfileForm } from './profile-form.js';
window.CONSUMER_SAVES = [];
window.CONSUMER_VALIDATE = validateSpec;
window.CONSUMER_FORM = FORM_SPEC;
window.CONSUMER_INVALID_RENDER = (spec) => Renderer({spec, components:{}, state:{name:''}, setState:()=>{}, actions:{save:()=>{}}});
createRoot(document.getElementById('root')).render(<ProfileForm onSave={(snapshot)=>window.CONSUMER_SAVES.push(snapshot)} />);
`);
  const metafile = await bundleExample(dir, entry, bundle);
  fs.writeFileSync(path.join(scratch, 'bundle-inputs.json'), JSON.stringify(metafile, null, 2));
  const runtime = fs.readFileSync(path.join(depsRoot, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
  const app = fs.readFileSync(bundle);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html{font-size:16px}body{margin:0}</style>
<script src="/baro.js"></script><script>window.BaroCSS.baroStart({skipExisting:false,theme:'shadcn-default'});</script>
</head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`;
  const assets = { '/': ['text/html', html], '/app.js': ['text/javascript', app], '/baro.js': ['text/javascript', runtime] };
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' || !Object.hasOwn(assets, req.url)) { res.writeHead(404); res.end(); return; }
    const [type, body] = assets[req.url];
    res.writeHead(200, { 'content-type': type }); res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    assert(fs.existsSync(pw.chromium.executablePath()), 'Installed Chromium is required; no download');
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    const errors = [], external = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== base) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(base);
    await page.getByText('Profile settings', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-node-id="layout"]').getAttribute('class'), 'grid grid-cols-1 md:grid-cols-2 gap-2.5');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-node-id="layout"]')).display === 'grid');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-node-id="card"]')).paddingTop === '14px');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Bea');
    await page.getByRole('button', { name: 'Save profile' }).click();
    assert.deepEqual(await page.evaluate(() => window.CONSUMER_SAVES), [{ name: 'Bea' }]);
    assert.equal(await page.getByLabel('Saved name').textContent(), 'Name: Bea');
    const invalid = await page.evaluate(() => ({ ...window.CONSUMER_FORM, arbitraryCss: 'not-allowed' }));
    await page.getByRole('textbox', { name: 'Screen JSON' }).fill(JSON.stringify(invalid));
    assert.match(await page.getByRole('list', { name: 'Validation errors' }).textContent(), /Unknown field/);
    assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Bea');
    const invalidRender = await page.evaluate((spec) => {
      try { window.CONSUMER_INVALID_RENDER(spec); return 'unexpected-success'; }
      catch (error) { return error.message; }
    }, invalid);
    assert.match(invalidRender, /^Invalid spec:/);
    const next = await page.evaluate(() => {
      const spec = structuredClone(window.CONSUMER_FORM);
      spec.elements.heading.props.text = 'Updated complete screen';
      return spec;
    });
    await page.getByRole('textbox', { name: 'Screen JSON' }).fill(JSON.stringify(next));
    await page.getByText('Updated complete screen', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Bea');
    assert.equal(await page.getByRole('list', { name: 'Validation errors' }).textContent(), '');
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await page.screenshot({ path: path.join(scratch, 'authored-consumer.png') });
    fs.writeFileSync(path.join(scratch, 'report.json'), JSON.stringify({ ...metadata,
      checks: { builtPackageImported: true, barocssClassesApplied: true, inputSaveOwnedByHost: true,
        invalidSpecRejected: true, lastValidScreenRetained: true, completeScreenUpdateRetainsInput: true,
        pageErrors: errors.length, externalRequests: external.length },
    }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('built ESM root exports do not require JSX or research code', async () => {
  const { dir, packageDir } = await consumer();
  fs.writeFileSync(path.join(dir, 'smoke.mjs'), `
import * as built from '@barocss/render';
process.stdout.write(JSON.stringify({exports:Object.keys(built).sort(), invalid:built.validateSpec(null)}));
`);
  const { stdout } = await exec(process.execPath, [path.join(dir, 'smoke.mjs')], { cwd: dir, timeout: 30_000 });
  const built = JSON.parse(stdout);
  assert.deepEqual(built.exports, ['Renderer', 'classesFor', 'validateSpec']);
  assert.deepEqual(built.invalid, { ok: false, errors: [{ path: '$', message: 'Expected a JSON object' }] });
  const source = fs.readFileSync(path.join(packageDir, 'dist/index.js'), 'utf8');
  assert(!source.includes('barocss-render-progressive'));
  assert(!source.includes('child_process'));
  assert(!/from\s*['"][^'"]*src\/index\.jsx/.test(source));
  assert(fs.existsSync(path.join(dir, 'node_modules/react')));
});

// Reproduce the repository's hoisted linker without an install or dependency download.
test('built ESM smoke resolves a React peer hoisted above the package', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-hoisted-peer-'));
  try {
    const anchor = path.join(scratch, 'packages/host');
    fs.mkdirSync(anchor, { recursive: true });
    fs.mkdirSync(path.join(scratch, 'node_modules'));
    fs.writeFileSync(path.join(anchor, 'package.json'), JSON.stringify({ private: true }));
    fs.symlinkSync(path.dirname(peers.resolve('react/package.json')),
      path.join(scratch, 'node_modules/react'), 'dir');
    assert(!fs.existsSync(path.join(anchor, 'node_modules')));
    const env = { ...process.env, REACT_ROOT: anchor };
    delete env.NODE_TEST_CONTEXT;
    const { stdout } = await exec(process.execPath, ['--test', '--test-reporter=tap',
      '--test-name-pattern=^built ESM root exports', fileURLToPath(import.meta.url)], {
      env, timeout: 30_000,
    });
    assert.match(stdout, /# pass 1/);
    assert.match(stdout, /# fail 0/);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
