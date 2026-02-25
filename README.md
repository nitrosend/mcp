# @nitrosend/mcp

MCP server for [Nitrosend](https://nitrosend.com) — connect Claude to your email marketing platform.

Manage contacts, compose emails, build automated flows, and launch campaigns through natural language.

## Install

```bash
claude mcp add nitro -e NITROSEND_API_KEY=nskey_live_... -- npx -y @nitrosend/mcp
```

## Get your API key

1. Log in at [nitrosend.com](https://nitrosend.com)
2. Go to **Settings > API Keys**
3. Copy your live key (starts with `nskey_live_`)

## What you can do

Once connected, Claude can:

- **Read** — query contacts, segments, flows, campaigns, and account status
- **Compose** — create emails with sections, build multi-step flows, set up campaigns
- **Manage** — import contacts, create segments, manage lists and tags
- **Deliver** — preview emails, run spam checks, send tests, approve and schedule campaigns
- **Insights** — view open/click/unsubscribe metrics and trends

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NITROSEND_API_KEY` | Yes | Your API key (`nskey_live_...`) |
| `NITROSEND_API_URL` | No | Override API endpoint (defaults to `https://api.nitrosend.com/mcp`) |

## Requirements

- Node.js 18+

## License

MIT
