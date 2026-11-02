// Stateless streamable-HTTP transport. BYO-key: credentials are read from per-request headers
// (x-cardmarket-app-token, x-cardmarket-app-secret, x-cardmarket-access-token, x-cardmarket-access-token-secret,
//  x-tcgplayer-client-id, x-tcgplayer-client-secret), used for that request only, never stored or logged.
import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";
import { requestEnv } from "./clients.js";

const PORT = Number(process.env.PORT || 8080);
const H = { "x-cardmarket-app-token": "CARDMARKET_APP_TOKEN", "x-cardmarket-app-secret": "CARDMARKET_APP_SECRET", "x-cardmarket-access-token": "CARDMARKET_ACCESS_TOKEN", "x-cardmarket-access-token-secret": "CARDMARKET_ACCESS_TOKEN_SECRET", "x-tcgplayer-client-id": "TCGPLAYER_CLIENT_ID", "x-tcgplayer-client-secret": "TCGPLAYER_CLIENT_SECRET" };

const card = {
  name: "net.bigfloppy.cardmarket", title: "cardmarket-mcp", version: "0.1.0",
  description: "Read-only BYO-key MCP for MTG pricing: Scryfall free tier, Cardmarket & TCGplayer with your own keys (sent per request via headers, never stored), repricing suggestions only. AI-authored.",
  transport: { type: "streamable-http", endpoint: "/mcp" },
  authentication: { required: false, note: "Optional per-request x-cardmarket-* / x-tcgplayer-* headers for paid-API tools." },
};

const body = (req) => new Promise((res, rej) => { let d = ""; req.on("data", (c) => { d += c; if (d.length > 1e6) { rej(new Error("too large")); req.destroy(); } }); req.on("end", () => res(d)); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, obj, type = "application/json") => { res.writeHead(code, { "content-type": type, "access-control-allow-origin": "*" }); res.end(req.method === "HEAD" ? undefined : typeof obj === "string" ? obj : JSON.stringify(obj)); };
  if (url.pathname === "/health" || url.pathname === "/api/health") return send(200, { ok: true });
  if (url.pathname === "/.well-known/mcp/server-card.json" || url.pathname === "/.well-known/mcp/server-card") return send(200, card);
  if (url.pathname === "/") return send(200, "cardmarket-mcp — AI-authored, read-only BYO-key MCP for MTG pricing. MCP endpoint: POST /mcp . Source: see README.\n", "text/plain");
  if (url.pathname !== "/mcp") return send(404, { error: "not found" });
  if (req.method !== "POST") return send(405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server: use POST)" }, id: null });
  try {
    const env = {};
    for (const [h, k] of Object.entries(H)) if (req.headers[h]) env[k] = String(req.headers[h]);
    const payload = JSON.parse((await body(req)) || "{}");
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await requestEnv.run(env, () => transport.handleRequest(req, res, payload));
  } catch (e) {
    if (!res.headersSent) send(500, { jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
}).listen(PORT, () => console.error(`cardmarket-mcp http on :${PORT}`));
