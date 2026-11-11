---
work_id: D673
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D673 — Show one Chat startup instruction for each unavailable state

P4, row 21. SMALL repair of desktop Studio Chat setup guidance. The browser keeps an optional server diagnostic. When it has none, the setup note shows one terminal command for starting the local Chat server. When the running server reports an unavailable Claude Code CLI, the note displays that diagnostic and its existing recovery instructions. The same start command remains available in the failed-turn fallback.

| Check | Result | Evidence |
| --- | --- | --- |
| Original setup guidance | FAIL | With no server, the note displayed the startup command twice. With the server running and the CLI unavailable, it still displayed the generic server startup command next to the CLI-specific instructions. |
| Server absent | PASS | Actual Vite fallback reported disabled. The note contained one formatted startup command. Message and Send controls were disabled. |
| CLI unavailable | PASS | The actual local server probed a missing executable. The note contained the sign-in instruction once and zero generic startup commands. The executable path stayed out of the status and UI. |
| Server recovery and controlled turn | PASS | Starting the server and reopening Chat on the same Studio page cleared the note and enabled input. The result, exit and step-cap diagnostics remained path-free. The next scripted turn succeeded. The working model stayed exact. |
| Focused and transcript checks | PASS | 34 Studio tests, Studio and CAD Model TypeScript, changed-source lint, browser syntax and the Studio production build passed. The D649 transcript driver preserved its local-path display rules. |
| Wider execution | NOT_RUN | Live model inference, real CLI installation and sign-in, mobile and whole CAD readiness. |

The final startup run verified 322 frozen files through cleanup and recorded zero page errors, console errors and downloads. Screenshots of both unavailable states were reviewed. The running-server proof uses a local scripted executable through the actual Chat server.

Use Node 22.19.0. Run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. Run browser commands from `apps/cad-studio` and use external `EVIDENCE`.

- Baseline `D673_SOURCE_FROZEN=1 node test/chat-cli-diagnostics-browser.mjs "$EVIDENCE/baseline" --startup-baseline`. Receipt SHA-256 `7dce6de98b49e1cf522a3a3ac3f6f8555715f197ba54b30fdf3788a9631b0b8a`.
- Final `D673_SOURCE_FROZEN=1 node test/chat-cli-diagnostics-browser.mjs "$EVIDENCE/fixed" --startup`. Receipt SHA-256 `233a24e9dde11d4209204d1bf2dd9cc8d99429ec066f7c6d0e65585dc26003ed`.
- Transcript regression `D649_SOURCE_FROZEN=1 node test/chat-cli-diagnostics-browser.mjs "$EVIDENCE/transcript" --transcript`. Receipt SHA-256 `333e7d02f0dbc558b413839ed7d7d56b87f9b58bbd08b25edc3fd6da0363d844`.
- From the root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test chat o17-transport toolset-mcp`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `pnpm exec eslint apps/cad-studio/src/chat/client.ts apps/cad-studio/src/ui/ChatPanel.tsx`, `node --check apps/cad-studio/test/chat-cli-diagnostics-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

D674 returns to P2 B06 Drawing and starts with the first uncovered view-attached leader and current-sheet SVG check. Initial scenarios remain 4/10, B09 remains 9/9 and whole CAD readiness is **NOT_MEASURED**. [#2287](https://github.com/barocss/barocss/issues/2287) remains open for the broader contextual UI work.
