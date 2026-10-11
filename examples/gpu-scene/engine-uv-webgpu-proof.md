# Authored EngineUV WebGPU acceptance example

This example prepares the actual acceptance flow for Issue1184. It uses the
original scene, texture bytes, complete CSS sources and overrides selected in
receipt6108348385. The runtime source was adopted at b8036403. This example does
not replace that receipt or certify unexecuted GPU behavior.

## Prepare the files

Use Node22 from this checkout with its existing workspace dependencies:

```sh
node examples/gpu-scene/engine-uv-webgpu-proof.mjs --output /absolute/fresh/output --build-only
```

The output directory must not exist. The command bundles the new browser client
from actual ordinary GPU/CAD source, pins every package input against b8036403,
and saves complete signed originals, two CSS files, the independent oracle and
asset hashes. It does not start a server, probe a port, navigate a browser or
access a device. The manifest says `PREPARED_ONLY` and `actualGPU:false`.

## Run the actual flow when the target is available

Serve the generated files only after the original target's browser policy is
restored and its server owner has coordinated the change. The currently pending
Issue1512 manual receipt, server127.0.0.1:52215 and user tab must be preserved.
This CLI provides no serving option or alternate target. Build success is not a
browser or GPU pass.

1. Initialize required WebGPU and read all declared windows. Check actual
   backend/status, generations, expected versus measured bytes and the manifest.
2. Click the two visible source objects and background on the canvas. The client
   requires trusted pointer events, converts the actual CSS rectangle to backing
   coordinates and calls the real GPU identity attachment through `pick`.
3. Advance the authored phases: left amount0.75, shared image red64→96, full left
   source literal#204080→#102030, then resize320×256. Each success advances the
   generation once. Read the independently recalculated windows for each phase.
4. Select the physically right `left_instance` through an actual click, then hide
   it. Verify selection clears and the surviving source reference remains exact.
5. Refuse an absent texture reference and camera.near0. Compare the complete
   accepted RGBA bytes, originals, dimensions, generation and selection before
   and after each refusal. This proves input refusal retention only.
6. Save complete signed originals and reopen that real file through the file
   control. The client reconstructs material IR from full CSS and mounts an
   actual new viewport. This is a same-page file remount, not a fresh browser.
7. Dispose every retained actual viewport twice, then download its observations.
   Disposed logical status does not certify physical driver cleanup.

The initial320×240 oracle declares eight3×3 windows and a background sample.
The source name `left_instance` is physically right; `right_instance` is
physically left. Original source IDs are preserved. The oracle uses original
texels, explicit sRGB decode, historical hex coefficients and one standard output
encode. RGB tolerance is3 per channel; alpha must be255. The camera and original
UV rows are fixed before any readback. Phase changes regenerate their own oracle
without using product shader evaluation or observed pixels.

## Evidence boundary

The receipt separates preparation, actual initialization, readbacks, trusted
physical events, authored updates, refusals, file reopening and disposal. Empty
or incomplete stages remain unrun; initialization alone is not completion.
Console observations are bounded client-captured errors/warnings and window
events, not a substitute for a browser tool's live native console receipt.
The public runtime does not expose successful shader compilation-message arrays;
record this limit rather than inventing those diagnostics.

Original files are private example envelopes, not a public native-file codec.
They retain F64 values, signed zero, original CSS/UV/IDs and scene units. Shader
text, packed buffers, sampled display bytes and logical resource charges remain
derived. Generic WebGL fallback is unsupported. Late driver failure, device loss,
fresh browser, physical memory/cleanup, integrated consumer acceptance and
publication require their own real evidence.
