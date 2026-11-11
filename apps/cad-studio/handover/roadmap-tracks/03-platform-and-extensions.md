# P4–P6 and independent library/automation tracks

[Current roadmap](../roadmap.md) · [P0 reliability](01-reliability.md) · [Core workflows](02-core-workflows.md) · [D519 audit](../notes/cad-package-studio-audit-2026-11-04/README.md)

This queue preserves implemented support and names the missing acceptance. The 34 row IDs are stable scope references, not equal work units or a completion percentage. No item is newly qualified by this rewrite. Source-only audit findings remain distinct from reproduced failures and intentional unsupported profiles.

## P4 — GPU, Viewer, interaction and scale

Owner's later-reference intake: [#2287](https://github.com/barocss/barocss/issues/2287), read in full on2026-11-05, is RESEARCH/P4 BACKLOG for contextual Inspector organization, command entrypoint consistency, tree/list/foldout state, actionable errors and focus/keyboard/transaction ownership. Reuse existing Inspector/HUD/Command.available/Palette/dock behavior and retained evidence first; select one uncovered desktop flow before any change. This does not select a Unity-style redesign, new shared UI package, assets/dependency download, mobile testing or an immediate MAIN task. Owner workspace/menu/icon redesign HOLD remains. Full official-reference review and new product/accessibility execution for this issue are NOT_RUN; its requirements are proposals, not missing-feature or parity claims.

Rows [05](../roadmap-rows/05.md), [06](../roadmap-rows/06.md), [15](../roadmap-rows/15.md), [20](../roadmap-rows/20.md), [21](../roadmap-rows/21.md), [22](../roadmap-rows/22.md), [23](../roadmap-rows/23.md), [32](../roadmap-rows/32.md). GPU owns device/resources/render contracts; Viewer owns its native/display facade; Model owns geometry identity; Studio owns selection, preview and user feedback. P0-R04/R05 owns the newly audited equality/recovery boundaries before breadth work.

### Current architecture and scope

- Studio uses its own [GPU renderer](../../src/viewport/gpuRenderer.ts) over `@barocss/gpu/viewer`, plus its existing WebGL fallback. It does not use the `@barocss/viewer` CAD facade for its viewport.
- The [Viewer facade](../../../../packages/barocss-viewer/src/index.ts) serves cad-viewer and CAD React's existing display sink. Native Surface/Curve/qualified-source capabilities differ from copied render-only triangle input; mesh indices do not become durable native topology.
- Interop owns copied native/display packets and bounded optional Three/Babylon/Pixi adapters. [Interop exports](../../../../packages/barocss-cad-interop/package.json) and [GPU exports](../../../../packages/barocss-gpu/package.json) are public surfaces with source/compiled consumer paths, not proof of all package combinations.
- Source units, Z-up/Y-up conversion, transform ownership and approximate-pick authority must remain explicit. Unsupported native Face/UV queries from display meshes must refuse rather than invent source authority.

### Acceptance queue

| Workstream | Existing evidence / retained boundary | Testable remaining acceptance |
| --- | --- | --- |
| Selection and visual identity | [D514](../notes/native-edge-selection-2026-11-04/README.md) qualifies selected native edge centerlines and edge-less face tint. | Update a supported body with the same logical key; verify current uploaded geometry, displayed selection and source refs. Test hidden/occluded edges and instance scope. P0-R04 first reproduces the incomplete-signature boundary; native reachability is not already proved. |
| Drag/preview/frame cadence | [D515](../notes/slow-drag-cadence-current-2026-11-04/README.md) and [D516](../notes/develop-integration-2026-11-04/README.md) retain bounded slow-drag measurements; current generation/pointer guards exist. | Select the remaining actual drag gap, if any: preview/current result, pause/full completion, Escape, pointer cancellation and first Undo must agree. Report timing with exact scene/device/source; do not turn the existing case into a universal responsiveness claim. |
| Device/resource lifecycle | Core recovery and typed stale-readback rejection exist. D517's recovery-host candidate remains unadopted with source-review gaps. | After P0-R05, observe current-owner restoring/recreated/failed states, replacement/unmount and late callbacks. Record simulated versus actual device failure separately. Retained geometry must not be advertised as a fresh recovered frame without evidence. |
| SDK and adapter boundaries | Existing facade, low-level scene API and optional third-party adapters have separate contracts and tests. | Check selected compiled package imports/types without source aliases, declared peers, frame/units, source identity, cancellation/refusal retention and owned resource disposal in one real consumer. Document precision/attribute loss. Do not substitute an example for library integration. |
| Precision and camera/picking | [D545](../notes/project-open-framing-2026-11-05/README.md) traces real delayed Open fit at two profiles; settled finite samples/camera equal public Frame all, with one Loft vertex behind the palette. No lasting stale-fit reproduction or product fix. Existing native/world and display paths have finite proofs; [world precision](../notes/viewer-cpu-world-precision-2026-11-02/README.md) retains the far raster/GPU-pick failure boundary. | Select a supported scale/placement and check native versus display coordinates, fit/clip/pick ownership and camera changes. CPU recovery is not a raster correction; a visible screenshot is not native accuracy. |
| Large assemblies and kernel throughput | Existing sharing, frame-cost and Worker/preview instrumentation remain. | Use a declared assembly and operation, record cold/warm rebuild, memory/resource release and input/frame latency. Compare current acceptance to the same workload and device. No new performance budget or broad scale claim is introduced. |
| Usability and docs | Existing tools, icons, inspectors, navigation and functional feedback remain. | Fix concrete discovery/error/focus defects in the existing surface. D509's26 routes/classes pass but settled active-color PNG agreement is unqualified. Owner workspace/menu/icon redesign stays HOLD. |

Finite P4 closeout requires a named display/interaction consumer, affected source/compiled checks, actual desktop observations and explicit resource/error scope. Browser tests that SKIP are not actual device proof. Package tests, manual regression and browser/physical evidence must stay separate; required CI currently omits runtime package tests by policy. New WebGPU CI remains held.

## P5 — Advanced geometry and direct editing

Rows [07](../roadmap-rows/07.md), [08](../roadmap-rows/08.md), [24](../roadmap-rows/24.md), [25](../roadmap-rows/25.md), [30](../roadmap-rows/30.md), [31](../roadmap-rows/31.md), [34](../roadmap-rows/34.md). CAD/High owns Boolean/B-rep/tolerance authority. Model and Studio follow only after a typed producer/consumer contract exists. Ordinary shell, sweep, Loft, Thread and sheet-metal baselines remain listed under P1; they are not absent or waiting for a general rewrite.

| Family | Existing versus future scope | Finite acceptance gate |
| --- | --- | --- |
| General Boolean/blend/shell/thicken | Restricted native producers and ordinary finishing are implemented; arbitrary contact, mixed carriers and general offset behavior remain separate. | Name one admitted or reproducibly blocked input. Preserve native boundary, topology, mass and original tolerances; test failure retention and the actual Studio edit/history/Open consumer. No repair or widening is implicit. |
| Guided/curved Loft, sweep and NURBS | Existing supported profiles remain, including [D492](../notes/part-profile-solid-extraction-2026-11-04/README.md) and [D494](../notes/part-native-face-finish-extraction-2026-11-04/README.md) source extractions. General rational/multi-span/frame and Class-A breadth is not certified. | Separate representation/admission from geometry and quality. A new profile needs independent native boundaries/derivatives where claimed, seam/trim ownership, refusal and real editable Studio/file evidence. |
| Surface editing and solid direct edit | Existing surface tools do not establish general solid-face move/delete/replace/push-pull with surrounding-face extension. [Row31](../roadmap-rows/31.md) remains the dedicated scope. | Declare the supported face/carrier family; verify topology/reference retention, native validity, actual edit/Undo/Open, and original retention on failure. No generic FaceUV/stable-topology promise. |
| Tolerance stack-up | Drawing tolerances and static assembly exist; general accumulation is a future consumer. [Row25](../roadmap-rows/25.md). | One hand-checkable chain with explicit units and tolerance assumptions; refuse missing/invalid tolerance inputs. Report geometric versus printed tolerances separately. |
| API units and naming | Current public APIs and compatibility surfaces exist. [Row34](../roadmap-rows/34.md). | Inventory actual units/frame semantics before changing names. Preserve callers or declare a reviewed compatibility change; verify types, independent consumer and actual Studio usage. No schema migration follows from a rename. |

Explicit HOLDs include #2258 public-thicken/fitter, #2266 widening and broad NURBS/fitter expansion. A future unsupported profile is not automatically an owner HOLD; it first needs requirements and authority review. Conversely, existing implementation does not lift an explicit HOLD. No WASM/backend adoption is authorized by external product comparisons.

## P6 — Real files, formats, catalogs and collaboration

Rows [26](../roadmap-rows/26.md), [28](../roadmap-rows/28.md), [29](../roadmap-rows/29.md). Interop/Model own admission and identity; file/Studio owners own atomic state; catalog/PDM requirements need an identified owner and authorized data/service boundary.

1. **Customer-file regression:** use owner-provided eligible files with provenance and allowed retention. Pin original bytes, supported features and expected loss/refusal. Check independent reads and current Studio behavior; never replace originals or download a convenient substitute.
2. **Additional exchange:** define each format/profile's units, transforms, geometry and metadata support/loss table. Retain existing ordinary STEP/STL/3MF profiles. Nonzero-cone offset expansion and ASME PDF mismatch remain HOLD; general DWG/standards support is not inferred from drafting references.
3. **Standard parts/catalogs:** distinguish existing procedural parts from person-loaded supplier rows. Require source/license/units and an actual insert/edit/reopen consumer. Positive tapped-row acceptance remains NOT_RUN without an eligible loaded row; no invented shipped catalog or automatic data download.
4. **Collaboration/PDM:** local projects, versions and linked sources already exist. Multi-user conflicts, roles, server ownership and external lifecycle are separate. Declare the supported conflict/merge case; prove that stale completion cannot replace a newer current document, and that refusal preserves local work. P0 file ownership is a prerequisite.

Close only the named file/profile/catalog/conflict case. New SDK/dependency/server adoption, outbound download and paid live service use retain their owner gates. Do not claim global customer-file or format coverage from one fixture.

## Separate parallel track — CAD React

Rows 04/05/16/32. The private package uses ordinary ReactDOM components, the existing Model contract, an injected Worker port and the existing Viewer facade. It is not a custom renderer or a bundled general Worker SDK. [D509](../notes/cad-react-profile-composition-2026-11-04/README.md) records 19 logical elements, selected all-six Profile composition, preserved old lowerings and finite current Viewer/Studio proof. Its remaining readability/settled-color documentation limits stay explicit.

First settle P0-R08/R09's React failure/ownership contracts. Then select a small dependency-ordered batch from the [domain design](../../../../packages/barocss-cad-react/design/README.md). Each real component needs typed source/output capabilities, grammar/defaults/units, refs/scopes/staged IDs, no orphan native emission, cycle/reorder/invalid-retention/recovery controls and backward compatibility. Proposed Regions and other design names stay unexported until their actual output/capability contract is qualified.

Finite batch acceptance: focused real ReactDOM and API tests; actual props change/refusal/recovery/Reset through the existing Viewer; numeric native oracle only for claimed geometry; exact returned-document current Studio consumer; one page/sidebar entry per component and fresh actual example types/docs. A reusable user component is not a new built-in. No claim that all Model storage kinds or arbitrary hidden Suspense intent are supported.

## Separate parallel track — Physics library

[D518 investigation](../notes/physics-exact04-takeover-audit-2026-11-04/README.md) distinguishes published inheritance from local EXACT04 Work. The local candidate remains unadopted. Complete its declared checkpoint/archive and source eligibility first; then separately qualify represented versus physical-J/rank behavior. The represented 10 / physical 9 and tilted 490 represented 8 / physical 7 gaps remain unresolved.

The Physics owner must define the exact public profile, physical oracle, body/frame/units and integration consumer. Source transfer, compiled consumer, physical result and Studio activation are different acceptance decisions. Library investigation/qualification is authorized; Studio Physics/Motion activation remains HOLD. Do not infer parity or adopt Rust/WASM from competitors' declared technology choices.

## Separate parallel track — AI, CLI, MCP and scripts

Rows [04](../roadmap-rows/04.md), [12](../roadmap-rows/12.md), [16](../roadmap-rows/16.md), [29](../roadmap-rows/29.md). Existing [CLI](../../scripts/cad-cli.mjs), [MCP](../../scripts/cad-mcp.mjs), [chat service](../../scripts/chat-server.mjs) and [Model commands](../../../../packages/barocss-cad-model/src/app/commands.ts) are the starting surfaces. Automation is neither absent nor a reason to add a new agent framework.

Acceptance must use the same typed core, Doc, reference, history, refusal and Undo contracts as manual Studio. For one declared command/batch: inspect the current source/revision, submit valid operations, reject an invalid member atomically or explicitly report the declared partial result, and retain the accepted document on failure. Delay completion, switch document, then verify the old job cannot overwrite current work. Reinspect results through the public current-source path and qualify first Undo/Redo plus own Save/Open where persistence is claimed.

Keep controlled adapters separate from paid live model/service proof. No paid live execution, new framework, automatic network download or implicit remote write is required by this roadmap. Cross-surface automation acceptance does not certify model intelligence, general agent autonomy or multi-user PDM.

## Selection and reporting contract

Use SMALL for a bounded private repair, FEATURE for new behavior/integration and FULL for changed public/geometry authority. Name requirement owners, consumed producer/consumer inputs and affected checks before execution. Add High geometry review when Boolean/B-rep/tolerance judgment is needed. Actual desktop Studio is required for a claimed Studio workflow; independent numeric/file authority is required for numeric/exchange claims. Do not repeat full suites solely because handover prose changed.

Keep implementation, controlled checks, compiled consumer, native physics, actual product, docs, remote publication and release as separate status fields. Preserve first failures and explicit NOT_RUN/UNKNOWN. Competitor feature lists are declared claims only; root owns their source comparison and the finite B01..B10 baseline, initially NOT_ADJUDICATED. No percentage or parity claim follows.

## Desktop Studio usability audit follow-up

A separate Chrome/WebGPU audit on `a3b3f256c` observed these P4 gaps. Route sketch and document loss through [P0 reliability](01-reliability.md).

- D665. Drawing toolbar, rows 02 and 21. The collapsed chat rail covered nine drawing tools at 1440×900, leaving 7 of 34 px visible per button. Check full button visibility at 1440×900 and 1280×720. Pointer and keyboard tool activation, linear dimension placement and Fit sheet passed. [D665 PASS](../notes/studio-drawing-toolbar-inset-2026-11-11/README.md).
- D666. More tools keyboard, row 21. At 1280×720 and 1024×768, Enter opened the menu, focus stayed on its container and Escape did not restore trigger focus. Check first enabled item, arrows, Enter and Escape. Open Export STEP and Insert part with the keyboard.
- Context and focus, row 21 and [#2287](https://github.com/barocss/barocss/issues/2287). Check model framing against the visible work area, tool group collapse, view cube keyboard access, Ortho/AO pressed state and Browser focus after Space or Escape. The audit observed duplicate chat startup instructions. Review each item with its own product acceptance.
