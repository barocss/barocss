import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { writeDxf, dxfNumber, dxfText, dxfHatchLines, isDxfWriteError, DXF_WRITER_VERSION } from '../dist/index.js';
import { caseRuns } from './dxf-cases.mjs';

// R11b (O1): the DXF writer. Each conformance case (conformance/r11b/<case>/case.json) is written under each of
// its option sets and must match the committed file byte for byte (the writer is deterministic); the committed
// oracle reading of that file (ezdxf, run outside the product: scripts/dxf-oracle.py) must audit clean and hold
// every input entity, its layer, coordinates to 1e-9, text and units.

const TOL = 1e-9;
const root = resolve(import.meta.dirname, '../conformance/r11b');
const near = (a, b, what, tol = TOL) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const nearXY = (a, b, what, tol = TOL) => { near(a[0], b[0], `${what} x`, tol); near(a[1], b[1], `${what} y`, tol); };
const deg360 = x => ((x % 360) + 360) % 360;
/** What a CAD program shows for DXF text: the control codes and \U+ escapes decoded. */
const shown = s => s.replace(/%%%/g, '\u0000').replace(/%%c/gi, 'Ø').replace(/%%d/gi, '°').replace(/%%p/gi, '±').replace(/\u0000/g, '%').replace(/\\U\+([0-9A-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const solidCorners = p => p.length === 3 ? [p[0], p[1], p[2], p[2]] : [p[0], p[1], p[3], p[2]];
function ellipsePoint(e, t) { const [mx, my] = e.major; return [e.center[0] + mx * Math.cos(t) - my * e.ratio * Math.sin(t), e.center[1] + my * Math.cos(t) + mx * e.ratio * Math.sin(t)]; }
function toSegment(q, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l)) : 0; return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy); }
const toPolyline = (q, pts, closed) => { let d = Infinity; for (let i = 0; i + 1 < pts.length + (closed ? 1 : 0); i++) d = Math.min(d, toSegment(q, pts[i], pts[(i + 1) % pts.length])); return d; };

/** An input entity against the oracle's reading of it (AC1015, or an R12 entity written as itself). */
function same(e, o, where, dimBlock) {
  assert.equal(o.layer, e.layer ?? '0', `${where} layer`);
  switch (e.type) {
    case 'line': assert.equal(o.type, 'LINE', where); nearXY(o.a, e.a, where); nearXY(o.b, e.b, where); return;
    case 'circle': assert.equal(o.type, 'CIRCLE', where); nearXY(o.center, e.center, where); near(o.radius, e.radius, where); return;
    case 'arc': assert.equal(o.type, 'ARC', where); nearXY(o.center, e.center, where); near(o.radius, e.radius, where); near(o.startDeg, deg360(e.start), where); near(o.endDeg, deg360(e.end), where); return;
    case 'ellipse':
      assert.equal(o.type, 'ELLIPSE', where); nearXY(o.center, e.center, where); nearXY(o.major, e.major, where); near(o.ratio, e.ratio, where);
      // The oracle's own points of it at its parameters are ours: the same curve, the same way round.
      o.samples.forEach((p, k) => nearXY(p, ellipsePoint(e, o.start + (o.end - o.start) * k / 16), `${where} point ${k}`));
      near(Math.cos(o.start), Math.cos(e.start), where); near(Math.sin(o.start), Math.sin(e.start), where);
      return;
    case 'lwpolyline':
      assert.equal(o.type, 'LWPOLYLINE', where); assert.equal(o.closed, !!e.closed, `${where} closed`);
      assert.equal(o.points.length, e.points.length); o.points.forEach((p, i) => { nearXY(p, e.points[i], `${where} ${i}`); near(o.bulges[i], e.bulges?.[i] ?? 0, `${where} bulge ${i}`); });
      return;
    case 'spline':
      assert.equal(o.type, 'SPLINE', where); assert.equal(o.degree, e.degree); assert.deepEqual(o.knots, e.knots);
      o.control.forEach((p, i) => nearXY(p, e.control[i], `${where} control ${i}`)); assert.deepEqual(o.weights, e.weights ?? []);
      return;
    case 'text':
      assert.equal(o.type, 'TEXT', where); assert.equal(shown(o.text), e.text, `${where} text`); near(o.height, e.height, where);
      near(o.rotationDeg, deg360(e.rotation ?? 0), `${where} rotation`); assert.equal(o.style, e.style ?? 'Standard');
      assert.equal(o.halign, { left: 0, center: 1, right: 2 }[e.align ?? 'left']); nearXY(o.halign ? o.alignAt : o.at, e.at, where);
      return;
    case 'mtext': assert.equal(o.type, 'MTEXT', where); assert.equal(o.text, e.text, `${where} text`); near(o.height, e.height, where); nearXY(o.at, e.at, where); return;
    case 'solid': assert.equal(o.type, 'SOLID', where); solidCorners(e.points).forEach((p, i) => nearXY(o.points[i], p, `${where} ${i}`)); return;
    case 'hatch': {
      assert.equal(o.type, 'HATCH', where); assert.equal(o.solid, e.fill.kind === 'solid'); assert.equal(o.pattern, e.fill.kind === 'solid' ? 'SOLID' : '_USER');
      assert.equal(o.loops.length, e.loops.length);
      o.loops.forEach((l, k) => { l.points.forEach((p, i) => nearXY(p, e.loops[k].points[i], `${where} loop ${k}`)); if (e.loops[k].bulges?.some(b => b)) assert.deepEqual(l.bulges, e.loops[k].bulges); });
      if (e.fill.kind === 'lines') {
        const a = e.fill.angle * Math.PI / 180, [line] = o.lines;
        near(line.angle, deg360(e.fill.angle), where); nearXY(line.offset, [-Math.sin(a) * e.fill.spacing, Math.cos(a) * e.fill.spacing], `${where} offset`); nearXY(line.base, e.fill.origin ?? [0, 0], `${where} origin`);
        // The oracle's own hatch lines over the loops are ours (the R12 writer's): their number and length.
        const ours = dxfHatchLines(e.loops, e.fill.angle, e.fill.spacing, e.fill.origin);
        assert.equal(o.rendered.lines, ours.length, `${where} hatch lines`);
        near(o.rendered.length, ours.reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0), `${where} hatch length`);
      }
      return;
    }
    case 'insert': assert.equal(o.type, 'INSERT', where); assert.equal(o.block, e.block); nearXY(o.at, e.at, where); near(o.scale, e.scale ?? 1, where); near(o.rotationDeg, deg360(e.rotation ?? 0), where); return;
    case 'dimension': {
      const g = e.geometry;
      assert.equal(o.type, 'DIMENSION', where); assert.equal(o.block, dimBlock, `${where} block`);
      assert.equal(o.dimtype, { linear: 0, aligned: 1, angular: 2, diameter: 3, radius: 4 }[g.kind]);
      assert.equal(shown(o.text), e.text, `${where} text`); nearXY(o.textAt, e.textAt, where);
      if (g.kind === 'linear' || g.kind === 'aligned') { nearXY(o.defpoint, g.line, where); nearXY(o.defpoint2, g.p1, where); nearXY(o.defpoint3, g.p2, where); if (g.kind === 'linear') near(o.angle, deg360(g.angle), where); }
      else if (g.kind === 'angular') { nearXY(o.defpoint2, g.line1[0], where); nearXY(o.defpoint3, g.line1[1], where); nearXY(o.defpoint4, g.line2[0], where); nearXY(o.defpoint, g.line2[1], where); nearXY(o.defpoint5, g.arc, where); }
      else if (g.kind === 'diameter') { nearXY(o.defpoint, g.opposite, where); nearXY(o.defpoint4, g.rim, where); }
      else { nearXY(o.defpoint, g.center, where); nearXY(o.defpoint4, g.rim, where); }
      if (e.measurement !== undefined && o.measurement !== undefined) near(o.measurement, e.measurement, `${where} measurement`);
      return;
    }
  }
}

/** R12: an input entity against the oracle entities written for it (from `k`); returns how many. */
function sameR12(e, list, k, where, dimBlock, tol, full) {
  const o = list[k];
  if (e.type === 'lwpolyline') {
    assert.equal(o.type, 'POLYLINE', where); assert.equal(o.closed, !!e.closed);
    o.points.forEach((p, i) => { nearXY(p, e.points[i], `${where} ${i}`); near(o.bulges[i], e.bulges?.[i] ?? 0, `${where} bulge ${i}`); });
    return 1;
  }
  if (e.type === 'ellipse' || e.type === 'spline') {
    assert.equal(o.type, 'POLYLINE', where);
    // Within the chord tolerance of the curve: the AC1015 oracle's own points of it lie near the polyline, and
    // the polyline's points on the curve (an ellipse's checked here by its formula).
    // (An R12 document of its own: an ellipse's points from its formula, which the AC1015 cases check against the oracle.)
    const samples = full?.samples ?? (e.type === 'ellipse' ? Array.from({ length: 17 }, (_, k) => ellipsePoint(e, e.start + (((e.end - e.start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI) * k / 16)) : []);
    assert.ok(samples.length, `${where}: the AC1015 oracle's points of it`);
    for (const p of samples) assert.ok(toPolyline(p, o.points, o.closed) <= tol + TOL, `${where}: the curve ${toPolyline(p, o.points, o.closed)} from its polyline`);
    if (e.type === 'ellipse') for (const p of o.points) { const t = Math.atan2(((p[0] - e.center[0]) * -e.major[1] + (p[1] - e.center[1]) * e.major[0]) / (e.ratio * Math.hypot(...e.major)), ((p[0] - e.center[0]) * e.major[0] + (p[1] - e.center[1]) * e.major[1]) / Math.hypot(...e.major)); nearXY(p, ellipsePoint(e, t), `${where} on the ellipse`, 1e-12); }
    return 1;
  }
  if (e.type === 'hatch') {
    const ours = dxfHatchLines(e.loops, e.fill.angle, e.fill.spacing, e.fill.origin);
    ours.forEach(([a, b], i) => { const x = list[k + i]; assert.equal(x.type, 'LINE', where); assert.equal(x.layer, e.layer ?? '0'); nearXY(x.a, a, where); nearXY(x.b, b, where); });
    if (full) assert.equal(full.rendered.lines, ours.length, `${where}: as many lines as the oracle draws for the AC1015 hatch`);
    return ours.length;
  }
  if (e.type === 'mtext') {
    const lines = e.text.split('\n');
    lines.forEach((line, i) => { const x = list[k + i]; assert.equal(x.type, 'TEXT', where); assert.equal(shown(x.text), line); near(x.height, e.height, where); near(x.at[1], e.at[1] - e.height * (1 + i * 5 / 3), where); });
    return lines.length;
  }
  same(e.type === 'text' && (e.style ?? 'Standard') === 'Standard' ? e : e, o, where, dimBlock);
  return 1;
}

function checkList(entities, list, where, version, run, fullList, dims) {
  if (version === 'AC1015') {
    assert.equal(list.length, entities.length, `${where}: entities`);
    entities.forEach((e, i) => same(e, list[i], `${where} #${i} ${e.type}`, e.type === 'dimension' ? `*D${dims.indexOf(e) + 1}` : undefined));
    return;
  }
  let k = 0;
  entities.forEach((e, i) => { k += sameR12(e, list, k, `${where} #${i} ${e.type}`, e.type === 'dimension' ? `*D${dims.indexOf(e) + 1}` : undefined, run.options.r12ChordTolerance, fullList?.(e)); });
  assert.equal(list.length, k, `${where}: entities`);
}

const cases = readdirSync(root).filter(n => existsSync(join(root, n, 'case.json')));
for (const name of cases) {
  const dir = join(root, name), c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
  const runs = caseRuns(c, dir);
  for (const run of runs) {
    const v = run.options.version;
    test(`conformance ${c.id} ${v}: ${c.about}`, () => {
      assert.equal(`r11b-${name}`, c.id, 'id matches the folder');
      const { text, bytes, report } = writeDxf(run.document, run.options);
      assert.equal(report.contract, DXF_WRITER_VERSION);
      assert.ok(Buffer.from(bytes).equals(readFileSync(join(dir, `expected.${v}.dxf`))), 'the committed file (after a deliberate change: scripts/dxf-fixtures.mjs, with the oracle)');
      assert.equal(bytes.length, text.length, 'one Windows-1252 byte a character');
      assert.match(text, /\$DWGCODEPAGE\n {2}3\nANSI_1252\n/);
      const o = JSON.parse(readFileSync(join(dir, `oracle.${v}.json`), 'utf8'));
      assert.deepEqual(o.audit, { errors: [], fixes: [] }, 'the oracle audits it clean');
      assert.equal(o.dxfversion, v);
      if (v === 'AC1015') assert.equal(o.insunits, { unitless: 0, in: 1, ft: 2, mm: 4, cm: 5, m: 6 }[run.document.units]);
      for (const l of run.document.layers ?? []) {
        const x = o.layers.find(y => y.name === l.name); assert.ok(x, `layer ${l.name}`);
        assert.equal(x.color, l.color ?? 7); assert.equal(x.linetype.toUpperCase(), (l.linetype ?? 'Continuous').toUpperCase());
        if (v === 'AC1015') assert.equal(x.lineweight, l.lineweight ?? -3);
      }
      for (const t of run.document.linetypes ?? []) assert.deepEqual(o.linetypes.find(y => y.name === t.name)?.pattern, t.pattern, `line type ${t.name}`);
      // R12 checks its curves against the AC1015 oracle's points of the same entities.
      const fullRun = runs.find(r => r.options.version === 'AC1015'), fullOracle = fullRun && v !== 'AC1015' ? JSON.parse(readFileSync(join(dir, 'oracle.AC1015.json'), 'utf8')) : null;
      const fullOf = (list, fullEntities) => e => { const i = fullEntities.indexOf(e); return i >= 0 ? list[i] : undefined; };
      const dims = run.document.entities.filter(e => e.type === 'dimension');
      checkList(run.document.entities, o.modelspace, 'model space', v, run, fullOracle && fullOf(fullOracle.modelspace, fullRun.document.entities), dims);
      for (const b of run.document.blocks ?? []) checkList(b.entities, o.blocks[b.name], `block ${b.name}`, v, run, fullOracle && fullOf(fullOracle.blocks[b.name], b.entities), dims);
      dims.forEach((d, k) => checkList(d.block, o.blocks[`*D${k + 1}`], `dimension block *D${k + 1}`, v, run, null, dims));
      if (v === 'AC1009') assert.ok(report.r12.maxChordDeviation <= (run.options.r12ChordTolerance ?? 0));
    });
  }
}

test('R12: the solid hatch is refused; curves need a tolerance; a polyline no finer than it allows', () => {
  const c = JSON.parse(readFileSync(join(root, 'entities/case.json'), 'utf8')), doc = c.input.document;
  assert.throws(() => writeDxf(doc, { version: 'AC1009', r12ChordTolerance: 1e-3 }), e => isDxfWriteError(e) && e.code === 'R12_UNSUPPORTED');
  const ellipse = { units: 'mm', entities: [{ type: 'ellipse', center: [0, 0], major: [10, 0], ratio: 0.5, start: 0, end: 2 * Math.PI }] };
  assert.throws(() => writeDxf(ellipse, { version: 'AC1009' }), e => e.code === 'R12_NEEDS_TOLERANCE');
  const coarse = writeDxf(ellipse, { version: 'AC1009', r12ChordTolerance: 0.1 }).report, fine = writeDxf(ellipse, { version: 'AC1009', r12ChordTolerance: 1e-4 }).report;
  assert.ok(coarse.modelSpace.VERTEX < fine.modelSpace.VERTEX && fine.r12.maxChordDeviation <= 1e-4 && coarse.r12.maxChordDeviation <= 0.1);
  assert.ok(coarse.r12.maxChordDeviation > 0.025, 'not needlessly fine');
  assert.equal(fine.r12.ellipses, 1); assert.equal(fine.r12.unitsNotStored, true);
  const arcSided = { units: 'mm', entities: [{ type: 'hatch', loops: [{ points: [[0, 0], [10, 0]], bulges: [1, 1] }], fill: { kind: 'lines', angle: 45, spacing: 1 } }] };
  assert.throws(() => writeDxf(arcSided, { version: 'AC1009' }), e => e.code === 'R12_UNSUPPORTED');
  assert.throws(() => writeDxf({ units: 'mm', layers: [{ name: 'a layer' }], entities: [] }, { version: 'AC1009' }), e => e.code === 'BAD_NAME', 'R12 names');
});

test('typed refusals for what cannot be written as given', () => {
  const line = (x = {}) => ({ type: 'line', a: [0, 0], b: [1, 1], ...x });
  const refused = (doc, code) => assert.throws(() => writeDxf({ units: 'mm', ...doc }), e => isDxfWriteError(e) && e.code === code && e.message.startsWith(`DXF [${code}]`), code);
  refused({ entities: [line({ layer: 'NOPE' })] }, 'UNKNOWN_LAYER');
  refused({ entities: [line({ linetype: 'DOTS' })] }, 'UNKNOWN_LINETYPE');
  refused({ layers: [{ name: 'A', linetype: 'DOTS' }], entities: [] }, 'UNKNOWN_LINETYPE');
  refused({ entities: [line({ b: [NaN, 0] })] }, 'NOT_FINITE');
  refused({ entities: [line({ b: [1e16, 0] })] }, 'NOT_FINITE');
  refused({ layers: [{ name: 'A' }, { name: 'a' }], entities: [] }, 'DUPLICATE_NAME');
  refused({ layers: [{ name: '0' }], entities: [] }, 'DUPLICATE_NAME');
  refused({ layers: [{ name: 'A<B' }], entities: [] }, 'BAD_NAME');
  refused({ blocks: [{ name: '*X', entities: [] }], entities: [] }, 'BAD_NAME');
  refused({ entities: [{ type: 'insert', block: 'NONE', at: [0, 0] }] }, 'UNKNOWN_BLOCK');
  refused({ blocks: [{ name: 'A', entities: [{ type: 'insert', block: 'B', at: [0, 0] }] }, { name: 'B', entities: [{ type: 'insert', block: 'A', at: [0, 0] }] }], entities: [] }, 'BLOCK_CYCLE');
  refused({ entities: [{ type: 'text', at: [0, 0], height: 1, text: 'two\nlines' }] }, 'BAD_TEXT');
  refused({ entities: [{ type: 'text', at: [0, 0], height: 1, text: 'emoji 😀' }] }, 'BAD_TEXT');
  refused({ entities: [{ type: 'text', at: [0, 0], height: 1, text: 'x'.repeat(251) }] }, 'TEXT_TOO_LONG');
  refused({ entities: [{ type: 'text', at: [0, 0], height: 1, text: 'x', style: 'NONE' }] }, 'UNKNOWN_STYLE');
  refused({ entities: [{ type: 'circle', center: [0, 0], radius: 0 }] }, 'BAD_ENTITY');
  refused({ entities: [{ type: 'ellipse', center: [0, 0], major: [1, 0], ratio: 1.5, start: 0, end: 1 }] }, 'BAD_ENTITY');
  refused({ entities: [{ type: 'spline', degree: 2, knots: [0, 0, 1, 1], control: [[0, 0], [1, 1], [2, 0]] }] }, 'BAD_ENTITY');
  refused({ entities: [{ type: 'solid', points: [[0, 0], [1, 0]] }] }, 'BAD_ENTITY');
  refused({ entities: [{ type: 'lwpolyline', points: [[0, 0], [1, 0]], bulges: [0] }] }, 'BAD_ENTITY');
  refused({ blocks: [{ name: 'A', entities: [{ type: 'dimension', geometry: { kind: 'radius', center: [0, 0], rim: [1, 0] }, block: [], text: 'R1', textAt: [1, 1] }] }], entities: [] }, 'BAD_ENTITY');
  assert.throws(() => writeDxf({ units: 'mm', entities: [] }, { version: 'AC1009', r12ChordTolerance: 0 }), e => e.code === 'BAD_ENTITY');
  // Long multi-line text goes in chunks of 250 (group 3, then the rest in group 1).
  const long = writeDxf({ units: 'mm', entities: [{ type: 'mtext', at: [0, 0], height: 1, text: 'y'.repeat(600) }] }).text;
  const lines = long.split('\n'), at = lines.findIndex((l, i) => l === '  3' && lines[i + 1].startsWith('y'));
  assert.deepEqual([lines[at], lines[at + 1].length, lines[at + 2], lines[at + 3].length, lines[at + 4], lines[at + 5].length], ['  3', 250, '  3', 250, '  1', 100]);
});

test('numbers read back exactly and never in exponent form; text in Windows-1252', () => {
  assert.equal(dxfNumber(0), '0.0'); assert.equal(dxfNumber(-0), '0.0'); assert.equal(dxfNumber(10), '10.0'); assert.equal(dxfNumber(0.1), '0.1');
  assert.equal(dxfNumber(1e-7), '0.0000001'); assert.equal(dxfNumber(-2.5e-12), '-0.0000000000025');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const x = (rnd() - 0.5) * 10 ** Math.floor(rnd() * 14 - 6); const s = dxfNumber(x); assert.ok(!/e/i.test(s), s); assert.ok(Math.abs(Number(s) - x) <= Math.abs(x) * 1e-15 + 1e-20, `${x} → ${s}`); if (Math.abs(x) >= 1e-6) assert.equal(Number(s), x, `${x} → ${s}`); }
  assert.equal(dxfText('Ø8 ±0.1 90° 5%', false), '%%c8 %%p0.1 90%%d 5%%%');
  assert.equal(dxfText('A–A × 2 €', false), 'A–A × 2 €', 'Windows-1252 as it is');
  assert.equal(dxfText('Δ≈ x', false), '\\U+0394\\U+2248 x', 'the rest escaped');
  assert.deepEqual([...writeDxf({ units: 'mm', entities: [{ type: 'text', at: [0, 0], height: 1, text: 'A–A' }] }).bytes].filter(b => b > 0x7e), [0x96]);
  assert.throws(() => writeDxf({ units: 'mm', layers: [{ name: 'Δ' }], entities: [] }), e => e.code === 'BAD_NAME');
  assert.equal(dxfText('a\nb {c}\\', true), 'a\\Pb \\{c\\}\\\\');
});

test('the same document gives the same file; extents cover the drawing', () => {
  const c = JSON.parse(readFileSync(join(root, 'entities/case.json'), 'utf8')), doc = c.input.document;
  const a = writeDxf(doc), b = writeDxf(JSON.parse(JSON.stringify(doc)));
  assert.equal(a.text, b.text);
  assert.deepEqual(a.report.extents, { min: [-15, -22], max: [150, 64.47] });
  assert.match(a.text, /\$HANDSEED\n {2}5\n[0-9A-F]+\n/);
  // Every handle is unique.
  const handles = [...a.text.matchAll(/\n {2}5\n([0-9A-F]+)\n|\n105\n([0-9A-F]+)\n/g)].map(m => m[1] ?? m[2]);
  assert.equal(new Set(handles).size, handles.length, 'unique ($HANDSEED the next one)');
});
