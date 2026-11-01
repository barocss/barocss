// D407: prepare/report/cancel only. The explicit outbound Export action is NOT_RUN.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
const remaining = process.env.STEP_PREVIEW_REMAINING === '1';
const input = resolve(process.argv[3] ?? ''); assert.ok(process.argv[3], 'fresh producer output directory required');
const metadata = JSON.parse(await readFile(join(input, 'producer-inputs.json'), 'utf8'));
const output = resolve(process.argv[2]); await mkdir(output, { recursive: true });
// A closed tetrahedron: mesh controls are tested without downloading an external fixture.
const meshFile = join(output, 'mesh.bcad');
await writeFile(meshFile, JSON.stringify({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, outputs: {}, nextId: 1, nodes: [{ id: 'n0', kind: 'mesh', name: 'Tetrahedron', unit: 'mm', representation: 'facets', positions: [0,0,0,10,0,0,0,10,0,0,0,10], indices: [0,2,1,0,1,3,1,2,3,2,0,3] }] }));
const assemblyFile = join(output, 'assembly-with-annotations.bcad');
const assembly = JSON.parse(await readFile(join(input, 'assembly.bcad'), 'utf8'));
assembly.drawing = { sheet: 'A4', projection: 'third', hidden: true, dimensions: [] };
assembly.references = { version: 1, references: [], keepouts: [], datums: [{ id: 'origin', name: 'Inspection origin', kind: 'plane', origin: [0,0,0], normal: [0,0,1], xAxis: [1,0,0] }] };
await writeFile(assemblyFile, JSON.stringify(assembly));
const f = await createFlow({ name: 'step-export-preview', envFrozen: 'STEP_EXPORT_PREVIEW_SOURCE_FROZEN', output, qualification: 'D407_STEP_EXPORT_PREVIEW',
  initialFiles: ['apps/cad-studio/test/step-export-preview-browser.mjs', assemblyFile, meshFile],
  extraFrozen: Object.keys(metadata.inputs).filter(path => path !== 'apps/cad-studio/exchange-profile-producer.ts'),
  requiredFrozen: ['apps/cad-studio/src/files/stepExportPreparation.ts', 'apps/cad-studio/src/files/StepExportPanel.tsx', 'apps/cad-studio/src/files/useModelExports.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits: ['Outbound Export button, Save and downloads are NOT_RUN (owner download permission absent).', 'Controller tests exercise delayed replies and stale final downloads with injected worker/download functions; actual browser does not force worker timing.', 'One nested prismatic assembly and one closed tetrahedron on one WebGPU browser; no general format or reader acceptance claim.'] });
const panel = () => f.page.getByRole('region', { name: 'STEP export', exact: true });
async function prepare() { await f.page.getByRole('button', { name: 'Export STEP', exact: true }).click(); await panel().getByRole('button', { name: 'Export', exact: true }).waitFor(); await f.page.waitForFunction(() => document.querySelector('[aria-label="STEP export"] button.primary')?.disabled === false, null, { timeout: 60000 }); }
await f.run(async () => {
  await f.newPage(); f.phase = 'nested named coloured assembly'; await f.openFile(assemblyFile, 0);
  await f.page.waitForFunction(() => window.__studioDoc?.instances?.map(i => i.id).join(',') === 'loose,sub' && window.__studioInstanceBounds?.()?.length === 2, null, { timeout: 60000 });
  const original = await f.doc(); await f.page.getByRole('button', { name: 'Iso', exact: true }).click(); await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  if (!remaining) {
  await prepare(); const loss = await panel().getByLabel('STEP loss report').innerText();
  for (const re of [/feature history/, /flattened at their placements/, /hierarchy and shared definitions/, /User body and occurrence labels/, /colours and materials/, /Drawing sheets, dimensions/, /Named reference datums/]) assert.match(loss, re);
  const bounds = await panel().boundingBox(), viewport = await f.page.locator('.viewport').boundingBox(); assert.ok(bounds.x > viewport.x + viewport.width / 2, 'panel is in right dock');
  await f.same(original); f.report.observations.push({ loss, documentUnchanged: true, explicitDownload: 'NOT_RUN' }); await f.snapshot('01-assembly-step-preview');
  await panel().getByRole('button', { name: 'Cancel', exact: true }).click(); await panel().waitFor({ state: 'hidden' }); await f.same(original);
  }
  await prepare(); await f.page.getByRole('button', { name: 'Iso', exact: true }).click(); await f.page.keyboard.press('Escape'); await panel().waitFor({ state: 'hidden' }); await f.same(original);
  await prepare(); f.phase = 'Open invalidates prepared bytes'; await f.page.setInputFiles('input[aria-label="Model file"]', meshFile); await panel().waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.[0]?.kind === 'mesh', null, { timeout: 60000 }); await f.ready(); const mesh = await f.doc();
  f.phase = 'mesh representation remains in one dock panel'; await prepare(); const select = panel().getByLabel('STEP mesh representation'); assert.equal(await select.count(), 1);
  for (const option of ['tessellated', 'planar', 'auto']) { await select.selectOption(option); await f.page.waitForFunction(() => document.querySelector('[aria-label="STEP export"] button.primary')?.disabled === false, null, { timeout: 60000 }); assert.equal(await select.inputValue(), option); await f.same(mesh); }
  await f.snapshot('02-mesh-options'); await panel().getByRole('button', { name: 'Close STEP export', exact: true }).click(); await panel().waitFor({ state: 'hidden' }); await f.same(mesh);
  await prepare(); f.phase = 'New invalidates prepared bytes'; await f.page.getByRole('button', { name: 'New part', exact: true }).click(); await panel().waitFor({ state: 'hidden' }); await f.page.waitForFunction(() => !window.__studioDoc?.nodes?.length, null, { timeout: 60000 });
  assert.deepEqual(f.report.downloads, []); f.report.observations.push({ cancel: remaining ? 'PASS_IN_RUN02' : 'PASS', escapeOutsidePanel: 'PASS', OpenInvalidation: 'PASS', NewInvalidation: 'PASS', meshOptions: ['tessellated', 'planar', 'auto'], meshDocumentUnchanged: true }); await f.snapshot('03-new-clears-preparation');
});
