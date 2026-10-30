import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const D = import.meta.dirname, cur = readFileSync(D + '/select.cur.ts', 'utf8');
const L = "const ids = tagsOf(r, points.map(start => ({ kind: 'line' as const, start })));";
const muts = [
  ['M1 unmapped ids', L, "const ids = r.ids?.length === 4 ? [...r.ids] : null;"],
  ['M2 no construction carry', "...(r.construction ? { construction: true as const } : {})", "...({})"],
  ['M3 reversed loop', L, "const ids = tagsOf(r, [...points].reverse().map(start => ({ kind: 'line' as const, start })));"],
  ['M4 rotated by one', L, "const t0 = tagsOf(r, points.map(start => ({ kind: 'line' as const, start }))), ids = t0 && [...t0.slice(1), t0[0]];"],
  ['M5 ids only from lower-left a', L, "const ids = r.a[0] <= r.b[0] && r.a[1] <= r.b[1] ? r.ids : null;"],
  ['M6 ids mapped with cornersOf of the outline (identity)', L, "const ids = r.ids && r.ids.length === 4 ? r.ids : null;"],
  ['M7 construction always dropped, ids kept', "...(r.construction ? { construction: true as const } : {})", "...(r.construction ? {} : {})"],
  ['M8 construction carried as false', "...(r.construction ? { construction: true as const } : {})", "construction: false as never"],
];
for (const [name, from, to] of muts) {
  if (!cur.includes(from)) { console.log('NOAPPLY', name); continue; }
  writeFileSync(D + '/select.mut.ts', cur.replace(from, to));
  const res = [];
  for (const t of ['m.test.ts', 's.test.ts']) {
    const r = spawnSync(process.execPath, [D + '/run.mjs', D + '/' + t, '--test'], { encoding: 'utf8', env: { ...process.env, SELECT: D + '/select.mut.ts' } });
    res.push(`${t} pass ${/# pass (\d+)/.exec(r.stdout)?.[1]} fail ${/# fail (\d+)/.exec(r.stdout)?.[1]} [${[...r.stdout.matchAll(/^not ok (\d+)/gm)].map(m => m[1]).join(',')}]`);
  }
  console.log(res.every(x => / fail 0 /.test(x)) ? 'SURVIVED' : 'killed  ', name, '|', res.join(' | '));
}
