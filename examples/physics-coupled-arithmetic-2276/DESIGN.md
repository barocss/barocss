# Shared arithmetic extraction design 01

Status: AUTHOR_DESIGN_ONLY_NOT_EXECUTED. The ancestor is efficient candidate24294355dc1743f8d08e747ee99da85b3ce44ae40afe1ba83b4a69d8270988f3. Root reports actual pure Source/Native PASS on the original three inputs and eight negatives, with full14-packet parity. The after target used241975 integer primitives,23153 gcd remainders,771 rational constructions,1297 peak bits and66 subdivisions/exponent. These are ancestor results; this extraction has no runtime result. The truncated older failure's20194 gcd count is not a completed-work comparator.

## Module map and API

- `limits.ts`: frozen unchanged production constants. No environment, mutable global mode or input override.
- `types.ts`: the unchanged public candidate input/result/certificate types and internal exact arithmetic types.
- `math-core.ts`: one per-call arithmetic context. Move the existing meter wrappers, rational/interval operations, primitive signed pseudo-PRS, immutable-chain/Point variation memo, all-root isolation/admissibility, sqrt and RNE helpers here. No static helper, physical fixture, reference, World or test import. Context construction does no exact arithmetic. Explicit initialize performs the original q0 then q1 in the original order. Shared functions and wrappers retain their source operations/prices; copies of counts are read-only observations.
- `production-context.ts`: parameterless constructor passing only frozen production limits to the core. No lower-limit validation or test import.
- `candidate.ts`: static-helper invocation followed by the original physical/native composition. Only mechanical context calls and the extracted root-population call change. No extra mathematical operation or result field. Static J/N/T/certificate and every counter must match the ancestor raw.
- `production-entry.ts`: runtime exports only coupledContactTarget and the unchanged static helper. It must not reach test-entry.ts or test-context.ts. Strict emitted/source actual-entry audits must prove that closure.
- `test-context.ts`: accepts only explicitly lower nonnegative integer resource limits, rejects unknown keys, negatives, nonintegers and any raised bound BEFORE creating a context. initialExponent remains64 and is not configurable. No production import reaches this module.
- `test-entry.ts`: private `runArithmeticTest` data dispatcher. It creates one context per call and invokes the same actual core operations used by production. It never creates a World, supplies a candidate K/J or changes a production limit. Its input variants cover polynomial/H classification, polynomial multiplication, RNE intervals, and actual resource operations. It returns exact results, word-preserving number values, actual counts and typed refusal reasons. A rejected test-limit request reports NO_CONTEXT, not an arithmetic guard PASS.

The core factory takes an internal immutable limits dependency so production and tests share the implementation. The lower-limit request/validation path exists only in test-context.ts. No World or CoupledInput field can select it, and the production entry re-exports no core/context/test factory. An explicit import of private filesystem modules is outside the public-entry claim; no public production API adoption is proposed.

## Extraction invariants

Keep the frozen static-helper source and emitted bytes. Preserve exact arithmetic operation order, all wrapper prices/default caps,64/8 refinement policy, per-call shared memo and258-entry cap, complete root population, positive PRS sign normalization, status/reason strings, admission and output field order. Retain static and dynamic counters exactly. The extracted root classifier is the existing sturm→isolate→H-loop in the same order; it is called by production and the literal polynomial test entry. The physical closing/SPD/static-priority and negative/positive endpoint-existence guards remain production composition checks; generic polynomial tests do not pretend to satisfy that physical profile.

The production factory has no requested-limit argument. Test limits may lower bits/rationals/integerOps/gcdSteps/subdivisions/exponent only. Hard degree4/chain5 and initialExponent64 remain fixed. Test code must use real operations and catch real core refusals, with attempted counters retained. It must not pre-return a desired guard reason or change global state. A resource test may intentionally fail initialize, which is a genuine core operation, rather than pass an already-invalid physical input.

## Qualification order and bounds

Freeze this design and the complete proposal in CASE-PROPOSAL.md before any numerical call. A separate reference author owns literal expansion and independent factor/RNE gold and must not read the candidate implementation. Source-text extraction by this author is not a numerical qualification.

First strict-build the separate production and test entries with actual closed-graph audits. Before broad arithmetic claims, rerun the unchanged original3physical+8negative+2directstatic pure protocol in its OWN fresh process, with the original13 actual calls and cap16. Compare every returned field and ALL counters to the completed efficient cohort raw. New provider identity is external harness metadata only; no numeric normalization is allowed.

The private arithmetic protocol is SEPARATE, with its own fresh test-entry process and cap64 calls. The independent reference author expanded the33-row proposal to52 fixed rows, including both an unknown-key refusal and the mandatory raised-limit refusal integerOps262145. Its independently frozen bank/gold is the execution authority. Keep denied configuration admission distinct from actual core exhaustion. Do not combine13+52 into a purported64-call campaign: those are separate censuses and must be reported separately. Keep180s and16MiB evidence limits for each bounded protocol. Source/strict Native and full word/packet parity remain separate actual stages.

Any raw production drift blocks the extraction, even if it passes physical tolerances. Any new guard, cap, RNE, root-population, test-entry isolation or independent-gold failure is preserved first. No dynamic World, public adoption, warm/multipoint/continuous contact, browser, performance or whole-engine PASS follows from a shared-core extraction.
