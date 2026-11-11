// D740: actual X/Y pattern Count admission and independent native quarter-turn checks.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/circular-pattern-count-browser.mjs',
  'apps/cad-studio/src/ui/Hud.tsx',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/commands.ts',
];
const f = await createFlow({
  name: 'circular-pattern-count', output, envFrozen: 'D740_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce silent quarter-turn Count clamping' : 'Refuse unsupported X/Y Count before pattern preview or Apply',
  limits: ['Actual desktop HUD, unchanged real Worker preview, and straight disjoint prismatic copies.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { partBreps, evaluateDoc } from '@barocss/cad-model/engine/evaluate';
const { doc } = JSON.parse(process.argv[3]);
const evaluated = evaluateDoc(doc, 1);
assert.ok(evaluated.ok, JSON.stringify(evaluated));
console.log(JSON.stringify(partBreps(doc).map(({ key, brep }) => ({
  key, brep, volume: evaluated.bodies.find(body => body.key === key)?.volume,
}))));
`,
  oracleSource: String.raw`
import itertools, json, math, sys
d = json.load(sys.stdin)
original = set(itertools.product([10,14], [20,26], [0,8]))
def rotate(v):
    x,y,z = v
    return (x,-z,y) if d['axis']=='x' else (z,y,-x)
expected = [original]
for k in range(1,d['count']):
    expected.append({rotate(v) for v in expected[-1]})
assert len(set.union(*expected)) == 8*d['count']
def points(vertices):
    result = set()
    for vertex in vertices:
        point = vertex['point']
        nearest = tuple(round(x) for x in point)
        assert all(math.isclose(a,b,abs_tol=1e-9,rel_tol=0) for a,b in zip(point,nearest)),point
        result.add(nearest)
    return result
def pieces(brep):
    for body in brep['bodies']:
        assert body['kind']=='solid',body
        shells = [s for s in brep['shells'] if s['body']==body['id']]
        assert len(shells)==1 and shells[0]['closed']
        face_ids = set(shells[0]['faces'])
        loops = {i for f in brep['faces'] if f['id'] in face_ids for i in f['loops']}
        coedges = {i for l in brep['loops'] if l['id'] in loops for i in l['coedges']}
        edges = {c['edge'] for c in brep['coedges'] if c['id'] in coedges}
        vertices = {v for e in brep['edges'] if e['id'] in edges for v in e['vertices']}
        corners = points(v for v in brep['vertices'] if v['id'] in vertices)
        assert len(corners)==8,corners
        yield frozenset(corners)
bodies = d['outputs']
if d['mode']=='one':
    body, = bodies
    assert len(body['brep']['bodies'])==d['count'],body
    assert math.isclose(body['volume'],192*d['count'],abs_tol=1e-7,rel_tol=0),body
else:
    assert len(bodies)==d['count'] and len({b['key'] for b in bodies})==d['count'],bodies
    assert all(len(b['brep']['bodies'])==1 and math.isclose(b['volume'],192,abs_tol=1e-7,rel_tol=0) for b in bodies),bodies
assert {p for b in bodies for p in pieces(b['brep'])}=={frozenset(p) for p in expected},bodies
print(json.dumps({'status':'PASS','count':d['count'],'volume':192*d['count'],'corners':8*d['count']}))
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const element = document.querySelector(`button[aria-label="${name}"]`);
      return [element.disabled, element.getAttribute('data-tip')];
    }),
  }),
});

const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [10, 20], max: [14, 26], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
  ], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const sourceBytes = Buffer.from(JSON.stringify(source));
function holdPreview() {
  const proto = Worker.prototype, post = proto.postMessage, handler = Object.getOwnPropertyDescriptor(proto, 'onmessage');
  let armed = false, target, pending, deliver;
  proto.postMessage = function (request, ...rest) {
    if (armed && request.type === 'preview') {
      armed = false;
      target = { worker: this, id: request.id, revision: request.revision };
    }
    return Reflect.apply(post, this, [request, ...rest]);
  };
  Object.defineProperty(proto, 'onmessage', {
    configurable: true, get: handler.get,
    set(callback) {
      handler.set.call(this, callback && function (event) {
        if (target?.worker === this && target.id === event.data?.id && event.data.result) {
          pending = { id: target.id, revision: target.revision, ok: event.data.result.ok };
          deliver = () => callback.call(this, event);
          target = null;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d740Hold = { arm() { armed = true; }, read: () => pending, release() { deliver(); deliver = null; } };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.addInitScript(holdPreview);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const button = name => f.page.getByRole('button', { name, exact: true });
  const hud = () => f.page.getByRole('dialog', { name: 'Circular pattern', exact: true });
  const field = name => hud().getByLabel(name, { exact: true });
  const state = value => f.page.waitForFunction(value => document.querySelector('.hud .status')?.textContent === value, value);
  const apply = () => hud().getByRole('button', { name: 'Apply', exact: true });
  const select = async () => {
    await button('Top').click();
    await f.frame([[10, 20], [14, 26]]);
    const point = await f.page.evaluate(() => window.__studioScreenOf([12, 23, 8]));
    await f.page.mouse.click(...point);
    await f.page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
  };
  const begin = async () => {
    await f.newPage();
    const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: 'quarter-turn-source.bcad', mimeType: 'application/json', buffer: sourceBytes });
    await f.same(source);
    await select();
    await clickModelCommand(f.page, 'Pattern', 'Circular pattern');
    await state('preview');
  };
  const physical = async (label, doc, axis, mode) => {
    const outputs = await f.inspect(label, {}, { doc });
    return f.runOracle({ outputs, axis, mode, count: 4 }, label);
  };
  const checkUnchanged = (after, before) => {
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(after[key], before[key], key);
  };
  const commit = async (label, axis, result) => {
    await state('preview');
    await apply().click();
    await f.changed(source);
    await hud().waitFor({ state: 'hidden' });
    const after = await f.snapshot(label);
    if (result === 'one') {
      assert.equal(after.doc.nodes[2].axis, axis);
      assert.equal(after.doc.nodes[2].angle, 90);
      assert.equal(after.doc.nodes[2].count, 4);
    } else assert.deepEqual(after.doc.nodes.filter(node => node.kind === 'rotate').map(node => [node.axis, node.angle]), [[axis,90],[axis,180],[axis,270]]);
    await physical(label, after.doc, axis, result);
    return after.doc;
  };
  const saveReopen = async (doc, axis, result) => {
    const project = 'D740 quarter-turn ' + axis, name = 'quarter-turn-' + axis + '.bcad';
    await f.page.locator('.doc-tab input').fill(name.slice(0, -5));
    const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
    const attach = async () => {
      if (!(await versions().isVisible())) await button('Project and versions').click();
      await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
      await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
      await versions().getByLabel('Project', { exact: true }).waitFor();
    };
    await attach();
    await button('Save').click();
    await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
    await f.page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'hidden' });
    const saved = await f.page.evaluate(async ([project, name]) => {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
      return (await (await dir.getFileHandle(name)).getFile()).text();
    }, [project, name]);
    assert.deepEqual(JSON.parse(saved), doc);
    await versions().getByRole('button', { name: 'Close project', exact: true }).click();
    await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
    await f.page.reload();
    await f.ready();
    await attach();
    await versions().getByRole('button', { name: 'Open ' + name, exact: true }).click();
    await f.same(doc);
    await f.snapshot('reopened-' + axis);
    await physical('reopened-' + axis, doc, axis, result);
    f.report.files.push({ name, sha256: sha256(saved) });
  };

  if (baseline) {
    for (const [axis, result] of [['x','one'],['y','separate']]) {
      f.phase = 'Reproduce a clamped count in ' + result;
      await begin();
      await field('Count').fill('9');
      await field('Axis').selectOption(axis);
      await field('Result').selectOption(result);
      await state('preview');
      assert.equal(await field('Count').inputValue(), '9');
      await commit('parent-' + axis + '-' + result, axis, result);
    }
    return;
  }

  f.phase = 'Discard a queued Apply after an invalid axis and result change';
  await begin();
  const before = await f.snapshot('accepted-before-switch');
  await f.page.evaluate(() => window.__d740Hold.arm());
  await field('Count').fill('9');
  await f.page.waitForFunction(() => window.__d740Hold.read());
  const reply = await f.page.evaluate(() => window.__d740Hold.read());
  assert.equal(reply.ok, true);
  await state('evaluating…');
  await field('Count').press('Enter');
  await field('Axis').selectOption('x');
  assert.equal(await field('Count').inputValue(), '9');
  assert.equal(await field('Count').getAttribute('max'), '4');
  await field('Result').selectOption('separate');
  await field('Axis').selectOption('y');
  await f.page.evaluate(() => window.__d740Hold.release());
  await state('refused');
  assert.match(await hud().locator('.hud-error').innerText(), /90°.*2.*4|2.*4.*90°/s);
  assert.equal(await apply().isDisabled(), true);
  await field('Count').press('Enter');
  await f.same(source);
  checkUnchanged(await f.snapshot('invalid-xy-after-queued-apply'), before);
  assert.equal(await field('Count').inputValue(), '9');
  await field('Axis').selectOption('z');
  await state('preview');
  assert.equal(await field('Count').inputValue(), '9');
  assert.equal(await field('Count').getAttribute('max'), '36');
  for (const axis of ['x', 'y']) {
    await field('Axis').selectOption(axis);
    await state('refused');
    assert.equal(await field('Count').inputValue(), '9');
    assert.equal(await field('Count').getAttribute('max'), '4');
    assert.equal(await apply().isDisabled(), true);
    checkUnchanged(await f.snapshot('refused-' + axis + '-nine'), before);
    await field('Axis').selectOption('z');
    await state('preview');
  }
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click();
  await f.same(source);
  assert.equal(await hud().isVisible(), false);
  f.report.observations.push({ refusedWithoutCommit: true, heldPreview: reply });

  for (const [axis, result] of [['x','one'],['y','separate']]) {
    f.phase = 'Verify supported 90-degree copies for ' + axis + ' ' + result;
    await begin();
    await field('Axis').selectOption(axis);
    await field('Result').selectOption(result);
    await field('Count').fill('4');
    await state('preview');
    await field('Count').fill('5');
    await state('refused');
    assert.equal(await field('Count').inputValue(), '5');
    await field('Count').fill('4');
    await state('preview');
    await field('Count').fill('2.5');
    await state('refused');
    await field('Count').fill('4');
    await state('preview');
    await field('Axis').selectOption('z');
    await state('preview');
    assert.equal(await field('Count').inputValue(), '4');
    await field('Axis').selectOption(axis);
    const doc = await commit('supported-' + axis + '-' + result, axis, result);
    await f.undo();
    await f.same(source);
    await f.redo();
    await f.same(doc);
    await saveReopen(doc, axis, result);
  }
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ sourceSHA256: sha256(sourceBytes) });
});
