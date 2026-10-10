# Existing font consumer public-helper adoption (#1150)

## Frozen source and ownership

Contract Wiki a656e41 preceded Issue1150. Start Wiki d502fdc and claim6093895013
preceded code. Exact adopted parent75d6469a7b950283a9a424491c6a664867b77697 contains
announced1011/c4ee321a and1024/8ca9aaf1 actual adoptions. Both original checkouts
were exact and clean at start; original branches, receipts and committed
evidence remain intact. See the later deliberate cleanup below. This change owns existing
consumer/host/HTML, package docs, a scoped type config and new adoption evidence.
No core, schema, tree, renderer, Scene, envelope, manifest, root or lock change.
Historical evidence/text-raster and evidence/browser-text files are unchanged.

The host now calls root rasterizeBrowserText. Private measure/draw/readback,
boundsFromMetrics/copyRaster and manual glyph quad assembly are removed. Host
ASCII1..32, fixed24px monospace/DPR2, fonts.ready/load/check, bounded delay and
5s timeout remain. A current-generation callback runs after font readiness and
before the synchronous helper. The narrower1024x128/131072pixels/524288byte
example guard runs AFTER the public helper has prepared its bounded1MiB result.
It does not claim to refuse a narrower host limit before scratch allocation.
Public error objects retain identity. Glyph creation consumes the public layout;
restored editing copies the saved Scene to a candidate tree and calls public
Label.setLayout before fresh renderer admission. Accepted state stays live until
the candidate is admitted. Cold Open uses saved bytes/layout with no helper or
font preparation; supported Scene versions are delegated to public parsing.

## Executed build and focused checks

Node22.22.0 affected declarations/browser build succeeded:233.3KiB dist/index.js.
It was run on the exact parent core before consumer edits; core/build inputs
remain unchanged in this delta. Strict common source-consumer checkJs passed;
the final scoped tsconfig.text-helper.json includes host, consumer and the
compiled-root BrowserTextRaster/ImageAssetInput/GlyphRunLayout/create/setLayout
type fixture and passed. The provider's119-refusal campaign was not repeated.

probe.mjs/focused.json passed31 synthetic host refusals: private input/delay/font
policies, controlled unresolved-ready timeout, stale/superseded/disposed current
checks before helper/scratch, inclusive1024x128/524288bytes, narrower host refusal
after a public-helper532480byte result, and original Canvas2DError identity.
These use synthetic browser/font/metrics/timers. They are not actual font/GPU
proof. The old native Scene23/private-host probe remains historical and must be
run in its preserved original checkout, not used as the new-source gate.

## Actual isolated browser flow

HeadlessChromium148 on macOS, installed chromium1223, software ANGLE WebGL2,
logical320x128/backing640x256, DPR2. Real document.fonts readiness/load/check was
used for normal edits. Generic24px monospace reported loadedFaces0/checktrue;
this is a declaration/readiness observation, not named-face identity.

Fifteen recorded stages cover Canvas2D -> HI -> H I, malformed text refusal,
actual1000px font with32 copies of M ASSET_LIMIT refusal, superseded750ms host
readiness, Save/current27 physical Open, restored helper/setLayout, controlled
timeout, native23 physical Open, restored helper/setLayout, actual PNG decode
and late readiness after Dispose. Eight real pointer clicks routed Label/Back
and stage. Opaque ink is[255,255,255,255]/Label; transparent internal space and
background are[32,40,56,255]/Back. The new helper reproduces the existing fixed
24px label dimensions: Canvas2D238x42/39984bytes, HI60x36/8640bytes,
H I88x36/12672bytes. Exact raster boundaries and cross-platform parity are not
claimed. MalformedHOST_TEXT and actual oversizedASSET_LIMIT retain the accepted
canvas/tree/bytes/pixels with no display renderer creation.

Superseded SlowHI completes font preparation but makes no helper raster or new
candidate. Actual helper/scratch counts rise only for the accepted H I request.
The controlled fonts.ready unresolved promise exercises the real host5s timer:
HOST_FONT_TIMEOUT at5041.9ms, retainedtrue, helper/scratch/renderer unchanged.
This is explicitly an injected readiness wait, not a physical platform font
loading timeout. The original ready property was restored before later edits.

## Actual files and restored edits

Save produced an actual17907byte v1 Scene27 document, SHA256
599f5e545ce95eeef2fc638f16d1e374fc1a57df887cbe9afeb61cabfa1c363d.
A separate physical chooser click followed by one exact upload opened it on a
fresh canvas/tree/renderer. All12672RGBA bytes, Back/Label IDs, contextId, layout,
ink/space pixels and hits match the accepted saved state. Font metadata is null;
helperCalls, fontLoads and scratch2D are unchanged. Current Open proof is stored
in browser-observations.json. Restored HI uses public helper plus setLayout on
the reconstructed candidate, then admits a fresh canvas/renderer.

A second separate physical chooser opened the unchanged original1011 Scene23
file from its preserved native checkout:17907bytes, originalSHA256
f69ee6007f8af0a1d6d519567938f1a4d6291f418c648e29b6b130c6236778bf.
All12672bytes, glyph layout/text/baseline/atlas/opacity/sampling/context/IDs and
interior pixels/hits match. No font/helper/scratch call. The admitted saved Scene
remains version23; current editable tree snapshots use27, so the diagnostic
sceneMatchesTree is false at this one cross-version stage. This is not a layout
or pixel mismatch. Restored public helper/setLayout emits current27. Total
layoutEdits2 proves the two actual restored paths, not direct mutation of the
accepted tree before admission.

Actual PNG download5405bytes, SHA256
fc735da301d0ae4170391d63dd608007a0eb39e9ef21a9b69bf4be57ca0a9d30.
Browser fetch/createImageBitmap decoded the exact downloaded file640x256.
Three interior ink/space/background samples matched exactly. Bitmap closed;
private diagnostic2D readback used willReadFrequently. Screenshot inspected.

## Disposal and observations

SlowHI followed by physical Dispose left helper7/scratch8/draw6 unchanged after
late readiness; no tree/renderer/submit/render followed. The last real click on
the disposed canvas left pointer count8. Display renderer8created=8disposed,
live0; binding8=unbinding8, max live display renderers2. Nine actual GL contexts
in this final flow include8 display and1 temporary PNG renderer. Each reports
native is* live0, shader4/program2/buffer3/VAO2/texture1/FBO0 created=deleted,
GLerror0 and fragment capacity4096. No context loss ran.

The final-page CLI console has0errors/0warnings; application console/error-event
capture is also0/0. Preliminary inspection before the final replay emitted4
GPU-driver ReadPixels stall warnings. These are retained as preliminary
diagnostic observations; no performance claim. Reload invalidated that initial
page and its diagnostic context; the9-context explicit deletion equality claim
is limited to the final recorded page, not the discarded preliminary context.
Own browser session c2d1150 and HTTP31150 server were closed after evidence.
Own private CLI artifacts were moved to /tmp/c2d1150-cli-private-20261010.

## Deliberate cleanup after the file flow

During final preservation checks, the previously present plain recovery paths
for merged1037/1054/1109/1011 were absent. Integration's completed turn and
Wiki Worktree-Cleanup-2026-10-10 confirm deliberate clean/inactive checkout
removal. Original named branches and exact recovery refs still equal their
native commits; committed proof is readable. The actual native1011 physical
upload completed while its path was still present. Do not treat that historical
path as a currently runnable checkout or repeatedly recreate removed copies.
Exact recovery refs under refs/worktree-cleanup/20261010-final are:
1037/cd6c14c25af3d14c,1054/987d64ac6b249c53,1109/e9a0bc1d6d616902,
1011/72bd8ed9543dcc88. The managed1024 original, pending1115/1052/SVG/chart/diagram,
deferred1032 and this1150 checkout remain clean. Cleanup is not new validation.
Unhanded6801c5bc was amended before the first native receipt only to record
this observed preservation timing; product/runtime source and flow are unchanged.

## First failures and fixes

- Initial read of shared-root package paths failed before any write. The fixed
  isolated checkout supplied the files; removal/cwd cause was not inferred.
- Probe worker first read used a wrong relative cwd path. Its first type command
  used a missing package-local TypeScript path; both were corrected to existing
  paths. Its first probe asserted malformed producer bytes in admitRaster; that
  assertion was removed because the host narrows trusted public output and does
  not revalidate producer semantics. Actual host limit/error checks remain.
- Initial UI observation included all asset bytes and made huge diagnostic text.
  Removed that display field before the final replay; existing bytes() supplies
  full-byte proof without placing it in the rendered observation panel.
- A CLI eval containing statements failed with Unexpected token ';'. The
  separate physical chooser still opened the current saved file. Baseline
  counters were recovered from the already recorded pre-Open saved stage, then
  the comparison ran successfully. Replay fixture now records these counters
  in flow1 before chooser Open. No repeated upload was used for this correction.

No shaping/multiline/font installation/context loss/performance/tarball/install,
producer reimplementation, product push, merged-head acceptance or release claim.
Native handoff and Integration adoption remain separate receipts.
