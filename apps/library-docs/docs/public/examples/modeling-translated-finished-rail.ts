import { cad, type CadModelSnapshot } from '@barocss/cad';

/** Exact #1919 two-chamfer rail pair. Importing this module performs no native work. */
export function makeTranslatedFinishedRail(): CadModelSnapshot {
  const model = cad.model();
  const frontDistance = model.parameter('frontDistance', 1);
  const backDistance = model.parameter('backDistance', 2);
  const backY = model.parameter('backY', 24);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const part = front.chamfer(front.edges({ parallelTo: 'x', at: { y: backY, z: 'max' } }).one(), backDistance);
  const spacing = model.parameter('spacing', 48);
  const right = part.translate([spacing, -0, 0]);
  return model.build({ left: part, right });
}

/** Edit the owned spacing driver. Native exact-coordinate admission can refuse. */
export function spaceFinishedRail(pair: CadModelSnapshot, spacing = 64): CadModelSnapshot {
  return pair.withParameters({ spacing });
}
