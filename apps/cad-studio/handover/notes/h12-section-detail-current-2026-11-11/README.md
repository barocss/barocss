# D704 — Requalify the H12 drawing on current producers

P2 B06-01, row 11. Tested head `3681993a3b548c0a919d16b62c2968aa16795c27`. SMALL verification. The root ran the Studio flow. Sol High independently reviewed the numerical checks and the original file and Worker evidence. [B06 v1 checklist](../../roadmap-tracks/14-b06-evidence-ledger.md)

## Exact source and current native check

**PASS.** Use the original recovered D455 H12 source from D550. Its 1,767-byte native file has SHA-256 `ddd7b9b7a5303f5ac9f092ae557e88a1a7cff2cd7280b31fc16bfeb0e77d8fb1`. It contains a 60 × 40 × 12 mm plate, a Ø10 through bore centered at (15,20), the R3 corner fillet and the original A3/mm drawing.

Seventeen of the 495 producer pins differ from D550, including Auto layout and the section provider. Run the original control and independent Python oracle on the current sources. One source evaluation and one explicit split give fresh strict native evidence. The source digest is `bafe7e865f28d750`. The original native B-rep hash is `859ced0c726deb63d1f5b7669a517801e6f32d2778403cdb5e3b89f6f3fb075e`. The new capture matches D550's physical packet byte-for-byte, SHA-256 `2d3a58b2042d4f7e6b938fa8bc314bb5b4f2989f1b555bd0f6498c5d720961f8`. Section A at Y = 23 mm gives two exact material rectangles with X ranges [0,11] and [19,60], a bore gap of 8 mm, and material area 624 mm². The Detail B bore radius is 5 mm in model coordinates. The original 1e-9 mm native limit applies.

The current pure Auto candidate matches D550's accepted B at SHA-256 `82d8330b802a7c3a6f0c2699513eec5fed759029589e37278c100b06a5d5ccd8`. Top dimensions resolve to 15, 20, 40 and Ø10 mm. Front dimensions resolve to 60 and 12 mm. The three original completeness warnings clear. The two tolerance estimates remain suggestions.

## Actual Studio and exported SVG

**PASS 6/6.** Chrome WebGPU at 1440 × 1000 opens the exact original file. Auto retains Section A and Detail B, removes the redundant Right view and places the six dimensions. First Undo restores exact A and its three warnings. First Redo restores exact B. Save emits 4,783 native bytes with SHA-256 `f68c4c9748390f461962068c719a879d26d9b334e0a82a4d68221d8a5b431349`. A fresh context opens those bytes and retains B. Export leaves the document and evaluated body intact.

Two fresh real Drawing Worker request/reply pairs and five exact pair reuses verify the seven observations including setup. The real Section A reply gives 16 projected edges and the two closed material rings from body index 0. It matches the current explicit native cut. Raw V8 artifacts retain original bytes. Only comparison copies normalize signed zero. Internal Worker native evaluation counts remain NOT_MEASURED.

**PASS.** The original 15,133-byte SVG has SHA-256 `37dea7ce11f7a23b1e18bb6ecd8fd32f6469d1cea85453288057efb93e1509fb`. The independent reader verifies A3 (420 × 297 mm), 2:1, mm, the source revision and all six source-backed dimension groups. The two selected inner cap lines are 16 paper mm apart and 24 paper mm long. Detail B has two radius-10 mm paper semicircles and one separate radius-12 mm crop outline. The maximum checked primary dimension coordinate error is 3.743153550317402e-5 paper mm. The selected cap endpoint maximum is 3.7431535488963164e-5 paper mm. Both are within 5.0001e-5 paper mm. The cap area comes from the native rings.

## Reproduction and status

- **PASS.** Use Node 22.19.0 and the existing Chrome and Playwright under `gate.sh`. From the repository root run `BAROCSS_D455_CAPSULE="$D550_EVIDENCE/original-D455-recovered" node "$D550_EVIDENCE/run-controlled.mjs" 02` with fresh suffix outputs. The wrapper receipt SHA-256 is `4d0f192f5cf00910fae44341a5bff5d184f750fb48be931a1f0ff9fd74df2513`. Run `BAROCSS_D455_CAPSULE="$D550_EVIDENCE/original-D455-recovered" D550_SOURCE_FROZEN=1 node apps/cad-studio/test/section-detail-auto-dimensions-browser.mjs "$EVIDENCE/studio01" "$D550_EVIDENCE/freeze02/runtime-config.json"`. Studio receipt SHA-256 `76fecd18ccf35ffc00bb80f066e8dc3bfbf6767df412d065d77a9fd4df6fa670`. The root reviewed setup, Undo and final SVG screenshots. All 827 frozen pins match through cleanup. There are zero page errors, console errors and watched changes. Only the two expected local file outputs were captured.
- **PASS.** `TEST_CONCURRENCY=2 pnpm --filter @barocss/cad-model test auto-dimension.test auto-layout drawing-section-translation sections.test drawing-detail drawing-current-contract` gives 69/69. `pnpm --filter @barocss/cad-studio-app test drawing-commit-roundtrip` gives 4/4. Both type checks, runner syntax and Git whitespace pass.
- **FAIL.** None in D704. The existing ASME golden failure remains deferred.
- **NOT_RUN.** Actual PDF and DXF for this H12 profile, general hatch and visibility accuracy, full suites and paid live runs.

B06 v1 reaches 6/7 qualified groups. B06-07 PDF remains held. Initial scenarios stay 5/10 accepted. Whole CAD and core readiness remain NOT_MEASURED. [#540](https://github.com/barocss/barocss/issues/540) remains open.

Next D705 moves to P3 B05 and the public agent consumer. Verify that an occurrence ID discovered through `assembly.get` identifies the same instance when passed directly to the existing requirements planner. [#2427](https://github.com/barocss/barocss/issues/2427)
