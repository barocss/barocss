// Ellipse sketch tool qualification: the Ellipse tool (button "Ellipse", key I) takes three clicks: the centre, the end of the first axis (Rx and the angle), then a point whose distance from that axis line is Ry.
// The result is a closed 192-point tangent-arc polygon with the definition kept (SketchOutline.ellipse = { center, rx, ry, angle }); the side ids never change when the definition is edited.
// The ELLIPSE panel section lists Centre X, Centre Y, Rx, Ry, Angle (Enter or blur applies; Enter must not finish the sketch). A definition narrower than 1 : 5 is refused with its reason and the shape stays.
// "Make curves of the sketch" turns the ellipse into one exact degree-2 rational NURBS direct curve ("Sketch curve 1 · c1"). Reopen restores the definition; Extrude 10 follows the edits.
// Root must freeze all sources first. Run from apps/cad-studio:
//   ELLIPSE_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/ellipse-sketch-browser.mjs /absolute/artifacts
// Actual Studio UI (New part, palette Sketch, Sketch plane select, Ellipse toolbar button with canvas clicks via window.__studioScreenOf, ELLIPSE inputs, Finish, Extrude HUD, history button + Edit sketch, Undo/Redo, Save, Open,
// Make curves) mutates. Readonly hooks (window.__studioDoc / __studioBodies / __studioSelection / __studioScreenOf) observe only. The document starts EMPTY (no fixture).
// One Chrome WebGPU process, two sequential fresh contexts. Product read: a bundled inspector (product code, not an oracle) evaluates the document (volume) and reads every direct curve through direct.ts geometryOf / evaluateCurve.
// The independent Python oracle (python3 -I, zero product imports) decides: fit points on the exact ellipse (1e-9), the whole outline (arcs sampled from the stored bulges) within 1e-5 of the longer semi-axis,
// area (shoelace + circular segments) against pi rx ry (2e-5) and against the Studio volume (1e-6), side ids, and for the made curve: degree 2, clamped knots, rational weights, closed, every point on the rotated ellipse (1e-9).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

const oracleSource = String.raw`"""Independent check of an ellipse sketch (closed tangent-arc outline of 192 points) and of the exact NURBS curve Make curves writes. Product imports: zero."""
import json, math, sys

data = json.load(sys.stdin)
doc = data['doc']; exp = data['expect']; mode = data['mode']; reported = data.get('volume')
cx, cy = exp['center']; rx = exp['rx']; ry = exp['ry']; ang = exp['angle']
ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
longer = max(rx, ry)

def local(x, y):
    dx, dy = x - cx, y - cy
    return (ca * dx + sa * dy, -sa * dx + ca * dy)
def implicit(x, y):
    u, v = local(x, y)
    return (u / rx) ** 2 + (v / ry) ** 2 - 1

GRID = 256
TABLE = [(rx * math.cos(2 * math.pi * k / GRID), ry * math.sin(2 * math.pi * k / GRID)) for k in range(GRID)]
def distance(x, y):
    u, v = local(x, y)
    best = min(range(GRID), key=lambda k: (TABLE[k][0] - u) ** 2 + (TABLE[k][1] - v) ** 2)
    lo = 2 * math.pi * (best - 1) / GRID; hi = 2 * math.pi * (best + 1) / GRID
    def d2(t): return (rx * math.cos(t) - u) ** 2 + (ry * math.sin(t) - v) ** 2
    for _ in range(80):
        a = lo + (hi - lo) / 3; b = hi - (hi - lo) / 3
        if d2(a) < d2(b): hi = b
        else: lo = a
    return math.sqrt(d2((lo + hi) / 2))

def finite(v, path):
    if isinstance(v, bool): raise AssertionError(('boolean is not a number', path))
    if isinstance(v, (int, float)): assert math.isfinite(v), ('non-finite', path)
    elif isinstance(v, list):
        for i, x in enumerate(v): finite(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): finite(x, path + '.' + k)
    elif v is None: raise AssertionError(('null', path))
finite(doc, 'doc')
out = {'status': 'PASS', 'productImports': 0, 'mode': mode}

if mode == 'sketch':
    node = doc['nodes'][0]; assert node['kind'] == 'sketch', node['kind']
    outline = node['outline']; assert outline['ellipse'] == {'center': [cx, cy], 'rx': rx, 'ry': ry, 'angle': ang}, ('stored definition', outline['ellipse'], exp)
    pts = outline['points']; n = len(pts); assert n == 192, ('outline points', n)
    bulges = outline.get('bulges') or [0] * n; assert len(bulges) == n, 'one bulge per point'
    tags = node['sideTags']['outer']; assert len(tags) == 192 and len(set(tags)) == 192, ('192 distinct outer side ids', len(tags), len(set(tags)))
    worst_implicit = 0.0; worst_position = 0.0
    for k in range(96):
        t = 2 * math.pi * k / 96; x = rx * math.cos(t); y = ry * math.sin(t)
        ex = cx + ca * x - sa * y; ey = cy + sa * x + ca * y; p = pts[2 * k]
        worst_position = max(worst_position, math.hypot(p[0] - ex, p[1] - ey) / longer)
        worst_implicit = max(worst_implicit, abs(implicit(p[0], p[1])))
    assert worst_implicit <= 1e-9, ('fit points on the exact ellipse', worst_implicit)
    assert worst_position <= 1e-9, ('fit points at the parameter positions', worst_position)
    worst_dist = 0.0; area = 0.0
    for i in range(n):
        p = pts[i]; q = pts[(i + 1) % n]; b = bulges[i]
        area += (p[0] * q[1] - q[0] * p[1]) / 2
        if b == 0:
            samples = [(p[0] + (q[0] - p[0]) * k / 32, p[1] + (q[1] - p[1]) * k / 32) for k in range(33)]
        else:
            c = math.hypot(q[0] - p[0], q[1] - p[1]); m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            nx, ny = -(q[1] - p[1]) / c, (q[0] - p[0]) / c; d = (c / 2) * (1 - b * b) / (2 * b)
            ctr = (m[0] + nx * d, m[1] + ny * d); r = math.hypot(p[0] - ctr[0], p[1] - ctr[1])
            start = math.atan2(p[1] - ctr[1], p[0] - ctr[0]); sweep = 4 * math.atan(b)
            samples = [(ctr[0] + r * math.cos(start + sweep * k / 32), ctr[1] + r * math.sin(start + sweep * k / 32)) for k in range(33)]
            end = samples[-1]; assert math.hypot(end[0] - q[0], end[1] - q[1]) <= 1e-7 * longer, ('arc ' + str(i) + ' ends on its chord end', end, q)
            area += r * r / 2 * (sweep - math.sin(sweep))
        for s in samples: worst_dist = max(worst_dist, distance(s[0], s[1]))
    area = abs(area)
    assert worst_dist <= 1e-5 * longer, ('outline within 1e-5 of the longer semi-axis', worst_dist, worst_dist / longer)
    exact = math.pi * rx * ry; rel_exact = abs(area - exact) / exact
    assert rel_exact <= 2e-5, ('area against pi rx ry', area, exact, rel_exact)
    out.update({'points': n, 'sideIds': len(tags), 'worstFitImplicit': worst_implicit, 'worstFitPosition': worst_position, 'worstOutlineDistance': worst_dist, 'worstOutlineDistanceRelative': worst_dist / longer,
                'outlineArea': area, 'exactArea': exact, 'areaRelativeToExact': rel_exact})
    if reported is not None:
        ext = [m for m in doc['nodes'] if m['kind'] == 'extrude' and m['sketch'] == 0]; assert len(ext) == 1, 'one extrude of the sketch'
        h = abs(float(ext[0]['height'])); assert h == exp['height'], ('extrude height', h)
        vol = area * h; rel = abs(vol - reported) / vol; rel_pi = abs(exact * h - reported) / (exact * h)
        assert rel <= 1e-6, ('Studio volume against height x outline area', vol, reported, rel)
        assert rel_pi <= 2e-5, ('Studio volume against pi rx ry height', exact * h, reported, rel_pi)
        out.update({'outlineVolume': vol, 'studioVolume': reported, 'volumeRelativeToOutline': rel, 'volumeRelativeToExact': rel_pi})
elif mode == 'curve':
    curves = data['curves']; assert len(curves) == 1, ('one direct curve', [c['name'] for c in curves])
    c = curves[0]; assert c['name'].startswith('Sketch curve 1'), c['name']
    p = c['degree']; P = c['controlPoints']; W = c['weights']; U = c['knots']; n = len(P) - 1
    assert p == 2, ('degree 2', p); assert len(W) == len(P) and len(U) == len(P) + p + 1, ('lengths', len(P), len(W), len(U))
    assert all(U[i] <= U[i + 1] for i in range(len(U) - 1)), 'knots do not decrease'
    assert len(set(U[:p + 1])) == 1 and len(set(U[-p - 1:])) == 1 and U[0] < U[-1], ('clamped knots', U)
    assert all(w > 0 for w in W), ('positive weights', W); assert any(abs(w - 1) > 1e-6 for w in W), ('rational: some weight differs from 1', W)
    assert all(abs(q[2]) <= 1e-12 for q in P), ('all poles at z 0', [q[2] for q in P])
    assert max(abs(P[0][i] - P[-1][i]) for i in range(3)) <= 1e-9 * longer, ('closed: first pole equals last', P[0], P[-1])
    def find_span(t):
        if t >= U[n + 1]: return n
        lo, hi = p, n + 1; mid = (lo + hi) // 2
        while t < U[mid] or t >= U[mid + 1]:
            if t < U[mid]: hi = mid
            else: lo = mid
            mid = (lo + hi) // 2
        return mid
    def at(t):
        i = find_span(t); N = [0.0] * (p + 1); N[0] = 1.0; left = [0.0] * (p + 1); right = [0.0] * (p + 1)
        for j in range(1, p + 1):
            left[j] = t - U[i + 1 - j]; right[j] = U[i + j] - t; saved = 0.0
            for r in range(j):
                temp = N[r] / (right[r + 1] + left[j - r]); N[r] = saved + right[r + 1] * temp; saved = left[j - r] * temp
            N[j] = saved
        num = [0.0, 0.0, 0.0]; den = 0.0
        for j in range(p + 1):
            w = N[j] * W[i - p + j]; den += w
            for k in range(3): num[k] += w * P[i - p + j][k]
        return [x / den for x in num]
    a = U[p]; b = U[-p - 1]; worst = 0.0; max_u = 0.0; max_v = 0.0; count = 800
    for k in range(count + 1):
        q = at(a + (b - a) * k / count); worst = max(worst, abs(implicit(q[0], q[1]))); assert abs(q[2]) <= 1e-12, ('point at z 0', q)
        u, v = local(q[0], q[1]); max_u = max(max_u, abs(u)); max_v = max(max_v, abs(v))
    assert worst <= 1e-9, ('every point satisfies the ellipse equation', worst)
    assert abs(max_u - rx) <= 1e-3 * rx and abs(max_v - ry) <= 1e-3 * ry, ('the curve reaches both semi-axes', max_u, max_v)
    s0 = at(a); s1 = at(b); assert max(abs(s0[i] - s1[i]) for i in range(3)) <= 1e-9 * longer, ('closed: start equals end', s0, s1)
    worst_product = 0.0
    for e in c['evals']:
        q = at(e['t']); worst_product = max(worst_product, max(abs(q[i] - e['point'][i]) for i in range(3)))
    assert worst_product <= 1e-9 * longer, ('product evaluation equals the oracle evaluation', worst_product)
    out.update({'name': c['name'], 'degree': p, 'poles': len(P), 'weights': W, 'knots': U, 'worstImplicit': worst, 'samples': count + 1, 'maxLocalU': max_u, 'maxLocalV': max_v, 'worstProductDifference': worst_product})
else:
    raise AssertionError(('unknown mode', mode))
print(json.dumps(out, indent=2))
`;
assert.equal(process.env.ELLIPSE_SOURCE_FROZEN, '1', 'Root must freeze all writers before the ellipse driver runs');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'ELLIPSE_SKETCH_TOOL', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], reads: [], oracles: [], files: [], downloads: [], observations: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['One XY sketch plane from an empty document: one ellipse (centre (10, 5), clicks on the 1 mm grid), edited by the panel (Angle, Ry, Rx), extruded 10 mm.', 'Canvas clicks are real mouse events at pixels from window.__studioScreenOf.',
    'The too-narrow edit (Ry 5 with Rx 60) is refused; the panel field returns to its current value by itself (no Escape key is pressed: Escape would leave the sketch).',
    'Undo / Redo use the toolbar buttons when enabled, else Meta+z / Meta+Shift+z; which state one Undo returns to is recorded.', 'Product reads (the bundled inspector) are product code, not an independent oracle.',
    'The Python oracle (python3 -I, zero product imports) decides point exactness, outline deviation, area, volume, side ids and the exact NURBS curve.', 'Hashes are source provenance, not geometry oracles.'] };
let phase = 'source preparation', server, browser, context, page, inspector;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const inspectSource = `import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {geometryOf} from '../../packages/barocss-cad-model/src/engine/direct.ts';
import {evaluateCurve} from '@barocss/cad';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed'),curves:[]};
if(view.ok){out.bodyCount=view.bodies.length;if(view.bodies.length){const key=view.bodies[0].key,body=part('Ellipse observed',doc).body(key);out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.facadeVolume=body.mass({density:1}).volume;}}
out.sketch=doc.nodes[0]??null;out.hasNull=JSON.stringify(doc).includes('null');
for(const o of doc.direct?.objects??[]){const g:any=geometryOf(doc.direct,o);if(g.kind!=='curve')continue;
const a=g.knots[g.degree],b=g.knots[g.knots.length-g.degree-1];
out.curves.push({id:o.id,name:o.name,degree:g.degree,knots:g.knots,controlPoints:g.controlPoints,weights:g.weights,evals:Array.from({length:17},(_,k)=>{const t=a+(b-a)*k/16;return {t,point:evaluateCurve(g,t)};})});}
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
    ellipseInputs: [...document.querySelectorAll('.sk-panel [role="group"][aria-label="Ellipse"] input')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })),
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
const ellipseTitle = () => page.locator('.sk-panel .card-title').filter({ hasText: /^ELLIPSE$/ });
const ellipseRows = () => page.evaluate(() => [...document.querySelectorAll('.sk-panel [role="group"][aria-label="Ellipse"] input')].map(i => ({ label: i.getAttribute('aria-label'), value: i.value })));
const panelCheck = async label => { const text = await page.evaluate(() => document.querySelector('.sk-panel')?.textContent ?? ''); report.observations.push({ label: `${label}-panel-text`, text }); await persist();
  assert.ok(/Ellipse\s*192 tangent arcs/.test(text), `${label}: the constraint list shows one Ellipse row (192 tangent arcs)`); assert.ok(!/edge 192/i.test(text), `${label}: no per-arc rows (no "edge 192")`); };
const LABELS = ['Centre X', 'Centre Y', 'Rx', 'Ry', 'Angle'];
const valuesOf = rows => { assert.deepEqual(rows.map(r => r.label), LABELS, 'ELLIPSE lists Centre X, Centre Y, Rx, Ry, Angle'); return { center: [Number(rows[0].value), Number(rows[1].value)], rx: Number(rows[2].value), ry: Number(rows[3].value), angle: Number(rows[4].value) }; };
const alertText = () => page.evaluate(() => document.querySelector('.sk-panel [role="alert"]')?.textContent ?? null);
// ELLIPSE inputs apply on Enter or blur (a local draft while typing); Enter must not finish the sketch.
async function setField(label, text) { const input = sketchPanel().locator(`[role="group"][aria-label="Ellipse"] input[aria-label="${label}"]`); await input.fill(text); await input.press('Enter'); await page.waitForTimeout(300); }
async function openSketchEditor() {
  phase = 'open sketch editor'; const state = await doc(), consumer = state.nodes.findIndex(n => n.kind === 'extrude' && n.sketch === 0);
  if (consumer >= 0) { report.observations.push({ label: 'sketch-editor-route', via: `extrude node ${consumer}` }); await page.locator(`.history .hs[data-node-index="${consumer}"]`).click(); await editor().waitFor(); return; }
  const target = page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: 'Sketch · outline', exact: true }); assert.equal(await target.count(), 1, 'one standalone outline sketch button'); await target.click(); await editor().waitFor();
}
async function reopenSketch(label) { await openSketchEditor(); phase = `reopen sketch ${label}`; await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor(); await ellipseTitle().waitFor({ timeout: 15000 }); return ellipseRows(); }
async function finishSketch(label) { phase = `Finish sketch ${label}`; await page.locator('.topbar button.finish').click(); await sketchPanel().waitFor({ state: 'hidden' }); await ready(); return snapshot(label); }
async function startExtrude(label) {
  phase = `Extrude HUD ${label}`; await openSketchEditor(); await editor().getByRole('button', { name: 'Close editor', exact: true }).click(); await editor().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => (window.__studioSelection?.selection?.sketches ?? []).includes(0), null, { timeout: 15000 });
  await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('e'); await hud().waitFor();
  await page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 });
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
// Product read (bundled inspector) and the independent Python oracle on the same document and the Studio-reported volume. Everything is written before the first assertion.
async function inspect(label, mode, expect, volume) {
  phase = `product read and oracle ${label}`; await ready(); const accepted = await doc(), file = join(output, `${label}-doc.bcad`); await writeFile(file, JSON.stringify(accepted));
  const run = spawnSync(process.execPath, [inspector, file], { encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}.stdout.json`), run.stdout ?? ''); await writeFile(join(output, `${label}.stderr.txt`), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr); const read = JSON.parse(run.stdout); report.reads.push({ label, studioVolume: volume ?? null, ...read }); await persist();
  const input = { doc: accepted, mode, expect, volume: volume ?? null, curves: read.curves }; await writeFile(join(output, `${label}-oracle-input.json`), JSON.stringify(input, null, 2));
  const check = spawnSync('python3', ['-I', join(output, 'ellipse-oracle.py')], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }); await writeFile(join(output, `${label}-oracle.json`), check.stdout ?? ''); await writeFile(join(output, `${label}-oracle.stderr.txt`), check.stderr ?? '');
  report.oracles.push({ label, exit: check.status, stdout: check.stdout ? JSON.parse(check.stdout) : null, stderr: check.stderr }); await persist();
  assert.equal(check.status, 0, `ORACLE ${label}: ${check.stderr}`); assert.equal(JSON.parse(check.stdout).status, 'PASS');
  assert.equal(read.ok, true, `${label}: product evaluation ok (${read.error})`); assert.equal(read.hasNull, false, `${label}: no null stored in the document`);
  if (volume !== undefined) { assert.equal(read.bodyCount, 1, `${label}: one body`); assert.ok(Math.abs(read.evalVolume - volume) <= 1e-6 * volume, `${label}: product evalVolume ${read.evalVolume} vs Studio ${volume}`); assert.ok(Math.abs(read.facadeVolume - volume) <= 1e-6 * volume, `${label}: facade volume ${read.facadeVolume} vs Studio ${volume}`); }
  assert.deepEqual(await doc(), accepted); return { read, verified: JSON.parse(check.stdout) };
}
const initialFiles = ['apps/cad-studio/test/ellipse-sketch-browser.mjs', 'apps/cad-studio/src/viewport/ellipseDraft.ts', 'apps/cad-studio/test/sketch-ellipse-studio.test.ts', 'packages/barocss-cad-model/test/sketch-ellipse.test.ts', 'packages/barocss-cad-model/src/sketch/ellipse.ts',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/app/sketchControls.ts', 'apps/cad-studio/src/ui/SketchPanel.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx', 'apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/sketch/useSketchActions.ts',
  'packages/barocss-cad-model/src/sketch/spline.ts', 'packages/barocss-cad-model/src/sketch/profile.ts', 'packages/barocss-cad-model/src/sketch/reopen.ts', 'packages/barocss-cad-model/src/sketch/loops.ts', 'packages/barocss-cad-model/src/sketch/settle.ts',
  'packages/barocss-cad-model/src/sketch/types.ts', 'packages/barocss-cad-model/src/sketch/entityIds.ts', 'packages/barocss-cad-model/src/engine/curveSource.ts', 'packages/barocss-cad-model/src/engine/direct.ts', 'packages/barocss-cad-model/src/engine/doc.ts'];
let frozenFiles = initialFiles;
async function capsule(label, files) { const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(); assert.ok(unique.length <= 4096); const hashes = {}; for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file))); await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes; }
const CLICKS = [[10, 5], [60, 5], [10, 30]];
const D1 = { center: [10, 5], rx: 50, ry: 25, angle: 0 }, D2 = { center: [10, 5], rx: 50, ry: 20, angle: 30 }, D3 = { center: [10, 5], rx: 60, ry: 20, angle: 30 };
const REFUSED = 'A narrower ellipse than 1 : 5 is not supported; draw a slot or a spline instead.';
// The sketch node's checks shared by the Finish states: one outline with the definition, 192 points, 192 distinct outer side ids.
function checkSketch(node, def, label) {
  assert.equal(node.kind, 'sketch'); assert.ok(node.outline, `${label}: outline stored`); assert.deepEqual(node.outline.ellipse, def, `${label}: outline.ellipse`);
  assert.equal(node.outline.points.length, 192, `${label}: 192 outline points`); assert.ok(node.sideTags && Array.isArray(node.sideTags.outer), `${label}: sideTags.outer`);
  assert.equal(node.sideTags.outer.length, 192, `${label}: 192 outer side ids`); assert.equal(new Set(node.sideTags.outer).size, 192, `${label}: distinct side ids`);
}
try {
  report.sourceBefore = await capsule('initial-subset', initialFiles); report.sourceBeforeCount = Object.keys(report.sourceBefore).length; await writeFile(join(output, 'ellipse-oracle.py'), oracleSource); report.oracleSource = { hash: hash(oracleSource), productImports: 0 };
  const buildInputs = [], sourcefile = 'ellipse-inspector.ts', virtual = resolve(app, sourcefile);
  const built = await build({ stdin: { contents: inspectSource, resolveDir: app, sourcefile, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  await writeFile(join(output, 'inspector.ts'), inspectSource); await writeFile(join(output, 'inspector-metafile.json'), JSON.stringify(built.metafile, null, 2));
  // Stdin has no disk path. Its exact source/hash is captured and the virtual input is explicitly excluded.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file => resolve(file)).filter(file => file !== virtual)); report.virtualSources = [{ label: 'inspector', hash: hash(inspectSource), virtualInputExcluded: virtual }];
  inspector = join(output, 'inspector.mjs'); await writeFile(inspector, built.outputFiles[0].contents);
  const studioFiles = (await readdir(join(app, 'src'), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(app, 'src', file));
  frozenFiles = [...initialFiles, ...buildInputs, ...studioFiles, 'apps/cad-studio/vite.config.ts']; report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length;
  for (const [file, digest] of Object.entries(report.sourceBefore)) assert.equal(report.sourceFrozen[file], digest);
  for (const need of ['packages/barocss-cad-model/src/sketch/ellipse.ts', 'apps/cad-studio/src/viewport/Viewport.tsx', 'apps/cad-studio/src/ui/SketchPanel.tsx']) assert.ok(report.sourceFrozen[need], `${need} is in the frozen capsule`);
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;

  // Context 1: empty document.
  phase = 'empty document'; await newPage(); await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0); await ready(); const empty = await doc(); assert.equal(empty.nodes.length, 0, 'the document starts empty'); await snapshot('00-empty');
  phase = 'start XY sketch'; await command('Sketch'); await sketchPanel().waitFor(); await sketchPanel().getByLabel('Sketch plane', { exact: true }).selectOption('xy');
  await tool('Ellipse', 'i'); await frame(CLICKS);

  // 1. Three clicks: centre (10, 5), axis end (60, 5), minor point (10, 30).
  phase = 'ellipse clicks'; const pixels = []; for (const p of CLICKS) pixels.push(await worldClick(p));
  await page.mouse.move(5, 5); await page.waitForTimeout(250); await ellipseTitle().waitFor({ timeout: 15000 });
  const rows01 = await ellipseRows(); report.observations.push({ label: '01-clicked', clickPixels: pixels, rows: rows01, alert: await alertText(), overlayPoints: await page.evaluate(() => document.querySelectorAll('svg.vp-overlay circle.sk-point').length) }); await snapshot('01-drawn');
  assert.deepEqual(valuesOf(rows01), D1, 'ELLIPSE reads Centre (10, 5), Rx 50, Ry 25, Angle 0'); assert.equal(await alertText(), null, 'no refusal for the drawn ellipse'); assert.deepEqual(await doc(), empty, 'nothing is stored until Finish');

  // 2. Angle 30 and Ry 20 by the panel; Enter must not finish the sketch.
  phase = 'edit Angle and Ry'; const docBefore02 = await doc();
  await setField('Angle', '30'); await page.waitForFunction(() => document.querySelector('.sk-panel input[aria-label="Angle"]')?.value === '30', null, { timeout: 15000 });
  assert.equal(await sketchPanel().isVisible(), true, 'Enter on Angle did not finish the sketch'); assert.equal(await alertText(), null);
  await setField('Ry', '20'); await page.waitForFunction(() => document.querySelector('.sk-panel input[aria-label="Ry"]')?.value === '20', null, { timeout: 15000 });
  assert.equal(await sketchPanel().isVisible(), true, 'Enter on Ry did not finish the sketch'); assert.equal(await alertText(), null);
  await page.mouse.move(5, 5); await page.waitForTimeout(200); const rows02 = await ellipseRows(); await snapshot('02-edited'); report.observations.push({ label: '02-edited', rows: rows02 });
  assert.deepEqual(valuesOf(rows02), D2, 'the fields follow the edits'); assert.deepEqual(await doc(), docBefore02, 'the document is untouched until Finish');

  // 3. Finish.
  const done03 = await finishSketch('03-finished'), doc03 = done03.doc; assert.equal(doc03.nodes.length, 1, 'one sketch node'); report.observations.push({ label: '03-sketch', nodeKeys: Object.keys(doc03.nodes[0]), profile: doc03.nodes[0].profile, outlineKeys: Object.keys(doc03.nodes[0].outline ?? {}), segments: doc03.nodes[0].segments?.length ?? null }); await persist();
  checkSketch(doc03.nodes[0], D2, '03'); assert.deepEqual(await alerts(), []);
  const read03 = await inspect('03-native', 'sketch', { ...D2 }); assert.equal(read03.read.bodyCount, 0);

  // 4. Extrude 10 mm.
  await startExtrude('04'); const operation = await page.evaluate(() => { const s = document.querySelector('.hud select[aria-label="Operation"]'); return s ? { value: s.value, options: [...s.options].map(o => o.value) } : null; });
  const depthSelect = await hud().getByLabel('Depth', { exact: true }).count(); report.observations.push({ label: '04-extrude-hud', operation, depthSelect, hudText: await page.evaluate(() => document.querySelector('.hud')?.textContent ?? null) });
  if (operation && operation.options.includes('new') && operation.value !== 'new') await hud().getByLabel('Operation', { exact: true }).selectOption('new');
  if (depthSelect) await hud().getByLabel('Depth', { exact: true }).selectOption('distance');
  const distance = hud().getByLabel('Distance', { exact: true }); await distance.waitFor(); await distance.fill('10');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 });
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await changed(doc03); await hud().waitFor({ state: 'hidden' }); const done04 = await snapshot('04-extruded'), doc04 = done04.doc;
  assert.deepEqual(doc04.nodes[0], doc03.nodes[0], 'the sketch node is unchanged by the extrude'); assert.equal(doc04.nodes.length, 2); assert.equal(doc04.nodes[1].kind, 'extrude'); assert.equal(Math.abs(doc04.nodes[1].height), 10);
  assert.equal(done04.bodies.bodies.length, 1, 'one body'); const volume04 = done04.bodies.bodies[0].volume; assert.deepEqual(await alerts(), []);
  await inspect('04-native', 'sketch', { ...D2, height: 10 }, volume04);

  // 4b. Fillet on a top rim edge of the ellipse body is refused (the command is unavailable): a toast with the reason, no HUD, no node added. The edge (the first outer side meeting the top, at the +Rx end) is picked by the readonly-named pick hook of the other drivers.
  phase = 'Fillet refused on an ellipse side edge'; const first = doc04.nodes[0].sideTags.outer[0], extIndex = doc04.nodes.length - 1;
  const names = [`n${extIndex}.side[${first}]|n${extIndex}.top`, `n${extIndex}.top|n${extIndex}.side[${first}]`, `n${extIndex}.side0|n${extIndex}.top`, `n${extIndex}.top|n${extIndex}.side0`]; let picked = null;
  for (const name of names) { if (await page.evaluate(n => window.__studioSelectEdge(n), name)) { picked = name; break; } }
  report.observations.push({ label: '04b-edge', tried: names, picked }); await persist(); assert.ok(picked, `a top rim edge of the ellipse body could be selected (tried ${names})`);
  await page.waitForTimeout(300); await page.evaluate(() => document.activeElement?.blur()); await snapshot('04b-edge-selected');
  await command('Fillet'); await page.waitForFunction(() => document.querySelectorAll('.toast').length > 0, null, { timeout: 15000 }).catch(() => {});
  const refusedToasts = await alerts(), hudShown = await page.locator('.hud').count(); await snapshot('04b-fillet-refused'); report.observations.push({ label: '04b-fillet', toasts: refusedToasts, hudCount: hudShown }); await persist();
  assert.ok(refusedToasts.some(t => /Fillet can.t run here/.test(t ?? '') && (t ?? '').includes('not supported yet: the ellipse is 192 tangent arcs')), `Fillet is refused with the ellipse reason: ${JSON.stringify(refusedToasts)}`); assert.equal(hudShown, 0, 'no Fillet HUD opened');
  assert.deepEqual(await doc(), doc04, 'the refused Fillet added no node and changed nothing');
  // Cancel: clear the selection and let the toast go.
  await page.keyboard.press('Escape'); const notice = page.locator('.toast[role="alert"]'); if (await notice.count()) await notice.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.toast').length === 0, null, { timeout: 20000 });
  await persist(); assert.deepEqual(await doc(), doc04);

  // 5. Reopen, Rx 60, Finish: the side ids stay, the definition and the volume follow.
  const rows05 = await reopenSketch('05'); report.observations.push({ label: '05-reopened', rows: rows05 }); await panelCheck('05'); await snapshot('05-reopened');
  assert.deepEqual(valuesOf(rows05), D2, 'ELLIPSE shows the stored definition after reopening'); assert.deepEqual(await doc(), doc04, 'reopening does not change the document');
  phase = 'edit Rx'; await setField('Rx', '60'); await page.waitForFunction(() => document.querySelector('.sk-panel input[aria-label="Rx"]')?.value === '60', null, { timeout: 15000 });
  assert.equal(await sketchPanel().isVisible(), true, 'Enter on Rx did not finish the sketch'); assert.equal(await alertText(), null); assert.deepEqual(valuesOf(await ellipseRows()), D3); await snapshot('05-edited');
  const done06 = await finishSketch('06-refinished'), doc06 = done06.doc; assert.equal(doc06.nodes.length, 2); checkSketch(doc06.nodes[0], D3, '06');
  assert.deepEqual(doc06.nodes[0].sideTags, doc04.nodes[0].sideTags, 'the same 192 side ids after the edit'); assert.notDeepEqual(doc06.nodes[0].outline.points, doc04.nodes[0].outline.points, 'the outline changed'); assert.deepEqual(doc06.nodes[1], doc04.nodes[1], 'the Extrude node is unchanged');
  assert.equal(done06.bodies.bodies.length, 1, 'one body'); const volume06 = done06.bodies.bodies[0].volume; assert.ok(volume06 > volume04, 'a longer Rx gives a larger volume'); assert.deepEqual(await alerts(), []);
  await inspect('06-native', 'sketch', { ...D3, height: 10 }, volume06);

  // 6. A too-narrow edit (Ry 5 with Rx 60, ratio below 1 : 5) is refused; the definition and the document stay; Finish unchanged.
  const rows07 = await reopenSketch('07'); assert.deepEqual(valuesOf(rows07), D3); await panelCheck('07'); const docBefore07 = await doc(); phase = 'refused Ry';
  await setField('Ry', '5'); await page.waitForFunction(() => !!document.querySelector('.sk-panel [role="alert"]'), null, { timeout: 15000 }).catch(() => {});
  const refusal = await alertText(), rowsRefused = await ellipseRows(); await snapshot('07-refused'); report.observations.push({ label: '07-refused', alert: refusal, rows: rowsRefused });
  assert.equal(refusal, REFUSED, 'the refusal reason is shown in the panel alert'); assert.deepEqual(valuesOf(rowsRefused), D3, 'the definition did not change (the Ry field is back at 20)'); assert.deepEqual(await doc(), docBefore07, 'the document did not change');
  assert.equal(await sketchPanel().isVisible(), true, 'the refused edit left the sketch open');
  const done08 = await finishSketch('08-finish-unchanged'); assert.deepEqual(done08.doc, doc06, 'Finish after the refused edit leaves the document equal'); assert.deepEqual(await alerts(), []);
  await inspect('08-native', 'sketch', { ...D3, height: 10 }, done08.bodies.bodies[0].volume);

  // 7. Undo / Redo once, Save.
  phase = 'Undo/Redo'; await page.evaluate(() => document.activeElement?.blur());
  const undo = page.getByRole('button', { name: 'Undo', exact: true }); if (await undo.count() === 1 && await undo.isEnabled()) await undo.click(); else await page.keyboard.press('Meta+z');
  await page.waitForTimeout(800); await ready(); const afterUndo = await doc(), undoneTo = JSON.stringify(afterUndo) === JSON.stringify(doc04) ? 'doc04 (before the Rx edit)' : JSON.stringify(afterUndo) === JSON.stringify(doc06) ? 'doc06 (the unchanged Finish recorded no step)' : 'other';
  report.observations.push({ label: 'undo-once', undoneTo }); await persist(); assert.notEqual(undoneTo, 'other', 'one Undo returns the previous recorded document');
  const redo = page.getByRole('button', { name: 'Redo', exact: true }); if (await redo.count() === 1 && await redo.isEnabled()) await redo.click(); else await page.keyboard.press('Meta+Shift+z');
  await same(doc06); const saved = await save('ellipse'); assert.deepEqual(saved.doc, doc06);

  // Context 2: fresh Open of the saved file.
  const fresh = await freshOpen(saved.file, saved.doc, '09-fresh-open'); assert.deepEqual(fresh.doc, saved.doc, 'the opened document equals the saved one'); assert.deepEqual(await alerts(), [], 'no toast on Open');
  assert.equal(fresh.bodies.bodies.length, 1); const volumeFresh = fresh.bodies.bodies[0].volume; assert.ok(Math.abs(volumeFresh - volume06) <= 1e-6 * volume06, `09: volume ${volumeFresh} vs ${volume06}`);
  await inspect('09-native', 'sketch', { ...D3, height: 10 }, volumeFresh);

  // 8. Make curves from the reopened sketch: one exact rational NURBS direct curve.
  const rows10 = await reopenSketch('10'); assert.deepEqual(valuesOf(rows10), D3); await panelCheck('10'); assert.deepEqual(await doc(), saved.doc, 'reopening does not change the document'); await snapshot('10-reopened');
  phase = 'Make curves'; const docBeforeCurves = await doc(), directBefore = docBeforeCurves.direct?.objects?.length ?? 0;
  await sketchPanel().getByRole('button', { name: 'Make curves', exact: true }).click();
  await page.waitForFunction(n => (window.__studioDoc.direct?.objects?.length ?? 0) > n, directBefore, { timeout: 60000 }); await ready(); await sketchPanel().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => report.observations.push({ label: '11-panel-still-visible' }));
  const done11 = await snapshot('11-curves'), doc11 = done11.doc, made = doc11.direct.objects.slice(directBefore);
  report.observations.push({ label: '11-curves', names: doc11.direct.objects.map(o => o.name), newObjects: made.length, sketchPanelVisible: await sketchPanel().isVisible(), nodesEqualBefore: JSON.stringify(doc11.nodes) === JSON.stringify(docBeforeCurves.nodes) }); await persist();
  assert.equal(made.length, 1, 'one new direct object'); assert.ok(made[0].name.startsWith('Sketch curve 1'), `the new object is named Sketch curve 1: ${made[0].name}`); assert.equal(await sketchPanel().isVisible(), false, 'Make curves leaves the sketch');
  assert.deepEqual(doc11.nodes, docBeforeCurves.nodes, 'Make curves leaves the nodes unchanged'); assert.deepEqual(await alerts(), []);
  const read11 = await inspect('11-native', 'curve', { ...D3, height: 10 }, done11.bodies.bodies[0].volume); assert.equal(read11.read.curves.length, 1); assert.equal(read11.read.curves[0].degree, 2);

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); report.sourceAfterCount = Object.keys(report.sourceAfter).length; assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); report.sourceAfterCleanupCount = Object.keys(report.sourceAfterCleanup).length; if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
