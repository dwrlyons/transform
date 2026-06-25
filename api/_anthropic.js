// Shared core used by both the Vercel and Netlify serverless functions.
// The Anthropic API key lives ONLY on the server, never in the browser bundle.
// Files in /api whose name starts with "_" are treated as helpers, not routes.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Only forward the fields the app actually needs. This keeps the proxy from
// becoming an open relay for arbitrary Anthropic requests.
export function sanitize(body) {
  const out = {
    model: typeof body.model === "string" ? body.model : "claude-sonnet-4-6",
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 2000, 256), 4096),
    messages: Array.isArray(body.messages) ? body.messages : [],
  };
  if (typeof body.system === "string") out.system = body.system;
  if (Array.isArray(body.tools)) out.tools = body.tools; // e.g. web_search for research
  if (Array.isArray(body.mcp_servers)) out.mcp_servers = body.mcp_servers; // optional connectors
  return out;
}

export async function callAnthropic(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      status: 500,
      json: { error: "ANTHROPIC_API_KEY is not set on the server. Add it in your hosting provider's environment variables." },
    };
  }

  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: "Anthropic returned a non-JSON response.", raw: text.slice(0, 2000) };
    }
    return { status: res.status, json };
  } catch (e) {
    return { status: 502, json: { error: "Upstream request to Anthropic failed.", detail: String(e) } };
  }
}
