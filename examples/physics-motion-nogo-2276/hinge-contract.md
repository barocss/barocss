---
work_id: physics-motion-nogo-2276
artifact_type: frozen-hinge-scalar-study
status: implemented_not_run
owner_role: independent-algorithm-work
source_request: preserve NO_GO and diagnose archived public two-hinge scalar discrepancy
last_updated: 2026-11-01
---

# Archived step 77 scalar study

This study reads historical DATA and evaluates one reconstructed expression.
It does not execute absent candidate `7178434a0440d9dcce0be8c602cf3ba4f8ee5068`.
It changes no old source, fixture, tolerance, cap, raw-bit gate, or HOLD.
The parent owns every actual test and study run. No run is claimed here.

## Fixed authorities

The selected historical authority is `f40123da0eedb19245688557f865e1beb09d47ef`.
The completed archive root is
`examples/physics-rigid-hinge-velocity-world-reference/evidence/completed-world-a341f222`.
Its manifest SHA256 is
`60e389dbce2640f7f28378927f54cd6d2d8af203bcf374d54177a957b91d2191`.
The historical source freeze SHA256 is
`f25d064ebb082e556202491000f545f41726eef3c8e426a1452a66814e6d7954`.

Before any scalar calculation, the study checks current `math.ts`, private
coupled-hinge angle source, private velocity diagnostics, private report,
and private postcontact adapter against their exact historical source-freeze
byte counts and SHA256 values. It also pins the current transferred package
measurement, pose, and report files. The private and transferred `function
angle(...)` lines must be byte equal. This establishes the expression's
historical source correspondence. The new `.mjs` expression is an explicit
transcription; it is not an import of that package or the absent candidate.

| Selected span | Decoded offset | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| `main.native.jsonl.gz`, line 77 | 15860593 | 208605 | `88b2800cb2c56052ab82ff607509f13ce4a4e50c958ce92cea3630621e0e1444` |
| `main.records.jsonl.gz`, line 78 | 123916 | 1635 | `1119026b4d21f2828438800b1cf31166efce29874b26e1a0557fafcca82e654a` |
| `main.bodies.raw.gz`, POSTCONTACT | 191776 | 416 | `bc860dd78f5c6e8bb9bb2fe25618f15d04cca481bebc59a5f9df52b9f8d20b08` |
| `main.bodies.raw.gz`, projected | 192192 | 416 | `0ac9fd68b1ae6f81f327899549ab41c8170b100b66d5f6319cf70c62085d6e7d` |

Each compressed archive first matches its own frozen manifest entry. The
independent outcome record must point to the selected native record and raw
spans. Selected hashes, cursor `76 -> 77`, returned outcome, empty commands,
fixed body/joint order, `dt=1/120`, report-ready stage, and historical report
bits must match. The raw spans must equal the native JSON raw-frame strings.
The historical POSTCONTACT quaternion bytes, including signed zeros, are
the reconstruction input. No final-pose inference substitutes for them.

The immutable report comparison values are:

- Historical accepted angle: `0.3020821295571869`, F64LE `a3ddc9485055d33f`.
- Recorded candidate angle: `0.30208212955718694`, F64LE `a4ddc9485055d33f`.

The candidate's actual preprojection operands were not observed. Equal
final body bytes do not establish equal preprojection operands.

## Independent rounding certificate

Python restores the four raw13 body records and selects both directed pairs.
It reconstructs `b * inverse(a)` and the `+Z` dot product with a separate
exact-Fraction implementation. Each basic operation rounds to binary64
with nearest-even rounding. Exact zero results preserve IEEE signed-zero
rules. The Node transcription must return the same quaternion and operand
bits before its scalar result is compared.

For positive binary64 operands `x,y`, require `0 < y/x < 1/4`. Thus
`atan2(y,x)=atan(y/x)` without a quadrant or pi approximation. Let `r=y/x`
as an exact rational. The alternating series supplies strict bounds:

```text
S64 = sum(n=0..63) (-1)^n r^(2n+1)/(2n+1)
S64 < atan(r) < S65 = S64 + r^129/129
```

Both rational endpoints must round to the same binary64 number. Otherwise
the result is `UNRESOLVED` and execution stops. The selected number is a
certificate for correctly rounded `atan2` at these reconstructed binary64
operands. Multiplication by two then follows the declared binary operation.
The output retains the exact rational endpoints and their operand bits.
No host `atan`, `atan2`, decimal library, or ODE solver supplies this oracle.

This compares the historical and candidate bit patterns with a new rounding
certificate. It does not alter either pattern or call a scalar match a
physical pass. An observed host mismatch with the certificate is a scalar
classification, not an execution failure. Authentication, schema, operand,
domain, or unresolved rounding errors stop the attempt.

## API and limits

```text
python3 hinge-unit.test.py
python3 hinge-study.py --output <fresh.json> \
  --node /Users/user/.volta/tools/image/node/22.19.0/bin/node \
  --node /Users/user/.volta/tools/image/node/24.22.1/bin/node
```

`hinge-runtime.mjs` accepts one bounded JSON request on stdin. It restores
the raw bytes, evaluates exactly one `Math.atan2` per pair, and emits operand
and result bits plus executable, Node/V8 versions, architecture, and OS
facts. No source factory is imported. The Python driver records executable
SHA256 values and raw child stdout/stderr. Node runtime versions are limited
to the named installed versions. Missing historical libm provenance remains
explicit; current OS metadata does not fill that gap.

| Resource | Bound |
| --- | --- |
| Node runtime processes | At most 2, distinct selected versions |
| Native `atan2` calls | At most 2 per runtime, 4 total |
| Exact series certificates | 2, one per pair, 64/65 terms |
| World, motor, FREE, contact, projection, solve, reference derive | 0 |
| Compressed native archive | 8 MiB |
| Decoded native prefix | 20 MiB |
| Selected native record | 256 KiB |
| Compressed outcome archive / decoded selected prefix | 256 KiB each |
| Selected outcome record | 4 KiB |
| Compressed body archive / decoded selected prefix | 64 KiB / 256 KiB |
| Retained selected raw slices | 832 bytes |
| Each child stdout/stderr | 64 KiB |
| One executable read for hashing | 256 MiB |
| Derived JSON output | 1 MiB |
| Diagnostic process | 90 seconds; one attempt |

Output must use a new path. A logic repair uses a new run ID and preserves
the first attempt. Runtime counters distinguish charged attempts from
completed replies. A child failure never fabricates completed scalar calls.
The parent runner retains its own raw stdout/stderr, exit, and timing.

The synthetic unit tests cover alternating bounds, unique rounding and a
rounding-boundary refusal, strict operand domain, ties-to-even arithmetic,
signed zeros, quaternion operation order, JSON validation, raw-data
validation, and selected-span authentication. They use no archived campaign
or native `atan2` call. Their arithmetic is separate from study counters.

## Preserved first failure and limits

An earlier read-only locator probe printed the selected historical location
and quaternions, then raised `KeyError` by assuming an `output.joints` field.
It changed no files and made no mathematical calls. The new output records
that schema-probe failure instead of omitting it.

The historical candidate remains unqualified. This study cannot observe its
missing preprojection operands, recover historical V8/libm behavior, repair
public admission, or qualify a World trajectory. Existing public activation
`NO_GO`, raw-bit gates, physical gates, original failures, and HOLDs remain.
