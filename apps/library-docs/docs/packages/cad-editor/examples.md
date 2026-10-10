# CAD Editor task examples

## Canonical source authoring

The `apps/cad-editor/src/app.tsx` (local application; local source) loads the canonical fixture, owns menus/file decisions and mounts the public component. Run the existing app in the workspace:

```sh
pnpm --filter @barocss/cad-editor-app dev
```

Use a free configured port and the existing dependencies. Select a Surface pole, enter a valid coordinate or weight, Apply, Save, then Open the downloaded original file. Observe native source/IDs and accepted filename independently from the displayed preview.

## Curve and feature tasks

`apps/cad-editor/fixtures/curve-pole-authoring.cad-document.json` (Curve fixture; local source) contains original Curve data for focus and coefficient editing. Staged handle motion is pending authoring; display samples are not the coefficients.

`apps/cad-editor/fixtures/boolean-extrusion.authored-graph.json` (Boolean extrusion fixture; local source) and `apps/cad-editor/src/feature-app.tsx` (feature application; local source) demonstrate graph/parameter transactions and selected output display. This is a bounded native feature mode, not an unrestricted solid modeller.

## Retained original inventory

`apps/cad-editor/fixtures/complete-native-inventory.cad-document.json` (Complete inventory fixture; local source) retains native objects beyond the displayed subset. Choose displayed bodies explicitly instead of truncating the native file. See the `apps/cad-editor/README.md` (app task and receipt notes; local source) for focused host flows. This documentation build does not rerun all file/recovery/native feature acceptance.

`packages/barocss-cad-editor/package.json` (Manifest and version; local source) · `packages/barocss-cad-editor/README.md` (Package task notes; local source)
