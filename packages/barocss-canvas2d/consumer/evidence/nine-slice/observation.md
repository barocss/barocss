# C2D-50 native Chromium/WebGL2 observation

The compiled consumer ran in headed Chromium 155 on a real WebGL2 canvas at logical 32 × 24 and DPR 2. A 3 × 3 RGBA8 asset provided distinct colors for all nine cells. At 7 × 5 logical pixels, the renderer returned these exact corner, edge and center RGBA values: top left `[255,0,0,255]`, top `[255,128,0,255]`, top right `[255,255,0,255]`, left transparent cell showing the gray background `[64,64,64,255]`, center `[0,255,0,255]`, right `[0,255,255,255]`, bottom left `[0,0,255,255]`, bottom `[128,0,255,255]`, and bottom right `[255,255,255,255]`. Resizing to 9 × 7 retained all nine sampled values while the center grew. The opaque point returned `Panel, Back` from `hitTestAll`; the transparent point returned only `Back`. Two real mouse pointerdowns delivered `Panel → stage` and `Back → stage` respectively.

The browser downloaded the attached 1,021-byte v1 Scene v12 document. After a page reload, chooser Open staged generation 2 on a fresh canvas, renderer and display tree. It restored 9 × 7 geometry, the four insets, all 36 RGBA8 asset bytes, all nine pixel samples and the same hit stacks. The restored public handle then changed the right inset to zero and resized to 11 × 9; WebGL2 pixels and the one-ID hit stack remained valid. The screenshot shows this reopened and edited state. The browser console reported zero errors and warnings.

Separate actual WebGL2 queries checked sliced-image options. Linear sampling kept the transparent cell's hit on `Back` and the center hit on `Panel, Back`. Tint `[0,1,1]` changed the red top-left pixel to `[0,0,0,255]`. Additive center composition over gray produced `[64,255,64,255]`, while normal composition produced `[0,255,0,255]`. A transparent clipping frame kept `Panel, Back` and its red pixel inside the clip; outside it, only `Back` and gray `[64,64,64,255]` remained.

With anchor `(0.5,0.5)` and position `(10,10)`, the public world box moved to `{x:6.5,y:7.5,width:7,height:5}`. The new point hit `Panel, Back`; the former point hit only `Back`. A separate 5 × 5 image with the same 3 × 3 cells embedded at crop `(1,1,3,3)` retained the sampled red, green and yellow pixels and the one-ID hit stack after `setImageSource`.

Changing that crop to `(3,3,3,3)` passed the pure handle shape check but exceeded the registered 5 × 5 asset. Renderer admission returned `INVALID_ASSET`. Its previously accepted red pixel and `Panel, Back` stack stayed unchanged after another render.

Calling `setSlice(null)` returned to a plain image and kept `Panel, Back` at the opaque point. Restoring the four one-pixel insets returned the green center pixel and the same semantic stack.

This observation is one Chromium/WebGL2 path. It does not establish device-wide subpixel seam behavior, batching performance or a published package.
