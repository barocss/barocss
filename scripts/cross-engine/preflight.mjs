// #374: #336's preflight claim ("full" == Tailwind 4.3.3 preflight) checked in a real engine.
// Renders one fixture of reset-relevant elements twice (BaroCSS getPreflightCSS('full') vs Tailwind's
// compiled preflight) and diffs computed styles element-by-element; also counts rules each engine dropped.
//   PW_DIR=... [CHROME=<chromium>] ENGINE=chromium|firefox|webkit node scripts/cross-engine/preflight.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/'));
const baro = req('./dist/index.cjs').getPreflightCSS('full');
const { compile } = req('tailwindcss');
const tw = (await compile(`@layer base {\n${fs.readFileSync(req.resolve('tailwindcss/preflight.css'), 'utf8')}\n}`)).build([]);
const FIXTURE = `<h1>h</h1><h2>h</h2><p>p <a href="#">a</a> <b>b</b> <small>s</small> <sub>1</sub><sup>2</sup> <code>c</code> <abbr title="t">ab</abbr></p>
<ul><li>li</li></ul><ol><li>li</li></ol><blockquote>q</blockquote><hr><pre>pre</pre><table><tr><th>th</th><td>td</td></tr></table>
<img alt="" width="10" height="10" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><svg width="10" height="10"></svg><video></video>
<button>b</button><input placeholder="p"><input type="checkbox"><select><option>o</option></select><textarea>t</textarea>
<fieldset><legend>l</legend></fieldset><progress value="1" max="2"></progress><summary>s</summary><dialog open>d</dialog><div hidden>x</div>`;
const PROPS = ['display', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'border-top-width', 'border-top-style', 'box-sizing',
  'font-size', 'font-weight', 'line-height', 'font-family', 'color', 'background-color', 'list-style-type', 'vertical-align',
  'text-decoration-line', 'border-collapse', 'max-width', 'height', 'border-top-left-radius', 'outline-style', 'resize', 'appearance'];
const ENGINE = process.env.ENGINE || 'chromium';
const pw = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await pw[ENGINE].launch({ executablePath: ENGINE === 'chromium' ? process.env.CHROME : undefined });
async function sig(css) {
  const p = await browser.newPage();
  await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${FIXTURE}</body></html>`);
  const r = await p.evaluate((PROPS) => {
    const cssRules = (function count(list) { let n = 0; for (const r of list) n += 1 + (r.cssRules ? count(r.cssRules) : 0); return n; })(document.styleSheets[0].cssRules);
    const els = [...document.querySelectorAll('body *')].map((e) => { const s = getComputedStyle(e); return [e.tagName + (e.type ? ':' + e.type : ''), ...PROPS.map((k) => s.getPropertyValue(k))]; });
    return { cssRules, els };
  }, PROPS);
  await p.close();
  return r;
}
const a = await sig(baro), b = await sig(tw);
await browser.close();
const diffs = [];
a.els.forEach((row, i) => row.forEach((v, j) => { if (j && v !== b.els[i][j]) diffs.push(`${row[0]} ${PROPS[j - 1]}: baro=${v} tw=${b.els[i][j]}`); }));
const out = { engine: ENGINE, els: a.els.length, props: PROPS.length, baroRules: a.cssRules, twRules: b.cssRules, diffs };
console.log(JSON.stringify({ ...out, diffs: diffs.length, sample: diffs.slice(0, 8) }));
fs.mkdirSync(path.join(ROOT, 'scripts/cross-engine/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `scripts/cross-engine/out/preflight.${ENGINE}.json`), JSON.stringify(out, null, 1));
