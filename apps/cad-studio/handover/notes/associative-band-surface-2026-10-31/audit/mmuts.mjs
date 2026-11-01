import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const S = '/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/auditB2';
const P = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model';
const M = [
  ['engine/references.ts', 'MM1 band substitution allowed', 'if (typeof m === \'string\' && m !== ref.name && ref.node !== null && out.nodes[ref.node]?.kind === \'band-surface\') {', 'if (false) {'],
  ['engine/references.ts', 'MM2 band moved held as gone', 'if (!(live !== undefined && live === cands.get(m))) m = [m];', 'if (!(live !== undefined && live === cands.get(m))) m = [];'],
  ['engine/references.ts', 'MM3 band groups share A parent', "{ parent: node.b.parent, list: node.b.edges }", "{ parent: node.a.parent, list: node.b.edges }"],
  ['engine/references.ts', 'MM4 unsigned band ignored', "if (n.kind === 'band-surface') { if ([...n.a.edges, ...n.b.edges].some(name => !n.sigs?.[name])) return true; continue; }", "if (n.kind === 'band-surface') continue;"],
  ['engine/references.ts', 'MM5 band refs not edges', "edge: key === 'edges' || node.kind === 'band-surface'", "edge: key === 'edges'"],
  ['engine/rematch.ts', 'MM6 rematch band branch off', "if (node.kind === 'band-surface' && was >= first", "if (false && was >= first"],
  ['engine/rematch.ts', 'MM7 rematch moved allowed', 'if (m === name) continue;', 'if (typeof m === \'string\') continue;'],
  ['engine/doc.ts', 'MM8 parentsOf one parent', "case 'band-surface': return node.a.parent.node === node.b.parent.node ? [node.a.parent.node] : [node.a.parent.node, node.b.parent.node];", "case 'band-surface': return [node.a.parent.node];"],
  ['engine/doc.ts', 'MM9 thickness admitted (checkNode)', "if (input.thickness !== undefined || input.side !== undefined) return 'Band surface: band thickening waits on exact thicken (#2258).';\n  const allowed = new Set(['kind', 'version', 'a', 'b', 'flip', ...NODE_EXTRA_FIELDS]);", "const allowed = new Set(['kind', 'version', 'a', 'b', 'flip', 'thickness', 'side', ...NODE_EXTRA_FIELDS]);"],
  ['engine/doc.ts', 'MM10 same name both sides admitted', 'if (seen.has(name)) return', 'if (false) return'],
  ['engine/doc.ts', 'MM11 file thickness admitted', "if (thickness !== undefined || side !== undefined) return 'Band surface: band thickening waits on exact thicken (#2258).';\n        for", "for"],
  ['engine/part.ts', 'MM12 gone parent not propagated', "if (node.kind === 'band-surface' && (node.suppressed || gone.has(node.a.parent.node) || gone.has(node.b.parent.node))) { gone.add(i); return; }", "if (node.kind === 'band-surface' && node.suppressed) { gone.add(i); return; }"],
  ['engine/part.ts', 'MM13 expect dropped', "...(node.flip ? { flip: true } : {}), ...expectOf(node, [...node.a.edges, ...node.b.edges]) };", "...(node.flip ? { flip: true } : {}) };"],
  ['engine/part.ts', 'MM14 flip dropped', "...(node.flip ? { flip: true } : {}), ...expectOf(", "...expectOf("],
  ['chat/features.ts', 'MM15 named excludes band', "const named = (n: ModelNode): readonly string[] => n.kind === 'band-surface' ? [...n.a.edges, ...n.b.edges] :", "const named = (n: ModelNode): readonly string[] => n.kind === 'band-surface' ? [] :"],
  ['chat/features.ts', 'MM16 renumber skips band', "if (n.kind === 'band-surface') { (n as { a: unknown }).a", "if (false) { (n as { a: unknown }).a"],
  ['engine/flatten.ts', 'MM17 flatten admits band', "if (doc.nodes.some(n => n.kind === 'band-surface')) throw", "if (false) throw"],
  ['app/bandSurfaceCommand.ts', 'MM18 other-side duplicate admitted', "if (other && add.some(n => other.edges.includes(n))) return", "if (false) return"],
  ['app/bandSurfaceCommand.ts', 'MM19 late body admitted', 'return r.node >= this.index ?', 'return false ?'],
  ['app/bandSurfaceCommand.ts', 'MM20 second click does not remove', 'else if (add.every(n => held.edges.includes(n))) edges = held.edges.filter(n => !add.includes(n));', ''],
  ['app/bandSurfaceCommand.ts', 'MM21 edit keeps held', "if (before.held !== undefined) { delete node.held; delete node.suppressed; }", ''],
  ['app/bandSurfaceCommand.ts', 'MM22 edit drops sigs', "if (before.sigs) { const sigs", "if (false) { const sigs"],
  ['engine/evaluate.ts', 'MM23 no band note', "...(o.band ? [{ text: o.band.note }] : []),", ''],
];
mkdirSync(`${S}/mmut`, { recursive: true });
for (const [file, name, from, to] of M) {
  const src = readFileSync(`${P}/src/${file}`, 'utf8');
  if (src.split(from).length !== 2) { console.log(`${name}: PATTERN NOT UNIQUE/FOUND (${src.split(from).length - 1})`); continue; }
  const path = `${S}/mmut/${name.split(' ')[0]}.ts`; writeFileSync(path, src.replace(from, to));
  const r = spawnSync(process.execPath, [`${S}/run.mjs`, `${P}/test/band-surface.test.ts`, '--test'], { env: { ...process.env, SWAP: `${file}=${path}` }, encoding: 'utf8' });
  const out = r.stdout + r.stderr, fail = /# fail (\d+)/.exec(out)?.[1], fails = [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map(m => m[1].slice(0, 50));
  console.log(`${name}: ${r.status === 0 ? 'SURVIVED' : 'killed'} (fail ${fail ?? '?'}) ${fails.join(' | ')}`);
}
