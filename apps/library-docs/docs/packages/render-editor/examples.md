# Render Editor task examples

## Source1 scene workbench

The `apps/render-editor/src/fixtures.ts` (real source1 fixtures; local source) contain Sphere/Box/Cylinder and Torus/Capsule scenes. The `apps/render-editor/src/app.tsx` (existing host; local source) owns File/Edit/Help/workspace behavior.

```sh
pnpm --filter @barocss/render-editor-app dev
```

With the existing dependencies and a free configured port, edit a supported object field, Apply, Undo/Redo, then Save and fresh Open. Check original scene source and camera separately from `presentedRevision`. Resolve a temporary view before authoring/file actions.

## One Sphere and one native Surface

`apps/render-editor/src/mixed-fixtures.ts` (Mixed original-source fixtures; local source) and `apps/render-editor/src/mixed-app.tsx` (mixed application; local source) retain complete native source with one selected Surface and one Sphere. Import original CAD text, choose a Surface, stage scene-unit placement and Apply. Save/Open reconstructs the frame from original text instead of saving sampled buffers.

## Query and duplicate

Use the applied Surface point controls to query original U/V and XYZ/mm. Duplicate changes host document identity/title while preserving native IDs/source and starting independent history. Structured mixed Sphere fields rewrite the original Sphere source; native Surface position remains a display transform. See `apps/render-editor/README.md` (host flow notes; local source) for scoped source/API/file/browser receipt commands. Current local merge availability does not renew integrated UI/recovery acceptance.

`packages/barocss-render-editor/package.json` (Manifest and version; local source) · `packages/barocss-render-editor/README.md` (Package task notes; local source)
