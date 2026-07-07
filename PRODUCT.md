# Diorama — Product Context

## Register

product — app UI / tool. Design serves the task (building and watching agent worlds); the 3D viewport is the hero, chrome recedes.

## Users & Purpose

Developers who run AI agents (Claude Code, Codex CLI, OpenClaw, custom systems). They come to Diorama to (1) lay out a 3D office in a wizard, (2) connect their agent runtimes, (3) leave a live view running to watch agents work. Context: a second monitor or a browser tab next to a terminal; dark ambient, long sessions.

## Personality

Precision instrument. Three words: exact, quiet, confident. The interface should feel like a serious CAD/editor tool that happens to produce something playful (little walking agents) — the playfulness lives in the 3D scene, never in the chrome.

## References

- **Figma** (primary): canvas-centric editor, clean panels, numeric inspector, calm tab vocabulary.
- Linear (secondary): 13px UI discipline, keyboard-first affordances, restrained accent.

## Anti-references

- Hackathon-dashboard dark UI: arbitrary paddings, gray-on-gray boxes, no vertical rhythm.
- Sci-fi command-center kitsch: glows, scanlines, mono-everything.
- SaaS marketing chrome inside the tool (hero metrics, gradient text).

## Design principles

1. Viewport first: panels and bars take minimum visual weight; one accent color reserved for selection/primary action.
2. Numbers are first-class: coordinates, sizes, counts render in mono with tabular figures.
3. Every control states its state: hover/focus/active/disabled are designed, not defaulted.
4. Density over emptiness in panels; whitespace carries hierarchy in flows (wizard steps).
5. Motion only for state change, 150–200ms, ease-out.

## Accessibility

Body/labels ≥4.5:1 on their surfaces. Focus visible on every interactive element. Reduced-motion honored.
