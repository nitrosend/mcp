# @nitrosend/mcp

MCP server for [Nitrosend](https://nitrosend.com) — connect any AI agent to your email marketing platform.

Manage contacts, compose emails, build automated flows, and launch campaigns through natural language.

---

## Setup by client

Most clients support OAuth — sign in via your browser, no API keys needed.

### Claude Code

```bash
claude mcp add --transport http nitrosend https://api.nitrosend.com/mcp
```

Or add to `.mcp.json`:

```json
{
  "mcpServers": {
    "nitrosend": {
      "type": "http",
      "url": "https://api.nitrosend.com/mcp"
    }
  }
}
```

OAuth sign-in happens automatically on first use.

---

### Claude Desktop

Go to **Settings → MCP Servers → Add** and select **Streamable HTTP** transport:

```text
https://api.nitrosend.com/mcp
```

---

### Claude.ai (web + mobile)

Go to **Settings → Connectors → Add custom connector** and enter:

```text
https://api.nitrosend.com/mcp
```

---

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nitrosend": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://api.nitrosend.com/mcp"]
    }
  }
}
```

Cursor opens your browser to sign in on first use via `mcp-remote`.

---

### VS Code (Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "nitrosend": {
      "type": "http",
      "url": "https://api.nitrosend.com/mcp"
    }
  }
}
```

VS Code handles OAuth automatically via its built-in MCP auth flow.

---

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "nitrosend": {
      "serverUrl": "https://api.nitrosend.com/mcp"
    }
  }
}
```

Windsurf supports OAuth natively for HTTP servers — sign in via your browser on first use.

---

### Codex CLI

```bash
codex mcp add nitrosend --url https://api.nitrosend.com/mcp
codex mcp login nitrosend
```

Or add to `~/.codex/config.toml`:

```toml
[mcp_servers.nitrosend]
url = "https://api.nitrosend.com/mcp"
```

Then run `codex mcp login nitrosend` to authenticate via OAuth.

---

### Zed

Zed only supports stdio transport — use `mcp-remote` to bridge:

```json
{
  "context_servers": {
    "nitrosend": {
      "command": {
        "path": "npx",
        "args": ["-y", "mcp-remote", "https://api.nitrosend.com/mcp"]
      }
    }
  }
}
```

---

### Any other MCP client

**If your client supports HTTP/SSE transport**, point it at:

```text
https://api.nitrosend.com/mcp
```

**If your client only supports stdio**, use the bridge with an API key:

```json
{
  "command": "npx",
  "args": ["-y", "@nitrosend/mcp"],
  "env": {
    "NITROSEND_API_KEY": "nskey_live_..."
  }
}
```

Get your API key at **nitrosend.com → Settings → API Keys**.

---

## What you can do

Once connected, your agent can:

- **Read** — query contacts, segments, flows, campaigns, and account status
- **Compose** — create emails with sections, build multi-step flows, set up campaigns
- **Manage** — import contacts, create segments, manage lists and tags
- **Deliver** — preview emails, run spam checks, send tests, approve and schedule campaigns
- **Insights** — view open/click/unsubscribe metrics and trends

## Environment variables

| Variable | Description |
| --- | --- |
| `NITROSEND_API_KEY` | API key (`nskey_live_...`) — for stdio transport |
| `NITROSEND_BEARER_TOKEN` | OAuth bearer token — alternative to API key |
| `NITROSEND_API_URL` | Override API endpoint (default: `https://api.nitrosend.com/mcp`) |

## Requirements

- Node.js 18+

## License

MIT
