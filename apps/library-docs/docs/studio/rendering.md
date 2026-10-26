# Rendering

The **Render** workspace sets how the part looks in a picture: its appearances, the lights, the background and the
camera. It can also add props and animate the part.

- **The model doesn't change.** The settings are saved in the document, but they aren't part of its revision.
- **WebGPU only.** It draws with the studio's WebGPU viewer. On WebGL2 the panel says rendering needs WebGPU, and the
  view stays the modelling look.

Click **Render** in the top bar to open it. The **Render** panel, in the dock, has four tabs: **Appearance**, **Lights**,
**Scene** and **Source**.

![The Render workspace: the part in a brass appearance, the Render panel in the dock and the timeline under the viewport](/shots/studio/rendering/appearance.jpg)

## Appearance

An appearance applies to the selected bodies. With none selected, it applies to every body without its own.

- **Preset:** a ready look such as **Aluminium**, **Steel** or **Brass**, or **Custom**.
- **Colour**, **Metallic**, **Roughness** and **Opacity**.
- **Two-sided**, for open or thin shells seen from inside.
- **Texture:** an image multiplied into the colour.
  - **Repeat every** sets its size in mm.
  - **Cut out below** leaves out what is under an alpha value, for holes, leaves or grilles.
- **Finish:** the marks a process leaves on the surface: **Cast**, **Sand-cast**, **Machined**, **Turned**,
  **Brushed**, **Knurled** or **Bead-blasted**.
  - **Marks** sets their size and **Depth** how strong they are.
  - **Along** sets their direction, X, Y or Z, for the finishes that have one.
- **Clear coat**, a lacquer over the colour, and **Oil film**, an oil's tint on the reflections, from 0 to 1.
- **Shader:** one of the materials written on the **Source** tab.
- **Use the default appearance** removes a body's own.

An appearance is a look, not a material: a body's mass comes from its material, set in the modelling workspace.

## Lights, environment and tone mapping

- **Lights.** **Add sun**, **Add point** and **Add spot** add lights.
  - A sun has **Azimuth** and **Elevation**.
  - A point or spot light has a position, and a **Range** over which it fades. A spot also has a **Cone**.
  - Every light has **Intensity** and **Colour**.
  - One sun can cast a **Shadow**.
- **Shadows.** The shadow is soft, as from a studio key light about 3° across: sharp at the foot of what casts it and
  wider and lighter farther off. Contact shadows darken the creases and the places where parts meet, which the shadow
  map is too coarse to show. Both are on in the Render workspace, with no control for them yet; the modelling look
  is unchanged.
- **Scene.**
  - The background's **Top** and **Bottom** colours, and the **Ambient** light.
  - **Studio** lights the part: **Sky and ground**, **Softboxes** or **Cyclorama**. **Environment** takes an image
    instead, an equirectangular one with its top row overhead.
  - **Environment strength**, for a studio or an image.
  - **Occlusion**, **Ground**, **Grid** and **Edges**.
- **Post.**
  - **Exposure**.
  - **Tone map**: **Filmic (ACES)**, **Soft highlights (AgX)** or **None**.
  - **Grade**: **Neutral**, **Warm studio** or **Cool daylight**, with **Contrast**, **Saturation** and **Vignette**.
  - **Bloom** spreads light from bright areas past their edges, as a glow. The slider controls its strength; 0 turns
    it off. The glow is added before tone mapping, so bright reflections can bloom while the surface stays unchanged.

![The Lights tab](/shots/studio/rendering/lights.png)

![A post on a plate in the Render workspace: its shadow dark at the foot and softer and wider farther off, and the crease where it meets the plate darkened](/shots/studio/rendering/shadows.jpg)

![The Scene tab: the background, the ambient light, the Softboxes studio, its strength and the view toggles; under Post, exposure, tone map and grade](/shots/studio/rendering/scene.png)

## Camera

- **Save this view** keeps the camera with the document, and **Go to saved view** returns to it.
- **Field of view** sets the lens.

### Focus and blur

Under **Camera**, **Focus distance** sets a positive distance along the camera's view axis, in mm.
**Blur radius** sets the maximum blur in CSS pixels, from 0 to 24. A value of 0 keeps the focus setting but
turns the effect off. Changing these settings changes the displayed picture, not the model geometry.

Choose **Pick focus on part**, then click a surface to set its focus distance. A background click cancels the
pick. Choose **Cancel focus pick** to cancel it explicitly. Focus picking requires WebGPU. On WebGL2, the
focus and blur settings remain saved, while the panel explains that the effect needs WebGPU.

The saved Model field is `render.environment.post.depthOfField: { focus, blur }`.
It requires a finite positive `focus` and a finite `blur`; the reader clamps blur to the 0–24 range.
This is a display effect, not a physical camera calibration or a change to measurements.

![View-axis focus depth is 80 mm while eye-to-point distance is 100 mm; blur is a separate CSS-pixel value](/diagrams/focus-distance.svg)

[Open the focus diagram at full size](/diagrams/focus-distance.svg).

## Props and materials

The **Source** tab holds two texts, both in the language of [@barocss/gpu](/packages/gpu/):

- **PROPS · CSS SCENE**: objects placed round the part, such as a plinth.
  - **Unit** scales them.
  - **Apply props** shows an edited source, and **Example** fills in a sample one.
  - A source with an error is reported, and the last good one stays.
- **MATERIALS · @SHADER**: `@shader` materials, each a colour expression with its uniforms. **Add material** starts
  one.

![The Source tab: the props and the materials](/shots/studio/rendering/source.png)

## Timeline and turntable

The timeline animates the bodies:

- **Time** scrubs and plays; **Duration** sets the length.
- **Turntable** turns the camera round the part.
- For a selected body, **Set key** keeps its offset at the current time. A key can be jumped to or removed.

Time and duration use seconds; body offsets use mm. Positions interpolate linearly between keys and stay at the
first or last offset outside their time range. Turntable changes the camera view.
These are authored display motions, not gravity or contact solver results. Their playback does not establish
physical behaviour; see [Experiment evidence](/reference/verification#planned-experiment-evidence).

![The timeline: play, the time and its length, and Turntable](/shots/studio/rendering/timeline.png)

## Exporting an image

**Export image**, the camera button on the Render panel, downloads the view as a PNG. It needs WebGPU.

The PNG records the displayed view, including its appearance and camera. Keep the editable `.bcad` document and
any analysis results separately: an image does not carry the model history or establish manufacturing or physical
validation. See [Files and exports](/studio/files).
