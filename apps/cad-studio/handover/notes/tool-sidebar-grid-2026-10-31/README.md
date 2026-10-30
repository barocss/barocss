# D378 — Row 21: the tool sidebar fits without scrolling

Tier: **small**. Only the layout changes; clicks, shortcuts and tooltips stay the same. Owner order "Go to 20/21", 2026-10-31. [Qualification](qualification.json).

## Before

The left rail held 75 buttons in one 44 px column.

| Window | Buttons below the visible height |
| --- | --- |
| 1440 × 900 | 51 (scroll height 2434 px against 788 px) |
| 1280 × 800 | 51 |
| 1920 × 1080 | 49 |
| 1024 × 700 | 55 |

[run01](before-run01/layout.json)

## Change

Each group is now a grid under its label: Create 30, Modify 27, Pattern 8, Combine 3, Inspect 7.
- The column count is the fewest that fits the window's height above the view controls ([toolColumns.ts](../../../src/app/toolColumns.ts)).
- Columns have the button's width, so every group lines up.
- The sketch-mode rail is unchanged.

## Verification

- **Tests:** toolColumns 3/3; Studio 566/566.
- **Static checks:** tsc and eslint PASS.
- **Actual [run05](after-run05/layout.json):**

| Window | Columns | Rail width |
| --- | --- | --- |
| 1440 × 900 | 4 | 136 px |
| 1280 × 800 | 5 | 158 px |
| 1920 × 1080 | 4 | 152 px |
| 1024 × 700 | 6 | 188 px |

At every size, nothing scrolls or is hidden, and the rail does not overlap the view controls. A hover shows the tooltip, and a click starts the tool. The page and console showed no errors.

**Retained failures**
- **run02:** a driver expectation was wrong; the first button, Sketch, starts sketch mode rather than a command.
- **run03/run04:** the root's image review found two problems: Combine was off the other groups' columns, and at 1024 × 700 the rail covered the view controls. Both were fixed, and the driver now checks for the overlap.

## Limits

- The rail still floats over the left 136–188 px of the viewport.
- These are not done: a ribbon, command search, and the reference CAD's Browser and History timeline.
- The History bar sub-item stays open.
- CI and release NOT_RUN.
