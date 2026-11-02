---
work_id: physics-tangent-response-2276
artifact_type: explicit-input-correction
status: frozen_before_execution
last_updated: 2026-11-03
---

The original api-01 run remains FAIL_TANGENT_PUBLIC_API. It stopped at
source-high-friction after13 accepted Worlds/steps. The public admission layer
rejected friction.static4 with INVALID_CONFIG because the supported range is[0,2].
This is an invalid test input, not evidence of a numerical repair failure.

Before any runner edit, the actual executed api-run.mjs and cases.mjs were copied
byte-for-byte to evidence/api-01/executed-api-run.mjs and executed-cases.mjs.
Both copies match the byte counts and SHA-256 hashes in the original summary:

- api-run.mjs:12683bytes;3b60ecfbc6b6f315fc1f1a70f272a0905684242edc8b2af4c0e72c0c805cea74
- cases.mjs:1671bytes;67d56519fc87fe27adad78efc74c23279dd144b84f723664b6027425a0aa3384

The original20-case cases.mjs, original CONTRACT.md and original results remain
unchanged. The runner still defaults to that original profile. A corrected run
requires an explicit second CLI argument:cases-02.mjs.

The corrected profile imports the original cases. The original high-friction input
(muStatic4,muDynamic2) is retained with expectedError INVALID_CONFIG. Its model
input remains identical. Record actual rejected input/error code and require the
public creation call to refuse before a World is returned. Count this separately
as one creation refusal; it is not an accepted World or step. Compare Source/Native
rejection input and actual error name/code/message exactly. Stack paths are excluded.

A separate upper-supported-friction case uses muStatic2,muDynamic1. All other
physical values match the original high-friction control. This is the supported
upper static coefficient; it does not change public admission or material mixing.

The corrected profile defines21 cases:20 accepted finite physical controls and one
expected creation refusal. The complete graph retains27 accepted Worlds and31
accepted steps, including repeat/replay/refusal-retry controls. Each graph adds one
creation refusal. Existing gates,40-World/128-step/16MiB limits and first unexpected
failure stop remain unchanged. No source algorithm, tolerance or iteration changes
are part of this correction. The previous13 passed steps do not qualify unexecuted
cases. A fresh result must report its own evidence.

Execution after review, through the existing command guard:

    node examples/physics-tangent-response-2276/api-run.mjs api-02 cases-02.mjs

No build or numerical execution was performed while authoring this correction.
