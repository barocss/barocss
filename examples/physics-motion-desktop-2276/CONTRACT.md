# Current Native Physics motion desktop adapter

SOURCE_ONLY; Root alone builds/imports/executes/tests. Reuse unchanged physics-persistent-impact-2276/scene/{app.mjs,scenario.mjs,display.mjs,index.html,style.css} and its existing browser-checks.js. No new demo law, physics hook, recorder, solver, package dependency, download, source fallback, mobile or deployment.

Physics root/replay resolve ONLY actual packages/barocss-physics/dist/index.js and dist/replay.js. Verify actual publishConfig paths. All transitive Physics code must remain in that dist directory; any Physics source input refuses. Viewer/GPU and other existing display package dependencies use the existing ownedPackages Source resolver; these are explicitly a display Source boundary, never a genuine Native whole-Viewer claim. Every effective input/bundle/HTML/CSS is hashed. Fresh proof ID fixes one immutable build directory; serve mode authenticates it and never builds, regenerates providers or mutates source.

Original persistent-impact preset model/commands are unchanged: one2kg cube and static floor (or separate equal-mass pair), zero gravity/friction, centered initial downward2m/s, min restitution.25 or unit1; rigid-persistent-box-v1/direct/dt1/120, recorder.step([]),512-frame cap. The visible bounce is an existing1/2body public dynamic profile. It does not qualify eight moving boxes, the stationary8 profile as dynamic, general impacts or engineering load data. Preserve existing numerical tolerances, first failures and profile limits. Numerical current-provider finite impacts and actual desktop motion must be checked in the same stage by Root; copied historical receipts do not qualify this build.

Commands from repository root, under Root's existing180s guard:

```
node examples/physics-motion-desktop-2276/server.mjs --build motion-01
node examples/physics-motion-desktop-2276/server.mjs motion-01
```

Open http://127.0.0.1:53044/. Root reuses the original11-check desktop protocol with a fresh output ID and this URL; original browser-checks are input-pinned but not rewritten here. Build output is output/playwright/physics-motion/motion-01/{app.mjs,index.html,style.css,inputs.json}. Build limit16MiB bundle, each static asset1MiB, metadata1MiB, <=2048 input files. Loopback GET-only exact whitelist, same-origin CSP, no expected physics states served. --build creates a fresh directory and writes once; serve refuses absent/damaged/stale files and has no build path. Browser/test proof remains NOT_RUN until Root executes.
