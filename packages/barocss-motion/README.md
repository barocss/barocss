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

## Versioned clip files

```js
import { serializeMotionClipFile, parseMotionClipFile } from '@barocss/motion';

const text = serializeMotionClipFile(clip); // supply a validated or plain v0 clip
const loaded = parseMotionClipFile(text);  // fresh owned clip
```

The UTF-8 `.baromotion` file contains exactly `{ "format": "barocss-motion", "version": 0, "lengthUnit": "mm", "coordinateSystem": "part-xyz", "clip": { ... } }`. The `clip` is the version-0 data described above. The file states this library's part XYZ frame; it does not convert a host's coordinate system. The codec performs no file, network, clock, or renderer operations. Hosts can write and read the returned string using their own APIs.

Output uses a fixed field order and no whitespace. Finite scalars use round-trip JSON numbers. A negative zero is emitted as the JSON numeric token `-0`; authored quaternion signs and exact key values remain intact. Input member order and legal JSON whitespace may vary, but unknown, missing, and duplicate fields (including escaped duplicate names) fail. The parser reads at most 1 MiB of UTF-8, depth 12, 131072 values, 16 fields per record, 128 decoded characters per string, 192 tracks, 256 keys per track, and 4096 total keys. All existing clip bounds still apply. Invalid data throws `MotionFileError` with a stable `code`: `INVALID_INPUT`, `FILE_TOO_LARGE`, `INVALID_JSON`, `DUPLICATE_FIELD`, `UNKNOWN_FIELD`, `LIMIT_EXCEEDED`, `INVALID_ENVELOPE`, or `INVALID_CLIP`. No caller getter or `toJSON` is invoked during serialization. Parse failure returns no clip and cannot alter an existing player.

## Marker timeline

```js
import { createMotionTimeline, parseMotionClipFile } from '@barocss/motion';

const clip = parseMotionClipFile(fileText); // host reads the file
const timeline = createMotionTimeline(clip, {
  version: 0,
  mode: 'repeat',
  markers: [
    { contextId: clip.contextId, id: 'start', timeSeconds: 0, label: 'Start' },
    { contextId: clip.contextId, id: 'contact', timeSeconds: 2, targetId: 'part-a' },
    { contextId: clip.contextId, id: 'end', timeSeconds: 4, label: 'End' },
  ],
});
timeline.play();
const frame = timeline.advance(4); // host supplies elapsed seconds
// frame.events: contact(0), end(0), start(1)
timeline.dispose();
```

The wrapper uses the existing validated clip and player. It returns the same owned poses with an `iteration` and an owned `events` array. Events are emitted only by positive `advance` while playing. Each event has `contextId`, `id`, `timeSeconds`, `iteration`, `markerIndex`, and optional `label` and `targetId`. `markerIndex` is the marker's input array index; iteration starts at zero and counts repeat passes since the last seek or clamp-end restart. `getState`, `play`, `pause`, `seek`, and `setMode` return no events. Seeking samples the pose without replaying markers.

Crossings use `(old, new]` for each pass. An initial time-zero marker is silent. At an exact repeat seam, endpoint markers arrive before time-zero markers for the next pass. Equal-time markers retain input order. Zero-duration clips emit no marker events; zero-marker timelines are valid. A clamp endpoint pauses playback, and `play` there restarts at zero with no event. Paused or zero-delta advances emit no events.

The timeline accepts at most 256 markers, 16 repeat seams, and 256 events per advance. Marker IDs use the clip's ASCII ID rule and must be unique; marker times must be finite and within the clip duration. Labels use 1–256 UTF-8 bytes without C0 control characters. An optional target must be in the clip. Inputs are copied from data fields; caller getters are rejected without invocation. Invalid input or an exceeded limit throws `MotionTimelineError` with `code` `INVALID_INPUT`, `DUPLICATE_MARKER`, `UNKNOWN_TARGET`, or `LIMIT_EXCEEDED` before changing the current state. Disposal is idempotent; later operations throw `DISPOSED`. This wrapper has no clock, callback, renderer ownership, or marker file format. The version-0 `.baromotion` envelope remains unchanged.
