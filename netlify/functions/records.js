// Netlify function: mapped from /api/records by netlify.toml.
import { handleRecords } from "../../api/_store.js";

export const handler = async (event) => {
  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    body = {};
  }
  const q = event.queryStringParameters || {};
  const { status, json } = await handleRecords(event.httpMethod, q, body);
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(json),
  };
};
