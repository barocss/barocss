# D328 — Second App decomposition

App.tsx decreases from **2,308 to 2,046 lines**, and from **214,011 to 188,513 bytes**. Seven new modules separate nine domains. The [source map](source-map.md) lists each entry point. Central document adoption, evaluation, Open/Save/work ownership, Undo/Redo and Stop remain in App.

Implementation used GPT-6.1 Sol Medium. GPT-6.1 Sol High performed the [source-only review](source-review.md). No required source finding remains. No runtime dependency, schema, public package API or behavior change is intended.

## Verification

- Build, including TypeScript: PASS. Existing bundler warnings remain in the raw log.
- Changed production ESLint: PASS, zero errors/warnings. Browser driver lint: zero errors, 45 existing console warnings.
- Studio suite: **429 passed, zero failed, zero skipped**. No new mirror tests were added for code movement.
- Actual Chrome/WebGPU/DPR1: **11 unique selected cases pass**, plus starter smoke. Cases cover requirements, STEP references, DXF drafts, analysis maps, rapid section drag, section modes, display/picking/isolation, 3D annotations, CNC, clearance and print layers.

This browser result spans two source-identical runs. First run: 11 PASS / 1 FAIL, including starter. A6.4 still assumed Export STL immediately downloads; the baseline already opens a quality dialog. The driver now clicks its Export button and waits for the STL file. Isolated rerun: 2 PASS / 0 FAIL, including starter. Preserve the original timeout. Later first-run screenshots retain the leftover dialog; their domain assertions do not certify a clean whole-screen visual result. Root inspected analysis, section, print and final DXF captures.

Initial type/lint failures and a root receipt-command wrong-directory error are retained without rewriting their output. Correct-root checks confirm the frozen production source remained unchanged through both actual runs. [Qualification](qualification.json) gives precise boundaries; hashes in frozen/profile.json bind provenance and are not product checksum tests.

Whole other-package/browser suites, remote CI, performance comparisons and unrelated A05/A06 work were not run or accepted. Prior D321 Render-history evidence limits remain. Incoming DA-1a work was read and registered under its existing roadmap item only. No PR or release.
