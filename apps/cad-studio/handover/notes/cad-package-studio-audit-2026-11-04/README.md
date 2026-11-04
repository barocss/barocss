---
work_id: D519
artifact_type: source-audit
status: investigated-runtime-not-run
last_updated: 2026-11-04
---

# D519 — Audit CAD packages and the Studio product boundary

The owner requested a full CAD package/roadmap audit after the Physics handoff investigation, then explicitly added cad-studio. This record captures that completed read-only investigation before D520 changes planning documents. It adopts no source candidate and delivers no defect correction. [Current roadmap](../../roadmap.md).

## Evidence boundary

Baseline: `ccce78c671c8a5c09718c1cf6005a90027b75adc`, clean `local/cad-dev` matching its fetched remote. Fourteen package manifests were screened. Seven direct CAD libraries were inventoried: CAD, Model, Interop, GPU, Viewer, CAD React and Physics. Public entry points, dependencies, main consumer/ownership paths, test selectors and all34 roadmap scope rows were reviewed. This is not an examination or certification of every function body.

CAD/Model/Physics numerical and contract review used GPT-6.1 Sol High. Platform, React and Studio engine/viewport/storage reviews used GPT-6.1 Sol Medium. Root checked source references, actual consumers and roadmap inconsistencies. No files, tests, builds, browsers or native solvers were created/run during that read-only investigation. This later documentation record does not change that execution boundary.

Studio inventory:286 source files,355 files in its test tree,125 default top-level `*.test.ts` files and84 separately named `*-browser.mjs` drivers. These are inventory counts, not test passes. The source census for CAD/Model/Physics contains366/373/128 files; Model's373 include369TS and4JSON. The supported ownership split remains usable: geometry in CAD, documents/features in Model, display in GPU/Viewer, an injected ordinary React bridge, and bounded renderer-neutral Physics. Studio consumes its own GPU renderer; it does not use the public Viewer facade for that viewport.

## Ranked findings and qualification

All new runtime reproduction below is **NOT_RUN**. Evidence means directly read source; consequence means source-supported inference unless explicitly stated otherwise. No P1 or newly reproduced numerical failure is established by this audit.

| Priority | Evidence / finding | Consequence and limit | Current queue |
| --- | --- | --- | --- |
| First | [keepLog](../../../src/storage/useProject.ts) lines104–108 updates shared log/tag after awaiting a write without session/path guards; switch/merge return their old Doc at223/244. [VersionsPanel](../../../src/storage/VersionsPanel.tsx) lines61–64/118 then calls onOpen. | A delayed A branch/merge completion after B opens can overwrite B's current log/tag and dispatch A. Actual sequence NOT_RUN. Existing Open/Save guards do not cover this version-write completion. | P0-R01 |
| Next | Project autosave catches all failures at useProject188; [App](../../../src/App.tsx)475–491 selects it instead of the recovery-copy path. | Failed autosave has no failure notice or new fallback copy. Dirty/exit warning remains; this is not a claim that the UI marks it saved. | P0-R02 |
| Next | [3MF action](../../../src/files/useModelExports.ts)137–150 checks root fresh, filters absent instance entries and uses retained instance bodies without the STEP instancesFresh guard. | Pending/failed/stale placed geometry can be omitted or exported old. Actual assembly output NOT_RUN. | P0-R03 |
| P2 | [GPU signature](../../../src/viewport/gpuRenderer.ts)103–107 omits index values, normals and edge coordinates;238–254 reuses buffers on equality. Actual body keys are stable feature IDs, not revisions. | Accepted inputs differing only in omitted buffers retain stale geometry. A reachable native Studio collision and visible impact remain UNKNOWN. | P0-R04 |
| P2, known | GPU create188–197 connects render requests but no recovery/error host callback; Viewport fallback581–594 is initial creation only. | Existing D517 recovery-host gap remains. Its TMP candidate is unadopted, with notice ownership/startup review gaps; no fix follows from this audit. | P0-R05 |
| P2 | [Model mass facade](../../../../../packages/barocss-cad-model/src/api/core.ts)26–29 has no positive/finite density guard; [CAD facade](../../../../../packages/barocss-cad/src/api/core.ts)39–40 rejects it. | Zero/negative/NaN/infinite density reaches Model mass arithmetic. Valid-density historical BOM results are not invalidated. | P0-R06 |
| P2 | [Memo](../../../../../packages/barocss-cad-model/src/engine/evalMemo.ts)17/73–78 stores results globally by Doc despite wrappers per callback. | A distinct evaluator can receive the first evaluator's same-Doc result. Whether the intended callers guarantee equivalent evaluation is unresolved. | P0-R07 |
| P2 | [React Host](../../../../../packages/barocss-cad-react/src/model-host.ts)37/102–114 derives status from a separate error field; [Adapter](../../../../../packages/barocss-cad-react/src/adapter.ts)90–110 records an asynchronous failure. | A settled Worker failure can leave the inspector pending/Updating without its error. Actual event flow NOT_RUN. | P0-R08 |
| P2, contract | Host read returns internal Doc, submitted list, centroid and bounds aliases; complete reparses the frozen compiler Doc into mutable data. | Caller mutation could change observations without an owner/fingerprint change. Current consumer mutation is UNKNOWN; declare the observation contract first. | P0-R09 |
| P2, contract | CAD/Model mass facades return volume/mass/centroid/inertia without the core's method/basis/error provenance. | Callers cannot distinguish the declared numerical authority through that result alone. No wrong numeric result is established. | P0-R10 |
| P2, contract | Model core stepOf40–47 returns text only; the producer exposes source/omitted at evaluate480–557. | Existing loss reports do not reach this public facade. The internal exporter and Studio loss preview retain their own contracts. | P0-R11 |
| Qualification | Viewer default test selects clipping only; Studio selects top-level test.ts; Physics has no package test script. [CI runner](../../../../../.github/scripts/affected-ci-run.mjs)63–75/149–175 intentionally separates runtime tests. D513 commands reference TMP tools. | Build/CI/source-helper success is not all runtime acceptance. Preserve reusable drivers and a named command inventory without enabling held WebGPU CI. Model emitted-package distribution remains separately unqualified. | P0-R12 / P4 |

## Positive contracts and remaining unknowns

Worker epochs, named lanes, preview lifetime retirement and deferred-mass source envelopes protect existing Studio ownership boundaries. D513 nested-card freshness and D514 native-edge selection are implemented bounded corrections; D515 slow-drag measurements do not prove every workload. File tags, snapshot-before-log writes and tested Open/Save completion guards are substantial existing protection, not missing features to rebuild.

Native/analytic/faceted routes and sampled strict B-rep checks have explicit limits. Display meshes remain approximate authority. Physics keeps its bounded admission and original D518 rank/adoption gaps. No general customer-shape correctness, package tarball, actual device recovery, standards compliance, full Studio or whole-kernel acceptance was generated by this audit.

Roadmap source facts: the pre-D520 index had615 lines and mixed current navigation with accumulated historical next-item statements. It named D433 latest full kernel while also recording D482's later2167 PASS/0 FAIL/2 existing SKIP. Core readiness and the global product denominator remained NOT_MEASURED/UNENUMERATED. The old43% heuristic must not be revived. Existing scoped workflows and original FAIL/NOT_RUN records must survive replanning.

## Result

- PASS: package/Studio inventory, main ownership/public-contract traces, test-selector and roadmap cross-checks.
- Findings: source-confirmed guard/contract gaps and explicitly qualified consequences above; no new runtime FAIL is claimed.
- NOT_RUN: new tests, builds, Studio/Viewer execution, native/physical oracles, candidate adoption, CI and issue-state refresh/closure.

The owner then requested a complete roadmap rewrite. [D520](../cad-roadmap-replan-2026-11-04/README.md) records that separate documentation change and maps findings to acceptance units. Raw logs/screenshots/archives are not committed.
