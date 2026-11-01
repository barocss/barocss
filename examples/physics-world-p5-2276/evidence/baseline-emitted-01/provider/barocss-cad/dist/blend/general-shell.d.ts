import { type Brep } from '../brep/brep-core.js';
/**
 * How the hollow meets itself at a concave edge of the body: 'sharp', its faces' offsets extended until they meet (as
 * offset faces do; the default); 'arc', a round of the wall's radius about the edge (and a ball at a vertex) — every
 * point within the wall of the boundary, and no other. The owner's decision (D106/D107); one switch.
 */
export type ShellJoin = 'sharp' | 'arc';
/** The shell of `body` with walls `t` thick, the faces named in `open` removed. */
export declare function generalShell(body: Brep, t: number, open: ReadonlySet<string>, id: string, join?: ShellJoin): Brep;
/**
 * The slabs' union: in their order; where the analytic Boolean cannot close a step, the same union by halves, then in
 * the reverse order — one solid however it is grouped, only the pieces' meeting in between differs (a box's notched
 * corner at t 3, D108: one wall's slab added last to the end's, the top's and the floor's) — refused typed if none does.
 */
export declare function joined(slabs: readonly Brep[], id: string): Brep;
