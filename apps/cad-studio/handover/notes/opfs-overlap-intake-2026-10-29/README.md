# OPFS conditional-write intake — 2026-10-29

Issue2241 is attached to existing roadmap12 CG6/O9. This intake reads the real issue and
retains the external execution and peer review; it reruns no runtime/browser check and edits
no storage source. D318 skeleton admission remains selected. Existing registered P1 data/file/
lifetime repairs precede this bounded P2. No duplicate issue or implementation queue is created.

The external report observes native Chrome156 OPFS on the unchanged handleStore adapter.
Both same-path writers use the same original expected tag and acquire native createWritable()
streams before either closes; only the admitted return is delayed by an audit barrier. A commits,
then B also succeeds and replaces A. A serial stale-write refusal control passes. Observed native
stream mode is siloed in this run; no portable default is asserted. One console404 lacks a URL.
Actual Studio UI overlap, two tabs, external-folder/program conflict and user file loss are NOT_RUN.

Acceptance: coordinate the supported adapter/path from expected-tag validation through close
and returned-tag read, including unconditional writers. A later stale expected tag must refuse
and preserve the first successful bytes; fresh-tag writes, returned-tag ownership and failure/
cancellation cleanup must pass. A per-instance queue proves only that scope. Wider cooperating
instances/tabs require a stated ownership scope and separate proof; no universal cross-process
atomic-CAS or external-program lock is required. Do not wait for two native streams to admit in
a queue-aware regression, since correct exclusion prevents that schedule.

The owner authorizes closing issues after roadmap transfer. Any closure receipt means transfer,
not source repair or product completion. The actual issue body is retained in source.json.
D317's independent source/retained-receipt review confirms39/39 qualification artifacts,23/23
consumer artifacts and5/5 source hashes; its independent runtime/browser/visual rerun is NOT_RUN.
No successful D317 test was repeated for this acknowledgement.

Fresh GitHub verification confirms issue2241 CLOSED after transfer, original body unchanged,
no body/comment writes. See closure.json. This is not a defect-fix completion.

## Later D320 repair

[Final qualification](../opfs-write-ownership-2026-10-29/qualification.json) supplies same-instance/
exact-path queue ownership and actual native OPFS proof. Wider instance/tab/remove/CAS and
actual Studio scheduling remain unqualified. Original transfer closure is not the fix receipt.
