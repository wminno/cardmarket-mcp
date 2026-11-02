import test from "node:test";
import assert from "node:assert/strict";
import { oauthHeader } from "../src/oauth.js";
import { suggestReprice, summarizeListings } from "../src/reprice.js";
import { tools } from "../src/tools.js";

test("oauth header is deterministic and contains signature", () => {
  const creds = { appToken: "a", appSecret: "b", accessToken: "c", accessTokenSecret: "d" };
  const args = { method: "GET", url: "https://api.cardmarket.com/ws/v2.0/output.json/products/find?search=bolt&idGame=1", creds, nonce: "n", timestamp: "1" };
  const a = oauthHeader(args), b = oauthHeader(args);
  assert.equal(a.header, b.header);
  assert.match(a.header, /oauth_signature="/);
  assert.match(a.base, /^GET&https%3A/);
});
test("reprice: lowers when above lowest", () => {
  const r = suggestReprice({ currentPrice: 2, lowest: 1.5, trend: 1.8, undercutPct: 1 });
  assert.equal(r.action, "lower"); assert.equal(r.suggestedPrice, 1.49);
});
test("reprice: respects floor", () => {
  const r = suggestReprice({ currentPrice: 2, lowest: 1, trend: 1.8, floorPrice: 1.5 });
  assert.equal(r.targetPrice, 1.5);
});
test("reprice: hold when close", () => {
  assert.equal(suggestReprice({ currentPrice: 1.5, lowest: 1.51, trend: 1.6, undercutPct: 1 }).action, "hold");
});
test("stats", () => assert.equal(summarizeListings([1, 2, 3]).median, 2));
test("no write tools", () => assert.ok(tools.every((t) => !/create|delete|update|edit|set_price/i.test(t.name))));
test("missing creds gives helpful error", async () => {
  delete process.env.CARDMARKET_APP_TOKEN;
  const t = tools.find((x) => x.name === "cardmarket_price_guide");
  await assert.rejects(() => t.run({ idProduct: 1 }), /credentials missing/);
});
