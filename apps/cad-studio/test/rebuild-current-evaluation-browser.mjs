import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const baseline = process.argv.includes('--baseline');
const flow = await createFlow({
  name: 'rebuild-current-evaluation', output: process.argv[2], envFrozen: 'D1246_SOURCE_FROZEN',
  qualification: 'Do not display an earlier document report after the current evaluation fails.',
  initialFiles: [
    'apps/cad-studio/src/App.tsx',
    'apps/cad-studio/src/ui/RebuildPanel.tsx',
    'packages/barocss-cad-model/src/team/rebuild.ts',
  ],
});

const plate = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const failed = { ...plate, nodes: [plate.nodes[0], { ...plate.nodes[1], height: 0 }] };
const shelled = { ...plate,
  nodes: [...plate.nodes, { id: 'n2', kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: 2, open: ['n1.top'] }],
  outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
};
const panel = () => flow.page.getByRole('complementary', { name: 'Rebuild panel', exact: true });
const button = name => flow.page.getByRole('button', { name, exact: true });

async function open(name, doc) {
  flow.phase = 'Open ' + name;
  const [chooser] = await Promise.all([flow.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await flow.page.waitForFunction(n => document.querySelector('.doc-tab input')?.value === n, name);
}

function workerGate() {
  const worker = Worker.prototype, send = worker.postMessage;
  const descriptor = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  let armed = false, id, give;
  worker.postMessage = function (message, ...rest) {
    if (armed && message?.type === 'evaluate') { id = message.id; armed = false; }
    return send.call(this, message, ...rest);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: descriptor.get,
    set(fn) {
      descriptor.set.call(this, typeof fn === 'function' ? function (event) {
        if (id !== undefined && event.data?.id === id && event.data.result) {
          give = () => fn.call(this, event);
          id = undefined;
          return;
        }
        return fn.call(this, event);
      } : fn);
    },
  });
  window.__rebuildGate = { arm() { armed = true; }, held: () => !!give, release() { const deliver = give; give = undefined; deliver(); } };
}

async function snapshot(label) {
  return flow.snapshot(label, () => {
    const root = document.querySelector('[aria-label="Rebuild panel"]');
    return { rebuild: root?.textContent, rows: [...(root?.querySelectorAll('[data-rebuild-state]') ?? [])].map(row => row.textContent) };
  });
}

await flow.run(async () => {
  const createContext = flow.browser.newContext.bind(flow.browser);
  flow.browser.newContext = async options => {
    const context = await createContext(options);
    await context.addInitScript(workerGate);
    return context;
  };
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 800 }]) {
    const tag = viewport.width;
    await flow.newPage();
    await flow.page.setViewportSize(viewport);
    await open('shell-' + tag, shelled);
    await flow.same(shelled);
    await clickModelCommand(flow.page, 'Inspect', 'Rebuild');
    if (await button('Open the dock').isVisible()) await button('Open the dock').click();
    await panel().getByText(/Shell 2/).waitFor();
    const before = await snapshot('shell-' + tag);
    assert.ok(Math.abs(before.bodies.bodies[0].volume - (16384 - 60 * 28 * 6)) <= 1e-7);
    await flow.page.evaluate(() => window.__rebuildGate.arm());
    await open('zero-height-' + tag, failed);
    await flow.page.waitForFunction(() => window.__rebuildGate.held());
    const pending = await snapshot('pending-' + tag);
    if (!baseline) {
      assert.deepEqual(pending.rows, []);
      assert.match(pending.rebuild, /Evaluating the current model/i);
      assert.doesNotMatch(pending.rebuild, /Every mate is met|No mates\./);
    }
    await flow.page.evaluate(() => window.__rebuildGate.release());
    await flow.page.getByText('Previous result · model evaluation failed', { exact: true }).waitFor();
    const refused = await snapshot('failed-' + tag);
    assert.deepEqual(refused.doc, failed);
    assert.deepEqual(refused.bodies.bodies, before.bodies.bodies);
    if (baseline) {
      assert.match(refused.rebuild, /last evaluation.*Shell 2/);
      assert.doesNotMatch(refused.rebuild, /current model evaluation failed/i);
    } else {
      assert.deepEqual(refused.rows, []);
      assert.match(refused.rebuild, /Current model evaluation failed/i);
      assert.doesNotMatch(refused.rebuild, /Every mate is met|No mates\./);
    }

    await open('height-eight-' + tag, plate);
    await flow.same(plate);
    await panel().getByRole('table', { name: 'Rebuild features', exact: true }).waitFor();
    const restored = await snapshot('recovered-' + tag);
    assert.equal(restored.rows.length, 2);
    assert.ok(restored.rows.some(text => text.includes('Extrude 8')));
    assert.ok(restored.rows.every(text => !text.includes('Shell')));
    assert.equal(restored.bodies.bodies[0].volume, 16384);
  }
  if (baseline) throw Error('Rebuild presents a previous document as its current report.');
});
