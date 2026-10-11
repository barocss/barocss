# #1179 first I0 reference refusal — source-only cause and repair

First actual flow039f4852 exited1 after1.059732s. Only initial request I0 was evaluated: World steps0, native projections0. Passed public constructor/private constructor/options prefix remains original evidence; no replay. Original build/types0, source507/emits554 and all first failure logs are Root preserved. This is EXECUTION_FAILURE, not physical World NO-GO or initial qualification.

Saved exact input `/tmp/physics-1179-world-first-039f4852/source-proof/reference.stdin.raw`:3536B, SHA256 `4f0a978500157b8ec7922f597a580d07f9dbdc3e485d7a941cc32c0672518f86`. Saved stdout219B, SHA256 `e39a49a9f2172e92d810108a48e426091fc0bb89cf48243761620a8ca5c51d52`, exact outer REFERENCE_INPUT. Stderr0. These files were read and hashed only; no request/reference/model/import/evaluation was executed during this triage.

## Exact rejection chain

1. Owned World `reference.py:24` calls `admit(value)` BEFORE the80/120 derivation contexts. No precision context covers this initial admission.
2. Owned `world_schema.py:182` invokes unchanged independent `M.source_input(pair)` for first local pair. Saved I0 has literal negative A0 x=-.1, positive B0 x=.1, original metadata/cursor0 and raw finite body words.
3. Adopted M `physics-rigid-hinge-motor-reference/reference.py:198–210` admits carrier, then calls unchanged `PARENT.OLD.decode`.
4. Adopted D `physics-rigid-hinge-limit-diagnostic/reference.py:19` defines `RADIUS=Decimal.from_float(.1)` exactly. D number/vector at35–48 independently use exact Decimal.from_float for the saved negative x.
5. D:133–134 compares exact config position against `(-RADIUS if index==0 else RADIUS, ZERO, original_z)`. Decimal unary negation obeys the current precision; under default28 it rounds the exact positive binary64 radius before making the negative operand. Decimal.from_float(-.1) retains its full exact binary value. They differ, so this FIRST negative-position guard refuses original pairA0. Negative-anchor comparison later has the same context dependency but is not the first guard.

This conclusion is source-backed, not a newly executed diagnostic. Parent files have no global getcontext/DefaultContext precision changes; source search finds only localcontext precision assignments. The original qualified detached M `predict:288–291` invokes its same source_input INSIDE the selected80/120 context. The new World admission callsite omitted that inherited precondition. No fixture/raw/count/body constraint is responsible for this refusal.

## Root authorized minimal repair

Root accepted this cause and authorized one owned callsite repair: import decimal.localcontext and wrap ONLY M.source_input(pair) in localcontext precision120. Scope exits immediately after it returns. Every parent file, exact RADIUS/config/anchor comparison, law, source data, binary float operation, cap, gate, derivation80/120 and protocol error tuple remains unchanged. Do not round/change external -.1, replace the parent radius, relax equality or change global Decimal context.

Applied source diff:

```diff
 import copy
+from decimal import localcontext
@@
-        cfg, carrier, internal, memory, origin, limits = M.source_input(pair)
+        # Inherited exact binary-radius admission uses its parent's precision context.
+        with localcontext() as context:
+            context.prec = 120
+            cfg, carrier, internal, memory, origin, limits = M.source_input(pair)
```

Only world_schema.py and this triage document were written. No Python compilation/import/evaluation/test/native/World/control/build/type/Git or remote run. Root publishes before-repair contract and fresh complete source freeze/syntax gate before authorizing the ONE saved failed I0 re-evaluation. Passed constructors, World stages and parent14/93 are not replayed. No claim that repaired I0 passes exists yet. STOP EDIT.
