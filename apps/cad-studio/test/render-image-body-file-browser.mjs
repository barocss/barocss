// D710 / #2419. Real Render body selection, local image inputs and native browser project files.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { imagePixels, installDecodeHold } from './render-image-test-helpers.mjs';

const output = process.argv[2], name = 'D710 Two bodies', nativeName = name + '.bcad', project = 'D710 Render images';
const [checker, holes] = await Promise.all(['checker.png', 'holes.png'].map(name => readFile(new URL('./fixtures/' + name, import.meta.url))));
const png = bytes => 'data:image/png;base64,' + bytes.toString('base64');
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [20, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 5, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [32, 0], max: [44, 9], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 8, id: 'n3' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
  bodies: { b1: { name: 'Target plate' }, b3: { name: 'Sibling plate' } },
};
const pins = [
  'apps/cad-studio/test/render-image-body-file-browser.mjs', 'apps/cad-studio/test/render-image-test-helpers.mjs',
  'apps/cad-studio/test/fixtures/checker.png', 'apps/cad-studio/test/fixtures/holes.png',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/BodyBrowserRows.tsx', 'apps/cad-studio/src/ui/RenderPanel.tsx',
  'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/storage/handleStore.ts',
  'packages/barocss-cad-model/src/engine/render.ts', 'packages/barocss-cad-model/src/engine/container.ts',
];
const f = await createFlow({
  name: 'render-image-body-file', envFrozen: 'D710_SOURCE_FROZEN', output, qualification: 'D710 #2419 per-body images and native save/open',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['Desktop Chrome WebGPU. Synthetic two-body native file and local PNG/JPEG input. Browser project Save writes to OPFS, with no network or browser downloads.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    controls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`)?.disabled),
  }),
  oracleSource: String.raw`
import base64, hashlib, io, json, struct, sys
from pathlib import Path
d = json.load(sys.stdin)
raw = Path(d['file']).read_bytes()
assert hashlib.sha256(raw).hexdigest() == d['nativeSha256']
doc = json.loads(raw)
assert doc['nodes'] == d['source']['nodes'] and doc['outputs'] == d['source']['outputs'] and doc['bodies'] == d['source']['bodies']
render = doc['render']
assert set(render['appearances']) == {'b1'} and 'texture' not in render['defaultAppearance']
texture = render['appearances']['b1']['texture']
environment = render['environment']['map']
assert texture['scale'] == 16 and environment['intensity'] == 4
def decode(asset, mime):
    prefix, encoded = asset['image'].split(',', 1)
    assert prefix == 'data:image/' + mime + ';base64'
    return base64.b64decode(encoded, validate=True)
p = decode(texture, 'png')
assert p[:8] == b'\x89PNG\r\n\x1a\n' and p[12:16] == b'IHDR'
assert struct.unpack('>II', p[16:24]) == (1024, 64)
assert p[25] == 6, 'RGBA PNG retains the alpha channel'
j = decode(environment, 'jpeg')
assert j[:2] == b'\xff\xd8'
stream = io.BytesIO(j[2:])
while True:
    assert stream.read(1) == b'\xff'
    mark = stream.read(1)[0]
    while mark == 0xff:
        mark = stream.read(1)[0]
    size, = struct.unpack('>H', stream.read(2))
    assert size >= 2
    block = stream.read(size - 2)
    if mark in (0xc0, 0xc1, 0xc2):
        assert struct.unpack('>HH', block[1:5]) == (256, 2048)
        break
    assert mark != 0xda, 'missing JPEG frame header'
hashes = [hashlib.sha256(value).hexdigest() for value in [p, j]]
assert hashes == d['images']
print(json.dumps({'status': 'PASS', 'texturePixels': [1024, 64], 'environmentPixels': [2048, 256], 'imageSha256': hashes}))
`,
});

const button = name => f.page.getByRole('button', { name, exact: true });
const mode = name => f.page.locator('.mode').getByRole('button', { name, exact: true });
const render = () => f.page.getByRole('complementary', { name: 'Render', exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const row = name => f.page.locator('.outliner .ol-row').filter({ has: f.page.getByRole('button', { name: new RegExp('^' + name) }) });
const kindTab = { texture: 'Appearance', environment: 'Scene' };
const inputLabel = { texture: 'Texture image', environment: 'Environment image' };
const targetImage = doc => doc.render?.appearances.b1?.texture?.image;
const environmentImage = doc => doc.render?.environment.map?.image;

async function showInput(kind) {
  await render().getByRole('tab', { name: kindTab[kind], exact: true }).click();
  await render().getByLabel(inputLabel[kind], { exact: true }).waitFor({ state: 'attached' });
}
async function select(name) {
  await row(name).getByRole('button', { name: new RegExp('^' + name) }).click();
  await f.page.locator('.outliner .ol-row.sel').filter({ has: f.page.getByRole('button', { name: new RegExp('^' + name) }) }).waitFor();
}
async function chooseImage(kind, name, buffer, ok = true, mimeType = 'image/png') {
  await showInput(kind);
  await render().getByLabel(inputLabel[kind], { exact: true }).setInputFiles({ name, mimeType, buffer });
  await f.page.waitForFunction(([name, ok]) => window.__renderDecodeHold.read(name) === ok, [name, ok]);
}
const release = name => f.page.evaluate(name => window.__renderDecodeHold.release(name), name);
const closed = () => f.page.evaluate(() => window.__renderDecodeHold.closed());
async function waitClosed(name) {
  await f.page.waitForFunction(name => window.__renderDecodeHold.closed().includes(name), name);
}
async function unchanged(before, label) {
  const after = await f.snapshot(label);
  for (const key of ['doc', 'bodies', 'dirty', 'history', 'controls', 'selection', 'notices']) assert.deepEqual(after[key], before[key], key);
}
async function accepted(previous) {
  await f.changed(previous);
  await f.ready();
  const next = await f.doc();
  for (const key of ['nodes', 'outputs', 'bodies']) assert.deepEqual(next[key], source[key]);
  return next;
}
async function readStored() {
  return Buffer.from(await f.page.evaluate(async ({ project, nativeName }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const file = await (await dir.getFileHandle(nativeName)).getFile();
    return [...new Uint8Array(await file.arrayBuffer())];
  }, { project, nativeName }));
}
async function openProject() {
  if (!(await versions().isVisible())) await button('Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}
async function generateImages() {
  return f.page.evaluate(async () => {
    const encode = async (width, height, mime, alpha) => {
      const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d');
      ctx.fillStyle = '#204080'; ctx.fillRect(0, 0, width / 2, height);
      ctx.fillStyle = alpha ? 'rgba(224, 128, 32, .5)' : '#e08020';
      ctx.fillRect(width / 2, 0, width / 2, height);
      const image = await canvas.convertToBlob({ type: mime, quality: 0.95 });
      return [...new Uint8Array(await image.arrayBuffer())];
    };
    return {
      texture: await encode(1280, 80, 'image/png', true),
      environment: await encode(2304, 288, 'image/jpeg', false),
    };
  });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(installDecodeHold, 'D710-');
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };

  f.phase = 'Open two bodies and start a pending texture on the target';
  await f.newPage();
  await f.page.locator('input[aria-label="Model file"]').setInputFiles({ name: nativeName, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  assert.deepEqual((await f.bodies()).bodies.map(body => body.key).sort(), ['b1', 'b3']);
  await openProject();
  await mode('Render').click();
  await select('Target plate');
  await chooseImage('texture', 'D710-old-success.png', checker);
  await select('Sibling plate');
  const sibling = await f.snapshot('sibling-selected-before-stale-success');
  await release('D710-old-success.png');
  await waitClosed('D710-old-success.png');
  await unchanged(sibling, 'sibling-selected-after-stale-success');

  f.phase = 'Switch away and back before a genuine decode failure';
  await select('Target plate');
  await chooseImage('texture', 'D710-old-failure.png', Buffer.from('invalid PNG'), false);
  await select('Sibling plate');
  await select('Target plate');
  const returned = await f.snapshot('target-reselected-before-stale-failure');
  await release('D710-old-failure.png');
  await unchanged(returned, 'target-reselected-after-stale-failure');

  f.phase = 'Delete the texture target before its bitmap is delivered';
  const removedFile = 'D710-target-removed.png';
  await chooseImage('texture', removedFile, checker);
  await f.page.keyboard.press('Delete');
  await f.changed(source);
  await f.ready();
  assert.deepEqual((await f.bodies()).bodies.map(body => body.key), ['b3']);
  const removed = await f.snapshot('target-removed-before-delivery');
  await release(removedFile);
  await waitClosed(removedFile);
  await unchanged(removed, 'target-removed-after-delivery');
  await button('Undo').click();
  await f.same(source);
  await select('Target plate');

  f.phase = 'Accept only the selected target texture and preserve repeat scale on replace';
  await chooseImage('texture', 'D710-small.png', holes);
  await release('D710-small.png');
  const small = await accepted(source);
  assert.deepEqual(Object.keys(small.render.appearances), ['b1']);
  assert.equal(small.render.defaultAppearance.texture, undefined);
  assert.deepEqual(await imagePixels(f.page, targetImage(small)), await imagePixels(f.page, png(holes)));
  const repeat = render().getByRole('spinbutton', { name: 'Texture repeat', exact: true });
  await repeat.fill('16');
  const scaled = await accepted(small);
  assert.equal(scaled.render.appearances.b1.texture.scale, 16);
  const generated = await generateImages();
  await chooseImage('texture', 'D710-large.png', Buffer.from(generated.texture));
  await release('D710-large.png');
  const texture = await accepted(scaled);
  const textureUrl = targetImage(texture), texturePixels = await imagePixels(f.page, textureUrl);
  assert.deepEqual([texturePixels.width, texturePixels.height, texturePixels.transparent], [1024, 64, true]);
  const wantedTexture = structuredClone(scaled);
  wantedTexture.render.appearances.b1.texture.image = textureUrl;
  assert.deepEqual(texture, wantedTexture);
  await f.snapshot('target-texture-accepted');
  await button('Undo').click();
  await f.same(scaled);
  await button('Redo').click();
  await f.same(texture);

  f.phase = 'Replace the environment with a resized JPEG at the same intensity';
  await chooseImage('environment', 'D710-environment.png', checker);
  await release('D710-environment.png');
  const firstEnv = await accepted(texture);
  const intensity = render().getByRole('slider', { name: 'Environment strength', exact: true });
  await intensity.press('End');
  const stronger = await accepted(firstEnv);
  assert.equal(stronger.render.environment.map.intensity, 4);
  await chooseImage('environment', 'D710-large-environment.jpg', Buffer.from(generated.environment), true, 'image/jpeg');
  await release('D710-large-environment.jpg');
  const final = await accepted(stronger), envUrl = environmentImage(final);
  assert.match(envUrl, /^data:image\/jpeg;base64,/);
  const envPixels = await imagePixels(f.page, envUrl);
  assert.deepEqual([envPixels.width, envPixels.height, envPixels.transparent], [2048, 256, false]);
  const wantedEnv = structuredClone(stronger);
  wantedEnv.render.environment.map.image = envUrl;
  assert.deepEqual(final, wantedEnv);
  await f.snapshot('environment-accepted');
  await button('Undo').click();
  await f.same(stronger);
  await button('Redo').click();
  await f.same(final);
  assert.deepEqual((await closed()).sort(), ['D710-environment.png', 'D710-large-environment.jpg', 'D710-large.png', 'D710-old-success.png', 'D710-small.png', removedFile]);

  f.phase = 'Save the accepted native images in a browser project';
  await mode('Model').click();
  await versions().waitFor();
  await button('Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(nativeName, { exact: true }).waitFor();
  await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'detached' });
  const saved = await readStored(), file = join(output, nativeName);
  assert.deepEqual(JSON.parse(saved.toString()), final);
  await writeFile(file, saved, { flag: 'wx' });
  const hashes = [textureUrl, envUrl].map(url => sha256(Buffer.from(url.split(',', 2)[1], 'base64')));
  await f.runOracle({ file, nativeSha256: sha256(saved), source, images: hashes }, 'saved-images');
  await f.snapshot('native-saved');

  f.phase = 'Close, reload and open the native project document';
  const page = f.page, context = f.context;
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await page.reload();
  assert.equal(page.context(), context);
  await page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  await openProject();
  await versions().getByRole('button', { name: 'Open ' + nativeName, exact: true }).click();
  await f.same(final);
  assert.deepEqual(await readStored(), saved);
  await mode('Render').click();
  await select('Target plate');
  await showInput('texture');
  const thumb = () => render().locator('img.texture-thumb');
  await thumb().waitFor();
  assert.deepEqual(await imagePixels(f.page, await thumb().getAttribute('src')), texturePixels);
  await f.snapshot('reopened-target-texture');
  await select('Sibling plate');
  assert.equal(await thumb().count(), 0);
  await showInput('environment');
  await thumb().waitFor();
  assert.deepEqual(await imagePixels(f.page, await thumb().getAttribute('src')), envPixels);
  await f.snapshot('reopened-environment');

  f.phase = 'Open the exact saved native file in a fresh browser context';
  await f.newPage();
  await f.openFile(file, final.nodes.length);
  await f.page.waitForFunction(name => document.querySelector('.doc-tab input')?.value === name, name);
  const fresh = await f.snapshot('fresh-native-open');
  // Native Open can reorder normalized Render object keys.
  assert.deepEqual(fresh.doc, final);
  assert.deepEqual(await readFile(file), saved);
  assert.deepEqual(await imagePixels(f.page, targetImage(fresh.doc)), texturePixels);
  assert.deepEqual(await imagePixels(f.page, environmentImage(fresh.doc)), envPixels);
  f.report.observations.push({ nativeSha256: sha256(saved), nativeBytes: saved.length, target: 'b1', sibling: 'b3', texturePixels, envPixels, imageSha256: hashes });
  assert.deepEqual(f.report.downloads, []);
});
