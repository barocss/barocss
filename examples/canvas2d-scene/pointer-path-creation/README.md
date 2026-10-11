# Pointer path creation

Consumer of unchanged Canvas2D public builders/tree/conversions/document and existing example SceneHistory/control adapter. Initial artwork has no curves. Pointer placements and a final control drag create new Q/C paths; each whole gesture adds one history entry. Copy complete previews, cancel safely and edit restored source data. Profile: Scene29,480×320,DPR2,one four-byte cyan asset,eight single-curve nodes max,50 history entries. General pen/stylus/multisegment editing is not claimed.

Node22 preparation: `node examples/canvas2d-scene/pointer-path-creation/flow.mjs --source /tmp/c2d1447-source`; strict actual source host/types: `tsc -p examples/canvas2d-scene/pointer-path-creation/tsconfig.json --noEmit`. The history TYPEONLY alias points to public-types.ts for strict owned-controller checking; runtime esbuild uses exact unchanged ../scene-history.mjs. Source bundle is the actual native profile; emitted public API/types are separate focused proof. The second Download has a different filename and is not opened again. Native execution is pending source/probe/driver review.

There is no extra endpoint distance minimum. Unchanged public geometry admission can refuse a zero-area contour. Selection validates the requested control before publication; slot changes cancel current drafts or drags. The repaired native driver compares admitted commands with independently captured trusted input at1e-8, reports requested input quantization separately, proves the distinct builder refusal and compares the complete second file with the first file plus only the restored Q control delta. These native checks remain UNRUN until root hash GO.


## Selected path deletion (#1469)

Delete selected path removes only a created Q/C direct child from a copied Parent through public removeChild. The accepted candidate becomes one existing history entry; Undo restores the complete scene, and Redo restores the deletion. Save keeps surviving path data and the stable image bytes. Opening that document starts a fresh history. Deleting the last created path leaves Marker and Sprite.

Delete is disabled during a pending gesture, without a selection and after Dispose. A direct pending/no-selection call returns false without changing accepted state. This is an example operation; no new library API or general object deletion profile is added.

Native acceptance and exact adoption are recorded separately in evidence/path-deletion/. Original pointer creation/capture-loss receipts and incomplete driver records remain under their original evidence paths and native commits.


## Selected solid fill RGB (#1478)

Select a created Q/C path, enter exactly #RRGGBB, and apply its fill RGB. The existing opaque alpha, fill rule, stroke and all commands stay the same. Undo and Redo restore complete scenes. Save and Open keep the accepted color and original image bytes. Invalid RGB text stays available for correction and does not replace the accepted scene.

The new RGB control follows selection, history, Open and deletion selection changes. It is disabled without a supported solid fill, during a pending gesture and after Dispose. Existing coordinate controls and error behavior remain. The example now permits byte-normalized fill RGB while its immutable authoring validator still checks every other style/shape restriction on a validation copy; the actual scene retains its original colors and its64KiB bound.

The bounded opaque Q/C color flow and native lifetime proof are recorded separately under evidence/fill-rgb/. Earlier creation, deletion, capture-loss and incomplete receipts remain under their original paths/native commits.


## Selected stroke width (#1486)

Select a created Q/C path with a stroke, enter an integer width from1 to16 logical pixels, and apply it. The fill, stroke color, opacity, cap, join, dash, commands and pose remain. Undo/Redo restore complete scenes and the width field. Save/Open preserve the accepted numeric width and original image bytes. Invalid width text remains for correction and leaves accepted data intact.

The width control is disabled without a supported selection, during a pending gesture and after Dispose. Only the new width field follows selection/history/Open/deletion selection changes. The validation copy maps accepted widths to legacy2 for immutable authoring checks, while actual data retains the chosen width and the real64KiB bound. Earlier color/deletion/creation evidence stays at its original paths/native commits; bounded width proof lives in evidence/stroke-width/.


## Selected independent stroke RGB (#1492)

Select a created Q/C path with a stroke, enter exactly #RRGGBB, and apply its outline RGB. Its fill and current stroke width stay the same. Stroke alpha, cap, join, dash, commands and pose remain. Undo/Redo restore complete scenes and the new field. Save/Open keep the numeric color and stable image bytes. Invalid text stays available for correction and preserves accepted state.

The control is disabled without a supported selection, during a pending gesture and after Dispose. The existing MAIN validation copy checks the actual64KiB bound and exact byte-normalized strokeRGB, then maps only copied strokeRGB3 to original defaults for immutable profile checks. Actual accepted data retains its independent outline color. Earlier source/evidence stays at its native paths; bounded outline proof lives in evidence/stroke-rgb/.


## Canvas view controls (#1500)

Pan X/Pan Y move the canvas view; Zoom changes its scale. Pan uses canonical integer text from-64 to64. Zoom offers0.75,1,1.1,1.25. Apply view admits a complete renderer before replacement. Reset view restores the original12,8,1.1 view while retaining artwork, selection and history. Pending gestures disable these controls. An unchanged view is a no-op. Invalid view text stays available for correction and does not replace accepted state.

Camera state belongs to this host and stays outside the Scene/history/document. Existing fresh renderers use the accepted host view and existing public point conversions. The actual new view/reset pixel and hit proof is under evidence/view-controls/. Its document-snapshot.json is public API serialization evidence, not a native UI download. Mixed editing/Open/history flows after a camera change remain separate unrun acceptance. Earlier limits, styles, assets and native files stay preserved.


## Canvas path selection (#1509)

In Edit control mode, click a created curve to select it. The existing coordinate and paint fields follow that path. Clicking the same path keeps its current control slot and drafts. Marker and Sprite clicks retain selection. Blank background clears selection; the Path dropdown also offers None. Clearing hides the control handle and disables selected paint/deletion controls. Selection changes retain the Scene, history, camera, image bytes and renderer. They do not capture a pointer or allocate a renderer.

The host passes CSS/backing/DPR input as logical viewport coordinates to existing hitTest; it does not apply a second camera inverse. Legacy handle drags and creation gestures remain separate; pending direct selection/clear calls return false. evidence/canvas-selection/ records the bounded actual click/clear proof. Its document-snapshot.json is API serialization only, not a native UI download. Mixed selection/edit/history/Open after camera remains separate unrun acceptance.
