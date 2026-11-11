# CAD roadmap — current status and execution order

Updated 2026-11-11 · Priority authority: D520 · Latest delivery: D698 · Audit baseline: `ccce78c671c8a5c09718c1cf6005a90027b75adc`

This is the only current status index. Detailed tracks define acceptance; the 34 stable row pages retain scope and issue navigation. Immutable decision notes retain results. Do not append chronological status paragraphs here. [D520 decision](notes/cad-roadmap-replan-2026-11-04/README.md) supersedes D445 execution order and historical next-item text, while retaining its safeguards and bounded proofs.

## Now and next

- **Current position:** D698 applies Hidden lines to same-sheet and split-sheet Detail views and verifies current SVG/DXF. [D698](notes/detail-hidden-lines-2026-11-11/README.md).
- **Next MAIN:** D699 / P2 B06, row 11. Reproduce section culling far from the origin and compare a translated intersection with the near-origin control and a true miss. [#2418](https://github.com/barocss/barocss/issues/2418). [Core workflows](roadmap-tracks/02-core-workflows.md).
- **Active branch:** `local/cad-dev`. Before work fetch both remote refs and preserve unexpected WIP. Latest develop integration is D516, merge `4d733c0f622dadf0b8d84d4395b696779e9b1e84`, incorporating develop `0a838f9543a29a864df5917ac2bb877540c8aa73`. No new develop merge or release is authorized by this plan.
- **Measured progress:** whole CAD and core readiness **NOT_MEASURED**; B01 v1 **12/12 accepted groups**; B02 v1 **11/11 accepted groups**; B04 v1 **26/26 accepted groups**; B07 v1 **6/6 accepted profiles**; B09 v1 **9/9 accepted groups**; initial scenarios **5/10 accepted**; B03, B05, B06, B08 and B10 **NOT_ADJUDICATED**, with no aggregate baseline percentage. The legacy43% is frozen history. P0 has12 acceptance items; R01–R12 have bounded D521–D532 closeouts; R04 native collision remains UNKNOWN; no whole-product acceptance follows. This is backlog state, not a whole-CAD percentage.
- **Evidence correction:** D482 records2167 PASS/0 FAIL/2 existing SKIP in a later full-kernel run than D433. Neither result is a new full-suite PASS at this audit HEAD. [D482 record](notes/vertical-contact-refusal-2026-11-04/README.md).

## Product order

P0 findings that can lose work, export stale geometry or misattribute results take precedence. Thereafter select the first uncovered, nonheld acceptance in P1, then P2, then P3. A concrete downstream blocker may move earlier with a recorded reason. Preserve valid prefixes; do not rebuild an implemented feature because its broad family is open.

| Order | Deliverable and boundary | Current position | Detailed acceptance |
| --- | --- | --- | --- |
| **P0** | Document safety, current geometry/output, public API ownership and truthful failure/provenance | R01–R12 have bounded closeouts. R04 native collision is UNKNOWN. D663, D664, D669 and D670 cover R13–R16. D684 and D686 close the reproduced R17 keyboard and R18 feature draft losses. | [Reliability queue](roadmap-tracks/01-reliability.md) |
| **P1** | Useful daily parts: constrained sketch, extrude/revolve, Boolean, hole/finish/pattern, upstream edit, stable refs, measure/history and Save/Open | B01 v1 support12/12 and B02 v1 enclosure11/11 accepted. B03 has selected full-Revolve8/8, shaft11/11, four partial/Hole supplements8/8 each and current Chamfer8/8; positive tapped remains data-blocked, whole B03 unadjudicated. D546 accepts B04 v1 at26/26 selected Pipe/Loft/Sheet groups after independent folded/flat/DXF and actual project proof; D545 delayed-fit measurement stays bounded. D547 adds the selected reverse Subtract missing consumer8/8; wider families remain separate. Broader family acceptance stays separate. | [Core workflows](roadmap-tracks/02-core-workflows.md) |
| **P2** | Engineering drawings and exchange: dimensions/sections/details, revisions, units, explicit losses, independent reads | D548 qualifies two-sheet source/SVG 10/10. D549 qualifies Section/Detail output 3/3. D550 qualifies Auto-dimension, history, Save/Open and annotated SVG 6/6. D674–D676 verify leader, counterbore and lost-diameter handling in actual SVGs. [D695](notes/b07-neutral-file-acceptance-2026-11-11/README.md) accepts B07 v1 at 6/6 selected STEP, STL and 3MF profiles. [D696](notes/auto-dimension-tolerance-retention-2026-11-11/README.md) verifies authored tolerance retention in Studio and current SVG/DXF. [D697](notes/auto-layout-refusal-2026-11-11/README.md) verifies Auto-layout refusal and source retention. [D698](notes/detail-hidden-lines-2026-11-11/README.md) verifies Detail visibility in Studio and current SVG/DXF. B06 remains unadjudicated. ASME PDF mismatch stays deferred. | [Core workflows](roadmap-tracks/02-core-workflows.md) |
| **P3** | Static assemblies: placement, mates, nested selection, linked revisions, material/BOM/drawings | D511/D512 bounded workflows and D513 card fix qualified. No generic assembly or dynamics completion. | [Core workflows](roadmap-tracks/02-core-workflows.md) |
| **P4** | Studio/Viewer/GPU usability, desktop performance and library consumer readiness | D514 edge selection and D515 slow drag retained. [D668](notes/studio-model-work-area-fit-2026-11-11/README.md) verifies model work-area fit. [D685](notes/studio-top-toolbar-overflow-2026-11-11/README.md) and [D687](notes/studio-model-command-rail-2026-11-11/README.md) qualify the selected desktop tool layouts. The historical D545 Loft case remains a separate repro profile. GPU equality/recovery gaps remain P0. General scale and emitted-package acceptance remain open. | [Platform and extensions](roadmap-tracks/03-platform-and-extensions.md) |
| **P5** | Advanced geometry, direct face editing, surface quality and tolerance analysis | Bounded native families exist; general SSI/NURBS/blends/direct editing remain separate. Existing fitter/thicken/widening HOLDs persist. | [Platform and extensions](roadmap-tracks/03-platform-and-extensions.md) |
| **P6** | Real-file ecosystem, additional formats/catalogs and collaboration/PDM | Planned profiles need approved sources, dependencies and concrete consumers; no automatic download/server adoption. | [Platform and extensions](roadmap-tracks/03-platform-and-extensions.md) |

## First product baseline and reference review

[Ten named scenarios B01–B10](roadmap-tracks/04-product-baseline.md) define the first mechanical-CAD target: bracket, enclosure, shaft/flange, sweep/Loft/sheet, static assembly, drawings, neutral files, project recovery, automation and Viewer/React consumers. B01 v1 has an adjudicated [12-group ledger](roadmap-tracks/09-b01-evidence-ledger.md), B02 v1 an [11-group ledger](roadmap-tracks/10-b02-evidence-ledger.md); B04 v1 is accepted26/26; B09 v1 is [accepted9/9](notes/cli-constrained-rectangle-2026-11-11/README.md) for one CLI-created constrained plate. B07 v1 is [accepted6/6](notes/b07-neutral-file-acceptance-2026-11-11/README.md) at the selected exchange profiles. Five named scenarios have accepted v1 ledgers. B03, B05, B06, B08 and B10 remain NOT_ADJUDICATED. Do not label existing implementation missing or infer an aggregate fraction/percentage before their case matrices are known. This subset is not whole-CAD completeness. [Official-source comparison](roadmap-tracks/05-reference-review.md) distinguishes ArtCraft CADCraft, the separate CadCraft/PartCraft suite, SolidCraft and CadXStudio supplier claims. No competitor execution or parity benchmark was performed.

## GitHub requirement and issue inventory

The November 10 intake routes the 135 issues from #2288 through #2422, including the CSS exclusion. It records source-backed safety candidates, drawing and exchange follow-ups, and the AI delivery sequence. The new runtime checks are NOT_RUN. [November 10 issue follow-up](roadmap-tracks/13-issue-followup-2026-11-10.md).

[Registered target](roadmap-tracks/07-requirement-registry.md):129 exact requirement IDs from15 existing CAD epics #528–#542. [Live issue reconciliation](roadmap-tracks/06-github-issues.md):192 open repository issues screened;85 CAD-title issues plus16 related dependencies receive primary destinations. The new map preserves older delivered evidence and adds #2284 local visual-review research, #2285 edit semantics and #2286 fillet scalar interaction. Owner later-reference #2287 is routed separately to P4 Inspector/command/focus research; it does not remeasure the historical census or lift UI HOLD. Issue proposals/checklists are input data; current owner decisions and explicit HOLDs remain execution authority. [The other91 open issues](roadmap-tracks/08-other-issue-routing.md) have metadata-only provider/domain/other-owner routing, so shared GPU/Interop dependencies are not lost by a CAD-title filter. Requirement coverage is NOT_ADJUDICATED; an unchecked box is not proof of missing implementation.

## Independent tracks and owner gates

- **Automation / AI:** existing manual Studio, CLI/MCP/script/proposal paths must share the typed core and editable Doc/history. B09 qualifies create→inspect→revise→refuse/rollback→save→Studio Open. Live-LLM value is separate from controlled tool correctness; no new framework or paid live run follows.
- **CAD React:** continue separately with the existing Model/Worker and Viewer. D509 current runtime and docs functionality pass at the recorded scope; six-page readability and stable active-color capture remain partial. Settle P0-R08/R09 and declare component/source support before another breadth batch. New components require actual props-change/render evidence and a returned-document Studio consumer. No custom GPU renderer is implied. [D509](notes/cad-react-profile-composition-2026-11-04/README.md).
- **Physics library:** source investigation D518 complete; local EXACT04 remains unadopted. First complete the declared candidate/checkpoint/archive boundary, then qualify adoption and the physical-J/rank contract separately. Represented10/physical9 and tilted490 represented8/physical7 remain unresolved. Library work is authorized; Studio Physics is not. [D518](notes/physics-exact04-takeover-audit-2026-11-04/README.md).
The new priority **P2 means drawings/exchange**. The old manufacturing gate also named `P2` is a separate historical gate and remains held.

- **HOLD:** Studio Physics/Motion activation, manufacturing/equipment/P2/PG11, broad fitter/NURBS/public-thicken and #2266 widening, nonzero-cone offset expansion, owner UI redesign, ASME PDF mismatch, schema5/migration, new WebGPU CI, release/npm/deployment retain their existing gates. No gate is removed by renaming a track. Downloads and paid live executions require prior permission each time. Desktop only; do not test mobile.

## Stable scope map — all34 rows

These are scope references, not34 equal units of completion. A bounded verified example is not family acceptance. C1–C8 are retained in historical records; P0–P6 now determine current order.

| Row | Scope | Current track / retained boundary |
| --- | --- | --- |
| [01](roadmap-rows/01.md) | Standalone tolerance frames | P2; bounded D372 proof retained |
| [02](roadmap-rows/02.md) | Drawing usage documentation | P2; bounded D374 proof retained |
| [03](roadmap-rows/03.md) | Cut-feature linear repeat | P1; bounded D373 proof retained |
| [04](roadmap-rows/04.md) | Public API, examples and documentation | P0/P2/P4; contract gaps and consumer qualification |
| [05](roadmap-rows/05.md) | Viewer product | P4; bounded D375 proof retained |
| [06](roadmap-rows/06.md) | GPU renderer | P0/P4; bounded relative-frame proofs, recovery/equality open |
| [07](roadmap-rows/07.md) | Modeling feature families | P1/P5; everyday profiles first, advanced scope separate |
| [08](roadmap-rows/08.md) | Patterns, direct editing and surfaces | P1/P5; recorded bounded profiles retained |
| [09](roadmap-rows/09.md) | Sketch and constraints | P1/P5; existing basic workflows, advanced breadth separate |
| [10](roadmap-rows/10.md) | Static assemblies | P0/P3; 3MF currentness and ordinary assembly acceptance |
| [11](roadmap-rows/11.md) | Drawings | P2; existing bounded proofs, PDF mismatch deferred |
| [12](roadmap-rows/12.md) | Files, versions and collaboration | P0/P1/P3/P6; implemented Save/Open, new version/recovery gaps |
| [13](roadmap-rows/13.md) | Exchange and loss reporting | P0/P2; supported profiles first, general formats open |
| [14](roadmap-rows/14.md) | Manufacturing | HOLD; P2/PG11 and NOT FOR PRODUCTION unchanged |
| [15](roadmap-rows/15.md) | Product usability | P4; functional feedback allowed, owner redesign deferred |
| [16](roadmap-rows/16.md) | Accuracy, references and API robustness | P0 and cross-cutting; no universal precision claim |
| [17](roadmap-rows/17.md) | Path bundles and virtual clips | Existing bounded proofs retained; new Motion activation held |
| [18](roadmap-rows/18.md) | Joints and robotics | Existing staged proofs; Studio dynamics activation held |
| [19](roadmap-rows/19.md) | Experiments and multiphysics | HOLD; static display is not solver certification |
| [20](roadmap-rows/20.md) | Handles, previews, cadence and notices | P0/P4; D514/D515 bounded proofs retained |
| [21](roadmap-rows/21.md) | Sidebar/history/command discovery | P4; bounded layout proofs, redesign deferred |
| [22](roadmap-rows/22.md) | Performance and code structure | P0/P4; measured seams, no speculative acceleration |
| [23](roadmap-rows/23.md) | Large assemblies | P4 after static foundations; measured workload not yet frozen |
| [24](roadmap-rows/24.md) | Class-A surface quality | P5; B2/surface dependencies and HOLDs retained |
| [25](roadmap-rows/25.md) | Tolerance stack analysis | P5 after drawing/assembly foundations |
| [26](roadmap-rows/26.md) | Real customer file regression | P6; per-download/source/license gates |
| [27](roadmap-rows/27.md) | Release and operations | HOLD; no publishing authority follows |
| [28](roadmap-rows/28.md) | Formats and standard-parts catalogs | P6; dependency/source/SDK gates |
| [29](roadmap-rows/29.md) | Collaboration and PDM | P6; server and conflict-recovery gates |
| [30](roadmap-rows/30.md) | Kernel generality | P0 concrete blockers / P5 breadth; widening HOLD retained |
| [31](roadmap-rows/31.md) | B-rep direct editing | P5 after needed kernel support |
| [32](roadmap-rows/32.md) | Viewer SDK commercial acceptance | P0/P4; private/source tests do not qualify shipped consumers |
| [33](roadmap-rows/33.md) | Browser CI | HOLD; D359 local-only verification remains |
| [34](roadmap-rows/34.md) | Unit-suffix cleanup | P5 quiet boundary; no schema5/migration permission |

## Acceptance and progress contract

1. Before a category run, version its finite case matrix: feature family and supported inputs, actions, expected quantities and unchanged tolerances, refusal/retention cases, history, native/local-project persistence, owner/source and affected consumer. Check retained evidence before selecting missing steps.
2. Each implementation milestone gets one decision, the required SMALL/FEATURE/FULL checks and a relevant actual Studio run. Geometry/numerical claims need a suitable independent native/physical oracle; pixel output and hashes are not that oracle. React also needs its actual Viewer consumer; Physics library proof does not imply Studio integration.
3. Report separately: implementation available, source/controlled checks, actual Studio/Viewer, independent numerical/file read, and remaining unsupported/HOLD scope. PASS/FAIL/NOT_RUN are results, not vague percentages. Keep first failures and run only necessary antecedents plus changed/failed steps.
4. A named milestone may report accepted N/M only after its matrix is frozen and retained evidence is adjudicated. Whole CAD remains NOT_MEASURED. The first B01–B10 subset has a named scope list. B01 v1 and B02 v1 are adjudicated at their recorded scopes; B04 v1 is accepted26/26; B07 v1 is accepted6/6 at its declared exchange profiles; B09 v1 is accepted9/9 at its recorded CLI-created scope. B03, B05, B06, B08 and B10 matrices/coverage remain NOT_ADJUDICATED. This subset is not the denominator of all CAD. Do not weight open rows as50%, count decisions/tests as features, or count all new backlog entries as missing implementation.
5. Select SMALL for private bounded repairs, FEATURE for new behavior, FULL for public API/geometric/tolerance changes. Whole kernel runs remain B-rep-core-only. Final Model tsc follows the last test edit. Use gate.sh for one heavy execution; freeze worktree writes during actual Studio. Preserve all other [operating rules](notes/codex-handoff-2026-11-01/README.md#5-지킬-규칙-오너-결정).
6. Before closing an issue, inspect every acceptance requirement and current evidence. Keep research/epic/partially satisfied issues open. This documentation milestone closes no issue and authorizes no release.

## Records and maintenance

- [D519 audit](notes/cad-package-studio-audit-2026-11-04/README.md): evidence versus inference and execution limits.
- [D520 replanning record](notes/cad-roadmap-replan-2026-11-04/README.md): rationale, archives, validation and next item.
- [Current handoff](notes/claude-handoff-2026-11-02/README.md) · [Decision index](decisions.md) · [Issue intake D460](notes/github-issue-intake-2026-11-03/README.md).
- [Exact pre-D520 index](roadmap-history-D418-D518.md) and [through-D417 history](roadmap-history-through-D417.md) are historical only. Old next-item/latest-checkpoint phrases there are not current authority.
- Keep this index as a current snapshot. Replace current status in place; put narrative receipts in their decision notes. Preserve34 row IDs, add new acceptance units in a detailed track, and revise a frozen denominator explicitly when scope changes.
