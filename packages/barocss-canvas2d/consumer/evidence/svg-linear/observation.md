# #1386 linear SVG native consumer receipt

PASS for this frozen native flow on Chromium148, ANGLE/SwiftShader WebGL2. This is not an integration or release receipt.

## Implemented host

The existing `current-v29-svg.html?linear=1` uses the new public `exportSceneLinearSVG`. The default solid mode and its importer remain separate. The inline Scene29 fixture uses logical320×220, DPR1 and identity view. It contains an opaque Background path, LinearGroup(alpha0.5, translation15,10), a transformed local80×40 LinearPath with an evenodd hole, and an unrelated opaque green path whose source ID collides with the first generated gradient name. The definition therefore uses `C2DLinearGradient2`.

The original public edit changes the end stop from Blue to Green. The exported native SVG uses local userSpaceOnUse coordinates, pad spread, explicit encoded sRGB interpolation, opaque8-bit stops and per-paint alpha0.5. A copied public tree with an actual radial fill refuses with UNSUPPORTED_FEATURE. Its corrective draft remains available; accepted tree, identities, canonical scene and all281600 frame bytes remain unchanged.

## One actual browser flow

All five frozen driver phases passed on their first execution. No accepted action or file upload was replayed.

1. Original Green edit, two trusted canvas pointers, radial refusal and one SVG download. The phase returned completed=true/running=false before the SVG chooser; File.text0/inputchange0.
2. A separate physical SVG chooser uploaded the genuine downloaded bytes once. Native HTMLImageElement.decode displayed that file through a local Blob URL, with no SVG importer. The manually inverted fixed affine oracle checked six deep interior pixel centres: three gradient samples, hole, unrelated path and background. Both Canvas and native SVG samples match encoded RGB source-over Back within2. Native 2D backing resets to0×0. Then one JSON Save returned before the separate JSON chooser; File.text1/inputchange1/pendinghash0.
3. A separate physical JSON chooser uploaded the genuine JSON once. Its fresh tree, canvas and renderer retain every Scene29 field, ID, transform, command, gradient stop, alpha, order and canonical scene; assets[]. All281600 GL frame bytes match the saved original. Linear exporter count stays2 through both uploads. The restored public edit changes the endpoint to100,0 and end stop toBlue; the independent interior oracle passes again. Two more trusted pointers reach LinearPath and Background.
4. The driver returned the screenshot before Dispose. Author and root inspected Original Green, native SVG Green and restored Blue, including hole/background/unrelated path. No unexpected content was seen.
5. Public Dispose completed before page closure. One late physical canvas click made no callback. All controls are disabled; repeated Dispose changes nothing.

## Genuine file artifacts

- SVG:975 bytes; SHA256 `42f939254fce23839cb1e1f4bfe9abc70d0e599bddb956f37c883c8040eb3161`; native mtimeNS1791655596977242042.
- JSON:1887 bytes; SHA256 `cd04eeab8629d96bc3fa29703e02f2cc94a9073e9ba65b650cb9aabc05c124bc`; native mtimeNS1791655646931378440.
- Phase0 startNS1791655584933322000. Each native download emitted one downloading and one downloaded event. Dedicated artifacts are exact native file copies, not reconstructed files.

## Lifetimes and executed checks

Every actual GL context was instrumented before module startup. Two contexts each created/deleted shader4, program2, buffer3 and vertexArray2; texture0/framebuffer0. Native is* live0, getError0 and no context loss were proved before page closure. Exact callback target/function/capture ledgers show two adds, two removes, active0. One native-image 2D scratch is0×0; Blob URLs0; ImageBitmap0. External requests0. Application errors0, rejections0 and nativeGL errors0. Four ReadPixels stall warnings are retained separately. PNG exports0.

Node22.22.0 affected build FIRSTPASS305.2KiB; common types0; strict scoped actual-host/source+emitted ABI types0 after retained annotation/config repairs. The sole successful paired independent probe passed16322 assertions; each entry has6 accepted/12 unsupported/16 malformed cases. Its largest legal8192-command witness emitted564921 ASCII bytes from912433 source bytes. No successful probe rerun occurred.

After the flow, all229 frozen source/host/config hashes and approved driverSHA256 `9498384ad53ec5b608d51f685ab6635e1f3a57b7d34d759835f60bd1f8d20987` were unchanged. All873 unowned baseline blobs and568 prior evidence blobs matched. Browser sessionc2d1386 closed; server31386/PID17165 terminated, terminal exit143.

## First records and limits

The exporter first strict check found historical Scene union narrowing; a transient ambiguous patch was detected and the legacy10190-byte prefix restored before acceptance. First scoped types failed343 diagnostic rows from the untyped host/transitive fixture. The narrowed check then found closure narrowing, DOM.Iterable, source/emitted nominal renderer and ambient declaration issues. Typed actual-host annotations/public Pick and strict configuration repairs resolved these; noImplicitAny was not weakened. The first probe setup defaulted esbuild stdin toJavaScript and rejected import type before public assertions; loader:'ts' repaired setup only. Pre-browser driver review corrected texture population0, added actual request auditing and separated screenshot return from terminal cleanup. Read-only guessed config/donor lookups were also retained. These are preparation/type records, not browser assertion failures. Raw logs remain under `/tmp/c2d1386-*`.

The committed browser JSON summarizes repeated nativePixels and file strings by byte count/SHA after collection; raw phase logs remain complete. Independent sample values, full-frame comparison counts, exact file artifacts, cleanup ledgers and first records remain explicit.

Only selected native SVG interior parity is claimed; whole-frame/native antialias edge parity is not claimed. No editable SVG gradient import, general SVG round trip, nonopaque stops, radial export, multistop, device/color-management, context-loss or performance qualification follows. The1MiB output append cap is source-reviewed; no manufactured public output-overflow refusal was run. Broader current1254/674 acceptance remains UNRUN. Legacy default successful-flow semantics remain through the typed annotations and defensive DOM access guards. The legacy exporter10190-byte body is exact. No old solid browser producer/importer flow was replayed.
