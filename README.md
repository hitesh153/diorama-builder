# Diorama

**Build 3D worlds for your AI agents.** Design an office in a CAD-style
editor (or ask the AI copilot to design it for you), connect the agent
runtimes you already use, and watch your agents live — walking between
rooms, showing what they're working on.

Works today with **Codex CLI**, **Claude Code**, **OpenClaw gateways**, and
**anything that can send an HTTP request**.

## Quick start (from source)

> Not yet on npm — run from a checkout. Requires Node ≥ 20.

```bash
git clone https://github.com/hitesh153/diorama-builder && cd diorama-builder
npm install
cd packages/app && npx next dev -p 3456
```

Open http://localhost:3456 — with no config you land in the wizard:

1. **Connect** — Diorama scans your machine for agent runtimes (Codex
   sessions, Claude Code projects) and offers one-click connections, an
   OpenClaw gateway form, an HTTP push option, or demo data.
2. **Build Your Office** — CAD-style editor: 2D/3D views, click-to-place
   rooms with ghost preview, drag / 8-handle resize / multi-select /
   keyboard nudge, numeric inspector, furniture catalog, floor styles,
   themes, full undo/redo — plus the **✦ AI copilot** tab
   ([docs](docs/copilot.md)).
3. **Configure Agents** — seat assignment, room access, energy per agent.
4. **Launch** — config saved to `~/.diorama/config.json`; the live world
   starts.

## Connect anything

```bash
curl -X POST http://localhost:3456/api/ingest \
  -H 'content-type: application/json' \
  -d '{"v":1,"type":"task.started","agent":"my-agent","room":"Lab","label":"running tests"}'
```

The agent appears in the world and **walks to the Lab**. Full protocol +
connector guide: [docs/connectors.md](docs/connectors.md).

## The living world

- Agents auto-seat in chairs; events send them walking door-to-door
  (BFS pathfinding over the room graph)
- Activity icons above heads (💬 talking, 🔬 testing, 📡 sending, …) derived
  from event types — no mapping config needed
- Restless agents (energy slider) wander between their allowed rooms
- Rolling activity feed + room glow on events
- **Dashboard view** (toggle top-right): live agent tiles, activity stream,
  per-room event counts

## Room presets & themes

5 presets (meeting, workspace, private, social, lab) × 4 themes (Sci-Fi,
Modern Office, Cyberpunk, Minimal) — furniture and materials morph per
theme. Per-room custom colors and 5 procedural floor textures on top.

## Configuration

Everything lives in `~/.diorama/config.json` (or a project's
`diorama.config.json`):

```json
{
  "name": "My Agent Office",
  "sources": [{ "type": "claude-code" }, { "type": "codex" }, { "type": "ingest" }],
  "gateway": { "url": "", "token": "" },
  "view": "3d-office",
  "theme": "neon-dark",
  "rooms": [
    { "preset": "meeting", "position": [0, 0], "size": [4, 3], "label": "Strategy Room" },
    { "preset": "lab", "position": [4, 0], "size": [4, 4], "label": "Lab" }
  ],
  "agents": {
    "claude/my-app": { "desk": "lab-desk-1", "seat": "Lab::2", "allowedRooms": [], "energy": 0.7 }
  }
}
```

Environment variables (like `$OPENCLAW_TOKEN`) are resolved at runtime.

## Packages

| Package | Purpose |
|---------|---------|
| `@diorama/engine` | Pure core: config schema, event protocol, geometry, room graph + pathfinding, presets, seating, activity derivation |
| `@diorama/plugins` | Connectors (OpenClaw, Codex, Claude Code, JSONL tailer), themes, LLM provider adapters |
| `@diorama/ui` | Builder store (reducer + undo/redo), copilot tool surface |
| `@diorama/cli` | `diorama init` scaffolding + dev server with gateway proxy |
| `@diorama/app` | Next.js app: wizard, CAD editor, live 3D world, dashboard |

## Architecture

```
 Codex sessions ─┐  (jsonl tail)
 Claude Code ────┤                                    ┌─ 3D office view (R3F)
 HTTP pushes ────┼─▶ Event hub ─▶ SSE ─▶ EventBus ─▶ ├─ Dashboard view
 OpenClaw ws ────┘   (server)           (browser)     └─ Activity feed

 Copilot chat ─▶ /api/copilot/chat ─▶ your LLM (key stays server-side)
      │                                    │
      └──── tool calls ──▶ builder reducer ┘   (every AI edit = one undo)
```

Engine stays pure (no React); all rendering lives in `packages/app`; the
config file is the single source of truth.

## Development

```bash
npm test          # full suite (530+ tests; live-gateway tests need DIORAMA_LIVE_TESTS=1)
npm run lint      # eslint
npm run typecheck # tsc project references + app check
```

CI runs lint + typecheck + tests + build on Node 20 and 22.

## License

MIT
