import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = ['apps/cad-studio/src/files/StepExportPanel.tsx', 'apps/cad-studio/src/files/stepExportPreparation.ts',
  'apps/cad-studio/src/files/importedFile.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad/src/io/step.ts',
  'packages/barocss-cad/src/brep/brep-check-geometry.ts'];
const fixtureHashes = {
  'dome-first': 'de1d85486bda585886965306eb2ce58d41a172f10ad502ec82342c56d9e29742',
  'dome-last': '7e2841b7329d87b99f42a7d6f05bd296fa3739a2781a51eb3f0e5a2cd807012f',
  'no-gap': '7692cdf32d0f71343f1619e818f7ec258c5053ba08d036fe520e5c74d32c2119',
};
const f = await createFlow({
  name: 'sew-step-fidelity', output: process.argv[2], envFrozen: 'D1192_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Check native STEP preparation for both tolerance-only Sew orders and a coincident control.',
  limits: ['Three exact local QA fixtures. Browser intercepts the locally generated STEP blob at the download boundary. No external reader.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, curveDomain, evaluateCurve, massPropertiesOf, stepValidationProperties } from '@barocss/cad';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc);
console.log(JSON.stringify(outputs.map(output => {
  const { brep } = output, check = checkBrep(brep, { strict: true });
  const seams = [];
  for (const edge of brep.edges) {
    const [a,b] = curveDomain(edge.curve), p = evaluateCurve(edge.curve, (a + b) / 2);
    if (p[2] > 11 && p[2] < 12) seams.push(p[2]);
  }
  return {
    valid: check.valid, volume: massPropertiesOf(output).volume, solids: output.bodyCount,
    edgeGap: check.maximumEdgeSurfaceGap, vertexGap: check.maximumVertexGap, seams: seams.sort((a,b) => a-b),
    declaredVolume: doc.nodes[0]?.kind === 'import' ? stepValidationProperties(doc.nodes[0].step).volume : undefined,
  };
})));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);

async function newPageWithCapture() {
  const native = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await native({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, files = new Map();
      window.__stepNativeCaptures = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob.type === 'model/step') files.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = files.get(this.href);
        if (!blob || !this.download.endsWith('.step')) return click.call(this);
        files.delete(this.href);
        window.__stepNativeCaptures.push(blob.arrayBuffer().then(bytes => ({
          name: this.download, bytes: Array.from(new Uint8Array(bytes)),
        })));
      };
    });
    const origin = new URL(f.server.resolvedUrls.local[0]).origin;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = native; }
}

await f.run(async () => {
  const outcomes = [];
  for (const [name, hash] of Object.entries(fixtureHashes)) {
    f.phase = `Open the ${name} Sew document and prepare STEP`;
    const file = join(process.argv[3], `${name}.bcad`);
    const bytes = await readFile(file);
    assert.equal(sha256(bytes), hash);
    const source = JSON.parse(bytes.toString());
    await newPageWithCapture();
    await f.openFile(file, 1);
    await f.same(source);
    assert.equal(source.nodes[0].tolerance, 0.021);
    assert.equal(source.nodes[0].names.at(name === 'dome-last' ? -1 : 0), 'lid · dome');
    const [native] = await f.inspect(`${name}-source-native`, source);
    assert.ok(native.valid && native.solids === 1);
    near(native.volume, 1200);
    near(native.edgeGap, name === 'no-gap' ? 0 : 0.02);
    near(native.vertexGap, name === 'dome-first' ? 0.02 : 0);
    assert.equal(native.seams.length, 4);
    native.seams.forEach(z => near(z, name === 'dome-first' ? 11.52 : 11.5));

    await button('Export STEP').click();
    const panel = f.page.getByRole('region', { name: 'STEP export', exact: true });
    const blocked = panel.getByRole('alert');
    const ready = panel.getByRole('list', { name: 'STEP loss report', exact: true });
    await blocked.or(ready).waitFor();
    if (await blocked.count()) {
      await f.snapshot(`${name}-step-refused`);
      const notice = await blocked.innerText();
      assert.equal(await button('Export', panel).isEnabled(), false);
      assert.equal(await f.page.evaluate(() => window.__stepNativeCaptures.length), 0);
      await button('Cancel', panel).click();
      await f.same(source);
      outcomes.push({ name, status: 'refused', native, notice });
      continue;
    }

    await f.snapshot(`${name}-step-prepared`);
    await button('Export', panel).click();
    await panel.waitFor({ state: 'hidden' });
    const [captured, ...extra] = await f.page.evaluate(() => Promise.all(window.__stepNativeCaptures));
    assert.deepEqual(extra, []);
    assert.equal(captured?.name, `${name}.step`);
    const step = Buffer.from(captured.bytes);
    const sha = sha256(step);
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: captured.name, mimeType: 'application/step', buffer: step });
    const toast = f.page.getByRole('alert').filter({ hasText: /STEP opened|could not open|import failed/i });
    await toast.waitFor();
    const accepted = await toast.getByText('STEP opened', { exact: true }).count() > 0;
    let reopened;
    if (accepted) {
      const imported = await f.doc();
      assert.equal(imported.nodes[0].kind, 'import');
      assert.equal(imported.nodes[0].step, step.toString());
      [reopened] = await f.inspect(`${name}-step-native`, imported);
    } else await f.same(source);
    await f.snapshot(`${name}-step-${accepted ? 'opened' : 'open-refused'}`);
    outcomes.push({ name, status: accepted ? 'reopened' : 'reopen-refused', native, reopened, sha });
  }
  f.report.observations.push(...outcomes);
  await f.persist();
  for (const item of outcomes) {
    if (item.name !== 'no-gap') {
      assert.equal(item.status, 'refused', `STEP preparation should refuse the ${item.name} gap`);
      assert.match(item.notice, /Sewn boundary gap.*0\.02 mm.*align the surface edges/i);
    } else {
      assert.equal(item.status, 'reopened');
      assert.ok(item.reopened.valid && item.reopened.solids === 1);
      near(item.reopened.volume, 1200);
      near(item.reopened.declaredVolume, 1200);
      near(item.reopened.edgeGap, 0);
      near(item.reopened.vertexGap, 0);
      assert.equal(item.reopened.seams.length, 4);
      item.reopened.seams.forEach(z => near(z, 11.5));
    }
  }
  assert.equal(f.report.downloads.length, 0);
});
