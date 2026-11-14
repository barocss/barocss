import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], baseline = process.argv.includes('--baseline');
const flow = await createFlow({
  name: 'tapped-pattern-drawing', output, envFrozen: 'D1245_SOURCE_FROZEN',
  qualification: 'Read current circular and linear tapped pattern quantities in Studio and actual SVG, PDF and DXF.',
  initialFiles: [
    'packages/barocss-cad-model/src/drawing/callout.ts',
    'packages/barocss-cad-model/src/drawing/holeCircles.ts',
    'packages/barocss-cad-model/src/drawing/dimensions.ts',
    'packages/barocss-cad-model/src/drawing/sheet.ts',
    'packages/barocss-cad-model/src/io/svg.ts',
    'packages/barocss-cad-model/src/io/pdf.ts',
    'packages/barocss-cad-model/src/io/dxf.ts',
  ],
  oracleSource: String.raw`
import json, pathlib, re, sys, xml.etree.ElementTree as ET
data = json.load(sys.stdin)
svg = ET.fromstring(pathlib.Path(data["SVG"]).read_bytes())
pdf = pathlib.Path(data["PDF"]).read_bytes().decode("latin-1")
dxf = pathlib.Path(data["DXF"]).read_bytes().decode("cp1252").splitlines()
assert pdf.startswith("%PDF-1.4") and re.search(r"/Type /Pages[^>]* /Count 1\b", pdf)
assert dxf[-1] == "EOF"
def select(texts):
    return sorted(" ".join(t.split()) for t in texts if re.search(r"M6×1|PCD|^\d+× 8$", t))
svg_text = select(x.text or "" for x in svg.findall(".//{http://www.w3.org/2000/svg}text"))
pdf_text = select(re.sub(r"\\([0-7]{3}|[()\\])", lambda m: chr(int(m[1],8)) if len(m[1]) == 3 else m[1], key) for key in re.findall(r"\(((?:\\.|[^()\\])*)\) Tj", pdf))
dxf_text, kind = [], ""
for code, value in zip(dxf[::2], dxf[1::2], strict=True):
    if code.strip() == "0": kind = value
    if code.strip() == "1" and kind in ("TEXT", "MTEXT"):
        text = re.sub(r"\\U\+([A-Fa-f0-9]{4})", lambda m: chr(int(m[1],16)), value)
        dxf_text.append(text.replace("%%c", "Ø"))
print(json.dumps(dict(status="PASS", SVG=svg_text, PDF=pdf_text, DXF=select(dxf_text))))
`,
  limits: ['Stored M6×1 Z-axis blind tapped-hole fixture, 4 to 6 copies, circular and linear; actual desktop output.'],
});
function stock(mode) {
  const circular = mode === 'circle';
  return {
    format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
    nodes: [
      { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 60] },
      { id: 'n1', kind: 'extrude', sketch: 0, height: 12 },
      { id: 'n2', kind: 'hole', parent: { node: 1, side: 'solid' }, axis: 'z', side: 'max', face: 'n1.top',
        center: circular ? [45, 30] : [8, 30], radius: 2.5, depth: 6, thread: 'M6×1',
        pattern: circular ? { count: 4, about: [30, 30] } : { count: 4, step: [8, 0] } },
    ],
    outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
  };
}
const button = name => flow.page.getByRole('button', { name, exact: true });
const expected = (mode, copies) => [
  `${copies}× M6×1 × 6 DEEP`,
  mode === 'circle' ? `Ø30 PCD · ${copies}× EQ SP` : `${copies - 1}× 8`,
].sort();

async function capture(label, copies) {
  flow.phase = label;
  await flow.page.waitForFunction(() => window.__studioDrawing?.() && !document.querySelector('.dw-busy'));
  const state = await flow.snapshot(label, () => ({ drawing: window.__studioDrawing() }));
  const sheet = flow.page.locator('svg[aria-label="Drawing sheet"]');
  const texts = (await sheet.locator('text').allTextContents()).map(t => t.trim().replace(/\s+/g, ' '))
    .filter(t => /M6×1|PCD|^\d+× 8$/.test(t)).sort();
  const input = {}, hashes = {};
  for (const format of ['SVG', 'PDF', 'DXF']) {
    const [download] = await Promise.all([flow.page.waitForEvent('download'), button(`Export ${format}`).click()]);
    const file = join(output, `${label}.${format.toLowerCase()}`);
    await download.saveAs(file);
    const bytes = await readFile(file);
    input[format] = file;
    hashes[format] = sha256(bytes);
  }
  const exported = await flow.runOracle(input, label, { timeout: 10000 });
  for (const format of Object.keys(hashes)) assert.deepEqual(exported[format], texts, format);
  assert.equal(state.bodies.bodies.length, 1);
  const volume = state.bodies.bodies[0].volume;
  assert.ok(Math.abs(volume - (43200 - copies * 6 * 2.5 ** 2 * Math.PI)) <= 1e-7, volume);
  flow.report.observations.push({ label, texts, lost: state.drawing.dimensions.filter(d => d.lost).map(d => d.lost), volume, hashes });
  return { state, texts, hashes };
}

await flow.run(async () => {
  for (const mode of ['circle', 'line']) {
    await flow.newPage();
    const seed = stock(mode);
    const [chooser] = await Promise.all([flow.page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: `tapped-${mode}.bcad`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(seed)) });
    await flow.same(seed);
    await button('Drawing').click();
    await button('Auto-dimension').click();
    await flow.changed(seed);
    const authored = await flow.doc();
    const before = await capture(`${mode}-four`, 4);
    assert.deepEqual(before.texts, expected(mode, 4));

    await button('Model').click();
    await flow.openFeatureEditor(2, `tapped ${mode}`);
    await flow.editor().getByLabel('Copies', { exact: true }).fill('6');
    const changed = (await flow.applyEditor(authored, `${mode}-six-copies`)).doc;
    assert.equal(changed.nodes[2].pattern.count, 6);
    assert.equal(changed.nodes[2].thread, 'M6×1');
    await button('Drawing').click();
    const after = await capture(`${mode}-six-existing-drawing`, 6);
    if (baseline) {
      assert.ok(!after.texts.some(t => t.includes('6× M6')));
      assert.ok(after.texts.includes(mode === 'circle' ? 'Ø30 PCD' : '3× 8'), after.texts);
    } else {
      assert.ok(after.texts.every(t => expected(mode, 6).includes(t)), after.texts);
      assert.ok(after.texts.length === 2 || after.state.drawing.dimensions.filter(d => d.lost?.includes('Auto-dimension')).length >= 2);
    }

    await button('Model').click();
    await flow.undo();
    await flow.same(authored);
    await button('Drawing').click();
    assert.deepEqual((await capture(`${mode}-undo`, 4)).hashes, before.hashes);
    await button('Model').click();
    await flow.redo();
    await flow.same(changed);
    const { file, doc } = await flow.save(`tapped-${mode}-six`);
    await flow.newPage();
    const [reopen] = await Promise.all([flow.page.waitForEvent('filechooser'), button('Open').click()]);
    await reopen.setFiles(file);
    await flow.page.waitForFunction(name => document.querySelector('.doc-tab input')?.value === name, `tapped-${mode}-six`);
    await flow.ready();
    const reopened = await flow.doc();
    assert.deepEqual(reopened.nodes, doc.nodes);
    assert.deepEqual(reopened.outputs, doc.outputs);
    assert.deepEqual(reopened.drawing.dimensions.map(d => d.id), doc.drawing.dimensions.map(d => d.id));
    await button('Drawing').click();
    assert.deepEqual((await capture(`${mode}-reopened-drawing`, 6)).texts, after.texts);

    await button('Auto-dimension').click();
    await flow.changed(reopened);
    assert.deepEqual((await capture(`${mode}-refreshed-six`, 6)).texts, expected(mode, 6));
  }
  if (baseline) throw Error('Old PCD or repeated pitch reaches exported files after the pattern count changes.');
});
