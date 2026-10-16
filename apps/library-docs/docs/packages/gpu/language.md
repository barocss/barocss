# GPU scene language

The scene language declares simple 3D objects and assigns their properties. The compiler resolves the declarations on the CPU. `showScene(viewer, source)` shows the accepted scene on the WebGPU viewer: each object becomes a tessellated mesh with its placement and color. Start with the [live scene example](/playground#gpu-scene), then change one property at a time.

This page describes source0 and source1 at local source snapshot `c79d752cb3463a34e6c93cb64e3693bc493c271f`; the grammar is unchanged since `5f5ad866205a21510ac69552e704cc162fa253b5`. The language is a bounded scene format. CSS selectors, JavaScript expressions and arbitrary GLSL are separate formats and are not accepted here.

## Typed Source2 generation

Use [Generate a scene with typed inputs](./generated-scene) for the separate `4dcb0ebb` Source2 compiler with `@param`, `@repeat` and `@when`. Its application displays coefficient-based diagnostic boxes and does not execute the derived shaders. This page keeps its older Source0/1 parser and `showScene` contracts.

## Practice styles and local transforms

The [GPU composition examples](./composition-examples) show type styles with ID overrides, rounded-box dimensions and local capsule endpoints under rotation. Complete sources and actual images accompany the live examples.

## Choose the correct language

| Input | Purpose | CPU entry | Drawing entry |
| --- | --- | --- | --- |
| Source0/1 `@scene` text | Declare primitives and their style | `parseScene`, `compileGpu` | `showScene(viewer, source)` |
| `@shader` text | Set an opaque mesh fragment color | `compileMeshMaterial` | `mesh.material = { shader }` from `materialShader` or `bindingShader` |
| `EngineSceneV0` data | Prepare CPU hierarchy, transforms, bounds and draws | `prepareEngineScene` | Add its prepared geometry with `viewer.add` |
| CAD `@model` text | Define CAD geometry in model units | `compileCadModel` from CAD | Tessellate, convert, then `viewer.add` the mesh |

The scene format does not embed a material block. The [material language](./material-language) changes a mesh color. It does not create scene objects. The CPU Engine data format does not parse `@scene` text.

## First complete source1 scene

```css
@scene shapes {
  version: 1;
  background: #101820;
  sphere #ball;
  box #block;
}
sphere { radius: .65; color: #F1AA55; }
#ball { translate: -1.1 0 0; }
#block {
  size: 1 1.5 .8;
  translate: 1 0 0;
  rotate-x: 20deg;
  rotate-y: 35deg;
  rotate-z: -10deg;
  color: #57B4D9;
}
```

The orange sphere is on the left. The blue box is on the right. The box has full extents `1 × 1.5 × .8`. Its local rotation is `[20,35,-10]` degrees. The sphere has radius `.65`, so its diameter is `1.3` scene units.

The source does not specify a camera. `showScene` frames the scene once along the viewer camera's current direction; the playground's camera starts at `[2,1.6,3]` looking at the origin. The background is dark blue. See the [rendered image and exact input](./examples#rotated-box-and-sphere).

Compile with the explicit source1 option, then show the same text:

```ts
import { compileGpu, createViewer, showScene } from '@barocss/gpu';

// source is the complete text above. canvas is an HTMLCanvasElement.
const compiled = compileGpu({ kind: 'scene', source, sourceVersion: 1 });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
console.log(compiled.ir.pipeline);       // 'sdf'
console.log(compiled.ir.schemaVersion);  // 2
console.log(compiled.ir.draws.length);    // 2

const viewer = await createViewer(canvas, { camera: { position: [2, 1.6, 3], target: [0, 0, 0], up: [0, 1, 0] } });
const view = showScene(viewer, source);
// Call view.dispose() and viewer.dispose() when the host removes this view.
```

Compilation needs no canvas or GPU device. Showing needs WebGPU (`createViewer` rejects with a `ViewerError` without it). The IR keeps the name `sdf` and `compileScene` still generates signed-distance-field shader text; the viewer does not run it and draws tessellated meshes instead.

## Source versions

| Feature | Source0 | Source1 |
| --- | --- | --- |
| Required header | `version: 0;` | `version: 1;` |
| Shapes | `sphere`, `box` | `sphere`, `box`, `cylinder`, `capsule`, `rounded-box`, `torus` |
| Object rotation | No rotation properties | `rotate-x`, `rotate-y`, `rotate-z` |
| Host option | Omit source options | Pass `{sourceVersion: 1}` to `compileGpu`/`parseScene`; `showScene` reads the header |
| Render IR | SDF schema version1 | SDF schema version2 |

`parseScene(source)` and `compileGpu({kind:'scene',source})` use source0. A `version: 1;` declaration does not change their parser mode; pass the explicit option as well. `showScene` is the exception: it passes `sourceVersion: 1` itself when the header declares `version: 1;`. `sourceVersion: 0` is not an accepted explicit option; omit the option for source0.

```ts
import { parseScene } from '@barocss/gpu';

const source0 = '@scene simple { version: 0; sphere #ball; }';
const scene0 = parseScene(source0);
console.log(scene0.version); // 0

const source1 = '@scene simple { version: 1; sphere #ball; }';
const scene1 = parseScene(source1, { sourceVersion: 1 });
console.log(scene1.objects[0].rotateDegrees); // [0, 0, 0]
```

## Grammar and identifiers

The following grammar is an explanatory summary of the parser. The property tables below define each value.

```text
document      = "@scene" identifier "{" scene-item* "}" style-rule*
scene-item    = "version" ":" selected-version ";"
              | "background" ":" hex-color ";"
              | shape "#" identifier ";"
style-rule    = selector "{" property-declaration* "}"
selector      = shape | "#" identifier
property-declaration = property ":" value ";"
identifier    = ASCII letter or "_", followed by letters, digits, "_" or "-"
hex-color     = #RGB | #RRGGBB
```

There is exactly one scene block. Style rules follow that block. Declare objects inside `@scene`; place property blocks after its closing brace. Each declaration requires a semicolon. Empty style blocks are allowed.

Identifiers and keywords are case sensitive. `#ball` and `#Ball` refer to different IDs. Scene names and object IDs use ASCII identifiers. An ID cannot start with a digit. IDs must be unique within the scene. A `#id` style selector must refer to a declared object.

Whitespace and both comment forms are accepted:

```css
// This line is an annotation.
@scene notes {
  version: 0;
  /* Comments do not change diagnostic offsets. */
  sphere #ball;
}
```

The parser discards comment text but retains offsets into the original source. An unclosed `/*` comment is an error.

## Declarations create objects; styles change them

```css
@scene cascade {
  version: 0;
  sphere #small;
  sphere #large;
}
sphere { radius: 1; color: #406080; }
#small { radius: .5; }
sphere { radius: 2; }
```

The declarations create two objects in order: `small`, then `large`. The final radii are `.5` and `2`. The later type rule changes `large`. It does not override the more specific `#small` value.

The cascade is per property:

1. A shape selector has specificity0.
2. An ID selector has specificity1.
3. A higher specificity wins, regardless of source order.
4. At the same specificity, the later declaration wins.
5. An omitted property retains its default.

Rules do not create objects. A valid shape rule can match no objects. An unknown ID selector is refused even if another rule would override it. Each declaration is validated before the cascade; a bad dimension in a losing rule is still an error.

There are no classes, lists of selectors, descendant selectors, pseudo selectors, `!important`, inheritance, variables or CSS units. `translate: 1px 0 0;` is invalid.

## Default values

| Value | Default |
| --- | --- |
| Scene background | `#101820` |
| Object color | `#E08040` |
| Object translation | `[0,0,0]` |
| Sphere radius | `1` |
| Box full size | `[2,2,2]` |
| Source1 rotation | `[0,0,0]` degrees |
| Cylinder radius / full Y height | `1` / `2` |
| Capsule radius / local start / local end | `1` / `[0,-1,0]` / `[0,1,0]` |
| Rounded-box full size / rounding radius | `[2,2,2]` / `.25` |
| Torus major radius / minor radius | `1` / `.25` |

Colors become normalized RGB arrays. For example, `#57B4D9` becomes `[87/255,180/255,217/255]`. Color alpha and named colors are unavailable.

## Property reference

| Property | Applies to | Value | Meaning |
| --- | --- | --- | --- |
| `color` | All shapes | One `#RGB` or `#RRGGBB` | Opaque object color |
| `translate` | All shapes | Three numbers | XYZ scene position |
| `radius` | Sphere, cylinder, capsule, rounded-box | One positive number | Shape radius or box rounding radius |
| `size` | Box, rounded-box | Three positive numbers | Full outer XYZ extents |
| `rotate-x/y/z` | All source1 shapes | One number with `deg` | Local axis rotation |
| `height` | Cylinder | One positive number | Full local Y height |
| `start`, `end` | Capsule | Three numbers each | Local center segment endpoints |
| `major-radius` | Torus | One positive number | Radius of the XZ centerline circle |
| `minor-radius` | Torus | One positive number | Radius of the tube |

Numbers can use signs, decimals and exponent notation. Positive dimensions must be at most1000 and remain positive in Float32. Coordinates must be finite and lie within `[-1000,1000]`. Values use scene units; the language does not define a millimeter unit. CAD mesh conversion has a separate `mmToSceneUnit` option.

### Rotation and coordinate order

The coordinate system is right handed with Y up. Source1 applies local X rotation, then Y, then Z. Rotation uses explicit degrees in `[-360,360]`. Translation places the rotated object in the scene. The compiler uses the inverse rotation when evaluating the object's SDF.

`rotate-y: 35deg;` is valid. `rotate-y: 35;` and `rotate-y: .6rad;` are invalid. Rotating a sphere does not change its silhouette. Box, cylinder, capsule and torus rotation changes their orientation.

### Source1 shapes in one complete input

Open [GPU six shapes](/playground#gpu-six-shapes) to compare these six shapes in one view. Each shape has its own color. The two rows make their silhouettes and extents easier to compare.

```css
@scene sixShapes {
  version: 1;
  background: #101820;
  sphere #ball;
  box #block;
  cylinder #post;
  capsule #pill;
  rounded-box #case;
  torus #ring;
}
#ball { radius: .4; translate: -2 1 0; color: #F1AA55; }
#block { size: .7 .9 .6; translate: 0 1 0; rotate-y: 25deg; color: #57B4D9; }
#post { radius: .35; height: 1; translate: 2 1 0; color: #95D88B; }
#pill { radius: .25; start: 0 -.4 0; end: 0 .4 0; translate: -2 -1 0; color: #CA97E5; }
#case { size: 1 .8 .6; radius: .1; translate: 0 -1 0; color: #ED8090; }
#ring { major-radius: .55; minor-radius: .15; translate: 2 -1 0; rotate-x: 90deg; color: #F0D670; }
```

The accepted object order is sphere, box, cylinder, capsule, rounded-box, torus. Their IDs are `ball`, `block`, `post`, `pill`, `case`, `ring`. Translation places the first three at Y=1 and the last three at Y=-1. The example uses source1 explicitly; its render IR has schema version2 and pipeline `sdf`.

The cylinder is aligned to local Y before rotation. Its height includes the complete straight cylinder, not a half height. The capsule adds hemispherical ends around its center segment; its overall extent is greater than the segment length by two radii.

The rounded box's `size` is its outer size. The rounding radius must be positive and at most half the smallest outer extent. These checks also run in Float32. A radius equal to the smallest half extent is accepted; a larger radius is refused.

The torus axis is local Y, and its centerline is in local XZ. It requires `0 < minor-radius < major-radius` and `major-radius + minor-radius <= 1000`. Float32 radii must retain a positive hole. Capsule endpoints must retain a usable nonzero separation after Float32 conversion.

In this preset, X rotation90deg turns the ring toward the default camera. Change its minor radius from`.15` to`.55` to create an intentional refusal: its major and minor radii would be equal. The compiler returns `VALIDATION`; `view.update` returns those diagnostics and keeps the shown scene. See the [six-shape image and edit steps](./examples#compare-all-six-source1-primitives).

## Compile and inspect errors before drawing

```ts
import { compileGpu } from '@barocss/gpu';

const result = compileGpu({
  kind: 'scene',
  sourceVersion: 1,
  source: '@scene broken { version: 1; box #block; } #block { radius: 1; }'
});
if (!result.ok) {
  for (const d of result.diagnostics) {
    console.log(d.code, d.message, d.range);
  }
}
```

This input returns an error because `radius` is not a box property. The diagnostic message identifies that mismatch. The range refers to the original text, with character offsets `start/end` and 1-based `line/column`. The compiler returns its first diagnostic; it does not perform recovery to find every error.

`parseScene` throws `SceneError` instead of returning `ok:false`. The compiler groups scene errors under `SYNTAX`, `VERSION`, `DUPLICATE`, `REFERENCE`, `VALIDATION` or `LIMIT`; lowering failures use `LOWERING`. Prefer the returned code and range over matching an entire message string.

| Edit | Result |
| --- | --- |
| Omit `version` | Refused: the selected version is required |
| Use source1 text with no host opt-in | Refused: source0 expects `version: 0` |
| Declare the same `#ball` twice | Refused: duplicate ID |
| Style `#missing` | Refused: unknown object ID |
| Set `radius: 0` | Refused: dimension must be positive |
| Set `translate: 1 2` | Refused: three values required |
| Set `rotate-y: 361deg` | Refused: out of rotation range |
| Give capsule equal endpoints | Refused: unusable center segment |
| Set torus minor radius equal to major radius | Refused: no positive ring hole |

## Update a shown scene

```ts
const before = view.result;
const update = view.update(source.replace('radius: .65;', 'radius: 0;'));
if (!update.ok) {
  console.log(update.diagnostics[0].message);
  console.assert(view.result === before);
}
```

`view.update` compiles the candidate before changing anything. A refused source returns its diagnostics and keeps the shown meshes and the previously accepted result. An accepted source replaces the view's meshes and releases shapes no longer used. A lost GPU device is replaced by the viewer, which re-uploads the scene.

The viewer draws on demand (at most one frame per animation frame); it creates no animation clock for the scene. The host controls edits, resizing and disposal. The camera is viewer state (`viewer.camera`, `viewer.fit()`, orbit controls); camera data does not belong in the scene text.

## Budgets and supported rendering

| Boundary | Limit at this source snapshot |
| --- | --- |
| Source | 64KiB UTF-8 |
| Token count | 65,536 |
| Objects | 32 |
| Style rules | 128 |
| Total style declarations | 512 |
| AST nodes | 4,096 |
| Generated fragment source (`compileScene`) | 64KiB |
| SDF steps per ray in that generated shader | 128 |
| Ray travel / hit epsilon in that generated shader | 100 / .001 scene units |
| Tessellation in `showScene` | `segments` 8–128 around a curved primitive (default 48) |

`showScene` tessellates each primitive separately; overlapping objects intersect as meshes and are not merged. It is not a CAD Boolean solver. Each mesh is opaque with its scene color and the viewer's metal–roughness lighting. Material expressions, texture coordinates, alpha, arbitrary meshes and scene hierarchy are outside this grammar. Use a mesh API or a CPU Engine API for its own stated contract.

## API profile

This page describes source0 and source1 for local experimental `@barocss/gpu` version0.0.0 at the source snapshot stated above. Read the [scene input rules](./language#choose-the-correct-language) and [scene compiler contracts](./api#scene-compiler) before constructing compiler inputs. A browser host needs WebGPU and a TypeScript-capable bundler for the local source package.

[Examples](./examples) · [Material language](./material-language) · [API](./api) · [Limits](./limits)
