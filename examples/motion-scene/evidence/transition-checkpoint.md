# Motion #692 native checkpoint

Base: #687 native `3a0e1dfcd5910648d343155291d088bf3ab46291`. This is an isolated Motion-owned delta; serial Integration and Viewer adoption are separate. Public API and transition state rules were frozen in [#692](https://github.com/barocss/barocss/issues/692#issuecomment-6054942239) before code. The owner's later instruction resumed implementation without waiting for Planner's separate Wiki reconciliation #701.

## Actual bounded runs

- Node 22.22.0: `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --dir packages/barocss-motion build:library` exited 0. TypeScript and esbuild produced `dist/index.js` (61.9 KB) and declarations.
- Node 22.22.0: `node examples/motion-scene/transition-probe.mjs` exited 0. Two actual `.baromotion` files gave source/destination midpoint clocks 2/1 s at weight 0.5, then adopted the destination at 2 s with its exact sampled pose. The source initial Part A signed zero survived. The repeat seam at source 3+1 s wrapped to 0; cubic fade midpoint weight was 0.31535681190527853. Invalid active replacement/seek, nonfinite delta, context/target/clock/duration/timing/getter input and use after disposal were refused with prior state retained. Returned poses were independently owned.
- Headed Playwright Chrome: `http://127.0.0.1:52189/examples/motion-scene/transition-demo.html` from a repository-root HTTP server. The actual UI loaded two clip assets and a Three.js 3D scene. Seek source to 1 s, transition, Play, Advance 1 s twice observed midpoint `[2,1,0.5]`, then `adopted` at target time 2 s/weight 1. Try incompatible clip reported `INCOMPATIBLE_CLIPS` and retained the accepted state. [Screenshot](transition-adopted.png). The renderer only consumed poses; no CAD source or scene identity was edited.

## First failures and limits

- An earlier attempt used a nonexistent absolute `pnpm` path and exited 127 before compilation. The same affected build passed with Node 22's `pnpm` and the existing Integration `tsc`/esbuild bin path.
- An earlier headed browser session closed between separate CLI calls. Reopening and running the flow in one session passed. The first attempt to replace two copied demo files in one `apply_patch` failed because delete/add targeted the same paths; separate delete/add passed.
- The prior managed worktree disappeared while its #692 edits were uncommitted. This checkpoint was reconstructed on a new clean worktree from the exact #687 native base. The lost uncommitted attempt is not a native deliverable.
- This proves a bounded reference consumer and public local build. It does not prove marker event switching, animation graph/layers/skinning, GPU/Viewer adoption, all renderer targets, professional numerical/performance quality, npm publication or release.
