// Shared helper for the actual-Studio Playwright drivers (apps/cad-studio/test/*-browser.mjs). It owns the plumbing every driver used to copy: Vite server, one Chrome, fresh contexts, console/page error capture,
// file-watch changes, the frozen-source capsule (before / after / after cleanup), the receipt, per-step snapshots, Open / Save, framing and world clicks, toasts, Undo / Redo, the Parameters panel,
// the feature editor, the Extrude HUD, the embedded Python oracle (python3 -I, JSON on stdin, zero product imports) and the bundled product inspector. Page helpers always act on the CURRENT page (flow.page), so they stay valid after newPage().
// The heavy gate is taken by the caller's shell, never here. This helper never touches git and never edits product files.
//
// Minimal driver skeleton (run from apps/cad-studio; env PW_DIR, CHROME and <ENV_FROZEN>=1 as before):
//   import assert from 'node:assert/strict';
//   import { createFlow } from './flow-helper.mjs';
//   const f = await createFlow({ name: 'demo', envFrozen: 'DEMO_SOURCE_FROZEN', output: process.argv[2], qualification: 'DEMO',
//     limits: ['what the run does not prove'], initialFiles: ['apps/cad-studio/test/demo-browser.mjs'], requiredFrozen: ['apps/cad-studio/src/App.tsx'],
//     oracleSource: PYTHON_SOURCE, inspectorSource: INSPECTOR_TS, snapshotExtra: () => ({ myField: document.title }) });
//   await f.run(async () => {                       // run = start (sources, Vite, Chrome) + body + final assertions + receipt + cleanup
//     await f.newPage(); await f.page.click('[aria-label="New part"]'); await f.ready();
//     f.phase = 'sketch'; await f.command('Sketch');
//     const state = await f.snapshot('01-sketch');   // json + html + png + receipt.states entry
//     const saved = await f.save('demo');            // { file, doc }; native download compared with the accepted document
//     await f.freshOpen(saved.file, saved.doc, '02-fresh-open');
//     await f.runOracle({ doc: saved.doc }, '02');   // writes <label>-oracle-input/oracle/.stderr files, asserts exit 0 and status PASS
//   });
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

/** sha256 hex digest of a string or buffer. */
export const sha256 = value => createHash('sha256').update(value).digest('hex');

/** Hash every file (repo-relative, de-duplicated, sorted) and write source-<label>.json into output; returns { relativeFile: sha256 }. */
export async function capsule(repo, output, label, files) {
  const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort();
  assert.ok(unique.length <= 4096, 'capsule size');
  const hashes = {};
  for (const file of unique) hashes[file] = sha256(await readFile(resolve(repo, file)));
  await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2));
  return hashes;
}

/** Write the oracle input, run `python3 -I <script>` with it on stdin, write the oracle output / stderr beside it, record into report.oracles and assert exit 0 and status PASS; returns the parsed output. */
export async function runOracleFile({ output, report, persist, script, input, label }) {
  await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', script], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
  await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stdout: check.stdout ? JSON.parse(check.stdout) : null, stderr: check.stderr }); await persist();
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); const parsed = JSON.parse(check.stdout); assert.equal(parsed.status, 'PASS'); return parsed;
}

/**
 * Create a flow: asserts the env, makes the output folder, writes the oracle script and returns the flow object (page helpers, report, receipt). Options:
 * name (file prefix), envFrozen (env var that must be '1'), output (artifact dir), qualification, limits, initialFiles (frozen subset), requiredFrozen (must be in the capsule), extraFrozen (more frozen files),
 * oracleSource (python text), inspectorSource (TS text for the bundled product inspector), snapshotExtra (page function adding fields to every snapshot).
 */
export async function createFlow(options) {
  const { name, envFrozen, qualification, limits = [], initialFiles = [], requiredFrozen = [], extraFrozen = [], oracleSource, inspectorSource, snapshotExtra } = options;
  assert.equal(process.env[envFrozen], '1', `Root must freeze all writers before the ${name} driver runs`);
  assert.ok(process.env.PW_DIR && process.env.CHROME && options.output, 'PW_DIR, CHROME and artifact directory required');
  const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(options.output);
  await mkdir(output, { recursive: true });
  const report = { status: 'RUNNING', qualification, visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [], limits };
  const f = { name, app, repo, output, report, phase: 'source preparation', server: null, browser: null, context: null, page: null, inspector: null, frozenFiles: [] };
  const oracleScript = join(output, `${name}-oracle.py`);
  if (oracleSource) { await writeFile(oracleScript, oracleSource); report.oracleSource = { hash: sha256(oracleSource), productImports: 0 }; }
  const ownFile = relative(repo, import.meta.filename);

  /** Write receipt.json (report plus the current phase); called after every step. */
  f.persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase: f.phase }, null, 2));
  /** Frozen-source capsule of `files` under this flow's repo and output. */
  f.capsule = (label, files) => capsule(repo, output, label, files);

  // Locators (current page).
  /** The node feature editor panel. */
  f.editor = () => f.page.locator('.node-editor');
  /** The Sketch panel (complementary landmark). */
  f.sketchPanel = () => f.page.getByRole('complementary', { name: 'Sketch', exact: true });
  /** The Extrude HUD dialog. */
  f.hud = () => f.page.getByRole('dialog', { name: 'Extrude', exact: true });

  // Document and body reads.
  /** The document in JSON form (a key holding undefined is absent, as in a saved file). */
  f.doc = () => f.page.evaluate(() => JSON.parse(JSON.stringify(window.__studioDoc)));
  /** The Studio body list (window.__studioBodies()). */
  f.bodies = () => f.page.evaluate(() => window.__studioBodies());
  /** Wait until the Studio is fresh and the mass is ready. */
  f.ready = () => f.page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 });
  /** Wait until the Studio document equals `expected`, then assert it. */
  f.same = async expected => { await f.page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await f.ready(); assert.deepEqual(await f.doc(), JSON.parse(JSON.stringify(expected))); };
  /** Wait until the Studio document differs from `previous`. */
  f.changed = async previous => { await f.page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(previous), { timeout: 60000 }); await f.ready(); };

  // Toasts. The text includes the icon name ("info..."), so match by contains.
  /** The text of every toast. */
  f.toasts = () => f.page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
  /** Dismiss the alert toast (button 'Dismiss', exact) and wait until no toast is left. */
  f.dismissToasts = async () => {
    const notice = f.page.locator('.toast[role="alert"]'); if (await notice.count()) await notice.first().getByRole('button', { name: 'Dismiss', exact: true }).click().catch(() => {});
    await f.page.waitForFunction(() => document.querySelectorAll('.toast').length === 0, null, { timeout: 30000 });
  };
  /** Wait for a toast whose text matches `re` (contains semantics); returns that text. */
  f.waitToast = async (re, timeout = 15000) => {
    const handle = await f.page.waitForFunction(([source, flags]) => { const r = new RegExp(source, flags); return [...document.querySelectorAll('.toast')].map(x => x.textContent ?? '').find(t => r.test(t)) ?? false; }, [re.source, re.flags], { timeout });
    return handle.jsonValue();
  };

  /** Settle two animation frames, record the state (doc, bodies, selection, notices, panels, history plus snapshotExtra / `extra` fields) into report.states and write <label>.json / .html / .png. */
  f.snapshot = async (label, extra = snapshotExtra) => {
    await f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const base = await f.page.evaluate(label => ({ label, doc: JSON.parse(JSON.stringify(window.__studioDoc)), bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
      editor: document.querySelector('.node-editor')?.textContent ?? null, sketchPanel: document.querySelector('.sk-panel')?.textContent ?? null, hud: document.querySelector('.hud')?.textContent ?? null,
      sketchAlert: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null, sketchStatus: document.querySelector('.sk-panel [role="status"]')?.textContent ?? null,
      history: [...document.querySelectorAll('.history .hs')].map(b => b.getAttribute('aria-label')) }), label);
    const state = { ...base, ...(extra ? await f.page.evaluate(extra) : {}) };
    report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2)); await writeFile(join(output, `${label}.html`), await f.page.content()); await f.page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await f.persist(); return state;
  };

  /** Close the previous context (if any) and open a fresh one (1440 x 1000) on the Studio, with error / console / download / dialog capture; waits for the WebGPU viewport and ready. */
  f.newPage = async () => {
    if (f.context) { await f.context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
    f.context = await f.browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); const page = f.page = await f.context.newPage();
    page.on('pageerror', e => report.errors.push(e.stack ?? String(e))); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
    page.on('download', d => report.downloads.push({ phase: f.phase, suggestedFilename: d.suggestedFilename() })); page.on('dialog', d => d.accept());
    await page.goto(f.server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await f.ready();
  };
  /** Open a model file through the file input and wait for `nodeCount` nodes. */
  f.openFile = async (file, nodeCount) => { await f.page.setInputFiles('input[aria-label="Model file"]', file); await f.page.waitForFunction(n => window.__studioDoc?.nodes?.length === n, nodeCount, { timeout: 60000 }); await f.ready(); };
  /** New context, Open `file`, wait for the document to equal `expectedDoc`, snapshot `label`. */
  f.freshOpen = async (file, expectedDoc, label) => { f.phase = `fresh Open ${label}`; await f.newPage(); await f.openFile(file, expectedDoc.nodes.length); await f.same(expectedDoc); return f.snapshot(label); };
  /** Native Save (toolbar button 'Save', exact): the download is stored as <label>.bcad, compared with the accepted document and recorded in report.files; returns { file, doc }. */
  f.save = async label => {
    f.phase = `native Save ${label}`; await f.ready(); const accepted = await f.doc();
    const [download] = await Promise.all([f.page.waitForEvent('download'), f.page.getByRole('button', { name: 'Save', exact: true }).click()]);
    const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
    report.files.push({ file, hash: sha256(bytes), semanticEquality: true }); return { file, doc: accepted };
  };

  // Palette, tools, canvas.
  /** Open the palette (Space), type `text`, Enter. */
  f.command = async text => { await f.page.keyboard.press('Space'); await f.page.locator('.palette input').fill(text); await f.page.keyboard.press('Enter'); };
  /** Screen pixel [x, y] of the world point [x, y] (z 0) through the readonly window.__studioScreenOf hook. */
  f.screenOf = point => f.page.evaluate(point => window.__studioScreenOf?.(point), [...point, 0]);
  /** Real mouse click at the pixel of the world point (asserts the pixel exists); returns the pixel. */
  f.worldClick = async point => { const pixel = await f.screenOf(point); assert.ok(pixel?.length === 2, 'screen position of the point'); await f.page.mouse.click(pixel[0], pixel[1]); await f.page.waitForTimeout(150); return pixel; };
  /** Zoom out with the wheel until every world point is on the canvas (not under a panel); records 'framing' in report.observations. */
  f.frame = async points => {
    const tries = [];
    for (let i = 0; i < 10; i++) {
      const read = await f.page.evaluate(points => { const c = document.querySelector('.vp-canvas'), r = c.getBoundingClientRect();
        const px = points.map(p => window.__studioScreenOf([p[0], p[1], 0])), z = window.__studioScreenOf([0, 0, 0]), o = window.__studioScreenOf([1, 0, 0]);
        const hits = px.map(q => q && q[0] > r.left + 24 && q[0] < r.right - 24 && q[1] > r.top + 24 && q[1] < r.bottom - 24 && !!document.elementFromPoint(q[0], q[1])?.closest('.vp-canvas'));
        return { canvas: [r.left, r.top, r.width, r.height], px, pxPerMm: z && o ? Math.hypot(o[0] - z[0], o[1] - z[1]) : null, allOnCanvas: hits.every(Boolean) }; }, points);
      tries.push(read); if (read.allOnCanvas) { report.observations.push({ label: 'framing', tries }); await f.persist(); return read; }
      const [left, top, width, height] = read.canvas; await f.page.mouse.move(left + width / 2, top + height / 2); await f.page.mouse.wheel(0, 400); await f.page.waitForTimeout(400);
    }
    report.observations.push({ label: 'framing-failed', tries }); await f.persist(); assert.fail('the points could not be framed on the canvas');
  };
  /** Pick a sketch tool by its toolbar button name (exact), else by its key with the input blurred; records tool-<name> in report.observations. */
  f.tool = async (toolName, key) => {
    const b = f.page.getByRole('button', { name: toolName, exact: true }); const count = await b.count(); report.observations.push({ label: `tool-${toolName}`, buttons: count });
    if (count === 1) await b.click(); else { await f.page.evaluate(() => document.activeElement?.blur()); await f.page.keyboard.press(key); }
    await f.page.waitForTimeout(100);
  };
  /** Text of the sketch panel alert, or null. */
  f.sketchAlert = () => f.page.evaluate(() => document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null);
  /** Text content of the sketch panel. */
  f.sketchPanelText = () => f.page.evaluate(() => document.querySelector('.sk-panel')?.textContent ?? '');
  /** Finish the sketch with the top bar button, wait for the panel to go, snapshot `label`. */
  f.finishSketch = async label => { f.phase = `Finish sketch ${label}`; await f.page.locator('.topbar button.finish').click(); await f.sketchPanel().waitFor({ state: 'hidden' }); await f.ready(); return f.snapshot(label); };

  // Undo / Redo.
  /** Undo with the toolbar button when enabled, else Meta+z; waits 800 ms and ready. */
  f.undo = async () => {
    await f.page.evaluate(() => document.activeElement?.blur()); const b = f.page.getByRole('button', { name: 'Undo', exact: true });
    if (await b.count() === 1 && await b.isEnabled()) await b.click(); else await f.page.keyboard.press('Meta+z'); await f.page.waitForTimeout(800); await f.ready();
  };
  /** Redo with the toolbar button when enabled, else Meta+Shift+z. */
  f.redo = async () => { const b = f.page.getByRole('button', { name: 'Redo', exact: true }); if (await b.count() === 1 && await b.isEnabled()) await b.click(); else await f.page.keyboard.press('Meta+Shift+z'); };

  // Feature editor.
  /** The editor's labelled inputs as [{ label, value, disabled }]. */
  f.editorFields = () => f.page.evaluate(() => [...document.querySelectorAll('.node-editor input[aria-label]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value, disabled: i.disabled })));
  /** Close the feature editor when it is visible. */
  f.closeEditor = async () => { if (await f.editor().isVisible()) { await f.editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await f.editor().waitFor({ state: 'hidden' }); } };
  /** Open the feature editor of node `index` through its history button. */
  f.openFeatureEditor = async (index, label = String(index)) => { f.phase = `open feature editor ${label}`; await f.ready(); await f.page.evaluate(() => document.activeElement?.blur()); await f.page.locator(`.history .hs[data-node-index="${index}"]`).click(); await f.editor().waitFor(); };
  /** Click Apply in the feature editor, wait for the document to change from `previous`, close the editor, snapshot `label`. */
  f.applyEditor = async (previous, label) => { f.phase = `Apply feature editor ${label}`; await f.editor().getByRole('button', { name: 'Apply', exact: true }).click(); await f.changed(previous); await f.closeEditor(); await f.ready(); return f.snapshot(label); };

  // Extrude HUD.
  /** With a sketch selected: blur, press `e`, wait for the HUD and its preview / refused status. */
  f.openExtrudeHud = async (key = 'e') => { await f.page.evaluate(() => document.activeElement?.blur()); await f.page.keyboard.press(key); await f.hud().waitFor(); await f.page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 }); };
  /** In the open Extrude HUD: Operation new, Depth distance, Distance `distance`, wait for preview, Apply, wait for the change from `previous`; records <label>-extrude-hud and snapshots <label>-extruded. */
  f.applyExtrude = async ({ distance, previous, label }) => {
    const operation = await f.page.evaluate(() => { const s = document.querySelector('.hud select[aria-label="Operation"]'); return s ? { value: s.value, options: [...s.options].map(o => o.value) } : null; });
    const depthSelect = await f.hud().getByLabel('Depth', { exact: true }).count();
    report.observations.push({ label: `${label}-extrude-hud`, operation, depthSelect, hudText: await f.page.evaluate(() => document.querySelector('.hud')?.textContent ?? null) });
    if (operation && operation.options.includes('new') && operation.value !== 'new') await f.hud().getByLabel('Operation', { exact: true }).selectOption('new');
    if (depthSelect) await f.hud().getByLabel('Depth', { exact: true }).selectOption('distance');
    const field = f.hud().getByLabel('Distance', { exact: true }); await field.waitFor(); await field.fill(String(distance));
    await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
    await f.hud().getByRole('button', { name: 'Apply', exact: true }).click(); await f.changed(previous); await f.hud().waitFor({ state: 'hidden' }); return f.snapshot(`${label}-extruded`);
  };

  // Parameters panel (hidden while a feature editor or sketch is active, so the editor is closed first).
  /** Open the Parameters panel; returns its locator. */
  f.openParameters = async () => { await f.ready(); await f.closeEditor(); await f.page.click('[aria-label="Parameters"]'); const panel = f.page.locator('aside[aria-label="Parameters panel"]'); await panel.waitFor(); return panel; };
  /** Close the Parameters panel. */
  f.closeParameters = async panel => { await f.page.click('[aria-label="Close parameters"]'); await panel.waitFor({ state: 'hidden' }); };
  /** Add a parameter (name, value) in the panel, wait for it in the document, close the panel, snapshot `label`. */
  f.addParameter = async (paramName, value, label) => {
    f.phase = `add parameter ${paramName} ${label}`; const panel = await f.openParameters();
    await panel.getByLabel('New parameter name', { exact: true }).fill(paramName); await panel.getByLabel('New parameter value', { exact: true }).fill(String(value)); await panel.getByRole('button', { name: 'Add parameter', exact: true }).click();
    await f.page.waitForFunction(([n, v]) => window.__studioDoc?.parameters?.[n] === v, [paramName, value], { timeout: 60000 }); await f.ready(); await f.closeParameters(panel); return f.snapshot(label);
  };
  /** Set a parameter value (Enter in its 'Value of <name>' field), asserting the panel shows the current value first; closes the panel and snapshots `label`. */
  f.setParameter = async (paramName, value, label) => {
    f.phase = `set parameter ${paramName} ${label}`; const before = await f.doc(), panel = await f.openParameters(); const field = panel.getByLabel(`Value of ${paramName}`, { exact: true }); await field.waitFor();
    assert.equal(Number(await field.inputValue()), before.parameters[paramName], `${label}: the panel shows the current ${paramName}`);
    await field.fill(String(value)); await field.press('Enter');
    await f.page.waitForFunction(([n, v]) => window.__studioDoc?.parameters?.[n] === v, [paramName, value], { timeout: 60000 }); await f.ready(); await f.closeParameters(panel); return f.snapshot(label);
  };

  // Oracle and product inspector.
  /** Run the embedded Python oracle (python3 -I, JSON on stdin) on `input`; see runOracleFile. */
  f.runOracle = (input, label) => runOracleFile({ output, report, persist: f.persist, script: oracleScript, input, label });
  /** Write `accepted` as <label>-doc.bcad, run the bundled product inspector on it (extra args JSON-encoded), keep stdout / stderr files, assert exit 0 and return the parsed read. */
  f.inspect = async (label, accepted, ...extra) => {
    const file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
    const run = spawnSync(process.execPath, [f.inspector, file, ...extra.map(x => JSON.stringify(x))], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 });
    await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr); return JSON.parse(run.stdout);
  };
  /** Bundle the inspector TS (stdin, resolved from the app folder, esbuild, node22 ESM) into <output>/inspector.mjs; returns the on-disk build inputs to freeze. */
  f.buildInspector = async entryTs => {
    const sourcefile = `${name}-inspector.ts`, virtual = resolve(app, sourcefile);
    const built = await build({ stdin: { contents: entryTs, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
    await writeFile(join(output, 'inspector.ts'), entryTs); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
    // Stdin has no disk path. Its exact source/hash is captured and the virtual input is explicitly excluded.
    report.virtualSources = [{ label: 'inspector', hash: sha256(entryTs), virtualInputExcluded: virtual }];
    f.inspector = join(output, 'inspector.mjs'); await writeFile(f.inspector, built.outputFiles[0].contents);
    return Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual);
  };

  /** Source capsule, inspector build, frozen capsule (compared with the initial subset), Vite server on a free port (watch changes into report.changes) and one headless Chrome (WebGPU). */
  f.start = async () => {
    const initial = [...initialFiles, ownFile];
    report.sourceBefore = await f.capsule('initial-subset', initial); report.sourceBeforeCount = Object.keys(report.sourceBefore).length;
    const buildInputs = inspectorSource ? await f.buildInspector(inspectorSource) : [];
    const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
    f.frozenFiles = [...initial, ...buildInputs, ...studioFiles, ...extraFrozen, 'apps/cad-studio/vite.config.ts'];
    report.sourceFrozen = await f.capsule('frozen', f.frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
    for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
    for (const need of requiredFrozen) assert.ok(report.sourceFrozen[need], `${need} is in the frozen capsule`);
    f.phase = 'actual Studio start';
    f.server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
    f.server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await f.server.listen();
    const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
    f.browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;
  };

  /** Run `body(flow)` after start(); then assert no page / console errors and no file changes and that the source capsule is unchanged (PASS); on any failure record FAIL and a 'failure' snapshot; always close context / browser / server, re-check the capsule after cleanup, write the receipt and print the one-line result. */
  f.run = async body => {
    try {
      await f.start(); await body(f);
      assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
      report.sourceAfter = await f.capsule('after', f.frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
    } catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (f.page) try { await f.snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
    finally {
      for (const [resource, label] of [[f.context, 'CONTEXT'], [f.browser, 'BROWSER'], [f.server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
      try { report.sourceAfterCleanup = await f.capsule('after-cleanup', f.frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
      await f.persist(); // eslint-disable-next-line no-console
      console.log(JSON.stringify({ status: report.status, phase: f.phase, failure: report.failure, output }));
    }
  };
  return f;
}
