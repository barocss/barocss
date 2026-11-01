import test from 'node:test';
import assert from 'node:assert/strict';
import { deviationPair, deviationSet, lengthFormats, presetFor, type DeviationPair, type DrawingUnits, type UnitSettings } from '../src/drawing/standard';
import { dimensionLine, dimensionMarks, toleranceText, valueMarks, withShownText } from '../src/drawing/sheet';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { withFit } from '../src/drawing/fits';

// Independent exact-decimal oracle. Compare fractions by cross-products; no floating-point epsilon.
type Fraction = { n: bigint; d: bigint };
function decimal(value: string | number): Fraction {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value)); assert.ok(m, String(value));
  const fraction = m[3] ?? '', exponent = Number(m[4] ?? 0) - fraction.length;
  const n = BigInt((m[1] === '-' ? '-' : '') + ((m[2] || '0') + fraction));
  return exponent < 0 ? { n, d: 10n ** BigInt(-exponent) } : { n: n * 10n ** BigInt(exponent), d: 1n };
}
const plus = (a: Fraction, b: Fraction): Fraction => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const compare = (a: Fraction, b: Fraction): number => { const x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; };
const inUnit = (a: Fraction, unit: DrawingUnits): Fraction => unit === 'inch' ? { n: a.n * 5n, d: a.d * 127n } : a;
function contained(pair: DeviationPair, nominal: number, upper: number, lower: number, unit: DrawingUnits): void {
  if (!pair.printable) {
    assert.equal(pair.upper, 'not printable'); assert.equal(pair.lower, 'not printable'); assert.equal(pair.tight, true); assert.equal(pair.equal, false);
    return;
  }
  const N = decimal(pair.nominal), hi = plus(N, decimal(pair.upper)), lo = plus(N, decimal(pair.lower));
  const truthHi = inUnit(plus(decimal(nominal), decimal(upper)), unit), truthLo = inUnit(plus(decimal(nominal), decimal(lower)), unit);
  assert.ok(compare(hi, truthHi) <= 0, `${JSON.stringify(pair)}: upper exceeds true limit`);
  assert.ok(compare(lo, truthLo) >= 0, `${JSON.stringify(pair)}: lower is below true limit`);
  assert.equal(compare(lo, hi), upper === lower ? 0 : -1, 'point stays exact; positive width never collapses or inverts');
  if (upper === lower) { assert.equal(compare(hi, truthHi), 0); assert.equal(compare(lo, truthLo), 0); }
}

test('exact point endpoints: representable zero, shifted and rounded-nominal zones; no EPS snapping', () => {
  const inch = presetFor({ units: 'inch' });
  for (const [nominal, shift] of [[25.4, 0], [25.3, 0.1], [30, -4.6], [25.4001, -0.0001], [25.4, 0.0254], [-25.4, -0.0254]] as const) {
    const pair = deviationPair(shift, shift, inch, 'inch', nominal);
    assert.equal(pair.printable, true); assert.equal(pair.tight, false); contained(pair, nominal, shift, shift, 'inch');
  }
  const compensated = deviationPair(-0.0001, -0.0001, inch, 'inch', 25.4001);
  assert.equal(compensated.upper, '0'); assert.equal(compensated.lower, '0');
  for (const [nominal, shift] of [[30, 0], [64, 0], [25.4, 0.01], [25.4, 1e-15]] as const) {
    const pair = deviationPair(shift, shift, inch, 'inch', nominal); assert.equal(pair.printable, false); contained(pair, nominal, shift, shift, 'inch');
  }
  assert.equal(deviationPair(0, 0, presetFor({ precision: { mm: 2 } }), 'mm', 10.00004).printable, false);
  const six = deviationPair(0, 0, presetFor({ precision: { mm: 6 } }), 'mm', 10.00004);
  assert.equal(six.printable, true); contained(six, 10.00004, 0, 0, 'mm');
});

test('positive-width intervals: omit inverted/collapsed output; retain ordered tight output; exact grid edges', () => {
  const inch = presetFor({ units: 'inch' });
  for (const [nominal, upper, lower] of [[25.4, 0.00001, 0], [64, 0.00001, -0.00001]] as const) {
    const pair = deviationPair(upper, lower, inch, 'inch', nominal); assert.equal(pair.printable, false); contained(pair, nominal, upper, lower, 'inch');
  }
  const narrow = deviationPair(0.0004, 0, inch, 'inch', 25.4);
  assert.equal(narrow.printable, true); assert.equal(narrow.tight, true); contained(narrow, 25.4, 0.0004, 0, 'inch');
  for (const [upper, lower] of [[0.0253999999999, 0], [0, -0.0253999999999], [0.0254000000001, 0.0253999999999]] as const) contained(deviationPair(upper, lower, inch, 'inch', 25.4), 25.4, upper, lower, 'inch');
});

test('exact containment matrix includes point, shifted, negative, near-grid and sub-grid zones at each precision', () => {
  const settings: UnitSettings[] = [{}, { units: 'inch' }, { units: 'inch', precision: { inch: 6 } }, { precision: { mm: 2 } }, { precision: { mm: 6 } }];
  let numeric = 0, omitted = 0;
  for (const set of settings) for (const nominal of [0, 12.7, -12.7, 30, 64, 25.4, 25.4001, 10.00004]) for (const lower of [0, 0.1, -4.6, 0.0254, -0.0001, 0.01]) for (const width of [0, 0.000001, 0.0004, 0.02]) {
    const unit = set.units ?? 'mm', upper = lower + width, pair = deviationPair(upper, lower, presetFor(set), unit, nominal);
    contained(pair, nominal, upper, lower, unit); if (pair.printable) numeric++; else omitted++;
  }
  assert.ok(numeric > 0 && omitted > 0);
});

test('common-digit sets preserve cardinality and numeric members when another member is unprintable', () => {
  const set = deviationSet([[0.0254, 0.0254], [0.01, 0.01], [0.05, -0.05]], presetFor({ units: 'inch' }), 'inch', 25.4);
  assert.equal(set.items.length, 3); assert.equal(set.tight, true);
  for (const [k, upper, lower] of [[0, 0.0254, 0.0254], [1, 0.01, 0.01], [2, 0.05, -0.05]] as const) contained({ ...set.items[k], nominal: set.nominal, digits: set.digits, tight: set.tight }, 25.4, upper, lower, 'inch');
  assert.deepEqual(set.items.map(item => item.printable), [true, false, true]);
});

test('fit pairs keep their class and each numeric member, with a single missing-limit phrase for the other', () => {
  const doc: StudioDoc = { ...emptyDoc(), fits: { version: 1, tables: [{ id: 'p', rows: [{ class: 'H7', over: 10, upTo: 18, upper: 0.0254, lower: 0.0254 }, { class: 'g6', over: 10, upTo: 18, upper: 0.01, lower: 0.01 }] }], faces: [{ face: 'hole', class: 'H7' }, { face: 'shaft', class: 'g6' }], pairs: [{ hole: 'hole', shaft: 'shaft' }] } };
  const text = withFit(doc, () => null)('hole|top', 12.7, lengthFormats(presetFor({ units: 'inch' })).primary)!;
  const m = /^Ø(\S+) H7\/g6 \((\S+)\/(\S+), limits not printable\)$/.exec(text); assert.ok(m, text);
  assert.equal(compare(plus(decimal(m[1]), decimal(m[2])), decimal('.501')), 0); assert.equal(m[2], m[3]);
  assert.equal(text.split('limits not printable').length - 1, 1);
});

test('a public dimension renders its missing tolerance once, and a representable shifted point stays numeric', () => {
  const p = presetFor({ units: 'inch' }), tol = { kind: 'deviation' as const, upper: 0, lower: 0 };
  assert.equal(toleranceText(tol, '', p, 'inch', 30), 'tolerance not printable');
  const r = withShownText({ ok: true, kind: 'linear', dim: { id: 'p', kind: 'linear', view: 'front', tol }, a: [0, 0], b: [1, 0], value: 30, text: '' } as never, undefined, p);
  assert.ok(r.ok); assert.equal(dimensionLine(r, p), '1.18110 tolerance not printable');
  const marks = valueMarks([0, 0], 0, 'start', r.text, tol, '', p, undefined, 30);
  assert.equal(marks.length, 1); assert.equal(marks[0].kind, 'text'); assert.equal(marks[0].kind === 'text' && marks[0].text, '1.18110 tolerance not printable');
  const shifted = { kind: 'deviation' as const, upper: -4.6, lower: -4.6 };
  assert.equal(toleranceText(shifted, '', p, 'inch', 30), '-.181/-.181');
});

test('an explicit point tolerance and a fit share their final nominal precision in inline, stacked and dual text', () => {
  const doc: StudioDoc = { ...emptyDoc(), fits: { version: 1, tables: [{ id: 'p', rows: [{ class: 'H7', over: 20, upTo: 40, upper: 0.01, lower: 0.01 }] }], faces: [{ face: 'hole', class: 'H7' }] } };
  for (const dual of [false, true]) {
    const p = presetFor({ units: 'inch', dual }), tol = { kind: 'deviation' as const, upper: -4.6, lower: -4.6 };
    const r = withShownText({ ok: true, kind: 'diameter', dim: { id: 'mixed', kind: 'diameter', view: 'top', edge: 'hole', near: [0, 0, 0], place: [20, 20], tol }, center: [0, 0], radius: 15, value: 30, text: '' } as never, withFit(doc, () => null), p);
    assert.ok(r.ok); assert.deepEqual(r.shownPrecision, { inch: 5 });
    const line = dimensionLine(r, p), match = /^Ø(\S+) H7 \(limits not printable\) (\S+)\/(\S+)/.exec(line); assert.ok(match, line);
    for (const deviation of match.slice(2)) assert.equal(compare(plus(decimal(match[1]), decimal(deviation)), decimal(1)), 0, line);
    const marks = dimensionMarks({ id: 'top', origin: [100, 100], scale: 1, box: [0, 0, 200, 200] }, r, p).filter((m): m is Extract<typeof m, { kind: 'text' }> => m.kind === 'text');
    if (dual) assert.ok(marks.some(m => m.text === line), marks.map(m => m.text).join(' | '));
    else { assert.ok(marks.some(m => m.text === 'Ø1.18110 H7 (limits not printable)')); assert.deepEqual(marks.slice(-2).map(m => m.text), ['-.18110', '-.18110']); }
  }
});
