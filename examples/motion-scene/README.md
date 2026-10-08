# Motion scene prototype

Build only the motion package, then serve the repository root:

```sh
pnpm --dir packages/barocss-motion build:library
python3 -m http.server 52119
```

Open `http://127.0.0.1:52119/examples/motion-scene/`. The demo imports the built motion core from the adjacent package and a pinned Three.js renderer from jsDelivr. Three.js only draws the two shapes; it does not calculate their poses. The scene keeps the same geometries and exact target IDs while translation, rotation, and scale change. Use Play/Pause, the seek slider, and the Clamp/Repeat selector. Current owned pose data appears below the controls and is also available as `window.motionDemo.getState()`.

`node examples/motion-scene/probe.mjs` checks actual endpoint and midpoint poses, pause, seek, repeat, and rejection without state loss. The prototype does not claim CAD feature updates or native GPU adoption.
