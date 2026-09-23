export const unverifiedBrowser = { status: 'unverified' } as const;

// Guard checked these exact single-class inputs against Tailwind CSS 4.3.3.
// The source comment records the fixture, browser, OS, and measured values.
const evidence = {
  'zoom-75': { property: 'zoom', computedValue: '0.75', elementWidth: '75px' },
  'zoom-125': { property: 'zoom', computedValue: '1.25', elementWidth: '125px' },
  'tab-2': { property: 'tab-size', computedValue: '2', elementWidth: '100px' },
  'tab-[12px]': { property: 'tab-size', computedValue: '12px', elementWidth: '100px' },
} as const;

export const browserEvidenceSource = 'https://github.com/barocss/barocss/pull/84#issuecomment-5791345702';

export function browserEvidenceV4_3_3(classes: string[]) {
  if (classes.length !== 1 || !(classes[0] in evidence)) return unverifiedBrowser;
  const candidate = classes[0] as keyof typeof evidence;
  return {
    status: 'verified-match',
    browser: 'Headless Chrome 153',
    os: 'macOS 15.6.1',
    tailwindVersion: '4.3.3',
    barocssCommit: '5a20ae7',
    source: browserEvidenceSource,
    ...evidence[candidate],
  } as const;
}
