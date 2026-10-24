// R7 (the facades): a modelling verb as a document-neutral spec — the agent's v2 command name and its `values`
// (api-conventions.md §12), with the faces or edges it acts on by persistent name. The one part implementation (./part)
// turns each verb into a spec once; each document's backend writes the spec into its own document (§11): cad's into a
// CadPartDocument, cad-model's through the studio's own command, as the agent's run_command does.
import { refuse } from './refusal.js';

export type FeatureSpec =
  | { readonly command: 'box'; readonly values: { readonly w: number; readonly d: number; readonly h: number; readonly x: number; readonly y: number; readonly z: number } }
  | { readonly command: 'hole'; readonly face: string; readonly values: { readonly type: 'through' | 'blind'; readonly d: number; readonly x: number; readonly y: number; readonly depth?: number } }
  | { readonly command: 'fillet'; readonly edges: readonly string[]; readonly values: { readonly radius: number } };

/** `box`: the command's values, with their units in the names (§2). */
export interface BoxOptions { wMM: number; dMM: number; hMM: number; xMM?: number; yMM?: number; zMM?: number }
/** `hole`: into the face a selector picks; `x`, `y` on that face's plane (a Z face: X and Y), as the command takes them. */
export interface HoleOptions { dMM: number; xMM: number; yMM: number; type?: 'through' | 'blind'; depthMM?: number }
/** `fillet`: on the edges a selector picks. */
export interface FilletOptions { radiusMM: number }

const positive = (name: string, v: number) => { if (!(Number.isFinite(v) && v > 0)) throw refuse('VALUE', `${name} must be a positive number of mm, not ${v}`); return v; };
const finite = (name: string, v: number) => { if (!Number.isFinite(v)) throw refuse('VALUE', `${name} must be a number of mm, not ${v}`); return v; };

export function boxSpec(o: BoxOptions): FeatureSpec {
  return { command: 'box', values: { w: positive('wMM', o.wMM), d: positive('dMM', o.dMM), h: positive('hMM', o.hMM), x: finite('xMM', o.xMM ?? 0), y: finite('yMM', o.yMM ?? 0), z: finite('zMM', o.zMM ?? 0) } };
}

export function holeSpec(face: string, o: HoleOptions): FeatureSpec {
  const type = o.type ?? (o.depthMM !== undefined ? 'blind' : 'through');
  if (type === 'blind' && o.depthMM === undefined) throw refuse('VALUE', 'a blind hole needs depthMM');
  return { command: 'hole', face, values: { type, d: positive('dMM', o.dMM), x: finite('xMM', o.xMM), y: finite('yMM', o.yMM), ...(type === 'blind' ? { depth: positive('depthMM', o.depthMM!) } : {}) } };
}

export function filletSpec(edges: readonly string[], o: FilletOptions): FeatureSpec {
  if (!edges.length) throw refuse('SELECTION_EMPTY', 'the selector picked no edge to fillet');
  return { command: 'fillet', edges, values: { radius: positive('radiusMM', o.radiusMM) } };
}
