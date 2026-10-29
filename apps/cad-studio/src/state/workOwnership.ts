// Studio-private cancellation ownership. History snapshots and document/evaluation objects remain unchanged.
export interface WorkHistory<D extends object> { doc: D; marker: number | null }
interface Reservation<D extends object, I extends object> {
  entry: WorkHistory<D>; after: D; beforeInput: I; generation: object;
}
interface Origin<D extends object, I extends object> extends Reservation<D, I> { input: I }
export interface WorkRun<D extends object, I extends object> {
  token: object; input: I; candidate: boolean; origin: Origin<D, I> | null;
}
export interface WorkOwnership<D extends object, I extends object> {
  scope: object; generation: object; reservation: Reservation<D, I> | null; run: WorkRun<D, I> | null;
}
export function createWorkOwnership<D extends object, I extends object>(): WorkOwnership<D, I> {
  return { scope: {}, generation: {}, reservation: null, run: null };
}
/** A completion permission belongs only to the current uncommitted candidate, and is consumed by acceptance. */
export function workEditRefusal<D extends object, I extends object>(state: WorkOwnership<D, I>, expectedScope: object, ownCompletion: object | null = null): 'stale' | 'pending' | null {
  if (ownCompletion !== null && state.run?.candidate && state.run.token === ownCompletion) return null;
  if (expectedScope !== state.scope) return 'stale';
  return state.reservation || state.run ? 'pending' : null;
}
/** Call only after acceptance admission. Reserve synchronously, before React starts an evaluation effect. */
export function reserveAcceptedChange<D extends object, I extends object>(state: WorkOwnership<D, I>, entry: WorkHistory<D>, after: D, beforeInput: I): WorkOwnership<D, I> {
  return { ...state, scope: {}, reservation: { entry, after, beforeInput, generation: state.generation }, run: null };
}
/** Render-only changes do not start the main effect; settle against that effect's exact memoized input. */
export function settleWorkReservation<D extends object, I extends object>(state: WorkOwnership<D, I>, doc: D, input: I): WorkOwnership<D, I> {
  const r = state.reservation;
  return r && (r.after !== doc || r.beforeInput === input) ? { ...state, reservation: null } : state;
}
/** Candidates and view-only evaluations never borrow a previous accepted history transition. */
export function beginWork<D extends object, I extends object>(state: WorkOwnership<D, I>, doc: D, input: I, candidate: boolean): WorkOwnership<D, I> {
  const r = state.reservation;
  const origin = !candidate && r?.after === doc && r.generation === state.generation && r.beforeInput !== input ? { ...r, input } : null;
  return { ...state, scope: {}, reservation: null, run: { token: {}, input, candidate, origin } };
}
export function finishWork<D extends object, I extends object>(state: WorkOwnership<D, I>, token: object): WorkOwnership<D, I> {
  return state.run?.token === token ? { ...state, run: null } : state;
}
/** Workspace replacement/history navigation is separate from the Stop replay of one owned change. */
export function invalidateWork<D extends object, I extends object>(_state: WorkOwnership<D, I>): WorkOwnership<D, I> {
  return { scope: {}, generation: {}, reservation: null, run: null };
}
export function stopOwnedWork<D extends object, I extends object>(state: WorkOwnership<D, I>, doc: D, input: I, top: WorkHistory<D> | undefined): { state: WorkOwnership<D, I>; target: WorkHistory<D> | null } {
  const origin = state.run?.origin;
  const target = origin && origin.generation === state.generation && origin.after === doc && origin.input === input && origin.entry === top ? origin.entry : null;
  return { state: invalidateWork(state), target };
}
