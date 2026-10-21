import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { libraries, libraryById, loadUserLibraries, registerLibrary, setLibraryStore, unregisterLibrary } from '../src/library/libraries';

// PKG-b (O92): the four blockers cut in place, kept cut — the model's code (sketch/, assembly/drag, library/, the CLI)
// imports nothing from viewport/ or ui/, and library/ reaches no browser storage: the user's libraries go to the store
// the app sets, and with none (a test, the CLI) nothing is kept.

const root = process.cwd();
const src = (p: string) => readFileSync(join(root, p), 'utf8');
const IMPORT = /^\s*(?:import|export)\b[^;]*?from\s+'([^']+)'/gm;
const importsOf = (p: string) => [...src(p).matchAll(IMPORT)].map(m => m[1]);

test('PKG-b the blockers stay cut: sketch/*, assembly/drag, library/*, the CLI import nothing from viewport/ or ui/; library/ reaches no localStorage', () => {
  const files = [...readdirSync(join(root, 'src/sketch')).filter(f => f.endsWith('.ts')).map(f => `src/sketch/${f}`), 'src/assembly/drag.ts',
    ...readdirSync(join(root, 'src/library')).filter(f => f.endsWith('.ts')).map(f => `src/library/${f}`), 'server/cadCli.ts', 'src/engine/stl.ts', 'src/engine/vec3.ts'];
  for (const f of files) for (const spec of importsOf(f)) assert.ok(!/(^|\/)(viewport|ui)\//.test(spec), `${f} imports ${spec}`);
  for (const f of files.filter(x => x.startsWith('src/library/'))) assert.ok(!/\blocalStorage\s*[?.]/.test(src(f).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')), `${f} reaches localStorage`);
  // (The UI still reads the moved names from where it did: re-exported.)
  assert.match(src('src/viewport/Viewport.tsx'), /export type \{ SketchTool, SketchShape, SketchAnchor, SketchState, Make \} from '\.\.\/sketch\/types'/);
  assert.match(src('src/viewport/gizmo.ts'), /export type \{ Axis3 \} from '\.\.\/engine\/vec3'/);
  assert.match(src('src/ui/files.ts'), /export \{ meshToStl \} from '\.\.\/engine\/stl'/);
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
