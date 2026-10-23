// O9: results tied to what they were asked for. A request goes on a lane — what it is for: the command's preview, the
// section, the mould, the drawing, one placed part's bodies — and a newer request on the same lane makes every older one
// on it come back stale, never as a result, so a late reply cannot overwrite the newer state it was overtaken by.
// Lanes are apart: one placed part's bodies do not supersede another's. The engine client's main evaluation keeps its
// own rule (the newest wins), which is this with one lane.

/** A reply overtaken on its lane by a newer request: not to be shown or stored. */
export interface Stale { readonly stale: true; readonly lane: string }
export const isStale = (r: unknown): r is Stale => !!r && typeof r === 'object' && (r as Stale).stale === true;

export class Lanes {
  private latest = new Map<string, number>();
  private seq = 0;
  /** The request's reply, or Stale when a newer one went on its lane before it came back. */
  async run<T>(lane: string, request: () => Promise<T>): Promise<T | Stale> {
    const ticket = ++this.seq;
    this.latest.set(lane, ticket);
    const reply = await request();
    return this.latest.get(lane) === ticket ? reply : { stale: true, lane };
  }
}
