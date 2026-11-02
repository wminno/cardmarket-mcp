import { z } from "zod";
import { scryfall, cardmarket, tcgplayer } from "./clients.js";
import { suggestReprice, summarizeListings } from "./reprice.js";

const ATTR = "Card data & prices via Scryfall (https://scryfall.com). Scryfall prices are informational, updated once per 24h; not a guarantee of sale price. Magic: The Gathering is © Wizards of the Coast.";
const num = (x) => (x === null || x === undefined || x === "" ? undefined : Number(x));

const slimScry = (c) => ({
  id: c.id, name: c.name, set: c.set, set_name: c.set_name, collector_number: c.collector_number, rarity: c.rarity,
  type_line: c.type_line, mana_cost: c.mana_cost, released_at: c.released_at,
  prices: c.prices, cardmarket_id: c.cardmarket_id, tcgplayer_id: c.tcgplayer_id, scryfall_uri: c.scryfall_uri,
  purchase_uris: c.purchase_uris,
});

// Pull comparable listing prices for a Cardmarket product (read-only).
async function cmArticles(productId, o) {
  const j = await cardmarket(`/articles/${productId}`, { start: 0, maxResults: o.limit ?? 100, minCondition: o.minCondition, idLanguage: o.languageId, isFoil: o.foil === undefined ? undefined : String(o.foil), userType: o.userType });
  return (j.article || []).map((a) => ({
    idArticle: a.idArticle, price: a.price, count: a.count, condition: a.condition, language: a.language?.languageName, foil: !!a.isFoil,
    seller: a.seller?.username, sellerCountry: a.seller?.address?.country || a.seller?.country, sellerType: a.seller?.isCommercial === 2 ? "powerseller" : a.seller?.isCommercial === 1 ? "professional" : "private",
  }));
}

export const tools = [
  {
    name: "scryfall_search_cards", title: "Search MTG cards (free, Scryfall)",
    description: "FREE tier. Search Magic cards with Scryfall syntax (e.g. 'o:flying t:dragon'). Returns ids, set info, and USD/EUR/TIX prices, plus Cardmarket/TCGplayer product ids for use with the paid-API tools. Requires no credentials.",
    schema: { query: z.string().describe("Scryfall search query"), limit: z.number().int().min(1).max(25).default(10), unique: z.enum(["cards", "art", "prints"]).default("prints") },
    run: async ({ query, limit = 10, unique = "prints" }) => {
      const j = await scryfall("/cards/search", { q: query, unique, order: "released", dir: "desc" });
      return { attribution: ATTR, total_found: j.total_cards, cards: (j.data || []).slice(0, limit).map(slimScry) };
    },
  },
  {
    name: "scryfall_card_prices", title: "Card price lookup (free, Scryfall)",
    description: "FREE tier. Fuzzy-name card lookup returning all printings' prices (usd, usd_foil, eur, eur_foil, tix) from Scryfall bulk-derived data, updated daily. No credentials.",
    schema: { name: z.string(), set: z.string().optional().describe("Set code, e.g. 'mh3'"), all_printings: z.boolean().default(false) },
    run: async ({ name, set, all_printings = false }) => {
      const c = await scryfall("/cards/named", { fuzzy: name, set });
      if (!all_printings) return { attribution: ATTR, card: slimScry(c) };
      const p = await scryfall("/cards/search", { q: `!"${c.name}"`, unique: "prints", order: "released", dir: "desc" });
      return { attribution: ATTR, card: c.name, printings: (p.data || []).slice(0, 60).map(slimScry) };
    },
  },
  {
    name: "cardmarket_product_search", title: "Cardmarket product search (BYO key)",
    description: "Search Cardmarket products by name (Magic by default, idGame=1). Requires your own Cardmarket API credentials in env (CARDMARKET_APP_TOKEN, CARDMARKET_APP_SECRET, CARDMARKET_ACCESS_TOKEN, CARDMARKET_ACCESS_TOKEN_SECRET). Read-only.",
    schema: { search: z.string(), idGame: z.number().int().default(1), idLanguage: z.number().int().default(1).describe("1=English"), exact: z.boolean().default(false), maxResults: z.number().int().min(1).max(100).default(20) },
    run: async ({ search, idGame = 1, idLanguage = 1, exact = false, maxResults = 20 }) => {
      const j = await cardmarket("/products/find", { search, idGame, idLanguage, exact: String(exact), start: 0, maxResults });
      return { products: (j.product || []).map((p) => ({ idProduct: p.idProduct, name: p.enName, localName: p.locName, expansion: p.expansionName || p.expansion, rarity: p.rarity, number: p.number, website: p.website, priceGuide: p.priceGuide })) };
    },
  },
  {
    name: "cardmarket_price_guide", title: "Cardmarket price guide (BYO key)",
    description: "Get the Cardmarket price guide (SELL, LOW, LOWEX, AVG, TREND, foil variants, 1/7/30-day averages) for a product id. Requires your own Cardmarket credentials. Read-only.",
    schema: { idProduct: z.number().int() },
    run: async ({ idProduct }) => {
      const j = await cardmarket(`/products/${idProduct}`);
      const p = j.product || {};
      return { idProduct, name: p.enName, expansion: p.expansionName || p.expansion?.enName, priceGuide: p.priceGuide, countArticles: p.countArticles, countFoilArticles: p.countFoilArticles, link: p.website ? "https://www.cardmarket.com" + p.website : undefined };
    },
  },
  {
    name: "cardmarket_compare_sellers", title: "Compare Cardmarket sellers & prices (BYO key)",
    description: "Lists current offers for a Cardmarket product (cheapest first) with seller, country, condition, language, foil, quantity, plus price distribution stats. Optionally filter by min condition (MT,NM,EX,GD,LP,PL,PO), language id, foil, seller type. Requires your own Cardmarket credentials. Read-only.",
    schema: { idProduct: z.number().int(), minCondition: z.enum(["MT", "NM", "EX", "GD", "LP", "PL", "PO"]).optional(), languageId: z.number().int().optional(), foil: z.boolean().optional(), userType: z.enum(["private", "commercial", "powerseller"]).optional(), limit: z.number().int().min(1).max(500).default(50) },
    run: async (a) => {
      const arts = (await cmArticles(a.idProduct, a)).sort((x, y) => x.price - y.price);
      return { idProduct: a.idProduct, stats: summarizeListings(arts.map((x) => x.price)), offers: arts.slice(0, 25) };
    },
  },
  {
    name: "cardmarket_seller_stock", title: "A seller's stock on Cardmarket (BYO key)",
    description: "Read-only view of a given Cardmarket seller's public stock (username or user id), optionally filtered by game and a name search, so you can compare their prices against market. Requires your own Cardmarket credentials.",
    schema: { user: z.string().describe("Cardmarket username or id"), idGame: z.number().int().default(1), start: z.number().int().min(0).default(0), maxResults: z.number().int().min(1).max(200).default(50) },
    run: async ({ user, idGame = 1, start = 0, maxResults = 50 }) => {
      const j = await cardmarket(`/users/${encodeURIComponent(user)}/articles`, { idGame, start, maxResults });
      return { seller: user, articles: (j.article || []).map((a) => ({ idArticle: a.idArticle, idProduct: a.idProduct, name: a.product?.enName, expansion: a.product?.expansion, price: a.price, count: a.count, condition: a.condition, language: a.language?.languageName, foil: !!a.isFoil })) };
    },
  },
  {
    name: "tcgplayer_product_search", title: "TCGplayer product search (BYO key)",
    description: "Search TCGplayer catalog products by name. Magic is categoryId 1. Requires your own TCGplayer API keys in env (TCGPLAYER_CLIENT_ID, TCGPLAYER_CLIENT_SECRET). Read-only. Note: TCGplayer is not currently issuing new API keys to everyone; this works only if you already have access.",
    schema: { productName: z.string(), categoryId: z.number().int().default(1), limit: z.number().int().min(1).max(50).default(20) },
    run: async ({ productName, categoryId = 1, limit = 20 }) => {
      const j = await tcgplayer("/catalog/products", { categoryId, productName, limit, offset: 0 });
      return { products: (j.results || []).map((p) => ({ productId: p.productId, name: p.name, groupId: p.groupId, url: p.url })) };
    },
  },
  {
    name: "tcgplayer_price_guide", title: "TCGplayer market prices (BYO key)",
    description: "Market/low/mid/high/direct-low prices per subtype (Normal/Foil) for up to 50 TCGplayer product ids. Requires your own TCGplayer keys. Read-only.",
    schema: { productIds: z.array(z.number().int()).min(1).max(50) },
    run: async ({ productIds }) => {
      const j = await tcgplayer(`/pricing/product/${productIds.join(",")}`);
      return { prices: j.results || [] };
    },
  },
  {
    name: "reprice_suggest", title: "Repricing suggestion (advice only)",
    description: "Suggests a new price for ONE of your listings. SUGGESTION ONLY — this server never creates, edits or deletes listings. Provide your current price plus either (a) marketplace='cardmarket' with idProduct (fetches live data with your creds), or (b) marketplace='manual' with your own reference numbers. Strategies: competitive (default), undercut_lowest, match_trend, premium.",
    schema: {
      marketplace: z.enum(["cardmarket", "tcgplayer", "manual"]).default("manual"),
      id: z.number().int().optional().describe("Cardmarket idProduct or TCGplayer productId"),
      currentPrice: z.number().positive(),
      strategy: z.enum(["competitive", "undercut_lowest", "match_trend", "premium"]).default("competitive"),
      undercutPct: z.number().min(0).max(50).default(1),
      floorPrice: z.number().min(0).default(0).describe("Never suggest below this (your cost basis)"),
      minCondition: z.enum(["MT", "NM", "EX", "GD", "LP", "PL", "PO"]).optional(),
      foil: z.boolean().optional(),
      lowest: z.number().optional(), trend: z.number().optional(), average: z.number().optional(),
      competitorPrices: z.array(z.number()).optional(),
    },
    run: async (a) => {
      let { lowest, trend, average, competitorPrices } = a;
      if (a.marketplace === "cardmarket") {
        if (!a.id) throw new Error("id (Cardmarket idProduct) required for marketplace=cardmarket");
        const g = (await cardmarket(`/products/${a.id}`)).product?.priceGuide || {};
        trend = num(a.foil ? g.TRENDFOIL : g.TREND) ?? trend; average = num(g.AVG) ?? average;
        const arts = await cmArticles(a.id, { minCondition: a.minCondition, foil: a.foil, limit: 100 });
        competitorPrices = arts.map((x) => x.price);
      } else if (a.marketplace === "tcgplayer") {
        if (!a.id) throw new Error("id (TCGplayer productId) required for marketplace=tcgplayer");
        const r = (await tcgplayer(`/pricing/product/${a.id}`)).results || [];
        const row = r.find((x) => (a.foil ? /foil/i : /normal/i).test(x.subTypeName)) || r[0];
        if (row) { trend = num(row.marketPrice) ?? trend; lowest = num(row.lowPrice) ?? lowest; average = num(row.midPrice) ?? average; }
      }
      return suggestReprice({ ...a, lowest, trend, average, competitorPrices });
    },
  },
];
