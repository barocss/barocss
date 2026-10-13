// Pure file-stage preflight only: no React, browser picker, CAD evaluation or GPU authority.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const result = await require('esbuild').build({
  entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/modeling-file.ts')],
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const bundleURL = 'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64');
const { readModelingFileText, MAX_MODELING_FILE_BYTES: MAX } = await import(bundleURL);
const encoder = new TextEncoder();
let checks = 0;

function mockFile(data, size = data.length) {
  return { size, async arrayBuffer() { return Uint8Array.from(data).buffer; } };
}
const original = '{"format":"barocss-cad-model","label":"정밀 CAD"}';
const originalBytes = encoder.encode(original);
assert.equal(await readModelingFileText(mockFile(originalBytes)), original); checks++;
assert.equal(await readModelingFileText(mockFile(encoder.encode('  { "units": "mm" }\n'))), '  { "units": "mm" }\n'); checks++;
const exactLimit = 'x'.repeat(MAX);
assert.equal((await readModelingFileText(mockFile(encoder.encode(exactLimit)))).length, MAX); checks++;
let called = false;
await assert.rejects(() => readModelingFileText({
  size: MAX + 1, async arrayBuffer() { called = true; throw new Error('must not read'); },
}), /at most/);
assert.equal(called, false); checks++;
for (const size of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
  await assert.rejects(() => readModelingFileText({size, async arrayBuffer() { throw new Error('must not read'); }}), /at most/);
  checks++;
}
await assert.rejects(() => readModelingFileText(mockFile(encoder.encode('x'.repeat(MAX + 1)), 1)), /at most/); checks++;
await assert.rejects(() => readModelingFileText(mockFile(new Uint8Array([0xc3, 0x28]))), /encoded|valid|UTF|character/i); checks++;
for (const content of ['', '   \n\t']) {
  await assert.rejects(() => readModelingFileText(mockFile(encoder.encode(content))), /empty/); checks++;
}
await assert.rejects(() => readModelingFileText({
  size: 1, async arrayBuffer() { throw new Error('read refused'); },
}), /read refused/); checks++;
// The reader stages bytes as-is, even when the model is not valid JSON;
// the authoritative controller rejects malformed authored data on explicit Open.
assert.equal(await readModelingFileText(mockFile(encoder.encode('{broken'))), '{broken'); checks++;
console.log(JSON.stringify({ status: 'PASS', checks, boundary: 'file bytes and UTF-8 only; no browser/GPU/native acceptance' }));
