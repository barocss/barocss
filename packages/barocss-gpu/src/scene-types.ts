export type Vec3 = [number, number, number];
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
export interface SceneObject1 extends SceneObject {
  /** Local right-handed degrees; X then Y then Z. */
  rotateDegrees: Vec3;
}
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
export class SceneError extends Error {
  readonly diagnostics: SceneDiagnostic[];
  constructor(diagnostics: SceneDiagnostic[]) {
    super(diagnostics.map((item) => `${item.line}:${item.column}: ${item.message}`).join('\n'));
    this.name = 'SceneError';
    this.diagnostics = diagnostics;
  }
}
