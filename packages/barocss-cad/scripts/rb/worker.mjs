// One runner worker: runs the cases it is sent, one at a time, reporting each stage as it starts.
import { pathToFileURL } from 'node:url';
import { runCase } from './stages.mjs';

const cad = await import(pathToFileURL(process.env.RB_KERNEL).href);
process.on('message', ({ id, file }) => {
  let rows;
  try { rows = runCase(cad, file, stage => process.send({ id, started: stage })); }
  catch (cause) { rows = [{ stage: 'case', status: 'CRASH', ms: 0, detail: String(cause?.stack ?? cause).slice(0, 300) }]; }
  process.send({ id, rows });
});
process.send({ ready: true });
