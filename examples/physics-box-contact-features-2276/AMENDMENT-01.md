# Presentation amendment after preserved first failure

Frozen before repaired execution, 2026-11-03. No repaired build or candidate
execution has run when this amendment is authored.

First build01 and run01 completed Source/strict construction and graph parity
for20cases/62points per graph, retaining32 original rows. The independent
observer stopped at source/failure-pre-1 point3: the exact native certificate
passed, but the rounded midpoint/normal line missed a native box. Only2float
presentations passed. This remains the first actual failure.

The complete pre-edit source, build, observer and outputs are preserved in
`evidence/first-failure-01/preserved-source-build-observer-output.tar.gz`.
SHA256: `c223d6e3c2e148d148fe2d87c2dcd1de31075d36cce925ec91bf0a804437b6a6`.
`manifest.json` pins every archived file. Existing build01/run01 stay unchanged.

The old numeric conversion truncated numerator and denominator to their first
53bits before division. It was not a correctly rounded rational division.
Replace it with exact integer quotient/remainder conversion to nearest binary64,
ties to even, including subnormals and significand carry. No precision retry,
neighbor-word search, inward repair, geometric nudge or changed tolerance.

A source-level counterexample needs no candidate execution: for
`n=2^54+3,d=2^54`, truncating each integer to53leadingbits returns1. The exact
ratio is `1+3*2^-54`, which rounds to `1+2^-52`. Thus the old conversion can
lose a full output word before any geometric boundary test.

The only attempted floating presentation is the correctly rounded exact point
and endpoints, plus the existing unit-normal construction from correctly rounded
exact direction components. Certify that represented midpoint/normal line
against exact native slabs. Both line intervals must exist; its native exits
must match the represented paired endpoints within the unchanged1e-12m gate.
If certification fails, return typed UNRESOLVED at FLOAT_PRESENTATION, retaining
the exact construction and failed attempted presentation for diagnosis. Do not
return a geometric MISS or silently drop the failed point.

Correct rounding alone cannot guarantee strict incidence at a polygon boundary.
A valid rational line can touch an edge/corner with zero transverse slack; an
independently rounded anchor and direction can fall on either side. This
amendment does not claim that no alternative binary64 line exists for the saved
case. It gives a deterministic single-presentation rule and refuses an
uncertified result. Exact native geometry and binary64 presentation remain
separate verdicts. All original cases, point populations,12native halfspaces,
surface1e-9m/paired-line1e-12m gates and public/P4 NO_GO remain unchanged.

Root owns fresh build/run and the unchanged independent observer. A new refusal
is preserved NO_GO for this presentation protocol. No production adoption,
World, trajectory, cache or public report repair is authorized by this amendment.
