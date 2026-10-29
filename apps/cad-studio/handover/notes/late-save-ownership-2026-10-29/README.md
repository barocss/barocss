# D322 delayed Save ownership

Final selected result: **SCOPED_PASS**. See [root qualification](qualification.json) for final checks, actual3cases/affected Stop regression, retained failures and NOT_RUN limits. Earlier paragraphs below retain the investigation sequence.

Existing EA-20261029/A02 P1 attaches to12/CG6/O9. The current source has unguarded post-await effects in App Save and useProject save: dirty/recovery clearing and project tag/path/log/offered/autosave changes can outlive their captured request. This is a source candidate, not an actual data-loss claim.

Baseline is a386c8705beda2c72d215da61a55fd6119351ca2. First qualify a controlled actual Studio/native-IO late completion before repair. Saved bytes may finish for their original request, but completion must not clean a newer document or mutate another project/path/session. Newer autosave/recovery must survive. Capture and recheck ownership across await; preserve errors and current-save behavior. Do not infer full cross-tab coordination or performance from this work.

Sol High owns read-only ownership design/review. Sol Medium owns ordinary implementation/tests when assigned; the consumer lane prepares a native-return schedule and public UI baseline. Root owns integration, final checks and normal feature push. No PR/release is authorized.

First actual attempt: SETUP_OR_SCHEDULE_FAILURE, `Cannot read properties of null (reading 'doc')`. The selected native Save committed and its close return stayed held, but the asynchronous browser wait did not establish a completed newer autosave before snapshot access. No old-Save release or final safety assertion was reached. Original source capsule, logs, states and owned-resource cleanup are retained by the consumer. This is not a reproduced product defect. Production remains the fixed baseline while the native-read polling is corrected.

Second actual attempt: **BASELINE_REPRODUCED_PRODUCT_FAIL** at the same a386 source. Real Save A commits, its native close return stays held, and newer public Grid edit B finishes its native autosave. Releasing A preserves live B and saved A but marks B clean and deletes its completed native autosave. Native returned-tag read and project-list completion are observed before the final snapshot. Root reads the receipt and views the before/after PNGs. The failure is:

```text
late Save A must not mark newer Render edit B clean

false !== true
```

Node exits1; the namespace is removed and verified absent, owned context/browser/server close, and the heavy gate is returned. The document remains in memory; permanent file loss, actual crash, New/Close/switch and cross-tab behavior are not inferred. Implementation is now authorized within source-plan.md; consumer regression waits for final source checks and freeze.
