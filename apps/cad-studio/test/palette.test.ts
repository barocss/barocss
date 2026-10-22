import test from 'node:test';
import assert from 'node:assert/strict';
import { commands } from '@barocss/cad-model/app/commands';
import { emptyDoc, rectanglePart } from '@barocss/cad-model/engine/doc';
import { paletteList } from '../src/ui/paletteList';

// D157's fix: a command's keywords must not take another command's label. The Shaft's "fillet chamfer key groove …"
// made "fillet" + Enter open Shaft (Fillet unavailable with nothing picked sorts after it), failing 21 flow steps.
// Typing each command's own label, with nothing picked, gives that command first — over every command.
// (The six collisions older than R12c — pipe, sweep-curve, sheet-flange, frame, tube, move — cleared by the outer
// lane's ranking of a label first, O134: none waits.)
const WAITING = new Set<string>([]);

test('the palette: each command\'s label typed gives that command first (empty part, and a plate with nothing picked)', () => {
  for (const doc of [emptyDoc(), rectanglePart(64, 32, 8)]) {
    const ctx = { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] } }, wrong: string[] = [];
    for (const c of commands) {
      const first = paletteList(c.label, ctx)[0]?.c;
      if (first?.id !== c.id && !WAITING.has(c.id)) wrong.push(`"${c.label}" opens ${first?.label ?? 'nothing'} (${first?.id})`);
    }
    assert.deepEqual(wrong, []);
  }
  // The flow's own palette words.
  const ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  for (const [q, id] of [['fillet', 'fillet'], ['chamfer', 'chamfer'], ['hole', 'hole'], ['interference', 'interference'], ['spring', 'spring'], ['cam', 'cam'], ['sprocket', 'sprocket'], ['pulley', 'pulley'], ['coupling', 'coupling'], ['belt', 'belt-drive'], ['chain', 'belt-drive'], ['connector', 'connector'], ['shaft', 'shaft'], ['worm gear pair', 'worm-pair'], ['meshing gear', 'gear-mesh']] as const)
    assert.equal(paletteList(q, ctx)[0]?.c.id, id, q);
});

test('the palette: no word the browser flow types opens a drive or connector command it did not mean (R12c.6b, D161; R12c.7, D162)', async () => {
  // (Every `.palette input').fill('…')` in the flow, typed into an empty part and a plate: the first command found is never a
  // sprocket, pulley, belt or coupling unless the word names it.)
  const { readFileSync } = await import('node:fs'), { join } = await import('node:path');
  const flow = readFileSync(join(process.cwd(), 'test/browser-flow.mjs'), 'utf8'), words = [...new Set([...flow.matchAll(/\.palette input'\)\.fill\('([^']+)'\)/g)].map(m => m[1]))];
  const drives = new Set(['sprocket', 'pulley', 'belt-drive', 'coupling', 'connector']), wrong: string[] = [];
  for (const doc of [emptyDoc(), rectanglePart(64, 32, 8)]) {
    const ctx = { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] } };
    for (const q of words) { const first = paletteList(q, ctx)[0]?.c; if (first && drives.has(first.id) && !/sprocket|pulley|belt|chain|coupling|connector/.test(q)) wrong.push(`"${q}" opens ${first.label}`); }
  }
  assert.ok(words.length > 30, String(words.length)); assert.deepEqual(wrong, []);
});
