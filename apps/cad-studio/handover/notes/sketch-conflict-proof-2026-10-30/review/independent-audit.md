# D350 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

The audit read and ran the implementation worktree only. Probes and mutants are in [../audit](../audit). Raw outputs were not saved; the numbers below are the auditor's reported observations.

**Verdict: CHANGES_REQUIRED, for the docs and tests only. The code is sound: no false proof was found.**

## Soundness (against the kernel source)

Kernel acceptance requires every residual to be at most 1e-7. The worst case for each modelled equation:

- anchor, fix, H and V: 1e-7;
- a length on an H/V edge: 1e-7 plus hypot − |Δ| ≤ dy²/0.001 (about 1e-11);
- a dx/dy distance, through two helper ties and a measure segment: about 3e-7, which is below s = 4e-7.

The largest measured deviation of a kernel-accepted solution from a model target was 0.696·s. Rules the kernel skips are also skipped by the model. Inputs the kernel ignores but the class gate rejects lead to `outside-class`, which is conservative. The D284 snap runs only on success. The dyadic conversion handles subnormals, −0 and the largest finite values. Bellman–Ford starts from a zero-initialised virtual source and makes enough passes. The budget never yields a proof.

## Probes

- [p1-oracle.ts](../audit/p1-oracle.ts): an independent rational Floyd–Warshall that tries every sign. 18,000 random cases, 0 verdict mismatches.
- [p2-kernel.ts](../audit/p2-kernel.ts): random rectilinear constructions with one dimension perturbed, against the kernel via `solveOutline` from 4 seeds. 3,600 cases, 0 false proofs. Seed 7 gave 82 proven (all kernel-fail), 37 feasible with kernel-fail (honest nonconvergence) and 481 feasible with kernel-ok.
- [p3-edges.ts](../audit/p3-edges.ts): extremes and odd inputs. Malformed keys reach kernel admission errors before NONCONVERGENCE.
- [p4-perf.ts](../audit/p4-perf.ts): odd-parity closures. Proven at n=22 in 110 ms; `budget` at n=42 and n=62 after 312 and 602 ms, on top of the kernel's 599 and 1637 ms.
- [p5-boundary.ts](../audit/p5-boundary.ts): the exact one-ulp dx-chain boundary. The largest double ≤ B is feasible; the next is proven.
- Mutants ([mut](../audit/mut)):
  - Caught by the original tests: m1 (too few Bellman–Ford passes: 93 false proofs in p2), m3 (s = 2.5e-7), m4 (budget treated as proof) and m6 (one sign only: 97 false proofs).
  - Survived: m2 (no anchor), m5 (no clamp; unreachable) and m7 (float32 inputs: 2/300 false proofs in p2, and p5 wrong).

## Findings and root disposition

1. **Medium, docs overclaim.** `sketches.md` said every rectilinear contradiction is a proven Conflict. Three counterexamples ([p6-docs.ts](../audit/p6-docs.ts)): a contradiction inside the relaxation band (60 vs 60+6e-7); any unrelated rule present (`equal`, `perpendicular`); and an exhausted budget. **Fixed:** the docs now state the class, the band and the budget.
2. **Medium, the exactness test did not test exactness** (m7 survived). **Fixed:** a one-ulp boundary test.
3. **Low, test names stronger than their asserts; no anchor-only test** (m2 survived). **Fixed:** the test is renamed and an anchor-only test is added.
4. **Low, direct callers.** Loose key parsing ("-0", "0x2", "2e0") and a throw on a fractional `fix` point. These are unreachable through `solveOutline`. **Fixed:** they now return `outside-class`. Pre-existing and unchanged: `solveOutline` throws for a `dx` rule with `a = 0.5` (in `ruleTerms`).
5. **Low, latency.** A worst-case budget run adds about 0.6 s to a failing edit at n=62, synchronously. Retained as a limit.
6. **Nits.** `conflict?: true` does not pass through `checkEdit` (only the reason prefix reaches the UI), so it is retained. The over-long docs line is now wrapped.
