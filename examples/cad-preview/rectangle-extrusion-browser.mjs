import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startServer } from './server.mjs';

assert(process.env.PW_DIR && process.env.CHROME && process.env.BAROCSS_CAD_REGISTRATION_PROPOSAL && process.env.BAROCSS_CAD_IMPORT_EVIDENCE);
const output = process.env.BAROCSS_CAD_IMPORT_EVIDENCE;
await mkdir(output, { recursive: true });
const proposal = JSON.parse(await readFile(process.env.BAROCSS_CAD_REGISTRATION_PROPOSAL, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
const server = await startServer();
let browser;
try {
  const modules = {};
  for (const [name, expected] of Object.entries(proposal.modules)) {
    const route = name === 'index.js' ? '/cad.js' : '/' + name;
    const response = await fetch(server.url + route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /javascript/);
    modules[name] = hash(Buffer.from(await response.arrayBuffer()));
    assert.equal(modules[name], expected.sha256, route);
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [], requests = new Set();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === server.url && url.pathname.endsWith('.js')) requests.add(url.pathname);
  });
  const response = await page.goto(server.url + '/workspace.html');
  assert(response.headers()['content-security-policy'].includes("script-src 'self'"));
  await page.waitForFunction(() => window.cadPreview?.snapshot()?.packet);
  const records = await page.evaluate(async () => {
    const api = await import('/cad.js');
    const before = JSON.stringify(window.cadPreview.snapshot());
    const records = [];
    for (const [width, height, distance] of [[7, 5, 6], [8, 5, 6], [1, 1, 1]]) {
      const request = { bodyId: 'browser_body', profile: { kind: 'rectangle', id: 'browser_profile', origin: [4, -3], width, height }, distance };
      const result = api.buildAxisRectangleExtrusion(request);
      const compiled = api.compileCadModel(result.source, { sourceVersion: 2 });
      if (!compiled.ok || JSON.stringify(compiled.model) !== JSON.stringify(result.model) || JSON.stringify(compiled.ir) !== JSON.stringify(result.ir)) throw Error('Actual browser source roundtrip failed');
      if (api.validateAxisBoxShell(result.shell).solid !== false || !api.validateAxisBoxSolid(result.shell).solid) throw Error('Separate shell/solid contract failed');
      records.push({ request, result, profileMidpoint: api.evaluateCurve(result.profile.curve, .5) });
    }
    let invalidRejected = false;
    try { api.buildAxisRectangleExtrusion({ ...records[0].request, distance: .5 }); } catch { invalidRejected = true; }
    if (!invalidRejected || JSON.stringify(window.cadPreview.snapshot()) !== before) throw Error('Pure native API changed accepted workspace or accepted invalid distance');
    return { records, invalidRejected, workspaceRetained: true };
  });
  for (const { request, result, profileMidpoint } of records.records) {
    const { width: w, height: h } = request.profile, d = request.distance;
    assert.equal(result.solidReport.volumeMM3, w * h * d);
    assert.equal(result.solidReport.areaMM2, 2 * (w * h + w * d + h * d));
    assert.equal(result.model.objects.length, 7);
    assert.equal(result.ir.parameters.length, 5);
    assert.deepEqual(profileMidpoint, [4 + w / 2, -3, 0]);
  }
  for (const name of Object.keys(proposal.modules)) assert(requests.has(name === 'index.js' ? '/cad.js' : '/' + name), name);
  assert.deepEqual(errors, []);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await writeFile(path.join(output, 'index.json'), JSON.stringify({ head, modules, requests: [...requests].sort(), ...records, errors }, null, 2) + '\n');
  console.log('Native rectangle browser import passed:', Object.keys(modules).length, 'exact modules; three actual source/solid cases; workspace retained.');
} finally {
  if (browser) await browser.close();
  await server.close();
}
