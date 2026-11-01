---
work_id: D406
artifact_type: step-compatibility-qualification
status: done
owner_role: executor
source_request: "Approved native STEP reader build; remove task OCP after tests"
last_updated: 2026-11-01
---

# STEP validation units: fixed and independently read

Baseline `8569f7d5f`. Implementation and checks: GPT-6.1 Sol Medium. Difficult reader-control, C++ and unit diagnosis: GPT-6.1 Sol High. This is a bounded exchange correctness fix, not general STEP/AP242 acceptance.

## Defect and correction

The first native read built and ran with explicitly empty ShapeProcess flags. The box was valid and its geometry matched, but the strict gate failed on **two load failures**: MEASURE_REPRESENTATION_ITEM.unit_component had an illegal type for the pinned OCCT 8.0.1 reader. The writer emitted two-component complex units combining DERIVED_UNIT with VOLUME_UNIT or AREA_UNIT.

`writeValidationProperties` now emits plain DERIVED_UNIT. The elements still reference millimetres at powers 3 and 2. Values, property links, entity IDs, geometric entities and authored tolerances stay unchanged. The fresh box/assembly comparisons show exactly two changed unit entities per file and 28 fewer bytes. This is a necessary correctness change; no general byte-identity claim is made. `validationProperties:false` byte identity was not separately compared.

The pinned reader accepts plain derived units, and OCCT's own validation-property writer uses them: [AddVolume](https://github.com/Open-Cascade-SAS/OCCT/blob/V8_0_1/src/DataExchange/TKDESTEP/STEPConstruct/STEPConstruct_ValidationProps.cxx#L434), [AddArea](https://github.com/Open-Cascade-SAS/OCCT/blob/V8_0_1/src/DataExchange/TKDESTEP/STEPConstruct/STEPConstruct_ValidationProps.cxx#L469). This records a reproduced declared-export/pinned-reader compatibility defect. Modern merged EXPRESS definitions differ; the evidence does not establish a universal ISO prohibition on every complex-unit variant.

## Checks

- **PASS:** old-writer regression control fails 1/1; final affected STEP tests 13/13. The regression follows both measure-unit graphs to mm^3 and mm^2, rather than matching a cosmetic substring. CAD library build, cad-model tsc after final test edit, targeted lint/syntax and diff checks pass.
- **PASS:** native OCCT box: 1 solid, 1 shell, 6 faces, 12 edges, 8 vertices; geometry-enabled BRepCheck valid; signed volume 39999.999999999993; bounds [0,0,0]–[80,50,10]. Volume error -7.275957614183426e-12, bounds error 0.
- **PASS:** native assembly: 3 solids/shells, 18 faces, 36 edges, 24 vertices; whole and each solid valid; total signed volume 3000, each approximately 1000. All three literal placed bounds and aggregate [-20,0,0]–[100,90,5] match, errors 0.
- **PASS:** all four load/transfer warning/failure counts are zero for both files. Sidecars also have NbTotal 0. Unit is mm. Roots transfer completely. Maximum native tolerance recorded is 1e-7; the harness does not change it.
- **PASS:** explicit-set and empty flags before and after transfer. Fixed absolute bounds tolerance 1e-6 mm and volume tolerance 1e-5 mm³. Signed positive volumes required, without absolute-value orientation correction.
- **PASS:** controls: unset/default flags rejected with exit 2 before transfer; truncated STEP rejected at ReadFile with exit 1; valid 80×50×11 solid passes validity/reader diagnostics but fails geometry expectations (volume error 4000, bounds error 1).
- **PASS actual Studio run01:** exact native-checked bytes, box 1 body/V40000 and assembly 3 bodies/V3000, mm notices and no instances after flattened STEP import. Two snapshots; 740 frozen files unchanged; zero page/console errors, source changes or outbound downloads. Root reviewed the assembly image.

## Native build and limits

Owner approved official source at commit `b8f597c677811d1f9f4d8a97f5ae2825c0353a42`. Archive: 45131814 bytes, SHA-256 `dba62b81078dd43cec23feba89432be301582341001edad1b93342ad8bda35ea` (provenance, not a publisher digest). All 178 compile-used headers match official pinned Git blobs/tree `76543d44e49c73bfffa2d141089e6c5add106f9a`. Existing Apple clang 17 compiled one ARM64 C++17 CLI against installed exact-version 8.0.1 dylibs. No OCCT library was built. Only the new CLI's load commands were remapped; installed dylibs were not changed. Actual loader output confirms the intended library path.

Retained setup failures: missing direct TKGeomBase link, and insufficient executable load-command header space (fixed with the linker's headerpad_max_install_names). Those failures do not prove an ABI mismatch. Runtime qualification covers only the exercised controls and prism operations.

The reader disables automatic ShapeProcess postprocessing with explicit empty operation flags. It **does not disable every adjustment inside STEP translation**. Built-in curve recovery and continuity encoding have separate paths. No general zero-repair, curved/offset/seam, AP242 hierarchy/sharing, colours, PMI or named-datum acceptance follows. No issue closes. Full kernel/Studio suites, remote CI, release and outbound Save/Export are **NOT_RUN**. Geometry/B-rep core/public API shape did not change; this is the small bounded metadata-correction tier, with High technical diagnosis.

## Reproduction and cleanup

Raw evidence stays outside the repository:
- original failure and build/header/loader records: `/tmp/barocss-d406-evidence`;
- original and corrected STEP producers: `/tmp/barocss-d406-forward` and `/tmp/barocss-d406-forward-fixed`;
- final native reads and controls: `/tmp/barocss-d406-qualified`;
- valid control STEP: `/tmp/barocss-d406-controls-source`;
- actual Studio: `/tmp/barocss-d406-run01`.

The source tools are `build-step-native-reader.py`, `step-native-reader.cxx`, `qualify-step-native.py` and `step-native-browser.mjs` under `apps/cad-studio/test`. The build tool does not download anything. Reproducible commands and all counts are in [qualification.json](qualification.json). Heavy commands ran one at a time under gate.sh; no worktree writer ran during Studio.

**Cleanup completed after all tests and root review, as requested.** Removed `/Users/user/.cache/barocss-step-reader`, `/tmp/barocss-d406-native-source` (archive/extracted source) and `/tmp/barocss-d406-native-build` (headers/native executable). Absence and preserved evidence were verified; receipt `/tmp/barocss-d406-evidence/cleanup.json`. Dependency-list text was retained; no SDK/library/binary copy was hidden in evidence. Other environments and user data were preserved. Running this external-reader campaign again requires a new approved dependency setup/download; the removed environment is not a current prerequisite satisfied on this machine.

Next row-13 work remains STEP assembly/presentation/loss profiles under #2263; named frames under research #2248 stay separate. D404's structural result and D405's reverse result remain historical bounded evidence.
