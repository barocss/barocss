# R6: the examples/gpu-scene flows (G-R40, 2026-10-23)

All 78 flows failed as checked in. 65 are kept and pass under `node examples/gpu-scene/run-flows.mjs`; 13 are retired.

Common to all: in the workspace `@barocss/cad` resolves to CAD's TypeScript sources, which Node does not load. The runner gives each flow the gpu tests' hook (`packages/barocss-gpu/tests/cad-dist.mjs`) through `NODE_OPTIONS`, so child processes get it too.

The 18 flows that needed only the hook are unchanged: engine-camera-ray, engine-lighting-bindings, engine-material-bindings, engine-opacity-bindings, engine-raycast, engine-rotation-clip, engine-scale-clip, engine-scene, engine-scene-frustum, engine-texture-bindings, engine-translation-clip, material-line-comments, material-literal-division, material-radians, material-rgb, material-scalar-mix, scene-line-comments, triangle-geometry.

## Retired (b): the input each needed

- `boolean-buffers-flow.mjs`: --meshes: CAD #887 research meshes (not in the repository).
- `shell-buffers-flow.mjs`: --meshes: CAD #896 research meshes, --planar #887 cross_union (not in the repository).
- `knot-aligned-loft-frame-flow.mjs`: --request: a main.request.json from the research run.
- `knot-aligned-loft-raw-frame-flow.mjs`: --fixtures: two raw donor files, --compiled-sdk: a qualified compiled copy.
- `knot-recipe-loft-frame-flow.mjs`: --authored MAIN0 and --reference MAIN0-result.
- `mixed-workplane-arc-preview-flow.mjs`: --fixtures: native1161 input directory.
- `qualified-body-engine-scene-flow.mjs`: --native-dir: the 1348 original files.
- `source-curve-edit-preview-flow.mjs`: --fixtures: the curve-edit native input directory.
- `source-native-surface-edit-mesh-flow.mjs`: --fixtures: native1147 input directory.
- `source-surface-elevation-frame-flow.mjs`: --fixtures: the CAD1401 demo output.
- `split-body-engine-scene-flow.mjs`: --native-dir: the 1437 demo.
- `workplane-world-curve-preview-flow.mjs`: --fixtures: native1148 input directory.
- `native-reflection-cause-flow.mjs`: another research checkout's build (gpu-native-surface-uv01-binding/…/dist) and the pending #1439 state.

Also removed, used only by those flows: knot-aligned-loft-frame-internal.mjs, knot-aligned-loft-raw-frame-internal.mjs, knot-recipe-loft-frame-internal.mjs, source-surface-elevation-frame-internal.mjs, split-body-engine-scene.ts. The physics examples' base-tracked-ledger.json entries naming them stay as historical text.

## Kept (a): each changed assertion, before → after

"(removed)" marks a check of the repository on the milestone day: an exact namespace size, the parent commit's barrel, bytes, declarations or manifest, a git delta, or a dependency then pending. Every check of actual output stays: WGSL, programs, buffers and values.

### affine-scene-source-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length, 99);`
  - after: (removed)

### axis-box-boolean-buffers-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(exports.length,54);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(Object.keys(sourceAPI).sort(),exports)`
  - after: `assert.ok(exports.every(x => x in sourceAPI))`

### axis-box-contact-buffers-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(exports.length,54);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(Object.keys(sourceAPI).sort(),exports)`
  - after: `assert.ok(exports.every(x => x in sourceAPI))`

### box-geometry-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + name)`
  - after: `(path.includes('/src/') && path.endsWith('/' + name))`

### capsule-geometry-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + name)`
  - after: `(path.includes('/src/') && path.endsWith('/' + name))`

### cone-geometry-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + name)`
  - after: `(path.includes('/src/') && path.endsWith('/' + name))`

### cylinder-geometry-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + name)`
  - after: `(path.includes('/src/') && path.endsWith('/' + name))`

### engine-transform-clip-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length, 101);`
  - after: (removed)

### engine-uv-material-bindings-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length,94);`
  - after: (removed)

### engine-uv-material-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length,93);`
  - after: (removed)

### engine-uv-repeating-material-bindings-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length,98);`
  - after: (removed)

### engine-uv-repeating-material-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length,97);`
  - after: (removed)

### engine-uv-texture-material-bindings-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `row.path.endsWith('/src/' + leaf)`
  - after: `(row.path.includes('/src/') && row.path.endsWith('/' + leaf))`
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...oldRuntime, ...additions].sort())`
  - after: `assert.ok([...oldRuntime, ...additions].sort().every(x => namespace.includes(x)))`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(gitFile('packages/barocss-gpu/package.json')));`
  - after: (removed)
- git delta against the parent commit:
  - before: `assert.deepEqual(delta, [...owned].sort(), 'Exactly four claimed delta paths');`
  - after: (removed)
- every other bundled source file byte-equal to the parent commit's:
  - before: `const expectedBytes = execFileSync('git', ['show', parent + ':' + packagePath], { cwd: repo });     assert.deepEqual(bytes, expectedBytes, 'Fixed provider bytes ' + packagePath + ' from ' + path);`
  - after: (removed)
- the parent commit's runtime names dropped from the expected names:
  - before: `assert.ok([...oldRuntime, ...additions].sort().every(x => namespace.includes(x)))`
  - after: `assert.ok([...additions].sort().every(x => namespace.includes(x)))`

### engine-uv-texture-material-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 148);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, ...additions].sort())`
  - after: `assert.ok([...parentRuntime, ...additions].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(barrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['engine-texture-bindings.ts', 'material-evaluation.ts', 'mesh-shaders.ts']) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)
- the parent commit's declarations unchanged:
  - before: `for (const [name, text] of Object.entries(oldDeclarations)) assert.equal(newDeclarations[name], text, name);`
  - after: (removed)
- exactly these declarations new since the parent commit:
  - before: `assert.deepEqual(Object.keys(newDeclarations).filter(name => !Object.hasOwn(oldDeclarations, name)).sort(), [...additions, ...newTypes].sort());`
  - after: (removed)
- R2d had rewritten a path read from the pinned parent commit; the parent has it at the old path:
  - before: `parentFile('src/material/mesh-material.ts')`
  - after: `parentFile('src/mesh-material.ts')`

### engine-uv-texture-material-wgsl-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `row.path.endsWith('/src/' + leaf)`
  - after: `(row.path.includes('/src/') && row.path.endsWith('/' + leaf))`
- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 157);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'lowerEngineUVTextureMaterialWGSL'].sort())`
  - after: `assert.ok([...parentRuntime, 'lowerEngineUVTextureMaterialWGSL'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(gitFile('packages/barocss-gpu/package.json')));`
  - after: (removed)
- git delta against the parent commit:
  - before: `assert.deepEqual(delta, [...owned].sort());`
  - after: (removed)
- every other bundled source file byte-equal to the parent commit's:
  - before: `if (packagePath !== null && !owned.includes(packagePath)) assert.deepEqual(bytes, execFileSync('git', ['show', parent + ':' + packagePath], { cwd: repo }), 'Fixed provider bytes ' + packagePath + ' from ' + path);`
  - after: (removed)
- f32 underflow refused at compile time since acbf60deb (G5), not later at lowering:
  - before: `const compiled = gpu.compileEngineUVTextureMaterial(source); assert.equal(compiled.ok, true); await reject(name, clone(compiled.material), 'RANGE', error => { assert.equal(error.start, 0); assert.equal(error.end, 0); assert.equal(Object.hasOwn(error, 'cause'), false); }); }`
  - after: `const compiled = gpu.compileEngineUVTextureMaterial(source); assert.deepEqual([compiled.ok, compiled.diagnostics?.map(d => d.code)], [false, ['RANGE']], name); }`

### engine-uv-texture-program-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `row.path.endsWith('/src/' + leaf)`
  - after: `(row.path.includes('/src/') && row.path.endsWith('/' + leaf))`
- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 158);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'lowerEngineUVTextureProgramWGSL'].sort())`
  - after: `assert.ok([...parentRuntime, 'lowerEngineUVTextureProgramWGSL'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(gitFile('packages/barocss-gpu/package.json')));`
  - after: (removed)
- git delta against the parent commit:
  - before: `assert.deepEqual(delta, [...owned].sort());`
  - after: (removed)
- every other bundled source file byte-equal to the parent commit's:
  - before: `if (packagePath !== null && !owned.includes(packagePath)) assert.deepEqual(bytes, execFileSync('git', ['show', parent + ':' + packagePath], { cwd: repo }), 'Fixed provider ' + packagePath);`
  - after: (removed)
- f32 underflow refused at compile time since acbf60deb (G5), not later at lowering:
  - before: `const tiny = gpu.compileEngineUVTextureMaterial(css('image', 'sample(image,1e-50,0)')); assert.equal(tiny.ok, true); await reject('inherited_f32_underflow', clone(tiny.material), 'RANGE', error => { assert.equal(error.start, 0); assert.equal(error.end, 0); assert.equal(Object.hasOwn(error, 'cause'), false); });`
  - after: `const tiny = gpu.compileEngineUVTextureMaterial(css('image', 'sample(image,1e-50,0)')); assert.deepEqual([tiny.ok, tiny.diagnostics?.map(d => d.code)], [false, ['RANGE']], 'inherited_f32_underflow');`

### material-color-return-function-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 128);`
  - after: (removed)
- src/index.ts byte-equal to the parent commit's:
  - before: `assert.equal(await readFile(resolve(pkg, 'src/index.ts'), 'utf8'), parentFile('src/index.ts'));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- dist/mesh-material.d.ts byte-equal to the parent commit's:
  - before: `assert.equal(currentDTS, parentDTS);`
  - after: (removed)
- the same R2d undo:
  - before: `parentFile('src/material/mesh-material.ts')`
  - after: `parentFile('src/mesh-material.ts')`

### material-discrete-evaluation-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 145);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'evaluateDiscreteAuthoredMaterial'].sort())`
  - after: `assert.ok([...parentRuntime, 'evaluateDiscreteAuthoredMaterial'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(barrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['mesh-material.ts', 'mesh-shaders.ts', 'native-directional-light-shader-source.ts']) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)
- the same R2d undo:
  - before: `parentFile('src/material/material-evaluation.ts')`
  - after: `parentFile('src/material-evaluation.ts')`

### material-discrete-selection-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 144);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, ...additions].sort())`
  - after: `assert.ok([...parentRuntime, ...additions].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['material-evaluation.ts', 'mesh-shaders.ts', 'native-surface-uv01-binding.ts']) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)
- exactly these declarations new since the parent commit:
  - before: `assert.deepEqual(Object.keys(currentDeclarations).filter(name => !Object.hasOwn(oldDeclarations, name)).sort(), [...additions, ...newTypes].sort());`
  - after: (removed)
- validateMeshMaterialBinding public since 59c1eff09 (the viewer core):
  - before: `assert.ok(!namespace.includes('validateMeshMaterialBinding')); assert.ok(!/\bvalidateMeshMaterialBinding\b/.test(publicDTS));`
  - after: (removed)
- the same R2d undo:
  - before: `parentFile('src/material/mesh-material.ts')`
  - after: `parentFile('src/mesh-material.ts')`

### material-evaluation-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length, 102);`
  - after: (removed)

### material-locals-flow.mjs

- plain Node cannot load the TypeScript sources the exports map names:
  - before: `const entry=resolve(root,manifest.exports['.'].import),bindingEntry=resolve(dirname(entry),'mesh-material.js'); (imported as they are)`
  - after: `entry and bindingEntry are src/index.ts and src/material/mesh-material.ts bundled by esbuild into the output`

### material-pure-float-function-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 128);`
  - after: (removed)
- src/index.ts byte-equal to the parent commit's:
  - before: `assert.equal(await readFile(resolve(pkg, 'src/index.ts'), 'utf8'), parentFile('src/index.ts'));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- dist/mesh-material.d.ts byte-equal to the parent commit's:
  - before: `assert.equal(currentDTS, parentDTS);`
  - after: (removed)
- the same R2d undo:
  - before: `parentFile('src/material/mesh-material.ts')`
  - after: `parentFile('src/mesh-material.ts')`

### material-scalar-abs-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(results[0].exports.length,54);`
  - after: (removed)

### material-scalar-extrema-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(results[0].exports.length,54);`
  - after: (removed)

### material-shorthand-flow.mjs

- plain Node cannot load the TypeScript sources the exports map names:
  - before: `const entry = resolve(root, manifest.exports['.'].import); const bindingEntry = resolve(dirname(entry), 'mesh-material.js');`
  - after: `both bundled by esbuild into the output, as above`

### material-smoothstep-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(results[0].exports.length,54);`
  - after: (removed)

### native-directional-lights-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 134);`
  - after: (removed)
- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.filter(n => !runtimeAdditions.includes(n)).length, 131);`
  - after: (removed)
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentFile('src/index.ts')));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['mesh-lighting.ts', 'mesh-shaders.ts']) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)

### native-surface-uv01-binding-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 126);`
  - after: (removed)

### native-surface-uv01-frame-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `row.path.endsWith('/src/' + leaf)`
  - after: `(row.path.includes('/src/') && row.path.endsWith('/' + leaf))`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(gitFile('packages/barocss-gpu/package.json')));`
  - after: (removed)
- git delta against the parent commit:
  - before: `assert.deepEqual(delta, [...owned].sort());`
  - after: (removed)
- every other bundled source file byte-equal to the parent commit's:
  - before: `if (!owned.includes(packagePath)) assert.equal(bytes.toString(), gitFile(packagePath), packagePath);`
  - after: (removed)
- namespace includes this flow's names (not exactly the parent commit's plus them); source, emitted and cold namespaces still equal:
  - before: `const namespace = [...parentRuntime, ...additions].sort(); for (const provider of providers) assert.deepEqual(Object.keys(provider.gpu).sort(), namespace);`
  - after: `const namespace = Object.keys(providers[0].gpu).sort(); assert.ok(additions.every(x => namespace.includes(x))); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);`
- f32 underflow refused at compile time since acbf60deb (G5): the frame case became a compile check:
  - before: `['program_literal_f32_underflow', r => r.entries[0].material = compile('@shader #tiny { @fragment { color:mix(#000,#fff,1e-50); } }'), 'PROGRAM', e => { assert.ok(e.cause instanceof gpu.MeshMaterialError); assert.equal(e.cause.code, 'RANGE'); }],`
  - after: `  { const t = gpu.compileNativeSurfaceUV01Material('@shader #tiny { @fragment { color:mix(#000,#fff,1e-50); } }'); assert.deepEqual([t.ok, t.diagnostics?.map(d => d.code)], [false, ['RANGE']], 'program_literal_f32_underflow'); }`

### native-surface-uv01-geometry-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 121);`
  - after: (removed)
- a dependency still pending on the milestone day:
  - before: `assert.equal(namespace.includes('compileNativeSurfaceUV01Material'), false, 'No independent unadopted #1432 dependency');`
  - after: (removed)

### native-surface-uv01-material-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 122);`
  - after: (removed)

### native-surface-uv01-program-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `row.path.endsWith('/src/' + leaf)`
  - after: `(row.path.includes('/src/') && row.path.endsWith('/' + leaf))`
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'lowerNativeSurfaceUV01ProgramWGSL'].sort())`
  - after: `assert.ok([...parentRuntime, 'lowerNativeSurfaceUV01ProgramWGSL'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(gitFile('packages/barocss-gpu/package.json')));`
  - after: (removed)
- git delta against the parent commit:
  - before: `assert.deepEqual(delta, [...owned].sort());`
  - after: (removed)
- every other bundled source file byte-equal to the parent commit's:
  - before: `if (!owned.includes(packagePath)) assert.deepEqual(bytes, execFileSync('git', ['show', parent + ':' + packagePath], { cwd: repo }), packagePath);`
  - after: (removed)
- f32 underflow refused at compile time since acbf60deb (G5), not later at lowering:
  - before: `const compiled = gpu.compileNativeSurfaceUV01Material(source); assert.equal(compiled.ok, true); await reject('f32_underflow_' + name, compiled.material, 'RANGE', error => { assert.equal(error.start, 0); assert.equal(error.end, 0); assert.equal(Object.hasOwn(error, 'cause'), false); }); }`
  - after: `const compiled = gpu.compileNativeSurfaceUV01Material(source); assert.deepEqual([compiled.ok, compiled.diagnostics?.map(d => d.code)], [false, ['RANGE']], 'f32_underflow_' + name); }`

### native-surface-uv01-wgsl-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `row.path.endsWith('/src/' + leaf)`
  - after: `(row.path.includes('/src/') && row.path.endsWith('/' + leaf))`
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'lowerNativeSurfaceUV01MaterialWGSL'].sort())`
  - after: `assert.ok([...parentRuntime, 'lowerNativeSurfaceUV01MaterialWGSL'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(gitFile('packages/barocss-gpu/package.json')));`
  - after: (removed)
- git delta against the parent commit:
  - before: `assert.deepEqual(delta, [...owned].sort());`
  - after: (removed)
- every other bundled source file byte-equal to the parent commit's:
  - before: `if (!owned.includes(packagePath)) assert.deepEqual(bytes, execFileSync('git', ['show', parent + ':' + packagePath], { cwd: repo }), packagePath);`
  - after: (removed)
- f32 underflow refused at compile time since acbf60deb (G5), not later at lowering:
  - before: `const compiled = gpu.compileNativeSurfaceUV01Material(source); assert.equal(compiled.ok, true); await reject('f32_underflow_' + name, compiled.material, 'RANGE', error => { assert.equal(error.start, 0); assert.equal(error.end, 0); assert.equal(Object.hasOwn(error, 'cause'), false); }); }`
  - after: `const compiled = gpu.compileNativeSurfaceUV01Material(source); assert.deepEqual([compiled.ok, compiled.diagnostics?.map(d => d.code)], [false, ['RANGE']], 'f32_underflow_' + name); }`

### plane-geometry-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + name)`
  - after: `(path.includes('/src/') && path.endsWith('/' + name))`

### primitive-frame-preflight-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + file)`
  - after: `(path.includes('/src/') && path.endsWith('/' + file))`
- primitive-scene-renderer.ts removed with the WebGL2 renderers (d4d05fcfb):
  - before: `'primitive-frame-preflight.ts', 'primitive-scene-renderer.ts',`
  - after: `'primitive-frame-preflight.ts',`

### rounded-box-geometry-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + name)`
  - after: `(path.includes('/src/') && path.endsWith('/' + name))`

### scene-conditional-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 139);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'compileConditionalAffineSceneSource'].sort())`
  - after: `assert.ok([...parentRuntime, 'compileConditionalAffineSceneSource'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['scene-product-source.ts', 'scene-arithmetic-source.ts', 'scene-finite-repeat-source.ts', 'scene-front.ts', 'affine-scene-source.ts', 'compiler.ts', 'native-directional-lights.ts', 'mesh-material.ts', 'mesh-shaders.ts'])   assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)

### scene-finite-repeat-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 136);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'compileFiniteRepeatAffineSceneSource'].sort())`
  - after: `assert.ok([...parentRuntime, 'compileFiniteRepeatAffineSceneSource'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['scene-product-source.ts', 'scene-arithmetic-source.ts', 'scene-front.ts', 'affine-scene-source.ts']) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)

### scene-flat-arithmetic-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 132);`
  - after: (removed)
- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.filter(n => n !== 'compileArithmeticAffineSceneSource').length, 131);`
  - after: (removed)
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentFile('src/index.ts')));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- a leaf file byte-equal to the parent commit's:
  - before: `assert.equal(await readFile(resolve(pkg, 'src/scene/scene-product-source.ts'), 'utf8'), parentFile('src/scene-product-source.ts'));`
  - after: (removed)
- the same R2d undo:
  - before: `parentFile('src/scene/scene-product-source.ts')`
  - after: `parentFile('src/scene-product-source.ts')`

### scene-generated-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 140);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'compileGeneratedAffineSceneSource'].sort())`
  - after: `assert.ok([...parentRuntime, 'compileGeneratedAffineSceneSource'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['scene-product-source.ts', 'scene-arithmetic-source.ts', 'scene-finite-repeat-source.ts', 'scene-conditional-source.ts', 'scene-front.ts', 'affine-scene-source.ts', 'compiler.ts', 'native-directional-lights.ts', 'mesh-material.ts', 'mesh-shaders.ts'])   assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)

### scene-literal-parameter-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 130);`
  - after: (removed)
- exact namespace size of the milestone day:
  - before: `assert.deepEqual(namespace.filter(name => !additions.includes(name)).length, 128);`
  - after: (removed)
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentFile('src/index.ts')), 'Old public barrel is an unchanged prefix');`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['scene-front.ts', 'scene-types.ts']) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)

### scene-optional-repeat-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 141);`
  - after: (removed)
- namespace includes these names (not exactly them):
  - before: `assert.deepEqual(namespace, [...parentRuntime, 'compileOptionalRepeatedAffineSceneSource'].sort())`
  - after: `assert.ok([...parentRuntime, 'compileOptionalRepeatedAffineSceneSource'].sort().every(x => namespace.includes(x)))`
- the parent commit's runtime names dropped from the expected names:
  - before: `[...parentRuntime,`
  - after: `[`
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(oldBarrel));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- leaf files byte-equal to the parent commit's:
  - before: `for (const leaf of ['scene-product-source.ts', 'scene-arithmetic-source.ts', 'scene-finite-repeat-source.ts', 'scene-conditional-source.ts', 'scene-generated-source.ts', 'scene-front.ts', 'affine-scene-source.ts', 'compiler.ts', 'mesh-material.ts', 'mesh-shaders.ts'])   assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));`
  - after: (removed)

### scene-quantity-product-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.length, 131);`
  - after: (removed)
- exact namespace size of the milestone day:
  - before: `assert.equal(namespace.filter(n => n !== 'compileMultiplicativeAffineSceneSource').length, 130);`
  - after: (removed)
- the parent commit's barrel as a prefix of src/index.ts:
  - before: `assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentFile('src/index.ts')));`
  - after: (removed)
- package.json equal to the parent commit's:
  - before: `assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));`
  - after: (removed)
- the same R2d undo:
  - before: `parentFile('src/scene/scene-parameter-source.ts') (twice)`
  - after: `parentFile('src/scene-parameter-source.ts')`

### source-scene-bounds-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length, 102);`
  - after: (removed)

### sphere-geometry-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + name)`
  - after: `(path.includes('/src/') && path.endsWith('/' + name))`

### torus-geometry-flow.mjs

- R2d: the source graph under src/, any folder:
  - before: `path.endsWith('/src/' + name)`
  - after: `(path.includes('/src/') && path.endsWith('/' + name))`

### triangle-normal-generation-flow.mjs

- exact namespace size of the milestone day:
  - before: `assert.equal(Object.keys(providers[0][1]).length, 99);`
  - after: (removed)
