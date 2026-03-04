# @nitrosend/mcp

MCP server for [Nitrosend](https://nitrosend.com) — connect any AI agent to your email marketing platform.

Manage contacts, compose emails, build automated flows, and launch campaigns through natural language.

---

## Setup by client

### Claude Code

No API key needed. Claude Code handles sign-in automatically via OAuth.

Add to `.mcp.json`:

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

Or via CLI:

```bash
claude mcp add --transport http nitrosend https://api.nitrosend.com/mcp
```

---

### Cursor

**API key** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nitrosend": {
      "command": "npx",
      "args": ["-y", "@nitrosend/mcp"],
      "env": {
        "NITROSEND_API_KEY": "nskey_live_..."
      }
    }
  }
}
```

**OAuth** — use `mcp-remote` as a proxy:

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

---

### Claude.ai (web + mobile)

Go to **Settings → Connectors → Add custom connector** and enter:

```text
https://api.nitrosend.com/mcp
```

---

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "nitrosend": {
      "command": "npx",
      "args": ["-y", "@nitrosend/mcp"],
      "env": {
        "NITROSEND_API_KEY": "nskey_live_..."
      }
    }
  }
}
```

---

### Zed

Add to Zed settings under `context_servers`:

```json
{
  "context_servers": {
    "nitrosend": {
      "command": {
        "path": "npx",
        "args": ["-y", "@nitrosend/mcp"],
        "env": {
          "NITROSEND_API_KEY": "nskey_live_..."
        }
      }
    }
  }
}
```

---

### Any other MCP client

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
