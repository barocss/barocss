import { evaluateSurfaceCurvature, evaluateSurfaceD2 } from '@barocss/cad';
import { BaroCADBabylonLoader } from '@barocss/cad-interop/babylon';
import { Scene } from '@babylonjs/core/scene.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { assertSame } from './native-surface-curvature-babylon-fixture.mjs';
import { observeMesh } from './native-surface-curvature-babylon-observer.mjs';

export const options = Object.freeze({ sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 });
export const ANNOTATION_DIMENSIONS = Object.freeze({ pointRadius: 0.00008, normalLength: 0.0008 });

export function createInspection(scene) {
  if (!(scene instanceof Scene) || scene.isDisposed || scene.useRightHandedSystem !== true) throw new TypeError('A live caller right-handed Babylon Scene is required');
  const resources = [], previews = [], releasedAnnotations = new WeakSet();
  let accepted = null, annotations = null, readout = null, disposed = false, busy = false, revision = 0;
  function track(kind, mesh) { const row = observeMesh(kind, mesh); resources.push(row); return row; }
  function releaseAnnotations(value) {
    if (!value || releasedAnnotations.has(value)) return;
    releasedAnnotations.add(value);
    value.point.dispose(false, false);
    // Standard sphere material is separately owned; LinesMesh owns its automatic material.
    value.pointMaterial.dispose();
    value.line.dispose(false, false);
  }
  function evaluate(surface, u, v) {
    const curvature = evaluateSurfaceCurvature(surface, u, v), d2 = evaluateSurfaceD2(surface, u, v);
    assertSame(curvature.derivatives, d2, 'Original native D2');
    return { u, v, curvature, d2 };
  }
  function createAnnotations(value) {
    const start = value.curvature.derivatives.point.map(coordinate => coordinate * options.unitsPerMillimeter);
    const end = start.map((coordinate, axis) => coordinate + value.curvature.unitNormal[axis] * ANNOTATION_DIMENSIONS.normalLength);
    let point, pointMaterial, line;
    try {
      point = MeshBuilder.CreateSphere('inspection_native_point', { diameter: ANNOTATION_DIMENSIONS.pointRadius * 2, segments: 12 }, scene);
      point.setEnabled(false);
      pointMaterial = new StandardMaterial('inspection_native_point_material', scene);
      pointMaterial.diffuseColor = Color3.Black(); pointMaterial.specularColor = Color3.Black(); pointMaterial.emissiveColor = new Color3(1, 0, 1);
      point.material = pointMaterial; point.position.set(...start);
      point.renderingGroupId = 1; pointMaterial.depthFunction = Constants.ALWAYS; pointMaterial.disableDepthWrite = true;
      track('point', point);
      line = MeshBuilder.CreateLines('inspection_native_normal', { points: [new Vector3(...start), new Vector3(...end)] }, scene);
      line.setEnabled(false); line.color = new Color3(1, 1, 0);
      line.renderingGroupId = 1; line.material.depthFunction = Constants.ALWAYS; line.material.disableDepthWrite = true;
      track('normal', line);
      return { point, line, pointMaterial, start, end };
    } catch (error) {
      point?.dispose(false, false); pointMaterial?.dispose(); line?.dispose(false, false);
      throw error;
    }
  }
  function enable(value) { value.point.setEnabled(true); value.line.setEnabled(true); }
  function assertAvailable() {
    if (disposed || busy || scene.isDisposed) throw new Error('Surface inspection is unavailable');
  }
  return {
    admit(source, u = -3, v = 2) {
      assertAvailable(); busy = true;
      let result, candidate;
      let committed = false;
      try {
        result = new BaroCADBabylonLoader(scene, options).parse(source);
        // Real Babylon meshes already belong to this Scene. Disable immediately on this stack.
        for (const mesh of result.meshes) mesh.setEnabled(false);
        if (result.model.objects.length !== 1 || result.model.objects[0].kind !== 'surface' || result.meshes.length !== 1 || result.surfaces.length !== 1 || result.curves.length !== 0) throw new Error('One original Surface and its actual preview are required');
        track('preview', result.meshes[0]);
        const surface = result.model.objects[0], value = evaluate(surface, u, v);
        candidate = createAnnotations(value);
        for (const mesh of result.meshes) mesh.setEnabled(true);
        enable(candidate);
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
      if (surface !== accepted.surface) throw new TypeError('Query Surface must be the accepted original object reference');
      busy = true;
      let candidate, committed = false;
      try {
        const value = evaluate(surface, u, v);
        candidate = createAnnotations(value); enable(candidate);
        const previous = annotations;
        annotations = candidate; readout = value; revision++; committed = true;
        releaseAnnotations(previous);
        return value;
      } catch (error) { if (!committed) releaseAnnotations(candidate); throw error; }
      finally { busy = false; }
    },
    get result() { return accepted?.result ?? null; },
    get originalSurface() { return accepted?.surface ?? null; },
    get identity() { return accepted ? { modelId: accepted.result.model.name, surfaceId: accepted.surface.id } : null; },
    get readout() { return readout; }, get annotations() { return annotations; }, get resources() { return resources; },
    snapshot() {
      return { disposed, revision, identity: accepted ? { modelId: accepted.result.model.name, surfaceId: accepted.surface.id } : null,
        source: accepted?.result.source ?? null, model: accepted ? structuredClone(accepted.result.model) : null,
        readout: readout ? structuredClone(readout) : null,
        annotations: annotations ? { start: [...annotations.start], end: [...annotations.end], ...ANNOTATION_DIMENSIONS } : null,
        resources: resources.map(row => ({ kind: row.kind, geometryResourceId: row.geometryResourceId, geometryUniqueId: row.geometryUniqueId,
          observedPositions: [...row.observedPositions], observedIndices: [...row.observedIndices], observedNormals: [...row.observedNormals],
          nativeParameters: row.nativeParameters ? [...row.nativeParameters] : null,
          livePositions: row.geometryDisposals ? null : Array.from(row.mesh.getVerticesData('position')),
          meshDisposals: row.meshDisposals, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
        })) };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseAnnotations(annotations);
      for (const result of previews) { result.dispose(); result.dispose(); }
      // Independent source, original Model/Surface, readout and cached CPU buffers stay readable.
    },
  };
}
