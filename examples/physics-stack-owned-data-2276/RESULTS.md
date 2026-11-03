---
work_id: physics-stack-owned-data-2276
artifact_type: implementation-validation-result
status: bounded_component_pass_full_p4_open
owner_role: independent-physics-algorithm-work
source_request: qualify retained-root sizing and fixed reservation controls
last_updated: 2026-11-04
---

# Actual retained-root and ledger component

Root ran the fixed7-group selftest under the original180s command guard with
reviewed PINS94e1e6949865c13e7ca20e03129bad8517d89aafc529be0555d08feb2fff0d3e:
PASS_STACK_RETAINED_DATA_AND_FIXED_LEDGER_COMPONENTS, outer exit0/126.3095ms.

The independent flat registration oracle exactly matches the walker: direct
keys/values/Fraction/alias/cycle992 bytes/12 nodes; Decimal cohorts including
signed zeros and long coefficient1272 bytes/9 nodes; native-slot Token844 bytes/
9 nodes. Eleven unknown-policy/type/getter/unset-slot cases refuse with zero
subject getter calls. Boundary/AUX reservations and five-owner64MiB atomic
ledger tests pass; rejected operations preserve full snapshots. Three credits
remain held through prepare/proof/archive; failure preserves the last contiguous
accepted frontier, with no claim that first observed failure is earliest.

Root also imported the ACTUAL prepared Token class without loading its original
world/reference and passed token-live-01: nine explicitly registered retained
objects exactly match the flat oracle, strong references/aliases and Decimal
representations/flags remain unchanged. No physics or numerical reference call
was made. The original component source/seal remains unchanged.

The selected Decimal policy is supported by the pinned CPython3.13.5 C-size
implementation and local C-extension/runtime checks; see DECIMAL-PREMISE.md.
It defaults to UNKNOWN when that policy is absent. These tests qualify CLOSED
RETAINED ROOTS and controller behavior only. They do not discover active native
scratch, allocator-copy overlap, all live frames, Node/V8 data or total process
memory. whole64MiBBound=false; nativeTemporaries/allLiveFrames=UNKNOWN, full1200
BLOCKED, API=false. Existing profile thresholds and failures remain intact.
