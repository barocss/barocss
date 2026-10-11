import assert from 'node:assert/strict';
import {resolve, dirname} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {mkdir, writeFile, stat} from 'node:fs/promises';
import {bundle, verifyFreeze, verifyEmitted, root} from './bundle.mjs';
import {runGraph} from './consumer.mjs';
import {loadSourcePrefix} from './resume-source.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** Runs each new graph once, with source bytes as the parity authority. */
export async function run(outputDirectory, resumeSource = false) {
  await verifyFreeze();
  await verifyEmitted();
  assert.equal(process.version, 'v22.22.0');
  try { await stat(outputDirectory); throw new Error('fresh World output directory is required'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(outputDirectory, {recursive: false});
  const results = [], origins = [];
  const referencePath = resolve(here, 'reference.py');
  const prefix = resumeSource ? loadSourcePrefix(root, here) : null;
  for (const graph of ['source', 'source-repeat', 'compiled-dependencies']) {
    const built = await bundle(graph, outputDirectory);
    origins.push(built.audit);
    const module = await import(pathToFileURL(built.path).href);
    const directory = resolve(outputDirectory, graph + '-proof');
    const result = await runGraph(module, graph, directory, referencePath,
      graph === 'source' ? null : resolve(outputDirectory, 'source-proof'), graph === 'source' ? prefix : null);
    results.push(result);
    // An execution/storage failure cannot launch another physical graph.
    if (result.disposition === 'GRAPH_NO_COMPLETE_PROOF') break;
  }
  const complete = results.length === 3 && results.every(result => result.disposition !== 'GRAPH_NO_COMPLETE_PROOF');
  const physicalGO = complete && results.every(result => result.disposition === 'HINGE2_WORLD_GO');
  const summary = {complete, physicalGO, disposition: physicalGO ? 'HINGE2_WORLD_GO' : complete ? results[0].disposition : 'GRAPH_NO_COMPLETE_PROOF',
    graphs: results.map(({graph, disposition, counts, extrema, firstFailure}) => ({graph, disposition, counts, extrema, firstFailure})), origins};
  await writeFile(resolve(outputDirectory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', {flag: 'wx'});
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output) throw new Error('fresh output directory argument is required');
  const started = performance.now();
  const summary = await run(resolve(output), process.argv[3] === '--resume-source');
  console.log(JSON.stringify({disposition: summary.disposition, complete: summary.complete,
    physicalGO: summary.physicalGO, elapsedSeconds: (performance.now() - started) / 1000}));
  process.exitCode = summary.complete ? 0 : 1;
}
