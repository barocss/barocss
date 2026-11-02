---
work_id: physics-motion-nogo-2276
artifact_type: frozen-equilibrium-certificate
status: ready_for_build
owner_role: independent-algorithm-work
source_request: test first-frame contact feasibility after the measured normal residual
last_updated: 2026-11-01
---

# Saved first-frame equilibrium certificate

Only the original ALIGNED initial record and step1 are parsed. No World,
velocity sweep, optimization, source geometry or historical reference runs.
The existing stack-study.py and its first receipt stay immutable. This study
reuses that new observer's independently authored geometry routines, with its
SHA256 pinned to `70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2`.

## Inputs and authentication

The default prior diagnostic is `evidence/stack-study-01/result.json` in this
directory:16407bytes, SHA256
`f8941733862d59a49730c5f5624d99186e7d9f8a1f307dda3026371efc2b89db`.
It certifies complete decoded JSON/raw hashes before its result delivery.
The new study authenticates this receipt and the original manifest and whole
compressed archives again. Original archive paths, sizes and hashes are the
unchanged pins in stack-contract.md. The current compressed bytes must match
the prior authenticated bytes; complete decoded authentication is explicitly
reused from that receipt, not claimed as a new full decoded stream pass.

Parse only the first two LF-terminated JSON records, each<=2MiB. Step1 JSON
SHA256 must be
`f588b8d940c75dc246b164b7ab0b0182e6cf32604672986bcdabbe81b2108840`.
Read only the raw initial936bytes and step1's9360bytes at offset936. The
step1 raw SHA256 must be
`b156e035caaa3c94f5885a24a2541b9913869221a22311a416af64d58121ecc2`.
Authenticate both selected record hashes before any certificate arithmetic.
Restore all ten raw step frames using the unchanged archive layout. Use the
closure-ready fixed free pose and its saved velocity-phase body state.

## Restricted exact certificate

Require nine bodies, eight actual face interfaces and exactly32actual points.
Each interface must contain the four distinct XZ corners[+/-0.25,+/-0.25]
at a common Y. Require identity orientations, masses1kg, zero horizontal free
velocity/spin, one common negative free vertical velocity and zero static
floor velocity. All32warm normal/tangent impulses must be zero. Keep the
original dt1/120,gravity-9.81,restitution0,friction1/.7 and actual poses.

Derive the chain from actual pair connectivity, with the unique static body
as root. Check that it has nine vertices/eight edges, no branch/cycle, and
that its direction agrees with increasing geometric height and each actual
normal. Derive supported mass by counting dynamic vertices on the side of an
edge away from the static root. No load uses an ID suffix or hardcoded pair.

Treat saved binary64 operands as exact Fractions. Let s=-savedFreeVy. For an
interface supporting k one-kilogram cubes, assign each actual point normal
impulse lambda=k*s/4 and tangent[0,0,0]. Sum signed impulses and lever-arm
torques at each actual free COM. Verify exact zero final velocity and spin,
nonnegative lambda, zero32-row normal speeds/complementarity and friction
feasibility. Report exact rational residuals. This is a closed-form witness,
not an active-set solve or a unique impulse-distribution claim.

Separately report k*Fraction(savedGravityMagnitude)*Fraction(savedDt)/4 and
its difference from the stopping impulse. Native multiplication rounds; these
two expressions must not be called exactly equal without checking.

For every actual point, independently derive OBB corners/support planes and
line/slab witnesses from the saved free pose. Use Decimal80/120 and the
unchanged1e-9m geometry tolerance; classifications must agree and numeric
differences<=1e-60. Both point line intersections, point inclusion within
tolerance and witness midpoint agreement are required. A positive support
gap may be<=1e-9; negative gap is recorded penetration, including the initial
free-fall floor overlap. It is not silently set to zero. No original physical
gate changes. Missing symmetry, invalid topology, unequal free velocities or
invalid geometry yields a restricted-certificate refusal, not relaxed input.

## Budget, result and execution

One attempt:<=2parsed JSON records,10296selected raw bytes,32geometry checks,
32exact certificate rows. Output<=16MiB. External deadline180s; internal
alarm170s leaves time to write an execution failure. One synthetic unittest
suite and one archive study are run by the parent after source freeze.

```
python3 -B examples/physics-motion-nogo-2276/stack-equilibrium-unit.test.py
python3 -B examples/physics-motion-nogo-2276/stack-equilibrium.py --output <new-absolute-result.json>
```

`--diagnostic <absolute-prior-result.json>` is optional and must contain the
same pinned bytes. The output is exclusively created. Input authentication
or precision uncertainty is EXECUTION_FAILURE. A resolved restricted-profile
or certificate disagreement is CERTIFICATE_REFUSED, an honest negative study
receipt with exit0. A passed certificate proves feasibility of one saved
velocity patch. Together with the prior receipt it shows a feasible fixed
point and a recorded64-sweep residual. It does not prove asymptotic
convergence, full patch sufficiency later, the cause of the original collapse,
or a native repair. Every result retains causalLawDefect=UNKNOWN,
nativeLawFixAuthorized=false and originalEightBoxPhysicalGO=false.
