import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import * as K from '../../../../../packages/barocss-cad/dist/index.js';
import { readNativeSIInertia } from '../../../../../packages/barocss-cad/dist/internal/native-si-mass.js';
const bench = new URL('../../../../../packages/barocss-cad/scripts/perf-bench.mjs', import.meta.url), dist = new URL('../dist/', bench).href;
let source = readFileSync(bench, 'utf8');
source = source.slice(0, source.indexOf("if (process.argv[2] === 'shape-save'"));
source = source.replace("const D = new URL('../dist', import.meta.url).pathname;", `const D = ${JSON.stringify(dist.replace(/\/$/, ''))};`);
source += '\nexport { CASES };\n';
const { CASES } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const bits = n => { const b = Buffer.alloc(8); b.writeDoubleBE(n); return b.toString('hex'); };
function bitTree(v) {
  if (typeof v === 'number') return bits(v);
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return Array.from(v, bitTree);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, bitTree(x)]));
  return v;
}
const result = { node: process.version, cases: {} };
for (const name of ['shaft-thread', 'tapped-hole', 'shaft-thread-long', 'tapped-hole-long', 'direct-thread-long-construction', 'direct-thread-long-construction-first-mass']) {
  const brep = CASES[name](), fresh = structuredClone(brep), mass = K.brepMassProperties(fresh, 7.85), area = K.brepSurfaceArea(fresh);
  result.cases[name] = { geometry: bitTree(brep), mass: bitTree(mass), nativeSI: bitTree(readNativeSIInertia(mass)), area: bitTree(area), valid: K.checkBrep(brep, { strict: true }).valid, counts: { bodies: brep.bodies.length, faces: brep.faces.length, edges: brep.edges.length, vertices: brep.vertices.length } };
  console.log(`captured ${name}`);
}
writeFileSync(new URL(`./actual-${process.argv[2]}.json.gz`, import.meta.url), gzipSync(JSON.stringify(result), { level: 9 }));
