# Loader limits and errors

## Source and display profiles

| Resource | Bound |
| --- | --- |
| Native dialect | Explicit sourceVersion0 only on the direct source loader |
| Source bytes | 262144 UTF-8 bytes |
| Default Curve display | 1..4 total native objects |
| Default Surface-only display | 1..4 Surfaces; unrendered Curves retained |
| Complete native profile | Exactly `{version:1,maximumObjects:16}`; 1..16 total objects |
| Surface grid | Integer2..17 per axis |
| Complete Surface envelope | 4624 vertices,8192 triangles,24576 indices |
| Curve display aggregate | 4096 points and4092 segments |
| Adaptive Curve tolerance | 1e-7..1000 mm |
| Curve maxSegments | v0:1..1024; explicit v1:1..4092 |
| Curve maxDepth | Integer0..16 |
| Uniform original Curve | Degree1..5; count2..129 |
| Native source-to-GLB | At most4 total native objects |

The complete profile is a fixed versioned admission mode, not an arbitrary configurable object budget. Per-Curve and aggregate limits still apply. Curve-only display requires an explicit Curve profile; Pixi requires adaptive v1. Other specialized entries have their own input domains.

## Independent composition and transport budgets

Document selection admits at most four bodies. Model-set loading admits at most four source entries; primitive projection admits at most four total objects. Assembly validation has four parts and32 instances. None of these follows automatically from the native16 display profile. Listing32 as a native assembly bound does not claim execution of every adapter at that maximum.

Bounded URL transport uses262144 source bytes,2097152 document bytes or1048576 feature-graph bytes for its respective path, plus4096 body chunks. It rejects HTTP/transport/UTF-8 failures and supports AbortSignal or progress-callback cancellation. `loadAsync` on an engine loader retains its own older transport behavior. Use the explicitly bounded method when that guarantee is required.

## Error map

| Failure | Public signal | Host response |
| --- | --- | --- |
| Invalid option shape | TypeError or RangeError | Supply exact own plain-data fields; do not use getters |
| CAD compiler refusal | `BaroCadSourceError.diagnostics` | Show actual code/range; retain accepted source |
| Sampling/conversion refusal | RangeError or entry-specific error | Keep native authority; revise the admitted profile |
| Cancellation | `BaroCadLoadAbortError`, name`AbortError`, code`ABORT_ERR` | Leave accepted result; dispose any stale candidate |
| Uniform Curve refusal | `BaroCadUniformCurveSourceError` | Inspect code, diagnostics and actual cause |
| HTTP/UTF-8/progress exception | Actual transport exception | Report the failure without adopting partial state |

Uniform Curve codes are OPTIONS, SOURCE, PROFILE, SAMPLING, PARAMETERS, POSITIONS and SEGMENTS. They distinguish invalid configuration, original compiler refusal, wrong native family, sampling/domain issues, unsafe conversion and collapsed segments.

Options reject extra/symbol/accessor/inherited fields and unsupported versions. Native parameters/IDs and source bytes stay authoritative. Conversion applies scale once and can refuse binary64/Float32 nonzero-to-zero loss or collapsed segments/triangles. No silent clamping or geometry substitution guarantees acceptance.

## Peer and ownership boundary

Actual repository peer checkpoints use Three0.186.1 (`^0.186.1` declaration), Babylon9.29.0, PixiJS7.2.4 and Pixi3D2.5.0. Import only the optional target entry your host uses. The neutral root/native path does not create a renderer.

Caller owns host Scene/Stage, renderer/engine, camera, canvas, lights and unrelated objects. Adapter result owns its generated display resources, including prepared resources for unselected objects. Disposal is idempotent. Native Model/source remains a separate CPU record.

Historical source-browser, compiled-JS/declaration, native-built, locally merged and current-consumer receipts have different scope. [#1017](https://github.com/barocss/barocss/issues/1017) now records an additive-entry CPU checkpoint, not all-entry runtime or full peer declaration certification. Packed installation remains [#801](https://github.com/barocss/barocss/issues/801); npm publication, broad CAD quality and universal exchange parsing remain unclaimed.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. [Manifest](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/package.json), [public root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/src/index.ts), [package README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-interop/README.md). Fixed-SHA links identify that snapshot; this native local commit may not yet be available on the remote. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
