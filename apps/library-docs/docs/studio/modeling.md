# Modeling workflow

Use this guide to choose the next modeling step.
The detailed pages explain each tool and its supported inputs.

## Goal

Build an editable part from a profile and solid features.
Use parameters for shared sizes. Use a frame when the design needs separate structural members.

## Inputs

- A sketch plane and a profile for the intended feature.
- Sizes for the feature, and named parameters if sizes must change together.
- For a frame, a skeleton and a typed section or section rows from your own file.

## Example: one plate with a through hole

Use the Box route for this example from [Getting started](/guide/getting-started#a-first-part).
The later sections explain sketch-based features and frames as other construction choices.

1. Choose New part, then press <kbd>B</kbd> for Box.
   Set Width X to 64, Depth Y to 32 and Height Z to 8 mm.
   Keep At X, At Y and At Z at 0, then press <kbd>Enter</kbd>.
2. Choose Top in the view buttons, then click the plate's top face.
3. Press <kbd>H</kbd>. Set Type to Through and Diameter to 8 mm.
   Set Centre X to 32 and Centre Y to 16 mm.
   Wait for the HUD to say preview, then press <kbd>Enter</kbd>.
4. Open Parameters. Enter the name `T` and value `8`, then choose Add.
5. Open the box feature in the history.
   Select `T` from the Distance field's ƒ list, then choose Apply.
   This binds the plate thickness to `T`; inspect the accepted result.
6. Choose Save to keep the editable `.bcad` document.
   With a project open, it is saved in that project. Otherwise, the browser downloads it.
   See [Files and exports](/studio/files#the-bcad-document).

![Existing Getting started image: the top-face hole preview and its input fields](/shots/guide/getting-started/hole-preview.jpg)

This image is reused from Getting started. It is not a new run of these parameter and save steps.

For the initial dimensions, the ideal box volume is `64 × 32 × 8 = 16,384 mm³`.
A straight Ø8 through hole removes `π × 4² × 8 = 128π mm³`.
The ideal remaining volume is about `15,981.876 mm³`.
These are calculations from dimensions, not API results or measurements from a new Studio run.

## Work sequence

### 1. Draw and finish a profile

Choose Sketch. With nothing selected, the sketch starts on XY.
Select a flat face first to sketch on that face.
Draw the profile, then add the required dimensions and constraints.
Read the remaining freedom in the sketch panel. Fully defined means the sketch has no freedom left.
Choose Finish sketch when the profile is ready.

![Existing Studio image: a dimensioned rectangle and its sketch constraints](/shots/studio/sketches/rectangle.jpg)

This image is reused from the sketch guide. It is not a new result from this workflow.

### 2. Make a solid feature

Choose Extrude for a profile pulled along its normal.
When a body already exists, use Operation to choose Join to body, New body or Cut from body.
Revolve turns a profile about an axis. Sweep follows a path. Loft connects profiles.
Use the feature history to edit a feature; the features after it rebuild.
See [Part features](/studio/features#from-a-sketch) before choosing another construction method.

### 3. Bind sizes that must change together

Open Parameters and add a named, finite value.
In a feature editor, choose a supported field's parameter from its ƒ list, then Apply.
The field follows that parameter while it is bound.
When editing an existing parameter, submit its value with Enter or by leaving its field.
Typing alone changes the draft.
Check the accepted result. A refused change keeps the accepted parameters, part and references.
Use Configurations to save and apply sets of parameter values.
A configuration does not change suppression or replace assembly components.

### 4. Choose a frame for structural members

A frame is a different construction: each member is a separate body along a skeleton.
Use Frame for a skeleton with shared sections. Use Structural member for one member.
Choose the section and joint treatment, then inspect the member ends.
Picked edges copies straight edge endpoints; it does not make a live link to those edges.
Use Skeletons when the frame's 3D sketch needs constraints or parameter bindings.

## Check the result

- Confirm the profile and plane before making the feature.
- Inspect the resulting bodies and the feature history after an edit.
- Check which fields follow each parameter and which values remain accepted.
- For a frame, inspect the members and use Cut list for lengths, end cuts and quantities.

A sketch defines a flat profile. A solid feature uses geometry to build or change a body.
A parameter supplies a named value. A frame builds members along a skeleton.
Choose these by their role; a frame is not an assembly of inserted part files.

## Refusals and support

Overlapping sketch shapes are refused. A closed shape inside a hole needs a separate sketch.
Invalid parameter names, duplicate names and non-finite values are refused.
Only fields that can store one direct parameter reference offer a binding.
Frame Picked edges requires straight edges. Its copied skeleton does not follow later edge edits.
Section rows come from your files; prefilled section radii are estimates.
Read the detailed refusal before changing the input. Do not treat an unsuccessful rebuild as an accepted part.

## Related details

- [Sketches](/studio/sketches): planes, drawing tools, constraints and profile limits.
- [Part features](/studio/features): solid operations and feature history.
- [Parameters and configurations](/studio/parameters): bindings and accepted values.
- [Frames and weldments](/studio/frames): sections, skeletons, joints and cut lists.
