import { part, sketch } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/api';
import { encodeStudioFile, readStudioFile } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/container';
import type { StudioDoc, SketchNode } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { ellipseShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/ellipse';
import { settleShape } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/settle';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
import { sketchShapes } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/reopen';
for (const d of [{ center: [0, 0], rx: 30, ry: 12, angle: 20 }, { center: [-4123.456789, 3210.987654], rx: 1234.5678901, ry: 987.654321, angle: -73.3333333 }, { center: [0.1, 0.2], rx: 0.3, ry: 0.07, angle: 0.1 }] as any[]) {
  const s = settleShape(ellipseShape(d), null).shape as any, p: any = profileOf([{ ...s, ids: s.points.map((_: any, i: number) => 'e' + (i + 3)) }]);
  const t = part('so').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }).doc;
  const doc = { ...t, nodes: t.nodes.map((n: any, i: number) => i === 0 ? { ...p.node, id: n.id } : n) } as StudioDoc;
  const bytes = encodeStudioFile(doc); const read: any = await readStudioFile(bytes);
  const back = read.doc ?? read; const node = back.nodes?.[0] as SketchNode;
  const re = sketchShapes(node).shape as any;
  console.log(JSON.stringify(d), 'format', bytes[0] === 0x7b ? 'json' : 'binary', 'bytes', bytes.length, 'readKeys', Object.keys(read).join(','), 'outline.ellipse eq', JSON.stringify(node?.outline?.ellipse) === JSON.stringify(d), 'reopen def', !!re?.ellipse, 'doc eq', JSON.stringify(back) === JSON.stringify(doc));
}
