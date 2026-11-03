---
work_id: D484
artifact_type: part-prismatic-detail-extraction
status: qualified
owner_role: executor
source_request: "Owner requested the next queued part-model profile/detail split after D482 and D483"
last_updated: 2026-11-04
---

# D484 — Extract existing prismatic detail cases

SMALL mechanical maintenance for rows08/16/30. Rib, Profile relief and Rectangular relief move to one internal `part-prismatic-detail.ts` family. `part-model.ts` is reduced1417→1348 lines; the new family has101 lines. The exact73 original case lines and70 old exports are retained. Parent is `bcaa200cdd332999ca7943f61f24ffdf5aec7838`, plus the two known CAD candidate files during proof. No feature, geometry admission, public API or percentage is added. [Qualification](qualification.json) pins source and evidence. High final saved-data review accepts **ACCEPT_D484_NEW_CURRENT_PUBLIC_ONE_A_TEXT_RELIEF_SIX_BINDINGS**, SHA`bdec5cacd96e1846852367eb1f7fcf23f610c0f6d65360e92e0bcf1826ef4f24`. This audit reads saved data only and adds no product or oracle run.

## Mechanical and initialization boundary

The three original case bodies, comments, validations, messages, helper calls and deferred closures are exact. Their mutually exclusive kind labels are grouped before Cylindrical wrap; literal order of every old label is not claimed unchanged. Every unaffected case remains in its original order. `profileRelief` and its type move to the family because these cases were their sole parent uses.

The original `lineOnly`, `brepOf`, `boxSolid`, `boolean`, `empty`, `exactVolume` and `CadPartLimits` stay with the runtime owner. One private module-level frozen bag passes their original references after dependent constants initialize. The family has no runtime value import back to the model. The parent's one/many wrappers remain unchanged; the family's stateless module-level one wrapper retains its original body. No per-feature helper object is added. Admission, dependency collection, expected-reference wrapping, cache, output state, Boolean/facet/profiling state and native-SI behavior remain in the parent. In particular, profile-relief's `brepOf(target[0], at)` remains inside the deferred compute closure.

Source AST proof establishes exact moved branches, unchanged remaining owner AST,70 old exports and the final frozen helper bag. Whole emitted JavaScript byte equality is not claimed across the new function boundary. D479's type-only equivalence and D480's separate extraction evidence remain separate.

## Checks

Root runs `bash /tmp/barocss-d484-root/run-checks01.sh`; nine primary commands pass: AST proof; full semantic CAD library build;41 CAD tests in seven existing files;31 affected Model tests in five files; two fresh initialization orders; full CAD lint; StudioTSC; final ModelTSC; diff check. Fresh family→parent and parent→family processes evaluate only the existing K06 rib fixture with its original volume12200 and1e−9 relative tolerance. No permanent mirror test, optional parent/current geometry-pair campaign, whole-kernel rerun or new variant is added for this extraction. The primary receipt is `/tmp/barocss-d484-checks01/receipt.json`, SHA`6acf4a0d1334a67eed76c99fa4598992d0d3825114445ac90cba1e251f376b00`.

## One fresh affected desktop profile

Root runs `bash /tmp/barocss-d484-root/run-studio03.sh`. This is **NEW actual public construction**, following the existing D296 Latin A profile. The missing historical full StudioDoc/font custody is not reused as an input receipt. Public Box40×30×10 is created with its original `made` provenance; the original native top cap is selected by mouse. Text relief uses the existing local46016-byte ABeeZee font, A, em10, at[5,5], tracking0 and tolerance0.002. Font SHA is `2901c8df256648cc2bb2e3afb381cb8d28e65ed3dbe11de20695ae4d5ffdeda9`. An independent current fontTools4.67.0 reference uses the existing uv cache; no tool or font is downloaded or installed. Its reference receipt SHA is `9b8c6ca76e33fc4c75e389b8ac0efc35321a784408f74cf55f6a50f9e05a355c`.

Root prepares the map/font reference with `bash /tmp/barocss-d484-root/run-map01.sh`; the corrected saved-Doc map-rebind02 postprocess receipt has SHA`f5783b65eea1c601fa2bb921738114fcafc348b3e638d3cd4fdae4bd06eb855e`. The independent straight-outline A area is148797 design units² at unitsPerEm1000, so em10 gives area14.8797mm². The base volume is40×30×10=12000mm³. Adding this area times depth2 gives12029.7594; removing it times depth1.5 gives11977.68045; removing it times depth2 gives11970.2406mm³. Font-derived exact first moments and the unchanged placement/extrusion formulas give the centroid and native carrier references; observed native or Worker output does not define these expectations.

Six groups pass: public emboss depth2 with outside-X39 preview refusal; FIRST Undo to the base; Redo emboss2; History edit to engrave1.5; own portable-font project Save/Close/same-context reload/Open; postOpen engrave2. Four native captures and two exact-whole-Doc reuses provide six fresh native/reference/Worker bindings. Native strict B-reps and the independent reference are physical authority; Worker volume/centroid agreement is consumer coherence. Worker maximum volume/centroid errors are0. Native/raw maximum errors are volume3.637978807091713e−12, centroid1.0658141036401503e−14, bounds0, pcurve3.552713678800501e−15, plane4.440892098500626e−16 and side area1.7763568394002505e−14. Existing physical criteria are unchanged.

Absolute budgets are native volume1e−8, Worker volume1e−7, centroid/bounds/carriers/pcurve1e−9 and side area1e−8. Exact whole-Doc and authored font/reference/ID checks are not replaced by these numerical budgets. Sol Medium owns source and driver preparation; Sol High owns geometry readiness/final saved-data review; root owns execution, custody and images.

The46896-byte BCADPACK, SHA`55aa4bb3260b5d004b5d634beb212f57ccd60c1996e0dd516357c54f74e8fb1d`, embeds the exact original font once at offset880. It is owned same-context project evidence, not a download/export. Actual receipt SHA is `107dc4e918af1dba074353edc8037670f1fff8de9596825a0caf75ad79e42038`; config SHA is `f77cae7f4d3e9d3159713f0492c41acfbd72296378822666d6c51bf9e2f5955d`.

Root reviews eight images: A appears, disappears on FIRST Undo, returns on Redo, and remains engraved after History edit, project Open and postOpen edit. The palette partly occludes the stock, so complete viewport fit is NOT_MEASURED. Wrapper3047/helper2581 source pins remain equal through cleanup/current. Owned namespace D484-text-run03 is removed and absent; context/browser/server close; PID73377 is absent. Errors, console errors, downloads and watched changes are0. Root review SHA is `34bc48831df22e39c07c15aaaa70929ce7e7b861778b08b78601d80f58fc5077`.

## Original harness failures and limits

Actual01 stops before real face selection/font upload: the map antecedent omits the public box's `nodes[1].made`. All six physical groups are NOT_RUN. Root preserves that failure and binds the map to the actual full public Doc. The first rebind postcheck uses the old Doc SHA and fails; only the postprocess check is corrected. No product provenance is stripped and no product fix is claimed.

Actual02 passes the first two groups, then exits2 at Redo because deferred Worker `massReady` is stillfalse. Its Redo Doc is byte-exact to the prior emboss Doc; the remaining four groups are NOT_RUN. Actual03 changes only the driver readiness wait, `await f.same(embossed.doc)`, after public Redo. Product and oracle remain unchanged. These failures do not become product fixes or disappear from the evidence.

This qualifies the bounded extraction and one affected A profile. It does not establish actual Studio coverage for Rib/Rectangular relief, general fonts/glyphs/relief admission, complete viewport fit, browser restart, export, CI or release. Mobile is NOT_RUN_OWNER_RULE. Core readiness remains NOT_MEASURED, legacy43% stays frozen, #534 remains an open epic, all owner HOLDs remain, and the ASME PDF investigation stays owner-deferred. Next D485 reviews the next unmet ordinary C3 engineering-handoff acceptance; its profile is selected only after inventorying retained evidence.
