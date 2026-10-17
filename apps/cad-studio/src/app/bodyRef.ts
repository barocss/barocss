// A body's place in the history from its key (`b<node>` or `b<node>_<side>`): the feature that made it and which side.
import type { BodyRef, Side } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';

export function refOf(body: BodyResult): BodyRef {
  const m = /^b(\d+)(?:_(.+))?$/.exec(body.key);
  return { node: Number(m?.[1] ?? 0), side: (m?.[2] ?? 'solid') as Side };
}
