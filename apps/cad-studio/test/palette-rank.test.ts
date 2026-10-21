import test from 'node:test';
import assert from 'node:assert/strict';
import { commands } from '@barocss/cad-model/app/commands';
import { paletteOrder, rankOf } from '../src/ui/paletteRank';

// The palette's ranking (the coordinator's request after 8788eafec: Shaft lists "fillet" in its keywords and came first
// for "fillet"): a command's own label always beats another's keywords.
const all = (ok: (id: string) => boolean = () => true) => commands.map(c => ({ c, ok: ok(c.id) }));

test('every command, its label typed, comes first (or one of the same label does), available or not', () => {
  const wrong: string[] = [];
  for (const c of commands) for (const ok of [() => true, (id: string) => id !== c.id]) {
    const first = paletteOrder(all(ok), c.label)[0]?.c;
    if (first?.label.toLowerCase() !== c.label.toLowerCase()) wrong.push(`${c.label} → ${first?.label}`);
  }
  assert.deepEqual(wrong, []);
});

test('a keyword never beats a label: "fillet" gives Fillet before any command only keyed so', () => {
  const fake = { id: 'shaft', label: 'Shaft', keywords: 'fillet chamfer keyway' };
  const list = [{ c: fake, ok: true }, ...commands.map(c => ({ c: c as typeof fake, ok: false }))];
  for (const word of ['fillet', 'chamfer']) {
    const order = paletteOrder(list, word), at = order.findIndex(x => x.c.id === 'shaft');
    assert.ok(at > 0, `${word}: Shaft is ${at}`);
    assert.ok(order.slice(0, at).every(x => (rankOf(x.c, word) ?? 9) < 4), `${word}: only label matches before Shaft`);
    assert.match(order[0].c.label.toLowerCase(), new RegExp(word));
  }
  // (Prefix before a word inside the label, both before a keyword.)
  assert.deepEqual([rankOf(fake, 'shaft'), rankOf(fake, 'sha'), rankOf({ id: 'x', label: 'Linear pattern' }, 'pat'), rankOf(fake, 'keyway')], [0, 1, 2, 4]);
  assert.equal(rankOf(fake, 'nothing'), null);
});
