import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { libraries, libraryById, loadUserLibraries, registerLibrary, setLibraryStore, unregisterLibrary } from '@barocss/cad-model/library/libraries';

// PKG-b (O92): the four blockers cut in place, kept cut — the model's code (sketch/, assembly/drag, library/, the CLI)
// imports nothing from viewport/ or ui/, and library/ reaches no browser storage: the user's libraries go to the store
// the app sets, and with none (a test, the CLI) nothing is kept.

const root = process.cwd();
const src = (p: string) => readFileSync(join(root, p), 'utf8');
const IMPORT = /^\s*(?:import|export)\b[^;]*?from\s+'([^']+)'/gm;
const importsOf = (p: string) => [...src(p).matchAll(IMPORT)].map(m => m[1]);

test('PKG-b the blockers stay cut: sketch/*, assembly/drag, library/*, the CLI import nothing from viewport/ or ui/; library/ reaches no localStorage', () => {
  // (PKG-f, O97: the model is all in the package; the server — the CLI, MCP, chat server, ab — imports nothing of the UI.)
  const files = readdirSync(join(root, 'server'), { recursive: true }).map(String).filter(f => f.endsWith('.ts')).map(f => `server/${f}`);
  assert.ok(files.includes('server/cadCli.ts'));
  for (const f of files) for (const spec of importsOf(f)) assert.ok(!/(^|\/)src\/(?!ui\/|viewport\/)/.test(spec) || /src\/(app\/(recovery|templates)|chat\/(client|images)|engine\/client|assembly\/(useAssembly|faceClient)|subd\/useCageEditor)/.test(spec), `${f} imports the model by path: ${spec}`);
  for (const f of files) for (const spec of importsOf(f)) assert.ok(!/(^|\/)(viewport|ui)\//.test(spec), `${f} imports ${spec}`);
  // (PKG-c, O95: what moved to @barocss/cad-model imports nothing of the app — relative paths stay inside the package.)
  const pkg = join(root, '../../packages/barocss-cad-model/src'), moved: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d, { withFileTypes: true })) { const p = join(d, n.name); if (n.isDirectory()) walk(p); else if (n.name.endsWith('.ts')) moved.push(p); } };
  walk(pkg); assert.ok(moved.length >= 190, String(moved.length));
  for (const f of moved) for (const m of readFileSync(f, 'utf8').matchAll(IMPORT)) assert.ok(!m[1].startsWith('.') || !join(f, '..', m[1]).startsWith(join(root, 'src')), `${f} reaches back into the app: ${m[1]}`);
  for (const f of moved) for (const m of readFileSync(f, 'utf8').matchAll(IMPORT)) assert.ok(!/^(react|@barocss\/gpu)/.test(m[1]), `${f} imports ${m[1]}`);
  // (PKG-e, O96: the library — moved — still reaches no browser storage.)
  for (const f of moved.filter(x => x.includes('/library/'))) assert.ok(!/\blocalStorage\s*[?.]/.test(readFileSync(f, 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')), `${f} reaches localStorage`);
  assert.ok(moved.some(x => x.endsWith('/library/libraries.ts')), 'the library moved');
  // (The UI still reads the moved names from where it did: re-exported.)
  assert.match(src('src/viewport/Viewport.tsx'), /export type \{ SketchTool, SketchShape, SketchAnchor, SketchState, Make \} from '@barocss\/cad-model\/sketch\/types'/);
  assert.match(src('src/viewport/gizmo.ts'), /export type \{ Axis3 \} from '@barocss\/cad-model\/engine\/vec3'/);
  assert.match(src('src/ui/files.ts'), /export \{ meshToStl \} from '@barocss\/cad-model\/engine\/stl'/);
});

test('PKG-b the user\'s libraries go to the store the app sets: kept there and read back; with none set nothing is kept', () => {
  const v = JSON.parse(JSON.stringify(libraryById('tslot-20')!.manifest)); v.id = 'tslot-20-pkg'; v.libraryVersion = '0.3.0';
  const kept = new Map<string, string>(), store = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, s: string) => { kept.set(k, s); } };
  try {
    // None set: registering keeps nothing anywhere.
    setLibraryStore(null); registerLibrary(v, 'user'); assert.equal(kept.size, 0);
    unregisterLibrary('tslot-20-pkg');
    // Set: registering writes the user's libraries to it, and loading reads them back.
    setLibraryStore(store); registerLibrary(v, 'user');
    const saved = JSON.parse(kept.get('barocss-cad-user-libraries')!) as { library: { id: string } }[];
    assert.deepEqual(saved.map(x => x.library.id), ['tslot-20-pkg']);
    unregisterLibrary('tslot-20-pkg'); assert.ok(!libraries().some(e => e.library.manifest.id === 'tslot-20-pkg'));
    kept.set('barocss-cad-user-libraries', JSON.stringify(saved));
    assert.deepEqual(loadUserLibraries(), []); assert.ok(libraryById('tslot-20-pkg'), 'read back from the store');
  } finally { unregisterLibrary('tslot-20-pkg'); setLibraryStore(null); }
});
