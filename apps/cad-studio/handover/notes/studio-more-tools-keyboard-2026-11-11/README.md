---
work_id: D666
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D666 — Enable keyboard navigation in More tools

P4 desktop usability, row 21. FEATURE qualification for the top-bar overflow menu.

More tools registers the existing icon buttons as menu items. The menu uses Radix focus order and skips disabled controls. Enter opens and activates a tool. Arrow keys move through the available tools, and Escape returns focus to the trigger. The Templates trigger participates in the overflow menu and keeps its own controls accessible.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop navigation | FAIL | At 1280 × 720 and 1024 × 768 with chat open, Enter opened More tools. Focus stayed on the menu container after ArrowDown and Tab. Escape returned focus to the trigger in this reproduction. |
| First updated driver | FAIL | The driver checked the active element before Radix finished moving focus. The retry waits for the expected active element after each key press. |
| Desktop navigation | PASS | Enter focused the first enabled tool at each size. ArrowDown reached each available item in order, ArrowUp moved back and Escape returned focus to More tools. |
| Existing commands | PASS | Keyboard activation opened the STEP options and the Insert part file chooser at both sizes. Pointer activation still opened the STEP options. The working document stayed exact after the controls were closed. |
| Wider chat control | PASS | At 1024 × 768 with wider chat, keyboard navigation skipped the disabled tool. Enter opened Templates and focused its first choice. Tab reached the second choice. Escape closed the menu and restored focus. Reopening More tools started with Templates closed. |
| Focused tests and build | PASS | Studio 26 passed. Studio TypeScript, changed TypeScript lint, browser syntax and Studio build passed. |
| Actual STEP export, file import, mobile and whole CAD suites | NOT_RUN | The test opened and closed the command surfaces without transferring a file. |

Use Node 22.19.0 and run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. Run browser commands from `apps/cad-studio`.

- Baseline `D666_SOURCE_FROZEN=1 node test/more-tools-keyboard-browser.mjs "$EVIDENCE/baseline" --baseline`. Receipt SHA-256 `79316f25815eb7a21dcab82f7feb6a1e3abfe89d1054eb52759f98b906827d76`.
- First updated driver receipt SHA-256 `db1ac1b893d72cc7979eabffd4835f14af2d35ee7307566cb2b6da8fb6789a3d`.
- Desktop `D666_SOURCE_FROZEN=1 node test/more-tools-keyboard-browser.mjs "$EVIDENCE/retry" --fixed`. Receipt SHA-256 `98d53ec8e1659639a55722d430a4980a56f7062805dc1aca7450aaddc6e802a4`. The run checked 319 source files through cleanup and recorded zero page errors, console errors and downloads.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test template step-export ui-icon`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint apps/cad-studio/src/ui/ToolsTray.tsx apps/cad-studio/src/ui/TemplatePicker.tsx`, `node --check apps/cad-studio/test/more-tools-keyboard-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/retry-vite-build"` and `git diff --check`.

Initial scenarios stay at 4/10, B09 at 9/9 and whole CAD readiness at **NOT_MEASURED**. D667 checks the Browser row's Space key and focus behavior. [#2287](https://github.com/barocss/barocss/issues/2287) remains open for the broader contextual UI review.
