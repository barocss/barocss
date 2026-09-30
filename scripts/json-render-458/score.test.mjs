import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capture } from './capture.mjs';
import { stubTransport } from './stub.mjs';
import { scoreSaved } from './score.mjs';
import { verifyFrozen } from './freeze.mjs';

const run = async (transport) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'baro-458-score-'));
  const outputDir = path.join(parent, 'capture');
  const rows = await capture({ outputDir, transport, planHash: verifyFrozen(), synthetic: true });
  return { parent, outputDir, rows };
};

test('stub scoring accounts for supported requests and three honest abstentions', async () => {
  const { parent, outputDir, rows } = await run(stubTransport());
  try {
    const scored = scoreSaved(rows, outputDir);
    assert.equal(scored.length, 24);
    assert.equal(scored.filter((row) => row.requestSatisfied).length, 21);
    assert.equal(scored.filter((row) => row.abstentionCorrect).length, 3);
    assert.equal(scored.filter((row) => row.chainAfter).length, 24);
    assert.equal(scored.filter((row) => row.errors.length).length, 3); // unsupported edits remain visible
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});

test('a semantic failure poisons the complete session chain', async () => {
  const base = stubTransport();
  const transport = async (args) => {
    const result = await base(args);
    if (args.row.id === 'settings--variable--initial') {
      const envelope = JSON.parse(result.rawFinal);
      const spec = JSON.parse(envelope.specJson);
      spec.elements.heading.props.text = 'Changed';
      envelope.specJson = JSON.stringify(spec);
      result.rawFinal = JSON.stringify(envelope);
    }
    return result;
  };
  const { parent, outputDir, rows } = await run(transport);
  try {
    const scored = scoreSaved(rows, outputDir).filter((row) => row.session === 'settings--variable');
    assert.equal(scored.length, 4);
    assert.equal(scored[0].semanticValid, false);
    assert.ok(scored.every((row) => !row.chainAfter));
    assert.equal(scored[1].chainBefore, false);
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});

test('valid final text after timeout, quota or missing completion never earns success', async () => {
  for (const reason of ['timeout', 'quota', 'missing-completion-event']) {
    const base = stubTransport();
    const transport = async (args) => {
      const response = await base(args);
      if (args.row.ordinal === 0) { response.stopReason = reason; response.exitCode = null; }
      return response;
    };
    const { parent, outputDir, rows } = await run(transport);
    try {
      const scored = scoreSaved(rows, outputDir);
      assert.equal(scored[0].schemaValid, true, reason);
      assert.equal(scored[0].transportValid, false, reason);
      assert.equal(scored[0].requestSatisfied, false, reason);
      assert.equal(scored[0].chainAfter, false, reason);
      assert.equal(scored.filter((row) => row.requestSatisfied && row.session === 'settings--variable').length, 0, reason);
    } finally { fs.rmSync(parent, { recursive: true, force: true }); }
  }
});
