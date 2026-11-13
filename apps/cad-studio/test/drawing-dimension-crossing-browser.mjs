import assert from 'node:assert/strict';
import { resolve, relative } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && relative(repo, resolve(output)).startsWith('../'));
const a = { edge: 'n1.side0|n1.top', at: 'end', near: [0, 0, 8] };
const b = { edge: 'n1.side0|n1.top', at: 'end', near: [64, 0, 8] };
const c = { edge: 'n1.side1|n1.top', at: 'end', near: [64, 32, 8] };
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [64, 32], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 8, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
  drawing: { sheet: 'A3', scope: { kind: 'part' }, scale: 1, projection: 'third', hidden: false,
    title: 'Dimension ruler crossing', views: ['front', 'top'], dimensions: [
      { id: 'width', kind: 'linear', view: 'top', a, b, orient: 'horizontal', place: [32, 8] },
      { id: 'depth', kind: 'linear', view: 'top', a: b, b: c, orient: 'vertical', place: [16, 16] },
    ] },
};
const f = await createFlow({
  name: 'drawing-dimension-crossing', envFrozen: 'D951_SOURCE_FROZEN', output,
  qualification: 'Measure the two continuous rulers in the current Studio drawing and actual SVG and DXF.',
  initialFiles: [import.meta.filename],
  extraFrozen: ['packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/drawing/dimensions.ts',
    'packages/barocss-cad-model/src/drawing/annotations3d.ts', 'packages/barocss-cad-model/src/io/svg.ts',
    'packages/barocss-cad-model/src/io/dxf.ts', 'packages/barocss-cad/src/io/dxf-writer.ts'],
  limits: ['One A3, plain-mm, 1:1 Top view with two straight, continuous rulers.'],
  snapshotExtra: () => ({ drawing: window.__studioDrawing?.() }),
  oracleSource: `
import json, math, sys, xml.etree.ElementTree as ET
d = json.load(sys.stdin)
left,top,right,bottom = d['top']
assert abs(right-left-64) <= 0.0001 and abs(bottom-top-32) <= 0.0001
intersection = (left+16,bottom-8)
want = {'width':((left,bottom-8),(right,bottom-8)), 'depth':((left+16,bottom),(left+16,top))}
ns = {'s':'http://www.w3.org/2000/svg'}
root = ET.fromstring(d['svg'])
assert root.get('width') == '420mm' and root.get('height') == '297mm'
for name, pair in want.items():
    group = root.find(".//s:g[@data-dim='%s']" % name,ns)
    assert group.get('class') == 'dimension' and group.get('data-view') == 'top'
    assert len(group.findall("s:path[@fill='#000']",ns)) == 2
    assert group.find('s:text',ns).text == ('64' if name == 'width' else '32')
    lines = [((float(l.get('x1')),float(l.get('y1'))),(float(l.get('x2')),float(l.get('y2')))) for l in group.findall('s:line',ns)]
    assert sum(all(math.dist(p,q) <= 0.0001 for p,q in zip(line,pair)) for line in lines) == 1, (name,lines,pair)
    assert len(lines) == 3
raw = d['dxf'].splitlines()
pairs = list(zip(map(int,raw[::2]), (s.strip() for s in raw[1::2]), strict=True))
starts = [i for i,(k,v) in enumerate(pairs) if k == 0]
entities = [(pairs[i][1],dict(pairs[i+1:j])) for i,j in zip(starts,starts[1:])]
dimensions = [fields for kind,fields in entities if kind == 'DIMENSION']
assert sorted(float(fields[42]) for fields in dimensions) == [32,64]
for dimension in dimensions:
    block = dimension[2]
    start = next(i for i,(k,v) in enumerate(entities) if k == 'BLOCK' and v.get(2) == block)
    end = next(i for i in range(start+1,len(entities)) if entities[i][0] == 'ENDBLK')
    pair = want['width' if float(dimension[42]) == 64 else 'depth']
    lines = [((float(l[10]),297-float(l[20])),(float(l[11]),297-float(l[21]))) for k,l in entities[start+1:end] if k == 'LINE']
    assert len(lines) == 3
    assert sum(all(math.dist(p,q) <= 0.0001 for p,q in zip(line,pair)) for line in lines) == 1
print(json.dumps({'status':'PASS','intersection':intersection,'rulersMM':[64,32],'centerlineGapMM':0}))
`,
});
const button = name => f.page.getByRole('button', { name, exact: true });
await f.run(async () => {
  const originalContext = f.browser.newContext.bind(f.browser);
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.browser.newContext = async options => {
    const context = await originalContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultNavigationTimeout(60000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(() => {
      const files = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__crossingExports = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        files.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        if (!/\.(svg|dxf)$/.test(this.download) || !files.has(this.href)) return click.call(this);
        void files.get(this.href).text().then(text => window.__crossingExports.push(text));
      };
    });
    return context;
  };
  f.phase = 'open the crossing fixture and inspect the two Top dimensions';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'dimension-crossing.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.title === 'Dimension ruler crossing');
  await f.ready();
  await button('Drawing').click();
  await f.page.locator('g.dimension[data-dim="depth"]').waitFor();
  const state = await f.snapshot('01-crossing');
  assert.deepEqual(state.doc.drawing, source.drawing);
  assert.deepEqual(state.drawing.dimensions.map(d => [d.id, d.value]), [['width', 64], ['depth', 32]]);
  for (const [index, name] of ['Export SVG', 'Export DXF'].entries()) {
    await button(name).click();
    await f.page.waitForFunction(i => window.__crossingExports.length > i, index);
  }
  const [svg, dxf] = await f.page.evaluate(() => window.__crossingExports);
  f.report.observations.push({ label: 'baseline-exports', svgBytes: Buffer.byteLength(svg), svgSHA256: sha256(svg),
    dxfBytes: Buffer.byteLength(dxf), dxfSHA256: sha256(dxf) });
  await f.runOracle({ svg, dxf, top: state.drawing.boxes.top }, 'continuous-rulers');
  assert.deepEqual(f.report.downloads, []);
});
