import assert from 'node:assert/strict';

export function overlap(cad, chamfer = false) {
  const model = cad.model();
  const rearX = model.parameter('rearX', 16), leftX = model.parameter('leftX', 8), rightX = model.parameter('rightX', 40);
  const lowY = model.parameter('lowY', -8), highY = model.parameter('highY', 24), height = model.parameter('height', 4);
  const blank = model.sketch.polygon([[-0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32]]).extrude(8);
  const tool = model.sketch.rectangle({ min: [leftX, lowY], max: [rightX, highY] }).extrude(height);
  const part = blank.intersect(tool);
  const finished = chamfer ? part.chamfer(part.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 1) : part;
  return { model, blank, tool, part, build: () => model.build({ overlap: finished }) };
}

export function prove(solid, volume, inventory) {
  assert.deepEqual(solid.certificate.volumeMM3, { numerator: String(volume), denominator: '1' });
  const { vertices, edges, faces } = solid.graph;
  if (inventory) assert.deepEqual([faces.length, edges.length, vertices.length], inventory);
  assert.equal(vertices.length - edges.length + faces.length, 2);
  assert.ok(edges.every(edge => edge.uses.length === 2));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  let six = 0;
  for (const { face } of solid.request.assets) {
    const points = face.topology.loop.uses.map(use => face.loop.edges.find(curve => curve.id === use.curveId).controlPoints[use.sense === 'forward' ? 0 : 1]);
    for (let i = 1; i + 1 < points.length; i++) six += dot(points[0], cross(points[i], points[i + 1]));
  }
  assert.equal(six, 6 * volume);
  assert.ok(Object.isFrozen(solid) && Object.isFrozen(vertices[0].pointMM));
}
