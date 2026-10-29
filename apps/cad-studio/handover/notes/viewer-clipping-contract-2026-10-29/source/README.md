# D325 source lane

The original production commit is `d85558ce0031d812341d5871743f8535520eb8d4`. `baseline-source.json` binds the four original source files to Git blobs and SHA-256 values; their exact bytes are preserved in the sibling gzip files. `candidate-source.json` binds the current candidate. The consumer's original native failure is preserved under `../consumers/baseline-first/`.

## Selected contract and candidate

The SDK camera uses scene-unit view depth, with the closed interval `near <= depth <= far`. Geometry's millimetre-to-scene conversion does not rescale the camera's clipping values. Public MeshCamera validation retains its finite bounds and refuses Infinity or null; the Core's original automatic perspective far value is Infinity, which JSON alone cannot distinguish from a null serialization.

Presenter now forwards the admitted near/far and sets its Core camera's `autoClip` to false. The new Camera field defaults to true. The original auto branch still fits scene/grid bounds and calls the original infinite reversed-depth projection. The manual perspective branch changes only its two depth coefficients for a finite far plane; its projection remains reversed WebGPU [0, 1], not the OpenGL MeshCamera matrix.

Manual projection validates its own range with the existing CLIP_INVALID code. Perspective requires a finite positive near and a larger finite far or positive Infinity. Orthographic permits a finite negative or zero near but requires a larger finite far. These checks do not impose the SDK's numeric bounds on Core or change automatic projection validation. Projection retains authored values, including an orthographic negative zero.

Manual pick pipelines retain strict greater depth testing and draw order. Their fragment output retains the raw readback depth, including zero at the finite far plane. A separate fragment-depth value maps only exact zero to `bitcast<f32>(0x00800000u)`, the least positive normal f32, so the first boundary fragment passes the cleared depth and later equal fragments fail. There is no max/clamp of other depths and no change to geometric clipping planes. The original automatic fragment entry bodies remain unchanged. The same manual depth-test separation has an entry for cap picking; complete cap variants are not qualified by this source inspection.

Background remains identified by ID zero, not depth zero. The pending GPU pick snapshot now includes autoClip, retaining the existing unmap-before-stale-return behavior and all prior camera/clip/canvas/instance-scene checks.

## Depth-consumer source review

| Consumer | Source observation | Boundary |
| --- | --- | --- |
| GPU pick reconstruction | Camera inverse view-projection | Generic finite projection; actual shader/readback proof pending |
| SSAO and contact shadows | Output inverse projection and projection | Manual finite mode refuses positive-strength configurations before rendering |
| Depth of field | Inverse projection | Manual finite mode refuses an enabled focus effect before rendering |
| Grid | Inverse view-projection ray and projection | Manual finite mode refuses a visible grid before rendering |
| Caps | View-projection and capDepth range check | Manual capPick entry added; probe/mask/full cap boundary qualification pending |
| Shadows | Independent light projections | Camera finite coefficients do not replace their projection conventions |
| Path tracing | Separate ray camera and transport, not raster depth decode | Manual finite mode refuses creation and rendering with active/creating sessions |
| Core CPU raycast | Direct geometry rays | Existing method does not search/filter by authored near/far; SDK public CPU pick does |

The normal SDK Presenter lighting disables SSAO and does not enable contact shadows, depth of field, or grid. Manual finite mode refuses the unsupported combinations above instead of silently applying the old depth-zero background convention. Existing automatic Core combinations are unchanged. No TAA depth consumer was found in the inspected Viewer source.

The guard runs at prepareCamera before rendering, picking, or submission. It uses existing CLIP_INVALID for a visible grid, positive-strength SSAO/contact shadows, or an enabled focus effect. Active or creating path traces use PATH_TRACE_UNSUPPORTED. createPathTrace also checks before its first await, after loading the module, and after session creation before publication. A session created after the mode changes is disposed; a private pending counter is decremented in finally on all paths. These are guards on the existing Core entry points, not a new global resource protocol.

SDK CPU picking already loops over all triangles and entries. It applies its view-depth interval before updating the nearest hit, so an out-of-range front triangle does not stop the search for an in-range triangle behind it. This is a source observation; the two-square native case is not yet executed. Core CPU raycast retains its original geometry-query contract.

## Current verification boundary

Source edits are limited to GPU camera.ts, viewer.ts, shaders/pick.ts, and SDK presenter.ts. The shader facade needs no new export. The only intended API inventory addition is Camera.autoClip and its nested type observations; the expected inventory is owned by root.

The source owner inspected the candidate diff; `git diff --check` passed. Candidate build, lint, CPU tests, and native WebGPU checks are NOT_RUN by this lane. Root coordinates the test owners. Source inspection is not native clipping, exact-far, equal-instance, cap, or post-processing proof.
