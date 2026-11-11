// D720: actual section initialization and handle drag on a thin native slab.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/thin-section-span-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/SectionBar.tsx',
  'apps/cad-studio/src/ui/ViewDisplayControls.tsx',
  'apps/cad-studio/src/viewport/sectionView.ts',
  'apps/cad-studio/src/viewport/useSectionDisplay.ts',
  'apps/cad-studio/src/viewport/useSectionEvaluation.ts',
  ...(baseline ? [] : ['apps/cad-studio/src/viewport/sectionSpan.ts']),
];
const f = await createFlow({
  name: 'thin-section-span', output, envFrozen: 'D720_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce out-of-bounds initialization and drag' : 'Keep thin-model section planes within the current span',
  limits: ['Desktop native rectangular extrusion, public Model section controls and handle drag.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, partBreps } from '@barocss/cad-model/engine/evaluate';
import { brepMassProperties, checkBrep, coedgeVertices } from '@barocss/cad';
import { readFileSync } from 'node:fs';
import { sectionSplits } from './src/viewport/sectionView';

const { name, section } = JSON.parse(process.argv[3]);
if (section) {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const built = evaluateDoc(doc, 1);
  assert.ok(built.ok);
  const exact = sectionSplits(doc,built.bodies,section);
  assert.equal(exact.kept.length,1);
  const part = partBreps(exact.doc).find(body => body.key === exact.kept[0]);
  assert.ok(part);
  const brep = part.brep;
  const check = checkBrep(brep, {strict:true});
  assert.ok(check.valid, JSON.stringify(check.issues));
  const cap = brep.faces.find(face => face.name?.startsWith('n2.cut'));
  assert.ok(cap, 'native split cap');
  const vertices = new Map(brep.vertices.map(vertex => [vertex.id,vertex.point]));
  const coedges = new Map(brep.coedges.map(coedge => [coedge.id,coedge]));
  const edges = new Map(brep.edges.map(edge => [edge.id,edge]));
  const capLoops = brep.loops.filter(loop => cap.loops.includes(loop.id));
  const { normal, offset } = section.planes[0];
  const sum = [0,0,0];
  let planeError = 0;
  for (const loop of capLoops) for (const id of loop.coedges) {
    const [a,b] = coedgeVertices(brep,coedges.get(id),edges).map(vertex => vertices.get(vertex));
    planeError = Math.max(planeError, Math.abs(a[0]*normal[0]+a[1]*normal[1]+a[2]*normal[2]-offset));
    sum[0] += a[1]*b[2]-a[2]*b[1];
    sum[1] += a[2]*b[0]-a[0]*b[2];
    sum[2] += a[0]*b[1]-a[1]*b[0];
  }
  console.log(JSON.stringify({ key:part.key,cap:cap.name,area:Math.hypot(...sum)/2,volume:brepMassProperties(brep,1).volume,planeError }));
  process.exit(0);
}
const z = name === 'thin-z', y = name === 'thin-y';
const plane = z ? { origin:[0,0,0.1], normal:[0,0,1], xAxis:[1,0,0] } : undefined;
const profile = withNode(emptyDoc(), { kind:'sketch',profile:'rectangle',min:[0,y ? 0.1 : 0],max:[20,y ? 0.3 : 12],
  ...(plane ? { plane } : {}) });
const doc = withNode(profile, {kind:'extrude',sketch:0,height:z ? 0.2 : y ? 12 : 8});
const built = evaluateDoc(doc, 1);
assert.ok(built.ok && built.bodies.length === 1, JSON.stringify(built));
console.log(JSON.stringify({doc,bounds:built.bodies[0].mesh.bounds,volume:built.bodies[0].volume}));
`,
});

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance,
  `Expected ${expected} ± ${tolerance}, received ${actual}`);

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    if (!baseline) await context.addInitScript(() => {
      // Hold only the next real Section worker reply. Regular document evaluation stays live.
      const NativeWorker = window.Worker;
      const control = { holding: false, replies: [] };
      window.__d720Replies = control;
      window.Worker = class extends NativeWorker {
        sectionIds = new Set();
        postMessage(request, options) {
          if (request.type === 'section') this.sectionIds.add(request.id);
          return super.postMessage(request, options);
        }
        set onmessage(listener) {
          super.onmessage = listener ? event => {
            const id = event.data?.id;
            if (event.data?.result && this.sectionIds.delete(id) && control.holding) {
              control.replies.push({ id, deliver: () => listener.call(this, event) });
              return;
            }
            listener.call(this, event);
          } : null;
        }
        get onmessage() { return super.onmessage; }
      };
    });
    return context;
  };
  await f.newPage();
  let page = f.page, mouse = page.mouse;
  const button = name => page.getByRole('button', { name, exact: true });
  const section = () => page.evaluate(() => window.__studioSection());
  const exactVolume = (volume, tolerance = 1e-6) => page.waitForFunction(([expected, limit]) => {
    const state = window.__studioSection();
    return state.exact && Math.abs(state.volume - expected) < limit;
  }, [volume, tolerance], { timeout: 20000 }).catch(async () => {
    assert.fail(`Expected displayed exact result ${volume} ± ${tolerance}: ${JSON.stringify(await section())}`);
  });
  const openPath = async (file, doc) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(file);
    await f.same(doc);
  };
  const open = async name => {
    const model = await f.inspect(name, {}, { name });
    const file = join(output, name + '.bcad');
    await writeFile(file, JSON.stringify(model.doc));
    await openPath(file, model.doc);
    if (baseline && name === 'thin-z') {
      assert.equal((await section()).mode, 'plane', 'the parent keeps the old section on Open');
      await f.snapshot('parent-stale-section', () => ({ section: window.__studioSection() }));
      await button('Section view').click();
    }
    assert.equal((await section()).mode, null);
    return model;
  };
  const snap = label => f.snapshot(label, () => ({ section: window.__studioSection() }));
  const selectMode = name => page.locator('[aria-label="Section mode"] button').getByText(name, { exact: true }).click();
  const enter = async () => {
    await button('Section view').click();
    await page.getByRole('radiogroup', { name: 'Section mode', exact: true }).waitFor();
  };
  const drag = async (id, factor) => {
    const line = page.locator(`.vp-overlay [data-handle="${id}"] line:nth-of-type(2)`);
    await line.waitFor({ state: 'attached' });
    const { start, delta } = await line.evaluate(element => {
      const overlay = element.closest('svg').getBoundingClientRect();
      const number = name => Number(element.getAttribute(name));
      const a = [number('x1'), number('y1')], b = [number('x2'), number('y2')];
      return { start: [overlay.left + (a[0] + b[0]) / 2, overlay.top + (a[1] + b[1]) / 2],
        delta: [b[0] - a[0], b[1] - a[1]] };
    });
    assert.ok(Math.hypot(...delta) > 5);
    await mouse.move(...start);
    await mouse.down();
    await mouse.move(start[0] + factor * delta[0], start[1] + factor * delta[1], { steps: 8 });
    const preview = await section();
    await mouse.up();
    return preview;
  };

  f.phase = 'Default Y plane for the thin-Y solid';
  const thinY = await open('thin-y');
  near(thinY.volume, 48);
  await enter();
  if (!baseline) await exactVolume(24);
  const initial = await snap('thin-y-initial');
  assert.deepEqual(initial.section.planes[0].normal, [0, 1, 0]);
  near(initial.section.planes[0].offset, baseline ? 0 : 0.2);
  assert.deepEqual(initial.doc, thinY.doc);

  f.phase = 'Z plane and third cut-out plane for the thin-Z solid';
  const thinZ = await open('thin-z');
  near(thinZ.volume, 48);
  near(thinZ.bounds.min[2], 0.1);
  near(thinZ.bounds.max[2], 0.3);
  await button('Iso').click();
  await page.keyboard.press('f');
  await enter();
  await button('Section across Z').click();
  const z = await snap('thin-z-axis');
  near(z.section.planes[0].offset, baseline ? 0 : 0.2);
  if (!baseline) {
    await exactVolume(24);
    const native = await f.inspect('axis-midpoint-native', thinZ.doc, { section: { mode: 'plane', planes: z.section.planes } });
    near(native.volume, 24);
    near(native.area, 240);
    near(native.planeError, 0);
    f.report.observations.push({ label: 'axis-midpoint-native', ...native });
  }

  await selectMode('Cut-out');
  await button('Add a section plane').click();
  const cutout = await snap('thin-z-cutout');
  assert.equal(cutout.section.planes.length, 3);
  near(Math.abs(cutout.section.planes[2].offset), baseline ? 0 : 0.2);

  f.phase = 'Face-picked interior plane dragged in the actual viewport';
  await selectMode('Plane');
  await button('Section across Z').click();
  await button('Section from a face').click();
  const target = await page.evaluate(() => window.__studioScreenOf([6, 3, 0.3]));
  await mouse.click(...target);
  await page.waitForFunction(() => window.__studioSection().planes?.[0].face === 'n1.top');
  await exactVolume(24);
  const picked = await snap('thin-z-from-face');
  assert.deepEqual(picked.section.planes[0].normal.map(value => value || 0), [0, 0, -1]);
  near(picked.section.planes[0].offset, -0.2);
  assert.equal(picked.section.planes[0].face, 'n1.top');
  const preview = await drag('section', -0.5);
  const released = await snap('thin-z-released');
  if (baseline) near(released.section.planes[0].offset, 0.2);
  else assert.ok(released.section.planes[0].offset > -0.3 && released.section.planes[0].offset < -0.1);
  assert.deepEqual(released.doc, thinZ.doc);
  assert.deepEqual(released.history, picked.history);
  f.report.observations.push({ before: picked.section.planes[0], preview: preview.planes[0], after: released.section.planes[0], bounds: thinZ.bounds });
  if (baseline) return;

  near(released.section.planes[0].offset, -0.12);
  assert.ok(preview.planes[0].offset > -0.3 && preview.planes[0].offset < -0.1);
  await exactVolume(4.8);
  await drag('section', 0.5);
  const reverse = await snap('thin-z-drag-reverse');
  near(reverse.section.planes[0].offset, -0.28);
  await exactVolume(43.2);
  await button('Flip the section').click();
  await exactVolume(4.8);
  const flip = await snap('thin-z-flipped');
  near(flip.section.planes[0].offset, 0.28);
  assert.deepEqual(flip.section.planes[0].normal, [0, 0, 1]);

  f.phase = 'Box, planes and cut-out stay within the original spans';
  await selectMode('Box');
  await exactVolume(16 * 9.6 * 0.16);
  const box = await snap('thin-z-box');
  near(box.section.planes[4].offset, 0.12);
  near(box.section.planes[5].offset, -0.28);
  await drag('section4', 0.25);
  await drag('section5', 0.25);
  const boxAfter = await snap('thin-z-box-dragged');
  near(boxAfter.section.planes[4].offset, 0.12);
  near(boxAfter.section.planes[5].offset, -0.28);
  await selectMode('Planes');
  await exactVolume(12);
  await button('Add a section plane').click();
  await exactVolume(6);
  await snap('thin-z-three-planes');
  await selectMode('Cut-out');
  await exactVolume(36, 1e-5);
  await button('Add a section plane').click();
  await exactVolume(42, 1e-5);
  await snap('thin-z-three-cutout');
  await button('Hatch the cut').click();
  assert.equal((await section()).hatch, null);
  await button('Hatch the cut').click();
  assert.ok((await section()).hatch);

  f.phase = 'General normal handle on the CPU clipping path';
  const scale = Math.sqrt(40001), normal = [0, 1 / scale, 200 / scale];
  await page.evaluate(plane => window.__studioSetSection({ mode: 'plane', planes: [plane] }), { normal, offset: 46 / scale });
  await exactVolume(24);
  const obliqueStart = await snap('oblique-exact-midpoint');
  const obliqueNative = await f.inspect('oblique-midpoint-native', thinZ.doc, { section: { mode: 'plane', planes: obliqueStart.section.planes } });
  near(obliqueNative.volume, 24);
  near(obliqueNative.area, 240 * Math.hypot(1, 1 / 200));
  near(obliqueNative.planeError, 0);
  await page.evaluate(() => window.__studioSectionDebug({ hold: true, cpu: true }));
  await page.waitForFunction(() => !window.__studioSection().gpu);
  const cpuPreview = await drag('section', -0.5);
  assert.equal(cpuPreview.gpu, false);
  const obliqueAfter = await snap('oblique-cpu-drag');
  near(obliqueAfter.section.planes[0].offset, 66.8 / scale);
  const obliqueWanted = obliqueVolume(66.8);
  near(obliqueAfter.section.shownVolume, obliqueWanted.volume, 1e-5);
  await page.evaluate(() => window.__studioSectionDebug({ hold: false, cpu: false }));
  await exactVolume(obliqueWanted.volume);
  const obliqueDragged = await snap('oblique-exact-release');
  const native = await f.inspect('oblique-drag-native', thinZ.doc, { section: { mode: 'plane', planes: obliqueDragged.section.planes } });
  near(native.volume, obliqueWanted.volume);
  near(native.area, obliqueWanted.area);
  near(native.planeError, 0);
  await button('Flip the section').click();
  await exactVolume(48 - obliqueWanted.volume);
  const obliqueFlip = await snap('oblique-flipped');
  near(obliqueFlip.section.planes[0].offset, -66.8 / scale);
  f.report.observations.push({ label: 'oblique-native', midpoint: obliqueNative, released: native, analytic: obliqueWanted });
  assert.deepEqual(obliqueFlip.doc, thinZ.doc);
  assert.deepEqual(obliqueFlip.history, picked.history);
  assert.equal(await page.locator('[aria-label="Unsaved changes"]').count(), 0);

  f.phase = 'Open a different part while an exact section reply is pending';
  await page.evaluate(() => { window.__d720Replies.holding = true; });
  await button('Section across Y').click();
  await page.waitForFunction(() => window.__d720Replies.replies.length === 1);
  const regular = await open('regular');
  const delivered = await page.evaluate(() => {
    const held = window.__d720Replies;
    held.holding = false;
    return held.replies.splice(0).map(reply => { reply.deliver(); return reply.id; });
  });
  assert.equal(delivered.length, 1);
  const afterLate = await snap('late-reply-after-open');
  assert.equal(afterLate.section.mode, null);
  assert.equal(afterLate.section.exact, false);
  assert.deepEqual(afterLate.doc, regular.doc);
  await enter();
  await exactVolume(960);
  await button('Section across X').click();
  await exactVolume(960);
  await drag('section', 0.3);
  const regularDrag = await snap('regular-snap');
  assert.equal(regularDrag.section.planes[0].offset * 2 % 1, 0);
  await button('Section view').click();
  assert.equal((await section()).mode, null);
  const clean = await snap('regular-cancelled');
  assert.deepEqual(clean.doc, regular.doc);

  f.phase = 'Save the native part and reopen with no active section';
  await enter();
  await exactVolume(960);
  const project = 'D720 Section span';
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText('regular.bcad', { exact: true }).waitFor();
  const bytes = Buffer.from(await page.evaluate(async projectName => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    return [...new Uint8Array(await (await (await dir.getFileHandle('regular.bcad')).getFile()).arrayBuffer())];
  }, project));
  assert.deepEqual(JSON.parse(bytes.toString()), regular.doc);
  const saved = join(output, 'studio-saved.bcad');
  await writeFile(saved, bytes);
  f.report.observations.push({ heldSectionReply: delivered[0], nativeSha256: createHash('sha256').update(bytes).digest('hex') });

  await f.newPage();
  page = f.page;
  mouse = page.mouse;
  await openPath(saved, regular.doc);
  assert.equal((await section()).mode, null);
  const reopened = await snap('fresh-native-open');
  near(reopened.bodies.bodies[0].volume, 1920);
  await enter();
  await exactVolume(960);
  await button('New part').click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0 && window.__studioSection().mode === null);
  await button('Section view').click();
  await page.getByRole('status').filter({ hasText: 'No interior section position is available for these bounds.' }).waitFor();
  const invalid = await snap('empty-part-section-refused');
  assert.equal(invalid.section.mode, null);
  await f.undo();
  await f.same(regular.doc);
  assert.equal((await section()).mode, null);
});

function obliqueVolume(c) {
  const clamp = value => Math.min(12, Math.max(0, value));
  const a = clamp(c - 60), b = clamp(c - 20);
  const area = 20 * (b - a) * Math.hypot(1, 1 / 200);
  const volume = 20 * (0.3 * (b - a) - (c * (b - a) - (b * b - a * a) / 2) / 200 + 0.2 * (12 - b));
  return { area, volume };
}
