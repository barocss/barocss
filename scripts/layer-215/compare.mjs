// #215: compare computed-style signatures between two BaroCSS runtime variants (A = unlayered utilities,
// B = utilities in `@layer utilities`). Inputs are SIG_OUT dumps from the probes, run once per variant with BARO_UMD:
//   BARO_UMD=<A.umd.cjs> SIG_OUT=<dir>/jr-A.json     PROBE_PORT=5610 node scripts/json-render-probe/run.mjs 1
//   BARO_UMD=<A.umd.cjs> SIG_OUT=<dir>/html-A.json   PROBE_PORT=5620 CSPS=typical node scripts/mcp-html-probe/run.mjs 1
//   BARO_UMD=<A.umd.cjs> SIG_OUT=<dir>/out199-A.json PROBE_PORT=5630 node scripts/mcp-model-outputs/render.mjs
// (same with B), then: node scripts/layer-215/compare.mjs <dir>
import fs from 'node:fs'; import path from 'node:path';
const D = process.argv[2];
const load = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
// Diff two signatures; ref (optional) classifies each differing cell.
function diff(a, b, ref, label, props, ids) {
  const r = { elements: 0, cells: 0, bIsRef: 0, aIsRef: 0, neither: 0, byProp: {}, examples: [] };
  if (!a || !b || a.length !== b.length) return { error: 'shape', la: a?.length, lb: b?.length };
  a.forEach((row, i) => {
    let d = false;
    row.forEach((v, j) => {
      if (v === b[i][j]) return;
      d = true; r.cells++; const p = props[j]; r.byProp[p] = (r.byProp[p] || 0) + 1;
      const rv = ref?.[i]?.[j];
      if (ref) { if (b[i][j] === rv) r.bIsRef++; else if (v === rv) r.aIsRef++; else r.neither++; }
      if (r.examples.length < 6) r.examples.push([label, ids ? ids[i] : i, p, 'A=' + v, 'B=' + b[i][j], ref ? 'ref=' + rv : '']);
    });
    if (d) r.elements++;
  });
  return r;
}
const out = {};
// json-render: baro arms vs A/B; reference = build arm (same variant file, build arm does not load BaroCSS).
{
  const A = load('jr-A.json'), B = load('jr-B.json');
  const build = A.find((r) => r.arm === 'build');
  for (const arm of ['baro', 'baroskip', 'baropre']) {
    const a = A.find((r) => r.arm === arm), b = B.find((r) => r.arm === arm);
    out['json-render/' + arm] = {
      spec: diff(a.specSig, b.specSig, build.specSig, 'spec', a.props, a.specIds),
      shell: diff(a.shellSig, b.shellSig, build.shellSig, 'shell', a.props),
    };
  }
}
// mcp-html-probe: baro arms per section, reference = built ref arm.
{
  const A = load('html-A.json'), B = load('html-B.json');
  for (const arm of ['baro', 'baropf']) {
    const secs = [...new Set(A.map((r) => r.sec))];
    out['mcp-html/' + arm] = Object.fromEntries(secs.map((s) => {
      const f = (X, ar) => X.find((r) => r.sec === s && r.arm === ar && r.csp === 'typical');
      const a = f(A, arm), b = f(B, arm), ref = f(A, 'ref');
      return [s, diff(a?.finalSig, b?.finalSig, ref?.finalSig, s, a?.props || [])];
    }));
  }
}
// #199 outputs: arm b (as written + BaroCSS runtime), reference = arm a (as written, no runtime).
{
  const A = load('out199-A.json'), B = load('out199-B.json');
  out['out199'] = Object.fromEntries(Object.keys(A).map((id) => [id, diff(A[id].b, B[id].b, A[id].a, id, ['tag', ...(A[id].props || [])])]));
}
console.log(JSON.stringify(out, null, 1));
