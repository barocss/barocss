// DA-DUP-1 / #2243: sequential actual Studio Open, issue fixes, Save, fresh Open and Undo/Redo.
// Run only after product sources are frozen, with no other browser flow running:
// PW_DIR=/absolute/playwright CHROME=/absolute/chrome node test/drawing-independent-location-browser.mjs /absolute/artifacts
// Optional FLOW_RENDERER=webgl2 follows browser-flow.mjs; default is WebGPU.
// Fixture: byte copy of drawing-da1a-20261029T084920/accepted.bcad under
// /Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/.
// Original SHA256: 6b2cb00f30dcb17943164dfab0843e94677317d425cad9c764a649792c21b4b1.
// This fixture is input, not an accepted output of the repaired product.
// All application mutations use public controls. Existing dev hooks only observe actual state.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory are required; no silent skip');
const app = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2]);
const fixture = join(import.meta.dirname, 'fixtures/drawing-independent-location.bcad');
const fixtureBytes = await readFile(fixture), fixtureSHA256 = createHash('sha256').update(fixtureBytes).digest('hex');
assert.equal(fixtureSHA256, '6b2cb00f30dcb17943164dfab0843e94677317d425cad9c764a649792c21b4b1');
await mkdir(output, { recursive: true });
const states = [], errors = [], consoleErrors = [], changes = [];
const cleanup = { context: 'NOT_STARTED', browser: 'NOT_STARTED', server: 'NOT_STARTED', priorContexts: [] };
let phase = 'startup', browser, context, page, server;
const report = { status: 'RUNNING', fixtureSHA256, renderer: process.env.FLOW_RENDERER ?? 'webgpu', states, errors, consoleErrors, changes, cleanup,
  limits: ['Finite captured sheet L-bracket and authored square-grid cases', 'No model edit differential or independent geometry accuracy claim', 'No PDF, remote CI or live AI verification'] };
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
// Drawing edge-reference sig refresh is permitted metadata for this captured fixture.
// Nodes and parameters use exact deep equality, without signature stripping.
const semantic = value => Array.isArray(value) ? value.map(semantic) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'sig').map(([key, entry]) => [key, semantic(entry)])) : value;
const withoutPlace = value => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'place'));
const fixtureDoc = JSON.parse(fixtureBytes);
const dimension = (state, id) => state.doc.drawing.dimensions.find(item => item.id === id);
const targetEdges = ['n0.leg1.a|n2.side0#2', 'n0.leg0.a|n5.side0#2'];
function assertPair(state, original) {
  for (const [index, id] of ['d3', 'd9'].entries()) {
    const dim = dimension(state, id), resolved = state.sheet.dimensions.find(item => item.id === id);
    assert.ok(dim, `${id} must remain`); assert.equal(dim.b.edge, targetEdges[index]);
    assert.equal(resolved?.text, '15', `${id} must resolve to 15`);
    if (original) {
      assert.deepEqual(semantic(withoutPlace(dim)), semantic(withoutPlace(dimension(original, id))), `${id} reference and authored fields must remain`);
    }
  }
  assert.deepEqual(state.doc.nodes, fixtureDoc.nodes);
  assert.deepEqual(state.doc.parameters, fixtureDoc.parameters);
  assert.ok(!state.issueRows.some(item => item.code === 'DUPLICATE' && /^15 is given twice/.test(item.text)), 'independent 15/15 targets must not be duplicate');
}
async function snapshot(label) {
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, sheet: window.__studioDrawing?.(), bodies: window.__studioBodies?.(),
    rendererObserved: document.querySelector('.viewport')?.dataset.renderer ?? null,
    publicStats: document.querySelector('.corner-left')?.textContent ?? null,
    issueRows: [...document.querySelectorAll('[aria-label="Drawing issues"] .dw-issue')].map(row => ({ code: row.title, text: row.textContent })),
    visibleIssues: document.querySelector('[aria-label="Drawing issues"]')?.textContent }), label);
  states.push(state); await persist(); await page.screenshot({ path: join(output, `${label}.png`) }); return state;
}
async function freshPage() {
  if (context) { await context.close(); cleanup.priorContexts.push('CLOSED'); cleanup.context = 'CLOSED'; }
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  cleanup.context = 'OPEN'; page = await context.newPage();
  page.on('pageerror', error => errors.push(error.stack ?? String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(server.resolvedUrls.local[0] + (report.renderer === 'webgl2' ? '?renderer=webgl2' : ''));
  await page.waitForFunction(() => window.__studioDoc && window.__studioFresh === true, null, { timeout: 30000 });
  await page.waitForSelector(`.viewport[data-renderer="${report.renderer}"]`, { timeout: 30000 });
  report.rendererObserved = await page.locator('.viewport').getAttribute('data-renderer');
}
async function open(file, nodeCount = 7) {
  await page.setInputFiles('input[aria-label="Model file"]', file);
  await page.waitForFunction(count => window.__studioDoc?.nodes.length === count && window.__studioFresh === true && window.__studioBodies?.().massReady === true, nodeCount, { timeout: 60000 });
  await page.click('.mode button:text-is("Drawing")');
  await page.waitForFunction(() => Array.isArray(window.__studioDrawing?.()?.dimensions), null, { timeout: 60000 });
}
async function save(label) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[aria-label="Save"]')]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file);
  const saved = JSON.parse(await readFile(file, 'utf8')), current = await page.evaluate(() => window.__studioDoc);
  assert.deepEqual(saved.nodes, current.nodes);
  assert.deepEqual(saved.parameters, current.parameters);
  assert.deepEqual(semantic(saved.drawing), semantic(current.drawing));
  return file;
}
async function missing(label) {
  await page.waitForFunction(() => !window.__studioDoc.drawing.dimensions.some(item => item.id === 'd9') && window.__studioDrawing?.()?.issues.some(item => item.code === 'HOLE_NOT_LOCATED'), null, { timeout: 30000 });
  const state = await snapshot(label);
  assert.equal(state.sheet.dimensions.find(item => item.id === 'd3')?.text, '15');
  assert.ok(state.issueRows.some(item => item.code === 'HOLE_NOT_LOCATED' && /hole.*not located/.test(item.text)), 'public issue list must name the missing location');
  assert.deepEqual(state.doc.nodes, fixtureDoc.nodes);
  return state;
}
try {
  server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  cleanup.server = 'OPEN'; server.watcher.on('change', file => changes.push(file)); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: report.renderer === 'webgl2'
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--enable-unsafe-webgpu'] });
  cleanup.browser = 'OPEN'; await freshPage(); phase = 'public Open captured 15/15 fixture'; await open(fixture);
  const initial = await snapshot('01-open-both'); assertPair(initial);
  phase = 'public Fix all preserves independent targets';
  const fixAll = page.locator('[aria-label="Fix all issues"]');
  report.fixAllOffered = await fixAll.count() > 0;
  if (report.fixAllOffered) {
    await fixAll.click();
    await page.waitForFunction(() => /\d+ fixes? applied/.test(document.querySelector('.toast')?.textContent ?? ''), null, { timeout: 60000 });
  }
  const fixed = await snapshot('02-after-fix-all'); assertPair(fixed, initial);
  phase = 'Save and fresh-context Open both targets'; const bothFile = await save('both-targets');
  await freshPage(); await open(bothFile); const reopened = await snapshot('03-fresh-open-both'); assertPair(reopened, initial);
  assert.deepEqual(semantic(reopened.doc.drawing), semantic(fixed.doc.drawing));
  phase = 'public remove second target location';
  const row = page.locator('.dw-dims .dw-dim').filter({ hasText: 'horizontal · right' }).filter({ has: page.locator('b:text-is("15")') });
  assert.equal(await row.count(), 1, 'public row must identify only d9');
  await row.locator('[aria-label="Remove dimension 15"]').click(); const removed = await missing('04-missing-second-location');
  phase = 'public Undo and Redo'; await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => window.__studioDoc.drawing.dimensions.some(item => item.id === 'd9') && window.__studioDrawing?.()?.dimensions.some(item => item.id === 'd9' && item.text === '15') && !window.__studioDrawing?.()?.issues.some(item => item.code === 'HOLE_NOT_LOCATED'), null, { timeout: 30000 });
  const undone = await snapshot('05-undo'); assertPair(undone, initial);
  assert.deepEqual(semantic(undone.doc.drawing), semantic(reopened.doc.drawing));
  await page.keyboard.press('Meta+Shift+z'); const redone = await missing('06-redo');
  assert.deepEqual(semantic(redone.doc.drawing), semantic(removed.doc.drawing));
  phase = 'Save and fresh-context Open missing second target'; const missingFile = await save('missing-second-target');
  await freshPage(); await open(missingFile); const missingOpen = await missing('07-fresh-open-missing');
  assert.deepEqual(semantic(missingOpen.doc.drawing), semantic(removed.doc.drawing));
  phase = 'public single missing-location Auto fix';
  const locationIssue = page.locator('[aria-label="Drawing issues"] .dw-issue[title="HOLE_NOT_LOCATED"]');
  await locationIssue.locator('button').click();
  await page.waitForFunction(() => !window.__studioDrawing?.()?.issues.some(item => item.code === 'HOLE_NOT_LOCATED'), null, { timeout: 60000 });
  const repaired = await snapshot('08-location-auto-fix');
  for (const [index, edge] of targetEdges.entries()) {
    const view = index === 0 ? 'top' : 'right', orient = index === 0 ? 'vertical' : 'horizontal';
    const dims = repaired.doc.drawing.dimensions.filter(item => item.kind === 'linear' && item.view === view && item.orient === orient && [item.a?.edge, item.b?.edge].includes(edge));
    assert.ok(dims.some(dim => repaired.sheet.dimensions.some(item => item.id === dim.id && item.text === '15')), `${edge} must have its own location dimension after Auto`);
  }
  assert.deepEqual(repaired.doc.nodes, initial.doc.nodes); assert.deepEqual(repaired.doc.parameters, initial.doc.parameters);
  phase = 'same-view grid input from authored conformance document';
  const gridSource = join(app, '../../packages/barocss-cad/conformance/r14/pcd-square-grid/case.json');
  const gridBytes = await readFile(gridSource), gridCase = JSON.parse(gridBytes);
  const gridDocument = { ...gridCase.input.document, drawing: { ...gridCase.input.drawing, dimensions: [] } };
  assert.equal(gridDocument.nodes.length, 6); assert.equal(gridDocument.drawing.dimensions.length, 0);
  const gridFile = join(output, 'grid-input.bcad'), gridInput = JSON.stringify(gridDocument, null, 2) + '\n';
  await writeFile(gridFile, gridInput);
  report.grid = { source: gridSource, sourceSHA256: createHash('sha256').update(gridBytes).digest('hex'), inputFile: gridFile,
    inputSHA256: createHash('sha256').update(gridInput).digest('hex'), coverage: 'NOT_RUN',
    inputConstruction: 'input.document plus input.drawing with explicit empty dimensions; no generated runtime result supplied' };
  await freshPage(); await open(gridFile, 6); await snapshot('09-grid-open-empty');
  phase = 'public grid Auto-dimension preserves each independent hole position';
  await page.click('[aria-label="Auto-dimension"]');
  await page.waitForFunction(() => window.__studioDoc.drawing.dimensions.length > 0 && window.__studioDrawing?.()?.dimensions.length === window.__studioDoc.drawing.dimensions.length, null, { timeout: 60000 });
  const grid = await snapshot('10-grid-auto-dimension');
  report.grid.rendererObserved = grid.rendererObserved;
  report.grid.issues = grid.issueRows;
  const placementCodes = ['TEXT_OVERLAP', 'TEXT_OVER_LINES', 'OFF_SHEET', 'VIEWS_DONT_FIT', 'DETAIL_NO_ROOM', 'SECTION_NO_ROOM'];
  report.grid.placementIssues = grid.issueRows.filter(item => placementCodes.includes(item.code));
  report.grid.placementStatus = report.grid.placementIssues.length ? 'ISSUES_OBSERVED' : 'NO_PLACEMENT_ISSUES_OBSERVED';
  // Keep all diagnostics in the receipt. This profile accepts target coverage, not overall drawing layout.
  report.grid.overallDrawingAcceptance = 'NOT_CLAIMED';
  await persist();
  assert.deepEqual(grid.doc.nodes, gridDocument.nodes); assert.deepEqual(grid.doc.parameters, gridDocument.parameters);
  const locations = grid.doc.drawing.dimensions.filter(item => item.kind === 'linear' && item.view === 'top' && [item.a?.at, item.b?.at].includes('center'));
  assert.equal(locations.length, 8, 'four independently authored holes need eight location dimensions');
  assert.equal(grid.doc.drawing.dimensions.length, 12, 'eight locations plus three overall dimensions and one grouped callout');
  for (const hole of gridDocument.nodes.filter(item => item.kind === 'hole')) {
    for (const [axis, orient] of ['horizontal', 'vertical'].entries()) {
      const own = locations.filter(item => item.orient === orient && [item.a, item.b].some(ref => ref?.at === 'center' && ref.edge.split('|').some(name => name.startsWith(hole.id + '.'))));
      assert.equal(own.length, 1, `${hole.id} must have its own ${orient} position`);
      const measured = grid.sheet.dimensions.find(item => item.id === own[0].id);
      assert.equal(measured?.text, String(hole.center[axis]), `${hole.id} ${orient} must display its authored 15/45 coordinate`);
    }
  }
  assert.ok(grid.sheet.dimensions.some(item => item.text === '4× Ø6 THRU'), 'grouped square-grid hole callout must remain');
  assert.ok(!grid.issueRows.some(item => item.code === 'DUPLICATE' || item.code === 'HOLE_NOT_LOCATED'), 'independent same-view positions must have no duplicate or missing-location diagnostic');
  report.grid.coverage = 'PASS';
  assert.equal(errors.length, 0, 'no page exception'); assert.equal(changes.length, 0, 'source must remain frozen during the flow');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.firstFailure = { phase, message: error.message, stack: error.stack };
  if (page && !page.isClosed()) await snapshot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  // Close each owned resource even when an earlier close fails. No other browser is started.
  for (const [kind, resource] of [['context', context], ['browser', browser], ['server', server]]) {
    if (!resource) continue;
    try { await resource.close(); cleanup[kind] = 'CLOSED'; }
    catch (error) {
      cleanup[kind] = { status: 'CLOSE_FAILED', message: error.message }; report.status = 'FAIL'; process.exitCode = 1;
      report.firstFailure ??= { phase: `cleanup ${kind}`, message: error.message, stack: error.stack };
    }
  }
  await persist();
}
process.stdout.write(JSON.stringify({ status: report.status, phase, output, cleanup, firstFailure: report.firstFailure }, null, 2) + '\n');
