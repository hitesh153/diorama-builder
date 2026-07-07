# Diorama — Design System

Dark-only precision-instrument UI. Tokens are CSS variables in `packages/app/app/globals.css`; components consume them via `var(--…)` and the `dio-*` classes.

## Color (OKLCH)

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.15 0.014 265)` | app background |
| `--surface` | `oklch(0.19 0.016 265)` | panels, sidebar, bars |
| `--surface-2` | `oklch(0.23 0.018 265)` | raised: hover, active tab, inputs |
| `--border` | `oklch(0.29 0.02 265)` | hairline borders (1px) |
| `--border-strong` | `oklch(0.38 0.024 265)` | focused/hovered borders |
| `--ink` | `oklch(0.94 0.008 265)` | primary text |
| `--ink-2` | `oklch(0.74 0.018 265)` | secondary text, placeholders |
| `--ink-3` | `oklch(0.58 0.02 265)` | tertiary/disabled (large text only) |
| `--accent` | `oklch(0.66 0.15 270)` | selection, primary buttons, focus rings |
| `--accent-soft` | `oklch(0.66 0.15 270 / 0.14)` | selected backgrounds/tints |
| `--ok` / `--err` / `--warn` | green/red/amber at L 0.7 | status |

Strategy: Restrained. Accent ≤10% of any screen; status colors only on status.

## Typography

System stack `ui-sans-serif, -apple-system, "Segoe UI", sans-serif`; mono `ui-monospace, "SF Mono", Menlo` for numerics/code/agent-ids (always `font-variant-numeric: tabular-nums`).

Scale (fixed rem): 20/15/13/12/11 px → step ratio ~1.18. UI base 13px. Weights: 450 body, 550 medium, 650 semibold. Labels: 11px/550, letter-spacing 0.02em, sentence case (no all-caps scaffolding).

## Components (`dio-*` classes)

- `dio-btn` (+ `-primary`, `-ghost`, `-danger`) — 32px height, 6px radius, designed hover/active/disabled/focus-visible.
- `dio-input`, `dio-select` — 32px, surface-2 bg, border → accent ring on focus.
- `dio-card` — surface + border + 10px radius; `dio-card-interactive` adds hover raise + selected state via `aria-pressed`/`data-selected`.
- `dio-tab` — quiet text tabs with active underline (no filled boxes).
- `dio-label` — 11px/550 ink-2 field label.
- `dio-kbd` — key hint chip.

## Layout

- Spacing scale: 4/8/12/16/20/24/32.
- Wizard shell: 48px top bar (wordmark · stepper · step action) over full-bleed content; flows constrained to 560px column.
- Builder: toolbar 44px; right sidebar 300px, `--surface` with hairline divider; inspector/panel sections separated by borders, 12/16px padding.
- z-scale: dropdown 10 · sticky 20 · overlay 30 · modal 40 · toast 50.

## Motion

150–200ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint feel). State changes only: tab underline, card raise, step transitions (fade+4px rise), copilot thinking. `prefers-reduced-motion`: transitions collapse to instant.
