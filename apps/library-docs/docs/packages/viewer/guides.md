# Load, measure and manage Viewer lifetime

[Authored directional lights](./authored-directional-lights) — Complete native documents, raw materials and authored lights through the explicit asynchronous required-WebGPU facade.

[Native points and display pose](./display-pose) — Measure original native points, apply a separate display pose and select a projected point in the actual 3D view.

## Choose the load profile

Use `loadNative` for bounded Source0 preview. Use `loadDocument(result,options)` for a qualified canonical CAD document, and `loadModelSet(result)` for the loader's qualified model-set result. These modes have different admission profiles. URL loads remain caller-owned network operations; cancel obsolete requests yourself.

`replaceNativeScene` replaces complete original native authority and explicit display settings together. It does not promote a packet to native source. `setPackets` validates display packet shape and has no native origin proof.

## Measure original native points

Use `measureNativePoints` with tagged Surface or Curve references and original U/V or t. The returned native XYZ and straight point distance are in millimetres. A Curve chord is not length along the Curve. Original Surface evaluation is not assembly/display pose measurement.

For independent qualified Face assets, use source-pinned `measureQualifiedFacePoints`, `projectQualifiedFacePoint`, `fitQualifiedFace` and `sampleQualifiedFace`. Pins contain exact source text and original IDs. Screen sampling obtains approximate U/V from the sampled triangle, then evaluates the original Surface. Keep display intersection, chosen parameters and evaluated native XYZ separate.

## Fit and select

`fit()` uses visible displayed geometry. `fitGeometry(ref)` frames one admitted geometry. Selection and visibility use qualified references; a surfaceId alone is insufficient across models/assets. A bound Surface material can block selection until the material is cleared. Qualified Face/Shell/mixed modes have explicit selection restrictions; use their matching APIs.

## Display caller-owned simulation

Physics outputs metres. Viewer cloth/fluid adapters copy supported frame data and convert once by `1000 * mmToSceneUnit`. A context ID and scene revision distinguish generations. The host owns the world, fixed-step clock and layer reset. These layers do not turn the displayed Surface into exact simulation collision geometry. Clear an old layer before changing its context.

## Clear and dispose

`clear()` draws a blank background frame and clears loaded authority, selection, poses and measurements while retaining accepted view/background/scale/lighting. It supersedes older pending native URL results. `getState().status` becomes `empty`. The initial no-renderer state and an explicit clear are different.

Dispose pointer/keyboard adapters and Viewer on document close. Context loss or unavailable presentation retains only the documented authority for that mode; old pixels are not promised. Explicitly reconstruct a supported Viewer/provider path for recovery. Do not use a disposed object.

`packages/barocss-viewer/package.json` (Manifest and version; local source) · `packages/barocss-viewer/README.md` (Package task notes; local source)
