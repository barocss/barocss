# D685 — Fit the top toolbar to the rendered controls

P4, row 21. Baseline `9b8ab79e28bc764c97364ff8376efd6954ae7db1`. The independent desktop audit reported clipped tools at 1024 × 800 with Chat closed and 1280 × 800 with Chat open. Root reproduced the clipping with the current starter part in Chrome WebGPU.

**FAIL before repair.** The fitter budgeted 30 px for controls that measured 34 px. On this checkout, the More tools button extended 3.672 px past the top bar at 1024 × 800 and 19.672 px at 1280 × 800. At 1280 × 800 the button center failed the pointer hit test. The earlier audit had a different fit count at the narrow size and observed Insert part outside the window. Baseline receipt SHA-256 `d416251dcd09123321f32011c38292b7a59158087c5d669f4bb0667b7341211c`.

The tray measures a rendered tool and the top bar's actual available width. It accounts for padding, borders, sibling controls and gaps. It reserves a slot for More tools when some tools need to move into the menu. The existing ResizeObserver also observes the tray.

## Actual desktop Studio

| Desktop case | Tools inline | Tools in More tools | Right edge of More tools | Result |
| --- | ---: | ---: | ---: | --- |
| 1024 × 800, Chat closed | 11 | 3 | 1014 px | PASS |
| 1280 × 800, Chat open | 10 | 4 | 1270 px | PASS |
| 1440 × 900, Chat closed after resize | 14 | 0 | No trigger needed | PASS |

All 14 tools remained in order across the inline tray and menu. The driver checked each control's bounds and center hit at both narrow sizes. Tab reached each enabled inline control. Space opened More tools and ArrowDown reached each enabled menu item. Escape returned focus to More tools. Enter and a pointer click each opened the actual Insert part file chooser. Cancel left the exact document intact. Neither narrow view scrolled horizontally.

The D666 desktop regression also passed. It covers STEP options, Insert part, disabled-item skip, keyboard focus and the nested Templates menu with a resized Chat column.

## Verification

SMALL private layout repair. Use Node 22.19.0 and one heavy job at a time under `gate.sh acquire heavy 180 <label>`. From Studio with local `PW_DIR` and `CHROME`, run `D685_SOURCE_FROZEN=1 node test/top-toolbar-overflow-browser.mjs "$EVIDENCE" --fixed`. Use `--baseline` against the original source. Run `D666_SOURCE_FROZEN=1 node test/more-tools-keyboard-browser.mjs "$KEYBOARD_EVIDENCE" --fixed` for the existing menu flow.

Final D685 receipt SHA-256 `8f11d4ff37bdd722b61bd270a10ad6b452b2694034559ed4ce08d72fc5414e0a`. D666 regression receipt SHA-256 `dc977e25cfea8046691d2ed9b6339c0f007e82c9151dcd53fa1a18cf55b1536b`. Reviewed the clipped baseline and both fixed menu screenshots. The D685 run matched 321 frozen paths through cleanup. Browser downloads, page errors, console errors and worktree changes were zero.

`TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test palette document-file tool-columns project-open-fit` passed 24/24. Studio and Model type checks, scoped ESLint, driver syntax and Git whitespace checks passed.

The first baseline driver assumed the same clipped control as the independent audit. The final baseline accepts either measured clipped control. The first two fixed attempts sampled menu focus before arrow navigation or close focus had settled. The final driver waits for the actual focus target.

**NOT_RUN.** Other desktop browsers, the whole Studio suite and the broader [#2287](https://github.com/barocss/barocss/issues/2287) scope. The issue stays open. The next owner-selected item is R18 feature draft retention.
