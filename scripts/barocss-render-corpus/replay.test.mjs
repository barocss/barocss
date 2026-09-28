import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { INITIAL } from '../barocss-render-prototype/fixture.mjs';
import { readSavedTurn, replaySaved } from './replay.mjs';

function saveTurn(dir, kind, spec) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${kind}-final.txt`), JSON.stringify({ specJson: JSON.stringify(spec) }) + '\n');
}
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

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

test('a changed final is rejected against the captured digest before parsing or replay', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-corpus-tamper-'));
  try {
    const corpusDir = path.join(dir, 'corpus');
    const savedDir = path.join(dir, 'saved');
    fs.mkdirSync(corpusDir);
    saveTurn(savedDir, 'initial', INITIAL);
    const originalSha = sha(fs.readFileSync(path.join(savedDir, 'initial-final.txt')));
    const changed = structuredClone(INITIAL);
    changed.elements.heading.props.text = 'Changed after capture';
    saveTurn(savedDir, 'initial', changed);
    const next = structuredClone(INITIAL);
    next.elements.heading.props.text = 'Name: Bea';
    saveTurn(savedDir, 'next', next);
    fs.writeFileSync(path.join(corpusDir, 'corpus.json'), JSON.stringify({ kind: 'barocss-render-corpus-v1', rows: [
      { id: '01', prompt: 'Create a profile form', name: 'Bea',
        initial: { status: 'valid', outputDir: savedDir, rawSha256: originalSha },
        next: { status: 'valid', outputDir: savedDir } },
    ] }) + '\n');
    const report = await replaySaved({ corpusDir, resultDir: path.join(dir, 'report') });
    assert.equal(report.source, 'authored-fixture-replay');
    assert.equal(report.rows[0].eligible, false);
    assert.equal(report.rows[0].skipReason, 'initial-saved-output-invalid');
    assert.match(report.rows[0].initial.errors.join(' '), /digest differs/);
    assert.deepEqual(report.rows[0].replay, []);
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

test('renamed root and two cards produce complete style measurements in both arms', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-corpus-renamed-'));
  try {
    const corpusDir = path.join(dir, 'corpus');
    const savedDir = path.join(dir, 'saved');
    fs.mkdirSync(corpusDir);
    const initial = structuredClone(INITIAL);
    initial.root = 'profile-root';
    initial.elements['profile-root'] = initial.elements.layout;
    delete initial.elements.layout;
    initial.elements['profile-root'].props.id = 'profile-root';
    initial.elements['profile-root'].children = ['profile-card', 'help-card'];
    initial.elements['profile-card'] = initial.elements.card;
    delete initial.elements.card;
    initial.elements['profile-card'].props.id = 'profile-card';
    initial.elements['profile-card'].props.tone = 'dark';
    initial.elements['help-card'] = { type: 'Card', props: { id: 'help-card', padding: 'spacious', tone: 'light' }, children: ['help'] };
    initial.elements.help = { type: 'Text', props: { id: 'help', text: 'Local help.' }, children: [] };
    const next = structuredClone(initial);
    next.elements.heading.props.text = 'Name: Bea';
    saveTurn(savedDir, 'initial', initial);
    saveTurn(savedDir, 'next', next);
    fs.writeFileSync(path.join(corpusDir, 'corpus.json'), JSON.stringify({ kind: 'barocss-render-corpus-v1', rows: [
      { id: '06', prompt: 'Two-card profile', name: 'Bea',
        initial: { status: 'valid', outputDir: savedDir }, next: { status: 'valid', outputDir: savedDir } },
    ] }) + '\n');
    const report = await replaySaved({ corpusDir, resultDir: path.join(dir, 'report') });
    assert.equal(report.rows[0].eligible, true);
    assert.deepEqual(report.rows[0].replay.map((arm) => arm.status), ['replayed', 'replayed']);
    for (const arm of report.rows[0].replay) {
      for (const screen of Object.values(arm.initial.screens)) {
        assert.equal(screen.rootId, 'profile-root');
        assert.equal(screen.formCardId, 'profile-card');
        assert.equal(screen.measurementComplete, true);
        assert.equal(screen.cards.length, 2);
        assert(screen.cards.every((card) => card.present && card.paddingPx !== null && card.background));
        assert.notEqual(screen.cards[0].background, screen.cards[1].background);
      }
    }
    assert.equal(report.rows[0].comparison.comparable, true);
    assert(Object.values(report.rows[0].comparison.screens).every((screen) => screen.layoutIdentical));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
