// Records store, backed by Upstash Redis over its REST API.
// Vendor-neutral: works on Vercel, Netlify, or anywhere that can set these
// two environment variables:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// If they are absent, the endpoint reports "not configured" and the browser
// falls back to local storage, so the app still runs.

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const IDX = "ttr:index";
const REC = (id) => `ttr:rec:${id}`;

function configured() {
  return Boolean(URL && TOKEN);
}

async function redis(cmd) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j && j.error) throw new Error(j.error);
  return j ? j.result : null;
}

function metaOf(rec) {
  return {
    id: rec.id,
    createdAt: rec.createdAt,
    company: rec.scope?.company || "",
    industry: rec.scope?.industry || "",
    theme: rec.scope?.theme || "",
    portfolio: rec.portfolio ?? null,
    band: rec.band || null,
    challengeCount: (rec.challenges || []).length,
  };
}

export async function handleRecords(method, query, body) {
  if (!configured()) {
    return { status: 501, json: { error: "Cloud store not configured.", configured: false } };
  }

  try {
    if (method === "GET") {
      if (query && query.id) {
        const raw = await redis(["GET", REC(query.id)]);
        return { status: 200, json: { record: raw ? JSON.parse(raw) : null } };
      }
      const flat = (await redis(["HGETALL", IDX])) || [];
      const records = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        try {
          records.push(JSON.parse(flat[i + 1]));
        } catch {}
      }
      records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return { status: 200, json: { records, source: "cloud" } };
    }

    if (method === "POST") {
      const rec = body || {};
      if (!rec.id) return { status: 400, json: { error: "Missing record id." } };
      await redis(["SET", REC(rec.id), JSON.stringify(rec)]);
      await redis(["HSET", IDX, rec.id, JSON.stringify(metaOf(rec))]);
      return { status: 200, json: { ok: true, id: rec.id } };
    }

    if (method === "DELETE") {
      const id = query && query.id;
      if (!id) return { status: 400, json: { error: "Missing id." } };
      await redis(["DEL", REC(id)]);
      await redis(["HDEL", IDX, id]);
      return { status: 200, json: { ok: true } };
    }

    return { status: 405, json: { error: "Method not allowed" } };
  } catch (e) {
    return { status: 502, json: { error: "Store request failed.", detail: String(e) } };
  }
}
