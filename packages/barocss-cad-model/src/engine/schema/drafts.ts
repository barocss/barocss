// The document's drafts schema (R4 D4: the types engine/doc.ts stores, out of chat/drafts.ts unchanged).

export type Drive = { kind: 'scale'; nodes: string[]; about: [number, number] } | { kind: 'height'; nodes: string[] } | { kind: 'depth'; nodes: string[] } | { kind: 'hole'; node: string; hole: number; center: [number, number] };
export interface DraftDim { name: string; label: string; value: number; basis: 'scaled' | 'from-drawing'; confirmed?: { by: 'user'; at: string }; drive: Drive }
export interface Draft { id: string; from: { image: string } | { drawing: string }; nodes: string[]; dims: DraftDim[]; note?: string; /** A drawing that declares no unit, read as mm (every size ×25.4 off if it was inches): an assumption, shown beside the dimensions. */ unitAssumed?: true }
export interface DraftSet { version: 1; drafts: Draft[] }
