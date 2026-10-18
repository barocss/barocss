import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCadLibrary, instantiateLibraryPart, parseLibraryExpression, evaluateLibraryExpression, CadLibraryError, evaluateCadPart } from '../dist/index.js';

// LIB1 (D61): libraries as data — a manifest, parts with sourced (or estimated) parameters, variants, a recipe of
// part-model features with safe expressions; checked on load; instantiated to features.
const ev = (text, values = {}) => evaluateLibraryExpression(parseLibraryExpression(text), values);
const refused = (f, code, re) => assert.throws(f, e => e instanceof CadLibraryError && e.code === code && (!re || re.test(e.message)), `${code} ${re}`);

test('the expression language: arithmetic with precedence, right-associative ^, unary minus, comparisons, logic, the conditional, functions in degrees, pi; nothing else is run', () => {
  assert.equal(ev('1 + 2 * 3'), 7); assert.equal(ev('(1 + 2) * 3'), 9); assert.equal(ev('2 ^ 3 ^ 2'), 512); assert.equal(ev('-2 ^ 2'), 4); assert.equal(ev('7 % 4'), 3);
  assert.equal(ev('w / 2 - t', { w: 20, t: 1.5 }), 8.5); assert.equal(ev('1e-3 * 2'), 0.002); assert.equal(ev('.5 + 0.25'), 0.75);
  assert.equal(ev('a > 2 && b <= 1 ? 10 : 20', { a: 3, b: 1 }), 10); assert.equal(ev('!(a == 3) || 0', { a: 3 }), 0); assert.equal(ev('a != 3', { a: 2 }), 1);
  assert.equal(ev('min(3, 1, 2) + max(4, 5)'), 6); assert.equal(ev('round(2.5) + floor(-0.5) + ceil(0.2) + abs(-3)'), 3 - 1 + 1 + 3);
  assert.ok(Math.abs(ev('sin(30)') - 0.5) < 1e-15); assert.ok(Math.abs(ev('atan2(1, 1)') - 45) < 1e-12); assert.ok(Math.abs(ev('2 * pi') - 2 * Math.PI) < 1e-15); assert.equal(ev('sqrt(16)'), 4);
  // (Short-circuit: the untaken side is not evaluated.)
  assert.equal(ev('0 && x', {}), 0); assert.equal(ev('1 ? 2 : x', {}), 2);
  refused(() => parseLibraryExpression('constructor.constructor("x")()'), 'EXPRESSION', /unexpected "\."|cannot read/);
  refused(() => parseLibraryExpression('alert(1)'), 'EXPRESSION', /unknown function alert/);
  refused(() => parseLibraryExpression('max(1)'), 'EXPRESSION', /at least 2 arguments/);
  refused(() => parseLibraryExpression('1 +'), 'EXPRESSION', /ends early/); refused(() => parseLibraryExpression('(1'), 'EXPRESSION', /not closed/);
  refused(() => parseLibraryExpression('a ? b'), 'EXPRESSION', /needs ":"/); refused(() => parseLibraryExpression('1 2'), 'EXPRESSION', /unexpected "2"/);
  refused(() => parseLibraryExpression('x'.repeat(501)), 'EXPRESSION', /at most 500/); refused(() => parseLibraryExpression('('.repeat(40) + '1' + ')'.repeat(40)), 'EXPRESSION', /nested deeper/);
  refused(() => parseLibraryExpression('"a"'), 'EXPRESSION', /cannot read/);
  refused(() => ev('a + 1'), 'REFERENCE', /no parameter a/); refused(() => ev('1 / 0'), 'EXPRESSION', /not a finite number/);
  refused(() => ev('toString', {}), 'REFERENCE', /no parameter toString/);
});

/** A small library: a plate with a hole pattern, in two sizes, its corner holes left out when too small. */
const PLATE = {
  format: 'barocss-cad-library', version: 1, id: 'test-plates', name: 'Test plates', libraryVersion: '1.2.0', units: 'mm', license: 'CC0-1.0', provenance: 'written for the tests',
  parts: [{
    id: 'plate', name: 'Mounting plate', category: 'plates', simplified: true,
    parameters: {
      w: { value: 40, unit: 'mm', min: 10, max: 200, source: 'test table, row A' },
      h: { value: 30, unit: 'mm', min: 10, max: 200, source: 'test table, row A' },
      t: { value: 3, unit: 'mm', min: 1, max: 20, estimate: true },
      d: { value: 4.5, unit: 'mm', source: 'clearance for M4, test table' },
      holes: { value: 1, unit: 'count', integer: true, min: 0, max: 1, source: 'test table' },
      inset: { value: { expr: 'max(d, min(w, h) / 6)' }, unit: 'mm' },
    },
    variants: [{ id: 'A', values: { w: 40, h: 30 } }, { id: 'B', name: 'Large', values: { w: 80, h: 60, t: 5 } }],
    recipe: [
      { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ expr: 'w' }, { expr: 'h' }] },
      { id: 'p', kind: 'extrude', sketch: 's', height: { expr: 't' } },
      { id: 'h1', kind: 'hole', target: 'p', center: [{ expr: 'inset' }, { expr: 'inset' }], radius: { expr: 'd / 2' }, when: 'holes > 0' },
      { id: 'f', kind: 'chamfer', target: 'h1', edges: ['p.side0|p.top'], distance: 0.5, when: 'holes > 0 && w >= 60' },
    ],
    outputs: ['f'],
    interfaces: [{ id: 'top', role: 'mount-face', plane: { origin: [0, 0, { expr: 't' }], normal: [0, 0, 1] } }],
  }],
};

test('loading and instantiating: defaults, variants, values given; derived parameters; features kept by `when`; expressions to numbers; ids and references prefixed; origin and warnings; the features evaluate', () => {
  const lib = loadCadLibrary(JSON.stringify(PLATE));
  assert.equal(lib.manifest.libraryVersion, '1.2.0'); assert.deepEqual([...lib.parts.keys()], ['plate']);
  // (Variant B: 80 × 60 × 5, the chamfer kept: w ≥ 60.)
  const big = instantiateLibraryPart(lib, 'plate', { variant: 'B', prefix: 'P1' });
  assert.deepEqual(big.features.map(f => f.id), ['P1_s', 'P1_p', 'P1_h1', 'P1_f']);
  assert.deepEqual(big.features[0].max, [80, 60]); assert.equal(big.features[1].sketch, 'P1_s'); assert.equal(big.features[1].height, 5);
  assert.deepEqual(big.features[2].center, [10, 10]); assert.equal(big.features[2].radius, 2.25); assert.equal(big.features[2].target, 'P1_p');
  assert.deepEqual(big.features[3].edges, ['P1_p.side0|P1_p.top']); assert.equal('when' in big.features[3], false);
  assert.deepEqual(big.outputs, ['P1_f']);
  assert.deepEqual(big.origin, { library: 'test-plates', version: '1.2.0', part: 'plate', variant: 'B', params: { w: 80, h: 60, t: 5, d: 4.5, holes: 1 } });
  // (t from the variant row: still the table's estimate; the part's simplified internals said.)
  assert.deepEqual(big.warnings, ['t = 5 mm is an estimate', 'Mounting plate: simplified internals — not for structural calculation']);
  assert.deepEqual(big.interfaces, [{ id: 'top', role: 'mount-face', plane: { origin: [0, 0, 5], normal: [0, 0, 1] } }]);
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: big.features };
  const out = evaluateCadPart(doc).output('P1_f');
  // (Less the hole and the 0.5 mm chamfer along the 80 mm edge.)
  assert.ok(Math.abs(out.massProperties(1).volumeMM3 - (80 * 60 * 5 - Math.PI * 2.25 ** 2 * 5 - 0.125 * 80)) < 1e-6, String(out.massProperties(1).volumeMM3));
  // Defaults, a value given (no estimate warned for it), and a hole left out by `when`: the chamfer then refused as an output.
  const small = instantiateLibraryPart(lib, 'plate', { params: { t: 2 } });
  // (The chamfer left out, w < 60: the output is the body it would have changed, the hole's.)
  assert.deepEqual(small.features.map(f => f.id), ['plate_s', 'plate_p', 'plate_h1']); assert.deepEqual(small.outputs, ['plate_h1']);
  assert.deepEqual(small.warnings, ['Mounting plate: simplified internals — not for structural calculation']);
  assert.deepEqual(instantiateLibraryPart(lib, 'plate', { params: { holes: 0 } }).outputs, ['plate_p']);
  const maker = JSON.parse(JSON.stringify(PLATE)); maker.parts[0].recipe[1].when = 'holes > 0'; maker.parts[0].recipe[2].when = undefined; delete maker.parts[0].recipe[2].when;
  refused(() => instantiateLibraryPart(loadCadLibrary(maker), 'plate', { params: { holes: 0 } }), 'RECIPE', /p is left out by its when for these values/);
  // Refusals at instantiation.
  refused(() => instantiateLibraryPart(lib, 'nut'), 'REFERENCE', /no part nut/);
  refused(() => instantiateLibraryPart(lib, 'plate', { variant: 'C' }), 'REFERENCE', /no variant C \(variants: A, B\)/);
  refused(() => instantiateLibraryPart(lib, 'plate', { params: { w: 5 } }), 'PARAMETER', /5 is outside 10 … 200/);
  refused(() => instantiateLibraryPart(lib, 'plate', { params: { holes: 0.5 } }), 'PARAMETER', /a whole number/);
  refused(() => instantiateLibraryPart(lib, 'plate', { params: { inset: 3 } }), 'PARAMETER', /is derived/);
  refused(() => instantiateLibraryPart(lib, 'plate', { params: { q: 3 } }), 'REFERENCE', /no parameter q/);
  refused(() => instantiateLibraryPart(lib, 'plate', { prefix: '1x' }), 'FORMAT', /prefix/);
});

test('loading refuses, typed and saying where: format, version, ids, a value without a source, bad limits, a derived cycle, a variant setting a derived or unknown parameter, an expression reading a non-parameter, a reference to a later feature, a duplicate id, bad outputs', () => {
  const lib = (patch) => JSON.parse(JSON.stringify({ ...PLATE, ...patch }));
  const part = (patch) => lib({ parts: [{ ...PLATE.parts[0], ...patch }] });
  const P = PLATE.parts[0];
  refused(() => loadCadLibrary('{'), 'FORMAT', /not JSON/); refused(() => loadCadLibrary(lib({ format: 'x' })), 'FORMAT');
  refused(() => loadCadLibrary(lib({ version: 2 })), 'VERSION', /reads version 1/); refused(() => loadCadLibrary(lib({ libraryVersion: '1.2' })), 'VERSION');
  refused(() => loadCadLibrary(lib({ id: '9lib' })), 'FORMAT'); refused(() => loadCadLibrary(lib({ units: 'in' })), 'FORMAT');
  refused(() => loadCadLibrary(lib({ parts: [P, P] })), 'FORMAT', /appears twice/);
  refused(() => loadCadLibrary(part({ parameters: { ...P.parameters, w: { value: 40 } } })), 'PARAMETER', /test-plates\/plate\.w: a value needs its source, or estimate: true/);
  refused(() => loadCadLibrary(part({ parameters: { ...P.parameters, w: { value: 'x', source: 's' } } })), 'PARAMETER');
  refused(() => loadCadLibrary(part({ parameters: { ...P.parameters, pi: { value: 1, source: 's' } } })), 'PARAMETER', /not pi/);
  refused(() => loadCadLibrary(part({ parameters: { ...P.parameters, a: { value: { expr: 'b + 1' } }, b: { value: { expr: 'a * 2' } } } })), 'REFERENCE', /cycle: a → b → a/);
  refused(() => loadCadLibrary(part({ parameters: { ...P.parameters, a: { value: { expr: 'zz' } } } })), 'REFERENCE', /reads zz/);
  refused(() => loadCadLibrary(part({ variants: [{ id: 'A', values: { inset: 3 } }] })), 'PARAMETER', /derived/);
  refused(() => loadCadLibrary(part({ variants: [{ id: 'A', values: { q: 3 } }] })), 'REFERENCE', /sets q/);
  refused(() => loadCadLibrary(part({ variants: [{ id: 'A', values: {} }, { id: 'A', values: {} }] })), 'FORMAT', /variant id appears twice/);
  refused(() => loadCadLibrary(part({ recipe: [{ ...P.recipe[0], max: [{ expr: 'w' }, { expr: 'height' }] }] })), 'REFERENCE', /plate:s\.max\[1\]: reads height/);
  refused(() => loadCadLibrary(part({ recipe: [P.recipe[1], P.recipe[0]] })), 'REFERENCE', /s is not an earlier feature/);
  refused(() => loadCadLibrary(part({ recipe: [P.recipe[0], P.recipe[0]] })), 'RECIPE', /appears twice/);
  refused(() => loadCadLibrary(part({ recipe: [] })), 'RECIPE');
  refused(() => loadCadLibrary(part({ recipe: [{ ...P.recipe[0], when: 'w >' }] })), 'EXPRESSION', /ends early/);
  refused(() => loadCadLibrary(part({ recipe: [{ ...P.recipe[0], min: [{ expr: '0', note: 1 }, 0] }] })), 'EXPRESSION', /takes nothing else/);
  refused(() => loadCadLibrary(part({ outputs: ['zz'] })), 'REFERENCE', /outputs/);
  refused(() => loadCadLibrary(part({ interfaces: [{ id: 'a', role: 'x', at: { expr: 'nope' } }] })), 'REFERENCE', /reads nope/);
});
