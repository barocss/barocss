// R7: gpu's object facade — an immutable scene, shown in a Viewer — imported as `@barocss/gpu/api`.
// See apps/cad-studio/handover/notes/api-facade-design.md.
export { scene, show, Scene, VIEWS, LINE_MATERIAL, type SceneData, type SceneMesh, type SceneCamera, type FacadeMesh, type ViewName } from './scene.js';
export { BarocssError, type RefusalWhere, type SceneCode } from './refusal.js';
