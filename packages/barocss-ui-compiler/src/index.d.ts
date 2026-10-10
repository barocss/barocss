export interface CompilationArtifactV0 {
  version: 1;
  moduleId: string;
  sourceDigest: string;
  bundleDigest: string;
  bundle: Uint8Array;
  css: string;
  versions: { react: string; reactDom: string; esbuild: string };
}

export interface CompileUiOptions {
  moduleId: string;
}

/** Compile one complete authored JSX module. This is not hostile JavaScript validation. */
export function compileUi(source: string, options: CompileUiOptions): Promise<CompilationArtifactV0>;
