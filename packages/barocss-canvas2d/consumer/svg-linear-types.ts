// Script-scoped declarations preserve the unchanged fixture and strict-check the actual host.
declare module '*/examples/canvas2d-scene/current-v29-svg-fixture.mjs' {
  type Factory = Pick<typeof import('@barocss/canvas2d'), 'createDisplayTree'>;
  type Tree = import('@barocss/canvas2d').DisplayTree;
  type Scene = import('@barocss/canvas2d').Scene;
  export const LOGICAL_SIZE: Readonly<import('@barocss/canvas2d').Size>;
  export function createCurrentSVGFixture(api?: Factory): {
    tree: Tree; ids: Record<string,string>; logicalSize: typeof LOGICAL_SIZE;
    samples: {name:string;point:import('@barocss/canvas2d').Point;expectedHitId:string|null}[];
  };
  export function applyCurrentSVGEdit(tree: Tree): Scene;
  export function createTreeFromImportedSVG(input: unknown, api?: Factory): Tree;
  export function compareCurrentSVGSemantics(original: unknown, imported: unknown): {
    matched: true; contextId:string; groupIds:string[]; pathIds:string[];
    normalizedPaths:Record<string,unknown>[]; ignoredImportedIdentityViewportWrappers:string[];
    numberTolerance:string;hitScope:string;
  };
}
declare const svgLinearSource: typeof import('../src/index.js');
declare const svgLinearEmitted: typeof import('../dist/index.js');
function svgLinearPublicTypes(input:unknown,size:import('../src/index.js').Size) {
  const original:import('../src/index.js').SVGExportResult=svgLinearSource.exportSceneLinearSVG(input,size);
  const compiled:import('../dist/index.js').SVGExportResult=svgLinearEmitted.exportSceneLinearSVG(input,size);
  if(original.ok){const svg:string=original.svg;const map:{sourceId:string;svgId:string}[]=original.sourceIdMap;void svg;void map;}
  if(!compiled.ok){const diagnostics:import('../dist/index.js').SVGExportDiagnostic[]=compiled.diagnostics;void diagnostics;
    // @ts-expect-error Refusal has no partial SVG.
    compiled.svg;
  }
  // @ts-expect-error Logical size is required.
  svgLinearSource.exportSceneLinearSVG(input);
  // @ts-expect-error Size dimensions must be numbers.
  svgLinearEmitted.exportSceneLinearSVG(input,{width:'320',height:220});
  // @ts-expect-error Serialization is synchronous.
  const promise:Promise<import('../src/index.js').SVGExportResult>=svgLinearSource.exportSceneLinearSVG(input,size);
  return {original,compiled,promise};
}
