// A row section's empty state (O16): one short line, and what its file holds behind Details (the long note it was).
import type { ReactNode } from 'react';

export function RowsEmpty({ none, holds, after = 'None is built in.' }: { none: string; holds: ReactNode; after?: string }) {
  return <div className="empty">{none}: load your own file. {after}
    <details className="muted"><summary className="cursor-pointer select-none">What the file holds</summary>{holds}</details></div>;
}
