/** Canonical design-check boundary. Duty uses degrees/mm, seconds and gravity mm/s².
 * Native calculation inputs/results are available only through the explicit robot/native contract. */
import type { JointTree } from './joints';
import type { LinkBody } from './dynamics';
import type { Motor, Reducer } from './actuators';
import type { SweepLink } from './sweep';
import { readDuty } from './native/duty';
import { checkDesign as nativeCheckDesign } from './native/harness';
import { harnessJson, type PublicDuty } from './reports';

export function checkDesign(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, sweep: readonly SweepLink[] | null, duty: PublicDuty, catalogue: { motors?: readonly Motor[]; reducers?: readonly Reducer[] } = {}) {
  const native = readDuty(tree, duty);
  if ('error' in native) return native;
  return harnessJson(tree, nativeCheckDesign(tree, bodies, sweep, native, catalogue));
}
