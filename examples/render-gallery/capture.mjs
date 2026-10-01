import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createGallery } from './serve.mjs';
import { loadIndex, recordsFor, validateRecord, digest, slug, recordKey, attachBatch } from './store.mjs';
import { PRESET } from './preset.mjs';
const repo = new URL('../../', import.meta.url);
export async function captureBatch(root, { id = `batch-${Date.now()}-${randomUUID().slice(0, 8)}`, sampleIds } = {}) {
  const index = loadIndex(root), records = recordsFor(root, index).filter((r) => !sampleIds || sampleIds.includes(r.id));
  if (!slug(id) || !records.length || records.some((r) => !validateRecord(r).replayable)) throw new Error('Accepted authored/fake samples and fresh batch ID required');
  const dir = path.join(root, 'captures', id); fs.mkdirSync(dir, { mode: 0o700 });
  const candidateSha = execFileSync('git', ['-C', fileURLToPath(repo), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const manifest = JSON.parse(fs.readFileSync(new URL('packages/barocss-render/package.json', repo), 'utf8'));
  const build = { renderer: digest(fs.readFileSync(new URL(`packages/barocss-render/${manifest.exports['.'].import}`, repo))),
    runtime: digest(fs.readFileSync(new URL('packages/barocss-browser/dist/cdn/barocss.umd.cjs', repo))),
    registry: digest(fs.readFileSync(new URL('browser.jsx', import.meta.url))), preset: digest(PRESET) };
  const batch = { version: 1, id, candidateSha, build, preset: PRESET.id, presetDigest: digest(PRESET), rendererVersion: manifest.version,
    browser: null, node: process.version, source: 'actual Chromium capture of accepted built renderer data', captures: [] };
  const app = await createGallery({ root }); let browser;
  try {
    const require = createRequire(import.meta.url);
    browser = await require('playwright-core').chromium.launch({ headless: true }); batch.browser = browser.version();
    for (const record of records) for (const width of [1200, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }); const errors = [], external = [];
      try {
        page.on('pageerror', () => errors.push('page-error'));
        await page.addInitScript(() => { window.CSP_EVENTS = []; document.addEventListener('securitypolicyviolation', (event) => window.CSP_EVENTS.push(event.violatedDirective)); });
        await page.route('**/*', (route) => { if (new URL(route.request().url()).origin !== app.url) { external.push('external-request'); return route.abort(); } return route.continue(); });
        await page.goto(`${app.url}/?sample=${record.id}&revision=${record.revision}&capture=1`);
        await page.waitForFunction(({ id, revision }) => window.GALLERY?.snapshot().sample?.id === id && window.GALLERY.snapshot().sample.revision === revision, record);
        // Runtime CSS is asynchronous; content and style checks must succeed before capture.
        await page.waitForFunction((record) => {
          const elements = [...document.querySelectorAll('[data-node-id]')];
          const theme = getComputedStyle(document.documentElement), rem = parseFloat(theme.fontSize);
          return Object.values(record.spec.elements).every((node) => {
            const element = elements.find((e) => e.dataset.nodeId === node.props.id); if (!element) return false;
            const style = getComputedStyle(element); if (element.getBoundingClientRect().height <= 0) return false;
            if (node.type === 'Text') return element.textContent === node.props.text;
            if (node.type === 'Input') return element.value === node.props.value.$bindState.slice(1).split('/').reduce((v, k) => v[k], record.initialState);
            if (node.type === 'Button') return element.textContent === node.props.label;
            if (node.type === 'Layout') return style.display === 'grid' && Math.abs(parseFloat(style.gap) - (node.props.gap === 'fractional' ? .625 : .875) * rem) < .1
              && style.gridTemplateColumns.split(' ').length === (node.props.columns === 'responsive' && innerWidth >= 768 ? 2 : 1);
            return Math.abs(parseFloat(style.paddingTop) - (node.props.padding === 'fractional' ? .875 : 1.375) * rem) < .1
              && (node.props.tone === 'light' ? style.backgroundColor === 'rgb(255, 255, 255)' : style.backgroundColor.startsWith('oklch('));
          }) && document.documentElement.scrollWidth <= innerWidth;
        }, record);
        const csp = await page.evaluate(() => window.CSP_EVENTS);
        if (errors.length || csp.length || external.length) throw new Error('Capture browser/CSP/external request failure');
        const filename = `${recordKey(record)}-${width}.png`;
        await page.screenshot({ path: path.join(dir, filename), fullPage: true }); fs.chmodSync(path.join(dir, filename), 0o600);
        const observed = await page.evaluate(() => [...document.querySelectorAll('[data-node-id]')].map((element) => ({ id: element.dataset.nodeId,
          text: element.tagName === 'INPUT' ? element.value : element.textContent, display: getComputedStyle(element).display,
          gap: getComputedStyle(element).gap, padding: getComputedStyle(element).paddingTop, background: getComputedStyle(element).backgroundColor })));
        batch.captures.push({ id: record.id, revision: record.revision, sampleDigest: digest(record), specDigest: digest(record.spec),
          contractDigest: digest(record.contract), stateDigest: digest(record.initialState), presetDigest: digest(PRESET),
          viewport: { width, height: 900 }, validated: true, sourceKind: record.source.kind,
          imageDigest: digest(fs.readFileSync(path.join(dir, filename))), observed, errors, csp, external });
      } finally { await page.close(); }
    }
    fs.writeFileSync(path.join(dir, 'batch.json'), JSON.stringify(batch, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
    attachBatch(root, batch); return { id, samples: records.length, images: batch.captures.length, modelCalls: 0 };
  } finally { if (browser) await browser.close(); await app.close(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: node capture.mjs ABS_GALLERY_ROOT');
  console.log(JSON.stringify(await captureBatch(process.argv[2])));
}
