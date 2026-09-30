import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';
import { replaySavedProgressive } from './browser-replay.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assetRoots = {
  repoDepsRoot: process.env.REPO_DEPS_ROOT ?? '/Users/user/.barocss-ai/v3/integration',
  jrRoot: process.env.JR_ROOT ?? '/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr',
  pwDir: process.env.PW_DIR ?? '/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core',
};

function fixture(dir, tamper = false) {
  const corpusDir = path.join(dir, 'corpus');
  const savedDir = path.join(dir, 'saved');
  fs.mkdirSync(corpusDir);
  fs.mkdirSync(savedDir);
  const next = structuredClone(INITIAL);
  next.elements.heading.props.text = 'Name: Bea';
  const initialRaw = JSON.stringify({ specJson: JSON.stringify(INITIAL) }) + '\n';
  const nextRaw = JSON.stringify({ specJson: JSON.stringify(next) }) + '\n';
  fs.writeFileSync(path.join(savedDir, 'initial-final.txt'), initialRaw);
  fs.writeFileSync(path.join(savedDir, 'next-final.txt'), nextRaw);
  fs.writeFileSync(path.join(corpusDir, 'corpus.json'), JSON.stringify({ kind: 'barocss-render-corpus-v1', rows: [
    { id: '01', name: 'Bea', prompt: 'Authored profile form',
      initial: { status: 'valid', outputDir: savedDir, rawSha256: tamper ? '0'.repeat(64) : sha(initialRaw) },
      next: { status: 'valid', outputDir: savedDir, rawSha256: sha(nextRaw) } },
  ] }) + '\n');
  return { corpusDir, initialRaw, nextRaw };
}

test('authored fixture replays each delivery phase with screenshots, styles, action, and exact hashes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-progressive-browser-'));
  try {
    const { corpusDir, initialRaw, nextRaw } = fixture(dir);
    const resultDir = path.join(dir, 'result');
    const report = await replaySavedProgressive({ corpusDir, resultDir, source: 'authored-fixture', assetRoots });
    assert.equal(report.source, 'authored-fixture');
    assert.equal(report.modelCalls, 0);
    assert.equal(report.delivery, 'synthetic-app-server-jsonrpc');
    assert.equal(report.measurementComplete, true);
    assert.equal(report.rows[0].replay.status, 'replayed');
    assert.equal(report.rows[0].initial.rawSha256, sha(initialRaw));
    assert.equal(report.rows[0].next.rawSha256, sha(nextRaw));
    assert.match(report.assetHashes.app, /^[0-9a-f]{64}$/);
    for (const [kind, turn] of Object.entries(report.rows[0].replay.turns)) {
      assert.match(turn.streamSha256, /^[0-9a-f]{64}$/);
      for (const [stage, screens] of Object.entries(turn.stages)) {
        for (const [viewport, screen] of Object.entries(screens)) {
          assert.equal(screen.phase, stage === 'actionReady' ? 'action-ready' : stage);
          if (kind === 'initial' && stage === 'generating') {
            assert.equal(screen.measurementComplete, null);
            assert.equal(screen.placeholderComplete, true);
          } else assert.equal(screen.measurementComplete, true, `${kind}:${stage}:${viewport}`);
          assert.equal(screen.visibleSpecExact, true);
          assert.equal(screen.committedSpecExact, true);
          assert.equal(screen.actionsEnabled, kind === 'initial' && stage === 'generating'
            ? null : ['actionReady', 'committed'].includes(stage));
          assert.equal(screen.overflow, false);
          const bytes = fs.readFileSync(path.join(resultDir, screen.screenshot));
          assert.equal(screen.screenshotSha256, sha(bytes));
          if (stage !== 'generating' || kind === 'next') {
            assert.equal(screen.contentComplete, true);
            assert.equal(screen.styleComplete, true);
            assert.equal(screen.missingIds.length, 0);
          }
        }
      }
    }
    const initial = report.rows[0].replay.turns.initial;
    const next = report.rows[0].replay.turns.next;
    assert.deepEqual(initial.actionsBeforeCommit, []);
    assert.equal(initial.queuedAction, 'Bea');
    assert.equal(initial.stages.committed.desktop.actions[0].name, 'Bea');
    assert.equal(next.stages.committed.desktop.inputValue, 'Bea');
    assert.equal(next.stages.committed.desktop.nameVisible, true);
    assert.equal(next.stages.committed.desktop.revision, 2);
    assert(fs.existsSync(path.join(resultDir, 'report.json')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('changed saved bytes fail digest validation before browser replay', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-progressive-tamper-'));
  try {
    const { corpusDir } = fixture(dir, true);
    const report = await replaySavedProgressive({ corpusDir, resultDir: path.join(dir, 'result'),
      source: 'authored-fixture' });
    assert.equal(report.rows[0].eligible, false);
    assert.equal(report.rows[0].replay, null);
    assert.equal(report.measurementComplete, false);
    assert.match(report.rows[0].initial.errors.join(' '), /digest differs/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('source must be declared and private output cannot be labeled authored', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-progressive-source-'));
  try {
    const { corpusDir } = fixture(dir);
    await assert.rejects(replaySavedProgressive({ corpusDir, resultDir: path.join(dir, 'result') }),
      /Declare the corpus source/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
