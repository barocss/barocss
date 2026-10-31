# Independent audit: History bar stays dimmed + inert during sketch/command (roadmap 21)

Verdict: CHANGES_REQUIRED

## F1 (medium) inert makes the bar click-through to the viewport
FeatureHistoryBar.tsx:23 puts `inert` on `.history` itself. HTML spec: an inert node is hit-tested as if `pointer-events: none`
(Chromium: UsedPointerEvents() = none when inert). `.history` (styles.css:251, z-index 3) sits over `.viewport` (styles.css:78,
`inset: 0`), so while busy every click, wheel and hover on the dimmed bar lands on the canvas underneath:
- Box from the palette (`placing: true`, App.tsx:1159): a click on a dimmed step places the box at a spot hidden under the bar (onSpot).
- Open sketch: the click adds a sketch point / picks an entity under the bar; wheel over the bar zooms the view.
- Fillet/hole picking: the click picks the face/edge under the bar.
Before, the bar was absent, so this strip was visible canvas; now it is covered canvas that still takes input.
The `title` (FeatureHistoryBar.tsx:24) never shows either: hover never targets an inert element.
Fix: keep the bar hit-testable while busy, e.g. a non-inert sibling shield over the bar (absolute, same box, carries the title,
swallows pointer/wheel), with `inert` only on the content; or drop `inert` for `aria-disabled` + capture handlers that
stopPropagation/preventDefault. Keep the `.hs` chips direct children (useFitChips.ts:20 uses `:scope > .hs`).

## F2 (medium, verification gap) the new driver cannot see F1
test/history-bar-browser.mjs:40-42: `click({ force: true })` on an inert step goes to the canvas; `state()` compares only
`active` command id, `sketch` boolean and `.node-editor` (App.tsx:597), so a placed Box spot or an added sketch point passes
"a click on a step changes nothing"; the later `f.same(original)` runs after Escape, which discards both. Assert instead
`document.elementFromPoint(chip centre)` is inside `.history`, and compare the full active values/placing and sketch shape.

## F3 (low) floating HUD over the view bar in narrow windows
When the dock is not docked (useLayout.ts:44) the HUD floats (`top 50, max-height 100vh-130`, bottom edge 80px above the
stage bottom, z 3). With `has-history` kept during a command, `.corner-right` sits at bottom 56px (styles.css:274), so its top
(about 88px) is now under a full-height HUD by about 8px; before, it sat at 16px with no overlap.

## Checked, no defect
- useFitChips/useBottomRow: the bar stays mounted; deps include `!!sketch`, `!!active`, `doc.nodes`, so `historyHidden` and
  `natural` re-measure after a command adds a feature. No mount-only effects in FeatureHistoryBar.
- Toolbar (bottom at 100vh-60), Finish sketch (top bar), toast stack, view cube: no overlap with the 40px row.
- Focus: inert on a subtree holding focus blurs it to body (as unmount did); global shortcuts unaffected. React 19.2
  renders `inert` boolean correctly. AT exposure matches the old absence. FeatureHistoryMenu behaviour unchanged.
- Existing drivers: none asserts `.history` absent during a sketch/command. Waits like browser-flow.mjs:212/239/263/284/1216
  on `.history` text no longer imply the command closed, but each follows an Enter that commits; low risk. Raw
  `page.mouse` clicks near the bottom during a sketch still reach the canvas (because of F1), so none breaks.
