---
work_id: D659
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D659 — Attach the current nested face diagnosis to Studio chat

P0 automation evidence, rows 04, 12 and 16. FULL qualification for the selected-turn MCP surface.

The nested inspector can attach one missing named face to the next manual Studio chat turn. The attachment binds the authored working document, full occurrence path, requirement digest and face name. The local MCP tool rechecks those inputs on the turn's current document. It reports the unresolved face and the unsupported repair. Changing the selected occurrence or working document retires the attachment and any chat session that used it.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | The inspector named the missing face, but there was no attachment action. The baseline driver passed because it expected the missing action. |
| Initial updated driver | FAIL | Two deliberate HTTP 422 requests were sent through page JavaScript and triggered the driver's browser console check. The negative transport cases now use the browser context's HTTP client. |
| Actual desktop and local MCP | PASS | The attached `p1/p1 · WIDTH · n1.side3` returned one unresolved face with the exact authored requirement and unsupported repair. A tool argument could not change the target. The next unselected turn had no selected tool. An old revision and a wrong face returned 422, an untrusted origin returned 403, and rechecking the passing sibling returned no diagnosis. Selecting the sibling and restoring the earlier version each retired the pending attachment. |
| Historical and geometric controls | PASS | The D658 browser flow still retained the original approval and verified that only the left face was gone. The independent 192 and 384 mm³ volumes matched the native geometry. The original snapshots and evidence bytes remained exact. |
| Focused checks and build | PASS | Studio 59 and Model 45 passed. Four isolated mutations were detected. Both TypeScript checks, changed TypeScript lint, browser driver syntax and Studio build passed. |
| Existing saved-approval attachment | PASS | D654 still returned the retained report and retired it when the document changed. |
| Paid live model, mobile and whole CAD suites | NOT_RUN | The desktop flow used a scripted CLI with the actual Studio, chat server and stdio MCP. |

Use Node 22.19.0. Run one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`. `EVIDENCE` is external to the worktree. Run browser commands from `apps/cad-studio`.

- Baseline `D659_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/baseline" --diagnosis-baseline`. Receipt SHA-256 `89cb83d77ee70168e4a2bed22811f6c36ae0351d6562b2ef9a13557db9ca9098`.
- Desktop `D659_SOURCE_FROZEN=1 node test/nested-lost-face-evidence-browser.mjs "$EVIDENCE/final" --diagnosis-chat`. Receipt SHA-256 `e0e523680da8814c86b5618a876e52dbf8d90dcc6260c826ca0a3ce1343b2cc0`. The flow checked 975 source files through cleanup and recorded zero page errors, console errors, downloads or source changes.
- Independent check `python3 -I "$EVIDENCE/final/nested-lost-face-evidence-oracle.py" < "$EVIDENCE/final/independent-lost-face-oracle-input.json"`. Result SHA-256 `3e92b7f2e9f68e9c7e8ed155d12df7543a15885a86ef76ed3dc96e0893ae93cc`.
- Desktop regression `D654_SOURCE_FROZEN=1 node test/nested-approved-comparison-browser.mjs "$EVIDENCE/regression-d654" "$PRIOR" --attach-follow-up`. `PRIOR` contains the D607 desktop fixtures. Receipt SHA-256 `29fd29f4e44bbd83150abb9ebd70dad5d0cd4d71978ef55501c7b958128f9d3a`.
- From the repository root run `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test face-diagnosis chat toolset-mcp tool-contract-mcp approved-requirement-compare nested-selection` and `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test requirement-evidence team-freshness spec tool-contract`.
- Run `node "$EVIDENCE/mutations.mjs" "$PWD" "$EVIDENCE"` on isolated bundles. Result SHA-256 `631f11202326cceb6063baa469e7d2b1e19aba565f02a0a307033c9ef150c8b9`.
- Run `pnpm --dir packages/barocss-cad-model exec tsc --noEmit`, `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm exec eslint` on changed TypeScript, `node --check apps/cad-studio/test/nested-lost-face-evidence-browser.mjs`, `pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/vite-build"` and `git diff --check`.

Initial scenario acceptance stays at 4/10 and B09 at 9/9. Whole CAD readiness remains **NOT_MEASURED**. D660 tests explicit repair for a uniquely renamed face. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
