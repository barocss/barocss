// Offline synthetic scoring checks. Uses existing browser dependencies; never generates model output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { specFor } from '../json-render-446/spec.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length > 1) throw new Error('Usage: replay-failures.mjs [replay-entry.mjs]');
const replay = path.resolve(args[0] || path.join(here, 'replay.mjs'));
const cases = [
  { name: 'unknown-prop', expected: 'schema', change: spec => { spec.elements.heading.props.unsupportedProp = 'synthetic'; } },
  { name: 'changed-binding', expected: 'schema', change: spec => { spec.elements.email.props.value = { $bindState: '/plan' }; } },
  { name: 'wrong-action', expected: 'schema', change: spec => { spec.elements.save.on.press.action = 'refresh'; } },
  { name: 'absent-class', expected: 'style', change: spec => { spec.elements.layout.props.className = 'grid-cols-2 gap-6'; } },
  { name: 'semantic-text', expected: 'semantic', change: spec => { spec.elements.heading.props.text = 'Different synthetic heading'; } },
];
const stages = ['initial', 'density', 'responsive', 'structure'];
const rows = cases.flatMap(test => stages.map(stage => {
  const spec = specFor('settings', 'utility', stage);
  if (stage === 'initial') test.change(spec);
  return { id: `${test.name}:${stage}`, model: `synthetic:${test.name}`, scenario: 'settings', arm: 'utility', repeat: 0, stage, status: stage === 'initial' ? 'valid' : 'blocked', ...(stage === 'initial' ? { spec } : {}) };
}));
const continuations = [
  {name:'semantic-continuation',expected:'semantic',change:spec=>{spec.elements.heading.props.text='Different synthetic heading';}},
  {name:'style-continuation',expected:'style',change:spec=>{spec.elements.layout.props.className='grid-cols-2 gap-3';}},
  {name:'runtime-continuation',expected:'runtime',change:spec=>{delete spec.elements.save.on;}},
  {name:'schema-continuation',expected:'schema',change:spec=>{spec.elements.heading.props.unsupportedProp='synthetic';}},
  {name:'successful-session',expected:'pass',change:()=>{}},
];
for(const test of continuations) for(const stage of stages) {
  const spec=specFor('settings','utility',stage);
  if(stage==='density') test.change(spec);
  rows.push({id:`${test.name}:${stage}`,model:`synthetic:${test.name}`,scenario:'settings',arm:'utility',repeat:0,stage,status:'valid',spec});
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'barocss-447-replay-failures-'));
try {
  const input = path.join(temp, 'input.json');
  const output = path.join(temp, 'output.json');
  fs.writeFileSync(input, JSON.stringify(rows, null, 2) + '\n');
  const result = spawnSync(process.execPath, [replay, '--input', input, '--output', output], { env: process.env, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Replay failed: ${result.stderr || result.stdout}`);
  const report = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(report.rows.length, 80, 'All 10 sessions × 4 stages × 2 arms must survive scoring');
  for (const test of cases) for (const arm of ['utility', 'build']) {
    const cells = report.rows.filter(row => row.model === `synthetic:${test.name}` && row.arm === arm);
    assert.equal(cells.length, 4, `${test.name}/${arm}: dropped cells`);
    assert.deepEqual(cells.map(row => row.stage), stages);
    assert.equal(cells[0].classification, test.expected, `${test.name}/${arm}: wrong initial classification`);
    if (test.expected === 'schema') assert.equal(cells[0].rendered, false);
    else assert.equal(cells[0].rendered, true);
    for (const cell of cells.slice(1)) {
      assert.equal(cell.status, 'blocked');
      assert.equal(cell.classification, 'blocked');
      assert.equal(cell.rendered, false);
    }
  }
  for(const test of continuations) {
    const cells=report.rows.filter(row=>row.model===`synthetic:${test.name}`&&row.arm==='utility');
    assert.deepEqual(cells.map(row=>row.stage),stages);
    assert.equal(cells[0].classification,'pass');
    assert.equal(cells[1].classification,test.expected,`${test.name}: failing anchor`);
    assert.deepEqual(cells.slice(2).map(row=>row.classification),['pass','pass'],`${test.name}: later cells scored independently`);
    assert.deepEqual(cells.map(row=>row.priorChainComplete),[true,true,test.expected==='pass',test.expected==='pass'],`${test.name}: failure must propagate`);
    const session=report.sessions.find(row=>row.model===`synthetic:${test.name}`&&row.arm==='utility');
    assert.equal(session.completeSessionSuccess,test.expected==='pass');
    assert.equal(session.passedAnchors,test.expected==='pass'?4:3);
    assert.equal(session.totalAnchors,4);
  }
  for(const session of report.sessions) if(session.model!=='synthetic:successful-session'||session.arm!=='utility') assert.equal(session.completeSessionSuccess,false,'Failed anchors prevent complete session success');
  console.log(JSON.stringify({ kind: 'synthetic-replay-failure-checks', cases: cases.length + continuations.length, rows: report.rows.length, pass: true }));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
