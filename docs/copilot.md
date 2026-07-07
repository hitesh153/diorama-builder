# The AI copilot

The **✦ AI** tab in the builder is a copilot that edits your world from
plain English: "add a lab next to the meeting room", "make it cyberpunk",
"design an office for 5 engineers and 2 QA".

Every copilot edit goes through the same reducer as manual edits — each
reply is **one undo step**, previewed as ✓/✗ chips.

## Bring your own LLM

Configured in the panel's settings card (⚙). Keys are stored in
`~/.diorama/credentials.json` (chmod 600) and **never sent to the browser**
— the dev server proxies all model calls.

| Provider | What you need | Default model |
|---|---|---|
| **Claude Code CLI** ⭐ | the `claude` CLI you already log into — **no key** | your CLI default |
| **Codex CLI** ⭐ | the `codex` CLI (ChatGPT login) — **no key** | your CLI default |
| **Anthropic API key** | an API key (`sk-ant-…`) | `claude-sonnet-5` |
| **OpenAI-compatible** | key + optional base URL — works with OpenAI, OpenRouter, Groq, LM Studio, vLLM… | `gpt-5` |
| **Ollama (local)** | a running `ollama serve` — no key | `llama3.1` |

⭐ The CLI providers are detected automatically (✓ in the dropdown) and are
the zero-setup path: Diorama spawns your local binary in non-interactive
mode (`claude -p` / `codex exec`), so auth and billing are whatever your
existing login has. Replies take a little longer than a direct API call.

"Save & test" makes a one-token ping to verify the connection.

## What it can do

The copilot has 11 tools: add/remove/move/resize/rename rooms, set colors
and floor styles, add furniture, switch themes, assign agents, and
`generate_layout` — which turns a team brief ("3 engineers, 1 QA, a
manager") into a full room program:

- engineers → workspaces (3 per room)
- qa / research → labs (4 per room)
- managers / leads → private offices
- comms / support → social spaces
- +meeting room at 3+ people, +lounge at 5+

It sees your current world (rooms, positions, theme, agents) on every turn,
so follow-ups like "move it left a bit" work.
