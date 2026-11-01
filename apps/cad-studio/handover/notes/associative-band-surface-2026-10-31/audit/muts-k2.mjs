// node muts.mjs [filter] — one-replacement mutants of the kernel band files, each run against the kernel test (source bundle).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const S = '/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/auditB2';
const K = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad/src';
const F = { bs: 'features/band-surface.ts', sh: 'brep/band-sheet.ts', pb: 'part/part-band.ts' };
const M = [
  ['bs', 'K1 no seam choice (new code)', 'if (closed) { const seamed = startedNear(B, startOf(A.pieces[0])); B = seamed.chain; cut = seamed.cut; }', ''],
  ['bs', 'K2 piece pairing ignores the cut', 'const same = counts[0] === counts[1] && !cut;', 'const same = counts[0] === counts[1];'],
  ['bs', 'K3 seam rotation off by one', 'return { chain: { closed: true, pieces: rotate(list, k + 1) }, cut: true };', 'return { chain: { closed: true, pieces: rotate(list, k) }, cut: true };'],
  ['bs', 'K4 always snap to a piece start', 'atStart = dist(at0, startOf(piece)) <= 1e-9 * scale', 'atStart = dist(at0, startOf(piece)) <= 1e9 * scale'],
  ['bs', 'M1 drop B reverse', 'if (reverse) B = reverseChain(B);', ''],
  ['bs', 'M2 open orientation inverted', 'reverse = turned < keep * (1 - 1e-9);', 'reverse = !(turned < keep * (1 - 1e-9));'],
  ['bs', 'M3 closed orientation inverted', 'reverse = c < 0;', 'reverse = c > 0;'],
  ['bs', 'M4 no seam choice', 'if (closed) B = startedNear(B, startOf(A.pieces[0]), same);', ''],
  ['bs', 'M5 seam at vertex for by-length', 'if (closed) B = startedNear(B, startOf(A.pieces[0]), same);', 'if (closed) B = startedNear(B, startOf(A.pieces[0]), true);'],
  ['bs', 'M6 seam at nearest point for equal counts', 'if (closed) B = startedNear(B, startOf(A.pieces[0]), same);', 'if (closed) B = startedNear(B, startOf(A.pieces[0]), false);'],
  ['bs', 'M7 skip split (A joints only)', 'breaks = breaksOf(fa, fb);', 'breaks = breaksOf(fa, fa);'],
  ['bs', 'M8 linear length inverse', 'let a = lo(c), b = hi(c), s = a + (b - a) * target / total;', 'let a = lo(c), b = hi(c), s = a + (b - a) * target / total; if (total > 0) return s;'],
  ['bs', 'M9 elevation weights swapped', 'out.push([0, 1, 2, 3].map(j => (left ? f * left[j] : 0) + (right ? (1 - f) * right[j] : 0)));', 'out.push([0, 1, 2, 3].map(j => (left ? (1 - f) * left[j] : 0) + (right ? f * right[j] : 0)));'],
  ['bs', 'M10 MERGE 0', 'const MERGE = 1e-4;', 'const MERGE = 0;'],
  ['bs', 'M11 MERGE 0.2', 'const MERGE = 1e-4;', 'const MERGE = 0.2;'],
  ['bs', 'M12 no TOUCH', "if (dist(pa, pb) < TOUCH) refuse(", "if (false) refuse("],
  ['bs', 'M13 no DEGENERATE', "if (!(n > 1e-7 * len(su) * len(sv))) refuse(", "if (false) refuse("],
  ['bs', 'M14 no OBLIQUE', 'if (!(Math.abs(c) >= 0.1)) refuse(', 'if (false) refuse('],
  ['bs', 'M15 MAX_PIECES 33', 'const MAX_PIECES = 32, MAX_POLES = 16;', 'const MAX_PIECES = 33, MAX_POLES = 16;'],
  ['bs', 'M16 no 16-pole precheck', 'if (ca.controlPoints.length > MAX_POLES || cb.controlPoints.length > MAX_POLES) refuse(', 'if (false) refuse('],
  ['bs', 'M17 no branch refusal', "for (const [v, list] of incidence) if (list.length > 2) refuse(", "for (const [v, list] of incidence) if (false) refuse("],
  ['bs', 'M18 retarget fallback by base name', 'const list = side.brep.edges.filter(e => e.name === name);', "let list = side.brep.edges.filter(e => e.name === name); if (!list.length) list = side.brep.edges.filter(e => (e.name ?? '').split('#')[0] === name.split('#')[0]);"],
  ['bs', 'M19 cut slice off by one', 'h: w.h.slice(i0 - 1), ev: c.ev }];', 'h: w.h.slice(i0), ev: c.ev }];'],
  ['bs', 'M20 deviation vs itself', 'deviation = Math.max(deviation, dist(pa, a.ev(sa)), dist(pb, b.ev(sb)));', 'deviation = Math.max(deviation, 0);'],
  ['bs', 'M21 flip ignored', 'if (input.flip) reverse = !reverse;', ''],
  ['bs', 'M22 closed↔open allowed', "if (A.closed !== B.closed) refuse(", "if (false) refuse("],
  ['bs', 'M23 chain reversal not applied', 'return l.rev ? reversePiece(p) : p;', 'return p;'],
  ['bs', 'M24 reversed piece knots not mirrored', 'knots: [...c.knots].reverse().map(k => k === a ? b : k === b ? a : a + b - k), h: [...c.h].reverse()', 'knots: [...c.knots], h: [...c.h].reverse()'],
  ['bs', 'M25 insertKnot alpha flipped', 'h.push(c.h[i].map((x, j) => (1 - al) * c.h[i - 1][j] + al * x));', 'h.push(c.h[i].map((x, j) => al * c.h[i - 1][j] + (1 - al) * x));'],
  ['bs', 'M26 equal counts paired by length', 'const counts: [number, number] = [A.pieces.length, B.pieces.length], same = counts[0] === counts[1];', 'const counts: [number, number] = [A.pieces.length, B.pieces.length], same = false;'],
  ['sh', 'M27 closed seam not shared', 'rulings = closed ? n : n + 1;', 'rulings = n + 1;'],
  ['sh', 'M28 ruling names off', "const near = closed ? `${id}.band${(k + n - 1) % n}`", "const near = closed ? `${id}.band${k % n}`"],
  ['pb', 'M29 expect not checked', 'if (expect) for (const s of sides) checkExpected(', 'if (false) for (const s of sides) checkExpected('],
  ['pb', 'M30 thickness admitted', "if (Object.hasOwn(f, 'thickness') || Object.hasOwn(f, 'side')) fail(", "if (false) fail("],
  ['pb', 'M31 duplicate names admitted', "if (seen.has(n)) fail(", "if (false) fail("],
];
const only = process.argv[2];
mkdirSync(`${S}/mut`, { recursive: true });
for (const [file, name, from, to] of M) {
  if (only && !name.startsWith(only + ' ')) continue;
  const src = readFileSync(`${K}/${F[file]}`, 'utf8');
  if (src.split(from).length !== 2) { console.log(`${name}: PATTERN NOT UNIQUE/FOUND`); continue; }
  const path = `${S}/mut/${name.split(' ')[0]}.ts`; writeFileSync(path, src.replace(from, to));
  const extra = process.env.PROBE ? [process.env.PROBE] : [`${S}/ktest.mjs`, '--test'];
  const r = spawnSync(process.execPath, [`${S}/run.mjs`, ...extra], { env: { ...process.env, SWAP: `${F[file]}=${path}` }, encoding: 'utf8' });
  const out = r.stdout + r.stderr, fail = /# fail (\d+)/.exec(out)?.[1], fails = [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map(m => m[1].slice(0, 60));
  console.log(`${name}: ${r.status === 0 ? 'SURVIVED' : 'killed'} (fail ${fail ?? '?'}) ${fails.join(' | ')}`);
}
