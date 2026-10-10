# First failures and repairs — #1270

- An initial edit command used the app cwd with repository-relative paths and failed before writing. Retried from the native repository root; no package or shared file changes.
- First app-cwd bundle rejected its own input locations because esbuild metadata was relative to the invoking cwd. Fixed esbuild absWorkingDir to the immutable native repository root; retained exact own-source/path and zero-dist admission, rather than skipping the guard. The first browser navigation before the dev host started returned connection refused.
- The first dev host rejected a dynamic import from Vite public assets. Generated the own-source ESM into ignored .vitepress/generated and used a normal Vue import. Vite now processes it for SSR/client bundling; no arbitrary runtime public-script import or source alias. Removed the abandoned public runtime.js.
- First complete docs build passed, but the link checker found a removed CAD Interop Three-host task anchor and GPU example anchors while that helper was still writing. Restored the existing Three-host anchor and finished the actual GPU example sections. No dead-link suppression.
- An old preview process started against the previous build served a stale route404 and missing hashed assets after dist replacement. It exited on missing old style asset. Start a fresh owned preview only after the final build; do not treat those stale process errors as current browser acceptance.
- Browser session launch initially created its own root .playwright-cli/output artifacts. Moved only owned new receipts/screenshots into app-local ignored output; no root files are included in the delta.

Expected invalid source/material refusals in the final browser and CPU examples are task evidence, not unresolved runner failures. The normal large-reference chunk warning remains visible; no threshold or performance claim changed.

- A screenshot-only pass queried the Vue ready marker before the new route had created its component and threw on null. The final production pass waits for the actual marker with a null guard; no timer-based hydration assumption.

- The screenshot pass hid the navigation banner, then tried to restore it through a role locator that excludes hidden elements. Captures had completed, but restoration timed out. Use includeHidden for that owned banner restoration. A separate heading wait used an exact name without its accessible permalink suffix; changed it to the actual heading-name prefix. These are browser-script locator repairs, not hidden page errors.

- A production navigation pass reported one real VitePress1.6.4 outline error: a deferred scroll update touched its removed marker.style after doc→page navigation. Confirmed actual stack in the theme chunk and installed outline.js. The playground already has no outline; setting its frontmatter aside:false makes the inherited aside-enabled guard stop that pending callback. No dependency patch or runtime upgrade. Retained the failed production JSON and verify the same route on a fresh affected build.

- aside:false did not fix the production error. Inspection of actual useAside showed it depends on media/sidebar, not that frontmatter flag. Do not treat that attempt as verified. Retain the default doc layout for the playground, keep its outline empty, and apply app-local wide-content CSS. The native outline component remains mounted during docs→playground transitions; no dependency source patch or upgrade. Recheck actual route, viewport and console.
