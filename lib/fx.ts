import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

let _cache: { rate: number; at: number } | null = null;

/** Fetch EUR/USD rate (1 EUR = X USD). Cached for 5 min. */
export async function getEURUSDRate(): Promise<number> {
  if (_cache && Date.now() - _cache.at < 5 * 60 * 1000) return _cache.rate;
  try {
    const q = await yf.quote("EURUSD=X");
    const rate = q.regularMarketPrice ?? 1.08;
    _cache = { rate, at: Date.now() };
    return rate;
  } catch {
    return _cache?.rate ?? 1.08;
  }
}

/** Convert an amount from any currency to EUR using the current rate. */
export function toEUR(amount: number, currency: string, eurUsdRate: number): number {
  if (currency === "EUR") return amount;
  return amount / eurUsdRate;
}
