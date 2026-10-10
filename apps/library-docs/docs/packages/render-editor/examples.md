# Render Editor task examples

## Source1 scene workbench

The [real source1 fixtures](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/render-editor/src/fixtures.ts) contain Sphere/Box/Cylinder and Torus/Capsule scenes. The [existing host](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/render-editor/src/app.tsx) owns File/Edit/Help/workspace behavior.

```sh
pnpm --filter @barocss/render-editor-app dev
```

With the existing dependencies and a free configured port, edit a supported object field, Apply, Undo/Redo, then Save and fresh Open. Check original scene source and camera separately from `presentedRevision`. Resolve a temporary view before authoring/file actions.

## One Sphere and one native Surface

[Mixed original-source fixtures](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/render-editor/src/mixed-fixtures.ts) and [mixed application](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/render-editor/src/mixed-app.tsx) retain complete native source with one selected Surface and one Sphere. Import original CAD text, choose a Surface, stage scene-unit placement and Apply. Save/Open reconstructs the frame from original text instead of saving sampled buffers.

## Query and duplicate

Use the applied Surface point controls to query original U/V and XYZ/mm. Duplicate changes host document identity/title while preserving native IDs/source and starting independent history. Structured mixed Sphere fields rewrite the original Sphere source; native Surface position remains a display transform. See [host flow notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/render-editor/README.md) for scoped source/API/file/browser receipt commands. Current local merge availability does not renew integrated UI/recovery acceptance.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/README.md)
