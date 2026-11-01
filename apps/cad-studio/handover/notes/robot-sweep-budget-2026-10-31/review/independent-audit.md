# D367 independent audit (claude-opus-5-5 sub-agent, 2026-10-31)

The audit was read-only, on 5179126c1 plus the #2229 diff. Probes and the before/after comparison harness are in [../audit](../audit); `cmp/` holds `cmp.mjs`, `run.sh`, `diff.py`, the before/after logs and the mutants.

**Verdict: CHANGES_REQUIRED (small).** The core fix is correct and true contacts are unchanged.

## Holds

- **Repro.** The repro cases A–D on the fixed code: no false contact or TOI remains. The graze and small-budget cases give `exhausted` at the s where the false contact was reported. With a budget of 1e7 the min values are bit-identical. The real collision is identical: s 0.0390231616736922, toi 0.17668778270387953, post–b, 80 samples.
- **Broad comparison.** `sweepPath` and `sweepTimed` were instrumented, and 20 test files were run on HEAD sources and on the fix. The 19 existing files made 1165 calls with 0 differences: 107 contacts and 1060 clears.
- **Contact at the first sample** still reads as contact (`toi` 0), not exhausted.
- **Step-branch argument.** It holds: d ≤ tol + 1e-12·rate. A constant-gap spin at tol 1e-9 can still read as contact at up to about 7× tol over 160 turns. This is low severity, pre-existing and nanometre scale.
- **No consumer treats exhausted as clear.** The facade `path.check()` and `robotCore.sweepOf` pass it through.

## Findings and root disposition

- **maxSamples policy (medium): fixed.**
  - Before: 0 meant different things in `sweepPath` and the wrappers, non-integers ran ceil samples, and NaN, Infinity or 1e300 removed the cap (a 3 µm graze did not finish in 25 s).
  - Now: a whole number from 1 to 10,000,000 is required at every entry point; anything else is refused.
- **Test gap (medium/low): fixed.**
  - A mutant replacing the exhausted `check_path` summary survived. An end-to-end `dispatchTool` test now kills it.
  - The two-segment test now asserts `segment === 1`.
- **Low items.**
  - The `path.check()` docs and diagram now mention `exhausted`: fixed.
  - The RM6 margin value 0 is now the least clearance met: fixed.
  - The crossing-cap `break` now returns exhausted: fixed, but no test reaches it.
  - The step-branch relative threshold: not changed.
  - A persistent Studio marker: not added; the toast only.
- **Mutants.** 15/16 killed; the survivor is now killed by the new test.
