---
work_id: D405
artifact_type: third-party-step-measurement-checkpoint
status: needs_input
owner_role: executor
source_request: "Approved isolated OCP installation and bounded STEP geometry qualification"
last_updated: 2026-11-01
---

# OCP STEP checkpoint: reverse PASS; strict forward CONTROL_BLOCKED

Baseline `962323a09`. Model: GPT-6.1 Sol Medium; difficult no-healing control diagnosis by the parent's Sol High lane. Product code and public/runtime dependencies are unchanged. This is a partial interoperability checkpoint, not completed forward geometry or whole-format acceptance.

## Installation and control boundary

The user explicitly approved the pinned wheel batch from `packages/barocss-cad/test/consumer-requirements.txt` into `/Users/user/.cache/barocss-step-reader`. `pip --only-binary=:all: --require-hashes` installed all 14 pinned distributions. OCP and proxy both report **8.0.1.1.0**; installed dylibs identify OCCT **8.0.1**. Python is **3.13.5**, macOS 15.6.1 ARM64. No pip upgrade, extra fixture download, product dependency change, or paid call occurred. Install log: `/tmp/barocss-d405-install/pip.log`.

**Strict forward geometry is CONTROL_BLOCKED, not FAIL or PASS.** The binding cannot pass or return `std::bitset<18>` in `SetShapeProcessFlags` / `GetShapeProcessFlags`. It raises TypeError. An ordinary default reader cannot prove the required no-healing boundary: OCCT's default reader enables FixShape, and a resource-sequence change or DE fix parameters do not clear that explicit processing flag.

The High lane identified the supported native C++ operation: set an empty `ShapeProcess::OperationsFlags` after ReadFile and before TransferRoots, then verify that the explicit-set flag is true and the bitset is empty. The Python wrapper cannot express this operation. The test harness refuses forward execution rather than silently falling back to default healing. No product STEP was transferred under the default-healing reader, and no tolerance was widened.

Owning OCCT V8_0_1 sources: [reader default](https://github.com/Open-Cascade-SAS/OCCT/blob/V8_0_1/src/DataExchange/TKDESTEP/STEPControl/STEPControl_Reader.cxx#L840), [missing-parameter initialization](https://github.com/Open-Cascade-SAS/OCCT/blob/V8_0_1/src/DataExchange/TKXSBase/XSControl/XSControl_Reader.cxx#L497), [processing flags setter](https://github.com/Open-Cascade-SAS/OCCT/blob/V8_0_1/src/DataExchange/TKXSBase/Transfer/Transfer_ActorOfTransientProcess.cxx#L82). The native reader proposal is `/tmp/barocss-d405-native-prep/README.md`; it is **UNBUILT/UNRUN**. No additional header/source archive was downloaded by D405. Any new download remains outside the approved pip batch.

## Completed measurements

| Check | Result and boundary |
|---|---|
| OCP-created box | **PASS:** 12×7×3 at `[5,-4,2]`; geometry-enabled BRepCheck valid; signed volume 252; BRepGProp/BRepBndLib bounds `[5,-4,2]`–`[17,3,5]`. These measurements are on the newly created OCP shape before STEP writing. |
| OCP STEP writing | **PASS:** STEPControl_Writer transfer/write both IFSelect_RetDone; AP214IS/MM settings; actual file schema AUTOMOTIVE_DESIGN/AP214 and mm declaration; 15407 bytes. No external fixture. |
| Current product importer | **PASS:** exact OCP STEP yields one solid, volume 252, bounds `[5,-4,2]`–`[17,3,5]`. Volume error and all six bounds errors are zero. This is reverse interoperability, not independent validation of the product writer. |
| Actual Studio Open | **PASS run01:** exact input STEP text retained in one import node, one accepted body, volume 252 and mm toast. One snapshot, 735 frozen files equal before/after/cleanup, zero page errors, console errors, source changes and downloads. Export/Save UI **NOT_RUN**. |
| Truncated STEP control | **PASS detection:** fresh STEPControl_Reader.ReadFile returns IFSelect_RetFail with unexpected-end-of-file syntax diagnostic. No TransferRoots or healing is invoked. |
| Valid wrong-dimensions control | **PASS detection:** OCP-created 12×7×4 box is valid, volume 336 and bounds ending at z=6; writer succeeds. Against the fixed 12×7×3 expectation, native comparisons detect volume error 84 and maximum bounds error 1. The unchanged current-importer probe reads the STEP, then exits 1 at its numeric bounds gate `[5,-4,2,17,3,6]` vs `[5,-4,2,17,3,5]`. This is a numeric mismatch control, not a syntax rejection. |
| Forward product box/assembly through strict OCP reader | **NOT_RUN / CONTROL_BLOCKED.** No load/transfer/validity/volume acceptance is claimed for the D404 writer. |
| Forward transferred-shape controls, OCP STEP reimport | **NOT_RUN / CONTROL_BLOCKED.** The two completed controls above do not substitute for strict forward geometry qualification. |

Fixed tolerances from the preparation: absolute bounds **1e-6 mm**, absolute volume **1e-5 mm³**. Signed positive volume is required; no absolute-value orientation correction. Bounds use AddOptimal with triangulation and shape-tolerance expansion disabled, gap 0. OCP8 returns an unbound Bnd_Box::Limits from Get(), so CornerMin/CornerMax read the same calculated box. No healing/sewing/geometry correction was used to turn a failing shape into a pass.

Retained setup failures: initial reverse harness used unsupported schema spelling `AP214` (registered value is `AP214IS`), then hit the unbound Bnd_Box::Limits return. Both were harness/API setup failures, not invalid product geometry. `/tmp/barocss-d405-ocp` and `/tmp/barocss-d405-ocp02` retain those failures; final reverse result is `/tmp/barocss-d405-ocp03`.

## Tools and evidence

Test-only tools: `apps/cad-studio/test/step-ocp-profile.py`, `step-ocp-import.mjs`, `step-ocp-negative-controls.py`, `step-ocp-browser.mjs`. The OCP geometry harness imports no product code. Its default forward mode explicitly stops at the missing no-healing control; `--reverse-only` produces the valid local fixture and records the forward limitation.

- API evidence: `/tmp/barocss-d405-api/{probe.json,flags.txt,no-heal-api.txt,fix-mode-api.txt,writer-schema.txt}`.
- Native reverse receipt and local STEP: `/tmp/barocss-d405-ocp03/{ocp-readback.json,ocp-box.step}`.
- Product reverse read: `/tmp/barocss-d405-import/import.stdout.json`.
- Controls: `/tmp/barocss-d405-controls-final/{negative-controls.json,wrong-import.stderr.txt}`.
- Studio: `/tmp/barocss-d405-run01/{receipt.json,01-ocp-step-opened.png}`.

Run the approved interpreter and Node22.19.0, under the serial heavy gate:

```sh
/Users/user/.cache/barocss-step-reader/bin/python -I apps/cad-studio/test/step-ocp-profile.py /tmp/barocss-d405-forward /tmp/barocss-d405-ocp03 --reverse-only
node apps/cad-studio/test/step-ocp-import.mjs /tmp/barocss-d405-ocp03/ocp-box.step /tmp/barocss-d405-import
/Users/user/.cache/barocss-step-reader/bin/python -I apps/cad-studio/test/step-ocp-negative-controls.py /tmp/barocss-d405-controls-final /tmp/barocss-d405-import/import-probe.mjs /Users/user/Library/pnpm/nodejs/22.19.0/bin/node
```

After freezing all writers, from `apps/cad-studio` with the supplied PW_DIR and CHROME:

```sh
STEP_OCP_SOURCE_FROZEN=1 node test/step-ocp-browser.mjs /tmp/barocss-d405-run01 /tmp/barocss-d405-ocp03/ocp-box.step /tmp/barocss-d405-import
```

No broad baseline suites were rerun. AP242 assembly sharing, colour/PMI/datum preservation, curved surfaces, offsets and seam coverage remain outside this checkpoint. D404 structural graph evidence remains separate from strict third-party geometric evidence. #2263 and research #2248 have no closure evidence here.
