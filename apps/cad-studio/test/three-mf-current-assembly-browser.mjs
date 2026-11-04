// D523/P0-R03 desktop consumer. Root freezes writers and owns heavy execution and screenshot review.
// node test/three-mf-current-assembly-browser.mjs /ABS/NEW/OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { installD523PlacedReplyScheduler } from './placed-worker-reply-scheduler.mjs';

const output = process.argv[2], expectation = process.argv.find(arg => arg.startsWith('--expect='))?.split('=')[1] ?? 'fixed';
assert.ok(['repro', 'fixed'].includes(expectation)); assert.ok(output && isAbsolute(output));
assert.ok(relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'), 'Artifacts must remain outside this worktree');
await mkdir(output); // Preserve all earlier receipts.
const fixture = join(import.meta.dirname, 'fixtures/instance-pattern.bcad');
const oracleSource = String.raw`import json, sys, zipfile, xml.etree.ElementTree as ET
d=json.load(sys.stdin)
with zipfile.ZipFile(d['file']) as z:
 assert z.testzip() is None
 root=ET.fromstring(z.read('3D/3dmodel.model'))
ns={'c':'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
assert root.get('unit')=='millimeter'
resources=root.find('c:resources',ns)
bases={b.get('id'):b.findall('c:base',ns) for b in resources.findall('c:basematerials',ns)}
objects=resources.findall('c:object',ns)
items=root.findall('c:build/c:item',ns)
assert len(objects)==2 and len(items)==2, (len(objects),len(items))
assert {i.get('objectid') for i in items}=={o.get('id') for o in objects}
for item in items:
 if item.get('transform') is not None:
  assert [float(v) for v in item.get('transform').split()]==[1,0,0,0,1,0,0,0,1,0,0,0]
out=[]
for o in objects:
 vs=[[float(v.get(a)) for a in ('x','y','z')] for v in o.findall('c:mesh/c:vertices/c:vertex',ns)]
 ts=o.findall('c:mesh/c:triangles/c:triangle',ns)
 assert len(vs)==8 and len(ts)==12
 for t in ts:
  assert all(0<=int(t.get(a))<len(vs) for a in ('v1','v2','v3'))
  if t.get('pid') is not None:
   assert t.get('pid') in bases and 0<=int(t.get('p1'))<len(bases[t.get('pid')])
 material=bases[o.get('pid')][int(o.get('pindex'))]
 assert material.get('name') and material.get('displaycolor')
 lo=[min(v[a] for v in vs) for a in range(3)]; hi=[max(v[a] for v in vs) for a in range(3)]
 cube=o.get('name','').startswith('Cube / ')
 if cube:
  assert material.get('name')==d['cubeMaterial'], (dict(material.attrib),d['cubeMaterial'])
  assert material.get('displaycolor').upper() in (d['cubeColor'].upper(),d['cubeColor'].upper()+'FF')
 wantlo=[d['cubeX'],0,0] if cube else [-20,-20,-4]
 wanthi=[d['cubeX']+10,10,d.get('cubeHeight',10)] if cube else [140,40,0]
 assert all(abs(lo[a]-wantlo[a])<1e-6 and abs(hi[a]-wanthi[a])<1e-6 for a in range(3)), (o.get('name'),lo,hi,wantlo,wanthi)
 out.append({'name':o.get('name'),'min':lo,'max':hi,'vertices':len(vs),'triangles':len(ts),'material':dict(material.attrib)})
assert sum(o['name'].startswith('Cube / ') for o in out)==1
print(json.dumps({'status':'PASS','productImports':0,'unit':root.get('unit'),'objects':out,'buildItems':len(items)}))
`;
const f = await createFlow({ name: 'three-mf-current-assembly', envFrozen: 'D523_SOURCE_FROZEN', output, oracleSource,
  qualification: `D523/P0-R03 ${expectation === 'repro' ? 'baseline stale placed mesh reproduction only' : 'pending placed evaluation refusal and current file export'}`,
  initialFiles: ['apps/cad-studio/test/three-mf-current-assembly-browser.mjs', 'apps/cad-studio/test/placed-worker-reply-scheduler.mjs', 'apps/cad-studio/test/fixtures/instance-pattern.bcad'],
  requiredFrozen: ['apps/cad-studio/src/files/useModelExports.ts', 'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts'],
  extraFrozen: ['packages/barocss-cad-model/src/print/export3mf.ts', 'packages/barocss-cad-model/src/print/threemf.ts'],
  snapshotExtra: () => ({ scheduler: window.__d523Placed.snapshot(), instancePanel: document.querySelector('[aria-label="Instance"]')?.textContent ?? null }),
  limits: ['Desktop 1440x900 Chrome only. Root must view screenshots.', 'Real Worker MessageEvent delivery delay only; payloads and product actions are unchanged.',
    'Only one visible Cube placement edit in the existing base-plate fixture.', 'Independent ZIP/XML reader verifies literal fixture bounds, mesh counts, millimeter units and material references; no general geometry certificate.',
    'The fixed-only tail edits Cube extrude Distance 10 to 15, then saves and opens its own accepted file in a fresh context.',
    'Failed/missing source GUI cases are NOT_RUN; those boundaries require controlled tests.'],
});
f.report.expectation = expectation;
const labels = new Set();
const capture = async label => { assert.ok(!labels.has(label)); labels.add(label); return f.snapshot(label); };
const drain = () => f.page.evaluate(() => new Promise(resolve => { const channel = new MessageChannel(); channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); }; channel.port2.postMessage(null); }));

await f.run(async () => {
  await f.newPage(); await f.page.setViewportSize({ width: 1440, height: 900 });
  await f.context.addInitScript(installD523PlacedReplyScheduler); await f.page.reload(); await f.ready();
  const downloads = []; f.page.on('download', download => downloads.push(download));
  let cubeMaterial, cubeColor;
  const exportFile = async (label, cubeX, cubeHeight = 10) => {
    const [download] = await Promise.all([f.page.waitForEvent('download', { timeout: 15000 }), f.page.getByRole('button', { name: 'Export 3MF', exact: true }).click()]);
    assert.match(download.suggestedFilename(), /\.3mf$/);
    const file = join(output, `${label}.3mf`); await download.saveAs(file);
    f.report.files.push({ label, file, sha256: sha256(await readFile(file)), hashPurpose: 'artifact identity only' });
    await f.runOracle({ file, cubeX, cubeMaterial, cubeColor, cubeHeight }, label); return file;
  };
  try {
    f.phase = 'public Open existing assembly fixture; genuine current export';
    await f.openFile(fixture, 2);
    await f.page.locator('.ol.instance').first().click();
    const panel = f.page.getByRole('complementary', { name: 'Instance', exact: true }); await panel.waitFor();
    await capture('00-opened-instance-before-body-wait');
    await f.page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Instance"] .kv')].some(row => row.firstChild?.textContent?.trim() === 'Bodies' && row.querySelector('b')?.textContent?.trim() === '1'));
    // Expected material text and colour come from public controls, without product material/look imports.
    const material = panel.getByLabel('Material', { exact: true });
    const choice = await material.locator('option').nth(1).evaluate(option => ({ value: option.value, label: option.textContent }));
    assert.ok(choice.value && choice.label); cubeMaterial = choice.label;
    await material.selectOption(choice.value);
    const swatch = panel.getByRole('button', { name: /^Colour #[0-9a-f]+$/i }).first();
    const colorLabel = await swatch.getAttribute('aria-label'); cubeColor = colorLabel.match(/#[0-9a-f]+/i)[0];
    if (cubeColor.length === 4) cubeColor = `#${[...cubeColor.slice(1)].map(c => c + c).join('')}`;
    await swatch.click(); await drain(); await f.ready();
    f.report.publicAppearance = { materialValue: choice.value, materialLabel: cubeMaterial, color: cubeColor };
    await capture('01-initial-current-assembly'); await exportFile('01-initial-current', 0); await f.dismissToasts();
    const initial = await f.doc();

    f.phase = 'public Cube X=200 edit; hold original placed Worker result';
    await f.page.evaluate(() => window.__d523Placed.arm());
    const x = panel.getByLabel('Instance X', { exact: true }).first(); await x.fill('200'); await x.press('Enter');
    await f.page.waitForFunction(() => window.__studioDoc.instances[0].position[0] === 200);
    await f.page.waitForFunction(() => { const s = window.__d523Placed.snapshot(); return s.claimed && s.events.some(e => e.kind === 'native-event-held' && e.id === s.claimed.id && e.resultOK === true); }, null, { timeout: 15000 });
    const pending = await capture('02-current-doc-native-reply-held');
    assert.equal(pending.doc.instances[0].position[0], 200); assert.equal(initial.instances[0].position[0], 0);
    assert.equal(pending.scheduler.claimed.place.t[0], 200);
    f.report.acceptedBeforeExport = pending.doc; await f.persist();

    f.phase = 'public Export 3MF with genuine placed reply pending';
    const before = downloads.length;
    if (expectation === 'repro') {
      await exportFile('03-baseline-stale-placement', 0);
      await capture('03-baseline-stale-export');
      f.report.observations.push({ label: 'BASELINE_REPRODUCED_PRODUCT_FAIL', currentDocCubeX: 200, returnedFileCubeX: 0, currentnessContract: 'FAIL' });
    } else {
      await f.page.getByRole('button', { name: 'Export 3MF', exact: true }).click();
      await f.waitToast(/not written|evaluat|up.to.date/i); await drain();
      const refused = await capture('03-pending-export-refused');
      assert.equal(downloads.length, before, 'Pending placed evaluation must not create a 3MF download');
      assert.deepEqual(refused.doc, pending.doc);
    }
    await f.dismissToasts();
    f.phase = 'release original Worker messages FIFO; export current assembly';
    await f.page.evaluate(() => window.__d523Placed.release());
    await f.page.waitForFunction(() => { const s = window.__d523Placed.snapshot(); return s.events.some(event => event.kind === 'client-callback-reached' && event.delivery === 'held-original-event' && event.key === s.claimed?.key && event.id === s.claimed?.id); });
    await drain(); await f.ready();
    // Changed placement's visible result: Instance panel is fed from instanceBodies, not the read-only document hook.
    await f.page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Instance"] .kv')].some(row => row.firstChild?.textContent?.trim() === 'Bodies' && row.querySelector('b')?.textContent?.trim() === '1'));
    await capture('04-released-current-assembly');
    await exportFile('04-current-placement', 200); await capture('05-current-export-complete');
    assert.deepEqual(await f.doc(), pending.doc);
    if (expectation === 'fixed') {
      await f.dismissToasts();
      f.phase = 'public Cube source edit: extrude Distance 10 to 15';
      await panel.getByRole('button', { name: 'Edit part', exact: true }).click();
      const banner = f.page.getByRole('status', { name: 'Editing a part in place', exact: true });
      await banner.waitFor(); await f.page.waitForFunction(() => !window.__studioDoc.instances); await f.ready();
      await capture('06-source-edit-entered');
      await f.openFeatureEditor(1, 'Cube extrude');
      const distance = f.editor().getByLabel('Distance', { exact: true });
      assert.equal(Number(await distance.inputValue()), 10, 'Public source editor must show original literal extrude height');
      await distance.fill('15');
      const beforeSourceApply = await f.doc();
      await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
      await f.changed(beforeSourceApply); await f.closeEditor();
      assert.equal((await f.doc()).nodes[1].height, 15);
      const finishSequence = await f.page.evaluate(() => window.__d523Placed.snapshot().events.length);
      await banner.getByRole('button', { name: 'Finish', exact: true }).click();
      await banner.waitFor({ state: 'hidden' });
      await f.page.waitForFunction(() => window.__studioDoc.instances?.[0]?.doc?.nodes?.[1]?.height === 15);
      await f.page.waitForFunction(since => {
        const events = window.__d523Placed.snapshot().events;
        return events.some(submit => submit.sequence >= since && submit.kind === 'submit' && submit.type === 'placed'
          && events.some(delivery => delivery.kind === 'client-callback-reached' && delivery.key === submit.key && delivery.id === submit.id));
      }, finishSequence, { timeout: 15000 });
      await drain(); await f.ready();
      await f.page.locator('.doc-tab input').press('Tab'); await f.page.keyboard.press('f');
      const sourceEdited = await capture('07-source-edited-current-assembly');
      assert.equal(sourceEdited.doc.instances[0].position[0], 200);
      await exportFile('07-source-edited-current', 200, 15); await f.dismissToasts();

      f.phase = 'public Save own accepted source-edited assembly';
      const saved = await f.save('08-source-edited-assembly');
      assert.deepEqual(saved.doc, sourceEdited.doc);
      await capture('08-own-assembly-saved');

      f.phase = 'fresh context public Open own saved assembly; current export and appearance';
      await f.newPage(); await f.page.setViewportSize({ width: 1440, height: 900 });
      await f.context.addInitScript(installD523PlacedReplyScheduler); await f.page.reload(); await f.ready();
      await f.openFile(saved.file, saved.doc.nodes.length); await f.same(saved.doc);
      await f.page.locator('.ol.instance').first().click();
      await f.page.getByRole('complementary', { name: 'Instance', exact: true }).waitFor();
      await f.page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Instance"] .kv')].some(row => row.firstChild?.textContent?.trim() === 'Bodies' && row.querySelector('b')?.textContent?.trim() === '1'));
      await f.page.locator('.doc-tab input').press('Tab'); await f.page.keyboard.press('f');
      await capture('09-fresh-own-open-current-assembly');
      await exportFile('09-fresh-own-open-current', 200, 15);
      await capture('10-fresh-own-export-complete');
      assert.deepEqual(await f.doc(), saved.doc);
    }
  } finally { await f.page.evaluate(() => window.__d523Placed?.release()); }
});
