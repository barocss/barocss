# Learn CAD with BaroCSS

This learning path is for someone who wants to **make and edit parts in the actual CAD Editor**. Each exercise begins with a real supported preset, changes one parameter, inspects the accepted result, and ends with editable saved data. You do **not** need to choose internal source dialects, author graph IDs, or write TypeScript.

The product is currently a local experimental workspace. A source-backed lesson is **not** evidence that its browser, GPU, file picker, release or manufacturing use has been validated.

## Start here: your first editable part

**Lesson 1 — [Cut an underside pocket](./first-model)** · Available in the current `develop` documentation.

You will load a 32 × 24 × 8 mm plate, change underside recess depth from 4 to 8 mm, see the through-window, practise **Apply dimensions**, **Discard draft**, **Undo/Redo**, inspect `part` against `plate`/`tool`, and save/reopen the actual authored model.

**Try it yourself:** change to depth 4, accept; change to depth 8, accept; undo; redo; download; reopen; select `part` again. A passed native fixture does not prove the browser interaction or downloaded file was successful on your machine.

## Upcoming lessons: source-backed, not yet adopted

The following tutorials have been proposed in separate **normal GitHub PRs**, but are not local documentation routes in this baseline. Follow the PR links to review the draft content. **Do not assume a lesson is deployed or merged just because its engine capability exists.**

| Planned lesson | Key learning goal | Documentation status |
| --- | --- | --- |
| Round post | Diameter vs radius, center location, rational stored boundary; certified volume unavailable | [PR #1746](https://github.com/barocss/barocss/pull/1746) — awaiting integration |
| Mounting plate | Through-hole, blank vs plate, strict containment and refusal; native-vs-mesh topology | [PR #1754](https://github.com/barocss/barocss/pull/1754) — awaiting integration |
| L-bracket | Union of two qualified rectangular extrusions, named operands, CONTACT refusal | [PR #1757](https://github.com/barocss/barocss/pull/1757) — awaiting integration |

Each future local link will be activated **only when its content exists on the accepted documentation branch**. PR statuses above describe this page's source snapshot; check GitHub for newer acceptance.

## The core workflow you will repeat

1. **Load** an actual built-in example through **Modeling examples**. Confirm replacement before discarding the current accepted part.
2. **Edit** one named millimetre parameter. Raw text marked **Dimension changes pending** is not yet native geometry.
3. **Apply dimensions**; accept only if native construction **and** display admission succeed. On refusal, preserve the previous accepted model.
4. **Inspect** the named output. A hidden `blank`, `tool` or other output may still be present in the authored file.
5. **Save or open a model**: **Download model** starts a browser download; **Choose model file** only stages UTF-8 source, and **Open saved model** performs the actual native admission after confirmation.
6. **Re-edit** the reopened model to verify that you preserved authored intent rather than exporting a non-editable mesh.

## What should you learn before calling a model accurate?

**Native geometry** (authored sketches, accepted feature operations and qualified B-Rep/other native families) is the authority for this CAD project. **Display triangles, GPU pixels, camera pose and approximate selection** are derived presentations.

A `convex-planar` solid with a qualified exact volume is different from a `stored-rational-circle-prism` or `stored-rational-plate-hole` whose editor reports **Certified volume unavailable**. Do not calculate a nominal cylinder volume and relabel it as certified material. Likewise, a valid display mesh does not prove manifold topology, unrestricted Boolean support, CAD interchange, tolerances or manufacturing readiness.

For what is currently admitted or refused, use [CAD modeling capabilities](../cad/capabilities) and [the modeling guide](../cad/modeling).

## Continue as a developer

After you understand the user-facing workflow, take the [typed CAD quickstart](../cad/quickstart), the [complete modeling API guide](../cad/modeling), and the [CAD Editor pure-session quickstart](./quickstart) for embedding the UI. The advanced [CAD language reference](../cad/language) is for separate text compiler/Curve/Surface profiles, not a prerequisite for a first solid.

## Verification boundary

**Checked for this course index:** existing `develop` tutorial routes and source-backed language from the prior issue/guide. **UNRUN here:** live browser exercises, screenshots, GPU pixels, fresh file-download/restore, VitePress build and publication. The underlying provider test reports have their own source pins; this learning index does not re-execute them.

[CAD Editor overview](./) · [First lesson](./first-model) · [CAD engine capabilities](../cad/capabilities)
