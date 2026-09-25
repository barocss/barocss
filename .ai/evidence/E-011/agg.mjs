// E-011 aggregation (method steps 8-9). Uniform metrics across the three arms, all on the pinned commit bf979c6:
//   arm0 = E-007's recorded G1/G2/G3 runs (the pinned commit IS E-007's world; harness frozen) — the baseline.
//   arm1 = BaroCSS resolution report injected after first generation (.ai/evidence/E-011/runs/G*.arm1.json).
//   arm2 = browser computed-style control report (.ai/evidence/E-011/runs/G*.arm2.json).
// Primary metric: first-try silent parity misses shipped under a "done" claim (comparable to E-007's 7 of 8).
// Secondary: first-try parity misses self-detected/fixed before the claim. Plus, for arm1/arm2, how many of the
// misses the injected report flagged were fixed before the claim (the causal link).
// Usage: node .ai/evidence/E-011/agg.mjs  -> writes audit.json and prints the table.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const E007 = join(HERE, '..', 'E-007', 'runs');
const TASKS = ['G1', 'G2', 'G3'];
const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
// a claim "names" a miss token only as a whole class token (avoid `shadow` ⊂ `shadow-xl`, per E-007's caveat).
const names = (text, tok) => { if (!text) return false; const re = new RegExp('(^|[^\\w:/.-])' + tok.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&') + '(?![\\w:/.-])'); return re.test(text); };

function runMetrics(r) {
  const firstTry = r.first_try?.misses ?? [];
  const final = r.final_section?.misses ?? [];
  const claim = r.final_text || '';
  const selfFixed = firstTry.filter((t) => !final.includes(t));                 // gone from the section before the claim
  const shippedNamed = final.filter((t) => names(claim, t));                    // present in section AND named in the claim
  const shippedSilent = final.filter((t) => !names(claim, t));                  // present in section, NOT named → silent under "done"
  const flagged = (r.injected_report?.[0]?.rows ?? []).filter((x) => x.status && x.status !== 'RESOLVED').map((x) => x.cls);
  const flaggedFixed = flagged.filter((t) => firstTry.includes(t) && !final.includes(t));
  return { task: r.run, arm: r.arm ?? 'arm0', firstTry, final, selfFixed, shippedNamed, shippedSilent, claimNamesAny: shippedNamed.length > 0 || firstTry.some((t) => names(claim, t)),
    turns: r.num_turns, cost: r.cost_usd, graderPass: r.grader?.pass ?? false, graderReasons: r.grader?.reasons ?? [], flagged, flaggedFixed };
}

function arm(label, files) {
  const rows = files.filter((f) => existsSync(f)).map((f) => runMetrics(rd(f)));
  const sum = (k) => rows.reduce((a, r) => a + r[k].length, 0);
  return { label, present: rows.length, rows,
    firstTryMisses: sum('firstTry'), selfFixed: sum('selfFixed'), shippedSilent: sum('shippedSilent'), shippedNamed: sum('shippedNamed'),
    reportFlagged: rows.reduce((a, r) => a + r.flagged.length, 0), reportFlaggedFixed: rows.reduce((a, r) => a + r.flaggedFixed.length, 0) };
}

const arm0 = arm('arm0 (E-007 baseline, no report)', TASKS.map((t) => join(E007, `${t}.json`)));
const arm1 = arm('arm1 (BaroCSS resolution report)', TASKS.map((t) => join(HERE, 'runs', `${t}.arm1.json`)));
const arm2 = arm('arm2 (computed-style control)', TASKS.map((t) => join(HERE, 'runs', `${t}.arm2.json`)));

const out = { pin: 'bf979c6', primaryMetric: 'first-try parity misses shipped silently under a "done" claim', arms: [arm0, arm1, arm2] };
writeFileSync(join(HERE, 'audit.json'), JSON.stringify(out, null, 2) + '\n');

const pad = (s, n) => String(s).padEnd(n);
console.log('\nPrimary metric = first-try parity misses SHIPPED SILENTLY under a "done" claim (lower is better). Pin bf979c6, n=1/task.\n');
console.log(pad('arm', 36), pad('runs', 5), pad('firstTryMiss', 13), pad('shippedSilent', 14), pad('selfFixed', 10), 'reportFlagged→fixed');
for (const a of [arm0, arm1, arm2]) console.log(pad(a.label, 36), pad(a.present, 5), pad(a.firstTryMisses, 13), pad(a.shippedSilent, 14), pad(a.selfFixed, 10), a.label.startsWith('arm0') ? '-' : `${a.reportFlagged}→${a.reportFlaggedFixed}`);
console.log('\nPer-run detail:');
for (const a of [arm0, arm1, arm2]) { console.log(`\n${a.label}:`); for (const r of a.rows) console.log(`  ${r.task}: firstTry[${r.firstTry.join(' ')||'-'}] shippedSilent[${r.shippedSilent.join(' ')||'-'}] selfFixed[${r.selfFixed.join(' ')||'-'}] ${r.arm!=='arm0'?`flagged→fixed[${r.flagged.length}→${r.flaggedFixed.length}]`:''}`); }
