import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === '--baseline' || mode === '--fixed');
const fixed = mode === '--fixed';
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/ui/SketchPanel.tsx',
  'packages/barocss-cad-model/src/sketch/select.ts',
  ...(fixed ? ['apps/cad-studio/src/ui/useWorkspaceModeExit.tsx'] : []),
];
const oracleSource = `
import json, math, sys
d = json.load(sys.stdin)
nodes = d['doc']['nodes']
assert len(nodes) == 2 and [n['kind'] for n in nodes] == ['sketch','extrude']
assert nodes[1]['sketch'] == 0 and nodes[1]['height'] == 18
assert nodes[0]['profile'] == 'polygon'
expected = [[0,0],[20,0],[20,12],[0,12]]
assert all(math.isclose(a,b,abs_tol=1e-9) for p,q in zip(nodes[0]['points'],expected,strict=True) for a,b in zip(p,q,strict=True))
assert nodes[0]['outline']['lengths']['1'] == 12
assert any(rule['kind'] == 'fix' and rule['point'] == 1 for rule in nodes[0]['outline']['rules'])
assert len(nodes[0]['sideTags']['outer']) == 4
assert len(d['bodies']) == 1
body = d['bodies'][0]
assert math.isclose(body['volume'], 20 * 12 * 18, abs_tol=1e-7)
print(json.dumps({'status':'PASS','profileMm':[20,12],'heightMm':18,'volumeMm3':4320}))
`;
const f = await createFlow({ name: 'sketch-mode-exit', envFrozen: 'D663_SOURCE_FROZEN', output, inspectorSource: undefined,
  initialFiles: pins, requiredFrozen: pins, oracleSource, qualification: 'Preserve one draft when leaving Sketch for Model, Drawing or Render' });
const button = name => f.page.getByRole('button', { name, exact: true });
const tabs = () => f.page.getByRole('group', { name: 'Mode', exact: true });
const tab = name => tabs().getByRole('button', { name, exact: true });
const width = () => f.sketchPanel().locator('#sk-width');
const height = () => f.sketchPanel().locator('#sk-height');
const modes = ['Model', 'Drawing', 'Render'];
const prompt = () => f.page.getByRole('dialog', { name: 'Discard sketch changes?', exact: true });
const keep = () => prompt().getByRole('button', { name: 'Keep editing', exact: true });
const discard = () => prompt().getByRole('button', { name: 'Discard changes', exact: true });
const waitFocus = locator => locator.evaluate(element => new Promise((resolve, reject) => {
  let attempts = 0;
  const check = () => {
    if (document.activeElement === element) resolve(true);
    else if (++attempts >= 120) reject(new Error('The expected sketch or mode control did not regain focus.'));
    else requestAnimationFrame(check);
  };
  check();
}));

async function sketch() {
  await tab('Sketch').click();
  await f.sketchPanel().waitFor();
  await f.sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
}
async function rectangle() {
  await sketch();
  await f.frame([[0, 0], [20, 12]]);
  await f.worldClick([0, 0]);
  await f.worldClick([20, 12]);
  await width().waitFor();
  assert.deepEqual([Number(await width().inputValue()), Number(await height().inputValue())], [20, 12]);
  const panel = await f.sketchPanelText();
  assert.match(panel, /Horizontal2 edges/);
  assert.match(panel, /Vertical2 edges/);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  await button('New part').click();
  await f.page.waitForFunction(() => window.__studioDoc?.nodes.length === 0);
  await f.ready();
  const empty = await f.doc();
  if (!fixed) {
    for (const name of modes) {
      f.phase = 'original draft loss through ' + name;
      await rectangle();
      await f.snapshot('baseline-before-' + name.toLowerCase());
      await tab(name).click();
      await f.sketchPanel().waitFor({ state: 'hidden' });
      await sketch();
      assert.equal(await width().count(), 0);
      assert.equal(await height().count(), 0);
      await f.same(empty);
      await f.snapshot('baseline-after-' + name.toLowerCase());
      await f.page.keyboard.press('Escape');
      await f.sketchPanel().waitFor({ state: 'hidden' });
      f.report.observations.push({ mode: name, draftLost: true });
    }
    return;
  }
  f.phase = 'preserve dimensions and focus across all three mode requests';
  await rectangle();
  const before = await f.doc();
  assert.deepEqual(before, empty);
  const originalConstraints = await f.sketchPanelText();
  for (const name of modes) {
    await width().focus();
    await tab(name).click();
    await prompt().waitFor();
    await waitFocus(keep());
    await f.same(before);
    await f.snapshot('mode-confirmation-' + name.toLowerCase());
    if (name === 'Drawing') await f.page.keyboard.press('Escape');
    else await keep().click();
    await prompt().waitFor({ state: 'hidden' });
    await waitFocus(width());
    assert.deepEqual([Number(await width().inputValue()), Number(await height().inputValue())], [20, 12]);
    assert.equal(await f.sketchPanelText(), originalConstraints);
    await f.same(before);
    f.report.observations.push({ mode: name, draftKept: true, width: 20, height: 12, priorFocusRestored: true });
  }
  await tabs().getByRole('button', { name: /^Sketch · / }).click();
  assert.equal(Number(await width().inputValue()), 20);
  assert.equal(await prompt().count(), 0);

  f.phase = 'preserve an authored constraint and a driving edge dimension after a keyboard mode request';
  await f.tool('Select', 's');
  const edgeLength = f.sketchPanel().getByLabel('Edge 2 length', { exact: true });
  await edgeLength.waitFor();
  // The fixed corner supplies the bottom edge's horizontal alignment.
  await f.sketchPanel().getByRole('button', { name: 'Remove Horizontal edge 1', exact: true }).click();
  await f.worldClick([20, 0]);
  const fix = f.sketchPanel().getByRole('button', { name: 'Fix', exact: true });
  await fix.click();
  const fixedCorner = f.sketchPanel().getByRole('button', { name: 'Remove Fixed point 2', exact: true });
  await fixedCorner.waitFor();
  await edgeLength.fill('12');
  await edgeLength.press('Enter');
  const lengthRule = f.sketchPanel().getByRole('button', { name: 'Remove Length edge 2 = 12', exact: true });
  await lengthRule.waitFor();
  const constrained = await f.sketchPanelText();
  await tab('Model').focus();
  await tab('Model').press('Enter');
  await prompt().waitFor();
  await waitFocus(keep());
  await f.page.keyboard.press('Enter');
  await prompt().waitFor({ state: 'hidden' });
  await waitFocus(tab('Model'));
  await fixedCorner.waitFor();
  await lengthRule.waitFor();
  assert.equal(await f.sketchPanelText(), constrained);
  assert.equal(Number(await edgeLength.inputValue()), 12);
  await f.same(before);
  await f.snapshot('constrained-draft-after-keep');

  await f.finishSketch('finished');
  const finished = await f.doc();
  assert.deepEqual(finished.nodes.map(node => node.kind), ['sketch']);
  await f.openExtrudeHud();
  await f.applyExtrude({ distance: 18, previous: finished, label: 'kept-sketch' });
  await f.ready();
  const extruded = await f.doc();
  await f.runOracle({ doc: extruded, bodies: (await f.bodies()).bodies }, 'physical');

  f.phase = 'discard a second draft explicitly and leave an empty sketch without a confirmation';
  await rectangle();
  await tab('Drawing').click();
  await prompt().waitFor();
  await discard().click();
  await prompt().waitFor({ state: 'hidden' });
  await f.sketchPanel().waitFor({ state: 'hidden' });
  assert.match(await tab('Drawing').getAttribute('class'), /(?:^|\s)on(?:\s|$)/);
  await f.same(extruded);
  await sketch();
  assert.equal(await width().count(), 0);
  await tab('Render').click();
  await f.sketchPanel().waitFor({ state: 'hidden' });
  assert.equal(await prompt().count(), 0);
  assert.match(await tab('Render').getAttribute('class'), /(?:^|\s)on(?:\s|$)/);
  await f.same(extruded);
  f.report.observations.push({ fixedCornerPreserved: true, drivingLengthPreserved: true, keyboardFocusRestored: true,
    finishedOnce: true, extrusionMm: 18, explicitDiscard: true, emptySketchExitedDirectly: true });
});
