"""Fixed stack prerequisite reservations. IDs only; no payload or process accounting."""
CAP = 64 * 1024 * 1024
CONTROL = 64 * 1024
OWNERS = ('producer', 'coordinator', 'geometry', 'position0', 'position1')
PHASES = ('prepare', 'proof', 'archive')


class LedgerError(ValueError):
    pass


def need(value, reason):
    if not value:
        raise LedgerError(reason)


class Ledger:
    __slots__ = ('_amounts', '_active', '_steps', '_phases', '_next',
                 '_last_accepted', '_first_observed_failure')

    def __init__(self):
        # Fixed control reservation covers these fixed arrays and bounded snapshots.
        self._amounts = [0] * 5
        self._active = [False] * 5
        self._steps = [0] * 3
        self._phases = [None] * 3
        self._next = 1
        self._last_accepted = 0
        self._first_observed_failure = None

    def _owner(self, owner):
        need(type(owner) is str and owner in OWNERS, 'UNKNOWN_OWNER')
        return OWNERS.index(owner)

    def _step(self, step):
        need(type(step) is int and 1 <= step <= 1200, 'STEP_ID_INVALID')
        need(step in self._steps, 'UNKNOWN_STEP')
        return self._steps.index(step)

    def reserve(self, owner, amount):
        index = self._owner(owner)
        need(type(amount) is int and amount >= 0, 'RESERVATION_AMOUNT_INVALID')
        need(not self._active[index], 'DUPLICATE_RESERVATION')
        need(amount <= CAP, 'GLOBAL_DATA_LIMIT')
        need(CONTROL + sum(self._amounts) + amount <= CAP, 'GLOBAL_DATA_LIMIT')
        self._amounts[index] = amount
        self._active[index] = True

    def release(self, owner, *, aliases_cleared=False):
        index = self._owner(owner)
        need(self._active[index], 'UNMATCHED_RELEASE')
        need(aliases_cleared is True, 'ALIASES_NOT_DECLARED_CLEARED')
        self._amounts[index] = 0
        self._active[index] = False

    def begin(self, step):
        need(type(step) is int and 1 <= step <= 1200, 'STEP_ID_INVALID')
        need(self._first_observed_failure is None, 'PREPARATION_STOPPED_AFTER_FAILURE')
        need(step == self._next, 'STEP_NOT_NEXT')
        need(0 in self._steps, 'STEP_CREDIT_LIMIT')
        index = self._steps.index(0)
        self._steps[index] = step
        self._phases[index] = 'prepare'
        self._next += 1

    def advance(self, step, phase):
        index = self._step(step)
        need(type(phase) is str and phase in ('proof', 'archive'), 'PHASE_INVALID')
        need(self._first_observed_failure is None or step < self._first_observed_failure,
             'FAILED_OR_LATER_STEP_STOPPED')
        wanted = 'proof' if self._phases[index] == 'prepare' else 'archive' if self._phases[index] == 'proof' else None
        need(phase == wanted, 'PHASE_TRANSITION_INVALID')
        self._phases[index] = phase

    def commit(self, step):
        index = self._step(step)
        need(self._phases[index] == 'archive', 'ARCHIVE_NOT_COMPLETED')
        need(self._first_observed_failure is None or step < self._first_observed_failure,
             'FAILED_OR_LATER_STEP_STOPPED')
        need(step == self._last_accepted + 1, 'NONCONTIGUOUS_COMMIT')
        # Caller invokes only AFTER complete archive persistence. No implicit IO.
        self._last_accepted = step
        self._steps[index] = 0
        self._phases[index] = None

    def fail(self, step):
        self._step(step)
        need(self._first_observed_failure is None, 'FAILURE_ALREADY_RECORDED')
        self._first_observed_failure = step

    def discard(self, step):
        index = self._step(step)
        need(self._first_observed_failure is not None and step >= self._first_observed_failure,
             'DISCARD_NOT_FAILED_OR_LATER')
        self._steps[index] = 0
        self._phases[index] = None

    def snapshot(self):
        return dict(capBytes=CAP, controllerReservedBytes=CONTROL,
                    totalReservedBytes=CONTROL + sum(self._amounts),
                    owners={owner: dict(active=self._active[index], bytes=self._amounts[index])
                            for index, owner in enumerate(OWNERS)},
                    credits=[dict(step=step, phase=phase) for step, phase in zip(self._steps, self._phases)],
                    nextStep=self._next, lastAcceptedStep=self._last_accepted,
                    firstObservedFailureStep=self._first_observed_failure,
                    earliestFailureKnown=False, whole64MiBBound=False)
