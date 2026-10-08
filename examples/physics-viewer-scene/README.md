# Physics → Viewer native Surface consumer

This example loads two original weighted BaroCAD Surfaces. Physics simulates a dynamic sphere above a static box. Viewer displays `rational_panel` at the sphere center and leaves `flat_panel` at its authored position. The SVG side view shows the collision proxies. The moving native Surface is not the collision shape.

The exact binding, units, frame, source fixture, limits and invalid-input rule are frozen in [PHYS-01 #764](https://github.com/barocss/barocss/issues/764#issuecomment-6058526690). Physics uses metres; Viewer receives millimetres and declares `part-xyz-matches-rhyup`. The host owns playback at one quarter of wall time. It makes one Physics fixed step before applying each complete Viewer pose frame. Pause, one-step and reset are host controls. Reset creates a new world.

With Node 22 and the local package outputs built:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/gpu build:library
pnpm --filter @barocss/cad-interop build:library
pnpm --filter @barocss/viewer build:library
pnpm --filter @barocss/physics build:library
node examples/physics-viewer-scene/server.mjs
```

Open `http://127.0.0.1:52884/`. Set `PHYSICS_VIEWER_PORT` to change the port. The **Test invalid binding** control submits a one-sided binding and reports whether the last accepted Viewer pose remained in place. This is a bounded visual and compiled-consumer check. It does not implement exact CAD collision, rotation, friction, joints or CCD.
