---
work_id: D577
artifact_type: render-image-ownership-qualification
status: fixed-and-qualified-for-selected-desktop-import-ordering
last_updated: 2026-11-10
---

# D577 — Apply only the current Render image import

P0, rows 06 and 16. Use the SMALL tier for the private Studio repair in [#2419](https://github.com/barocss/barocss/issues/2419).

## Actual Studio

Open the synthetic box and select local PNG A then B through the real Texture and Environment inputs in separate browser contexts. The test holds the original browser decode outcomes. Release A before B. In two more contexts, leave Render for Model before releasing a Texture success and an Environment failure.

Before the fix, both two-selection paths apply A and report refusal for B. After leaving Render, the late successful Texture still changes the document and the late Environment decode failure raises a notice. The fixed flow applies B once in each two-selection path, suppresses both late effects after Render exits, and keeps the exact document, selection, dirty state and visible history across discarded results.

Fixed Texture also suppresses an earlier genuine decode failure and reports the latest failure while preserving the accepted B image. First Undo and Redo restore the exact original and B documents for both successful imports. The fixture decoder and the authored images match at the RGBA level for the selected 64 × 64 PNGs, including B's transparent pixels. The texture thumbnail matches the accepted image. Root reviewed both actual viewport captures. Each successfully decoded input bitmap closes, including the obsolete A and the successful Texture after Render exits.

Each input has a separate latest request token. A change of the original document/work callback or Render unmount revokes both tokens. A change to the ordered appearance target or its availability revokes only the Texture token. Changing tabs inside Render keeps the panel owner. Original callbacks continue to apply the existing App admission checks. PNG/JPEG conversion, 1024/2048 limits, repeat and intensity use the existing policy. Bitmap cleanup now runs even if canvas work throws. [Commands and receipts](qualification.json).

- **PASS** — fixed desktop latest selection for Texture and Environment, two Render exit outcomes, stale and latest decode errors, pixel and thumbnail match, transparency, bitmap cleanup, first Undo/Redo, focused regressions, both type checks and Studio build.
- **FAIL** — original desktop applies A in both ordering tests, applies a late Texture after exit and reports a late Environment error after exit.
- **NOT_RUN** — reverse completion and three-file desktop cases, active body target change, Undo/New/Open during decode, JPEG and over-limit images, fresh native Save/Open, full kernel and mobile.

[#2419](https://github.com/barocss/barocss/issues/2419) remains open for remaining acceptance. Next is D578, P0/B09 rows 04 and 16. Verify whether display rounding changes numeric requirement verdicts for [#2411](https://github.com/barocss/barocss/issues/2411). Whole CAD remains NOT_MEASURED.
