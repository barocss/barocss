// Passive exec telemetry. Reported counter scope is not established across resumes.
const required = ['input_tokens', 'cached_input_tokens', 'output_tokens'];
const optional = ['reasoning_output_tokens'];
const counter = (value) => Number.isSafeInteger(value) && value >= 0;

export function completionUsage(eventCount, usage) {
  let status = 'reported', reportedCounters = null;
  if (eventCount === 0) status = 'no-completion';
  else if (eventCount !== 1) status = 'ambiguous';
  else if (usage == null) status = 'missing';
  else if (typeof usage !== 'object' || Array.isArray(usage)
    || required.some((key) => !counter(usage[key]))
    || optional.some((key) => Object.hasOwn(usage, key) && !counter(usage[key]))) status = 'malformed';
  else reportedCounters = Object.fromEntries([...required, ...optional].map((key) => [key, usage[key] ?? null]));
  return { status, completionEventCount: eventCount, reportedCounters, counterScope: 'unverified' };
}

export function packetUsage(results) {
  return {
    turns: results.map((result) => result.usage),
    counterScope: 'unverified',
    tokenTotals: null,
    totalReason: 'Reported counters are not summed or differenced across resumed processes without verified scope.',
    billedCost: { status: 'unavailable', amount: null, currency: null,
      reason: 'No billing record; ChatGPT account cost is not inferred from API token prices.' },
  };
}
