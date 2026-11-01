# Independent audit: notice click-through (roadmap 20 item 7)

Verdict: ACCEPT (no blocking defects)

## 1. What sits inside .toast-stack (App.tsx:2102-2134)
- Recovery (role=dialog): Restore, Discard are `<button>`.
- Delete with dependents (role=dialog): Delete N, Cancel are `<button>`.
- Main toast (role=alert): `<details><summary>` with `<code>`, action `<button>`, Dismiss `ToolIconButton` (renders `<button>`, tool-button.tsx:19).
Every control is covered by the selector. pointer-events is inherited, so the Icon inside a button and the `<code>` inside details get `auto` too; detail text stays selectable. No div/span onClick, role=button, label/checkbox or handler on .toast itself.
Mesh units, Mesh repair (checkbox labels), STL, STEP, Flat pattern and Cut list are siblings of .toast-stack (App.tsx:2098-2100), not inside it, so this rule does not affect them.

## Findings
- LOW, styles.css:314: title and hint text can no longer be selected or copied. Example: an error such as "Cannot delete X: <engine message>" is readable but cannot be copied unless it is also in `detail`. A double-click on the hint to pick a word reaches the canvas onDoubleClick (Viewport.tsx:1739) and selects the body behind. That changes the selection only and deletes nothing.
- LOW, styles.css:407 (row-actions gap 6px): a click that just misses Delete or Cancel now lands on the viewport and changes the selection while the question is open. This does no harm: deleteCascade deletes the indices in `cascade.all` that were stored when the question was asked (useFeatureHistory.ts:76-79), not the current selection. Clicks outside the box already worked this way.
- INFO: `details` with `auto` catches clicks across its full width when closed and across the open code box. That is acceptable for text meant to be copied.

## 2. Hover
No hover handlers (onMouseEnter), no title tooltips and no auto-dismiss timers on notices in the stack. Nothing is lost.

## 3. Keyboard and focus
Not affected by pointer-events. Tab and Enter still reach every button.

## 4. Overrides
No other CSS sets pointer-events on .toast or its descendants. Tailwind `disabled:pointer-events-none` (button.tsx:10) only applies to disabled buttons, which is correct.
