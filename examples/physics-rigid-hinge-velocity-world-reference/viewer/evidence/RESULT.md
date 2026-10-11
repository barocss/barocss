# Recorded two-hinge Viewer native result — #1179

## Result

The frozen source and genuine compiled public Viewer consumers both passed one actual Chrome flow. Native execution used clean commit 9330df8fe74accb155706fbb419a4a1aa3866760, Node22.22.0, Chrome155.0.8059.39 and WebGL2. Viewport was1280x900; actual GPU canvas was900x400. This is a saved-data Viewer result. No Physics step or reference model ran in this browser flow.

## Measured gates

Four original body IDs and two joint IDs remained distinct. Viewer frame/bindings/display poses matched recorded frames0,1,60,197,1200 with the selected m-to-mm boundary conversion and unchanged quaternion. Named joint values and signed-zero fields matched saved data. Five independent frustum checks covered all four packet bounds. Three actual GPU readbacks were nonblank and source/compiled byte-identical. Initial/moving/final screenshots were visually inspected: both pairs, per-body colour, orientation witnesses, record cursor, units and joint panels are visible. The proxies are approximate display geometry.

| Mode | Whole native flow (s) | Natural replay wall time (s) | Accepted submissions during natural replay | Recorded advances |
| --- | ---: | ---: | ---: | ---: |
| source | 12.057665791000002 | 10.076087 | 1200 | 1200 |
| compiled | 11.814535957999999 | 10.071099167000002 | 1200 | 1200 |

Natural playback ended at cursor1200, saved time10s, playing=false and pendingRAF=0. These wall times are observed execution durations, not performance qualification. UI Play/Pause/one-frame/Reset passed. Actual WEBGL_lose_context paused and disposed the Viewer while retaining cursor1200 and marking display unknown. Restore did not resume. Explicit Reset created the new Viewer at frame0 with byte-identical initial pixels. Idempotent disposal left all seven tracked resource classes and tracked GPU buffer bytes at zero. No later draw or submission occurred. Page errors, console errors and warnings were empty for both modes. Browser, both pages and both temporary servers closed; no cleanup failure occurred.

Pixel SHA256 at0:37c620759bec864e00c001c9ebf156dd0df00c29d1972b3aa35b32ebe270176a; at60:7dda70f795de4751a5f87178b06e422d3a98764d8030c1fab43860491c4f6a24; at1200:7e0c9189e2fb20e9afa9b165b89250af62487797e70e6ea8e605b5f347c3dee1. Non-background counts are5460/5441/5260. Actual readback size is1,440,000bytes each. The restored initial hash matches cursor0.

## Source, build and data provenance

Immutable native World parent:f40123da0eedb19245688557f865e1beb09d47ef. New consumer commits:880c54a6579f6a14175e6936e592a929ed48abfa (contract), fc118528adc82328c5e2b99c8cfdfe030768974d (authored source/data/driver), 9330df8fe74accb155706fbb419a4a1aa3866760 (actual source/emitted/bundle freeze). Evidence commit follows this run and changes only excluded evidence paths. Original133 World paths remain unchanged.

Complete consumer/provider source closure SHA92e45013780167e2e7f6c2712471b918239bf6a38d899dfdf5c1dd690c22ab61. Provider closure89fb649276e7131876becd0152b70732efe538f6afa57c90ad667dd71ef5d0f5. Emitted708-file closure13f784f2a989bef485d5154a4f76ca89581eb36366b48ee224764ecf2ce74938. Source bundle f84510a31d878e117b9f53222c8eff326faf75e2950114bd1f8c3ed34de94ea3:1,014,862bytes/SRC300/DIST0. Compiled bundle37ac228f3fdd9c9147e42946900aef962cc3a5cdb02e76739e666786ceb24380:1,379,767bytes/SRC0/DIST223. Neither graph imports Physics.

Provider builds ran with fixed provider source at880c54a6. Original CAD succeeded; CAD-interop first failed on missing optional Pixi declarations. Both actual logs and the separate npm cache failure are preserved. Isolated exact declared optional peer types were installed, without repository package/lock changes. The successful original CAD build was reused after provider hash comparison. Actual recovery CAD-interop/GPUtypes/GPUbundle/Viewer all exited0. Dist is owned ignored output. These are provider builds, not a later full-source build claim.

Data extraction ran once:1,201frames/6,507,999bytes, SHA5d24afa5f13aa3e9c015cd1a0ae9788f88cd92653bbcae351b3f3ca0335896f5. Every source/raw locator was authenticated; original native manifest60e389dbce2640f7f28378927f54cd6d2d8af203bcf374d54177a957b91d2191 remains authority. No numerical campaign was repeated. Seven fake-Viewer failure/lifecycle checks passed once before browser work; their index.html hash predates a footer-only clarification. No controller/app/clock logic changed after those checks. Fake checks are separate from the actual browser proof.

## Limits and next dependency

The numerical joint limit at197/time1.641666667s and blocked motors from198 are saved physical records. Replay end1200/time10s is a display event. Public PhysicsWorld still rejects the original four-body/two-hinge input. No general joint network/contact composition, CCD, Box3D parity, release, FPS or current integrated Save/Open/recovery is proven. #1179/#660 remain OPEN; #674/#1254 retain composed follow-ups.

Current Integration was read-only observed atddbd947b852fa709e91b2f7c9510c0061e35ce86; native f401 ancestry returned1. No exact native adoption was found. Candidate providers already differ from the pinned Integration snapshot5fa4a4b5 in10 source files, so this native success is not current Integration acceptance. Required World and Viewer handoffs remain separate. After exact adoption, record merged; integration validation pending. Pending composed UI/file checks alone must not block eligible consumers.

Actual reports, pixels, screenshots, cleanup and their byte/SHA manifest are preserved in native-9330df8f/. Source/emitted ledger and frozen bundles stay unchanged. No product push, PR, deployment or publication occurred.
