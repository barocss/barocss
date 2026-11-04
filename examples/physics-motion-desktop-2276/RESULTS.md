---
work_id: physics-motion-desktop-2276
artifact_type: verification
status: done_bounded_local
owner_role: independent-physics-algorithm-work
source_request: verify actual motion together with numerical behavior on desktop
last_updated: 2026-11-04
---

# Current Native impact and actual GPU motion

Actual current build15 Physics root/replay are bundled from `dist` only.
Viewer/GPU remain existing Source display packages; this is not a Native
whole-Viewer qualification. Existing persistent-impact scenario, renderer and
11-check bank are reused unchanged. No new physics law or shipping fallback.

`motion-native-desktop-build-01` passes in666.598083ms.
`motion-native-desktop-01` passes in14866.891708ms.
Actual report: `output/playwright/persistent-impact/motion-native-01/report.json`,
status `CURRENT_NATIVE_MOTION_DESKTOP_CONFIRMED`, source integrity true.
Chrome156.0.8078.80 passes all11 checks/six presets and1280/1440/1920 widths,
with zero page/console errors and local requests only. The owned proof session
is closed. The loopback prebuilt preview remains at http://127.0.0.1:53044/.

Six actual public input cases cover minimum restitution, exact closing-speed
threshold0.5m/s, its next binary64 value, unit restitution, zero restitution
and equal-mass moving pairs. Expected velocity, impulse and energy are checked
with the existing1e-10 SI thresholds; no tolerance/iteration/body-cap changes.
The minimum case gives outgoing vertical speed0.5m/s, impulse5Ns and energy0.25J.

Subsequent20 actual public steps move the body from Y0.49999999999999994m to
0.583333333333333m. GPU pixel hash changes2992914343→894647260. Poses match
accepted public transforms with one SI-to-mm display conversion. Camera/resize
preserve Physics; keyboard, step/play/pause/reset and the512-frame recorder
cap pass. Actual accepted time at that cap is4.266666666666667s.

This is centered zero-gravity/zero-friction1/2-body impact. It establishes
real implemented motion, not eight-body falling, general coupled impact,
physical machine agreement or deployment readiness. Original impact failure
and all HOLDs remain. Screenshots prove rendering; independent physics evidence
is recorded separately in `physics-persistent-impact-2276/RESULTS.md`.

Executed with installed Node22, the existing heavy gate and owned180s guard:

```
node examples/physics-motion-desktop-2276/server.mjs --build motion-native-01
node examples/physics-motion-desktop-2276/server.mjs motion-native-01
node examples/physics-motion-desktop-2276/browser-run.mjs motion-native-01
```

Build and browser outputs require fresh IDs. Do not rerun these IDs. No mobile,
downloads, new dependencies, changed security flags, deployment or release.
