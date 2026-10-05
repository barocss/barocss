# @barocss/gpu (private experimental v0)

An independent CSS-shaped scene language and original WebGL2 SDF renderer.
This package has no React, Three.js, GSS, CAD or existing utility-class dependency.
It is private, additive and not a claim of CSS/GSS compatibility or production readiness.

## Supported language

```css
@scene demo {
  version: 0;
  background: #101820;
  sphere #ball;
  box #cube;
}
sphere { radius: 1; color: #e08040; }
#ball { translate: -1 0 0; }
#cube { size: 1 2 1; translate: 1 0 0; color: #4090e0; }
```

Exactly one scene, mandatory version 0, ASCII names/IDs, unique object IDs.
Comments and whitespace are permitted. One type selector (`sphere`, `box`) or ID
selector per style rule. No inheritance, classes, groups, lists, pseudo selectors,
URLs, expressions, scripts, arbitrary shaders or silently ignored syntax.
`background` is scene-only; `color` is opaque #rgb/#rrggbb. Numeric vectors have
exactly three whitespace-separated components, without units. `radius` is sphere-only;
`size` is box-only and specifies full extents. `translate` applies to both shapes.
Defaults: background #101820, object color #e08040, radius 1, size 2 2 2,
translation 0 0 0. ID specificity wins over type; later declarations win ties.
Repeated style properties are allowed. Duplicate scene version/background,
unknown IDs/properties/selectors and properties applied to the wrong shape fail.

Limits: 64 KiB UTF-8 source, 32 objects, 128 rules, 512 style declarations,
finite numbers, coordinates with absolute value <=1000, dimensions >0 and <=1000.
Geometry must also remain positive after conversion to GPU float32. Values smaller
than the ray epsilon may be accepted but need not produce visible geometry.
Diagnostics carry source offsets and one-based line/column positions.

## Built ESM API

```js
import { parseScene, compileScene, mountScene } from '@barocss/gpu';
const scene = parseScene(source); // throws SceneError with diagnostics
const shaders = compileScene(scene); // revalidates structured input
const renderer = mountScene(canvas, source); // throws GPUError on GL failure
const result = renderer.update(nextSource); // {ok:true} or {ok:false,error}
renderer.resize(640, 480);
const rgba = renderer.readPixels(); // bottom-left origin, Uint8Array
renderer.dispose(); // idempotent
```

`scene` and `shaders` getters expose the accepted state. Invalid parse, validation,
shader compilation/link or candidate GL draw returns failure and keeps the accepted
scene/frame when the context remains usable. A lost context cannot preserve usable
pixels: it is explicit failure and requires a fresh mount. Missing WebGL2 fails;
there is no CPU fallback. Resize/read/getters throw after disposal/context loss;
update returns failure after disposal/context loss. Dispose removes only this
renderer's programs/shaders/VAO and its listener. No timer or animation loop exists.
Use a dedicated canvas/context: drawing sets default framebuffer, program, VAO,
viewport and blend/depth/scissor/cull/color-mask state; previous host GL state is
not restored. Buffer sizes are integer 1..4096 with <=4,194,304 total pixels.

## Rendering contract

Right-handed scene coordinates, +Y up. Fixed camera at (0,0,6), looking toward -Z,
vertical perspective field of view 45 degrees; aspect follows buffer size.
Sphere and axis-aligned box SDFs are evaluated with a fixed template. Lowest
signed distance wins; equal distances retain the earlier declared object.
128 ray steps, maximum travel 100 units, hit/normal epsilon 0.001. The camera
may be inside a shape; surfaces below epsilon and distant/off-camera objects are
not visibility guarantees. No textures, CSG, rotation, scaling, shadows or picking.
Light direction normalize(-0.6,0.8,1); ambient .35 plus Lambert .65.
Object color uses gamma-2.2 conversion to linear before lighting and back afterward.
Background is emitted unchanged. No raw source/name/ID enters GLSL.
Generated fragment shader <=64 KiB; per-frame work also has buffer/object/step ceilings.

WebGL2 behavior reference: [Khronos specification](https://registry.khronos.org/webgl/specs/2.0.0/).
Original implementation, not GSS code or compatibility.

## Verification and local example

Build before tests: `pnpm --filter @barocss/gpu build:library`.
Run lint, type-check, test and test:consumer. The consumer packs built artifacts,
imports ESM and compiles declarations independently.

```sh
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node \
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
pnpm --filter @barocss/gpu test:browser
```

The pixel gate must obtain actual WebGL2 and readPixels. Missing browser/context
is failure, never skip. Software WebGL proves functionality only; it proves no
physical-GPU execution, throughput or performance. Evidence retains source,
validated data, shaders, PNG/JSON, SHA/hash/backend/buffer/assertion details.
The example lives in `examples/gpu-scene/`; follow its README to run on loopback.
