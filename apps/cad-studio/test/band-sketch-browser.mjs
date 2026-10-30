// B1 qualification: an associative 2D band. Construction circles A (centre (0, 0), r 20) and B (centre (60, 0), r 10) are picked with the Band tool (button "Band", key M; a click inside a closed shape picks it),
// the BAND panel section (Offset, Width, "Make band") makes the band, Finish stores `profile: 'band'` with `band = { version, id, sources, offset?, width? }` and the two construction circles; the outline is regenerated
// (tangent lines and arcs; with a width a strip: outer at offset + width, hole at offset). The Extrude feature editor lists the band fields (Band offset, Band width, Band source k radius / centre X / centre Y), each bindable with the f select.
// Root must freeze all sources first. Run from apps/cad-studio:
//   BAND_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/band-sketch-browser.mjs /absolute/artifacts
// Actual Studio UI (New part, palette Sketch, Sketch plane select, Construction + Circle + Band toolbar buttons with canvas clicks via window.__studioScreenOf, BAND inputs, Make band, Finish, Extrude HUD, Extrude feature editor
// fields + Apply, Parameters panel Add / value field, the f bind select, history button + Edit sketch, Undo/Redo, Save, Open) mutates. Readonly hooks (window.__studioDoc / __studioBodies / __studioSelection / __studioScreenOf)
// observe only. The document starts EMPTY (no fixture). One Chrome WebGPU process, two sequential fresh contexts.
// Product read: a bundled inspector (product code, not an oracle) evaluates the document (volume, facade mass) and the refusal of the same document with the overlapping parameter value.
// The independent Python oracle (python3 -I, zero product imports) decides: the stored band node and its construction circles (parameters resolved), the strip area (belt envelope area at offset + width minus at offset, from the
// two-circle closed form (R1 + R2) C cos(b) + R1^2 (pi + 2b) / 2 + R2^2 (pi - 2b) / 2 with sin b = (R1 - R2) / C, cross-checked against a monotone-chain convex hull of 2 x 50000 sampled circle points) and
// the Studio volume = height x area within 1e-6 relative.
// Note on the overlap step: the circles overlap when R + 10 >= 60, so R = 55 is used (R = 45 would leave a 5 mm gap and is a valid band).
// A parameter value the evaluation refuses is refused by the Studio as a whole ("Parameters not changed" toast carrying the reason, the accepted document and body unchanged); the driver records which of the two it saw.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent check of a two-circle band sketch (strip or filled) and of its extruded volume. Product imports: zero."""
import json, math, sys

data = json.load(sys.stdin)
doc = data['doc']; exp = data['expect']; mode = data['mode']; reported = data.get('volume')
params = doc.get('parameters') or {}

def finite(v, path):
    if isinstance(v, bool): return  # (the construction flag)
    if isinstance(v, (int, float)): assert math.isfinite(v), ('non-finite', path)
    elif isinstance(v, list):
        for i, x in enumerate(v): finite(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): finite(x, path + '.' + k)
    elif v is None: raise AssertionError(('null', path))
finite(doc, 'doc')

def resolve(x):
    if isinstance(x, dict):
        assert list(x.keys()) == ['parameter'], ('binding shape', x)
        return float(params[x['parameter']])
    assert isinstance(x, (int, float)) and not isinstance(x, bool), ('not a plain number', x)
    return float(x)

def area(R1, R2, C):
    s = (R1 - R2) / C; assert abs(s) < 1, ('one circle inside the other', R1, R2, C)
    b = math.asin(s)
    return (R1 + R2) * C * math.cos(b) + 0.5 * R1 * R1 * (math.pi + 2 * b) + 0.5 * R2 * R2 * (math.pi - 2 * b)

def hull_area(circles, d, n=50000):
    pts = []
    for (cx, cy, r) in circles:
        for k in range(n): t = 2 * math.pi * k / n; pts.append((cx + (r + d) * math.cos(t), cy + (r + d) * math.sin(t)))
    pts = sorted(set(pts))
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    h = lower[:-1] + upper[:-1]
    return abs(sum(h[i][0] * h[(i + 1) % len(h)][1] - h[(i + 1) % len(h)][0] * h[i][1] for i in range(len(h)))) / 2

out = {'status': 'PASS', 'productImports': 0, 'mode': mode}
if mode == 'overlap':
    R = exp['R']; r2 = exp['r2']; C = exp['C']
    assert R + r2 > C and abs(R - r2) < C, ('the circles overlap (neither apart nor nested)', R, r2, C)
    out.update({'R': R, 'r2': r2, 'C': C, 'sum': R + r2, 'overlap': R + r2 - C})
elif mode == 'volume':
    nodes = doc['nodes']; assert [n['kind'] for n in nodes] == ['sketch', 'extrude'], [n['kind'] for n in nodes]
    sk, ex = nodes[0], nodes[1]
    assert sk['profile'] == 'band' and set(sk['band'].keys()) <= {'version', 'id', 'sources', 'offset', 'width'}, ('band node', sk.get('profile'), sk.get('band'))
    band = sk['band']; assert band['version'] == 1 and band['id'] == 'b1', band
    assert len(band['sources']) == 2 and len(set(band['sources'])) == 2, band['sources']
    cons = sk['construction']; assert len(cons) == 2 and all(c['kind'] == 'circle' for c in cons), cons
    circles = []
    for ref in band['sources']:
        match = [c for c in cons if ref in (c.get('ids') or [])]; assert len(match) == 1, ('source resolves to one circle', ref)
        c = match[0]; circles.append((resolve(c['c'][0]), resolve(c['c'][1]), resolve(c['r'])))
    bound = exp.get('bound') or {}
    for k, c in enumerate([[m for m in cons if ref in m['ids']][0] for ref in band['sources']]):
        for slot, value in (('r', c['r']), ('c0', c['c'][0]), ('c1', c['c'][1])):
            name = bound.get('%d%s' % (k, slot))
            if name: assert value == {'parameter': name}, ('binding of source %d %s' % (k + 1, slot), value, name)
            else: assert isinstance(value, (int, float)) and not isinstance(value, bool), ('plain number', k, slot, value)
    (x1, y1, R1), (x2, y2, R2) = circles
    assert [round(x1, 9), round(y1, 9), round(R1, 9), round(x2, 9), round(y2, 9), round(R2, 9)] == [exp['x1'], exp['y1'], exp['R1'], exp['x2'], exp['y2'], exp['R2']], ('source circles', circles, exp)
    C = math.hypot(x2 - x1, y2 - y1); assert abs(C - exp['C']) < 1e-9, ('centre distance', C)
    offset = resolve(band['offset']) if 'offset' in band else 0.0; width = resolve(band['width']) if 'width' in band else None
    assert offset == exp['offset'] and width == exp['width'], ('offset / width', offset, width, exp)
    ob = exp.get('boundBand') or {}
    for key in ('offset', 'width'):
        if key in ob: assert band[key] == {'parameter': ob[key]}, (key, band.get(key))
    outer = offset + (width or 0.0)
    strip = area(R1 + outer, R2 + outer, C) - (area(R1 + offset, R2 + offset, C) if width is not None else 0.0)
    hull = hull_area(circles, outer) - (hull_area(circles, offset) if width is not None else 0.0)
    assert abs(strip - hull) <= 1e-8 * strip, ('closed form against the sampled convex hull', strip, hull, abs(strip - hull) / strip)
    assert ex['sketch'] == 0 and abs(float(ex['height'])) == exp['height'], ('extrude', ex)
    vol = abs(float(ex['height'])) * strip
    if reported is not None:
        rel = abs(vol - reported) / vol; assert rel <= 1e-6, ('Studio volume against height x strip area', vol, reported, rel)
        out.update({'studioVolume': reported, 'volumeRelative': rel})
    out.update({'R1': R1, 'R2': R2, 'C': C, 'offset': offset, 'width': width, 'stripArea': strip, 'hullArea': hull, 'oracleVolume': vol})
else:
    raise AssertionError(('unknown mode', mode))
print(json.dumps(out, indent=2))
`;
assert.equal(process.env.BAND_SOURCE_FROZEN, '1', 'Root must freeze all writers before the band driver runs');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'ASSOCIATIVE_2D_BAND', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One XY sketch from an empty document: construction circles A (0, 0) r 20 and B (60, 0) r 10 drawn by canvas clicks on the 1 mm grid, picked by clicks inside them with the Band tool, width 3, offset 0, extruded 10 mm.',
    'Canvas clicks are real mouse events at pixels from window.__studioScreenOf.', 'Source 1 radius 25 by the Extrude feature editor (Apply); parameter R added in the Parameters panel (25), the radius bound with the f select, R set to 28, then 55 (overlap: 55 + 10 > 60).',
    'The brief named R = 45; 45 + 10 = 55 < 60 leaves the circles apart, so the overlap step uses R = 55.', 'A refused parameter value leaves the accepted document and body unchanged (a toast gives the reason); Undo / Redo use the toolbar buttons when enabled, else Meta+z / Meta+Shift+z.',
    'Product reads (the bundled inspector) are product code, not an independent oracle.', 'The Python oracle (python3 -I, zero product imports) decides the band node, the strip area and the volume.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));if(process.argv[3])doc.parameters={...(doc.parameters??{}),...JSON.parse(process.argv[3])};const before=JSON.stringify(doc);
const out:any={ok:false,error:null,thrown:null};let view:any=null;
try{view=evaluateDoc(doc,0);}catch(e:any){out.thrown=String(e?.message??e);}
if(view){out.ok=!!view.ok;out.error=view.ok?null:String(view.error?.detail??view.error?.title??view.error??'evaluation failed');
if(view.ok){out.bodyCount=view.bodies.length;if(view.bodies.length){const key=view.bodies[0].key,body=part('Band observed',doc).body(key);out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.facadeVolume=body.mass({density:1}).volume;}}}
out.sketch=doc.nodes[0]??null;out.parameters=doc.parameters??null;out.hasNull=JSON.stringify(doc).includes('null');
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));`;
// (JSON form: a key holding undefined is absent from a saved file.)
const doc = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__studioDoc)));
const editor = () => page.locator('.node-editor');
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
const hud = () => page.getByRole('dialog', { name: 'Extrude', exact: true });
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
async function same(expected) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) === x, JSON.stringify(expected), { timeout: 60000 }); await ready(); assert.deepEqual(await doc(), JSON.parse(JSON.stringify(expected))); }
async function changed(previous) { await page.waitForFunction(x => JSON.stringify(window.__studioDoc) !== x, JSON.stringify(previous), { timeout: 60000 }); await ready(); }
const bodies = () => page.evaluate(() => window.__studioBodies());
const alerts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, doc: JSON.parse(JSON.stringify(window.__studioDoc)), bodies: window.__studioBodies?.(), selection: window.__studioSelection ?? null, notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    editor: document.querySelector('.node-editor')?.textContent ?? null, sketchPanel: document.querySelector('.sk-panel')?.textContent ?? null, hud: document.querySelector('.hud')?.textContent ?? null,
    sketchAlert: document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null, sketchStatus: document.querySelector('.sk-panel [role="status"]')?.textContent ?? null,
    bandInputs: [...document.querySelectorAll('.sk-panel input[aria-label^="Band"]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })),
    bandOverlay: { outline: document.querySelectorAll('svg.vp-overlay path.sk-band').length, picked: document.querySelectorAll('svg.vp-overlay polygon.sk-band-pick').length, construction: document.querySelectorAll('svg.vp-overlay .sk-shape.construction').length },
    editorFields: [...document.querySelectorAll('.node-editor input[aria-label]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value, disabled: i.disabled })),
    history: [...document.querySelectorAll('.history .hs')].map(b => b.getAttribute('aria-label')) }), label);
  report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2)); await writeFile(join(output, `${label}.html`), await page.content()); await page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await persist(); return state;
}
async function newPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e))); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() })); page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready();
}
async function openFile(file, nodeCount) {
  await page.setInputFiles('input[aria-label="Model file"]', file);
  await page.waitForFunction(n => window.__studioDoc?.nodes?.length === n, nodeCount, { timeout: 60000 }); await ready();
}
async function freshOpen(file, expected, label) { phase = `fresh Open ${label}`; await newPage(); await openFile(file, expected.nodes.length); await same(expected); return snapshot(label); }
async function command(label) { await page.keyboard.press('Space'); await page.locator('.palette input').fill(label); await page.keyboard.press('Enter'); }
const screenOf = point => page.evaluate(point => window.__studioScreenOf?.(point), [...point, 0]);
async function worldClick(point) { const pixel = await screenOf(point); assert.ok(pixel?.length === 2, 'screen position of the point'); await page.mouse.click(pixel[0], pixel[1]); await page.waitForTimeout(150); return pixel; }
// Every point must be on the canvas (not under a panel) before the first click; zoom out with the wheel until they are.
async function frame(points) {
  const tries = [];
  for (let i = 0; i < 10; i++) {
    const read = await page.evaluate(points => { const c = document.querySelector('.vp-canvas'), r = c.getBoundingClientRect();
      const px = points.map(p => window.__studioScreenOf([p[0], p[1], 0])), z = window.__studioScreenOf([0, 0, 0]), o = window.__studioScreenOf([1, 0, 0]);
      const hits = px.map(q => q && q[0] > r.left + 24 && q[0] < r.right - 24 && q[1] > r.top + 24 && q[1] < r.bottom - 24 && !!document.elementFromPoint(q[0], q[1])?.closest('.vp-canvas'));
      return { canvas: [r.left, r.top, r.width, r.height], px, pxPerMm: z && o ? Math.hypot(o[0] - z[0], o[1] - z[1]) : null, allOnCanvas: hits.every(Boolean) }; }, points);
    tries.push(read); if (read.allOnCanvas) { report.observations.push({ label: 'framing', tries }); await persist(); return read; }
    const [left, top, width, height] = read.canvas; await page.mouse.move(left + width / 2, top + height / 2); await page.mouse.wheel(0, 400); await page.waitForTimeout(400);
  }
  report.observations.push({ label: 'framing-failed', tries }); await persist(); assert.fail('the points could not be framed on the canvas');
}
// A sketch tool by its toolbar button name, else its key (input blurred first).
async function tool(name, key) {
  const b = page.getByRole('button', { name, exact: true }); const count = await b.count(); report.observations.push({ label: `tool-${name}`, buttons: count });
  if (count === 1) await b.click(); else { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press(key); }
  await page.waitForTimeout(100);
}
const alertText = () => page.evaluate(() => document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null);
const panelText = () => page.evaluate(() => document.querySelector('.sk-panel')?.textContent ?? '');
const overlay = () => page.evaluate(() => ({ outline: document.querySelectorAll('svg.vp-overlay path.sk-band').length, picked: document.querySelectorAll('svg.vp-overlay polygon.sk-band-pick').length, construction: document.querySelectorAll('svg.vp-overlay .sk-shape.construction').length }));
const bandInputs = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sk-panel input[aria-label^="Band"]')].map(i => [i.getAttribute('aria-label'), i.value])));
async function closeEditor() { if (await editor().isVisible()) { await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' }); } }
async function openExtrudeEditor(label) {
  phase = `open Extrude editor ${label}`; await ready(); await page.evaluate(() => document.activeElement?.blur()); await page.locator('.history .hs[data-node-index="1"]').click(); await editor().waitFor();
}
const editorLabels = () => page.evaluate(() => [...document.querySelectorAll('.node-editor input[aria-label]')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value, disabled: i.disabled })));
async function applyEditor(previous, label) {
  phase = `Apply feature editor ${label}`; await editor().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(previous);
  await closeEditor(); await ready(); return snapshot(label);
}
async function reopenSketch(label) {
  await openExtrudeEditor(label); phase = `reopen sketch ${label}`; await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor();
  await page.locator('.sk-panel [role="group"][aria-label="Band"]').waitFor({ timeout: 15000 });
  await page.mouse.move(5, 5); await page.waitForTimeout(250); return { text: await panelText(), inputs: await bandInputs(), overlay: await overlay(), alert: await alertText() };
}
async function finishSketch(label) { phase = `Finish sketch ${label}`; await page.locator('.topbar button.finish').click(); await sketchPanel().waitFor({ state: 'hidden' }); await ready(); return snapshot(label); }
async function startExtrude(label) {
  phase = `Extrude HUD ${label}`; await ready();
  if (!(await page.evaluate(() => (window.__studioSelection?.selection?.sketches ?? []).includes(0)))) {
    await page.locator('.history .hs[data-node-index="0"]').click(); await editor().waitFor(); await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' });
    await page.waitForFunction(() => (window.__studioSelection?.selection?.sketches ?? []).includes(0), null, { timeout: 15000 });
  }
  await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('e'); await hud().waitFor();
  await page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 });
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
// The Parameters panel (top bar button [aria-label="Parameters"]); it is hidden while a feature editor or sketch is active, so the editor is closed first.
async function openParameters() {
  await ready(); await closeEditor(); await page.click('[aria-label="Parameters"]'); const panel = page.locator('aside[aria-label="Parameters panel"]'); await panel.waitFor(); return panel;
}
async function closeParameters(panel) { await page.click('[aria-label="Close parameters"]'); await panel.waitFor({ state: 'hidden' }); }
async function addParameter(name, value, label) {
  phase = `add parameter ${name} ${label}`; const panel = await openParameters();
  await panel.getByLabel('New parameter name', { exact: true }).fill(name); await panel.getByLabel('New parameter value', { exact: true }).fill(String(value)); await panel.getByRole('button', { name: 'Add parameter', exact: true }).click();
  await page.waitForFunction(([n, v]) => window.__studioDoc?.parameters?.[n] === v, [name, value], { timeout: 60000 }); await ready(); await closeParameters(panel); return snapshot(label);
}
async function setParameter(name, value, label) {
  phase = `set parameter ${name} ${label}`; const before = await doc(), panel = await openParameters(); const field = panel.getByLabel(`Value of ${name}`, { exact: true }); await field.waitFor();
  assert.equal(Number(await field.inputValue()), before.parameters[name], `${label}: the panel shows the current ${name}`);
  await field.fill(String(value)); await field.press('Enter');
  await page.waitForFunction(([n, v]) => window.__studioDoc?.parameters?.[n] === v, [name, value], { timeout: 60000 }); await ready(); await closeParameters(panel); return snapshot(label);
}
// A parameter value the evaluation refuses: the Studio keeps the accepted document (toast with the reason) or accepts it with the evaluation refused. Which one is recorded.
async function tryParameter(name, value, label) {
  phase = `refused parameter ${name} ${label}`; const before = await doc(), panel = await openParameters(); const field = panel.getByLabel(`Value of ${name}`, { exact: true }); await field.waitFor();
  await field.fill(String(value)); await field.press('Enter');
  await page.waitForFunction(([n, v]) => document.querySelectorAll('.toast').length > 0 || window.__studioDoc?.parameters?.[n] === v, [name, value], { timeout: 60000 }); await page.waitForTimeout(600);
  const after = await doc(), toasts = await alerts(), shown = await field.inputValue().catch(() => null);
  const mode = after.parameters[name] === value ? 'accepted-with-evaluation-refused' : JSON.stringify(after) === JSON.stringify(before) ? 'candidate-refused-document-unchanged' : 'other';
  report.observations.push({ label, mode, toasts, panelFieldAfter: shown }); await persist(); return { mode, toasts, before, after, panel, field };
}
async function dismissToasts() {
  const notice = page.locator('.toast[role="alert"]'); if (await notice.count()) await notice.first().getByRole('button', { name: 'Dismiss', exact: true }).click().catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('.toast').length === 0, null, { timeout: 30000 });
}
// Product read (bundled inspector) of the document, the independent Python oracle on it and the Studio-reported volume. Everything is written before the first assertion.
async function runInspector(file, extra) { return spawnSync(process.execPath, [inspector, file, ...(extra ? [JSON.stringify(extra)] : [])], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); }
async function oracle(label, input) {
  await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'band-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stdout: check.stdout ? JSON.parse(check.stdout) : null, stderr: check.stderr }); await persist();
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS'); return JSON.parse(check.stdout);
}
async function inspect(label, expect, volume) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = await runInspector(file); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr); const read = JSON.parse(run.stdout); report.reads.push({ label, studioVolume: volume ?? null, ...read }); await persist();
  const verified = await oracle(label, { doc: accepted, mode: 'volume', expect, volume: volume ?? null });
  assert.equal(read.ok, true, `${label}: product evaluation ok (${read.error ?? read.thrown})`); assert.equal(read.hasNull, false, `${label}: no null stored in the document`);
  if (volume !== undefined) { assert.equal(read.bodyCount, 1, `${label}: one body`); assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6 * volume, `${label}: product evalVolume ${read.evalVolume} vs Studio ${volume}`); assert.ok(Math.abs(read.facadeVolume - volume) <= 1e-6 * volume, `${label}: facade volume ${read.facadeVolume} vs Studio ${volume}`); }
  assert.deepEqual(await doc(), accepted); return { read, verified };
}
// The same document with the parameter at an overlapping value: the evaluation refuses and names the band.
async function inspectRefusal(label, parameters, overlap) {
  phase = `product refusal ${label}`; const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = await runInspector(file, parameters); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr); const read = JSON.parse(run.stdout); report.reads.push({ label, parameters, ...read }); await persist();
  await oracle(label, { doc: accepted, mode: 'overlap', expect: overlap, volume: null });
  const reason = `${read.error ?? ''} ${read.thrown ?? ''}`; assert.ok(!read.ok, `${label}: the evaluation is refused`); assert.match(reason, /band b1/i, `${label}: the refusal names the band: ${reason}`); assert.match(reason, /overlap/i, `${label}: the refusal says overlap: ${reason}`);
  return reason;
}
const initialFiles = ['apps/cad-studio/test/band-sketch-browser.mjs', 'apps/cad-studio/test/sketch-band-studio.test.ts', 'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/app/sketchControls.ts', 'apps/cad-studio/src/app/bandControls.ts',
  'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/ParametersPanel.tsx', 'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts', 'apps/cad-studio/src/styles.css',
  'packages/barocss-cad-model/src/sketch/band.ts', 'packages/barocss-cad-model/test/sketch-band-geometry.test.ts', 'packages/barocss-cad-model/test/sketch-band-identity.test.ts', 'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/app/profiles.ts',
  'packages/barocss-cad-model/src/engine/part.ts', 'packages/barocss-cad-model/src/engine/doc.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/types.ts',
  'packages/barocss-cad-model/src/sketch/entityIds.ts', 'packages/barocss-cad-model/src/sketch/select.ts', 'packages/barocss-cad-model/src/sketch/dxf.ts', 'packages/barocss-cad-model/src/engine/parameters.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
const CIRCLE_A = [[0, 0], [20, 0]], CIRCLE_B = [[60, 0], [70, 0]], PICK_A = [5, 5], PICK_B = [60, 5];
// The expectation of the oracle for the two circles (radius 1 may change) and the band's offset / width.
const exp = (R1, extra = {}) => ({ x1: 0, y1: 0, R1, x2: 60, y2: 0, R2: 10, C: 60, offset: 0, width: 3, height: 10, ...extra });
const circleOf = (node, k) => node.construction.find(c => c.ids?.includes(node.band.sources[k]));
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'band-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  const buildInputs = [], sourcefile = 'band-inspector.ts', virtual = resolve(app, sourcefile);
  const built = await build({ stdin: { contents: inspectSource, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'inspector.ts'), inspectSource); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
  // Stdin has no disk path. Its exact source/hash is captured and the virtual input is explicitly excluded.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources = [{ label: 'inspector', hash: hash(inspectSource), virtualInputExcluded: virtual }];
  inspector = join(output, 'inspector.mjs'); await writeFile(inspector, built.outputFiles[0].contents);
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  for (const need of ['packages/barocss-cad-model/src/sketch/band.ts', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/app/bandControls.ts']) assert.ok(report.sourceFrozen[need], `${need} is in the frozen capsule`);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;

  // Context 1: empty document.
  phase = 'empty document'; await newPage(); await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0); await ready(); const empty = await doc(); assert.equal(empty.nodes.length, 0, 'the document starts empty'); await snapshot('00-empty');
  phase = 'start XY sketch'; await command('Sketch'); await sketchPanel().waitFor(); await sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');

  // 1. Construction mode, circle A (0, 0) r 20 and circle B (60, 0) r 10.
  phase = 'construction circles'; const construction = page.getByRole('button', { name: 'Construction', exact: true }); report.observations.push({ label: 'construction-button', buttons: await construction.count() });
  if (await construction.count() === 1) await construction.click(); else { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('x'); }
  await page.waitForTimeout(100); const constructionOn = await page.evaluate(() => /(^|\s)on(\s|$)/.test(document.querySelector('button[aria-label="Construction"]')?.className ?? '')); report.observations.push({ label: 'construction-on', constructionOn }); await persist();
  assert.ok(constructionOn, 'the Construction toggle is on (X)');
  await tool('Circle', 'c'); await frame([[-20, 0], [0, 20], [0, -20], [70, 0], [60, 10], [60, -10]]);
  const pixelsA = []; for (const p of CIRCLE_A) pixelsA.push(await worldClick(p)); await page.mouse.move(5, 5); await page.waitForTimeout(250);
  const diameterA = await page.evaluate(() => document.querySelector('.sk-panel input[aria-label="Diameter"]')?.value ?? null); report.observations.push({ label: '01-circle-A', clickPixels: pixelsA, diameter: diameterA, alert: await alertText() }); await snapshot('01-circle-A');
  if (diameterA !== null) assert.equal(Number(diameterA), 40, 'circle A shows Diameter 40');
  const pixelsB = []; for (const p of CIRCLE_B) pixelsB.push(await worldClick(p)); await page.mouse.move(5, 5); await page.waitForTimeout(250);
  const diameterB = await page.evaluate(() => document.querySelector('.sk-panel input[aria-label="Diameter"]')?.value ?? null), centreB = await page.evaluate(() => ['Centre X', 'Centre Y'].map(l => document.querySelector(`.sk-panel input[aria-label="${l}"]`)?.value ?? null));
  report.observations.push({ label: '02-circle-B', clickPixels: pixelsB, diameter: diameterB, centre: centreB, overlay: await overlay() }); await snapshot('02-circles');
  if (diameterB !== null) assert.equal(Number(diameterB), 20, 'circle B shows Diameter 20'); if (centreB[0] !== null) assert.deepEqual(centreB.map(Number), [60, 0], 'circle B centre (60, 0)');
  assert.ok((await overlay()).construction >= 2, 'both circles are drawn as construction (dashed)'); assert.deepEqual(await doc(), empty, 'nothing is stored until Finish');

  // 2. Band tool (M): click inside A, then inside B; the BAND section shows 2 shapes picked.
  phase = 'Band tool picks'; await tool('Band', 'm'); await page.locator('.sk-panel .card-title').filter({ hasText: /^BAND$/ }).waitFor({ timeout: 15000 });
  assert.match(await panelText(), /0 shapes picked/, 'BAND shows 0 shapes picked'); const pickA = await worldClick(PICK_A), pickB = await worldClick(PICK_B); await page.mouse.move(5, 5); await page.waitForTimeout(250);
  const picked = await panelText(), pickOverlay = await overlay(); report.observations.push({ label: '03-picked', pixels: [pickA, pickB], panel: picked, overlay: pickOverlay, alert: await alertText() }); await snapshot('03-picked');
  assert.match(picked, /2 shapes picked/, 'BAND shows 2 shapes picked'); assert.match(picked, /ready/); assert.equal(pickOverlay.picked, 2, 'both picked shapes are highlighted'); assert.equal(await alertText(), null); assert.deepEqual(await alerts(), []);
  assert.ok(await sketchPanel().getByLabel('Band offset', { exact: true }).count() === 1 && await sketchPanel().getByLabel('Band width', { exact: true }).count() === 1, 'Offset and Width inputs');

  // 3. Width 3, Make band: the panel shows the band, no refusal.
  phase = 'Make band'; const widthInput = sketchPanel().getByLabel('Band width', { exact: true }); await widthInput.fill('3'); assert.equal(await widthInput.inputValue(), '3');
  await sketchPanel().getByRole('button', { name: 'Make band', exact: true }).click(); await page.locator('.sk-panel [role="group"][aria-label="Band"]').waitFor({ timeout: 15000 }); await page.mouse.move(5, 5); await page.waitForTimeout(300);
  const madeText = await panelText(), madeInputs = await bandInputs(), madeOverlay = await overlay(); report.observations.push({ label: '04-made', panel: madeText, inputs: madeInputs, overlay: madeOverlay, alert: await alertText(), toasts: await alerts() }); await snapshot('04-band-made');
  assert.match(madeText, /BAND\s*·\s*2 sources/, 'the panel shows the band with 2 sources'); assert.equal(Number(madeInputs['Band width']), 3, 'Width 3'); assert.ok(madeInputs['Band offset'] === '0' || Number(madeInputs['Band offset']) === 0, 'Offset 0');
  assert.equal(madeOverlay.outline, 1, 'the band outline is drawn'); assert.equal(await alertText(), null, 'no refusal in the panel'); assert.deepEqual(await alerts(), [], 'no toast');
  assert.equal(await sketchPanel().getByRole('button', { name: 'Remove band', exact: true }).count(), 1, 'Remove band is offered'); assert.deepEqual(await doc(), empty, 'nothing is stored until Finish');

  // 4. Finish: a band node whose sources are the two circle ids.
  const done05 = await finishSketch('05-finished'), doc05 = done05.doc; assert.equal(doc05.nodes.length, 1, 'one sketch node'); const node05 = doc05.nodes[0];
  report.observations.push({ label: '05-sketch', nodeKeys: Object.keys(node05), profile: node05.profile, band: node05.band, construction: node05.construction }); await persist();
  assert.equal(node05.kind, 'sketch'); assert.equal(node05.profile, 'band', 'profile band'); assert.equal(node05.band.version, 1); assert.equal(node05.band.id, 'b1'); assert.equal(node05.band.width, 3, 'band width 3'); assert.ok(!node05.band.offset, 'no offset stored (0)');
  assert.equal(node05.band.sources.length, 2); assert.equal(node05.construction.length, 2, 'two construction circles'); assert.ok(node05.construction.every(c => c.kind === 'circle' && c.construction === true && c.ids?.length === 1), 'circles are construction with side ids');
  assert.deepEqual([0, 1].map(k => node05.construction.filter(c => c.ids.includes(node05.band.sources[k])).length), [1, 1], 'each source id names one circle'); assert.deepEqual(node05.construction.map(c => c.ids[0]).sort(), [...node05.band.sources].sort(), 'sources = the two circle ids');
  const a05 = circleOf(node05, 0), b05 = circleOf(node05, 1); assert.deepEqual([a05.c, a05.r, b05.c, b05.r], [[0, 0], 20, [60, 0], 10], 'source 1 is A (0,0) r 20, source 2 is B (60,0) r 10'); assert.deepEqual(await alerts(), []);

  // 5. Extrude 10: the strip area x 10 (oracle).
  await startExtrude('06'); const operation = await page.evaluate(() => { const s = document.querySelector('.hud select[aria-label="Operation"]'); return s ? { value: s.value, options: [...s.options].map(o => o.value) } : null; });
  const depthSelect = await hud().getByLabel('Depth', { exact: true }).count(); report.observations.push({ label: '06-extrude-hud', operation, depthSelect, hudText: await page.evaluate(() => document.querySelector('.hud')?.textContent ?? null) });
  if (operation && operation.options.includes('new') && operation.value !== 'new') await hud().getByLabel('Operation', { exact: true }).selectOption('new');
  if (depthSelect) await hud().getByLabel('Depth', { exact: true }).selectOption('distance');
  const distance = hud().getByLabel('Distance', { exact: true }); await distance.waitFor(); await distance.fill('10');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(doc05); await hud().waitFor({ state: 'hidden' }); const done06 = await snapshot('06-extruded'), doc06 = done06.doc;
  assert.deepEqual(doc06.nodes[0], doc05.nodes[0], 'the band sketch node is unchanged by the extrude'); assert.equal(doc06.nodes.length, 2); assert.equal(doc06.nodes[1].kind, 'extrude'); assert.equal(Math.abs(doc06.nodes[1].height), 10);
  assert.equal(done06.bodies.bodies.length, 1, 'one body'); const volume06 = done06.bodies.bodies[0].volume; assert.deepEqual(await alerts(), []);
  await inspect('06-native', exp(20), volume06);

  // 6. Feature editor: the band fields; source 1 radius 25 (unbound) follows the oracle.
  await openExtrudeEditor('07'); const fields07 = await editorLabels(); report.observations.push({ label: '07-editor-fields', fields: fields07 }); await snapshot('07-editor');
  const expectedFields = [['Band offset', 0], ['Band width', 3], ['Band source 1 radius', 20], ['Band source 1 centre X', 0], ['Band source 1 centre Y', 0], ['Band source 2 radius', 10], ['Band source 2 centre X', 60], ['Band source 2 centre Y', 0]];
  for (const [label, value] of expectedFields) { const f = fields07.find(x => x.label === label); assert.ok(f, `the Extrude editor lists "${label}": ${JSON.stringify(fields07.map(x => x.label))}`); assert.equal(Number(f.value), value, `${label} shows ${value}`); assert.equal(f.disabled, false); }
  phase = 'edit source 1 radius'; await editor().getByLabel('Band source 1 radius', { exact: true }).fill('25'); const done08 = await applyEditor(doc06, '08-radius-25'), doc08 = done08.doc;
  assert.deepEqual(doc08.nodes[1], doc06.nodes[1], 'the Extrude node is unchanged'); assert.equal(circleOf(doc08.nodes[0], 0).r, 25, 'source 1 radius 25'); assert.deepEqual(doc08.nodes[0].band, doc06.nodes[0].band, 'the band record is unchanged (sources by id)');
  assert.deepEqual(doc08.nodes[0].construction.map(c => c.ids), doc06.nodes[0].construction.map(c => c.ids), 'the source ids stay'); assert.deepEqual(await alerts(), []);
  assert.equal(done08.bodies.bodies.length, 1); const volume08 = done08.bodies.bodies[0].volume; assert.ok(volume08 > volume06, 'a larger source gives a larger strip'); await inspect('08-native', exp(25), volume08);

  // 7. Parameter R = 25, source 1 radius bound to R (the f select), R = 28 follows.
  const param09 = await addParameter('R', 25, '09-param-R'); assert.deepEqual(param09.doc.parameters, { R: 25 }); assert.deepEqual(param09.doc.nodes, doc08.nodes, 'only the parameter was added'); assert.deepEqual(await alerts(), []);
  await openExtrudeEditor('10'); const bindSelect = editor().getByLabel('Band source 1 radius parameter', { exact: true }); await bindSelect.waitFor();
  assert.ok(await bindSelect.locator('option', { hasText: /^R$/ }).count() === 1, 'the f select offers R'); phase = 'bind source 1 radius to R'; await bindSelect.selectOption('R');
  await page.waitForFunction(() => document.querySelector('.node-editor input[aria-label="Band source 1 radius"]')?.disabled === true, null, { timeout: 15000 }); await snapshot('10-bound-draft');
  const done10 = await applyEditor(param09.doc, '10-bound'), doc10 = done10.doc; assert.deepEqual(circleOf(doc10.nodes[0], 0).r, { parameter: 'R' }, 'source 1 radius is bound to R'); assert.deepEqual(doc10.parameters, { R: 25 });
  assert.deepEqual(doc10.nodes[1], doc08.nodes[1]); assert.deepEqual(doc10.nodes[0].band, doc08.nodes[0].band); assert.deepEqual(await alerts(), []);
  assert.equal(done10.bodies.bodies.length, 1); assert.ok(Math.abs(done10.bodies.bodies[0].volume - volume08) <= 1e-6 * volume08, 'binding R = 25 keeps the volume'); await inspect('10-native', exp(25, { bound: { '0r': 'R' } }), done10.bodies.bodies[0].volume);
  const param11 = await setParameter('R', 28, '11-param-R-28'), doc11 = param11.doc; assert.deepEqual(doc11.parameters, { R: 28 }); assert.deepEqual(doc11.nodes, doc10.nodes, 'only the parameter changed'); assert.deepEqual(await alerts(), []);
  assert.equal(param11.bodies.bodies.length, 1); const volume11 = param11.bodies.bodies[0].volume; assert.ok(volume11 > volume08, 'R = 28 gives a larger strip'); await inspect('11-native', exp(28, { bound: { '0r': 'R' } }), volume11);

  // 8. R = 55: A overlaps B (55 + 10 > 60): the refusal names the band; no stale body.
  const refusedReason = await inspectRefusal('12-product-refusal', { R: 55 }, { R: 55, r2: 10, C: 60 });
  const tried = await tryParameter('R', 55, '12-param-R-55'); await snapshot('12-refused'); const toastText = tried.toasts.join(' | ');
  if (tried.mode === 'candidate-refused-document-unchanged') {
    assert.match(toastText, /band b1/i, `the refusal toast names the band: ${toastText}`); assert.match(toastText, /overlap/i, `the refusal toast says overlap: ${toastText}`);
    assert.equal(tried.after.parameters.R, 28, 'R is still 28 (the accepted document)'); const b12 = await bodies(); assert.equal(b12.bodies.length, 1, 'the accepted body stays (it is the R = 28 body, not a stale one)');
    assert.ok(Math.abs(b12.bodies[0].volume - volume11) <= 1e-6 * volume11, 'the shown body is the R = 28 body');
    await dismissToasts(); await closeParameters(tried.panel); await same(doc11);
  } else {
    assert.equal(tried.mode, 'accepted-with-evaluation-refused', `unexpected parameter outcome: ${tried.mode}`); const b12 = await bodies(); assert.equal(b12.bodies.length, 0, 'no body is shown for the refused evaluation (no stale volume)');
    assert.match(`${toastText} ${await page.evaluate(() => document.body.innerText)}`, /band b1/i, 'the refusal names the band'); await closeParameters(tried.panel);
    phase = 'Undo to R = 28'; await page.evaluate(() => document.activeElement?.blur()); const undo = page.getByRole('button', { name: 'Undo', exact: true }); if (await undo.count() === 1 && await undo.isEnabled()) await undo.click(); else await page.keyboard.press('Meta+z');
    await same(doc11); await dismissToasts().catch(() => {});
  }
  assert.ok(refusedReason.length > 0); assert.deepEqual(await alerts(), []);
  await inspect('13-native', exp(28, { bound: { '0r': 'R' } }), (await bodies()).bodies[0].volume);

  // 9. Reopen the sketch: the band is drawn, the panel shows its fields; Finish unchanged keeps the document.
  const reopened = await reopenSketch('14'); report.observations.push({ label: '14-reopened', ...reopened }); await snapshot('14-reopened');
  assert.match(reopened.text, /BAND\s*·\s*2 sources/, 'the panel shows the band after reopening'); assert.equal(reopened.overlay.outline, 1, 'the band is drawn after reopening'); assert.equal(reopened.alert, null);
  assert.equal(Number(reopened.inputs['Band width']), 3, 'Width 3'); assert.ok(reopened.inputs['Band offset'] === '0' || Number(reopened.inputs['Band offset']) === 0, 'Offset 0'); assert.deepEqual(await doc(), doc11, 'reopening does not change the document');
  const done15 = await finishSketch('15-finish-unchanged'); assert.deepEqual(done15.doc, doc11, 'Finish unchanged leaves the document equal'); assert.deepEqual(await alerts(), []);
  assert.deepEqual(circleOf(done15.doc.nodes[0], 0).r, { parameter: 'R' }, 'the R binding survives reopen and Finish'); await inspect('15-native', exp(28, { bound: { '0r': 'R' } }), done15.bodies.bodies[0].volume);

  // 10. Undo / Redo once, Save.
  phase = 'Undo/Redo'; await page.evaluate(() => document.activeElement?.blur());
  const undo = page.getByRole('button', { name: 'Undo', exact: true }); if (await undo.count() === 1 && await undo.isEnabled()) await undo.click(); else await page.keyboard.press('Meta+z');
  await page.waitForTimeout(800); await ready(); const afterUndo = await doc(), undoneTo = JSON.stringify(afterUndo) === JSON.stringify(doc10) ? 'doc10 (R = 25 before the R = 28 edit)' : JSON.stringify(afterUndo) === JSON.stringify(doc11) ? 'doc11 (the unchanged Finish recorded no step)' : 'other';
  report.observations.push({ label: 'undo-once', undoneTo }); await persist(); assert.notEqual(undoneTo, 'other', 'one Undo returns the previous recorded document');
  const redo = page.getByRole('button', { name: 'Redo', exact: true }); if (await redo.count() === 1 && await redo.isEnabled()) await redo.click(); else await page.keyboard.press('Meta+Shift+z');
  await same(doc11); const saved = await save('band'); assert.deepEqual(saved.doc, doc11);

  // Context 2: fresh Open of the saved file.
  const fresh = await freshOpen(saved.file, saved.doc, '16-fresh-open'); assert.deepEqual(fresh.doc, saved.doc, 'the opened document equals the saved one'); assert.deepEqual(await alerts(), [], 'no toast on Open');
  assert.equal(fresh.bodies.bodies.length, 1); const volumeFresh = fresh.bodies.bodies[0].volume; assert.ok(Math.abs(volumeFresh - volume11) <= 1e-6 * volume11, `16: volume ${volumeFresh} vs ${volume11}`);
  await inspect('16-native', exp(28, { bound: { '0r': 'R' } }), volumeFresh);
  const reopenedFresh = await reopenSketch('17'); report.observations.push({ label: '17-reopened', ...reopenedFresh }); await snapshot('17-reopened');
  assert.match(reopenedFresh.text, /BAND\s*·\s*2 sources/); assert.equal(reopenedFresh.overlay.outline, 1, 'the band is drawn after Open and reopen'); assert.equal(reopenedFresh.alert, null); assert.deepEqual(await doc(), saved.doc, 'reopening does not change the document');
  const done18 = await finishSketch('18-finish-unchanged'); assert.deepEqual(done18.doc, saved.doc, 'Finish unchanged after Open leaves the document equal'); assert.deepEqual(await alerts(), []);
  assert.equal(done18.bodies.bodies.length, 1); assert.ok(Math.abs(done18.bodies.bodies[0].volume - volume11) <= 1e-6 * volume11); await inspect('18-native', exp(28, { bound: { '0r': 'R' } }), done18.bodies.bodies[0].volume);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
