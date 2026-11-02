# Warm tangent transport contract 01

This private Source experiment changes only the tangent cache at `warmStartPoint`, before its actual impulse application. The original producer, real-warm-run-01 inputs, source, outputs, and first failure remain immutable. That run accepted two steps and reached a real same-feature, same-point, nonzero-tangent, changed-normal warm branch. Its first failure was `currentTangentPlane = 9.141407414550243e-5 Ns`, above the unchanged `1e-12 Ns` gate. Reaching this branch was not a physical PASS.

## Frozen algorithm

For the actual current represented normal `n` and raw stored prior tangent `T`, set `Tnew = cross(n,cross(T,n))/dot(n,n)`. Assign `impulse.tangentNs = Tnew` before warm application. Then apply the actual `normalNs*n + Tnew` once, through the existing producer application path. The normal cache is unchanged. A zero or nonfinite normal, nonfinite tangent, overflow, or nonfinite result produces `WarmTransportError` with code `WARM_TRANSPORT_UNRESOLVED`; there is no fallback. The staged build must have a distinct identity.

This is orthogonal projection, not length-preserving parallel transport. In exact arithmetic it removes the current-normal component, is invariant under nonzero normal scaling or reversal, cannot increase tangent magnitude, and is idempotent. These facts do not prove passivity of a whole rigid-body step. The original independent work, momentum, spin, native geometry, wrench, transaction, and resource gates must still pass.

The helper has constant work: two three-component crosses, one three-term squared norm, one reciprocal, three scale products, and fixed finite checks. There is no iteration, neighbor search, tolerance change, cache reset, force clamp, source detector fallback, or body cap change. The existing 8 inner iterations and 8 outer passes remain unchanged. This contract does not repair within-pass normal changes, cache identity, or all Coulomb branches.

## Independent reference and trace semantics amendment

`reference.py` generates a fixed finite bank using exact rational Gram projection `T - n*dot(T,n)/dot(n,n)`. It does not import the helper, copy its nested-cross expression, or execute the engine. Cases include changed normal, nonunit normal, zero tangent, already tangent, reversed normal, scaled normal, oblique tangent, and zero-normal refusal. Each successful case records exact projected components, exact zero normal component, and nonincrease of squared magnitude. The helper presentation is compared with these results at `1e-12 Ns`; no tolerance is widened.

`phasePoint` must capture the raw `cacheBefore` and real producing frame before transport. `cacheAfter` on the actual warm application is the transported cache. The independent observer must compute Gram from raw `cacheBefore.tangentNs` and actual current event normal. It must check every `cacheAfter.tangentNs` component against Gram at `1e-12 Ns`, its current-normal dot product at `1e-12 Ns`, and unchanged normalNs. It must check actual J against `normalNs*n + Gram` using the unchanged application-vector gate. The former warm-applied-vector equation based on raw prior T is explicitly replaced; the former requirement that raw prior T already lie in the current plane is replaced by projected-T plane and Gram checks. Raw prior T must remain in evidence. No other observer equation or tolerance changes.

Actual warm coverage still requires real prior-step provenance, a nonzero raw tangent cache, a changed normal, and matching native feature/active-halfspace correspondence. It must not be inferred from a manufactured cache or changed point ID. Independent impulse, COM spin, midpoint work, origin moment, step wrench, accepted native geometry, and rollback checks continue to use actual application events. The observer trace must not become producer wrench authority.

## Bounded qualification

First freeze all new files and the unchanged original input/provider dependencies. Build a distinct staged Source provider with the qualified producer transform followed by `warmTransportTransform`. Expose the helper only through the private test entry. Execute the independently generated finite helper bank before the unchanged real warm-frame case. The physics case reuses the frozen input words and retains one fresh World, at most three attempts, fail-first stopping, and existing resource limits. Stop on the first real physical failure; preserve it before any new proposal.

The author performs no numerical, build, candidate, or World execution. Root executes only after review and freeze. No production source, canonical API, recording decoder, Native, public root, desktop, performance, or promotion qualification follows from a private Source PASS. Promotion remains blocked pending all required paths and a performance gate.
