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
