# @barocss/ui-compiler

`compileUi` is a Node 22 server API. It compiles one complete authored JSX module into a browser bundle and fixed BaroCSS CSS. It does not call an AI provider.

```js
import { compileUi } from '@barocss/ui-compiler';

const artifact = await compileUi(source, { moduleId: 'counter' });
// { version: 1, moduleId, sourceDigest, bundleDigest, bundle, css, versions }
```

`bundle` is a `Uint8Array`. The two lowercase SHA256 digests cover the original UTF-8 source and emitted bundle bytes. `versions` records the pinned React, ReactDOM and esbuild versions used for the bundle. The host owns artifact storage and resource URLs.

Authored source may import `react` and the compiler's virtual `@barocss/ui` module. That module exports `Layout`, `Card`, `Text`, `Input` and `Button`. The compiler generates `react/jsx-runtime` imports. Source must have a default export. Source is limited to 32 KiB and the bundle to 2 MiB. Foreign imports, forwarded imports, `require` and dynamic imports fail.

The host serves `artifact.bundle` as JavaScript and `artifact.css` in an iframe document. The document must contain `#app` and meta tags named `host-origin`, `instance-id` and `bundle-digest`. The host uses `<iframe sandbox="allow-scripts">`; the bundle runs in that opaque frame. It sends `ready` with `instanceId` and `bundleDigest`. It accepts a parent `init` message with the same identifiers, `initialState: { name, count }` and `canSave`, after checking the parent's window and origin. It sends `state` and `save` with the selected `{ name, count }`. Name length is at most 80 and count is an integer from 0 through 1000. A later `init` renders in the same React root, so mounted hooks stay local to the frame.

The host supplies stream identity, permissions, action handling and persistence. Import checks do not make arbitrary JavaScript safe. The package does not isolate CPU use or migrate state between different bundles.

Build with `node build.mjs`. The [`ui-compiler-package` example](../../examples/ui-compiler-package/README.md) stages emitted public packages and runs one bounded browser flow.
