import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loftSolid } from '../../../../../packages/barocss-cad/dist/features/loft.js';
const dist = new URL('../../../../../packages/barocss-cad/dist/features/', import.meta.url);
function archived(name, overrides = {}) {
  let source = readFileSync(new URL(`original-${name}.mjs`, import.meta.url), 'utf8');
  source = source.replace(/from (['"])([^'"]+)\1/g, (_, quote, spec) => `from ${quote}${overrides[spec] ?? new URL(spec, dist).href}${quote}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const oldMixed = archived('framed-mixed-loft'), oldOriented = archived('oriented-loft', { './framed-mixed-loft.js': oldMixed });
const oldLoft = (await import(archived('loft', { './oriented-loft.js': oldOriented, './loft-nurbs-guide.js': archived('loft-nurbs-guide') }))).loftSolid;
const square = w => [[-0, 0], [w, 0], [w, w], [0, w]].map(start => ({ kind: 'line', start }));
const circle = () => [{ kind: 'arc', start: [1, 0], center: [0, 0], direction: 'ccw' }];
const stadium = () => [{ kind: 'line', start: [-2, -1] }, { kind: 'arc', start: [2, -1], center: [2, 0], direction: 'ccw' }, { kind: 'line', start: [2, 1] }, { kind: 'arc', start: [-2, 1], center: [-2, 0], direction: 'ccw' }];
const frame = z => ({ origin: [0, 0, z], xAxis: [1, -0, 0], yAxis: [0, 1, -0] });
const fixtures = [];
for (const count of [2, 3, 8]) for (const controls of [4, 16, 17, 64]) {
  const degree = 3, knots = [...Array(4).fill(0), ...Array.from({ length: controls - 4 }, (_, i) => (i + 1) / (controls - 3)), ...Array(4).fill(1)];
  fixtures.push({ id: `height-${count}-${controls}`, name: 'old', sections: Array.from({ length: count }, (_, i) => ({ z: i / (count - 1), profile: square(1 + i / (count - 1)) })), guide: { kind: 'nurbs', degree, knots, controlPoints: Array.from({ length: controls }, (_, i) => [0, -0, knots.slice(i + 1, i + 4).reduce((a, b) => a + b, 0) / 3]) } });
}
for (const profile of [square, circle, stadium]) {
  for (const kind of [undefined, 'quadratic-bezier', 'cubic-bezier']) {
    if (profile === square && kind) continue;
    const seam = profile()[0].start;
    fixtures.push({ id: `frame-${profile.name}-${kind}`, name: 'old', sections: [0, 3].map(z => ({ frame: frame(z), profile: profile(1) })), ...(kind ? { guide: { kind, controlPoints: kind === 'quadratic-bezier' ? [[...seam, 0], [seam[0] + 2, seam[1], 1.5], [...seam, 3]] : [[...seam, 0], [seam[0] + 2, seam[1], 1], [seam[0] - 1, seam[1], 2], [...seam, 3]] } } : {}) });
  }
}
fixtures.push({ id: 'mixed-general-direction', name: 'old', sections: [0, 1].map(z => ({ profile: stadium(), frame: { origin: [0, -0.8 * z, 0.6 * z], xAxis: [1, 0, 0], yAxis: [0, 0.6, 0.8] } })) });
fixtures.push({ id: 'mixed-permuted-guide', name: 'old', sections: [0, 3].map(z => ({ profile: stadium(), frame: { origin: [z, 0, 0], xAxis: [0, 1, 0], yAxis: [0, 0, 1] } })), guide: { kind: 'quadratic-bezier', controlPoints: [[0, -2, -1], [1.5, 0, -1], [3, -2, -1]] } });
function bits(value) {
  if (typeof value === 'number') { const b = Buffer.alloc(8); b.writeDoubleBE(value); return { binary64: b.toString('hex') }; }
  if (Array.isArray(value)) return value.map(bits);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, bits(value[k])]));
  return value;
}
const records = fixtures.map(input => {
  const before = bits(input), a = oldLoft(input), b = loftSolid(input);
  const old = bits({ brep: a.brep, mass: a.mass(1), denseMass: a.mass(7.85) }), current = bits({ brep: b.brep, mass: b.mass(1), denseMass: b.mass(7.85) });
  const same = JSON.stringify(old) === JSON.stringify(current), preserved = JSON.stringify(before) === JSON.stringify(bits(input));
  console.log(input.id, same ? 'SAME' : 'DIFFERENT', preserved ? 'INPUT_PRESERVED' : 'INPUT_MUTATED');
  return { input, same, preserved, original: old, current };
});
writeFileSync(new URL('./legacy-bits-results.json.gz', import.meta.url), gzipSync(JSON.stringify({ node: process.version, records }, null, 2) + '\n', { mtime: 0 }));
if (records.some(r => !r.same || !r.preserved)) process.exitCode = 1;
