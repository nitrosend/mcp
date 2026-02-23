const DEFAULT_API_URL = "https://api.nitrosend.com/mcp";

export function getApiKey(): string {
  const key = process.env.NITROSEND_API_KEY;

  if (!key) {
    console.error(
      "Error: NITROSEND_API_KEY is not set.\n\n" +
        "Set your API key:\n" +
        "  export NITROSEND_API_KEY=nskey_live_...\n\n" +
        "Get your key at: https://nitrosend.com/settings/api-keys\n\n" +
        "Or pass it when adding the server:\n" +
        "  claude mcp add nitro -e NITROSEND_API_KEY=nskey_live_... -- npx -y nitrosend-mcp"
    );
    process.exit(1);
  }

  if (!key.startsWith("nskey_live_")) {
    console.error(
      "Error: Invalid API key format.\n\n" +
        "API keys must start with nskey_live_.\n" +
        "Get your key at: https://nitrosend.com/settings/api-keys"
    );
    process.exit(1);
  }

  return key;
}

export function getApiUrl(): string {
  return process.env.NITROSEND_API_URL || DEFAULT_API_URL;
}
