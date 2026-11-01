---
work_id: D421
artifact_type: step-name-loss-qualification
status: done
owner_role: executor
source_request: "Continue the roadmap after the approved develop integration"
last_updated: 2026-11-01
---

# STEP header/product name loss visibility

D421 is QUALIFIED at `41c06e66608d0899d0db2074129f75743db7ae97`. The existing STEP preparation panel now reports when the current writer replaces non-ASCII or control characters in the STEP header file name and product name with underscores. The raw intended download basename is separate and remains visible as entered. This is a row-13 loss-report correction, not a Unicode codec or name-preservation feature. [Counts, commands and source hashes](qualification.json).

Before editing, real `exportStudioStep` calls reproduce three missing reports: Latin, Korean and newline names change in the serialized header/product while `omitted` is absent. Default printable ASCII, ordinary ASCII and quote/backslash controls behave as expected. All six fixed-timestamp pre-change STEP files are retained outside git. The fix appends one applicable private result through the existing `omitted` list; it changes no public signature, UI component, serializer, geometry, source revision or download action.

Sol Medium implements and verifies the small fix. Focused tests pass 6/6 (three existing and three new). The new cases also cover DEL/emoji, exact header/product values, unchanged document, six pre-fix byte hashes and the unchanged source key. Hashes prove byte equality, not geometry. Model types after the final test edit, three-file lint, driver syntax and API/docs/refusal/navigation checks pass. No baseline whole suite or unchanged geometry build is repeated. No independent audit is required by the small tier.

One actual Studio run passes Korean and ASCII preparations. Passive real worker replies confirm `부품` remains the intended download basename while the header/product use `__` and the new loss is visible. The ASCII control keeps its name and has no added loss. Cancel and Esc preserve the exact document. Root reviews both images and accepts the readable existing-dock report/control; this adds no general UI layout acceptance. All 744 frozen files match before, after and after cleanup; page/console errors, changes and downloads are zero. Context, Chrome and server close; no task-owned resources remain.

A pre-execution driver review catches a missing Model/Kernel freeze graph. A minimal inspector re-export supplies the fresh graph and required inputs; it makes no new inspector/independent-geometry claim. Same-document Open waits for the exact filename to avoid a stale-name race. Neither review correction is relabelled as an actual-run failure. The three real baseline omissions remain recorded FAIL with their resolution.

Actual outbound download and filesystem filename behavior, Unicode preservation, arbitrary face/description string loss, broad format acceptance, full suites and release remain NOT_RUN. No OCP, dependency download, paid call, schema change or further develop merge occurs. Raw files, snapshots, bundles and logs stay under `/tmp/barocss-d421`. The serializer and all six fixed-input STEP bytes remain unchanged. Broader exchange/research issues stay open.
