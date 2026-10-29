# D339 Sew preview display repair

Source frozen. Focused tests 3/3 and related Direct controls 7/7 passed. Studio types, focused App/helper/test ESLint and final Vite build passed. Exact logs and exits are in results.json. No source changes were needed after source-ready. Heavy slot released. Browser NOT_RUN by worker; root serial verification pending.

The accepted directShown tessellation memo remains unchanged. A separate viewportDirect memo filters copied source IDs from active.ctx.direct only when the nonempty previewBodies array is the shown body candidate. Raw sewSnapshot contexts retain all Direct display items. Cancel, error, absent/empty candidate and command switch return the accepted display array. Context and candidate identity drive the memo; active.values changes do not retessellate sources. The helper uses an explicit loop and retains unconsumed item and buffer identity. No document, selection, Undo, trims, geometry or tolerance changes are made.

Focused test source covers copied sources, unrelated surfaces and curves, item/buffer identity, restoration cases, raw snapshots and captured IDs versus current selection.

Prior run-01 numeric PASS remains separate from its VISUAL_REVIEW_FAIL. No commit or push.
