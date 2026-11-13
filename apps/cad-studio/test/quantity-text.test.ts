import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { fmt, rectanglePart } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptySel } from '../src/app/studioConstants';
import { SelectionInspector } from '../src/ui/SelectionInspector';
import { quantityText } from '../src/ui/quantityText';
import { openImportedFile } from '../src/files/importedFile';

// Display inputs below are synthetic. These tests do not qualify tiny-body geometry.
test('finite nonzero values retain their sign and three significant digits when legacy text is zero', () => {
  assert.equal(quantityText(4.1887902e-9, '0'), '4.19e-9');
  assert.equal(quantityText(-4.1887902e-9, '-0'), '-4.19e-9');
  assert.equal(quantityText(.002), '2.00e-3');
  assert.equal(quantityText(Number.MIN_VALUE, '0'), '4.94e-324');
});

test('exact zero, negative zero and ordinary legacy output are preserved', () => {
  assert.equal(quantityText(0), '0'); assert.equal(quantityText(-0), '0'); assert.equal(quantityText(-0, '-0'), '0'); assert.equal(quantityText(0, '-0'), '0');
  for (const value of [1, 1.234, 1234, -.015, .005, -.005, .499, .5, -.5]) {
    const rounded = Math.round(value), text = fmt(rounded);
    assert.equal(quantityText(value, text), rounded === 0 && value !== 0 ? value.toExponential(2) : text);
  }
  assert.equal(quantityText(1234, '1,234'), '1,234');
  assert.equal(quantityText(NaN), 'NaN'); assert.equal(quantityText(Infinity), 'Infinity');
});

function inspector(body: BodyResult, selected: boolean) {
  const doc = rectanglePart(10, 10, 10);
  return renderToStaticMarkup(createElement(SelectionInspector, {
    model: { doc, evaluated: doc, bodies: [body], fresh: true, busy: false, massReady: true },
    selection: selected ? { ...emptySel, bodies: [0] } : emptySel,
    materialSettings: { material: 'al6061', setMaterial() {} },
    display: { showBox: false, setShowBox() {}, inertiaAt: 'centre', setInertiaAt() {} },
    changes: { commit() { return true; }, setSelection() {}, edgesToCurves() {}, async loadBendTable() {}, setFlatView() {}, setCutListView() {}, separate() {} },
    children: null,
  }));
}

function body() {
  const result = evaluateDoc(rectanglePart(10, 10, 10), 1);
  assert.ok(result.ok); return result.bodies[0];
}

test('body and part summary show tiny dimensions and quantities without changing source fields', () => {
  const b = body(); b.volume = 4.1887902e-9; b.area = 1.256637e-5;
  b.mesh = { ...b.mesh, bounds: { min: [0, 0, 0], max: [.002, .002, .002] } };
  const before = JSON.stringify(b), selected = inspector(b, true), summary = inspector(b, false);
  assert.match(selected, /4.19e-9.*mm³/); assert.match(selected, /1.13e-11.*g/);
  assert.match(selected, /1.26e-5.*mm²/); assert.match(selected, /2.00e-3/);
  assert.match(summary, /1.13e-11.*g/); assert.match(summary, /2.00e-3/);
  assert.equal(JSON.stringify(b), before);
});

test('ordinary body values retain existing integer volume, mass and area text', () => {
  const html = inspector(body(), true);
  assert.match(html, /Volume <b>1000 mm³/); assert.match(html, /Mass <b>2.7 g/);
  assert.match(html, /Surface area <b>600 mm²/); assert.match(html, /Bounds <b>10 × 10 × 10/);
});

test('real STEP import handler formats total volume after the existing metre conversion', async () => {
  const notices: string[] = [], opened: unknown[] = [];
  const source = "ISO-10303-21; DATA; #1=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT($,.METRE.)); ENDSEC; END-ISO-10303-21;";
  const options = {
    doc: rectanglePart(10, 10, 10), ownership: { isCurrent: () => true },
    worker: { nextRevision: () => 1, engine: { async stepMeshes() { return null; }, async part() { return { ok: true, bodies: [{ volume: 4.1887902e-18 }] }; } } },
    mesh: { setStage() {}, setRepairAsk() {}, setMeshAsk() {} },
    changes: { onOpened(doc: unknown, _name: string, accept: () => void) { opened.push(doc); accept(); }, commitDirect() { return true; }, fitLater() {} },
    onNotice(n: { hint: string }) { notices.push(n.hint); },
  } as unknown as Parameters<typeof openImportedFile>[1];
  await openImportedFile({ name: 'metre.step', text: async () => source } as File, options);
  assert.equal(opened.length, 1);
  assert.match(notices[0], /scaled ×1000 to millimetres; 4.19e-9 mm³ in all/);
});
