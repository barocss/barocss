import test from 'node:test';
import assert from 'node:assert/strict';
import { beginWork, createWorkOwnership, finishWork, invalidateWork, reserveAcceptedChange, settleWorkReservation, stopOwnedWork, workEditRefusal, type WorkHistory } from '../src/state/workOwnership';

// These are tests of the private ownership decision boundary. Actual App callbacks/history/storage need UI proof.
type Doc = { readonly name: string; readonly model: { readonly boxes: number }; readonly render: { readonly grid: boolean }; readonly parameters: { readonly L: number } };
type Input = { readonly source: string };
function doc(name: string, boxes = 1, grid = false): Doc { return Object.freeze({ name, model: Object.freeze({ boxes }), render: Object.freeze({ grid }), parameters: Object.freeze({ L: 40 }) }); }
const input = (source: string): Input => Object.freeze({ source });
const history = (document: Doc, marker: number | null = null): WorkHistory<Doc> => Object.freeze({ doc: document, marker });
function acceptedWork() {
  const before = doc('before'), after = doc('after', 2), beforeInput = input('one box'), afterInput = input('two boxes'), entry = history(before, 3);
  const reserved = reserveAcceptedChange(createWorkOwnership<Doc, Input>(), entry, after, beforeInput);
  const state = beginWork(reserved, after, afterInput, false);
  assert.ok(state.run);
  return { before, after, beforeInput, afterInput, entry, state, token: state.run.token };
}

test('pending work refuses an independent document edit before caller document, history, dirty or recovery values change', () => {
  const work = acceptedWork(), caller = { doc: work.after, undo: [work.entry], redo: [history(doc('redo'))], dirty: true, recovery: { document: work.after, marker: 7 } };
  const before = structuredClone(caller), stateBefore = { ...work.state };
  assert.equal(workEditRefusal(work.state, work.state.scope), 'pending');
  assert.equal(workEditRefusal(work.state, work.state.scope, work.token), 'pending', 'a normal evaluation token cannot bypass the edit gate');
  assert.deepEqual(caller, before); assert.deepEqual(work.state, stateBefore);
  assert.equal(caller.doc, work.after); assert.equal(caller.undo[0], work.entry);
});

test('Stop returns exactly the originating accepted edit and its rollback marker without popping caller history', () => {
  const work = acceptedWork(), undo = [history(doc('older')), work.entry], redo = [history(doc('future'))];
  const stopped = stopOwnedWork(work.state, work.after, work.afterInput, undo.at(-1)!);
  assert.deepEqual(stopped.target, work.entry); assert.equal(stopped.target?.doc, work.before); assert.equal(stopped.target?.marker, 3);
  assert.deepEqual(undo, [undo[0], work.entry]); assert.equal(redo.length, 1);
  assert.equal(stopped.state.run, null); assert.equal(stopped.state.reservation, null);
  assert.notEqual(stopped.state.scope, work.state.scope); assert.notEqual(stopped.state.generation, work.state.generation);
});

test('an idle Stop never replays old history and future work is still allowed', () => {
  const state = createWorkOwnership<Doc, Input>(), old = history(doc('old')), current = doc('accepted'), evaluated = input('accepted input');
  const stopped = stopOwnedWork(state, current, evaluated, old);
  assert.equal(stopped.target, null); assert.equal(workEditRefusal(stopped.state, stopped.state.scope), null);
  assert.equal(workEditRefusal(stopped.state, state.scope), 'stale');
  assert.equal(stopOwnedWork(state, current, evaluated, undefined).target, null);
});

test('initial, variant and unaccepted parameter evaluations cannot claim an unrelated Undo entry', () => {
  for (const kind of ['initial', 'variant', 'parameter']) {
    const accepted = doc(`accepted ${kind}`), evaluated = input(`evaluating ${kind}`), old = history(doc('older accepted change'));
    const state = beginWork(createWorkOwnership<Doc, Input>(), accepted, evaluated, kind !== 'initial');
    assert.equal(stopOwnedWork(state, accepted, evaluated, old).target, null, kind);
    assert.equal(accepted.parameters.L, 40); assert.equal(old.doc.name, 'older accepted change');
  }
});

test('only the current parameter candidate token authorizes its pre-effect accept closure, and acceptance consumes it', () => {
  const initial = createWorkOwnership<Doc, Input>(), state = beginWork(initial, doc('accepted'), input('candidate L50'), true);
  assert.ok(state.run);
  assert.equal(workEditRefusal(state, state.scope), 'pending');
  assert.equal(workEditRefusal(state, state.scope, {}), 'pending');
  assert.equal(workEditRefusal(state, state.scope, state.run.token), null);
  assert.equal(workEditRefusal(state, initial.scope, state.run.token), null, 'the valid accept closure captured its scope before the effect began');
  const token = state.run.token, next = reserveAcceptedChange(state, history(doc('accepted')), doc('accepted candidate', 2), input('candidate hand-off'));
  assert.equal(workEditRefusal(next, next.scope, token), 'pending', 'the consumed candidate token does not authorize another commit');
  assert.equal(workEditRefusal(next, initial.scope, token), 'stale');
});

test('a candidate or view-only run never borrows an accepted model rollback reservation', () => {
  const work = acceptedWork(), reserved = reserveAcceptedChange(createWorkOwnership<Doc, Input>(), work.entry, work.after, work.beforeInput);
  const candidate = beginWork(reserved, work.after, work.afterInput, true);
  assert.equal(stopOwnedWork(candidate, work.after, work.afterInput, work.entry).target, null);
});

test('same-content document or input ABA and a lookalike history entry do not authorize rollback', () => {
  const work = acceptedWork();
  const cases = [
    [structuredClone(work.after), work.afterInput, work.entry],
    [work.after, structuredClone(work.afterInput), work.entry],
    [work.after, work.afterInput, { doc: work.before, marker: 3 }],
    [work.after, work.afterInput, history(doc('unrelated later edit'))],
  ] as const;
  for (const [current, evaluated, top] of cases) assert.equal(stopOwnedWork(work.state, current, evaluated, top).target, null);
  assert.equal(work.state.run?.token, work.token, 'refused rollback does not mutate the original owner object');
});

test('old completion and finally callbacks cannot release a newer owner or a newer Render reservation', () => {
  const old = acceptedWork(), invalidated = invalidateWork(old.state), accepted = doc('new file'), evaluated = input('new file input');
  const newer = beginWork(invalidated, accepted, evaluated, false); assert.ok(newer.run);
  assert.equal(finishWork(newer, old.token), newer);
  assert.equal(workEditRefusal(newer, newer.scope), 'pending');
  assert.equal(stopOwnedWork(newer, accepted, evaluated, old.entry).target, null);
  const reserved = reserveAcceptedChange(invalidated, history(accepted), doc('render setting', 1, true), evaluated);
  assert.equal(finishWork(reserved, old.token), reserved); assert.equal(workEditRefusal(reserved, reserved.scope), 'pending');
});

test('new Open invalidates ownership even when the old document object is reused; redo gets a new owner', () => {
  const old = acceptedWork(), opened = invalidateWork(old.state);
  assert.equal(stopOwnedWork(opened, old.after, old.afterInput, old.entry).target, null);
  assert.equal(workEditRefusal(opened, old.state.scope), 'stale');
  const redoEntry = history(old.before, 3), redone = beginWork(reserveAcceptedChange(opened, redoEntry, old.after, old.beforeInput), old.after, old.afterInput, false);
  assert.ok(redone.run); assert.notEqual(redone.run.token, old.token);
  assert.equal(finishWork(redone, old.token), redone);
  assert.equal(stopOwnedWork(redone, old.after, old.afterInput, old.entry).target, null);
  assert.deepEqual(stopOwnedWork(redone, old.after, old.afterInput, redoEntry).target, redoEntry);
});

test('two Render-only reservations settle normally and cannot attach themselves to a later model computation', () => {
  const original = doc('accepted'), evaluated = input('unchanged model');
  let state = createWorkOwnership<Doc, Input>(), current = original;
  for (const grid of [true, false]) {
    const next = doc(`grid ${grid}`, 1, grid), entry = history(current);
    state = reserveAcceptedChange(state, entry, next, evaluated);
    assert.equal(workEditRefusal(state, state.scope), 'pending');
    state = settleWorkReservation(state, next, evaluated); current = next;
    assert.equal(state.reservation, null); assert.equal(workEditRefusal(state, state.scope), null);
  }
  state = beginWork(state, current, input('later unrelated work'), false);
  assert.equal(stopOwnedWork(state, current, state.run!.input, history(original)).target, null);
});

test('a reservation survives a changed evaluated identity until the corresponding work begins', () => {
  const before = doc('before'), after = doc('model edit', 2), oldInput = input('old'), newInput = input('new'), entry = history(before);
  const reserved = reserveAcceptedChange(createWorkOwnership<Doc, Input>(), entry, after, oldInput);
  const waiting = settleWorkReservation(reserved, after, newInput);
  assert.equal(workEditRefusal(waiting, waiting.scope), 'pending');
  const running = beginWork(waiting, after, newInput, false);
  assert.deepEqual(stopOwnedWork(running, after, newInput, entry).target, entry);
});

test('a rejected or throwing pre-accept transition releases its reservation without reserving an unrelated document', () => {
  const before = doc('accepted'), after = doc('not accepted', 2), evaluated = input('accepted input'), entry = history(before);
  const reserved = reserveAcceptedChange(createWorkOwnership<Doc, Input>(), entry, after, evaluated);
  // The caller's exception/finally path supplies the actual unchanged document, not the unaccepted proposal.
  let released = reserved;
  assert.throws(() => { try { throw new Error('candidate rejected before acceptance'); } finally { released = settleWorkReservation(reserved, before, evaluated); } }, /candidate rejected/);
  assert.equal(released.reservation, null); assert.equal(workEditRefusal(released, released.scope), null);
  const following = beginWork(released, before, input('subsequent evaluation'), false);
  assert.equal(stopOwnedWork(following, before, following.run!.input, entry).target, null);
});

test('matching completion releases ordinary or hand-off work without a worker request and allows the next edit', () => {
  for (const candidate of [false, true]) {
    const state = beginWork(createWorkOwnership<Doc, Input>(), doc('accepted'), input(candidate ? 'candidate hand-off' : 'normal work'), candidate);
    assert.ok(state.run);
    const completed = finishWork(state, state.run.token);
    assert.equal(completed.run, null); assert.equal(completed.reservation, null);
    assert.equal(workEditRefusal(completed, completed.scope), null);
    const next = reserveAcceptedChange(completed, history(doc('accepted')), doc('next accepted', 2), input('next base'));
    assert.equal(workEditRefusal(next, next.scope), 'pending');
  }
});
