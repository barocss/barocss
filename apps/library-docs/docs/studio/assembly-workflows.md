# Assembly workflow

Use this guide to place reusable parts and decide whether the assembly can move.
Assembly placement and robot motion have different support limits.

## Goal

Place part instances, constrain them with mates and inspect the solved assembly.
For a mechanism, continue to the supported robot pose and motion tools.

## Inputs

- Part documents prepared as separate .bcad files, plus the document's own base-part bodies.
- An intended position for each instance and compatible faces or references for its mates.
- For robot work, mates that leave supported motion free and the required joint settings.

## Work sequence

### 1. Insert parts and place instances

Choose Insert part to place a .bcad document as an instance.
Select the instance in Browser to inspect its definition and bodies.
Use its gizmo or typed position to place it.
Copies share one part definition. Their placements remain separate.
Use Make independent only when one copy needs a definition of its own.
A newer revision waits for acceptance; loading the file does not replace all copies immediately.

### 2. Add mates and read the remaining freedom

Select a face that stays, then a face on the part to move.
Choose a compatible mate and inspect it in Mates.
The base part and grounded parts stay fixed. Typed placement cannot override existing mates.
Read the Freedom line and any Mate refused reason before adding another constraint.
A solved mate can leave motion free; a part does not have to be fully fixed to be correctly assembled.

### 3. Check the current assembly

Inspect the placements and resolve unmet mates.
Use Interference to find overlap at the current placement.
Use Clearance in Preview & analysis to distinguish designed contact, touching, overlap, near and clear.
Explode changes the display only. It does not change the placements, mates or exports.
These checks describe the current assembly; they do not establish clearance through a whole motion.

### 4. Continue to a supported robot pose

Open Joints. The joint type follows the motion left free by the mates.
Choose Base link to select the link that stays fixed.
Use a joint slider, or submit a numeric pose with Apply or Enter.
Home returns joints to zero, the pose solved by the mates.
A pose is a preview. It is not saved and does not add an undo step.

![Existing Studio image: the Joints card and sliders for a two-link arm](/shots/studio/robots/joints.jpg)

This image is reused from the robot guide. It is not a new result from this workflow.

## Check the result

- Confirm which instances share a definition and which revision they use.
- Check placements, remaining freedom and unmet mate reasons.
- For robot work, confirm the joint tree and the pose before creating a path.
- Use the path and motion tools described in [Robots](/studio/robots#moving-it) for movement checks.

Gravity torques shown at one pose describe that pose. They do not establish loads during a motion.
Motion checks need their own path, limits and inputs. Playing a preview does not save a motion.
See [Limits and sizing](/studio/robots#limits-and-sizing) for duty and actuator checks.

## Refusals and support

Two fixed parts cannot be mated. An unsolved mate is not an accepted placement constraint.
A valid assembly mate can still be unsupported by the robot motion tree.
For example, a solved Universal placement does not yet provide a supported robot joint or export.
A numeric pose outside its set joint limits is refused and keeps the previous pose.
Studio Check path still refuses looped motions; supported loop playback has a separate scope.
Showing a variant also blocks modeling edits. Show the master before editing the assembly.

## Related details

- [Assemblies and mates](/studio/assemblies): placement, definitions, mates and variants.
- [Face and edge references](/studio/assemblies#face-and-edge-references): supported mate targets.
- [Robots](/studio/robots): joint trees, poses, paths and export limits.
- [Parameters and configurations](/studio/parameters#configurations): part configurations versus assembly variants.
