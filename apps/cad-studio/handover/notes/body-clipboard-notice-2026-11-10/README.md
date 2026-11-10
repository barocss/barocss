---
work_id: D571
artifact_type: body-clipboard-notice-qualification
status: fixed-and-qualified-for-selected-desktop-boundaries
last_updated: 2026-11-10
---

# D571 — Clear the copy notice with its body clipboard

P0, rows 12 and 16. This completes the bounded body clipboard verification for [#2310](https://github.com/barocss/barocss/issues/2310). Use the SMALL tier for this private Studio repair. The clipboard guards already reject Paste after invalidation.

## Actual Studio

On the original App, Studio still shows the Copy notice and its Paste instruction after each of five clipboard invalidations. The cases cover successful Open, direct New, Undo and Redo across an Open, and reuse of a source feature ID on a new history branch. The initial product result is **FAIL**. Paste stays inert in the tested Open and history-branch cases.

The fix clears the Copy notice with the clipboard at the existing invalidation points. The same desktop driver now passes all five transitions. Ordinary Undo and Redo on the same branch keep the valid Copy notice. New keeps the unrelated error from a malformed Open. A fresh Copy and Paste after the branch change creates and selects a copy 18 mm away on X. Independent box arithmetic verifies the geometry and offsets. Root reviewed the actual before and after Open captures.

Both runs record 19 snapshots, three independent box joins and 299 frozen source files. Each run closes its browser context, Chrome and local server. No unexpected console errors, downloads or source changes occur within either run. Commands, exact source pins and receipt hashes are in [qualification](qualification.json).

- **PASS** — fixed desktop Studio flow, both type checks, 59 targeted ownership and edit-in-place tests, and driver syntax.
- **FAIL** — original Studio leaves the Copy notice visible in all five cases.
- **NOT_RUN** — standalone Stop at a replacement boundary, other browsers, full kernel and mobile.

## Issue acceptance and next item

[D552](../body-clipboard-owner-2026-11-10/README.md) covers same-tab Open, a matching local body key in a different document, exact state after stale Paste, and two fresh pastes. The replacement routes have actual coverage in [D560 New](../body-clipboard-new-part-2026-11-10/README.md), [D561 template](../body-clipboard-template-2026-11-10/README.md), [D562 project and version](../body-clipboard-project-2026-11-10/README.md), [D563 recovery](../body-clipboard-recovery-2026-11-10/README.md), [D564 edit in place](../body-clipboard-in-place-2026-11-10/README.md) and [D567 project autosave](../body-clipboard-project-autosave-2026-11-10/README.md).

[D556](../body-clipboard-history-2026-11-10/README.md) and [D566](../body-clipboard-history-branch-2026-11-10/README.md) cover replacement history and reused branch IDs. [D558](../body-clipboard-pending-2026-11-10/README.md), [D559](../body-clipboard-failed-open-2026-11-10/README.md), [D565](../body-clipboard-deleted-source-2026-11-10/README.md), [D569](../body-clipboard-text-focus-2026-11-10/README.md) and [D570](../body-clipboard-cancel-open-2026-11-10/README.md) cover pending evaluation, failed Open, source removal, text shortcuts and browser-native cancel. [D568](../body-clipboard-save-reopen-2026-11-10/README.md) verifies both pasted bodies and references through native Save and fresh Open. OS clipboard transfer and permission handling are outside the issue's contract.

Next is D572, P0 rows 16 and 28. Reproduce [#2361](https://github.com/barocss/barocss/issues/2361) in Studio with local libraries that share IDs but have different geometry. Compare the displayed source with the inserted body and placed instance. Whole CAD remains NOT_MEASURED.
