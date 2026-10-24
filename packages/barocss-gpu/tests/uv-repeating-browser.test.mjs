// G18.2: the library docs' repeating UV shader demos lowered to WGSL — each the same on WebGPU as on its GLSL path.
//   1. The lowering: each demo's material (its defaults, and its uniforms at their maxima) drawn on a unit quad by the
//      GLSL lowering (lowerEngineUVRepeatingMaterial, the docs' old WebGL2 host's program: gamma-2.2 colours, 1/2.2 out)
//      and by the WGSL lowering (lowerEngineUVRepeatingMaterialWGSL, the same colour model) in a raw WebGPU pass —
//      every pixel within 2/255 a channel.
//   2. The demo on the viewer (uvRepeatingShader, the viewer's exact sRGB decode and encode, G5): against the GLSL
//      host — what differs is the colour model alone; measured and bounded.
//   3. Coefficients not representable as f32 are refused (RANGE), by the lowering and by materialShader.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --import ./tests/cad-dist.mjs --test tests/uv-repeating-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gpuDist = path.resolve(here, '../dist'), cadDist = path.resolve(here, '../../barocss-cad/dist');
const snippets = path.resolve(here, 'fixtures/shader-demos');
const DEMOS = ['advanced-shader', 'caustics-shader', 'weave-shader', 'contour-shader', 'halftone-shader', 'reusable-shader'];
const page = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"@barocss/cad":"/cad/index.js"}}</script><style>body{margin:0}canvas{display:block;width:96px;height:96px}</style><canvas id="gl" width="96" height="96"></canvas><canvas id="gpu" width="96" height="96"></canvas><canvas id="view" width="96" height="96"></canvas>`;

test('G18.2 repeating UV demos: WGSL as the GLSL path draws them, the viewer within its colour model, f32 refusals', { timeout: 240000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const demos = await Promise.all(DEMOS.map(async name => { const p = JSON.parse(await readFile(path.join(snippets, `${name}.json`), 'utf8')); return { name, source: p.source }; }));
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    if (/^\/gpu\/[\w./-]+\.js$/.test(req.url) && !req.url.includes('..')) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(path.join(gpuDist, req.url.slice(5)))); return; }
    if (/^\/cad\/[\w./-]+\.js$/.test(req.url) && !req.url.includes('..')) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(path.join(cadDist, req.url.slice(5)))); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  const errors = [];
  try {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(`http://127.0.0.1:${server.address().port}/`);
    if (!await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))) { t.skip('no WebGPU adapter'); return; }
    const r = await p.evaluate(async demos => {
      const gpu = await import('/gpu/index.js'), N = 96;
      // The GLSL path: the docs host's program on WebGL2, read top row first.
      const gl = document.getElementById('gl').getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
      const compile = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const glsl = (lowered, uniforms) => {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, '#version 300 es\nprecision highp float;\nlayout(location=0) in vec2 a_position;\nout vec2 v_engine_uv;\nvoid main(){ v_engine_uv=a_position*0.5+0.5; gl_Position=vec4(a_position,0.0,1.0); }'));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, `#version 300 es\nprecision highp float;\n${lowered.inputDeclarations}\n${lowered.uniformDeclarations}\nout vec4 outputColor;\nvoid main(){ vec3 linearColor=${lowered.expression}; outputColor=vec4(pow(clamp(linearColor,vec3(0.0),vec3(1.0)),vec3(1.0/2.2)),1.0); }`));
        gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        for (const u of lowered.uniformLayout) gl.uniform1f(gl.getUniformLocation(prog, u.glslName), uniforms[u.name] ?? u.default);
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, N, N); gl.drawArrays(gl.TRIANGLES, 0, 6);
        const px = new Uint8Array(N * N * 4), out = new Uint8Array(N * N * 4); gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let y = 0; y < N; y++) out.set(px.subarray((N - 1 - y) * N * 4, (N - y) * N * 4), y * N * 4);
        return out;
      };
      // The WGSL lowering in a raw WebGPU pass with the GLSL path's colour model (1/2.2 out), read top row first.
      const adapter = await navigator.gpu.requestAdapter(), device = await adapter.requestDevice();
      const wgsl = async (lowered, uniforms) => {
        const helpers = 'fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {\n  let t = clamp(ratio, 0.0, 1.0);\n  return a * (1.0 - t) + b * t;\n}\n';
        const code = `${lowered.declarations}${helpers}@group(0) @binding(0) var<uniform> materialParams: MaterialParams;
struct V { @builtin(position) p: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs(@builtin(vertex_index) i: u32) -> V { var q = array<vec2<f32>, 6>(vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(1.0,1.0), vec2(-1.0,-1.0), vec2(1.0,1.0), vec2(-1.0,1.0)); var o: V; o.p = vec4(q[i], 0.0, 1.0); o.uv = q[i] * 0.5 + 0.5; return o; }
@fragment fn fs(v: V) -> @location(0) vec4<f32> { let engine_uv = v.uv; let c = ${lowered.expression}; return vec4(pow(clamp(c, vec3(0.0), vec3(1.0)), vec3(1.0 / 2.2)), 1.0); }`;
        const module = device.createShaderModule({ code }), info = await module.getCompilationInfo();
        const bad = info.messages.filter(m => m.type === 'error'); if (bad.length) throw new Error(bad.map(m => m.message).join('; '));
        const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module, entryPoint: 'vs' }, fragment: { module, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] } });
        const params = new Float32Array(16); for (const u of lowered.uniformLayout) params[u.index] = uniforms[u.name] ?? u.default;
        const ubo = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(ubo, 0, params);
        const tex = device.createTexture({ size: [N, N], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
        const read = device.createBuffer({ size: 512 * N, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const enc = device.createCommandEncoder(), pass = enc.beginRenderPass({ colorAttachments: [{ view: tex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
        pass.setPipeline(pipeline); pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubo } }] })); pass.draw(6); pass.end();
        enc.copyTextureToBuffer({ texture: tex }, { buffer: read, bytesPerRow: 512 }, [N, N]); device.queue.submit([enc.finish()]);
        await read.mapAsync(GPUMapMode.READ); const raw = new Uint8Array(read.getMappedRange()), out = new Uint8Array(N * N * 4);
        for (let y = 0; y < N; y++) out.set(raw.subarray(y * 512, y * 512 + N * 4), y * N * 4);
        read.unmap(); return out;
      };
      // The demo on the viewer: an unlit unit quad filling the view (orthographic, its half height 1), its shader material.
      const viewer = await gpu.createViewer(document.getElementById('view'), { pixelRatio: 1, controls: false, antialias: false, background: '#000000' });
      Object.assign(viewer.camera, { projection: 'orthographic', position: [0, 0, 3], target: [0, 0, 0], up: [0, 1, 0], fovY: 2 * Math.atan(1 / 3) * 180 / Math.PI });
      const quad = viewer.add({ positions: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) }, { material: { color: '#ffffff', unlit: true }, castShadow: false });
      const viewed = async (material, uniforms) => {
        quad.material = { color: '#ffffff', unlit: true, shader: gpu.uvRepeatingShader(material, uniforms) };
        viewer.environment = { ...viewer.environment, ambientOcclusion: false };
        const img = await viewer.capture(); return { data: img.data, width: img.width };
      };
      // A pixel on a jump: the material (binary64, the CPU evaluator) changes by more than 24/255 within 2e-5 of its uv —
      // where a fract wraps, the f32 GPUs may each land on either side.
      const encode = c => c.map(x => Math.pow(Math.min(1, Math.max(0, x)), 1 / 2.2) * 255);
      const onJump = (material, uniforms, i) => {
        const x = (i % N) + 0.5, y = Math.floor(i / N) + 0.5, uv = [x / N, 1 - y / N];
        const at = q => encode(gpu.evaluateAuthoredMaterial({ material, uniforms, uv: q }).linearRGB), c0 = at(uv);
        return [[2e-5, 0], [-2e-5, 0], [0, 2e-5], [0, -2e-5]].some(([du, dv]) => { const c = at([uv[0] + du, uv[1] + dv]); return c.some((v, k) => Math.abs(v - c0[k]) > 24); });
      };
      const split = (a, b, material, uniforms) => {
        let smooth = 0, jumps = 0, onJumps = 0;
        for (let i = 0; i < N * N; i++) {
          let d = 0; for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(a[4 * i + k] - b[4 * i + k]));
          if (d <= 2) { smooth = Math.max(smooth, d); continue; }
          if (onJump(material, uniforms, i)) onJumps++; else { jumps++; smooth = Math.max(smooth, d); }
        }
        return { smoothMax: smooth, onJumps, offJumps: jumps };
      };
      const cmp = (a, b) => { let max = 0, sum = 0, over = 0; for (let i = 0; i < a.length; i++) { if ((i & 3) === 3) continue; const d = Math.abs(a[i] - b[i]); max = Math.max(max, d); sum += d; if (d > 2) over++; } return { max, mean: sum / (a.length * 0.75), over }; };
      const rows = [];
      for (const demo of demos) {
        const c = gpu.compileEngineUVRepeatingMaterial(demo.source); if (!c.ok) throw new Error(demo.name + ': ' + JSON.stringify(c.diagnostics));
        for (const at of ['defaults', 'maxima']) {
          const uniforms = Object.fromEntries(c.material.uniforms.map(u => [u.name, at === 'defaults' ? u.default : u.max]));
          const g = glsl(gpu.lowerEngineUVRepeatingMaterial(c.material), uniforms), w = await wgsl(gpu.lowerEngineUVRepeatingMaterialWGSL(c.material), uniforms);
          const v = await viewed(c.material, uniforms), vv = new Uint8Array(N * N * 4);
          for (let y = 0; y < N; y++) vv.set(v.data.subarray(y * v.width * 4, y * v.width * 4 + N * 4), y * N * 4);
          // (The bound on the colour model's difference: the 2.2 power against the sRGB curve, round trip, at mid tones — the
          // largest gap between x^(1/2.2) and the sRGB encode of the same linear value over [0, 1] is 8.55/255, at x = 0.0022.)
          rows.push({ demo: demo.name, at, lowering: { ...cmp(g, w), ...split(g, w, c.material, uniforms) }, viewer: cmp(g, vv), spread: g.reduce((m, x, i) => (i & 3) === 3 ? m : Math.max(m, x), 0) - g.reduce((m, x, i) => (i & 3) === 3 ? m : Math.min(m, x), 255) });
        }
      }
      // f32: a literal flushed to zero and one past f32's range, refused (RANGE) where the source compiles — before any
      // lowering — and so by materialShader too (the lowering's own check is what an IR's source cannot get past).
      const refusals = [];
      for (const k of ['0.' + '0'.repeat(45) + '1', '1' + '0'.repeat(39)]) {
        const src = `@shader #tiny { @uniform s: float(0,1,.5); @fragment { color: mix(#000000,#ffffff,clamp(uv_u*${k},0,1)*s); } }`;
        const c = gpu.compileEngineUVRepeatingMaterial(src), shader = gpu.materialShader(src);
        refusals.push({ digits: k.length, compiled: c.ok ? 'accepted' : c.diagnostics[0].code, message: c.ok ? '' : c.diagnostics[0].message, shader: shader.ok ? 'accepted' : shader.diagnostics[0].code });
      }
      viewer.dispose();
      return { rows, refusals };
    }, demos);
    console.log(JSON.stringify(r));
    for (const row of r.rows) {
      assert.ok(row.spread > 40, `${row.demo} (${row.at}) draws a pattern, not a flat colour: ${JSON.stringify(row)}`);
      assert.ok(row.lowering.smoothMax <= 2 && row.lowering.offJumps === 0, `${row.demo} (${row.at}): the WGSL lowering as the GLSL path, within 2/255 off the jumps: ${JSON.stringify(row.lowering)}`);
      assert.ok(row.viewer.max <= 9 || row.lowering.onJumps > 0, `${row.demo} (${row.at}): on the viewer within the colour model's difference: ${JSON.stringify(row.viewer)}`);
    }
    for (const x of r.refusals) assert.deepEqual([x.compiled, x.shader], ['RANGE', 'RANGE'], `refused as f32: ${JSON.stringify(x)}`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
});
