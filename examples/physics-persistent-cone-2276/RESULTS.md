---
workid: physics-persistent-cone-2276
artifact: FINITE_SOURCE_PERSISTENT_CONE_FIRST_FAILURE
status: NO_GO_FIRST_STATIC_CONSTITUTIVE_CASE
owner: Codex
source_request: Package the actual first constitutive failure
last_updated: 2026-11-03
---

The frozen Source campaign is NO_GO at the first `before` case. One World completed one actual committed step before the independent constitutive audit failed. The step produced 108 applications, 10 total queries, 9 points and 243 anchor checks. All controls for `at` and `after` remain NOT_RUN. Input words, iteration limits and gates are unchanged.

Initial geometry and physical checks, force geometry and the complete one-step physical ledger passed. The first constitutive failure is `eventsStaticZeroContactVelocity0 = 0.1410596011492487 m/s`, above the unchanged 1e-10 static sticking gate. Step acceptance by the engine does not imply constitutive qualification.

The saved independent 3x3 contact matrix is [[395/128,-3/4,-15/32],[-3/4,251/128,-15/16],[-15/32,-15/16,23/8]]. Its saved exact sticking impulse is [917503/8388608,9371647/67108864,17825791/1073741824] Ns. The exact static squared margin is -34898689791/1152921504606846976, so the saved reference requires STATIC_STICK. The exact reference, actual event-summed impulse and actual producer impulse are retained in RESULTS.json without re-solving.

Read-only decoding of the saved trace identifies 44 normal and 64 tangent applications. All 64 tangent decisions select dynamic. On the first tangent decision, requested magnitude is 0.10146605639161764 Ns and the current partial normal cache gives a static limit of 0.06574878129232452 Ns. On the last decision, requested magnitude is 0.11227932497844108 Ns, static limit 0.09235903051770232 Ns and dynamic limit 0.06465132136239161 Ns. The actual final tangent speed is 0.1441532024458636 m/s. These observed branch values diagnose partial-normal-cache coupling for this fixed case. They do not establish a replacement solver or general convergence result.

The maximum step momentum residual is 3.9478882299124983e-17 Ns, energy ledger residual 2.3261469828081017e-18 J and applied tangent-plane residual 1.9767779137522122e-18 Ns. Those passing physical ledgers do not clear the static constitutive failure. Saved exact Fraction arithmetic and 80/120-digit norm checks retain their original gates and precision diagnostics.

The guarded freeze passed. The actual run stopped at its first failure in about 2.037 s. The original reference command receipt is retained separately. Exact commands, guard boundaries, every application branch/impulse row, all saved constitutive rows and every observer maximum are in RESULTS.json and original evidence. No physical observer, reference generator, World or browser was rerun for packaging. Only the authenticated qualified decoder was used to read stored words.

The archive contains the full own folder, frozen Source provider and dependency closure, original observers, input/model/options words, exact reference and design contracts, root execution review, traces, accepted output, first-failure prefix and freeze/run/reference command receipts. Every logical archive member is read back and hashed. Native, browser, production, performance and new-solver qualification are NOT_RUN. Original P4 NO_GO remains unchanged.
