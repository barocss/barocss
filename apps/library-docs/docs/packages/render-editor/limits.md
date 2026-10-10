# Render Editor limits, errors and cleanup

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
