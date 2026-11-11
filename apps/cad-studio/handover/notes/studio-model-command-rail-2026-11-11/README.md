# D687 — Show primary and selection-specific Model tools

P4, row 21. Baseline `6ddf04427bd83fc4445e38783c1e63393b5f0b32`. The independent audit measured 89 icons in the 200 px Model rail at 1440 × 900. The owner selected named Sketch and Extrude as the default. An eligible planar face adds Hole. Eligible edges add Fillet. Six existing command groups retain their tools, and the palette keeps its command and alias routing.

The Model rail is 116 px wide. Groups start closed and expand one at a time. The original command objects still own availability, hints, shortcuts, placement and Apply. The context checks use the accepted selection and hide the named action on stale or mixed selections and on an unsupported cylindrical-wrap body. The named Sketch button shares the top Sketch action. It uses the existing confirmation for an active draft. Escape restores HUD focus. After discard, the top Sketch mode button receives focus because the Model rail leaves the screen.

## Actual desktop Studio

**PASS.** In Chrome WebGPU at 1024 × 800 with Chat closed and 1280 × 800 with Chat open, use named Sketch to draw a 40 × 24 mm rectangle. Finish selects the profile. Named Extrude previews 12 mm, then Apply creates one body of 11,520 mm³. The selected profile and volume are checked independently of the preview.

**PASS.** Use the actual canvas with Pick all. A top face shows the face highlight, planar Inspector and Hole. One edge shows the edge highlight, edge Inspector and Fillet. A vertex shows a point marker and neither contextual action. Clicking blank canvas clears the prior selection. The run checks sampled WebGPU pixels for the face and edge highlights. Enter and Space open the rail and group actions. The grouped Fillet applies the four top-face perimeter edges. Keyboard search opens the same Edge type and its preview, and also opens the separate Face fillet type and Measure.

**PASS.** All six groups fit at the two owner-specified sizes. The separate sidebar check measures all 89 grouped controls across four desktop sizes. It checks the group inventory, clipping, tooltip and a command refusal. The migrated Fillet family and click-through notice flows passed. Draft confirmation and focus also passed after the final change.

**Camera follow-up.** At 1440 × 900, both reported Box vertices were reachable before Frame all on the current Sketch → Top → New part → Box sequence. Their projected X coordinates were 412.36 px and 222.90 px. After Frame all, actual click and Shift-click selected [32, 0, 16] and [0, 0, 16] mm. The prior audit's overlap was not reproduced with the current rail. No camera code changed.

## Verification

FEATURE tier. Separate GPT-6.1 Sol Medium agents authored the desktop flow, migrated legacy rail selectors and reviewed source. Review findings covered the shared Sketch guard, selection ownership and focus after leaving Model. Root ran all heavy verification. Use Node 22.19.0, local `PW_DIR` and `CHROME`, and one job at a time under `gate.sh acquire heavy 180 <label>`. From Studio use fresh external output directories.

| Command | Result and receipt SHA-256 |
| --- | --- |
| `D687_SOURCE_FROZEN=1 node test/model-command-rail-browser.mjs "$EVIDENCE"` | PASS · `7894ff310d730e874b6cbdbf6323b99c1ca912395d6b65f8d3339f7b6edee63f` |
| `TOOL_SIDEBAR_SOURCE_FROZEN=1 TOOL_SIDEBAR_EXPECT=grid node test/tool-sidebar-browser.mjs "$EVIDENCE"` | PASS · `174d50262f426ca9f76268188e7ab435b60c4191c53c8e47e0712e5b7484f71c` |
| `NOTICE_SOURCE_FROZEN=1 NOTICE_EXPECT=through node test/notice-click-through-browser.mjs "$EVIDENCE"` | PASS · `872edda1f27d61df5c65167cefdc08dc49c15d09e8f652e67189c3bf44226f12` |
| `FILLET_FAMILY_SOURCE_FROZEN=1 node test/fillet-family-browser.mjs "$EVIDENCE"` | PASS · `85bac1e39c1b9afb0bf27be4e65bfddc99c2787a1f8a41a2e35098343cab2d44` |
| `D686_SOURCE_FROZEN=1 node test/feature-mode-exit-browser.mjs "$EVIDENCE" --fixed` | PASS · `e12cfe6315cba30c254d8d16ab657fbe7f379e9869aceede2cf2e02df4c114e3` |

The main run matched 322 frozen paths through cleanup. All five receipts have zero downloads, page errors, console errors and watched changes. Reviewed the default rail and face and edge selection screenshots. The first gate attempt ended before Studio launched.

`TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test model-rail fillet-family palette document-file` passed 29/29. Studio and Model type checks, scoped ESLint, syntax checks for all changed browser scripts, Git whitespace checks and Vite build passed. Vite reported existing module-chunk warnings and bundler timings. The obsolete column-count tests are replaced by measured group inventory and clipping checks.

**NOT_RUN.** Full Studio suite, other browsers and the remaining migrated browser flows. Mixed-pick eligibility has focused tests. Native wrap exclusion has source review. [#2287](https://github.com/barocss/barocss/issues/2287) remains open. Return to the queued B07 3MF variant case next.
