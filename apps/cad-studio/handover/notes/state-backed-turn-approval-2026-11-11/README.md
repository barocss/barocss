---
work_id: D670
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D670 — Enforce approval on state-backed CAD MCP turns

P0 R16, row 16. SMALL repair of the existing proposal-only policy at the state-backed MCP entry point. D669 protects Studio Chat. The current state file now supplies the current person's approval requirement to CAD tools when an external host starts the same MCP process directly.

The state file's last authored turn takes precedence. The host's `CAD_PROMPT` supplies the text when the turn has no authored history. The server reads the requirement once when the state file opens and passes it to each tool invocation. The host requirement can only reduce autonomy. Both the direct model edit gate and the agent proposal acceptance gate use it. Standalone `--doc` continues to use the configured level for the local document.

| Check | Result | Evidence |
| --- | --- | --- |
| Original state-backed edit | FAIL | A raw L2 `features.edit` changed the left bore from Ø6 to Ø8 while the latest authored turn required approval. The state advanced to version 1 and had zero open proposals. |
| Current request and fallback | PASS | Direct L2 editing was refused with protected text in either the latest authored turn or the fallback host prompt. Each refused state file stayed byte-identical. A subsequent read reported 18,747.611 mm³. |
| Current turn and standalone controls | PASS | A new ordinary authored turn took precedence over earlier protected text and applied the normal L2 edit. The actual `cad-mcp --doc --autonomy 2` invocation also applied the edit. |
| Proposal and agent acceptance | PASS | A protected L4 process made one open proposal and refused both acceptance and direct editing in the same process. A fresh protected process also refused both calls with exact bytes. |
| Actual Studio consumer | PASS | Opened the MCP's pending proposal in desktop WebGPU Studio. Preview preserved the exact working document. User Accept changed only the left bore and recorded one acceptance. One Undo restored the exact pending document and geometry. |
| Studio Chat regression | PASS | Re-ran the D669 desktop Chat flow with the real server, stdio MCP and scripted model. |
| Focused checks | PASS | Studio 42 and CAD Model 29 focused tests passed. Both TypeScript checks, changed-source lint and browser syntax passed. |
| Wider execution | NOT_RUN | Live model inference, new natural-language variants, evaluation harness auto-approval, mobile and whole CAD readiness. |

The original 60 × 40 × 8 mm plate has centers (10, 20) and (50, 20) mm. The actual Studio volume is 18,747.610657883095 mm³ with two Ø6 bores and 18,571.681469282048 mm³ after approval of the left Ø8 bore. The test checks both authored radii, feature IDs, centers, output identity and volume against analytic cylinder subtraction with a 1 mm³ tolerance. The final run checked 327 frozen files through cleanup, recorded zero page errors, console errors and downloads, and reviewed the Preview and Accept screenshots.

Use Node 22.19.0 and one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. Run browser commands from `apps/cad-studio` with external `EVIDENCE`.

- Baseline `D670_SOURCE_FROZEN=1 node test/state-backed-approval-browser.mjs "$EVIDENCE/baseline" --baseline`. Receipt SHA-256 `f40e93110beb1f4d6825e2227f934496df46210aff28d8592885d7e897dbd3d5`.
- Fixed `D670_SOURCE_FROZEN=1 node test/state-backed-approval-browser.mjs "$EVIDENCE/fixed" --fixed`. Receipt SHA-256 `8e148b2c560729bcb3a498e2c8041dc966287fac7e93d1904047374c9b0e664d`.
- Studio Chat regression `CAD_STUDIO_CHAT_PORT=52391 D669_APPROVAL_SOURCE_FROZEN=1 node test/turn-approval-browser.mjs "$EVIDENCE/studio-chat" --fixed`. Receipt SHA-256 `ab3a86a8bde3971fa9fce54ded05e447f106a1ee711eeb0823969f64f3398ba0`.
- From the root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test turn-autonomy chat toolset-mcp cad-external o17-transport`, `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test proposals chat-merge nested-parameter-proposal`, Studio and CAD Model TypeScript, ESLint on the five changed TypeScript sources, `node --check apps/cad-studio/test/state-backed-approval-browser.mjs` and `git diff --check`.

D671 resumes the ViewCube keyboard work from the D669 baseline. Initial scenarios remain 4/10, B09 remains 9/9 and whole CAD readiness is **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) stays open for the broader AI-native CAD program.
