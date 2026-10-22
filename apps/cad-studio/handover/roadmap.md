---
work_id: cad-review-continuation-20261022
artifact_type: continuation-roadmap
status: in_progress
owner_role: CAD Coordinator
source_request: "Current chat: resume CAD work in separate Kernel, Model and GPU Works."
last_updated: 2026-10-23
---

# CAD continuation roadmap

[Current status and Work identities](state.yaml) · [Handover protocol](protocol.md) ·
[Source checkpoint](notes/coordinator-handover-2026-10-22.md) ·
[Owner roadmap](notes/owner-roadmap-2026-10-22.md)

[Feature delivery brief and sent instructions](notes/feature-delivery-assignments-2026-10-22.md)

[Consumer connections and follow-up instructions](notes/feature-delivery-followup-2026-10-22.md)

This roadmap defines scope, dependencies and exits. `state.yaml` holds current
status, exact commits and receipts. A recorded completion is limited to the
profile and evidence in its decision record. A source fix, a lane check, local
adoption, integrated browser acceptance, remote merge and release are separate.

## Goal

AI takes a brief to a manufacturable, buyable product. A9 is the first full
acceptance path. The owner roadmap is the scope reference; current acceptance
stays in state and evidence.

## Coordination windows

The owner requested finish on 2026-10-23. Implementation and automatic dispatch
are stopped; cad-work is PAUSED. Read [Codex handback](notes/codex-handback-2026-10-23.md)
and state.yaml for exact commits, lane WIP, blockers and resume commands. Final
window244321188 passed builds and types, failed Studio lint, and encountered a
Model test failure before repeated ENOSPC prevented completion. Remaining package
suites and full browser flow are not run. No new fully verified head is claimed.

Kernel FRk6 sourceabb697f, GPU A9-7 source8789/evidence0eff and CNC source5c9
remain preserved outside integration. Model A9-7 native source remains adopted.
A9-9 scripted upload/paste is controlled fixture evidence; actual-person row
acceptance requires the original human-supplied file and source. G22/G23/FRk5
actual-flow gaps remain open. Resume only on an explicit owner instruction.

## Review corrections

| ID | Owner | Required exit |
|---|---|---|
| REVIEW-K1 | Kernel | Overlapping Sweep mass, centroid and inertia agree with the final B-rep; the five-bend example agrees with `64π`, and disjoint controls retain their exact results. |
| REVIEW-M1 | Model | Direct, batch and script calls enforce the same approval policy; permitted changes survive save/reopen; dry-run, no-op and rejected operations retain accepted state. |
| REVIEW-M2 | Model | A section-row edit that changes geometry invalidates analysis, revision and approval pins; unchanged input stays current. |
| REVIEW-M3 | Model | Welded direct evaluation and worker evaluation contain the same bead bodies; weld changes invalidate the evaluation key. |
| REVIEW-G1 | GPU | GPU pick metadata selects the nearest kept face or cap; CPU and GPU agree for quarter, plane and instance cases. Mock and actual device evidence are named separately. |
| REVIEW-A1 | Model / app contract | Failed mesh persistence is reported and cannot leave a misleading successful recovery state; restore remains coherent with the offered copy and accepted work. |

## Product tracks and dependencies

| Track | Next scope | Dependency / exit |
|---|---|---|
| Kernel FR completion | A9 planar ordered-trim bead dependency → FRk3 I/H and tapered channels → FRk4 arc members → FRk5 gaps/notches → FRk6 trim speed → FRk7 SubD slivers → FRk8a housing check → optional exact-trim integration → FRk9 acceptance | Follow D165's reordered queue and the latest Kernel handover. One D-record and checkpoint per stage. |
| Model A9 | Verify A9-1/2/5/6 → A9-13 part drawing → A9-4 drawing options → A9-10/8 output tools and shop-row inheritance → A9-9 person-supplied rows → A9-11 CSV provenance → A9-7 housing connection → acceptance | The bead refusal and key/bearing fixture conflict remain explicit prerequisites. The acceptance uses real v2 tools and fresh files. |
| GPU | Finish G20.2 → G21 display modes → G22 clearance → G23 print/CNC preview → G24 3D annotations → G25 analysis | G22/G23/G24 consume the existing model contracts. Prepared data does not complete their display. Verify both renderer paths at each stage. |
| Robustness | RB5 fuzz, RB6 corpus, RB7 STEP hardening, RB8 wider sweeps; RB9 actual-agent evidence | Keep downloads, live-model budgets and inherited approvals separate from deterministic local checks. |
| Publication | Public model-package build, docs inventory, legal and release checks | Publishing, deployment and release need their own owner request; no release completion follows from a merge. |

## Preserved decisions

- Kernel → model → app remains the package boundary. Model modules are fully
  public experimental APIs, with no browser/UI import or new dependency shortcut.
- Shop rows come from the person, a sourced page or an explicitly marked estimate.
  A9-9 requires a file supplied by the person in the conversation and its provenance.
- CAE/FEA and the mesher remain held. ECAD, DWG and SAT retain the source
  decisions. RD10 deterministic output is not live-model acceptance.
- Every Work uses its own checkout. Only the coordinator writes current handover
  state and adopts checkpoints. No source changes occur in a running flow's checkout.

Use the dated source handover and D/O/G logs for formulas, supported profiles,
capacity, fixtures, numerical budgets and decisions. This file does not replace
those contracts or turn known limits into completed product acceptance.

## Later owner experiment

After the whole roadmap is complete, write the full specification and conformance
suite, then test a fresh AI reimplementation from them. This is a later owner
experiment, with no implementation assigned in the current window.

## A9 shared seams

The ordered-trim S0 found shared weld material: nominal joint quantities total
2880 mm3, while four duplicate 180 mm3 prisms make unique material2160 mm3.
Preserve the original failed no-overlap check. Request a shared-seam ownership
and reporting contract before implementation; equal partition is the preferred
proposal. Physical material, nominal requested quantity and joint references
must remain separate and auditable. The isolated360 mm3 T control stays fixed.

The shared-seam contract must preserve valid nonshared legacy controls without
automatically writing a policy. A detected shared component with missing or
incomplete context must refuse atomically. Removing a failed peer and retrying
the remaining full nominal bead must not produce overlapping material or
misleading mass totals. Final Model and Kernel agreement precedes implementation.

The coordinator accepted D170 with the Model S0 five-boundary corrections and
assigned separate Kernel and Model implementations at `b9d8b4834`. The Kernel
error must carry the complete structured shared component. The Model retains
unaffected bodies, labels incomplete bead subtotals, and prevents whole-part
mass/inertia/BOM approval from succeeding on omitted shared material. Model
acceptance requires the actual reviewed Kernel API; proposal and synthetic
transport checks do not qualify automatic discovery or partitioning.

## Bounded G21 progression

Deliver the five display modes through the existing App Views control and
GPU/viewport backend as one usable feature. Preserve the current default, native
picks, clip geometry and document state. The exact App display-mode lease and
failure correction belong to the feature delivery brief and current state.
Unsupported combinations need an explicit reason and safe default. Silhouettes,
focus and the missing WebGL2 instance display bridge remain whole-G21 work;
backend checks or the bounded display-mode feature do not complete all G21.

The recovery S0 found metadata-before-blob completion, incomplete-reference false
success and wrong-key cleanup after failed Restore. Its six isolated diagnostic
groups do not provide React or real IndexedDB proof. Preserve the evidence; route
a narrow App/helper fix after GPU returns its exclusive display-mode App lease.

## Historical feature delivery order

Use the [sent feature contracts](notes/feature-delivery-assignments-2026-10-22.md)
to keep three independent implementation lanes productive. Kernel implements
D164 FRk4 on its FRk3 native result. Model consumes that exact FRk3 API through
the existing section editor, commands, v2 tools and Save/Open. GPU connects the
existing display-mode backend to actual App controls and resolves the retained
WebGPU image failure. Required tests stay inside these implementation tasks.
The coordinator separately reviews and adopts the already received A9 shared-seam
and FRk3 native results; pending aggregate verification does not require independent
implementation lanes to remain idle. A9 acceptance and its remaining queue still
require the real shared-seam and brief-fixture dependencies.

Shared-seam and FRk3 native code are now available in local integration, with
focused checks recorded in current state. This does not complete FRk3 screen/file
acceptance or the full A9 path. A ready feature may use a free verification slot
before an unready reservation; notify the affected Works and preserve one active
heavy lease at a time.

FRk3 editor screen/file evidence and the bounded G21 display-mode feature have
since been accepted at their native SHAs and adopted locally. Current state records
the separate aggregate window. Complete FRk4 through its existing editor consumer
before advancing Kernel to FRk5; a named Model-file lease keeps that work separate
from Model's A9-13 drawing correction. A9-13 means removing unrelated instance
geometry and automatic dimensions from a part drawing, while preserving assembly
BOM and balloons. GPU next connects default assembly instance display/pick on
WebGL2. Silhouettes, isolate/hide and nondefault instance display modes remain
explicit whole-G21 work.

Every manufacturing source table must fit within the drawing frame and page,
with every column and value visible in the actual exported file. Successful
v2 calls, file download and text extraction alone do not complete A9-4 output
acceptance. Compare the original render and saved coordinates before
classifying a suspected overflow; preserve and correct the finding when the
original evidence disproves it.

A9-13 must also preserve assembly drawing corrections: suppress automatic part
dimensions, while keeping existing table/note placement and scale fixes in both
UI and v2 Fix-all. Review found a broad assembly rejection in the first candidate;
the same feature needs that correction before its actual drawing acceptance.

## Window continuation proof

The approved gear-URDF refresh changes eight inertial numbers and adds independent
geometric guards. A resumed window checks the repaired target and its prerequisites,
then the remaining types/lint and full browser flow. Keep the original package-suite
SHA and the new browser SHA explicit. This fixture repair does not include the new
shared-seam consumer or G21 source. Their acceptance remains separate.
