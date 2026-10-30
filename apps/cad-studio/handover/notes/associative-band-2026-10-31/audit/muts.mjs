import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const D = import.meta.dirname, T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20';
const M = T + '/packages/barocss-cad-model', S = T + '/apps/cad-studio';
const F = { band: 'barocss-cad-model/src/sketch/band.ts', reopen: 'barocss-cad-model/src/sketch/reopen.ts', part: 'barocss-cad-model/src/engine/part.ts', usa: 'cad-studio/src/sketch/useSketchActions.ts', prof: 'barocss-cad-model/src/app/profiles.ts', dxf: 'barocss-cad-model/src/sketch/dxf.ts' };
const P = { band: M + '/src/sketch/band.ts', reopen: M + '/src/sketch/reopen.ts', part: M + '/src/engine/part.ts', usa: S + '/src/sketch/useSketchActions.ts', prof: M + '/src/app/profiles.ts', dxf: M + '/src/sketch/dxf.ts' };
const muts = [
  ['band', 'crossing sign', 'const q = (k.r - g.r) / D;', 'const q = (g.r - k.r) / D;'],
  ['band', 'skip pairwise check', 'const problem = pairProblem(srcs, scale);', 'const problem = null as string | null;'],
  ['band', 'drop not-reached refusal (silent drop)', "for (let k = 0; k < srcs.length; k++) if (!won.has(k)) return", "for (let k = 0; k < 0; k++) if (!won.has(k)) return"],
  ['band', 'drop a winner piece (skip first item)', 'const won = new Set(items.map(p => p.g.src));', 'items.splice(0, 1); const won = new Set(items.map(p => p.g.src));'],
  ['band', 'crossing active check off', 'if (active(g, t) && active(k, t)) cand.push(t);', 'cand.push(t);'],
  ['band', 'no cone endpoints', 'for (const g of all) cand.push(g.a0, g.a0 + g.len);', ''],
  ['band', 'only + crossing', 'for (const t of [phi + da, phi - da])', 'for (const t of [phi + da])'],
  ['band', 'no CW flip', 'const flip = loopArea(raw) < 0,', 'const flip = false,'],
  ['band', 'convexity off', "if (cr < -1e-9 || (dt < 0 && cr < 1e-9)) return 'convex';", ''],
  ['band', 'tie check off', 'if (bh - sh < 1e-9 * scale) return', 'if (false) return'],
  ['band', 'hole at d+w', 'const inner = hullLoop(items, d, b.id,', 'const inner = hullLoop(items, d + w * 0.5, b.id,'],
  ['band', 'no _n suffix', "const named = tags.map(t => { if (count.get(t)! < 2) return t;", "const named = tags.map(t => { if (true) return t;"],
  ['band', 'MIN_ARC off', 'if (rho < MIN_ARC) return', 'if (false) return'],
  ['band', 'COORD off', 'if (Math.max(Math.abs(g.c[0]), Math.abs(g.c[1])) + rho > COORD) return', 'if (false) return'],
  ['band', 'touch threshold 0', 'if (d < MIN_LINE) return', 'if (d < 0) return'],
  ['band', 'containment off', 'if (excess(B, A) <= 1e-9 * scale) return', 'if (false) return'],
  ['band', 'collapse tiny arcs off', 'wide = rho > 0 && rho * (b - a) >= MIN_LINE', 'wide = rho > 0'],
  ['band', 'ambiguous-holder check off', 'if (holders.length > 1) return', 'if (false) return'],
  ['band', 'non-construction accepted', 's.construction && s.ids?.includes(ref)', 's.ids?.includes(ref)'],
  ['band', 'bandSketchNode allows other shapes', "if (all.some(s => !s.construction && s.kind !== 'bezier' && shapeNode(s))) return { error: ONLY };", ''],
  ['band', 'bandProfile ignores params', 'v = resolveSketchDims(node, params);', 'v = resolveSketchDims(node, Object.fromEntries(Object.keys(params).map(k => [k, 1])));'],
  ['reopen', 'reopen returns stored band', "if (node.profile === 'band') return { shape: null, done: constructionOf(node), band: node.band };", "if (node.profile === 'band') return { shape: null, done: constructionOf(node), band: (stored as { band: never }).band };"],
  ['reopen', 'id seed ignores construction', 'let k = nextIdOf(constructionOf(node));', 'let k = 1;'],
  ['reopen', 'band slots not named', "leaves: Object.values(value), named: true,", "leaves: Object.values(value),"],
  ['reopen', 'no construction slots', "(node.construction ?? []).forEach((c, i) => {", "([] as unknown[]).forEach((c, i) => {"],
  ['part', 'stale band (no branch)', "if (node.profile === 'band') { features.push(...featuresOf(bandProfile(node, params, i), i, CadPartLimits.features - features.length)); return; }", ''],
  ['part', 'band without params', 'featuresOf(bandProfile(node, params, i)', 'featuresOf(bandProfile(node, {}, i)'],
  ['usa', 'construction ids skipped at Finish', 'const shapes = withIds(joinOpen(', 'const shapes = ((x: SketchShape[]) => x)(joinOpen('],
  ['usa', 'reopen without band', "...(reopened.band ? { band: reopened.band } : {}),", ''],
  ['usa', 'reopen with node.band', "...(reopened.band ? { band: reopened.band } : {}),", "...(reopened.band ? { band: (node as { band: never }).band } : {}),"],
  ['usa', 'band refusal ignored at Finish', "if (banded && 'error' in banded) { setToast({ title: 'Cannot finish the band', hint: banded.error, detail: '' }); return; }", ''],
  ['prof', 'valued skips band', "if (n.profile === 'band') return bandProfile(n, params, index);", ''],
  ['dxf', 'dxf skips band', 'const node = bandProfile(sketch, parameters) as', 'const node = sketch as'],
];
mkdirSync(D + '/mut', { recursive: true });
const only = process.argv[2];
for (const [f, name, from, to] of muts) {
  if (only && !name.includes(only)) continue;
  const cur = readFileSync(P[f], 'utf8');
  if (!cur.includes(from)) { console.log('NOAPPLY', name); continue; }
  const mf = D + '/mut/' + f + '.ts'; writeFileSync(mf, cur.replace(from, to));
  const env = { ...process.env, SWAP: F[f] + '=' + mf };
  const res = [];
  for (const [label, file, test, extra] of [['geo', M + '/test/sketch-band-geometry.test.ts', true], ['id', M + '/test/sketch-band-identity.test.ts', true], ['studio', S + '/test/sketch-band-studio.test.ts', true, { DIRNAME: S + '/test' }], ['p1', D + '/p1.ts', false, { CASES: '250', KEVERY: '25', SEED: '5' }]]) {
    const r = spawnSync(process.execPath, [D + '/run.mjs', file, ...(test ? ['--test'] : [])], { encoding: 'utf8', env: { ...env, ...(extra ?? {}) }, timeout: 300000 });
    const out = r.stdout + r.stderr;
    if (test) res.push(`${label}:${/# fail (\d+)/.exec(out)?.[1] ?? 'ERR'}`);
    else res.push(`${label}:${/FAILS (\d+)/.exec(out)?.[1] ?? 'ERR'}`);
  }
  const killed = res.some(x => !/:0$/.test(x));
  console.log(killed ? 'killed  ' : 'SURVIVED', name.padEnd(42), res.join(' '));
}
