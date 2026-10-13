import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAxisBoxSolid } from '../dist/index.js';

/**
 * Replays an existing authored six-face axis-box fixture, then proves that
 * mutating a declared edge use is rejected by the unchanged native gate.
 * Requires a built CAD package. No renderer, mass approximation or
 * global B-Rep certification is inferred.
 *
 * node packages/barocss-cad/scripts/qualified-solid-regression.mjs \
 *   /absolute/six-surfaces.css /absolute/input.json /absolute/receipt.json
 */
const [sourceArg, inputArg, receiptArg] = process.argv.slice(2);
if (!sourceArg || !inputArg || !receiptArg) {
  throw new Error('Usage: node qualified-solid-regression.mjs six-surfaces.css input.json receipt.json');
}
const sourcePath = resolve(sourceArg), inputPath = resolve(inputArg), receiptPath = resolve(receiptArg);
const bytes = (path) => readFileSync(path);
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const output = mkdtempSync(join(tmpdir(), 'barocss-cad-regression-'));
try {
  const demo = resolve(fileURLToPath(new URL('../../../examples/cad-nurbs/box-solid-demo.mjs', import.meta.url)));
  execFileSync(process.execPath, [demo, sourcePath, inputPath, output], { stdio: 'pipe', timeout: 120000 });
  const shell = JSON.parse(bytes(join(output, 'shell.json')).toString('utf8'));
  const positive = validateAxisBoxSolid(shell);
  assert.equal(positive.valid, true);
  assert.equal(positive.solid, true);
  assert.equal(positive.geometryFamily, 'exact-axis-box-solid-v0');

  const corrupt = structuredClone(shell);
  assert.ok(corrupt.edges.length > 0 && corrupt.edges[0].uses.length === 2, 'required native edge-use fixture');
  corrupt.edges[0].uses[1].sense = corrupt.edges[0].uses[0].sense;
  let negative = null;
  try { validateAxisBoxSolid(corrupt); } catch (error) {
    negative = { outcome: 'refused', diagnostic: String(error instanceof Error ? error.message : error).slice(0, 1024) };
  }
  assert.ok(negative, 'corrupt edge use must be rejected, not silently repaired');
  const unchanged = validateAxisBoxSolid(shell);
  assert.deepEqual(unchanged, positive, 'negative mutation must not change accepted source');

  const receipt = {
    schema: 'barocss-cad-qualified-regression-v1',
    caseId: 'exact-axis-box-opposite-edge-use',
    inputs: { sourceSHA256: sha256(bytes(sourcePath)), documentSHA256: sha256(bytes(inputPath)) },
    admittedFamily: 'exact-axis-box-solid-v0',
    proofTier: 'native-family-certified',
    positive: { outcome: 'certified', volumeMM3: positive.volumeMM3, areaMM2: positive.areaMM2, closed: positive.closed },
    negative: { mutation: 'duplicate-first-edge-use-sense', ...negative },
    documentRoundtrip: 'unrun',
    browserStatus: 'unrun',
    loaderStatus: 'unrun'
  };
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ caseId: receipt.caseId, positive: receipt.positive.outcome, negative: receipt.negative.outcome, receiptPath }));
} finally { rmSync(output, { recursive: true, force: true }); }
