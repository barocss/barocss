import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';
import { openExperimentBrowser } from './live-browser.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assetRoots = {
  repoDepsRoot: process.env.REPO_DEPS_ROOT ?? '/Users/user/.barocss-ai/v3/integration',
  jrRoot: process.env.JR_ROOT ?? '/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr',
  pwDir: process.env.PW_DIR ?? '/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core',
};
const message = (method, params) => JSON.stringify({ method, params });

function notifications(ids, spec, messageId) {
  const raw = JSON.stringify({ specJson: JSON.stringify(spec) });
  const item = { id: messageId, type: 'agentMessage', phase: 'final_answer', text: raw };
  const base = { threadId: ids.threadId, turnId: ids.turnId };
  return {
    start: message('turn/started', { threadId: ids.threadId,
      turn: { id: ids.turnId, status: 'inProgress' } }),
    itemStart: message('item/started', { ...base,
      item: { id: messageId, type: 'agentMessage' }, startedAtMs: 0 }),
    delta: (text) => message('item/agentMessage/delta', { ...base, itemId: messageId, delta: text }),
    itemComplete: message('item/completed', { ...base, item, completedAtMs: 30 }),
    turnComplete: message('turn/completed', { threadId: ids.threadId,
      turn: { id: ids.turnId, status: 'completed', items: [item] } }),
    raw,
  };
}

test('browser observes real notification lines, gates actions, saves once, and matches static baseline', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-live-browser-'));
  const resultDir = path.join(dir, 'result');
  let hostElapsed = 0;
  let browser;
  try {
    browser = await openExperimentBrowser({ resultDir, assetRoots, clock: () => hostElapsed });
    const initialIds = { processId: 'process-initial', threadId: 'thread-1', turnId: 'turn-initial' };
    const initial = notifications(initialIds, INITIAL, 'message-initial');
    assert.equal((await browser.start({ ids: initialIds, name: 'Bea' })).phase, 'generating');
    const event = async (line, processId, transportMs, observedMs = transportMs + 5) => {
      hostElapsed = observedMs;
      return browser.event({ line, processId, elapsedMs: transportMs });
    };
    assert.equal((await event(initial.start, initialIds.processId, 1)).changed, false);
    assert.equal((await event(initial.itemStart, initialIds.processId, 2)).changed, false);
    const cut = Math.floor(initial.raw.length / 2);
    assert.equal((await event(initial.delta(initial.raw.slice(0, cut)), initialIds.processId, 10)).changed, false);
    const preview = await event(initial.delta(initial.raw.slice(cut)), initialIds.processId, 20);
    assert.equal(preview.phase, 'preview');
    assert.equal(preview.observation.complete, true);
    assert.equal(preview.observation.screens.desktop.actionsEnabled, false);
    assert.equal(preview.observation.screens.narrow.actionsEnabled, false);
    assert.equal(preview.observation.screens.desktop.hostPaintMs, 25);
    await assert.rejects(browser.save({ name: 'Bea', revision: 1 }), /not committed/);
    const ready = await event(initial.itemComplete, initialIds.processId, 30);
    assert.equal(ready.phase, 'action-ready');
    assert.equal(ready.observation.screens.desktop.actionsEnabled, true);
    const committed = await event(initial.turnComplete, initialIds.processId, 40);
    assert.equal(committed.phase, 'committed');
    assert.equal(committed.observation.screens.desktop.revision, 1);
    hostElapsed = 46;
    const initialBaseline = await browser.baseline({ spec: INITIAL, name: 'Bea', completedMs: 40 });
    assert.equal(initialBaseline.equal, true);
    const action = await browser.save({ name: 'Bea', revision: 1 });
    assert.deepEqual(action, { action: 'save', revision: 1, name: 'Bea', ...initialIds });
    await assert.rejects(browser.save({ name: 'Bea', revision: 1 }), /duplicate save/);

    const nextSpec = structuredClone(INITIAL);
    nextSpec.elements.heading.props.text = 'Name: Bea';
    const nextIds = { processId: 'process-next', threadId: 'thread-1', turnId: 'turn-next' };
    const next = notifications(nextIds, nextSpec, 'message-next');
    hostElapsed = 50;
    assert.equal((await browser.start({ ids: nextIds, name: 'Bea', startedMs: 49 })).hostStartedMs, 49);
    assert.equal((await event(next.start, nextIds.processId, 51)).changed, false);
    assert.equal((await event(next.itemStart, nextIds.processId, 52)).changed, false);
    const fallback = await event(next.itemComplete, nextIds.processId, 70);
    assert.equal(fallback.phase, 'action-ready');
    assert.equal(fallback.observation.screens.desktop.inputValue, 'Bea');
    assert.equal(fallback.observation.screens.desktop.actionsEnabled, true);
    const nextCommit = await event(next.turnComplete, nextIds.processId, 80);
    assert.equal(nextCommit.phase, 'committed');
    assert.equal(nextCommit.observation.screens.desktop.revision, 2);
    hostElapsed = 100;
    const baseline = await browser.baseline({ spec: nextSpec, name: 'Bea', completedMs: 80 });
    assert.equal(baseline.equal, true);
    assert.equal(baseline.completeResponseMs, 80);
    assert.equal(baseline.observedHostMs, 100);
    assert(baseline.renderApplyMs.desktop >= 0);
    assert(baseline.renderApplyMs.narrow >= 0);
    await browser.close();
    browser = null;
    const report = JSON.parse(fs.readFileSync(path.join(resultDir, 'report.json'), 'utf8'));
    assert.deepEqual(report.observations.map((item) => item.phase),
      ['preview', 'action-ready', 'committed', 'action-ready', 'committed']);
    assert.equal(report.baselines.length, 2);
    assert.equal(report.actions.length, 1);
    assert.equal(report.actions[0].actionSha256, sha(JSON.stringify(action)));
    assert.equal(report.modelCallsByHarness, 0);
    assert.deepEqual(report.networkErrors, []);
    for (const record of report.observations) for (const screen of Object.values(record.screens)) {
      assert.equal(screen.measurementComplete, true);
      assert.equal(screen.screenshotSha256, sha(fs.readFileSync(path.join(resultDir, screen.screenshot))));
    }
  } finally {
    if (browser) await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
