# Physics scene

This is the first visible consumer of `@barocss/physics`. A moving sphere falls onto a fixed box. The engine computes positions, velocities and contacts in SI units; this page draws a side projection of those returned values. The sphere and box are screen geometry, not CAD collision shapes.

From the repository root, build the package and run:

```sh
pnpm --filter @barocss/physics build:library
node examples/physics-scene/probe.mjs
node examples/physics-scene/server.mjs
```

Open `http://127.0.0.1:5181/`. Use pause, single step and reset. The panel reports the same state returned by the library. The probe checks free fall, stable box rest, sphere impact, initial overlap, copied state, refusal retention and disposal.
