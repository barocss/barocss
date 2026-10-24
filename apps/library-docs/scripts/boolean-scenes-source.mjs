// Fixed teaching cases. Geometry is evaluated from the native kernel, then tessellated for display only.
import { evaluateCadPart, tessellateBrep, checkOutput, massPropertiesOf } from '@barocss/cad';
const doc = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const box = (id, min, max, z = 0, h = 10) => [
  { id: `${id}s`, kind: 'sketch', profile: 'rectangle', min, max },
  { id: `${id}e`, kind: 'extrude', sketch: `${id}s`, height: h },
  { id, kind: 'translate', target: `${id}e`, offset: [0, 0, z] },
];
const cylinder = (id, center, radius, z, h) => [
  { id: `${id}s`, kind: 'sketch', profile: 'circle', center, radius },
  { id: `${id}e`, kind: 'extrude', sketch: `${id}s`, height: h },
  { id, kind: 'translate', target: `${id}e`, offset: [0, 0, z] },
];
const boxField = (p, min, max) => Math.max(...p.flatMap((v, i) => [min[i] - v, v - max[i]]));
const cylField = (p, center, r, z, h) => Math.max(Math.hypot(p[0] - center[0], p[1] - center[1]) - r, z - p[2], p[2] - z - h);
export const CASES = [
  { id: 'boxes', title: 'Two offset boxes', path: 'Z-prismatic · three height intervals',
    a: 'A: X/Y/Z [0,10] mm', b: 'B: X [5,15], Y [3,13], Z [2,12] mm',
    equation: 'Common volume = 5 × 7 × 8 = 280 mm³',
    detail: 'The overlap changes at Z = 0, 2, 10 and 12. Split each section, select its regions, and rebuild caps and walls between levels.',
    features: [...box('a', [0, 0], [10, 10]), ...box('b', [5, 3], [15, 13], 2)],
    fieldA: p => boxField(p, [0, 0, 0], [10, 10, 10]), fieldB: p => boxField(p, [5, 3, 2], [15, 13, 12]),
  },
  { id: 'cylinder', title: 'Box and circular cutter', path: 'Z-prismatic · line/arc arrangement',
    a: 'A: X/Y/Z [0,10] mm', b: 'B: centre (8,5), radius 3, Z [−2,12] mm',
    equation: 'At X = 10: (y − 5)² = 9 − 2² = 5',
    detail: 'The two vertical cuts are at Y = 5 ± √5. Circle arcs stay circular in the B-rep. Subtraction reverses the retained cutter wall to face the empty cavity.',
    features: [...box('a', [0, 0], [10, 10]), ...cylinder('b', [8, 5], 3, -2, 14)],
    fieldA: p => boxField(p, [0, 0, 0], [10, 10, 10]), fieldB: p => cylField(p, [8, 5], 3, -2, 14),
  },
  { id: 'holes', title: 'A plate with two through-holes', path: 'Z-prismatic · multiple loops',
    a: 'A: 20 × 16 × 8 mm plate at (0,0,0)', b: 'B: radius-3 cylinders at (6,8) and (14,8), Z [−2,10] mm',
    equation: 'A − B = 2560 − 2π × 3² × 8 ≈ 2107.611 mm³',
    detail: 'B is a union of two separate cylinders. Subtraction makes two inner loops in each cap and two cylindrical cavity walls. The result is one connected plate; intersection has two bodies.',
    features: [...box('a', [0, 0], [20, 16], 0, 8), ...cylinder('b1', [6, 8], 3, -2, 12), ...cylinder('b2', [14, 8], 3, -2, 12), { id: 'b', kind: 'union', target: 'b1', tool: 'b2' }],
    fieldA: p => boxField(p, [0, 0, 0], [20, 16, 8]), fieldB: p => Math.min(cylField(p, [6, 8], 3, -2, 12), cylField(p, [14, 8], 3, -2, 12)),
  },
  { id: 'crossed', title: 'Two crossing cylinders', path: 'Native curved B-rep · cylinder/cylinder cuts',
    a: 'A: radius 4, axis Z, Z [−6,6] mm', b: 'B: radius 2.5, axis X, X [−6,6] mm',
    equation: 'x² + y² = 16; y² + z² = 6.25 ⇒ x² − z² = 9.75',
    detail: 'The intersection is a spatial curve on both cylindrical walls. It is not one flat circle. The kernel maps the same curve into each cylinder’s angle/height domain before splitting and joining the retained surfaces.',
    features: [...cylinder('a', [0, 0], 4, -6, 12), ...cylinder('raw', [0, 0], 2.5, -6, 12), { id: 'b', kind: 'rotate', target: 'raw', axis: 'y', angle: 90, pivot: [0, 0, 0] }],
    fieldA: p => cylField(p, [0, 0], 4, -6, 12), fieldB: p => cylField([-p[2], p[1], p[0]], [0, 0], 2.5, -6, 12),
  },
  { id: 'oblique', title: 'An oblique bore', path: 'Native curved B-rep · plane/cylinder cuts',
    a: 'A: X/Y [−6,6], Z [0,8] mm', b: 'B: radius 2, length 24 mm; tilted 30° about Y; centred at (0,0,4)',
    equation: 'Top/bottom ellipse: u² / (2 / cos 30°)² + y² / 2² = 1',
    detail: 'The tilted cylinder is no longer a Z-prismatic solid. Plane/cylinder intersection curves become ellipses on the caps. Map each curve into both face domains, split them, then classify and stitch the selected patches.',
    features: [...box('a', [-6, -6], [6, 6], 0, 8), ...cylinder('raw', [0, 0], 2, -12, 24), { id: 'tilt', kind: 'rotate', target: 'raw', axis: 'y', angle: 30, pivot: [0, 0, 0] }, { id: 'b', kind: 'translate', target: 'tilt', offset: [0, 0, 4] }],
    fieldA: p => boxField(p, [-6, -6, 0], [6, 6, 8]),
    fieldB: p => { const q = [Math.cos(Math.PI / 6) * p[0] - 0.5 * (p[2] - 4), p[1], 0.5 * p[0] + Math.cos(Math.PI / 6) * (p[2] - 4)]; return cylField(q, [0, 0], 2, -12, 24); },
  },
];
const round = v => Number(v.toFixed(8)); // Display storage only. Native predicates and tolerances stay unchanged.
function pack(output) {
  const mesh = tessellateBrep(output.brep, { segmentsPerQuarter: 12 });
  return { positions: Array.from(mesh.positions, round), normals: Array.from(mesh.normals, round), indices: Array.from(mesh.indices),
    patches: mesh.faces.map(f => {
      const sum = [0, 0, 0];
      for (let i = f.vertexOffset; i < f.vertexOffset + f.vertexCount; i++) for (let k = 0; k < 3; k++) sum[k] += mesh.normals[3 * i + k];
      const length = Math.hypot(...sum);
      return { start: f.indexOffset, count: f.indexCount, normal: length > 1e-6 ? sum.map(v => round(v / length)) : Array.from(mesh.normals.slice(3 * f.vertexOffset, 3 * f.vertexOffset + 3), round) };
    }),
    lines: mesh.edges.map(e => Array.from(e.points, round)) };
}
export function evaluateCase(c) {
  const inputs = evaluateCadPart(doc(c.features));
  const a = inputs.outputs.find(o => o.id === 'a'), b = inputs.outputs.find(o => o.id === 'b');
  const result = {};
  for (const operation of ['union', 'difference', 'intersect']) {
    const [output] = evaluateCadPart(doc([...c.features, { id: 'result', kind: operation, target: 'a', tool: 'b' }])).outputs;
    const valid = checkOutput(output);
    if (!valid.valid) throw new Error(`${c.id}/${operation}: ${JSON.stringify(valid.issues)}`);
    result[operation] = { mesh: pack(output), volume: massPropertiesOf(output, 1).volume, bodies: output.bodyCount, faces: output.brep.faces.length };
  }
  const cuts = result.intersect.mesh.lines.filter(line => {
    const points = Array.from({ length: line.length / 3 }, (_, i) => line.slice(i * 3, i * 3 + 3));
    return points.every(p => Math.abs(c.fieldA(p)) < 1e-6 && Math.abs(c.fieldB(p)) < 1e-6);
  });
  return { id: c.id, title: c.title, path: c.path, a: c.a, b: c.b, equation: c.equation, detail: c.detail,
    inputs: [pack(a), pack(b)], results: result, cuts };
}
export function buildScenes() { return { format: 'boolean-teaching-scenes-v1', cases: CASES.map(evaluateCase) }; }
