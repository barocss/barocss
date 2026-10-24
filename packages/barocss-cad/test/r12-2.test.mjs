import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, flatPattern, flatPatternDxf, writeDxf, importStep, flatPatternOf, massPropertiesOf, exportStep } from '../dist/index.js';

// R12.2 (D117): the flat pattern. Oracles, none computed by the unfolder:
// - the K-factor's area identity: the flat's area is V/T (V the kernel's volume) plus (K − ½)·T per unit of bend angle
//   and width — at K = ½ the neutral layer is the sheet's middle;
// - the textbook flat length: outside dimensions to the virtual sharps less each bend's deduction
//   BD = 2(R + T)·tan(θ/2) − θ(R + K·T), written here from the definitions;
// - closed forms of the cut-outs (π r², a notch's rectangle).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const BD = (th, R, T, K) => 2 * (R + T) * Math.tan(th / 2) - th * (R + K * T);
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b} (${(a - b) / Math.max(1, Math.abs(b))})`);

/** A channel 30 + 40 + 30 (outside), W wide, with a hole r through its base (a cut by difference: the sheet carried on). */
const channel = ({ T = 1.5, R = 2, K = 0.44, W = 25, r = 4 } = {}) => [
  { id: 'c', kind: 'sheet-contour', path: [[0, 30], [0, 0], [40, 0], [40, 30]], side: 'left', width: W, thickness: T, bendRadius: R, kFactor: K },
  ...(r ? [{ id: 'h', kind: 'sketch', profile: 'circle', center: [20, -W / 2], radius: r, plane: { origin: [0, -1, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] } }, { id: 'he', kind: 'extrude', sketch: 'h', height: T + 2 }, { id: 'd', kind: 'difference', target: 'c', tool: 'he' }] : []),
];

/** The S0 tray (D115): a plate, four 90° flanges a gap g short of the corners (united), optionally holes. */
function tray({ T = 1.5, R = 2, h = 20, A = 80, C = 50, g = 0.5, holes = false }) {
  const cen = [0, R + T], sect = [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [0, T], center: cen, direction: 'cw' }, { kind: 'line', start: [-R, R + T] }, { kind: 'line', start: [-R, R + T + h] }, { kind: 'line', start: [-R - T, R + T + h] }, { kind: 'arc', start: [-R - T, R + T], center: cen, direction: 'ccw' }];
  const feats = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [A, C] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: T }];
  let acc = 'pe';
  [[[0, 0], [0, C], [1, 0]], [[A, 0], [A, C], [-1, 0]], [[0, 0], [A, 0], [0, 1]], [[0, C], [A, C], [0, -1]]].forEach(([p0, p1, d], k) => {
    const n = [d[1], -d[0], 0], [s, e] = (p1[0] - p0[0]) * n[0] + (p1[1] - p0[1]) * n[1] > 0 ? [p0, p1] : [p1, p0], L = Math.hypot(e[0] - s[0], e[1] - s[1]), u = [(e[0] - s[0]) / L, (e[1] - s[1]) / L];
    feats.push({ id: `f${k}`, kind: 'sketch', profile: 'loop', segments: sect, plane: { origin: [s[0] + g * u[0], s[1] + g * u[1], 0], normal: n, xAxis: [d[0], d[1], 0] } }, { id: `fe${k}`, kind: 'extrude', sketch: `f${k}`, height: L - 2 * g }, { id: `u${k}`, kind: 'union', target: acc, tool: `fe${k}` });
    acc = `u${k}`;
  });
  if (holes) feats.push({ id: 'h0', kind: 'sketch', profile: 'circle', center: [A / 2, C / 2], radius: 5, plane: { origin: [0, 0, -1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'h0e', kind: 'extrude', sketch: 'h0', height: T + 2 }, { id: 'd0', kind: 'difference', target: acc, tool: 'h0e' });
  return { feats, bendWidth: 2 * (A + C) - 8 * g };
}

test('R12.2 a channel with a hole: the flat by the textbook length and the K-factor\'s area identity; its bends, both ways of looking at it', () => {
  const T = 1.5, R = 2, K = 0.44, W = 25, r = 4, th = Math.PI / 2, o = out(channel({ T, R, K, W, r }));
  // The hole is a cut by difference: the sheet's report carried on.
  assert.equal(o.sheet.fixedFace, 'c.leg0.a');
  const f = flatPatternOf(o), V = massPropertiesOf(o).volume, L = 30 + 40 + 30 - 2 * BD(th, R, T, K);
  close(f.box.max[0], L, 1e-12, 'flat length'); close(f.box.max[1], W, 1e-12, 'flat width');
  close(f.area, L * W - Math.PI * r * r, 1e-12, 'area by closed form');
  close(f.area, V / T + (K - 0.5) * T * 2 * th * W, 1e-11, 'area identity');
  assert.deepEqual(f.loops.map(l => [l.outer, l.segments.map(s => s.kind).join(',')]), [[true, 'line,line,line,line'], [false, 'arc']]);
  // Each bend: down (the path's skin is outside both), 90°, its developed width BA, its centre line at the leg's flat
  // length (outside less the outside setback) plus BA/2 from its end.
  const BA = th * (R + K * T), a = 30 - (R + T) + BA / 2;
  assert.deepEqual(f.bends.map(b => b.name).sort(), ['c.bend1', 'c.bend2']);
  for (const b of f.bends) {
    assert.equal(b.direction, 'down'); close(b.angle, 90, 1e-12, 'angle'); close(b.radius, R, 1e-12, 'radius'); close(b.allowance, BA, 1e-12, 'BA');
    const x = b.centre[0][0];
    assert.ok(Math.abs(x - a) < 1e-11 || Math.abs(x - (L - a)) < 1e-11, `${x}`);
    assert.ok(Math.abs(b.centre[1][0] - x) < 1e-11 && Math.abs(Math.abs(b.centre[1][1] - b.centre[0][1]) - W) < 1e-11);
    close(Math.abs(b.tangents[1][0][0] - b.tangents[0][0][0]), BA, 1e-12, 'strip');
  }
  // From the other skin: the same flat seen from behind, the bends up.
  const g = flatPatternOf(o, { fixedFace: 'c.leg1.b' });
  close(g.area, f.area, 1e-12, 'either skin'); close(g.box.max[0], L, 1e-12, 'length from the other skin');
  assert.ok(g.bends.every(b => b.direction === 'up'));
  // Another K: the length and area move by (K' − K)·T·θ a bend.
  const k = flatPatternOf(o, { kFactor: 0.33 });
  close(k.box.max[0], 100 - 2 * BD(th, R, T, 0.33), 1e-12, 'K 0.33');
});

test('R12.2 an L at any angle: its flat is the outside less BD; through STEP (no names, no history) the same', () => {
  const T = 2, R = 3, K = 0.4, A = 50, B = 35;
  for (const deg of [30, 60, 90, 120, 150]) {
    const th = deg * Math.PI / 180, o = out([{ id: 'c', kind: 'sheet-contour', path: [[0, 0], [A, 0], [A + B * Math.cos(th), B * Math.sin(th)]], side: 'left', width: 20, thickness: T, bendRadius: R, kFactor: K }]);
    const f = flatPatternOf(o);
    close(f.box.max[0], A + B - BD(th, R, T, K), 1e-12, `${deg}°`); close(f.area, 20 * (A + B - BD(th, R, T, K)), 1e-12, `${deg}° area`);
    close(f.bends[0].angle, deg, 1e-9, 'angle');
    const back = importStep(exportStep(o)), g = flatPattern(back, { thickness: T, kFactor: K });
    close(g.area, f.area, 1e-9, `${deg}° through STEP`); close(g.box.max[0], f.box.max[0], 1e-9, `${deg}° length through STEP`);
  }
});

test('R12.2 a tray of four flanges (united, so T and K given): the area identity with holes and with no gap at the corners; a notch through a bend', () => {
  const T = 1.5, K = 0.44;
  for (const opts of [{ holes: true }, { g: 0 }]) {
    const t = tray({ T, ...opts }), o = out(t.feats), f = flatPattern(o.brep, { thickness: T, kFactor: K, fixedFace: 'pe.top' }), V = massPropertiesOf(o).volume;
    close(f.area, V / T + (K - 0.5) * T * Math.PI / 2 * t.bendWidth, 1e-11, JSON.stringify(opts));
    // Seen from the plate's top the flanges come up; from its bottom they go down.
    assert.equal(f.bends.length, 4); assert.ok(f.bends.every(b => b.direction === 'up'));
    assert.ok(flatPattern(o.brep, { thickness: T, kFactor: K, fixedFace: 'pe.bottom' }).bends.every(b => b.direction === 'down'));
    // (No gap: the tabs touch at the plate's corners — one outline through those points.)
    assert.equal(f.loops.filter(l => l.outer).length, 1);
  }
  // A notch through an L's corner, square to the sheet (walls along and across the bend): a window across the bend's strip.
  const R = 3, T2 = 2, o = out([{ id: 'c', kind: 'sheet-contour', path: [[0, 40], [0, 0], [40, 0]], side: 'left', width: 30, thickness: T2, bendRadius: R, kFactor: K },
    { id: 'n', kind: 'sketch', profile: 'rectangle', min: [-1, -1], max: [10, 10], plane: { origin: [0, 0, 12], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'ne', kind: 'extrude', sketch: 'n', height: 6 }, { id: 'd', kind: 'difference', target: 'c', tool: 'ne' }]);
  const f = flatPatternOf(o), L = 80 - BD(Math.PI / 2, R, T2, K), notch = (10 - (R + T2)) * 2 + Math.PI / 2 * (R + K * T2);
  close(f.area, 30 * L - 6 * notch, 1e-12, 'notched L');
  assert.equal(f.loops.length, 2);
});

test('R12.2 refusals: a slanted cut (NON_NORMAL_CUT), a boss or a wrong thickness (NOT_A_SHEET), a cone (BEND_NOT_CYLINDRICAL), a flat covering itself (FLAT_OVERLAPS), a body not made as sheet', () => {
  const plate = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50] }, { id: 'b', kind: 'sheet-base', sketch: 's', thickness: 2, bendRadius: 2, kFactor: 0.44 }];
  const tilted = out([...plate, { id: 'h', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4, plane: { origin: [40, 25, -5], normal: [0.3, 0, 1], xAxis: [1, 0, -0.3] } }, { id: 'he', kind: 'extrude', sketch: 'h', height: 12 }, { id: 'd', kind: 'difference', target: 'b', tool: 'he' }]);
  assert.throws(() => flatPatternOf(tilted), e => e.code === 'GEOMETRY' && /^d: \[NON_NORMAL_CUT\] he\.side0#\d meets the sheet's face b\.(bottom|top) [\d.]+° off square/.test(e.message));
  const boss = out([...plate, { id: 'q', kind: 'sketch', profile: 'rectangle', min: [10, 10], max: [20, 20] }, { id: 'qe', kind: 'extrude', sketch: 'q', height: 5 }, { id: 'u', kind: 'union', target: 'b', tool: 'qe' }]);
  assert.throws(() => flatPattern(boss.brep, { thickness: 2, kFactor: 0.44 }), e => e.code === 'NOT_A_SHEET' && /qe\.top lies 5 mm from the skin face b\.bottom, not the sheet's 2 mm/.test(e.message));
  assert.throws(() => flatPattern(out(plate).brep, { thickness: 3, kFactor: 0.44 }), e => e.code === 'NOT_A_SHEET' && /lies 2 mm from the skin face/.test(e.message));
  // (A union keeps no sheet's rules: the output says so, the kernel's flatPattern takes them.)
  assert.throws(() => flatPatternOf(boss), e => e.code === 'CAPABILITY' && /not made as sheet metal/.test(e.message));
  // A thin parallelogram swept round a bend: its skin turns on a cone.
  const a = Math.PI / 6, W = 20, T = 2, pts = [[0, 0], [W * Math.cos(a), W * Math.sin(a)], [W * Math.cos(a) - T * Math.sin(a), W * Math.sin(a) + T * Math.cos(a)], [-T * Math.sin(a), T * Math.cos(a)]];
  const cone = out([{ id: 'p', kind: 'sketch', profile: 'polygon', points: pts }, { id: 'sw', kind: 'sweep', sketch: 'p', path: [{ kind: 'straight', length: 20 }, { kind: 'bend', radius: 30, angle: 90, toward: 'x' }, { kind: 'straight', length: 20 }] }]);
  assert.throws(() => flatPattern(cone.brep, { thickness: T, kFactor: 0.44 }), e => e.code === 'BEND_NOT_CYLINDRICAL' && /sw\.s1\.side\d continues the sheet smoothly but is not a plane or a cylinder/.test(e.message));
  // A flange on a window's edge, longer than the window: its tab lands on the plate in the flat. Shorter, it fits.
  const T3 = 2, R3 = 2, window = h => {
    const c = [0, R3 + T3], sect = [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [0, T3], center: c, direction: 'cw' }, { kind: 'line', start: [-R3, R3 + T3] }, { kind: 'line', start: [-R3, R3 + T3 + h] }, { kind: 'line', start: [-R3 - T3, R3 + T3 + h] }, { kind: 'arc', start: [-R3 - T3, R3 + T3], center: c, direction: 'ccw' }];
    return out([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50], holes: [[{ kind: 'line', start: [30, 10] }, { kind: 'line', start: [50, 10] }, { kind: 'line', start: [50, 40] }, { kind: 'line', start: [30, 40] }]] }, { id: 'b', kind: 'sheet-base', sketch: 's', thickness: T3, bendRadius: R3, kFactor: 0.44 },
      { id: 'f', kind: 'sketch', profile: 'loop', segments: sect, plane: { origin: [30, 12, 0], normal: [0, 1, 0], xAxis: [-1, 0, 0] } }, { id: 'fe', kind: 'extrude', sketch: 'f', height: 26 }, { id: 'u', kind: 'union', target: 'b', tool: 'fe' }]);
  };
  assert.throws(() => flatPattern(window(30).brep, { thickness: T3, kFactor: 0.44 }), e => e.code === 'FLAT_OVERLAPS' && /the flat covers itself near/.test(e.message));
  const fits = window(10), f = flatPattern(fits.brep, { thickness: T3, kFactor: 0.44 });
  close(f.area, massPropertiesOf(fits).volume / T3 + (0.44 - 0.5) * T3 * Math.PI / 2 * 26, 1e-11, 'window flange that fits');
});

test('R12.2 the flat\'s DXF: the outline on OUTLINE, each bend\'s centre line dashed on BEND_UP or BEND_DOWN with a note on BEND_NOTES', () => {
  const o = out(channel()), f = flatPatternOf(o), doc = flatPatternDxf(f), by = l => doc.entities.filter(e => e.layer === l);
  assert.deepEqual(doc.layers.map(l => l.name), ['OUTLINE', 'BEND_UP', 'BEND_DOWN', 'BEND_NOTES']);
  assert.deepEqual(by('OUTLINE').map(e => e.type), ['line', 'line', 'line', 'line', 'circle']);
  assert.equal(by('BEND_DOWN').length, 2); assert.equal(by('BEND_UP').length, 0);
  assert.deepEqual(by('BEND_NOTES').map(e => e.text), ['DOWN 90° R2', 'DOWN 90° R2']);
  assert.equal(doc.layers.find(l => l.name === 'BEND_DOWN').linetype, 'DASHED');
  const { text } = writeDxf(doc, {});
  assert.equal(text.match(/\nLINE\r?\n/g).length, 6); assert.equal(text.match(/\nCIRCLE\r?\n/g).length, 1); assert.equal(text.match(/\nTEXT\r?\n/g).length, 2);
});

test('R12.2 the flat DXF cases (conformance/r12/flat-dxf): the writer reproduces each file; ezdxf\'s reading audits clean and holds every entity on its layer, to 1e-9', async () => {
  const { readdirSync, readFileSync, existsSync } = await import('node:fs'), { join, resolve } = await import('node:path'), { flatDxfOfCase } = await import('./flat-dxf-cases.mjs');
  const root = resolve(import.meta.dirname, '../conformance/r12/flat-dxf'), near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-9;
  const names = readdirSync(root).filter(n => existsSync(join(root, n, 'case.json')));
  assert.deepEqual(names.sort(), ['channel-hole', 'pcb-enclosure', 'tray-holes']);
  for (const name of names) {
    const dir = join(root, name), c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')), doc = flatDxfOfCase(c);
    assert.equal(c.id, `r12-flat-dxf-${name}`);
    for (const version of c.input.versions) {
      assert.deepEqual(Buffer.from(writeDxf(doc, { version }).bytes), readFileSync(join(dir, `expected.${version}.dxf`)), `${name} ${version} bytes`);
      const r = JSON.parse(readFileSync(join(dir, `oracle.${version}.json`), 'utf8'));
      assert.deepEqual(r.audit, { errors: [], fixes: [] }, `${name} ${version} audit`);
      // (R12 has no $INSUNITS.)
      assert.equal(r.insunits, version === 'AC1009' ? null : 4);
      assert.deepEqual(r.modelspace.map(e => e.layer), doc.entities.map(e => e.layer), `${name} ${version} layers`);
      r.modelspace.forEach((e, i) => {
        const w = doc.entities[i];
        if (w.type === 'line') assert.ok(e.type === 'LINE' && near(e.a, w.a) && near(e.b, w.b), `${name} ${version} line ${i}`);
        else if (w.type === 'circle') assert.ok(e.type === 'CIRCLE' && near(e.center, w.center) && Math.abs(e.radius - w.radius) <= 1e-9, `${name} ${version} circle ${i}`);
        else if (w.type === 'text') assert.ok(e.type === 'TEXT' && e.text === w.text, `${name} ${version} text ${i}: ${e.text}`);
        else assert.fail(`${name}: an unexpected ${w.type}`);
      });
      assert.equal(r.layers.find(l => l.name === 'BEND_UP').linetype, 'DASHED');
    }
  }
});
