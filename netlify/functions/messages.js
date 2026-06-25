// Netlify function: mapped from /api/messages by netlify.toml redirect.
import { callAnthropic, sanitize } from "../../api/_anthropic.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    body = {};
  }
  const { status, json } = await callAnthropic(sanitize(body));
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(json),
  };
};
