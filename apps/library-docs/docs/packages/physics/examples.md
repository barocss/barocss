# Physics task examples

| Task | Existing example | What it preserves |
| --- | --- | --- |
| Rigid display | [Physics Viewer scene](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/physics-viewer-scene/README.md) | Caller-driven world and separate displayed native Surface. |
| CAD proxy | [CAD proxy scene](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/physics-cad-scene/README.md) | Approximation labels and exact source association. |
| Visual water | [Water Viewer](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/physics-scene/fluid-viewer/README.md) | Fixed 256-particle metre state, host display clock. |
| Fixed cloth | [Cloth host](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/physics-cloth-viewer/README.md) | Copied fixed topology and visual loss boundaries. |
| Static-box query | [Capsule query](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/physics-capsule-query-scene/README.md) | Fraction/normal/witness meanings and initial-overlap refusal. |
| Character controller | [Character reference](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/physics-character-controller-reference/README.md) | Fixed upright profile and host movement inputs. |

Use [workspace-source setup and source probe](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/workspace-source/README.md) for source import resolution. Specific legacy numeric probes may use compiled entries; follow their actual loader and published-map configuration. The [Physics manual](https://github.com/barocss/barocss/wiki/Physics-Manual) provides detailed profile history; #963/#972 reconcile that manual. This portal build does not rerun their numeric or release gates.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/README.md)
