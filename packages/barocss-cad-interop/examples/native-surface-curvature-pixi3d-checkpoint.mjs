import { BaroCADPixi3DLoader } from '@barocss/cad-interop/pixi3d';
import { Container, DRAW_MODES } from 'pixi.js';
import { Color, Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';
import { inspectSurface } from './native-surface-curvature-pixi3d-fixture.mjs';
import { observeMesh, observeRoot } from './native-surface-curvature-pixi3d-observer.mjs';

export const options = Object.freeze({ sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 });
export const ANNOTATION_DIMENSIONS = Object.freeze({ pointRadius: 0.00008, normalLength: 0.0008 });
export const ANNOTATION_SPHERE_OPTIONS = Object.freeze({ radius: 0.00008, segments: 12, rings: 8 });

export function createInspection(stage) {
  if (!(stage instanceof Container) || stage.destroyed) throw new TypeError('A live caller Pixi Container Stage is required');
  const resources = [], roots = [], previews = [], releasedAnnotations = new WeakSet();
  let accepted = null, annotations = null, readout = null, disposed = false, busy = false, revision = 0;
  function trackMesh(kind, mesh) { const row = observeMesh(kind, mesh); resources.push(row); return row; }
  function trackRoot(kind, root) { const row = observeRoot(kind, root); roots.push(row); return row; }
  function releaseMesh(mesh) {
    mesh.parent?.removeChild(mesh);
    mesh.destroy({ children: false, geometry: true, material: true });
  }
  function releaseAnnotations(value) {
    if (!value || releasedAnnotations.has(value)) return;
    releasedAnnotations.add(value);
    value.root.parent?.removeChild(value.root);
    releaseMesh(value.point); releaseMesh(value.line);
    value.root.destroy({ children: false });
  }
  function overlayMaterial(color) {
    const material = new StandardMaterial();
    material.unlit = true; material.doubleSided = true; material.baseColor = color;
    material.state.depthTest = false; material.depthMask = false;
    return material;
  }
  function createAnnotations(value) {
    const start = value.curvature.derivatives.point.map(coordinate => coordinate * options.unitsPerMillimeter);
    const end = start.map((coordinate, axis) => coordinate + value.curvature.unitNormal[axis] * ANNOTATION_DIMENSIONS.normalLength);
    const root = new Container3D(); trackRoot('annotation', root);
    let point, pointMaterial, line, lineMaterial, lineGeometry;
    try {
      pointMaterial = overlayMaterial(new Color(1, 0, 1));
      point = Mesh3D.createSphere(pointMaterial, ANNOTATION_SPHERE_OPTIONS);
      point.position.set(...start); trackMesh('point', point); root.addChild(point);
      lineGeometry = new MeshGeometry3D();
      const positions = Float32Array.from([...start, ...end]);
      lineGeometry.positions = { buffer: positions, componentType: 5126, componentCount: 3, normalized: false,
        min: [0,1,2].map(axis => Math.min(positions[axis], positions[axis + 3])), max: [0,1,2].map(axis => Math.max(positions[axis], positions[axis + 3])) };
      lineGeometry.indices = { buffer: Uint16Array.from([0, 1]), componentType: 5123, componentCount: 1, normalized: false };
      // Derived unlit shader input, separate from the original native unit normal.
      lineGeometry.normals = { buffer: Float32Array.from([0,0,1,0,0,1]), componentType: 5126, componentCount: 3, normalized: false };
      lineMaterial = overlayMaterial(new Color(1, 1, 0)); lineMaterial.drawMode = DRAW_MODES.LINE_STRIP;
      line = new Mesh3D(lineGeometry, lineMaterial); trackMesh('normal', line); root.addChild(line);
      return { root, point, line, start, end, sphereOptions: ANNOTATION_SPHERE_OPTIONS };
    } catch (error) {
      if (point) releaseMesh(point); else pointMaterial?.destroy();
      if (line) releaseMesh(line); else { lineGeometry?.destroy(); lineMaterial?.destroy(); }
      root.destroy({ children: false });
      throw error;
    }
  }
  function assertAvailable() {
    if (disposed || busy || stage.destroyed) throw new Error('Surface inspection is unavailable');
  }
  return {
    admit(source, u = -3, v = 2) {
      assertAvailable(); busy = true;
      let result, candidate, committed = false;
      try {
        result = new BaroCADPixi3DLoader(options).parse(source);
        if (result.root.parent !== null || result.model.objects.length !== 1 || result.model.objects[0].kind !== 'surface' || result.renderedSurfaces.length !== 1 || result.surfaces.length !== 1 || result.curves.length !== 0) throw new Error('One detached original Surface preview is required');
        trackRoot('preview', result.root); trackMesh('preview', result.renderedSurfaces[0].mesh);
        const surface = result.model.objects[0], value = inspectSurface(surface, u, v);
        candidate = createAnnotations(value);
        // Both roots stay detached until the complete native query and annotation pair succeed.
        stage.addChild(result.root, candidate.root);
        const previous = accepted, previousAnnotations = annotations;
        accepted = { result, surface }; annotations = candidate; readout = value; previews.push(result); revision++; committed = true;
        releaseAnnotations(previousAnnotations); previous?.result.dispose();
        return value;
      } catch (error) {
        if (!committed) { releaseAnnotations(candidate); result?.dispose(); }
        throw error;
      } finally { busy = false; }
    },
    query(u, v, surface = accepted?.surface) {
      assertAvailable();
      if (!accepted) throw new Error('Admit an original Surface before querying');
      busy = true;
      let candidate, committed = false;
      try {
        const value = inspectSurface(surface, u, v, accepted.surface);
        candidate = createAnnotations(value); stage.addChild(candidate.root);
        const previous = annotations;
        annotations = candidate; readout = value; revision++; committed = true;
        releaseAnnotations(previous);
        return value;
      } catch (error) { if (!committed) releaseAnnotations(candidate); throw error; }
      finally { busy = false; }
    },
    get result() { return accepted?.result ?? null; }, get originalSurface() { return accepted?.surface ?? null; },
    get identity() { return accepted ? { modelId: accepted.result.model.name, surfaceId: accepted.surface.id } : null; },
    get annotations() { return annotations; }, get readout() { return readout; }, get resources() { return resources; }, get roots() { return roots; },
    snapshot() {
      return { disposed, revision, identity: accepted ? { modelId: accepted.result.model.name, surfaceId: accepted.surface.id } : null,
        source: accepted?.result.source ?? null, model: accepted ? structuredClone(accepted.result.model) : null,
        readout: readout ? structuredClone(readout) : null,
        annotations: annotations ? { start: [...annotations.start], end: [...annotations.end], sphereOptions: { ...annotations.sphereOptions }, ...ANNOTATION_DIMENSIONS } : null,
        roots: roots.map(row => ({ kind: row.kind, rootDestroyCalls: row.rootDestroyCalls, destroyed: row.root.destroyed })),
        resources: resources.map(row => ({ kind: row.kind, observedPositions: [...row.observedPositions], observedIndices: [...row.observedIndices], observedNormals: [...row.observedNormals],
          currentCPUPositions: row.geometry.positions ? Array.from(row.geometry.positions.buffer) : null,
          meshDestroyCalls: row.meshDestroyCalls, geometryDestroyCalls: row.geometryDestroyCalls, materialDestroyCalls: row.materialDestroyCalls,
        })) };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseAnnotations(annotations);
      for (const result of previews) { result.dispose(); result.dispose(); }
      // Native/source/model/readout and independent CPU caches remain readable.
    },
  };
}
