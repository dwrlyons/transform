import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ArrowRight, ArrowLeft, Plus, Download, Library as LibraryIcon, Clock,
  Building2, Globe, Factory, Layers, BarChart3, Maximize2, Trash2,
  AlertTriangle, RefreshCw, GraduationCap, ShoppingCart, Cpu, Cloud, CloudOff,
} from "lucide-react";

/* ============================ brand + constants ============================ */
const C = {
  corange: "#FA4616",
  charcoal: "#1A202C",
  teal: "#03859B",
  paper: "#F6F4F0",
  card: "#FFFFFF",
  line: "#E6E2DA",
  ink: "#1A202C",
  sub: "#69727E",
  strong: "#03859B",
  developing: "#C2740A",
  exposed: "#FA4616",
  build: "#03859B",
  buy: "#FA4616",
  borrow: "#5A6B7B",
  bot: "#1A202C",
};
const fDisplay = { fontFamily: "'Space Grotesk', system-ui, sans-serif" };
const fBody = { fontFamily: "'Inter', system-ui, sans-serif" };
const fMono = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace" };

const THEMES = [
  "AI and automation",
  "Digital and data",
  "Sustainability and decarbonisation",
  "Regulatory and compliance",
  "Operating model and organisation design",
  "Growth, M&A and market expansion",
  "Cost, productivity and efficiency",
  "Customer and commercial model",
  "Technology and core systems modernisation",
  "Supply chain and resilience",
  "Workforce and talent model",
];

const ROUTE_META = {
  Build: { color: C.build, icon: GraduationCap, blurb: "Upskill or reskill" },
  Buy: { color: C.buy, icon: ShoppingCart, blurb: "Hire externally" },
  Borrow: { color: C.borrow, icon: Clock, blurb: "Contract or partner" },
  Bot: { color: C.bot, icon: Cpu, blurb: "Automate or augment" },
};

/* ============================ helpers ============================ */
const round1 = (n) => Math.round(n * 10) / 10;
const clampScore = (n) => Math.max(1, Math.min(5, Math.round(Number(n) || 1)));
const bandFor = (s) => (s >= 4 ? "Strong" : s >= 2.5 ? "Developing" : "Exposed");
const bandColor = (b) => (b === "Strong" ? C.strong : b === "Developing" ? C.developing : C.exposed);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const routeColor = (r) => (ROUTE_META[r] || ROUTE_META.Build).color;

function extractJson(text) {
  let t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("The model did not return readable data.");
  return JSON.parse(t.slice(s, e + 1));
}

/* ============================ cloud records client ============================ */
const LS_KEY = "ttr_records_v1";
function lsAll() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function lsWrite(arr) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {}
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

async function storeSave(rec) {
  try {
    const r = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rec),
    });
    if (!r.ok) throw new Error("save");
    // mirror locally too, so the same browser shows it instantly
    const arr = lsAll().filter((x) => x.id !== rec.id);
    arr.unshift(rec);
    lsWrite(arr);
    return "cloud";
  } catch {
    const arr = lsAll().filter((x) => x.id !== rec.id);
    arr.unshift(rec);
    lsWrite(arr);
    return "local";
  }
}
async function storeList() {
  try {
    const r = await fetch("/api/records");
    if (!r.ok) throw new Error("list");
    const d = await r.json();
    return { source: "cloud", records: d.records || [] };
  } catch {
    return { source: "local", records: lsAll().map(metaOf) };
  }
}
async function storeGet(id) {
  try {
    const r = await fetch("/api/records?id=" + encodeURIComponent(id));
    if (!r.ok) throw new Error("get");
    const d = await r.json();
    if (d.record) return d.record;
    throw new Error("empty");
  } catch {
    return lsAll().find((x) => x.id === id) || null;
  }
}
async function storeDelete(id) {
  try {
    await fetch("/api/records?id=" + encodeURIComponent(id), { method: "DELETE" });
  } catch {}
  lsWrite(lsAll().filter((x) => x.id !== id));
}

/* ============================ Claude calls ============================ */
async function callClaude({ system, user, useSearch }) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data && data.error;
    const msg = (m && (m.message || m)) || `Request failed (status ${res.status}).`;
    throw new Error(typeof msg === "string" ? msg : "The analysis request failed. Try running it again.");
  }
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function overviewSystem() {
  return "You are a workforce strategy and business transformation analyst with deep understanding of how people processes enable or block enterprise change. You reason from publicly available strategic signals and observable labour market dynamics. You never invent figures. Return only valid JSON with no markdown fences and no preamble. Use British spelling. Do not use em dashes.";
}
function overviewUser({ industry, company, geography, theme, n, horizon }) {
  const focus =
    theme === "All themes"
      ? "Tag each challenge with its primary theme from the list below, and a secondary theme only where it genuinely spans two."
      : `Surface only challenges that sit within the theme "${theme}".`;
  return `Scope:
- Industry: ${industry || "not specified"}
- Company: ${company || "industry-wide"}
- Geography: ${geography || "global"}
- Theme focus: ${theme === "All themes" ? "all themes" : theme}

Where a company is named, research its actual public strategy, recent announcements and stated leadership priorities. Identify the ${n} most material business transformation challenges over the next ${horizon}. A transformation challenge is a structural shift the organisation must make to stay competitive, compliant or viable, not a routine operational issue. ${focus}

Themes (use these labels exactly): ${THEMES.join("; ")}.

Return ONLY this JSON:
{"executiveSummary":"2 to 3 sentences on the transformation pressure facing this scope","challenges":[{"title":"short challenge name","theme":"one theme label","secondaryTheme":"another label or empty string","summary":"1 to 2 sentences on what must change and why"}]}
Provide exactly ${n} challenges.`;
}
function detailSystem() {
  return "You are a workforce strategy and business transformation analyst. For a given transformation challenge you map it to people processes, the skills the workforce needs, talent readiness signals, and a Build/Buy/Borrow/Bot route per capability. You reason from observable labour market dynamics and never invent figures. Return only valid JSON, no markdown, no preamble. Use British spelling. No em dashes. Keep every field a short phrase, roughly 6 to 14 words, never a paragraph.";
}
function detailUser({ industry, company, geography, horizon }, stub) {
  return `Scope: Industry ${industry || "n/a"}; Company ${company || "industry-wide"}; Geography ${geography || "global"}; horizon ${horizon}.

Transformation challenge: "${stub.title}".
Context: ${stub.summary}

Build/Buy/Borrow/Bot logic:
- Build: skill adjacent to current capability, core and strategic to own long term, retention matters, time allows.
- Buy: net-new with no internal adjacency, speed to permanent capability, must sit at the core, market can supply.
- Borrow: temporary or uncertain need, niche or scarce skill, flexibility over ownership.
- Bot: repeatable rules-based or high-volume task, scale and consistency beat judgement, process stable.

Capability readiness, 1 to 5: 5 ready; 4 largely ready; 3 addressable; 2 exposed; 1 critical gap. Score on the binding constraint.

Return ONLY this JSON:
{"duration":"how long this has been live, anchored to a signal","costOfInaction":{"commercial":"","operational":"","competitive":"","regulatory":"","talent":""},"peopleProcesses":[{"process":"Learning|Performance|Succession|Internal mobility|Compensation|Recruitment","role":"what it must deliver"}],"skills":{"technical":["specific skill"],"behavioural":["specific skill"]},"capabilities":[{"name":"capability or skill cluster","internalSupply":"","adjacency":"","externalScarcity":"","buildTime":"","halfLife":"","readiness":3,"justification":"one line tied to the signals","route":"Build|Buy|Borrow|Bot","trigger":"plain trigger condition","watchOut":"main risk"}]}
Include only the people processes that are genuinely material. Include 3 to 4 capabilities, prioritising the most critical. readiness must be an integer 1 to 5.`;
}

/* ============================ small UI primitives ============================ */
function Spinner({ size = 16, color = C.corange }) {
  return (
    <span
      className="inline-block rounded-full animate-spin"
      style={{ width: size, height: size, border: `2px solid ${color}33`, borderTopColor: color }}
    />
  );
}
function BandPill({ band, dark }) {
  if (!band) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: bandColor(band), color: "#fff", ...fBody }}
    >
      {band}
    </span>
  );
}
function ThemeTag({ label, secondary }) {
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color: secondary ? C.sub : C.teal,
        border: `1px solid ${secondary ? C.line : "#9FD3DD"}`,
        background: secondary ? "transparent" : "#F0FAFB",
        ...fBody,
      }}
    >
      {label}
    </span>
  );
}
function RouteBadge({ route, size = "md" }) {
  const m = ROUTE_META[route] || ROUTE_META.Build;
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md font-semibold"
      style={{
        background: m.color,
        color: "#fff",
        ...fBody,
        fontSize: size === "sm" ? 11 : 12,
        padding: size === "sm" ? "2px 7px" : "4px 9px",
      }}
    >
      <Icon size={size === "sm" ? 12 : 13} strokeWidth={2.4} />
      {route}
    </span>
  );
}
function Meter({ score, h = 10, showNum = true }) {
  if (score == null) score = 0;
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  const col = bandColor(bandFor(score));
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="relative flex-1 rounded-full overflow-hidden" style={{ height: h, background: "#ECE8E0" }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: col, transition: "width .6s" }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="absolute inset-y-0" style={{ left: `${i * 20}%`, width: 1, background: "#F6F4F0" }} />
        ))}
      </div>
      {showNum && score > 0 && (
        <span style={{ ...fMono, color: col }} className="text-sm font-medium tabular-nums">
          {round1(score)}
          <span style={{ color: C.sub }}>/5</span>
        </span>
      )}
    </div>
  );
}
function Field({ label, icon: Icon, children, hint }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 mb-1.5 text-sm font-medium" style={{ ...fBody, color: C.ink }}>
        <Icon size={14} style={{ color: C.sub }} /> {label}
      </span>
      {children}
      {hint && (
        <span className="block mt-1 text-xs" style={{ color: C.sub, ...fBody }}>
          {hint}
        </span>
      )}
    </label>
  );
}

/* ============================ intake ============================ */
function Intake({ initial, onRun, onLibrary, error, cloud }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => {
    const v = e.target.value;
    setF((p) => ({ ...p, [k]: v }));
  };
  const canRun = (f.company || f.industry).trim().length > 0;
  const inputStyle = { ...fBody, border: `1px solid ${C.line}`, background: "#fff", color: C.ink };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-5" style={{ background: C.paper }}>
      <div className="w-full" style={{ maxWidth: 560 }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div style={{ width: 22, height: 22, background: C.corange, borderRadius: 5 }} />
            <span style={{ ...fBody, color: C.sub }} className="text-sm font-semibold tracking-wide">
              CORNERSTONE
            </span>
          </div>
          <button
            onClick={onLibrary}
            className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5"
            style={{ ...fBody, color: C.ink, border: `1px solid ${C.line}`, background: "#fff" }}
          >
            <LibraryIcon size={15} /> Library
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.card }}>
          <div style={{ background: C.charcoal }} className="px-7 pt-7 pb-6">
            <div style={{ height: 3, width: 44, background: C.corange }} className="rounded-full mb-4" />
            <h1 style={{ ...fDisplay, color: "#fff", lineHeight: 1.1 }} className="text-2xl font-bold">
              Transformation & Talent Readiness
            </h1>
            <p style={{ ...fBody, color: "#AEB4BD" }} className="mt-2 text-sm">
              Name who you are looking at. We research the transformation pressures, map them to people
              processes and a Build, Buy, Borrow or Bot route, then present the findings as a deck.
            </p>
          </div>

          <div className="px-7 py-6 grid gap-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm" style={{ background: "#FEF1ED", color: "#9A2B12", ...fBody }}>
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Field label="Customer name" icon={Building2}>
              <input value={f.company} onChange={set("company")} placeholder="e.g. Scania" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2" style={inputStyle} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Industry" icon={Factory}>
                <input value={f.industry} onChange={set("industry")} placeholder="e.g. Retail" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2" style={inputStyle} />
              </Field>
              <Field label="Geography" icon={Globe}>
                <input value={f.geography} onChange={set("geography")} placeholder="e.g. Europe" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2" style={inputStyle} />
              </Field>
            </div>
            <Field label="Transformation theme" icon={Layers} hint="Focus on one theme, or leave on all themes.">
              <select value={f.theme} onChange={set("theme")} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2" style={inputStyle}>
                <option>All themes</option>
                {THEMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-5">
              <Field label="Challenges" icon={BarChart3}>
                <select value={f.n} onChange={set("n")} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2" style={inputStyle}>
                  {[3, 4, 5, 6].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Time horizon" icon={Clock}>
                <select value={f.horizon} onChange={set("horizon")} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2" style={inputStyle}>
                  {["2 years", "3 years", "5 years"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              onClick={() => canRun && onRun(f)}
              disabled={!canRun}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold"
              style={{ ...fBody, background: canRun ? C.corange : "#F0CFC4", color: "#fff", cursor: canRun ? "pointer" : "not-allowed" }}
            >
              Run analysis <ArrowRight size={16} />
            </button>
            <div className="flex items-center justify-center gap-1.5 text-xs" style={{ color: C.sub, ...fBody }}>
              {cloud === "cloud" ? (
                <><Cloud size={13} /> Cloud sync on. Records available from any browser.</>
              ) : cloud === "local" ? (
                <><CloudOff size={13} /> Cloud not configured. Records saved to this browser only.</>
              ) : (
                <>Enter at least a customer name or an industry to begin.</>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ loading ============================ */
function Loading({ label }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-5 p-6" style={{ background: C.paper }}>
      <Spinner size={34} />
      <div className="text-center">
        <p style={{ ...fDisplay, color: C.ink }} className="text-lg font-semibold">{label}</p>
        <p style={{ ...fBody, color: C.sub }} className="text-sm mt-1">Researching strategy signals and labour market dynamics.</p>
      </div>
    </div>
  );
}

/* ============================ slide model ============================ */
function buildSlides(scope, execSummary, challenges, portfolio) {
  const slides = [];
  const meta = [scope.industry, scope.geography, scope.theme !== "All themes" ? scope.theme : null, scope.horizon + " horizon"]
    .filter(Boolean)
    .join("  ·  ");
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  slides.push({ type: "cover", company: scope.company || scope.industry, meta, date });
  slides.push({ type: "summary", company: scope.company || scope.industry, execSummary, portfolio });

  const ranked = challenges
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => (a.score ?? 9) - (b.score ?? 9));
  slides.push({
    type: "portfolio",
    rows: ranked.map((c) => ({
      title: c.title,
      theme: c.theme,
      score: c.score,
      band: c.band,
      status: c.status,
      topRoute:
        c.detail?.capabilities?.length
          ? c.detail.capabilities.reduce((a, b) => (clampScore(a.readiness) <= clampScore(b.readiness) ? a : b)).route
          : null,
    })),
  });

  challenges.forEach((c, i) => {
    if (c.status === "done" && c.detail) {
      const coi = c.detail.costOfInaction || {};
      slides.push({
        type: "challenge",
        index: i,
        total: challenges.length,
        title: c.title,
        theme: c.theme,
        secondaryTheme: c.secondaryTheme,
        score: c.score,
        band: c.band,
        summary: c.summary,
        duration: c.detail.duration,
        coi: [
          ["Commercial", coi.commercial],
          ["Operational", coi.operational],
          ["Competitive", coi.competitive],
          ["Regulatory", coi.regulatory],
          ["Talent", coi.talent],
        ].filter(([, v]) => v),
        people: c.detail.peopleProcesses || [],
      });
      slides.push({
        type: "sourcing",
        index: i,
        total: challenges.length,
        title: c.title,
        skills: c.detail.skills || {},
        capabilities: (c.detail.capabilities || []).map((x) => ({ ...x, readiness: clampScore(x.readiness) })),
      });
    } else {
      slides.push({ type: "pending", index: i, total: challenges.length, title: c.title, status: c.status });
    }
  });

  return slides;
}

/* ============================ slide chrome ============================ */
function SlideShell({ eyebrow, title, children, footerRight }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff", padding: "56px 64px 48px" }}>
      <div style={{ ...fMono, color: C.corange, fontSize: 15, fontWeight: 600, letterSpacing: 1 }}>{eyebrow}</div>
      <div style={{ ...fDisplay, color: C.ink, fontSize: 38, fontWeight: 700, lineHeight: 1.08, marginTop: 4 }}>{title}</div>
      <div style={{ height: 3, width: 56, background: C.corange, borderRadius: 2, margin: "16px 0 24px" }} />
      <div style={{ position: "absolute", left: 64, right: 64, top: 168, bottom: 56 }}>{children}</div>
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 26, display: "flex", justifyContent: "space-between", ...fBody, color: "#9098A1", fontSize: 12, letterSpacing: 0.4 }}>
        <span>CORNERSTONE · CONFIDENTIAL</span>
        <span>{footerRight}</span>
      </div>
    </div>
  );
}

function SlideCover({ s }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.charcoal }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 7, background: C.corange }} />
      <div style={{ position: "absolute", left: 72, top: 64, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 16, height: 16, background: C.corange }} />
        <span style={{ ...fBody, color: "#fff", fontWeight: 700, letterSpacing: 3, fontSize: 15 }}>CORNERSTONE</span>
      </div>
      <div style={{ position: "absolute", left: 72, top: 250 }}>
        <div style={{ ...fBody, color: C.corange, fontWeight: 700, letterSpacing: 3, fontSize: 15 }}>TRANSFORMATION & TALENT READINESS</div>
        <div style={{ ...fBody, color: "#7E868F", letterSpacing: 2, fontSize: 13, marginTop: 26 }}>PREPARED FOR</div>
        <div style={{ ...fDisplay, color: "#fff", fontWeight: 700, fontSize: 64, lineHeight: 1.02, marginTop: 4 }}>{s.company}</div>
        <div style={{ ...fBody, color: "#AEB4BD", fontSize: 18, marginTop: 18 }}>{s.meta}</div>
        <div style={{ ...fBody, color: "#7E868F", fontSize: 15, marginTop: 6 }}>{s.date}</div>
      </div>
    </div>
  );
}

function SlideSummary({ s }) {
  return (
    <SlideShell eyebrow="EXECUTIVE SUMMARY" title={s.company} footerRight="">
      <div style={{ display: "flex", gap: 36, height: "100%" }}>
        <div style={{ flex: 1.5 }}>
          <p style={{ ...fBody, color: "#2A2F38", fontSize: 21, lineHeight: 1.5 }}>{s.execSummary || "Summary unavailable."}</p>
        </div>
        <div style={{ flex: 1, background: C.charcoal, borderRadius: 14, padding: 28, alignSelf: "flex-start" }}>
          <div style={{ ...fBody, color: "#7E868F", fontWeight: 700, letterSpacing: 2, fontSize: 13 }}>PORTFOLIO READINESS</div>
          {s.portfolio != null ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, margin: "10px 0 14px" }}>
                <span style={{ ...fDisplay, color: "#fff", fontWeight: 700, fontSize: 64, lineHeight: 1 }}>{round1(s.portfolio)}</span>
                <span style={{ ...fMono, color: "#7E868F", fontSize: 22, marginBottom: 8 }}>/ 5</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: "#2A323E", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(s.portfolio / 5) * 100}%`, background: bandColor(bandFor(s.portfolio)) }} />
              </div>
              <div style={{ marginTop: 16 }}>
                <BandPill band={bandFor(s.portfolio)} />
              </div>
            </>
          ) : (
            <div style={{ ...fBody, color: "#AEB4BD", marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <Spinner color="#fff" size={14} /> Scoring as challenges complete.
            </div>
          )}
        </div>
      </div>
    </SlideShell>
  );
}

function SlidePortfolio({ s }) {
  return (
    <SlideShell eyebrow="PORTFOLIO" title="Challenge portfolio" footerRight="Ordered by exposure, weakest first">
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1.1fr 0.8fr 1fr", background: "#F1EFEA", padding: "12px 18px", ...fBody, fontSize: 13, fontWeight: 700, color: C.sub, letterSpacing: 0.6 }}>
          <span>CHALLENGE</span><span>THEME</span><span>READINESS</span><span>BAND</span><span>PRIORITY ROUTE</span>
        </div>
        {s.rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1.1fr 0.8fr 1fr", alignItems: "center", padding: "14px 18px", borderTop: `1px solid ${C.line}`, background: "#fff" }}>
            <span style={{ ...fBody, color: C.ink, fontWeight: 600, fontSize: 16 }}>{r.title}</span>
            <span style={{ ...fBody, color: C.sub, fontSize: 14 }}>{r.theme}</span>
            <span style={{ paddingRight: 18 }}>{r.status === "done" ? <Meter score={r.score} h={8} /> : <Spinner size={14} />}</span>
            <span>{r.band ? <BandPill band={r.band} /> : null}</span>
            <span>{r.topRoute ? <RouteBadge route={r.topRoute} size="sm" /> : null}</span>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SlideChallenge({ s }) {
  return (
    <SlideShell
      eyebrow={`CHALLENGE ${String(s.index + 1).padStart(2, "0")} / ${String(s.total).padStart(2, "0")}`}
      title={s.title}
      footerRight=""
    >
      <div style={{ display: "flex", gap: 36, height: "100%" }}>
        <div style={{ flex: 1.1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <ThemeTag label={s.theme} />
            {s.secondaryTheme && <ThemeTag label={s.secondaryTheme} secondary />}
            {s.band && <BandPill band={s.band} />}
            {s.score != null && <span style={{ ...fMono, color: bandColor(s.band), fontSize: 15, fontWeight: 600 }}>{round1(s.score)}/5</span>}
          </div>
          <p style={{ ...fBody, color: "#2A2F38", fontSize: 17, lineHeight: 1.5 }}>{s.summary}</p>
          <div style={{ ...fBody, color: C.teal, fontWeight: 700, fontSize: 12, letterSpacing: 0.6, marginTop: 22 }}>HOW LONG THIS HAS BEEN LIVE</div>
          <div style={{ ...fBody, color: C.ink, fontSize: 15, lineHeight: 1.45, marginTop: 4 }}>{s.duration}</div>
          {s.people.length > 0 && (
            <>
              <div style={{ ...fBody, color: C.sub, fontWeight: 700, fontSize: 12, letterSpacing: 0.6, marginTop: 20 }}>PEOPLE PROCESSES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {s.people.map((p, i) => (
                  <span key={i} style={{ ...fBody, fontSize: 13, color: C.ink, background: "#F1EFEA", borderRadius: 6, padding: "4px 10px" }}>
                    <b style={{ color: C.teal }}>{p.process}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...fBody, color: C.corange, fontWeight: 700, fontSize: 12, letterSpacing: 0.6, marginBottom: 10 }}>COST OF INACTION</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {s.coi.map(([k, v]) => (
              <div key={k} style={{ background: "#fff", border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.corange}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ ...fBody, color: C.corange, fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>{k.toUpperCase()}</div>
                <div style={{ ...fBody, color: C.ink, fontSize: 13, lineHeight: 1.35, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function SlideSourcing({ s }) {
  const tech = s.skills?.technical || [];
  const beh = s.skills?.behavioural || [];
  return (
    <SlideShell
      eyebrow={`CHALLENGE ${String(s.index + 1).padStart(2, "0")} / ${String(s.total).padStart(2, "0")} · SKILLS & SOURCING`}
      title={s.title}
      footerRight=""
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 16 }}>
        {(tech.length || beh.length) > 0 && (
          <div style={{ display: "flex", gap: 28 }}>
            {tech.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ ...fBody, color: C.sub, fontWeight: 700, fontSize: 11, letterSpacing: 0.5, marginBottom: 4 }}>TECHNICAL & DOMAIN</div>
                <div style={{ ...fBody, color: C.ink, fontSize: 14 }}>{tech.join(", ")}</div>
              </div>
            )}
            {beh.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ ...fBody, color: C.sub, fontWeight: 700, fontSize: 11, letterSpacing: 0.5, marginBottom: 4 }}>LEADERSHIP & BEHAVIOURAL</div>
                <div style={{ ...fBody, color: C.ink, fontSize: 14 }}>{beh.join(", ")}</div>
              </div>
            )}
          </div>
        )}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr 1.6fr", background: "#F1EFEA", padding: "10px 16px", ...fBody, fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: 0.5 }}>
            <span>CAPABILITY</span><span>READINESS</span><span>ROUTE</span><span>TRIGGER</span>
          </div>
          {s.capabilities.map((cap, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr 1.6fr", alignItems: "center", padding: "12px 16px", borderTop: `1px solid ${C.line}`, background: "#fff" }}>
              <span style={{ ...fBody, color: C.ink, fontWeight: 600, fontSize: 14 }}>{cap.name}</span>
              <span style={{ paddingRight: 16 }}><Meter score={cap.readiness} h={7} /></span>
              <span><RouteBadge route={cap.route} size="sm" /></span>
              <span style={{ ...fBody, color: C.sub, fontSize: 12.5, lineHeight: 1.35 }}>{cap.trigger}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
          {Object.entries(ROUTE_META).map(([r, m]) => (
            <span key={r} style={{ ...fBody, fontSize: 11.5, color: C.sub, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: m.color }} /> <b style={{ color: C.ink }}>{r}</b> {m.blurb}
            </span>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function SlidePending({ s }) {
  return (
    <SlideShell eyebrow={`CHALLENGE ${String(s.index + 1).padStart(2, "0")} / ${String(s.total).padStart(2, "0")}`} title={s.title} footerRight="">
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: C.sub, ...fBody, fontSize: 18 }}>
        {s.status === "error" ? (
          <><AlertTriangle size={22} style={{ color: C.exposed }} /> This challenge did not return cleanly.</>
        ) : (
          <><Spinner size={22} /> Analysing this challenge…</>
        )}
      </div>
    </SlideShell>
  );
}

function renderSlide(s) {
  switch (s.type) {
    case "cover": return <SlideCover s={s} />;
    case "summary": return <SlideSummary s={s} />;
    case "portfolio": return <SlidePortfolio s={s} />;
    case "challenge": return <SlideChallenge s={s} />;
    case "sourcing": return <SlideSourcing s={s} />;
    default: return <SlidePending s={s} />;
  }
}

/* ============================ deck (interactive presentation) ============================ */
function Stage({ children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      if (ref.current) setScale(ref.current.clientWidth / 1280);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: "16 / 9", position: "relative", overflow: "hidden", borderRadius: 14, boxShadow: "0 12px 40px rgba(26,32,44,0.16)", background: "#fff" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

function Deck({ scope, execSummary, challenges, portfolio, savedNote, onNew, onLibrary, onExport }) {
  const slides = useMemo(() => buildSlides(scope, execSummary, challenges, portfolio), [scope, execSummary, challenges, portfolio]);
  const [idx, setIdx] = useState(0);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (idx > slides.length - 1) setIdx(Math.max(0, slides.length - 1));
  }, [slides.length, idx]);
  const go = useCallback((d) => setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d))), [slides.length]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);
  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, ...fBody }}>
      {/* top bar */}
      <div style={{ background: C.charcoal, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 16, height: 16, background: C.corange, borderRadius: 4 }} />
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>{scope.company || scope.industry}</span>
        {portfolio != null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 4 }}>
            <span style={{ ...fMono, color: "#fff", fontSize: 13 }}>{round1(portfolio)}<span style={{ color: "#69727E" }}>/5</span></span>
            <BandPill band={bandFor(portfolio)} />
          </span>
        )}
        <div style={{ flex: 1 }} />
        {savedNote && <span style={{ color: "#7E868F", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>{savedNote === "cloud" ? <Cloud size={13} /> : <CloudOff size={13} />}{savedNote === "cloud" ? "Saved to cloud" : "Saved locally"}</span>}
        <button onClick={onExport} style={btnStyle(C.corange, "#fff")}><Download size={15} /> PowerPoint</button>
        <button onClick={onLibrary} style={btnStyle("#252D38", "#fff")}><LibraryIcon size={15} /> Library</button>
        <button onClick={onNew} style={btnStyle("#252D38", "#AEB4BD")}><Plus size={15} /> New</button>
      </div>

      {/* stage */}
      <div ref={wrapRef} style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 8px" }}>
        <Stage>{renderSlide(slides[idx] || slides[0])}</Stage>

        {/* controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 18 }}>
          <button onClick={() => go(-1)} disabled={idx === 0} style={navBtn(idx === 0)}><ArrowLeft size={18} /></button>
          <span style={{ ...fMono, color: C.sub, fontSize: 14, minWidth: 70, textAlign: "center" }}>
            {idx + 1} / {slides.length}
          </span>
          <button onClick={() => go(1)} disabled={idx === slides.length - 1} style={navBtn(idx === slides.length - 1)}><ArrowRight size={18} /></button>
          <button onClick={fullscreen} style={{ ...navBtn(false), marginLeft: 8 }} title="Fullscreen"><Maximize2 size={16} /></button>
        </div>

        {/* dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", margin: "14px 0 28px" }}>
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              title={s.title || s.type}
              style={{ width: i === idx ? 22 : 9, height: 9, borderRadius: 99, border: "none", cursor: "pointer", background: i === idx ? C.corange : "#D8D3CA", transition: "width .2s" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
function btnStyle(bg, color) {
  return { ...fBody, display: "inline-flex", alignItems: "center", gap: 7, background: bg, color, border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
}
function navBtn(disabled) {
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 99, border: `1px solid ${C.line}`, background: "#fff", color: disabled ? "#C9C4BB" : C.ink, cursor: disabled ? "default" : "pointer" };
}

/* ============================ PowerPoint export ============================ */
function pptText(slide, pptx, str, opts) {
  slide.addText(str || "", { fontFace: "Segoe UI", ...opts });
}
async function exportPptx(scope, execSummary, challenges, portfolio) {
  const { default: pptxgen } = await import("pptxgenjs");
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "W16x9", width: 13.333, height: 7.5 });
  pptx.layout = "W16x9";
  const CH = "1A202C", OR = "FA4616", TE = "03859B", SUB = "69727E", GREY = "9098A1";
  const bandHex = (b) => (b === "Strong" ? "03859B" : b === "Developing" ? "C2740A" : "FA4616");

  const meta = [scope.industry, scope.geography, scope.theme !== "All themes" ? scope.theme : null, scope.horizon + " horizon"].filter(Boolean).join("   ·   ");
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // cover
  const cov = pptx.addSlide();
  cov.background = { color: CH };
  cov.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.1, fill: { color: OR } });
  cov.addShape(pptx.ShapeType.rect, { x: 0.75, y: 0.66, w: 0.18, h: 0.18, fill: { color: OR } });
  pptText(cov, pptx, "CORNERSTONE", { x: 1.0, y: 0.6, w: 6, h: 0.3, color: "FFFFFF", fontSize: 14, bold: true, charSpacing: 3 });
  pptText(cov, pptx, "TRANSFORMATION & TALENT READINESS", { x: 0.75, y: 2.5, w: 11, h: 0.4, color: OR, fontSize: 14, bold: true, charSpacing: 2 });
  pptText(cov, pptx, "PREPARED FOR", { x: 0.75, y: 3.05, w: 6, h: 0.3, color: "7E868F", fontSize: 12, bold: true, charSpacing: 2 });
  pptText(cov, pptx, scope.company || scope.industry, { x: 0.72, y: 3.3, w: 12, h: 1.2, color: "FFFFFF", fontSize: 48, bold: true });
  pptText(cov, pptx, meta, { x: 0.75, y: 4.7, w: 12, h: 0.4, color: "AEB4BD", fontSize: 16 });
  pptText(cov, pptx, date, { x: 0.75, y: 5.1, w: 12, h: 0.3, color: "7E868F", fontSize: 13 });

  const header = (slide, eyebrow, title) => {
    pptText(slide, pptx, eyebrow, { x: 0.6, y: 0.5, w: 12, h: 0.3, color: OR, fontSize: 13, bold: true, charSpacing: 1 });
    pptText(slide, pptx, title, { x: 0.6, y: 0.82, w: 12.1, h: 0.7, color: CH, fontSize: 30, bold: true });
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.6, w: 0.6, h: 0.04, fill: { color: OR } });
    pptText(slide, pptx, "CORNERSTONE · CONFIDENTIAL", { x: 0.6, y: 7.05, w: 8, h: 0.3, color: GREY, fontSize: 10 });
  };

  // summary
  const sum = pptx.addSlide();
  header(sum, "EXECUTIVE SUMMARY", scope.company || scope.industry);
  pptText(sum, pptx, execSummary || "", { x: 0.6, y: 2.0, w: 7.6, h: 4, color: "2A2F38", fontSize: 17, lineSpacingMultiple: 1.3, valign: "top" });
  sum.addShape(pptx.ShapeType.rect, { x: 8.5, y: 2.0, w: 4.2, h: 2.3, fill: { color: CH }, rectRadius: 0.08, line: { color: CH } });
  pptText(sum, pptx, "PORTFOLIO READINESS", { x: 8.75, y: 2.2, w: 3.8, h: 0.3, color: "7E868F", fontSize: 12, bold: true, charSpacing: 1 });
  if (portfolio != null) {
    pptText(sum, pptx, `${round1(portfolio)}`, { x: 8.7, y: 2.5, w: 2.4, h: 1.1, color: "FFFFFF", fontSize: 54, bold: true });
    pptText(sum, pptx, "/ 5", { x: 10.5, y: 3.15, w: 1, h: 0.4, color: "7E868F", fontSize: 20 });
    pptText(sum, pptx, bandFor(portfolio).toUpperCase(), { x: 8.75, y: 3.7, w: 3.6, h: 0.4, color: bandHex(bandFor(portfolio)), fontSize: 15, bold: true });
  } else {
    pptText(sum, pptx, "Pending", { x: 8.75, y: 2.7, w: 3.6, h: 0.4, color: "AEB4BD", fontSize: 18 });
  }

  // portfolio table
  const ranked = challenges.map((c, i) => ({ ...c, idx: i })).sort((a, b) => (a.score ?? 9) - (b.score ?? 9));
  const port = pptx.addSlide();
  header(port, "PORTFOLIO", "Challenge portfolio");
  const headRow = ["Challenge", "Theme", "Readiness", "Band", "Priority route"].map((t) => ({
    text: t.toUpperCase(),
    options: { bold: true, color: SUB, fill: { color: "F1EFEA" }, fontSize: 11 },
  }));
  const rows = ranked.map((c) => {
    const topRoute = c.detail?.capabilities?.length
      ? c.detail.capabilities.reduce((a, b) => (clampScore(a.readiness) <= clampScore(b.readiness) ? a : b)).route
      : "";
    return [
      { text: c.title, options: { bold: true, color: CH, fontSize: 13 } },
      { text: c.theme || "", options: { color: SUB, fontSize: 12 } },
      { text: c.score != null ? `${round1(c.score)} / 5` : "pending", options: { color: c.band ? bandHex(c.band) : SUB, bold: true, fontSize: 13 } },
      { text: c.band || "", options: { color: c.band ? bandHex(c.band) : SUB, bold: true, fontSize: 12 } },
      { text: topRoute, options: { color: topRoute ? routeColor(topRoute).replace("#", "") : SUB, bold: true, fontSize: 12 } },
    ];
  });
  port.addTable([headRow, ...rows], {
    x: 0.6, y: 2.0, w: 12.1, colW: [3.6, 3.0, 2.0, 1.5, 2.0],
    border: { type: "solid", color: "E6E2DA", pt: 1 }, fontFace: "Segoe UI", valign: "middle", rowH: 0.5,
  });

  // per challenge
  challenges.forEach((c, i) => {
    if (!(c.status === "done" && c.detail)) return;
    const d = c.detail;
    const eyebrow = `CHALLENGE ${String(i + 1).padStart(2, "0")} / ${String(challenges.length).padStart(2, "0")}`;

    const a = pptx.addSlide();
    header(a, eyebrow, c.title);
    pptText(a, pptx, c.summary || "", { x: 0.6, y: 1.85, w: 6.4, h: 1.6, color: "2A2F38", fontSize: 15, lineSpacingMultiple: 1.25, valign: "top" });
    pptText(a, pptx, "HOW LONG THIS HAS BEEN LIVE", { x: 0.6, y: 3.5, w: 6.4, h: 0.3, color: TE, fontSize: 11, bold: true });
    pptText(a, pptx, d.duration || "", { x: 0.6, y: 3.78, w: 6.4, h: 1, color: CH, fontSize: 14, valign: "top" });
    if ((d.peopleProcesses || []).length) {
      pptText(a, pptx, "PEOPLE PROCESSES", { x: 0.6, y: 5.0, w: 6.4, h: 0.3, color: SUB, fontSize: 11, bold: true });
      pptText(a, pptx, d.peopleProcesses.map((p) => p.process).join("   ·   "), { x: 0.6, y: 5.3, w: 6.4, h: 0.6, color: TE, fontSize: 13, bold: true, valign: "top" });
    }
    const coi = d.costOfInaction || {};
    const coiRows = [["Commercial", coi.commercial], ["Operational", coi.operational], ["Competitive", coi.competitive], ["Regulatory", coi.regulatory], ["Talent", coi.talent]].filter(([, v]) => v);
    pptText(a, pptx, "COST OF INACTION", { x: 7.4, y: 1.85, w: 5.3, h: 0.3, color: OR, fontSize: 11, bold: true });
    a.addTable(
      coiRows.map(([k, v]) => [
        { text: k.toUpperCase(), options: { bold: true, color: OR, fontSize: 10, valign: "top", w: 1.5 } },
        { text: v, options: { color: CH, fontSize: 12, valign: "top" } },
      ]),
      { x: 7.4, y: 2.15, w: 5.3, colW: [1.5, 3.8], border: { type: "solid", color: "E6E2DA", pt: 1 }, fontFace: "Segoe UI", rowH: 0.4 }
    );

    const b = pptx.addSlide();
    header(b, eyebrow + " · SKILLS & SOURCING", c.title);
    const tech = (d.skills?.technical || []).join(", ");
    const beh = (d.skills?.behavioural || []).join(", ");
    if (tech) {
      pptText(b, pptx, "TECHNICAL & DOMAIN", { x: 0.6, y: 1.8, w: 6, h: 0.3, color: SUB, fontSize: 10, bold: true });
      pptText(b, pptx, tech, { x: 0.6, y: 2.05, w: 6, h: 0.8, color: CH, fontSize: 13, valign: "top" });
    }
    if (beh) {
      pptText(b, pptx, "LEADERSHIP & BEHAVIOURAL", { x: 6.8, y: 1.8, w: 6, h: 0.3, color: SUB, fontSize: 10, bold: true });
      pptText(b, pptx, beh, { x: 6.8, y: 2.05, w: 5.9, h: 0.8, color: CH, fontSize: 13, valign: "top" });
    }
    const caps = (d.capabilities || []).map((x) => ({ ...x, readiness: clampScore(x.readiness) }));
    const capHead = ["Capability", "Readiness", "Route", "Trigger", "Watch-out"].map((t) => ({ text: t.toUpperCase(), options: { bold: true, color: SUB, fill: { color: "F1EFEA" }, fontSize: 10 } }));
    const capRows = caps.map((cap) => [
      { text: cap.name, options: { bold: true, color: CH, fontSize: 12 } },
      { text: `${cap.readiness} / 5`, options: { color: bandHex(bandFor(cap.readiness)), bold: true, fontSize: 12 } },
      { text: cap.route, options: { color: routeColor(cap.route).replace("#", ""), bold: true, fontSize: 11 } },
      { text: cap.trigger, options: { color: SUB, fontSize: 10.5, valign: "top" } },
      { text: cap.watchOut, options: { color: SUB, fontSize: 10.5, valign: "top" } },
    ]);
    b.addTable([capHead, ...capRows], {
      x: 0.6, y: 3.1, w: 12.1, colW: [2.7, 1.4, 1.4, 3.4, 3.2],
      border: { type: "solid", color: "E6E2DA", pt: 1 }, fontFace: "Segoe UI", valign: "middle", rowH: 0.55,
    });
  });

  const base = (scope.company || scope.industry || "analysis").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  pptx.writeFile({ fileName: `${base}_Transformation_Readiness.pptx` });
}

/* ============================ library ============================ */
function Library({ records, source, loading, onOpen, onDelete, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: C.paper, ...fBody }}>
      <div style={{ background: C.charcoal, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 16, height: 16, background: C.corange, borderRadius: 4 }} />
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>Library</span>
        {source && (
          <span style={{ color: "#7E868F", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {source === "cloud" ? <><Cloud size={13} /> Cloud</> : <><CloudOff size={13} /> This browser only</>}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onBack} style={btnStyle(C.corange, "#fff")}><Plus size={15} /> New analysis</button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {loading ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", color: C.sub }}><Spinner /> Loading records…</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: "center", color: C.sub, padding: "60px 0" }}>
            <LibraryIcon size={30} style={{ color: "#C9C4BB" }} />
            <p style={{ marginTop: 12, fontSize: 15 }}>No saved analyses yet. Run one and it will appear here.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {records.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...fDisplay, color: C.ink, fontWeight: 700, fontSize: 17 }}>{r.company || r.industry || "Untitled"}</div>
                  <div style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>
                    {[r.industry, r.theme && r.theme !== "All themes" ? r.theme : null].filter(Boolean).join("  ·  ")}
                    {r.industry || r.theme ? "  ·  " : ""}
                    {r.createdAt ? new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    {typeof r.challengeCount === "number" ? `  ·  ${r.challengeCount} challenges` : ""}
                  </div>
                </div>
                {r.portfolio != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...fMono, color: bandColor(bandFor(r.portfolio)), fontWeight: 600 }}>{round1(r.portfolio)}/5</span>
                    <BandPill band={r.band || bandFor(r.portfolio)} />
                  </div>
                )}
                <button onClick={() => onOpen(r.id)} style={btnStyle(C.charcoal, "#fff")}>Open</button>
                <button onClick={() => onDelete(r.id)} title="Delete" style={{ ...navBtn(false), width: 38, height: 38 }}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ app ============================ */
export default function App() {
  const [view, setView] = useState("intake"); // intake | loading | present | library
  const [error, setError] = useState(null);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [scope, setScope] = useState(null);
  const [execSummary, setExecSummary] = useState("");
  const [challenges, setChallenges] = useState([]);
  const [savedNote, setSavedNote] = useState(null);
  const [cloud, setCloud] = useState(null); // 'cloud' | 'local'
  const [records, setRecords] = useState([]);
  const [recSource, setRecSource] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const runId = useRef(0);
  const currentId = useRef(null);

  const initial = { company: "", industry: "", geography: "", theme: "All themes", n: 4, horizon: "3 years" };

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
    // probe cloud availability quietly
    storeList().then((d) => setCloud(d.source));
    return () => { try { document.head.removeChild(l); } catch {} };
  }, []);

  const portfolio = useMemo(() => {
    const sc = challenges.filter((c) => c.status === "done" && c.score != null).map((c) => c.score);
    return sc.length ? round1(mean(sc)) : null;
  }, [challenges]);

  const updateChallenge = (i, patch) => setChallenges((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  async function loadDetail(i, stub, s, myRun) {
    updateChallenge(i, { status: "loading" });
    try {
      const txt = await callClaude({ system: detailSystem(), user: detailUser(s, stub), useSearch: false });
      if (runId.current !== myRun) return;
      const d = extractJson(txt);
      const caps = (d.capabilities || []).map((c) => ({ ...c, readiness: clampScore(c.readiness) }));
      d.capabilities = caps;
      const score = caps.length ? round1(mean(caps.map((c) => c.readiness))) : null;
      updateChallenge(i, { status: "done", detail: d, score, band: score != null ? bandFor(score) : null });
    } catch {
      if (runId.current !== myRun) return;
      updateChallenge(i, { status: "error" });
    }
  }

  async function persist(s, summary, list) {
    const port = (() => {
      const sc = list.filter((c) => c.score != null).map((c) => c.score);
      return sc.length ? round1(mean(sc)) : null;
    })();
    const rec = {
      id: currentId.current,
      createdAt: new Date().toISOString(),
      scope: s,
      execSummary: summary,
      portfolio: port,
      band: port != null ? bandFor(port) : null,
      challenges: list.map((c) => ({
        title: c.title, theme: c.theme, secondaryTheme: c.secondaryTheme, summary: c.summary,
        status: c.status, score: c.score, band: c.band, detail: c.detail,
      })),
    };
    const where = await storeSave(rec);
    setSavedNote(where);
    setCloud(where);
  }

  async function run(form) {
    const myRun = ++runId.current;
    const s = { ...form, n: Number(form.n) };
    currentId.current = "rec_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setScope(s); setError(null); setExecSummary(""); setChallenges([]); setSavedNote(null);
    setLoadingLabel(`Researching ${s.company || s.industry}`); setView("loading");
    try {
      const ovText = await callClaude({ system: overviewSystem(), user: overviewUser(s), useSearch: true });
      if (runId.current !== myRun) return;
      const ov = extractJson(ovText);
      const stubs = (ov.challenges || []).slice(0, s.n).map((c) => ({
        title: c.title || "Untitled challenge", theme: c.theme || "", secondaryTheme: c.secondaryTheme || "",
        summary: c.summary || "", status: "pending", detail: null, score: null, band: null,
      }));
      if (!stubs.length) throw new Error("No challenges were returned. Try refining the scope.");
      setExecSummary(ov.executiveSummary || "");
      setChallenges(stubs);
      setView("present");
      const built = [...stubs];
      for (let i = 0; i < stubs.length; i++) {
        if (runId.current !== myRun) return;
        await loadDetail(i, stubs[i], s, myRun);
      }
      // read back the latest challenges for persistence
      setChallenges((cur) => {
        if (runId.current === myRun) persist(s, ov.executiveSummary || "", cur);
        return cur;
      });
    } catch (e) {
      if (runId.current !== myRun) return;
      setError(e.message || "Something went wrong. Try again.");
      setView("intake");
    }
  }

  async function openLibrary() {
    setView("library"); setRecLoading(true);
    const d = await storeList();
    setRecords(d.records); setRecSource(d.source); setCloud(d.source); setRecLoading(false);
  }
  async function openRecord(id) {
    setRecLoading(true);
    const rec = await storeGet(id);
    setRecLoading(false);
    if (!rec) return;
    runId.current++; // stop any in-flight run
    currentId.current = rec.id;
    setScope(rec.scope);
    setExecSummary(rec.execSummary || "");
    setChallenges((rec.challenges || []).map((c) => ({ ...c, status: c.status || "done" })));
    setSavedNote(null);
    setView("present");
  }
  async function removeRecord(id) {
    await storeDelete(id);
    setRecords((r) => r.filter((x) => x.id !== id));
  }
  function reset() {
    runId.current++;
    setView("intake"); setError(null); setChallenges([]); setSavedNote(null);
  }

  if (view === "intake") return <Intake initial={initial} onRun={run} onLibrary={openLibrary} error={error} cloud={cloud} />;
  if (view === "loading") return <Loading label={loadingLabel} />;
  if (view === "library")
    return <Library records={records} source={recSource} loading={recLoading} onOpen={openRecord} onDelete={removeRecord} onBack={reset} />;

  return (
    <Deck
      scope={scope}
      execSummary={execSummary}
      challenges={challenges}
      portfolio={portfolio}
      savedNote={savedNote}
      onNew={reset}
      onLibrary={openLibrary}
      onExport={() => exportPptx(scope, execSummary, challenges, portfolio)}
    />
  );
}
