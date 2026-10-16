# Coordinates and units

Choose the coordinate frame before you copy data between packages. A native CAD model, a display mesh, a pose and an image are different data products.

## Keep the native model authoritative

CAD preserves authored geometry and topology. A triangulated mesh approximates the model for display. A GLB file carries display data; it does not replace an editable native model. A renderer image contains pixels and no native topology.

| Data | Meaning | Host responsibility |
| --- | --- | --- |
| Native model | Authored geometry, topology, IDs and feature state | Keep the source for edits and measurements |
| Surface preview packet | Derived positions, indices and declared frame/unit | Read its metadata before display |
| Display mesh / GLB | Rendering data copied or derived from a model | Keep the native source separately |
| Display pose | Placement used by Viewer or caller-time GPU clips | Do not write it back as a CAD edit |
| Image | Rendered pixels | Treat it as output, not geometry |

## Map frames once

The Source0 Surface preview contract preserves authored XYZ and declares Y-up. The native Loader adapter scales that convention once. A Z-up host needs an explicit frame adapter.

Only the separate native face mesh `part-xyz` display adapter maps `(x, y, z)` to `(x, z, -y)`. Do not apply this mapping to every CAD packet. Do not relabel old data as a new frame.

Physics profiles declare their own dimensions and units; check the selected public profile. Do not assume a single up axis or length scale for all packages.

## Verify the transfer

1. Read the source frame and length unit.
2. Choose the host frame and scale.
3. Apply the conversion once at the adapter boundary.
4. Keep the native model and stable IDs for measurements and selection.
5. Compare one known distance and one axis direction in the host.

Read the [CAD guide](/packages/cad/guides), [Interop guide](/packages/cad-interop/guides) and [Viewer guide](/packages/viewer/guides) for actual transfer APIs.
