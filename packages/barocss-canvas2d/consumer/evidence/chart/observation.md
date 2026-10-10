# Public clipped chart native observation (#995)

## Contract and source

Wiki C2D-71 `0495e61` preceded Issue/code; logical viewport hit-input correction `5155778` preceded code. Exact separately verified #983 parent `c731a0fd2c3795c85dd2c566e0ec41662ca4b17f`; isolated branch codex/canvas2d-995. Consumer-only host/HTML/MJS/docs/types/evidence; core/schema/manifest and other feature fixtures are unchanged.

Two8-point datasets use x0..7/y0..10 domains, public polyline Path and6x6 Rect marks. Plot is220x130 at(45,40), rotation.14, scale(1,.9), cliptrue. Endpoints outside the domain are intentionally clipped. Scene24 has21nodes/21authored commands, below32/128 host limits. Selection is a12x12 public Path with hitMode:none. The host validates finite bounded data, uses copied candidate trees/data, changes public SeriesA/mark handles in staged candidates, then publishes only accepted scene/data. No general chart/CSV/axes/smoothing/SVG framework is claimed.

## Executed checks

Node22.22.0 affected build203.2KiB passed. Final strict consumer TypeScript/checkJs passed. Focused public/helper probe passed10HOST_DATA cases (including sparse A/B),8HOST_VIEW cases, copied data/view, mapping inverse and transformed point roundtrip, exact snapshot/topology reconstruction, selectionnohit,257commandsSCENE_LIMIT retention, six valid incompatible chart/topology/paint refusals and independent reopened-handle edit. The probe explicitly excludes renderer/GPU/hit order. No full probe or npm pack campaign.

## Actual browser and input

Isolated HeadlessChrome155/WebGL2 logical320x220/backing640x440 DPR2. Initial overlapblue[64,128,255,255] hitstack MarkB3,SeriesB,MarkA3,SeriesA,Plot,Back. Inside Ared[255,64,64,255]; intentionally clipped firstA and outside plot-local sampledark[26,31,41,255]/Backonly. Actual mouse selectedMarkB3 and routed MarkB3→Plot→stage. Nextselection choseSeriesB without a Selection hit. Pan(+18,+10) and zoom1.25 preserved transformed overlap/red/clip samples; actual moved mouse selectedMarkB3. CSS input→viewport→world→plotlocal→data reported(2.9999999738757177,5.000001036061203). Real browser PointerEvent subpixel quantization uses1e-4 data tolerance; pure math checks remain separate. Actual outside plot click routedBack→stage with selectednull.

Actual nonfinite/257command/incompatible-topology controls returned HOST_DATA/SCENE_LIMIT/HOST_CHART, all retainedtrue with no new renderer. A3 changedy5→8 through public candidate Path/mark edits at moved view; Reset restored originaldata/identityview/no selection. A second default-view edit produced red at the new A3 location. Host view/data/selection remain separate from Scene persistence.

## Save/Open and lifetime

Read-only review found Save ignored selection-clear failure. Main fixed changeSelection success reporting and Save early return before final browser replay/types. A controlled unavailable-new-WebGL2-context gate tested this failure on the actual physical Save button: WEBGL_UNAVAILABLE/retainedtrue, MarkB3 and its outline remained accepted, zero download events, savednull. The accepted renderer stayed real WebGL2; the prototype method was restored. This is injected candidate-context failure, not an actual platform allocation failure.

Normal ClearselectionandSave downloaded `saved-document.json`,6353bytes, SHA25668fad6c3252abe400c37908910a7a241f25e2e55c603bbfd3fccf659bf7a2656. Scene and no assets were serialized after accepted selection clearing. Actual Pan/Zoom then chooserOpen of the same file staged a fresh canvas/tree; view resetidentity, selectednull/outlinehidden. All21 IDs and six selected default-view pixel/hit/stack samples (five normal plus editedpoint) exactly matched preOpen. Data was derived from stored M/L commands; restored public SeriesA/mark handles changedy8→5, lastEdit.restoredtrue, and an actual subsequent mouse selectedMarkB3.

Actual chooserOpen of an otherwise valid document with Plotwidth219 was HOST_CHART/retainedtrue and allocated no new renderer. PhysicalDispose yielded creations12/disposals12/live0; an actual disposed-canvas click left submits/renders/pointer counts unchanged. Maxlive display renderers2. No scheduler is used. Source-reviewed chooser generation guards reserve tokens before file.text and ignore stale/Disposed reads; delayed-file and downstream view-rollback fault campaigns were not executed.

Browser errors/warnings0 for the final isolated flow. Screenshot `/tmp/canvas2d-995-restored.png` was visually inspected. `browser-observations.json` stores compact actual observations and `saved-document.json` is the real download. Raw private JSON `/tmp/canvas2d-995-browser.json` retains repeated observations. Private CLI artifacts remain outside the native delta.

## Corrections and tool limits

Host strict narrowing and fixture NodeList iteration errors were corrected. Sparse point arrays now reject as HOST_DATA instead of skipping holes. The first page open happened before fixture creation and returnedHTTP404; that browser was discarded before the final actual flow. A stale CLI reference failed before chooser action; refreshed snapshot resolved it. The negative document preparation initially treated the v1 Scene string as an object, stopped before creating the file and caused a missing-file upload; corrected parsing then ran the successful refusal flow. An initial postrun mouse tolerance1e-9 was too strict for observed1.036e-6 event quantization; it became1e-4 without product/source changes.

Native completion, separate develop integration and publication remain distinct. Preserve merged consumer type entries/docs and #1010 manifest changes on adoption. No broad chart/export quality or publication claim.
