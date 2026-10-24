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
- **Shader:** one of the materials written on the **Source** tab.
- **Use the default appearance** removes a body's own.

An appearance is a look, not a material: a body's mass comes from its material, set in the modelling workspace.

## Lights, environment and tone mapping

- **Lights.** **Add sun**, **Add point** and **Add spot** add lights.
  - A sun has **Azimuth** and **Elevation**.
  - A point or spot light has a position, and a **Range** over which it fades. A spot also has a **Cone**.
  - Every light has **Intensity** and **Colour**.
  - One sun can cast a **Shadow**.
- **Scene.**
  - The background's **Top** and **Bottom** colours, or an **Environment** image.
  - **Environment strength** and **Exposure**.
  - **Tone map**: **Filmic (ACES)** or **None**.
  - **Edges**, **Grid**, **Ground** and **Occlusion**.

![The Lights tab](/shots/studio/rendering/lights.png)

## Camera

- **Save this view** keeps the camera with the document, and **Go to saved view** returns to it.
- **Field of view** sets the lens.

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

![The timeline: play, the time and its length, and Turntable](/shots/studio/rendering/timeline.png)

## Exporting an image

**Export image**, the camera button on the Render panel, downloads the view as a PNG. It needs WebGPU.
