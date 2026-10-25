import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Recorder hooks and JSX expose the actual workflow's undoable commits and panel callbacks. Model mates and
// connectors are real source modules. This is a component/workflow test, not browser, GPU or human-input evidence.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Hooks = { useRef: Loose; useState: Loose; useMemo: Loose; useCallback: Loose; useEffect: Loose };
const shared = globalThis as typeof globalThis & { __fastenedHooks?: Hooks };
const studio = process.cwd(), model = resolve(studio, '../../packages/barocss-cad-model/src');
const { build } = createRequire(join(studio, 'package.json'))('esbuild') as typeof import('esbuild');
const artifacts = process.env.CAD_O24D_ARTIFACTS;
if (artifacts) await mkdir(artifacts, { recursive: true });
const temporary = await mkdtemp(join(artifacts || tmpdir(), 'cad-o24d-fastened-'));
let useAssembly: (args: Loose) => Loose, MatePanel: (props: Loose) => Loose;
try {
  const outfile = join(temporary, 'workflow.mjs');
  const built = await build({ ...(artifacts ? { metafile: true } : {}), stdin: { contents: `export { useAssembly } from './src/assembly/useAssembly'; export { MatePanel } from './src/ui/MatePanel';`, resolveDir: studio, loader: 'ts' }, outfile, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env.DEV': 'false' },
    plugins: [{ name: 'fastened-workflow-recorder', setup(builder) {
      // Pin Model imports to this checkout, independently of the shared node_modules symlinks.
      builder.onResolve({ filter: /^@barocss\/cad-model\// }, args => ({ path: resolve(model, args.path.slice('@barocss/cad-model/'.length) + '.ts') }));
      builder.onResolve({ filter: /^(react(?:\/jsx-runtime)?|\.\/faceClient|\.\/atoms|@\/components\/ui\/(?:button|native-select))$/ }, args => ({ path: args.path, namespace: 'recorder' }));
      builder.onLoad({ filter: /.*/, namespace: 'recorder' }, ({ path }) => ({ contents:
        path === 'react' ? 'export const useRef=(...a)=>globalThis.__fastenedHooks.useRef(...a),useState=(...a)=>globalThis.__fastenedHooks.useState(...a),useMemo=(...a)=>globalThis.__fastenedHooks.useMemo(...a),useCallback=(...a)=>globalThis.__fastenedHooks.useCallback(...a),useEffect=(...a)=>globalThis.__fastenedHooks.useEffect(...a);'
          : path === 'react/jsx-runtime' ? 'export const jsx=(type,props,key)=>({type,props,key}),jsxs=jsx; export const Fragment="fragment";'
          : path === './faceClient' ? 'export class FaceClient { table(){throw new Error("This fixture requires explicit linked face tables")} }'
          : path === './atoms' ? 'export const Icon="icon";'
          : path.endsWith('/button') ? 'export const Button="button";'
          : 'export const NativeSelect="select";',
      }));
    } }],
  });
  if (artifacts) await writeFile(join(temporary, 'metafile.json'), JSON.stringify(built.metafile, null, 2) + '\n', { flag: 'wx' });
  ({ useAssembly, MatePanel } = await import(pathToFileURL(outfile).href));
} finally { if (!artifacts) await rm(temporary, { recursive: true, force: true }); }

const doc = (): Loose => ({ format: 'barocss-cad-model', schema: 3, units: 'mm', nodes: [], parameters: {}, outputs: {} });
const plane = { kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] };
const tables = { 'origin:xy': plane };
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const same = (a: readonly unknown[] | undefined, b: readonly unknown[]) => !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const walk = (node: Loose): Loose[] => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(walk);
  // Only MateEditor is expanded. Its connector controls and the other React components remain JSX records.
  if (typeof node.type === 'function' && node.type.name === 'MateEditor') return [node, ...walk(node.type(node.props))];
  return [node, ...walk(node.props?.children)];
};
const find = (tree: Loose, label: string) => walk(tree).find(node => node.props?.['aria-label'] === label);
const text = (node: Loose): string => typeof node === 'string' || typeof node === 'number' ? String(node) : !node ? '' : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
const vector = (actual: readonly number[], expected: readonly number[]) => actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= 1e-9, `${actual} vs ${expected}`));

function fixture() {
  const previous = shared.__fastenedHooks, slots: Loose[] = [], effects = new Map<number, () => void>(), commits: Loose[] = [], history: Loose[] = [];
  let cursor = 0;
  const memo = (make: () => unknown, deps: unknown[]) => { const i = cursor++, before = slots[i]; if (!before || !same(before.deps, deps)) slots[i] = { deps, value: make() }; return slots[i].value; };
  shared.__fastenedHooks = {
    useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], (next: Loose) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useMemo: memo, useCallback: (callback: unknown, deps: unknown[]) => memo(() => callback, deps),
    useEffect(make: () => Loose, deps: unknown[]) { const i = cursor++, before = slots[i]; if (!before || !same(before.deps, deps)) effects.set(i, () => { before?.cleanup?.(); slots[i] = { deps, cleanup: make() }; }); },
  };
  const original = { ...doc(), instances: [{ id: 'p', name: 'Moving', doc: doc(), position: [9, 8, 7], rotation: [0, 0, 90] }] };
  const args: Loose = { doc: original, evaluated: original, bodies: [], instanceBodies: new Map(), readFaces: async () => tables,
    setDoc(next: Loose) { args.doc = typeof next === 'function' ? next(args.doc) : next; },
    commit(instances: Loose[], mates: Loose[]) { history.push(args.doc); commits.push({ instances, mates }); args.doc = { ...args.doc, instances, mates }; },
  };
  return { args, commits, original,
    render() { cursor = 0; return useAssembly(args); },
    async flush() { const pending = [...effects.values()]; effects.clear(); for (const effect of pending) effect(); await tick(); },
    async ready() { this.render(); await this.flush(); const api = this.render(); await this.flush(); return api; },
    async undo() { const last = history.pop(); assert.ok(last); args.doc = last; return this.ready(); },
    panel(api: Loose) { return MatePanel({ assembly: api, instances: args.doc.instances, instance: 'p', onRefused() {} }); },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); shared.__fastenedHooks = previous; },
  };
}
type Fixture = ReturnType<typeof fixture>;
function pick(f: Fixture, kind?: string, reverse = false) {
  f.render().start();
  if (kind) f.render().setDraft({ kind });
  const refs = [{ part: 'base', face: 'origin:xy' }, { part: 'p', face: 'origin:xy' }];
  if (reverse) refs.reverse();
  f.render().pickFace(refs[0]); f.render().pickFace(refs[1]);
}

test('O24 d UI: explicit Fastened aligns frames in one commit; connector edit and host undo restore the whole change', async () => {
  const f = fixture();
  try {
    await f.ready(); pick(f, 'fastened');
    assert.equal(f.commits.length, 1); vector(f.args.doc.instances[0].position, [0, 0, 0]); vector(f.args.doc.instances[0].rotation, [0, 0, 0]);
    assert.equal(f.args.doc.mates[0].kind, 'fastened');
    const api = await f.ready(); assert.deepEqual(api.freedom.p, { turns: 0, slides: 0 });
    const tree = f.panel(api), select = find(tree, 'Edit mate type');
    assert.equal(select.props.value, 'fastened'); assert.ok(walk(select).some(n => n.type === 'option' && n.props.value === 'fastened'));
    assert.match(text(find(tree, 'Fastened freedom')), /0 DoF/);
    const mate = f.args.doc.mates[0], original = f.args.doc;
    assert.equal(api.edit(mate.id, { a: { ...mate.a, at: { offset: [10, 0, 0] } } }), null);
    assert.equal(f.commits.length, 2); vector(f.args.doc.instances[0].position, [10, 0, 0]);
    const undone = await f.undo(); assert.equal(f.args.doc, original); assert.deepEqual(undone.mates, original.mates);
    vector(f.args.doc.instances[0].position, [0, 0, 0]);
  } finally { f.cleanup(); }
});

test('O24 d UI: classic Auto choice and Lock keep their original motions and placements', async () => {
  for (const mode of ['auto', 'lock']) {
    const f = fixture();
    try {
      const api = await f.ready();
      if (mode === 'auto') pick(f); else assert.equal(api.lock('p', 'base'), null);
      assert.equal(f.commits.length, 1); assert.equal(f.args.doc.mates[0].kind, mode === 'auto' ? 'coincident' : 'lock');
      vector(f.args.doc.instances[0].position, mode === 'auto' ? [9, 8, 0] : [9, 8, 7]);
      vector(f.args.doc.instances[0].rotation, [0, 0, 90]);
      const settled = await f.ready(); assert.deepEqual(settled.freedom.p, mode === 'auto' ? { turns: 1, slides: 2 } : { turns: 0, slides: 0 });
    } finally { f.cleanup(); }
  }
});

test('O24 d UI: reversed fixed pick order still aligns; invalid options, connector geometry and conflicts add no undo record', async () => {
  const f = fixture();
  try {
    await f.ready(); pick(f, 'fastened', true); const api = await f.ready();
    const original = f.args.doc, mate = original.mates[0]; assert.equal(mate.a.part, 'base');
    assert.match(api.edit(mate.id, { distance: 0 }), /VALUE/);
    assert.match(api.edit(mate.id, { a: { ...mate.a, at: { point: 'end' } } }), /CONNECTOR_POINT/);
    assert.equal(f.args.doc, original); assert.equal(f.commits.length, 1);
    api.start(); f.render().setDraft({ kind: 'fastened' });
    f.render().pickFace({ part: 'base', face: 'origin:xy', at: { offset: [1, 0, 0] } });
    f.render().pickFace({ part: 'p', face: 'origin:xy' });
    assert.equal(f.commits.length, 1); assert.equal(f.args.doc, original); assert.match(f.render().draft.error, /Conflicts/);
  } finally { f.cleanup(); }
});

test('O24 d UI: Type offers explicit Fastened; conversion removes only the previous classic scalar, without changing Auto', async () => {
  const f = fixture();
  try {
    const api = await f.ready(); api.start();
    let tree = f.panel(f.render()); const draftType = find(tree, 'Mate type');
    assert.equal(walk(draftType).filter(n => n.type === 'option')[0].props.value, 'auto');
    assert.ok(walk(draftType).some(n => n.type === 'option' && n.props.value === 'fastened'));
    f.render().setDraft({ kind: 'distance', distance: 2 });
    f.render().pickFace({ part: 'base', face: 'origin:xy' }); f.render().pickFace({ part: 'p', face: 'origin:xy' });
    const classic = await f.ready(); tree = f.panel(classic);
    find(tree, 'Edit mate type').props.onChange({ target: { value: 'fastened' } });
    assert.equal(f.args.doc.mates[0].kind, 'fastened'); assert.equal('distance' in f.args.doc.mates[0], false); assert.equal('angle' in f.args.doc.mates[0], false);
    vector(f.args.doc.instances[0].position, [0, 0, 0]); vector(f.args.doc.instances[0].rotation, [0, 0, 0]);
  } finally { f.cleanup(); }
});
