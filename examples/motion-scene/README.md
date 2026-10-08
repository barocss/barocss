# Motion scene prototype

Build only the motion package, then serve the repository root:

```sh
pnpm --dir packages/barocss-motion build:library
python3 -m http.server 52119
```

Open `http://127.0.0.1:52119/examples/motion-scene/`. The demo imports the built motion core from the adjacent package and a pinned Three.js renderer from jsDelivr. Three.js only draws the two shapes; it does not calculate their poses. The scene keeps the same geometries and exact target IDs while translation, rotation, and scale change. Use Play/Pause, the seek slider, and the Clamp/Repeat selector. Current owned pose data appears below the controls and is also available as `window.motionDemo.getState()`.

`node examples/motion-scene/probe.mjs` checks actual endpoint and midpoint poses, pause, seek, repeat, and rejection without state loss. The prototype does not claim CAD feature updates or native GPU adoption.

## Versioned file consumer

After building the package, run `node examples/motion-scene/clip-file-probe.mjs`. It writes one real `assets/two-parts.baromotion` file from the two-part clip, starts a fresh Node process that reads and samples the file, and checks a few malformed file refusals. Open `http://127.0.0.1:52129/examples/motion-scene/file-demo.html` from a separate repository-root server on port 52129. The file demo loads that same asset. Save uses a browser Blob; Open uses a selected local file. The host accepts only its own `sample-assembly` context and exact two-part TRS set before replacing the player. A rejected file retains the current frame and player.

## Marker timeline consumer

After building the package, run `node examples/motion-scene/timeline-probe.mjs`. It reads the real `.baromotion` asset and checks exact midpoint, clamp endpoint, repeat seam, multi-pass order, and atomic limit and getter refusals. Serve the repository root on port 52139, then open `http://127.0.0.1:52139/examples/motion-scene/timeline-demo.html`. The 3D scene keeps the same part IDs and geometries. Its marker log and current phase come from `createMotionTimeline`, while Three.js displays returned poses. Use Play and Advance 2 s or 4 s for exact crossings. The live state and copied event log are available at `window.motionTimelineDemo.getState()` and `window.motionTimelineDemo.getLog()`.

Run `node examples/motion-scene/marker-file-probe.mjs` to write and reopen the real `assets/two-parts.baromarkers` sidecar. It checks signed zero, a 256-byte label, event order, and invalid-file refusal. Serve the repository root on port 52159 and open the same `timeline-demo.html` path. This version loads markers from the sidecar. Save markers prepares a browser download Blob; Open markers stages a paused timeline at the prior time and mode, then replaces the timeline only after validation succeeds. A refused Open retains the timeline, pose, event log, and last accepted file. `window.motionTimelineDemo.getAcceptedFile()` and `getFileStatus()` expose the file state for inspection.

## Two-clip blend consumer

After building the package, run `node examples/motion-scene/blend-probe.mjs`. It reads two real compatible `.baromotion` files, including a destination with reversed target order and antipodal Part A quaternions. The probe checks exact endpoints, separate source/destination times, the half blend, result ownership, and mismatch refusal. Serve the repository root on a separate port 52149 and open `http://127.0.0.1:52149/examples/motion-scene/blend-demo.html`. Select source or destination files to replace either clip. An incompatible file leaves the prior 3D pose in place. The sliders choose each clip time and destination weight; `window.motionBlendDemo.getState()` exposes the current owned result.
