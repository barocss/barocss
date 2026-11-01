import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { drawingInputs } from '../src/chat/drawing';
import assert from 'node:assert/strict';
import { brepsFor } from '../src/engine/evaluate';
import { rectanglePart, starterDoc, type StudioDoc } from '../src/engine/doc';
import { projectViews } from '../src/drawing/project';
import { sectionsCut } from '../src/drawing/section';
import { layoutSheet } from '../src/drawing/views';
import { buildSheet, sectionExtents, sheetSections, type Mark, type Sheet } from '../src/drawing/sheet';
import { snapPoints } from '../src/drawing/dimensions';
import { defaultDrawing, readDrawing, sectionsOf, type DrawingDimension, type DrawingSettings, type DrawingViews } from '../src/drawing/types';
import { checkManufacturingDrawing, withManufacturingDrawing } from '../src/drawing/options';
import { forSheet, mergeSheet, nextSheetId, removeSheet, sheetCount, sheetSetIssues, staleSheetViews } from '../src/drawing/sheets';
import { autoLayoutSheets, buildSheets, sheetsIssues } from '../src/drawing/sheetSet';
import { runDrawingTool } from '../src/chat/drawing';
import { sheetSvg, sheetsSvg } from '../src/io/svg';
import { sheetPdf, sheetsPdf } from '../src/io/pdf';
import { sheetDxf } from '../src/io/dxf';

// 11 ④: drawing sets. Oracles by hand: the starter plate is 64 × 32 × 8 with a Ø8 hole at (32, 16); a sheet with the
// iso and right views has no front or top view; the PDF's MediaBox of A4 is 297 × 210 mm = 841.89 × 595.28 pt.

const doc: StudioDoc = starterDoc();
const viewsOf = (): DrawingViews => { const b = brepsFor(doc); assert.ok('breps' in b); const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok); return r.views; };
const views = viewsOf();
const META = { title: 'plate', date: '2026-11-01' };
const texts = (s: Sheet) => s.groups.flatMap(g => g.marks).filter((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text').map(m => m.text);
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;

function dims(): DrawingDimension[] {
  const f = snapPoints(views.front), at = (u: number, w: number) => f.find(p => near(p.at[0], u) && near(p.at[1], w))!.ref;
  const hole = views.top.edges.find(e => e.kind === 'circle')!, circle = { edge: hole.name, near: [...hole.circle!.center] as [number, number, number] };
  return [
    { id: 'wide', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 0), orient: 'horizontal', place: [32, -12] },
    { id: 'bore', view: 'top', kind: 'diameter', ...circle, place: [33, 17] },
  ];
}
function twoSheets(extra: Partial<DrawingSettings> = {}): DrawingSettings {
  return { ...defaultDrawing(), dimensions: dims(), views: ['front', 'top', 'right', 'iso'], sheets: [{ id: 'S2', name: 'Details', views: ['iso', 'right'] }], ...extra };
}
function built(settings: DrawingSettings, k: number) {
  const cuts = sheetSections(sectionsCut(doc, sectionsOf(settings))), s = forSheet(settings, k);
  const layout = layoutSheet(views, s, sectionExtents(s, cuts)), sheet = buildSheet(views, layout, s, META, cuts);
  return { s, layout, sheet, cuts };
}

test('a drawing with no sheets is the one sheet it was: forSheet gives the same settings, and the sets build the same sheet', () => {
  const settings: DrawingSettings = { ...defaultDrawing(), dimensions: dims() };
  assert.equal(forSheet(settings, 0), settings);
  assert.equal(sheetCount(settings), 1);
  const layout = layoutSheet(views, settings), direct = buildSheet(views, layout, settings, META);
  const [one, ...more] = buildSheets(views, settings, META);
  assert.equal(more.length, 0);
  assert.equal(sheetSvg(one.sheet, 'p'), sheetSvg(direct, 'p'));
  assert.equal(sheetDxf(one.sheet, one.layout).text, sheetDxf(direct, layout).text);
  assert.deepEqual(Buffer.from(sheetsPdf([direct], 'p')), Buffer.from(sheetPdf(direct, 'p')));
  assert.deepEqual(texts(direct).filter(t => /OF/.test(t)), [], 'no n OF N on a single sheet');
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(settings))), readDrawing(settings));
  assert.ok(!('sheets' in readDrawing({ sheets: [] })));
});

test('two sheets: the views split, each annotation follows its view, the title blocks read 1 OF 2 and 2 OF 2, the index and the revisions only on the first', () => {
  const settings = twoSheets({ revisions: [{ revision: 'A', date: '2026-10-01', description: 'first' }], tables: [{ id: 'rev', from: 'revisions' }], notes: [{ id: 'gen', text: 'GENERAL', at: [20, 20] }, { id: 'lead', text: 'LEAD', at: [200, 40], leader: { view: 'right', at: [10, 4] } }] });
  const a = built(settings, 0), b = built(settings, 1), all = ['front', 'top', 'right', 'iso'] as const;
  assert.deepEqual(all.filter(v => !a.layout.views[v].hidden), ['front', 'top']);
  assert.deepEqual(all.filter(v => !b.layout.views[v].hidden), ['right', 'iso']);
  const ids = (s: Sheet) => s.groups.filter(g => g.role === 'dimension').map(g => g.id);
  assert.deepEqual(ids(a.sheet), ['wide', 'bore']);
  assert.deepEqual(ids(b.sheet), []);
  assert.deepEqual(a.sheet.groups.filter(g => g.role === 'note').map(g => g.id), ['gen'], 'the general note on the first sheet');
  assert.deepEqual(b.sheet.groups.filter(g => g.role === 'note').map(g => g.id), ['lead'], 'the note with a leader on its view’s sheet');
  assert.ok(texts(a.sheet).includes('1 OF 2 A4') && texts(b.sheet).includes('2 OF 2 A4'));
  // (The revision table and the sheet index on the first sheet only; the index lists both sheets by name.)
  assert.ok(texts(a.sheet).includes('REVISIONS') && !texts(b.sheet).includes('REVISIONS'));
  assert.ok(texts(a.sheet).includes('SHEET INDEX') && !texts(b.sheet).includes('SHEET INDEX'));
  assert.ok(['Sheet 1', 'Details'].every(t => texts(a.sheet).includes(t)));
  assert.equal(b.s.titleBlock, undefined, 'a later sheet has the basic continuation block');
  // (Each sheet is laid out alone: the second has no front or top, so its scale is its own.)
  assert.ok(b.layout.fits && a.layout.fits);
});

test('a drawing set with one sheet label only when there are several: a drawing with sheets: [] reads as one sheet', () => {
  assert.equal(sheetCount(readDrawing({ sheets: [{ id: 'S2', views: [] }] })), 2, 'an empty sheet is kept (the issue list says it is empty)');
  assert.equal(sheetCount(readDrawing({ sheets: [] })), 1);
});

test('a detail whose view is on another sheet: its circle stays on the parent’s sheet marked SEE SHEET 2, the view says FROM SHEET 1', () => {
  const settings = twoSheets({ details: [{ id: 'B', view: 'front', center: [10, 4], radius: 6, scale: 5 }], sheets: [{ id: 'S2', name: 'Details', views: ['iso', 'detail:B'] }] });
  const a = built(settings, 0), b = built(settings, 1);
  assert.ok(texts(a.sheet).includes('SEE SHEET 2') && !texts(a.sheet).some(t => t.startsWith('DETAIL B')));
  assert.ok(a.sheet.groups.some(g => g.role === 'detail' && g.id === 'B' && g.view === 'front'), 'the circle on the front view');
  assert.ok(texts(b.sheet).includes('DETAIL B (5:1)') && texts(b.sheet).includes('FROM SHEET 1'));
  assert.ok(b.sheet.details?.some(d => d.id === 'B') && !a.sheet.details?.length);
  assert.ok(!b.sheet.detailsMissing?.length && !a.sheet.detailsMissing?.length);
  // (A detail that stays with its parent is drawn as before: no cross-reference.)
  const kept = built(twoSheets({ details: [{ id: 'B', view: 'front', center: [10, 4], radius: 6, scale: 5 }] }), 0);
  assert.ok(kept.sheet.details?.some(d => d.id === 'B') && !texts(kept.sheet).some(t => /SHEET \d/.test(t)));
  // (An unlisted detail follows its parent: here a detail of the right view is on the second sheet.)
  const follow = twoSheets({ details: [{ id: 'C', view: 'right', center: [10, 4], radius: 4, scale: 5 }] });
  assert.ok(built(follow, 1).sheet.details?.some(d => d.id === 'C'));
});

test('a removed section on another sheet: the cutting line (SEE SHEET 2) on the parent’s sheet, the section FROM SHEET 1', () => {
  const settings = twoSheets({ sections: [{ id: 'A', view: 'top', at: -4, removed: { scale: 1 } }], sheets: [{ id: 'S2', views: ['iso', 'section:A'] }] });
  const a = built(settings, 0), b = built(settings, 1);
  assert.ok(texts(a.sheet).includes('SEE SHEET 2') && texts(a.sheet).includes('A'), 'the line and its letter on the top view’s sheet');
  assert.ok(!a.sheet.sections?.length, 'no section drawn on sheet 1');
  assert.ok(b.sheet.sections?.some(x => x.id === 'A' && x.form === 'removed'));
  assert.ok(texts(b.sheet).some(t => t.startsWith('SECTION A–A')) && texts(b.sheet).includes('FROM SHEET 1'));
  // (A principal section stays in projection with its view, wherever it is listed.)
  const plain = twoSheets({ sections: [{ id: 'A', view: 'front', at: 16 }], sheets: [{ id: 'S2', views: ['iso', 'section:A'] }] });
  assert.match(String(sheetSetIssues(plain)), /^$/);
  assert.ok(staleSheetViews(plain).some(x => /stays with the view|cannot be on another sheet/.test(x.why) || /with its front view/.test(x.why)));
  assert.ok(built(plain, 0).sheet.sections?.some(x => x.id === 'A'), 'still on its view’s sheet');
});

test('refusals: a view on two sheets, an unknown id, a section that is not removed, a malformed sheet — in plain words', () => {
  const ask = (sheets: unknown, base: DrawingSettings = twoSheets()) => {
    const p = checkManufacturingDrawing({ sheets });
    if (p.length) return p[0].message;
    try { withManufacturingDrawing({ ...base, sheets: undefined }, { sheets }); return null; } catch (e) { return (e as Error).message; }
  };
  assert.match(ask([{ id: 'S2', views: ['iso'] }, { id: 'S3', views: ['iso'] }])!, /iso is listed on sheets S2 and S3.*exactly one sheet/);
  assert.match(ask([{ id: 'S2', views: ['iso', 'iso'] }])!, /iso is listed on S2 twice/);
  assert.match(ask([{ id: 'S2', views: ['sideways'] }])!, /not a view id/);
  assert.match(ask([{ id: 'S2', views: ['section:Q'] }])!, /section Q, which the drawing does not have/);
  assert.match(ask([{ id: 'S2', views: ['detail:Q'] }])!, /detail Q, which the drawing does not have/);
  assert.match(ask([{ id: 'S2', views: [] }, { id: 'S2', views: [] }])!, /two sheets are called S2/);
  assert.match(ask([{ id: 'S2', size: 'A0', views: [] }])!, /size is A4 or A3/);
  assert.match(ask([{ id: 'S2', views: [], color: 'red' }])!, /No other keys/);
  assert.match(ask('x')!, /give a list/);
  assert.equal(ask([{ id: 'S2', name: 'Details', size: 'A3', scale: 2, views: ['iso', 'right'] }]), null);
  assert.equal(ask([]), null);
  // (A plain section listed: refused against the drawing that has it; removing a section a sheet lists is refused too.)
  const withA = { ...defaultDrawing(), dimensions: [], sections: [{ id: 'A', view: 'front' as const, at: 16 }] };
  assert.throws(() => withManufacturingDrawing(withA, { sheets: [{ id: 'S2', views: ['section:A'] }] }), /drawn in projection with its front view/);
  const removedA = { ...defaultDrawing(), dimensions: [], sections: [{ id: 'A', view: 'front' as const, at: 16, removed: {} }], sheets: [{ id: 'S2', views: ['section:A'] }] };
  assert.throws(() => withManufacturingDrawing(removedA, { sections: [] }), /Sheet S2 lists section A, which the drawing does not have/);
});

test('Open keeps ids the drawing no longer has and the first sheet’s issue list reports them; an empty sheet is reported by the set', () => {
  const file = JSON.parse(JSON.stringify(twoSheets({ sheets: [{ id: 'S2', name: 'Details', views: ['iso', 'section:Z', 'detail:Q'] }, { id: 'S3', views: [] }] })));
  const settings = readDrawing(file);
  assert.deepEqual(settings.sheets![0].views, ['iso', 'section:Z', 'detail:Q'], 'kept as listed');
  const stale = staleSheetViews(settings);
  assert.equal(stale.length, 2);
  const issues = sheetsIssues({ views, settings, callout: () => null, meta: META });
  assert.ok(issues.some(x => x.sheet === 1 && x.issue.code === 'SHEET_SET' && /Sheet 2 \(Details\) lists section Z, which the drawing does not have/.test(x.issue.message)));
  assert.ok(issues.some(x => x.sheet === 1 && /detail Q/.test(x.issue.message)));
  assert.ok(issues.some(x => x.sheet === 3 && x.issue.code === 'SHEET_SET' && /Sheet 3 has no view on it/.test(x.issue.message)));
  // (The stale ids change nothing on the sheets: the iso view is still on the second.)
  assert.ok(built(settings, 1).sheet.groups.some(g => g.role === 'view' && g.view === 'iso'));
});

test('a drawing set’s issues are per sheet and name the sheet; what is missing is judged on the whole drawing', () => {
  const settings = twoSheets();
  const issues = sheetsIssues({ views, settings, callout: () => null, meta: META });
  // (The hole's size is on sheet 1 and the top view is there too: nothing about hidden views on the second sheet.)
  assert.ok(!issues.some(x => x.sheet === 2 && /not shown|overall/.test(x.issue.message)), JSON.stringify(issues.filter(x => x.sheet === 2)));
  assert.ok(issues.every(x => x.name === (x.sheet === 1 ? 'Sheet 1' : 'Details')));
  // (Move the top view to sheet 2: the hole's size dimension is then on a sheet apart from its view, still counted once.)
  const moved = twoSheets({ sheets: [{ id: 'S2', name: 'Details', views: ['top'] }] });
  const second = sheetsIssues({ views, settings: moved, callout: () => null, meta: META });
  assert.ok(!second.some(x => x.issue.code === 'VIEW_NEEDED'), JSON.stringify(second));
});

test('a multi-page PDF: a page for each sheet, each at its own size', () => {
  const settings = twoSheets({ sheets: [{ id: 'S2', name: 'Details', size: 'A3', views: ['iso', 'right'] }] });
  const sheets = buildSheets(views, settings, META).map(x => x.sheet);
  assert.deepEqual(sheets.map(s => s.size), [[297, 210], [420, 297]]);
  const pdf = Buffer.from(sheetsPdf(sheets, 'plate')).toString('latin1');
  assert.equal((pdf.match(/\/Type \/Page /g) ?? []).length, 2);
  assert.match(pdf, /\/Count 2/);
  const boxes = [...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => [Number(m[1]), Number(m[2])]);
  const pt = (mm: number) => mm * 72 / 25.4;
  assert.equal(boxes.length, 2);
  assert.ok(near(boxes[0][0], Math.round(pt(297) * 1e4) / 1e4) && near(boxes[0][1], Math.round(pt(210) * 1e4) / 1e4), 'A4 first');
  assert.ok(near(boxes[1][0], Math.round(pt(420) * 1e4) / 1e4) && near(boxes[1][1], Math.round(pt(297) * 1e4) / 1e4), 'A3 second');
  // (The cross-reference table is valid: every object offset in the xref points at its "n 0 obj".)
  const xref = pdf.indexOf('xref\n'), offsets = [...pdf.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map(m => Number(m[1]));
  offsets.forEach((o, k) => assert.ok(pdf.startsWith(`${k + 1} 0 obj`, o), `object ${k + 1}`));
  assert.equal(sheetsSvg(sheets, 'plate').length, 2);
});

test('revision records may carry an ECO number: the column shows only when one has it', () => {
  const rows = [{ revision: 'A', date: '2026-10-01', description: 'first' }, { revision: 'B', date: '2026-10-02', description: 'second', eco: 'ECO-1042' }];
  const s = readDrawing({ revisions: rows, tables: [{ id: 'rev', from: 'revisions' }] });
  assert.equal(s.revisions![1].eco, 'ECO-1042');
  assert.equal(s.revisions![0].eco, undefined);
  assert.deepEqual(checkManufacturingDrawing({ revisions: rows }), []);
  assert.ok(checkManufacturingDrawing({ revisions: [{ ...rows[0], eco: '' }] }).length, 'an empty eco is refused');
  const t = built({ ...defaultDrawing(), ...s }, 0).sheet;
  assert.ok(texts(t).includes('ECO') && texts(t).includes('ECO-1042'));
  const plain = built({ ...defaultDrawing(), dimensions: [], revisions: [rows[0]], tables: [{ id: 'rev', from: 'revisions' }] }, 0).sheet;
  assert.ok(!texts(plain).includes('ECO'));
});

test('Save and Open: the sheets round-trip through JSON, in the reader’s order, and an edit on a sheet merges back into the whole drawing', () => {
  const settings = readDrawing(twoSheets({ details: [{ id: 'B', view: 'front', center: [10, 4], radius: 6 }], sheets: [{ id: 'S2', name: 'Details', size: 'A3', scale: 2, views: ['iso', 'right', 'detail:B'] }] }));
  assert.deepEqual(readDrawing(JSON.parse(JSON.stringify(settings))), settings);
  assert.equal(JSON.stringify(readDrawing(JSON.parse(JSON.stringify(settings)))), JSON.stringify(settings));
  // (Editing sheet 2 — a new note on its right view, a dimension moved — leaves sheet 1's items as they were.)
  const on2 = forSheet(settings, 1);
  assert.equal(on2.sheet, 'A3'); assert.equal(on2.scale, 2); assert.equal(on2.sheets, undefined);
  const edited = mergeSheet(settings, 1, { ...on2, notes: [{ id: 'n1', text: 'NEW', at: [100, 50], leader: { view: 'right', at: [4, 4] } }], sheet: 'A4' });
  assert.deepEqual(edited.dimensions, settings.dimensions);
  assert.equal(edited.sheet, settings.sheet, 'the drawing’s own size is the first sheet’s');
  assert.equal(edited.sheets![0].size, 'A4', 'sheet 2’s size is its entry’s');
  assert.deepEqual(edited.notes!.map(n => n.id), ['n1']);
  assert.equal(JSON.stringify(readDrawing(JSON.parse(JSON.stringify(edited)))), JSON.stringify(readDrawing(edited)));
  // (A dimension deleted on sheet 1 is gone; the sheets stay.)
  const on1 = forSheet(settings, 0), cut = mergeSheet(settings, 0, { ...on1, dimensions: on1.dimensions.filter(d => d.id !== 'wide') });
  assert.deepEqual(cut.dimensions.map(d => d.id), ['bore']);
  assert.deepEqual(cut.sheets, settings.sheets);
  // (The sheet index is made for the first sheet and never written back.)
  assert.ok(forSheet(settings, 0).tables!.some(t => t.id === 'sheet-index') && !cut.tables?.some(t => t.id === 'sheet-index'));
});

test('Auto layout runs on each sheet on its own and writes each result back', () => {
  const settings = twoSheets({ sheets: [{ id: 'S2', name: 'Details', views: ['iso'] }] });
  const r = autoLayoutSheets({ views, settings, callout: () => null, meta: META });
  assert.equal(r.reports.length, 2);
  assert.ok(r.reports.every(x => x.scale > 0));
  assert.ok(r.settings.dimensions.some(d => d.auto && d.view === 'front'), 'the first sheet was dimensioned');
  assert.ok(r.settings.dimensions.every(d => d.view !== 'iso'), 'nothing is dimensioned on the iso view');
  assert.deepEqual(r.settings.sheets!.map(x => x.id), ['S2']);
  assert.ok(buildSheets(views, r.settings, META).every(x => x.layout.fits));
});

test('absent sheets: the one-page PDF is byte for byte the one made before drawing sets (plain, ISO, ASME; hashes made from the sources before; SVG and DXF are held by the units golden test)', () => {
  const f = snapPoints(views.front), at = (u: number, w: number) => f.find(p => near(p.at[0], u) && near(p.at[1], w))!.ref;
  const want = { plain: 'd280596ee08f569553b20d08e72673421cb58fed919f1e0917128369a1dcd081', iso: 'c610c6478edc1372f4f9f191271aaa7840d887db1ddc41ab91a802dc4a3f8040', asme: '7643251eca96357dd48c9868cc0722c5c46e37bf9aad9f6d58c9b4bd368f4d3a' };
  for (const [name, standard] of [['plain', undefined], ['iso', 'iso'], ['asme', 'asme']] as const) {
    const settings: DrawingSettings = { ...defaultDrawing(), ...(standard ? { standard } : {}), dimensions: [{ id: 'w', view: 'front', kind: 'linear', a: at(0, 0), b: at(64, 0), orient: 'horizontal', place: [32, -12] }] };
    const sheet = buildSheet(views, layoutSheet(views, settings), settings, { title: 'Plate', date: '2026-10-31' });
    assert.equal(createHash('sha256').update(sheetPdf(sheet, 'Plate')).digest('hex'), want[name], name);
  }
});

test('ticking a view on another sheet moves it here; a letter taken on another sheet is not reused', () => {
  const settings = twoSheets();
  // (On sheet 1 the iso view is unticked: ticking it moves it from sheet 2 to sheet 1.)
  const on1 = forSheet(settings, 0);
  const moved = mergeSheet(settings, 0, { ...on1, views: [...on1.views!, 'iso'] });
  assert.deepEqual(moved.sheets![0].views, ['right']);
  assert.ok(forSheet(moved, 0).views!.includes('iso') && !forSheet(moved, 1).views!.includes('iso'));
  // (Unticking on the sheet that has it takes it out of the drawing; front and top stay.)
  const off = mergeSheet(settings, 1, { ...forSheet(settings, 1), views: ['right'] });
  assert.deepEqual(off.views, ['front', 'top', 'right']);
  // (A section A on sheet 1; one made on sheet 2 as A is given B.)
  const withA = twoSheets({ sections: [{ id: 'A', view: 'front', at: 16 }] });
  const on2 = forSheet(withA, 1);
  assert.deepEqual(sectionsOf(on2), []);
  const made = mergeSheet(withA, 1, { ...on2, sections: [{ id: 'A', view: 'right', at: 10 }] });
  assert.deepEqual(sectionsOf(made).map(x => `${x.id}${x.view}`), ['Afront', 'Bright']);
});

test('a note without a leader made on a later sheet stays on it; a stale sheet id puts it back on the first', () => {
  const settings = twoSheets();
  const on2 = forSheet(settings, 1);
  const made = mergeSheet(settings, 1, { ...on2, notes: [{ id: 'n1', text: 'ON TWO', at: [100, 50] }] });
  assert.equal(made.notes![0].sheet, 'S2');
  assert.deepEqual(forSheet(made, 1).notes!.map(n => n.id), ['n1']);
  assert.equal(forSheet(made, 0).notes, undefined);
  assert.equal(JSON.stringify(readDrawing(JSON.parse(JSON.stringify(made)))), JSON.stringify(readDrawing(made)));
  const gone = { ...made, sheets: undefined };
  assert.deepEqual(forSheet({ ...made, sheets: [{ id: 'S3', views: ['iso'] }] }, 0).notes!.map(n => n.id), ['n1'], 'its sheet is gone: on the first');
  assert.equal(gone.sheets, undefined);
});

test('the agent: set_drawing takes sheets and refuses bad ones in words; drawing_issues names each sheet', () => {
  const ok = runDrawingTool(doc, 'set_drawing', { views: ['front', 'top', 'right', 'iso'], sheets: [{ id: 'S2', name: 'Pictorial', views: ['iso'] }] });
  assert.ok(!('error' in ok), JSON.stringify(ok));
  if ('error' in ok) return;
  assert.deepEqual(readDrawing(ok.doc.drawing).sheets, [{ id: 'S2', name: 'Pictorial', views: ['iso'] }]);
  const listed = runDrawingTool(ok.doc, 'drawing_issues', {});
  assert.ok(!('error' in listed));
  if ('error' in listed) return;
  const c = listed.content as { sheets: { sheet: number; name: string; views: string[] }[]; issues: { sheet: number }[] };
  assert.deepEqual(c.sheets.map(x => `${x.sheet} ${x.name}: ${x.views.join(',')}`), ['1 Sheet 1: front,top,right', '2 Pictorial: iso']);
  assert.ok(c.issues.every(x => x.sheet === 1 || x.sheet === 2));
  const bad = runDrawingTool(doc, 'set_drawing', { sheets: [{ id: 'S2', views: ['iso'] }, { id: 'S3', views: ['iso'] }] });
  assert.ok('error' in bad && /iso is listed on sheets S2 and S3/.test(bad.error), JSON.stringify(bad));
  const stale = runDrawingTool(doc, 'set_drawing', { sheets: [{ id: 'S2', views: ['detail:Z'] }] });
  assert.ok('error' in stale && /detail Z, which the drawing does not have/.test(stale.error), JSON.stringify(stale));
  const cleared = runDrawingTool(ok.doc, 'set_drawing', { sheets: [] });
  assert.ok(!('error' in cleared) && readDrawing(cleared.doc.drawing).sheets === undefined);
});

// The random-edit property of the merge (from the audit's probe): an edit of one sheet changes only what is on that sheet.
const PROP_VIEWS = ['front', 'top', 'right', 'iso'] as const;
const propWhole = (): DrawingSettings => ({
  ...defaultDrawing(), scale: 1, title: 'P', views: [...PROP_VIEWS], revision: 'B', standard: 'iso', units: 'inch',
  sheets: [{ id: 'S2', name: 'Two', size: 'A3', views: ['right', 'detail:D'] }, { id: 'S3', views: ['iso', 'section:B'] }],
  sections: [{ id: 'A', view: 'front', at: 4 }, { id: 'B', view: 'top', at: 4, removed: { scale: 1 } }, { id: 'C', view: 'right', at: 4, removed: {} }],
  details: [{ id: 'D', view: 'front', center: [1, 1], radius: 3 }, { id: 'E', view: 'section:B', center: [1, 1], radius: 3 }, { id: 'F', view: 'right', center: [2, 2], radius: 3 }],
  dimensions: [
    { id: 'd1', view: 'front', kind: 'linear', a: { edge: 'e1', near: [0, 0, 0] }, b: { edge: 'e2', near: [0, 0, 0] }, orient: 'horizontal', place: [1, 2] },
    { id: 'd2', view: 'right', kind: 'diameter', edge: 'c', near: [0, 0, 0], place: [1, 2] },
    { id: 'd3', view: 'top', kind: 'diameter', edge: 'c', near: [0, 0, 0], place: [3, 4] },
    { id: 'd4', view: 'section:B', kind: 'diameter', edge: 'c', near: [0, 0, 0], place: [3, 4] },
    { id: 'd5', view: 'detail:D', kind: 'diameter', edge: 'c', near: [0, 0, 0], place: [3, 4] },
    { id: 'd6', view: 'section:A', kind: 'diameter', edge: 'c', near: [0, 0, 0], place: [3, 4] },
    { id: 'd7', view: 'section:C', kind: 'diameter', edge: 'c', near: [0, 0, 0], place: [3, 4] },
  ] as never,
  notes: [{ id: 'n1', text: 'GEN', at: [1, 1] }, { id: 'n2', text: 'R', at: [1, 1], leader: { view: 'right', at: [0, 0] } }, { id: 'n3', text: 'ON2', at: [1, 1], sheet: 'S2' }, { id: 'n4', text: 'STALE', at: [1, 1], sheet: 'S9' }, { id: 'n5', text: 'F', at: [2, 2], leader: { view: 'front', at: [0, 0] } }, { id: 'n6', text: 'ON3', at: [1, 1], sheet: 'S3' }],
  datums: [{ id: 'A1', letter: 'A', view: 'front', dim: 'd1' }, { id: 'B1', letter: 'B', view: 'right' }, { id: 'C1', letter: 'C', view: 'top' }] as never,
  datumTargets: [{ id: 't1', letter: 'A', number: 1, view: 'front', place: [1, 1] }, { id: 't2', letter: 'B', number: 1, view: 'iso', place: [1, 1] }] as never,
  frames: [{ id: 'f1', dim: 'd2', characteristic: 'position', value: 0.1, datums: [] }, { id: 'f2', view: 'top', place: [1, 1], characteristic: 'flatness', value: 0.1, datums: [] }, { id: 'f3', dim: 'zz', characteristic: 'flatness', value: 0.1, datums: [] }, { id: 'f4', dim: 'd4', characteristic: 'position', value: 0.1, datums: [] }] as never,
  room: { front: { above: 5 }, right: { left: 3 }, iso: { below: 2 } },
  tables: [{ id: 'rev', from: 'revisions' }, { id: 'bom', from: 'bom' }],
  titleBlock: { template: 'basic', fields: { drawnBy: 'x' } } as never, balloons: true, weldSymbols: true,
  revisions: [{ revision: 'A', date: '2026-01-01', description: 'x', eco: 'E1' }],
  breaks: [{ axis: 'x', from: 1, to: 2 }] as never,
});
const norm = (s: DrawingSettings) => { const sorted = (o: any): any => Array.isArray(o) ? o.map(sorted) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sorted(o[k])])) : o; return JSON.stringify(sorted({ ...s, sections: sectionsOf(s), section: undefined })); };
test('mergeSheet: identity, repeated round trips, and 3000 random edits of one sheet leave everything else as it was, in order', () => {
  const fails: string[] = [];
const W = propWhole();
// identity
for (let k = 0; k < sheetCount(W); k++) { const m = mergeSheet(W, k, forSheet(W, k)); if (norm(m) !== norm(W)) { const a = JSON.parse(norm(m)), b = JSON.parse(norm(W)); for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) fails.push(`identity k=${k} ${key}: ${JSON.stringify(b[key])} -> ${JSON.stringify(a[key])}`); } }
// idempotent repeated round trips
{ let s = W; for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) s = mergeSheet(s, k, forSheet(s, k)); if (norm(s) !== norm(W)) fails.push('repeated round trips drift'); }
// random edits
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const LISTS = ['dimensions', 'notes', 'datums', 'datumTargets', 'frames', 'details'] as const;
for (let trial = 0; trial < 3000; trial++) {
  const k = Math.floor(rnd() * 3), f = forSheet(W, k), e: any = JSON.parse(JSON.stringify(f));
  const key = LISTS[Math.floor(rnd() * LISTS.length)], list: any[] = e[key] ?? [];
  const op = Math.floor(rnd() * 3);
  if (op === 0 && list.length) list[Math.floor(rnd() * list.length)].edited = trial;
  else if (op === 1 && list.length) list.splice(Math.floor(rnd() * list.length), 1);
  else { const vh = f.views!; if (!vh.length) continue; const v = vh[Math.floor(rnd() * vh.length)]; const base: any = key === 'notes' ? { id: 'new' + trial, text: 'N', at: [1, 1], ...(rnd() < 0.5 ? { leader: { view: v, at: [0, 0] } } : {}) } : key === 'details' ? { id: 'Q', view: v, center: [0, 0], radius: 1 } : key === 'frames' ? { id: 'new' + trial, view: v, place: [0, 0] } : { id: 'new' + trial, view: v }; list.push(base); }
  if (list.length || key === "dimensions") e[key] = list; else delete e[key];
  const m = mergeSheet(W, k, e);
  // what was not on sheet k must remain, identical, same order
  const onK = new Set((f as any)[key]?.map((x: any) => x.id) ?? []);
  const before = ((W as any)[key] ?? []).filter((x: any) => !onK.has(x.id)).map((x: any) => JSON.stringify(x));
  const after = ((m as any)[key] ?? []).filter((x: any) => !onK.has(x.id) && before.includes(JSON.stringify(x))).map((x: any) => JSON.stringify(x));
  if (JSON.stringify(before) !== JSON.stringify(after)) fails.push(`trial ${trial} k=${k} ${key} op=${op}: lost/reordered ${before.filter((x: string) => !after.includes(x)).join(' ')}`);
  // other lists untouched
  for (const other of LISTS) if (other !== key && JSON.stringify((m as any)[other]) !== JSON.stringify((W as any)[other])) { fails.push(`trial ${trial} k=${k} edit ${key} changed ${other}`); }
  // ids unique
  for (const kk of LISTS) { const ids = ((m as any)[kk] ?? []).map((x: any) => x.id); if (new Set(ids).size !== ids.length) fails.push(`trial ${trial} k=${k} dup ids in ${kk}: ${ids}`); }
  // edit visible on k after merge
  const back: any = forSheet(m, k); const wantIds = (e[key] ?? []).map((x: any) => x.id).sort().join(), gotIds = (back[key] ?? []).map((x: any) => x.id).sort().join();
  if (key !== 'details' && wantIds !== gotIds) fails.push(`trial ${trial} k=${k} ${key} op=${op}: edit not on sheet after merge want ${wantIds} got ${gotIds}`);
}
  assert.deepEqual(fails.slice(0, 5), []);
});

test('balloons and weld symbols are drawing-level flags: each is drawn where a view it can sit on is, ticked from any sheet, and shown as set on every sheet', () => {
  // (The iso view on sheet 2 carries balloons; weld symbols — front, top and right only — go with the front view on sheet 1.)
  const settings = twoSheets({ balloons: true, weldSymbols: true, sheets: [{ id: 'S2', views: ['iso'] }] });
  const a = forSheet(settings, 0), b = forSheet(settings, 1);
  assert.equal(a.balloons, true); assert.equal(b.balloons, true); assert.equal(a.weldSymbols, true); assert.equal(b.weldSymbols, true);
  assert.deepEqual([a.sheetContext!.balloonsHere, b.sheetContext!.balloonsHere], [false, true]);
  // (With the right view alone on sheet 2 and iso on sheet 1, balloons are on 1.)
  const other = twoSheets({ sheets: [{ id: 'S2', views: ['right'] }] });
  assert.deepEqual([forSheet(other, 0).sheetContext!.balloonsHere, forSheet(other, 1).sheetContext!.balloonsHere], [true, false]);
  // (Ticked on the first sheet or the second: the whole drawing has it; unticked, it has not.)
  const off = twoSheets();
  assert.equal(mergeSheet(off, 0, { ...forSheet(off, 0), balloons: true }).balloons, true);
  assert.equal(mergeSheet(off, 1, { ...forSheet(off, 1), weldSymbols: true }).weldSymbols, true);
  assert.equal(mergeSheet(settings, 1, (({ balloons: _b, ...rest }) => rest)(forSheet(settings, 1))).balloons, undefined);
  assert.equal(mergeSheet(settings, 0, { ...forSheet(settings, 0), weldSymbols: undefined }).weldSymbols, undefined);
});

test('datums are the whole drawing’s: a frame on one sheet may name a datum on another, and a letter repeated across sheets is reported once', () => {
  const line = views.front.edges.find(e => e.kind === 'line' && e.ends)!, [p, q] = line.ends!;
  const edge = { edge: line.name, near: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2] as [number, number, number] };
  const r = snapPoints(views.right), at = (u: number, w: number) => r.find(x => near(x.at[0], u) && near(x.at[1], w))?.ref ?? r[0].ref;
  const dimR: DrawingDimension = { id: 'dr', view: 'right', kind: 'linear', a: r[0].ref, b: at(r[1].at[0], r[1].at[1]), orient: 'aligned', place: [0, 0] };
  const base = twoSheets({ dimensions: [...dims(), dimR], datums: [{ id: 'da', letter: 'C', view: 'front', edge, place: [32, -26] }], frames: [{ id: 'fr', dim: 'dr', characteristic: 'perpendicularity', value: 0.1, datums: ['C'] }] });
  const codes = (s: DrawingSettings) => sheetsIssues({ views, settings: s, callout: () => null, meta: META }).filter(x => x.issue.code === 'DATUM_UNDEFINED' || x.issue.code === 'DATUM_TWICE').map(x => `${x.sheet}:${x.issue.code}`);
  assert.deepEqual(codes(base), [], 'the frame on sheet 2 names the datum feature on sheet 1');
  // (No datum feature anywhere: reported on the frame's sheet, once.)
  assert.deepEqual(codes({ ...base, datums: undefined }), ['2:DATUM_UNDEFINED']);
  // (A target gives the letter too.)
  assert.deepEqual(codes({ ...base, datums: undefined, datumTargets: [{ id: 't', letter: 'C', number: 1, view: 'front', place: [0, 0], kind: 'point', edge: line.name, at: 'end', near: edge.near, endpoint: 'min' } as never] }).filter(x => /UNDEFINED/.test(x)), []);
  // (The letter on two datum features on two sheets: once, on the later one's sheet.)
  const twice = { ...base, datums: [{ id: 'da', letter: 'C', view: 'front' as const, edge, place: [32, -26] as [number, number] }, { id: 'db', letter: 'C', view: 'right' as const, edge: { edge: views.right.edges.find(e => e.kind === 'line' && e.ends)!.name, near: [0, 0, 0] as [number, number, number] }, place: [0, 0] as [number, number] }] };
  assert.deepEqual(codes(twice).filter(x => /TWICE/.test(x)), ['2:DATUM_TWICE']);
});

test('the agent on a drawing with sheets: auto_dimension and fix_drawing work sheet by sheet', () => {
  let d = rectanglePart(400, 60, 20);
  const run = (t: string, a: Record<string, unknown>) => { const r = runDrawingTool(d, t, a); assert.ok(!('error' in r), JSON.stringify(r)); if ('error' in r) throw new Error(String(r.error)); d = r.doc; return r.content as { issues: { sheet: number; code: string; severity: string }[]; added?: Record<string, number> }; };
  run('set_drawing', { views: ['front', 'top', 'right', 'iso'], sheets: [{ id: 'S2', name: 'Two', views: ['right', 'iso'] }] });
  const auto = run('auto_dimension', {});
  assert.ok(auto.added!.overall >= 3, 'overall sizes were added');
  assert.deepEqual(auto.issues.filter(x => x.severity === 'error'), [], 'no sheet left off the page or overlapping');
  assert.ok(!auto.issues.some(x => x.code === 'OFF_SHEET'));
  const s = readDrawing(d.drawing);
  assert.ok(s.sheets && s.dimensions.length >= 3);
  // (Fix on a set with an error: a dimension lost from its view on the first sheet is removed by the fix.)
  const lost = { ...s, dimensions: [...s.dimensions, { id: 'lost', view: 'front', kind: 'diameter', edge: 'nope', near: [0, 0, 0], place: [0, 0] } as DrawingDimension] };
  d = { ...d, drawing: lost };
  const fixed = run('fix_drawing', {});
  assert.ok(!fixed.issues.some(x => x.code === 'DIMENSION_LOST'));
  assert.ok(!readDrawing(d.drawing).dimensions.some(x => x.id === 'lost'));
});

test('a deleted sheet’s notes go back to the first sheet and no later sheet takes them: the id is never reused while a note names it', () => {
  const settings = readDrawing(twoSheets({ notes: [{ id: 'n1', text: 'ON TWO', at: [10, 10], sheet: 'S2' }, { id: 'n2', text: 'ONE', at: [10, 20] }] }));
  const { sheets: _s, notes: _n, ...stripped } = settings; void _s; void _n;
  const gone: DrawingSettings = { ...stripped, ...removeSheet(settings, 1) };
  assert.equal(gone.sheets, undefined, 'one sheet again');
  assert.equal(gone.notes!.find(n => n.id === 'n1')!.sheet, undefined, 'the tag is dropped');
  const again: DrawingSettings = { ...gone, sheets: [{ id: nextSheetId(gone), views: [] as string[] }] };
  assert.equal(again.sheets![0].id, 'S2');
  assert.deepEqual(forSheet(again, 0).notes!.map(n => n.id), ['n1', 'n2'], 'both notes stay on the first sheet');
  // (A note that still names S2 — a file made so — keeps S2 from being handed out.)
  assert.equal(nextSheetId({ sheets: [], notes: [{ id: 'n', text: 't', at: [0, 0], sheet: 'S2' }] }), 'S3');
});

test('a section letter changed because another sheet has it: what was made in the same edit on it follows', () => {
  const whole = twoSheets({ sections: [{ id: 'A', view: 'front', at: 16 }] });
  const on2 = forSheet(whole, 1);
  const edited = mergeSheet(whole, 1, { ...on2,
    sections: [{ id: 'A', view: 'right', at: 10, removed: { scale: 1 } }],
    details: [{ id: 'Q', view: 'section:A', center: [1, 1], radius: 2 }],
    dimensions: [{ id: 'ds', view: 'section:A', kind: 'diameter', edge: 'e', near: [0, 0, 0], place: [0, 0] } as DrawingDimension, { id: 'dq', view: 'detail:Q', kind: 'diameter', edge: 'e', near: [0, 0, 0], place: [0, 0] } as DrawingDimension],
    frames: [{ id: 'sf', view: 'section:A', place: [0, 0], characteristic: 'flatness', value: 0.1, datums: [] } as never] });
  const ids = sectionsOf(edited).map(x => `${x.id}:${x.view}`);
  assert.deepEqual(ids, ['A:front', 'B:right']);
  assert.equal(edited.details![0].view, 'section:B');
  assert.deepEqual(edited.dimensions.filter(d => d.id === 'ds').map(d => d.view), ['section:B']);
  assert.deepEqual(edited.dimensions.filter(d => d.id === 'dq').map(d => d.view), ['detail:Q']);
  assert.equal((edited.frames![0] as { view: string }).view, 'section:B');
});

test('views ticked and unticked: unticking removes the view from the sheet’s list, ticking it elsewhere lists it only there', () => {
  const whole = twoSheets();
  const off = mergeSheet(whole, 1, { ...forSheet(whole, 1), views: ['right'] });
  assert.deepEqual(off.sheets![0].views, ['right'], 'iso is gone from the list');
  const back = mergeSheet(off, 0, { ...forSheet(off, 0), views: ['front', 'top', 'iso'] });
  assert.deepEqual(back.sheets![0].views, ['right'], 'ticked on sheet 1: unlisted (the first sheet holds it)');
  assert.ok(forSheet(back, 0).views!.includes('iso'));
  // (Ticked on the later sheet: listed there.)
  const third = twoSheets({ views: ['front', 'top'], sheets: [{ id: 'S2', views: [] }] });
  const ticked = mergeSheet(third, 1, { ...forSheet(third, 1), views: ['iso'] });
  assert.deepEqual(ticked.sheets![0].views, ['iso']); assert.ok(ticked.views!.includes('iso'));
});

test('what editing a later sheet must not lose: the tables, the other sheets’ datums, frames follow their dimension’s sheet, a scale edit is kept, the room of other sheets’ views, the title block on later sheets', () => {
  const line = views.front.edges.find(e => e.kind === 'line' && e.ends)!, [p, q] = line.ends!;
  const edge = { edge: line.name, near: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2] as [number, number, number] };
  const whole = twoSheets({ tables: [{ id: 'rev', from: 'revisions' }, { id: 'bom', from: 'bom' }], datums: [{ id: 'da', letter: 'A', view: 'front', edge, place: [1, 1] }], titleBlock: { template: 'extended', number: 'D-1' },
    frames: [{ id: 'fw', dim: 'wide', characteristic: 'flatness', value: 0.1, datums: [] }], room: { front: { above: 5 }, right: { left: 3 }, iso: { below: 2 } } });
  const on2 = forSheet(whole, 1);
  assert.equal(on2.tables, undefined); assert.equal(on2.datums, undefined); assert.equal(on2.titleBlock, undefined, 'the basic block after the first');
  assert.deepEqual(on2.room, { right: { left: 3 }, iso: { below: 2 } }, 'room per view');
  assert.equal(forSheet(whole, 0).frames![0].id, 'fw', 'a frame is on its dimension’s sheet (the front)');
  assert.equal(forSheet(whole, 1).frames, undefined);
  const edited = mergeSheet(whole, 1, { ...on2, scale: 2, room: { right: { left: 9 } } });
  assert.deepEqual(edited.tables!.map(t => t.id), ['rev', 'bom'], 'tables kept');
  assert.deepEqual(edited.datums!.map(d => d.id), ['da'], 'the first sheet’s datums kept');
  assert.deepEqual(edited.titleBlock, whole.titleBlock);
  assert.equal(edited.sheets![0].scale, 2, 'the later sheet’s scale is its entry’s');
  assert.equal(edited.scale, whole.scale);
  assert.deepEqual(edited.room, { front: { above: 5 }, right: { left: 9 } }, 'the first sheet’s room kept, the second’s as edited');
  // (The extended title block is taller: the first sheet's title box differs from a later sheet's.)
  const t0 = built(whole, 0).layout.title, t1 = built(whole, 1).layout.title;
  assert.ok(t0[3] - t0[1] > t1[3] - t1[1]);
});

// Weld symbols across sheets. The welded frame of the weld-list fixture has 16 joints, every one seen in the front view.
async function weldFixture() {
  const { calls } = JSON.parse(readFileSync(`${import.meta.dirname}/fixtures/frame-welded-table.calls.json`, 'utf8'));
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  const evaluate = async (d: StudioDoc) => evaluatePart(d, 1);
  for (const c of calls.slice(0, 1)) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, r.content); state = r.state; }
  const base: DrawingSettings = { ...readDrawing(state.doc.drawing), sheet: 'A3', weldSymbols: true, views: ['front', 'top', 'right', 'iso'] };
  const inputs = (s: DrawingSettings) => { const i = drawingInputs(state.doc, s); assert.ok(typeof i !== 'string', String(i)); return i as Exclude<typeof i, string>; };
  return { base, inputs };
}
const SPLITS: [string, (b: DrawingSettings) => DrawingSettings][] = [
  ['one sheet', b => b], ['top on 2', b => ({ ...b, sheets: [{ id: 'S2', views: ['top'] }] })], ['top and right on 2', b => ({ ...b, sheets: [{ id: 'S2', views: ['top', 'right'] }] })],
  ['front on 2', b => ({ ...b, sheets: [{ id: 'S2', views: ['front'] }] })], ['right on 2', b => ({ ...b, sheets: [{ id: 'S2', views: ['right'] }] })],
  ['no right view, iso on 2', b => ({ ...b, views: ['front', 'top', 'iso'], sheets: [{ id: 'S2', views: ['iso'] }] })],
];
const onFace = (name: string, face: string) => name.split('|').some(f => f === face || f.replace(/#\d+$/, '') === face);

test('weld symbols: a joint is drawn on the view a single sheet would pick, on that view’s sheet; a drawing with one sheet is unchanged', async () => {
  const { base, inputs } = await weldFixture();
  const i = inputs(base), joint0 = i.meta.welds![0];
  const counts = (v: DrawingViews, settings: DrawingSettings) => buildSheets(v, settings, { ...i.meta, date: '2026-10-21' }, i.sections).map(b => b.sheet.welds?.placed.map(p => `${p.label}@${p.view}`) ?? []);
  const one = counts(i.views, i.settings);
  assert.equal(one.length, 1); assert.equal(one[0].length, 16);
  // (Every joint is seen in the front view: it carries all 16 on whichever sheet has the front view; no other sheet has any.)
  for (const [name, split] of SPLITS.slice(1)) {
    const s = inputs(split(base)).settings, sheets = counts(i.views, s);
    assert.equal(sheets.flat().length, 16, name);
    assert.ok(new Set(sheets.flat().map(x => x.split('@')[0])).size === 16, `${name}: each joint once`);
  }
  // (W1's end face seen only in the top view — the front view loses its edges: its symbol is on the top view's sheet, on every split.)
  const noFront: DrawingViews = { ...i.views, front: { ...i.views.front, edges: i.views.front.edges.filter(e => !onFace(e.name, joint0.face)) } };
  assert.deepEqual(counts(noFront, i.settings)[0].find(x => x.startsWith('W1@')), 'W1@top');
  const withTop = inputs({ ...base, sheets: [{ id: 'S2', views: ['top'] }] }).settings, top = counts(noFront, withTop);
  assert.ok(top[1].includes('W1@top') && !top[0].some(x => x.startsWith('W1@')) && top[0].length === 15, JSON.stringify(top.map(x => x.length)));
  const withFront = inputs({ ...base, sheets: [{ id: 'S2', views: ['front'] }] }).settings, front = counts(noFront, withFront);
  assert.ok(front[0].includes('W1@top') && front[1].length === 15);
});

test('weld symbols: a joint seen in no shown view is warned in every split, once, on the first sheet', async () => {
  const { base, inputs } = await weldFixture();
  const i = inputs(base);
  const lost = { ...i, meta: { ...i.meta, welds: i.meta.welds!.map((j, k) => k === 0 ? { ...j, face: 'no-such-face' } : j) } };
  for (const [name, split] of SPLITS) {
    const s = inputs(split(base)).settings;
    const weld = sheetsIssues({ ...lost, settings: s, meta: { ...lost.meta, date: '2026-10-21' } }).filter(x => x.issue.code === 'WELD_NOT_SHOWN');
    assert.deepEqual(weld.map(x => x.sheet), [1], name);
    assert.match(weld[0].issue.message, /W1/, name);
  }
  // (And none when every joint is seen.)
  for (const [name, split] of SPLITS) assert.deepEqual(sheetsIssues({ ...i, settings: inputs(split(base)).settings, meta: { ...i.meta, date: '2026-10-21' } }).filter(x => /WELD/.test(x.issue.code)), [], name);
});

test('what is missing is judged on the whole drawing and named by the sheet of its view; a break is judged against every sheet’s views, and said once', () => {
  // (The hole shows round in the top view, which is on sheet 2 with no dimension: its missing size is sheet 2's; the overall sizes have no view: sheet 1's.)
  const settings = twoSheets({ dimensions: [], sheets: [{ id: 'S2', name: 'Details', views: ['top'] }] });
  const issues = sheetsIssues({ views, settings, callout: () => null, meta: META });
  const at = (code: string) => issues.filter(x => x.issue.code === code).map(x => x.sheet);
  assert.deepEqual(at('HOLE_SIZE_MISSING'), [2]);
  assert.deepEqual(at('OVERALL_MISSING'), [1]);
  // (A break through the part in X shortens the front view, which is on sheet 2 here; sheet 1 holds the right view only: no warning anywhere.)
  const broken = twoSheets({ breaks: [{ axis: 'x', from: 20, to: 40 }], sheets: [{ id: 'S2', views: ['front', 'top'] }] });
  assert.deepEqual(sheetsIssues({ views, settings: broken, callout: () => null, meta: META }).filter(x => x.issue.code === 'BREAK_NO_VIEW'), []);
  // (A break that misses the part: said once, on the first sheet, not once a sheet.)
  const misses = twoSheets({ breaks: [{ axis: 'x', from: 500, to: 600 }] });
  assert.deepEqual(sheetsIssues({ views, settings: misses, callout: () => null, meta: META }).filter(x => x.issue.code === 'BREAK_NO_VIEW').map(x => x.sheet), [1]);
});
