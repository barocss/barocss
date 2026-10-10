import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { here, root, bundle } from './bundle.mjs';
import { controls } from './controls.mjs';
import { runScene } from './producer.mjs';
const out = resolve(process.argv[2] ?? '/tmp/physics-1185-canonical');
await mkdir(out, { recursive: true });
const ref = spawn('python3', [resolve(here, 'geometry-reference.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
let stderr = '', pending;
ref.stderr.on('data', d => stderr += d);
createInterface({ input: ref.stdout }).on('line', line => { if (!pending) throw new Error('unsolicited reference output'); const done = pending; pending = null; try { done.resolve(JSON.parse(line)); } catch(e) { done.reject(e); } });
ref.on('error', e => pending?.reject(e));
ref.on('exit', code => { if(pending) { pending.reject(new Error(`reference exited ${code}: ${stderr}`)); pending=null; } });
const observer = { ask(data) { assert.equal(pending ?? null, null); return new Promise((resolve, reject) => { pending = { resolve, reject }; ref.stdin.write(JSON.stringify(data) + '\n'); }); } };
const reports = [], graphAudits = [], controlRows = [];
try {
  for (const graph of ['source', 'source-repeat', 'compiled-dependencies']) {
    const built = await bundle(graph === 'source-repeat' ? 'source' : graph, out); graphAudits.push(built.audit);
    const module = await import(pathToFileURL(built.modulePath));
    for (const scene of ['ALIGNED', 'OFFSET', 'YAW']) {
      controlRows.push({graph,...controls(module,scene)});
      const report = await runScene(module, observer, graph, scene, out);
      reports.push(report);
      console.log(JSON.stringify({graph,scene,acceptedSnapshots:report.acceptedSnapshots,failure:report.failure}));
    }
  }
  for (const scene of ['ALIGNED','OFFSET','YAW']) {
    const pair=reports.filter(r=>r.scene===scene);
    for(const other of pair.slice(1)) {
      assert.deepEqual(pair[0].states,other.states,'unchanged repeat/compiled dependency fields differ');
      assert.equal(pair[0].rawSha256,other.rawSha256,'raw Float64 bits differ');
      assert.deepEqual(pair[0].failure,other.failure,'repeat/compiled quality decisions differ');
    }
  }
  const passed=reports.every(r=>r.numericalGO);
  const summary = { base:'38cab806709d99568ec2b64e70b39ffbe1900ff6', measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,graphAudits,controls:controlRows,sourceCompiledDependencyParity:true,baseNumericalGO:passed,fullModelGO:false,results:reports.map(({graph,scene,acceptedSnapshots,rawBytes,rawSha256,failure,numericalGO})=>({graph,scene,acceptedSnapshots,rawBytes,rawSha256,failure,numericalGO})),refinementExecuted:false,costMeasured:false,browserExecuted:false,referenceStderr:stderr };
  await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  if(passed) throw new Error('Base quality GO: refinement/cost/browser still required by contract; no full GO');
} finally { ref.stdin.end(); }
