// D337: source preparation is safe; execution requires an explicit frozen-source gate.
// D337_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
//   node test/trimmed-surface-reverse-browser.mjs /absolute/artifacts
// One Chrome WebGPU process, serial fresh contexts. Public UI mutates; hooks read only.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { compileCadModel, surfaceEvaluator } from '../../../packages/barocss-cad/dist/index.js';

assert.equal(process.env.D337_SOURCE_FROZEN, '1', 'Root must freeze and qualify source before D337 execution');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory are required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const report = { status: 'RUNNING', profiles: ['rectangle-outside', 'rectangle-inside', 'concave-outside', 'nonplanar-refusal'], backend: 'webgpu', states: [], refusals: [], errors: [], consoleErrors: [], changes: [], downloads: [], files: [], cleanup: [],
  limits: ['Main trim metadata comes from actual public UI Trim by the curve (160 samples).', 'World polygon material is separate from sampled display mesh and solid mass.', 'Native semantic equality includes exact accepted UV, flags, object IDs and source bytes; hashes are provenance only.'] };
let phase = 'seed generation', server, browser, context, page;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtureCSS = `@model d337 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #hole { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]; weights:[1,1,1,1,1]; }
 @surface #wall { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[20,-8,-2],[20,-8,8]],[[20,26,-2],[20,26,8]]]; weights:[[1,1],[1,1]]; }
}`;
// Seed generation uses public Model imports and contains NO authored trims.
const generator = `import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part } from '../../packages/barocss-cad-model/src/api/index.ts';
import { emptyDirect, importSource } from '../../packages/barocss-cad-model/src/engine/direct.ts';
const witness = part('witness').box({w:12,d:7,h:5,x:80,y:-3,z:1});
assert.ok(Math.abs(witness.mass({density:1}).volume-420)<1e-7);
const direct = importSource(emptyDirect(), ${JSON.stringify(fixtureCSS)}, 'D337');
assert.ok(direct.objects.every(o => !o.trims));
writeFileSync(process.argv[2], JSON.stringify({...witness.doc,direct},null,2)+'\\n');`;
const doc = () => page.evaluate(() => window.__studioDoc);
const panel = () => page.getByRole('complementary', { name: 'Direct geometry', exact: true });
const byId = (state, id) => state.direct.objects.find(o => o.id === id);
async function ready(requireWitness = true) {
  await page.waitForFunction(requireWitness => {
    const state = window.__studioBodies?.(), body = state?.bodies[0];
    return window.__studioFresh === true && state?.fresh && state.massReady && (!requireWitness || state.bodies.length === 1 &&
      Math.abs(body.volume - 420) < 1e-7 && body.centroid?.every((v, i) => Math.abs(v - [86, 0.5, 3.5][i]) < 1e-7));
  }, requireWitness, { timeout: 60000 });
}
async function same(expected) {
  await page.waitForFunction(value => JSON.stringify(window.__studioDoc) === value, JSON.stringify(expected), { timeout: 60000 });
  await ready(); assert.deepEqual(await doc(), expected);
}
async function changed(before) {
  await page.waitForFunction(value => JSON.stringify(window.__studioDoc) !== value, JSON.stringify(before), { timeout: 60000 });
  await ready();
}
async function selection() {
  return page.evaluate(() => ({ hook: window.__studioSelection ?? null,
    directNames: [...document.querySelectorAll('.ol.direct.sel')].map(row => row.textContent),
    directSelectionSource: 'Read-only selected outliner rows; __studioSelection does not expose directSel' }));
}
async function snapshot(label) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(),
    selection: window.__studioSelection ?? null,
    directRows: [...document.querySelectorAll('.ol.direct')].map(row => ({ text: row.textContent, className: row.className, title: row.title })),
    feedback: [...document.querySelectorAll('.toast[role="alert"]')].map(e => e.textContent),
    buttonLabels: [...document.querySelectorAll('button')].map(e => ({ text: e.textContent, aria: e.getAttribute('aria-label') })) }), label);
  if (state.bodies?.bodies.length === 1) {
    const body = state.bodies.bodies[0];
    report.witnessKey ??= body.key;
    assert.equal(body.key, report.witnessKey, 'Witness body identity remains stable');
    assert.ok(Math.abs(body.volume - 420) < 1e-7);
    assert.ok(body.centroid?.every((v, i) => Math.abs(v - [86, 0.5, 3.5][i]) < 1e-7));
  }
  report.states.push(state);
  await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2));
  await writeFile(join(output, `${label}.html`), await page.content());
  await page.screenshot({ path: join(output, `${label}.png`), fullPage: true });
  await persist(); return state;
}
async function freshPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e)));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() }));
  page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready(false);
}
async function select(id, shift = false) {
  const object = byId(await doc(), id); assert.ok(object); assert.ok(!object.hidden, `Selection must not show hidden ${id}`);
  const escaped = object.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Icon text precedes the exact object name; no history-row label assumptions.
  const row = page.locator('.ol.direct').filter({ hasText: new RegExp(`${escaped}$`) });
  assert.equal(await row.count(), 1, `One direct outliner row for ${object.name}`);
  await row.click({ modifiers: shift ? ['Shift'] : [] }); await panel().waitFor();
}
async function dismissNotice() {
  const toast = page.locator('.toast[role="alert"]');
  if (await toast.count()) await toast.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await toast.waitFor({ state: 'hidden' });
}
async function refuse(label, action, expectedTitle, expectedHint) {
  phase = `guard ${label}`; await dismissNotice();
  const before = await doc(), selected = await selection(), downloads = report.downloads.length;
  await action();
  const toast = page.locator('.toast[role="alert"]'); await toast.waitFor();
  assert.equal(await toast.locator('.toast-title').textContent(), expectedTitle);
  const hint = await toast.locator('.toast-hint').textContent(); assert.match(hint, expectedHint);
  await same(before); assert.deepEqual(await selection(), selected, 'Refusal preserves selection');
  assert.equal(report.downloads.length, downloads, 'Refusal emits no download');
  report.refusals.push({label, title:expectedTitle, hint, documentUnchanged:true, selectionUnchanged:true, noDownload:true});
  await snapshot(`guard-${label}`);
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const before = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file);
  assert.deepEqual(JSON.parse(bytes), before, 'Native save semantic equality');
  report.files.push({ file, sha256: hash(bytes), semanticEquality: true, byteIdentityClaim: false }); return { file, doc: before };
}
async function freshOpen(saved, label) {
  phase = `fresh Open ${label}`; await freshPage(); await page.setInputFiles('input[aria-label="Model file"]', saved.file);
  await same(saved.doc); await snapshot(label);
}
async function undo(expected, label) { phase = label; await page.keyboard.press('Meta+z'); await same(expected); await snapshot(label); }
async function redo(expected, label) { phase = label; await page.keyboard.press('Meta+Shift+z'); await same(expected); await snapshot(label); }

// Independent planar polygon moments and ray parity. No trim/reversal/material helper is used.
function moments(points) {
  let twice = 0, mx = 0, my = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length], c = p[0] * q[1] - q[0] * p[1];
    twice += c; mx += (p[0] + q[0]) * c; my += (p[1] + q[1]) * c;
  }
  assert.ok(Math.abs(twice) > 1e-10);
  return { signedArea: twice / 2, area: Math.abs(twice / 2), centroid: [mx / (3 * twice), my / (3 * twice), points[0][2]] };
}
function inside(points, p) {
  let parity = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) parity = !parity;
  }
  return parity;
}
function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= 1e-7, `${label}: ${actual} vs ${expected}`);
}
function decode(state, id) {
  const object = byId(state, id); assert.ok(object);
  const text = state.direct.sources[object.source]; assert.equal(typeof text, 'string');
  const result = compileCadModel(text, { sourceVersion: 0 });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  // A transformed source can hold several objects. The direct reference is authoritative.
  const geometry = result.model.objects.find(g => g.id === object.geometry);
  assert.equal(geometry?.kind, 'surface');
  return { object, geometry };
}
function lifted(state, id) {
  const { object, geometry: s } = decode(state, id);
  assert.equal(s.degreeU, 1); assert.equal(s.degreeV, 1);
  assert.equal(s.controlPoints.length, 2); assert.equal(s.controlPoints[0].length, 2);
  const [u0, u1] = [s.knotsU[1], s.knotsU[2]], [v0, v1] = [s.knotsV[1], s.knotsV[2]];
  assert.ok(s.weights.flat().every(w => w === s.weights[0][0]));
  const native = surfaceEvaluator(s);
  const points = object.trims[0].uv.map(([u, v]) => {
    const a = (u - u0) / (u1 - u0), b = (v - v0) / (v1 - v0);
    // Independent tensor-product degree-one evaluation on decoded coefficients.
    const p = [0, 1, 2].map(k => (1-a)*(1-b)*s.controlPoints[0][0][k] + (1-a)*b*s.controlPoints[0][1][k] + a*(1-b)*s.controlPoints[1][0][k] + a*b*s.controlPoints[1][1][k]);
    native(u,v).forEach((x,k) => close(x,p[k],'public evaluator / independent lift'));
    return p;
  });
  return { object, points };
}
function material(state, id, baseline, expected) {
  const { object, points } = lifted(state, id);
  assert.equal(object.trims.length, 1); assert.equal(object.trims[0].uv.length, 160);
  const loop = moments(points), keep = object.trims[0].keep;
  const area = keep === 'inside' ? loop.area : 1200 - loop.area;
  const centroid = keep === 'inside' ? loop.centroid : [(1200*30-loop.area*loop.centroid[0])/area,(1200*9-loop.area*loop.centroid[1])/area,3];
  const probes = [[20,4,3],[40,15,3]].map(p => ({ point:p, material:inside(points,p) === (keep === 'inside') }));
  assert.equal(probes[0].material, keep === 'inside'); assert.equal(probes[1].material, keep === 'outside');
  if (baseline) {
    assert.equal(keep, baseline.keep); assert.equal(points.length, baseline.points.length);
    points.forEach((p,i) => p.forEach((x,k) => close(x,baseline.points[i][k],`world vertex ${i}/${k}`)));
    close(area,baseline.area,'preserved polygon material area');
    centroid.forEach((x,k) => close(x,baseline.centroid[k],`preserved centroid ${k}`));
    assert.deepEqual(probes, baseline.probes);
  }
  if (expected) {
    close(area,expected.area,'independent analytic material area');
    centroid.forEach((x,k) => close(x,expected.centroid[k],`independent analytic centroid ${k}`));
  }
  const evidence = { id, keep, points, area, centroid, loop, probes, toleranceMM:1e-7,
    scope:'Stored world polyline material; not sampled display mesh area or solid mass' };
  report.material ??= []; report.material.push(evidence); return evidence;
}
async function trim(keep, label) {
  await select('obj_1'); await select('obj_2',true);
  assert.equal(await panel().getByRole('button',{name:'Trim by the curve',exact:true}).count(),1);
  await panel().getByLabel('Trim keeps',{exact:true}).selectOption(keep);
  const before = await doc(); await panel().getByRole('button',{name:'Trim by the curve',exact:true}).click(); await changed(before);
  const state = await doc(); assert.equal(byId(state,'obj_1').trims[0].uv.length,160);
  assert.equal(byId(state,'obj_1').trims[0].keep,keep);
  assert.deepEqual(state.nodes,before.nodes); await snapshot(label); return state;
}
async function reverse(id, axis, label) {
  phase = label; await dismissNotice(); await select(id);
  await panel().getByLabel('Surface direction',{exact:true}).selectOption(axis);
  const before = await doc(); await panel().getByRole('button',{name:'Reverse',exact:true}).click(); await changed(before);
  const state = await doc(), added = state.direct.objects.filter(o => !before.direct.objects.some(old => old.id === o.id));
  assert.equal(added.length,1); const object = added[0];
  assert.ok(!object.hidden); assert.equal(byId(state,id).hidden,true);
  assert.deepEqual(byId(state,id),{...byId(before,id),hidden:true},'Hidden source keeps all trim/source/name metadata');
  assert.match(object.name,new RegExp(`${axis} reversed`));
  assert.notEqual(object.id,id); assert.ok(state.direct.sources[object.source]);
  assert.deepEqual(state.nodes,before.nodes);
  const sourceLoop = byId(before,id).trims[0], mappedLoop = object.trims[0];
  assert.equal(mappedLoop.keep,sourceLoop.keep); assert.equal(mappedLoop.uv.length,160);
  mappedLoop.uv.forEach((uv,i) => assert.equal(uv[axis === 'u' ? 1 : 0],sourceLoop.uv[i][axis === 'u' ? 1 : 0]));
  const selected = await selection(); assert.equal(selected.directNames.length,1); assert.ok(selected.directNames[0].endsWith(object.name));
  await snapshot(label); return {state,id:object.id};
}
const inputs = [
  'apps/cad-studio/src/ui/DirectPanel.tsx','apps/cad-studio/src/ui/DirectInspector.tsx','apps/cad-studio/src/App.tsx',
  'apps/cad-studio/test/trimmed-surface-reverse-browser.mjs','apps/cad-studio/vite.config.ts',
  'packages/barocss-cad-model/src/engine/direct.ts','packages/barocss-cad-model/src/engine/trim.ts',
  'packages/barocss-cad/dist/index.js','packages/barocss-cad-model/dist/engine/direct.js',
];
async function capsule(label, files) {
  const unique = [...new Set(files)].sort(); assert.ok(unique.length <= 4096,'Bounded source input inventory');
  const hashes = {};
  for (const file of unique) {
    try { hashes[file] = hash(await readFile(resolve(repo,file))); }
    catch (error) { if (error.code === 'ENOENT' && file.endsWith('/dist/engine/direct.js')) hashes[file] = 'ABSENT'; else throw error; }
  }
  await writeFile(join(output,`source-${label}.json`),JSON.stringify(hashes,null,2)); return hashes;
}
try {
  report.sourceBefore = await capsule('before-generation',inputs);
  for (const name of ['independent-oracle.py','independent-oracle.json']) {
    const file = `/tmp/d337-plan/${name}`, bytes = await readFile(file);
    await writeFile(join(output,name),bytes);
    report.independentOracle ??= []; report.independentOracle.push({file,sha256:hash(bytes),scope:'Planning arithmetic reference; browser claims require actual captured geometry'});
  }
  const built = await build({ stdin:{contents:generator,resolveDir:app,sourcefile:'d337-untrimmed-seed.ts',loader:'ts'},bundle:true,
    platform:'node',format:'esm',target:'node22',write:false,metafile:true });
  const bundle = join(output,'seed-generator.mjs');
  await writeFile(join(output,'seed-generator.ts'),generator); await writeFile(bundle,built.outputFiles[0].contents);
  await writeFile(join(output,'seed-metafile.json'),JSON.stringify(built.metafile,null,2));
  const seedFile = join(output,'seed.bcad'), run = spawnSync(process.execPath,[bundle,seedFile],{encoding:'utf8'});
  await writeFile(join(output,'seed.stdout.txt'),run.stdout ?? ''); await writeFile(join(output,'seed.stderr.txt'),run.stderr ?? '');
  assert.equal(run.status,0,run.stderr); const seed = JSON.parse(await readFile(seedFile,'utf8'));
  assert.ok(seed.direct.objects.every(o => !o.trims),'Main seed must have no trim metadata');
  report.seed = {file:seedFile,sha256:hash(await readFile(seedFile)),trimAuthorship:'Actual public Studio Trim by the curve only'};
  const concaveCSS = fixtureCSS.replace('knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]; weights:[1,1,1,1,1];',
    'knots:[0,0,1,2,3,4,5,6,6]; control-points:[[15,-1,3],[30,-1,3],[30,4,3],[22,4,3],[22,12,3],[15,12,3],[15,-1,3]]; weights:[1,1,1,1,1,1,1];');
  assert.notEqual(concaveCSS,fixtureCSS);
  // Public importSource generator remains the only source of direct objects in each own fixture.
  async function seedVariant(label, css) {
    const source = generator.replace(JSON.stringify(fixtureCSS),JSON.stringify(css)); assert.notEqual(source,generator);
    const compiled = await build({stdin:{contents:source,resolveDir:app,sourcefile:`${label}-seed.ts`,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true});
    const file = join(output,`${label}-seed.bcad`), executable = join(output,`${label}-generator.mjs`);
    await writeFile(executable,compiled.outputFiles[0].contents); await writeFile(join(output,`${label}-generator.ts`),source);
    const result = spawnSync(process.execPath,[executable,file],{encoding:'utf8'});
    await writeFile(join(output,`${label}-generator.log`),(result.stdout ?? '')+(result.stderr ?? '')); assert.equal(result.status,0,result.stderr);
    return {file,doc:JSON.parse(await readFile(file,'utf8'))};
  }
  const concaveSeed = await seedVariant('concave',concaveCSS);
  const unsupportedCSS = fixtureCSS.replace('[[50,-6,3],[50,24,3]]','[[50,-6,3],[50,24,4]]')
    .replace('[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]',
      '[[15,-1,3.0208333333333335],[25,-1,3.0625],[25,9,3.1875],[15,9,3.0625],[15,-1,3.0208333333333335]]');
  const unsupportedSeed = await seedVariant('nonplanar',unsupportedCSS);
  // esbuild records the virtual stdin name alongside real inputs. Its exact
  // contents are saved as seed-generator.ts; it has no source file on disk.
  const virtualSeed = resolve(app, 'd337-untrimmed-seed.ts');
  const generationInputs = Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtualSeed);
  // Include all actual public seed-bundle inputs and their source companions before browser startup.
  const frozenFiles = [...inputs,...generationInputs];
  report.sourceFrozen = await capsule('frozen-before-browser',frozenFiles);
  for (const [file,digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file],digest,`Source changed during generation: ${file}`);
  report.sourceInputCount = Object.keys(report.sourceFrozen).length;
  phase = 'actual Studio start';
  server = await createServer({root:app,configFile:join(app,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
  server.watcher.on('all',(event,file) => { if (['change','add','unlink'].includes(event)) report.changes.push({event,file}); }); await server.listen();
  const {chromium} = createRequire(join(process.env.PW_DIR,'package.json'))('playwright');
  browser = await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-unsafe-webgpu']});
  report.chromeProcessesLaunched = 1;
  await freshOpen({file:seedFile,doc:seed},'01-untrimmed-seed-open');
  const trimmed = await trim('outside','02-public-trim160-outside');
  const baseline = material(trimmed,'obj_1',null,{area:1100,centroid:[340/11,104/11,3]});
  const u = await reverse('obj_1','u','03-trim-preserving-reverse-u'); material(u.state,u.id,baseline);
  await undo(trimmed,'04-undo-u-exact-trim-document'); await redo(u.state,'05-redo-u-exact-accepted-document');
  const v = await reverse(u.id,'v','06-trim-preserving-reverse-v'); material(v.state,v.id,baseline);
  await select(v.id);
  await refuse('iges',()=>page.getByRole('button',{name:'Export IGES',exact:true}).click(),'Could not write IGES',/does not preserve surface trims/i);
  const thicken = panel().getByRole('button',{name:'Thicken into a body',exact:true});
  report.thickenEligibility = {count:await thicken.count(),selected:v.id};
  if (await thicken.count()) await refuse('thicken',()=>thicken.click(),'Untrim it first',/trimmed one is not thickened/);
  else report.thickenEligibility.status = 'NOT_PROVEN';
  await select('obj_3',true); const sew = panel().getByRole('button',{name:'Sew into a body',exact:true});
  report.sewEligibility = {count:await sew.count(),selected:[v.id,'obj_3']};
  if (await sew.count()) await refuse('sew',()=>sew.click(),'Untrim them first',/trimmed ones do not sew/);
  else report.sewEligibility.status = 'NOT_PROVEN';
  // A refusal adds no undo item: the next Undo returns to the actual last successful Reverse.
  await undo(u.state,'09-guards-do-not-add-undo-items'); await redo(v.state,'10-redo-after-guards');
  const saved = await save('trim-preserving-u-v'); await freshOpen(saved,'07-native-fresh-open');
  await select(v.id); material(await doc(),v.id,baseline);
  assert.deepEqual(byId(await doc(),'obj_1'),byId(saved.doc,'obj_1'));
  assert.deepEqual(byId(await doc(),v.id),byId(saved.doc,v.id));
  await snapshot('08-native-result-reselected');
  await freshOpen({file:seedFile,doc:seed},'11-inside-untrimmed-seed');
  const insideTrim = await trim('inside','12-public-trim160-inside');
  const insideBaseline = material(insideTrim,'obj_1',null,{area:100,centroid:[20,4,3]});
  const insideU = await reverse('obj_1','u','13-inside-reverse-u'); material(insideU.state,insideU.id,insideBaseline);
  const insideV = await reverse(insideU.id,'v','14-inside-reverse-v'); material(insideV.state,insideV.id,insideBaseline);
  await freshOpen(concaveSeed,'15-concave-untrimmed-seed');
  const concaveTrim = await trim('outside','16-concave-public-trim160');
  const concaveBaseline = material(concaveTrim,'obj_1');
  report.concaveDesign = {idealAuthoredHoleArea:131,actualStoredPolylineHoleArea:concaveBaseline.loop.area,
    note:'160 equal curve-parameter samples can cut corners. Preserve the actual stored polyline; do not equate this with the ideal authored polygon.'};
  const concaveU = await reverse('obj_1','u','17-concave-reverse-u'); material(concaveU.state,concaveU.id,concaveBaseline);
  const concaveV = await reverse(concaveU.id,'v','18-concave-reverse-v'); material(concaveV.state,concaveV.id,concaveBaseline);
  await freshOpen(unsupportedSeed,'19-nonplanar-untrimmed-seed');
  const unsupportedTrim = await trim('outside','20-nonplanar-public-trim160'); await select('obj_1');
  await panel().getByLabel('Surface direction',{exact:true}).selectOption('u');
  await refuse('nonplanar-reverse',()=>panel().getByRole('button',{name:'Reverse',exact:true}).click(),'The operation was refused',/trim|affine|planar/i);
  await undo(unsupportedSeed.doc,'21-refusal-undo-is-public-trim'); await redo(unsupportedTrim,'22-refusal-redo-public-trim');
  await freshOpen({file:seedFile,doc:seed},'23-valid-retry-seed');
  const retryTrim = await trim('outside','24-valid-retry-trim'); const retryBaseline = material(retryTrim,'obj_1',null,{area:1100,centroid:[340/11,104/11,3]});
  const retry = await reverse('obj_1','u','25-valid-retry-reverse'); material(retry.state,retry.id,retryBaseline);
  assert.deepEqual(report.errors,[]); assert.deepEqual(report.consoleErrors,[]); assert.deepEqual(report.changes,[]);
  report.sourceAfter = await capsule('after-browser',frozenFiles); assert.deepEqual(report.sourceAfter,report.sourceFrozen);
  report.status = 'PASS'; report.surfaceSolidMass = 'NOT_APPLICABLE';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1;
  if (page) { try { await snapshot('failure'); } catch (e) { report.captureFailure = e.stack ?? String(e); } }
} finally {
  for (const [resource,label] of [[context,'CONTEXT'],[browser,'BROWSER'],[server,'SERVER']]) {
    if (!resource) continue;
    try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); }
    catch (error) { report.cleanup.push({resource:label,error:error.stack ?? String(error)}); report.status='FAIL'; process.exitCode=1; }
  }
  try { report.sourceAfterCleanup = await capsule('after-cleanup',report.sourceFrozen ? Object.keys(report.sourceFrozen) : inputs); if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup,report.sourceFrozen); }
  catch (error) { report.sourceCapsuleFailure = error.stack ?? String(error); report.status='FAIL'; process.exitCode=1; }
  await persist(); console.log(JSON.stringify({status:report.status,phase,failure:report.failure,output}));
}
