# Diorama — Project Knowledge

Configurable 3D workspace visualizer for OpenClaw. Users build spatial layouts for AI agents with rooms, furniture, and themes via a wizard, then watch agents in real time.

## Monorepo Structure

npm workspaces — 5 packages under `packages/`:

| Package | Path | Purpose |
|---------|------|---------|
| `@diorama/engine` | `packages/engine` | Core: config (Zod), plugin registry, event bus, geometry/coordinates, agent state, activity state, room graph/pathfinding, room presets (5 presets × 4 themes), auto-layout, furniture catalog (20 items), floor textures (5 styles) |
| `@diorama/plugins` | `packages/plugins` | Source plugins (OpenClaw gateway w/ Ed25519, mock data), theme plugins (neon-dark, warm-office, cyberpunk, minimal) |
| `@diorama/ui` | `packages/ui` | Builder store (reducer, 12 action types, undo/redo), config sync, room catalog |
| `@diorama/cli` | `packages/cli` | Scaffolding (`diorama init`), templates (starter, full-office, minimal) |
| `@diorama/app` | `packages/app` | Next.js 15 app: 4-step wizard, R3F 3D scene, builder sidebar, spatial editor |

## Tech Stack

- React 19, Next.js 15.3, TypeScript 5.7
- Three.js r175, @react-three/fiber 9, @react-three/drei 10
- Zod (config validation), Vitest 3.1 (testing)
- No CSS frameworks — all inline styles

## Commands

Node ≥20 (see `engines` in package.json).

```bash
npm test              # all tests (451+ across engine, plugins, ui, cli)
                      # live-gateway tests are skipped unless DIORAMA_LIVE_TESTS=1
npm run lint          # eslint (flat config at eslint.config.js)
npm run typecheck     # tsc --build (libs) + app project check
cd packages/app && npx next dev -p 3456   # dev server
npx next build        # app build (from packages/app)
```

## Architecture

### Coordinate System
- Canvas: 1800×1000, GRID_UNIT = 200 canvas units
- World: scale 0.018 → 1 grid cell = 3.6 world units (GRID_WORLD)
- Room positions/sizes are in grid units, converted for rendering

### Wizard Flow
1. **Connect** — Gateway URL + token, or demo mode
2. **Build Your Office** — Spatial editor (3D view) with sidebar (rooms, agents, theme, furniture tabs)
3. **Configure Agents** — Seat assignment, allowed rooms, energy level per agent
4. **Launch** — Save config to `~/.diorama/config.json`

### Scene (R3F)
- `BuildStep.tsx` — Main component: manages state (useReducer), sidebar, toolbar (Select + undo/redo)
- `BuildStep3D.tsx` — Canvas with PerspectiveCamera (3D only), OrbitControls
  - `CameraSync` component: imperatively centers camera + OrbitControls target on `roomsCenter` (world-space centroid of all rooms via `toWorld()`)
  - Directional + ambient lighting (`meshStandardMaterial`), glass walls, neon edge glow
- `Room3D.tsx` — Renders floor mesh, walls, labels, furniture, selection highlight
  - Full 3D furniture via `RoomFurniture3D`, dimension callouts on all 4 edges when selected
  - Floor texture rendering: procedural canvas textures (512x512) via `drawFloorPattern()`, applied as `meshStandardMaterial` map + emissive self-illumination (`emissiveIntensity: 0.3`) to ensure patterns visible in dark themes
  - Three-tier floor style resolution: per-room override > preset+theme default > "solid" fallback
- `ProToolbar.tsx` — Select indicator + undo/redo buttons
- Hooks: `useDragRoom` (drag-to-move with grid snap), `useResizeRoom` (8-handle resize), `useFurniturePlacement` (click-to-place)
- All hooks use ref-based patterns for R3F event handlers (avoid stale closures)
- Sidebar scroll: `minHeight: 0` + `overflow: hidden` on flex containers in the height chain (wizard page → BuildStep → sidebar)

### Builder Store (`@diorama/ui`)
- `builderReducer` with actions: ADD_ROOM, REMOVE_ROOM, MOVE_ROOM, RESIZE_ROOM, SELECT_ROOM, SET_ROOM_COLORS, SET_FLOOR_STYLE, ADD_FURNITURE, REMOVE_FURNITURE, UNDO, REDO
- Full undo/redo via past/future history stacks

### Room Presets
5 types: meeting, workspace, private, social, lab — each with theme-dependent furniture and floor/wall colors.

### Themes
4 built-in: neon-dark (sci-fi), warm-office (modern), cyberpunk, minimal. Each exports `colors` (background, accent) and furniture material definitions.

## Conventions

- All app components use `"use client"` directive
- Inline styles throughout (no Tailwind, no CSS modules)
- Dark theme: `#0d1520` backgrounds, `#1a2535` borders, `#8090c0` accents
- Engine exports pure functions; React/Three.js code lives only in `packages/app`
- Monospace font: `'SF Mono', 'Fira Code', monospace`

## Key Files

- `packages/app/app/wizard/page.tsx` — Wizard step flow
- `packages/app/components/wizard/BuildStep.tsx` — Spatial editor main (state, sidebar, toolbar)
- `packages/app/components/wizard/BuildStep3D.tsx` — R3F canvas (cameras, CameraSync, lighting, OrbitControls)
- `packages/app/components/scene/Room3D.tsx` — Room rendering (3D full)
- `packages/app/components/scene/RoomFurniture3D.tsx` — 3D furniture geometry rendering
- `packages/app/components/scene/ResizeHandles.tsx` — 8-handle room resize
- `packages/app/components/scene/DragGroundPlane.tsx` — Invisible ground plane for drag tracking + click-to-deselect
- `packages/app/components/scene/AlignmentGuides.tsx` — Snap alignment guides
- `packages/app/components/scene/GLBFurniture.tsx` — GLB model loading for furniture
- `packages/app/components/wizard/ProToolbar.tsx` — Toolbar: Select indicator + undo/redo
- `packages/app/components/builder/BuilderSidebar.tsx` — Sidebar with tabs (rooms, agents, theme, furniture)
- `packages/app/components/builder/FurnitureCatalogPanel.tsx` — Furniture catalog in sidebar
- `packages/app/components/builder/FloorStylePicker.tsx` — Floor texture selection
- `packages/app/hooks/useDragRoom.ts` — Drag-to-move with grid snap
- `packages/app/hooks/useResizeRoom.ts` — 8-handle resize
- `packages/app/hooks/useFurniturePlacement.ts` — Click-to-place furniture
- `packages/app/hooks/useAlignmentDetection.ts` — Alignment/snap detection
- `packages/app/components/wizard/AgentBehaviorStep.tsx` — Wizard step 3: agent seat, room access, energy
- `packages/app/components/LiveView.tsx` — Live 3D view with pathfinding-driven agent movement
- `packages/engine/src/roomGraph.ts` — Room connectivity graph, BFS pathfinding, waypoint generation
- `packages/engine/src/agentState.ts` — Agent state machine, energy-based idle pose
- `packages/engine/src/activityState.ts` — Activity derivation (event type + room preset → visual activity)
- `packages/app/components/scene/ActivityIndicator3D.tsx` — Activity icons + agent name labels above heads
- `packages/app/components/ActivityFeed.tsx` — Rolling event log panel (bottom-left overlay)
- `packages/engine/src/roomPresets.ts` — Preset definitions + furniture per theme
- `packages/engine/src/furnitureCatalog.ts` — 20-item catalog (4 categories)
- `packages/engine/src/floorTexture.ts` — 5 floor texture styles
- `packages/engine/src/geometry.ts` — `toWorld()`, `toCanvas()`, coordinate conversion
- `packages/ui/src/builderStore.ts` — Reducer + undo/redo (12 action types)

## Changelog

### 2026-07-06 — M4 Living World

Agents walk. Verified in-browser: an ingest event naming another room sent claude/ECC door-to-door into the Meeting Room.

- **Pathfinding re-wired** (LiveView) — the roomGraph engine (built 2026-04-09, unwired since the same day) now drives movement: event names a room ≠ agent's current room → `findRoomContaining` → `findRoomPath` (BFS) → `generateWaypoints` (door-to-door) → SET_PATH; direct-line fallback for disconnected rooms.
- **In-place state mutation pattern** — AgentFigure3D reads state.x/z per frame in useFrame, so the walking rAF loop MUTATES AgentState objects (Object.assign with the pure reducer's result) and React only re-renders on mode flips (`modeVersion` bump) — zero per-frame React churn.
- **Seat lifecycle** — seat pools memoized; taken-set/agent-seat/standing-count in refs shared by init + walking; walking frees the old chair, reserves the destination (chair first, standing-ring fallback), SIT on arrival.
- **Energy wandering** — every 4s an idle agent rolls energy×0.18 to visit a random allowed room (`allowedRooms` respected; empty = anywhere).
- **View routing** — `config.view` finally does something: 3D ⇄ Dashboard switcher (top-right, persisted to config). DashboardView rebuilt as a live surface: agent tiles (activity icon, last event, room, ago), rolling 40-entry stream, per-room event counts — same event sources as the 3D view.
- Dashboard tile updater made idempotent (exact-id match before fuzzy; batched SSE events could double-insert an unknown agent → duplicate React keys).

### 2026-07-06 — M3 Connectors (bring your own agents)

Generic agent-source architecture — verified live in-browser with this machine's real Codex (32 sessions) and Claude Code (8 projects) data, plus a curl-pushed custom agent that materialized in the 3D world.

- **Public event protocol** (`engine/protocol.ts`) — versioned Zod contract: `{v:1, type, agent, room?, label?, ts?, payload?}`, single or ≤500-batch. `parseIngestBody` (branch-parsed for field-path errors), `ingestToDioramaEvent`.
- **JSONL tailer primitive** (`plugins/sources/jsonlTail.ts`) — polling directory tailer under every session-file connector: per-file offsets, partial-line carry, truncation recovery, new-file discovery, live-only vs replay, 24h age filter.
- **Codex connector** (`sources/codexSessions.ts`) — tails ~/.codex/sessions/**.jsonl; agent = `codex/<project>` from session_meta.cwd; maps task_started/agent_message/web_search_end/task_complete/function_call → normalized events. `detectCodexSessions()`.
- **Claude Code connector** (`sources/claudeCode.ts`) — tails ~/.claude/projects/<slug>/*.jsonl; agent = `claude/<project>`; assistant text→message.sent, tool_use→tool.call; sidechains skipped. `detectClaudeCode()`. Both honor DIORAMA_* env dir overrides (tests).
- **⚠ fs-module boundary** — connectors + credentials are NOT exported from the plugins barrel (the app imports the barrel client-side → "Can't resolve 'fs'"). Server code imports deep paths (`@diorama/plugins/sources/codexSessions`).
- **Event hub** (`app/lib/eventHub.ts`) — server-side pub/sub with refcounted connector lifecycle. **State anchored on globalThis** — Next bundles each route separately, so plain module singletons would give POST /api/ingest and the SSE stream different hubs (bug found live, fixed).
- **Routes** — `POST /api/ingest` (public protocol), `GET /api/ingest/stream?sources=` (SSE fan-out + starts requested connectors while subscribed, keep-alive comments), `GET /api/sources/detect` (runtime cards), `GET /api/sources/roster?types=` (agent names from session files).
- **Wizard step 1 redesign** (ConnectStep) — "Detect my agents": pre-checked cards for available runtimes, expandable OpenClaw gateway form, push-events card, demo fallback. Roster merges local sources + gateway/demo discovery. `sources[]` flows through LaunchStep into config (new `sources` field in config schema).
- **LiveView** — `useIngestEvents` SSE hook feeds the shared EventBus; demo mode only when nothing connected; badge shows "Live · codex + claude-code"; unknown agents materialize on first event (golden-angle placement); roomless connector events fall back to the agent's assigned room; ingest `label` honored in the feed.
- Tests: 531 passing (9 protocol + 8 jsonlTail + 11 connectors added).

### 2026-07-06 — M2 Copilot Chat

AI copilot that builds the world through the reducer — bring-your-own-LLM. Verified end-to-end in the browser against a mock OpenAI-compatible server (canned tool calls).

- **Tool surface** (`packages/ui/src/copilotTools.ts`) — COPILOT_TOOLS (11 tools: add/remove/move/resize/rename room, colors, floor style, furniture, set_theme, assign_agent, generate_layout) + pure `applyToolCall(state, call, makeId) → {actions, effects, summary, error}`. Room names resolve via `matchRoomIndex` (fuzzy). `generate_layout` maps roles→presets with capacity splitting (engineer→workspace cap 3, qa/research→lab cap 4, manager→private cap 1, comms→social) + meeting (≥3 people) + lounge (≥5). `describeWorld` feeds the system prompt.
- **BATCH reducer action** — applies N actions as ONE undo step (sub-UNDO/REDO/BATCH ignored; no-op batches leave history untouched). Every AI edit is a single undo.
- **Provider adapters** (`packages/plugins/src/copilot/providers.ts`) — anthropic (Messages API + tool_use blocks), openai-compatible (chat/completions + tool_calls; covers OpenAI/OpenRouter/Groq/vLLM), ollama (local, key-less), codex-auth (ChatGPT-subscription token). Dependency-free fetch. Malformed tool-call JSON args tolerated (empty input).
- **Credentials** (`copilot/credentials.ts`) — ~/.diorama/credentials.json chmod 0600, server-side only; `DIORAMA_HOME` env override for tests; codex-auth re-reads ~/.codex/auth.json `tokens.access_token` per call (CLI refreshes it out-of-band); `credentialsStatus()` is the browser-safe shape (never includes the key).
- **API routes** — `/api/copilot/config` (GET status / POST save-with-key-merge / DELETE), `/api/copilot/chat` (loads creds → provider.chat with COPILOT_TOOLS; 400 not_configured, 502 with provider message), `/api/copilot/test` (minimal ping call).
- **CopilotPanel** (`builder/CopilotPanel.tsx`) — 5th sidebar tab "✦ AI". Client-side agentic loop (max 5 rounds): chat → applyToolCall per call against a *working state* (later calls see earlier results) → one BATCH dispatch → effects (theme/assignment) → toolResults back to the model → repeat until no tool calls. Green ✓ / red ✗ chips per tool call, per-turn Undo link, quick-prompt chips, settings card (provider/key/model/baseUrl + Save & test) shown when unconfigured or via ⚙.
- **Client/server import boundary**: browser code imports only `@diorama/plugins/copilot/providers` (types/labels) and `@diorama/ui/src/copilotTools`; `credentials.ts` (fs) is API-route-only. App tsconfig gained `@diorama/*/*` subpath mappings.
- Tests: 503 passing (17 copilotTools + 9 providers + 6 credentials added).

### 2026-07-06 — M1 CAD Editor

Builder is now CAD-grade. All browser-verified end-to-end.

- **2D ⇄ 3D view toggle** (toolbar + keys 2/3) — 2D is a top-down floor-plan view using the SAME perspective camera positioned overhead with rotation-locked OrbitControls. (First attempt used drei `<OrthographicCamera makeDefault>` + imperative zoom — the makeDefault swap races the camera-setup effect (effect runs against the old camera) and rendering broke; same-camera-different-framing is the robust pattern.)
- **Zoom-to-fit** (F / ⤢ Fit) via a `fitSignal` counter; camera no longer auto-jumps on room edits (CameraSync refits only on fitSignal/mount, reading center/radius through a ref).
- **Inspector panel** (`builder/InspectorPanel.tsx`) — label, numeric X/Y/W/H (grid units), cells/m² line; furniture inspector (X/Z, ↻ 90°, delete). Inputs are draft-buffered `CommitField`s: commit on blur/Enter, Escape reverts — per-keystroke commits moved rooms through transient values ("6"→"62") and spammed undo.
- **Keyboard map**: arrows nudge selection ±1 (Shift ±5), ⌘D duplicate, R rotates selected furniture, D/Del deletes furniture-first-then-room, Esc cancels placement/deselects, 2/3/F views. Fixed the pre-existing stale-closure bug (deps `[]` reading live state) with a keyState ref.
- **Multi-select**: shift-click toggles (`TOGGLE_SELECT_ROOM`), group arrow-nudge moves rigidly (`NUDGE_ROOMS` rejects only non-group collisions), dimmer highlight on secondary selections.
- **Room placement mode**: palette click arms a ghost-follows-pointer mode (red tint on overlap), click places, Esc cancels, double-click = old instant auto-place.
- **Furniture editing**: click-select + drag (custom-furniture rooms only — preset furniture isn't in the store), `useFurnitureDrag` hook, ring highlight.
- **Store** (`@diorama/ui`): `selectedRoomIds`, `selectedFurniture`, actions TOGGLE_SELECT_ROOM / SELECT_ROOMS / NUDGE_ROOMS / DUPLICATE_ROOM / UPDATE_FURNITURE / SELECT_FURNITURE. 20 new tests.
- Dev-only `window.__dioramaBuilder` state probe in BuildStep for automated browser verification.
- Tests: 471 passing.

### 2026-07-06 — M0 Foundation (v3 world-builder plan)

v3 plan lives at `docs/specs/diorama-v3-world-builder.md`. This milestone fixed every bug found by full browser simulation:

- **Seat system root cause** — preset furniture (chairRing/deskRow) has no `label`, so all label-keyword seating checks failed silently: wizard step-3 dropdown was always empty AND LiveView's seat pool was empty (agents piled at room center). New engine module `seating.ts` (`resolveRoomFurniture`, `isSeatingItem` — now also matches glbPath filenames, `buildSeatOptions`, `resolveSeatRef`) is the single source of truth; used by AgentBehaviorStep (new `theme` prop) and LiveView.
- **LiveView seating rewrite** — explicit `seat` refs from config honored first (they were saved but never read), then fuzzy desk-prefix room match, then free chairs, then golden-angle standing ring (no more stacking).
- **Room matching** (`roomMatch.ts`) — `matchRoomIndex` fuzzy matcher (exact → containment). Random-room glow fallback removed: unmatched events don't glow.
- **Demo events remap to real rooms** — `createMockEventStream(count, roomLabels?)` maps mock pipeline rooms onto the user's built rooms.
- **Camera fit** — `fitCameraDistance(radius, fov)` in DioramaScene; both CameraSyncs (live + builder) frame the world by bounding-box radius instead of fixed (+20, +15).
- **Hygiene** — eslint flat config (lint now passes; was broken), `engines: >=20` (Node-22 pin was folklore), favicon (`app/icon.svg`), LICENSE (MIT), GitHub Actions CI (lint/typecheck/test/build on Node 20+22), root tsconfig is now solution-style (`files: []`) with `@diorama/*` subpath mappings, package tsconfigs exclude tests from builds, vitest excludes `*.live.test.ts` unless `DIORAMA_LIVE_TESTS=1`, README truth pass.
- Tests: 451 passing (27 seating/roomMatch + 5 mock-remap added).

### 2026-04-08 — Floor Style Fix (4 bugs)

Fixed floor texture system that broke after 2D view removal:

1. **Floor textures invisible in 3D** — Dark theme colors made patterns unreadable under `meshStandardMaterial` lighting. Added emissive self-illumination (`emissive="#ffffff"`, `emissiveMap`, `emissiveIntensity=0.3`) to textured floor material in `Room3D.tsx`.
2. **Custom room preset default mismatch** — Custom rooms fell back to workspace preset (carpet) instead of solid. Removed stale workspace fallback in `Room3D.tsx`.
3. **Floor style/colors/furniture lost on config save** — `BuilderSidebar.tsx` `configToRooms()` and save effect only copied core fields. Added conditional spread for `colors`, `floorStyle`, `furniture`.
4. **`drawFloorPattern` missing default case** — Invalid floor style silently rendered transparent. Added solid-color default case in `floorTexture.ts`.

Tests added: 15 new tests across `floorTexture.test.ts`, `roomPresets.test.ts`, `builderStore.test.ts`, `config.test.ts`. Total: 372+.

### 2026-04-08 — Click-to-Deselect Rooms

Clicking empty space in the 3D scene now deselects the selected room. Previously `onPointerMissed` on the Canvas never fired because the `DragGroundPlane` mesh intercepted all empty-space clicks.

- Added `onPointerDown` prop to `DragGroundPlane.tsx` that dispatches `SELECT_ROOM` with `null`
- Optimized `builderReducer` SELECT_ROOM to short-circuit when selection unchanged (same state ref)
- 3 new tests in `builderStore.test.ts`. Total: 378+.

### 2026-04-09 — Agent Behavior System

Added pathfinding, energy system, and agent behavior wizard step:

- **Room graph & pathfinding** (`roomGraph.ts`) — Builds connectivity graph from room positions/doors, BFS shortest path, world-space waypoint generation for smooth agent movement between rooms
- **Agent behavior wizard step** (`AgentBehaviorStep.tsx`) — New step 3: seat assignment (dropdown grouped by room), allowed-rooms checkboxes, energy slider (0=calm, 1=restless) per agent
- **Wizard expanded** from 3 to 4 steps: Connect → Build → Configure Agents → Launch
- **Agent state extended** (`agentState.ts`) — Energy field (0–1 float) drives idle animation speed/magnitude via `computeIdlePose()`
- **LiveView enhanced** (`LiveView.tsx`) — Pathfinding-driven movement, energy-based idle animation, room access control
- **Config schema extended** (`config.ts`) — `seat`, `allowedRooms`, `energy` fields added to agent config
- Fixed `catalogItemToFurniture` rug rotation bug: `defaultRotation` now applied regardless of `glbPath`
- Deduplicated `AgentBehavior` interface: `LaunchStep.tsx` imports from `AgentBehaviorStep.tsx`
- Tests: 10 new pathfinding tests in `roomGraph.test.ts`, 6 new agent state tests. Total: 395+.

### 2026-04-09 — Agent Activity Visualization

Agents now show what they're doing, not just where they are. Activity is auto-derived from gateway events — no user mapping needed.

- **Activity state engine** (`activityState.ts`) — Pure-function module: 8 activity types (idle, talking, working, testing, presenting, listening, sending, reviewing). `deriveActivity(eventType, roomPreset)` pattern-matches event type first, falls back to room preset semantics. `formatEventLabel()` generates human-readable feed labels.
- **Activity indicators** (`ActivityIndicator3D.tsx`) — Html overlays above agent heads showing activity icon (speech bubble, microscope, satellite, etc.) with animated dots (talking/working) or CSS pulse (testing/sending), plus agent name label always visible.
- **Activity feed** (`ActivityFeed.tsx`) — Rolling log panel (bottom-left) showing last 15 events with agent color dots, readable labels, and relative timestamps. Auto-scrolls, updates every second.
- **LiveView wiring** — Activity derivation runs on every event regardless of pathfinding success. Activity timeout (8s) returns agents to idle. Random room fallback when event room names don't match config rooms (demo mode compatibility).
- **AgentFigure3D** extended with `activity` prop to render `ActivityIndicator3D`.
- Tests: 27 new activity state tests. Total: 422+.

### 2026-04-09 — Live View Fix (Camera + Auto-Seating)

Fixed the live view (post-wizard `/` page) which was completely broken — camera pointed at origin while rooms rendered elsewhere, agents spawned at wrong coordinates.

- **DioramaScene** (`DioramaScene.tsx`) — Added `center` prop and `CameraSync` component (same pattern as `BuildStep3D.tsx`). Camera dynamically positions at `[centerX, 20, centerZ + 15]` looking at room centroid. Falls back to default position when no center provided.
- **LiveView rewrite** (`LiveView.tsx`) — Calculates `roomsCenter` from config rooms using `toWorld()` (same as wizard). Passes center to DioramaScene. Agents auto-seat in chairs: builds seat pool from room furniture, assigns round-robin, places at chair world positions with `mode: "seated"`. Overflow agents stand near room center.
- **Stripped pathfinding from events** — Agents stay seated. Events trigger activity indicators + room glow + feed entries only. No walking/movement complexity.
- **Removed imports**: `buildRoomGraph`, `findRoomPath`, `generateWaypoints`, `findRoomContaining`, `updateAgentState`.
