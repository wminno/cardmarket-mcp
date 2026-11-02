import { AsyncLocalStorage } from "node:async_hooks";
import { oauthHeader } from "./oauth.js";

// In remote (HTTP) mode credentials come ONLY from per-request headers (never from server env, never stored).
export const requestEnv = new AsyncLocalStorage();
const E = () => requestEnv.getStore() ?? process.env;

const UA = "cardmarket-mcp/0.1.0 (AI-authored open-source MCP server; read-only)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Scryfall (free, public, no key). Attribution required; 50-100ms between calls. ----
let lastScry = 0;
export async function scryfall(path, params = {}) {
  const wait = lastScry + 110 - Date.now();
  if (wait > 0) await sleep(wait);
  lastScry = Date.now();
  const u = new URL("https://api.scryfall.com" + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json;q=0.9,*/*;q=0.8" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Scryfall ${res.status}: ${body.details || res.statusText}`);
  return body;
}

// ---- Cardmarket API v2.0 (OAuth1, user-supplied credentials via env). GET only. ----
export function cardmarketCreds(env = E()) {
  const c = { appToken: env.CARDMARKET_APP_TOKEN, appSecret: env.CARDMARKET_APP_SECRET, accessToken: env.CARDMARKET_ACCESS_TOKEN, accessTokenSecret: env.CARDMARKET_ACCESS_TOKEN_SECRET };
  const missing = Object.entries({ CARDMARKET_APP_TOKEN: c.appToken, CARDMARKET_APP_SECRET: c.appSecret, CARDMARKET_ACCESS_TOKEN: c.accessToken, CARDMARKET_ACCESS_TOKEN_SECRET: c.accessTokenSecret }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Cardmarket credentials missing: set env ${missing.join(", ")} (your own Cardmarket API app credentials; this server never stores them).`);
  return c;
}
export async function cardmarket(path, params = {}) {
  const creds = cardmarketCreds();
  const base = E().CARDMARKET_BASE_URL || "https://api.cardmarket.com/ws/v2.0/output.json";
  const u = new URL(base + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  const { header } = oauthHeader({ method: "GET", url: u.toString(), creds });
  const res = await fetch(u, { method: "GET", headers: { Authorization: header, "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 204) return {};
  const text = await res.text();
  if (!res.ok) throw new Error(`Cardmarket ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new Error("Cardmarket returned non-JSON response"); }
}

// ---- TCGplayer API (bearer token from user-supplied public/private key). GET catalog/pricing only. ----
const tcgTokens = new Map();
export async function tcgplayer(path, params = {}) {
  const id = E().TCGPLAYER_CLIENT_ID, secret = E().TCGPLAYER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("TCGplayer credentials missing: set env TCGPLAYER_CLIENT_ID and TCGPLAYER_CLIENT_SECRET (your own API keys; never stored).");
  const base = E().TCGPLAYER_BASE_URL || "https://api.tcgplayer.com";
  let tcgToken = tcgTokens.get(id);
  if (!tcgToken || tcgToken.exp < Date.now() + 60000) {
    const r = await fetch(base + "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(`TCGplayer auth failed (${r.status}): ${j.error_description || j.error || "check your keys"}`);
    tcgToken = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
    tcgTokens.set(id, tcgToken);
  }
  const u = new URL(base + "/v1.39.0" + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  const res = await fetch(u, { headers: { Authorization: "bearer " + tcgToken.value, "User-Agent": UA, Accept: "application/json" } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`TCGplayer ${res.status}: ${(j.Errors || []).join("; ") || res.statusText}`);
  return j;
}
