// One L4 fuzz worker (RB5, K10, D188): evaluates the part documents it is sent, one at a time. For the root's output:
// the strict check, a watertight tessellation (by position), the mass. The runner judges them against the oracle. (A
// prismatic crescent's touch, D195, is KNOWN: measured and judged all the same.)
import { pathToFileURL } from 'node:url';
import { classifyError, crescentContacts, crescentIssues, crescentMesh, errorDetail, openEdgesByBody } from './stages.mjs';

const cad = await import(pathToFileURL(process.env.RB_KERNEL).href);
function run({ document, root }) {
  const t0 = performance.now();
  let outputs;
  try { outputs = cad.evaluateCadPart(document).outputs; }
  catch (cause) { return { status: classifyError(cause), detail: errorDetail(cause), code: cause?.code, ms: performance.now() - t0 }; }
  const o = outputs.find(x => x.id === root);
  if (!o) return { status: 'OK', empty: true, ms: performance.now() - t0, others: outputs.map(x => x.id) };
  try {
    const report = o.validate(), crescent = crescentContacts(o.brep);
    let known;
    if (!report.valid) { if (crescent && crescentIssues(o.brep, report.issues, crescent)) known = `KNOWN-CRESCENT (D195): ${report.issues[0]}`; else return { status: 'INVALID', detail: `strict: ${report.issues[0]}`, ms: performance.now() - t0 }; }
    const mesh = cad.tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), open = openEdgesByBody(o.brep, mesh);
    if (open) { if (crescent && crescentMesh(o.brep, mesh, crescent)) known ??= `KNOWN-CRESCENT (D195): ${open} mesh edges used four times along the tangent line`; else return { status: 'INVALID', detail: `tessellation: ${open} edges not used exactly twice`, ms: performance.now() - t0 }; }
    const m = o.massProperties(1);
    if (![m.volumeMM3, ...m.centroidMM].every(Number.isFinite)) return { status: 'CRASH', detail: 'non-finite mass', ms: performance.now() - t0 };
    return { status: 'OK', ...(known ? { known } : {}), volumeMM3: m.volumeMM3, centroidMM: m.centroidMM, method: m.method, bodies: o.bodyCount, ms: performance.now() - t0 };
  } catch (cause) { return { status: classifyError(cause), detail: errorDetail(cause), code: cause?.code, ms: performance.now() - t0 }; }
}
process.on('message', m => { let r; try { r = run(m); } catch (cause) { r = { status: 'CRASH', detail: String(cause?.stack ?? cause).slice(0, 300) }; } process.send({ id: m.id, result: r }); });
process.send({ ready: true });
