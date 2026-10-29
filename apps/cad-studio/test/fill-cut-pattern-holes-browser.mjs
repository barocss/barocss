// D345_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
// node test/fill-cut-pattern-holes-browser.mjs /absolute/artifacts
// One Chrome, serial contexts. Public seed API and actual UI actions author all accepted changes.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';
assert.equal(process.env.D345_SOURCE_FROZEN, '1', 'Root must freeze all source writers before D345 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const outer = [[4, 4], [52, 4], [52, 36], [4, 36]];
const holes = [[[20, 16], [34, 16], [34, 30], [20, 30]], [[42, 6], [46, 6], [44, 10]]];
const report = { status: 'RUNNING', qualification: 'ACTUAL_STRAIGHT_HOLE_MASK_LIFECYCLE', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], guards: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['Mask filters reference points; no tool clipping or full-tool containment claim.', 'Original CUT stays unconditional. Hole boundary excludes additional references.', 'Actual source edit changes the main outer edge of a hole-bearing sketch; it does not claim direct UI editing of stored hole coordinates.', 'Out-of-budget source is excluded by the actual region picker before copying; numeric preview refusal is tested separately.', 'One Chrome with serial contexts; hooks only observe.', 'Hashes prove source provenance, not geometry correctness.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const seedSource = `import {writeFileSync} from 'node:fs';import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
const p=part('D345 hole mask').box({w:60,d:40,h:10}).subtract(p=>p.box({w:3,d:5,h:10,x:7,y:6})).box({w:12,d:7,h:5,x:80,y:-3,z:1});
writeFileSync(process.argv[2],JSON.stringify(p.doc,null,2));`;
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {fillRegionSnapshot} from '../../packages/barocss-cad-model/src/engine/fillFeaturePattern.ts';import {checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),p=part('D345 observed',doc),view=evaluateDoc(doc,0);assert.ok(view.ok);
const bodies=partBreps(doc).map(({key,brep})=>({key,brep,check:checkBrep(brep,{strict:true}),mass:p.body(key).mass({density:1}),names:p.body(key).select().faces().names().sort(),model:view.bodies.find(b=>b.key===key)}));
const sketches=doc.nodes.flatMap((n,index)=>{if(n.kind!=='sketch')return[];try{return[{index,region:fillRegionSnapshot(doc,index)}];}catch(e){return[{index,error:e instanceof Error?e.message:String(e)}];}});
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify({bodies,sketches}));`;
const oracleSource = String.raw`"""Independent Fraction reference-point mask and stock-minus-disjoint-prism moments. Product imports: zero."""
import json,math,sys
from fractions import Fraction as F
def q(v): return F.from_float(v) if isinstance(v,float) else F(v)
def classify(r,p):
 winding=0
 for i,a in enumerate(r):
  b=r[(i+1)%len(r)]; ax,ay=map(q,a);bx,by=map(q,b);x,y=map(q,p);s=(bx-ax)*(y-ay)-(by-ay)*(x-ax)
  if s==0 and min(ax,bx)<=x<=max(ax,bx) and min(ay,by)<=y<=max(ay,by):return 'boundary'
  if ay<=y<by and s>0:winding+=1
  if by<=y<ay and s<0:winding-=1
 return 'inside' if winding else 'outside'
d=json.load(sys.stdin);node=d['feature'];region=node['region'];sx=q(node['spacing']);sy=q(node['spacing2']);a=node['anchor'];cells=[]
for j in range(node['count2']):
 for i in range(node['count']):
  p=[q(a[0])+i*sx,q(a[1])+j*sy]
  if (i or j) and (classify(region['points'],p)=='outside' or any(classify(h,p)!='outside' for h in region.get('holes',[]))):continue
  cells.append([i,j])
assert cells and cells[0]==[0,0]
v=F(24000)-150*len(cells);c=[(F(720000)-150*sum(F(17,2)+i*sx for i,j in cells))/v,(F(480000)-150*sum(F(17,2)+j*sy for i,j in cells))/v,F(5)]
t=d['target'];b=t['brep'];assert t['check']['valid'];assert len(b['bodies'])==1 and b['bodies'][0]['kind']=='solid';assert all(s['closed'] for s in b['shells'])
for label,m in [('public',t['mass']),('Model',t['model']),('actualStudio',d['studio'])]:
 assert math.isfinite(m['volume']) and abs(q(m['volume'])-v)<=q(1e-7),(label,'volume')
 assert all(abs(q(x)-y)<=q(1e-7) for x,y in zip(m['centroid'],c)),(label,'centroid')
names=t['names'];assert len(set(names))==len(names)
for j in range(node['count2']):
 for i in range(node['count']):
  if i or j:assert any(n.endswith('.side0@%d,%d'%(i,j)) for n in names)==([i,j] in cells),('stable suffix',i,j)
for i,j in cells:
 for dx in [0,3]:
  for dy in [0,5]:
   for z in [0,10]:
    p=[F(7)+i*sx+dx,F(6)+j*sy+dy,F(z)]
    assert any(all(abs(q(x)-y)<=q(1e-7) for x,y in zip(vt['point'],p)) for vt in b['vertices']),('missing cutter corner',p)
print(json.dumps({'status':'PASS','cells':cells,'volume':float(v),'centroid':[float(x) for x in c],'exactCentroid':[{'n':str(x.numerator),'d':str(x.denominator)} for x in c],'source':'Independent Fraction winding and exact integer prism moments','scope':'Reference point mask only; original seed retained; no clipping claim'},indent=2))
`;
const doc = () => page.evaluate(() => window.__studioDoc);
const hud = () => page.getByRole('dialog', { name: 'Fill cut pattern', exact: true });
const editor = () => page.locator('.node-editor');
const sketch = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
async function ready() { await page.waitForFunction(() => { const b = window.__studioBodies?.(); return window.__studioFresh === true && b?.fresh && b.massReady && b.bodies.length === 2; }, null, { timeout: 60000 }); }
async function same(before) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(before), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), before); }
async function changed(before) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(before), { timeout: 60000 }); await ready(); }
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection,
    hud: document.querySelector('.hud')?.textContent ?? null, editor: document.querySelector('.node-editor')?.textContent ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent) }), label);
  report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2)); await writeFile(join(output, `${label}.html`), await page.content()); await page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await persist();
}
async function freshOpen(file, expected, label) {
  phase = `fresh Open ${label}`; if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e))); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() })); page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 });
  await page.setInputFiles('input[aria-label="Model file"]', file); await same(expected); await snapshot(label);
}
async function command(label) { await page.keyboard.press('Space'); await page.locator('.palette input').fill(label); await page.keyboard.press('Enter'); }
async function selectTarget() {
  await ready(); const state = await page.evaluate(() => window.__studioBodies());
  const index = state.bodies.findIndex(b => b.key !== report.witness.key); assert.ok(index >= 0);
  await page.locator('.outliner .ol:not(.ol-step)').nth(index).click();
  await page.waitForFunction(i => window.__studioSelection?.selection?.bodies?.length === 1 && window.__studioSelection.selection.bodies[0] === i, index);
}
async function worldClick(point) { const pixel = await page.evaluate(point => window.__studioScreenOf?.(point), [...point, 0]); assert.ok(pixel?.length === 2); await page.mouse.click(pixel[0], pixel[1]); }
async function rectangle(a, b) {
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click(); await worldClick(a); await worldClick(b);
  // These wrapped labels include their mm suffix and have no aria-label override. Use their rendered public input IDs.
  for (const [id, value] of [['x', a[0]], ['y', a[1]], ['width', b[0] - a[0]], ['height', b[1] - a[1]]]) {
    const input = sketch().locator(`input#sk-${id}`); assert.equal(await input.count(), 1); await input.fill(String(value)); assert.equal(await input.inputValue(), String(value));
  }
}
async function triangle(points) {
  await page.getByRole('button', { name: 'Line', exact: true }).click(); for (const point of [...points, points[0]]) await worldClick(point);
  for (const [i, point] of points.entries()) for (const [axis, value] of point.entries()) await sketch().getByLabel(`Point ${i + 1} ${'XY'[axis]}`, { exact: true }).fill(String(value));
}
async function authorMask(extra, label) {
  phase = `actual standalone world XY sketch ${label}`; await page.keyboard.press('Escape'); const before = await doc();
  await command('Sketch'); await sketch().waitFor(); await sketch().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  await rectangle([4, 4], [52, 36]); await rectangle([20, 16], [34, 30]); await triangle(holes[1]);
  if (extra) { await triangle([[10, 10], [14, 10], [12, 13]]); await triangle([[40, 20], [46, 20], [43, 24]]); }
  await page.locator('.topbar button.finish').click(); await changed(before); await sketch().waitFor({ state: 'hidden' });
  const after = await doc(), index = after.nodes.length - 1, node = after.nodes[index];
  assert.equal(node.kind, 'sketch'); assert.equal(node.on, undefined); assert.equal(node.association, undefined); assert.equal(node.regions?.length ?? 0, 0); assert.equal(node.holes.length, extra ? 4 : 2);
  assert.ok(node.holes.flat().every(segment => segment.kind === 'line')); assert.deepEqual(node.holes.slice(0, 2).map(loop => loop.map(s => s.start)), holes);
  await snapshot(label); return { before, after, index };
}
async function configure(index, spacing = 10) {
  await hud().getByLabel('Region snapshot', { exact: true }).selectOption(String(index));
  for (const [label, value] of [['Reference X', 8], ['Reference Y', 8], ['X spacing', 12], ['Columns', 4], ['Y spacing', spacing], ['Rows', 3]]) await hud().getByLabel(label, { exact: true }).fill(String(value));
}
async function preview(status) { await page.waitForFunction(status => document.querySelector('.hud .status')?.textContent === status, status, { timeout: 60000 }); }
async function readNative(label) {
  phase = `public native observation ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
  await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout); assert.equal(result.bodies.length, 2);
  const witness = report.witness ? result.bodies.find(b => b.key === report.witness.key) : result.bodies.find(b => Math.abs(b.mass.volume - 420) < 1e-7 && b.mass.centroid.every((v, k) => Math.abs(v - [86, .5, 3.5][k]) < 1e-7));
  assert.ok(witness); report.witness ??= { key: witness.key, names: witness.names }; assert.deepEqual(witness.names, report.witness.names); assert.equal(witness.check.valid, true); assert.ok(Math.abs(witness.mass.volume - 420) < 1e-7); witness.mass.centroid.forEach((v, k) => assert.ok(Math.abs(v - [86, .5, 3.5][k]) < 1e-7));
  const target = result.bodies.find(b => b.key !== witness.key); assert.ok(target); const state = await page.evaluate(() => window.__studioBodies());
  const studio = state.bodies.find(b => b.key === target.key); assert.ok(studio); assert.deepEqual(await doc(), accepted);
  report.reads.push({ label, ...result }); const feature = accepted.nodes.findLast(node => node.kind === 'fill-feature-pattern');
  if (feature) {
    const input = { feature, target, studio }, oracleFile = join(output, `${label}-oracle-input.json`); await writeFile(oracleFile, JSON.stringify(input, null, 2));
    const check = spawnSync('python3', [join(output, 'oracle.py')], { input: JSON.stringify(input), encoding: 'utf8' });
    await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? ''); assert.equal(check.status, 0, check.stderr);
    report.oracles.push({ label, ...JSON.parse(check.stdout) });
  }
  await persist(); return { ...result, target };
}
async function checkPostApplySelection(label) {
  const state = await page.evaluate(() => ({ selection: window.__studioSelection.selection, order: window.__studioBodies().bodies.map(b => b.key) }));
  const indices = [...state.selection.bodies, ...['faces', 'edges', 'vertices'].flatMap(key => (state.selection[key] ?? []).map(p => p.body))];
  const record = { label, ...state, selectedKeys: indices.map(i => state.order[i]) }; report.postApplySelections ??= []; report.postApplySelections.push(record); await persist();
  assert.ok(!record.selectedKeys.includes(report.witness.key), 'Existing target pick must not alias the unrelated witness after Apply');
}
async function apply(before, label) { phase = `actual Fill Apply ${label}`; await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(before); await hud().waitFor({ state: 'hidden' }); await checkPostApplySelection(label); await snapshot(label); return doc(); }
async function openEditor(index) {
  const node = (await doc()).nodes[index];
  if (node.kind === 'sketch') {
    const label = `Sketch · ${node.profile === 'loop' ? 'outline' : node.profile}`, target = page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: label, exact: true });
    assert.equal(await target.count(), 1, 'One standalone source sketch has this history label'); await target.click();
  } else await page.locator(`.history .hs[data-node-index="${index}"]`).click();
  await editor().waitFor();
}
async function applyEditor(before, label) { phase = `actual editor Apply ${label}`; await editor().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(before); await editor().waitFor({ state: 'hidden' }); await snapshot(label); }
async function save(label) {
  await ready(); const before = await doc(); const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), before); report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: before };
}
const initialFiles = ['apps/cad-studio/test/fill-cut-pattern-holes-browser.mjs', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/engine/fillFeaturePattern.ts', 'packages/barocss-cad-model/src/app/commands.ts', 'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad/src/features/fill-cut-pattern.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) {
  const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096);
  const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file)));
  await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes;
}
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length;
  await writeFile(join(output, 'oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  const buildInputs = [];
  async function compile(label, contents) {
    const sourcefile = `d345-${label}.ts`, virtual = resolve(app, sourcefile);
    const built = await build({ stdin: { contents, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
    await writeFile(join(output, `${label}.ts`), contents); await writeFile(join(output, `${label}-metafile.json`), JSON.stringify(built.metafile, null, 2));
    // Virtual stdin has no disk source. Capture its exact contents/hash and explicitly exclude it from disk caps.
    buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources ??= []; report.virtualSources.push({ label, hash: hash(contents), virtualInputExcluded: virtual });
    const file = join(output, `${label}.mjs`); await writeFile(file, built.outputFiles[0].contents); return file;
  }
  const generator = await compile('seed', seedSource); inspector = await compile('inspector', inspectSource);
  const seedFile = join(output, 'seed.bcad'), generation = spawnSync(process.execPath, [generator, seedFile], { encoding: 'utf8' });
  await writeFile(join(output, 'seed.stdout.txt'), generation.stdout ?? ''); await writeFile(join(output, 'seed.stderr.txt'), generation.stderr ?? ''); assert.equal(generation.status, 0, generation.stderr); const seed = JSON.parse(await readFile(seedFile, 'utf8'));
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;
  await freshOpen(seedFile, seed, '01-budget-seed'); await readNative('01-budget-seed-native'); const bad = await authorMask(true, '02-actual-17-vertex-source');
  await selectTarget(); const beforeGuard = await doc(), guardSelection = await page.evaluate(() => window.__studioSelection.selection); await command('Fill cut pattern'); await hud().waitFor();
  const badChoice = await hud().getByLabel('Region snapshot', { exact: true }).locator(`option[value="${bad.index}"]`).count(); assert.equal(badChoice, 0, 'Actual over-budget source is excluded before snapshot copy');
  report.guards.push({ kind: 'actual17vertexSourcePickerExclusion', index: bad.index, totalVertices: 17, holes: 4, optionCount: badChoice });
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click(); await same(beforeGuard); assert.deepEqual(await page.evaluate(() => window.__studioSelection.selection), guardSelection);
  await page.keyboard.press('Meta+z'); await same(bad.before); await page.keyboard.press('Meta+Shift+z'); await same(bad.after); await snapshot('03-budget-guard-no-fill-undo');
  await freshOpen(seedFile, seed, '04-valid-seed'); await readNative('04-valid-seed-native'); const made = await authorMask(false, '05-actual-two-hole-source');
  const source = made.after, sketchIndex = made.index; await selectTarget(); const selected = await page.evaluate(() => window.__studioSelection.selection);
  await command('Fill cut pattern'); await hud().waitFor(); await configure(sketchIndex, 0); await preview('refused'); assert.equal(await hud().getByRole('button', { name: 'Apply', exact: true }).isDisabled(), true); assert.deepEqual(await doc(), source); assert.deepEqual(await page.evaluate(() => window.__studioSelection.selection), selected); await snapshot('06-numeric-refusal-atomic');
  await hud().getByLabel('Y spacing', { exact: true }).fill('10'); await preview('preview'); assert.deepEqual(await doc(), source); await hud().getByRole('button', { name: 'Cancel', exact: true }).click(); await same(source);
  await page.keyboard.press('Meta+z'); await same(made.before); await page.keyboard.press('Meta+Shift+z'); await same(source);
  await selectTarget(); await command('Fill cut pattern'); await hud().waitFor(); await configure(sketchIndex); await preview('preview'); await snapshot('07-valid-preview');
  const accepted = await apply(source, '08-seven-cuts-applied'), index = accepted.nodes.length - 1, feature = accepted.nodes[index];
  assert.equal(feature.kind, 'fill-feature-pattern'); assert.deepEqual(feature.region, { points: outer, holes }); assert.deepEqual(feature.anchor, [8, 8]); assert.ok(feature.id); report.featureId = feature.id; report.sketchIndex = sketchIndex;
  await readNative('08-seven-cuts-native'); await page.keyboard.press('Meta+z'); await same(source); await page.keyboard.press('Meta+Shift+z'); await same(accepted); await snapshot('09-seven-cuts-redo');
  const saved = await save('seven-cuts'); await freshOpen(saved.file, saved.doc, '10-seven-cuts-fresh-open'); await readNative('10-fresh-native');
  await openEditor(index); assert.equal(await editor().getByLabel('Region snapshot', { exact: true }).inputValue(), ''); assert.equal(await editor().getByLabel('Y spacing', { exact: true }).inputValue(), '10');
  const beforeSpacing = await doc(); await editor().getByLabel('Y spacing', { exact: true }).fill('12'); await applyEditor(beforeSpacing, '11-nine-cuts-spacing');
  const spaced = await doc(); assert.equal(spaced.nodes[index].id, feature.id); assert.deepEqual(spaced.nodes[index].region, feature.region); await readNative('11-nine-cuts-native');
  await page.keyboard.press('Meta+z'); await same(accepted);
  phase = 'actual hole-bearing source outer edit'; await openEditor(sketchIndex); await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketch().waitFor();
  const beforeSource = await doc(); await sketch().getByLabel('Point 1 X', { exact: true }).fill('10'); await page.locator('.topbar button.finish').click(); await changed(beforeSource); await sketch().waitFor({ state: 'hidden' });
  const sourceEdited = await doc(); assert.equal(sourceEdited.nodes[sketchIndex].id, beforeSource.nodes[sketchIndex].id); assert.equal(sourceEdited.nextId, beforeSource.nextId); assert.deepEqual(sourceEdited.nodes[index], feature); assert.deepEqual(sourceEdited.nodes[sketchIndex].holes, source.nodes[sketchIndex].holes);
  await readNative('12-source-edit-snapshot-independent'); await snapshot('12-source-edit-snapshot-independent');
  await openEditor(index); await editor().getByLabel('Region snapshot', { exact: true }).selectOption(String(sketchIndex)); await applyEditor(sourceEdited, '13-five-cuts-reselected');
  const replaced = await doc(); assert.equal(replaced.nodes[index].id, feature.id); assert.deepEqual(replaced.nodes[index].parent, feature.parent); assert.deepEqual(replaced.nodes[index].region, { points: [[10, 4], [52, 4], [52, 36], [10, 36]], holes }); await readNative('13-reselected-native');
  await page.keyboard.press('Meta+z'); await same(sourceEdited); await page.keyboard.press('Meta+Shift+z'); await same(replaced);
  const finalSaved = await save('reselected-five-cuts'); await freshOpen(finalSaved.file, finalSaved.doc, '14-final-fresh-open'); await readNative('14-final-native');
  await openEditor(index); assert.equal(await editor().getByLabel('Region snapshot', { exact: true }).inputValue(), ''); assert.equal(await editor().getByLabel('Y spacing', { exact: true }).inputValue(), '10'); await snapshot('15-final-editable');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []); report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); }
} finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
