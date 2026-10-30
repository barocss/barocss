# Final source review

Sol High reviewed the final `fe99a2a25719148774ee15e69c9493c743c3e88226289cf1dcb89333a3149a1b` App without modifying or executing it. No further required repair was found. This is source evidence, separate from the consumer and root executions.

- Stop without an originating accepted transition invalidates worker-bound freshness without borrowing history. An unchanged initial/variant/view input does not restart automatically: it stays stale until an existing evaluation trigger changes. Cancelling a parameter candidate can instead trigger recomputation of the accepted base through the existing parameter-edit dependency. Do not generalize all no-origin cases as permanently stale.
- The inactive/completed guard returns before restart, ownership/cache invalidation and history changes. The exact completed-result versus click race is actual-UI NOT_RUN.
- Stop requires the exact generation, document, evaluated input and top history entry. Redo captures its document/marker synchronously. Candidate acceptance requires the current request/base/input/token; its temporary completion permission is removed in finally. Old cleanup tokens cannot clear a newer run.
- The synchronous worker-session ref invalidates old placed loops before submission, after await and before map installation. The same state value restarts the placed effect after selected Stop. Ordinary history-generation changes do not represent backend replacement. Other restart paths, including repair-stage behavior, are outside this qualification.
