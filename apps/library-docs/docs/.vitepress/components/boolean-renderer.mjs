// A small display-only WebGL viewer. Kernel-generated triangles provide the geometry; no Boolean runs in the browser.
export function createBooleanRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  const shaders = [shader(gl.VERTEX_SHADER, `
    attribute vec3 position; attribute vec3 normal;
    uniform vec3 centre; uniform float radius; uniform vec2 angles; uniform float aspect;
    uniform vec3 offset; varying vec3 n;
    vec3 turn(vec3 v) {
      float a=cos(angles.x), b=sin(angles.x), c=cos(angles.y), d=sin(angles.y);
      vec3 q=vec3(a*v.x-b*v.y,b*v.x+a*v.y,v.z);
      return vec3(q.x,c*q.y-d*q.z,d*q.y+c*q.z);
    }
    void main() {
      vec3 p=turn((position+offset-centre)/radius);
      float scale=0.94*min(aspect,1.0);
      gl_Position=vec4(p.x*scale/aspect,p.y*scale,-p.z*0.45,1.0);
      gl_PointSize=5.0; n=turn(normal);
    }`), shader(gl.FRAGMENT_SHADER, `
    precision mediump float; uniform vec4 colour; uniform float lines; varying vec3 n;
    void main() {
      float light=lines>0.5?1.0:0.45+0.55*abs(dot(normalize(n),normalize(vec3(-0.4,0.6,1.0))));
      gl_FragColor=vec4(colour.rgb*light,colour.a);
    }`)];
  shaders.forEach(s => gl.attachShader(program, s)); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const loc = Object.fromEntries(['centre', 'radius', 'angles', 'aspect', 'offset', 'colour', 'lines'].map(k => [k, gl.getUniformLocation(program, k)]));
  const pos = gl.getAttribLocation(program, 'position'), normal = gl.getAttribLocation(program, 'normal');
  const buffers = new Map();
  const upload = mesh => {
    if (buffers.has(mesh)) return buffers.get(mesh);
    const P = [], N = [], L = [];
    for (const i of mesh.indices) { P.push(...mesh.positions.slice(3 * i, 3 * i + 3)); N.push(...mesh.normals.slice(3 * i, 3 * i + 3)); }
    for (const line of mesh.lines) for (let i = 3; i < line.length; i += 3) L.push(...line.slice(i - 3, i + 3));
    const buffer = data => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); return b; };
    const value = { p: buffer(P), n: buffer(N), l: buffer(L), count: mesh.indices.length, lineCount: L.length / 3 };
    buffers.set(mesh, value); return value;
  };
  const bind = (b, attr) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 3, gl.FLOAT, false, 0, 0); };
  const colour = value => gl.uniform4fv(loc.colour, value);
  const offset = value => gl.uniform3fv(loc.offset, value);
  const blue = [0.22, 0.54, 0.91, 1], amber = [0.95, 0.61, 0.16, 1], green = [0.14, 0.72, 0.49, 1];
  let latest;
  function draw(scene, stage, operation, yaw = -0.65, pitch = -1.05) {
    latest = [scene, stage, operation, yaw, pitch];
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2), box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(box.width * ratio)); canvas.height = Math.max(1, Math.round(box.height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.055, 0.08, 0.13, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const points = scene.inputs.flatMap(m => m.positions), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < points.length; i++) { const k = i % 3; min[k] = Math.min(min[k], points[i]); max[k] = Math.max(max[k], points[i]); }
    gl.uniform3fv(loc.centre, min.map((v, i) => (v + max[i]) / 2));
    const radius = Math.hypot(...min.map((v, i) => max[i] - v)) / 2;
    gl.uniform1f(loc.radius, radius * (stage === 2 ? 1.22 : 1)); gl.uniform2f(loc.angles, yaw, pitch); gl.uniform1f(loc.aspect, canvas.width / canvas.height);
    const solid = (mesh, tint, explode = false) => {
      const data = upload(mesh); bind(data.p, pos); bind(data.n, normal); colour(tint); gl.uniform1f(loc.lines, 0);
      if (explode) for (const patch of mesh.patches) { offset(patch.normal.map(v => v * radius * 0.16)); gl.drawArrays(gl.TRIANGLES, patch.start, patch.count); }
      else { offset([0, 0, 0]); gl.drawArrays(gl.TRIANGLES, 0, data.count); }
    };
    const wire = (mesh, tint) => {
      const data = upload(mesh); bind(data.l, pos); gl.disableVertexAttribArray(normal); gl.vertexAttrib3f(normal, 0, 0, 1); offset([0, 0, 0]); colour(tint); gl.uniform1f(loc.lines, 1); gl.drawArrays(gl.LINES, 0, data.lineCount);
    };
    if (stage <= 1) {
      gl.depthMask(false); solid(scene.inputs[0], [...blue.slice(0, 3), 0.55]); solid(scene.inputs[1], [...amber.slice(0, 3), 0.22]);
      wire(scene.inputs[0], blue); wire(scene.inputs[1], amber); gl.depthMask(true);
    } else if (stage === 2) {
      solid(scene.results.union.mesh, blue, true); solid(scene.results.intersect.mesh, amber, true);
    } else {
      solid(scene.results[operation].mesh, green);
      if (stage === 3) { gl.disable(gl.DEPTH_TEST); wire(scene.results.union.mesh, [0.65, 0.7, 0.8, 0.19]); wire(scene.results.intersect.mesh, [0.65, 0.7, 0.8, 0.19]); }
      else wire(scene.results[operation].mesh, [0.04, 0.19, 0.17, 0.6]);
    }
    if (stage === 1) {
      gl.disable(gl.DEPTH_TEST);
      for (const line of scene.cuts) {
        const key = line;
        if (!buffers.has(key)) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW); buffers.set(key, { p: b }); }
        bind(buffers.get(key).p, pos); gl.disableVertexAttribArray(normal); gl.vertexAttrib3f(normal, 0, 0, 1); offset([0, 0, 0]); colour([1, 0.3, 0.35, 1]); gl.uniform1f(loc.lines, 1); gl.drawArrays(gl.LINE_STRIP, 0, line.length / 3);
        // Endpoints are samples on curves; they are not a claim about topological vertex counts.
        gl.drawArrays(gl.POINTS, 0, 1); gl.drawArrays(gl.POINTS, line.length / 3 - 1, 1);
      }
    }
  }
  return { draw, redraw: () => latest && draw(...latest), dispose() {
    for (const data of buffers.values()) for (const value of Object.values(data)) if (typeof value !== 'number') gl.deleteBuffer(value);
    shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program);
  } };
}
