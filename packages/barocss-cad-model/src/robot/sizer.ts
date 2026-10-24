/** Canonical sizing boundary. All rounds stay in the single native solver;
 * project its original result once, before any clone or serialization. */
import type { JointTree } from './joints';
import type { LinkBody } from './dynamics';
import type { SweepLink } from './sweep';
import type { Motor, Reducer } from './actuators';
import { readDuty } from './native/duty';
import { sizeDesign as nativeSizeDesign } from './native/sizer';
import { sizedJson, type PublicDuty } from './reports';
export { capability } from './native/sizer';

export function sizeDesign(tree: JointTree, bodies: ReadonlyMap<string, LinkBody>, sweep: readonly SweepLink[] | null, duty: PublicDuty, o: { maxRounds?: number; motors?: readonly Motor[]; reducers?: readonly Reducer[] } = {}) {
  const native = readDuty(tree, duty);
  if ('error' in native) return native;
  return sizedJson(nativeSizeDesign(tree, bodies, sweep, native, o));
}
