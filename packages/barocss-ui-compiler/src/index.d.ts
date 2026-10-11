export interface CompilationArtifactV0 {
  version: 1;
  moduleId: string;
  sourceDigest: string;
  bundleDigest: string;
  bundle: Uint8Array;
  css: string;
  versions: { react: string; reactDom: string; esbuild: string };
}

export interface CompilationArtifactV2 extends Omit<CompilationArtifactV0, 'version'> {
  version: 2;
  cssDigest: string;
}

export interface CompileUiOptions {
  moduleId: string;
  artifactVersion?: 1 | 2;
}

/** Compile one complete authored JSX module. This is not hostile JavaScript validation. */
export function compileUi(source: string, options: CompileUiOptions & { artifactVersion: 2 }): Promise<CompilationArtifactV2>;
export function compileUi(source: string, options: CompileUiOptions & { artifactVersion?: 1 }): Promise<CompilationArtifactV0>;
export function compileUi(source: string, options: CompileUiOptions): Promise<CompilationArtifactV0 | CompilationArtifactV2>;
