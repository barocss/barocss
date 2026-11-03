# CLI handshake draft

Status: INTERFACE_PENDING. No commands below are ready to execute. Final Root-reviewed protocol must replace all pending fields before freeze.py can seal. No helper module is invoked during authoring.

Stage A manifest comes from the independent data-only materializer. It defines exactly ten ordered entries, immutable request paths/pins, immutable expected checker outcome, and case IDs. Candidate sees only its Stage A request. It never receives a cold-oracle reply or trusted solution. Candidate CLI request/reply argument shape is pending High approval.

The independent checker CLI is fixed:

```
checker.py kernel CASE_ID REQUEST_FILE REPLY_FILE OUTPUT_FILE
checker.py world CASE_ID REQUEST_FILE REPLY_FILE OUTPUT_FILE
```

A checker runs immediately after each actual candidate reply. The next case cannot start until the current reply is persisted, full required payload checks pass and the checker returns its exact predeclared status. Preserve both original stdout/stderr and process receipts. The four controls are fixed by the independent author; the harness must not invent or amend their data or expected rejection reasons.

Stage B candidate command runs once in one fresh process with all six original full requests, after authenticated A_PASS. It persists six exclusive reply files, each <=2MiB. It retains context.evaluate(request) CPU times per frame, including unchanged compact and legacy admission/HYP work plus the new metered witness proof. No process startup is inside the core timer. Exact B summary fields and candidate CLI are pending High approval. The whole B process output and evidence remain <=16MiB. The harness compares each full reply to the saved V2 payload, under the closed reviewed metadata differences, then invokes checker.py world. Unknown fields fail. After all six pass, one cost decision uses those same six retained core times. No second cost process exists.

freeze.py is a root-only hash command:

```
python3 -B examples/physics-p4-position-witness-harness-2276/freeze.py \
  --candidate-directory CANDIDATE_OWNED_DIRECTORY \
  --reference-directory REFERENCE_OWNED_DIRECTORY \
  --protocol ROOT_REVIEWED_PROTOCOL_JSON
```

The frozen protocol must contain exact installed tool paths and byte/hash pins, exact command argv arrays, source paths, stage manifests/checker statuses, the complete algorithm metadata declaration and output schema. No shell command interpolation, fallback executable or package launcher is allowed. The harness does not derive exact matrices or mass weights outside the candidate meter.
