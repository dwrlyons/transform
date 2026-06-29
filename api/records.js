// Vercel serverless function: /api/records  (GET list, GET ?id=, POST, DELETE ?id=)
import { handleRecords } from "./_store.js";

export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { status, json } = await handleRecords(req.method, req.query || {}, body || {});
  res.status(status).json(json);
}
