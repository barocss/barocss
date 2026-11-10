---
work_id: D552
artifact_type: body-clipboard-owner-reproduction
status: qualified-for-same-tab-open
last_updated: 2026-11-10
---

# D552 — Body clipboard ownership across document replacement

P0, rows 12 and 16. [#2310](https://github.com/barocss/barocss/issues/2310) is an open current-source candidate. The accepted D551 parent is `0313fdc346e61800f0e98365818233da1d5fa551`. The existing Copy/Paste handler stores a local body key and a paste count. On Paste it resolves the key against the current evaluated bodies. The current `replaceDoc` path clears selection but keeps that clipboard entry.

## First actual reproduction

Use the two retained native files from [D326](../project-open-ownership-2026-10-29/README.md). Their original paths are under `consumers/final-first/project-to-B` in that record.

| Document | File | SHA-256 | Body | Independent box target |
| --- | --- | --- | --- | --- |
| A | normal-B-control-nativeA.bcad | `7dddcf338c7594c8122c6d41c2fe6457cf937104f8b6b8a0217f5f1d26eb1604` | b1 | 10 × 10 × 10 mm, 1000 mm³, centroid [5,5,5] |
| B | normal-B-control-nativeB.bcad | `e619317078bab4c90637ee14ed7abbee602a9033c95cd156b700026f71698772` | b1 | 12 × 13 × 14 mm, 2184 mm³, centroid [6,6.5,7] |

Open A and select its sole body through the browser. Press Copy. Open B in the same Studio page and wait for the exact accepted B document and fresh body. Press Paste once without copying B. Capture Doc, body keys, volumes, centroids, selection, dirty and first Undo. The predicted incorrect product behavior is a second B body with a centroid at [28,6.5,7], followed by Undo to B. A passing observation of that sequence confirms a product FAIL.

If the defect reproduces, preserve the first receipt. A correction must refuse the stale clipboard without a Doc, body, selection or history mutation. First Undo must return A, and first Redo must return B. A fresh Copy in B followed by two successful Paste actions must retain the original and add the two copies at X offsets 22 and 44. The ordinary repeated Paste and stale transition proofs use the same independent box arithmetic and the existing native comparison budget.

Before editing product code, inspect how successful whole-document replacement and history select the current owner. A cancelled or refused Open keeps the current accepted Doc. Record the exact selected owner boundary and which other replacement contexts require separate proof. Use existing ownership and history code if it preserves same-document edits.

## Actual result

The first reproduction confirmed the product FAIL. A and B opened as their exact accepted documents. After Copy in A and Open B, Paste appended B's own 2,184 mm³ body at centroid [28,6.5,7]. First Undo returned B. The independent box calculation and characterization passed. The original failure receipt is preserved.

The fix clears the body clipboard after the whole-document commit succeeds in `replaceDoc`. A refused replacement leaves the clipboard alone. The first fixed Studio run retained exact B, its sole body, selection and clean state after the stale Paste. First Undo returned exact A and first Redo returned exact B. A fresh B Copy then added bodies at X offsets 22 and 44. Their centroids were [28,6.5,7] and [50,6.5,7]. All three B bodies retained the expected 2,184 mm³ volume. Independent arithmetic checks used the same 1e-9 absolute comparison.

Root used Node 22.19.0 and `gate.sh`. Reproduction took 10.52 s with 5 snapshots and 4 independent joins. The fix took 11.56 s with 9 snapshots and 7 joins. Both runs checked 297 pins through cleanup, with only App.tsx differing across runs. Both closed the owned context, Chrome and Vite, with no page errors, console errors or source changes. Root viewed the original stale result, the corrected stale result and the successful second Paste. The Copy notice can still remain visible after Open. The product change concerns clipboard ownership.

- **PASS** — browser characterization, fixed same-tab Open path, first Undo/Redo, fresh same-document repeat Paste, syntax, Studio and final Model types, and owned cleanup.
- **FAIL** — original product Paste selected the wrong document's body. The first receipt records it separately from the passing characterization.
- **NOT_RUN** — the other replacement and history transitions in #2310, failed Open behavior, system clipboard, full kernel and mobile. #2310 stays open for its remaining acceptance. Whole CAD remains NOT_MEASURED.

The next owner-selected item is D553, the first internal App/SceneViewport interaction refactor. [Qualification](qualification.json).
