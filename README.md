# @nitrosend/mcp

Optional stdio bridge for [Nitrosend](https://nitrosend.com). Most clients should connect directly to Nitrosend's remote MCP server at `https://api.nitrosend.com/mcp`; this package exists for stdio-only clients and local development.

All plans, including free plans, have full access to Nitrosend MCP/API/CLI. Plan limits still apply to send volume, seats, AI action allowances, and paid add-ons.

For Claude Desktop, Claude.ai, and Claude Cowork, use the remote MCP connector
UI. Do not install `@nitrosend/cli` or this stdio bridge for the standard
Claude connector setup.

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

Go to **Settings → Connections → Add Custom Connector** and enter:

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
      "url": "https://api.nitrosend.com/mcp"
    }
  }
}
```

Cursor handles Nitrosend as a direct remote MCP server. On first use, it prompts for OAuth sign-in.

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

Add to your Zed settings:

```json
{
  "context_servers": {
    "nitrosend": {
      "url": "https://api.nitrosend.com/mcp"
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

**If your client only supports stdio**, use this bridge package with an API key:

```json
{
  "command": "npx",
  "args": ["-y", "@nitrosend/mcp"],
  "env": {
    "NITROSEND_API_KEY": "nskey_live_..."
  }
}
```

Get your API key at **[Settings → API Keys](https://app.nitrosend.com/my/settings/api-keys)** in the Nitrosend dashboard.

---

## What you can do

Once connected, your agent can:

- **Read** — query contacts, segments, flows, campaigns, and account status
- **Compose** — create emails with sections, build multi-step flows, set up campaigns
- **Manage** — import contacts, create segments, manage lists and tags
- **Deliver** — preview emails, run spam checks, send tests, approve and schedule campaigns
- **Insights** — view open/click/unsubscribe metrics and trends

## Account and client-account context

For OAuth connections, Nitrosend stores both the current account and the current client account per user and OAuth application. Ask your agent to call `nitro_get_status` first: it shows `current_account` and `available_accounts` alongside `current_client_account` and `available_client_accounts`.

If the task is for a different account than the one shown, call `nitro_select_account` with the target `account_id`. The switch takes effect on the next tool call. Then call `nitro_select_client_account` to pick a client account within that account. The selected account persists across the session and across token refreshes until you switch again.

`nitro_select_account` and `nitro_select_client_account` only change the active MCP context. `nitro_set_brand_kit` edits the Brand Kit for the current client account, such as colors, logo, sender details, and voice.

API key connections are pinned to the API key's account and client account and cannot switch with `nitro_select_account` or `nitro_select_client_account`. For stdio bridge deployments that must force a single client account, set `NITROSEND_CLIENT_ACCOUNT_SID`; the bridge will send `X-Client-Account-SID` only when that variable is present.

## Environment variables

| Variable | Description |
| --- | --- |
| `NITROSEND_API_KEY` | API key (`nskey_live_...`) — for stdio transport |
| `NITROSEND_BEARER_TOKEN` | OAuth bearer token — alternative to API key |
| `NITROSEND_CLIENT_ACCOUNT_SID` | Optional fixed-client-account override for the stdio bridge. Sends `X-Client-Account-SID` only when set. |
| `NITROSEND_API_URL` | Override API endpoint (default: `https://api.nitrosend.com/mcp`) |

## Requirements

- Node.js 18+

## License

MIT
