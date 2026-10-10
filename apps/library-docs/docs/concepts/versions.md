# Versions and availability

The [catalog](/packages/), generated public signatures and original examples use local Integration source commit `5f5ad866205a21510ac69552e704cc162fa253b5` from 10 October 2026 as their baseline. The catalog records package versions and export maps at that commit.

Newer task guides state their own execution profile. For example, [Unicode labels](/packages/canvas2d/unicode-labels), [diagram labels](/packages/canvas2d/diagram-labels) and [path control editing](/packages/canvas2d/path-editing) use separate fixed source profiles. Read the selected guide's profile before using its APIs. Unless another profile is stated, the version and export-map statements on this page describe the catalog baseline.

## Choose an execution path

Most workspace development entries point to TypeScript source. Use the repository's supported Node 22+ tools and a TypeScript-transforming bundler or runner. Ordinary package-name imports select these source entries. No custom source condition is required.

Plain Node does not automatically resolve internal `.js` specifiers to `.ts` files. A raw Node import of a source-default package is not a supported quickstart.

`publishConfig` supplies complete compiled JS and declaration maps for a future packed package. The existing pnpm transformation replaces the whole exports map. Source execution does not verify that transformation, a tarball or a registry release.

Render differs at this clean snapshot: its default entry is `dist/index.js`, version `0.12.0`. A proposed manifest in a shared dirty checkout is outside this manual snapshot.

## Read stage labels precisely

| Stage | What it proves |
| --- | --- |
| Source available | The declared source entry exists at the stated commit |
| Native built / run | A specific native author ran the stated build or flow |
| Locally merged | Integration adopted a specific native delta |
| Consumer verified | The stated host or API flow ran at its recorded version |
| Published | A verified registry or deployment receipt exists |

The portal build verifies documentation output. It does not verify all package APIs. Individual snippets or examples identify their actual test scope. Eight engine/editor catalog packages have no registry publication receipt in this manual. Render has a historical exact0.12.0 publication and consumer receipt under [#478](https://github.com/barocss/barocss/issues/478); The recorded read-only registry check also reports `0.12.0` and an integrity value. No new install or byte comparison ran for this manual. That evidence does not verify all newer local changes in its source snapshot. Local public access metadata alone is insufficient.

## Existing CSS releases

Kit, Browser and Server have source manifest version `0.12.0` in this snapshot. Existing CSS docs in this local snapshot retain a verified example pin of `0.11.2`. These are different facts; this portal does not update either pin or determine the latest npm version. Release `0.12.2` remains separately owned.

## Experimental rendering

Renderer work tracked under #1183 and #1184 is not an available public runtime quickstart here. Use only actual exports at the fixed source commit. Do not infer professional CAD parity, format parity or whole-engine support from one bounded example.

The catalog baseline commit is local-only: GitHub commit lookup returned HTTP422 No commit found on 10 October 2026. Public declaration references therefore open in this portal. Other repository paths remain plain provenance text. A pinned GitHub source link is allowed only after the exact commit is confirmed remotely. Do not substitute a moving remote branch as the manual's version.
