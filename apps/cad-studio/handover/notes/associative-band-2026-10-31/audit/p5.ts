import { withIds } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/entityIds';
import { partSnapshot } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/part';
import { massPropertiesOf } from '@barocss/cad';
import { bandOver } from './geo';
for (const [name, sh] of [['collinear 1e-9', [[0, 0, 10], [50, 1e-9, 10], [100, 0, 10]]], ['collinear 1e-6', [[0, 0, 10], [50, 1e-6, 10], [100, 0, 10]]], ['dy1e-8+rect', null]] as const) {
  const shapes = sh ? sh.map(([x, y, r]) => ({ kind: 'circle', c: [x, y], r, construction: true })) : [{ kind: 'circle', c: [0, 0], r: 10, construction: true }, { kind: 'circle', c: [100, 1e-8], r: 10, construction: true }, { kind: 'rectangle', a: [40, -60], b: [60, -40], construction: true }];
  const all = withIds(shapes as never), band = bandOver(all, all.map((_, i) => i));
  const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'band', band, construction: all, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 5, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as never;
  try { console.log(name, 'volume', massPropertiesOf(partSnapshot(doc).outputs[0], 1).volume); } catch (e) { console.log(name, 'REFUSED', (e as Error).message.slice(0, 200)); }
}
