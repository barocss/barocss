# GPU material authoring proposal intake — 2026-10-29

Status: registered followup under existing06/G18.2/G18.3/G15-accept,05 SDK consumers and R7.5b/Studio. No new issue, language, renderer replacement or parallel implementation queue. D327 App decomposition remains the direct owner priority.

Root read all four supplied documents in full (471 lines), copied their exact bytes under [sources](sources/), and recorded original paths/hash/bytes in [source-manifest](source-manifest.json). This is intake, not independent runtime or current-HEAD acceptance. The source review's32 files/18 claims/17 registration entries are reported inventory, not test points; their underlying source-evidence files and full browser raw graph were not independently re-audited here.

## Preserve current support and evidence boundaries

The supplied fixed-d855 review reports existing public materialShader→bounded CSS @shader/@uniform/@fragment/@let/@fn→WGSL→Mesh material patch→raster. Existing Material and Scene material-ID registry are the base. PBR/maps/finish/clearcoat/film/raw base-color WGSL and experimental compute have separate profiles. Studio already has CSS SCENE and @SHADER source editors plus Appearance controls. Scene CSS currently does not bind PBR/maps/stored shaders; this is a connection proposal, not a missing editor or a reason to replace the material model.

The animation correction is preserved: public CPU caller-time TRS clip sampling exists. It is not a live mixer/clock/playback/skinning/morph contract. CSS convenience named-param clamp differs from strict binding refusal; keep both contracts. Current custom shader output is base color, not full vertex/fragment/normal/material/post programming. GLSL lowering is not live GPU-package WebGL2 fallback, and current path tracing refuses custom shaders. Opacity is not physical IOR/transmission/thickness glass.

[The supplied verification](sources/verification.json) reports one immutable-d855 unlit quad fixture with23 assertions, Chrome156/Apple metal-3/Node22: time0 [166,102,95,255] and time1 [224,128,32,255],6084 nonbackground pixels each. Invalid DSL is not applied by the caller and the accepted65536 bytes stay identical. This proves caller non-application at that profile, not atomic GPU compilation/allocation rollback. The548 inputs are547 pinned source plus1 fixture, not548 tests. Pipeline counts/cache lifetime/rawWGSL swap/device-loss/OOM/other backends/full Three parity remain NOT_RUN. Root neither reran this fixture nor viewed its PNGs in this intake. D325 clipping, D326 Open and current App refactor are excluded from its execution source.

## Attach proposal gates to existing work

| Proposal | Existing destination | Bounded acceptance |
|---|---|---|
| GMAT-1 |06/G18.2/G18.3, SDK/Studio docs and test-registration | Explain existing APIs/recipes/backend support; audit intended map CPU/browser registration. Definitions, historical summaries, registered/run/skip remain separate. |
| GMAT-2 |G18.2/G18.3/R7.5b | Optional typed TS/JS helper emits canonical CSS into existing compiler/diagnostics/budgets. Differential wave meaning/layout/errors/budget; no separate language or claim of all Three TSL compatibility. |
| GMAT-3 |R7.5b + Studio existing material-ID/normalization/assets | Small scene selector PBR/stored-shader reference bridge; stable binding and last-good/refusal. No assumed full CSS cascade or new material schema. |
| GMAT-4 |G18.2/material maps + actual Viewer | Sampler DSL requires explicit texture/UV/binding/resource bridge and actual pixels/lifetime. CPU GLSL/WGSL output alone is insufficient. |
| GMAT-5 |G18.3/G15-accept/resource ownership | GPU compile/allocation staging, accepted revision swap, stale result exclusion, cleanup and measured pipeline/cache policy. Caller invalidDSL control does not establish this gate. |
| GMAT-6 |G15 +05 SDK/Studio | One required PBR/vertex/post target with normal/bounds/shadow/pick and original CAD-geometry meaning. Reuse built-in post settings first. |
| GMAT-7 |G15-accept/backend contracts | Physical glass and pathtrace custom subset/backend parity require separate support/refusal/measurement; do not equate alpha or lowerer presence with those features. |

The recommended existing-CSS plus thin code frontend is the report's design proposal. Three TSL adapter cost and renderer/resource context still require a separate measured decision. No runtime dependency, compiler/API or product source is added by this intake.

## Studio UX evidence supplement

[The later supplied runtime followup](sources/studio-runtime-followup.md) was now read in full. It reports fixed d855 public UI6 PASS/0 FAIL/Sketch NOT_RUN1, source1042/escape0/own-dist0, errors0 and owned cleanup. Observed Model/tree/editor-open-close/Render/Drawing/1280 views support existing15/20/21 SUX proposals; Apply area scrolling and simultaneous Drawing/general Inspector columns are observations, not a new geometry or accessibility failure. The linked raw result/source graph/PNGs were not independently rerun or fully re-audited by root. Existing first asset setup failure/guard75 and previous author PNGs remain separate. This supplements [the prior intake](../studio-modernization-intake-2026-10-29/README.md); no modernization, Save/Open, material edit, render work, geometry/GPU correctness or commercial acceptance is implied.

No build/test/browser/process, remote issue/state or cross-chat message was performed by this intake. No implementation priority changed.
