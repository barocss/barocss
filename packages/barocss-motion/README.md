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

Players start paused at time zero. `seek` includes both endpoints in either mode. Positive `advance` in repeat mode wraps the duration endpoint to zero; clamp mode stops at the endpoint and pauses. `play` at the clamp endpoint starts again at zero. Zero-duration repeat clips stay at zero. Invalid calls throw before changing player state. `dispose` is idempotent; further calls throw. The base player has no hidden timer, autoplay, time scale, clip mixing, skinning, morphs, physics, spline, IK, or CAD regeneration.

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

The timeline accepts at most 256 markers, 16 repeat seams, and 256 events per advance. Marker IDs use the clip's ASCII ID rule and must be unique; marker times must be finite and within the clip duration. Labels use 1–256 UTF-8 bytes without C0 control characters. An optional target must be in the clip. Inputs are copied from data fields; caller getters are rejected without invocation. Invalid input or an exceeded limit throws `MotionTimelineError` with `code` `INVALID_INPUT`, `DUPLICATE_MARKER`, `UNKNOWN_TARGET`, or `LIMIT_EXCEEDED` before changing the current state. Disposal is idempotent; later operations throw `DISPOSED`. This wrapper has no clock, callback, or renderer ownership. The version-0 `.baromotion` envelope remains unchanged.

## Marker sidecar files

```js
import { parseMotionMarkerFile, serializeMotionMarkerFile } from '@barocss/motion';

const text = serializeMotionMarkerFile(clip, markers);
const reopenedMarkers = parseMotionMarkerFile(text, clip);
```

The separate UTF-8 `.baromarkers` file contains exactly `{ "format": "barocss-motion-markers", "version": 0, "timeUnit": "seconds", "contextId": "...", "durationSeconds": 4, "markers": [...] }`. Each marker has `contextId`, `id`, `timeSeconds`, and optional `label` and `targetId`. Canonical output has this field order, no whitespace, and preserves marker input order and numeric `-0`. The parser accepts different member order and JSON whitespace. A sidecar is compatible only with a validated clip whose context ID and numeric duration match. Parsing returns independent marker records. Hosts must stage a new timeline before replacing an existing one.

The sidecar is limited to 262144 UTF-8 bytes, depth 12, 16384 visited values and member names, 256 markers, six envelope fields, five fields per marker, 256 decoded UTF-16 code units per string token, and 1538 raw code units per string token. Timeline marker rules still apply. Unknown or missing fields, decoded duplicate fields, trailing data, bad numeric tokens, and invalid marker values fail. `MotionMarkerFileError.code` is `INVALID_INPUT`, `FILE_LIMIT`, `INVALID_JSON`, `UNSUPPORTED_FORMAT`, `INCOMPATIBLE_CLIP`, or `INVALID_MARKER`. Serialization does not invoke getters or `toJSON`. The codec has no file, network, player, timer, or renderer side effects.

## Two-clip pose blend

```js
import { parseMotionClipFile, sampleMotionBlend } from '@barocss/motion';

const source = parseMotionClipFile(sourceText);
const destination = parseMotionClipFile(destinationText);
const sample = sampleMotionBlend(source, 2, destination, 1, 0.5);
// { contextId, fromTimeSeconds: 2, toTimeSeconds: 1, weight: 0.5, poses }
```

Both inputs must be validated v0 clips with the same context ID and exact `(targetId, property)` set. Destination tracks may be in a different order; output poses follow the first target occurrence in the source. Each time is independent and must be finite and within that clip's duration. The weight is finite in `[0, 1]`. The result has two times because it is not a single-time `MotionFrame`.

At weight 0 or 1, the result copies the corresponding existing clip sample without component arithmetic. This preserves sampled signed zeros and quaternion signs. `weight: -0` selects the source and is returned as `+0`; signed-zero input times remain signed. Interior translation and scale are componentwise linear. Interior rotation uses the same shortest-path SLERP and near-equal normalization rule as keyed sampling. Returned poses and arrays are independent copies. Computed translation, scale and quaternion values must stay finite and inside the v0 bounds.

Invalid clips, times or weight throw `MotionBlendError` with code `INVALID_INPUT`. Context or target/property mismatches use `INCOMPATIBLE_CLIPS`; unsafe computed values use `UNSAFE_RESULT`. Error messages name the field and do not include caller data. The function has no player state, timer, marker events, asset migration, renderer operation, or CAD source mutation.

## Cubic timing for clip sampling

```js
import { evaluateMotionTiming, sampleMotionClipWithTiming } from '@barocss/motion';

const timing = { kind: 'cubic-bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
const evaluation = evaluateMotionTiming(0.5, timing);
const sample = sampleMotionClipWithTiming(clip, 2, timing);
// sample.inputTimeSeconds remains 2; sample.sampledTimeSeconds is eased.
```

The progress and four control values must be finite in `[0, 1]`. The cubic has fixed `(0, 0)` and `(1, 1)` endpoints. This bounded family has a monotone X axis and no Y overshoot. `evaluateMotionTiming` returns a fresh `{progress,easedProgress,parameter,iterations,xResidual}` record. A bracketed bisection uses at most 64 steps and requires computed X residual at most `1e-9`; the residual describes this calculation, not a global numerical certificate. Endpoints return exact 0 or 1 with zero steps. The result copies a negative-zero input progress, while its eased zero is positive zero.

`sampleMotionClipWithTiming` requires an actual validated v0 clip and a finite input time within its original duration. It maps only the requested sample time, then uses the existing sampler and returns independent `{contextId,inputTimeSeconds,sampledTimeSeconds,poses}` data. Exact input endpoints retain their time bits and existing key/quaternion sample values. A zero-duration clip stays at zero. The clip, keys, player and marker seconds/events do not change. No clock, per-track easing, file schema or renderer is included. Invalid inputs throw `MotionTimingError` with `INVALID_INPUT`; unsafe computed results use `UNSAFE_RESULT`. Timing must be an exact plain own-data record; getters and extra fields are refused without reading caller getters.

## Absolute-time preview range

```js
import { createMotionRangeTimeline } from '@barocss/motion';

const preview = createMotionRangeTimeline(clip, {
  range: [1, 3], markers, mode: 'repeat',
});
preview.play();
const frame = preview.advance(2); // time 1 again, after end/start seam events
preview.dispose();
```

The range is an exact own-data two-element array with finite `start < end` inside the original clip duration. Only a zero-duration clip admits numeric `[0, 0]`. State returns an independent copy of the range, original absolute seconds, owned poses and marker events, playing state, mode and repeat iteration. The initial time is the range start; numeric zero starts as positive zero. An explicit seek can preserve `-0`, and a clamp-end play restarts at positive zero when the start is numeric zero. A zero-duration range stays at positive zero after positive advance and emits no events.

The wrapper reuses the existing marker admission and event IDs/indexes. Markers outside the range remain admitted but never emit. Each pass delivers crossings in `(old, new]`; at a repeat seam, end events arrive before next-pass start events. The first start marker and seeks are silent. Equal-time events retain authored array order. A full `[0, duration]` range matches the existing timeline behavior. At most 16 seams and 256 events are delivered per advance; unsafe time arithmetic or an exceeded bound throws before changing accepted state. Invalid options, clip, range or time and marker failures use the existing `MotionTimelineError` codes. This wrapper has no timer, easing, clip/key/marker rewrite, file format or renderer ownership.

## Caller-driven clip transitions

```js
import { createMotionTransitionPlayer } from '@barocss/motion';

const transition = createMotionTransitionPlayer(source, { mode: 'clamp' });
transition.seek(1);
transition.transitionTo(destination, { destinationTimeSeconds: 0, fadeDurationSeconds: 2 });
transition.play();
transition.advance(1); // source 2 s, destination 1 s, linear weight 0.5
transition.advance(1); // destination adopted at 2 s
transition.dispose();
```

Source and destination must be validated v0 clips with the same context and exact target/property set. The destination time is required and within its clip; fade duration is finite in `[0, 3600]` seconds. Optional `timing` uses the cubic-bezier record above to ease only the blend weight. With no timing, weight equals raw fade progress. A zero-duration fade adopts the destination immediately. A second transition and `seek` are refused while a fade is active; the caller can pause or resume it. There is no interrupt or replacement policy in v0.

State returns independent poses plus `phase`, `playing`, `mode`, both clip times, fade elapsed/duration/progress and weight. Before a fade, phase is `idle`, destination time is `null`, and fade fields are zero. During a fade, both clocks and fade elapsed advance from the same caller delta. Clamp holds each clock at its endpoint but lets the fade complete; repeat wraps each nonzero-duration clip at the exact seam. After completion, the destination becomes the source, phase is `adopted`, destination time is `null`, and progress/weight stay at 1 until the next transition. Poses then use the destination clip's own target order. At a clamp endpoint, playback stops; `play` restarts at zero only when no fade is pending. The player starts paused, owns no timer, renderer or caller player, and never changes the clips or CAD source.

Invalid requests keep the accepted clocks, phase and poses. `MotionTransitionError` has stable codes `INVALID_INPUT`, `INCOMPATIBLE_CLIPS`, `TRANSITION_ACTIVE`, `UNSAFE_RESULT` and `DISPOSED`. `dispose` is idempotent; other methods refuse afterward. The implementation delegates sampling and interpolation to the existing clip, blend and timing APIs. It does not blend marker events or implement animation graphs, layers, skinning or a target renderer adapter.
