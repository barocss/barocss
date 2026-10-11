# Emitted compiler package flow

This example imports the emitted `@barocss/ui-compiler` package. It stages actual compiled public `@barocss/render`, `@barocss/server` and `@barocss/kit` exports. No example `.build` import enters the compiler package.

Use Node 22, existing dependencies and already built public package outputs. From the repository root:

```sh
node packages/barocss-ui-compiler/build.mjs
PUBLIC_DEPS_ROOT=/path/to/built/barocss PACKAGE_DEPS_ROOT=/path/to/installed/deps/barocss \
  node examples/ui-compiler-package/stage.mjs
PLAYWRIGHT_CORE_DIR=/path/to/installed/playwright-core \
  node examples/ui-compiler-package/flow.mjs
node examples/ui-compiler-package/cwd-repro.mjs
```

`stage.mjs` writes only ignored `.build/` files. The browser flow compiles the authored JSX module, checks malformed/foreign/dynamic inputs, serves bundle and CSS in an opaque frame, then checks the counter, calculation, input and selected state. The host fixture supplies the frame document and one `init` message. Save is disabled. It makes no provider call.

The package has local public configuration and emitted declarations. Integration owns workspace and lockfile adoption. This native flow does not prove integrated runtime behavior, publication, hostile JavaScript safety or CPU isolation.

The browser flow also checks the exact v1 artifact shape and the opt-in v2 CSS digest against the returned CSS bytes. It confirms that opting into v2 does not change the JS bundle or CSS bytes for the same source and dependency lease.

`cwd-repro.mjs` checks that the same emitted package and a relocated copy produce identical bundle bytes from different process working directories. It uses only the staged dependencies.

`layout-repro.mjs` compares the staged emitted package with an independently installed emitted package. Set `INSTALLED_COMPILER_ENTRY` to the absolute path of that installed package's `dist/index.js`. It requires byte-identical bundles and CSS from the same authored source and module ID. The installed package and its dependencies must be prepared separately; this script does not install or download them.

The compiler minifies browser output and preserves function and class names. This removes esbuild's dependency-path labels from the bundle while keeping authored names available to the UI code.
