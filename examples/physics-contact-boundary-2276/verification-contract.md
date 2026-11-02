---
work_id: physics-contact-boundary-2276
artifact_type: frozen-independent-boundary-verification
status: before_parent_execution
owner_role: independent-fixture-verification
source_request: reproduce all historical strict contact boundary failures and check every replacement point without relaxing gates
last_updated: 2026-11-01
---

# Independent contact-boundary verification

This lane owns only `failure-fixtures.py`, `independent-check.py`, and this
contract. The parent runs all commands. This contract is frozen before the
new fixture extraction or geometry checks run. No World, dynamics, solver,
model, old campaign, download, or production predicate is executed here.
Existing HOLDs, raw evidence, first failures, and geometric gates remain.

## Immutable DATA authority

Use `world-source-03` under `examples/physics-stack-solver-2276/evidence`,
committed at `8d7474ba0b4df5367dbeee93b3a95cb777dcac48`. Source02 has equal
decoded records, but is not substituted by these scripts. Check each source03
compressed byte count, SHA256, Git blob identity, complete decoded byte count,
and SHA256 before selecting any record. Check root `result.json` and
`source.json` byte/hash pins too. Raw archive authentication completes before
the independent geometry module is imported.

| Case | Step | Original rows | Failed strict rows |
| --- | ---: | ---: | ---: |
| ALIGNED positive control | 1 | 32 | 0 |
| ALIGNED first failure | 2 | 32 | 31 |
| OFFSET first failure | 1 | 32 | 14 |
| YAW first failure | 1 | 32 | 32 |

The four fixtures retain all128rows, including all77failed rows. The fixture
includes full original free bodies, signed raw13 body bytes, full original
point ledger, explicit raw point/normal binary64 bytes, failed indexes, and
the complete saved independent contact response. Restore point positions
and normals from `pointOperandF64leHex`; archived JSON alone is not a
signed-zero authority. Check all raw body frames in each archived record,
not merely the selected free frame.

### Canonical six-case extension

The original four cases and their complete ledger/baseline records stay
unchanged. Append `ALIGNED:4` and `OFFSET:2` from the completed
`examples/physics-contact-boundary-2276/evidence/world-source-01` archive.
These are immutable saved bytes from the first boundary construction run,
not Git blobs at the older base. Do not substitute a fresh run or claim
uncommitted data has a committed blob identity.

The canonical version1 fixture now contains exactly six cases in this order:
ALIGNED:1, ALIGNED:2, OFFSET:1, YAW:1, ALIGNED:4, OFFSET:2. It has 192 rows,
79 resolved failures, one unresolved row, and 112 passing rows. The 32-row
ALIGNED:1 positive control is unchanged. There is no alternate four-case mode
or runtime fallback. Existing baseline-01 and previous replacement receipts
are preserved as their historical four-case measurements.

| Added case | Resolved failed indexes | Unresolved indexes |
|---|---|---|
| ALIGNED:4 | 26 | none |
| OFFSET:2 | 11 | 18 |

The new compressed/decoded pins are:

| File | Compressed bytes / SHA256 | Decoded bytes / SHA256 |
|---|---|---|
| ALIGNED.jsonl.gz | 322766 / `10a0a5791a38e1dde80d040c1774b817147bb15738dbf1476ac2179ad773a017` | 2497299 / `988f3438ac63a74f9fbd7b6ef56b2739455c256e0e6e4fb4ab3d597275328db5` |
| OFFSET.jsonl.gz | 140767 / `3b8567b349dbefc51d4767392b5ef412fdd0582526b58ac19ead132e6637aaaa` | 1301068 / `004651d2330efd7a770dc5f82b68310c3c6738ee15689ba1029481884c00f237` |
| ALIGNED.f64le.gz | 4569 / `abc0bed0f94c69716873954b388d94f99fe92fd2f7438724111e1faeb5de8926` | 30888 / `e784ee225fe7d54d2ad752a451a8b12833d29f0ca7d6cfd4141d90a2d8db702f` |
| OFFSET.f64le.gz | 1404 / `7634a96dbb8cb45d13bada32bdb3af0c898b554f7638e3c506db06113016ecc8` | 15912 / `e165944ad8570c8f32c8e236420cfd5ddc92fdaf393a8144c0ca91c7d895e71a` |

Selected JSON line SHA256 pins are
`ac472eb027a2b40f8f473a852a61b01cf9be0a4df87cba78ec8160e77e86172c`
for ALIGNED:4 and
`152fcba2eaaa29a9b5fecc8b7eaf041842dfcd13f7a49a5234e9da23863e739f`
for OFFSET:2. All raw body frames in both complete archives are checked,
including nonselected steps. Their point/normal fields are restored from the
selected raw point hex, with signed normal bits kept unchanged.

New source receipt `source.json` is 21891 bytes, SHA256
`fd32ccfa7c09c9f243b9f7bc3ec5a6b8016ea3cba717a9bc33c2fad37e3c0b6e`.
It names parent8d and the saved source hashes, including face-contact.ts
`63a9fead6d88a25d07afc005d3fbd2cebb5fdb88c949123e84fb5681f2f4d3dc`,
strict-line.ts
`972b48005563fb4815aa54a86eab8356a4a52952b6dfaec1990f72e610ba5bee`,
and trajectory-reference.py
`f2c1850b193a14944de657848d065c461e3ff2440e9e9bf452b6d24519af0ea0`.
These are the archived origin identities, not hashes of the current edited
candidate. The extractor also pins complete scene result files and
world-consumer-graph.json by byte count/SHA256 in `NEW_JSON_PINS`; all source
entries are carried into output provenance. Original8d archive/blob pins stay
unchanged. Both archive sets authenticate before importing independent geometry.

## File interfaces

```text
python3 -B failure-fixtures.py --output <fresh-fixtures.json>
python3 -B independent-check.py --fixtures <fixtures.json> --baseline --output <fresh-result.json>
python3 -B independent-check.py --fixtures <fixtures.json> --generated <generated.json> --output <fresh-result.json>
```

Fixture JSON has `version`, `provenance`, `totals`, and `cases`. Each case
has `caseId` (one of the six canonical case IDs above), `scene`, `step`,
`freeBodies`, `freeBodyRawHex`, `originalPointLedger`,
`pointOperandF64leHex`, `expectedFailedIndexes`, `expectedUnresolvedIndexes`,
and `baselineReference`. The failed list contains resolved failures only.

Generated JSON is `{version:1,cases:[{caseId,pointLedger,pointOperandF64leHex}]}`.
It must have exactly those six cases in fixture order, exactly32points per
case, the same directed IDs/indexes/pair keys/families/row order, identical
normal binary64 bytes, and unchanged other ledger data. Only point positions
may change. Generated body data is not accepted or trusted; checks use the
authenticated original free bodies. The parent separately checks complete
new face/witness DTOs with the old `witness-reference.py`.

Movement is the Euclidean distance from each original midpoint to its
replacement. Its exact squared Fraction distance must be at most
`(1/10^12)^2 m²`. This is the fixed `1e-12 m` movement cap, not a geometry
tolerance. Finite JSON point coordinates must agree numerically with the
explicit generated binary64 bytes; normals must also match original bits.
No normal renormalization, point omission, index repair, or row deduplication
is performed by the checker.

## Unchanged independent checks

Authenticate `examples/physics-motion-nogo-2276/stack-study.py` SHA256
`70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2` before
importing its definitions. It imports no production contact implementation.
For every row, use its original `point_layout`, `geometry_at_precision` at80
and120digits, and `compare_geometry`. Keep the original strict booleans:

- `lineIntersectsBoth` and `lineMidpointWithinTolerance` must be true.
- Both endpoints' `pointInsideTolerance` must be true.
- Signed `supportPlaneGapM <= 1e-9 m`; penetration remains signed.
- Precision classification must agree and differences must be `<=1e-60`.

Do not inflate the exact line/slab test. A point inside the slab tolerance
can still fail its exact line intersection. The saved failure is a geometric
contract failure; it does not establish a macroscopic manifold defect or
the cause of historical stack collapse.

The baseline must reproduce the exact saved five-check boolean vector on
every resolved row, exact per-case failed/unresolved-index lists,
79failed/1unresolved/112passed rows in total, and32passing positive-control
rows. For OFFSET:2 row18, the exact saved `StudyError` and message
`UNRESOLVED geometry classification` must recur. Retain `resolved:false`
and `unresolvedRows:1`; do not classify this expected failure as a passing
geometry row. Only this exact saved unresolved result is an expected baseline
observation. A different/new unresolved or classification mismatch fails.
The matching study reports `baselineReproduced:true` and
`BASELINE_STRICT_FAILURES_REPRODUCED`, with `geometryPassed:false`, exit0.

Replacement acceptance requires all192rows resolved and passing, all79 prior
resolved failures repaired and the one formerly unresolved row now resolved
and passing: all80 previous bad rows. The counters distinguish
`historicalFailedRowsRepaired:79` from
`historicalBadRowsResolvedAndRepaired:80`. Positive-control coverage remains.
No replacement unresolved is allowed. The output retains every row's
new independent witness and classification. A resolved geometry failure is
`REPLACEMENT_STRICT_GEOMETRY_NO_GO`; no failed row is removed.

## Work and stopping

One fixture extraction and one baseline check precede one replacement check.
Each check has six cases,192rows,384precision geometry evaluations, and192
attempted precision comparisons. A reproduced baseline has191completed
comparisons and the one explicit saved precision-classification failure;
a replacement PASS requires192completed comparisons. No candidate BigInt
predicate or replacement math is
imported. Compressed source archives are at most128KiB each, decoded JSON
at most2MiB each, decoded raw body data at most32KiB each, each selected JSON
line at most1MiB. The new complete saved archive requires a separate512KiB
compressed/4MiBdecodedJSON cap; its actual2,497,299-byte ALIGNED decoded
input exceeds the old2MiBcap. New metadata is capped at1MiB, raw body data
stays32KiB. These are input-file caps, not changed numerical/model gates.
Fixture/generated/result files are at most16MiB each.
Each process has a170s internal deadline and180s external parent deadline.
Each output uses exclusive creation at a new path. No automatic retry.

Authentication/schema/reflection/precision/resource failure is
`EXECUTION_FAILURE`, exit1, with the actual progress retained when possible.
A baseline classification mismatch also uses exit1. The sole exact saved
unresolved baseline observation above is retained without a geometryGO claim;
it does not permit unresolved replacement data. A completed matching baseline
or resolved replacement study uses exit0. The parent
must require the explicit replacement PASS status before any World work;
exit0 alone is not acceptance. Source freeze, process/stream receipts, full
face/witness checks, copy controls, and subsequent World gates remain parent
responsibilities.

The earlier committed `trajectory-run.mjs` appears not to wire its error
helper despite its README claim. This lane does not edit or relabel that
runner. The parent records the correction and wires the new runner directly.
No prerelease or legacy-compatibility fallback is introduced.
