// D417: actual STEP admission of a known invalid surface/edge binding; no outbound file actions.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[2] && process.argv[3] && process.argv[4] && process.argv[5], 'Output, reviewer fixtures, matched-roof STEP and owned unit-box STL are required');
const input = resolve(process.argv[3]);
const remainingRefusal = process.env.PATCH_BINDING_REMAINING_REFUSAL === '1';
const refusal = process.env.PATCH_BINDING_REFUSAL;
assert.ok(refusal, 'Fixed-source run requires the exact expected refusal text');
const validFile = join(input, 'baseline.step'), invalidFile = join(input, 'invalidBinding.step');
const validText = await readFile(validFile, 'utf8'), invalidText = await readFile(invalidFile, 'utf8');
const roofFile = resolve(process.argv[4]), roofText = await readFile(roofFile, 'utf8');
const stlFile = resolve(process.argv[5]);
const inspectorSource = `
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {partBreps} from '@barocss/cad-model/engine/evaluate';
import {brepMassProperties,checkBrep,evaluateSurface,importStep,stepValidationProperties} from '@barocss/cad';
import {brepBounds} from '../../packages/barocss-cad/src/brep/brep-bounds';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));
const mode=JSON.parse(process.argv[3]);
if(mode==='prepared-mesh'){
 const text=JSON.parse(process.argv[4]),brep=importStep(text),mass=brepMassProperties(brep,1),bounds=brepBounds(brep),check=checkBrep(brep,{strict:true});
 assert.equal(doc.nodes.length,1);assert.equal(doc.nodes[0].kind,'mesh');assert.equal(doc.nodes[0].representation,'facets');
 assert.equal(check.valid,true);assert.deepEqual([brep.bodies.length,brep.shells.length,brep.faces.length,brep.edges.length,brep.vertices.length],[1,1,6,12,8]);
 assert.ok(Math.abs(mass.volume-1)<=1e-12);assert.deepEqual(bounds,{min:[0,0,0],max:[1,1,1]});
 const planes=(text.match(/=PLANE\\(/g)||[]).length;assert.equal(planes,6);assert.ok(text.includes('AUTOMOTIVE_DESIGN'));
 const metadata=stepValidationProperties(text);assert.ok(Math.abs(metadata.volume-1)<=1e-12);
 console.log(JSON.stringify({mode,planes,mass,bounds,check,metadata,route:'real worker planar STEP reply, existing planarFacets to owned brepFromTriangles'}));process.exit(0);
}
const bodies=partBreps(doc);assert.equal(bodies.length,1);
const brep=bodies[0].brep,check=checkBrep(brep,{strict:true});
const mass=brepMassProperties(brep,1),bounds=brepBounds(brep);
const counts={bodies:brep.bodies.length,shells:brep.shells.length,faces:brep.faces.length,edges:brep.edges.length,vertices:brep.vertices.length};
assert.deepEqual(counts,{bodies:1,shells:1,faces:6,edges:12,vertices:8});
let witness;
assert.equal(check.valid,true);
if(mode==='valid-flat'){
 assert.ok(Math.abs(mass.volume-1)<=1e-12);
 assert.deepEqual(bounds,{min:[0,0,0],max:[1,1,1]});
}else{
 assert.equal(mode,'valid-roof');
 assert.ok(Math.abs(mass.volume-1.25)<=1e-12);
 assert.deepEqual(bounds,{min:[0,0,0],max:[1,1,2]});
 const expectedName=doc.nodes[0].id+'.top';
 const faces=brep.faces.filter(face=>face.name==='top'||face.name===expectedName);
 assert.equal(faces.length,1);const surface=faces[0].surface;
 assert.deepEqual([surface.degreeU,surface.degreeV],[1,2]);
 assert.deepEqual([surface.controlPoints.length,surface.controlPoints[0].length],[4,3]);
 assert.ok(surface.weights.every(row=>row.every(weight=>weight===1)));
 const point=evaluateSurface(surface,.25,.5);assert.deepEqual(point,[.25,.5,2]);
 witness={degree:[1,2],poles:[4,3],point,source:'High matchedBox coefficient/volume oracle'};
}
console.log(JSON.stringify({mode,counts,check,mass,bounds,witness}));
`;
const f = await createFlow({
  name: 'patch-boundary-binding', envFrozen: 'PATCH_BOUNDARY_BINDING_SOURCE_FROZEN',
  output: process.argv[2], qualification: 'D417_INVALID_PATCH_BOUNDARY_ADMISSION', inspectorSource,
  initialFiles: ['apps/cad-studio/test/patch-boundary-binding-browser.mjs', validFile, invalidFile, roofFile, stlFile, 'packages/barocss-cad/test/brep-boundary-binding-fixtures.mjs', join(input, 'result.json'), join(input, 'proof.md')],
  requiredFrozen: ['apps/cad-studio/src/files/importedFile.ts', 'packages/barocss-cad/src/io/step-import.ts'],
  limits: [
    'One reviewer-produced degree(1,2), 4x3 invalid unit-box binding; valid flat unit box and genuinely matched nonplanar roof controls. No NURBS limit expansion.',
    'The 1 mm witness is same-parameter surface/edge z difference, not closest distance. Independent closest distance is about 0.00390622 mm.',
    'Invalid mismatched-face flux is not volume of a valid solid. Product inspector is an observation, not an independent geometry oracle.',
    'Raw STEP Open plus a 12-triangle STL to in-memory planar STEP preparation/Cancel. No outbound Export, Save, download, OCP or paid call.',
  ],
});
async function openAccepted(file, text, label, mode) {
  await f.page.setInputFiles('input[aria-label="Model file"]', file);
  const toast = await f.waitToast(/STEP opened.*1 solid/, 60000);
  await f.page.waitForFunction(expected => window.__studioDoc?.nodes?.length === 1 &&
    window.__studioDoc.nodes[0].kind === 'import' && window.__studioDoc.nodes[0].step === expected &&
    window.__studioBodies?.()?.bodies.length === 1, text, { timeout: 60000 });
  await f.ready();
  const doc = await f.doc(), bodies = await f.bodies();
  assert.equal(doc.nodes[0].step, text);
  const expectedVolume = mode === 'valid-flat' ? 1 : 1.25;
  assert.ok(Math.abs(bodies.bodies[0].volume - expectedVolume) <= 1e-12);
  const observation = await f.inspect(label, doc, mode);
  await f.same(doc);
  await f.page.getByRole('button', { name: 'Iso', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  f.report.observations.push({ label, mode, inputSha256: sha256(text), exactStoredImportText: true, toast, inspector: observation, studioBodies: bodies });
  await f.snapshot(label);
  return doc;
}
await f.run(async () => {
  const fonts = { stylesheets: 0, assets: 0 }, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.addInitScript(() => {
      const RealWorker = window.Worker;
      window.__d417StepReplies = [];
      window.Worker = class extends RealWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', event => {
            if (event.data?.step) window.__d417StepReplies.push({ id: event.data.id, step: event.data.step });
          });
        }
      };
    });
    await context.route('https://fonts.googleapis.com/**', route => { fonts.stylesheets++; return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
    await context.route('https://fonts.gstatic.com/**', route => { fonts.assets++; return route.fulfill({ status: 204, body: '' }); });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = newContext; }
  f.phase = 'Open valid unit-box STEP control';
  if (!remainingRefusal) await openAccepted(validFile, validText, '01-valid-flat-box', 'valid-flat');
  f.phase = 'Open genuinely matched nonplanar roof control';
  const accepted = await openAccepted(roofFile, roofText, '02-valid-matched-roof', 'valid-roof');
  f.phase = 'Refuse invalid boundary binding atomically';
  await f.page.setInputFiles('input[aria-label="Model file"]', invalidFile);
  const toast = await f.waitToast(/Could not open this file/, 60000);
  assert.ok(toast.includes(refusal), toast);
  assert.doesNotMatch(toast, /unexpected kernel failure/);
  await f.same(accepted);
  const bodies = await f.bodies();
  assert.ok(Math.abs(bodies.bodies[0].volume - 1.25) <= 1e-12);
  await f.page.getByRole('button', { name: 'Iso', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  f.report.observations.push({ invalidInputSha256: sha256(invalidText), refusal: toast, exactPriorDocumentRetained: true, matchedRoofStillUsable: true });
  await f.snapshot('03-invalid-refused-matched-roof-retained');
  if (!remainingRefusal) {
  f.phase = 'Open closed 12-triangle unit-box STL';
  await f.page.setInputFiles('input[aria-label="Model file"]', stlFile);
  const units = f.page.getByRole('dialog', { name: 'Mesh units', exact: true });
  await units.getByLabel('Mesh unit', { exact: true }).selectOption('mm');
  await units.getByRole('button', { name: 'Open', exact: true }).click();
  await units.waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 1 && window.__studioDoc.nodes[0].kind === 'mesh', null, { timeout: 60000 });
  await f.ready();
  const meshDoc = await f.doc(), meshBodies = await f.bodies();
  assert.equal(meshDoc.nodes[0].representation, 'facets');
  assert.ok(Math.abs(meshBodies.bodies[0].volume - 1) <= 1e-12);
  f.phase = 'Prepare planar STEP through owned mesh producer, without download';
  await f.page.evaluate(() => { window.__d417StepReplies.length = 0; });
  await f.page.getByRole('button', { name: 'Export STEP', exact: true }).click();
  const panel = f.page.getByRole('region', { name: 'STEP export', exact: true });
  await panel.getByRole('button', { name: 'Export', exact: true }).waitFor();
  await f.page.waitForFunction(() => document.querySelector('[aria-label="STEP export"] button.primary')?.disabled === false && window.__d417StepReplies.some(reply => typeof reply.step?.text === 'string'), null, { timeout: 60000 });
  assert.equal(await panel.getByLabel('STEP mesh representation', { exact: true }).inputValue(), 'auto');
  const prepared = await f.page.evaluate(() => window.__d417StepReplies.at(-1).step.text);
  const read = await f.inspect('04-owned-mesh-prepared', meshDoc, 'prepared-mesh', prepared);
  await writeFile(join(f.output, '04-actual-worker-prepared.step'), prepared);
  await f.same(meshDoc);
  f.report.observations.push({ ownedMeshConsumer: 'STL 12 triangles -> Auto <=5000 -> planarFacets -> brepFromTriangles', passiveRealWorkerReply: true, preparedSha256: sha256(prepared), inspector: read, documentUnchanged: true, outboundDownload: 'NOT_RUN' });
  await f.snapshot('04-owned-mesh-planar-step-preview');
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
  await f.same(meshDoc);
  }
  assert.equal(fonts.assets, 0);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ fonts, outboundSaveExportDownload: 'NOT_RUN', mode: 'FIXED_SOURCE_REFUSAL', remainingRefusalOnly: remainingRefusal });
});
