// D344_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
// node test/native-quadrature-step-browser.mjs /absolute/artifacts
// Public author API seed; actual mouse, Offset and Export STEP UI actions. Hooks only observe.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

assert.equal(process.env.D344_SOURCE_FROZEN, '1', 'Root must freeze all writers before D344 generation');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = {
  status: 'RUNNING', qualification: 'TARGET_ONLY_DEFAULT_STEP_METADATA', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS',
  states: [], nativeReads: [], exports: [], picks: [], downloads: [], files: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One target body; no witness aggregate can hide the tiny volume.',
    'STEP metadata uses raw native quadrature; upright Model mass is not its reference.',
    'Independent stored-node rational Gauss arithmetic imports no product code; rounded pi is a separate guide.',
    'Screenshots prove UI presence and action only. Float32 pixels do not prove a four-ULP interval.',
    'Native STEP strict readback is asserted without replacing the tiny fixture on failure.'],
};
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const seedSource = `import {writeFileSync} from 'node:fs';
import {part,Location} from '../../packages/barocss-cad-model/src/api/index.ts';
const p=part('D344 target-only cylinder').cylinder({r:3,h:5.00009}).moved(Location.at([.1234567,-.2345678,.3456789]));
writeFileSync(process.argv[2],JSON.stringify(p.doc,null,2));`;
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {brepMassProperties,checkBrep,importStep,stepValidationProperties} from '../../packages/barocss-cad/src/index.ts';
import {nativeCylinderNodes,assertNearRational} from '../../packages/barocss-cad/test/helpers/native-quadrature-oracle.mjs';
import {wholePatchTest} from '../../packages/barocss-cad/src/brep/brep-mass-quadrature.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),bodies=partBreps(doc);assert.equal(bodies.length,1);
const {key,brep}=bodies[0],check=checkBrep(brep,{strict:true});assert.equal(check.valid,true);assert.equal(brep.bodies.length,1);assert.equal(brep.bodies[0].kind,'solid');assert.equal(brep.shells.length,1);assert.equal(brep.shells[0].closed,true);assert.equal(brep.faces.length,4);
const levels=b=>[Math.min(...b.vertices.map(v=>v.point[2])),Math.max(...b.vertices.map(v=>v.point[2]))],interval=levels(brep),raw=brepMassProperties(brep,1),reference=nativeCylinderNodes(brep),guide=Math.PI*9*(interval[1]-interval[0]);
assert.equal(raw.method,'quadrature');assertNearRational(raw.volume,reference.volume,1e-11*guide,'native stored-node volume');for(let k=0;k<3;k++)assertNearRational(raw.centroid[k],reference.centroid[k],1e-7,'native centroid'+k);assert.ok(raw.centroid[2]>=interval[0]&&raw.centroid[2]<=interval[1]);
const view=evaluateDoc(doc,0);assert.ok(view.ok);assert.equal(view.bodies.length,1);const body=view.bodies[0];
const result={key,brep,check,interval,raw,reference:{nodeCount:reference.nodeCount,volume:{n:String(reference.volume.n),d:String(reference.volume.d)},centroid:reference.centroid.map(q=>({n:String(q.n),d:String(q.d)}))},roundedCircleGuide:guide,nativeNames:brep.faces.map(f=>f.name),displayBodyIndex:0,displayFaces:body.mesh.faces.map((f,index)=>({index,name:f.name,kind:f.kind,normal:f.normal,centroid:f.centroid}))};
if(process.argv[3]){const text=readFileSync(process.argv[3],'utf8');assert.ok(text.includes('SI_UNIT(.MILLI.,.METRE.)'));assert.ok(text.includes('VOLUME_UNIT()'));assert.ok(text.includes('AREA_UNIT()'));
const properties=stepValidationProperties(text);assert.ok(properties.volume!==undefined&&properties.centroid&&properties.box&&properties.area!==undefined);assertNearRational(properties.volume,reference.volume,1e-11*guide,'downloaded STEP native volume');assert.ok(Math.abs(properties.volume/guide-1)<1e-11);for(let k=0;k<3;k++)assertNearRational(properties.centroid[k],reference.centroid[k],1e-7,'STEP centroid'+k);assert.ok(properties.centroid[2]>=interval[0]&&properties.centroid[2]<=interval[1]);assert.equal(properties.box.min[2],interval[0]);assert.equal(properties.box.max[2],interval[1]);
const back=importStep(text),backCheck=checkBrep(back,{strict:true});assert.equal(backCheck.valid,true);assert.equal(back.bodies.length,1);assert.equal(back.bodies[0].kind,'solid');assert.equal(back.shells.length,1);assert.equal(back.shells[0].closed,true);assert.deepEqual(levels(back),interval,'STEP retains exact native cap levels');assert.equal(back.faces.length,4);assert.deepEqual(back.faces.map(f=>f.name).sort(),result.nativeNames.slice().sort());
const importedMass=brepMassProperties(back,1),whole=wholePatchTest(back);
result.step={properties,readback:back,check:backCheck,interval:levels(back),importedProvider:{mass:importedMass,wholePatchFaces:back.faces.filter(whole).map(f=>f.name),relativeVolumeDifferenceToRoundedGuide:importedMass.volume/guide-1,scope:'Separate imported-geometry provider observation; not the export metadata oracle'},units:{length:'mm',area:'mm^2',volume:'mm^3'},scope:'Actual UI download default native validation properties and strict readback'};}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(result));`;
const doc = () => page.evaluate(() => window.__studioDoc);
async function ready() {
  await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady && s.bodies.length === 1; }, null, { timeout: 60000 });
}
async function same(expected) {
  await page.waitForFunction(value => JSON.stringify(window.__studioDoc) === value, JSON.stringify(expected), { timeout: 60000 });
  await ready(); assert.deepEqual(await doc(), expected);
}
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection,
    hud: document.querySelector('.hud')?.textContent ?? null, notices: [...document.querySelectorAll('.toast')].map(e => e.textContent) }), label);
  report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2));
  await writeFile(join(output, `${label}.html`), await page.content()); await page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await persist();
}
async function open(file, expected, label) {
  phase = `fresh Open ${label}`;
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.stack ?? String(error)));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('download', download => report.downloads.push({ phase, suggestedFilename: download.suggestedFilename() }));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 });
  await page.setInputFiles('input[aria-label="Model file"]', file); await same(expected); await snapshot(label);
}
async function inspect(label, stepFile) {
  phase = `native and STEP observation ${label}`;
  const accepted = await doc(), file = join(output, `${label}.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file, ...(stepFile ? [stepFile] : [])], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
  await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr); const read = JSON.parse(run.stdout); report.nativeReads.push({ label, sourceRecipeHash: hash(JSON.stringify(accepted)), ...read });
  assert.deepEqual(await doc(), accepted, 'Observation leaves authored document unchanged'); await persist(); return read;
}
async function exportStep(label, expectedInterval) {
  phase = `actual Export STEP ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export STEP', exact: true }).click()]);
  assert.match(download.suggestedFilename(), /\.step$/i); const file = join(output, `${label}.step`); await download.saveAs(file);
  const bytes = await readFile(file); report.exports.push({ label, file, sha256: hash(bytes), suggestedFilename: download.suggestedFilename(), route: 'Actual Export STEP toolbar -> worker -> exportStudioStep -> native BRep validation metadata' });
  assert.deepEqual(await doc(), accepted, 'STEP export leaves recipe unchanged'); const read = await inspect(`${label}-readback`, file);
  assert.deepEqual(read.interval, expectedInterval); assert.deepEqual(read.step.interval, expectedInterval); await snapshot(label); return read;
}
async function pickTop(native) {
  phase = 'actual original top-cap mouse selection'; await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Top', exact: true }).click();
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const faces = native.displayFaces.filter(face => face.kind === 'plane' && face.normal[2] === 1); assert.equal(faces.length, 1); const face = faces[0];
  const pixel = await page.evaluate(point => window.__studioScreenOf?.(point), face.centroid); assert.ok(pixel?.length === 2 && pixel.every(Number.isFinite));
  await page.mouse.click(pixel[0], pixel[1]);
  await page.waitForFunction(face => { const s = window.__studioSelection?.selection; return s?.faces.length === 1 && s.faces[0].body === 0 && s.faces[0].face === face && s.edges.length === 0 && s.bodies.length === 0; }, face.index, { timeout: 10000 });
  report.picks.push({ point: face.centroid, pixel, key: native.key, face: face.index, route: 'Actual mouse click; __studioScreenOf only projects a point' }); await snapshot('03-original-cap-selected');
}
const initialFiles = ['apps/cad-studio/test/native-quadrature-step-browser.mjs', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/files/useModelExports.ts', 'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad-model/src/engine/nativeMassWire.ts', 'packages/barocss-cad-model/src/app/nativeOffsetFace.ts', 'packages/barocss-cad-model/src/app/profileCommands.ts',
  'packages/barocss-cad/src/io/step.ts', 'packages/barocss-cad/src/io/step-import.ts', 'packages/barocss-cad/src/brep/brep-mass-quadrature.ts', 'packages/barocss-cad/src/brep/solid-mass.ts', 'packages/barocss-cad/test/helpers/native-quadrature-oracle.mjs'];
let frozenFiles = initialFiles;
async function capsule(label, files) {
  const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096);
  const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file)));
  await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes;
}
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length;
  const buildInputs = [];
  async function compile(label, contents) {
    const sourcefile = `d344-${label}.ts`, virtual = resolve(app, sourcefile);
    const result = await build({ stdin: { contents, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
    await writeFile(join(output, `${label}.ts`), contents); await writeFile(join(output, `${label}-metafile.json`), JSON.stringify(result.metafile, null, 2));
    // Stdin is virtual. Its exact contents/hash are captured and it is explicitly excluded from disk inputs.
    buildInputs.push(...Object.keys(result.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual));
    report.virtualSources ??= []; report.virtualSources.push({ label, hash: hash(contents), virtualInputExcluded: virtual });
    const file = join(output, `${label}.mjs`); await writeFile(file, result.outputFiles[0].contents); return file;
  }
  const seedBundle = await compile('seed', seedSource); inspector = await compile('inspector', inspectSource);
  const seedFile = join(output, 'seed.bcad'), generation = spawnSync(process.execPath, [seedBundle, seedFile], { encoding: 'utf8' });
  await writeFile(join(output, 'seed.stdout.txt'), generation.stdout ?? ''); await writeFile(join(output, 'seed.stderr.txt'), generation.stderr ?? ''); assert.equal(generation.status, 0, generation.stderr);
  const seed = JSON.parse(await readFile(seedFile, 'utf8'));
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts'];
  report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); });
  await server.listen(); const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;
  await open(seedFile, seed, '01-original-target'); const original = await inspect('01-original-native');
  await exportStep('02-original-step', original.interval); await pickTop(original);
  phase = 'actual Offset preview'; await page.keyboard.press('Space'); await page.locator('.palette input').fill('Offset face'); await page.keyboard.press('Enter');
  const hud = page.getByRole('dialog', { name: 'Offset face', exact: true }); await hud.waitFor(); await hud.getByLabel('Offset', { exact: true }).fill('-5.00009');
  assert.equal(await hud.getByLabel('Offset', { exact: true }).inputValue(), '-5.00009');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 60000 });
  assert.deepEqual(await doc(), seed); assert.equal(await hud.getByRole('button', { name: 'Apply', exact: true }).isDisabled(), false); await snapshot('04-offset-preview');
  phase = 'actual Offset Apply'; await hud.getByRole('button', { name: 'Apply', exact: true }).click(); await hud.waitFor({ state: 'hidden' }); await ready();
  const accepted = await doc(); assert.deepEqual(accepted.nodes.slice(0, seed.nodes.length), seed.nodes); assert.deepEqual(accepted.parameters, seed.parameters);
  assert.equal(accepted.nodes.length, seed.nodes.length + 3); assert.equal(accepted.nodes.at(-1).kind, 'difference'); assert.equal(accepted.nodes[seed.nodes.length + 1].height, 5.00009); assert.equal(accepted.nodes[seed.nodes.length + 1].from, -5.00009);
  const selection = await page.evaluate(() => window.__studioSelection.selection); for (const key of ['faces', 'edges', 'bodies', 'vertices']) assert.equal(selection[key]?.length ?? 0, 0);
  report.acceptedSelection = selection; await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Iso', exact: true }).click(); await snapshot('05-thin-applied');
  const thin = await exportStep('06-thin-step', [.3456789, .34567890000000023]);
  phase = 'Undo and Redo exact recipe'; await page.keyboard.press('Meta+z'); await same(seed); await snapshot('07-undo-original'); await page.keyboard.press('Meta+Shift+z'); await same(accepted); await snapshot('08-redo-thin');
  phase = 'native Save'; const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const saved = join(output, 'thin.bcad'); await download.saveAs(saved); const bytes = await readFile(saved); assert.deepEqual(JSON.parse(bytes), accepted); report.files.push({ file: saved, hash: hash(bytes), semanticEquality: true });
  await open(saved, accepted, '09-fresh-open-thin'); const reopened = await exportStep('10-fresh-open-step', [.3456789, .34567890000000023]);
  assert.deepEqual(reopened.nativeNames, thin.nativeNames); assert.deepEqual(reopened.brep, thin.brep);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1;
  if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); }
} finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) {
    if (!resource) continue;
    try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; }
  }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); }
  catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
