# Real warm-frame baseline result

Date: 2026-11-03. Status: EXECUTED_NO_GO.

The actual private Source run created 1 World and accepted 2 of at most 3 steps. Step 1 passed its independent interval checks. At step 2, the first genuine warm application reused the same native point with a nonzero prior tangent and a changed normal. Its current tangent-plane residual was **9.141407414550243e-5 Ns**, above the unchanged **1e-12 Ns** gate. Warm-frame transport is NO_GO.

The Source had already committed step 2 before the observer found the physical failure. The complete step trace is preserved. Later step-2 checks and step 3 are NOT_RUN. The observed warm branch is evidence that the branch executed; it is not a transport PASS.

Actual Source totals are 203 applications, 19 geometry queries, 19 query points and 513 anchor checks. The observer stopped at record 6 of step 2 after checking its first warm event. Source totals and the checked observer prefix are separate counts. No cache was injected and no input was adjusted after the run. The frozen quaternion, narrow floor and independently generated height are preserved in model-01.

The reference and build-free freezer receipts passed. The actual run receipt exited 1 at the physical NO_GO. All three guarded processes closed and left no owned process group. EXECUTION-REVIEW-02.json separately preserves the pre-World review-hash mismatch: the shell continued the data-only freezer after its assertion; World calls were zero. Final read-only review matched the actual runner before the physical run.

This package includes complete input/reference files, source freezes, immutable producer bundle and staged dependencies, actual traces/DAG data and decoder/observer, logs, setup review and all three guard receipts. EVIDENCE-ARCHIVE.json records every member SHA256 and both archive and uncompressed byte counts. No evidence or source file was removed.

No new build, numerical reference, World, B query or physical observer run occurred during packaging. No serialization, restore, public/Native, desktop, general warm stability or original P4 PASS is claimed. Existing tolerances, caps, first failures, HOLDs and deployment limits remain.
