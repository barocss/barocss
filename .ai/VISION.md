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

## Who it is for (human direction, 2026-09-25)

Developers who build UI with AI through AI UI generation platforms (v0-like). The platform
emits Tailwind v4 markup; BaroCSS renders it with no build step, first in the platform's live
preview and then, unchanged, in production.

A zero-build Tailwind already exists: Tailwind's own browser runtime (`@tailwindcss/browser`),
which is not meant for production. BaroCSS earns its place only where it wins over that runtime:

1. **Production-grade.** Safe to ship with no build: size, runtime cost, caching and no flash
   of unstyled content, comparable to a built Tailwind stylesheet.
2. **Streaming.** While an AI streams markup, each class is styled as soon as it appears.
3. **Runtime theme and config.** Brand and theme change live, with no rebuild.

Table stakes: Tailwind v4 parity. Generated markup is Tailwind v4, so any divergence is a
broken UI to the developer (K10).

Not goals now: AI-specific APIs and styling provenance (O3), unless evidence shows one of the
three wins needs them.

Measure each claim against `@tailwindcss/browser` and a built Tailwind v4 stylesheet on
realistic generated UI. If BaroCSS doesn't win on one, that is a finding, not a failure.

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
