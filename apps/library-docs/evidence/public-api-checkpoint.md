# Native public-reference checkpoint — #1259

Frozen native parent17d9f5d9ab56c9f0d2dfe7372a5ee6bbfbf79ab6. Actual source/API pin remains5f5ad866205a21510ac69552e704cc162fa253b5. M1was serially adopted ataf56102a7cde1904b261d573a377553dfae38a30; no currentRoot API equivalence is inferred. Only apps/library-docs changed.

## Actual results

- Reused TypeScript5.9.3 and VitePress1.6.4 with Node22.22.0. Public export graph resolves9packages/54manifest entries (including2CSS entries)/2568exported symbol occurrences, including repeated compatibility/subpath symbols. Function signatures, types/interfaces/enums and public class fields/methods/constructor parameter properties extracted; no private/protected class members or implementation bodies.
- Baseline check exit0. Temporary real TypeScript fixture: unchanged input matched; addedexport, changedfunctionsignature and significant literal-whitespace type change detected; private helper/member exclusion and public readonly parameter property inclusion passed. No package runtime/source mutation.
- --write refuses any tracked package diff from source pin or declaration not present at that pin. Ordinary app-local dependency search rejects own source outside native root. Source extraction is not peer type-checking, emitted declaration equivalence or runtime execution.
- Final app build exit0 in21.79s with retained >500kBchunk warning from large complete reference pages. No warning threshold changes or performance certificate.
-71Markdown pages,12manifest hashes and5040internal page/actual built-anchor links passed. HTML anchor data cached per actual generated page in checker. Active unavailable pinned source-link check exit0.
- Exact GitHub commit lookup actually returned422No commit found. Converted280formerly remote public declaration links to actual site-local groups;183other local paths became precise provenance text. Source-link status records unavailable pin; no moving-main substitution or product push. Native1248evidence is untouched.
- Final actual headless Chromium flow clicked GPU API's formerly-GitHub mesh-materialgroup→/packages/gpu/reference#declarations-0b26a7625574→compileMeshMaterialsymbol→expanded actual string/result signature→Meta+K local search→samepublicsymbolanchor. Actualpageerror/consoleerror/warning arrays[]; screenshot/result JSON retained. Headed visible preview changed between calls, so final bounded flow used a separate owned headless session. No allpage/browser/runtime campaign.

## Scope and limits

M2 public signature entry reference and baseline M3 static drift maintenance completed at this explicit source snapshot. Handwritten guides/errors/ownership/lifecycle remain the semantic authority; signature identity does not prove behavior/error/ownership unchanged. CurrentRoot has later CAD/Canvas/GPU/RenderEditorbarrel additions; updating the source snapshot requires another bounded docs review, not silent retagging. Existing1260tracks module-owned README stale Canvas Scene29 and CAD Editor Curve statements; Manual does not wait for those unrelated corrections.

No package/source/root/lock/workflow/policy/oldCSSchange, dependency upgrade/install, runtime rerun, productpush/PR/npm/deploy/Pages/domain or automation. Original1248material-source and full portal-navigation evidence retained rather than replayed. CurrentRoot acceptance remains separate1254/674; registry and website publication separate.
