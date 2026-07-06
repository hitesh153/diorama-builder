# Diorama v3 — Generic Agent-World Builder

**Status:** Proposed · 2026-07-06
**Supersedes scope of:** `diorama-mvp-v2.md` (extends, does not replace)

## Vision

Diorama becomes **CAD software for AI-agent worlds**. Anyone runs `npx diorama`, connects
*their* agent runtime and *their* LLM, designs a world in a precision editor with an AI
copilot ("add a lab next to the meeting room, seat the QA agents there"), and watches
their agents live in 3D.

The design test for every feature: **could a stranger with zero context use this?**
No feature may assume a specific agent framework, LLM vendor, or file layout beyond
documented, optional connector presets.

Two generic seams define the architecture:

1. **Bring your own agents** — source connectors (OpenClaw gateway, Codex/Hermes
   sessions, Claude Code, or a public push-event protocol for everything else).
2. **Bring your own copilot** — LLM provider adapters (Anthropic key, Codex/ChatGPT
   auth, any OpenAI-compatible base URL, Ollama).

---

## Current state (verified 2026-07-06 by full simulation)

- 419/422 tests pass (3 failures = live gateway test needing a real server). Node 20 works despite Node 22 pin.
- Full wizard loop works end-to-end: connect (demo) → build 4 rooms → theme swap → agent config → save to `~/.diorama/config.json` → live view with streaming activity feed.
- **Verified bugs:** Step-3 seat dropdown always empty ("No assigned seat" only); all agents cluster/overlap in one room in live view; mock event room names don't match built rooms (random-glow fallback); initial camera framing cuts rooms off; missing favicon; `npm run lint` broken (no eslint config); README drift (192 vs 422 tests, 3 vs 4 steps).
- **Dormant assets:** `roomGraph.ts` pathfinding fully built + tested but unwired from LiveView; dashboard view exists but not routed through plugin registry; `api/gateway/discover` exists but layout generation ignores roles.

---

## Pillar A — Connector architecture (bring your own agents)

### A1. Public event protocol (the "whatever" adapter)
Define and document a tiny, versioned wire format any system can emit:

```jsonc
// POST http://localhost:<port>/api/ingest  (or WS /api/ingest/ws)
{ "v": 1, "type": "task.started", "agent": "my-agent", "room": "Lab",
  "label": "running tests", "ts": 1751780000000 }
```

- `packages/engine/src/protocol.ts` — Zod schema, versioned, exported as the public contract.
- CLI dev server gains an ingest HTTP + WS endpoint feeding the EventBus.
- Docs page with copy-paste `curl`, Python, and TS snippets ("integrate in 5 lines").
- This makes every future connector a *convenience preset*, not a requirement.

### A2. Source connector interface (formalize what exists)
```ts
interface SourceConnector {
  id: string;                    // "openclaw" | "codex" | "claude-code" | "ingest" | "mock"
  detect?(): Promise<DetectResult | null>;   // auto-discovery for wizard step 1
  connect(cfg, emit: (e: DioramaEvent) => void): Disposable;
}
```
- Refactor `openclawGateway.ts` and `mockData.ts` onto this interface (registry-driven, config `sources: []` array — **multiple simultaneous sources**, agents color-badged by source).

### A3. Connector presets (each optional, each detected)
- **OpenClaw** (exists — harden reconnect, surface auth errors in UI).
- **Codex sessions** — tail `~/.codex/sessions/**/*.jsonl` (rollout files): session start/stop, tool calls, messages → normalized events. Generic "JSONL directory tail" primitive underneath so *any* session-logging runtime can reuse it. (This is the generic form of "Hermes support": hermes-agent, Codex CLI, and anything session-file-based rides the same primitive.)
- **Claude Code** — tail `~/.claude/projects/*/sessions` transcripts the same way.
- **Wizard step 1 redesign:** "Detect my agents" scans known locations/ports, shows cards (✓ OpenClaw gateway on :4040 · ✓ Codex CLI, 3 recent sessions · ✓ Claude Code, 2 projects · + paste-a-URL · + demo). Multi-select, not either/or.

### A4. Agent roster sync
- Sources report their agent list (`discover()`); wizard step 3 and live view merge rosters across sources; agents keep `source` provenance for badges and filtering.

**Tests:** protocol schema, ingest route, JSONL tailer (fixture files), connector registry, multi-source merge. ~40 new tests.

---

## Pillar B — Copilot chat (bring your own LLM)

### B1. Provider adapter interface
```ts
interface CopilotProvider {
  id: string;                    // "anthropic" | "openai-compatible" | "codex-auth" | "ollama"
  chatStream(messages, tools): AsyncIterable<TextDelta | ToolCallDelta>;
}
```
- **anthropic** — API key, Messages API with tool use.
- **openai-compatible** — base URL + key; covers OpenAI, OpenRouter, Groq, LM Studio, vLLM…
- **codex-auth** — reads `~/.codex/auth.json` `tokens.access_token` (ChatGPT-subscription users; re-read on 401).
- **ollama** — local, zero-key.
- Keys live server-side only: CLI server proxies `/api/copilot/chat`; credentials in `~/.diorama/credentials.json` (0600). Never shipped to browser.
- Settings UI: provider picker + "test" button, mirroring the gateway-test pattern.

### B2. Tool surface = builder actions (the CAD copilot contract)
The copilot's tools dispatch **into the existing reducer** — so every AI edit is
undoable, config-synced, and identical to a manual edit:

`add_room, remove_room, move_room, resize_room, set_theme, set_room_colors,
set_floor_style, add_furniture, remove_furniture, rename_room, assign_agent,
set_agent_energy, generate_layout, describe_world, zoom_to`

- `packages/ui/src/copilotTools.ts` — tool JSON-schemas + pure `applyToolCall(state, call) → actions[]` (fully unit-testable, no LLM needed).
- `generate_layout(brief)` finishes the mvp-v2 promise: roles/count → room program → `autoLayout` placement (e.g. "6 agents: 2 coders, 1 QA, comms" → Workspace ×2, Lab, Comms room, Lounge).
- `describe_world` gives the model read access to current rooms/agents/theme so it edits in context.

### B3. Chat UX (CAD-grade, not chatbot-grade)
- Dockable right-panel chat in the builder (and live view), streaming.
- **Propose → preview → apply:** multi-step edits render as ghost/outline geometry in the 3D scene with Apply / Reject; single unambiguous ops apply instantly with an inline "applied ✓ (undo)" chip. All applied batches = one undo step.
- Quick-prompt chips on empty state: "Design an office for my team", "Make it cyberpunk", "Add a meeting room with 6 chairs".
- Errors (no provider configured) route to a friendly setup card, never a stack trace.

**Tests:** applyToolCall for all tools, layout generation (role→program), provider adapters (mocked HTTP), credential storage. ~60 new tests.

---

## Pillar C — CAD-grade editor

### C1. Viewport & navigation
- **2D top-down orthographic ⇄ 3D orbit toggle** (Tab / toolbar) — the single biggest CAD-feel unlock; 2D mode is where precision layout happens.
- Zoom-to-fit (F), zoom-to-selection, persistent camera per mode, fix initial framing bug.

### C2. Precision & inspector
- Right-side **Inspector panel** when a room/furniture is selected: numeric X/Y, W/H (grid units + meters), label, preset, floor style, colors — type a number, room moves.
- Grid controls: snap on/off, grid size; dimension callouts already exist — keep.

### C3. Interaction model
- Keyboard: `V` select, `Del`/`D` delete, `Cmd+Z`/`Cmd+Shift+Z`, arrows = nudge 1 unit, `Shift+arrows` = 5, `Cmd+D` duplicate, `Esc` cancel.
- **Drag-from-palette** to place rooms/furniture where dropped (replacing click-adds-at-default).
- Multi-select (shift-click + marquee in 2D), group move; copy/paste rooms with furniture.
- Furniture: select/move/rotate (R rotates 90°)/delete existing items — currently placement-only.
- **Door editing:** doors on shared walls as draggable openings (roomGraph already models doors — expose them).

### C4. Onboarding & polish
- First-run: pre-seeded example world + 4-step coach marks (per `docs/superpowers/specs/onboarding-redesign`).
- Empty states, hover cursors, wall z-fighting fix, favicon.

**Tests:** reducer additions (multi-select, duplicate, furniture ops, doors), nudge/snap math, inspector round-trip. ~50 new tests.

---

## Pillar D — Living world (finish the simulation)

- **Re-wire pathfinding:** events with a room target → agent walks there via `roomGraph` waypoints (code exists, was unwired 2026-04-09); energy drives idle wandering between allowed rooms; seated ⇄ walking transitions.
- **Fix seating:** step-3 seat dropdown populated from placed chair furniture (the verified bug — `configToRooms` furniture must reach `AgentBehaviorStep`); live view honors explicit seats, round-robins the rest **across rooms**, never stacks agents on one tile.
- **Room matching:** fuzzy match event room names → config rooms (case/space-insensitive, alias map in config); unmatched events go to feed only, no random-glow.
- **View plugins for real:** route `view: "3d-office" | "dashboard"` through the plugin registry; dashboard = live agent grid + activity stream + per-room occupancy (using the same EventBus).
- Demo mode generates events referencing the *user's actual built rooms* (fixes the mismatch found in simulation).

**Tests:** path re-integration, seat pool builder, fuzzy matcher, view routing. ~40 new tests.

---

## Pillar E — Ship to 100% (productization)

- **Repo hygiene:** eslint flat config (fix broken `lint`), `engines: ">=20"` (drop the Node-22 folklore, update CLAUDE.md), LICENSE (MIT), favicon, README rewrite (accurate counts, 4 steps, real quick-start), CONTRIBUTING.
- **CI:** GitHub Actions — install, lint, typecheck, `vitest run` (live-gateway tests skipped without `GATEWAY_URL`), `next build`, on Node 20 + 22 matrix.
- **npm publish:** scoped packages or single `diorama` package with bundled workspaces; `npx diorama init && npx diorama dev` smoke-tested from a clean temp dir in CI; semver + changelog; `latest` publish gated on CI green.
- **Docs site content (in-repo `docs/`):** quick-start, connector protocol, "write a connector", "connect your LLM", template gallery, keyboard map.
- **Templates refresh:** starter/full-office/minimal updated to v3 config (`sources[]`, copilot provider stub).

---

## Milestones & order

| # | Milestone | Contents | Size |
|---|---|---|---|
| **M0** | Foundation | All verified bugs (seats, clustering, camera, room-match, favicon), eslint, engines, CI skeleton, README truth | S |
| **M1** | CAD editor | 2D/3D toggle, inspector, keyboard map, drag-from-palette, multi-select, furniture editing, doors | L |
| **M2** | Copilot | Provider adapters + credentials, tool surface, chat panel, propose/preview/apply, generate_layout | L |
| **M3** | Connectors | Event protocol + ingest, connector interface refactor, Codex/Claude-Code presets, detect-my-agents wizard, multi-source | M |
| **M4** | Living world | Pathfinding re-wire, walking agents, view-plugin routing, dashboard, demo-mode room fix | M |
| **M5** | Ship | npm publish pipeline, docs, templates, onboarding tour, clean-machine smoke test | M |

Order rationale: M0 unblocks trust in the loop; M1 before M2 so the copilot drives a
*finished* action surface; M3 before M4 so walking agents demo against real sources;
M5 last, everything green.

Dependencies: M2 depends on M1's reducer extensions; M4 depends on M3's roster sync.
M1 and M3 are parallelizable.

Test trajectory: 422 → ~610+ across milestones, preserving the sibling-`.test.ts` TDD convention.

## Non-goals (v3)
- Arbitrary/angled geometry, terrain, multi-floor — grid-rectangle rooms stay.
- Hosting/multiplayer/cloud sync — local-first, config file is truth.
- Agent *control* (issuing commands to runtimes) — Diorama observes and visualizes; the copilot edits the *world*, not the agents.
