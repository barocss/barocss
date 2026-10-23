# @barocss/cad

The CAD kernel. It is a boundary-representation (B-rep) modeller with NURBS curves and surfaces, written in TypeScript,
with no WebAssembly and no external geometry library. The studio, the document model and the agent's tools all run on
it.

- **Exact surfaces.** Planes, cylinders, cones, tori and B-spline surfaces stay exact through Booleans, fillets and
  offsets.
  - STEP is written from them.
  - Mass properties are integrated over them. The few curved bodies the quadrature can't integrate fall back to the
    tessellation, and their result says so (`method: 'tessellated'`), with an error bound.
- **Stable names.** A part is a list of features. Faces are named by the feature and role that made them, such as
  `p.top` or `h.side0`. Those names are kept through every later feature, and through parameter edits that keep the
  topology.
- **Correct or refused.** An operation gives a valid body, or a `CadPartError` saying why it can't. It doesn't return an
  approximate body. See [B-rep, robustness and refusals](/packages/cad/robustness).
- **Meshes too.** Imported STL, OBJ and tessellated STEP bodies are faceted B-reps, with their own Booleans, holes and
  splits.

## Status and install

The package is `@barocss/cad`, version `0.0.0-experimental`. It is unreleased and not on npm.

- **From the repository.** Use it from a checkout, as a workspace package.
- **TypeScript sources.** Its entry point is the TypeScript source itself (`./src/index.ts`). Use it with a bundler or
  a TypeScript-aware runtime; there is no build step to run first.
- **One entry point.** Everything is exported from `@barocss/cad`.

<<< @/../samples/cad-part.test.mjs#import

## A part in code

A part is a JSON document: its units, its parameters, and its features in order. `evaluateCadPart` evaluates it and
returns a snapshot. Its `outputs` are the bodies no later feature consumes.

<<< @/../samples/cad-part.test.mjs#part

Each output measures itself, checks itself and writes itself:

<<< @/../samples/cad-part.test.mjs#outputs

These samples run in `apps/library-docs` (`pnpm test:samples`), against the package's sources.

## Where next

- [Modeling API](/packages/cad/modeling): the part document, evaluating, outputs and tessellation.
- [B-rep, robustness and refusals](/packages/cad/robustness): what the kernel guarantees, and what it refuses.
- [Exchange formats](/packages/cad/formats): STEP, IGES, STL and DXF.
- [@barocss/cad-model](/packages/cad-model/): the studio's document model on top of the kernel.
