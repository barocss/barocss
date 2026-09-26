// #405: summarize raw/<variant>.json into result.json. A load is "slow" if timeToFinalStyled > 100 ms. "preBoot"
// means the probe's first computed-style sample ran before the runtime inserted its CSS (first frame < boot:done).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? Math.round(s[s.length >> 1] * 10) / 10 : null; };
const mark = (x, n) => x.marks?.find((m) => m[0] === n)?.[1];
const variants = {};
let engine;
for (const f of fs.readdirSync(path.join(HERE, 'raw')).filter((f) => f.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(HERE, 'raw', f)));
  engine = d.engine;
  const rows = d.raw.filter((x) => x.timeToFinalStyled != null).map((x) => {
    const bootDone = mark(x, 'boot:done') ?? mark(x, 'bundle:exec-end');
    return {
      ms: x.timeToFinalStyled, slow: x.timeToFinalStyled > 100, preBoot: x.frameTimes[0] < bootDone,
      bundleFetch: x.res?.[0] ? x.res[0][1] - x.res[0][0] : null, bundleExec: mark(x, 'bundle:exec-end') - mark(x, 'bundle:exec-start'),
      dcl: x.nav?.dcl, bootWork: mark(x, 'boot:done') - (mark(x, 'dcl:first-listener') ?? mark(x, 'boot:call')), bootDone,
      firstFrame: x.frameTimes[0], styleChanges: x.changes.length, animatingFor: x.changes.length > 1 ? x.changes.at(-1) - x.changes[1] : 0,
    };
  });
  const phase = (sel) => {
    const r = rows.filter(sel);
    return r.length ? Object.fromEntries(['ms', 'bundleFetch', 'bundleExec', 'dcl', 'bootWork', 'bootDone', 'firstFrame', 'styleChanges', 'animatingFor']
      .map((k) => [k, med(r.map((x) => x[k]))]).concat([['n', r.length]])) : null;
  };
  variants[d.variant] = {
    arm: d.arm, headless: d.headless, args: d.args, n: rows.length, median: med(rows.map((x) => x.ms)),
    slow: rows.filter((x) => x.slow).length, preBoot: rows.filter((x) => x.preBoot).length,
    slowAndPreBoot: rows.filter((x) => x.slow && x.preBoot).length, max: Math.max(...rows.map((x) => x.ms)),
    fastMedians: phase((x) => !x.slow), slowMedians: phase((x) => x.slow),
  };
}
const out = { issue: 405, date: new Date().toISOString().slice(0, 10), engine, rounds: 10, sections: 4, warmupDiscarded: true, variants };
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
for (const [k, v] of Object.entries(variants)) console.log(k.padEnd(8), `n=${v.n} median=${v.median} slow=${v.slow} preBoot=${v.preBoot} slow&preBoot=${v.slowAndPreBoot} max=${Math.round(v.max)}`);
