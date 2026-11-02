/** Pure repricing-suggestion logic. Never touches any API; output is advice only. */
const r2 = (n) => Math.round(n * 100) / 100;

export function suggestReprice({ currentPrice, lowest, trend, average, competitorPrices = [], strategy = "competitive", undercutPct = 1, floorPrice = 0, minMarginToChangePct = 1 }) {
  const comp = competitorPrices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  const low = Number.isFinite(lowest) ? lowest : comp[0];
  let target, basis;
  if (strategy === "match_trend" && Number.isFinite(trend)) { target = trend; basis = "market trend/median price"; }
  else if (strategy === "undercut_lowest" && Number.isFinite(low)) { target = low * (1 - undercutPct / 100); basis = `${undercutPct}% below the lowest competing price`; }
  else if (strategy === "premium" && Number.isFinite(trend)) { target = trend * (1 + undercutPct / 100); basis = `${undercutPct}% above trend`; }
  else {
    // competitive: sit slightly above the lowest, but never above trend
    const ref = Number.isFinite(low) ? low : trend;
    if (!Number.isFinite(ref)) return { action: "no_data", reason: "No reference price available." };
    target = ref * (1 - undercutPct / 100);
    if (Number.isFinite(trend) && target > trend) target = trend;
    basis = "just under the lowest competing price, capped at trend";
  }
  const notes = [];
  if (target < floorPrice) { target = floorPrice; notes.push(`clamped to your floor price ${floorPrice}`); }
  target = r2(target);
  const diffPct = currentPrice > 0 ? ((target - currentPrice) / currentPrice) * 100 : null;
  let action = "hold";
  if (diffPct === null || Math.abs(diffPct) >= minMarginToChangePct) action = target > currentPrice ? "raise" : "lower";
  if (Number.isFinite(average) && currentPrice > average * 1.5) notes.push("your price is >50% above the average sell price — unlikely to sell");
  return {
    action, currentPrice, suggestedPrice: action === "hold" ? currentPrice : target, targetPrice: target,
    changePct: diffPct === null ? null : r2(diffPct), basis, strategy,
    reference: { lowest: low ?? null, trend: trend ?? null, average: average ?? null, competitorsConsidered: comp.length },
    notes, disclaimer: "Suggestion only. This tool is read-only and never edits listings.",
  };
}

export function summarizeListings(prices) {
  const p = prices.filter(Number.isFinite).sort((a, b) => a - b);
  if (!p.length) return { count: 0 };
  const q = (x) => p[Math.min(p.length - 1, Math.floor(x * (p.length - 1)))];
  return { count: p.length, min: p[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: p[p.length - 1], mean: r2(p.reduce((a, b) => a + b, 0) / p.length) };
}
