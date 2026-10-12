# Render Editor limits, errors and cleanup

## Native Light format and bounds

The current native envelope is `barocss-render-editor-native-scene`, wire version 2, profile `canonical-native-lights`, with a directional or point `lights.profile`. `RenderNativeLightDocument` and the generic parse/prepare/serialize/request/session APIs remain unsuffixed. This is separate from the historical Source1 and mixed-depth limits below.

- Select one to four original native Surface bodies through explicit qualified bindings, with at least one visible Surface. Keep complete CAD source, source options, original document/asset revisions, material source and supplied overrides. Material targets must match current qualified body pins; repeated geometry IDs are not interchangeable.
- File/draft text is limited to 2097152 UTF-8 bytes and UTF-16 code units. Input traversal is bounded to 65536 values, depth 24, 32 fields per record and generally 64 array elements; selected bodies, visible bodies, poses, materials and lights have their narrower four-entry limits. History allows at most 64 entries and 16 MiB of canonical serialized text.
- Body translation XYZ is finite in −10000..10000 mm; scale XYZ is finite in 0.001..100. Rotation is a raw XYZW unit quaternion: each component in −1..1 and length within 1e-9 of 1. The numeric workbench preserves it rather than adding a rotation control. Empty poses mean identity intent; otherwise every selected body must occur exactly once, including hidden bodies.
- `mmToSceneUnit` is 0.000001..1, with the explicit `part-xyz-matches-rhyup` basis. Camera eye/target and point-light positions are already scene coordinates; do not apply the mm conversion to them again.
- Camera eye/target components are finite within ±1000 scene units, separated by at least 0.0001. Up has finite dimensionless components and length at least 0.000001; its authored magnitude is retained. Up and viewing direction must not be singular. Vertical FOV is 10..100 degrees; clipping requires 0.0001 ≤ near < far ≤ 10000 scene units. Actual Float32 conditioning checks can refuse otherwise bounded values.
- Directional catalogs contain zero to four lights, each with a nonzero raw XYZ vector and components within ±1000. Point catalogs contain zero to four lights, position components within ±1000000 scene units and range 0.001..1000000 scene units. Ambient, each linear RGB component and intensity are 0..1. Disabled entries count toward the limit and still require valid fields. Point attenuation is the GPU's artistic finite-range law, not a photometric calibration claim.

Bounds are admission requirements, not permission to clamp or normalize. Original up/quaternion/vector components, signed zero and omitted material overrides survive accepted authorship and the signed codec. Actual native/material/TEN and posed GPU admission remain authoritative after schema validation. Plain own enumerable data is required; unknown fields, foreign prototypes, accessors, symbols, sparse arrays, nonfinite numbers, unsupported profiles and mismatched owner/revision bindings refuse.

### Native Light transaction and cleanup limits

A workspace's backend kind is fixed for its lifetime. Mixed lighting and cross-kind Open/Apply refuse. Supported legacy directional V1 can be parsed and migrated; Native V0 requires the app's explicit legacy import into a directional workspace. Switching kinds starts a new lifetime; remount reconstructs accepted data and resets history.

Accepted documents and candidates are immutable. Await `commitPrepared`; concurrent mutations, stale versions and foreign/forged/reused candidates refuse. Invalid or refused drafts retain corrective text and accepted authoring/history. The workbench's signed whole-document no-op comparison avoids a presentation/revision/history change; the bare session does not automatically suppress a prepared Apply. Save uses accepted authorship, excludes raw field strings and acknowledges only the exact issued save payload after persistence.

Native Light errors use `RenderEditorError` codes including `DOCUMENT_INPUT`, `DOCUMENT_VERSION`, `DOCUMENT_BYTES`, `SOURCE_REFUSED`, `STALE_CANDIDATE`, `PRESENTATION_REFUSED`, `HISTORY_LIMIT` and `DISPOSED`, with reached provider causes retained. Correct data and reprepare after an ordinary refusal. An indeterminate acknowledgement or lost/unavailable presentation requires explicit disposal/remount. Retained CPU authorship is not retained pixels. The host must fence file reads and asynchronous actions, dispose its owned session, and clean up startup that completes after closure.

### Evidence boundary

The complete [scene downloads and shared host](./examples#native-light-scene-downloads) expose original authoring data and a bounded source-consumer workflow. Controlled Viewer acknowledgements can verify software transactions; they do not establish actual WebGPU availability, rendered pixels, picking, physical file dialogs/persistence or integrated device recovery. No Native Light screenshot or physical rendering result is asserted here.

The numeric body fields do not establish a fix for [the physical arrow-control report #1573](https://github.com/barocss/barocss/issues/1573), which remains open and unresolved. Arbitrary mixed/spot lighting, local navigation gestures in this route, numeric rotation/visibility controls and native geometry editing are outside this workbench.

## Source format

Version0 `gpu-scene` uses file limit 262144 UTF-8 bytes, source limit 65536 bytes, at most 32 history entries and 4 MiB of history text. Exact own enumerable fields are required. Unknown versions/fields, accessors, malformed source/camera and forged/stale/reused candidates refuse. Original source is preserved, not normalized into a new schema.

Supported Source1 objects include Sphere, Box, Cylinder, Capsule, Rounded Box and Torus under actual GPU compiler admission. This does not imply universal affine scaling, mesh editing, canvas picking or transform gizmos.

## Mixed format

Version1 `mixed-depth` admits exactly one Sphere and one selected native Surface under profile `sdf-sphere-native-surface-v0`. Each original source is at most 65536 UTF-8 bytes/code units; file is at most 524288 bytes. Sample axes are 2–17, with at most 289 vertices/512 triangles. Camera-inside/clip/travel/Float32 guards still apply. Asset revision is a declared association, not a historical content certificate.

Surface display XYZ is in scene units, finite within ±1000 in the supported field profile. Original CAD coefficients/weights/knots stay native. U/V has no length unit. The existing focused mixed host declares a 1000 × 760 CSS-pixel minimum workspace; that is not mobile/device certification.

## Stable error families

Source `RenderEditorError.code`: `DOCUMENT_INPUT`, `DOCUMENT_VERSION`, `DOCUMENT_BYTES`, `SOURCE_REFUSED`, `STALE_CANDIDATE`, `PRESENTATION_REFUSED`, `HISTORY_LIMIT`, `DISPOSED`.

Mixed `RenderMixedDocumentError.code`: `INPUT`, `VERSION`, `BYTES`, `SOURCE`, `QUALIFICATION`, `NATIVE`, `GPU`, with reached provider cause. Correct invalid drafts/source/ref/profile before full Apply. Retain authoring/history on failure. Recover explicitly when presentation is unavailable; a restored frame and a retained CPU snapshot are different facts.

Raw incomplete hidden object/Surface input blocks full Apply and file/camera Use. Do not bypass those guards with a metadata-only or camera-only commit. Unmount/dispose releases owned resources; the host owns file reads/downloads, cancellation, routes and session closure.

No general native geometry editor, arbitrary mixed shapes/materials, picking, unrestricted asset scene, Physics coupling, full IME/mobile/recovery certification or publication is established here.

`packages/barocss-render-editor/package.json` (Manifest and version; local source) · `packages/barocss-render-editor/README.md` (Package task notes; local source)
