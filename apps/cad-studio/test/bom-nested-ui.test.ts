import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Roadmap 10 ②b (#2180): the BOM panel shows a sub-assembly's nested lines indented under it, the parent named ("Sub ›").
// BomPanel is bundled with recording stand-ins for React and the BOM model, as bom-linked-ui.test.ts does.

// The recorder's hooks, props and JSX records are untyped by nature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Hooks = { useRef: Loose; useState: Loose; useMemo: Loose; useEffect: Loose };
const shared = globalThis as typeof globalThis & { __bomHooks?: Hooks; __bomCalls?: Loose };

// The test runs bundled from a temporary folder, so esbuild is loaded from the studio's own node_modules (cwd).
const studio = process.cwd();
const { build } = createRequire(join(studio, 'package.json'))('esbuild') as typeof import('esbuild');
const temporary = await mkdtemp(join(tmpdir(), 'cad-bom-nested-ui-'));
let BomPanel: (props: Loose) => Loose;
try {
  const outfile = join(temporary, 'panel.mjs');
  await build({ entryPoints: [resolve(studio, 'src/ui/BomPanel.tsx')], outfile, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent',
    plugins: [{ name: 'panel-recorder', setup(builder) {
      builder.onResolve({ filter: /^(react(?:\/jsx-runtime)?|@barocss\/cad-model\/bom\/bom|\.\/files|\.\/atoms)$/ }, args => ({ path: args.path, namespace: 'recorder' }));
      builder.onLoad({ filter: /.*/, namespace: 'recorder' }, ({ path }) => ({ contents:
        // (O16: shadcn's Button takes Radix's Slot, which calls forwardRef as its module loads — and the rest of React's
        // element API when it renders as a child, which the recorder never does: a component's element is recorded.)
        path === 'react' ? 'export const useRef=(...a)=>globalThis.__bomHooks.useRef(...a),useState=(...a)=>globalThis.__bomHooks.useState(...a),useMemo=(...a)=>globalThis.__bomHooks.useMemo(...a),useEffect=(...a)=>globalThis.__bomHooks.useEffect(...a);'
          + 'export const forwardRef=render=>render,memo=type=>type,useCallback=f=>f,Fragment="fragment",isValidElement=()=>false,cloneElement=element=>element,createElement=(type,props,...children)=>({type,props:{...props,children}}),Children={map:()=>[],toArray:()=>[],count:()=>0,only:child=>child,forEach:()=>{}};'
          : path === 'react/jsx-runtime' ? 'export const jsx=(type,props,key)=>({type,props,key}),jsxs=jsx; export const Fragment="fragment";'
          : path === '@barocss/cad-model/bom/bom' ? 'export const bomPanelData=(...a)=>globalThis.__bomCalls.load(...a),purchaseCsv=(data,made)=>data.marker+":"+made,setBought=(doc)=>doc;'
          : path === './files' ? 'export const downloadBytes=(...a)=>globalThis.__bomCalls.downloads.push(a);'
          : 'export const Icon=()=>null;',
      }));
    } }],
  });
  ({ BomPanel } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

const lines = [
  { item: 'Sub', qty: 1, parts: ['sub1'], source: null, estimate: false, assembly: true, material: null },
  { item: 'Block A', qty: 2, parts: ['sub1/p1', 'sub1/p2'], source: null, estimate: false, level: 1, parent: 'sub1', perParent: 2, material: null },
  { item: 'Pin', qty: 1, parts: ['pin'], source: null, estimate: false, material: null },
];
const panel = { marker: 'nested', view: { elements: [], parts: [{ id: 'sub1', name: 'Sub' }] }, bom: { lines, totalQty: 2, totalMass: 0 }, made: [] };
const walk = (node: Loose): Loose[] => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = (tree: Loose): string => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : !tree ? '' : Array.isArray(tree) ? tree.map(text).join('') : text(tree.props?.children);

test('a nested line is indented under its sub-assembly and names the parent; top-level lines are not indented', async () => {
  const slots: Loose[] = [], effects: (() => void)[] = [], timers: (() => void)[] = [], jobs: Loose[] = [];
  let cursor = 0;
  const oldSet = globalThis.setTimeout;
  shared.__bomHooks = {
    useRef(v: unknown) { const i = cursor++; return slots[i] ??= { current: v }; },
    useState(v: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = v; return [slots[i], (n: Loose) => { slots[i] = typeof n === 'function' ? n(slots[i]) : n; }]; },
    useMemo(make: () => unknown) { const i = cursor++; return (slots[i] ??= { value: make() }).value; },
    useEffect(make: () => Loose) { const i = cursor++; if (!slots[i]) { slots[i] = {}; effects.push(() => { slots[i].cleanup = make(); }); } },
  };
  globalThis.setTimeout = ((cb: () => void) => { timers.push(cb); return timers.length; }) as Loose;
  shared.__bomCalls = { downloads: [], load: () => new Promise(resolve => jobs.push(resolve)) };
  try {
    const props: Loose = { doc: { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, instances: [] }, name: 'asm', evaluate: async () => null, onCommit() {}, onClose() {}, onError() {} };
    const render = () => { cursor = 0; return BomPanel(props); };
    render(); effects.splice(0).forEach(e => e()); timers.splice(0).forEach(t => t());
    jobs[0](panel); await Promise.resolve(); await Promise.resolve();
    const tree = render();
    const rows = walk(tree).filter(n => /^BOM line \d+$/.test(n.props?.['aria-label'] ?? ''));
    assert.equal(rows.length, 3);
    const cellOf = (row: Loose) => (row.props.children as Loose[]).filter(Boolean)[1];
    const [sub, block, pin] = rows.map(cellOf);
    assert.equal(sub.props.style, undefined); assert.equal(pin.props.style, undefined);
    assert.ok(block.props.style?.paddingLeft, 'the nested line is indented');
    assert.match(text(block), /^Sub › Block A/);
    assert.match(text(sub), /Sub.*assembly/);
    assert.match(block.props.title, /^Sub › Block A/);
  } finally { shared.__bomHooks = undefined; shared.__bomCalls = undefined; globalThis.setTimeout = oldSet; }
});
