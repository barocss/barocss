export const unverifiedBrowser = { status: 'unverified' } as const;

// Guard checked these exact single-class inputs against Tailwind CSS 4.3.3.
// The source comments record the fixture, browser, OS, and measured values.
export const zoomTabBrowserEvidenceSource = 'https://github.com/barocss/barocss/pull/84#issuecomment-5791345702';
export const gutterBrowserEvidenceSource = 'https://github.com/barocss/barocss/pull/84#issuecomment-5791909812';

const evidence = {
  'zoom-75': { property: 'zoom', computedValue: '0.75', elementWidth: '75px', barocssCommit: '5a20ae7', source: zoomTabBrowserEvidenceSource },
  'zoom-125': { property: 'zoom', computedValue: '1.25', elementWidth: '125px', barocssCommit: '5a20ae7', source: zoomTabBrowserEvidenceSource },
  'tab-2': { property: 'tab-size', computedValue: '2', elementWidth: '100px', barocssCommit: '5a20ae7', source: zoomTabBrowserEvidenceSource },
  'tab-[12px]': { property: 'tab-size', computedValue: '12px', elementWidth: '100px', barocssCommit: '5a20ae7', source: zoomTabBrowserEvidenceSource },
  'scrollbar-gutter-auto': { property: 'scrollbar-gutter', computedValue: 'auto', clientWidth: '160px', barocssCommit: '82ababe', source: gutterBrowserEvidenceSource },
  'scrollbar-gutter-stable': { property: 'scrollbar-gutter', computedValue: 'stable', clientWidth: '160px', barocssCommit: '82ababe', source: gutterBrowserEvidenceSource },
  'scrollbar-gutter-both': { property: 'scrollbar-gutter', computedValue: 'stable both-edges', clientWidth: '160px', barocssCommit: '82ababe', source: gutterBrowserEvidenceSource },
} as const;

export function browserEvidenceV4_3_3(classes: string[]) {
  if (classes.length !== 1 || !(classes[0] in evidence)) return unverifiedBrowser;
  const candidate = classes[0] as keyof typeof evidence;
  return {
    status: 'verified-match',
    browser: 'Headless Chrome 153',
    os: 'macOS 15.6.1',
    tailwindVersion: '4.3.3',
    ...evidence[candidate],
  } as const;
}
