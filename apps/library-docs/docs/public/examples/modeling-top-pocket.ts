import { cad, type CadModelSnapshot } from '@barocss/cad';

/** Exact adopted topPocket recipe: depth moves its lower origin down from Z=8. */
export function makeTopEntryPocket(): CadModelSnapshot {
  const model = cad.model(), depth = model.parameter('depth', 4), toolY = model.parameter('toolY', 8), toolSpanY = model.parameter('toolSpanY', 8);
  const plate = model.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(8);
  const from = model.dimension.add(8, model.dimension.scale(depth, -1));
  const tool = model.sketch.rectangle({ min: [8, toolY], max: [24, model.dimension.add(toolY, toolSpanY)] }).extrude(depth, { from });
  const part = plate.cut(tool);
  return model.build({ plate, tool, part });
}

/** Return a new accepted snapshot; let a refusal leave the caller's old snapshot intact. */
export function changeTopPocketDepth(accepted: CadModelSnapshot, depth: number): CadModelSnapshot {
  return accepted.withParameters({ depth });
}
// Baseline depth4/from4:5632 mm³; depth6/from2:5376; depth8/from0 window:5120.
// All plate/tool/part outputs remain authored. The preset displays part; generic Open
// selects tool (last canonical output), so choose part to inspect the result.
// Genuine retained preview evidence covers the baseline part only. Operand and
// changed-state display mocks used by CPU tests are not additional native captures.
