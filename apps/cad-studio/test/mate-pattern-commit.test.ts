import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { addPart, addMate, editMate, lockPart } from '@barocss/cad-model/assembly/edit';
import { addInstancePattern } from '@barocss/cad-model/assembly/patterns';
import { tableOf } from '@barocss/cad-model/assembly/faces';
import type { useAssembly as Hook } from '../src/assembly/useAssembly';
// Only React scheduling and the unused worker client are replaced. Model solver, patterns and face tables are real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
const shared = globalThis as typeof globalThis & {
  __mateHooks?: Loose;
};
const studio = process.cwd();
const { build } = createRequire(join(studio, 'package.json'))('esbuild') as typeof import('esbuild');
const temporary = await mkdtemp(join(tmpdir(), 'cad-mate-pattern-'));
let useAssembly: typeof Hook;
try {
  const hook = resolve(studio, 'src/assembly/useAssembly.ts');
  const input = process.env.MATE_BASELINE_HOOK
    ? { stdin: { contents: await readFile(process.env.MATE_BASELINE_HOOK, 'utf8'), resolveDir: resolve(studio, 'src/assembly'), sourcefile: hook, loader: 'ts' as const } }
    : { entryPoints: [hook] };
  const outfile = join(temporary, 'assembly.mjs');
  await build({
    ...input, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [{
      name: 'mate-hooks',
      setup(builder) {
        builder.onResolve({ filter: /^(react|\.\/faceClient)$/ }, args => ({ path: args.path, namespace: 'mate-hooks' }));
        builder.onLoad({ filter: /.*/, namespace: 'mate-hooks' }, ({ path }) => ({
          contents: path === 'react'
            ? 'export const useRef=(...a)=>globalThis.__mateHooks.useRef(...a),useState=(...a)=>globalThis.__mateHooks.useState(...a),useMemo=(...a)=>globalThis.__mateHooks.useMemo(...a),useCallback=(...a)=>globalThis.__mateHooks.useCallback(...a),useEffect=(...a)=>globalThis.__mateHooks.useEffect(...a);'
            : 'export class FaceClient {}',
        }));
      },
    }],
  });
  ({ useAssembly } = await import(pathToFileURL(outfile).href));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
export function cycleFixture(): StudioDoc {
  let doc = addPart(rectanglePart(100, 50, 10), { name: 'Pin', doc: rectanglePart(10, 10, 20), position: [0, 0, 20] }).doc;
  doc = addInstancePattern(doc, { seed: 'p1', kind: 'linear', count: 2, dir: [1, 0, 0], spacing: 30 }).doc;
  doc = addPart(doc, { name: 'Cap', doc: rectanglePart(10, 10, 20), position: [0, 0, 100] }).doc;
  return addMate(doc, { kind: 'coincident', a: { part: 'pat1-1', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } }).doc;
}
function harness(initial: StudioDoc) {
  const old = shared.__mateHooks, slots: Loose[] = [], effects = new Map<number, () => void>();
  let cursor = 0;
  const same = (a: Loose[], b: Loose[]) => a?.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const memo = (make: () => Loose, deps: Loose[]) => {
    const i = cursor++, before = slots[i];
    if (!before || !same(before.deps, deps)) slots[i] = { deps, value: make() };
    return slots[i].value;
  };
  shared.__mateHooks = {
    useRef(value: Loose) { return slots[cursor++] ??= { current: value }; },
    useState(value: Loose) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = value;
      return [slots[i], (next: Loose) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useMemo: memo,
    useCallback: (callback: Loose, deps: Loose[]) => memo(() => callback, deps),
    useEffect(make: () => Loose, deps: Loose[]) {
      const i = cursor++, before = slots[i];
      if (!before || !same(before.deps, deps)) {
        effects.set(i, () => { before?.cleanup?.(); slots[i] = { deps, cleanup: make() }; });
      }
    },
  };
  const commits: StudioDoc[] = [];
  const args: Parameters<typeof Hook>[0] = {
    doc: initial, evaluated: initial, bodies: [], instanceBodies: new Map(),
    readFaces: async (_owner, input) => tableOf(input),
    setDoc(next) { args.doc = typeof next === 'function' ? next(args.doc) : next; },
    commit(instances, mates) { args.doc = { ...args.doc, instances, mates }; commits.push(args.doc); },
  };
  return {
    args, commits,
    render() { cursor = 0; return useAssembly(args); },
    async flush() {
      const jobs = [...effects.values()]; effects.clear();
      for (const job of jobs) job();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); shared.__mateHooks = old; },
  };
}
async function ready(f: ReturnType<typeof harness>) {
  f.render(); await f.flush();
  const api = f.render(); await f.flush();
  return api;
}
function modelReason(fn: () => unknown): string {
  try { fn(); } catch (error) {
    assert.equal((error as { code: string }).code, 'MATE_UNMET');
    return (error as Error).message;
  }
  assert.fail('model did not refuse');
}
const closing = { kind: 'coincident' as const, a: { part: 'p2', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } };
test('finish refuses the model pattern-cycle before any document/history commit and retains first pick for recovery', async () => {
  const doc = cycleFixture(), f = harness(doc), before = JSON.stringify(doc);
  try {
    let api = await ready(f);
    api.start();
    api = f.render();
    api.setDraft({ kind: 'coincident' });
    api.pickFace(closing.a);
    api.pickFace(closing.b);
    api = f.render();
    assert.equal(f.commits.length, 0);
    assert.equal(JSON.stringify(f.args.doc), before);
    assert.match(api.draft?.error ?? '', /Mate m2 .*would leave pattern pat1 unsettled/);
    assert.equal(api.draft?.error, modelReason(() => addMate(doc, closing)));
    assert.deepEqual(api.draft?.picks.map(p => p.ref), [closing.a]);
    api.cancel();
    assert.equal(f.render().draft, null);
  }
  finally {
    f.cleanup();
  }
});
if (process.env.MATE_CYCLE_FIXTURE_OUT) {
  const fixture = cycleFixture();
  await writeFile(process.env.MATE_CYCLE_FIXTURE_OUT, JSON.stringify(fixture));
  await writeFile(process.env.MATE_CYCLE_FIXTURE_OUT + '.edit.bcad', JSON.stringify(addMate(fixture, { ...closing, kind: 'distance', distance: -40 }).doc));
}
test('editing a settled pattern feedback mate refuses an unsettled offset atomically and permits a valid edit', async () => {
  const base = cycleFixture(), doc = addMate(base, { ...closing, kind: 'distance', distance: -40 }).doc, f = harness(doc), before = JSON.stringify(doc);
  try {
    const api = await ready(f);
    const why = api.edit('m2', { distance: -39 });
    assert.match(why ?? '', /Mate m2 .*would leave pattern pat1 unsettled/);
    assert.equal(why, modelReason(() => editMate(doc, { id: 'm2', distance: -39 })));
    assert.equal(f.commits.length, 0);
    assert.equal(JSON.stringify(f.args.doc), before);
    assert.equal(api.edit('m2', { distance: -40 }), null);
    assert.equal(f.commits.length, 1);
    assert.deepEqual(f.args.doc.mates, doc.mates);
  }
  finally {
    f.cleanup();
  }
});
test('lock checks pattern settling before commit, including a newly read input awaiting its automatic solve', async () => {
  const base = cycleFixture(), doc = { ...base, instances: base.instances!.map(i => i.id === 'p2' ? { ...i, position: [0, 0, 100] as [
        number,
        number,
        number
      ] } : i) }, f = harness(doc), before = JSON.stringify(doc);
  try {
    f.render();
    await f.flush();
    const api = f.render();
    const why = api.lock('p1', 'p2');
    assert.match(why ?? '', /Mate m2 .*would leave pattern pat1 unsettled/);
    assert.equal(why, modelReason(() => lockPart(doc, { part: 'p1', to: 'p2' })));
    assert.equal(f.commits.length, 0);
    assert.equal(JSON.stringify(f.args.doc), before);
    assert.equal(api.lock('p1', 'base'), null);
    assert.equal(f.commits.length, 1);
    assert.equal(f.args.doc.mates!.at(-1)?.kind, 'lock');
  }
  finally {
    f.cleanup();
  }
});
test('refused finish keeps its first pick usable: valid second part commits once, with no input mutation', async () => {
  const doc = addPart(cycleFixture(), { name: 'Loose', doc: rectanglePart(10, 10, 20), position: [60, 0, 100] }).doc, f = harness(doc), before = JSON.stringify(doc);
  try {
    let api = await ready(f);
    api.start();
    api = f.render();
    api.setDraft({ kind: 'coincident' });
    api.pickFace(closing.a);
    api.pickFace(closing.b);
    assert.equal(f.commits.length, 0);
    api.pickFace({ part: 'p3', face: 'n1.bottom' });
    api = f.render();
    assert.equal(f.commits.length, 1);
    assert.equal(api.draft, null);
    assert.deepEqual(f.args.doc.mates!.at(-1)?.b, { part: 'p3', face: 'n1.bottom' });
    assert.equal(JSON.stringify(doc), before);
  }
  finally {
    f.cleanup();
  }
});
test('valid seed mate can require pattern regeneration without false refusal, and pending tables write nothing', async () => {
  const doc = cycleFixture(), f = harness(doc), before = JSON.stringify(doc);
  try {
    let api = f.render();
    api.start();
    api = f.render();
    api.pickFace({ part: 'base', face: 'n1.top' });
    api = f.render();
    assert.match(api.draft?.error ?? '', /faces.*unavailable/);
    assert.match(api.lock('p1', 'base') ?? '', /faces.*unavailable/);
    assert.match(api.edit('m1', { flip: true }) ?? '', /faces.*unavailable/);
    assert.equal(f.commits.length, 0);
    assert.equal(JSON.stringify(f.args.doc), before);
    await f.flush();
    api = f.render();
    await f.flush();
    api.cancel();
    api.start();
    api = f.render();
    api.setDraft({ kind: 'coincident' });
    api.pickFace({ part: 'base', face: 'n1.top' });
    api.pickFace({ part: 'p1', face: 'n1.bottom' });
    assert.equal(f.commits.length, 1);
    assert.equal(f.render().draft, null);
    assert.deepEqual(f.args.doc.mates!.at(-1)?.b, { part: 'p1', face: 'n1.bottom' });
    assert.equal(JSON.stringify(doc), before);
  }
  finally {
    f.cleanup();
  }
});
