import test from 'node:test';
import assert from 'node:assert/strict';
import { commands } from '@barocss/cad-model/app/commands';
import { emptyDoc, rectanglePart } from '@barocss/cad-model/engine/doc';
import { paletteList } from '../src/ui/paletteList';

// D157's fix: a command's keywords must not take another command's label. The Shaft's "fillet chamfer key groove …"
// made "fillet" + Enter open Shaft (Fillet unavailable with nothing picked sorts after it), failing 21 flow steps.
// Typing each command's own label, with nothing picked, gives that command first — over every command.
// (Six collisions older than R12c are named: they wait for the outer lane's ranking of an exact label first, and this
// list must only shrink.)
const WAITING = new Set(['pipe', 'sweep-curve', 'sheet-flange', 'frame', 'tube', 'move']);

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
  for (const [q, id] of [['fillet', 'fillet'], ['chamfer', 'chamfer'], ['hole', 'hole'], ['interference', 'interference'], ['spring', 'spring'], ['shaft', 'shaft'], ['worm gear pair', 'worm-pair'], ['meshing gear', 'gear-mesh']] as const)
    assert.equal(paletteList(q, ctx)[0]?.c.id, id, q);
});
