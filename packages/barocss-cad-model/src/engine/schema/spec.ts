// The document's spec schema (R4 D4: the types engine/doc.ts stores, out of chat/spec.ts unchanged).
import { type StudioDoc } from '../doc';
import type { EvalResult } from '../evaluate';

/** What is measured. Subjects (`a`, `b`, `face`) are face or edge names or selectors; `body` a body key (none: the part). */
export type Query =
  | { fn: 'bbox'; axis: 'x' | 'y' | 'z'; body?: string }
  | { fn: 'volume'; body?: string }
  | { fn: 'mass'; body?: string }
  | { fn: 'count_solids' }
  | { fn: 'count_faces_of_kind'; kind: 'plane' | 'curved'; body?: string }
  | { fn: 'distance_between'; a: unknown; b: unknown }
  | { fn: 'radius'; face: unknown }
  | { fn: 'hole_diameter'; face: unknown }
  | { fn: 'min_wall'; body?: string }
  | { fn: 'draft_min'; body?: string; pull?: [number, number, number] }
  | { fn: 'clearance'; a: string; b: string }
  /** A pair of spur gears (R6a.4b, D56), `a` and `b` their feature ids (n<k>), as placed: the kernel's pair checks. */
  | { fn: 'gear_center_distance' | 'gear_backlash' | 'gear_contact_ratio' | 'gear_clearance'; a: string; b: string }
  /** A library part's rule (R6b, D65): its value (the margin it reports), else 1 met / 0 not; unknown when its context was not given. */
  | { fn: 'library_check'; feature: string; check: string }
  /** R6b.2: the largest offset (mm) of the standoffs' screw axes from a board's holes (`board`: base or a part id). */
  | { fn: 'hole_alignment'; board: string; features?: string[] }
  /** AM2: the area (mm²) overhanging past the printing process's limit, built along `direction` (default +Z); `body` one body. */
  | { fn: 'overhang_area'; body?: string; direction?: [number, number, number] }
  /** AM3: one printability rule's value (wall, hole, gap, cavity, bed-fit, overhang, warp, tip …); unknown or n/a, said. */
  | { fn: 'print_rule'; rule: string; direction?: [number, number, number] }
  | { fn: 'subd_deviation'; body?: string; at?: 'all' | 'crease' }
  /** A6.3: the part's least clearance from a keep-out (mm; minus the overlap's volume when it enters), its chord tolerance said: within it of the limit, unknown (undecided). */
  | { fn: 'keepout'; keepout: string; body?: string }
  /** A6.3: a datum against a face of the part: the distance (mm) as measure reports it. */
  | { fn: 'datum_distance'; datum: string; face: unknown };
/** `==`: value ± tol; `<=` / `>=`: against value (tol allowed); `between`: min … max. */
export interface Predicate { op: '==' | '<=' | '>=' | 'between'; query: Query; value?: number; tol?: number; min?: number; max?: number; unit?: string }
export interface Requirement {
  id: string;
  /** The words it comes from, quoted as given. */
  source: string;
  /** What it is about, in words. */
  subject?: string;
  assume?: string;
  /** Hard: the part fails without it; soft: a preference. */
  hard: boolean;
  /** stated: given; assumed: chosen where the brief said nothing; ambiguous: the brief can be read more ways. */
  basis?: 'stated' | 'assumed' | 'ambiguous';
  /** Who confirmed an assumption (the user in the studio, for one), and when (ISO time): stated since. */
  confirmed?: { by: string; at: string };
  /** A stated requirement's source checked against what the user typed this conversation (A6.2), or not checkable there. */
  said?: 'verified' | 'unverified';
  /** Meant to hold under any change (one piece, no interference): not flagged as vacuous; `invariant_reason` says why. */
  invariant?: boolean; invariant_reason?: string;
  check: Predicate;
}
export interface Failure { req_id: string; check: string; measured: unknown; expected: string; delta?: number; entities?: string[]; feature?: string; hint: string }
export interface Report {
  model_hash: string; summary: { pass: number; fail: number; unknown: number; hard_failing: number };
  failures: Failure[]; unknowns: { req_id: string; why: string }[];
}
export type Outcome = { status: 'pass' | 'fail' | 'unknown'; measured?: unknown; delta?: number; entities?: string[]; why?: string; hint?: string };
export type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
export interface Validation {
  mutants: { built: number; tried: number; ms: number; labels: string[] };
  vacuous: { req_id: string; why: string }[]; unverified: { req_id: string; why: string }[]; invariant: { req_id: string; reason: string }[];
}
// ---- the iteration policy, kept by the tools (A3.2) ------------------------------------------------------------
/** What the tools remember across a session's checks: the best snapshot, each failing requirement's rounds. */
export interface Policy {
  best?: { hash: string; pass: number; score: number; doc: StudioDoc };
  /** Each failing requirement's last |delta| and checks run since it last improved. */
  last: Record<string, number>; rounds: Record<string, number>;
  /** Hard requirements passing at the last check: a change breaking one is refused unless it says why. */
  passedHard: string[];
  calls: number;
}
