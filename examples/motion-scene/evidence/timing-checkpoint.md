# Cubic timing checkpoint (#681)

Exact native parent: `14711fd3436f7d2b0de8e328f9a84fb870b3a238` (#677). Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only.

Public additions: `evaluateMotionTiming`, `sampleMotionClipWithTiming`, `MotionTimingError`. Input timing is an exact own-data `{kind:'cubic-bezier',x1,y1,x2,y2}` record with controls and progress in `[0,1]`. The evaluator returns progress, eased progress, cubic parameter, iteration count and computed X residual. Bisection is bounded to 64 steps and requires residual <= `1e-9`. The sampler returns original input time, eased sample time and independently owned existing clip poses. Endpoint bits and original clip/key/file/marker data remain unchanged. Errors are `INVALID_INPUT` and `UNSAFE_RESULT`.

Actual commands and results:

```text
PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --filter @barocss/motion build:library
exit 0; tsc and esbuild emitted JS (46.2 KiB) and declarations

/Users/user/.nvm/versions/node/v22.22.0/bin/node examples/motion-scene/timing-probe.mjs
exit 0; real two-part .baromotion reopened; identity midpoint 2 seconds; ease midpoint 3.209613548795252 seconds; ease X residual 3.883185994979499e-10 in 29 steps; flat X midpoint in one step; signed-zero endpoints and 0-duration clip retained; getter calls 0; six invalid-input refusals and independent results
```

Headed Chromium at `127.0.0.1:52169/examples/motion-scene/timing-demo.html`: the first automated check assumed the page still had its initial midpoint and failed with `ease midpoint missing`; a read immediately after showed the page at its 4-second endpoint. The repaired check explicitly selected Ease and Midpoint before measuring. After the reference added explicit progress readouts, that same short browser flow passed again. It verified 50% caller progress mapped to >50% eased progress, identity time exactly 2, invalid-curve refusal with the full accepted frame and timing evaluation unchanged, and exact 4-second endpoint. Console: 0 errors, 0 warnings. [Captured page](timing-refusal.png) shows 50.0% input progress, 80.2% eased progress, 2.00 s input, 3.21 s sample, two visible parts and retained pose after refusal.

The browser is a Three.js reference consumer. It does not prove Viewer #670 adoption, CAD mutation or package publication.
