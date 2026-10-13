# Boolean/extrusion per-feature cache contract (proposed)

Tracking: [#1710](https://github.com/barocss/barocss/issues/1710), under [#1696](https://github.com/barocss/barocss/issues/1696), [#1660](https://github.com/barocss/barocss/issues/1660) and [#551](https://github.com/barocss/barocss/issues/551). This document specifies gates for a future **private** cache in the bounded `BooleanExtrusionFeatureGraphV0` path. It does not implement one.

## Current evidence and boundary

`planBooleanExtrusionImpactV1` is read-only analysis and reports `analysis-only-full-rebuild-required`. `prepareBooleanExtrusionRebuildV1` produces a complete Native candidate without committing it. The update path still evaluates all Native builders. Merged #1706 checks equality of unaffected evaluated features across full rebuilds for three edits; it neither reuses outputs nor measures saved work. Closed #1627 implements private unchanged-prefix reuse for the separate `cad.model()` API and is not authority for this graph.

The supported graph remains two `face-input` features, one `coplanar-boolean`, and one to four `normal-extrusion` features, with at most eight parameters and seven features. Authored intent, units, source frame and actual Native builders remain authoritative. No new public v2 API, exported cache field, file format, editor state or provider substitution is implied.

## Owner, authority and lifetime

A cache frame may be created only by the module's evaluator from an accepted, fully validated result. It belongs to exactly that graph instance and accepted revision. It is private CPU data, never accepted from a caller, a report, a file, a serialized proof, another graph or a global registry. Cold evaluate/load starts without a frame. A proposed next frame is published only together with an accepted candidate under a revision compare-and-swap (CAS); failure discards the proposal and leaves the prior accepted result and frame usable. Frames do not point to superseded frames. Caller-accessible mutable arrays or objects cannot become cache authority.

The frame must bind a private evaluator/provider identity to the same imported Native implementations and evaluation policy. An implementation change, provider mismatch or option mismatch makes a miss. A public `graphId` or digest alone cannot authenticate the frame.

## Entry identity and fingerprint

One entry represents one evaluated feature and its owned output. Its identity includes graph ID, accepted revision, feature ID, kind, output slot ID, authored/evaluation order and the private evaluator identity. Lookup additionally checks a **lossless, bounded structural fingerprint** of:

- The complete admitted authored feature input: Plane and ordered Loop geometry and face options; Boolean operands, operation and options; or extrusion region, distance definition and options.
- The relevant admitted parameter definitions and their resolved typed values, including transitive parameter dependencies and `report.distances[].dependencyIds`.
- Every upstream feature dependency's owned output identity/content and order, plus graph length unit, source frame and evaluation budgets/options.

Canonical comparison must preserve array order, field presence, number values including `+0` versus `-0` (`Object.is` semantics), and all original Native IDs. Do not use ordinary JSON number serialization for signed zero. An optional hash is only an index: compare the complete canonical value before a hit. Reject incomplete, duplicate, unknown, cyclic or unbounded dependency inventories rather than treating missing data as unchanged.

A previously evaluated body may contain revision-qualified Native references. Therefore an unchanged geometry fingerprint alone does **not** authorize copying its old result into a new revision. Requalification of every Native reference, binding, source and nested report reference must be defined and shown equivalent to the complete current-revision Native rebuild first. Until that proof exists, this entry is a miss and the existing full builder runs.

## Invalidation, validation and transaction

Start with the existing owned edit snapshot and native admission. Compute transitive dirtiness from parameter edges, topology feature edges and extrusion distance edges; a directly edited feature is dirty even if its new value compares equal, unless a separately proved no-op rule admits reuse. A dirty upstream feature invalidates every dependent output. Features outside the dirty set are merely **eligible** for fingerprint inspection, not automatically reusable. The plan remains an advisory receipt; it cannot override Native admission.

Full Native evaluation is the safe fallback for any cache miss, quota overflow, ownership uncertainty, mismatched fingerprint/provider/options, unsafe revision binding or unsupported feature. Invalid authored data, stale expected revision, missing/cyclic references and Native builder failures still refuse the transaction with the prior accepted result intact. Do not convert an invalid edit into a successful cache miss.

A future commit must compare graph ID and exact accepted revision immediately before publishing a new result/frame. Only a fully validated candidate may win CAS; a losing candidate is discarded. No partial result, changed accepted document, or cache eviction may leak from a failed edit. Candidate revision and all qualified bindings must agree.

## Quota and ownership

At most seven entries may be retained in a frame, one per current feature ID; no historical revision entries. Admit an entry only if its complete owned CPU output and canonical fingerprint can be measured by a lossless bounded encoder. Proposed admission caps are **2 MiB encoded bytes per entry** and **8 MiB encoded bytes per frame**, counting fingerprints and retained output/binding/report data. Also enforce the graph's existing own-value/depth/array limits. These encoded-byte limits are deterministic admission limits, not a measured JavaScript heap ceiling. If a value cannot be encoded or would exceed a cap, skip that entry and use the full Native path. On a successful new revision replace the old frame as a unit; no LRU, unbounded retained chain, renderer resource or mutable alias.

## Verification gates before selective execution

1. Use an independent cold full Native rebuild as the oracle for each supported edit. Compare accepted authored document, resolved parameters, feature evaluations and original Native identities, dependency/distance rows, summaries, sources and every revision-qualified binding. Compare report semantics separately from work counters, which will differ if builders are eventually skipped. A cache hit must never use the prior revision's binding unchanged.
2. Extend the actual authored Boolean/extrusion fixture beyond #1706: face geometry and Boolean operation edits, multiple extrusion leaves and an unaffected sibling, transitive height and distance edits, no-op and unused signed-zero inputs. Check both candidate and cold Save/Open reconstruction, old/new ownership independence, and exact supported refusal diagnostics.
3. Exercise malformed or missing dependency reports, duplicate IDs, cycles, changed options/evaluator identity, mutated caller input, sparse/accessor edits, stale revisions, quota boundaries and an injected Native failure. Assert failed candidate/CAS leaves prior accepted bytes and frame available for a later valid edit.
4. In the later implementation PR, instrument **actual Native builder calls** per feature and compare cold versus warm paths on the exact head. Only claim skipped work when the specific builder was observed not called. Measure repeated Native timings under a fixed fixture/budget before claiming speedup; record variance and regressions. Keep current Native validation until an independent gate proves any proposed shortcut.
5. Run the affected CAD checks and a real Native fixture through GitHub Actions on the implementation head. Record exact workflow/run/head and distinguish PASS, FAIL and UNRUN. A green documentation PR alone does not satisfy the runtime gates.

This document is a proposed contract for review. All runtime cache, selective execution, CAS storage, rollback and timing gates above are **UNRUN** in this documentation increment.
