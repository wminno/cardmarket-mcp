# cardmarket-mcp

> **AI authorship disclosure:** this project was written entirely by an autonomous AI agent (`mtg-builder-1`, part of an experimental agent fleet). It has been tested with unit tests and live Scryfall calls only; the Cardmarket/TCGplayer paths have **not** been exercised against live accounts by the author — please report issues.

A **read-only, bring-your-own-key** [MCP](https://modelcontextprotocol.io) server for Magic: The Gathering pricing on **Cardmarket** and **TCGplayer**, with a free no-key tier powered by **Scryfall**.

- **BYO key:** you supply your own API credentials as environment variables. They are used only to sign requests from your machine to the marketplace; this project never stores, logs or transmits them anywhere else. There is no hosted backend.
- **Read-only:** no tool creates, edits or deletes listings. `reprice_suggest` returns *suggestions only*.
- **No scraping:** official APIs only.

## Tools

| Tool | Needs | What it does |
|---|---|---|
| `scryfall_search_cards` | nothing | Scryfall-syntax search, prices + Cardmarket/TCGplayer ids |
| `scryfall_card_prices` | nothing | Fuzzy name lookup, optionally all printings, USD/EUR/TIX prices |
| `cardmarket_product_search` | Cardmarket keys | Find product ids |
| `cardmarket_price_guide` | Cardmarket keys | SELL/LOW/AVG/TREND (+foil, 1/7/30d avg) |
| `cardmarket_compare_sellers` | Cardmarket keys | Cheapest offers w/ seller, country, condition, language; price distribution |
| `cardmarket_seller_stock` | Cardmarket keys | A seller's public stock |
| `tcgplayer_product_search` | TCGplayer keys | Catalog search |
| `tcgplayer_price_guide` | TCGplayer keys | Market/low/mid/high per product |
| `reprice_suggest` | none (manual) or keys | Suggested price for one listing: strategies `competitive`, `undercut_lowest`, `match_trend`, `premium`; floor price; hold-band |

## Install / configure

Requires Node 18+.

```json
{
  "mcpServers": {
    "cardmarket": {
      "command": "npx",
      "args": ["-y", "github:REPO_OWNER/cardmarket-mcp"],
      "env": {
        "CARDMARKET_APP_TOKEN": "...",
        "CARDMARKET_APP_SECRET": "...",
        "CARDMARKET_ACCESS_TOKEN": "...",
        "CARDMARKET_ACCESS_TOKEN_SECRET": "...",
        "TCGPLAYER_CLIENT_ID": "...",
        "TCGPLAYER_CLIENT_SECRET": "..."
      }
    }
  }
}
```

All env vars are optional; omit the ones for services you don't use (Scryfall tools need none). Get Cardmarket credentials from your Cardmarket account → *API* page (a "dedicated app" gives you all four values). Note: TCGplayer has restricted issuing new API keys; that path only works if you already have access.

## Remote (streamable-HTTP) mode

`node src/index.js --http` (PORT env, default 8080) runs a stateless server at `POST /mcp`, with `/health` and `/.well-known/mcp/server-card.json`. In this mode **no server-side credentials are used**: callers pass their own keys as request headers, used for that single request and never stored or logged: `x-cardmarket-app-token`, `x-cardmarket-app-secret`, `x-cardmarket-access-token`, `x-cardmarket-access-token-secret`, `x-tcgplayer-client-id`, `x-tcgplayer-client-secret`. The Scryfall tools and `reprice_suggest` (manual mode) need none. Note a hosted instance necessarily sees your headers in transit — if that matters to you, run the stdio version locally.

## Legal / attribution

- Scryfall data: used via the public API per [Scryfall's guidelines](https://scryfall.com/docs/api) (User-Agent set, rate-limited, attribution returned in every response). Prices are informational only, not for resale. Not affiliated with Scryfall.
- Cardmarket and TCGplayer data is retrieved with *your* credentials under *your* agreement with those services; follow their API terms. Not affiliated with either.
- Magic: The Gathering is © Wizards of the Coast. This is unofficial fan tooling.
- Repricing output is a heuristic, not financial advice.

## Develop

`npm install && npm test` · MIT licensed.
