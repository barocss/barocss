# @barocss/browser

## 0.0.4

### Patch Changes

- Fix style updates after DOM changes, configuration updates, cache clearing, and runtime cleanup.
- Make `BrowserRuntime.removeClass()` remove injected CSS for the target class while preserving rules still used by other classes.
- Publish a working ESM entry and CDN bundles. Remove the CommonJS `require` entry advertised by 0.0.3; that entry failed in a standalone Node consumer.
- Update dependency on `@barocss/kit` to 0.0.4.

## 0.0.3

### Patch Changes

- Updated dependencies [c709bc2]
  - @barocss/kit@0.0.3
