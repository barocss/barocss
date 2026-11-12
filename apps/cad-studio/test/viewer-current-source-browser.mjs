// D771/B10-02 and D773/B10-04: native Viewer revision, viewport and resource ownership.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { createFlow, sha256 } from './flow-helper.mjs';

const mode = process.argv[3] ?? 'source-replacement';
assert.ok(['source-replacement', 'resize-lifetime'].includes(mode));
const resizeLifetime = mode === 'resize-lifetime';
const repo = resolve(import.meta.dirname, '../../..');
const viewerEntry = await build({
  stdin: {
    contents: "export { createViewer } from './barocss-viewer/src/index.ts';\nexport { parseBaroCadDocument } from './barocss-cad-interop/src/document.ts';",
    resolveDir: join(repo, 'packages'),
  },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, metafile: true,
});
const browserPins = Object.keys(viewerEntry.metafile.inputs).filter(file => file !== '<stdin>').map(file => resolve(file));
const sources = [10, 20].map(x => `@model replacement { version:0; length-unit:mm;
  @surface #panel { type:nurbs; degree-u:1; degree-v:1;
    knots-u:[0,0,1,1]; knots-v:[0,0,1,1];
    control-points:[[[-${x},-8,0],[-${x},8,0]],[[${x},-8,0],[${x},8,0]]]; weights:[[1,1],[1,1]]; }
}`);
const docs = sources.map((source, i) => {
  const revision = i + 1;
  return {
    schema: 'barocss-cad-document', version: 1, documentId: 'replacement_doc', revision,
    profile: 'direct-geometry', nativeFrame: 'authored-xyz-no-axis-conversion', units: { length: 'mm', angle: 'rad' },
    assets: [{ id: 'replacement_asset', revision, role: 'authored-native-source', sourceVersion: 0,
      sourceFrame: 'authored-xyz-no-axis-conversion', source }],
    bodies: [{ id: 'replacement_body', name: 'Panel', kind: 'direct-geometry-object', assetId: 'replacement_asset', geometryId: 'panel' }],
    parameters: [], features: [], constraints: [], placements: [], derivedCaches: [],
  };
});
const f = await createFlow({
  name: 'viewer-current-source', envFrozen: resizeLifetime ? 'D773_SOURCE_FROZEN' : 'D771_SOURCE_FROZEN', output: process.argv[2],
  qualification: resizeLifetime ? 'B10-04 Viewer resize, replacement, clear and disposal' :
    'B10-02 same native Viewer IDs, exact source and revision, changed pixels and current pick',
  extraFrozen: browserPins,
  initialFiles: ['apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/handover/roadmap-tracks/17-b10-evidence-ledger.md'],
  requiredFrozen: ['packages/barocss-viewer/src/index.ts', 'packages/barocss-cad-interop/src/document.ts'],
  limits: ['One planar authored surface and two exact revisions. Fixed Viewer camera. Studio Open uses the same source bytes.'],
  oracleSource: String.raw`
import json, math, sys
x = json.load(sys.stdin)
width = x["halfWidth"]
assert x["bounds"] == {"min":[-width,-8,0],"max":[width,8,0]}
assert math.isclose(x["nativeWidth"], 2*width, abs_tol=1e-9)
side = x["sidePick"]
expected = (2*205/320-1) * 100 * math.tan(math.pi/8) * 320/240
assert 10 < expected < 20
if width == 10:
    assert side is None
else:
    assert all(abs(a-b) < 1e-7 for a,b in zip(side, [expected,0,0], strict=True))
print(json.dumps({"status":"PASS","width":2*width,"sidePickX":None if side is None else side[0]}))
`,
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const html = '<!doctype html><meta charset="utf-8"><style>body{margin:0}canvas{display:block}</style><canvas width="320" height="240"></canvas>';
  const viewerPath = '/__d771-viewer.js', htmlPath = '/__d771-viewer.html';
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      if (url.origin !== origin) return route.abort();
      if (url.pathname === viewerPath) return route.fulfill({ contentType: 'text/javascript', body: viewerEntry.outputFiles[0].text });
      if (url.pathname === htmlPath) return route.fulfill({ contentType: 'text/html', body: html });
      return route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = await f.context.newPage();
  page.on('pageerror', error => f.report.errors.push(error.stack ?? String(error)));
  page.on('console', message => { if (message.type() === 'error') f.report.consoleErrors.push(message.text()); });
  const selections = [];
  const resources = [];
  try {
    f.phase = 'initialize a real WebGPU Viewer with its public API';
    await page.goto(origin + htmlPath);
    await page.evaluate(async path => {
      const { createViewer, parseBaroCadDocument } = await import(path);
      const canvas = document.querySelector('canvas');
      const viewer = await createViewer(canvas, { mmToSceneUnit: 1, background: [0.035, 0.055, 0.09] });
      window.d771 = { viewer, parseBaroCadDocument };
    }, viewerPath);
    for (const doc of docs) {
      f.phase = 'public Viewer load of document revision ' + doc.revision;
      const read = await page.evaluate(async doc => {
        const { viewer, parseBaroCadDocument } = window.d771;
        const options = { native: { sourceVersion: 0, countU: 4, countV: 4, unitsPerMillimeter: 1 }, basis: 'authored-xyz-matches-rhyup' };
        viewer.loadDocument(parseBaroCadDocument(JSON.stringify(doc)), options);
        viewer.setView({ eye: [0,0,100], target: [0,0,0], up: [0,1,0], fovY: 45, near: 0.1, far: 500 });
        const state = viewer.getState();
        const base = await viewer.readPixels();
        const centre = viewer.pick(160, 120), side = viewer.pick(205, 120);
        const ref = state.surfaces[0];
        const native = viewer.measureNativeSurfacePoints({ ...ref, u: 0, v: 0.5 }, { ...ref, u: 1, v: 0.5 });
        viewer.select((side ?? centre).ref);
        const selected = await viewer.readPixels();
        const pixel = (frame, x, y) => Array.from(frame.slice(4*(320*y + x), 4*(320*y + x) + 4));
        const png = async frame => {
          const c = document.createElement('canvas');
          c.width = 320; c.height = 240;
          c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame), 320, 240), 0, 0);
          const blob = await new Promise(done => c.toBlob(done, 'image/png'));
          return Array.from(new Uint8Array(await blob.arrayBuffer()));
        };
        return {
          state: { status: state.status, document: state.document.document, selected: state.selected,
            bindings: state.documentBodies, bounds: state.packets[0].packet.bounds },
          centre, side, ref, native, selectedRef: viewer.getState().selected, bytes: base.length,
          baseSide: pixel(base, 205, 120), selectedSide: pixel(selected, 205, 120),
          baseCentre: pixel(base, 160, 120), selectedCentre: pixel(selected, 160, 120), background: pixel(base, 10, 10),
          base: await png(base), selected: await png(selected),
        };
      }, doc);
      assert.equal(read.state.status, 'ready');
      assert.deepEqual(read.state.document, doc);
      assert.equal(read.state.selected, null);
      assert.equal(read.bytes, 320 * 240 * 4);
      assert.equal(read.state.bindings.length, 1);
      const [binding] = read.state.bindings;
      assert.equal(binding.binding.documentRevision, doc.revision);
      assert.equal(binding.binding.assetRevision, doc.revision);
      assert.equal(binding.binding.bodyId, 'replacement_body');
      assert.equal(binding.binding.geometryId, 'panel');
      assert.deepEqual(read.centre.ref, read.ref);
      assert.deepEqual(read.selectedRef, read.ref);
      assert.notDeepEqual(read.baseCentre, read.selectedCentre);
      if (doc.revision === 1) {
        assert.equal(read.side, null);
        assert.deepEqual(read.baseSide, read.background);
      } else {
        assert.deepEqual(read.side.ref, read.ref);
        assert.notDeepEqual(read.baseSide, read.background);
        assert.notDeepEqual(read.baseSide, read.selectedSide);
      }
      const label = 'viewer-revision-' + doc.revision;
      const base = Uint8Array.from(read.base), selected = Uint8Array.from(read.selected);
      await writeFile(join(f.output, label + '-base.png'), base);
      await writeFile(join(f.output, label + '-selected.png'), selected);
      if (resizeLifetime) {
        const resize = await page.evaluate(async () => {
          const { viewer } = window.d771;
          const core = viewer.presenter.core;
          const retained = () => ({
            active: core.meshList.length, retained: core.geometries.size,
            resident: [...core.geometries].filter(geometry => geometry.gpu !== null).length,
          });
          const frames = [];
          for (const [width, height] of [[320,240], [480,360], [320,240]]) {
            viewer.resize(width, height);
            const pixels = await viewer.readPixels();
            const at = 4*(height/2*width + width/2);
            frames.push({
              width, height, length: pixels.length, centre: Array.from(pixels.slice(at, at+4)),
              selected: viewer.getState().selected,
              pick: viewer.pick(width/2, height/2),
              resources: retained(),
            });
          }
          return frames;
        });
        for (const frame of resize) {
          assert.equal(frame.length, 4 * frame.width * frame.height);
          assert.deepEqual(frame.centre, read.selectedCentre);
          assert.deepEqual(frame.selected, read.ref);
          assert.deepEqual(frame.pick, read.centre);
          assert.deepEqual(frame.resources, { active: 1, retained: 1, resident: 1 });
        }
        resources.push({ revision: doc.revision, frames: resize });
      }
      const { base: ignoredBase, selected: ignoredSelected, ...receipt } = read;
      selections.push({ ...receipt, baseSHA256: sha256(base), selectedSHA256: sha256(selected), sourceSHA256: sha256(doc.assets[0].source) });
      await f.runOracle({ halfWidth: doc.revision * 10, bounds: read.state.bounds,
        nativeWidth: read.native.distanceMM, sidePick: read.side?.positionScene ?? null }, label);
    }
    assert.deepEqual(selections[1].ref, selections[0].ref);
    assert.notEqual(selections[1].baseSHA256, selections[0].baseSHA256);
    f.report.observations.push(...selections);
    if (resizeLifetime) {
      f.phase = 'clear and dispose the current Viewer';
      const result = await page.evaluate(async () => {
        const { viewer } = window.d771;
        const core = viewer.presenter.core;
        viewer.clear();
        const pixels = await viewer.readPixels();
        const empty = { status: viewer.getState().status, selection: viewer.getState().selected,
          hit: viewer.pick(160,120), retained: core.geometries.size, active: core.meshList.length,
          uniform: pixels.every((value, i) => value === pixels[i%4]) };
        viewer.dispose();
        let refused = false;
        try { await viewer.readPixels(); } catch (error) { refused = /disposed/i.test(String(error)); }
        return { empty, disposed: { status: viewer.getState().status, retained: core.geometries.size,
          active: core.meshList.length, refused } };
      });
      assert.deepEqual(result.empty, { status: 'empty', selection: null, hit: null, retained: 0, active: 0, uniform: true });
      assert.deepEqual(result.disposed, { status: 'disposed', retained: 0, active: 0, refused: true });
      f.report.observations.push({ resources, ...result });
    }
  } finally {
    await page.evaluate(() => window.d771?.viewer.dispose());
    await page.close();
  }

  for (const [i, source] of sources.entries()) {
    f.phase = 'public Studio Open of the same authored source, revision ' + (i + 1);
    await f.page.getByRole('button', { name: 'New part', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0 && !window.__studioDoc.direct);
    await f.page.setInputFiles('input[aria-label="Model file"]', {
      name: 'panel-' + (i + 1) + '.barocad', mimeType: 'text/plain', buffer: Buffer.from(source),
    });
    await f.page.waitForFunction(text => {
      const direct = window.__studioDoc?.direct;
      return direct?.objects.length === 1 && direct.sources[direct.objects[0].source] === text;
    }, source);
    await f.ready();
    const object = (await f.doc()).direct.objects[0];
    await f.page.locator('.views').getByRole('button', { name: 'Top', exact: true }).click();
    await f.page.keyboard.press('f');
    await f.page.waitForFunction(id => window.__studioDirectAt?.([0,0,0]) === id, object.id);
    const selected = f.page.locator('.ol.direct.sel');
    await f.page.keyboard.press('Escape');
    await selected.waitFor({ state: 'hidden' });
    const point = await f.page.evaluate(() => window.__studioScreenOf([0,0,0]));
    assert.ok(point?.length === 2);
    await f.page.mouse.click(...point);
    await selected.waitFor();
    const side = await f.page.evaluate(() => window.__studioDirectAt([15,0,0]) ?? null);
    assert.equal(side, i === 0 ? null : object.id);
    const studio = await f.snapshot('studio-revision-' + (i + 1));
    assert.equal(studio.doc.direct.sources[object.source], source);
    if (resizeLifetime) {
      const viewport = f.page.locator('.viewport[data-renderer="webgpu"] canvas');
      const sizeBefore = await viewport.evaluate(canvas => [canvas.width, canvas.height]);
      await f.page.setViewportSize({ width: 1200, height: 900 });
      await f.page.waitForFunction(([width, height]) => {
        const canvas = document.querySelector('.viewport[data-renderer="webgpu"] canvas');
        return canvas && canvas.width !== width && canvas.height !== height;
      }, sizeBefore);
      const sizeAfter = await viewport.evaluate(canvas => [canvas.width, canvas.height]);
      assert.ok(sizeBefore.every((value, index) => sizeAfter[index] < value));
      await f.page.keyboard.press('Escape');
      await selected.waitFor({ state: 'hidden' });
      const resizedPoint = await f.page.evaluate(() => window.__studioScreenOf([0,0,0]));
      await f.page.mouse.click(...resizedPoint);
      await selected.waitFor();
      const resized = await f.snapshot('studio-resized-revision-' + (i + 1));
      assert.deepEqual(resized.doc, studio.doc);
      assert.deepEqual(resized.history, studio.history);
      f.report.observations.push({ revision: i + 1, studioCanvasBefore: sizeBefore, studioCanvasAfter: sizeAfter });
      await f.page.setViewportSize({ width: 1440, height: 1000 });
      await f.page.waitForFunction(([width, height]) => {
        const canvas = document.querySelector('.viewport[data-renderer="webgpu"] canvas');
        return canvas?.width === width && canvas?.height === height;
      }, sizeBefore);
    }
  }
  assert.deepEqual(f.report.downloads, []);
});
