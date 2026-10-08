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

After building the package, run `node examples/motion-scene/timeline-probe.mjs`. It reads the real `.baromotion` asset and checks exact midpoint, clamp endpoint, repeat seam, multi-pass order, and atomic limit and getter refusals. Serve the repository root on port 52139, then open `http://127.0.0.1:52139/examples/motion-scene/timeline-demo.html`. The 3D scene keeps the same part IDs and geometries. Its marker log and current phase come from the Motion timeline library, while Three.js displays returned poses. Use Play and Advance 2 s or 4 s for exact crossings. The live state and copied event log are available at `window.motionTimelineDemo.getState()` and `window.motionTimelineDemo.getLog()`.

Run `node examples/motion-scene/marker-file-probe.mjs` to write and reopen the real `assets/two-parts.baromarkers` sidecar. It checks signed zero, a 256-byte label, event order, and invalid-file refusal. Serve the repository root on port 52159 and open the same `timeline-demo.html` path. This version loads markers from the sidecar. Save markers prepares a browser download Blob; Open markers stages a paused timeline at the prior time and mode, then replaces the timeline only after validation succeeds. A refused Open retains the timeline, pose, event log, and last accepted file. `window.motionTimelineDemo.getAcceptedFile()` and `getFileStatus()` expose the file state for inspection.

For a range preview, run `node examples/motion-scene/range-probe.mjs` after building. It reopens the actual clip and marker sidecar, checks `[1, 3]` midpoint/end/repeat crossings in original seconds, bounded refusal retention and a full-range compatibility witness. Serve the repository root on port 52179 and open the existing `timeline-demo.html`. It starts with the full range and has buttons for `[1, 3]` and an invalid range. A valid range change stages a paused timeline at the old time if it lies within the new range, otherwise at the new start, then clears the event log. An invalid range keeps the accepted pose, log and range. `window.motionTimelineDemo.setRange()` and `getRangeStatus()` expose that host operation.

## Two-clip blend consumer

After building the package, run `node examples/motion-scene/blend-probe.mjs`. It reads two real compatible `.baromotion` files, including a destination with reversed target order and antipodal Part A quaternions. The probe checks exact endpoints, separate source/destination times, the half blend, result ownership, and mismatch refusal. Serve the repository root on a separate port 52149 and open `http://127.0.0.1:52149/examples/motion-scene/blend-demo.html`. Select source or destination files to replace either clip. An incompatible file leaves the prior 3D pose in place. The sliders choose each clip time and destination weight; `window.motionBlendDemo.getState()` exposes the current owned result.

## Cubic timing consumer

After building the package, run `node examples/motion-scene/timing-probe.mjs`. It reads the real two-part `.baromotion` file and checks exact endpoints, identity and ease midpoint, flat X controls, signed zero, owned results and bounded refusals. Serve the repository root on port 52169 and open `http://127.0.0.1:52169/examples/motion-scene/timing-demo.html`. The caller selects an input time and timing curve. The page shows input progress, eased progress, input time and sampled time separately; Three.js displays the two owned poses. Try invalid curve reports a refusal and retains the last accepted frame. `window.motionTimingDemo.getState()`, `getEvaluation()` and `getStatus()` expose that state.

## Caller-driven clip transition consumer

After building the package, run `node examples/motion-scene/transition-probe.mjs`. It reads two real `.baromotion` files and checks separate source/destination clocks, fade midpoint, target adoption, owned poses, repeat seam, cubic timing and refusal retention. Serve the repository root on a separate port 52189 and open `http://127.0.0.1:52189/examples/motion-scene/transition-demo.html`. Use Seek source to 1 s, Transition to second clip, Play and Advance 1 s twice. The cards show both clocks, phase, raw progress and blend weight. Try incompatible clip reports a refusal without changing the accepted 3D frame. `window.motionTransitionDemo.getState()` and `getStatus()` expose the actual state.

## glTF animation consumer

After building the package, run `node examples/motion-scene/gltf-probe.mjs`. It imports the real [Khronos AnimatedTriangle](./assets/gltf-animated-triangle/README.md) JSON and two binary files, checks its rotation at 0, 0.25, 0.5 and 1 s, verifies the input buffers remain intact, checks meter-to-millimeter conversion with a small translation fixture, and checks four refusals. Serve the repository root on port 52199 and open `http://127.0.0.1:52199/examples/motion-scene/gltf-demo.html`. The page loads the same glTF files and calls the adapter. The time buttons sample the resulting Motion clip. Try CUBICSPLINE reports a refusal while keeping the accepted 3D pose. `window.motionGltfDemo.getState()` and `getStatus()` expose the current frame and status. The host draws a fixed triangle; no glTF geometry or scene import is claimed.

## GLB animation consumer

After building the package, run `node examples/motion-scene/glb-probe.mjs`. It imports the real [Khronos BoxAnimated GLB](./assets/gltf-box-animated/README.md), checks that rotation holds after its 2.5 s last key while translation continues to about 3.71 s, verifies source bytes, accepts permitted BIN padding and an unknown later chunk, and refuses damaged inputs. Serve the repository root on port 52209 and open `http://127.0.0.1:52209/examples/motion-scene/glb-demo.html`. The page fetches one `.glb`, imports its selected animation and samples the same clip time for both channels. The two host boxes display the returned poses. Try bad GLB header reports a refusal without changing the accepted frame. `window.motionGlbDemo.getState()` and `getStatus()` expose the frame and status. The scene uses fixed host geometry; it does not import the GLB mesh or node hierarchy.
