# Future wrap reference connection — source inspection only

No Model/API/Studio wrap feature is implemented by this note. Root inspected the current739978a27 source.

`engine/mesh.ts:1–5,55–101`: a native full cylinder is two wall half-faces with names `x#1`,`x#2`.
The mesh groups connected same-base names and emits one DisplayFace named `x` (not `x#1+x#2`).
Only groups with different base names emit `+` names. The DisplayFace id is one root native face id;
it is not evidence that one half alone was selected. A full-cylinder mean normal is close to zero.
Do not choose its side from centroid/mean normal or treat a display name as an individual native half.

`engine/rematch.ts:35–40` signatures describe a whole display face. Sig.n counts plus-separated
names, not the number of native `#k` pieces. `engine/references.ts:24–29` preserves that meaning.
There is no existing per-half original-carrier signature in this display layer.

`app/commands.ts:393–406` face-thread takes one curved display selection, determines external versus
internal from vertex positions/normals, then uses its base name. Kernel `part/part-model.ts:1602–1615`
expands that base name to all native halves and checks that all are the same cylinder. This is group
semantics, not arbitrary individual-face semantics. It must not be confused with the D296 text-relief
API's exact individual +Z cap requirement at `api/part.ts:125–132`.

Recommended first future product contract: modify one unique closed native upright cylinder body,
with chart origin fixed explicitly at world +X and +Z axial direction. A body-only command can derive
its unique native exterior group on each evaluation, like rectangular relief, and need not invent a
per-half Sig. Its bounded native source adapter must refuse holes, cuts, extra source walls/slabs,
ambiguous groups or lost carrier; never choose the first classifier match. Dimensions recompute the
chart against the current source; invalid fit refuses atomically. Existing BodyRef/id/prefix paths
still have to be wired through validation, suppression, remapping, codec, parameter scans and edits.

If the product instead requires an authored picked wall, store the full display group/base name and
its existing group signature, add the node to refKey/unsigned/named rematch registration, and expand
that group in the kernel before uniquely selecting the positive-Y original quarter by coefficients
and sense. Do not store one arbitrary half name while capturing a whole-wall signature. No new Sig.n
meaning, document schema bump or legacy conversion is needed. Reject multiple selections, mixed
base-name plus groups, inner walls and unsigned/rematched references consistently with existing paths.

Before that connection: actual native provider topology, shared canonical edge/pcurve directions,
nonintersection/regularity and original-source mass need independent validation. None is approved
by this read-only reference inspection. Browser/UI labels must describe the bounded quarter support.
