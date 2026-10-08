# Public sprite source crop: native consumer observation

This is #799's native branch evidence, not a merged-head or release receipt.

Node 22.22.0 built the 124.5-KiB compiled package entry. The independent compiled-consumer declaration check passed. `sprite-crop-probe.mjs` passed copied handle data/snapshot, crop replacement and clearing, nine atomic invalid refusals, reconstruction and editing of a new handle.

Headless Chromium 155 opened the compiled `sprite-crop.html` consumer with WebGL2 at DPR2. One 2×2 RGBA8 atlas had red opaque, transparent, blue opaque and green opaque texels. A sprite under Team over a yellow Back rectangle used an 80×80 logical-pixel destination. With crop `{x:0,y:0,width:1,height:1}`, `(50,50)` was red `[255,0,0,255]`/Sprite. The transparent `{x:1,y:0,width:1,height:1}` crop made it yellow `[255,255,0,255]`/Back. The green `{x:1,y:1,width:1,height:1}` crop made it green `[0,255,0,255]`/Sprite. Clearing the crop made the four destination quadrants red/Sprite, yellow/Back, blue/Sprite and green/Sprite at `(30,30)`, `(70,30)`, `(30,70)` and `(70,70)`. A real pointerdown at sprite center routed Sprite → Team → stage.

Width zero returned `INVALID_SCENE` before changing handle/tree/render state. A schema-valid `{x:2,y:0,width:1,height:1}` crop exceeded the 2×2 asset; renderer submission returned `INVALID_ASSET`, retained all observed pixels/hits and previous accepted Scene, and the host restored the prior handle crop. The atlas's 16 bytes were unchanged.

The browser downloaded the actual [928-byte v1 document](crop-document.json) while the green crop was accepted, then reloaded the page. Real file-chooser Open created a generation-2 renderer and reconstructed display tree. The green crop, green/Sprite center and all 16 atlas bytes returned. Clicking Blue cell on the reconstructed sprite changed the crop to `{x:0,y:1,width:1,height:1}` and `(50,50)` became blue `[0,0,255,255]`/Sprite. The [reopened edited screenshot](reopened-edited.png) shows that state. The final page console had zero messages. Browser and HTTP server were closed after capture.

This fixed nearest-sampled 2×2 atlas does not establish a spritesheet parser, animation scheduling, filtered-edge behavior, broad devices or publication.
