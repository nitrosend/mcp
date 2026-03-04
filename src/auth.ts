const DEFAULT_API_URL = "https://api.nitrosend.com/mcp";

export interface AuthConfig {
  token: string;
  mode: "api_key" | "bearer";
}

export function getAuthConfig(): AuthConfig {
  const apiKey = process.env.NITROSEND_API_KEY;
  const bearerToken = process.env.NITROSEND_BEARER_TOKEN;

  if (bearerToken) {
    return { token: bearerToken, mode: "bearer" };
  }

  if (apiKey) {
    if (!apiKey.startsWith("nskey_live_")) {
      console.error(
        "Error: Invalid API key format.\n\n" +
          "API keys must start with nskey_live_.\n" +
          "Get your key at: https://nitrosend.com/settings/api-keys"
      );
      process.exit(1);
    }
    return { token: apiKey, mode: "api_key" };
  }

  console.error(
    "Error: No authentication credentials set.\n\n" +
      "Set your API key:\n" +
      "  export NITROSEND_API_KEY=nskey_live_...\n\n" +
      "Or pass it when adding the server:\n" +
      "  npx -y @nitrosend/mcp with NITROSEND_API_KEY=nskey_live_... in your env config\n\n" +
      "Get your key at: https://nitrosend.com/settings/api-keys"
  );
  process.exit(1);
}

export function getApiUrl(): string {
  return process.env.NITROSEND_API_URL || DEFAULT_API_URL;
}
