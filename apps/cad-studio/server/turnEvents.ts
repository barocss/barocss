// A turn's server-sent events read whole (the A/B harness's and the robot L3 run's reader): each event's JSON, in
// order. Readers take the events by type — tool, state, done — so one they do not know (O17c's reasoning) is skipped.

/** The events of a turn's whole response text. */
export function turnEventsOf(raw: string): { type: string; [key: string]: any }[] {
  const events: { type: string }[] = [];
  for (const block of raw.split('\n\n')) { const data = /^data: (.*)$/m.exec(block)?.[1]; if (data) events.push(JSON.parse(data)); }
  return events;
}
