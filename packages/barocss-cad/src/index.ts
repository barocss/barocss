export * from './types.js';
export * from './math.js';
export * from './iges.js';
export * from './packet.js';
export * from './preview.js';
export * from './extrusion.js';
export * from './derivatives.js';
export * from './boundary.js';
export * from './face.js';
export * from './adjacency.js';
export * from './orthogonal-adjacency.js';
export * from './box-shell.js';
export * from './box-solid.js';

export { compileCadModel } from './model-compiler.js';
export type { CadCompileOptions, CadCompileResult, CadDiagnostic, CadModelIR, CadModelAst, CadSourceRange } from './model-compiler.js';
export type { SourceSpan, ExtrusionConstruction } from './construction-types.js';
