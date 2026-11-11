# D686 — Preserve feature drafts on workspace changes

P0 R18, rows 12, 16 and 21. Baseline `eca21e504570d8dcdc170f160eed70974f392f49`. The separate desktop audit reported a Box draft loss when switching to Drawing.

**FAIL before repair.** In Chrome WebGPU at 1440 × 900, start Box and set Width X to 48 mm. Click Drawing, return to Model and reopen Box. The command closed without confirmation and its width reset to 32 mm. The native document and history remained exact. Baseline receipt SHA-256 `4536a9e20e77c7ac50293980e5158c83af37934b064f2f57b9272da4d233902b`. The first driver attempt timed out because it looked for the shorter Width label.

## Repair

The existing workspace confirmation now protects feature drafts as well as sketches. Keep editing and Escape return focus to the prior control. Model keeps a feature that can stay open there. Drawing and Render require an explicit discard before clearing a feature. A top Sketch request clears the feature after the new Sketch passes its document and plane checks. The reference-dimension route into Drawing uses the same guard.

The confirmation checks the document, sketch generation and live feature context before acting. It names both drafts when both would be discarded. An explicit discard retires preview work and clears the pending Apply or repeat. A separate GPT-6.1 Sol Medium source review identified the simultaneous-draft case and the order of Sketch admission. The follow-up review found no remaining blocker in the selected routes.

## Actual desktop Studio

- **PASS.** Drawing, Sketch and Render requests preserved a Box draft when canceled. Escape and Keep editing restored input focus. Width 48 mm and height 18 mm remained. The confirmation stayed open after the preview settled.
- **PASS.** Apply created one 48 × 32 × 18 mm body. Its volume was 27,648 mm³ and its centroid was [24, 16, 9] mm. One history step was added. Undo and Redo restored both exact documents.
- **PASS.** Keyboard confirmation discarded a second Box draft with width 60 mm and entered Drawing. The previously applied body and history remained exact.
- **PASS.** A rectangle draft and a Box draft opened through the palette coexisted. The confirmation named both. Keep editing preserved the 20 mm rectangle width and 55 mm feature width. Explicit discard closed both and retained the applied body.
- **PASS.** The D663 sketch regression retained dimensions, constraints and focus through workspace requests. Its 18 mm extrusion, explicit discard and empty-sketch exit also passed.

Final D686 receipt SHA-256 `8890cf4af4e18fc47abf798c75e828ce21405bf4e71d01537eab1dc247a17dd0`. Reviewed the 32 mm baseline and both confirmation screenshots. The final D686 run matched all 321 frozen paths through cleanup. Browser downloads, page errors, console errors and watched changes were zero.

## Verification

FEATURE tier for the additional confirmation route. Use Node 22.19.0 and one heavy job at a time under `gate.sh acquire heavy 180 <label>`. From Studio with local `PW_DIR` and `CHROME`, run `D686_SOURCE_FROZEN=1 node test/feature-mode-exit-browser.mjs "$EVIDENCE" --fixed`. Use `--baseline` on the original source. Run `D663_SOURCE_FROZEN=1 node test/sketch-mode-exit-browser.mjs "$SKETCH_EVIDENCE" --fixed` for the previous Sketch flow.

- Final Sketch regression receipt SHA-256 `08d99d095c77c02bf6fc09d585fe8a98684d12e67ebf2078a675533760076c67`. The native check measured 4,320 mm³ for the extruded sketch.
- `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test sketch preview-lifetime document-file stop-work-ownership` passed 77/77. Studio and Model type checks, scoped ESLint, both driver syntax checks and Git whitespace checks passed.
- From Studio, `pnpm exec vite build --outDir "$BUILD_EVIDENCE"` passed. Vite reported modules with both static and dynamic imports.

**NOT_RUN.** Actual curved-face Sketch refusal, a forced late preview reply after discard, and whole Studio acceptance. [#2287](https://github.com/barocss/barocss/issues/2287) remains open. D687 covers the owner-selected Model rail and the current desktop selection flows.
