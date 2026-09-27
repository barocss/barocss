import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inputHashes, digest } from './plan.mjs';
test('approval hash covers transitive renderer, scoring, styles and runtime assets', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const original = inputHashes();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '447-plan-'));
  try {
    for (const name of Object.keys(original)) {
      fs.mkdirSync(path.dirname(path.join(temp,name)), { recursive:true });
      fs.copyFileSync(path.join(root,name),path.join(temp,name));
    }
    assert.deepEqual(inputHashes(temp),original);
    for (const name of ['scripts/json-render-446/browser-app.jsx','scripts/json-render-446/styles.mjs', 'scripts/json-render-446/spec.mjs', 'scripts/json-render-446/contract.mjs','scripts/json-render-446/evidence/baro.umd.cjs','scripts/json-render-probe/e2e/app.css','scripts/json-render-447/dependency-lock.json']) {
      fs.appendFileSync(path.join(temp,name),'\n');
      assert.notEqual(digest(inputHashes(temp)),digest(original),name);
      fs.copyFileSync(path.join(root,name),path.join(temp,name));
    }
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
