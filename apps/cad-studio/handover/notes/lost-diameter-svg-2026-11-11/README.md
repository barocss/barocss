# D676 — Preserve the drawing through Hole suppression and Undo

P2 B06, rows 11–13 and 16. [D477](../drawing-circle-snap-recovery-2026-11-03/README.md) verifies the pattern and the visible-rim pointer pick in Studio. Its retained public input was unavailable. This run used a fresh 80 × 40 × 10 mm plate with the same four nominal Ø4 holes. Auto-dimension authored the callout and pitch-circle references on the 1:1 A4 sheet. This check covers actual SVG files and the first Undo after public Hole suppression.

## Reproduction and correction

**FAIL before repair.** The active and suppressed SVGs passed, including omission of the lost callout. The first Undo restored the plate and four holes, but the prior document had acquired 12 pitch-circle member signatures. Four signatures leaked into each of two linear dimensions and one standalone pitch-circle dimension. The earlier Undo entry and the changed drawing shared those mutable objects.

The reference writer now copies pitch-circle members in both standalone pitch-circle dimensions and linear endpoints before any reference setter can change them. The reference match rules and geometry are the same. The focused setter regression changed from 35 PASS and 1 FAIL to 36 PASS in the corresponding reference group. The new test exercises name and signature updates on all three ring owners while checking the original document.

## Actual Studio result

**PASS after repair.** Chrome WebGPU at 1440 × 900 ran public Open, Auto-dimension, Suppress and first Undo. The first Undo restored the complete pre-suppression document. The three real **Export SVG** files passed the independent XML check:

| State | Top-view bores | Diameter callout | Printed source |
| --- | --- | --- | --- |
| Active | Four, each formed by two Ø4 semicircles | `4× Ø4 THRU` | `b3e61d423035d54d` |
| Suppressed | Zero | Omitted. The stored reference remains and Studio reports `DIMENSION_LOST`. | `ec44e6ea587a788f` |
| First Undo | Four, at the original centres | `4× Ø4 THRU` | `b3e61d423035d54d` |

The reader checked the 80 × 40 mm outline, 8 mm radial pattern offsets, 2 mm arc radii and unaffected front-view dimensions. Active and restored files were byte-identical, SHA-256 `8dd70d6085f8d5fbaaefae515cf2874d4b5a118c5bbe6310964cc5db51ac2003`. The Worker agreed with the independent 32000−160π mm³ active and 32000 mm³ suppressed volumes and centroid [20, 0, 5] mm. The displayed diameter was within 1e-9 mm of nominal. Visual review covered the suppressed and restored sheets. Zero page errors, console errors and watched changes. The 325-file source capsule matched through cleanup.

## Reproduction and limits

SMALL verification covers the private copy fix. Use Node 22.19.0 and one heavy job at a time under `gate.sh acquire heavy 180 <label>` and `gate.sh release heavy`.

- From `apps/cad-studio`, set local `PW_DIR` and `CHROME`, then run `D676_SOURCE_FROZEN=1 node test/lost-diameter-svg-browser.mjs "$EVIDENCE"` with an external evidence directory. Final receipt SHA-256 `9faf11d3dad4713f4deeca6f3ba7a2ccba394c2b29d56c159e567c6af6b5618c`. Product baseline FAIL receipt SHA-256 `0e9f58f1f6476f73c5877b82d0299ab21d0e2d71b8770c43bdfef0c5463ba480`. Seed SHA-256 `c3d9af04c9682e9e7d376ef2fcbb2b51174bfe09c37ed0100a1f318b3b647562`.
- Three earlier driver failures were a wrong field path, strict equality on 4.000000000000001 mm, and a mistaken assumption that each visible ring used one SVG path. The corrected reader requires paired semicircles. The complete-document Undo assertion was kept.
- `TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test references.test auto-dimension.test drawing-issues.test` passed 58/58. `TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test drawing-commit-roundtrip drawing-revision-print` passed 17/17.
- `pnpm --dir apps/cad-studio exec tsc --noEmit`, `pnpm --dir packages/barocss-cad-model run type-check`, `pnpm exec eslint packages/barocss-cad-model/src/engine/references.ts packages/barocss-cad-model/test/references.test.ts`, `node --check apps/cad-studio/test/lost-diameter-svg-browser.mjs` and `git diff --check` passed.

**NOT_RUN.** Project reopen, PDF, full suites and whole B06 acceptance. The ASME PDF mismatch stays deferred. [#540](https://github.com/barocss/barocss/issues/540) remains open. The next unheld P2 item is D677 B07. Check that a real STEP preparation reply cannot reopen an old preview after switching documents in Studio.
