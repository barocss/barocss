# Physics → Viewer native Surface consumer

This example loads two original weighted BaroCAD Surfaces. Physics simulates a dynamic sphere above a static box. Viewer displays `rational_panel` at the sphere center and leaves `flat_panel` at its authored position. The SVG side view shows the collision proxies. The moving native Surface is not the collision shape.

The separate [two-body joint preview](joint-demo.html) uses the same two original Surfaces as display geometry for two dynamic sphere proxies. A built Physics package drives one bounded fixed pair with a 0.2 N·s impulse; Viewer shows both poses at steps 0, 30 and 120. Run this server and open `http://127.0.0.1:52884/joint-demo.html`. The host uses the compiled Physics and Viewer packages. The numeric fixture is `examples/physics-scene/dynamic-fixed-pair-probe.mjs`; [#823](https://github.com/barocss/barocss/issues/823#issuecomment-6072507713) freezes its first-slice limits. This preview does not support motors, break behavior, a native CAD joint or engineering loads.

The [hinge motor preview](motor-demo.html) uses one fixed Surface and one rotating original Surface. It uses a static anchor and a 1 kg dynamic sphere proxy with a fixed +Z hinge. The motor targets 0.5 rad/s, with a 0.0001 N·m·s step impulse cap and 0.0005 N·m·s constraint reaction cap. Open `http://127.0.0.1:52884/motor-demo.html?step=120`; capture steps are 0, 20 and 120. Use **Test overload after step 120** to confirm that the second overload step is refused and the step 121 Physics and Viewer pose remains. **Test stale source** confirms a stale Surface reference is refused. The numeric fixture is `examples/physics-scene/hinge-motor-probe.mjs`. This preview does not claim a calibrated break law.

The [two-dynamic hinge preview](dynamic-hinge-demo.html) rotates both original Surfaces in opposite directions. The bounded scene uses two coincident 1 kg sphere proxies, one +Z hinge and a motor that targets 0.5 rad/s relative speed. Open `http://127.0.0.1:52884/dynamic-hinge-demo.html?step=120`; capture steps are 0, 10 and 120. The overload control accepts step 121 and refuses step 122 while keeping both accepted poses. The numeric fixture is `examples/physics-scene/dynamic-hinge-motor-probe.mjs`. Offset anchors, gravity, linear motion and multi-joint assemblies are outside this preview.

The [offset-hinge preview](offset-hinge-demo.html?step=120) uses two original Surfaces with distinct 1 kg sphere proxy centres and body-local anchors that meet at one pivot. Its coloured A/B markers show proxy centres; the white marker shows the common pivot. These markers project onto the Viewer camera without testing depth occlusion. Open `http://127.0.0.1:52884/offset-hinge-demo.html?step=120`; supported capture steps are 0, 60 and 120. Play/Pause, One step and Reset control the host. The overload, invalid binding and stale source controls must retain the accepted Physics and Viewer frame. The numeric fixture is `examples/physics-scene/offset-hinge-probe.mjs`; [#939](https://github.com/barocss/barocss/issues/939#issuecomment-6077079018) records the exact local Integration proof. The CAD Surfaces stay unchanged. This is one planar visual proxy pair, not exact CAD collision, an authored CAD joint, a break rule or a certified load model.

The exact binding, units, frame, source fixture, limits and invalid-input rule are frozen in [PHYS-01 #764](https://github.com/barocss/barocss/issues/764#issuecomment-6058526690). Physics uses metres; Viewer receives millimetres and declares `part-xyz-matches-rhyup`. The host owns playback at one quarter of wall time. It makes one Physics fixed step before applying each complete Viewer pose frame. Pause, one-step and reset are host controls. Reset creates a new world.

With Node 22, build the CAD, GPU, Viewer and Physics packages, then start the page. The base page bundles Physics source; the joint pages use compiled packages:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/gpu build:library
pnpm --filter @barocss/cad-interop build:library
pnpm --filter @barocss/viewer build:library
pnpm --filter @barocss/physics build:library
node examples/physics-viewer-scene/server.mjs
```

Open `http://127.0.0.1:52884/`. Set `PHYSICS_VIEWER_PORT` to change the port. Restart the server after Physics source edits. The **Test invalid binding** control submits a one-sided binding and reports whether the last accepted Viewer pose remained in place. This is a bounded visual check. The separate release gate still builds and tests the compiled package. The base page does not implement exact CAD collision or CCD.
