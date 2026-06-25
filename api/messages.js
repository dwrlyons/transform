// Vercel serverless function: POST /api/messages
// Forwards the request to Anthropic with the server-side API key.
import { callAnthropic, sanitize } from "./_anthropic.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { status, json } = await callAnthropic(sanitize(body || {}));
  res.status(status).json(json);
}
