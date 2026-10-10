import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
const original = new URL('./section-uniform-curve-babylon-data/polynomial.actual-world.source0.css', import.meta.url);
export default defineConfig({ root: fileURLToPath(new URL('../../../', import.meta.url)), server: { port: 5248, strictPort: true },
  optimizeDeps: { noDiscovery: true, include: ["@babylonjs/core/Buffers/buffer.js", "@babylonjs/core/Cameras/camera.js", "@babylonjs/core/Cameras/freeCamera.js", "@babylonjs/core/Engines/engine.js", "@babylonjs/core/Materials/shaderMaterial.js", "@babylonjs/core/Materials/standardMaterial.js", "@babylonjs/core/Maths/math.color.js", "@babylonjs/core/Maths/math.vector.js", "@babylonjs/core/Meshes/Builders/linesBuilder.js", "@babylonjs/core/Meshes/geometry.js", "@babylonjs/core/Meshes/linesMesh.js", "@babylonjs/core/Meshes/meshBuilder.js", "@babylonjs/core/Shaders/color.fragment.js", "@babylonjs/core/Shaders/color.vertex.js", "@babylonjs/core/scene.js"] }, plugins: [{ name: 'original-section-source-bytes', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/packages/barocss-cad-interop/examples/section-uniform-curve-babylon-data/polynomial.actual-world.source0.css') return next();
      const bytes = readFileSync(original); response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Content-Length', bytes.length); response.setHeader('Cache-Control', 'no-store'); response.end(bytes);
    });
  } }] });
