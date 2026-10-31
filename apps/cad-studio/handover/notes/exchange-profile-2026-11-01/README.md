---
work_id: D404
artifact_type: exchange-support-matrix
status: qa_ready
owner_role: executor
source_request: "Row 13 CG7 initial support and independent-reader measurement"
last_updated: 2026-11-01
---

# Exchange profiles: bounded initial measurement

Source baseline: `822e55eec`. Model used: GPT-6.1 Sol Medium. No product implementation changed.
This is a support inventory and two prismatic STEP measurements, not whole-format acceptance.
`MEASURED` below means this run. `SELF_READ` uses the product's own importer. `SOURCE_ONLY` means current source inspection, with no fresh interoperability run.

## Support matrix

| Profile | Current boundary | Evidence in D404 |
|---|---|---|
| STEP exact B-rep | Writer produces AP214, one product containing solids. Reader supports its bounded analytic/B-spline solid profile. | **MEASURED:** box and nested assembly bytes; independent graph/vertex bounds; **SELF_READ:** solid counts, bounds and volumes. Studio Open measured for assembly. |
| STEP AP242 tessellation | `meshes: tessellated`, or sufficiently large/mixed facet bodies under `auto`, writes triangulated faces. `stepMeshes` reads mesh-only files; Studio diagnoses meshes and may require repair. | **SOURCE_ONLY.** No new AP242 bytes or independent tessellation-reader check. AP242 assembly/PMI support is not established. |
| STEP assemblies and shared definitions | Export collects placed B-reps into one product; import creates solid bodies. Native hierarchy and definition sharing are not carried through this path. | **MEASURED:** native paths `loose`, `sub/a`, `sub/b` share one definition; STEP has PRODUCT 1, solids 3, and no occurrence/mapping entities. Positions survive as baked coordinates. This is flattening, not assembly preservation. |
| STEP names and colours | Output has a product name and generated face names; occurrence/body labels and appearance are not assembly metadata in this path. | **MEASURED:** coloured/named native definition and occurrences become one import node without instances/body looks. No STYLED_ITEM/COLOUR_RGB in emitted graph; Open explicitly warns of loss. Generated face names are not a preserved user naming system. |
| STEP sheets | Base band sheets are omitted with a warning; placed bands are currently refused by the flattening guard. | **MEASURED:** valid base definition has two solids and a band; output has two solids plus `omitted`. Direct placed-band export, alone and with a root solid, refuses BAD_REFERENCE. Static silent-drop suspicion **NOT_REPRODUCED** in this profile. A sheet-only Studio definition was not manufactured by overriding its derived leaf outputs. |
| STEP PMI and named datum/UCS | Writer takes B-reps and generic representation placements; no semantic PMI/named-datum transfer route was found in the checked writer/reader. AXIS2_PLACEMENT_3D is not proof of user-named datum preservation. | **SOURCE_ONLY:** unsupported transfer in this path. No PMI/datum input fixture was measured. #2248 remains research. |
| STEP offsets, vertex/seam profiles | Reader follows supported surface/seam curves, and has bounded periodic-face splitting. Unsupported surface kinds are refused; offset-surface/general seam/vertex coverage is not established here. | **SOURCE_ONLY.** The prisms do not test these profiles. #2263 remains incomplete. |
| STEP units and history | Writer declares millimetres. Studio handles selected SI prefixes and named inch/foot conversions. Imported geometry is not native parametric history. | **MEASURED:** emitted mm and unchanged mm coordinates; import replaces hierarchy/history with one import node. Other-unit conversion is **SOURCE_ONLY**. |
| IGES | Bounded untransformed open rational B-spline curves/surfaces (126/128), mm, non-solid geometry. Direct export accepts at most 16 visible objects; a visible trimmed surface refuses the whole export. | **SOURCE_ONLY.** No fresh IGES bytes, trim-refusal run or independent geometry-reader check. |
| STL | Binary tessellation output; binary/ASCII triangle import. No embedded unit, colour, source-feature or assembly semantics. Studio asks for mesh units. | **SOURCE_ONLY.** No fresh STL export/import/reader check. |
| 3MF | Slicer output has mesh objects, materials/colours and print placement, with piece splitting. A 3MF Open route is not exposed in the checked Studio input. | **SOURCE_ONLY.** No independent slicer/3MF check; no CAD history or assembly-structure acceptance. |
| DXF | 2D drawing output supports AC1015/R12 with explicit conversions/refusals; bounded sketch/underlay reading is separate from solid import. | **SOURCE_ONLY.** Cached ezdxf availability is not a D404 DXF pass. |
| SVG | 2D drawing/sheet output, not a solid/history exchange path. | **SOURCE_ONLY.** No fresh SVG interoperability measurement. |
| Generic glTF/GLB and USDZ | No generic CAD Open/export route for these formats appears in the checked Studio routes. The GPU viewer has a separate bounded GLB 2.0 scene adapter (metres, +Y up); that is not CAD interchange. | **SOURCE_ONLY.** No generic glTF/USDZ acceptance or conversion claim. |
| Robot USDA | Dedicated robot exporter writes text USDA with UsdPhysics, meshes, mass/inertia and joints; metres/kilograms, Z up. This is separate from generic USDZ packaging or generic CAD assembly exchange. | **SOURCE_ONLY.** Cached OpenUSD availability is not a new robot-USD reader pass. |

Owning sources: `packages/barocss-cad/src/io/{step,step-import,iges,iges-import}.ts`; `packages/barocss-cad-model/src/engine/{evaluate,stepUnits,direct}.ts`; `src/print/export3mf.ts`, `src/io/{dxf,svg}.ts`, `src/sketch/dxfRead.ts`, `src/robot/usd.ts` in cad-model; `apps/cad-studio/src/files/{importedFile,useModelExports}.ts`; Studio's Model file input and `robot/useRobotExports.ts`; `packages/barocss-gpu/src/viewer/glb-scene.ts`.

## Measured fixtures and independent checks

Tools: `apps/cad-studio/test/exchange-profile-producer.mjs`, `part21-prism-check.py`, `exchange-profile-browser.mjs`.
Raw artifacts: `/tmp/barocss-d404-measure02`, `/tmp/barocss-d404-focused`, `/tmp/barocss-d404-run01`.

- Box: 80 × 50 × 10; analytic bounds `[0,0,0]`–`[80,50,10]`; analytic volume 40000. STEP 6551 bytes, 152 entities, PRODUCT 1, MANIFOLD_SOLID_BREP 1, VERTEX_POINT 8.
- Assembly: three occurrences of one 10 × 20 × 5 prism; one loose occurrence and two inside a rotated subassembly. The definition has a user body name and colour. Shared part id is `shared-prism`.
- Analytic occurrence bounds: `[80,0,0]`–`[100,10,5]`, `[-20,50,0]`–`[0,60,5]`, `[-10,70,0]`–`[0,90,5]`; total bounds `[-20,0,0]`–`[100,90,5]`. Analytic volume 3000.
- Assembly STEP: 14541 bytes, 369 entities, PRODUCT 1, solids 3, vertices 24. Independent graph/vertex bounds match all three analytic boxes, including their 90° rotations and translations.
- Numeric comparison tolerances: coordinate/bounds 1e-7 mm; SELF_READ volume 1e-5 mm³.
- **SELF_READ only:** product reimport returns 1/3 bodies and volumes 40000 / 2999.9999999999995, with matching per-solid/aggregate bounds. These are not independently calculated volumes.
- **Independent reader:** Python stdlib only, zero product imports. It lexes strings/escaped quotes/comments before reading DATA records, checks positive/unique IDs and all references, AP214 schema, mm length unit, entity counts and reachable prism vertex bounds. It does not evaluate STEP surfaces, prove manifold topology, or calculate volume. Arbitrary rotations/curved bounds are outside its profile. This is an independently written structural checker, not third-party geometric acceptance.
- For **each** STEP fixture, baseline plus escaped-string/comment decoy passes; five negative controls are detected. Actual reasons: dangling reference → `dangling reference #999999999 from #16`; duplicate ID → `duplicate id #1`; coordinate alteration with valid syntax/references → `aggregate vertex bounds mismatch`; unit alteration → `expected one declared millimetre length unit`; schema alteration → `unexpected schema [...]`. Hashes are provenance only.
- **Actual Studio run01 PASS:** native hierarchy/three evaluated occurrences visible; opening producer STEP yields three solids, one import node, no instances/body looks, and the explicit colour/name/assembly-loss toast. Two snapshots; 737 frozen files equal before/after/cleanup; zero page errors, console errors, file changes and downloads. Outbound Export/Save UI **NOT_RUN**.
- First scratch band probes were not used for conclusions: a pre-export flatten call could mask the exporter's own outcome. The final producer calls exportStudioStep directly for valid band definitions. No band/assembly geometry fix was attempted.

## Available reader paths and remaining boundary

Known paths checked: `/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python` is absent. `/opt/homebrew/opt/python@3.13/bin/python3.13` has no OCP/OCC/cadquery/trimesh/pygltflib modules. Existing `/Users/user/.cache/barocss-usd/bin/python` reports OpenUSD 26.8; `/Users/user/.cache/barocss-ezdxf/bin/python` reports ezdxf 1.4.5. These are specific checked environments, not an exhaustive machine inventory. No installs or downloads occurred. OCP geometric validation, other-format independent runs, broader STEP corpus and remote CI are **NOT_RUN**. #2263 and research #2248 have no closure evidence from D404.

Reproduce from repository root with Node 22.19.0, under the heavy gate:

```sh
node apps/cad-studio/test/exchange-profile-producer.mjs /tmp/barocss-d404-measure02
python3 -I apps/cad-studio/test/part21-prism-check.py /tmp/barocss-d404-measure02/box.step /tmp/barocss-d404-measure02/box-expected.json --selftest
python3 -I apps/cad-studio/test/part21-prism-check.py /tmp/barocss-d404-measure02/assembly.step /tmp/barocss-d404-measure02/assembly-expected.json --selftest
```

Then freeze all writers and run from `apps/cad-studio` with the supplied PW_DIR and CHROME:

```sh
EXCHANGE_PROFILE_SOURCE_FROZEN=1 node test/exchange-profile-browser.mjs /tmp/barocss-d404-run01 /tmp/barocss-d404-measure02
```
