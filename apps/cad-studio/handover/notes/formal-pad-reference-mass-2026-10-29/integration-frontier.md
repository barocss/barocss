# Formal mass integration frontier

Date: 2026-10-29. Static design only. Reviewed the candidate patch, both draft files, the prior independent review, and the current native assembly/source touchpoints. No repository change, build, test, probe, benchmark, commit or agent launch was made. Candidate tests are not execution evidence in this review.

## Present boundary

The candidate patch adds only a private feature module and its test. It has no connection to native assembly, Part.mass, a mass provider or Studio. Its declaration is the formal cylinder of nominal radius R plus the ideal scale2 annular sector whose endpoint rays come from the actual quarter coefficients. It is not the integral of the stored rational B-rep.

The corrected candidate includes the finite `density * 1000` guard, separate MIN_VALUE/REPRESENTABILITY and MAX_VALUE/SUPPORT expectations, normal-density finite retained-SI tests, and the tiny-source/large-density refusal test. This resolves the previously reported static expectation mismatch. It does not prove the existing SI reader accurate, remove its underflow limits or establish a runtime PASS. Keep nativeSIAccuracy false.

## Smallest actual-input connection

Use a new private diagnostic entry point with the same fixed native profile: one four-edge original-UV rectangle, no holes, source height positive, pad height exactly the admitted source radius. Do not widen D304, accept an external native receipt, or add a second caller rectangle/radius/source certificate.

Inside the fresh producer, retain the existing lexical `AssemblyRun`. Its `source` is the once-admitted, independently owned source; `assembly.nativeEvidence` contains the four actual base/outer/side operands; `publicResult.proof.components` contains the normalized actual UV ring. Current touchpoints are `runAssembly`, `nativeSidePhase`, `nativeFamilyPhase`, and `finishNativeAssembly` in cylindrical-wrap-assembly.ts. The existing public native builder should keep its behavior and receipt scope.

Derive one rectangle from that owned normalized ring. Charge the structural validation and require exactly four distinct corner combinations, alternating axis-aligned edges, strict U/V order and the admitted native domains. Match the four metadata start/end UV values and installed base/outer/side full fields as already required by D304. Cyclic starting point and clockwise input may normalize to the same rectangle. No second independently supplied rectangle is authoritative.

The mass phase must read these same actual inputs:

- `run.source.quarter`: stored poles, weights, full knot/domain bits and quadratic-by-linear layout; preserve actual endpoint rays, not ideal cardinal reconstruction.
- `run.source.radius` and `run.source.z`: nominal R and the actual slab endpoints from the same fresh source, including their represented bits.
- The derived rectangle: exact native-U endpoint normalization and exact affine-Z evaluation at its V endpoints.
- The installed factor2 family: source/base/outer/side binding and the existing height==R gate. This connects the formal sector parameter choice to the request; it does not turn the formal sector into the literal stored surface.
- The owned density and all mandatory scalar budgets. Preserve the actual public Number audit and retained central basis transfer; keep area and SI-accuracy claims false.

The candidate's `sourceChecks`, `moments` and `publicProperties` are the mathematical core to factor. Its current entry point, lines310-332, creates a new Context and calls buildCylindricalWrapUVSource again. Calling that whole public helper from the native builder would repeat source admission and its real cost. Never execute both source producers and then subtract one cost merely because the inputs match.

## One accepted ledger

Prefer a module-private formal core that consumes only the fresh producer's owned source/rectangle and a host arithmetic ledger. Keep this continuation inaccessible as a public caller-receipt finisher. Reuse the existing native q context, charged direct integer operations and `check()` path, or use an internal child ledger constrained by the actual remaining limit and import its executed incremental cost exactly once. A public standalone 200k context must not become another allowance.

The full accepted total includes source admission once, composition, D300/D301, the actual 63-slot D303 family, D304 binding, rectangle binding, all angle/sqrt/interval work, all ten moments, actual Number auditing, result ownership and structural work. Enforce the unchanged 200000 exact-operation, 8192-bit and 1048576-work caps. All rational GCD/search work and signed integer division/remainder/square guards remain accounted. Any child ledger must include real callback/final import checks; failure publishes no partial assembly or mass result.

Use the native host's existing work convention for the combined request. The standalone candidate's work formula differs from the native helper import convention; do not add an unlabeled mixture or call the two standalone work fields equivalent. Record incremental phases in the host convention and one authoritative final total after the mass audit. Earlier native/component/source receipts are cumulative prefixes, not independent extra allowances. Existing public builder receipts must not change merely to host the new diagnostic.

The D305 before/after result must establish actual remaining headroom. No static saving estimate or claim that this mass phase fits follows from this design. If the full fixed request exhausts the cap, return BUDGET and preserve the exact failure; do not reduce the independently audited outputs or raise the cap to obtain success.

## Closed-reference facts and open proof

For the declared formal object alone, the needed theorem is small: R>0; z0<zL<zU<z1; strictly ordered first-quadrant endpoint rays alpha<beta; C={rho<=R,z0<=z<=z1}; P={R<=rho<=2R,alpha<=theta<=beta,zL<=z<=zU}. C and P are closed bounded regions, their interiors are disjoint, and they meet on the R patch. Their union is a connected formal region with positive added volume. This justifies adding the ten reference moments. Prove this from the actual extracted scalar/ray data, rather than trusting positiveAddedVolume or an authority string. A narrow future formal-reference-closed flag must explicitly name this independently defined region.

The following do not yet follow for the actual assembled B-rep:

1. Full original exterior geometry: source consistency and strict checkBrep are not an analytic global certificate for both stored half-walls, both caps and all their seams. The second native half retains its actual coefficients and shifted producer angles. Do not silently substitute an ideal circle or infer sourceGlobalCertified from the quarter's radial bound.
2. Retained face domain and orientation: prove that the actual appended UV loop removes exactly the intended patch of the selected wall, with the correct winding and opposite material orientation, and that original cap/wall face senses give the outward boundary of the claimed region. Incidence/genus and shell.closed flags alone do not establish this.
3. Whole boundary embedding: D300/D301 covers the selected chart curve/side family. It does not prove global injectivity/disjointness of the retained wall, outer patch, all sides and original caps as a complete surface boundary. D304 all-coedge/endpoint tolerance bounds allow small residual gaps; tolerance binding is not exact geometric closedness or a homeomorphism theorem.
4. Reference-to-stored mass transfer: the source radial delta and twice-delta are currently excluded from mass error. A pointwise radial or D0 error is not automatically a volume, first-moment or inertia error. A later literal/stored mass claim needs a proved region correspondence or enclosing regions, signed moment bounds including negative Z, positive-volume control for centroid division, and propagation into every density-scaled central inertia scalar. Do not add native position tolerances to mass budgets without that derivation.

Therefore the first combined result can carry native-position binding and audited formal-reference mass side by side. It must retain sourceGlobalCertified, retainedFaceClosureCertified, orientationCertified, physicalBrepCertified, solidQualified, representedVolumeCertified/literalStoredBrepMass and partMassProvider false. Do not attach these properties to Part.mass or call them wrapped-solid mass. Native Math.hypot and optional surface-endpoint claims also remain unchanged.

## Required regression evidence before integration acceptance

- Run the standalone candidate's independent Bernstein/complex-polar oracle checks for all ten source/pad/total moments and all public scalars. Retain negative/asymmetric Z, translation, exact centered zero moments, diagonal angle branches, density/1000 and SI overflow/underflow cases.
- Use the actual D304 R10/H30 native pad in the integrated path. Require the same source coefficients/domains and actual side operands, equal formal bounds/properties to the standalone mathematical result for that derived rectangle, and one final full-request ledger. Clockwise/cyclic input should describe the same formal region after normalization.
- Keep the old assembly/native builder geometry, names, bounds and false flags unchanged. Compare actual full-field/Number-bit records for the same existing requests; do not add source-hash approval tests. The new combined final counter has its own explicit scope.
- Refuse unsupported holes, multiple components, diagonal edges, height!=R, caller radius/rectangle/certified overrides, getters and mutated source fields. Test failure atomicity and independent frozen output ownership. No external frozen or copied native/formal receipt may become continuation authority.
- Test aggregate budget exhaustion after successful native binding and during the mass phase. Demonstrate that final executed source cost is included exactly once, all GCD/direct work is present, and no phase resets limits. Preserve failures at tighter scalar budgets without loosening them.
- Keep actual stored-B-rep diagnostic mass separate from the formal oracle. Agreement in a fixture is useful regression evidence but is not the missing closed-reference or literal-mass theorem. Root will run the serial build/focused/full checks; none was run for this note.
