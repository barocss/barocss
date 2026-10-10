import * as AdvancedShaderAPI from '@barocss/gpu';

const sourceProfile = '7e96b959746a3fee957644fd1b5ccaf79c992c6c';
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

const vertexSource = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec2 a_uv;
out vec2 v_engine_uv;
void main() {
  v_engine_uv = a_uv;
  gl_Position = vec4(a_position, 1.0);
}`;

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

/** App-owned consumer of public prepared data; this is not a package renderer. */
export function createAdvancedShaderExample(canvas, source) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 is unavailable');
  let accepted = null, disposed = false, contextUnavailable = false, frameCount = 0;

  function available() { return !disposed && !contextUnavailable && !gl.isContextLost(); }
  function live() {
    if (!available()) throw new Error('WebGL2 host is unavailable; recreate the example to recover');
  }
  function release(resources) {
    if (!resources || gl.isContextLost()) return;
    for (const buffer of resources.buffers) gl.deleteBuffer(buffer);
    if (resources.vao) gl.deleteVertexArray(resources.vao);
    if (resources.program) gl.deleteProgram(resources.program);
  }
  function checkedShader(type, text) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL2 shader allocation failed');
    try {
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error('WebGL2 shader compilation failed: ' + (gl.getShaderInfoLog(shader) || '').slice(0, 2048));
      }
      return shader;
    } catch (error) { gl.deleteShader(shader); throw error; }
  }
  function prepare(material, uniforms) {
    return AdvancedShaderAPI.prepareEngineUVRepeatingMaterialBindings(scene, {
      format: 'barocss-gpu-engine-uv-repeating-material-bindings', version: 0,
      sceneId: scene.id,
      bindings: [{ materialId: 'advanced_uv_material', material, uniforms }],
    });
  }
  function createResources(prepared) {
    const lowered = prepared.loweredBindings[0].lowered;
    // Only the public source-reconstructed lowerer's text enters this fixed wrapper.
    const fragmentSource = `#version 300 es
precision highp float;
${lowered.inputDeclarations}
${lowered.uniformDeclarations}
out vec4 outputColor;
void main() {
  vec3 linearColor = ${lowered.expression};
  outputColor = vec4(pow(clamp(linearColor, vec3(0.0), vec3(1.0)), vec3(1.0 / 2.2)), 1.0);
}`;
    const resources = { program: null, vao: null, buffers: [], locations: [], indexCount: 0, indexType: null };
    let vertex = null, fragment = null;
    try {
      live();
      vertex = checkedShader(gl.VERTEX_SHADER, vertexSource);
      fragment = checkedShader(gl.FRAGMENT_SHADER, fragmentSource);
      resources.program = gl.createProgram();
      if (!resources.program) throw new Error('WebGL2 program allocation failed');
      gl.attachShader(resources.program, vertex);
      gl.attachShader(resources.program, fragment);
      gl.linkProgram(resources.program);
      if (!gl.getProgramParameter(resources.program, gl.LINK_STATUS)) {
        throw new Error('WebGL2 program linking failed: ' + (gl.getProgramInfoLog(resources.program) || '').slice(0, 2048));
      }
      resources.vao = gl.createVertexArray();
      if (!resources.vao) throw new Error('WebGL2 vertex array allocation failed');
      gl.bindVertexArray(resources.vao);
      const geometry = prepared.scene.draws[0].geometry;
      function buffer(target, data) {
        const value = gl.createBuffer();
        if (!value) throw new Error('WebGL2 buffer allocation failed');
        resources.buffers.push(value);
        gl.bindBuffer(target, value);
        gl.bufferData(target, data, gl.STATIC_DRAW);
      }
      buffer(gl.ARRAY_BUFFER, geometry.positions);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      buffer(gl.ARRAY_BUFFER, geometry.uvs);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      buffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indices);
      resources.indexCount = geometry.indices.length;
      resources.indexType = geometry.indexType === 'uint16' ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
      resources.locations = lowered.uniformLayout.map(uniform => ({
        name: uniform.name, location: gl.getUniformLocation(resources.program, uniform.glslName),
      }));
      gl.bindVertexArray(null);
      const error = gl.getError();
      if (error !== gl.NO_ERROR) throw new Error('WebGL2 resource preparation refused: ' + error);
      return resources;
    } catch (error) { release(resources); throw error; }
    finally {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
  }
  function present(resources, uniforms) {
    live();
    if (canvas.width <= 0 || canvas.height <= 0) throw new Error('Canvas dimensions must be positive');
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.useProgram(resources.program);
    for (const uniform of resources.locations) gl.uniform1f(uniform.location, uniforms[uniform.name]);
    gl.bindVertexArray(resources.vao);
    gl.drawElements(gl.TRIANGLES, resources.indexCount, resources.indexType, 0);
    gl.bindVertexArray(null);
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error('WebGL2 draw refused: ' + error);
    live();
  }
  function restoreAccepted() {
    if (!accepted || !available()) return;
    try { present(accepted.resources, accepted.prepared.resolvedBindings[0].binding.uniforms); }
    catch { contextUnavailable = true; }
  }
  function report() {
    const binding = accepted?.prepared.resolvedBindings[0].binding;
    const size = binding ? expressionSize(binding.material.expression) : { nodeCount: 0, depth: 0 };
    return {
      backend: 'Example WebGL2 host · public lowered UV material', sourceProfile,
      shaderId: binding?.material.shaderId ?? null,
      uniforms: binding ? { ...binding.uniforms } : {},
      controls: binding ? binding.material.uniforms.map(uniform => ({ ...uniform })) : [],
      loweredExpression: accepted?.prepared.loweredBindings[0].lowered.expression ?? null,
      ...size, frameCount, available: available(),
    };
  }
  function update(text) {
    let resources = null;
    try {
      live();
      const compiled = AdvancedShaderAPI.compileEngineUVRepeatingMaterial(text);
      if (!compiled.ok) {
        const diagnostic = compiled.diagnostics[0];
        const error = new Error(`${diagnostic.code}: ${diagnostic.message} [${diagnostic.start},${diagnostic.end})`);
        Object.assign(error, {
          code: diagnostic.code, start: diagnostic.start, end: diagnostic.end,
          diagnostic: { ...diagnostic },
        });
        throw error;
      }
      const previous = accepted?.prepared.resolvedBindings[0].binding.uniforms ?? {};
      const uniforms = Object.fromEntries(compiled.material.uniforms
        .filter(uniform => Object.hasOwn(previous, uniform.name))
        .map(uniform => [uniform.name, previous[uniform.name]]));
      const prepared = prepare(compiled.material, uniforms);
      resources = createResources(prepared);
      present(resources, prepared.resolvedBindings[0].binding.uniforms);
      const prior = accepted;
      accepted = { prepared, resources };
      resources = null;
      frameCount++;
      release(prior?.resources);
      return report();
    } catch (error) {
      release(resources);
      restoreAccepted();
      throw error;
    }
  }
  function setUniform(name, value) {
    try {
      live();
      if (!accepted) throw new Error('An accepted material is required');
      const prior = accepted.prepared.resolvedBindings[0].binding;
      const prepared = prepare(prior.material, { ...prior.uniforms, [name]: value });
      present(accepted.resources, prepared.resolvedBindings[0].binding.uniforms);
      accepted = { prepared, resources: accepted.resources };
      frameCount++;
      return report();
    } catch (error) { restoreAccepted(); throw error; }
  }
  function lost(event) { event.preventDefault(); contextUnavailable = true; }
  function restored() { contextUnavailable = true; }
  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    release(accepted?.resources);
    accepted = null;
  }
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  try { update(source); }
  catch (error) { dispose(); throw error; }
  return { update, setUniform, report, dispose };
}
