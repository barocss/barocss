# BaroCSS Vision

BaroCSS is not ultimately a Tailwind CSS replacement.

Its long-term goal is to become UI infrastructure for an era where AI
generates, understands, modifies, and verifies user interfaces:

    Human ↔ AI ↔ UI

Tailwind compatibility is strategically useful, but it is not the final
product boundary.

## What we are trying to discover

What BaroCSS *uniquely* has to provide in that loop. Don't assume it's AI-specific
APIs. Most of the loop may already be covered by the browser, the DOM, agent
tooling, or applications. BaroCSS should own only what it alone knows or does,
and only once evidence shows it's needed.

## What counts as progress

Progress means evidence that changes what BaroCSS should become. Code,
APIs, abstractions, passing tests, and docs are not progress by themselves.
Finding out that no new BaroCSS code is needed counts as progress.

## Operating priorities

1. Product direction over output
2. Fast progress
3. Minimal human intervention
4. Minimal context/token cost
5. Deterministic verification where possible
6. Observable, resumable from a fresh session
