# #1179 World provenance audit

Read-only data audit at candidate HEAD `a341f2224ac4bd0b1167f4a9059ab32ab331aac2`. No model, World, reference, build, type or gate replay. Only this /tmp document is written. Root AGENTS.md is the only applicable AGENTS file found. Current ownership/serial Integration rules and preservation of prior evidence apply; no repository write is authorized by this audit.

## Completed terminal results

- SOURCE: terminal `HINGE2_WORLD_GO`, main1,200 native returns and1,200 independently qualified steps, firstFailure:null.
- SOURCE-repeat: terminal `HINGE2_WORLD_GO`, main1,200/1,200/1,200, firstFailure:null.
- Genuine compiled graph: terminal `HINGE2_WORLD_GO`, main1,200/1,200/1,200, firstFailure:null. Child1,243 replies, exit0, signal:null, stderr0, no pending/first/secondary failure.
- Final summary: complete:true, physicalGO:true, disposition `HINGE2_WORLD_GO`. Summary SHA `b30fed3d20770223493297d0e126ffb14214de597282787a8979db939a32bb48`.

Output: `/tmp/physics-1179-world-continuation-a341f222`.

## Source/emitted/build authority

| Authority | Data check |
|---|---|
| Current source-freeze |510 byte-size/SHA256 pins match; SHA `f25d064ebb082e556202491000f545f41726eef3c8e426a1452a66814e6d7954` |
| Actual emitted ledger |554 byte-size/SHA256 pins match; SHA `00d78b5e5cf8d60ae77efb69eb520e9578b436009cd5f3815f3a894a83e9cad7` |
| Actual original build/type head |`9f7d32c37b0cbd6505a7375708ac4181ebced8b0`, not the later consumer head |
| Original build freeze |`906a68f937b454f1c3f1a1ff5e91fc54b032e377527b2c8d5e94973b0945d986`, intentionally retained in the emitted ledger |
| Producer compatibility |All289 frozen TS paths in Physics/CAD/new World match their Git blobs at actual build head9f7d exactly |
| Original build evidence |All13 files under evidence/first-build-9f7d32c3 match immutable first-proof Git238c45b6 |

Original receipts report CAD build0/3.843180458s, Physics tsc0/3.874825625s, Physics index bundle0/.492494125s and private types0/1.370448250s. These are prior actual checks, not new executions at a341. All stdout and all stderr except the44B normal index-bundle stderr are empty. Index-bundle stderr SHA is `583a9e1a4f37140587536a0c5331f1276b8f22f6a13caa2620e0411eafd1e2e2`.

## Actual graph inputs

| Graph | Physics source/dist | Actual inputs | Validation |
|---|---:|---:|---|
| SOURCE |39/0|64|All current byte-size/SHA match audit; private World and adopted projection present |
| SOURCE-repeat |39/0|64|All match; same bundle SHA as SOURCE |
| Compiled dependencies |0/15|40|All match current pinned files; genuine Physics dist inputs, no Physics source inputs |

All graph audits name consumerHead a341f222. SOURCE/repeat bundle SHA is `8ed469d095be466bcfb566f01e4b5f3830daec66379a4113bd7feae92c912812`; compiled SHA is `fae777ee274569725ae18ba08b5da81983b081df7d1451d2d961f56416ee9419`. Different input/module counts and bundle hashes are expected across source versus compiled representation; no equal-module-count claim is made.

## SOURCE completed bytes and repeated parity

All10 SOURCE stream receipts match actual saved file size/SHA; EOF/noUnusedBytes true. Main records contain initial plus1,200 consecutive passed RETURN receipts with attempted/accepted cursor1..1200. Main raw is2,995,616B (416B initial plus6 global416B frames per step), SHA `d22e40616ede583bdd9526ce4e3d4f308658adfeea394e5b2845daa40d10d9f3`.

SOURCE-repeat's8 canonical stream receipts match SOURCE exactly. For reference stdin/stdout, the canonical source is the actual completed initial process segment followed by actual continuation segment; streaming concatenated hashes match repeat. Logical stdin131,766,270B; stdout118,876,677B. Other streams compare directly. No numerical/ref execution was used to reconstruct data. Repeat EOF/noUnusedBytes true.

The compiled terminal's8 canonical streams also match those SOURCE sizes/SHA exactly, with EOF/noUnusedBytes true. Source510 and emitted554 were checked again after all terminal results; no drift. HEAD remained a341f222 and the worktree was clean at the final data check.

SOURCE current child:1,242 completed replies, exit0, signal:null, stderr0, pending:null, first/secondary failure absent, stdin ended and stdout/stderr closed. The separate saved initial completion adds one real successful reply; it is not inflated into the current child's receipt. Repeat child:1,243 completed replies, exit0, signal:null, stderr0 and no pending/failure. Logical completed requests are native controls17 + protocol26 + main1200 per completed graph.

## Retained failures and continuation scope

- Original039f archive manifest SHA `8a1c5f7fd1b3e16fd311c456a87f5fcc9300fb447a515c75f2c76a1df721420f`; all13 artifact hashes/sizes match.
- Original first20 native control JSONL records30,590B and raw416B are exact prefixes of new SOURCE canonical files. No prior public/17 private rejection/copy tests were rerun on SOURCE.
- Original failure remains `GRAPH_NO_COMPLETE_PROOF` / `IPC_REPLY_SCHEMA_INVALID`; its child received one reply, then was SIGTERM-closed with exitCode:null. The original reply was REFERENCE_INPUT; this is reference execution/admission failure with World step/projection0, not a numerical World failure.
- Actual saved-I0 completion at04ffb17a: one reference request, exit0/.080301167s, native steps/projections0. stdin SHA `4f0a978500157b8ec7922f597a580d07f9dbdc3e485d7a941cc32c0672518f86`; stdout SHA `a61debde83d4b92a5946ad75f178daacc699813f3b7056a565548032cdc9c524`; stderr empty. Those exact bytes remain in SOURCE completed-initial streams.
- Original formatting failure exit2/modelCalls0 is also retained: three trailing EOF blank-line diagnostics and the stated whitespace-only repair.

## Counts are scoped

SOURCE controls: logical public1/private29, actual current public0/private12, historical public1/private18, recovery private1. Combined actual private30 versus logical29 is intentional. SOURCE control steps28/calculation observations19/accepted13; observer callbacks19; queries9; dispose2. Observed control calls angular76/free76/motor38/projection36/report36. Unknown observer attempts remain separate identity/retention controls, not accepted physical outputs.

Repeat and compiled controls: full actual/logical public1/private29 with the same28/19/13 step counts; no recovery. Each graph's main constructor1 is a separate fresh runtime instance after controls. Protocol requests26 per graph.

Final scoped totals: main3,600 steps,3,600 native commits and3,600 qualified steps. Controls84 step attempts,57 observed calculation attempts and39 accepted control steps. Current control private constructors12+29+29=70; historical18 plus main fresh3 gives91 actual private constructors. Logical control29×3 plus main3 gives90; the difference is one necessary W0 recovery instance. Public controls are2 current plus1 historical. Current child replies1,242+1,243+1,243=3,728; saved successful I0 adds1 to3,729 actual completed-flow replies, including the intentionally negative protocol controls. Original failed I0 adds one distinct historical attempt, giving3,730 actual reference attempts across all scopes. Do not inflate the current children with either prior process.

## Final launch and archive

Actual launch receipt `/tmp/physics-1179-world-continuation-launch-a341f222/consumer.receipt.json` names Node22.22.0, consumerHead a341f222, the exact f25d source freeze and00d78 emitted ledger above. Exit0/503.0324376669887s. Actual stdout98B SHA `0a01f11f539802880545b2a2bd1a0107e5fbcbb3e0e01d5540ba3516169dd867`; stderr0B/empty SHA. The stdout reports terminal all-graph GO; its internal502.98310725s and the launch wall time are distinct clocks.

Root terminal archive manifest `/tmp/physics-1179-world-terminal-archive-a341f222/manifest.json`, SHA `60e389dbce2640f7f28378927f54cd6d2d8af203bcf374d54177a957b91d2191`: all43 archive files' stored size/SHA and streamed decoded size/SHA match. Decoded/source total490,540,001B; archive payload20,698,816B. Archive size is separate from runtime budgets. No mismatches and no model/reference replay were used for this verification.

## Audit conclusion

No source/emitted/import/build-evidence/hash/prefix/parity/archive mismatch found. All three terminal narrow HINGE2 World GO receipts are complete. This audit verifies provenance and retained data, does not independently recompute numerical model certificates, and does not claim general joint/contact support, native adoption, publication or screen acceptance.
