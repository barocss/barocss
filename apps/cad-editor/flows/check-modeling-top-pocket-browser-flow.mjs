// Local source contract for the DEFERRED real-browser acceptance script.
// Run: node apps/cad-editor/flows/check-modeling-top-pocket-browser-flow.mjs
// This is not Playwright, native geometry, WebGL/WebGPU or file-dialog evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const flow = read('apps/cad-editor/flows/modeling-top-pocket-browser-flow.mjs');
const editor = read('packages/barocss-cad-editor/src/react/modeling-editor.tsx');
const workspace = read('packages/barocss-cad-editor/src/react/modeling-workspace.tsx');
const app = read('apps/cad-editor/src/app.tsx');
const route = read('apps/cad-editor/src/prism-feature-app.tsx');
let checks = 0;
function includes(data, term) {
  assert.ok(data.includes(term), 'Missing source contract: ' + term);
  checks++;
}
function workspaceContract(source) {
  const require = (data, term) => assert.ok(data.includes(term), 'Missing active workspace contract: ' + term);
  require(source.app, "location.hash === '#/model'");
  require(source.app, '<ModelingApp />');
  require(source.route, '<CadEditorModeling workspace />');
  // Never satisfy workspace commands using the retained legacy fallback JSX.
  const start = source.editor.indexOf('if (workspace) return <ModelingWorkspace');
  const end = source.editor.indexOf('return <section className="barocss-cad-editor"', start);
  assert.ok(start >= 0 && end > start, 'Current workspace return must precede the legacy return');
  const active = source.editor.slice(start, end);
  for (const token of ['examples: examplesPanel', 'dimensions: dimensionsPanel', 'files: filesPanel',
    'inspect: inspectionPanel', 'visibilityPanel', 'onApply={applyDimensions}', 'onCancelDimensions={cancelDimensions}']) require(active, token);
  for (const token of ['data-testid="modeling-workspace"', 'data-testid={`modeling-panel-${name}`}',
    'className="modeling-workspace-status" role="status"', "'Accepted model'", "'Dimension changes pending'",
    "command('examples', 'Modeling examples'", "command('dimensions', props.dimensionLabel",
    "command('files', 'Save or open a model'", "command('outputs', 'Output bodies'",
    "command('inspect', 'Inspect selection'", "'Apply dimensions'", 'onClick={props.onCancelDimensions}>Cancel</button>',
    'aria-label="Undo"', 'aria-label="Redo"']) require(source.workspace, token);
}
const current = { app, route, editor, workspace };
workspaceContract(current); checks++;
// Actual assertion controls: fallback tokens cannot launder a missing active route/command.
const negatives = [
  { ...current, route: route.replace('<CadEditorModeling workspace />', '<CadEditorModeling />') },
  { ...current, workspace: '' },
  { ...current, workspace: workspace.replace('className="modeling-workspace-status"', 'className="obsolete-status"') },
  { ...current, workspace: workspace.replaceAll("'Apply dimensions'", "'Obsolete apply'") },
  { ...current, workspace: workspace.replace('onClick={props.onCancelDimensions}>Cancel</button>', 'onClick={props.onCancelDimensions}>Obsolete cancel</button>') },
  { ...current, editor: editor.replace('dimensions: dimensionsPanel', 'dimensions: null') },
];
for (const source of negatives) { assert.throws(() => workspaceContract(source)); checks++; }
for (const text of [
  'Cut a top-entry pocket', 'value="top-entry-pocket"', 'Pocket depth downward from top Z=8',
  'Tool Y origin', 'Tool Y span', 'Choose one output to inspect', 'Choose model file',
  'Open saved model', 'Download model', 'Saved model data', 'Replace accepted model and discard its history'
]) includes(editor, text);
for (const token of [
  "await page.goto('http://127.0.0.1:' + port + '/#/model')", "getByTestId('modeling-workspace')",
  "footer.modeling-workspace-status > span", "modeling-panel-inspect", "modeling-panel-files",
  "await command(page, 'CREATE', 'Modeling examples', 'examples')",
  "await command(page, 'MODIFY', 'Edit model dimensions', 'dimensions')",
  "await command(page, 'FILE', 'Save or open a model', 'files')",
  "await command(page, 'INSPECT', 'Output bodies', 'outputs')",
  "await command(page, 'INSPECT', 'Inspect selection', 'inspect')",
  "panel(page, 'examples').getByRole('checkbox'", "panel(fresh, 'files').getByRole('checkbox'",
  "selectOption('top-entry-pocket')", "assert.equal(await partVolume(page), '5632 / 1 mm³')",
  "assert.equal(await partVolume(page), '5376 / 1 mm³')", "assert.equal(await partVolume(fresh), '5504 / 1 mm³')",
  "name: 'Undo'", "name: 'Redo'", "name: 'Apply dimensions'", "name: 'Cancel', exact: true",
  "page.waitForEvent('download')", "download.path()", "page.waitForEvent('filechooser')",
  "modal.setFiles", "fresh.getByRole('button', { name: 'Open saved model' })",
  "await screenshot(page, 'refused-two-body')", "invalid-utf8.cad.json", "oversize.cad.json",
  "assert.deepEqual(receipt.pageErrors, [])", "receipt.result = 'UNRUN'", "receipt.result = 'FAILED'",
  "receipt.result = 'PASSED_BROWSER'", "sha256: sha(bytes)", "await browser?.close()",
  "server.kill('SIGTERM')", 'node --check apps/cad-editor/flows/modeling-top-pocket-browser-flow.mjs',
]) includes(flow, token);
assert.ok(!flow.includes(':scope > p[role="status"]'), 'Old legacy status selector must not return'); checks++;
assert.ok(!flow.includes("name: 'Discard draft'"), 'Workspace Cancel replaces the legacy Discard action'); checks++;
assert.ok(!flow.includes("filter({ hasText: 'Save or open a model' })"), 'File access must use the active command and panel'); checks++;
assert.ok(!flow.includes('/Users/user/'), 'Flow must not depend on a private machine path'); checks++;
assert.ok(!flow.includes('mock'), 'Flow must not substitute mocked device evidence'); checks++;
assert.ok(!Object.hasOwn(JSON.parse(read('apps/cad-editor/package.json')).scripts, 'test'), 'Keep app runtime checks local; do not restore the obsolete PR alias'); checks++;
console.log(JSON.stringify({ status: 'PASS', checks, workspaceNegativeControls: negatives.length,
  tier: 'local source and syntax only; real browser/GPU/physical file UNRUN' }));
