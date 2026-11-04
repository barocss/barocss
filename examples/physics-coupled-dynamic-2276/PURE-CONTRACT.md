# Pure coupled kernel protocol 01

Status: AUTHORED_NOT_EXECUTED. This contract covers pure arithmetic only. World calls are zero. No production, staged runtime, cache, geometry solver, physics API or prior evidence is changed. The original cone failure and static-only limits remain.

Root first freezes every owned harness file, both candidate sources, the three original trace packets/models/options, the qualified decoder, independent reference source/bank/root freeze/result, independent audit source and all actual compiler/tool inputs. AUTHOR-FREEZE-01.json is a fresh, hash-only author seal. It must include the audit before any extraction, build or candidate call. The independent reference must already be REFERENCE_READY. Inputs remain frozen after a failure.

## Data bank

`node input-bank.mjs bank-01` invokes the unchanged qualified trace decoder in a fresh Python process. It authenticates all author pins before import and creates no World. It reads `before-step-trace.json`, `at-step-trace.json` and `after-refused-trace.json` from the qualified coupled-contact Source01 campaign. It selects the single actual coupled-plan.input, the first actual step HIT query.result.normal (also equal to the plan's actual geometry normal), and actual model dynamic materials. It copies no result, static certificate, reference K/J, root or selected parameter. Actual admitted quaternion words are retained rather than reconstructed from model q. All numbers use lossless little-endian binary64 wrappers, including -0. Independent expectations remain in a separate file never passed to the kernel.

## Two-module build

`node build-pure.mjs build-01` copies the exact candidate and static helper into a fresh stage with the original sibling-directory relative import unchanged. The original static helper must remain SHA256 5ee4eb75ec8baa1036a7a60977ab1d6c39b37e1d96cbe1cc2ea7c67140781db2. The new entry exports only coupledContactTarget/coupledStaticTarget and types. It imports no World. A distinct math-manifest digest binds both sources and entry.

Use only the existing pinned native esbuild binary and TypeScript5.9.3 from coupled-contact TOOLCHAIN-PINS-02. JavaScript esbuild launchers are observed data, not invoked. Strict NodeNext emission has declarations, strict true, skipLibCheck false and noEmitOnError true. A separate strict NodeNext consumer imports emitted declarations. Actual compiler listed inputs must match frozen pins. An AST walk of actual emitted JS proves the entry closure consists only of the entry and two arithmetic modules, with no external or dynamic import. The Source metafile must identify exactly those three TS inputs. Full final stage/emitted/source pins are written after all outputs exist. No arithmetic module is imported during build.

## Finite qualification and first-failure rule

Commands:

```
node examples/physics-coupled-dynamic-2276/input-bank.mjs bank-01
node examples/physics-coupled-dynamic-2276/build-pure.mjs build-01
node examples/physics-coupled-dynamic-2276/run-pure.mjs bank-01 build-01 source-01 source
node examples/physics-coupled-dynamic-2276/run-pure.mjs bank-01 build-01 native-01 native
python3 -B examples/physics-coupled-dynamic-2276/pure-parity.py source-01 native-01 parity-01
```

Root wraps each command in the existing180s guard and stops before the next command after any unexpected failure. Every output directory is fresh. No author executes these commands. Each graph uses a fresh process and imports one authenticated graph only. Before/at require STATIC_TARGET and after requires DYNAMIC_TARGET. UNRESOLVED on these physical inputs is a preserved NO_GO, not an expected pass.

Each original result is saved losslessly before comparisons. Before/at also call the unchanged static helper on the same actual input. Compare original status/J/N/T and the COMPLETE static certificate by raw words; only new top-level dynamic-admission/cumulative counters are excluded from this equality. The two actual static returns are saved separately. No omitted certificate field or diagnostic normalization is allowed.

The independent audit CLI is `audit-pure.py packetPath referencePath outputPath`, with success status `EXECUTED_PASS_PURE_COUPLED_PHYSICAL_INPUT`. Packet numeric fields are recursive `{"$f64le":"16 lowercase hex digits"}` wrappers; packet keys are id/input/actual. Actual static-control returns are separate packets. The audit must independently verify actual admitted geometry, physical K, branch, dynamic full-system root intersection, 80/120 reference RNE J/N/T words and all unchanged physical residual/tangent/native-plane gates. Candidate certificates are evidence to verify, not oracle seeds. Candidate data never enters the independent reference generator. Save full process outputs and stop on the first audit failure.

Eight fixed refusal controls, in order, use the before input:

| ID | Frozen mutation | Expected reason (UNRESOLVED) |
| --- | --- | --- |
| point | nativePointExact[0]=-249999999999999999/1000000000000000000 | NATIVE_POINT_PRESENTATION_NOT_EXACT |
| frame | q=[0,0,0,0] | ZERO_QUATERNION |
| mass | massKg=2 | OUTSIDE_STATIC_UNIT_CUBE_PROFILE |
| spin | freeAngularVelocityRadps=[1,0,0] | OUTSIDE_STATIC_UNIT_CUBE_PROFILE |
| shape | halfExtentsM[0]=0.75 | OUTSIDE_STATIC_UNIT_CUBE_PROFILE |
| dynamic-material | muDynamicA=0.5 | OUTSIDE_DYNAMIC_MATERIAL_PROFILE |
| reported-normal-shape | reportedNormal=[0,1] | DYNAMIC_REPORTED_NORMAL_SHAPE |
| reported-normal-mismatch | reportedNormal=[0,1,0] | DYNAMIC_REPORTED_NORMAL_CORRESPONDENCE |

These reasons follow the frozen source contract. They are admission checks, not dynamic physical results. No negative input or expected reason changes after a failure.

Per graph there are11 coupled calls (3 originals +8 controls),2 direct static checks,13 top-level calls and13 underlying static helper invocations (one within each coupled call plus the two direct checks). Counters advance before the actual call, including failed calls. Hard top-level cap16. No World, physical step, runtime apply or iteration count is inferred from these calls.

Static and dynamic meters remain separate: each rational cap4096, gcd262144, integer bits16384; dynamic integer primitives262144, splits256 and dyadic exponent128. Report and check actual per-call counters, plus cumulative rational/gcd sums where supplied. Static integer operations were not metered; no combined integer-work claim is fabricated. Preserve denied attempted-work counts and all UNRESOLVED results without raising precision/work limits.

Each command has180s and16MiB evidence bounds. Runner reserves65536bytes for terminal output and writes full actual packets/process results. Parity compares all11 coupled packets, both direct static-control packets and bank bytes exactly, without graph/provider/number normalization. Audit process paths and wall times are not physics packets.

Degree reduction, repeated/endpoint/exact-dyadic/multiple/negative-H root banks, RNE ordinary/binade/subnormal/signed-zero arithmetic banks and work-exhaustion controls remain NOT_RUN: the current kernel has no such test exports. Even if all three physical inputs pass, runtime World promotion remains BLOCKED by those missing controls and actual host validation. Warm, wire, rollback, public adoption, browser, performance and general dynamic contact remain unqualified.
