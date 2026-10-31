# Independent audit: roadmap row 20 ④+⑥ handle value box (uncommitted)

**Verdict: ACCEPT.** I found no correctness defect that blocks the change. There is one low-severity finding, which can be fixed later.

## What I ran
From apps/cad-studio, under the gate:
`gate.sh acquire heavy audit-20b && node scripts/test.mjs handle-value-box command-drag-wall; gate.sh release heavy audit-20b`
Result: 27/27 pass. I did not run the browser driver. I wrote no probes; everything else below comes from reading the code.

## Checks
1. **Enter ordering: OK.** `setActive` is `activeStore.set` (App.tsx:289, valueStore.ts), which sets the value synchronously. The input's React onKeyDown fires at the React root, before the `window` listener (App.tsx:1547). So `onType` has already set the typed values and `preview:'busy'` when `apply()` reads `activeStore.get()`. Apply sees 'busy' and sets `applyWhenReady`. A late preview result for the OLD values cannot set 'ok': useCommandPreview.ts:120 compares JSON(a.values) with the values it ran. A late bisect step cannot overwrite the typed value either: the step reads `handleDrag.current` after its await and finds null, and the `mid` patch only applies while `a.values === values`. If the typed value is unchanged, empty or invalid, `commit` does not call onType, so Enter applies the current values. That is acceptable.
2. **Draft lifecycle: OK.** `{valueEditor}` keeps a fixed slot in the overlay fragment (Viewport.tsx:1722) and has `key=boxed.id`, so its state survives the per-frame re-renders. The box unmounts during any drag and on apply or cancel, so its draft starts fresh. A blur commit after Esc/cancel finds a null store, so `setActive(a => a ? … : a)` does nothing; the only effect is `handleDrag.current = null`, which is harmless.
3. **valueBox lifecycle:** this is mostly right, with the one exception in finding F1. The box stays hidden during drags and is cleared once no `editing` handle has that id. After Apply, the idle edit offers handles with `editing:false`, so the next frame clears the box. A frame is always requested (the overlayKey includes `editing`, and pointerup calls `request()`). Puck (plane) handles are excluded.
4. **Keyboard: OK.** Letters, Space, arrows and Delete/Backspace return at the `typing` check (App.tsx:1582). Handles are absent while sketching, so the sketch-tool exception does not apply. Before that check, ⌘Z still runs the document undo, but the HUD inputs already behave that way, so this change adds nothing new.
5. **D368/D377: OK.** `onType` clears `handleDrag` the same way the HUD's onChange does (App.tsx:1975). The next drag starts a fresh bound.

## Findings
- **F1 (low): the box can appear for a different command that was never dragged.** In Viewport.tsx:1710 the box is cleared only when no `editing` handle carries the id. `start()` (App.tsx:1159) can replace a running command with no `null` in between. Scenario: drag the `height` arrow of an idle extrude edit and release, and the box shows. Then pick another command from the rail whose handle is also `height`. The box shows at once on the new command without any drag, which goes against "after a handle is let go". It does no harm to data, because it edits the new command's value through the same store. Fix: key the box by command and handle, for example remember `active.cmd`/`ctx` with the id (pass `sessionKey` on FeatureHandle), or clear it when `active.cmd` changes.
- **Info (not a defect):** `onType` does not set `lastTyped`, so the preview runs without the 140 ms debounce. That fits a single commit on Enter or blur. A blur commit from clicking the canvas to drag again records the typed value, and the new drag then replaces it from its own start value. This matches the HUD.
