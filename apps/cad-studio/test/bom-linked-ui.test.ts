import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// A9-7 (ported from Codex 8789e468, G-R2): the BOM panel with a linked housing. A purchase list never comes from an
// earlier linked result: rows, parameters, target poses, hidden flags and deletions each make it stale, and only the
// current root and name may publish. D575 applies that rule to ordinary documents as well.
// BomPanel is bundled with recording stand-ins for React and the BOM model. The tests check consumer calls.

// The recorder's hooks, props and JSX records are untyped by nature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Hooks = { useRef: Loose; useState: Loose; useMemo: Loose; useEffect: Loose; useLayoutEffect: Loose };
const shared = globalThis as typeof globalThis & { __bomHooks?: Hooks; __bomCalls?: Loose };

// The test runs bundled from a temporary folder, so esbuild is loaded from the studio's own node_modules (cwd).
const studio = process.cwd();
const { build } = createRequire(join(studio, 'package.json'))('esbuild') as typeof import('esbuild');
const temporary = await mkdtemp(join(tmpdir(), 'cad-bom-linked-ui-'));
let BomPanel: (props: Loose) => Loose, bomHasLinkedHousing: (doc: Loose) => boolean;
try {
  const outfile = join(temporary, 'panel.mjs');
  await build({ entryPoints: [resolve(studio, 'src/ui/BomPanel.tsx')], outfile, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent',
    plugins: [{ name: 'panel-recorder', setup(builder) {
      builder.onResolve({ filter: /^(react(?:\/jsx-runtime)?|@barocss\/cad-model\/bom\/bom|\.\/files|\.\/atoms)$/ }, args => ({ path: args.path, namespace: 'recorder' }));
      builder.onLoad({ filter: /.*/, namespace: 'recorder' }, ({ path }) => ({ contents:
        // (O16: shadcn's Button takes Radix's Slot, which calls forwardRef as its module loads — and the rest of React's
        // element API when it renders as a child, which the recorder never does: a component's element is recorded.)
        path === 'react' ? 'export const useRef=(...a)=>globalThis.__bomHooks.useRef(...a),useState=(...a)=>globalThis.__bomHooks.useState(...a),useMemo=(...a)=>globalThis.__bomHooks.useMemo(...a),useEffect=(...a)=>globalThis.__bomHooks.useEffect(...a),useLayoutEffect=(...a)=>globalThis.__bomHooks.useLayoutEffect(...a);'
          + 'export const forwardRef=render=>render,memo=type=>type,useCallback=f=>f,Fragment="fragment",isValidElement=()=>false,cloneElement=element=>element,createElement=(type,props,...children)=>({type,props:{...props,children}}),Children={map:()=>[],toArray:()=>[],count:()=>0,only:child=>child,forEach:()=>{}};'
          : path === 'react/jsx-runtime' ? 'export const jsx=(type,props,key)=>({type,props,key}),jsxs=jsx; export const Fragment="fragment";'
          : path === '@barocss/cad-model/bom/bom' ? 'export const bomPanelData=(...a)=>globalThis.__bomCalls.load(...a),purchaseCsv=(data,made)=>data.marker+":"+made,setBought=(...a)=>globalThis.__bomCalls.setBought(...a);'
          : path === './files' ? 'export const downloadBytes=(...a)=>globalThis.__bomCalls.downloads.push(a);'
          : 'export const Icon=()=>null;',
      }));
    } }],
  });
  ({ BomPanel, bomHasLinkedHousing } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

const document = (linked = true): Loose => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: linked ? [{ kind: 'bearing', id: 'n1', housingRef: { part: 'housing', body: 'b2' } }] : [{ kind: 'key', id: 'n1' }], outputs: {}, instances: [] });
const data = (marker: string) => ({ marker, view: { elements: [] }, bom: { lines: [{ item: marker, qty: 1, kind: 'key', parts: ['base:n1'], source: null, estimate: false }], totalQty: 1, totalMass: 0 }, made: [] });
const walk = (node: Loose): Loose[] => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const find = (tree: Loose, label: string) => walk(tree).find(node => node.props?.['aria-label'] === label);
const text = (tree: Loose): string => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : !tree ? '' : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children);
const same = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

function fixture(linked = true) {
  const old = { hooks: shared.__bomHooks, calls: shared.__bomCalls, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const slots: Loose[] = [], layoutEffects = new Map<number, () => void>(), effects = new Map<number, () => void>();
  const timers = new Map<number, () => void>(), jobs: Loose[] = [], errors: unknown[][] = [], downloads: Loose[][] = [];
  const boughtCalls: Loose[][] = [], commits: Loose[] = [];
  let cursor = 0, timerId = 0, stateWrites = 0;
  const schedule = (queue: Map<number, () => void>, make: () => Loose, deps?: unknown[]) => {
    const i = cursor++, before = slots[i];
    if (!before || !same(before.deps, deps)) queue.set(i, () => {
      before?.cleanup?.();
      slots[i] = { deps, cleanup: make(), layout: queue === layoutEffects };
    });
  };
  const flush = (queue: Map<number, () => void>) => {
    const pending = [...queue.values()];
    queue.clear();
    for (const effect of pending) effect();
  };
  shared.__bomHooks = {
    useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], (next: Loose) => { stateWrites++; slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useMemo(make: () => unknown, deps: unknown[]) { const i = cursor++, before = slots[i]; if (!before || !same(before.deps, deps)) slots[i] = { deps, value: make() }; return slots[i].value; },
    useEffect(make: () => Loose, deps?: unknown[]) { schedule(effects, make, deps); },
    useLayoutEffect(make: () => Loose, deps?: unknown[]) { schedule(layoutEffects, make, deps); },
  };
  globalThis.setTimeout = ((callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; }) as Loose;
  globalThis.clearTimeout = ((id: number) => { timers.delete(id); }) as Loose;
  shared.__bomCalls = {
    downloads,
    load(doc: Loose, evaluate: Loose, name: string) { return new Promise((resolve, reject) => jobs.push({ doc, evaluate, name, resolve, reject })); },
    setBought(doc: Loose, parts: string[], value: boolean | null) {
      const next = { ...doc };
      boughtCalls.push([doc, parts, value, next]);
      return next;
    },
  };
  const props: Loose = { doc: document(linked), name: 'current assembly', evaluate: async () => null,
    onCommit: (next: Loose) => commits.push(next), onClose() {}, onError: (...args: unknown[]) => errors.push(args) };
  return { props, jobs, errors, downloads, boughtCalls, commits, get stateWrites() { return stateWrites; },
    render() { cursor = 0; const tree = BomPanel(props); flush(layoutEffects); return tree; },
    effects() { flush(effects); },
    start() { this.effects(); for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    async resolve(job: Loose, value: unknown) { job.resolve(value); await Promise.resolve(); },
    async reject(job: Loose, message: string) { job.reject(new Error(message)); await Promise.resolve(); },
    unmount() {
      for (const slot of slots) if (slot?.cleanup && slot.layout) { slot.cleanup(); slot.cleanup = undefined; }
    },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); shared.__bomHooks = old.hooks; shared.__bomCalls = old.calls; globalThis.setTimeout = old.setTimeout; globalThis.clearTimeout = old.clearTimeout; },
  };
}
type Fixture = ReturnType<typeof fixture>;
async function seed(f: Fixture) { f.render(); f.start(); await f.resolve(f.jobs[0], data('previous-result')); const tree = f.render(); f.effects(); assert.ok(find(tree, 'BOM lines')); return tree; }
const blocked = (tree: Loose) => { assert.equal(find(tree, 'BOM lines'), undefined); assert.equal(find(tree, 'Export purchase list')?.props.disabled, true); };

test('a linked current source hides old rows and CSV on first render and while pending; a failure shows its real reason', async () => {
  const f = fixture();
  try {
    const previous = await seed(f), oldCsv = find(previous, 'Export purchase list').props.onClick;
    f.props.doc = { ...f.props.doc, parameters: { bore: 46 } };
    blocked(f.render()); oldCsv(); assert.equal(f.downloads.length, 0, 'an old event closure cannot export after the source changed');
    f.start(); blocked(f.render()); assert.equal(f.jobs[1].doc, f.props.doc, 'the current authored root is evaluated, with its parameters');
    await f.reject(f.jobs[1], '[BEARING_HOUSING_EVALUATION] current bore refused');
    const failed = f.render(); blocked(failed); assert.match(text(walk(failed).find(node => node.props?.role === 'alert')), /current bore refused/);
    assert.deepEqual(f.errors, [['Could not work out the BOM', '[BEARING_HOUSING_EVALUATION] current bore refused']]);
  } finally { f.cleanup(); }
});

test('only the current authored root and name may publish; stale successes and failures are ignored, before effect cleanup too', async () => {
  const f = fixture();
  try {
    f.render(); f.start(); const old = f.jobs[0];
    f.props.doc = { ...f.props.doc, bearings: [{ id: 'new-row' }] }; blocked(f.render());
    await f.resolve(old, data('stale-success-before-cleanup')); blocked(f.render());
    f.start(); const rowJob = f.jobs[1];
    f.props.name = 'renamed assembly'; blocked(f.render()); f.start(); const current = f.jobs[2];
    await f.reject(rowJob, 'stale row failure'); blocked(f.render()); assert.deepEqual(f.errors, []);
    await f.resolve(current, data('current-only')); const tree = f.render(); assert.match(text(find(tree, 'BOM lines')), /current-only/);
    find(tree, 'Export purchase list').props.onClick(); assert.equal(f.downloads.length, 1); assert.equal(new TextDecoder().decode(f.downloads[0][0]), 'current-only:false');
  } finally { f.cleanup(); }
});

test('rows, fits, parameters, target poses, hidden flags, outputs and deletion each make a linked result stale, with the same bearing nodes', async () => {
  const changes: ((doc: Loose) => Loose)[] = [
    doc => ({ ...doc, bearings: [{ id: 'changed-row' }] }),
    doc => ({ ...doc, fits: [{ id: 'changed-fit' }] }),
    doc => ({ ...doc, parameters: { diameter: 47 } }),
    doc => ({ ...doc, instances: [{ id: 'housing', doc: document(false), position: [1, 0, 0], rotation: [0, 0, 0] }] }),
    doc => ({ ...doc, instances: [{ id: 'housing', doc: document(false), position: [0, 0, 0], rotation: [0, 0, 90], hidden: true }] }),
    doc => ({ ...doc, outputs: {} }),
    doc => ({ ...doc, instances: [] }),
  ];
  for (const change of changes) {
    const f = fixture();
    f.props.doc = { ...f.props.doc, outputs: { b2: { node: 0, side: 'solid' } }, instances: [{ id: 'housing', doc: document(false), position: [0, 0, 0], rotation: [0, 0, 0] }] };
    try { await seed(f); const nodes = f.props.doc.nodes; f.props.doc = change(f.props.doc); assert.equal(f.props.doc.nodes, nodes); blocked(f.render()); f.start(); assert.equal(f.jobs.at(-1).doc, f.props.doc); }
    finally { f.cleanup(); }
  }
});

test('linked detection covers nested occurrences and malformed refs; removing the last link cannot flash its previous data', async () => {
  assert.equal(bomHasLinkedHousing(document(false)), false);
  assert.equal(bomHasLinkedHousing({ ...document(false), instances: [{ id: 'shared-copy', doc: document() }] }), true);
  assert.equal(bomHasLinkedHousing({ ...document(), nodes: [{ kind: 'bearing', suppressed: true, housingRef: { part: 'housing', body: 'b2' } }] }), false);
  assert.equal(bomHasLinkedHousing({ ...document(), nodes: [{ kind: 'bearing', housingRef: null }] }), true, 'the async Model validator reports a malformed ref rather than old data being shown');
  const f = fixture();
  try { await seed(f); f.props.doc = document(false); blocked(f.render()); f.start(); assert.equal(find(f.render(), 'BOM lines'), undefined); await f.resolve(f.jobs[1], data('unlinked-current')); assert.match(text(find(f.render(), 'BOM lines')), /unlinked-current/); }
  finally { f.cleanup(); }
});

const choose = (tree: Loose, item: string) => find(tree, `Bought or made: ${item}`).props.onChange;
const choice = (value: string) => ({ currentTarget: { value } });

for (const change of ['document', 'name'] as const) {
  test(`D575: ordinary ${change} change blocks previous rows and actions until a current result succeeds`, async () => {
    const f = fixture(false);
    try {
      const previous = await seed(f), oldCsv = find(previous, 'Export purchase list').props.onClick;
      const oldChoose = choose(previous, 'previous-result');
      const previousDoc = f.props.doc, previousName = f.props.name;
      if (change === 'document') f.props.doc = { ...previousDoc, nodes: [{ kind: 'pin', id: 'n1' }] };
      else f.props.name = 'renamed assembly';
      assert.equal(change === 'document' ? f.props.name : f.props.doc, change === 'document' ? previousName : previousDoc);

      blocked(f.render());
      oldCsv(); oldChoose(choice('made'));
      assert.equal(f.downloads.length, 0); assert.equal(f.boughtCalls.length, 0); assert.equal(f.commits.length, 0);
      f.effects();
      blocked(f.render()); assert.equal(f.jobs.length, 1, 'the new request is still debounced');
      f.start();
      blocked(f.render()); assert.equal(f.jobs.length, 2);
      assert.equal(f.jobs[1].doc, f.props.doc); assert.equal(f.jobs[1].name, f.props.name);
      await f.reject(f.jobs[1], 'current evaluator unavailable');
      const failed = f.render();
      blocked(failed);
      assert.match(text(walk(failed).find(node => node.props?.role === 'alert')), /current evaluator unavailable/);
      assert.deepEqual(f.errors, [['Could not work out the BOM', 'current evaluator unavailable']]);
      oldCsv(); oldChoose(choice('made'));
      assert.equal(f.downloads.length, 0); assert.equal(f.boughtCalls.length, 0); assert.equal(f.commits.length, 0);

      f.props.doc = { ...f.props.doc };
      blocked(f.render()); f.start();
      await f.resolve(f.jobs[2], data('current-result'));
      const current = f.render();
      assert.match(text(find(current, 'BOM lines')), /current-result/);
      assert.equal(walk(current).find(node => node.props?.role === 'alert'), undefined);
      oldCsv(); oldChoose(choice('made'));
      assert.equal(f.downloads.length, 0); assert.equal(f.boughtCalls.length, 0); assert.equal(f.commits.length, 0);
      find(current, 'Export purchase list').props.onClick();
      assert.equal(f.downloads.length, 1);
      assert.equal(new TextDecoder().decode(f.downloads[0][0]), 'current-result:false');
      assert.equal(f.downloads[0][1], `${f.props.name} purchase list.csv`);
      choose(current, 'current-result')(choice('made'));
      assert.equal(f.boughtCalls.length, 1);
      const [doc, parts, value, next] = f.boughtCalls[0];
      assert.equal(doc, f.props.doc); assert.deepEqual(parts, ['base:n1']); assert.equal(value, false);
      assert.equal(f.commits.length, 1); assert.equal(f.commits[0], next);
    } finally { f.cleanup(); }
  });
}

test('D575: unmount blocks captured ordinary CSV and row handlers before passive cleanup', async () => {
  const f = fixture(false);
  try {
    const previous = await seed(f), csv = find(previous, 'Export purchase list').props.onClick;
    const mark = choose(previous, 'previous-result');
    f.unmount();
    csv(); mark(choice('bought'));
    assert.equal(f.downloads.length, 0); assert.equal(f.boughtCalls.length, 0); assert.equal(f.commits.length, 0);
  } finally { f.cleanup(); }
});

for (const outcome of ['success', 'failure'] as const) {
  test(`D575: unmount ignores a pending ordinary ${outcome} before passive cleanup`, async () => {
    const f = fixture(false);
    try {
      f.render(); f.start();
      const before = f.stateWrites;
      f.unmount();
      if (outcome === 'success') await f.resolve(f.jobs[0], data('late-result'));
      else await f.reject(f.jobs[0], 'late failure');
      assert.equal(f.stateWrites, before);
      assert.deepEqual(f.errors, []);
    } finally { f.cleanup(); }
  });
}
