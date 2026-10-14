// Frozen #1960 Pure18 ledger. Source-only: no CAD/native module may be imported.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1960-structure'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const source = resolve(root, 'packages/barocss-cad-editor/src/modeling-structure.ts');
const newPart = resolve(root, 'packages/barocss-cad-editor/src/modeling-rectangular-part.ts');
const built = await require('esbuild').build({ stdin: { contents: `export * from ${JSON.stringify(source)};export * from ${JSON.stringify(newPart)};`, resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
  plugins: [{ name: 'no-native', setup(build) { build.onResolve({ filter: /@barocss\/cad|barocss-cad\/|modeling-engine/ }, args => { throw Error('Native/runtime import prohibited: ' + args.path); }); } }] });
assert.deepEqual(Object.keys(built.metafile.inputs).filter(path => path !== '<stdin>').map(path => resolve(root, path)).sort(), [source, newPart].sort());
writeFileSync(resolve(output, 'structure.mjs'), built.outputFiles[0].text);
const api = await import(pathToFileURL(resolve(output, 'structure.mjs')));
const { canonicalModelingText: text, buildModelingStructure: build, getModelingStructureCapabilities: capabilities,
  modelingSourceBytes: bytes, modelingSourceBudget: budget, sameModelingStructure: same, createRectangularPartSource } = api;
const clone = value => structuredClone(value), parse = value => JSON.parse(value);
// Controlled authored summary identities, not measured native geometry or provider evidence.
function summary(value, revision = 1) {
  const d = typeof value === 'string' ? parse(value) : value;
  return { documentId: 'cad_model', revision, source: 'model', parameters: clone(d.parameters),
    features: d.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: node.kind === 'sketch' ? []
      : node.kind === 'extrude' ? [node.sketch] : node.kind === 'union' ? [node.left.node, node.right.node] : [node.parent.node, node.tool.node] })),
    outputs: Object.entries(d.outputs).map(([name, ref]) => ({ name, solidId: 'controlled_node' + ref.node, volumeMM3: null })) };
}
const base = parse(createRectangularPartSource({ width: '32', height: '8', thickness: '8' }));
base.nodes[0].min[0] = -0;
base.nodes[1].height = { op: 'add', left: { parameter: 'thickness' }, right: -0 };
const initial = text(base), initialSummary = summary(base);
const addInput = { kind: 'add-arm', target: capabilities(initial, initialSummary).addArm, x: -0, y: 0, width: 8, height: 24 };
const added = build(initial, initialSummary, addInput), pair = parse(added.text), pairSummary = summary(pair, 2);
const unionInput = { kind: 'union', targets: capabilities(added.text, pairSummary).union };
const joined = build(added.text, pairSummary, unionInput), union = parse(joined.text), unionSummary = summary(union, 3);
const slotInput = { kind: 'cut-slot', target: capabilities(joined.text, unionSummary).cutSlot, x: 16, y: 2, width: 8, height: 4 };
const cut = build(joined.text, unionSummary, slotInput), slotted = parse(cut.text);
const ledger = [];
function group(name, run) { run(); ledger.push(name); }
function refused(value) { const c = capabilities(text(value), summary(value)); assert.equal(c.addArm, null); assert.equal(c.union, null); assert.equal(c.cutSlot, null); assert.ok(c.reason); return c; }
function altered(value, change) { const copy = clone(value); change(copy); return copy; }

group('01 new-part2node admission', () => {
  assert.equal(base.nodes.length, 2); assert.deepEqual(capabilities(initial, initialSummary).addArm, { name: 'part', solidId: 'controlled_node1', node: 1 });
  assert.equal(capabilities(initial, initialSummary).sharedThickness, 8); assert.equal(capabilities(initial, initialSummary).union, null);
});
group('02 add4node/sharedheight', () => {
  assert.equal(pair.nodes.length, 4); assert.equal(added.selectedOutput, 'arm'); assert.deepEqual(added.consumed, []); assert.equal(added.kind, 'add-arm');
  assert.deepEqual(pair.nodes.slice(0, 2), base.nodes); assert.deepEqual(pair.nodes[3], { kind: 'extrude', sketch: 2, height: base.nodes[1].height });
  assert.deepEqual(Object.keys(pair.parameters).sort(), [...Object.keys(base.parameters), 'armX', 'armY', 'armWidth', 'armHeight'].sort());
  assert.deepEqual(pair.outputs, { part: { node: 1, side: 'solid' }, arm: { node: 3, side: 'solid' } });
  assert.equal(Object.hasOwn(pair.nodes[3], 'from'), false); assert.match(capabilities(initial, initialSummary).reason, /shared thickness changes both bodies/);
});
group('03 union5node/consumption', () => {
  assert.equal(union.nodes.length, 5); assert.deepEqual(union.nodes.slice(0, 4), pair.nodes); assert.deepEqual(union.parameters, pair.parameters);
  assert.deepEqual(union.nodes[4], { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  assert.deepEqual(union.outputs, { part: { node: 4, side: 'solid' } }); assert.deepEqual(joined.consumed, ['part', 'arm']); assert.equal(joined.selectedOutput, 'part');
});
group('04 cut8node/final-only', () => {
  assert.equal(slotted.nodes.length, 8); assert.deepEqual(slotted.nodes.slice(0, 5), union.nodes);
  assert.deepEqual(slotted.nodes[7], { kind: 'difference', parent: { node: 4, side: 'solid' }, tool: { node: 6, side: 'solid' } });
  assert.deepEqual(slotted.outputs, { part: { node: 7, side: 'solid' } }); assert.deepEqual(cut.consumed, ['part']); assert.equal(cut.selectedOutput, 'part');
  assert.deepEqual(slotted.nodes[6].height, base.nodes[1].height); assert.equal(Object.hasOwn(slotted.nodes[6], 'from'), false);
  assert.deepEqual(Object.keys(slotted.parameters).filter(k => k.startsWith('slot')).sort(), ['slotHeight', 'slotWidth', 'slotX', 'slotY']);
  assert.equal(capabilities(cut.text, summary(slotted)).cutSlot, null);
});
group('05 prefix/-0/canonical parity', () => {
  assert.ok(Object.is(pair.parameters.armX, -0)); assert.ok(Object.is(slotted.nodes[0].min[0], -0)); assert.ok(Object.is(slotted.nodes[1].height.right, -0));
  assert.deepEqual(parse(initial), base); assert.equal(text(parse(cut.text)), cut.text); assert.ok(cut.text.endsWith('\n'));
  assert.equal(text({ z: -0, a: [0, -0] }), '{"a":[0,-0],"z":-0}\n');
  const retained = parse(readFileSync(resolve(root, 'packages/barocss-cad/test/modeling-offset-evidence/baseline-transfer.json'), 'utf8'));
  assert.equal(text(parse(retained.text)), retained.text, 'actual retained provider save canonical parity; no native call');
  assert.deepEqual(base, parse(initial)); assert.deepEqual(initialSummary, summary(base)); assert.ok(Object.is(addInput.x, -0));
});
group('06 reversed target normalization', () => {
  const reverse = build(added.text, pairSummary, { kind: 'union', targets: [...unionInput.targets].reverse() });
  assert.deepEqual(reverse, joined); assert.deepEqual(reverse.consumed, ['part', 'arm']);
});
group('07 aliases/extras/stale IDs', () => {
  refused(altered(base, d => { d.outputs.alias = clone(d.outputs.part); }));
  refused(altered(pair, d => { d.outputs.alias = clone(d.outputs.arm); }));
  refused(altered(union, d => { d.outputs.arm = { node: 3, side: 'solid' }; }));
  refused(altered(pair, d => { d.outputs.arm = { node: 1, side: 'solid' }; }));
  assert.throws(() => build(initial, initialSummary, { ...addInput, target: { ...addInput.target, solidId: 'old_id' } }), /stale/);
  assert.throws(() => build(added.text, pairSummary, { kind: 'union', targets: [unionInput.targets[0], unionInput.targets[0]] }), /stale/);
  assert.throws(() => build(initial, { ...initialSummary, parameters: { ...initialSummary.parameters, width: 31 } }, addInput), /parameters/);
  assert.throws(() => build(initial, altered(initialSummary, s => { s.features[1].dependencies = []; }), addInput), /ownership/);
  assert.throws(() => build(added.text, altered(pairSummary, s => { s.outputs[1].solidId = s.outputs[0].solidId; }), unionInput), /distinct/);
});
group('08 legacy/unsupported graph', () => {
  const none = capabilities(initial, { ...initialSummary, source: 'legacy' }); assert.equal(none.addArm, null); assert.match(none.reason, /primary/);
  assert.equal(capabilities('{"format":"barocss-xy-affine-prism-feature-document","version":2}', initialSummary).addArm, null);
  refused(altered(base, d => { d.nodes[0] = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 8 }; }));
  refused(altered(pair, d => { d.nodes[3].height = 8; }));
  refused(altered(union, d => { d.nodes[4].left.node = 3; d.nodes[4].right.node = 1; }));
  const finished = altered(base, d => { d.nodes.push({ kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: {}, distance: 1 }); });
  assert.equal(capabilities(text(finished), initialSummary).addArm, null);
});
group('09 own descriptor/accessor refusal', () => {
  let reads = 0;
  const getter = Object.defineProperty({}, 'x', { enumerable: true, get() { reads++; return 0; } });
  assert.throws(() => text(getter), /own data/); assert.throws(() => build(initial, initialSummary, { ...addInput, target: getter }), /own data/);
  assert.equal(capabilities(initial, Object.defineProperty(clone(initialSummary), 'source', { get() { reads++; return 'model'; } })).addArm, null);
  assert.throws(() => text({ [Symbol('hidden')]: 1 }), /own data/); assert.throws(() => text(Object.create({ inherited: 1 })), /prototype/);
  const sparse = [0, 1]; delete sparse[0]; assert.throws(() => text(sparse), /dense/); const cycle = {}; cycle.self = cycle; assert.throws(() => text(cycle), /acyclic/);
  assert.throws(() => text(Object.defineProperty({}, 'a', { value: 1, enumerable: false })), /own data/);
  assert.equal(reads, 0); assert.throws(() => budget(Object.defineProperty([], '0', { get() { reads++; return 1; }, enumerable: true }), 0, []), /own data/); assert.equal(reads, 0);
});
group('10 parameter/name collisions/count', () => {
  for (const key of ['armX', 'armY', 'armWidth', 'armHeight']) refused(altered(base, d => { d.parameters[key] = 1; }));
  for (const key of ['slotX', 'slotY', 'slotWidth', 'slotHeight']) refused(altered(union, d => { d.parameters[key] = 1; }));
  refused(altered(base, d => { d.outputs.arm = d.outputs.part; delete d.outputs.part; }));
  const maximum = altered(base, d => { for (let i = 0; i < 9; i++) d.parameters['spare' + i] = i; });
  assert.equal(Object.keys(parse(build(text(maximum), summary(maximum), { ...addInput, target: capabilities(text(maximum), summary(maximum)).addArm }).text).parameters).length, 16);
  refused(altered(maximum, d => { d.parameters.oneTooMany = 1; }));
  const badName = altered(base, d => { d.parameters.constructor = 1; }); refused(badName);
  const tooMany = Object.fromEntries(Array.from({ length: 17 }, (_, i) => ['p' + i, i])); assert.throws(() => text(tooMany), /bounded/);
});
group('11 signed safe-integer corners', () => {
  const negative = build(initial, initialSummary, { ...addInput, x: -8, y: -16 });
  assert.equal(parse(negative.text).parameters.armX, -8); assert.equal(parse(negative.text).parameters.armY, -16);
  for (const x of [0.5, Number.MAX_SAFE_INTEGER, Number.NaN, Infinity]) assert.throws(() => build(initial, initialSummary, { ...addInput, x }));
  refused(altered(base, d => { d.nodes[0].min[0] = 0.5; }));
  assert.ok(Object.is(parse(added.text).parameters.armX, -0));
});
group('12 positive spans/bounds', () => {
  for (const width of [0, -0, -1, 10001, 0.5]) assert.throws(() => build(initial, initialSummary, { ...addInput, width }));
  for (const height of [0, -1, 10001]) assert.throws(() => build(joined.text, unionSummary, { ...slotInput, height }));
  assert.throws(() => build(initial, initialSummary, { ...addInput, x: 9999, width: 2 }), /10000/);
  refused(altered(base, d => { d.nodes[0].min[0] = -10000; d.nodes[0].max[0] = 10000; }));
  refused(altered(base, d => { d.parameters.thickness = 0; }));
  const edge = build(initial, initialSummary, { ...addInput, x: -10000, y: 9999, width: 10000, height: 1 }); assert.equal(parse(edge.text).parameters.armWidth, 10000);
});
group('13 thickness8/omitted-from Cut capability', () => {
  const thick = altered(union, d => { d.parameters.thickness = 9; });
  assert.match(refused(thick).reason, /exactly 8/); assert.throws(() => build(text(thick), summary(thick), slotInput), /exactly 8/);
  const thickPair = altered(pair, d => { d.parameters.thickness = 9; }); assert.ok(capabilities(text(thickPair), summary(thickPair)).union);
  for (const graph of [base, pair, union]) for (const i of graph.nodes.map((n, i) => n.kind === 'extrude' ? i : -1).filter(i => i >= 0)) {
    refused(altered(graph, d => { d.nodes[i].from = 0; }));
  }
  assert.equal(capabilities(joined.text, unionSummary).sharedThickness, 8);
});
group('14 malformed/derived inputs', () => {
  for (const value of ['', '{', 'null', '[]', '3']) assert.equal(capabilities(value, initialSummary).addArm, null);
  for (const expression of [{ parameter: 'missing' }, { op: 'multiply', left: 1, right: 8 }, { op: 'scale', value: 8, factor: '1' },
    { op: 'add', left: 10000, right: 1 }, { parameter: 'thickness', extra: 0 }]) refused(altered(base, d => { d.nodes[1].height = expression; }));
  let deep = { parameter: 'thickness' }; for (let i = 0; i < 6; i++) deep = { op: 'add', left: deep, right: 0 };
  refused(altered(base, d => { d.nodes[1].height = deep; }));
  const derived = altered(base, d => { d.nodes[1].height = { op: 'scale', value: { parameter: 'thickness' }, factor: 1 }; });
  assert.ok(capabilities(text(derived), summary(derived)).addArm);
  assert.throws(() => build(initial, initialSummary, { ...addInput, width: '8' }), /finite/);
  assert.throws(() => build(initial, initialSummary, { ...addInput, extra: true }), /exact fields/);
});
group('15 byte+character bounds', () => {
  assert.equal(bytes('a'.repeat(65536)), 65536); assert.throws(() => bytes('a'.repeat(65537)), /characters/);
  assert.equal(bytes('é'.repeat(32768)), 65536); assert.throws(() => bytes('é'.repeat(32769)), /UTF-8/); assert.throws(() => bytes(null));
  assert.equal(capabilities(initial + ' '.repeat(65536), initialSummary).addArm, null);
  const multibyte = Object.fromEntries(Array.from({ length: 16 }, (_, i) => ['k' + i, Array(64).fill('界'.repeat(64))]));
  assert.throws(() => text(multibyte), /64 KiB/); assert.throws(() => text('a'.repeat(129)), /string budget/);
});
group('16 no intermediate6/7 admission', () => {
  for (const count of [6, 7]) {
    const partial = altered(slotted, d => { d.nodes = d.nodes.slice(0, count); d.outputs = { part: { node: 4, side: 'solid' } }; });
    assert.match(refused(partial).reason, /6\/7-node/); assert.throws(() => build(text(partial), summary(partial), slotInput), /6\/7-node/);
  }
  assert.deepEqual([base, pair, union, slotted].map(d => d.nodes.length), [2, 4, 5, 8]);
});
group('17 structural identity versus same maps', () => {
  assert.deepEqual(pair.parameters, union.parameters); assert.equal(same(added.text, joined.text), false);
  assert.equal(same(initial, text(altered(base, d => { d.parameters.width = 40; }))), true);
  assert.equal(same(initial, text(altered(base, d => { d.parameters.extra = 0; }))), false);
  assert.equal(same(initial, text(altered(base, d => { d.nodes[0].min[0] = 0; }))), false);
  assert.equal(same(initial, text(altered(base, d => { d.outputs.renamed = d.outputs.part; delete d.outputs.part; }))), false);
  const named = altered(base, d => { d.nodes.push({ kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: {}, distance: 1, name: 'finish', suppressed: false }); d.outputs.part.node = 2; });
  assert.equal(same(text(named), text(altered(named, d => { d.nodes[2].suppressed = true; }))), true);
  assert.equal(same(text(named), text(altered(named, d => { d.nodes[2].suppressed = 1; }))), false);
  assert.equal(same(initial, 'null'), false); assert.equal(same(text({ ...base, nodes: [{ kind: 'unknown' }] }), text({ ...base, nodes: [{ kind: 'unknown' }] })), false);
});
group('18 aggregate source accounting synthetic boundary', () => {
  // Synthetic byte arithmetic, not a realistic near-limit model or native RSS claim.
  const limit = 8 * 1024 * 1024;
  assert.equal(budget([limit - 3], 1, [1, 1]), limit); assert.throws(() => budget([limit - 3], 1, [1, 2]), /8 MiB/);
  assert.equal(budget([100, 100], 100, [100, 100]), 500, 'every retained duplicate slot is charged');
  assert.equal(budget(Array(20).fill(65536), 65536, [65536, 65536]), 23 * 65536);
  for (const invalid of [-1, -0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) assert.throws(() => budget([], invalid, []));
  assert.throws(() => budget(Array(21).fill(0), 0, [])); assert.throws(() => budget([], 0, Array(65).fill(0)));
  assert.equal(budget([bytes(initial), bytes(added.text)], bytes(joined.text), [bytes(cut.text), bytes(joined.text)]),
    bytes(initial) + bytes(added.text) + 2 * bytes(joined.text) + bytes(cut.text));
});
assert.equal(ledger.length, 18);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const result = { ok: true, groups: ledger.length, ledger, nativeCalls: 0, inventories: [2, 4, 5, 8],
  sourceHashes: Object.fromEntries([source, newPart, import.meta.filename].map(path => [path.slice(root.length + 1), hash(path)])),
  scope: 'Pure authored commands, exact source identity and synthetic byte arithmetic; controlled summaries, no native geometry or renderer qualification' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
