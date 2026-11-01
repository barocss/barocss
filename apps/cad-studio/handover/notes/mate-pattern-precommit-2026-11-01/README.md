---
work_id: D413
artifact_type: qualification
status: done
owner_role: executor
source_request: D383 registered follow-up; continue the CAD roadmap
last_updated: 2026-11-01
---

# D413 — Refuse unsettled pattern mates before Studio commit

Bounded-qualified, small tier. Implementation and checks: GPT-6.1 Sol Medium. [Commands/counts](qualification.json).

## Reproduction and correction

Studio finished, edited or locked a mate with one assembly solve. A pattern seed→part→occurrence feedback could therefore move the seed and enter history before the automatic repeated solve reported that the pattern did not settle. The model API already refused this change.

A private Studio guard now uses the existing `resolved` and `unsettledRefusal`, with current authoritative face tables, before each of those three commits. It returns the same existing model reason. A refused finish retains the first pick for recovery. No solver, pattern rule, public API, schema, agent command or dependency changes.

## PASS

- 11 focused checks: five new real-hook tests and six existing linked-face checks. Only React scheduling and the unused worker client are replaced; model solver, patterns and face tables are real.
- All three refused write paths have zero document/history commits and the exact model `MATE_UNMET` reason. Valid edit/Lock, retained-pick recovery, a valid seed mate requiring pattern regeneration and pending-face zero-write controls pass.
- Studio types, post-final-test model types, scoped lint, driver syntax and diff checks.
- Actual run01 passed finish refusal/retained first pick/document equality, Cancel recovery, valid mate and exact Undo/Redo before its later driver failure. Actual run02 ran only the failed edit phase and native Open prerequisite: changing a settled distance from -40 to -39 refused, kept the document and restored the -40 field.
- Both runs: 740 frozen files unchanged, zero page/console errors, downloads or source changes; context/browser/server closed and gate released. Root reviewed three images. Finish refusal is DOM evidence because its text is below the first image's fold; run02 visibly shows the exact refusal and retained editor value.

## FAIL retained

Original hook finish committed once. The expanded original-hook control failed four of five tests (finish/edit/Lock/recovery), with the valid/pending control passing. A first baseline harness lacked its stdin TypeScript loader; another test briefly reused a stale API after a successful commit while fresh faces were pending. Both harness errors remain in raw evidence.

Actual run01 remains a whole-run FAIL: after Open, clicking its already-selected mate closed the editor and the distance-input locator timed out. A driver-only correction and `FLOW_ONLY=edit` produced run02 PASS. There is no clean whole-flow claim and no passing phase was rerun.

## NOT_RUN and boundaries

Actual Lock cycle and pending-face race are focused real-hook evidence only. General closed-loop physics/geometry, Save/outbound files, full baseline/kernel suites, CI and release are not qualified. Small tier requires no independent audit. Generic Material glyph words remain visible with font CSS empty, the known U3 limit.

U3's standard offline Lucide add failed with `ERR_PNPM_NO_OFFLINE_META`: zero downloads and no manifest/lockfile edits. Fresh download permission is pending. The D398 source-only assessment found view layout already recomputed on moves; automatic scale/room/dimension optimization remains the explicit Auto action, so no accuracy defect or source change is claimed there. OCP/source/native build remain removed.

#538 remains an incomplete backlog epic. #2180 is already closed as research; no product closure follows. A bounded mate-cycle title search found no dedicated issue. Next D414 assesses the registered drawing DXF-header follow-up; production/motion/external-SDK holds stay unchanged.

Raw evidence only: `/tmp/barocss-d413-checks`, `/tmp/barocss-d413-browser-run01`, `/tmp/barocss-d413-browser-run02`, `/tmp/barocss-d413-capsule`. No logs, screenshots, binaries or native fixtures are committed.
