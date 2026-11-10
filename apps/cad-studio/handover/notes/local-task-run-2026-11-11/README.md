---
work_id: D586
artifact_type: local-worker-run-qualification
status: qualified-local-two-worker-profile
last_updated: 2026-11-11
---

# D586 — Execute and recover a two-worker CAD run

P0, B09, rows 04 and 16. FULL qualification of the first local execution profile. [#2401](https://github.com/barocss/barocss/issues/2401).

The existing CAD CLI can start a run from a native source, a two-task plan and local height submissions. Independent Node workers use separate Model evaluations. The host revalidates their evidence against the admitted task and holds each result for a trusted decision. A first approval changes the accepted input. The other result needs fresh native verification on that input and a fresh decision. The CLI shows current scope, geometry and budget. It uses a terminal operator for decisions and control. Its local terminal is the trust boundary. The host API exercises Pause and Stop while workers are active. The CLI status command reads the current checkpoint without taking writer ownership.

Each run has a unique identity and one local writer. It retains versioned operation reservations, attempts, epochs, known effort, unresolved reservations, scoped evidence and decisions separately from the native document. A native file is durable before the atomic record update points to it. A staged native file does not become authoritative by itself. Restart checks the record and accepted digest, advances the epoch, restores held decisions and accounts for interrupted work. It does not replay uncertain writes.

The controlled tests kill the actual host after durable dispatch reservation, after a worker starts, after a held result, during native integration, after the native file is durable and after the record is durable. The first five recover the previous accepted file. The sixth recovers the already committed result and answers the same operation without another write. The tests also cover worker, lease and request identity, cancellation, pause, permission reduction, questions, usage, writer ownership, storage failure and corrupt native data.

A trusted answer goes through the existing D584 question binding. It commits a new specification and stales old results. Permission reduction pauses the run, retires its old work and preserves known and unresolved usage. Native publication rechecks the authority, lease and base. Cancellation can stop a local worker and can also discard late output from work that already ran. No provider can publish a file or supply its own approval.

Actual desktop Studio opened the native file accepted by the local host. The two independent reference volumes were 1,200 and 384 mm³. Studio edited the lid to 5 mm, measured 480 mm³, saved to the browser project and opened the saved bytes in a new context. The existing BOM output matched the two accepted occurrence IDs and 4.277 g. Independent volume and the specified 6061 density give 4.2768 g before the existing per-item rounding.

The timing comparison uses the same input and verification in six fresh local processes. It records native overlap, launch, checking, integration, recovery, revalidation, wall time and peak RSS. It checks that outputs differ only by authored history and proposal timestamps. Median wall time was 737.7 ms with one worker and 501.1 ms with two. Peak process RSS was 167,136 and 202,176 KiB respectively. Native evaluation overlapped by 29.1–40.5 ms in the three parallel runs. Adopt the local profile as an explicit one- or two-worker choice. The sample does not set a default for larger runs. Provider tokens and cost are zero. [Commands and receipts](qualification.json).

- **PASS** — 68 Studio runner tests, 45 Model tests, controlled native and worker tests, process crash recovery, actual CLI and terminal boundary, Studio Open, edit, Save and fresh Open, existing BOM output, affected lint and type checks, Studio build and six targeted mutations. The final Studio run preserved 954 source pins through cleanup.
- **FAIL** — initial fixture used a reserved occurrence name. Early static checks caught a callback error type and unsafe cleanup. The first terminal test exposed a raw-mode input hang. The first BOM browser driver compared unrounded mass with the existing rounded output. The corrected runner repeats these paths. The benchmark compares exact native content after removing only eight history and proposal timestamps. Its first whole-file comparison reported those expected timestamp differences. The independent audits found mutation, cross-run authority, storage callback and effort accounting gaps. Regressions cover their corrections.
- **NOT_RUN** — live providers, networked workers, remote storage, power-loss durability, Studio UI approval, whole Model and kernel suites and whole B09 acceptance.

Whole CAD remains **NOT_MEASURED**.

Next is D587, P0, B09, rows 04, 12 and 16. Freeze the editable CLI/MCP/Studio consumer matrix, join the retained evidence and verify its first uncovered path. [B09 scope](../../roadmap-tracks/04-product-baseline.md).
