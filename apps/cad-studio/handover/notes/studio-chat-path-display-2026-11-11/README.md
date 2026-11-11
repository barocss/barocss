---
work_id: D649-follow-up
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D649 follow-up — Shorten local paths in the Studio transcript

P0 Studio chat, rows 04 and 16. FEATURE qualification.

Studio shortens recognized absolute local paths to their final file or folder name in the transcript. This applies to user and assistant messages, expanded reasoning, notices, and tool details. HTTP links and relative references retain their original text. Chat requests, tool arguments, and saved model data keep their original values. The change applies at the display boundary.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop Studio transcript | FAIL | A scripted local turn showed complete macOS, Linux and Windows fixture paths. The baseline receipt passes because the driver expected the exposure. |
| Updated desktop Studio transcript and existing CLI recovery | PASS | The same turn showed the final names, kept the web and relative references, and preserved the original tool input and model. The four existing turn cases and unavailable-CLI case also passed. The browser reported zero downloads, page errors, console errors or source changes. |
| Focused tests and build | PASS | 28 tests passed. Studio type check, lint for changed TypeScript, browser driver syntax and the Vite build passed. |
| Paid live execution, mobile and whole CAD suites | NOT_RUN | The desktop flow used the existing local fixture CLI. |

Run with Node 22.19.0 from `apps/cad-studio`. Use `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy` for each heavy run. `EVIDENCE` is an external directory.

- Baseline: `D649_SOURCE_FROZEN=1 node test/chat-cli-diagnostics-browser.mjs "$EVIDENCE/baseline" --transcript-baseline`. Base source `4ef25c885fbc196ce1c7d3b445b78993c1c3012e`. Receipt SHA-256 `1cab5ca5d0a6d5f8f71f7209e84f32c3dddad1504d645d0d7eb5f4cc2c47e71e`.
- Updated desktop: `D649_SOURCE_FROZEN=1 node test/chat-cli-diagnostics-browser.mjs "$EVIDENCE/desktop" --transcript`. Receipt SHA-256 `b10987a371e9690493242143ff9f36035a676536b930a387fa992901162fb4fc`. The flow checked 311 source files before and after.
- Focused: `pnpm test chat`, `pnpm type-check`, `node --check test/chat-cli-diagnostics-browser.mjs`, `pnpm exec vite build --outDir "$EVIDENCE/vite-build"`. From the repository root, run `pnpm exec eslint apps/cad-studio/src/chat/localPathDisplay.ts apps/cad-studio/src/ui/ChatPanel.tsx apps/cad-studio/test/chat.test.ts` and `git diff --check`.

The initial workflow ledger stays at 4/10 and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. D655 remains the next roadmap item. [#2402](https://github.com/barocss/barocss/issues/2402) remains open.
