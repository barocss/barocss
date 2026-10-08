# Absolute-time range checkpoint (#687)

Exact clean native parent: `03aa1df58bf50d1eadffa1d3c4208e2953c6d5a3` (#681). Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only.

Public addition: `createMotionRangeTimeline(clip,{range:[start,end],markers,mode})` and its option/state/interface types. Times and marker events stay in the original clip's absolute seconds. Existing marker admission, IDs, order/index and `MotionTimelineError` codes are reused. State owns its range, poses and events. The original full timeline and file codecs are unchanged. Limits: finite inclusive clip range with start<end except numeric zero-duration `[0,0]`, at most 16 repeat seams and 256 events per advance. All events and next time are checked before state adoption.

Actual commands and results:

```text
PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --filter @barocss/motion build:library
first exit 2: src/range-timeline.ts(193,35) TS2322, false not assignable to narrowed true; fixed by explicitly typing staged nextPlaying as boolean
same affected build rerun exit 0: tsc and esbuild emitted 53.6 KiB JS and declarations
source review found the full-range clamp case "seek to end while playing, then positive advance" must pause rather than refuse; the same affected build rerun after this correction exited 0

/Users/user/.nvm/versions/node/v22.22.0/bin/node examples/motion-scene/range-probe.mjs
exit 0 after the correction: reopened actual two-part .baromotion and .baromarkers; [1,3] midpoint mid-a/mid-b at original 2 s, clamp end range-end at 3 s, exact repeat seam range-end@3 then range-start@1; full [0,4] matched the existing #668 timeline action/state flow including a positive advance from a playing clamp endpoint; getter count 0; wrap, negative delta, outside seek, zero span, outside clip, getter refusals retained the accepted state; zero-duration events 0
```

Headed Chromium at `127.0.0.1:52179/examples/motion-scene/timeline-demo.html`: the existing 3D reference opened a valid `[1,3]` range paused at 1 s. An exact caller advance of 2 s in repeat mode returned time 1 s, iteration 1 and the authored midpoint events. The invalid-range button reported `INVALID_INPUT` without changing pose, range, or event log. Console: 0 errors, 0 warnings. [Captured page](range-refusal.png) shows the retained 1-second two-part frame and marker log. Existing clip and sidecar bytes were not changed.

This is a local native package/reference checkpoint. Current merged-head browser use, Viewer adoption, broad validation and registry publication remain separate.
