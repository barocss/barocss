// D415 test-only generic SVG gallery; icon markup uses no fonts or external assets.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const output = resolve(process.argv[2] ?? ''); assert.ok(process.argv[2]);
await mkdir(output, { recursive: true });
const app = resolve(import.meta.dirname, '..');
const source = `
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server.edge';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {UI_ICONS} from './src/ui/uiIcons';
import {Icon} from './src/ui/atoms';
import {CAD_ICONS} from './src/ui/cadIcons';
const names=Object.keys(UI_ICONS),output=process.argv[2];
const markup=(name,small=false)=>renderToStaticMarkup(createElement(Icon,{name,small}));
const hash=value=>createHash('sha256').update(value).digest('hex');
const cad=Object.fromEntries(Object.keys(CAD_ICONS).map(name=>[name,{normal:hash(markup(name)),small:hash(markup(name,true))}]));
const pages=[];
for(const theme of ['dark','light'])for(let page=0;page<2;page++){
 const selected=names.slice(page*44,(page+1)*44),file=theme+'-'+(page+1)+'.html';
 const css='*{box-sizing:border-box}body{margin:0;padding:24px;font:12px system-ui;background:'+(theme==='dark'?'#242529;color:#c9ccd1':'#ffffff;color:#34404c')+'}h1{font-size:16px;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:16px}.icons{height:64px;display:flex;align-items:center;gap:12px}.normal svg{width:20px!important;height:20px!important}.large svg{width:48px!important;height:48px!important}article{min-height:98px;min-width:0}.name{overflow-wrap:anywhere;margin-top:8px}svg{display:block;flex:none}';
 const html='<!doctype html><meta charset="utf-8"><style>'+css+'</style><h1>Generic UI SVGs · '+theme+' · 20px / 48px · '+(page+1)+'/2</h1><div class="grid">'+selected.map(name=>'<article data-icon="'+name+'"><div class="icons"><span class="normal">'+markup(name)+'</span><span class="large">'+markup(name)+'</span></div><div class="name">'+name+'</div></article>').join('')+'</div>';
 writeFileSync(join(output,file),html);pages.push({file,names:selected,theme});
}
writeFileSync(join(output,'registry.json'),JSON.stringify({names,pages,cad},null,2));
console.log(JSON.stringify({names:names.length,uniqueImports:new Set(Object.values(UI_ICONS)).size,pages:pages.length,cad:Object.keys(cad).length}));
`;
const built = await build({ stdin: { contents: source, resolveDir: app, sourcefile: 'ui-icon-gallery.tsx', loader: 'tsx' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
await writeFile(join(output, 'producer.mjs'), built.outputFiles[0].contents);
await writeFile(join(output, 'producer-source.tsx'), source);
await writeFile(join(output, 'producer-inputs.json'), JSON.stringify(built.metafile, null, 2));
const cad = await readFile(join(app, 'src/ui/cadIcons.tsx'));
const before = execFileSync('git', ['show', 'HEAD:apps/cad-studio/src/ui/cadIcons.tsx']);
assert.deepEqual(cad, before, 'all100 CAD source entries remain byte-identical');
await writeFile(join(output, 'cad-source-proof.json'), JSON.stringify({ sourceByteIdentical: true, sha256: createHash('sha256').update(cad).digest('hex') }));
const run = spawnSync(process.execPath, [join(output, 'producer.mjs'), output], { encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr);
process.stdout.write(run.stdout);

if (process.env.UI_ICON_CAPTURE === '1') {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true });
  const requests = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 850 } });
    await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    const registry = JSON.parse(await readFile(join(output, 'registry.json'), 'utf8'));
    for (const item of registry.pages) {
      await page.setContent(await readFile(join(output, item.file), 'utf8'));
      const sizes = await page.locator('svg').evaluateAll(nodes => nodes.map(svg => ({ width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, textNodes: svg.querySelectorAll('text,image,use').length })));
      assert.equal(sizes.length, item.names.length * 2);
      assert.ok(sizes.every(size => [20, 48].includes(size.width) && size.width === size.height && !size.textNodes));
      assert.equal(await page.locator('[data-ui-icon-missing]').count(), 0);
      await page.screenshot({ path: join(output, item.file.replace('.html', '.png')), fullPage: true });
    }
    assert.deepEqual(requests, []);
    await context.close();
  } finally { await browser.close(); }
  await writeFile(join(output, 'capture.json'), JSON.stringify({ status: 'PASS', pages: 4, glyphs: 352, requests, resourcesClosed: true }));
}
