// Q6: error shape on admitted inputs (finite positive reach, untrimmed surface).
import { directOps, emptyDirect, importSource } from '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/src/engine/direct';
const plane = (ku: number[], kv: number[], pts = '[[[0,0,0],[0,10,0]],[[20,0,0],[20,10,0]]]', du = 1, dv = 1) => `@model t { version:0; length-unit:mm; @surface #p { type:nurbs; degree-u:${du}; degree-v:${dv};
 knots-u:[${ku.join(',')}]; knots-v:[${kv.join(',')}]; control-points:${pts}; weights:[${JSON.parse(pts).map((r: any) => '[' + r.map(() => 1).join(',') + ']').join(',')}]; } }`;
function run(label: string, src: string, edge: any, D: number) {
  let d; try { d = importSource(emptyDirect(), src, 'T'); } catch (e: any) { console.log(label, 'IMPORT', e.code ?? e.constructor.name, e.message.slice(0, 80)); return; }
  const before = JSON.stringify(d);
  try { directOps.extendSurface(d, d.objects[0].id, edge, D); console.log(label, 'OK'); }
  catch (e: any) { console.log(label, e?.code ? `CODED ${e.code}` : `UNCODED ${e?.constructor?.name}`, String(e?.message).slice(0, 100), JSON.stringify(d) === before ? '(input intact)' : '(INPUT CHANGED)'); }
}
const a = -0.00047245177520403137, b = 0.0003746328395716221;
run('u-domain overshoot i=n, u-max', plane([a, a, b, b], [0, 0, 1, 1]), 'u-max', 1);
run('u-domain overshoot i=n, u-min', plane([a, a, b, b], [0, 0, 1, 1]), 'u-min', 1);
const c = 121.53304674241028, e = 194.9592330046747;
run('v-domain overshoot j=across, u-max', plane([0, 0, 1, 1], [c, c, e, e]), 'u-max', 1);
run('v-domain overshoot, v-max (n=11 rows along v)', plane([0, 0, 1, 1], [c, c, e, e]), 'v-max', 1);
for (const D of [1e300, Number.MAX_VALUE, 1e-300, 5e-324]) run(`reach ${D}`, plane([0, 0, 1, 1], [0, 0, 1, 1]), 'u-max', D);
run('zero-length u-max edge (collapsed)', plane([0, 0, 1, 1], [0, 0, 1, 1], '[[[0,0,0],[0,10,0]],[[20,5,0],[20,5,0]]]'), 'u-max', 3);
run('zero tangent (repeated last pole, deg 1)', plane([0, 0, 0.5, 1, 1], [0, 0, 1, 1], '[[[0,0,0],[0,10,0]],[[20,0,0],[20,10,0]],[[20,0,0],[20,10,0]]]'), 'u-max', 3);
run('all poles coincide', plane([0, 0, 1, 1], [0, 0, 1, 1], '[[[1,1,1],[1,1,1]],[[1,1,1],[1,1,1]]]'), 'u-max', 3);
run('parser exponent', plane([0, 0, 1, 1], [0, 0, 1, 1], '[[[0,0,1e-7],[0,10,0]],[[20,0,0],[20,10,0]]]'), 'u-max', 3);
