// O9: results tied to what they were asked for. A request goes on a lane — one per thing a result replaces: the command's
// preview, the section view, one part's drawing, one placed part's bodies (never one per kind of request) — and a newer
// request on the same lane makes every older one on it come back stale, never as a result, so a late reply cannot
// overwrite the newer state it was overtaken by. Lanes are apart: one placed part's bodies do not supersede another's.
// The reply is a discriminated union: a caller has to look at `stale` before it can reach the result.

/** A reply on a lane: overtaken (not to be shown or stored), or current, with what it was asked of. */
export type LaneReply<T> =
  | { readonly stale: true; readonly lane: string; readonly revision: number }
  | { readonly stale: false; readonly lane: string; readonly revision: number; readonly source: string; readonly result: T };

export class Lanes {
  private latest = new Map<string, number>();
  private seq = 0;
  /** The request's reply, current or stale; `revision` and `source` are what it was asked of (the document's key). */
  async run<T>(lane: string, asked: { revision: number; source: string }, request: () => Promise<T>): Promise<LaneReply<T>> {
    const ticket = ++this.seq;
    this.latest.set(lane, ticket);
    const result = await request();
    return this.latest.get(lane) === ticket ? { stale: false, lane, revision: asked.revision, source: asked.source, result } : { stale: true, lane, revision: asked.revision };
  }
  /** Every request waiting on the lane comes back stale (R4b: what the caller asked for is gone — an effect's cleanup). */
  cancel(lane: string): void { this.latest.set(lane, ++this.seq); }
}
