# Next complete-reference dependency

Status: SOURCE_INSPECTION_AND_MATHEMATICAL_DESIGN_ONLY. No arithmetic, model, helper, reference, auditor, World, compiler or browser was executed for this design. All ended candidates, original inputs, first failures and HOLDs remain unchanged.

The ended NodeSAT candidate passed numerical/transport checks but failed its fixed cost gate: parent397992000ns + entire child686846000ns =1084838000ns. It performed432 delegated SAT records, retained6 cold QPs and used445 RPCs. Its receipt does NOT isolate IPC as the failure cause or prove that another runtime would be faster. It proves the whole frozen envelope exceeded the gate. Source: `physics-p4-node-sat-2276/RESULTS.md`, CONTRACT.md and integer-sat.mjs.

The new integer position proof also passed G0/U0/A10/B6 numerical checks but ended at812273000ns. Its parent557970000ns contains compact465815000ns, bridge23282000ns and residual68873000ns; legacy admission1719000ns is nested in the residual. Entire Node lifetime is254303000ns. These are attribution fields, not disjoint new benchmarks to extrapolate into1200 steps. A mere combined native port or another SAT worker is not justified by these results.

## Distinct arithmetic change

Current SAT already compares signed margins by exact squared products (`integer-sat.mjs:102–108`). Reproposing exact winner comparisons is not new. The distinct change is the radical ENCLOSURE after all15 axes and both convention winners are computed.

For x=abs(N)/(D*sqrt(S)), D,S>0, and a permitted precision p, define C=N²*2^(2p), B=D²*S, t=floor(C/B), q=floor(sqrt(t)). Then

`q²*B <= C < (q+1)²*B`.

This proves q=floor(x*2^p). If equality holds at the lower bound, the minimal dyadic interval is[q,q]/2^p; otherwise it is[q,q+1]/2^p. Reflect endpoints for negative N. Validate D/S before the N=0 shortcut; handle t=0 without calling the existing positive-only sqrt. Verify the upper product even when lower equality holds, with every product prebounded independently.

This replaces sqrt(S*2^(2p)) followed by two denominator divisions with a quotient followed by sqrt of the physical-value-sized quotient. It does not divide axes by a GCD, cache supports, skip axes, seed words or change the Float64 scalar selector. At a fixed p, the result is the smallest enclosing interval on that grid and is therefore contained in the old valid grid interval. Monotone depth clamping and absolute interval difference cannot widen under that inclusion. Exact equality of raw/normalized margins remains the existing signed-square predicate.

There is no measured speed claim. C/B construction and the upper certificate can exceed the same bit bound; refusal is valid. The quotient itself may be expensive. The scalar and full15-axis support work remain. This theorem justifies a small pure radical prototype, not an immediate full-reference cost candidate or a1200-step forecast.

## Smallest safe vertical scope

Phase1 is a Python pure radical kernel using the SAME immutable `physics-p4-sat-2276/integer_sat.py` Meter,2M allowance,16384-bit bound,64 sqrt iterations and precision table64/128/256/512/1024/2048. It has no geometry, QP, World or Node RPC. An independent literal bank uses squared-bound search rather than the candidate quotient/isqrt formula as its sole oracle. Freeze zero/negative/exact/irrational/subgrid/RNE-midpoint/high-precision/input-error/product-overflow cases before any call.

Only after Phase1 PASS may a new compact backend replace the interval function in the unchanged Python SAT source namespace. All15 axes, exact-zero/near-parallel labels, first minimum/ties, raw and normalized models,432 scalar calls and2592 physical words remain. Use a NEW certificate protocol: minimal endpoints, chosen precision and derived maximum-width metadata are algorithm-specific and cannot be asserted byte-identical to old intervals. Freeze each exact metadata path; compare every remaining physical leaf/word, including full position u/lambda/KKT/selection/ties. Require independent interval membership, width<=1e-25, strict own RNE cell and the original represented1e-12 gates. A midpoint or unresolved signed-zero enclosure remains a refusal.

Keep the existing integer proof Node component hash-identical and only its six RPCs. Do not delegate SAT pairs or port the scalar closure. No existing worker/cost candidate is resumed. A new whole-position bank gets one complete numerical qualification and one conservative parent+whole-child lifetime cost decision against695832300ns, without baseline rerun or repeated timing.

After any new cost GO, original runtime integration still needs the authenticated historical World/provider closure, all32 strict force witnesses, normal/KKT,36 position rows, ledger, quality, transport/compression/output and the three fresh16-step prefixes before any original1200-step attempt. Medium's separate execution map owns that boundary. Current live World source drift cannot inherit historical prefix receipts. Overall P4 remains NO_GO.
