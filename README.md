# Nitrosend MCP Server: email marketing for AI agents

[Nitrosend](https://nitrosend.com) is an email marketing platform built for AI agents. Connect it to Claude, ChatGPT, Cursor, Codex, VS Code, Windsurf or any MCP client, and your agent writes and sends newsletters, email campaigns, automated email flows and transactional emails, manages your contacts and mailing lists, and reports what worked.

- **Remote MCP server:** `https://api.nitrosend.com/mcp` (Streamable HTTP, OAuth 2.1 sign-in, no API key needed)
- **Free plan** with full MCP, API and CLI access. See [pricing](https://nitrosend.com/pricing).
- **Official listings:** [Claude directory](https://claude.ai/directory/nitrosend), [Cursor Marketplace](https://cursor.com/marketplace/nitrosend), ChatGPT and Codex apps, [Shopify App Store](https://apps.shopify.com/nitrosend), the [Official MCP Registry](https://registry.modelcontextprotocol.io) (`com.nitrosend/nitrosend`)

This repository also ships `@nitrosend/mcp`, an optional stdio bridge for clients that cannot connect to a remote server, and a one-click [Claude Desktop extension](./mcpb/).

## What your agent can do

- **Newsletters and email campaigns:** draft on-brand emails from your Brand Kit, target a list or segment, send a test, then approve and send or schedule. Product launches, promotions, Black Friday sales, weekly newsletters.
- **Email automation:** build automated flows from triggers, waits and yes/no splits: welcome series, onboarding emails, abandoned cart and browse abandonment, post-purchase, review requests, win-back and re-engagement, drip and nurture sequences.
- **Transactional email:** send receipts, order confirmations, shipping updates, password resets, magic links and OTP codes, one recipient at a time, with idempotent retries. Use the same templates from the REST API and Node SDK.
- **Contacts and audience:** import contacts from CSV or inline records, manage subscribers, mailing lists, tags and segments, and keep opt-in and unsubscribe status in order.
- **Email templates and design:** reusable branded templates, sections, images and a Brand Kit (logo, colours, fonts, sender details, voice).
- **Deliverability:** verify sending domains (SPF, DKIM, DMARC), set up senders, run spam and readiness checks before anything goes out.
- **Analytics:** open rate, click rate, unsubscribes and bounces for each campaign and flow, with trends against your own baseline.

Every send needs an explicit approval step, and read-only tools are annotated as read-only.

## Example prompts

- "Write this week's newsletter from our last three blog posts and send it to the Subscribers list on Thursday at 9am."
- "Build a welcome series: a welcome email now, a getting-started email after a day, a customer story after three days."
- "Set up an abandoned cart flow for our Shopify store with a reminder after one hour and a 10% offer after a day."
- "Send a password reset email to this user with our transactional template."
- "Import this CSV of subscribers, tag them `webinar-2026`, and make a segment of everyone who clicked in the last 30 days."
- "How did last month's email campaigns perform? Which subject lines had the best open rate?"

## Switching from Mailchimp, Klaviyo, beehiiv, Kit, Brevo, MailerLite or Substack

Your agent can move your mailing list and opt-outs over from Mailchimp, Klaviyo, beehiiv, Kit (ConvertKit), Brevo, MailerLite or Substack. Unsubscribes and suppressions go in first, then contacts, lists and tags. Your agent then rebuilds your automations as Nitrosend flows.

## Integrations

- **Shopify:** customers, orders, checkouts and abandoned carts feed flows and segments.
- **Stripe:** purchases, failed payments, subscriptions and trials become events that trigger flows.
- **HubSpot and Attio:** sync your CRM contacts into Nitrosend.
- **Bring your own sender:** send through Nitrosend, or through your own SendGrid, Amazon SES, Postmark, Resend or Mailgun account.
- **REST API, Node SDK, CLI and Events API:** send transactional email and custom events from your own app.

## Tools

The live tool list from your session is authoritative; some tools only appear when your account has the feature.

| Tool | What it does |
| --- | --- |
| `nitro_get_status` | Account, brand, plan and sending readiness |
| `nitro_query` | Read contacts, lists, segments, campaigns, flows, templates and messages |
| `nitro_search_contacts` | Find contacts by email, name, tag or field |
| `nitro_compose_campaign` | Create and edit email campaigns and newsletters |
| `nitro_compose_flow` | Build automated email flows and sequences |
| `nitro_manage_template` | Create and edit reusable email templates |
| `nitro_review_delivery` | Readiness, spam and content checks before sending |
| `nitro_send_test_message` | Send a test email to yourself |
| `nitro_control_delivery` | Approve, send, schedule, pause or resume campaigns and flows |
| `nitro_send_message` | Send one transactional email |
| `nitro_import_contacts` | Import contacts from CSV or inline records |
| `nitro_manage_audience` | Contacts, mailing lists, tags and bulk changes |
| `nitro_define_segment` | Create segments from filters |
| `nitro_get_insights` | Campaign and flow analytics |
| `nitro_manage_domains` | Add and verify sending domains |
| `nitro_set_brand_kit` | Logo, colours, fonts, sender details and voice |
| `nitro_ingest` | Bring in images and files |
| `nitro_configure_account` / `nitro_configure_providers` | Account settings and connected providers |
| `nitro_get_memory` / `nitro_set_memory` | Notes your agent keeps about your business |
| `nitro_select_account` / `nitro_select_brand` | Switch account or brand |
| `nitro_search_docs` / `nitro_request_support` | Search the docs or reach Nitrosend support |
| `nitro_manage_billing` | Plan and billing details |

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

### Claude Desktop, Claude.ai and Cowork

Nitrosend is an official connector in the Claude directory. Go to **Settings → Connectors**, search for **Nitrosend** and click **Connect**, or open <https://claude.ai/directory/nitrosend>. Sign in when prompted; no URL to paste and no API key.

If your Claude organisation restricts directory connectors, ask an organisation owner to enable Nitrosend or to add it as a custom connector with:

```text
https://api.nitrosend.com/mcp
```

Prefer a one-click desktop extension? [`mcpb/`](./mcpb/) packages the same remote server as a Claude Desktop extension (`.mcpb`) with browser OAuth. See [mcpb/README.md](./mcpb/README.md) to install or build it.

---

### Cursor

Nitrosend is an official plugin on the [Cursor Marketplace](https://cursor.com/marketplace/nitrosend). In Cursor's Agent chat, run:

```
/add-plugin nitrosend
```

Or click **Add to Cursor** on the Marketplace listing. The first Nitrosend tool call opens the OAuth sign-in; no API key, no config file.

Prefer to manage the server yourself? Add to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (this repo):

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

## Images in templates and campaigns

MCP should orchestrate image media rather than carry large bytes. Small chat-attached images can use `nitro_ingest` with `kind=image` and `image_data`; public images can use `image_url` when Nitro-hosted permanence is desired; larger local files should call `nitro_ingest(upload: {kind: "image", filename, content_type, byte_size, checksum})`, PUT bytes to `direct_upload.url`, then pass the returned `signed_id` to `nitro_ingest`.

## Account and brand context

For OAuth connections, Nitrosend stores both the current account and the current brand per user and OAuth application. Ask your agent to call `nitro_get_status` first: it shows `current_account` and `available_accounts` alongside `current_brand` and `available_brands`.

If the task is for a different account than the one shown, call `nitro_select_account` with the target `account_id`. The switch takes effect on the next tool call. Then call `nitro_select_brand` to pick a brand within that account. The selected brand persists for this authenticated client across requests, reconnects, and token refreshes until you switch again.

`nitro_select_account` and `nitro_select_brand` only change the active MCP context. `nitro_set_brand_kit` edits the Brand Kit for the current brand, such as colors, logo, sender details, and voice.

API key connections are pinned to the API key's account and brand and cannot switch with `nitro_select_account` or `nitro_select_brand`. For stdio bridge deployments that must force a single brand, set `NITROSEND_BRAND_SID`; the bridge will send `X-Brand-SID` only when that variable is present.

## Environment variables

| Variable | Description |
| --- | --- |
| `NITROSEND_API_KEY` | API key (`nskey_live_...`) — for stdio transport |
| `NITROSEND_BEARER_TOKEN` | OAuth bearer token — alternative to API key |
| `NITROSEND_BRAND_SID` | Optional fixed-brand override for the stdio bridge. Sends `X-Brand-SID` only when set. |
| `NITROSEND_API_URL` | Override API endpoint (default: `https://api.nitrosend.com/mcp`) |

## Requirements

- Node.js 18+

## License

MIT
