import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowRight, RefreshCw, AlertTriangle, Building2, Globe, Factory,
  Layers, ChevronLeft, Plus, Search, GraduationCap, ShoppingCart,
  Clock, Cpu, BarChart3, Download,
} from "lucide-react";

/* ---------- brand palette ---------- */
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

/* ---------- helpers ---------- */
const round1 = (n) => Math.round(n * 10) / 10;
const clampScore = (n) => Math.max(1, Math.min(5, Math.round(Number(n) || 1)));
const bandFor = (s) => (s >= 4 ? "Strong" : s >= 2.5 ? "Developing" : "Exposed");
const bandColor = (b) =>
  b === "Strong" ? C.strong : b === "Developing" ? C.developing : C.exposed;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

function extractJson(text) {
  let t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Model did not return readable data.");
  return JSON.parse(t.slice(s, e + 1));
}

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

/* ---------- branded Word export ---------- */
const DOCFONT = "'Segoe UI', Calibri, Arial, sans-serif";
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function routeColor(r) {
  return (ROUTE_META[r] || ROUTE_META.Build).color;
}
function wScore(score) {
  if (score == null)
    return `<span style="font-family:${DOCFONT};font-size:9pt;color:#9098A1">pending</span>`;
  const filled = Math.round(score);
  const col = bandColor(bandFor(score));
  let cells = "";
  for (let i = 1; i <= 5; i++) {
    cells += `<td width="16" style="height:9px;background:${i <= filled ? col : "#ECE8E0"};font-size:1px;line-height:1px;border:1px solid #ffffff">&nbsp;</td>`;
  }
  return `<table cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse"><tr>${cells}<td style="padding-left:9px;font-family:${DOCFONT};font-size:10pt;color:${col};font-weight:bold">${round1(score)} / 5</td></tr></table>`;
}
function wBarWide(score, track) {
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  const col = bandColor(bandFor(score));
  return `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td width="${pct}%" style="background:${col};height:6px;font-size:1px;line-height:1px">&nbsp;</td><td style="background:${track};height:6px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>`;
}
function wBand(band) {
  if (!band) return "";
  return `<span style="font-family:${DOCFONT};font-size:8.5pt;font-weight:bold;color:#ffffff;background:${bandColor(band)};padding:3px 9px">${band}</span>`;
}
function wEyebrow(letter, label) {
  const chip = letter
    ? `<span style="background:#FA4616;color:#ffffff;font-family:${DOCFONT};font-size:8.5pt;font-weight:bold;padding:2px 7px;margin-right:10px">${letter}</span>`
    : "";
  return `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:24px 0 12px"><tr><td style="vertical-align:middle;white-space:nowrap;width:1%">${chip}<span style="font-family:${DOCFONT};font-size:9.5pt;font-weight:bold;color:#1A202C;letter-spacing:1.2px">${esc(label).toUpperCase()}</span></td><td style="vertical-align:middle;padding-left:14px"><div style="border-top:1px solid #DCD8D0;font-size:1px;line-height:1px;height:1px">&nbsp;</div></td></tr></table>`;
}
function wTable(headers, rows) {
  const th = headers
    .map(
      (h) =>
        `<td style="padding:8px 11px;font-family:${DOCFONT};font-size:8pt;font-weight:bold;color:#1A202C;letter-spacing:.7px;border-bottom:2px solid #FA4616"${
          h.width ? ` width="${h.width}"` : ""
        }>${esc(h.label).toUpperCase()}</td>`
    )
    .join("");
  const trs = rows
    .map(
      (cells, ri) =>
        `<tr>${cells
          .map(
            (c) =>
              `<td style="padding:9px 11px;font-family:${DOCFONT};font-size:10pt;color:#2A2F38;border-bottom:1px solid #ECE8E0;vertical-align:top;background:${
                ri % 2 ? "#FAF8F5" : "#ffffff"
              }">${c}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 6px;page-break-inside:avoid"><tr>${th}</tr>${trs}</table>`;
}
function buildWordHtml(scope, execSummary, challenges, portfolio) {
  const meta = [
    scope.industry,
    scope.geography,
    scope.theme !== "All themes" ? scope.theme : null,
    scope.horizon + " horizon",
  ]
    .filter(Boolean)
    .map(esc)
    .join("  &bull;  ");
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const ranked = challenges
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => (a.score ?? 9) - (b.score ?? 9));

  let body = "";

  /* cover */
  body += `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
    <tr><td style="background:#FA4616;height:5px;font-size:1px;line-height:1px">&nbsp;</td></tr>
    <tr><td style="background:#1A202C;padding:32px 32px 30px">
      <table cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr>
        <td width="13" style="background:#FA4616;height:13px;font-size:1px;line-height:1px">&nbsp;</td>
        <td style="padding-left:10px;font-family:${DOCFONT};font-size:10pt;color:#ffffff;font-weight:bold;letter-spacing:2px;vertical-align:middle">CORNERSTONE</td>
      </tr></table>
      <div style="font-family:${DOCFONT};font-size:8.5pt;color:#FA4616;letter-spacing:2px;font-weight:bold;margin-top:24px">TRANSFORMATION AND TALENT READINESS</div>
      <div style="font-family:${DOCFONT};font-size:8.5pt;color:#7E868F;letter-spacing:1.5px;margin-top:16px">PREPARED FOR</div>
      <div style="font-family:${DOCFONT};font-size:25pt;font-weight:bold;color:#ffffff;margin-top:3px;line-height:1.05">${esc(scope.company || scope.industry)}</div>
      <div style="font-family:${DOCFONT};font-size:10pt;color:#AEB4BD;margin-top:12px">${meta}</div>
      <div style="font-family:${DOCFONT};font-size:9pt;color:#7E868F;margin-top:3px">${today}</div>
    </td></tr></table>`;

  /* executive summary */
  body += wEyebrow("", "Executive summary");
  body += `<div style="font-family:${DOCFONT};font-size:11pt;color:#2A2F38;line-height:1.55">${esc(execSummary)}</div>`;

  /* portfolio readiness panel */
  body += `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:18px"><tr><td style="background:#1A202C;padding:18px 22px">
      <div style="font-family:${DOCFONT};font-size:8.5pt;color:#7E868F;letter-spacing:2px;font-weight:bold">PORTFOLIO READINESS</div>
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px"><tr>
        <td style="vertical-align:bottom;white-space:nowrap;width:1%">${
          portfolio != null
            ? `<span style="font-family:${DOCFONT};font-size:30pt;font-weight:bold;color:#ffffff">${round1(portfolio)}</span><span style="font-family:${DOCFONT};font-size:13pt;color:#7E868F"> / 5</span>`
            : `<span style="font-family:${DOCFONT};font-size:13pt;color:#AEB4BD">Pending</span>`
        }</td>
        <td style="vertical-align:bottom;padding-left:16px">${portfolio != null ? wBand(bandFor(portfolio)) : ""}</td>
      </tr></table>
      ${portfolio != null ? `<div style="margin-top:12px">${wBarWide(portfolio, "#2A323E")}</div>` : ""}
    </td></tr></table>`;

  /* portfolio table */
  body += wEyebrow("", "Challenge portfolio");
  const prows = ranked.map((c) => {
    const topRoute = c.detail?.capabilities?.length
      ? c.detail.capabilities.reduce((a, b) =>
          clampScore(a.readiness) <= clampScore(b.readiness) ? a : b
        ).route
      : "";
    return [
      `<b>${esc(c.title)}</b>`,
      esc(c.theme),
      c.score != null ? wScore(c.score) : `<span style="font-family:${DOCFONT};font-size:9pt;color:#9098A1">pending</span>`,
      wBand(c.band),
      topRoute ? `<span style="color:${routeColor(topRoute)};font-weight:bold">${esc(topRoute)}</span>` : "",
    ];
  });
  body += wTable(
    [{ label: "Challenge" }, { label: "Theme" }, { label: "Readiness" }, { label: "Band" }, { label: "Priority route" }],
    prows
  );

  /* challenges flow continuously; one break separates summary from detail */
  challenges.forEach((c, i) => {
    if (i > 0) body += `<div style="border-top:1px solid #E6E2DA;margin-top:30px;font-size:1px;line-height:1px">&nbsp;</div>`;
    const headStyle = (i === 0 ? "page-break-before:always;" : "") + "page-break-inside:avoid";

    const tags = [[c.theme, false], [c.secondaryTheme, true]]
      .filter(([t]) => t)
      .map(
        ([t, sec]) =>
          `<span style="font-family:${DOCFONT};font-size:8.5pt;color:${sec ? "#69727E" : "#03859B"};border:1px solid ${sec ? "#DCD8D0" : "#9FD3DD"};padding:2px 7px;margin-right:5px">${esc(t)}</span>`
      )
      .join("");

    body += `<div style="${headStyle}">`;
    body += `<div style="font-family:${DOCFONT};font-size:9pt;color:#FA4616;font-weight:bold;letter-spacing:1.5px;margin-top:${i === 0 ? 0 : 24}px">CHALLENGE ${String(i + 1).padStart(2, "0")} / ${String(challenges.length).padStart(2, "0")}</div>`;
    body += `<div style="font-family:${DOCFONT};font-size:16pt;font-weight:bold;color:#1A202C;margin-top:3px;line-height:1.12">${esc(c.title)}</div>`;
    body += `<div style="margin-top:8px">${tags}</div>`;
    body += `<div style="font-family:${DOCFONT};font-size:10.5pt;color:#69727E;line-height:1.5;margin-top:9px">${esc(c.summary)}</div>`;
    if (c.status === "done" && c.detail) {
      body += `<table cellspacing="0" cellpadding="0" style="margin-top:13px"><tr><td style="vertical-align:middle">${wScore(c.score)}</td><td style="vertical-align:middle;padding-left:14px">${wBand(c.band)}</td></tr></table>`;
    }
    body += `</div>`;

    if (c.status === "done" && c.detail) {
      const d = c.detail;

      body += wEyebrow("A", "The challenge");
      body += `<div style="font-family:${DOCFONT};font-size:8pt;font-weight:bold;color:#03859B;letter-spacing:.8px">HOW LONG THIS HAS BEEN LIVE</div><div style="font-family:${DOCFONT};font-size:10.5pt;color:#2A2F38;margin:3px 0 14px;line-height:1.5">${esc(d.duration)}</div>`;
      const coi = d.costOfInaction || {};
      const coiRows = [
        ["Commercial", coi.commercial],
        ["Operational", coi.operational],
        ["Competitive", coi.competitive],
        ["Regulatory", coi.regulatory],
        ["Talent", coi.talent],
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => [
          `<span style="font-family:${DOCFONT};color:#FA4616;font-weight:bold;font-size:9pt;letter-spacing:.4px">${k.toUpperCase()}</span>`,
          esc(v),
        ]);
      body += `<div style="font-family:${DOCFONT};font-size:8pt;font-weight:bold;color:#69727E;letter-spacing:.8px;margin-top:4px">COST OF INACTION</div>`;
      body += wTable([{ label: "Dimension", width: 150 }, { label: "Impact" }], coiRows);

      if (d.peopleProcesses?.length) {
        body += wEyebrow("B", "People process alignment");
        body += wTable(
          [{ label: "Process", width: 170 }, { label: "What it must deliver" }],
          d.peopleProcesses.map((p) => [
            `<span style="color:#03859B;font-weight:bold">${esc(p.process)}</span>`,
            esc(p.role),
          ])
        );
      }

      if (d.capabilities?.length) {
        body += wEyebrow("C", "Skills and capability readiness");
        const tech = (d.skills?.technical || []).map(esc);
        const beh = (d.skills?.behavioural || []).map(esc);
        if (tech.length || beh.length) {
          body += `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:12px;page-break-inside:avoid"><tr>
            <td width="50%" style="vertical-align:top;padding-right:12px"><div style="font-family:${DOCFONT};font-size:8pt;font-weight:bold;color:#69727E;letter-spacing:.6px;margin-bottom:4px">TECHNICAL AND DOMAIN</div><div style="font-family:${DOCFONT};font-size:10pt;color:#2A2F38;line-height:1.5">${tech.join(", ") || "n/a"}</div></td>
            <td width="50%" style="vertical-align:top"><div style="font-family:${DOCFONT};font-size:8pt;font-weight:bold;color:#69727E;letter-spacing:.6px;margin-bottom:4px">LEADERSHIP AND BEHAVIOURAL</div><div style="font-family:${DOCFONT};font-size:10pt;color:#2A2F38;line-height:1.5">${beh.join(", ") || "n/a"}</div></td>
          </tr></table>`;
        }
        d.capabilities.forEach((cap) => {
          const sc = clampScore(cap.readiness);
          const sig = [
            ["Internal supply", cap.internalSupply],
            ["Adjacency", cap.adjacency],
            ["External scarcity", cap.externalScarcity],
            ["Build time", cap.buildTime],
            ["Skill half-life", cap.halfLife],
          ].filter(([, v]) => v);
          body += `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #E6E2DA;border-left:3px solid #FA4616;margin-bottom:9px;page-break-inside:avoid"><tr><td style="padding:13px 15px">`;
          body += `<table width="100%" cellspacing="0" cellpadding="0"><tr><td style="font-family:${DOCFONT};font-size:11pt;font-weight:bold;color:#1A202C;vertical-align:middle">${esc(cap.name)}</td><td align="right" style="vertical-align:middle">${wScore(sc)}</td></tr></table>`;
          body += `<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:9px">`;
          sig.forEach(([k, v]) => {
            body += `<tr><td width="135" style="font-family:${DOCFONT};font-size:8pt;font-weight:bold;color:#69727E;letter-spacing:.4px;padding:3px 0;vertical-align:top">${k.toUpperCase()}</td><td style="font-family:${DOCFONT};font-size:9.5pt;color:#2A2F38;padding:3px 0;line-height:1.45">${esc(v)}</td></tr>`;
          });
          body += `</table>`;
          if (cap.justification)
            body += `<div style="font-family:${DOCFONT};font-size:9pt;font-style:italic;color:#69727E;margin-top:9px;padding-top:7px;border-top:1px solid #E6E2DA">${esc(cap.justification)}</div>`;
          body += `</td></tr></table>`;
        });
      }

      if (d.capabilities?.length) {
        body += wEyebrow("D", "Sourcing strategy");
        body += wTable(
          [
            { label: "Capability", width: 150 },
            { label: "Score", width: 62 },
            { label: "Route", width: 72 },
            { label: "Trigger" },
            { label: "Watch-out" },
          ],
          d.capabilities.map((cap) => [
            `<b>${esc(cap.name)}</b>`,
            `${clampScore(cap.readiness)} / 5`,
            `<span style="color:${routeColor(cap.route)};font-weight:bold">${esc(cap.route)}</span>`,
            esc(cap.trigger),
            esc(cap.watchOut),
          ])
        );
      }
    } else {
      body += `<div style="font-family:${DOCFONT};font-size:10pt;color:#69727E;margin-top:12px;font-style:italic">Detailed analysis pending or unavailable for this challenge.</div>`;
    }
  });

  const footer = `<div style="mso-element:footer" id="f1"><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #E6E2DA"><tr><td style="padding-top:6px;font-family:${DOCFONT};font-size:8pt;color:#9098A1;letter-spacing:.5px">CORNERSTONE &nbsp;&bull;&nbsp; CONFIDENTIAL</td><td align="right" style="padding-top:6px;font-family:${DOCFONT};font-size:8pt;color:#9098A1">Page <span style="mso-element:field-begin"></span>PAGE<span style="mso-element:field-separator"></span>1<span style="mso-element:field-end"></span></td></tr></table></div>`;

  const head = `<style>
@page Section1 { size:595.3pt 841.9pt; margin:1.6cm 1.6cm 1.4cm 1.6cm; mso-footer-margin:1.0cm; mso-footer:f1; }
div.Section1 { page:Section1; }
body { margin:0; font-family:${DOCFONT}; }
table { mso-table-lspace:0pt; mso-table-rspace:0pt; }
</style>`;

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(
    scope.company || scope.industry
  )} Transformation Readiness</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->${head}</head><body><div class="Section1">${body}${footer}</div></body></html>`;
}

/* ---------- prompt builders ---------- */
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
- Build: skill adjacent to current capability, core and strategic to own long term, retention matters, time allows. Slowest, lowest long-run cost.
- Buy: net-new with no internal adjacency, speed to permanent capability, must sit at the core, market can supply. Fast, highest fixed cost.
- Borrow: temporary or uncertain need, niche or scarce skill, flexibility over ownership. Fast, no retained knowledge.
- Bot: repeatable rules-based or high-volume task, scale and consistency beat judgement, frees scarce capacity, process stable. Needs governance and a human accountability layer.

Capability readiness, 1 to 5: 5 ready (exists at scale, low scarcity, short build); 4 largely ready (pockets, highly adjacent); 3 addressable (adjacent, months to build, moderate scarcity); 2 exposed (little supply, weak adjacency, contested, multi-year build); 1 critical gap (net-new, no adjacency, scarce, long build). Score on the binding constraint.

Return ONLY this JSON:
{"duration":"how long this has been live, anchored to a signal","costOfInaction":{"commercial":"","operational":"","competitive":"","regulatory":"","talent":""},"peopleProcesses":[{"process":"Learning|Performance|Succession|Internal mobility|Compensation|Recruitment","role":"what it must deliver"}],"skills":{"technical":["specific skill"],"behavioural":["specific skill"]},"capabilities":[{"name":"capability or skill cluster","internalSupply":"","adjacency":"","externalScarcity":"","buildTime":"","halfLife":"","readiness":3,"justification":"one line tied to the signals","route":"Build|Buy|Borrow|Bot","trigger":"plain trigger condition","watchOut":"main risk"}]}
Include only the people processes that are genuinely material. Include 3 to 4 capabilities, prioritising the most critical. readiness must be an integer 1 to 5.`;
}

/* ---------- small UI pieces ---------- */
function Meter({ score, size = "md" }) {
  if (score == null) score = 0;
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  const band = bandFor(score);
  const col = bandColor(band);
  const h = size === "lg" ? 14 : size === "sm" ? 7 : 10;
  return (
    <div className="flex items-center gap-3 w-full">
      <div
        className="relative flex-1 rounded-full overflow-hidden"
        style={{ height: h, background: "#ECE8E0" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pct}%`, background: col, transitionDuration: "700ms" }}
        />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="absolute inset-y-0"
            style={{ left: `${i * 20}%`, width: 1, background: C.paper }}
          />
        ))}
      </div>
      {score > 0 && (
        <span style={{ ...fMono, color: col }} className="text-sm font-medium tabular-nums">
          {round1(score)}<span style={{ color: C.sub }}>/5</span>
        </span>
      )}
    </div>
  );
}

function BandPill({ band }) {
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

function RouteBadge({ route }) {
  const m = ROUTE_META[route] || ROUTE_META.Build;
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold"
      style={{ background: m.color, color: "#fff", ...fBody }}
    >
      <Icon size={13} strokeWidth={2.4} />
      {route}
    </span>
  );
}

function Eyebrow({ children, n }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {n && (
        <span
          style={{ ...fMono, color: C.corange }}
          className="text-xs font-semibold"
        >
          {n}
        </span>
      )}
      <span
        style={{ ...fBody, color: C.sub, letterSpacing: "0.08em" }}
        className="text-xs font-semibold uppercase"
      >
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: C.line }} />
    </div>
  );
}

function Spinner({ size = 16, color = C.corange }) {
  return (
    <span
      className="inline-block rounded-full animate-spin"
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}33`,
        borderTopColor: color,
      }}
    />
  );
}

/* ---------- intake ---------- */
function Field({ label, icon: Icon, children, hint }) {
  return (
    <label className="block">
      <span
        className="flex items-center gap-1.5 mb-1.5 text-sm font-medium"
        style={{ ...fBody, color: C.ink }}
      >
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

function Intake({ initial, onRun, error }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => {
    const v = e.target.value;
    setF((prev) => ({ ...prev, [k]: v }));
  };
  const canRun = (f.company || f.industry).trim().length > 0;

  const inputStyle = {
    ...fBody,
    border: `1px solid ${C.line}`,
    background: "#fff",
    color: C.ink,
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-5"
      style={{ background: C.paper }}
    >
      <div className="w-full" style={{ maxWidth: 560 }}>
        <div className="flex items-center gap-2 mb-5">
          <div style={{ width: 22, height: 22, background: C.corange, borderRadius: 5 }} />
          <span style={{ ...fBody, color: C.sub }} className="text-sm font-semibold tracking-wide">
            CORNERSTONE
          </span>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${C.line}`, background: C.card }}
        >
          <div style={{ background: C.charcoal }} className="px-7 pt-7 pb-6">
            <div style={{ height: 3, width: 44, background: C.corange }} className="rounded-full mb-4" />
            <h1 style={{ ...fDisplay, color: "#fff", lineHeight: 1.1 }} className="text-2xl font-bold">
              Transformation & Talent Readiness
            </h1>
            <p style={{ ...fBody, color: "#AEB4BD" }} className="mt-2 text-sm">
              Tell us who you are looking at. We research the transformation pressures, map
              them to people processes, and score how ready the workforce is to deliver.
            </p>
          </div>

          <div className="px-7 py-6 grid gap-5">
            {error && (
              <div
                className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ background: "#FEF1ED", color: "#9A2B12", ...fBody }}
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Field label="Customer name" icon={Building2}>
              <input
                value={f.company}
                onChange={set("company")}
                placeholder="e.g. Scania"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
                style={inputStyle}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Industry" icon={Factory}>
                <input
                  value={f.industry}
                  onChange={set("industry")}
                  placeholder="e.g. Commercial vehicles"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={inputStyle}
                />
              </Field>
              <Field label="Geography" icon={Globe}>
                <input
                  value={f.geography}
                  onChange={set("geography")}
                  placeholder="e.g. Western Europe"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field
              label="Transformation theme"
              icon={Layers}
              hint="Focus the analysis on one theme, or leave on all themes."
            >
              <select
                value={f.theme}
                onChange={set("theme")}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
                style={inputStyle}
              >
                <option>All themes</option>
                {THEMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Challenges" icon={BarChart3}>
                <select
                  value={f.n}
                  onChange={set("n")}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={inputStyle}
                >
                  {[3, 4, 5, 6].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Time horizon" icon={Clock}>
                <select
                  value={f.horizon}
                  onChange={set("horizon")}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={inputStyle}
                >
                  {["2 years", "3 years", "5 years"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              onClick={() => canRun && onRun(f)}
              disabled={!canRun}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity"
              style={{
                ...fBody,
                background: canRun ? C.corange : "#F0CFC4",
                color: "#fff",
                cursor: canRun ? "pointer" : "not-allowed",
              }}
            >
              Run analysis <ArrowRight size={16} />
            </button>
            <p className="text-xs text-center" style={{ color: C.sub, ...fBody }}>
              Enter at least a customer name or an industry to begin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- loading ---------- */
function Loading({ label }) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center gap-5 p-6"
      style={{ background: C.paper }}
    >
      <Spinner size={34} />
      <div className="text-center">
        <p style={{ ...fDisplay, color: C.ink }} className="text-lg font-semibold">
          {label}
        </p>
        <p style={{ ...fBody, color: C.sub }} className="text-sm mt-1">
          Researching strategy signals and labour market dynamics.
        </p>
      </div>
    </div>
  );
}

/* ---------- overview ---------- */
function Overview({ scope, execSummary, challenges, portfolio, goTo, onExport }) {
  const ranked = [...challenges]
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => (a.score ?? 9) - (b.score ?? 9));
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex justify-end mb-1">
        <button
          onClick={onExport}
          className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold"
          style={{ ...fBody, color: "#fff", background: C.charcoal }}
        >
          <Download size={15} /> Export to Word
        </button>
      </div>
      <Eyebrow>Executive summary</Eyebrow>
      <h2 style={{ ...fDisplay, color: C.ink, lineHeight: 1.15 }} className="text-3xl font-bold">
        {scope.company || scope.industry}
      </h2>
      <p style={{ ...fBody, color: C.sub }} className="mt-1 text-sm">
        {[scope.industry, scope.geography, scope.theme !== "All themes" ? scope.theme : null]
          .filter(Boolean)
          .join("  ·  ")}
        {"  ·  "}
        {scope.horizon} horizon
      </p>
      <p style={{ ...fBody, color: C.ink }} className="mt-5 text-base leading-relaxed">
        {execSummary || "Summary unavailable."}
      </p>

      <div
        className="mt-8 rounded-xl p-6"
        style={{ background: C.charcoal }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            style={{ ...fBody, color: "#AEB4BD", letterSpacing: "0.08em" }}
            className="text-xs font-semibold uppercase"
          >
            Portfolio readiness
          </span>
          {portfolio != null && <BandPill band={bandFor(portfolio)} />}
        </div>
        {portfolio != null ? (
          <>
            <div className="flex items-end gap-2 mb-3">
              <span style={{ ...fDisplay, color: "#fff" }} className="text-5xl font-bold tabular-nums">
                {round1(portfolio)}
              </span>
              <span style={{ ...fMono, color: "#AEB4BD" }} className="text-lg mb-1">/ 5</span>
            </div>
            <Meter score={portfolio} size="lg" />
          </>
        ) : (
          <div className="flex items-center gap-3 text-sm" style={{ color: "#AEB4BD", ...fBody }}>
            <Spinner color="#fff" /> Scoring challenges as they complete.
          </div>
        )}
      </div>

      <Eyebrow>Challenge portfolio</Eyebrow>
      <p style={{ ...fBody, color: C.sub }} className="-mt-1 mb-4 text-sm">
        Ordered by exposure, weakest first. Select any challenge for the full breakdown.
      </p>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        {ranked.map((c, i) => {
          const topRoute =
            c.detail?.capabilities?.length
              ? c.detail.capabilities.reduce((a, b) =>
                  clampScore(a.readiness) <= clampScore(b.readiness) ? a : b
                ).route
              : null;
          return (
            <button
              key={c.idx}
              onClick={() => goTo(c.idx)}
              className="w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors"
              style={{
                background: "#fff",
                borderTop: i === 0 ? "none" : `1px solid ${C.line}`,
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ ...fBody, color: C.ink }} className="text-sm font-semibold truncate">
                    {c.title}
                  </span>
                  <ThemeTag label={c.theme} />
                </div>
              </div>
              <div style={{ width: 130 }} className="hidden sm:block">
                {c.status === "done" ? (
                  <Meter score={c.score} size="sm" />
                ) : c.status === "error" ? (
                  <span className="text-xs" style={{ color: C.exposed, ...fBody }}>Failed</span>
                ) : (
                  <Spinner size={14} />
                )}
              </div>
              <div style={{ width: 88 }} className="hidden md:flex justify-start">
                {topRoute && <RouteBadge route={topRoute} />}
              </div>
              {c.band ? <BandPill band={c.band} /> : <span style={{ width: 60 }} />}
              <ArrowRight size={16} style={{ color: C.sub }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- challenge detail ---------- */
function InfoCard({ label, children, accent }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "#fff", border: `1px solid ${C.line}` }}
    >
      <div
        className="text-xs font-semibold uppercase mb-1.5"
        style={{ ...fBody, color: accent || C.sub, letterSpacing: "0.06em" }}
      >
        {label}
      </div>
      <div style={{ ...fBody, color: C.ink }} className="text-sm leading-snug">
        {children}
      </div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span
      className="inline-flex rounded-md px-2 py-1 text-xs font-medium"
      style={{ background: "#F1EFEA", color: C.ink, ...fBody }}
    >
      {children}
    </span>
  );
}

function Challenge({ c, index, total, onRetry }) {
  if (c.status === "loading" || c.status === "pending") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 flex flex-col items-center gap-4">
        <Spinner size={28} />
        <p style={{ ...fBody, color: C.sub }} className="text-sm">
          Analysing “{c.title}”
        </p>
      </div>
    );
  }
  if (c.status === "error") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 flex flex-col items-center gap-4 text-center">
        <AlertTriangle size={26} style={{ color: C.exposed }} />
        <p style={{ ...fBody, color: C.ink }} className="text-sm">
          This challenge did not come back cleanly.
        </p>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ ...fBody, background: C.charcoal, color: "#fff" }}
        >
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }

  const d = c.detail;
  const coi = d.costOfInaction || {};
  const coiRows = [
    ["Commercial", coi.commercial],
    ["Operational", coi.operational],
    ["Competitive", coi.competitive],
    ["Regulatory", coi.regulatory],
    ["Talent", coi.talent],
  ].filter(([, v]) => v);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* header */}
      <div className="flex items-center gap-2 mb-2">
        <span style={{ ...fMono, color: C.corange }} className="text-sm font-semibold">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <ThemeTag label={c.theme} />
        {c.secondaryTheme && <ThemeTag label={c.secondaryTheme} secondary />}
      </div>
      <h2 style={{ ...fDisplay, color: C.ink, lineHeight: 1.15 }} className="text-2xl font-bold">
        {c.title}
      </h2>
      <p style={{ ...fBody, color: C.sub }} className="mt-2 text-sm leading-relaxed">
        {c.summary}
      </p>

      <div
        className="mt-4 flex items-center gap-4 rounded-lg px-4 py-3"
        style={{ background: "#fff", border: `1px solid ${C.line}` }}
      >
        <div className="flex-1" style={{ maxWidth: 280 }}>
          <Meter score={c.score} />
        </div>
        <BandPill band={c.band} />
        <span style={{ ...fBody, color: C.sub }} className="text-xs hidden sm:block">
          Challenge readiness
        </span>
      </div>

      {/* A */}
      <div className="mt-9">
        <Eyebrow n="A">The challenge</Eyebrow>
        <InfoCard label="How long this has been live" accent={C.teal}>
          {d.duration}
        </InfoCard>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {coiRows.map(([k, v]) => (
            <div
              key={k}
              className="rounded-lg p-3.5"
              style={{ background: "#fff", border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.corange}` }}
            >
              <div
                className="text-xs font-semibold uppercase mb-1"
                style={{ ...fBody, color: C.corange, letterSpacing: "0.05em" }}
              >
                {k}
              </div>
              <div style={{ ...fBody, color: C.ink }} className="text-sm leading-snug">
                {v}
              </div>
            </div>
          ))}
        </div>
        <p style={{ ...fBody, color: C.sub }} className="mt-2 text-xs">
          Cost of inaction within the {/* horizon injected by parent via summary */}horizon.
        </p>
      </div>

      {/* B */}
      {d.peopleProcesses?.length > 0 && (
        <div className="mt-9">
          <Eyebrow n="B">People process alignment</Eyebrow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {d.peopleProcesses.map((p, i) => (
              <div
                key={i}
                className="rounded-lg p-4"
                style={{ background: "#fff", border: `1px solid ${C.line}` }}
              >
                <div style={{ ...fBody, color: C.teal }} className="text-sm font-semibold mb-1">
                  {p.process}
                </div>
                <div style={{ ...fBody, color: C.ink }} className="text-sm leading-snug">
                  {p.role}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* C */}
      {d.capabilities?.length > 0 && (
        <div className="mt-9">
          <Eyebrow n="C">Skills and capability readiness</Eyebrow>
          {(d.skills?.technical?.length || d.skills?.behavioural?.length) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {d.skills?.technical?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: C.sub, ...fBody }}>
                    Technical and domain skills
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.skills.technical.map((s, i) => <Chip key={i}>{s}</Chip>)}
                  </div>
                </div>
              )}
              {d.skills?.behavioural?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: C.sub, ...fBody }}>
                    Leadership and behavioural skills
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.skills.behavioural.map((s, i) => <Chip key={i}>{s}</Chip>)}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {d.capabilities.map((cap, i) => {
              const sc = clampScore(cap.readiness);
              const signals = [
                ["Internal supply", cap.internalSupply],
                ["Adjacency", cap.adjacency],
                ["External scarcity", cap.externalScarcity],
                ["Build time", cap.buildTime],
                ["Skill half-life", cap.halfLife],
              ].filter(([, v]) => v);
              return (
                <div
                  key={i}
                  className="rounded-lg p-4"
                  style={{ background: "#fff", border: `1px solid ${C.line}` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span style={{ ...fBody, color: C.ink }} className="text-sm font-semibold">
                      {cap.name}
                    </span>
                    <div style={{ width: 120 }} className="shrink-0">
                      <Meter score={sc} size="sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2.5">
                    {signals.map(([k, v]) => (
                      <div key={k}>
                        <div
                          className="text-xs font-semibold uppercase mb-0.5"
                          style={{ ...fBody, color: C.sub, letterSpacing: "0.04em" }}
                        >
                          {k}
                        </div>
                        <div style={{ ...fBody, color: C.ink }} className="text-xs leading-snug">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  {cap.justification && (
                    <p
                      className="mt-3 pt-3 text-xs leading-snug"
                      style={{ ...fBody, color: C.sub, borderTop: `1px solid ${C.line}` }}
                    >
                      {cap.justification}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* D */}
      {d.capabilities?.length > 0 && (
        <div className="mt-9 mb-4">
          <Eyebrow n="D">Sourcing strategy</Eyebrow>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(ROUTE_META).map(([r, m]) => (
              <span key={r} className="inline-flex items-center gap-1.5 text-xs" style={{ color: C.sub, ...fBody }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: m.color }} />
                <b style={{ color: C.ink }}>{r}</b> {m.blurb}
              </span>
            ))}
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
            <div
              className="hidden md:grid px-4 py-2.5 text-xs font-semibold uppercase"
              style={{ background: "#F1EFEA", color: C.sub, gridTemplateColumns: "1.4fr 0.9fr 0.8fr 1.6fr 1.4fr", gap: 12, ...fBody, letterSpacing: "0.04em" }}
            >
              <span>Capability</span><span>Readiness</span><span>Route</span><span>Trigger</span><span>Watch-out</span>
            </div>
            {d.capabilities.map((cap, i) => (
              <div
                key={i}
                className="grid grid-cols-1 md:grid-cols-none px-4 py-3"
                style={{
                  background: "#fff",
                  borderTop: `1px solid ${C.line}`,
                  gridTemplateColumns: "1.4fr 0.9fr 0.8fr 1.6fr 1.4fr",
                  gap: 12,
                }}
              >
                <span style={{ ...fBody, color: C.ink }} className="text-sm font-medium">{cap.name}</span>
                <div className="flex items-center" style={{ maxWidth: 90 }}>
                  <Meter score={clampScore(cap.readiness)} size="sm" />
                </div>
                <span><RouteBadge route={cap.route} /></span>
                <span style={{ ...fBody, color: C.sub }} className="text-xs leading-snug">{cap.trigger}</span>
                <span style={{ ...fBody, color: C.sub }} className="text-xs leading-snug">{cap.watchOut}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- sidebar ---------- */
function Sidebar({ scope, active, challenges, portfolio, onSelect, onReset, onExport }) {
  return (
    <aside
      className="hidden md:flex flex-col shrink-0"
      style={{ width: 280, background: C.charcoal, height: "100vh", position: "sticky", top: 0 }}
    >
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid #2A323E" }}>
        <div className="flex items-center gap-2 mb-4">
          <div style={{ width: 18, height: 18, background: C.corange, borderRadius: 4 }} />
          <span style={{ ...fBody, color: "#AEB4BD" }} className="text-xs font-semibold tracking-wide">
            CORNERSTONE
          </span>
        </div>
        <div style={{ ...fDisplay, color: "#fff" }} className="text-base font-bold leading-tight">
          {scope.company || scope.industry}
        </div>
        {portfolio != null && (
          <div className="flex items-center gap-2 mt-3">
            <span style={{ ...fMono, color: "#fff" }} className="text-sm">
              {round1(portfolio)}<span style={{ color: "#69727E" }}>/5</span>
            </span>
            <BandPill band={bandFor(portfolio)} />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavItem
          label="Overview"
          activeNow={active === "overview"}
          onClick={() => onSelect("overview")}
        />
        <div style={{ ...fBody, color: "#69727E", letterSpacing: "0.08em" }} className="px-3 mt-4 mb-1.5 text-xs font-semibold uppercase">
          Challenges
        </div>
        {challenges.map((c, i) => (
          <NavItem
            key={i}
            n={String(i + 1).padStart(2, "0")}
            label={c.title}
            activeNow={active === i}
            onClick={() => onSelect(i)}
            status={c.status}
            band={c.band}
          />
        ))}
      </nav>

      <div className="px-3 py-4 flex flex-col gap-1.5" style={{ borderTop: "1px solid #2A323E" }}>
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold"
          style={{ ...fBody, color: "#fff", background: C.corange }}
        >
          <Download size={15} /> Export to Word
        </button>
        <button
          onClick={onReset}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          style={{ ...fBody, color: "#AEB4BD", background: "transparent" }}
        >
          <Plus size={15} /> New analysis
        </button>
      </div>
    </aside>
  );
}

function NavItem({ n, label, activeNow, onClick, status, band }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors mb-0.5"
      style={{ background: activeNow ? "#252D38" : "transparent" }}
    >
      {n && (
        <span style={{ ...fMono, color: activeNow ? C.corange : "#69727E" }} className="text-xs shrink-0">
          {n}
        </span>
      )}
      <span
        style={{ ...fBody, color: activeNow ? "#fff" : "#C2C7CE" }}
        className="text-sm flex-1 truncate"
      >
        {label}
      </span>
      {status === "loading" || status === "pending" ? (
        <Spinner size={11} color="#69727E" />
      ) : status === "error" ? (
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "#69727E" }} />
      ) : band ? (
        <span style={{ width: 8, height: 8, borderRadius: 99, background: bandColor(band) }} />
      ) : null}
    </button>
  );
}

/* ---------- mobile nav ---------- */
function MobileBar({ active, challenges, onSelect, onReset, onExport }) {
  const val = active === "overview" ? "overview" : String(active);
  return (
    <div
      className="md:hidden sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5"
      style={{ background: C.charcoal }}
    >
      <select
        value={val}
        onChange={(e) =>
          onSelect(e.target.value === "overview" ? "overview" : Number(e.target.value))
        }
        className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
        style={{ ...fBody, background: "#252D38", color: "#fff", border: "none" }}
      >
        <option value="overview">Overview</option>
        {challenges.map((c, i) => (
          <option key={i} value={i}>{`${i + 1}. ${c.title}`}</option>
        ))}
      </select>
      <button
        onClick={onExport}
        className="rounded-lg p-2"
        style={{ background: C.corange, color: "#fff" }}
        aria-label="Export to Word"
      >
        <Download size={16} />
      </button>
      <button
        onClick={onReset}
        className="rounded-lg p-2"
        style={{ background: "#252D38", color: "#AEB4BD" }}
        aria-label="New analysis"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [view, setView] = useState("intake"); // intake | loading | results
  const [error, setError] = useState(null);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [scope, setScope] = useState(null);
  const [execSummary, setExecSummary] = useState("");
  const [challenges, setChallenges] = useState([]);
  const [active, setActive] = useState("overview");
  const runId = useRef(0);

  const initial = {
    company: "",
    industry: "",
    geography: "",
    theme: "All themes",
    n: 4,
    horizon: "3 years",
  };

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
    return () => { try { document.head.removeChild(l); } catch (e) {} };
  }, []);

  const portfolio = useMemo(() => {
    const scores = challenges.filter((c) => c.status === "done" && c.score != null).map((c) => c.score);
    return scores.length ? round1(mean(scores)) : null;
  }, [challenges]);

  const updateChallenge = (i, patch) =>
    setChallenges((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  async function loadDetail(i, stub, scopeArg, myRun) {
    updateChallenge(i, { status: "loading" });
    try {
      const txt = await callClaude({
        system: detailSystem(),
        user: detailUser(scopeArg, stub),
        useSearch: false,
      });
      if (runId.current !== myRun) return;
      const d = extractJson(txt);
      const caps = (d.capabilities || []).map((c) => ({ ...c, readiness: clampScore(c.readiness) }));
      d.capabilities = caps;
      const score = caps.length ? round1(mean(caps.map((c) => c.readiness))) : null;
      updateChallenge(i, {
        status: "done",
        detail: d,
        score,
        band: score != null ? bandFor(score) : null,
      });
    } catch (e) {
      if (runId.current !== myRun) return;
      updateChallenge(i, { status: "error" });
    }
  }

  async function run(form) {
    const myRun = ++runId.current;
    const s = { ...form, n: Number(form.n) };
    setScope(s);
    setError(null);
    setExecSummary("");
    setChallenges([]);
    setActive("overview");
    setLoadingLabel(`Researching ${s.company || s.industry}`);
    setView("loading");
    try {
      const ovText = await callClaude({
        system: overviewSystem(),
        user: overviewUser(s),
        useSearch: true,
      });
      if (runId.current !== myRun) return;
      const ov = extractJson(ovText);
      const stubs = (ov.challenges || []).slice(0, s.n).map((c) => ({
        title: c.title || "Untitled challenge",
        theme: c.theme || "",
        secondaryTheme: c.secondaryTheme || "",
        summary: c.summary || "",
        status: "pending",
        detail: null,
        score: null,
        band: null,
      }));
      if (!stubs.length) throw new Error("No challenges were returned. Try refining the scope.");
      setExecSummary(ov.executiveSummary || "");
      setChallenges(stubs);
      setView("results");
      for (let i = 0; i < stubs.length; i++) {
        if (runId.current !== myRun) return;
        await loadDetail(i, stubs[i], s, myRun);
      }
    } catch (e) {
      if (runId.current !== myRun) return;
      setError(e.message || "Something went wrong. Try again.");
      setView("intake");
    }
  }

  function retry(i) {
    const myRun = runId.current;
    loadDetail(i, challenges[i], scope, myRun);
  }

  function reset() {
    runId.current++;
    setView("intake");
    setError(null);
    setChallenges([]);
    setActive("overview");
  }

  function downloadWord() {
    try {
      const html = buildWordHtml(scope, execSummary, challenges, portfolio);
      const blob = new Blob(["\ufeff", html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const base = (scope.company || scope.industry || "analysis")
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_|_$/g, "");
      a.href = url;
      a.download = `${base}_Transformation_Readiness.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {}
  }

  if (view === "intake") return <Intake initial={initial} onRun={run} error={error} />;
  if (view === "loading") return <Loading label={loadingLabel} />;

  return (
    <div style={{ ...fBody, background: C.paper, minHeight: "100vh" }} className="flex">
      <Sidebar
        scope={scope}
        active={active}
        challenges={challenges}
        portfolio={portfolio}
        onSelect={setActive}
        onReset={reset}
        onExport={downloadWord}
      />
      <main className="flex-1 min-w-0">
        <MobileBar active={active} challenges={challenges} onSelect={setActive} onReset={reset} onExport={downloadWord} />
        {active === "overview" ? (
          <Overview
            scope={scope}
            execSummary={execSummary}
            challenges={challenges}
            portfolio={portfolio}
            goTo={setActive}
            onExport={downloadWord}
          />
        ) : (
          <Challenge
            c={challenges[active]}
            index={active}
            total={challenges.length}
            onRetry={() => retry(active)}
          />
        )}
      </main>
    </div>
  );
}
