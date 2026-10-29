# Engine audit intake — 2026-10-29

Original intake status: **REGISTERED / NOT_REPRODUCED** for15 static candidates. The later bounded
execution update below reports five reproduced cases at its own fixed source, not15 product failures.
This note creates no repository rewrite or second task queue.
A candidate's priority is the audit's reproduction priority, not a replacement for the owner's work order.

## Source and current-state boundary

- Audit base: `06c33222a46520bef7d3191a4d4eb7614fde7a83`.
- Current local checkpoint at intake: D297 `739978a27df502495e01276f986b335b814c62d9`.
- Audit report: [README](/Users/user/Documents/ChatGPT/barocss/reports/engine-audit-2026-10-28/README.md),
  [cross-review](/Users/user/Documents/ChatGPT/barocss/reports/engine-audit-2026-10-28/validation.md),
  [requested candidates](/Users/user/Documents/ChatGPT/barocss/reports/engine-audit-2026-10-28/roadmap.md).
  Their linked source copies are fixed at the audit base. They are not the current moving worktree.
- Root confirmed that the tracked A01–A08 core paths listed in the delivery have no committed diff
  between06c33222a and739978a27. This verifies unchanged source paths, not the audit's product scenarios.
- D297's private wrap map/composer and its subsequent native-source/assembly candidates are separate work.
  The audit's copied five-file WIP is not a qualification of D297 or later wrap work.
- Current root-owned `engine/rematch.ts` and `text-relief-rematch.test.ts` WIP is a separate text-relief
  reference fix. This intake neither changes it nor treats it as closure of an audit candidate.
- The audit performed source/AST/import/registration and artifact checks. Product build, type/lint/test,
  browser, resource-growth measurements, natural GPU loss/OOM and remote Actions checks were **NOT RUN**.
  This intake reads records and writes documentation only. It adds no execution evidence.

The owner retains **07 → 08 → 09** as the feature order. Wrap remains the active row07 feature.
The following entries are attached reproduction checks under existing areas; they do not silently displace
wrap, restart paused work, duplicate earlier tasks, or transfer another work's source ownership.
When an affected area is assigned, check the exact current diff and existing receipts before reproduction.
A confirmed defect in the active feature is handled within that feature. Otherwise keep the check pending.

## Mapping and bounded acceptance

At the original static intake, all15 rows below were **NOT_REPRODUCED**. The execution update below
supersedes that label only for its five stated cases. Candidate IDs are namespaced as `EA-20261029/Axx` here to
avoid confusion with older A1/A9 experiment and acceptance IDs. They are references, not new task IDs.
Completed historical O/R/V entries keep their earlier qualification scope; these follow-ups do not reopen
or invalidate those whole entries without current evidence. No new issue is needed for this intake.

| Candidate / audit priority | Attach to existing roadmap area and task | Exact reproduction and acceptance scope |
| --- | --- | --- |
| A01 / P1 | 09 CG3 advanced sketch; 12 CG6 file flow | Create an actual skeleton/3D sketch, Save, then Open in a fresh session. Preserve node IDs, references and evaluated results. Check ModelNode kind/reader admission completeness and structural skeleton validation. An allow-list edit alone is insufficient. |
| A02 / P1 | 12 CG6 project save/recovery; O9 revision ownership | Delay a save while editing, New, and project/path switching. Bind completion to the saved project/document/path/generation. Only that current saved generation may become clean. A newer autosave/recovery record must survive older completion. This is not the earlier REVIEW-A1 blob-write ordering task. |
| A03 / P1 | 05 Viewer delivery; V1 lifecycle and R2 resource ownership | On a fixed accepted packet scene, repeat orbit/pan/zoom and count live Geometry plus actually uploaded buffers. Counts must stabilize through scene replacement, dispose and device recreation. Distinguish retained CPU arrays from GPU allocation and reported counts from driver memory. No measured memory slope exists yet. |
| A04 / P2 | 12 CG6 versions/snapshots | Round-trip a currently allowed snapshot that omits optional nextId through the dedicated snapshot codec. Preserve its original canonical key and fields. Include omission, false, zero and empty data; report semantic/canonical JSON and raw-byte equality separately. Keep ordinary Open normalization. Do not generalize to all UI-authored projects or invent schema migration. |
| A05 / P2 | 12 CG6 Open/project flow; O9 late-result ownership | Delay A then Open B, and separately A then New. Also close/switch the project before A completes. Recheck request/project generation after each await. Old completion must not replace document, version log or autosave proposal. |
| A06 / P2 | 12 CG6 worker/recovery lifecycle; O9 and R4 engine ownership | Repeatedly restart/Stop the worker and replace WireSender. Dispose must unsubscribe from blob eviction and clear owned maps on normal and error exits. Subscriber and retained-node counts must stabilize. Static retention alone is not a measured heap increase. |
| A07 / P2 | 06 GPU delivery; existing scene/pick generation contract | Delay pick readback while moving, reordering, shrinking, removing or replacing instances. Capture/recheck instance or scene generation. Never combine stale instance ID/depth with current transforms. Preserve stale-result refusal and readback cleanup. |
| A08 / P2 | 05 Viewer delivery; V1 camera and V2 inspect/pick | Define one external near/far contract and compare pixels with CPU and GPU pick under restricted clipping. Preserve backend depth conventions; a mathematical helper merge alone is insufficient. |
| A09 / P3 investigation | 05 Viewer delivery; V1 accepted-state failure/dispose contract | Retain existing packet/camera prevalidation. Identify a reachable synchronous internal display failure, or use explicitly bounded failure injection, to check rollback of accepted packet/camera and owned resources. This does not prove ordinary public-input failure, natural OOM or device loss. |
| A10 / P2 | 16 CG10 acceptance and existing RB5–RB8 validation/CI scope | Classify discovery/registration and define automatic CPU checks plus selected browser/GPU environment and skip policy. Distinguish execution, pass, fail, skip and not-run at the exact source. See counts below. Register missing intended coverage without assuming all 19 belong in one heavy command; no existing download permission or paused campaign is reopened. |
| A11 / P2 | 22 remaining own-data/code-shape work; R5 CAD and R2 GPU/Viewer shared internals | Reuse existing own-data work and attach remaining snapshot/validator/backend-state candidates. Only consolidate equal contracts. Preserve error factory/code/message, limits, reflection/check order, signed zero, omission, source ownership, ABI and support profile. Differential validation precedes adoption. The 148 token groups and 97 structural groups are overlapping candidate counts, not defects or a sum. |
| A12 / P2 | 16 CG10/R7 public contracts; R4 Model layers and R1 Studio ownership | Identify stable authoring/evaluation/document/storage/presentation contracts and existing consumers. Keep core/facades and public compatibility. Verify the actual emitted/runtime boundary before calling a value-declaration cycle an execution defect. Splitting files or removing wildcard exports alone does not close this item; API retirement requires separate consumer/support review. |
| A14 / P3 | 16 CG10 mass-result acceptance and diagnostics | Reproduce a supported fallback path and preserve a cause classification distinguishing unsupported quadrature from internal error. Keep method:tessellated and the existing coarse/fine volumeBound estimate meaning. Do not promote that estimate to a rigorous bound or loosen numerical admission. |
| A15 / P3 | 16 CG10/R7.3d public native support and consumer map | For the selected source-wide material-graph and knot-recipe loft-graph families, record real consumer/example/external contract, supported inputs, qualification level and reason for public retention. Root re-export or absence of another src caller does not prove dead code. Do not delete or broaden APIs on this static count alone. |
| A16 / P2 investigation | 06 GPU/Studio display contract; R2 shared renderer policy | First establish whether the same degenerate/cancelling-normal input is admitted by both product paths. Decide zero versus +Z fallback semantics, or record the unreachable-input restriction. Share only justified low-level accumulation; preserve indexed/nonindexed support and do not merge camera ownership. |

## A10 registration counts are separate observations

At the audit base, the GPU source inventory has **83 named test files**. The default package test command
lists **45/83**. The consumer command lists **3** and the browser command **16**; the union of all three
commands is **64/83**, leaving **19 unregistered** across that union. Default and union are not synonyms.
The default command also includes one external example check, which is not another GPU test file.
These are static registration counts, not case counts, executed counts, pass counts or proof of absent
manual runs. The fixed full list is in the report's `test-registration.json`.

Viewer has four CPU test files outside package test discovery and two separate browser files with environment
or adapter skip paths. Check their intended runner/environment and report each actual skip. The general CI
package-test exclusion and manual-regression app-test exclusion may be deliberate policy; current CI history
was not read. An existing green CI result does not by itself supply these product receipts.

## Exclusion, deduplication and next handling

**A13 is excluded.** Cross-review found the public typed-array contract explicitly forbids mutation after
handoff. Caller mutation of positions/indices does not establish a defect under that contract. Keep A13
only as the audit's retraction record. No new groups/internal-mutation defect was established.

Existing attachment points are reused: O9 for stale-result ownership, CG6 for files and versions, V1/V2 for
Viewer lifecycle/camera/inspect, R2/R4/R5 for their already assigned boundaries and internal common work,
R7.3d for consumer/support classification, RB5–RB8/CG10 for execution evidence, and row22 for remaining own-data
work. The existing issue2215 result-acceptance section already requires current-source rechecking and bounded
proof. This intake extends that discipline; it neither duplicates issue2215 nor claims these candidates were
part of its older c3ae0d5 audit.

When assigned, process one bounded candidate as current-source check → reproduction → smallest justified fix
→ affected verification → required actual consumer/file/resource flow. Record source, execution, product and
remote status separately; keep first failures. P1 data/lifetime checks precede lower-priority investigations
within this audit's pending work. The active owner order07→08→09 is unchanged. No issue, cross-thread message,
fetch, product tool run, source modification, push, PR or release was performed by this intake.


## Independent execution update — fixed5463dbf32,2026-10-29

The later audit reports were read from the actual GitHub issues and are indexed in
[the execution-report source record](engine-audit-reproductions-2026-10-29.json). They use an isolated
`5463dbf32af5dd10670badd0d334c68504615292` snapshot and did not modify or qualify the D315 WIP.
This intake did not rerun their probes. The five directly affected files have no committed diff
from that snapshot through D315 `dbfe93216`; that source comparison is not a new product run.
Keep the owner's07->08->09 order and existing source ownership. These are new OPEN defect issues,
separate from the already archived73-issue research intake; do not close them as research transfer.

| Existing candidate / destination | Issue and executed scope reported by the audit | Remaining acceptance |
|---|---|---|
| A01 /09+12 | [#2235 P1](https://github.com/barocss/barocss/issues/2235): actual Studio3D sketch, real Save download and fresh browser-context Open reject unknown skeleton. File SHA25609a1e09a23c191b4ea0e0a62688b2bf208cbb16ff3512f02c76635ec9e4c7a98; prior accepted document preserved. | Current structural reader admission, stable IDs/frames/evaluation, actual Save/fresh Open/re-edit. Allow-list addition alone is not full acceptance. |
| A04 /12 | [#2236 P2](https://github.com/barocss/barocss/issues/2236): real version API/project codec with memoryStore changes the canonical key when optional nextId is omitted. Dedicated snapshot-codec control passes. This is not UI or physical-file evidence. | Reuse the dedicated snapshot codec; preserve omission/false/0/empty data and original keys while ordinary Open normalization remains. Then validate the actual selected project flow. |
| A07 /06+GPU R2 | [#2237 P2](https://github.com/barocss/barocss/issues/2237): real pickNow CPU reconstruction and public setInstances with delayed readback mock reproduce shrink TypeError and old-depth/current-instance mixing. Device/draw/visibility/camera preparation are stubs. | Bind instance/scene generations across await; cover replacement/reorder/shrink/remove and buffer cleanup. Actual GPU readback timing remains unexecuted by this mock. |
| A03 /05+Viewer V1/R2 | [#2238 P1](https://github.com/barocss/barocss/issues/2238): actual Chrome156/Apple Metal WebGPU orbit32 times grows retained Geometry1->33 with one Mesh; three setView calls then clear retain36 Geometry/Mesh0; dispose reaches0. | Reuse or release owned geometry through camera/scene/clear/error/dispose cycles. Counts are private-object diagnostics, not driver-byte or OOM measurements. |
| A08 /05+Viewer display/pick | [#2239 P2](https://github.com/barocss/barocss/issues/2239): actual WebGPU coverage9600 pixels and center RGBA remain at depth6 for near7 or far5, while public CPU pick returns null; normal clip control hits. | Align or explicitly define display/CPU/GPU clipping; test bounds and camera transitions. Whole pixel-byte equality and GPU-pick equivalence were not measured. |

The same audit independently observed D315's original17/64-control constructor/mass success with
Surface/strict/tessellation failure at the fixed baseline. It added no duplicate issue. D315's
later source repair and actual consumer checks are a separate receipt, not supplied by that baseline.
The remaining original audit candidates retain their original unexecuted status and scope.
