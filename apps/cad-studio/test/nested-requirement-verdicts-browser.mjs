import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/ui/NestedRequirementReadout.tsx',
  'packages/barocss-cad-model/src/chat/requirementEvidence.ts', 'packages/barocss-cad-model/src/team/requirementScope.ts',
  'packages/barocss-cad-model/src/team/freshness.ts', 'packages/barocss-cad-model/src/assembly/looks.ts',
];
const oracleSource = String.raw`
import json, math, sys
data = json.load(sys.stdin)
for name, height in [('initialLeft', 4), ('initialRight', 7), ('otherLeft', 6), ('reopenedLeft', 6), ('reopenedRight', 7)]:
    scope = data[name]
    assert scope['HEIGHT']['value'] == height
    assert scope['HEIGHT']['verdict'] == ('Pass' if height <= 5 else 'Fail')
    # 20 x 10 mm section, steel density 0.00785 g/mm³, and no placed rotation in this check.
    assert math.isclose(scope['MASS']['value'], 20 * 10 * height * 0.00785, rel_tol=0, abs_tol=1e-8)
    assert scope['MASS']['verdict'] == 'Pass'
print(json.dumps({'status':'PASS','states':5,'massToleranceGrams':1e-8}))
`;
const f = await createFlow({
  name: 'nested-requirement-verdicts', envFrozen: 'D605_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins, oracleSource,
  qualification: 'Current read-only local requirement verdicts in the Studio nested inspector',
  limits: ['Two reused nested leaf IDs, same-path document replacement, ordinary project Save and fresh Open. Real Worker evaluations with delayed delivery to the inspector after transport decoding.'],
});

const empty = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 };
const requirement = (id, source, fn, value, unit, args = {}) => ({
  id, source, basis: 'stated', hard: true, check: { query: { fn, ...args }, op: '<=', value, unit },
});
const leafRequirements = [
  requirement('HEIGHT', 'Plate height maximum 5 mm', 'bbox', 5, 'mm', { axis: 'z' }),
  requirement('MASS', 'Plate mass maximum 20 g', 'mass', 20, 'g'),
];
const plate = (height, w = 20, d = 10) => ({
  ...empty, nextId: 2, nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] },
    { id: 'n1', kind: 'extrude', sketch: 0, height },
  ], outputs: { b1: { node: 1, side: 'solid' } },
});
const instance = (id, name, doc, position, looks) => ({ id, name, doc, position, rotation: [0, 0, 0], ...(looks ? { looks } : {}) });
const host = (height, material) => ({ ...empty, instances: [
  instance('p1', 'Leaf plate', { ...plate(height), requirements: leafRequirements }, [0, 0, 0], { b1: { material } }),
] });
const root = leftHeight => ({
  ...plate({ parameter: 'H' }, 6, 6), parameters: { H: 2 },
  requirements: [requirement('HEIGHT', 'Root datum height maximum 2 mm', 'bbox', 2, 'mm', { axis: 'z' })],
  instances: [
    instance('p1', 'Left module', host(leftHeight, 'al6061'), [30, 0, 8], { 'p1/b1': { material: 'steel' } }),
    instance('p2', 'Right module', host(7, 'steel'), [60, 0, 15]),
  ],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const card = () => f.page.getByRole('complementary', { name: 'Nested part', exact: true });
const local = () => card().getByRole('region', { name: 'Local requirements', exact: true });
const rootHeight = () => f.page.getByRole('listitem', { name: 'Requirement HEIGHT', exact: true });
const paths = ['p1/p1', 'p2/p1'], names = ['Left module', 'Right module'];

async function select(i) {
  const leaf = f.page.locator(`.ol.instance.nested[data-path="${paths[i]}"]`);
  if (!(await leaf.isVisible())) await button('Show the parts of ' + names[i]).click();
  await leaf.click();
  await card().getByTestId('nested-path').getByText(paths[i], { exact: true }).waitFor();
}

async function shown(height, verdict) {
  const row = local().getByLabel('Local requirement HEIGHT', { exact: true });
  await row.getByText(verdict, { exact: false }).waitFor();
  const result = {};
  for (const [id, unit] of [['HEIGHT', 'mm'], ['MASS', 'g']]) {
    const text = await local().getByLabel('Local requirement ' + id, { exact: true }).innerText();
    const [, state] = text.match(new RegExp(`^[✓✗?]${id} · (Pass|Fail|Unknown)`, 'm')) ?? [];
    const [, value] = text.match(new RegExp(`^(-?[0-9.]+) ${unit} \\(want `, 'm')) ?? [];
    assert.ok(state && value, text);
    result[id] = { value: Number(value), verdict: state };
  }
  assert.deepEqual(result.HEIGHT, { value: height, verdict });
  return result;
}

async function installHold() {
  await f.page.evaluate(async () => {
    const url = '/src/engine/client.ts';
    const { EngineClient } = await import(url);
    const original = EngineClient.prototype.part;
    let armed = false, held, completed = 0;
    // Delay delivery after real Worker transport decoding so cached meshes stay in wire order.
    EngineClient.prototype.part = async function (doc, revision, slot) {
      const capture = armed && slot === 'read' && doc.requirements?.some(r => r.id === 'MASS');
      if (capture) armed = false;
      const result = await original.call(this, doc, revision, slot);
      if (capture) {
        if (!result?.ok || !result.bodies.length) throw new Error('Expected an evaluated leaf to hold.');
        await new Promise(resolve => { held = { release: resolve, volume: result.bodies[0].volume }; });
        completed++;
      }
      return result;
    };
    window.__d605Hold = {
      arm() { armed = true; }, held: () => held?.volume, completed: () => completed,
      release() { const { release } = held; held = undefined; release(); },
    };
  });
}

async function holdLeft() {
  await f.page.evaluate(() => window.__d605Hold.arm());
  await select(0);
  await local().getByRole('status').getByText('Checking…', { exact: true }).waitFor();
  await f.page.waitForFunction(() => Math.abs(window.__d605Hold.held() - 800) < 1e-8);
  assert.equal(await local().getByLabel('Local requirement HEIGHT').count(), 0);
}

async function release(expected, label) {
  await f.page.evaluate(() => window.__d605Hold.release());
  await f.page.waitForFunction(n => window.__d605Hold.completed() === n, expected);
  await f.snapshot(label);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const first = root(4), other = root(6);
  const firstFile = join(output, 'first.bcad'), filename = 'replacement.bcad', otherFile = join(output, filename);
  await writeFile(firstFile, JSON.stringify(first));
  await writeFile(otherFile, JSON.stringify(other));
  const states = {};

  f.phase = 'current selected leaves and separate root check';
  await f.newPage();
  await f.openFile(firstFile, 2);
  await f.same(first);
  await f.page.locator('.req.pass[aria-label="Requirement HEIGHT"]').waitFor();
  await select(0);
  states.initialLeft = await shown(4, 'Pass');
  assert.match(await rootHeight().innerText(), /Root datum height maximum 2 mm/);
  assert.doesNotMatch(await local().innerText(), /Root datum/);
  await f.snapshot('initial-left');
  await select(1);
  states.initialRight = await shown(7, 'Fail');

  f.phase = 'late evaluated left reply cannot replace the right result';
  await installHold();
  await holdLeft();
  await f.snapshot('held-left');
  await select(1);
  await shown(7, 'Fail');
  await release(1, 'right-after-release');
  assert.deepEqual(await shown(7, 'Fail'), states.initialRight);
  await f.same(first);

  f.phase = 'same path in a replacement document refuses the previous reply';
  await holdLeft();
  await f.openFile(otherFile, 2);
  await f.same(other);
  assert.equal(await local().count(), 0);
  await select(0);
  states.otherLeft = await shown(6, 'Fail');
  await release(2, 'replacement-after-release');
  assert.deepEqual(await shown(6, 'Fail'), states.otherLeft);
  await f.same(other);

  f.phase = 'save and reopen the replacement through the actual Studio project workflow';
  await f.page.keyboard.press('Escape');
  const edited = await f.setParameter('H', 3, 'root-height-edited');
  assert.deepEqual(edited.doc.instances, other.instances);
  const project = 'D605 nested verdicts';
  await button('Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(filename, { exact: true }).waitFor();
  const saved = await f.page.evaluate(async ({ project, filename }) => {
    const storage = await navigator.storage.getDirectory();
    const folder = await (await storage.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await folder.getFileHandle(filename)).getFile()).text();
  }, { project, filename });
  assert.deepEqual(JSON.parse(saved), edited.doc);
  const savedFile = join(output, 'saved-opfs.bcad');
  await writeFile(savedFile, saved);
  await f.newPage();
  await f.openFile(savedFile, 2);
  await f.same(edited.doc);
  await f.page.locator('.req.fail[aria-label="Requirement HEIGHT"]').waitFor();
  assert.match(await rootHeight().innerText(), /3 \(want <= 2 mm\)/);
  await select(0);
  states.reopenedLeft = await shown(6, 'Fail');
  await f.snapshot('reopened-left');
  await select(1);
  states.reopenedRight = await shown(7, 'Fail');
  await f.same(edited.doc);
  await f.snapshot('reopened-right');
  await f.runOracle(states, 'independent-box-verdicts');

  f.phase = 'cut scope refuses a verdict and a leaf without requirements stays empty';
  const cut = root(4), cutFile = join(output, 'unsupported-and-empty.bcad');
  cut.instances[0].doc.assemblyCuts = [
    { id: 'c1', profile: { kind: 'circle', radius: 2 }, at: [5, 5, 0], dir: [0, 0, 1], depth: 'through', targets: ['p1'] },
  ];
  delete cut.instances[1].doc.instances[0].doc.requirements;
  await writeFile(cutFile, JSON.stringify(cut));
  await f.openFile(cutFile, 2);
  await f.same(cut);
  await select(0);
  await local().getByRole('status').getByText(/has an assembly cut/).waitFor();
  assert.equal(await local().getByLabel('Local requirement HEIGHT').count(), 0);
  await f.snapshot('cut-refusal');
  await select(1);
  assert.equal(await local().count(), 0);
  assert.equal(await f.page.locator('.toast[role="alert"]').count(), 0);
  await f.same(cut);
  f.report.observations.push({ states, releasedLateReads: 2, samePaths: paths, savedSHA256: sha256(saved) });
  assert.deepEqual(f.report.downloads, []);
});
