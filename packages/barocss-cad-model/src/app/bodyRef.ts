// A body's place in the history: the feature that made it and which side (`ref`, set when the body is
// evaluated: its key is by that feature's stable id, see engine/ids.ts).
import type { BodyRef, Side } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';

export function refOf(body: BodyResult): BodyRef {
  if (body.ref) return body.ref;
  // (A body made without its nodes at hand: its key read as an index.)
  const m = /^b(\d+)(?:_(.+))?$/.exec(body.key);
  return { node: Number(m?.[1] ?? 0), side: (m?.[2] ?? 'solid') as Side };
}
