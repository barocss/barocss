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

### Body material uniform limits

- **Body material** edits only scalar uniforms declared by an existing visible body's qualified embedded material. Names, ranges and defaults come from the actual shader compiler/provider; they are not a universal 0..1 range. Hidden/missing/unqualified bindings and materials with no scalar declarations are noneditable. Uniform editing creates no binding or ID and preserves shader source; explicit portable-material transfer is described below.
- Each full body binding owns its embedded material independently. Repeated material `documentId` values do not link bodies or authorize changing another binding. Unrelated materials and original source/TEN/pose/camera/light data stay intact.
- Enabled overrides require complete finite decimals within their declared ranges. Empty, incomplete, nonfinite or out-of-range active input refuses the whole transaction without accepting partial edits. Cleared overrides omit their property and use the declared default; their retained corrective text is not authored input. Explicit defaults differ from omission, and signed zero differs from positive zero. Equivalent numeric formatting with unchanged presence is a no-op when the complete scene is otherwise unchanged.
- Existing material-session preparation owns dirty comparison and the single next embedded revision. Changed material revision `2147483647` refuses before presentation; unchanged bindings retain their revision. Temporary material sessions are disposed without a separate history commit or presentation. Material/body/camera/light changes use the same pending-operation fences, one scene Apply/history transaction and accepted-only Save described below.

See the [body-bound uniform guide](./guides#edit-scalar-material-uniforms-for-a-body) and the [unchanged Surface B downloads](./examples#edit-the-existing-amount-uniform-on-surface-b). These controls do not establish physical GPU/file/device acceptance or resolve #1573.

### Portable material transfer limits

- Import targets one existing visible, unambiguous, fully qualified embedded binding. It copies only shader source and supplied uniforms through the actual portable codec/assignment/material-session authority; it does not import the portable identity/title/revision, create a shared asset or fan out repeated material IDs. Other bindings and complete scene/native/TEN/pose/light/authored-camera/local-view authority remain intact.
- Existing material limits apply: file size is at most **262144 UTF-8 bytes**, source at most **65536**, and at most **16 supplied uniforms**. The host checks both reported size and actual buffer bytes, then fatal UTF-8 and the strict codec/compiler/provider. Unknown fields, malformed source, undeclared/out-of-range uniforms and invalid qualifications refuse atomically. No partial source/uniform fields are published.
- Import requires a clean whole-scene form/session, ready idle presentation and no Help, chooser or navigation operation. It captures the exact snapshot/form, full binding, selection epoch and owning lifetime before the chooser, then checks them again after reading. Selection away/back, changed form/history/workspace, disposal, loss or stale completion cannot retarget the import. Cancellation/empty selection is a no-op, and the input is cleared for same-file reselection. Submitted reads are awaited rather than falsely described as cancelled; only the owning operation releases busy state.
- Staging alone leaves accepted revision/history/saved state unchanged. Real material or scene changes at revision **2147483647** refuse before staging or Viewer work; an exact no-op needs no next revision. Existing signed-value material preparation owns a changed embedded revision once, and the eventual whole-scene Apply owns the single presentation/history transaction. Temporary material sessions are disposed on every path, including exceptions.
- Export reads only the selected accepted embedded material, even if private fields are dirty. It uses the signed portable serializer and safe existing ID filename, never calls the scene's saved acknowledgement, and always removes its owned link/revokes its URL. Download transport is not proof of disk persistence. Hidden, unbound, unqualified and busy targets remain unavailable.

See the [material Import/Export steps](./guides#import-and-export-a-body-material) and [existing material authority](./api#portable-material-authority). Controlled files and Viewers establish software retention and lifecycle behavior only; #1577's physical file/pixel gate and #1573's physical gizmo gate remain open.

### Native Light transaction and cleanup limits

A workspace's backend kind is fixed for its lifetime. Mixed lighting and cross-kind Open/Apply refuse. Supported legacy directional V1 can be parsed and migrated; Native V0 requires the app's explicit legacy import into a directional workspace. Switching kinds starts a new lifetime; remount reconstructs accepted data and resets history.

Accepted documents and candidates are immutable. Await `commitPrepared`; concurrent mutations, stale versions and foreign/forged/reused candidates refuse. Invalid or refused drafts retain corrective text and accepted authoring/history. The workbench's signed whole-document no-op comparison avoids a presentation/revision/history change; the bare session does not automatically suppress a prepared Apply. Save uses accepted authorship, excludes raw field strings and acknowledges only the exact issued save payload after persistence.

Native Light errors use `RenderEditorError` codes including `DOCUMENT_INPUT`, `DOCUMENT_VERSION`, `DOCUMENT_BYTES`, `SOURCE_REFUSED`, `STALE_CANDIDATE`, `PRESENTATION_REFUSED`, `HISTORY_LIMIT` and `DISPOSED`, with reached provider causes retained. Correct data and reprepare after an ordinary refusal. An indeterminate acknowledgement or lost/unavailable presentation requires explicit disposal/remount. Retained CPU authorship is not retained pixels. The host must fence file reads and asynchronous actions, dispose its owned session, and clean up startup that completes after closure.

### Local viewport navigation limits

The [Light workbench navigation controls](./guides#navigate-a-local-viewport-camera) use the same strict camera bounds and raw-value admission above. The existing session's `navigateViewportCamera` and `resetViewportCamera` require a current expected version and an awaited result. Local view changes advance session/Viewer generations only: accepted authorship, raw drafts, document/catalog revisions, Save identity and history stay unchanged. Exact signed-value camera no-ops make no Viewer request. The camera is not added to the saved document unless the clean-only **Set scene camera** action accepts it through one whole-scene Apply.

**Frame selected/all** use qualified original CAD control-hull bounds for visible material-bound Surfaces, preserving complete body/document/asset/model/geometry identity even when geometry IDs repeat. The current admitted quaternion, positive nonuniform scale, translation and explicit mm conversion transform all eight corners per included body. Framing retains viewing orientation, raw Up and FOV, then chooses a centered local camera and clipping planes with a 1.2 visual margin. Every corner must pass the actual prepared projection and near/far checks; nonfinite, degenerate, out-of-limit, missing, hidden, unbound or ambiguous targets refuse without clamping. This conservative visual fit is not a tight Surface bound, centroid or pixel-containment certificate, and does not import Source1's separate radial travel rule.

Framing reads accepted geometry without consuming corrective fields, revisions, history or Save identity. Its repeat cache requires the exact acknowledged document/camera identities, body scope and CSS/backing dimensions; any changed key requalifies instead of using approximate camera equality. Active drag/queued/pending operations, file chooser, Help and unavailable state fence Frame commands. A Canvas backing size that differs from the acknowledged Viewer size refuses before cache reuse or presentation. Existing local-view retention/reset and explicit clean-only **Set scene camera** behavior still apply; no new shortcut, picking or gizmo behavior is implied.

There is at most one in-flight workbench presentation and one latest desired target, accumulated from new inputs rather than the stale acknowledged camera. Drag/queued/pending input fences author/file actions. Cancellation, blur/capture loss and changed CSS rectangles discard queued motion, not an already submitted or acknowledged update. **Scene camera** is a separate acknowledged reset. Ordinary Apply/Undo/Redo retain an active local override; successful Open/new lifetime resets it, while refused Open retains it.

Recoverable refusal retains the last acknowledged camera and accepted/raw state. Unexpected rejection or malformed/inconsistent acknowledgement is indeterminate and requires explicit disposal/remount. ACK followed by device loss still records acknowledged metadata with unavailable live status; it does not promise a visible frame. Disposal/replaced-workspace fences prevent late completion from reviving the old lifetime. Original validation failures and backend causes remain observable.

Directional and point Viewer replacement currently rebuilds complete candidates/resources. Coalescing bounds concurrent work; it is not a camera-only GPU fast path, measured performance result, smoothness or 60 fps guarantee. The bounded software checks use actual input/math/codec/session behavior with controlled Viewer, DOM geometry, pointer capture and RAF boundaries. Physical browser/GPU/device behavior remains unverified by those checks.

### Canvas body selection limits

The [Canvas selection workflow](./guides#select-a-body-from-the-canvas) queries the currently acknowledged scene through the owned Viewer. Public `pickViewportBody(xPixel, yPixel, expectedVersion)` requires integer top-left backing coordinates, current version, ready status and matching actual/acknowledged backing dimensions. The app maps an in-bounds point from its axis-aligned CSS rectangle with `floor((client - origin) * backing / CSS-size)`; outside, nonfinite or invalid dimensions refuse rather than clamp. This is not the historical Native continuous-CSS triangle picker or Source1 selection API.

A result must match the complete current original document/revision/body/asset/revision/model/geometry/frame binding and display reference, and identify exactly one visible material-bound Surface. Hidden, unbound, malformed, foreign or stale identities refuse. Repeated geometry IDs alone cannot identify a body. The read holds the session operation lock but leaves the exact accepted snapshot, corrective draft, authored revision/history, valid Save payloads and local camera unchanged. It does not call Viewer selection/highlight or request a scene replacement.

The host captures session/lifetime/generation and CSS/backing geometry, then rechecks completion before changing its Inspector row. A miss keeps that row. Active-drag capture loss and explicit cancellation invalidate input; ordinary capture release after pointerup does not invalidate the admitted click. A cancelled in-flight query remains busy until actual completion. Disposal, replacement, loss, changed dimensions or generation cannot update a newer workspace. Controlled identity responses and DOM events verify these software boundaries; they do not establish physical identity-buffer pixels, pointer behavior, device recovery or fixes for #1573/#1332.

### Evidence boundary

The complete [scene downloads and shared host](./examples#native-light-scene-downloads) expose original authoring data and a bounded source-consumer workflow. Controlled Viewer acknowledgements can verify software transactions; they do not establish actual WebGPU availability, rendered pixels, picking, physical file dialogs/persistence or integrated device recovery. No Native Light screenshot or physical rendering result is asserted here.

The numeric body fields and local camera controls do not establish a fix for [the physical arrow-control report #1573](https://github.com/barocss/barocss/issues/1573), which remains open and unresolved. Arbitrary mixed/spot lighting, numeric rotation/visibility controls and native geometry editing are outside this workbench.

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
