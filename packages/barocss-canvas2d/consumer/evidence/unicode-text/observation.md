# C2D112 / #1355 Unicode browser labels

The scoped implementation and single actual browser flow passed. Native adoption,
current-root #1254/#674 acceptance and publication are separate. Root owns the
native commit and serial Integration handoff; this worker did not commit or push.

## Contract and implementation

Parent `c6d45418e64cec2a3d8db3d1be9b7d0933cbcf9c`, branch
`codex/canvas2d-1355`. Existing Issue1355 followed Planner's Wiki contract
`ebaf744` / published `390f0ff`. Root author freeze
`76edf3b6d20a3602ae004efa5dcf855564946c79` and claim6099387868 preceded code.
Exactly15 owned package paths; source/host/docs/type/probe/browser work stayed
in the isolated Unicode checkout. No other worker wrote these paths.

`BrowserTextPolicy` adds `unicode-single-line` on `rasterizeBrowserText`.
It requires1..128 original UTF-16 code units, well-formed surrogate pairs and
non-whitespace content. C0 U+0000..001F, DEL/C1 U+007F..009F and U+2028/U+2029
are refused with INVALID_SCENE before browser allocation. Text is not normalized,
trimmed or case-converted. The whole-label glyph range is0..original text.length.
The existing alphanumeric default, printable ASCII, explicit multiline and word
wrapping keep their contracts. Existing font/DPR/metrics/padding/1024x256/1MiB
limits, typed errors and finally scratch cleanup stay in place. The root already
exports BrowserTextPolicy; index/schema/tree/renderer/document were not changed.

The existing browser-text host retains its old24px monospace controls. New Unicode
controls use an explicit current24px system-ui font/DPR2/policy. The textarea and
JS corrective draft retain the rejected original code units. Open restores copied
text/layout/atlas bytes, with font/policy/rasterDPR unknown (`null`); they are not
file fields. Restored Unicode editing uses the public GlyphRun.setLayout after
selecting the current profile. Disposal removes the exact canvas bindings and
all host control listeners. Existing source cancellation and late Open guards
remain in use; no new general Open policy is claimed.

## Build and controlled checks

Node22.22.0 affected build passed at280.4KiB after the retained first setup failure.
The old ignored node_modules link resolved through historical worktrees to a
removed cache-reentry target. The first build completed tsc, then esbuild was
unavailable; pnpm exited1. Only this checkout's ignored link was repaired to the
existing primary node_modules. No install, dependency, manifest, lock or Git
configuration change occurred. First log `/tmp/c2d1355-build.txt`, successful
retry `/tmp/c2d1355-build-retry.txt`.

Common source consumer types and scoped actual browser-text host plus explicit
source/emitted public types passed with empty diagnostics. One paired
source-bundle/emitted-root controlled-Canvas probe passed on its first run:
784 assertions; EACH10 successful original-text/range/copied-RGBA/scratch cases
and95 typed refusals/getter0. Cases include Hangul/CJK, supplementary pairs,
leading/trailing whitespace preservation, combining versus precomposed text,
128UTF16 boundary, every C0/DEL/C1 control, malformed surrogate pairs, unknown
fields/policy/getters, rejected Unicode under old ASCII policies, and unchanged
multiline/wrap ASCII exclusions. Controlled metric/draw/not-ready/oversize failures
release scratch0x0. Root imports are inert. These synthetic metrics/pixels are
admission/copy/cleanup evidence, NOT native shaping or readable glyph evidence.
No successful numerical probe was rerun. Logs use `/tmp/c2d1355-{common,scoped}-types.txt`
and `/tmp/c2d1355-focused-run.txt`.

## One actual native browser flow

Native installed Chrome155.0.8059.39 on Darwin24.6.0/arm64 macOS, ANGLE SwiftShader
WebGL2, logical320x144/DPR2/backing640x288. Local AppleSDGothicNeo and Hiragino Sans GB
fonts are installed, but the helper makes no matched-face claim. Native browser
shaping/fallback uses24px system-ui. No downloaded or registered font was used.
FontFaceSet readiness, metrics and nonzero alpha do not prove glyph coverage.

All four driver phases passed first attempts on one page; no fixture repair,
accepted replay or source/driver edit occurred. DefaultASCII `Canvas2D` is the
ordinary control. UnicodeA `설계 圖面 A1` has8 original code units/range0..8 and
50336 atlas bytes; UnicodeB `설계 圖面 B2` has8/range0..8 and52416 bytes. IDs stay
Back/Label in BrowserTextConsumer/Scene29. Native bitmap bytes match registered
copies. Three real ink/transparent-space/Back clicks use existing glyph alpha-hit
semantics. Whole737280-byte GPU frames use an independent nearest mapping of the
copied native atlas over a fixed background, tolerance2/maximum difference0.
This renderer comparison does not substitute for visual glyph inspection.

Unpaired high surrogate, LF and129UTF16 requests return INVALID_SCENE with no
candidate/scratch allocation. The accepted tree/canvas/renderer/layout/all bytes,
whole framebuffer and canonical document remain exact. Corrective drafts remain
exact in JS and textarea: high-surrogate code unit55296; newline code units
44032,10,45208; oversized draft129 copies of44032. These three intentional typed
refusals increment host errors3; page/window/runtime/fixture errors are zero.

Save ran once and fully returned before a separate physical chooser and ONE CLI
upload. The prechooser boundary has phase1completedtrue/runningfalse, acceptedB2,
overall generation6, File.text0/inputchange0/pendinghashes0. The actual completed
native70894-byte JSON was copied to saved-document.json, canonical exact; SHA256
`3f7f92715211856b7d6af3ab078cae002e200cba1e50251e626e9df7957a94a4`,
mtimeNS1791648450817878515. It contains originalB2 text/range/layout and complete
252x52/52416-byte BrowserTextAtlas, SHA256
`a907aee212eb2d48c42c66d88c257bc21e173a4f77e4698aa10832a475fe6b5f`.
This file was copied from the download, not manufactured from in-memory text.

Physical chooser/upload/inputchange/File.text each measured1. Fresh Open creates
new canvas/tree/renderer at generation7, with all text/layout/IDs/context/asset
bytes/full frame/canonical file equal. Helper calls and native font loads stay
unchanged on Open. Font/policy/rasterDPR are null; no preparation profile is
inferred from the file. The restored public GlyphRun edit explicitly prepares
`수정 圖面 C3` under the current24px system-ui/DPR2/Unicode policy, generation8,
53248 atlas bytes/range0..8. Its whole737280-byte frame also has maximum difference0.
Three more real ink/space/Back clicks pass. Six live clicks plus one late click
are distinct from bubbled callback logs. No PNG operation was performed.

Root and worker inspected BOTH actual screenshots before Dispose. InitialA at
generation2 and restoredC at generation8 show readable intended Hangul/CJK/ASCII
characters without visible tofu. `screenshot.png` and `restored-screenshot.png`
belong to those pre-Dispose stages; their bind2/unbind1 and bind5/unbind4 displays
are distinct from terminal5/5 cleanup. The coverage claim is limited to this
named native browser/system-font fixture, not global font or device coverage.

## Lifetime and immutable proof

All five actual GL contexts are included: default, UnicodeA, UnicodeB, fresh
Open and restoredC. EACH shader4/program2/buffer3/VAO2/texture1/FBO0 had
created=deleted/native is*live0/error0/no loss through APIs BEFORE page closure.
The exact canvas callback/target/capture ledger adds5/removes5/active0; every
identity is removed once. Host liveRenderers0, rendererCreated5/disposed5,
binds5/unbinds5, pointerEvents6 retained after a real late pointer. Controls,
textarea and file input are disabled; repeated Dispose is inert. Retained
platform/audit listeners are not counted as removed canvas pointer bindings.

All four actual helper2D scratch canvases (default/A/B/C) are0x0 after copying.
Native measure/fill counts are4; no scratch is created for malformed text or
Open. Native font-load count7 includes the three rejected host requests, and is
unchanged on Open. Application/window errors, unhandled rejections, native GL
errors and browser/CLI fixture assertions are0. Four ReadPixels stall warnings
are preserved in the full console log. Browserc2d1355 and server31355 closed only
after the terminal API proof was persisted.

All208 frozen source/host/config hashes and approved driver SHA256
`a22cd9a3722d62deb5cda511eeb4157132749238a71769ea35d850666f6ddcf6`
remain unchanged. All654 unowned baseline blobs, including446 original evidence
files, match the parent. Ignored dist was frozen before browser; no all-emitted
before/after hash certificate is claimed. Raw phases/chooser/upload/console/close
logs and actual save metadata use `/tmp/c2d1355-*`. The four-phase driver uses
PHASE0..3; phase1 must fully return before external chooser/upload. Phase3 ran
only after root inspected both screenshots. No new runtime was run to collect
or verify the final JSON.

## Limits

This does not implement a shaping kernel, grapheme editing, IME/bidi typography,
complex-script or emoji fidelity, font service, cross-device equality, device
performance/context-loss/GC/packed/full producer acceptance. No font download,
PNG replay, new example, schema/Scene/file change or product publication follows.
Native proof, sole exact Integration adoption and current composed1254/674
acceptance remain separate. Earlier ASCII/multiline/wrapped and other natives
retain their original immutable receipts.
