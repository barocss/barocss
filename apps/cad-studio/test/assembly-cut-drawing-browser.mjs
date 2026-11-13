import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/assembly-cut-drawing-browser.mjs',
  'apps/cad-studio/src/ui/useDrawingSheet.ts', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'apps/cad-studio/src/engine/client.ts', 'apps/cad-studio/src/engine/engine.worker.ts',
  'packages/barocss-cad-model/src/engine/wireDoc.ts', 'packages/barocss-cad-model/src/util/revision.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad-model/src/io/svg.ts',
];
const f = await createFlow({
  name: 'assembly-cut-drawing', output: process.argv[2], envFrozen: 'D1027_SOURCE_FROZEN',
  qualification: 'The Assembly drawing and its SVG show only the current applied Assembly Cut.',
  limits: ['Two 60 × 40 × 5 mm plates and one base, a Ø8 through cut at [30,20], and the default front orientation.'],
  initialFiles: pins, requiredFrozen: pins,
  oracleSource: String.raw`
import json, math, re, sys, xml.etree.ElementTree as ET
x = json.load(sys.stdin)
s = "{http://www.w3.org/2000/svg}"
root = ET.fromstring(x["svg"])
shown = ET.fromstring(x["shown"])
views = ("front","top","right","iso")
def read(doc, view):
    group, = [g for g in doc.iter(s+"g") if g.get("class") == "view" and g.get("data-view") == view]
    return list(group)
def signature(elements):
    return [(e.tag, dict(sorted(e.attrib.items())), e.text) for e in elements]
def close(a, b):
    return abs(a-b) < 0.0002
def number_list(text):
    return list(map(float,re.findall(r"[-+]?(?:\d+\.?\d*|\.\d+)",text)))
groups = {v: read(root,v) for v in views}
for v in views:
    assert signature(groups[v]) == signature(read(shown,v)), v
def lines(v, hidden):
    return [tuple(float(e.get(k)) for k in ("x1","y1","x2","y2")) for e in groups[v]
            if e.tag == s+"line" and bool(e.get("stroke-dasharray")) == hidden]
def arcs(v, hidden=False):
    return [number_list(e.get("d")) for e in groups[v]
            if e.tag == s+"path" and "A" in e.get("d","") and bool(e.get("stroke-dasharray")) == hidden]
top_lines = lines("top",False)
xmin = min(min(a,c) for a,_,c,_ in top_lines)
xmax = max(max(a,c) for a,_,c,_ in top_lines)
ymin = min(min(b,d) for _,b,_,d in top_lines)
ymax = max(max(b,d) for _,b,_,d in top_lines)
assert close(xmax-xmin,90) and close(ymax-ymin,80), (xmin,xmax,ymin,ymax)
r = x["radius"]
rim = arcs("top")
if r:
    centre = [xmin+40,ymax-40]  # Base starts at [-10,-20]. Top maps [x,y] to [x,-y].
    assert len(rim) == 2, rim
    for a in rim:
        assert len(a) == 9 and close(a[2],r) and close(a[3],r) and a[5] == 0, a
        assert all(close(c,(p+q)/2) for c,p,q in zip(centre,a[:2],a[-2:])), (centre,a)
        assert close(math.dist(a[:2],a[-2:]),2*r), a
    assert all(close(p,q) for p,q in zip(rim[0][:2],rim[1][-2:])), rim
    assert all(close(p,q) for p,q in zip(rim[1][:2],rim[0][-2:])), rim
    iso = arcs("iso")
    assert sum(sorted(a[2:4]) == [round(r/math.sqrt(3),4),r] for a in iso) >= 2, iso
else:
    assert not rim and not arcs("iso"), (rim,arcs("iso"))
hidden_bore = {}
for v, u in [("front",40),("right",40)]:
    solid = lines(v,False)
    left = min(min(a,c) for a,_,c,_ in solid)
    bottom = max(max(b,d) for _,b,_,d in solid)
    # The lowest stock edge is at z=-4. Each bore wall spans z=[0,10].
    hidden_bore[v] = []
    for side in (-1,1):
        at = left+u+side*(r or 4)
        spans = sorted((bottom-max(b,d)-4,bottom-min(b,d)-4) for a,b,c,d in lines(v,True)
                       if close(a,at) and close(c,at) and not close(b,d))
        if r:
            assert len(spans) in (1,2) and close(spans[0][0],0) and close(spans[-1][1],10), (v,at,spans)
            if len(spans) == 2:
                assert close(spans[0][1],5) and close(spans[1][0],5), (v,spans)
        else:
            assert not spans, (v,at,spans)
        hidden_bore[v].append(spans)
title, = [g for g in root.iter(s+"g") if g.get("class") == "title"]
source, = [e.text for e in title if (e.text or "").startswith("SRC ")]
print(json.dumps({"status":"PASS","topRimArcs":len(rim),"isoVisibleArcs":len(arcs("iso")),"hiddenBore":hidden_bore,"source":source}))
`,
});
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const mode = name => button(name, f.page.locator('.mode')).click();
const hud = () => f.page.getByRole('complementary', { name: 'Assembly cut', exact: true });
const settings = () => f.page.getByRole('complementary', { name: 'Drawing settings', exact: true });
const pick = name => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).first().click();
const waitPreview = (x, present) => f.page.waitForFunction(([x, present]) =>
  window.__studioInstanceBounds?.()?.length === 2 && !!window.__studioInstanceAt?.([x, 20, 10]) === present, [x, present]);

async function createDraft() {
  await pick('Plate 1');
  await clickModelCommand(f.page, 'Modify', 'Assembly cut');
  await hud().waitFor();
  await hud().getByLabel('Radius mm', { exact: true }).fill('4');
  for (const [axis, value] of [['X', '30'], ['Y', '20'], ['Z', '10']]) await hud().getByLabel('Centre ' + axis, { exact: true }).fill(value);
  await pick('Plate 2');
  await button('Add selected', hud()).click();
  const pending = await f.snapshot('creation-preview');
  assert.ok(await hud().getByText('Plate 1', { exact: true }).count(), pending.doc.assemblyCuts);
  assert.ok(await hud().getByText('Plate 2', { exact: true }).count(), pending.doc.assemblyCuts);
  await waitPreview(30, false);
}

async function verify(label, expected, radius) {
  await mode('Drawing');
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.scale === 1);
  const index = await f.page.evaluate(() => window.__cutDrawingCaptures.length);
  await button('Export SVG', settings()).click();
  const svg = await f.page.evaluate(index => window.__cutDrawingCaptures[index], index);
  assert.equal(await f.page.evaluate(() => window.__cutDrawingCaptures.length), index + 1);
  const shown = await f.page.locator('svg').filter({ has: f.page.locator('g.view[data-view="top"]') }).evaluate(el => new XMLSerializer().serializeToString(el));
  const state = await f.snapshot(label);
  assert.deepEqual(state.doc, expected);
  f.report.files.push({ label, sha256: sha256(svg), kind: 'Studio SVG' });
  const oracle = await f.runOracle({ svg, shown, radius }, label);
  return { svg, source: oracle.source };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    await context.addInitScript(() => {
      const urls = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__cutDrawingCaptures = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob.type === 'image/svg+xml') urls.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = urls.get(this.href);
        if (!blob || !this.download.endsWith('.svg')) return click.call(this);
        window.__cutDrawingCaptures.push(blob.text());
        urls.delete(this.href);
      };
    });
    return context;
  };
  await f.newPage();
  const doc = JSON.parse(await readFile(join(f.repo, fixture), 'utf8'));
  const file = 'assembly-cut-drawing.bcad';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Top', f.page.locator('.views')).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await waitPreview(30, true);

  f.phase = 'Configure the 1:1 assembly sheet and export stock';
  await mode('Drawing');
  await settings().getByLabel('Drawing scope', { exact: true }).selectOption('assembly');
  await settings().getByLabel('Scale', { exact: true }).selectOption('1');
  await settings().getByLabel('Hidden lines', { exact: true }).check();
  const stock = await f.doc();
  assert.deepEqual(stock.drawing.scope, { kind: 'assembly' });
  const stockExport = await verify('stock', stock, 0);

  f.phase = 'Preview the new cut without changing the Drawing';
  await mode('Model');
  await createDraft();
  assert.equal((await verify('creation-draft', stock, 0)).svg, stockExport.svg);
  await mode('Model');
  await hud().waitFor();
  await waitPreview(30, false);

  f.phase = 'Apply Ø8 and read the current sheet and SVG';
  await button('Cut', hud()).click();
  await f.changed(stock);
  const applied = await f.doc();
  assert.equal(applied.assemblyCuts[0].profile.radius, 4);
  const appliedExport = await verify('applied', applied, 4);
  assert.notEqual(appliedExport.source, stockExport.source);

  f.phase = 'Undo and Redo with Drawing active';
  await f.undo();
  await f.same(stock);
  assert.equal((await verify('undo', stock, 0)).svg, stockExport.svg);
  await f.redo();
  await f.same(applied);
  assert.equal((await verify('redo', applied, 4)).svg, appliedExport.svg);

  f.phase = 'Preview a Ø12 edit and cancel without changing the Drawing';
  await mode('Model');
  await f.page.locator('button[aria-label^="Edit cut"]').first().click();
  await hud().getByLabel('Radius mm', { exact: true }).fill('6');
  await waitPreview(35, false);
  assert.equal((await verify('edit-draft', applied, 4)).svg, appliedExport.svg);
  await mode('Model');
  await hud().waitFor();
  assert.equal(await hud().getByLabel('Radius mm', { exact: true }).inputValue(), '6');
  await button('Cancel', hud()).click();
  await waitPreview(35, true);
  assert.equal((await verify('edit-cancelled', applied, 4)).svg, appliedExport.svg);

  f.phase = 'Reopen the saved assembly with the applied cut and export again';
  await mode('Model');
  const projectName = 'D1027 Assembly Cut Drawing';
  const project = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  async function connectProject() {
    await button('Project and versions').click();
    await project.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
    await button('Project in this browser', project).click();
    await project.getByLabel('Project', { exact: true }).waitFor();
  }
  await connectProject();
  await button('Save').click();
  await project.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  await button('Close project', project).click();
  await project.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.ready();
  await connectProject();
  await button('Open ' + file, project).click();
  await f.same(applied);
  assert.equal((await verify('reopened', applied, 4)).svg, appliedExport.svg);
  assert.deepEqual(f.report.downloads, []);
});
