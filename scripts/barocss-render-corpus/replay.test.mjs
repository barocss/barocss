import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';
import { readSavedTurn, replaySaved } from './replay.mjs';

function saveTurn(dir, kind, spec) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${kind}-final.txt`), JSON.stringify({ specJson: JSON.stringify(spec) }) + '\n');
}

test('saved turn validation is independent of a declared valid status', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-corpus-read-'));
  try {
    const bad = structuredClone(INITIAL);
    bad.elements.card.props.className = 'fixed';
    saveTurn(dir, 'initial', bad);
    const result = readSavedTurn({ status: 'valid', outputDir: dir }, 'initial');
    assert.equal(result.filePresent, true);
    assert.equal(result.envelopeValid, true);
    assert.equal(result.specValid, false);
    assert.match(result.errors.join(' '), /elements\.card\.props\.className/);
    assert.match(result.rawSha256, /^[0-9a-f]{64}$/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('saved JSON bytes replay in both local arms without a model call', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-corpus-replay-'));
  const corpusDir = path.join(dir, 'corpus');
  const validDir = path.join(dir, 'saved-valid');
  const invalidDir = path.join(dir, 'saved-invalid');
  const resultDir = path.join(dir, 'result');
  try {
    fs.mkdirSync(corpusDir);
    const next = structuredClone(INITIAL);
    next.elements.heading.props.text = 'Name: Bea';
    saveTurn(validDir, 'initial', INITIAL);
    saveTurn(validDir, 'next', next);
    const bad = structuredClone(INITIAL);
    bad.elements.card.props.className = 'fixed';
    saveTurn(invalidDir, 'initial', bad);
    fs.writeFileSync(path.join(corpusDir, 'corpus.json'), JSON.stringify({ kind: 'barocss-render-corpus-v1', rows: [
      { id: '01', prompt: 'Create a profile form', name: 'Bea',
        initial: { status: 'valid', outputDir: validDir }, next: { status: 'valid', outputDir: validDir } },
      { id: '02', prompt: 'Create a bad form', name: 'Zoë',
        initial: { status: 'valid', outputDir: invalidDir }, next: { status: 'unattempted' } },
    ] }) + '\n');
    const report = await replaySaved({ corpusDir, resultDir });
    assert.equal(report.rows.length, 2);
    assert.equal(report.rows[0].eligible, true);
    assert.equal(report.rows[1].eligible, false);
    assert.equal(report.rows[1].skipReason, 'initial-saved-output-invalid');
    assert.deepEqual(report.rows[0].replay.map((arm) => arm.status), ['replayed', 'replayed']);
    for (const arm of report.rows[0].replay) {
      assert.equal(arm.actionPass, true);
      assert.equal(arm.nextNameVisible, true);
      assert.equal(arm.statePreserved, true);
      assert.equal(arm.overflowFree, true);
      assert.deepEqual(arm.errors, []);
      assert.equal(arm.initial.screens.desktop.columns, 2);
      assert.equal(arm.initial.screens.narrow.columns, 1);
    }
    assert.equal(report.rows[0].comparison.comparable, true);
    assert.equal(report.rows[0].comparison.actionIdentical, true);
    for (const screen of Object.values(report.rows[0].comparison.screens)) {
      assert.equal(screen.layoutIdentical, true);
      assert.equal(screen.stateIdentical, true);
      assert.equal(screen.screenshotIdentical, true);
    }
    assert.notEqual(report.rows[0].initial.specSha256, report.rows[0].next.specSha256);
    assert(fs.existsSync(path.join(resultDir, 'report.json')));
    assert(fs.existsSync(path.join(resultDir, 'shots/01-prototype-next-narrow.png')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
