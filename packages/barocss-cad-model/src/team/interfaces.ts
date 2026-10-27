// The Architect's `interfaces` (A8.2, O34) — the reader and the interfaces' own revision — moved from team/parts.ts
// unchanged, importing only the revision leaf: team/bundle.ts, baseline.ts, ecr.ts and freshness.ts read them, and
// importing parts.ts (which runs the chat tools) closed an import cycle chat/tools → chat/outputs → team/bundle →
// team/baseline → team/parts → chat/tools that left CHAT_COMMANDS and ROBOT_TOOLS undefined at load.
import type { StudioDoc } from '../engine/doc';
import { revisionOf } from '../util/revision';

export interface HolePattern { id: string; positions: [number, number, number][]; diameter: number; /** The direction the holes run (the assembly's frame). */ axis: [number, number, number]; parts: string[] }
export interface Envelope { id: string; part: string; min: [number, number, number]; max: [number, number, number] }
export interface Interfaces { version: 1; datums: string[]; keepouts: string[]; holePatterns: HolePattern[]; envelopes: Envelope[]; budgets: { mass?: number; parts?: Record<string, number> } }
export const readInterfaces = (raw: unknown): Interfaces => {
  const r = raw as Interfaces | undefined;
  return r && r.version === 1 ? { version: 1, datums: r.datums ?? [], keepouts: r.keepouts ?? [], holePatterns: r.holePatterns ?? [], envelopes: r.envelopes ?? [], budgets: r.budgets ?? {} } : { version: 1, datums: [], keepouts: [], holePatterns: [], envelopes: [], budgets: {} };
};
/** The interfaces' own revision (A7.1's hash over them alone: a part's contract). */
export const interfacesRevision = (doc: StudioDoc) => revisionOf({ nodes: [], parameters: {}, interfaces: readInterfaces(doc.interfaces) } as unknown as StudioDoc);
