// E-004 route classification probe (written after A1, to classify its route; grader and runner unchanged).
// Question: is `getRuntime()` from the CDN module the page's BrowserRuntime, or a second one?
// On arm B (page instance exposed as window.baroRuntime): compare identity, then replay A1's calls
// (getRuntime().updateConfig(theme.extend brand) → addClass('bg-brand') → swap class) and see which instance holds the config
// and which <style> element holds the .bg-brand rule. Writes route-probe.json.
// Usage from repo root: PW_MCP_DIR=… node .ai/evidence/E-004/route-probe.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const req = createRequire(join(process.env.PW_MCP_DIR, 'node_modules/@playwright/mcp/package.json'));
const { chromium } = req('playwright-core');
const PORT = 8814;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const p = await b.newPage({ viewport: { width: 1024, height: 900 } });
await p.goto(`http://127.0.0.1:${PORT}/.ai/evidence/E-004/index-B.html`);
await p.waitForSelector('html[data-baro-ready]'); await sleep(300);
const out = await p.evaluate(async () => {
  const styleIds = () => [...document.querySelectorAll('style')].map((s) => s.id || '(no id)');
  const before = styleIds();
  const m = await import('/packages/barocss-browser/dist/cdn/barocss.js');
  const rt = m.getRuntime();
  const same = rt === window.baroRuntime;
  rt.updateConfig({ theme: { extend: { colors: { brand: '#5B21B6' } } } });
  rt.addClass('bg-brand');
  await new Promise((r) => setTimeout(r, 300));
  const save = document.querySelector('[data-testid="save-button"]');
  save.className = save.className.replace('bg-blue-600', 'bg-brand');
  await new Promise((r) => setTimeout(r, 500));
  const holders = [];
  for (const s of document.querySelectorAll('style')) if (s.textContent.includes('.bg-brand') || [...(s.sheet?.cssRules || [])].some((r) => (r.selectorText || '').includes('.bg-brand'))) holders.push(s.id || '(no id)');
  return {
    getRuntimeIsPageRuntime: same,
    pageRuntimeHasBrand: JSON.stringify(window.baroRuntime.context?.config?.theme?.extend?.colors || null).includes('5B21B6')
      || String(window.baroRuntime.getCss?.('bg-brand') || '').includes('5B21B6'),
    getRuntimeHasBrand: String(rt.getCss('bg-brand') || '').includes('5B21B6'),
    pageRuntimeCssForBgBrand: window.baroRuntime.getCss?.('bg-brand') ?? null,
    styleElementsBefore: before,
    styleElementsAfter: styleIds(),
    styleElementsHoldingBgBrand: holders,
    saveBg: getComputedStyle(save).backgroundColor,
  };
});
out.cdnExports = await p.evaluate(async () => Object.keys(await import('/packages/barocss-browser/dist/cdn/barocss.js')));
console.log(JSON.stringify(out, null, 2));
writeFileSync(join(HERE, 'route-probe.json'), JSON.stringify(out, null, 2) + '\n');
await b.close(); srv.kill();
