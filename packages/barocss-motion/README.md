# @barocss/motion

Experimental, renderer-neutral TRS keyframes for 3D part poses. The package does not read a clock or change scene or CAD objects.

```js
import { createMotionClip, createMotionPlayer, sampleMotionClip } from '@barocss/motion';

const clip = createMotionClip({
  version: 0,
  contextId: 'assembly-1',
  durationSeconds: 2,
  tracks: [{
    targetId: 'part-1', property: 'translation', interpolation: 'LINEAR',
    keys: [
      { timeSeconds: 0, value: [0, 0, 0] },
      { timeSeconds: 2, value: [20, 0, 0] },
    ],
  }],
});
sampleMotionClip(clip, 1).poses[0].translation; // [10, 0, 0] mm

const player = createMotionPlayer(clip, { mode: 'repeat' });
player.play();
player.advance(0.5); // supply elapsed seconds from your host
player.pause();
player.seek(2); // exact authored endpoint
player.dispose();
```

Each target is identified by the pair `(contextId, targetId)`. Translation uses native part XYZ millimeters, scale is dimensionless and positive, and rotation is a unit quaternion in XYZW order. The host maps these units and axes to its renderer once. Returned poses and component arrays are independent copies.

The version-0 bounds are 64 targets, 192 tracks, 256 keys per track, 4096 keys in total, and 3600 seconds. Translation is within ±10000 mm per component; scale is in `[0.001, 100]`; quaternion norm must differ from 1 by at most `1e-9`. Key times must be finite, strictly increasing, nonnegative, and within duration. IDs are 1–128 ASCII characters: an alphanumeric first character followed by alphanumerics, `.`, `_`, `:`, or `-`. Clips need at least one track and each track needs at least one key.

Translation and scale accept `STEP` and `LINEAR`; rotation accepts `STEP` and `SLERP`. Samples before the first key and after the last key hold that key's value. Exact key samples return the authored value, including the sign of an authored quaternion. Interior SLERP follows the shortest path, flips the right quaternion when the dot product is negative, uses normalized linear interpolation when the adjusted dot is above `1 - 1e-8`, and normalizes its result. A quaternion and its negation encode the same orientation.

Players start paused at time zero. `seek` includes both endpoints in either mode. Positive `advance` in repeat mode wraps the duration endpoint to zero; clamp mode stops at the endpoint and pauses. `play` at the clamp endpoint starts again at zero. Zero-duration repeat clips stay at zero. Invalid calls throw before changing player state. `dispose` is idempotent; further calls throw. No hidden timer, autoplay, time scale, mixing, skinning, morphs, physics, spline, IK, or CAD regeneration is included.
