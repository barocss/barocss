// D346 bounded polynomial quadratic CUT contracts with independent position and material references.
// Retain the existing D334 straight/refusal suites alongside these additional profiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep, brepMassProperties, CadNumericPolicy } from '@barocss/cad';
import { planCurveFeaturePatternPath } from '@barocss/cad/api';
import { part, param, type RawNurbsPath, type StudioPart } from '../src/api';
import { curvePatternPathLength, curvePatternDocumentProblem, resolveCurveFeaturePatternPath, affectedCurveFeaturePatterns, eligibleCurvePatternPaths } from '../src/engine/curveFeaturePattern';
import { outlineCurve, curvesSource } from '../src/engine/curveSource';
import { xyPlane } from '../src/sketch/plane';
import { importSource, directOps } from '../src/engine/direct';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluatedPart, WireSender, WireReceiver } from '../src/engine/wireDoc';
import { readStudioDoc } from '../src/engine/migrate';
import { withNode } from '../src/engine/doc';
import { flattenAssembly } from '../src/engine/flatten';
import { bindParameter } from '../src/engine/parameters';
import { commandById, type Ctx } from '../src/app/commands';
import { editFields } from '../src/app/editFields';

interface Reference {
  name: string; points: number[][]; lengthBounds: number[];
  positions: { offset: number[]; radius: number; certified: boolean }[]; centroid: number[];
}
// Independent High fixed-point sqrt/rigorous Simpson reference, source hash ad12d0f8256de8ee... .
// Its balls include reported binary64 offset rounding. No production planner supplies these expectations.
const references: Reference[] = [
  {
    "name": "authorable right quadratic",
    "points": [
      [
        0,
        0
      ],
      [
        20,
        0
      ],
      [
        20,
        20
      ]
    ],
    "lengthBounds": [
      32.46450479343963,
      32.464504811548714
    ],
    "positions": [
      {
        "offset": [
          9.804642846917092,
          1.6361454649667142
        ],
        "radius": 4.6339673873489035e-09,
        "certified": true
      },
      {
        "offset": [
          17.287138970530407,
          7.980960868337377
        ],
        "radius": 6.625261593058337e-09,
        "certified": true
      }
    ],
    "centroid": [
      30.238268905621354,
      20.15848976857768,
      5
    ]
  },
  {
    "name": "asymmetric quadratic",
    "points": [
      [
        0,
        0
      ],
      [
        20,
        0
      ],
      [
        24,
        18
      ]
    ],
    "lengthBounds": [
      32.95184910225117,
      32.95184911104702
    ],
    "positions": [
      {
        "offset": [
          9.863370390345974,
          1.3846589155193532
        ],
        "radius": 1.540874228676357e-09,
        "certified": true
      },
      {
        "offset": [
          18.30421261214178,
          6.547013804851535
        ],
        "radius": 3.2574538489412507e-09,
        "certified": true
      }
    ],
    "centroid": [
      30.231416668773964,
      20.16922501451993,
      5
    ]
  },
  {
    "name": "live middle-pole edit",
    "points": [
      [
        0,
        0
      ],
      [
        20,
        5
      ],
      [
        20,
        20
      ]
    ],
    "lengthBounds": [
      30.809778558485117,
      30.809778567539656
    ],
    "positions": [
      {
        "offset": [
          9.363978407378582,
          3.4406030049848866
        ],
        "radius": 1.767878078408241e-09,
        "certified": true
      },
      {
        "offset": [
          16.95102866855327,
          9.81108693115009
        ],
        "radius": 5.3780935460905735e-09,
        "certified": true
      }
    ],
    "centroid": [
      30.243216515439922,
      20.13533955454691,
      5
    ]
  }
];
// Decimal80 analytic cross-check, not a new certified interval.
const spacingGuide: Reference = {
  "name": "Decimal80 spacing12 guide (not a certified interval)",
  "points": [
    [
      0,
      0
    ],
    [
      20,
      0
    ],
    [
      20,
      20
    ]
  ],
  "lengthBounds": [
    32.46450479343963,
    32.464504811548714
  ],
  "positions": [
    {
      "offset": [
        11.614367038573226,
        2.484848476895385
      ],
      "radius": 0,
      "certified": false
    },
    {
      "offset": [
        18.876310248373144,
        11.64238287281798
      ],
      "radius": 0,
      "certified": false
    }
  ],
  "centroid": [
    30.216619889892062,
    20.129762857645137,
    5.0
  ]
};
const positionBudget = CadNumericPolicy.linearTolerance;
const source = () => part('D346 asymmetric CUT').parameter('spacing', 10).parameter('copies', 3).box({ w: 60, d: 40, h: 10 })
  .subtract(p => p.box({ w: 3, d: 5, h: 10, x: 7, y: 6 }));
function raw(reference = references[0], z = 0, domain: readonly [number, number] = [0, 1]): RawNurbsPath {
  return { degree: 2, knots: [domain[0], domain[0], domain[0], domain[1], domain[1], domain[1]], controlPoints: reference.points.map(p => [p[0], p[1], z]), weights: [1, 1, 1] };
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= positionBudget, `${actual} vs ${expected}`);
function ball(actual: readonly number[], offset: readonly number[], radius: number, label: string) {
  // Ordinary fixtures have margin far beyond addition rounding. This is a bounded consumer comparison,
  // not a universal floating-point vector-enclosure algorithm.
  assert.ok(Math.hypot(actual[0] - offset[0], actual[1] - offset[1], actual[2] ?? 0) + radius <= positionBudget, label);
}
function plan(reference: Reference, path = raw(reference)) {
  const before = structuredClone(path), result = planCurveFeaturePatternPath(path, 10, 3);
  assert.equal(result.offsets.length, 3); assert.deepEqual(result.offsets[0], [0, 0, 0]);
  assert.ok(Number.isFinite(result.length.estimate) && result.length.lower <= result.length.estimate && result.length.estimate <= result.length.upper);
  assert.ok(result.length.lower <= reference.lengthBounds[1] && result.length.upper >= reference.lengthBounds[0], 'Length bounds overlap independent certified interval; Kernel proof owns full interval validity');
  reference.positions.forEach((p, k) => ball(result.offsets[k + 1], p.offset, p.radius, `independent position ball ${reference.name}/${k + 1}`));
  assert.deepEqual(path, before); return result;
}
function geometry(p: StudioPart, reference: Reference, spacing = 10) {
  const bodies = partBreps(p.doc); assert.ok(bodies.length === 1 || bodies.length === 2);
  const witness = bodies.length === 2 ? bodies.find(b => Math.abs(p.body(b.key).mass({ density: 1 }).volume - 420) <= positionBudget) : undefined;
  if (witness) { const mass = p.body(witness.key).mass({ density: 1 }); close(mass.volume, 420); mass.centroid.forEach((v, k) => close(v, [86, .5, 3.5][k])); }
  const target = bodies.find(b => b !== witness)!; assert.ok(target);
  const brep = target.brep, before = structuredClone(brep); assert.equal(checkBrep(brep, { strict: true }).valid, true); assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid'); assert.ok(brep.shells.every(s => s.closed));
  const displayed = evaluateDoc(p.doc, 0); assert.ok(displayed.ok); const model = displayed.bodies.find(b => b.key === target.key)!;
  const pipelines = { public: p.body(target.key).mass({ density: 1 }), native: brepMassProperties(brep, 1), model };
  for (const mass of Object.values(pipelines)) { assert.ok(mass.volume !== null && mass.centroid); close(mass.volume, 23550); mass.centroid.forEach((v, k) => close(v, reference.centroid[k])); }
  const offsets = [[0, 0], ...reference.positions.map(p => p.offset)], names = p.body(target.key).select().faces().names().sort(); assert.equal(new Set(names).size, names.length);
  offsets.forEach((offset, k) => {
    const radius = k ? reference.positions[k - 1].radius : 0;
    for (const dx of [0, 3]) for (const dy of [0, 5]) for (const z of [0, 10]) {
      const center = [7 + offset[0] + dx, 6 + offset[1] + dy, z];
      assert.ok(brep.vertices.some(v => Math.hypot(...v.point.map((x, a) => x - center[a])) + radius <= positionBudget), `fixed 3x5x10 cutter corner ${k}/${center}`);
    }
    if (k) for (let side = 0; side < 4; side++) assert.ok(names.some(n => n.endsWith(`.side${side}@${k}`)), `stable source wall ${side}@${k}`);
  });
  assert.ok(!names.some(n => n.endsWith('@3'))); assert.deepEqual(brep, before);
  return { targetKey: target.key, names, spacing, witnessKey: witness?.key };
}
function liveSource() {
  const doc = source().doc, line = outlineCurve(xyPlane(), [[0, 0], [20, 20]], undefined, false);
  assert.equal(line.degree, 2); assert.deepEqual(line.points, [[0, 0, 0], [10, 10, 0], [20, 20, 0]]); assert.deepEqual(line.weights, [1, 1, 1]);
  let direct = importSource({ sources: {}, objects: [] }, curvesSource('D346 actual line producer', [line]), 'Quadratic path');
  const id = direct.objects[0].id; direct = directOps.editCurvePole(direct, id, 1, { xMM: 20, yMM: 0 }); doc.direct = direct;
  return { doc, id };
}

test('quadratic planner: three ordinary curved references use true-curve offsets, owned results and legacy straight smoke control', () => {
  for (const reference of references) {
    const path = raw(reference), first = plan(reference, path), second = plan(reference, path);
    assert.notEqual(first, second); assert.notEqual(first.offsets, second.offsets); first.offsets.forEach((row, i) => assert.notEqual(row, second.offsets[i]));
    assert.deepEqual(first, second); assert.ok(first.offsets.every(row => path.controlPoints.every(p => p !== row)));
  }
  const line: RawNurbsPath = { degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[0, 0, 0], [10, 0, 0], [20, 0, 0]], weights: [1, 1, 1] };
  assert.deepEqual(planCurveFeaturePatternPath(line, 10, 3).offsets, [[0, 0, 0], [10, 0, 0], [20, 0, 0]]); assert.equal(curvePatternPathLength(line), 20);
  let getterCalls = 0;
  for (const field of ['degree', 'knots', 'controlPoints', 'weights']) {
    const accessor = { ...raw() };
    Object.defineProperty(accessor, field, { enumerable: true, get() { getterCalls++; return raw()[field as keyof RawNurbsPath]; } });
    assert.throws(() => planCurveFeaturePatternPath(accessor, 10, 3));
    assert.throws(() => curvePatternPathLength(accessor));
    assert.throws(() => resolveCurveFeaturePatternPath({}, accessor));
    assert.equal(getterCalls, 0);
  }
  const indexed = raw(), points = indexed.controlPoints as unknown as number[][];
  Object.defineProperty(points[1], '0', { enumerable: true, get() { getterCalls++; return 20; } });
  assert.throws(() => planCurveFeaturePatternPath(indexed, 10, 3));
  assert.throws(() => curvePatternPathLength(indexed)); assert.equal(getterCalls, 0);
  const liveAccessor = Object.defineProperty({}, 'objectId', { enumerable: true, get() { getterCalls++; return 'not-read'; } });
  assert.throws(() => resolveCurveFeaturePatternPath({}, liveAccessor)); assert.equal(getterCalls, 0);
  const oversized = { ...raw(), controlPoints: new Array(65) };
  Object.defineProperty(oversized.controlPoints, '0', { get() { getterCalls++; return [0, 0, 0]; } });
  assert.throws(() => curvePatternPathLength(oversized)); assert.equal(getterCalls, 0);
  // Complete old straight/cancellation/subnormal behavior is covered by retained D334 tests, not duplicated here.
});

test('quadratic raw Part: native material, constant finite Z/nonunit domain and owned inline recipe', () => {
  const seed = source(), before = seed.doc, path = raw(), patterned = seed.curveFeaturePattern({ path, spacing: 10, count: 3 }), accepted = patterned.doc;
  geometry(patterned, references[0]); assert.deepEqual(accepted.nodes.slice(0, -1), before.nodes);
  const mutable = path as unknown as { controlPoints: number[][] }; mutable.controlPoints[1][1] = 100; assert.deepEqual(patterned.doc, accepted); assert.deepEqual(seed.doc, before);
  const nonunit = raw(references[0], 3, [-2, 6]), shifted = source().curveFeaturePattern({ path: nonunit, spacing: 10, count: 3 });
  geometry(shifted, references[0]); const node = shifted.doc.nodes.at(-1); assert.ok(node?.kind === 'curve-feature-pattern'); assert.deepEqual(node.path, nonunit);
  assert.ok(plan(references[0], nonunit).offsets.every(offset => offset[2] === 0));
});

test('quadratic spacing binding: independent Decimal12/24 material guide and unchanged feature/source identity', () => {
  const seed = source(), patterned = seed.curveFeaturePattern({ path: raw(), spacing: param('spacing'), count: 3 }), before = patterned.doc;
  const edited = patterned.withParameters({ spacing: 12 }); geometry(edited, spacingGuide, 12); assert.deepEqual(patterned.doc, before);
  assert.equal(edited.doc.nodes.at(-1)!.id, before.nodes.at(-1)!.id); assert.deepEqual(edited.doc.nodes.slice(0, -1), before.nodes.slice(0, -1));
  const node = edited.doc.nodes.at(-1); assert.ok(node?.kind === 'curve-feature-pattern'); assert.deepEqual(node.spacing, { parameter: 'spacing' });
  const estimate = curvePatternPathLength(raw()), one = planCurveFeaturePatternPath(raw(), 1, 1); assert.equal(estimate, one.length.estimate);
  assert.throws(() => seed.curveFeaturePattern({ path: raw(), spacing: 10, count: param('copies') }), /PARAMETER_UNBINDABLE/);
  assert.throws(() => bindParameter(before, { feature: before.nodes.length - 1, value: 'count', parameter: 'copies' }), /PARAMETER_UNBINDABLE/);
});

test('quadratic live source: actual line producer/P1 edit, current-source recompute and exact translation identity', () => {
  const { doc, id } = liveSource(), patterned = part('live quadratic', doc).curveFeaturePattern({ path: { objectId: id }, spacing: 10, count: 3 }), accepted = patterned.doc, index = accepted.nodes.length - 1;
  geometry(patterned, references[0]); assert.deepEqual(resolveCurveFeaturePatternPath(accepted, { objectId: id }), raw());
  assert.equal(eligibleCurvePatternPaths(accepted).some(c => c.value === id), true);
  const edited = { ...accepted, direct: directOps.editCurvePole(accepted.direct!, id, 1, { yMM: 5 }) }; geometry(part('live P1', edited), references[2]);
  assert.deepEqual(affectedCurveFeaturePatterns(accepted, edited), [index]); assert.deepEqual(edited.nodes, accepted.nodes); assert.equal(edited.nextId, accepted.nextId);
  const moved = { ...edited, direct: directOps.move(edited.direct, [id], [3, 4, 0]) }; geometry(part('translated live', moved), references[2]); assert.deepEqual(moved.nodes, accepted.nodes);
  const unchanged = structuredClone(accepted); unchanged.direct!.objects[0].hidden = true; unchanged.direct!.objects[0].name = 'Same live quadratic'; assert.deepEqual(affectedCurveFeaturePatterns(accepted, unchanged), []); geometry(part('hidden rename', unchanged), references[0]);
  const field = editFields(accepted.nodes, index, accepted.parameters, undefined, { doc: accepted }).find(f => f.key === 'path'); assert.ok(field?.kind === 'choice'); assert.equal(field.get(accepted.nodes), id);
});

test('quadratic actual command: witness identity and pure source/selection atomicity; accepted App picks require separate browser proof', () => {
  const { doc, id } = liveSource(), withWitness = part('witness fixture', doc).box({ w: 12, d: 7, h: 5, x: 80, y: -3, z: 1 }).doc;
  const initial = evaluateDoc(withWitness, 0); assert.ok(initial.ok); const targetIndex = initial.bodies.findIndex(b => b.volume !== null && Math.abs(b.volume - 23850) <= positionBudget); assert.ok(targetIndex >= 0);
  const ctx: Ctx = { doc: withWitness, bodies: initial.bodies, selection: { faces: [], edges: [], bodies: [targetIndex] } }, before = structuredClone(ctx), command = commandById('curve-feature-pattern')!;
  const made = command.build!(ctx, { path: id, spacing: 10, count: 3 }); geometry(part('actual quadratic command', made), references[0]); assert.deepEqual(ctx, before);
  for (const edit of [{ spacing: 100, count: 3 }, { spacing: 0, count: 3 }, { spacing: 10, count: 65 }, { path: 'missing', spacing: 10, count: 1 }]) { assert.throws(() => command.build!(ctx, Object.assign({ path: id, spacing: 10, count: 3 }, edit))); assert.deepEqual(ctx, before); }
  // Pure command build retains its input context. It cannot prove successful Studio Apply clears stale indices.
});

test('quadratic file/wire: inline and base live paths preserve coefficients, IDs, names and existing nested-reference policy', async () => {
  const { doc, id } = liveSource(), live = part('native live quadratic', doc).curveFeaturePattern({ path: { objectId: id }, spacing: param('spacing'), count: 3 }).doc;
  const opened = await readStudioFile(encodeStudioFile(live)); assert.ok('doc' in opened); assert.deepEqual(opened.doc, live); geometry(part('native reopened', opened.doc), references[0]);
  const sender = new WireSender(), receiver = new WireReceiver(), wired = receiver.unpack(sender.pack(live)); sender.dispose(); assert.deepEqual(evaluatedPart(wired), evaluatedPart(live)); geometry(part('wire reopened', wired), references[0]);
  assert.match(curvePatternDocumentProblem({ nodes: [], parameters: {}, pendingParts: { child: { doc: live } } })!, /base document/); assert.throws(() => flattenAssembly(live), /base document/);
  const inline = source().curveFeaturePattern({ path: raw(), spacing: 10, count: 3 }).doc; assert.equal(curvePatternDocumentProblem({ nodes: [], parameters: {}, pendingParts: { child: { doc: inline } } }), null); geometry(part('flattened inline', flattenAssembly(inline)), references[0]);
});

test('quadratic refusals: unsupported rational/multispan/nonXY/cusp inputs and suppressed nested recipes cannot bypass count-one admission', t => {
  const base = raw(), bad: RawNurbsPath[] = [
    { ...base, weights: [1, .5, 1] },
    { ...base, controlPoints: [[0, 0, 0], [20, 0, 1], [20, 20, 0]] },
    { ...base, controlPoints: [[0, 0, 0], [0, 0, 0], [20, 20, 0]] },
    { ...base, controlPoints: [[0, 0, 0], [20, 0, 0], [10, 0, 0]] },
    { ...base, controlPoints: [[0, 0, 0], [20, 0, 0], [0, 0, 0]] },
    { degree: 2, knots: [0, 0, 0, 1, 1, 2, 2, 2], controlPoints: [[0, 0, 0], [20, 0, 0], [20, 20, 0], [20, 30, 0], [20, 40, 0]], weights: [1, 1, 1, 1, 1] },
  ];
  const seed = source(), before = seed.doc;
  for (const path of bad) {
    assert.throws(() => planCurveFeaturePatternPath(path, 10, 1)); assert.throws(() => seed.curveFeaturePattern({ path, spacing: 10, count: 1 })); assert.deepEqual(seed.doc, before);
  }
  const valid = source().curveFeaturePattern({ path: raw(), spacing: 10, count: 3 }).doc;
  for (const path of bad) {
    const invalid = structuredClone(valid), node = invalid.nodes.at(-1); assert.ok(node?.kind === 'curve-feature-pattern'); node.path = path; node.count = 1; node.suppressed = true;
    assert.ok(curvePatternDocumentProblem(invalid)); assert.ok('error' in readStudioDoc(JSON.stringify(invalid))); assert.ok(curvePatternDocumentProblem({ nodes: [], parameters: {}, pendingParts: { child: { doc: invalid } } }));
  }
  t.diagnostic('Core verifies the scalar/work certificate; this Model test covers typed profile and document admission.');
});

test('quadratic original CUT: count-one retains seed and still requires a current unsuppressed difference source', () => {
  const seed = source(), names = seed.select().faces().names().sort(), one = seed.curveFeaturePattern({ path: raw(), spacing: 10, count: 1 }); close(one.mass({ density: 1 }).volume, 23850); assert.deepEqual(one.select().faces().names().sort(), names);
  const doc = seed.doc; let difference = -1;
  for (let i = doc.nodes.length - 1; i >= 0; i--) if (doc.nodes[i].kind === 'difference') { difference = i; break; }
  assert.ok(difference >= 0);
  const suppressed = structuredClone(doc); suppressed.nodes[difference].suppressed = true; assert.throws(() => part('suppressed source', suppressed).curveFeaturePattern({ path: raw(), spacing: 10, count: 1 }));
  const consumed = withNode(doc, { kind: 'translate', parent: { node: difference, side: 'solid' }, offset: [1, 0, 0] }); assert.throws(() => part('consumed source', consumed).curveFeaturePattern({ path: raw(), spacing: 10, count: 1 }));
  assert.deepEqual(seed.doc, doc);
});
