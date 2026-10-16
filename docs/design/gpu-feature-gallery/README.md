# GPU feature result target gallery

**TARGET DESIGN / NOT ACTUAL ENGINE CAPTURE.** These PNGs are AI-generated visual design references created with the built-in image-generation tool. They are not BaroCSS GPU output, tests, screenshots, numerical or performance evidence. No implementation, editor UI, develop changes, runtime validation, release or merge is included.

Current product naming is cad-studio. Historical issue titles may mention cad-editor or render-editor; those links establish engine feature provenance, not a proposal to restore the old editors.

## Evidence and scope (2026-10-16)
- [GPU Engine Roadmap](https://github.com/barocss/barocss/wiki/GPU-Engine-Roadmap): E3 UV textures; E4 later material/light maturity; postprocessing/backend acceptance separate.
- [#1579](https://github.com/barocss/barocss/issues/1579): authored directional-light qualified Surface WebGPU viewport. Board01 changes intended light direction only. Legacy opaque/diffuse profile; no cast shadows, PBR, reflective environment or actual device claim.
- [#1584](https://github.com/barocss/barocss/issues/1584): bounded point lights. Board02 changes intended range only. Artistic weight max(1-d/r,0)^2, not physical inverse-square. Source/software stage and external physical-device acceptance are separate. No numerical brightness validation.
- [#1184](https://github.com/barocss/barocss/issues/1184): source-adopted generic EngineUV UNLIT texture route; actual generic device/pixel/lifetime acceptance explicitly UNRUN in issue. Board03 changes one source image region, nearest/clamp unchanged.
- [Pinned texture source](https://github.com/barocss/barocss/blob/88c3342e208e721be859089372bd09d12e5173ae/packages/barocss-gpu/src/engine-texture-bindings.ts) admits opaque rgba8/srgb/bottom-left/nearest/clamp-to-edge only. No linear filtering, alpha or generic PBR is represented.
- [#1512](https://github.com/barocss/barocss/issues/1512) and [#674](https://github.com/barocss/barocss/issues/674) retain actual runtime/integration evidence gates.

## Boards
![Directional-light concept](01-directional-light.png)
![Point-light range concept](02-point-light-range.png)
![UV source update concept](03-uv-texture-update.png)

## Design review and evidence limits
Panels use matched scene concepts and intended single-variable changes. Image generation introduces minor silhouette, placement, surface texture and brightness drift. These are qualitative visual targets, not controlled captures, geometry equality, shader-equation or sampler validation. Actual validation must later use real engine output with identical source/camera/geometry and pinned backend. No such run occurred here.

The first directional and point images were independently visually reviewed; embedded strict Same geometry wording was replaced with matched-concept wording. A rejected UV filtering draft was not published: current source admits nearest only. Final UV draft removes ground/cast shadows and replaces the proposed filter comparison with source-image update.

## Next nonduplicate design queue
1. Authored light color/intensity relationships under #1445/#1579.
2. Opaque material uniform/color expressions under #779/#1439.
3. Transparency as a separately labeled future target only after reading #1237 and its exact limits.
Shadows, environmental reflections, physically based materials and postprocessing are not current-support claims; require their own grounded future-design scope before adding imagery.

## Publication
Only docs/design/gpu-feature-gallery/ on branch design/gpu-feature-gallery-20261016. Base develop snapshot 88c3342e208e721be859089372bd09d12e5173ae was read, never modified. No application/package source changes. Prompts are in prompts.json.

## Additional reviewed targets
- Board04: [opaque material color uniform #779](https://github.com/barocss/barocss/issues/779). Intended base-color change, fixed camera/geometry/light. No PBR or texture support inferred.
- Board05: [authored light color #1445](https://github.com/barocss/barocss/issues/1445) / [directional profile #1579](https://github.com/barocss/barocss/issues/1579). Intended light RGB change on neutral matte materials. Not a colorimetric measurement.
Both images were inspected and independently accepted as qualitative concepts. Existing capture and geometry-drift limitations apply.

![Opaque color uniform](04-opaque-material-uniform.png)
![Authored light color](05-authored-light-color.png)

## Future opacity and normalized native coordinates
- Board06 is explicitly a **future graphics target** for [#1237](https://github.com/barocss/barocss/issues/1237). CPU opacity/order preparation does not establish rendered alpha support. It depicts simple source-over intent without refraction, Fresnel, shadows or physical glass. No numeric alpha calibration is claimed. Independent review rejected the initial dark-mask overlap; final brighter warm/neutral overlap and nonnumeric labels were reviewed.
- Board07 maps direct U/V gradients from [#1432](https://github.com/barocss/barocss/issues/1432) and native binding [#1439](https://github.com/barocss/barocss/issues/1439). Normalized derived shader coordinates are not exact native geometry queries. CPU/compiler/binding completion does not establish a real current-runtime capture. Camera/surface shape are intended controls, not identical pixel geometry.
Both final PNGs were inspected and independently accepted as qualitative target designs.

![Future opacity concept](06-future-opacity-composition.png)
![Native normalized-coordinate concept](07-native-surface-uv01.png)
