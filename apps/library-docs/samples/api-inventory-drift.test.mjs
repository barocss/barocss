// R7.6 independent static fixtures. SOURCE ONLY: not executed during preparation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { collectApiInventory } from '../scripts/api-inventory.mjs';
import { checkInventory, canonicalJSON } from '../scripts/api-inventory-policy.mjs';

const ts = createRequire(join(process.cwd(), 'package.json'))('typescript');
const sourceCore = [
  'export interface CadPartOutput { readonly id: string; readonly bodyCount: number; }',
  'export interface CadPartSnapshot { readonly outputs: readonly CadPartOutput[]; }',
].join('\n');
function fixture(root = '/r76-fixture/one') {
  const files = new Map();
  const set = (file, value) => { files.set(resolve(root, file), typeof value === 'string' ? value : JSON.stringify(value)); };
  set('packages/barocss-cad/package.json', { name: '@barocss/cad', exports: { '.': './src/index.ts', './api': './src/api/index.ts', './internal/native-si-mass': './src/internal/native-si-mass.ts' } });
  set('packages/barocss-cad/src/index.ts', sourceCore);
  set('packages/barocss-cad/src/api/index.ts', 'export class Part { get doc(): { count: number } { return { count: 1 }; } extrude(): Part { return new Part(); } } export function part(): Part { return new Part(); }');
  set('packages/barocss-cad/src/internal/native-si-mass.ts', 'export interface NativeMass { massKG: number; inertiaKgM2: readonly number[]; }');
  set('packages/barocss-cad-model/package.json', { name: '@barocss/cad-model', exports: { './samples/*': './samples/*', './*': './src/*.ts', './*.json': './src/*.json' } });
  set('packages/barocss-cad-model/src/index.ts', 'export interface ModelInfo { readonly id: string; }');
  set('packages/barocss-cad-model/src/robot/native/duty.ts', 'export interface NativeDuty { angleRad: number; life_h: number; }');
  set('packages/barocss-cad-model/src/robot/public.ts', 'export interface PublicDuty { angle: number; serviceLife: number; }');
  set('packages/barocss-cad-model/src/config.json', { format: 'fixture-data', value: 17 });
  set('packages/barocss-cad-model/samples/example.json', { id: 'independent-fixture' });
  set('packages/barocss-gpu/package.json', { name: '@barocss/gpu', exports: { '.': { types: './src/index.ts', import: './src/index.ts' }, './source': { types: './src/index.ts', import: './src/index.ts' }, './api': './src/api/index.ts' } });
  set('packages/barocss-gpu/src/index.ts', 'export interface SceneData { readonly value: number; }');
  set('packages/barocss-gpu/src/api/index.ts', 'export class Scene { readonly data = { value: 1 }; add(): Scene { return new Scene(); } }');
  const io = {
    virtual: true,
    read(file) { return files.get(resolve(file)); },
    files(directory) { const prefix = resolve(directory) + '/'; return [...files.keys()].filter(p => p.startsWith(prefix)).sort(); },
  };
  return { root, files, set, io, collect: () => collectApiInventory({ repo: root, ts, io }) };
}
const hasRule = (result, rule) => result.issues.some(i => i.rule === rule);
const assertClean = c => assert.deepEqual(c.issues, [], JSON.stringify(c.issues));
const exposure = (c, pkg, subpath, name) => c.data.exposures.find(e => e.package === pkg && e.subpath === subpath && e.exportName === name);

test('P1: the two readonly core results have no direct callable declarations', () => {
  const c = fixture().collect(); assertClean(c);
  assert.deepEqual(c.data.coreResultChecks.map(r => r.exportName), ['CadPartOutput', 'CadPartSnapshot']);
  assert.ok(c.data.coreResultChecks.every(r => r.directMembers.every(m => m.kind === 'property')));
  assert.ok(c.notProven.some(s => s.includes('nested')));
});
test('N1: a missing explicit source target is EX002, with no dist fallback', () => {
  const f = fixture(); f.set('packages/barocss-cad/package.json', { name: '@barocss/cad', exports: { '.': './src/missing.ts' } });
  const c = f.collect(); assert.ok(hasRule(c, 'EX002'));
  assert.ok(c.issues.some(i => i.target === './src/missing.ts'));
});
test('N2: each unresolved named/star/default re-export fails independently', async t => {
  for (const [name, statement] of [
    ['named', 'export { missing } from "./present.js";'],
    ['star', 'export * from "./absent.js";'],
    ['default', 'export { default } from "./absent.js";'],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-cad/src/index.ts', sourceCore + '\n' + statement);
    f.set('packages/barocss-cad/src/present.ts', 'export const available = 1;');
    assert.ok(hasRule(f.collect(), 'EX003'));
  });
});
test('N3: unsupported fallback/condition/escaping targets are explicit EX001', async t => {
  for (const [name, exports] of [
    ['array', { '.': ['./src/index.ts'] }],
    ['condition', { '.': { custom: './src/index.ts' } }],
    ['escape', { '.': './../outside.ts' }],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-cad/package.json', { name: '@barocss/cad', exports });
    assert.ok(hasRule(f.collect(), 'EX001'));
  });
});
test('P2: GPU source alias retains two exposures of one declaration; removal drifts', () => {
  const f = fixture(), before = f.collect(); assertClean(before);
  const main = exposure(before, '@barocss/gpu', '.', 'SceneData');
  const alias = exposure(before, '@barocss/gpu', './source', 'SceneData');
  assert.ok(main && alias);
  assert.deepEqual(main.variants[0].target, alias.variants[0].target);
  assert.equal(before.data.exposures.filter(e => e.package === '@barocss/gpu' && e.exportName === 'SceneData').length, 2);
  f.set('packages/barocss-gpu/package.json', { name: '@barocss/gpu', exports: { '.': './src/index.ts', './api': './src/api/index.ts' } });
  assert.ok(hasRule(checkInventory(f.collect(), before.data), 'IV001'));
});
test('P3: wildcard native paths and more specific JSON/explicit keys are retained', () => {
  const f = fixture(), c = f.collect(); assertClean(c);
  assert.ok(exposure(c, '@barocss/cad-model', './robot/native/duty', 'NativeDuty'));
  const data = exposure(c, '@barocss/cad-model', './config.json', null);
  assert.equal(data.space, 'asset'); assert.equal(data.variants[0].target.file, 'src/config.json');
  const pkg = c.data.packageExports.find(p => p.package === '@barocss/gpu');
  assert.deepEqual(pkg.entries.find(e => e.key === '.').leaves.map(l => l.conditions), [['types'], ['import']]);
});
test('N4: adding a core result method fails even with a matching expected snapshot', () => {
  const f = fixture(); f.set('packages/barocss-cad/src/index.ts', sourceCore.replace('readonly id: string;', 'massProperties(): number; readonly id: string;'));
  const c = f.collect(); assert.ok(hasRule(c, 'DA001'));
  assert.ok(hasRule(checkInventory(c, c.data), 'DA001'));
});
test('N5: a getter and optional callback are separate direct-result failures', async t => {
  await t.test('getter', () => {
    const f = fixture(); f.set('packages/barocss-cad/src/index.ts', 'export interface CadPartOutput { readonly id: string; } export class CadPartSnapshot { get save(): string { return ""; } }');
    const c = f.collect(); assert.ok(hasRule(c, 'DA001'));
    assert.ok(c.data.coreResultChecks.find(r => r.exportName === 'CadPartSnapshot').directMembers.some(m => m.kind === 'getter'));
  });
  await t.test('optional callback', () => {
    const f = fixture(); f.set('packages/barocss-cad/src/index.ts', sourceCore.replace('readonly outputs:', 'onSaved?: () => void; readonly outputs:'));
    const c = f.collect(); assert.ok(hasRule(c, 'DA001'));
    assert.ok(c.data.coreResultChecks.find(r => r.exportName === 'CadPartSnapshot').directMembers.some(m => m.kind === 'callback'));
  });
});
test('N6: missing/any/unknown anchors cannot pass as empty data', async t => {
  for (const [name, declaration] of [
    ['missing', ''], ['any', 'export type CadPartSnapshot = any;'], ['unknown', 'export type CadPartSnapshot = unknown;'],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-cad/src/index.ts', 'export interface CadPartOutput { id: string; }\n' + declaration);
    assert.ok(hasRule(f.collect(), 'DA001'));
  });
});
test('P4: facade methods/doc getter stay visible and do not become core results', () => {
  const c = fixture().collect(); assertClean(c);
  const part = exposure(c, '@barocss/cad', './api', 'Part');
  assert.ok(part.variants[0].shape.members.some(m => m.name === 'doc' && m.kind === 'getter'));
  assert.ok(part.variants[0].shape.members.some(m => m.name === 'extrude' && m.kind === 'method'));
  assert.ok(c.notProven.some(s => s.includes('immutability')));
});
test('P5: callback/resource/Error are distinct observations, not general JSON approval', () => {
  const f = fixture();
  f.set('packages/barocss-gpu/src/index.ts', 'export interface Options { onChange?: (value: number) => void; } export class Viewer { update(): void {} } export class BarocssError extends Error { code: string = "FIXTURE"; }');
  const c = f.collect(); assertClean(c);
  const options = exposure(c, '@barocss/gpu', '.', 'Options');
  assert.ok(options.variants[0].shape.members.some(m => m.kind === 'callback'));
  assert.equal(exposure(c, '@barocss/gpu', '.', 'Viewer').variants[0].target.kind, 'class');
  assert.equal(exposure(c, '@barocss/gpu', '.', 'BarocssError').variants[0].shape.role, 'Error-observed');
});
test('P6: explicit native and public canonical units stay visible without numeric certification', () => {
  const c = fixture().collect(); assertClean(c);
  assert.ok(exposure(c, '@barocss/cad', './internal/native-si-mass', 'NativeMass'));
  const native = exposure(c, '@barocss/cad-model', './robot/native/duty', 'NativeDuty');
  const canonical = exposure(c, '@barocss/cad-model', './robot/public', 'PublicDuty');
  assert.ok(native.variants[0].shape.members.some(m => m.name === 'life_h'));
  assert.ok(canonical.variants[0].shape.members.some(m => m.name === 'serviceLife'));
  assert.ok(c.notProven.some(s => s.includes('numeric')));
});
test('N7: symbol/signature/alias differences and NOTGENERATED are IV001', () => {
  const c = fixture().collect(); assertClean(c);
  for (const expected of [
    undefined, { schemaVersion: 1, policyVersion: 1, status: 'NOTGENERATED' },
    { ...c.data, exposures: c.data.exposures.slice(1) },
    { ...c.data, typescriptVersion: 'different-compiler' },
    { schemaVersion: 1, policyVersion: 1, exposures: [], packageExports: [], coreResultChecks: [] },
  ]) assert.ok(hasRule(checkInventory(c, expected), 'IV001'));
  const f = fixture(), before = f.collect();
  f.set('packages/barocss-gpu/src/index.ts', 'export interface SceneData { readonly value: string; }');
  const drift = checkInventory(f.collect(), before.data);
  assert.ok(hasRule(drift, 'IV001'));
  assert.ok(drift.issues.find(i => i.rule === 'IV001').path.startsWith('$'));
});
test('N8: glob/private/native/stale/shape exceptions cannot waive a rule', () => {
  const c = fixture().collect();
  for (const entry of [
    { module: '*' }, { module: 'private/*' }, { module: 'robot/native/*' },
    { module: '@barocss/cad', exportName: 'CadPartOutput', ruleId: 'DA001', currentShape: 'stale' },
  ]) assert.ok(hasRule(checkInventory(c, c.data, [entry]), 'IV002'));
});
test('P7: equal fixture sources under different roots have byte-identical canonical output', () => {
  const first = fixture('/r76-fixture/alpha'), second = fixture('/another-location/beta');
  const files = second.io.files; second.io.files = directory => files(directory).reverse();
  const map = JSON.parse(second.io.read(join(second.root, 'packages/barocss-cad/package.json')));
  map.exports = Object.fromEntries(Object.entries(map.exports).reverse());
  second.set('packages/barocss-cad/package.json', map);
  const a = first.collect(), b = second.collect();
  assertClean(a); assertClean(b); assert.equal(canonicalJSON(a.data), canonicalJSON(b.data));
  assert.equal(canonicalJSON(a.data).includes('/r76-fixture/alpha'), false);
  assert.equal(canonicalJSON(a.data).includes('"generated"'), false);
});
test('P8: ordinary absolute-looking string literals are not import-path-normalized', () => {
  const f = fixture('/r76-fixture/alpha');
  f.set('packages/barocss-gpu/src/index.ts', 'export type Literal = "/r76-fixture/alpha/keep-this-literal";');
  const c = f.collect(); assertClean(c);
  assert.ok(exposure(c, '@barocss/gpu', '.', 'Literal').variants[0].shape.type.includes('/r76-fixture/alpha/keep-this-literal'));
});
test('N9: valid cyclic re-exports terminate, unresolved names still fail', () => {
  const f = fixture();
  f.set('packages/barocss-cad/src/index.ts', sourceCore + '\nexport * from "./a.js";');
  f.set('packages/barocss-cad/src/a.ts', 'export const a = 1; export * from "./b.js";');
  f.set('packages/barocss-cad/src/b.ts', 'export const b = 2; export * from "./a.js";');
  assertClean(f.collect());
  f.set('packages/barocss-cad/src/b.ts', 'export { missing } from "./a.js";');
  assert.ok(hasRule(f.collect(), 'EX003'));
});
test('P9: matching baseline never suppresses a hard failure or claims full conformance', () => {
  const f = fixture(); f.set('packages/barocss-cad/src/index.ts', sourceCore.replace('readonly id: string;', 'save(): string; readonly id: string;'));
  const c = f.collect(), result = checkInventory(c, c.data);
  assert.equal(result.status, 'FAIL'); assert.ok(hasRule(result, 'DA001'));
  assert.ok(result.notProven.some(s => s.includes('NOT_PROVEN')));
  const good = fixture().collect(), scoped = checkInventory(good, good.data);
  assert.equal(scoped.status, 'SCOPED_PASS');
  assert.ok(scoped.notProven.some(s => s.includes('§§1–12')));
});

test('R76-01: direct, star, chained and local-import type-only routes lose value exposure', async t => {
  for (const [name, statement, bridge] of [
    ['direct', 'export type { C } from "./classes.js";'],
    ['specifier', 'export { type C } from "./classes.js";'],
    ['star', 'export type * from "./classes.js";'],
    ['chain', 'export * from "./bridge.js";', 'export type { C } from "./classes.js";'],
    ['type-star-chain', 'export * from "./bridge.js";', 'export type * from "./classes.js";'],
    ['local-import', 'import type { C } from "./classes.js"; export { C };'],
  ]) await t.test(name, () => {
    const f = fixture();
    f.set('packages/barocss-gpu/src/classes.ts', 'export class C { readonly value: number = 1; }');
    if (bridge) f.set('packages/barocss-gpu/src/bridge.ts', bridge);
    f.set('packages/barocss-gpu/src/index.ts', 'export { C } from "./classes.js";');
    const before = f.collect(); assertClean(before);
    assert.equal(exposure(before, '@barocss/gpu', '.', 'C').space, 'type+value');
    f.set('packages/barocss-gpu/src/index.ts', statement);
    const after = f.collect(); assertClean(after);
    assert.equal(exposure(after, '@barocss/gpu', '.', 'C').space, 'type');
    assert.ok(hasRule(checkInventory(after, before.data), 'IV001'));
  });
  await t.test('independent value star restores value space', () => {
    const f = fixture();
    f.set('packages/barocss-gpu/src/classes.ts', 'export class C {}');
    f.set('packages/barocss-gpu/src/bridge.ts', 'export { C } from "./classes.js";');
    f.set('packages/barocss-gpu/src/index.ts', 'export type * from "./classes.js"; export * from "./bridge.js";');
    const c = f.collect(); assertClean(c);
    assert.equal(exposure(c, '@barocss/gpu', '.', 'C').space, 'type+value');
  });
});

test('R76-02: typeof, import types and later merged declarations fail EX003 independently', async t => {
  for (const [name, source] of [
    ['typeof', 'export type Broken = typeof missingValue;'],
    ['import module', 'export type Broken = import("./absent.js").T;'],
    ['import namespace', 'export type Broken = typeof import("./absent.js");'],
    ['import member', 'export type Broken = import("./present.js").Missing;'],
    ['merged interface', 'export interface M { ok: number; } export interface M { broken: typeof missingValue; }'],
    ['merged namespace', 'export namespace M { export interface A { ok: number; } } export namespace M { export type Broken = import("./absent.js").T; }'],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-gpu/src/index.ts', source);
    f.set('packages/barocss-gpu/src/present.ts', 'export interface Present { value: number; }');
    const c = f.collect(); assert.ok(hasRule(c, 'EX003'), JSON.stringify(c.issues));
    assert.ok(hasRule(checkInventory(c, c.data), 'EX003'));
  });
  await t.test('resolved query/import types and implementation-only unresolved names', () => {
    const f = fixture();
    f.set('packages/barocss-gpu/src/present.ts', 'export interface Present { value: number; }');
    f.set('packages/barocss-gpu/src/index.ts', 'declare const known: number; export type Query = typeof known; export type Imported = import("./present.js").Present; export function safe(): number { return missingBodyOnly; }');
    assertClean(f.collect());
  });
});

test('R76-03: direct and inherited callable indexes/methods/accessors cannot pass DA001', async t => {
  for (const [name, snapshot] of [
    ['string callable index', 'export interface CadPartSnapshot { [key: string]: () => void; }'],
    ['number callable index', 'export interface CadPartSnapshot { [key: number]: (n: number) => number; }'],
    ['inherited callable index', 'interface Base { [key: string]: () => void; } export interface CadPartSnapshot extends Base {}'],
    ['inherited method', 'interface Base { save(): string; } export interface CadPartSnapshot extends Base {}'],
    ['inherited getter', 'declare class Base { get save(): string; } export interface CadPartSnapshot extends Base {}'],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-cad/src/index.ts', 'export interface CadPartOutput { readonly id: string; }\n' + snapshot);
    const c = f.collect(); assert.ok(hasRule(c, 'DA001'));
    assert.ok(hasRule(checkInventory(c, c.data), 'DA001'));
    if (name.includes('index')) assert.ok(c.data.coreResultChecks.find(r => r.exportName === 'CadPartSnapshot').indexSignatures.some(i => i.callable));
  });
  await t.test('readonly scalar index remains data', () => {
    const f = fixture();
    f.set('packages/barocss-cad/src/index.ts', 'export interface CadPartOutput { readonly id: string; } export interface CadPartSnapshot { readonly [key: string]: number; }');
    const c = f.collect(); assertClean(c);
    assert.ok(c.data.coreResultChecks.find(r => r.exportName === 'CadPartSnapshot').indexSignatures.every(i => i.readonly && !i.callable));
  });
});

test('R76-04: generic constraints/defaults, namespace exports and aliases each cause structural drift', async t => {
  for (const [name, beforeSource, afterSource] of [
    ['interface constraint', 'export interface Box<T extends string> { value: T; }', 'export interface Box<T extends number> { value: T; }'],
    ['interface default', 'export interface Box<T = string> { value: T; }', 'export interface Box<T = number> { value: T; }'],
    ['class constraint', 'export class Box<T extends string> { value!: T; }', 'export class Box<T extends number> { value!: T; }'],
    ['alias default', 'export type Box<T = string> = readonly T[];', 'export type Box<T = number> = readonly T[];'],
    ['namespace field', 'export namespace N { export interface Row { value: number; } }', 'export namespace N { export interface Row { value: string; } }'],
    ['namespace added name', 'export namespace N { export interface Row {} }', 'export namespace N { export interface Row {} export type Added = number; }'],
    ['merged namespace', 'export namespace N { export interface Row {} } export namespace N { export type Tag = "a"; }', 'export namespace N { export interface Row {} } export namespace N { export type Tag = "b"; }'],
    ['namespace re-export', 'export * as N from "./present.js";', 'export type * as N from "./present.js";'],
    ['alias literal union', 'export type Tag = "a" | "b";', 'export type Tag = "a" | "c";'],
    ['alias target', 'export type Tag = string;', 'export type Tag = number;'],
    ['alias referenced union', 'type Hidden = "a" | "b"; export type Tag = Hidden;', 'type Hidden = "a" | "c"; export type Tag = Hidden;'],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-gpu/src/present.ts', 'export interface Row { value: number; }');
    f.set('packages/barocss-gpu/src/index.ts', beforeSource);
    const before = f.collect(); assertClean(before);
    f.set('packages/barocss-gpu/src/index.ts', afterSource);
    const after = f.collect(); assertClean(after);
    assert.ok(hasRule(checkInventory(after, before.data), 'IV001'));
  });
  await t.test('namespace implementation bodies do not enter canonical signatures', () => {
    const f = fixture();
    f.set('packages/barocss-gpu/src/index.ts', 'export namespace N { export function value(): number { return 1; } function hidden(): number { return 7; } }');
    const before = f.collect(); assertClean(before);
    f.set('packages/barocss-gpu/src/index.ts', 'export namespace N { export function value(): number { const local = 2; return local; } function hidden(): number { return missingBodyOnly; } }');
    const after = f.collect(); assertClean(after);
    assert.equal(canonicalJSON(after.data), canonicalJSON(before.data));
  });
});

test('R76 policy regression: condition priority and null shadow retain distinct semantics', () => {
  const f = fixture(), before = f.collect(); assertClean(before);
  const gpu = JSON.parse(f.io.read(join(f.root, 'packages/barocss-gpu/package.json')));
  gpu.exports['.'] = { import: './src/index.ts', types: './src/index.ts' };
  f.set('packages/barocss-gpu/package.json', gpu);
  const after = f.collect(); assertClean(after);
  assert.ok(hasRule(checkInventory(after, before.data), 'IV001'));
  const model = JSON.parse(f.io.read(join(f.root, 'packages/barocss-cad-model/package.json')));
  model.exports['./robot/native/*'] = null;
  f.set('packages/barocss-cad-model/package.json', model);
  const blocked = f.collect(); assertClean(blocked);
  assert.equal(exposure(blocked, '@barocss/cad-model', './robot/native/duty', 'NativeDuty'), undefined);
  assert.ok(exposure(blocked, '@barocss/cad-model', './robot/public', 'PublicDuty'));
  assert.ok(hasRule(checkInventory(blocked, after.data), 'IV001'));
});

test('serializer: empty tuple aliases and readonly property tuples stay exact and drift independently', async t => {
  for (const [name, source, changed, inspect] of [
    ['alias', 'export type Empty = [];', 'export type Empty = [number];', c => exposure(c, '@barocss/gpu', '.', 'Empty').variants[0].shape.type],
    ['readonly alias', 'export type Empty = readonly [];', 'export type Empty = readonly [number];', c => exposure(c, '@barocss/gpu', '.', 'Empty').variants[0].shape.type],
    ['document properties', 'export interface Document { features: []; parameters: []; }', 'export interface Document { features: [number]; parameters: []; }', c => exposure(c, '@barocss/gpu', '.', 'Document').variants[0].shape.members.find(m => m.name === 'features').type],
    ['readonly property', 'export interface Document { readonly features: readonly []; }', 'export interface Document { readonly features: readonly [number]; }', c => exposure(c, '@barocss/gpu', '.', 'Document').variants[0].shape.members.find(m => m.name === 'features').type],
    ['intersection property', 'interface Saved { readonly tag: "wire"; } export interface Wire { doc: Saved & { nodes: [] }; }', 'interface Saved { readonly tag: "wire"; } export interface Wire { doc: Saved & { nodes: [number] }; }', c => exposure(c, '@barocss/gpu', '.', 'Wire').variants[0].shape.members.find(m => m.name === 'doc').type],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-gpu/src/index.ts', source);
    const before = f.collect(); assertClean(before);
    assert.match(inspect(before), /\[\]/);
    assert.doesNotMatch(inspect(before), /\bany\b/);
    if (name.includes('readonly')) assert.match(inspect(before), /readonly\s*\[\]/);
    f.set('packages/barocss-gpu/src/index.ts', changed);
    const after = f.collect(); assertClean(after);
    assert.match(inspect(after), /\[number\]/);
    assert.ok(hasRule(checkInventory(after, before.data), 'IV001'));
  });
});

test('serializer: compile-result unions and nested dependency tuples retain empty and nonempty branches', async t => {
  for (const [name, source, changed, exportName, member] of [
    ['compile result', 'export type Result = { ok: true; diagnostics: [] } | { ok: false; diagnostics: string[] };', 'export type Result = { ok: true; diagnostics: [number] } | { ok: false; diagnostics: string[] };', 'Result'],
    ['compile result reference', 'type Result = { ok: true; diagnostics: [] } | { ok: false; diagnostics: string[] }; export interface View { result: Extract<Result, { ok: true }>; }', 'type Result = { ok: true; diagnostics: [number] } | { ok: false; diagnostics: string[] }; export interface View { result: Extract<Result, { ok: true }>; }', 'View', 'result'],
    ['dependency tuple', 'interface Binding { dependencies: [{ sources: []; parents: [] }, { sources: [string]; parents: [string] }]; } export interface Report { dependencies: Binding["dependencies"]; }', 'interface Binding { dependencies: [{ sources: []; parents: [number] }, { sources: [string]; parents: [string] }]; } export interface Report { dependencies: Binding["dependencies"]; }', 'Report', 'dependencies'],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-gpu/src/index.ts', source);
    const before = f.collect(); assertClean(before);
    const shape = exposure(before, '@barocss/gpu', '.', exportName).variants[0].shape;
    const types = member ? shape.members.find(m => m.name === member).type : shape.type;
    assert.match(types, /\[\]/); assert.doesNotMatch(types, /\bany\b/);
    f.set('packages/barocss-gpu/src/index.ts', changed);
    const after = f.collect(); assertClean(after);
    assert.ok(hasRule(checkInventory(after, before.data), 'IV001'));
  });
});

test('serializer: error constructors and callback/call signatures preserve zero-argument tuple alternatives', async t => {
  await t.test('Error constructor rest union', () => {
    const f = fixture();
    f.set('packages/barocss-gpu/src/index.ts', 'export class TypedError extends Error { constructor(readonly code: "FIXTURE", ...cause: [] | [unknown]) { super(code); } }');
    const before = f.collect(); assertClean(before);
    const shape = exposure(before, '@barocss/gpu', '.', 'TypedError').variants[0].shape;
    assert.match(shape.constructSignatures.join('\n'), /\[\]/);
    assert.match(shape.constructSignatures.join('\n'), /\[unknown\]/);
    assert.match(shape.constructSignatures.join('\n'), /cause/);
    f.set('packages/barocss-gpu/src/index.ts', 'export class TypedError extends Error { constructor(readonly code: "FIXTURE", ...cause: [] | [string]) { super(code); } }');
    const after = f.collect(); assertClean(after);
    assert.ok(hasRule(checkInventory(after, before.data), 'IV001'));
  });
  await t.test('generic callback and callable interface', () => {
    const f = fixture();
    f.set('packages/barocss-gpu/src/index.ts', 'export interface Callable { <T extends string = "x">(...args: [] | [T]): readonly []; } export interface Options { onDone?: (...args: [] | [unknown]) => []; }');
    const before = f.collect(); assertClean(before);
    const call = exposure(before, '@barocss/gpu', '.', 'Callable').variants[0].shape.callSignatures.join('\n');
    assert.match(call, /extends string/); assert.match(call, /readonly\s*\[\]/); assert.match(call, /\[T\]/);
    const callback = exposure(before, '@barocss/gpu', '.', 'Options').variants[0].shape.members.find(m => m.name === 'onDone');
    assert.equal(callback.kind, 'callback'); assert.equal(callback.optional, true);
    assert.match(callback.type, /\[\]/); assert.match(callback.type, /\[unknown\]/);
    f.set('packages/barocss-gpu/src/index.ts', 'export interface Callable { <T extends string = "x">(...args: [] | [T]): readonly [number]; } export interface Options { onDone?: (...args: [] | [unknown]) => []; }');
    const after = f.collect(); assertClean(after);
    assert.ok(hasRule(checkInventory(after, before.data), 'IV001'));
  });
});

test('serializer: recursive conditional generics and namespace exports retain empty tuple type identity', () => {
  const f = fixture();
  const source = 'export namespace N { export type Tree<T extends string = "leaf"> = T extends "leaf" ? { tag: T; empty: readonly [] } : { tag: T; children: readonly Tree<T>[]; empty: [] }; export interface Holder { readonly marker: []; } }';
  f.set('packages/barocss-gpu/src/index.ts', source);
  const before = f.collect(); assertClean(before);
  const children = exposure(before, '@barocss/gpu', '.', 'N').variants[0].shape.namespaceExports;
  const tree = children.find(child => child.exportName === 'Tree').shape;
  assert.match(tree.declarationSignatures[0].typeParameters[0], /extends string/);
  assert.match(tree.declarationSignatures[0].typeParameters[0], /"leaf"/);
  assert.match(tree.declarationSignatures[0].definition, /\bTree<T>/);
  assert.match(tree.declarationSignatures[0].definition, /readonly\s*\[\s*\]/);
  assert.match(children.find(child => child.exportName === 'Holder').shape.members[0].type, /\[\]/);
  f.set('packages/barocss-gpu/src/index.ts', source.replace('readonly []', 'readonly [number]'));
  const after = f.collect(); assertClean(after);
  assert.ok(hasRule(checkInventory(after, before.data), 'IV001'));
});

test('serializer: empty tuple support cannot waive unresolved types or core callbacks', async t => {
  for (const [name, source] of [
    ['import', 'export type Broken = [[], import("./absent.js").T];'],
    ['typeof', 'export type Broken = [[], typeof missingValue];'],
  ]) await t.test(name, () => {
    const f = fixture(); f.set('packages/barocss-gpu/src/index.ts', source);
    const c = f.collect(); assert.ok(hasRule(c, 'EX003'));
    assert.ok(hasRule(checkInventory(c, c.data), 'EX003'));
  });
  await t.test('callback remains forbidden on core data', () => {
    const f = fixture();
    f.set('packages/barocss-cad/src/index.ts', sourceCore.replace('readonly outputs:', 'save?: (...args: [] | [unknown]) => []; readonly outputs:'));
    const c = f.collect(); assert.ok(hasRule(c, 'DA001'));
    assert.ok(hasRule(checkInventory(c, c.data), 'DA001'));
  });
});
