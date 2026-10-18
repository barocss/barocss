// The robustness runner (RB1): every case file under the given folders through the kernel in a pool of
// worker processes, each case under a SIGKILL timeout, each stage classified (scripts/rb/stages.mjs). Prints
// the pass rate per stage × category × input class with p50/p95 times, marks known failures (robustness/
// todo.json) as TODO and fixed ones as IMPROVEMENT, and fails (exit 1) on a failure that is not known.
//   node scripts/rb/run.mjs [folders…] [--jobs N] [--timeout S] [--out rows.jsonl] [--record]
// Default folders: conformance/ and robustness/corpus/. --record appends one summary row to
// robustness/trend.jsonl, keyed by the commit and the dataset's hash. Needs dist/ (build:library).
import { fork, execSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileHash, STATUSES } from './stages.mjs';

const pkg = resolve(import.meta.dirname, '../..'), args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const valued = new Set(['--jobs', '--timeout', '--out']);
const folders = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const roots = (folders.length ? folders : ['conformance', 'robustness/corpus']).map(f => resolve(pkg, f)).filter(existsSync);
const jobs = Number(option('--jobs', Math.max(1, availableParallelism() - 1))), timeout = 1000 * Number(option('--timeout', 120));
const out = resolve(option('--out', join(tmpdir(), 'barocss-rb-rows.jsonl'))), record = args.includes('--record');

/** Case files under a root: part documents (.json) and STEP files, with their input class and category. */
function casesOf(root) {
  const found = [], walk = dir => { for (const name of readdirSync(dir).sort()) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(json|step|stp)$/i.test(name) && name !== 'todo.json') found.push(p); } };
  walk(root);
  // (A conformance case a later step superseded is the record of what its step promised: not run, conformance/README.)
  return found.flatMap(file => {
    const rel = relative(root, file).split(sep), json = file.endsWith('.json') ? JSON.parse(readFileSync(file, 'utf8')) : null;
    if (json?.supersededBy) return [];
    const inputClass = json ? (json.input?.partDocument ? 'conformance' : 'part') : 'step';
    return [{ file, id: `${root.split(sep).pop()}/${rel.join('/')}`, inputClass, category: rel.length > 1 ? rel.slice(0, -1).join('/') : root.split(sep).pop() }];
  });
}
const cases = roots.flatMap(casesOf);
if (!cases.length) { console.error('no case files under', roots.join(', ')); process.exit(2); }

const kernel = join(pkg, 'dist/index.js'), rows = [];
const queue = [...cases];
/** One worker: forked, fed cases one at a time, killed and replaced when a case runs past the timeout. */
function startWorker(done) {
  const child = fork(join(pkg, 'scripts/rb/worker.mjs'), [], { env: { ...process.env, RB_KERNEL: kernel }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], execArgv: ['--max-old-space-size=4096'] });
  let current = null, stage = 'case', timer = null, stderr = '';
  child.stderr.on('data', d => { stderr = (stderr + d).slice(-2000); });
  const next = () => {
    current = queue.shift(); stage = 'case';
    if (!current) { child.kill(); done(); return; }
    timer = setTimeout(() => { finish([{ stage, status: 'TIMEOUT', ms: timeout, detail: `killed after ${timeout / 1000} s` }]); child.removeAllListeners('exit'); child.kill('SIGKILL'); startWorker(done); }, timeout);
    child.send({ id: current.id, file: current.file });
  };
  const finish = caseRows => {
    clearTimeout(timer);
    const hash = fileHash(current.file);
    for (const r of caseRows) rows.push({ case: current.id, hash, inputClass: current.inputClass, category: current.category, ...r });
    process.stderr.write(`  ${current.id}: ${caseRows.map(r => r.status === 'OK' ? '·' : r.status[0]).join('')}\n`);
  };
  child.on('message', m => { if (m.ready) next(); else if (m.started) stage = m.started; else if (m.rows) { finish(m.rows); next(); } });
  child.on('exit', (code, signal) => { if (current) { finish([{ stage, status: 'CRASH', ms: 0, detail: `worker exited (${code ?? signal}): ${stderr.trim().split('\n').slice(-2).join(' ')}` }]); current = null; startWorker(done); } });
}
await new Promise(all => { let left = Math.min(jobs, cases.length); for (let k = 0; k < Math.min(jobs, cases.length); k++) startWorker(() => { if (--left === 0) all(); }); });

// Known failures (robustness/todo.json: [{ case, stage, status, note }]; stage "*" for any): TODO when they
// still fail, IMPROVEMENT when they pass now; any other failure is NEW.
const todoFile = join(pkg, 'robustness/todo.json'), todo = existsSync(todoFile) ? JSON.parse(readFileSync(todoFile, 'utf8')) : [];
const known = r => todo.find(t => t.case === r.case && (t.stage === '*' || t.stage === r.stage.replace(/#\d+$/, '')));
const failed = r => !['OK', 'REFUSED'].includes(r.status);
for (const r of rows) { const t = known(r); r.mark = failed(r) ? (t ? 'TODO' : 'NEW') : (t ? 'IMPROVEMENT' : undefined); if (!r.mark) delete r.mark; }
writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');

const pct = (list, q) => { if (!list.length) return 0; const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const groups = new Map();
for (const r of rows) { const k = `${r.stage.replace(/#\d+$/, '')}\t${r.category}\t${r.inputClass}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('stage', 12)}${pad('category', 22)}${pad('class', 13)}${pad('n', 5)}${pad('pass', 8)}${STATUSES.map(s => pad(s, 11)).join('')}${pad('p50 ms', 9)}p95 ms`);
for (const [k, list] of [...groups].sort()) {
  const [stage, category, inputClass] = k.split('\t'), by = Object.fromEntries(STATUSES.map(s => [s, list.filter(r => r.status === s).length]));
  console.log(`${pad(stage, 12)}${pad(category, 22)}${pad(inputClass, 13)}${pad(list.length, 5)}${pad(((by.OK + by.REFUSED) / list.length * 100).toFixed(0) + '%', 8)}${STATUSES.map(s => pad(by[s] || '', 11)).join('')}${pad(pct(list.map(r => r.ms), 0.5), 9)}${pct(list.map(r => r.ms), 0.95)}`);
}
const marks = m => rows.filter(r => r.mark === m);
for (const m of ['NEW', 'TODO', 'IMPROVEMENT']) if (marks(m).length) { console.log(`\n${m}:`); for (const r of marks(m)) console.log(`  ${r.case} ${r.stage} ${r.status}${r.detail ? ` — ${r.detail.slice(0, 160)}` : ''}`); }
console.log(`\nrows: ${out}`);

if (record) {
  let commit = 'unknown'; try { commit = execSync('git rev-parse --short HEAD', { cwd: pkg }).toString().trim(); } catch { /* not a checkout */ }
  const dataset = createHash('sha256').update([...new Set(rows.map(r => `${r.case}:${r.hash}`))].sort().join('\n')).digest('hex').slice(0, 16);
  const totals = Object.fromEntries(STATUSES.map(s => [s, rows.filter(r => r.status === s).length]));
  const stages = {};
  for (const [k, list] of groups) { const stage = k.split('\t')[0], cur = stages[stage] ?? { n: 0, pass: 0 }; cur.n += list.length; cur.pass += list.filter(r => !failed(r)).length; stages[stage] = cur; }
  appendFileSync(join(pkg, 'robustness/trend.jsonl'), JSON.stringify({ commit, date: new Date().toISOString().slice(0, 10), dataset, cases: cases.length, totals, stages, new: marks('NEW').length, todo: marks('TODO').length, improvement: marks('IMPROVEMENT').length }) + '\n');
}
process.exit(marks('NEW').length ? 1 : 0);
