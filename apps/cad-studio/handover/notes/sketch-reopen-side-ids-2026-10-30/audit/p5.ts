import { finish, reopen } from './lib';
import { roundCorner } from '@barocss/cad-model/sketch/corner';
import { splitAt, trimAt } from '@barocss/cad-model/sketch/trim';
const circle = { kind: 'circle', c: [5, 3], r: 1 };
for (const [lab, a, b] of [['LL', [0, 0], [10, 6]], ['UR', [10, 6], [0, 0]]] as const) {
  const n1 = finish(circle, [{ kind: 'rectangle', a, b }], false), { s } = reopen(n1);
  // Round corner 2 (upper-right) in the sketcher, then Finish.
  const rc: any = roundCorner(s.shape, 2, 1);
  const n2 = 'error' in rc ? rc : finish(rc.shape, s.done, true);
  console.log(lab, 'round corner: tags', JSON.stringify(n1.sideTags), '->', JSON.stringify(n2.sideTags ?? n2.error), 'profile', n2.profile);
  // Split the bottom edge at (5,0), then Finish.
  const sp: any = splitAt([s.shape, ...s.done], [5, 0], 0.1);
  const n3 = 'error' in sp ? sp : finish(sp.shapes[0], sp.shapes.slice(1), true);
  console.log(lab, 'split bottom: tags ->', JSON.stringify(n3.sideTags ?? n3.error), 'profile', n3.profile);
}
