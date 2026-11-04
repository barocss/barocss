---
work_id: D429
artifact_type: viewer-orthographic-depth-conditioning
status: qualified-bounded-fixture-and-compatibility-profiles
owner_role: executor
source_request: "Continue the roadmap and report row and overall progress"
last_updated: 2026-11-02
---

# Viewer orthographic depth conditioning — bounded qualification

D429 corrects the centered tiny-body artifact measured by [D428](../orthographic-ao-artifact-2026-11-02/README.md) on rows 6, 13 and 16. Overall progress stays about43%. [Source hashes, commands, numbers and limits](qualification.json).

Viewer automatic orthographic clipping now uses the box's support along the view direction: `q=sum(abs(forward_i)*halfExtent_i)`. The original signed depth range, 1.05 padding and 1e-6 support floor remain. Lateral helper width no longer supplies a full sphere radius to this depth calculation. Public `Camera.clip` is byte-unchanged; private Viewer refinement follows it and precedes the unchanged grid extension. Full cap depth bounds and manual guards remain.

Any visible non-disposed label mesh retains legacy clipping, including unbounded labels. Plane glyphs can extend beyond anchor-only bounds. Invalid, collapsed or unusable packed candidates also retain the original result. Guards cover ordered finite inputs, packed projection/inverse scales, packed inverse endpoint distinction and eight simulated packed-Z corner depths. They are conservative source arithmetic checks, not certification of the complete GPU vertex/FMA/MSAA/bias/reconstruction path. An invalid legacy result is preserved, not newly certified.

PASS: 88 focused CPU tests (27 new,61 existing), independent17 endpoint/corner/compatibility checks, four assertion-killed source mutants with no crashes/survivors, GPU build/types/lint, final Model/Studio types and driver syntax/lint. The old implementation fails12 of27 new tests numerically; its original compiled Viewer matches independently transpiled baseline bytes. One temporary independent-runner SyntaxError occurred before candidate tests ran; its log remains preserved. The corrected runner passed without product edits.

Four affected real Viewer browser profiles pass: clip caps/area/picks, multiple clip planes and oblique sections, cap shadows versus the equivalent cube, and orthographic depth of field at DPR1/AAfalse including resize/off restoration. This is4 measured profiles, not every renderer permutation.

The actual Studio run uses four fresh contexts: ordinary Bracket Top/Iso orthographic, and the original centered radius-.001mm STEP in perspective/Top orthographic. All40 genuine face/body pointer picks pass. Public hide/Undo preserves native arrays and restores the exact document, helpers, effects, scene and camera pose. The tiny perspective pose, projection, raster clip, volume and centroid exactly match accepted D427 evidence.

Tiny Top orthographic keeps AO radius1/strength.9, ground bounded and visible, grid visible, and the SAME wide scene radius28.28850029. Raster clipping becomes +/-0.0432411742285mm while all ground corners remain inside nominal depth. The predeclared fixed80x80 interior-region artifact criteria pass: mean absolute second difference0.45503914<1 and fraction above1.5 is0.0028125<.02 (D428 original6.93495348/.843125). This region's bytes equal D428's clean experimental narrower-range AO-ON region; no effect is disabled. Ordinary grid-dominated ranges remain +/-901.18409119mm.

All791 frozen source files match through cleanup. Page/console errors, changes and downloads are zero. Four contexts, browser and server close and the own lease releases. Root viewed the four full-page profiles, visible images and selected hidden/restored controls; independent actual review has its own bounded findings. Raw images, source responses, receipts, bundles and logs stay under `/tmp`.

Qualification covers these fixture artifact/visibility/selection and compatibility profiles. General image quality, label-scene artifact correction, far-coordinate GPU framing/picking and complete numeric certification remain open. Full-kernel checks are NOT_RUN because B-rep core is unchanged; D424 is the latest full-kernel checkpoint. GL is NOT_RUN because this correction is confined to the WebGPU Viewer path.

Next is D430: measure the retained original far-coordinate STEP's GPU local-frame/display/picking boundary before further OFFSET admission. Issue #2263 remains open because its complete assembly, presentation, PMI and remaining surface/loop acceptance is absent. No dependencies, further develop integration or release are included.
