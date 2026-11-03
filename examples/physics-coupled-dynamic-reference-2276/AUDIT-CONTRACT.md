# Pure packet audit 01

Status: AUTHOR_ONLY_NOT_EXECUTED. This file and `audit-pure.py` are new. The executed reference, its input bank, contract, derivation, freeze, results and archive remain unchanged.

## Interface and boundary

Root calls `python3 -B audit-pure.py packetPath referencePath outputPath` immediately after each original pure helper call and, for before/at, its same-input direct static control. Each packet is `{id,input,actual,staticControl?}`. All input/result numbers use the recursive lossless `{$f64le:16hex}` form. Without an embedded control, the audit reads the sibling `<id>-static-control.json`. It also reads sibling `bank.json` for trace provenance. Output uses exclusive creation. The only success status is `EXECUTED_PASS_PURE_COUPLED_PHYSICAL_INPUT`; it describes that one original input only.

An original after `UNRESOLVED` is the first physical NO_GO. It is never a positive result. The medium runner owns the eight frozen admission refusal checks and the final 13-call census. This audit does not require later calls before auditing an earlier input. General degree/repeated/multiple/endpoint/dyadic root, RNE boundary and exhaustion controls remain NOT_RUN. Runtime World promotion remains blocked after a pure pass.

## Independent authority

The gold reference is the already executed file with SHA256 `0f710491f0063fd0b0e988ea915cd6342c5e013e695057d503a27a7d7ba7c943`. It predates candidate calls. The audit never calls its generator, a candidate, a World, a compiler or a geometry solver. Gold's full 80/120 directed 3x3 Gaussian coverage is physical-root authority. Candidate polynomial and Sturm data are statements to verify, not reference inputs.

The audit authenticates each original trace with fixed SHA256, expands and checks its lossless DAG, and binds actual packet input to its unique prewarm plan plus first step HIT normal and original model material words. It checks the plan precedes every actual application and that native point, body COM/pose/free velocity/spin, finite FACE metadata and exact endpoint correspondence come from that query. It derives native axes by normalized Hamilton quaternion products, and physical K by Cartesian unit impulses and COM spin. It then checks those derivations against frozen gold metadata. No hardcoded K or impulse enters the calculation.

Before/at must preserve raw status/J/N/T and the entire original static certificate from the separately saved direct helper call. New admission/cumulative meters are checked separately. Exact Gaussian elimination independently checks the static certificate and branch. After must match gold 80/120 certified RNE world J, cache N and world T words. Candidate ideal root and impulse enclosures must intersect both gold precision proofs.

## Algebra and physical checks

For candidate certificate validation only, the audit forms the full physical 3x3 L(s) and b(s). Leibniz determinant expansion and full Cramer column replacements produce three numerator polynomials. The primitive polynomial from `numT1^2+numT2^2-qD*numN^2` must equal the candidate polynomial, with positive normalization. This differs from the candidate's 2x2 Schur/adjugate construction. The audit checks every Sturm recurrence as a positive primitive multiple of the negative exact remainder. It checks derivative, decreasing degrees, constant nonzero last member, endpoint signs, exact side variations, every reported interval's count, disjointness, complete interior root population and positive/negative Cramer normal numerator disposition. This is a certificate check, not a second physical root search. Exactly one positive-normal interval must intersect gold's unique physical root.

The represented impulse is independently applied through Cartesian momentum and COM spin. Final velocity, zero native normal speed, dynamic slip, cone magnitude, each opposition component, native/public cache planes, cache/J binding, COM and origin moment, and midpoint impulse work retain the original 1e-10 m/s and 1e-12 Ns gates. Candidate residual bounds must contain independently evaluated residual enclosures; counts are checked but do not prove unobserved internal work. Gold and candidate ideal enclosures and RNE cells are checked independently of represented residuals.

## Frozen audit limits

The audit has 180 seconds, 16 MiB total read bytes, 16 MiB expanded canonical DAG bytes, 16 MiB output, 8192 shared DAG nodes, reference depth 64, 1,000,000 canonical JSON fragments, 262144 checked rational operations, degree at most 4 for the final root polynomial (temporary determinant products at most 6), 5 Sturm members, 4 roots and 16384-bit exact integer/rational components and proposed products. The code checks variable product bounds before multiplication and proposed shifts before shifting. Adding two bounded products may use one temporary bit; an oversized sum is refused before Fraction construction. Square roots use one fixed dyadic denominator 2^128 and exact squared endpoint checks. No precision, budget, input, expected reason or frozen source changes after a failure.

The author can perform AST and byte-hash checks only. Root executes the audit after its actual candidate call. Each failure writes a typed bounded report and preserves first failure. No pass here changes old HOLD states, first failures, browser/static receipts, public support, whole P03 dynamic status or deployment state.
