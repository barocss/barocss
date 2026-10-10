# CAD Editor task examples

## Canonical source authoring

The [local application](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/cad-editor/src/app.tsx) loads the canonical fixture, owns menus/file decisions and mounts the public component. Run the existing app in the workspace:

```sh
pnpm --filter @barocss/cad-editor-app dev
```

Use a free configured port and the existing dependencies. Select a Surface pole, enter a valid coordinate or weight, Apply, Save, then Open the downloaded original file. Observe native source/IDs and accepted filename independently from the displayed preview.

## Curve and feature tasks

[Curve fixture](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/cad-editor/fixtures/curve-pole-authoring.cad-document.json) contains original Curve data for focus and coefficient editing. Staged handle motion is pending authoring; display samples are not the coefficients.

[Boolean extrusion fixture](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/cad-editor/fixtures/boolean-extrusion.authored-graph.json) and [feature application](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/cad-editor/src/feature-app.tsx) demonstrate graph/parameter transactions and selected output display. This is a bounded native feature mode, not an unrestricted solid modeller.

## Retained original inventory

[Complete inventory fixture](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/cad-editor/fixtures/complete-native-inventory.cad-document.json) retains native objects beyond the displayed subset. Choose displayed bodies explicitly instead of truncating the native file. See the [app task and receipt notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/apps/cad-editor/README.md) for focused host flows. This documentation build does not rerun all file/recovery/native feature acceptance.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-cad-editor/README.md)
