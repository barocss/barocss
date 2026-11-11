# D697 — Refuse Auto-layout when no candidate fits

P2 B06, row 11. [#2406](https://github.com/barocss/barocss/issues/2406). Parent `606d7dc6c8718dff321c2048ce1908676a094a07`. Drawing placement, with the existing Model refusal type and success shape.

## Decision

Auto-layout raises `VIEWS_DONT_FIT` when it cannot produce a fitting candidate. The refusal identifies the sheet sizes and searched scale ranges, including a sheet with no supported scale below its saved ceiling. The direct Model error carries the candidates and trial count. A fitting candidate with annotation issues still returns the existing result and issue report. The issue list offers a scale or sheet fix only after checking that it fits the views.

Studio reports the refusal before committing any edit. The same refusal stops an agent drawing proposal. Multi-sheet layout reports the failing sheet by number and name and returns no partially edited document. The successful agent path still requires user approval.

## Actual desktop Studio

**PASS, 2/2.** Open each source in Chrome WebGPU at 1440 × 1000 and click Auto twice. Both attempts preserve the exact Doc, existing manual and auto dimensions, authored ±0.05, note, sheet and view settings. Two prior drawing edits leave both Undo and Redo enabled. The first Redo and Undo after refusal restore the exact expected documents. Save and Open the native bytes in a fresh context. The reopened Doc matches the accepted source after the deliberate history setup.

| Source | Independent fit check and Studio result | Recovery |
| --- | --- | --- |
| A4 plate, 9,000 × 100 × 10 mm, with five front sections | The five valid cuts each give one ring and eight projected edges. Each spans 90 paper-mm at 1:100. Their 450 mm sum exceeds A3's 420 mm width before gaps or margins. Studio reports A4 and A3 at 1:100 and offers no ineffective scale fix. | Edit the source width to 40 mm. Auto succeeds on A4 at 1:2, retains the manual width tolerance and lays out the five cuts. |
| A3 plate, 40 × 100 × 10 mm, with a saved 1:200 scale | The saved scale renders, but it is below the smallest supported Auto candidate. Studio reports the empty scale search and preserves the stored scale. | Select Auto scale. Auto-dimension succeeds and retains the manual width tolerance. |

For each source, actual SVG output before and after the two refusals is byte-identical. ElementTree independently reads the sheet width, original manual and auto dimension groups, tolerance and note. The preserved A4 SVG represents the original off-sheet drawing. The test verifies its retention and the continued availability of export.

## Verification

Run one heavy job at a time under `gate.sh`, with Node 22.19.0 and existing Playwright/Chrome. From Studio, run `D697_SOURCE_FROZEN=1 node test/auto-layout-no-fit-browser.mjs "$EVIDENCE"` and again with `--saved-scale` in a separate output directory.

- **PASS.** Desktop receipts SHA-256 `e0c621e0427b1be95e8804ce3eea95d7680707e39eb70807732c750a106dc77c` (sections) and `7b393b57cf97901c86f4f025d3955d4f199b0ada9fb3c613118e27b6f232e83a` (saved scale). All 325 frozen paths match through cleanup in each run. Zero browser downloads, watched source changes, page errors or console errors.
- **FAIL, original product.** The actual saved-scale Auto click produced an unhandled TypeError reading `settings` from null. Receipt SHA-256 `71debb40cf98af438c557fe170bcfb25eccf14dd8ffd07792dd672d7a638841d`.
- **FAIL, original fixtures.** A 50,000 mm native rectangle hit the ±10,000 mm feature-length limit before drawing; receipt `22e7dcd1ed8a6a64efef04d5a4738787bc28d026d02a811da41b3514173b7665`. The initial 10,000 mm cut fixture did not establish the expected layout at setup; receipt `f40fd755664dfde1c3165039791d3571dacc5bdc2ca328dd649a2fdfb2a21853`. The final native witness uses 9,000 mm and checks the five valid cuts.
- **PASS, focused contract.** The Model regressions check A4 fallback and direct A3, with and without a hole, all-candidates-fail versus zero candidates, repeated refusal, a fitting candidate with unresolved annotation issues, and a two-sheet agent proposal with the second sheet refused. The first sheet's layout is staged only locally. The recovered proposal retains the drawing approval gate. Three out-of-tree mutations were rejected: untyped refusal, lost sheet identity and an ineffective scale fix. Studio drawing history passed 4/4. Model and Studio type checks, syntax, whitespace, refusal catalog and scoped lint passed. Lint retains one pre-existing `any` warning in the agent test.
- **FAIL, inherited Model tests.** `TEST_CONCURRENCY=2 pnpm --filter @barocss/cad-model test auto-layout drawing-issues drawing-sheets chat-drawing section-dimensions` ran 61 tests, with 59 PASS and 2 FAIL. The agent's accepted tolerance fixture reports `TEXT_OVER_LINES`. The ASME drawing-sheets fixture differs from its existing PDF hash. Both failures reproduce with the exact parent drawing sources. Parent output SHA-256 `a8b9747f1fd3952d22599c6ba48b49afa71da090a71791639e87c6f32973ca29`.
- **FAIL, inherited API inventory.** Generated parent and current snapshots have two D697 exposure changes, `DrawingIssueCode` and `CadModelCode`. The checked snapshot incorporates only those changes. The policy still reports `IV001` for the same 157 inherited exposure differences. The refusal catalog passes.
- **NOT_RUN.** Full suites, new PDF or DXF qualification, browser-managed file delivery and paid live agent calls. Whole B06 remains unadjudicated. Initial scenarios remain 5/10 accepted. Whole CAD and core readiness remain NOT_MEASURED.

Next D698 checks whether Detail follows the parent sheet's Hidden lines setting in Studio and actual SVG/DXF. [#2408](https://github.com/barocss/barocss/issues/2408)
