# D374 — Rows 02 and 04 closed: drawing docs and the docs site batch

Tier: **small** (docs close-out). Owner order "Go to 01–06", 2026-10-31. [Qualification](qualification.json).

- **Row 02.** `studio/drawings.md` now matches the D372 actual flow:
  - Frame details edits the frame;
  - a hidden view gives `VIEW_NEEDED`, keeps the position and blocks moving;
  - Save and SVG keep the frame's position;
  - `TEXT_OVER_LINES` is described as it is reported.
- **Row 04.** The docs batch was checked:
  - **Samples:** all pass, 162/162. The earlier failures and cancellations are gone ([summary](samples-summary.txt)).
  - **API inventory:** `--check` passes.
  - **Public list:** reviewed, 6198 exposures in 3 packages. Nothing internal is exposed by mistake. The two underscore exports are intentional compile-time guards.
  - **Docs checks:** check-docs passes.
  - **Site build:** the vitepress build completes, with 69 pages and no dead links ([tail](site-build-tail.txt)).
  - **Pages:** the drawings page and the cad-model API page were opened in the built site.

**Limits.** The 24-case gallery is not closed by this. The site is not deployed, and no release was made.
