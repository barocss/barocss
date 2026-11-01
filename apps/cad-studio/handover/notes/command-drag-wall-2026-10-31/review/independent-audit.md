# D368 independent audit (claude-opus-5-5 sub-agent, 2026-10-31)

The audit was read-only, on 5179126c1 plus the first 20② fix. The harness is in [../audit](../audit):
- `build.mjs` (`ORIG=1` builds HEAD);
- `scen.mjs` and `rolled.mjs`;
- `mutants.mjs` and `runmut.mjs`;
- `fixcand.json`, the candidate patch checked on copies.

The fix round's reruns and mutants are in [../audit-fix](../audit-fix).

**Verdict: CHANGES_REQUIRED.**

## Holds

- **A/B/C** settle at 6.5, 5 and 5.5 at 5, 60 and 150 ms.
- **Bounded.** The bisect is bounded: at most about log2(gap/step) evaluations, and the queue drained in every scenario.
- **Cancellation.** Escape, unmount, a command replaced mid-bisect and HUD typing all stop it.
- **Value range.** The value never lies beyond the pointer. When the limit drops mid-drag (`geomchange`) it settles at 3.5, where HEAD stayed at a refused 6.
- **Other drags.** Drags without refusals take the same path as HEAD. The full studio suite passed 537/537.

## Findings and root disposition

- **F1 (medium-high): fixed.** Holding or jittering the pointer past the bound made the value swing back and forth: 4 ↔ 5.5, 11 swings in 40 frames at 60 ms. For a rolled preview at 150 ms it swung 10 ↔ 6. HEAD stayed steady.
  - Causes: `onDrag` reset to lastOk on every move, cancelling the in-flight midpoint; and any stale success moved lastOk back.
  - Fix: keep the in-flight value strictly between lastOk and bad, and move lastOk only on a live success, with no bound, or toward bad. After the fix, still60, jitter60, jitter150 and rolled60/150 move one way and settle.
- **F2 (low): fixed.** Of 15 mutants, 9 survived, including "remove the past-bound clamp" and "never clear bad". The tests now cover:
  - the held-past-bound sequence;
  - later validity;
  - a stale failure at 60 ms;
  - a late refusal;
  - the release commit.

  After the fix round, the auditor's set plus the F1 mutants: 16 killed. Survivors: M14 is equivalent; F1a and F1c are timing-only dips that would be flaky to assert; F1d is a one-frame transient.
- **F3 (note): stated as intended.** Release does not stop the bisect, and Enter applies the converged, kernel-accepted value.
- **Side notes.**
  - Off-grid starts give off-grid midpoints.
  - A new drag during a post-release bisect takes the in-flight midpoint as lastOk. This is pre-existing.
