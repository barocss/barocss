import { BarocssError } from '../core/barocss-error.js';
import type { Vec3 } from '../core/geometry-types.js';
export type { Vec3 };
export type RGB = [number, number, number];
export interface SceneObject {
  id: string;
  type: 'sphere' | 'box';
  color: RGB;
  translate: Vec3;
  radius: number;
  /** Full box extents, not half extents. */
  size: Vec3;
}
export interface RotatedSceneObject extends SceneObject {
  /** Local right-handed degrees; X then Y then Z. */
  rotation: Vec3;
}
export interface CylinderSceneObject extends Omit<RotatedSceneObject, 'type'> {
  type: 'cylinder';
  /** Full local Y height. */
  height: number;
}
export interface CapsuleSceneObject extends Omit<RotatedSceneObject, 'type'> {
  type: 'capsule';
  /** Center segment endpoints in local scene units. */
  start: Vec3;
  end: Vec3;
}
export interface RoundedBoxSceneObject extends Omit<RotatedSceneObject, 'type'> {
  type: 'rounded-box';
}
export interface TorusSceneObject extends Omit<RotatedSceneObject, 'type'> {
  type: 'torus';
  /** Local XZ centreline circle radius, axis local Y; scene units. */
  majorRadius: number;
  /** Tube radius; strictly smaller than majorRadius. */
  minorRadius: number;
}
export type SceneObject1 = RotatedSceneObject | CylinderSceneObject | CapsuleSceneObject | RoundedBoxSceneObject | TorusSceneObject;
export interface Scene1 {
  version: 1;
  name: string;
  background: RGB;
  objects: SceneObject1[];
}
export type AnyScene = Scene | Scene1;
export interface SceneSourceOptions { sourceVersion: 1 }
export interface Scene {
  version: 0;
  name: string;
  background: RGB;
  objects: SceneObject[];
}
export interface SceneDiagnostic {
  message: string;
  line: number;
  column: number;
  start: number;
  end: number;
}
export class SceneError extends BarocssError {
  declare readonly code: 'SCENE';
  readonly diagnostics: SceneDiagnostic[];
  constructor(diagnostics: SceneDiagnostic[]) {
    super('SCENE', diagnostics.map((item) => `${item.line}:${item.column}: ${item.message}`).join('\n'));
    this.name = 'SceneError';
    this.diagnostics = diagnostics;
  }
}
