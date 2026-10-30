# D326 / A05 executed project Open baseline

Execution HEAD: `f841c0c34a1897a88fd75a14d5fe53521181f858`.
Node: `v22.19.0`. Gate `d326-project-open-baseline` acquired and released.
Working directory: `apps/cad-studio` in the assigned worktree.

Exactly one command was executed: `node scripts/test.mjs project-open-ownership`.
Result: **exit 1; 1 PASS / 6 FAIL / 0 SKIPPED**, normal runner exit,101.36 ms.
Raw output: `baseline.log`. Actual exit: `baseline-exit.txt`. Exact checkout: `baseline-head.txt`.
`baseline-run-sha256.txt` binds the hook, codec and driver used by that run.

The unchanged control passed through real hook actions and project codecs: A document, A version log and C autosave offer were all correct. `reached()` is defined in the source driver and each controlled await was entered; no fixture/import/harness lifetime failure occurred.

The first raw assertion failure was a superseded A returning true after Close, expected false. Its diagnostic observed callback `a.bcad` and current document parameter L10. The remaining cases also failed current-acceptance assertions, with these independently recorded side effects before assertion:

| Schedule | Raw diagnostic after A completes |
|---|---|
| A readPart → Close | oldOpenAccepted true; callbacks[A]; current L10. |
| A readPart → New/detach | oldOpenAccepted true; callbacks[A]; current L10 rather than new C. |
| A readPart → B completes | oldOpenAccepted true; callbacks[B,A]; current L10 rather than B. |
| A versions read → B completes | oldOpenAccepted true; callbacks[A,B]; version head A and offer L101 overwrite B. |
| A autosave read → B completes | oldOpenAccepted true; callbacks[A,B]; head B retained, but offer L101 overwrites B's L202. |
| A checkLinked listing → B completes | oldOpenAccepted true; head B/offer L202 retained, but old A publishes child.bcad linked revision offer. |

Only callbacks and real hook live action state were observed. This is an actual hook/project-codec wrong-ownership reproduction with controlled directory transport; it is not actual App UI, Undo/dirty/recovery, browser or native OPFS evidence. The New case uses the existing hook detach path and a callback-document fixture, not a claim that the complete New button flow ran.

Both the manifest preparation HEAD and the execution HEAD are `f841c0c34a1897a88fd75a14d5fe53521181f858`. The archived A05 source/driver copies were captured after the D325 push and compared byte-identical to all seven execution inputs immediately before the run. `baseline-source/` and its preparation manifest remain unchanged. The working test driver was expanded only after this baseline, without executing that expansion; it is not the archived baseline driver. The preparation plan remains historical PREPARED_NOT_RUN; this report records the later authorized execution without rewriting that history.

No production source, other worker's source, commit or remote state changed. No build/types/lint/whole suite/browser/native test was run. Source repair waits for root's baseline approval; general App File Open is a separate lane, and this hook boundary does not close all A05. A06 remains queued.
