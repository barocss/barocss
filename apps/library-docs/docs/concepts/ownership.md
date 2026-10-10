# IDs and ownership

Keep source identity and display resources separate. An ID identifies data in its documented scope. It does not prove that an object owns native geometry or renderer resources.

## Keep IDs in their scope

Use model, part, face, curve and display IDs as the selected API defines them. A display pick result needs an explicit mapping to native selection. Do not convert an index in a triangulated mesh to a native face ID by assumption.

A derived mesh or pose can change while the native model remains the same. Keep the native source reference if the host will measure, edit or export native data.

## Copy or retain deliberately

Read each API's copy and ownership contract before passing arrays. Some APIs copy input; others retain handles or resources. A copied input does not imply that all transitive native or GPU resources are copied.

- Keep a native model alive while an owned binding requires it.
- Replace display data through the public update/load API.
- Release the binding, scene or host through its documented disposal method.
- Do not use a disposed handle. Handle the package's reported error or refusal.

See [Interop lifecycle](/packages/cad-interop/limits), [Viewer lifecycle](/packages/viewer/limits) and [GPU lifecycle](/packages/gpu/limits) for concrete calls.

## Separate authoring from display

CAD Editor changes native CAD state. Render Editor changes a scene document. Viewer display poses and GPU caller-time clips change display state. Retired Motion is historical; no independent Motion package exists in this snapshot.

Use explicit save/open APIs for the owning document. A screenshot, GLB or GPU packet is not a substitute for the authoring document.
