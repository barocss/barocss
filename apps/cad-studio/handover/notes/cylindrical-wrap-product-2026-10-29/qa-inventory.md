# D313 Studio QA inventory

Scope: one original upright cylinder, one rectangular radial pad on the first quarter of its
original +Y half. Original UV has0<u0<u1<0.5 and0<v0<v1<1. Outward height equals source radius.
Mass uses the certified closed reference; literal stored coefficient closure/mass and native SI
accuracy remain unqualified. This inventory records intended checks, not completed results.

| Claim or control | Functional check | Visual state and evidence |
|---|---|---|
| Create a native cylinder | Normal Cylinder palette/HUD, radius10, height30, Z-7 | One cylinder, no viewport error |
| Select the original wall | Click visible wall in Back view; inspect selected merged name | Highlight and face inspector visible |
| Open Cylindrical wrap | Normal palette control after wall selection | Five fields, explicit +Y quarter/UV/height hint fit in HUD |
| Four UV bounds | Set .1/.4/.2/.7 with normal input; wait for current preview | Pad appears only over its expected angle/Z extent |
| Required height | Height10 accepted; height9 refused | Refused state, Apply disabled, accepted document unchanged |
| Invalid UV range | U end0.5 or reversed interval refused | Clear refusal; previous accepted body remains |
| Cancel and recover | Cancel a candidate; reopen command and valid values | Original state restored, no ghost pad |
| Apply | Apply valid preview; await fresh body and deferred massReady | One joined body; pad/caps/radial sides visible; no duplicate inner surface |
| Reference mass | Compare raw returned volume/centroid to independent sector oracle | Volume/mass inspector populated; default density2.7 follows live provider |
| Undo and Redo | Normal keyboard controls return original then wrapped recipe | Geometry and history return with each state |
| History edit | Edit U start .1->.15, apply | Same feature ID/signature; visibly narrower pad |
| Save and fresh Open | Save asset-free current-schema JSON .bcad, New part, reopen file | Same recipe/face signature and geometry/mass, no stale old body |
| Re-edit after Open | Open history command and change UV bound | Existing values retained; fresh preview and Apply succeed |
| Wrong surface | Pick cap, or invalid source if exposed | Command unavailable or typed refusal; original accepted document unchanged |
| Unsupported later feature | Try a consuming modifier | Typed refusal, no partial accepted output |
| Viewport fit | Inspect1440x900/DPR1 and1024x768 | HUD, outliner, history, inspector and canvas remain visible; no overlap/clipping |

The scripted browser-flow step may use existing test hooks to stage a selected display face.
That is functional harness evidence. The separate interactive pass must use normal UI clicks
for wall selection and command input. JS inspection reads fresh recipe/mass/state only; it does
not count as user input. Inspect final screenshots at the specific preview/applied/reopened states.

Explore for30–90 seconds after the main flow: cancel/reopen, invalid bounds/height, small-window
layout, and selection of an unsupported face. Record every new visible state found. Clean up only
browser/context/server processes created by this task, using owned handles/PIDs.
