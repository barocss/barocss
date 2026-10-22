import * as AdvancedShaderAPI from '@barocss/gpu';

// The material profile's source pin (its language and CPU results); the host itself draws on the WebGPU viewer of the
// pin in scripts/profiles/gpu-uv-repeating-webgpu-v0.json (G18.2: no app-owned WebGL2).
const sourceProfile = '363f583cfb3d2fde6ebf70330ccd6e786e098713';
const scene = {
  format: 'barocss-gpu-engine-scene', version: 0, id: 'advanced_uv_scene',
  coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0],
  camera: { eye: [0, 0, 3], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: 0.1, far: 10 },
  geometries: [{
    format: 'barocss-gpu-triangle-geometry', version: 0, id: 'advanced_uv_quad',
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw',
    positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1], indices: [0, 1, 2, 0, 2, 3],
  }],
  materials: [{ id: 'advanced_uv_material', type: 'unlit', colorSpace: 'linear', color: [1, 1, 1] }],
  nodes: [{
    id: 'advanced_uv_node', type: 'mesh', parentId: null,
    translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true,
    geometryId: 'advanced_uv_quad', materialId: 'advanced_uv_material',
  }],
};

function expressionSize(expression) {
  const children = expression.kind === 'unary' ? [expression.value]
    : expression.kind === 'binary' ? [expression.left, expression.right]
      : expression.kind === 'call' ? expression.args : [];
  const sizes = children.map(expressionSize);
  return {
    nodeCount: 1 + sizes.reduce((count, child) => count + child.nodeCount, 0),
    depth: 1 + Math.max(0, ...sizes.map(child => child.depth)),
  };
}

/**
 * App code on the public package: the material compiled and bound by the public preparer, drawn by the package's
 * WebGPU viewer as an unlit quad filling the canvas (its shader material: the public WGSL lowering). Not a renderer.
 */
export async function createAdvancedShaderExample(canvas, source) {
  const viewer = await AdvancedShaderAPI.createViewer(canvas, { controls: false, background: '#000000' });
  let accepted = null, disposed = false, frameCount = 0;
  // (The quad as wide as the canvas: uv 0..1 across it, as the WebGL2 host drew it; an orthographic view of height 2.)
  const aspect = canvas.clientWidth && canvas.clientHeight ? canvas.clientWidth / canvas.clientHeight : canvas.width / Math.max(1, canvas.height);
  Object.assign(viewer.camera, { projection: 'orthographic', position: [0, 0, 3], target: [0, 0, 0], up: [0, 1, 0], fovY: 2 * Math.atan(1 / 3) * 180 / Math.PI });
  const quad = viewer.add({
    positions: new Float32Array([-aspect, -1, 0, aspect, -1, 0, aspect, 1, 0, -aspect, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array(scene.geometries[0].uvs), indices: new Uint32Array(scene.geometries[0].indices),
  }, { material: { color: '#000000', unlit: true }, castShadow: false });
  viewer.environment = { ...viewer.environment, ambientOcclusion: false };

  function available() { return !disposed; }
  function live() { if (!available()) throw new Error('WebGPU host is unavailable; recreate the example to recover'); }
  function prepare(material, uniforms) {
    return AdvancedShaderAPI.prepareEngineUVRepeatingMaterialBindings(scene, {
      format: 'barocss-gpu-engine-uv-repeating-material-bindings', version: 0,
      sceneId: scene.id,
      bindings: [{ materialId: 'advanced_uv_material', material, uniforms }],
    });
  }
  function present(prepared) {
    const binding = prepared.resolvedBindings[0].binding;
    quad.material = { color: '#ffffff', unlit: true, shader: AdvancedShaderAPI.uvRepeatingShader(binding.material, binding.uniforms) };
    viewer.requestRender();
    frameCount++;
  }
  function report() {
    const binding = accepted?.resolvedBindings[0].binding;
    const size = binding ? expressionSize(binding.material.expression) : { nodeCount: 0, depth: 0 };
    return {
      backend: 'Example WebGPU viewer · public WGSL repeating UV material', sourceProfile,
      shaderId: binding?.material.shaderId ?? null,
      uniforms: binding ? { ...binding.uniforms } : {},
      controls: binding ? binding.material.uniforms.map(uniform => ({ ...uniform })) : [],
      loweredExpression: binding ? AdvancedShaderAPI.lowerEngineUVRepeatingMaterialWGSL(binding.material, { srgb: true }).expression : null,
      ...size, frameCount, available: available(),
    };
  }
  function update(text) {
    live();
    const compiled = AdvancedShaderAPI.compileEngineUVRepeatingMaterial(text);
    if (!compiled.ok) {
      const diagnostic = compiled.diagnostics[0];
      const error = new Error(`${diagnostic.code}: ${diagnostic.message} [${diagnostic.start},${diagnostic.end})`);
      Object.assign(error, { code: diagnostic.code, start: diagnostic.start, end: diagnostic.end, diagnostic: { ...diagnostic } });
      throw error;
    }
    const previous = accepted?.resolvedBindings[0].binding.uniforms ?? {};
    const uniforms = Object.fromEntries(compiled.material.uniforms
      .filter(uniform => Object.hasOwn(previous, uniform.name))
      .map(uniform => [uniform.name, previous[uniform.name]]));
    // (Prepared, and lowered for the viewer, before anything is shown: a refusal leaves the accepted material drawn.)
    const prepared = prepare(compiled.material, uniforms);
    present(prepared);
    accepted = prepared;
    return report();
  }
  function setUniform(name, value) {
    live();
    if (!accepted) throw new Error('An accepted material is required');
    const prior = accepted.resolvedBindings[0].binding;
    const prepared = prepare(prior.material, { ...prior.uniforms, [name]: value });
    present(prepared);
    accepted = prepared;
    return report();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; accepted = null;
    viewer.dispose();
  }
  try { update(source); }
  catch (error) { dispose(); throw error; }
  return { update, setUniform, report, dispose };
}
