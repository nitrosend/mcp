# Nitrosend Desktop Extension (MCPB)

Use Nitrosend from Claude Desktop as a one-click desktop extension. The bundle
runs a small local launcher that proxies Claude's MCP traffic to the production
Nitrosend server at `https://api.nitrosend.com/mcp` over streamable HTTP, using
the bundled [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) proxy.

Sign-in is browser OAuth (OAuth 2.1 authorization code + PKCE with dynamic
client registration). No API key is required.

## Install

1. Download [nitrosend.mcpb](https://github.com/nitrosend/claude/releases/download/v2.1.5/nitrosend.mcpb) (version 1.0.1) from the first-party release. This source is 1.0.2, not yet released.
2. Double-click it (or drag it onto Claude Desktop). Claude Desktop opens the
   install dialog under Settings → Extensions.
3. Click Install. Node.js (20.18.1 or newer is required; current Claude Desktop
   builds bundle a newer Node) ships inside Claude Desktop, so there is nothing
   else to install.

## Connect

On first use, your browser opens the Nitrosend sign-in page. Sign in and
approve access; the extension completes the OAuth handshake and Claude is
connected. Then ask Claude to run `nitro_get_status` and confirm the returned
account and brand before changing anything.

### Optional: pin to one account with an API key

In the extension's settings, the **API key (optional)** field accepts a
Nitrosend API key (`nskey_...`). When a valid key is set, the extension
authenticates with it directly and skips browser OAuth entirely — useful when
you want the connection pinned to a single account. Claude Desktop stores the
key in your operating system's secret store, and the extension never places it
in command-line arguments or logs. An API-key connection cannot switch
accounts; leave the field empty (the default) to use browser OAuth.

Known behavior: if the configured key is revoked or wrong (but well-formed),
the server rejects it and a browser sign-in window may open — that sign-in
cannot take effect while the key setting remains, because the configured key
keeps overriding it. Fix or clear the API key setting instead of completing
the browser flow.

## What you can do

The live tool catalog exposed by your connected session is authoritative —
Claude sees exactly the tools your account has, including any account-gated
capabilities. Workflow areas include account and brand setup, contact imports
and segmentation, template and campaign composition, automation flows,
transactional sends, deliverability review, and analytics. See the
[Nitrosend docs](https://docs.nitrosend.com) for product behavior.

## Troubleshooting

- **Browser never opens / OAuth stalls:** the sign-in URL is printed in the
  extension logs (Settings → Extensions → Nitrosend → View logs). Open it
  manually, complete sign-in, and the local callback finishes the flow. The
  callback listens on a local port and falls back to a random free port if the
  default is taken.
- **Signed into the wrong Nitrosend account:** disconnect the extension, delete
  the token cache directory (below), sign out of Nitrosend in your browser,
  then reconnect and sign in as the intended login.
- **Token cache:** OAuth tokens are stored on disk under
  `~/.nitrosend/mcpb-auth` (override with the `MCP_REMOTE_CONFIG_DIR`
  environment variable). Deleting that directory signs the extension out.
- **Corporate proxies:** when `HTTPS_PROXY`/`HTTP_PROXY`/`ALL_PROXY` is set in
  the environment Claude Desktop runs in, the extension enables proxy support
  automatically. For TLS-intercepting proxies, point `NODE_EXTRA_CA_CERTS` at
  your CA bundle.
- **Still stuck:** email [contact@nitrosend.com](mailto:contact@nitrosend.com)
  or open an issue at
  [github.com/nitrosend/mcp](https://github.com/nitrosend/mcp/issues).

## Build from source

```bash
cd mcpb
npm ci --omit=dev
npx @anthropic-ai/mcpb validate manifest.json
npx @anthropic-ai/mcpb pack . dist/nitrosend.mcpb
```

Run the test suite with `npm test`.

## Privacy Policy

The full Nitrosend privacy policy is at
[https://nitrosend.com/privacy](https://nitrosend.com/privacy). Specific to
this extension:

**Data collection.** The extension itself collects nothing. It is a local
proxy: the tool calls Claude makes on your behalf — and the data inside them,
such as contact lists you import, campaign content you compose, and account
settings you change — are transmitted directly to Nitrosend's first-party API
(`api.nitrosend.com`) over TLS, along with your OAuth identity or API key for
authentication. No analytics, telemetry, or crash reporting is added by the
extension.

**Data usage and storage.** Data sent to the API is used to provide the
Nitrosend service (sending email, managing contacts, storing templates,
campaigns, and flows) and is stored server-side under the terms of the privacy
policy above. Locally, the extension stores: (a) your API key — only if you
configure one — in the operating system's secret store via Claude Desktop's
sensitive-settings mechanism, and (b) OAuth tokens on disk under
`~/.nitrosend/mcpb-auth` (or `MCP_REMOTE_CONFIG_DIR` if set).

**Third-party sharing.** The extension sends data to no third parties: the
only network destination is Nitrosend's own API. Server-side, Nitrosend uses
infrastructure subprocessors (for example email delivery providers) as
described in the privacy policy; the extension adds none of its own.

**Data retention.** Local OAuth tokens persist until you delete the cache
directory; uninstalling the extension does not remove it — delete
`~/.nitrosend/mcpb-auth` to sign out fully. A configured API key is removed
when you clear the setting or uninstall the extension. Server-side retention
and deletion (including full account deletion) are governed by the privacy
policy; deletion requests go to the contact below.

**Contact.** Privacy questions, data access, and deletion requests:
[contact@nitrosend.com](mailto:contact@nitrosend.com).

## License

MIT — see [LICENSE](./LICENSE).
