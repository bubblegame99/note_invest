import { NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// GET /api/stock-price?ticker=AAPL          → { price, currency, name }
// GET /api/stock-price?search=app&limit=5   → { results: [{ ticker, name, currency, exchange }] }
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim();
  const ticker = searchParams.get("ticker")?.trim().toUpperCase();

  // ── Autocomplete search ──────────────────────────────────
  if (search) {
    if (search.length < 1) {
      return Response.json({ results: [] });
    }
    try {
      const res = await yf.search(search, { quotesCount: 6, newsCount: 0 });
      const results = (res.quotes ?? [])
        .filter((q) => q.isYahooFinance && (q as { quoteType?: string }).quoteType === "EQUITY")
        .slice(0, 5)
        .map((q) => ({
          ticker: (q as { symbol?: string }).symbol ?? "",
          name: (q as { longname?: string; shortname?: string }).longname ?? (q as { shortname?: string }).shortname ?? "",
          exchange: (q as { exchDisp?: string }).exchDisp ?? "",
        }));
      return Response.json({ results });
    } catch {
      return Response.json({ results: [] });
    }
  }

  // ── Quote for a specific ticker ──────────────────────────
  if (!ticker) {
    return Response.json({ error: "ticker or search required" }, { status: 400 });
  }

  try {
    const quote = await yf.quote(ticker);
    if (!quote || quote.regularMarketPrice == null) {
      return Response.json({ error: "No price data available" }, { status: 404 });
    }
    return Response.json({
      price: quote.regularMarketPrice,
      currency: quote.currency ?? "USD",
      name: quote.longName ?? quote.shortName ?? ticker,
    });
  } catch {
    return Response.json({ error: "Ticker not found" }, { status: 404 });
  }
}
