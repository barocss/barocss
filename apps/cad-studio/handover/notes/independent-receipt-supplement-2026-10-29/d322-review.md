# D322 late Save: source and author-receipt review

**APPROVE_BOUNDED_AUTHOR_RECEIPTS.** The selected late-Save source guards and the author’s three repaired-source browser cases agree. No new actionable regression was found in this scope. This is a source/receipt review. **Independent execution: NOT_RUN.** No heavy slot, test, build, browser, app server or native instrumentation was started.

Exact reviewed commit: `27500e219febc591845cd5e4c53341a24ca9d39b` (`fix(studio): retain current work across late project saves`). Repository: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. All product source and author evidence were read with explicit `git -C … show COMMIT:path`. The author’s current dirty `project.ts` and canonical-version-snapshot work were not read as the reviewed source, changed or reverted. Existing design tests were not repeated.

## Source decision

References below are lines in the exact commit, not a claim about a later working tree.

- `apps/cad-studio/src/App.tsx:378–391` adds a token for every document state dispatch. The Save closure uses the token from its own render. Direct document updates update `docNow`; functional updates are forwarded unchanged to React. The raw setter has only the two calls inside this wrapper. This avoids borrowing a newer token and avoids eager execution of functional updaters.
- `App.tsx:564–566` keeps the current filename in a synchronous ref. `App.tsx:2028–2038` captures rendered document, render token and name. Its project-save callback clears dirty/local recovery only if all three still match. Token comparison protects document ABA and conservative no-op dispatch invalidation; the document reference also rejects a mismatched old render. The download-only path is unchanged.
- `apps/cad-studio/src/storage/useProject.ts:43–51, 60–86` owns Save session/path identity separately from App document identity. Store use, Close, Detach and Open-part request invalidate earlier saves. Detach invalidates before its null-part/log early return. Public New part calls `replaceDoc` and Detach (`App.tsx:2013–2019, 3580`).
- `useProject.ts:100–125` admits a successful file receipt only for the same owner/store/path. It advances the file tag even if a later document edit occurred, so the next current Save does not conflict with its own earlier write. `saveOwnership.ts:7–10` rejects an older successful receipt after a newer one. The first null-to-path transition is allowed. Versions read and parts listing recheck current successful ownership after await. The final check and App callback share one synchronous interval.
- `useProject.ts:126–129` suppresses stale errors; current STORAGE_CHANGED and generic write errors retain their refusal path and do not call the success callback. A current versions-read error remains an explicit versions error; this is not a claim that every generic asynchronous operation is guarded.
- Save no longer physically removes native autosave. Exact-commit `storage/project.ts:71–79` retains the existing rule that hides a checkpoint whose encoded bytes equal the saved file. Explicit user discard still removes its checkpoint (`useProject.ts:135`). Physical retention and UI offer filtering are different facts.

## Artifact and runtime binding

Manifest schema was read before resolving paths. `qualification-artifacts.json` is a map from artifact paths relative to the note directory to bytes/SHA-256. `consumers/artifact-manifest.json` uses `algorithm` and `files[]`; its paths are relative to `consumers/`. These paths are evidence files, not product source paths.

- Parent manifest: **124/124** byte/hash matches. Consumer manifest: **106/106** matches. These overlap: **230 reference comparisons, 124 unique artifact files**. They are not tests.
- Qualification source hashes: **7/7** match exact commit. Final runtime profile: **6/6** match exact commit, including App, useProject, saveOwnership and exact storage/recovery dependencies. The two final gzip driver/helper capsules match both their compressed hashes and decompressed source hashes; both source files also match the commit.
- First/second baseline profiles each bind five runtime files to `a386c8705beda2c72d215da61a55fd6119351ca2`; each retains two matching original driver capsules. Preparatory driver variants are not substituted for the final executed driver.
- The final raw case receipts still carry `baseline=a386…`. That field alone does not identify repaired runtime. Their repaired-source binding is the separate final source profile, whose six hashes match the reviewed commit. There is no complete imported/dependency input-audit in this selected profile; approval is bounded to the recorded sources and author receipts.
- Nineteen saved/autosave `.bcad` observation files match their recorded byte sizes and parsed documents. Exact raw saved A bytes remain unchanged from held-save through after-release in all three cases. In same-document, native autosave B before/after release has SHA `d01e692d999153d9be697a6b664449286524b89b2427a3394b99bd2d4047315d`; normal Save B’s main file has that same raw hash. This is raw-byte proof in addition to semantic JSON equality.

## What the author actually proved

Raw final TAP and exit files report **3 PASS / 0 FAIL / 0 SKIP**, exit 0, 29064.115208 ms in Chrome 156.0.8078.48/WebGPU/DPR 1. Each receipt contains real public UI state, original native saved bytes, native progress events and cleanup records.

| Selected schedule | Preserved/applied result in author receipt | Proof boundary |
|---|---|---|
| Same document, newer Render Grid edit B while Save A return is held | Live B remains dirty; native A remains saved; native autosave B remains. Normal public Save B then becomes clean, writes native B and shows no self-conflict. | Local recovery was null before and after. This case proves native autosave retention, not local-recovery retention. Private tag ref is not exposed; next successful Save is the behavioral tag check. |
| Public New part, new 12×13×14 Box and new name | New live document stays dirty, fresh/massReady, volume within 1e-8 of 2184 mm³. Exact local recovery string remains; no old active part is attached. Old saved A remains as original file. | This case proves local recovery and binding, not new-document native autosave. |
| Public Close project | Accepted document remains; project, active part, document list and old version/part UI remain closed. No stale project refresh is observed. Saved A remains valid. | This is project-session isolation, not an Open/switch or browser-close/crash test. |

The scheduler forwards real native receivers, arguments, handles, bytes and results. It holds one owned Save close **return after native close committed**. It marks inspection I/O separately from production I/O. Completion requires the production returned-tag read; same-document also requires actual project listing completion. New/Close take a stale synchronous continuation that returns before refresh. This is author-controlled scheduling, not a natural fault or timing-frequency claim. No scheduler or runtime was rerun by this review.

The focused final raw log reports **9 PASS / 0 FAIL / 0 SKIP**, exit 0: two pure ownership decisions and seven actual-hook tests with an in-memory directory-handle stand-in. Root Studio raw log reports **398 PASS / 0 FAIL / 0 SKIP**, exit 0; it already includes the focused nine. Do not add these as unique tests. The separate existing D321 Stop regression reports exit 0 and is reused affected-flow coverage. Types/lint/docs claims remain author evidence, not independent current checks.

## Earlier failures remain distinct

1. Audit A02 at `e1f2b05d…` was a source-reachable candidate. `runs/studio-005-prepared/attempt-outcome.json` records automated content classification failure during preparation, with no executable probe, guard or browser. That is **NOT_RUN**, not the author’s reproduction or a passed test.
2. Author first browser attempt at a386 was a setup/schedule failure: an asynchronous predicate was treated as truthy before a completed newer autosave existed; null `doc` access followed. Old Save release and final safe assertions were not reached. Raw exit 1 and capsule remain.
3. Author second baseline run at a386 reached native completion and failed the safe-ownership assertion: `late Save A must not mark newer Render edit B clean / false !== true`. Live B and saved A remained, but B became clean and its completed native autosave disappeared. Local recovery was null at both checkpoints, so recovery loss was not observed in that case.
4. First focused harness had nine passing assertions but a persistent React server.browser MessageChannel prevented process exit; its owned PID was terminated and the file-level failure remains. The final test-only server.edge import correction exits normally with the same nine cases. Do not erase the first failure or count eighteen unique passes.

## Remaining limits and next checkpoint

This does not establish all A02/A05 ownership, actual Open-file/project/path-switch during pending Save, full App ABA/old-render/no-op timing, cross-tab/process/folder behavior, natural IO failure, real crash or permanent user-file loss. It does not accept the whole product or commercial CAD readiness. No new issue or product change follows from this review.

One next independent check, only in a separately authorized finite cycle: freeze the complete `27500e2` dependency graph and bundle the existing focused test unchanged, then run only `actual hook: late Save retains newer recovery, advances its tag, and keeps saved-equal checkpoint hidden` with Node22 `--test --test-name-pattern`. This single hook case needs no native-method override and can independently check A/B checkpoint and next-Save tag behavior. It remains a stand-in test, not browser/native proof. The exact command and prerequisite are in the companion verification JSON. This cycle stops here.
