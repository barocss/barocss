import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { runUniformCurveSourceCheckpoint } from '../examples/native-uniform-curve-source-verify.mjs';

const args = process.argv.slice(2);
assert.ok(args.length === 2 && args[0] === '--output',
  'Usage: node uniform-curve-source.test.mjs --output EVIDENCE_DIR');
await runUniformCurveSourceCheckpoint('source', resolve(args[1]));
