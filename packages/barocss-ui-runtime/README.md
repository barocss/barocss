# @barocss/ui-runtime

Browser controller for complete compiled UI artifacts. The package does not
compile JSX, fetch a model, create the frame document, or authorize storage.
The host supplies those services.

```ts
import { createUiRuntime } from '@barocss/ui-runtime';

const runtime = createUiRuntime({
  container,
  async resolveResource(record, { instanceId, hostOrigin, signal }) {
    const artifact = await loadArtifact(record.bundleDigest, signal);
    const frameUrl = await createFrameDocument(artifact, { instanceId, hostOrigin, signal });
    return { artifact, frameUrl };
  },
  async onSave({ state, streamId, revision, bundleDigest, signal }) {
    await saveIfAuthorized({ state, streamId, revision, bundleDigest, signal });
  },
});
const admitted = await runtime.start(records); // AsyncIterable of one module, one commit, then normal EOF
runtime.dispose();
```

The module record has `version:1`, `seq:1`, `type:'module'`, `phase:'preview'`,
`streamId`, `revision`, `moduleId`, `sourceDigest`, `bundleDigest`, and
`initialState:{name,count}`. The matching commit has `version:1`, `seq:2`,
`type:'commit'`, `streamId`, `revision`, and `bundleDigest`. Records must have
exactly those fields. `name` is at most 80 characters; `count` is an integer
from 0 through 1000. The bundle digest is SHA256 of the returned bytes.

The host must serve a frame document with the artifact's script and CSS and
`host-origin`, `instance-id`, `bundle-digest` metadata. The compiler's bundled
child bootstrap checks the parent origin. The parent uses an iframe with only
`allow-scripts`, so its origin is opaque. It accepts bridge messages only from
the active frame's `contentWindow`, with origin `null` and matching instance
and bundle digest. The frame URL is host supplied; the runtime checks that it
uses HTTP or HTTPS. The host must set safe resource access and CSP policy.

The frame stays in the same DOM parent during preview. A matching bundle reuses
the mounted frame and its local hooks. A new bundle gets a fresh frame and
initial state. Cancel or error restores the previous committed frame. Save is
forwarded only after matching commit, normal EOF and mount. A rejected save
callback can be called again; the host must enforce action authority and
idempotency. `dispose()` aborts owned resource work, settles pending mount,
removes frames and the message listener. It cannot abort an external callback
that ignores its signal.

Build with Node 22 and `pnpm --filter @barocss/ui-runtime build:library` after
workspace registration. In an isolated checkout with existing dependencies,
`tsc -p packages/barocss-ui-runtime/tsconfig.json` emits `dist/index.js` and
`dist/index.d.ts`. The example under `examples/ui-runtime-package` uses a
hand-authored artifact fixture and reports that boundary explicitly.
