# Physics task examples

| Task | Existing example | What it preserves |
| --- | --- | --- |
| Rigid display | `examples/physics-viewer-scene/README.md` (Physics Viewer scene; local source) | Caller-driven world and separate displayed native Surface. |
| CAD proxy | `examples/physics-cad-scene/README.md` (CAD proxy scene; local source) | Approximation labels and exact source association. |
| Visual water | `examples/physics-scene/fluid-viewer/README.md` (Water Viewer; local source) | Fixed 256-particle metre state, host display clock. |
| Fixed cloth | `examples/physics-cloth-viewer/README.md` (Cloth host; local source) | Copied fixed topology and visual loss boundaries. |
| Static-box query | `examples/physics-capsule-query-scene/README.md` (Capsule query; local source) | Fraction/normal/witness meanings and initial-overlap refusal. |
| Character controller | `examples/physics-character-controller-reference/README.md` (Character reference; local source) | Fixed upright profile and host movement inputs. |

Use `examples/workspace-source/README.md` (workspace-source setup and source probe; local source) for source import resolution. Specific legacy numeric probes may use compiled entries; follow their actual loader and published-map configuration. The [Physics manual](https://github.com/barocss/barocss/wiki/Physics-Manual) provides detailed profile history; #963/#972 reconcile that manual. This portal build does not rerun their numeric or release gates.

`packages/barocss-physics/package.json` (Manifest and version; local source) · `packages/barocss-physics/README.md` (Package task notes; local source)
