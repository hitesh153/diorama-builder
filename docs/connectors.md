# Connecting your agents

Diorama visualizes agents from **any** system. There are two ways in: use a
built-in connector, or push events over HTTP with the public protocol.

## Built-in connectors

Detected automatically in the wizard's **Connect** step:

| Source | How it works | Agent naming |
|---|---|---|
| **Codex CLI** | Tails `~/.codex/sessions/**/*.jsonl` rollout files | `codex/<project-dir>` |
| **Claude Code** | Tails `~/.claude/projects/<slug>/*.jsonl` transcripts | `claude/<project>` |
| **OpenClaw gateway** | WebSocket connection (Ed25519 auth handled server-side) | gateway-reported ids |
| **Push events** | The HTTP protocol below | whatever you send |

Multiple sources can run simultaneously — agents from every source share the
same world.

## The push protocol (works with anything)

POST one event, or an array of up to 500:

```bash
curl -X POST http://localhost:3456/api/ingest \
  -H 'content-type: application/json' \
  -d '{"v":1,"type":"task.started","agent":"my-agent","room":"Lab","label":"running tests"}'
```

| Field | Required | Meaning |
|---|---|---|
| `v` | ✓ | Protocol version — always `1` |
| `type` | ✓ | Event type, e.g. `task.started`, `message.sent`, `test.passed` |
| `agent` | ✓ | Agent id — unknown agents appear in the world automatically |
| `room` | | Target room label (fuzzy-matched; the agent **walks there**) |
| `label` | | Feed text override |
| `ts` | | Unix millis (defaults to arrival time) |
| `payload` | | Anything else |

Python:

```python
import requests
requests.post("http://localhost:3456/api/ingest", json={
    "v": 1, "type": "review.started", "agent": "review-bot",
    "room": "Meeting Room", "label": "reviewing PR #42",
})
```

TypeScript:

```ts
await fetch("http://localhost:3456/api/ingest", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ v: 1, type: "task.completed", agent: "worker-1" }),
});
```

### How events drive the world

- `room` → the agent walks there (door-to-door pathfinding), the room glows
- `type` + room preset → an activity icon above the agent's head
  (`test.*` → 🔬, `message.*`/`*.sent` → 📡, `review.*` → 🔍, …)
- `attention.requested` → the agent shows a pulsing amber "✋ needs you"
  badge (and can fire a browser notification) until `attention.resolved`
  — or any later event from the same agent — clears it; the built-in
  Codex/Claude Code connectors emit these automatically when a session is
  blocked on a permission prompt or question
- everything lands in the activity feed and the dashboard

## Writing a connector

A connector is anything that turns your system's activity into protocol
events. The built-in session-file connectors share one primitive you can
reuse — `tailJsonlDirectory` from `@diorama/plugins/sources/jsonlTail`:

```ts
import { tailJsonlDirectory } from "@diorama/plugins/sources/jsonlTail";

tailJsonlDirectory({
  dir: "/var/log/my-agents",
  onRecord: (record, filePath) => {
    const event = mapMyRecord(record); // your mapping → {v:1, type, agent, ...}
    if (event) fetch("http://localhost:3456/api/ingest", { method: "POST", body: JSON.stringify(event), headers: { "content-type": "application/json" } });
  },
});
```

Or skip all of that and emit HTTP calls straight from your agent framework's
hook/callback system — the protocol is the contract, not the transport
around it.
