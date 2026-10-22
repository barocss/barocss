import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// A9-7 (ported from Codex 8789e468, G-R2): useAssembly's face tables with a linked housing. Linked reads take the
// exact base (evaluated) input and each immediate occurrence's local document, never a flattened one. A group is
// published only whole and only for the current source: a partial, late, null, rejected or thrown read leaves no
// tables, and then no mate, lock, ground or solve runs. Leaving linked mode falls back to the legacy flattened reads.
// useAssembly is bundled with recording stand-ins for React, the face client, flatten and the mate solver.

// The recorder's hooks, arguments and tables are untyped by nature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Hooks = { useRef: Loose; useState: Loose; useMemo: Loose; useCallback: Loose; useEffect: Loose };
const shared = globalThis as typeof globalThis & { __facesHooks?: Hooks; __facesCalls?: Loose };

// The test runs bundled from a temporary folder, so esbuild is loaded from the studio's own node_modules (cwd).
const studio = process.cwd();
const { build } = createRequire(join(studio, 'package.json'))('esbuild') as typeof import('esbuild');
const temporary = await mkdtemp(join(tmpdir(), 'cad-assembly-linked-faces-'));
let useAssembly: (args: Loose) => Loose;
try {
  const outfile = join(temporary, 'assembly.mjs');
  await build({ entryPoints: [resolve(studio, 'src/assembly/useAssembly.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', define: { 'import.meta.env.DEV': 'false' },
    plugins: [{ name: 'assembly-recorder', setup(builder) {
      builder.onResolve({ filter: /^(react|\.\/faceClient|@barocss\/cad-model\/assembly\/(?:mates|flatten))$/ }, args => ({ path: args.path, namespace: 'recorder' }));
      builder.onLoad({ filter: /.*/, namespace: 'recorder' }, ({ path }) => ({ contents:
        path === 'react' ? 'export const useRef=(...a)=>globalThis.__facesHooks.useRef(...a),useState=(...a)=>globalThis.__facesHooks.useState(...a),useMemo=(...a)=>globalThis.__facesHooks.useMemo(...a),useCallback=(...a)=>globalThis.__facesHooks.useCallback(...a),useEffect=(...a)=>globalThis.__facesHooks.useEffect(...a);'
          : path === './faceClient' ? 'export class FaceClient { table(doc){return globalThis.__facesCalls.legacy(doc)} }'
          : path.endsWith('/flatten') ? 'export const flattenAssembly=doc=>{globalThis.__facesCalls.flattened.push(doc);return {...doc,flattened:true}};'
          : 'export const BASE="base", kindsFor=()=>["coincident"],lockRel=()=>({}),mateRefusal=(...a)=>{globalThis.__facesCalls.refusals.push(a);return null},solveAssembly=(...a)=>globalThis.__facesCalls.solve(...a);',
      }));
    } }],
  });
  ({ useAssembly } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

const doc = (): Loose => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', nodes: [], parameters: {}, outputs: {} });
const table = (marker: string) => ({ marker, face: { kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] } });
const ticks = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const same = (a: readonly unknown[] | undefined, b: readonly unknown[]) => !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

function fixture() {
  const old = { hooks: shared.__facesHooks, calls: shared.__facesCalls };
  const slots: Loose[] = [], effects = new Map<number, () => void>(), jobs: Loose[] = [], legacy: Loose[] = [], solves: Loose[] = [], commits: unknown[][] = [], flattened: Loose[] = [], refusals: unknown[][] = [];
  let cursor = 0;
  const memo = (make: () => unknown, deps: unknown[]) => { const i = cursor++, before = slots[i]; if (!before || !same(before.deps, deps)) slots[i] = { deps, value: make() }; return slots[i].value; };
  shared.__facesHooks = {
    useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], (next: Loose) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useMemo: memo, useCallback: (callback: unknown, deps: unknown[]) => memo(() => callback, deps),
    useEffect(make: () => Loose, deps: unknown[]) { const i = cursor++, before = slots[i]; if (!before || !same(before.deps, deps)) effects.set(i, () => { before?.cleanup?.(); slots[i] = { deps, cleanup: make() }; }); },
  };
  const makeReader = (label = 'root-1', fail?: (owner: string, input: Loose) => Loose) => (owner: string, input: Loose) => {
    if (fail) return fail(owner, input);
    return new Promise((resolve, reject) => jobs.push({ label, owner, input, resolve, reject }));
  };
  shared.__facesCalls = {
    flattened, refusals,
    legacy(input: Loose) { return new Promise((resolve, reject) => legacy.push({ input, resolve, reject })); },
    solve(instances: Loose[], mates: Loose[], faces: (id: string) => Loose) {
      const observed = new Map(['base', ...instances.map(i => i.id)].map(id => [id, faces(id)]));
      solves.push({ instances, mates, observed });
      return { instances: [...instances], problems: [], freedom: {} };
    },
  };
  const child = doc(), rootDoc = { ...doc(), instances: [{ id: 'a', name: 'A', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }, { id: 'b', name: 'B', doc: child, position: [10, 0, 0], rotation: [0, 0, 0] }], mates: [{ id: 'm1', kind: 'coincident', a: { part: 'base', face: 'face' }, b: { part: 'a', face: 'face' } }] };
  const args: Loose = { doc: rootDoc, evaluated: doc(), bodies: [], instanceBodies: new Map(), readFaces: makeReader(), setDoc(next: Loose) { args.doc = typeof next === 'function' ? next(args.doc) : next; }, commit: (...a: unknown[]) => commits.push(a) };
  return { args, jobs, legacy, solves, commits, flattened, refusals, makeReader,
    render() { cursor = 0; return useAssembly(args); },
    async flush() { const pending = [...effects.values()]; effects.clear(); for (const effect of pending) effect(); await ticks(); },
    async complete(group: Loose[], marker = 'current') { for (const job of group) job.resolve(table(marker + ':' + job.owner)); await ticks(); },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); shared.__facesHooks = old.hooks; shared.__facesCalls = old.calls; },
  };
}
type Fixture = ReturnType<typeof fixture>;
async function seed(f: Fixture) { f.render(); await f.flush(); const group = f.jobs.slice(); await f.complete(group, 'old'); const api = f.render(); await f.flush(); assert.equal(api.tables.size, 3); assert.ok(f.solves.length); return api; }
const noInvocation = (f: Fixture, api: Loose, before: number) => {
  assert.match(api.lock('a', 'base'), /faces.*unavailable/); assert.match(api.edit('m1', {}), /faces.*unavailable/); assert.match(api.ground('b', true), /faces.*unavailable/);
  assert.equal(f.solves.length, before); assert.equal(f.commits.length, 0);
};
const noAuthority = (f: Fixture, api: Loose, before: number) => { assert.equal(api.tables.size, 0); noInvocation(f, api, before); };

test('linked reads use the exact base (evaluated) and immediate occurrence local documents, without flatten or partial publication', async () => {
  const f = fixture();
  try {
    const pending = f.render(), empty = pending.tables; await f.flush();
    assert.equal(f.solves.length, 0); assert.equal(f.legacy.length, 0); assert.deepEqual(f.flattened, []);
    assert.deepEqual(f.jobs.map(job => [job.owner, job.input]), [['base', f.args.evaluated], ['a', f.args.doc.instances[0].doc], ['b', f.args.doc.instances[1].doc]]);
    f.jobs[0].resolve(table('base-only')); f.jobs[1].resolve(table('a-only')); await ticks();
    const partial = f.render(); assert.equal(partial.tables, empty); await f.flush(); assert.equal(f.solves.length, 0);
    f.jobs[2].resolve(table('b-complete')); await ticks(); const ready = f.render(); assert.equal(ready.tables.size, 3); await f.flush();
    assert.equal(f.solves.at(-1).observed.get('base').marker, 'base-only'); assert.equal(f.solves.at(-1).observed.get('b').marker, 'b-complete');
  } finally { f.cleanup(); }
});

test('a new root callback, evaluated input or occurrence clears linked tables during render, and stale APIs cannot solve', async () => {
  const changes: ((f: Fixture) => void)[] = [
    f => { f.args.readFaces = f.makeReader('root-rows-changed'); },
    f => { f.args.evaluated = { ...f.args.evaluated }; },
    f => { f.args.doc = { ...f.args.doc, instances: f.args.doc.instances.map((i: Loose) => i.id === 'b' ? { ...i, position: [20, 0, 0] } : i) }; },
  ];
  for (const change of changes) {
    const f = fixture();
    try {
      const oldApi = await seed(f), before = f.solves.length; change(f); const pending = f.render();
      noAuthority(f, pending, before); assert.equal(oldApi.tables.size, 3, 'historical Maps stay immutable'); noInvocation(f, oldApi, before);
      await f.flush(); assert.equal(f.solves.length, before);
      const empty = pending.tables; assert.equal(f.render().tables, empty, 'the pending Map is stable across renders');
      await f.complete(f.jobs.slice(3), 'fresh'); const current = f.render(); await f.flush(); assert.equal(current.tables.size, 3);
      assert.ok([...f.solves.at(-1).observed.values()].every((face: Loose) => face?.marker.startsWith('fresh:')));
    } finally { f.cleanup(); }
  }
});

test('late linked responses never refill a newer root group; only the complete current group reaches the solver', async () => {
  const f = fixture();
  try {
    f.render(); await f.flush(); const old = f.jobs.slice();
    f.args.readFaces = f.makeReader('new-root'); const empty = f.render().tables; await f.flush(); const current = f.jobs.slice(3);
    await f.complete(old, 'stale'); assert.equal(f.render().tables, empty); assert.equal(f.solves.length, 0);
    await f.complete(current, 'new'); const ready = f.render(); await f.flush(); assert.equal(ready.tables.size, 3);
    assert.ok([...f.solves.at(-1).observed.values()].every((face: Loose) => face.marker.startsWith('new:')));
  } finally { f.cleanup(); }
});

test('null, missing, rejected and synchronously thrown linked reads clear the whole group and cannot mate', async () => {
  for (const failure of ['null', 'missing', 'reject', 'throw', 'mixed']) {
    const f = fixture();
    try {
      await seed(f); const before = f.solves.length;
      f.args.readFaces = failure === 'throw' ? f.makeReader('throw', () => { throw new Error('current context refused'); })
        : failure === 'mixed' ? f.makeReader('mixed', owner => { if (owner === 'base') return Promise.reject(new Error('base refused')); if (owner === 'a') throw new Error('owner binding refused'); return Promise.resolve(table('partial-b')); })
        : f.makeReader('failure');
      noAuthority(f, f.render(), before); await f.flush();
      if (failure !== 'throw' && failure !== 'mixed') {
        const group = f.jobs.slice(3); group[0].resolve(table('base-good')); group[1].resolve(table('a-good'));
        if (failure === 'reject') group[2].reject(new Error('housing no longer exists')); else group[2].resolve(failure === 'null' ? null : undefined);
        await ticks();
      }
      const failed = f.render(); noAuthority(f, failed, before); await f.flush(); assert.equal(f.solves.length, before);
      failed.start(); let draft = f.render(); draft.pickFace({ part: 'base', face: 'face' }); draft = f.render(); draft.pickFace({ part: 'a', face: 'face' });
      assert.equal(f.commits.length, 0); assert.equal(f.refusals.length, 0, 'no old native face enters mate validation'); assert.equal(f.solves.length, before);
    } finally { f.cleanup(); }
  }
});

test('leaving linked mode hides old linked tables until fresh legacy tables arrive, keeping the legacy flattened inputs', async () => {
  const f = fixture();
  try {
    const old = await seed(f), before = f.solves.length; f.args.readFaces = undefined;
    const pending = f.render(); noAuthority(f, pending, before); await f.flush(); assert.equal(f.legacy.length, 3);
    assert.equal(f.legacy[0].input, f.args.evaluated); assert.equal(f.legacy[1].input.flattened, true); assert.equal(f.legacy[2].input.flattened, true);
    assert.deepEqual(f.flattened, f.args.doc.instances.map((i: Loose) => i.doc));
    assert.equal(f.render().tables, pending.tables);
    for (const job of f.legacy) job.resolve(table('legacy-current'));
    await ticks(); const ready = f.render(); await f.flush();
    assert.notEqual(ready.tables, old.tables); assert.ok([...f.solves.at(-1).observed.values()].every((face: Loose) => face.marker === 'legacy-current'));
    const solved = f.solves.length; f.args.readFaces = f.makeReader('linked-again'); const linkedPending = f.render();
    noAuthority(f, linkedPending, solved); noInvocation(f, ready, solved); await f.flush(); assert.equal(f.solves.length, solved);
  } finally { f.cleanup(); }
});
