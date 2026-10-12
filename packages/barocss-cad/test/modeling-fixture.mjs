export function serial(cad, query = { parallelTo: 'x', at: { y: 0, z: 'max' } }, chamfer = true) {
  const model = cad.model();
  const height = model.parameter('height', 8), setback = model.parameter('setback', 1);
  const rearX = model.parameter('rearX', 16), upperX = model.parameter('upperX', 16);
  const blank = model.sketch.polygon([[-0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32]]).extrude(height);
  const tool = model.sketch.rectangle({ min: [8, -16], max: [upperX, 48] }).extrude(8);
  const cut = blank.cut(tool, { axis: 'x' });
  const part = chamfer ? cut.positive.chamfer(cut.positive.edges(query).one(), setback) : cut.positive;
  return { model, blank, tool, cut, part, build: () => model.build({ part, other: cut.negative }) };
}
