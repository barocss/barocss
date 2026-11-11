# D745 — Keep interference results with their current inspection

P0, rows 15 and 16. FEATURE qualification. Parent `900c0ff610319c1abf6921b6b94e4c5e640da183`. [#2350](https://github.com/barocss/barocss/issues/2350).

The Studio captures the accepted document, evaluated input, work generation, Worker session, rollback marker and chosen bodies when an inspection starts. Each run owns its own report. The inspection checks ownership before every pair request, after every reply and before publication. Close retires the inspection locally. Document and input changes, Worker session changes, a new run and host cleanup retire prior ownership. Current result rows remain selectable by body key. Start requires current evaluated bodies.

## Qualification

- **FAIL (parent)** — Actual Studio closed a busy inspection and received the held 500 mm³ reply. The old run submitted another pair, then reopened the panel with 300 mm³ as well. When a document with the same body keys replaced the source, the old 500 mm³ row appeared under the replacement body names. The replacement's independent overlap is 200 mm³. Four baseline states reproduce both cases.
- **PASS** — Current Studio stays closed after the late 500 mm³ and after a verified native empty reply. An invalidated multi-pair run sends zero additional volume requests. Same-key Open keeps the replacement selection, Doc, history, dirty state and geometry. Its new inspection reports 200 mm³. Close and Open reuse the original Worker.
- **PASS** — Two actual overlapping inspections use the same Worker. Delivering the older reply first preserves the current Checking state. Delivering the newer reply first preserves its 300 mm³ result. The previous 500 mm³ row never appears and the older run submits no additional pair. Changing the camera and selecting the current row selects the original two bodies.
- **PASS** — Parameter-only changes keep the authored nodes and replace the evaluated input. Height 10, 8 and 6 mm gives independently expected overlap 500, 400 and 300 mm³. An old pending 400 mm³ reply is retired after accepting height 6 mm. Completed reports retire on parameter accept, first Undo, Redo and rollback. Rolling forward allows a fresh 400 mm³ check.
- **PASS** — A controlled Worker error event retires the pending inspection and the old epoch's held reply. Retry engine evaluates the same document on a new Worker and the 500 mm³ check passes. Closing the browser host during a pending run leaves a fresh host without its panel. Studio's existing engine lifecycle tests cover request disposal.
- **PASS** — Thirteen desktop states over 327 frozen sources, zero downloads, page errors and console errors. D744 desktop replay passes its 23 states including genuine CAPABILITY, verified empty, a mixed 6 mm³ clash and exact project Save/Open. Studio 36/36 focused tests cover retirement with successful, empty and stopped replies and zero new dispatches. Both type-checks, affected lint, driver syntax, production build and diff check pass.
- **FAIL (initial drivers)** — One parameter fixture used a string where the dimension requires a parameter-reference record. The next driver retained a locator from the disposed page. The final driver uses the supported reference and checks the new page.
- **NOT_RUN** — Full suites, mobile and general collision accuracy. Reply ordering and the error event were controlled. The probes themselves used the actual Worker and native box geometry.

Use Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D745_SOURCE_FROZEN=1 node apps/cad-studio/test/interference-ownership-browser.mjs "$EVIDENCE/baseline" --baseline
D745_SOURCE_FROZEN=1 node apps/cad-studio/test/interference-ownership-browser.mjs "$EVIDENCE/studio-final"
D744_SOURCE_FROZEN=1 node apps/cad-studio/test/interference-result-browser.mjs "$EVIDENCE/d744-replay"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test interference-result o9-lanes engine-client-lifecycle work-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint apps/cad-studio/src/{App.tsx,app/checkInterference.ts,state/useInterferenceCheck.ts} apps/cad-studio/test/interference-result.test.ts
node --check apps/cad-studio/test/interference-ownership-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D746 reproduces hidden-body snap candidates in actual sketch pointer input. [#2305](https://github.com/barocss/barocss/issues/2305). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
