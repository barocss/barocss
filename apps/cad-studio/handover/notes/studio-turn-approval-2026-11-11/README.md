---
work_id: D669
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D669 — Enforce explicit approval requests for the current Studio chat turn

P0 R15, row 16. SMALL repair through the existing proposal-only autonomy policy. The separate Studio audit reported a direct L2 edit in a turn that asked the agent to wait for approval. Root reproduced it through actual desktop Studio before changing the server. This defect took priority over the ViewCube keyboard work.

The chat server reads the current person's message before selection and attachment context. It recognizes explicit Korean and English approval instructions and sets the turn's effective autonomy to L1. The prompt and CAD MCP process receive the same effective level. The policy ends with that turn and preserves the Studio preference. It supports the recorded clause patterns. General intent recognition and arbitrary phrasing remain unqualified.

| Check | Result | Evidence |
| --- | --- | --- |
| Original L2 direct edit | FAIL | With `n2.side0` selected, the Korean request explicitly prohibited applying before approval. The scripted call `features.edit` changed the left bore from Ø6 to Ø8. No proposal was open. One Undo restored the exact original document. |
| Updated L2 direct edit | PASS | The same message and tool call returned a refusal. Both bores stayed Ø6 and the model history and document stayed exact. The Studio autonomy preference stayed L2. |
| Review, Reject and Accept | PASS | Preview switched Before/After on P1. Reject changed its proposal status and preserved the model and feature history. The equivalent P2 required one Studio Accept, recorded one user approval, and changed only the left bore. One Undo restored the exact waiting document and feature history. |
| Existing policy controls | PASS | L1 still refuses an ordinary direct edit. L4 refused agent acceptance in a turn with an explicit approval instruction. L2 refused the protected empty-part build, then allowed a new ordinary first build. Ordinary L2 single-feature editing still applied directly. |
| Focused checks | PASS | 36 Studio tests, Studio and CAD Model TypeScript, changed-source lint and browser syntax. |
| Driver corrections | FAIL | The first fixture used the wrong native output key. The first probe selected the top face before moving the sample up the cylindrical wall. The first extended fixed driver asserted exact integer volume for a floating-point Box result. The retained final run corrects all three. |
| Live and wider coverage | NOT_RUN | Actual Codex CLI or other model inference, alternate approval phrasing and other model edit families, mobile and whole CAD readiness. |

The native 60 × 40 × 8 mm plate has bore centers (10, 20) and (50, 20) mm. The working model measured 18,747.610657883095 mm³ before approval and 18,571.681469282048 mm³ after approval. The check compares the volume to the analytic two-cylinder subtraction within 1 mm³ and checks authored dimensions, feature IDs, output and the untouched bore. The model and feature history after Undo match the pre-approval state. The scripted executable replaces model inference. The real Studio UI, Chat server, stdio CAD MCP, model evaluator and proposal controls run in the proof. The final run verified 328 frozen source files through cleanup and recorded zero page errors, console errors and downloads.

Use Node 22.19.0. Run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. Run browser commands from `apps/cad-studio` and use an external `EVIDENCE` directory.

- Baseline `CAD_STUDIO_CHAT_PORT=52391 D669_APPROVAL_SOURCE_FROZEN=1 node test/turn-approval-browser.mjs "$EVIDENCE/exact-baseline" --baseline`. Receipt SHA-256 `85cb0059163164603898339a26026b86e006cdb75cc0018023fecce84ccf4646`.
- The fixture, selection and exact-equality driver failures retain receipt hashes `ece0dabe4c9b40c85be376b52f1190279da65f5838372c05dfb9e40d2183dc1f`, `aa5aea7d64824caaa508f06ece829a346ad96351946c052d18b0b52e755e02b1` and `0433ca56728421d097027a53d3fce4cc243c04d9224cede1592c6be953a81ca3`.
- Final `CAD_STUDIO_CHAT_PORT=52391 D669_APPROVAL_SOURCE_FROZEN=1 node test/turn-approval-browser.mjs "$EVIDENCE/final" --fixed`. Receipt SHA-256 `feef363dfc45ffb038d972c781bb703840944061d9c0f9e073bf90087857f0ae`.
- From the root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test turn-autonomy chat toolset-mcp o17-transport`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `pnpm exec eslint apps/cad-studio/server/turnAutonomy.ts apps/cad-studio/server/chatServer.ts apps/cad-studio/test/turn-autonomy.test.ts`, `node --check apps/cad-studio/test/turn-approval-browser.mjs` and `git diff --check`.

## Direct MCP follow-up

An independent audit verified the HTTP approval guard against source hashes `972b5e3e9907` and `83b5d83b9d1e`. In its earlier live Codex CLI run at `21e196e2d`, the model chose open proposals and left the geometry unchanged. A separate forced direct stdio MCP call at the same baseline applied the edit under L2. D669 covers the Studio Chat entry point. D670 addresses the state-backed stdio entry point. Live inference on the fixed Studio Chat path remains NOT_RUN.

The ViewCube keyboard work resumes after D670. Its retained baseline receipt SHA-256 is `d511e64994000ba37933d779b680d3bd86e87329cfd3e8417e742ab8030c9743`. At 1280 × 720 and 1024 × 768 Tab skipped the ViewCube. Pointer face, edge, corner and orbit passed. The baseline driver remains in external evidence and no ViewCube product changes were made. Initial scenarios remain 4/10, B09 remains 9/9 and whole CAD readiness is **NOT_MEASURED**. The wider [#2402](https://github.com/barocss/barocss/issues/2402) remains open.
