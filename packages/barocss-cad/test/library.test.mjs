import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAD_KERNEL_VERSION, loadCadLibrary, instantiateLibraryPart, parseLibraryExpression, evaluateLibraryExpression, CadLibraryError, evaluateCadPart, checkLibraryFit, outputOf, massPropertiesOf } from '../dist/index.js';

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
    interfaces: [{ id: 'top', role: 'mount-face', accepts: ['foot'], frame: { origin: [{ expr: 'w / 2' }, { expr: 'h / 2' }, { expr: 't' }], z: [0, 0, 1], x: [1, 0, 0] }, faces: { plane: 'p.top' } }],
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
  assert.deepEqual(big.origin, { library: 'test-plates', version: '1.2.0', part: 'plate', variant: 'B', params: {}, values: { w: 80, h: 60, t: 5, d: 4.5, holes: 1 } });
  // (t from the variant row: still the table's estimate; the part's simplified internals said.)
  assert.deepEqual(big.warnings, ['t = 5 mm is an estimate', 'Mounting plate: simplified internals — not for structural calculation']);
  assert.deepEqual(big.interfaces, [{ id: 'top', role: 'mount-face', accepts: ['foot'], frame: { origin: [40, 30, 5], z: [0, 0, 1], x: [1, 0, 0] }, faces: { plane: 'P1_p.top' } }]);
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: big.features };
  const out = outputOf(evaluateCadPart(doc), 'P1_f');
  // (Less the hole and the 0.5 mm chamfer along the 80 mm edge.)
  assert.ok(Math.abs(massPropertiesOf(out).volume - (80 * 60 * 5 - Math.PI * 2.25 ** 2 * 5 - 0.125 * 80)) < 1e-6, String(massPropertiesOf(out).volume));
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
  // (Another model's geometry is never a library part: a STEP import or a mesh stays in the user's own document.)
  refused(() => loadCadLibrary(part({ recipe: [{ id: 'x', kind: 'import', step: 'ISO-10303-21;' }] })), 'RECIPE', /import carries another model's geometry/);
  refused(() => loadCadLibrary(part({ recipe: [{ id: 'x', kind: 'mesh', positions: [0, 0, 0], indices: [0, 0, 0] }] })), 'RECIPE', /mesh carries/);
  assert.equal(CAD_KERNEL_VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  refused(() => loadCadLibrary(part({ interfaces: [{ id: 'a', role: 'x', frame: { origin: [0, 0, { expr: 'nope' }], z: [0, 0, 1], x: [1, 0, 0] } }] })), 'REFERENCE', /reads nope/);
  refused(() => loadCadLibrary(part({ interfaces: [{ id: 'a', role: 'x' }] })), 'FORMAT', /frame must be/);
  refused(() => loadCadLibrary(part({ interfaces: [{ id: 'a', role: 'x', frame: { origin: [0, 0, 0], z: [0, 0, 1], x: [1, 0, 0] }, faces: { plane: 'zz.top' } }] })), 'REFERENCE', /zz\.top is not a face/);
  refused(() => instantiateLibraryPart(loadCadLibrary(part({ interfaces: [{ id: 'a', role: 'x', frame: { origin: [0, 0, 0], z: [0, 0, 1], x: [1, 0, 1] } }] })), 'plate'), 'RECIPE', /perpendicular/);
});

/** A block with a pocket on top, and a key that fits it: interfaces on the pocket's floor and the key's bottom. */
const KEYED = {
  format: 'barocss-cad-library', version: 1, id: 'test-keys', name: 'Test keys', libraryVersion: '0.1.0', units: 'mm',
  parts: [
    { id: 'block', name: 'Block', parameters: { L: { value: 30, source: 'test' }, W: { value: 20, source: 'test' }, H: { value: 10, source: 'test' }, k: { value: 6, source: 'test' }, depth: { value: 4, source: 'test' } },
      recipe: [
        { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ expr: 'L' }, { expr: 'W' }] },
        { id: 'b', kind: 'extrude', sketch: 's', height: { expr: 'H' } },
        { id: 'ps', kind: 'sketch', profile: 'rectangle', min: [{ expr: '(L - k) / 2' }, { expr: '(W - k) / 2' }], max: [{ expr: '(L + k) / 2' }, { expr: '(W + k) / 2' }] },
        { id: 'pk', kind: 'extrude', sketch: 'ps', height: { expr: 'depth + 1' }, from: { expr: 'H - depth' } },
        { id: 'cut', kind: 'difference', target: 'b', tool: 'pk' }],
      interfaces: [{ id: 'pocket', role: 'pocket', accepts: ['key'], frame: { origin: [{ expr: 'L / 2' }, { expr: 'W / 2' }, { expr: 'H - depth' }], z: [0, 0, 1], x: [1, 0, 0] }, faces: { plane: 'pk.bottom' } }] },
    { id: 'key', name: 'Key', parameters: { k: { value: 5.8, source: 'test (0.1 mm clearance a side)' }, h: { value: 8, source: 'test' } },
      recipe: [
        { id: 's', kind: 'sketch', profile: 'rectangle', min: [{ expr: '-k / 2' }, { expr: '-k / 2' }], max: [{ expr: 'k / 2' }, { expr: 'k / 2' }] },
        { id: 'key', kind: 'extrude', sketch: 's', height: { expr: 'h' } }],
      interfaces: [{ id: 'foot', role: 'key', frame: { origin: [0, 0, 0], z: [0, 0, -1], x: [0, 1, 0] }, faces: { plane: 'key.bottom' } }] },
  ],
  fits: [
    { id: 'key-in-pocket', a: { part: 'block', interface: 'pocket' }, b: { part: 'key', interface: 'foot' } },
    { id: 'key-too-wide', a: { part: 'block', interface: 'pocket' }, b: { part: 'key', params: { k: 6.5 }, interface: 'foot' } },
  ],
};

test('LIB2 fits: b placed onto a by interfaces facing each other (an exact rigid placement, offset in a\'s frame); the overlap by the exact Boolean — a key in its pocket overlaps by nothing, a wider key by its excess; declared fits checked on load', () => {
  const lib = loadCadLibrary(KEYED);
  const ok = checkLibraryFit(lib, 'key-in-pocket');
  assert.equal(ok.ok, true); assert.equal(ok.overlapMM3, 0); assert.equal(ok.contact, true);
  // (Lifted 1 mm off the floor: no overlap, but no contact either — not a fit.)
  const lifted = checkLibraryFit(lib, { a: KEYED.fits[0].a, b: KEYED.fits[0].b, offset: [0, 0, 1] });
  assert.deepEqual([lifted.overlapMM3, lifted.contact, lifted.ok], [0, false, false]);
  // (The key's foot frame: z down, x along +Y; the pocket's: z up, x along +X — the key turned a quarter about Z, its foot on the floor.)
  const R = ok.placement.rotation; assert.deepEqual(R.map(v => Math.round(v * 1e12) / 1e12 + 0), [0, 1, 0, -1, 0, 0, 0, 0, 1]);
  const p = ([x, y, z]) => [0, 1, 2].map(i => R[3 * i] * x + R[3 * i + 1] * y + R[3 * i + 2] * z + ok.placement.translation[i]);
  assert.deepEqual(p([0, 0, 0]).map(v => +v.toFixed(12)), [15, 10, 6]); assert.deepEqual(p([0, 0, 8]).map(v => +v.toFixed(12)), [15, 10, 14]);
  // (A key 6.5 wide in the 6 mm pocket: 0.25 into each of its four walls, over its 4 mm depth: 6.5² − 6² = 6.25 mm² × 4.)
  const wide = checkLibraryFit(lib, 'key-too-wide');
  assert.equal(wide.ok, false); assert.ok(Math.abs(wide.overlapMM3 - 6.25 * 4) < 1e-6, String(wide.overlapMM3));
  // Moved by an offset: 1 mm along the pocket's x, into one wall by 0.9 over the key's 5.8 × the depth 4.
  const moved = checkLibraryFit(lib, { a: KEYED.fits[0].a, b: KEYED.fits[0].b, offset: [1, 0, 0] });
  assert.ok(Math.abs(moved.overlapMM3 - 0.9 * 5.8 * 4) < 1e-6, String(moved.overlapMM3));
  // Declared fits are checked on load: unknown parts, interfaces, roles that do not accept each other.
  const bad = fits => () => loadCadLibrary({ ...KEYED, fits });
  refused(bad([{ id: 'f', a: { part: 'nope', interface: 'x' }, b: KEYED.fits[0].b }]), 'REFERENCE', /no part nope/);
  refused(bad([{ id: 'f', a: { part: 'block', interface: 'x' }, b: KEYED.fits[0].b }]), 'REFERENCE', /no interface x/);
  refused(bad([{ id: 'f', a: KEYED.fits[0].b, b: KEYED.fits[0].b }]), 'REFERENCE', /do not accept each other/);
  refused(bad([KEYED.fits[0], KEYED.fits[0]]), 'FORMAT', /appears twice/);
});

test('declared checks (R6b, D65): recommended ones warn, feasible ones refuse, with the margin; context inputs (the wall of the body it goes on) given at insertion — a check needing one not given is unknown, said, never passed', () => {
  const RIB = {
    format: 'barocss-cad-library', version: 1, id: 'test-ribs', name: 'Ribs', libraryVersion: '1.0.0', units: 'mm',
    parts: [{ id: 'rib', name: 'Rib', parameters: { r: { value: 1.2, source: 'test' }, h: { value: 8, source: 'test' } },
      context: { wall: { unit: 'mm', description: 'the nominal wall of the body it goes on', from: ['given', 'min_wall'] } },
      checks: [
        { id: 'sink', expr: 'r <= 0.6 * wall', value: 'r / wall', level: 'recommended', message: 'a rib thicker than 0.6 of the wall risks sink marks' },
        { id: 'too-thick', expr: 'r <= wall', value: 'r / wall', level: 'feasible', message: 'a rib thicker than the wall' },
        { id: 'tall', expr: 'h <= 3 * 4', level: 'recommended', message: 'a rib taller than 3 × its base' },
      ],
      recipe: [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ expr: 'r' }, 20] }, { id: 'x', kind: 'extrude', sketch: 's', height: { expr: 'h' } }] }],
  };
  const lib = loadCadLibrary(RIB);
  // On a 2.5 mm wall: 1.2 ≤ 1.5, met.
  let i = instantiateLibraryPart(lib, 'rib', { context: { wall: 2.5 } });
  assert.deepEqual(i.checks.map(c => [c.id, c.pass, c.value]), [['sink', true, 0.48], ['too-thick', true, 0.48], ['tall', true, undefined]]); assert.deepEqual(i.warnings, []);
  // On a 1.6 mm wall: over 0.6 (0.75 of it) — a warning with the margin; not over the wall.
  i = instantiateLibraryPart(lib, 'rib', { context: { wall: 1.6 } });
  assert.deepEqual(i.warnings, ['sink: a rib thicker than 0.6 of the wall risks sink marks (0.75)']);
  // On a 1 mm wall: thicker than the wall — refused, with why.
  refused(() => instantiateLibraryPart(lib, 'rib', { context: { wall: 1 } }), 'PARAMETER', /too-thick: a rib thicker than the wall \(1\.2\)/);
  // No wall given: both wall checks unknown, said; the other still checked (a tall rib warned).
  i = instantiateLibraryPart(lib, 'rib', { params: { h: 14 } });
  assert.deepEqual(i.checks.map(c => [c.id, c.pass]), [['sink', null], ['too-thick', null], ['tall', false]]);
  assert.deepEqual(i.warnings, ['sink: unknown — needs wall (the nominal wall of the body it goes on)', 'too-thick: unknown — needs wall (the nominal wall of the body it goes on)', 'tall: a rib taller than 3 × its base']);
  // Context not declared, a recipe reading context, a check reading neither: refused.
  refused(() => instantiateLibraryPart(lib, 'rib', { context: { depth: 3 } }), 'REFERENCE', /no context input depth/);
  const bad = patch => () => loadCadLibrary({ ...RIB, parts: [{ ...RIB.parts[0], ...patch }] });
  refused(bad({ recipe: [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ expr: 'wall' }, 20] }] }), 'REFERENCE', /reads wall, which is not a parameter/);
  refused(bad({ checks: [{ id: 'c', expr: 'q > 0', level: 'feasible', message: 'm' }] }), 'REFERENCE', /reads q/);
  refused(bad({ checks: [{ id: 'c', expr: 'r > 0', level: 'maybe', message: 'm' }] }), 'FORMAT', /a check is/);
  refused(bad({ context: { r: {} } }), 'FORMAT', /not a parameter's/);
});

test('R6b.3 additions: ln, exp, atan (degrees); reports — a value, or unknown naming the context it needs; a check unknown only when its evaluation reaches missing context (a short-circuit past it decides); fit checks over both parts\' values', () => {
  assert.ok(Math.abs(ev('ln(exp(2))') - 2) < 1e-15); assert.ok(Math.abs(ev('atan(1)') - 45) < 1e-12);
  const LIB = {
    format: 'barocss-cad-library', version: 1, id: 'test-rep', name: 'Reports', libraryVersion: '1.0.0', units: 'mm',
    parts: [{ id: 'beam', name: 'Beam', parameters: { k: { value: 2, source: 'test' } },
      context: { E: { unit: 'MPa' }, fdm: {}, inPlane: {} },
      checks: [{ id: 'plane', expr: 'fdm == 0 || inPlane == 1', level: 'recommended', message: 'bend in the print plane' }],
      reports: [{ id: 'force', value: 'k * E', unit: 'N', message: 'its force' }],
      recipe: [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ expr: 'k' }, 1] }, { id: 'x', kind: 'extrude', sketch: 's', height: 1 }],
      interfaces: [{ id: 'top', role: 'a', accepts: ['b'], frame: { origin: [0, 0, 1], z: [0, 0, 1], x: [1, 0, 0] } }, { id: 'bot', role: 'b', accepts: ['a'], frame: { origin: [0, 0, 0], z: [0, 0, -1], x: [1, 0, 0] } }] }],
    fits: [{ id: 'stack', a: { part: 'beam', interface: 'top' }, b: { part: 'beam', params: { k: 1 }, interface: 'bot' }, checks: [{ id: 'narrower', expr: 'b_k < a_k', value: 'a_k - b_k', message: 'the top one narrower' }] }],
  };
  const lib = loadCadLibrary(LIB);
  let i = instantiateLibraryPart(lib, 'beam', { context: { E: 100, fdm: 0 } });
  assert.deepEqual(i.reports, [{ id: 'force', value: 200, unit: 'N', message: 'its force' }]);
  assert.equal(i.checks[0].pass, true, 'fdm 0: decided without inPlane');
  i = instantiateLibraryPart(lib, 'beam', { context: { fdm: 1 } });
  assert.deepEqual([i.reports[0].value, i.reports[0].unknown], [null, 'needs E']); assert.equal(i.checks[0].pass, null);
  const fit = checkLibraryFit(lib, 'stack');
  assert.deepEqual(fit.checks, [{ id: 'narrower', pass: true, value: 1, message: 'the top one narrower' }]);
  refused(() => loadCadLibrary({ ...LIB, fits: [{ ...LIB.fits[0], checks: [{ id: 'c', expr: 'c_k > 0', message: 'm' }] }] }), 'REFERENCE', /reads c_k/);
  refused(() => loadCadLibrary({ ...LIB, parts: [{ ...LIB.parts[0], reports: [{ id: 'plane', value: 'k', message: 'm' }] }] }), 'FORMAT', /report id appears twice/);
});
