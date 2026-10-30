import { encodeStudioFile, readStudioFile } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/container';
import { withNode, emptyDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { profileOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/loops';
const p: any = profileOf([{ kind: 'rectangle', a: [0, 0], b: [10, 6] } as any]);
for (const c of [[{ kind: 'bezier', poles: [[0, 20], [10.123456789012, 40], [20, 20], [1e-12, 3]] }], [{ kind: 'bezier' }]]) {
  const doc = withNode(emptyDoc(), { ...p.node, construction: c });
  try { const enc: any = await encodeStudioFile(doc as any); const back: any = await readStudioFile(enc); const node = (back.doc ?? back).nodes?.[0]; console.log('save/open construction', JSON.stringify(c), '->', JSON.stringify(node?.construction), 'same', JSON.stringify(node?.construction) === JSON.stringify(c)); }
  catch (e: any) { console.log('THROW', JSON.stringify(c), e.message.slice(0, 150)); }
}
