// Static source contract for the DEFERRED real-browser acceptance script.
// This is not Playwright, native geometry, WebGL/WebGPU or file-dialog evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const flow = readFileSync(resolve(root, 'apps/cad-editor/flows/modeling-top-pocket-browser-flow.mjs'), 'utf8');
const editor = readFileSync(resolve(root, 'packages/barocss-cad-editor/src/react/modeling-editor.tsx'), 'utf8');
const app = readFileSync(resolve(root, 'apps/cad-editor/src/app.tsx'), 'utf8');
let checks = 0;
function includes(data, term) {
  assert.ok(data.includes(term), 'Missing source contract: ' + term);
  checks++;
}
includes(app, "location.hash === '#/model'");
includes(app, '<ModelingApp />');
for (const text of [
  'Cut a top-entry pocket', 'value="top-entry-pocket"', 'Pocket depth downward from top Z=8',
  'Tool Y origin', 'Tool Y span', 'Choose one output to inspect', 'Choose model file',
  'Open saved model', 'Download model', 'Saved model data', 'Apply dimensions',
  'Discard draft', 'Undo', 'Redo', 'Replace accepted model and discard its history'
]) includes(editor, text);
for (const token of [
  "await page.goto('http://127.0.0.1:' + port + '/#/model')",
  "selectOption('top-entry-pocket')", "assert.equal(await partVolume(page), '5632 / 1 mm³')",
  "assert.equal(await partVolume(page), '5376 / 1 mm³')", "assert.equal(await partVolume(fresh), '5504 / 1 mm³')",
  "name: 'Undo'", "name: 'Redo'", "name: 'Apply dimensions'",
  "page.waitForEvent('download')", "download.path()", "page.waitForEvent('filechooser')",
  "modal.setFiles", "filter({ hasText: 'Save or open a model' })", "fresh.getByRole('button', { name: 'Open saved model' })",
  "await screenshot(page, 'refused-two-body')", "invalid-utf8.cad.json", "oversize.cad.json",
  "assert.deepEqual(receipt.pageErrors, [])", "receipt.result = 'UNRUN'", "receipt.result = 'FAILED'",
  "receipt.result = 'PASSED_BROWSER'", "sha256: sha(bytes)", "await browser?.close()",
  "server.kill('SIGTERM')"
]) includes(flow, token);
assert.ok(!flow.includes('/Users/user/'), 'Flow must not depend on a private machine path'); checks++;
assert.ok(!flow.includes('mock'), 'Flow must not substitute mocked device evidence'); checks++;
console.log(JSON.stringify({ status: 'PASS', checks, tier: 'source and syntax only; real browser/GPU/physical file UNRUN' }));
