import YahooFinance from "yahoo-finance2";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFIFO, type RawTx, type OpenLot, type ClosedLot } from "./fifo";
import { getEURUSDRate, toEUR } from "./fx";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ─── Types ───────────────────────────────────────────────────────────────────

export type EnrichedPosition = {
  ticker: string;
  pocket: string;
  company_name: string | null;
  currency: string;
  remainingQty: number;
  avgCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  marketValueEUR: number | null;
  costBasis: number;
  costBasisEUR: number;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  unrealizedPnlEUR: number | null;
  realizedPnl: number;
  realizedPnlEUR: number;
  openLots: OpenLot[];
  // Latest technical levels
  support_price: number | null;
  resistance_price: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3_fair_value: number | null;
  last_analysis_date: string | null;
  distanceToSupport: number | null;    // % from current to support (neg = below)
  distanceToResistance: number | null; // % from current to resistance (pos = below)
  potentialToTP1: number | null;
  potentialToTP2: number | null;
  potentialToTP3: number | null;
  rrRatio: number | null;              // (TP3 - price) / (price - support)
  isWatchlist: boolean;
};

export type ClosedPosition = {
  ticker: string;
  pocket: string;
  company_name: string | null;
  currency: string;
  closedLots: ClosedLot[];
  realizedPnl: number;
  realizedPnlEUR: number;
  totalQty: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  lastSellDate: string;
};

export type PortfolioSummary = {
  eurUsdRate: number;
  costBasisEUR: number;
  marketValueEUR: number | null;
  unrealizedPnlEUR: number | null;
  unrealizedPnlPct: number | null;
  realizedPnlEUR: number;
  positionCount: number;
  closedCount: number;
};

export type PortfolioData = {
  byPocket: Record<string, EnrichedPosition[]>;
  closedPositions: ClosedPosition[];
  summary: PortfolioSummary;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function buildPriceMap(
  tickers: string[]
): Promise<Map<string, { price: number; currency: string } | null>> {
  const map = new Map<string, { price: number; currency: string } | null>();
  if (tickers.length === 0) return map;
  const results = await Promise.allSettled(tickers.map((t) => yf.quote(t)));
  tickers.forEach((ticker, i) => {
    const r = results[i];
    if (r.status === "fulfilled" && r.value.regularMarketPrice != null) {
      map.set(ticker, {
        price: r.value.regularMarketPrice,
        currency: r.value.currency ?? "USD",
      });
    } else {
      map.set(ticker, null);
    }
  });
  return map;
}

type TechLevels = {
  support_price: number | null;
  resistance_price: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3_fair_value: number | null;
  last_analysis_date: string | null;
};

type GroupData = {
  txs: RawTx[];
  company_name: string | null;
  currency: string;
  tech: TechLevels;
};

// ─── Main export ─────────────────────────────────────────────────────────────

export async function getPortfolioData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<PortfolioData> {
  const [{ data: txRows }, eurUsdRate] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, created_at, date, type, ticker, pocket, company_name, quantity, price, currency, source_id, last_analysis_date, support_price, resistance_price, tp1, tp2, tp3_fair_value"
      )
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
    getEURUSDRate(),
  ]);

  const empty: PortfolioData = {
    byPocket: { long_term: [], active: [] },
    closedPositions: [],
    summary: {
      eurUsdRate,
      costBasisEUR: 0,
      marketValueEUR: null,
      unrealizedPnlEUR: null,
      unrealizedPnlPct: null,
      realizedPnlEUR: 0,
      positionCount: 0,
      closedCount: 0,
    },
  };

  if (!txRows || txRows.length === 0) return empty;

  // Group transactions by ticker+pocket
  const groups = new Map<string, GroupData>();
  for (const row of txRows) {
    const key = `${row.ticker}::${row.pocket}`;
    if (!groups.has(key)) {
      groups.set(key, {
        txs: [],
        company_name: null,
        currency: row.currency ?? "USD",
        tech: {
          support_price: null,
          resistance_price: null,
          tp1: null,
          tp2: null,
          tp3_fair_value: null,
          last_analysis_date: null,
        },
      });
    }
    const g = groups.get(key)!;
    g.txs.push({
      id: row.id,
      date: row.date,
      created_at: row.created_at,
      type: row.type as "buy" | "sell",
      quantity: Number(row.quantity),
      price: Number(row.price),
      currency: row.currency ?? "USD",
      source_id: row.source_id ?? null,
    });
    if (row.company_name) g.company_name = row.company_name;
    // Update tech levels with the latest non-null values (rows sorted ascending so last wins)
    const t = g.tech;
    if (row.support_price != null) t.support_price = Number(row.support_price);
    if (row.resistance_price != null) t.resistance_price = Number(row.resistance_price);
    if (row.tp1 != null) t.tp1 = Number(row.tp1);
    if (row.tp2 != null) t.tp2 = Number(row.tp2);
    if (row.tp3_fair_value != null) t.tp3_fair_value = Number(row.tp3_fair_value);
    if (row.last_analysis_date != null) t.last_analysis_date = row.last_analysis_date;
  }

  // Run FIFO per group
  const fifoMap = new Map<string, ReturnType<typeof computeFIFO>>();
  for (const [key, g] of groups) {
    fifoMap.set(key, computeFIFO(g.txs));
  }

  // Deduplicate tickers for all active + watchlist groups
  const uniqueActiveTickers = [...new Set(
    [...groups.entries()]
      .filter(([key]) => {
        const f = fifoMap.get(key)!;
        return f.remainingQty > 0 || f.isWatchlist;
      })
      .map(([key]) => key.split("::")[0])
  )];

  const priceMap = await buildPriceMap(uniqueActiveTickers);

  // Build active positions
  const activePositions: EnrichedPosition[] = [];
  const closedPositions: ClosedPosition[] = [];

  for (const [key, g] of groups) {
    const ticker = key.split("::")[0];
    const pocket = key.split("::")[1];
    const fifo = fifoMap.get(key)!;

    const liveCurrency = priceMap.get(ticker)?.currency ?? g.currency;
    const currentPrice = priceMap.get(ticker)?.price ?? null;

    if (fifo.remainingQty > 0 || fifo.isWatchlist) {
      const isWatchlist = fifo.isWatchlist;
      const costBasis = isWatchlist ? 0 : fifo.avgCost * fifo.remainingQty;
      const costBasisEUR = toEUR(costBasis, g.currency, eurUsdRate);
      const marketValue = (!isWatchlist && currentPrice != null) ? currentPrice * fifo.remainingQty : null;
      const marketValueEUR = marketValue != null ? toEUR(marketValue, liveCurrency, eurUsdRate) : null;
      const unrealizedPnl = marketValue != null ? marketValue - costBasis : null;
      const unrealizedPnlEUR = unrealizedPnl != null ? toEUR(unrealizedPnl, liveCurrency, eurUsdRate) : null;
      const unrealizedPnlPct =
        unrealizedPnl != null && costBasis > 0
          ? (unrealizedPnl / costBasis) * 100
          : null;
      const realizedPnl = fifo.realizedPnl;
      const realizedPnlEUR = toEUR(realizedPnl, g.currency, eurUsdRate);

      const { support_price, resistance_price, tp1, tp2, tp3_fair_value, last_analysis_date } = g.tech;

      const distanceToSupport =
        currentPrice != null && support_price != null
          ? ((currentPrice - support_price) / currentPrice) * 100
          : null;
      const distanceToResistance =
        currentPrice != null && resistance_price != null
          ? ((resistance_price - currentPrice) / currentPrice) * 100
          : null;
      const potentialToTP1 =
        currentPrice != null && tp1 != null
          ? ((tp1 - currentPrice) / currentPrice) * 100
          : null;
      const potentialToTP2 =
        currentPrice != null && tp2 != null
          ? ((tp2 - currentPrice) / currentPrice) * 100
          : null;
      const potentialToTP3 =
        currentPrice != null && tp3_fair_value != null
          ? ((tp3_fair_value - currentPrice) / currentPrice) * 100
          : null;
      const rrRatio =
        currentPrice != null &&
        tp3_fair_value != null &&
        support_price != null &&
        currentPrice - support_price > 0
          ? (tp3_fair_value - currentPrice) / (currentPrice - support_price)
          : null;

      activePositions.push({
        ticker,
        pocket,
        company_name: g.company_name,
        currency: g.currency,
        remainingQty: fifo.remainingQty,
        avgCost: fifo.avgCost,
        currentPrice,
        marketValue,
        marketValueEUR,
        costBasis,
        costBasisEUR,
        unrealizedPnl,
        unrealizedPnlPct,
        unrealizedPnlEUR,
        realizedPnl,
        realizedPnlEUR,
        openLots: fifo.openLots,
        support_price,
        resistance_price,
        tp1,
        tp2,
        tp3_fair_value,
        last_analysis_date,
        distanceToSupport,
        distanceToResistance,
        potentialToTP1,
        potentialToTP2,
        potentialToTP3,
        rrRatio,
        isWatchlist,
      });
    } else if (fifo.isClosed) {
      const totalQty = fifo.closedLots.reduce((s, l) => s + l.quantity, 0);
      const totalBuyCost = fifo.closedLots.reduce((s, l) => s + l.buyPrice * l.quantity, 0);
      const totalSellValue = fifo.closedLots.reduce((s, l) => s + l.sellPrice * l.quantity, 0);
      const lastSellDate = fifo.closedLots
        .map((l) => l.sellDate)
        .sort()
        .at(-1) ?? "";
      closedPositions.push({
        ticker,
        pocket,
        company_name: g.company_name,
        currency: g.currency,
        closedLots: fifo.closedLots,
        realizedPnl: fifo.realizedPnl,
        realizedPnlEUR: toEUR(fifo.realizedPnl, g.currency, eurUsdRate),
        totalQty,
        avgBuyPrice: totalQty > 0 ? totalBuyCost / totalQty : 0,
        avgSellPrice: totalQty > 0 ? totalSellValue / totalQty : 0,
        lastSellDate,
      });
    }
  }

  // Group active positions by pocket
  const byPocket: Record<string, EnrichedPosition[]> = { long_term: [], active: [] };
  for (const pos of activePositions) {
    const key = pos.pocket in byPocket ? pos.pocket : "active";
    byPocket[key].push(pos);
  }

  // Summary (only priced positions contribute to marketValue/pnl)
  const pricedPositions = activePositions.filter((p) => p.marketValueEUR != null);
  const costBasisEUR = activePositions.reduce((s, p) => s + p.costBasisEUR, 0);
  const marketValueEUR =
    pricedPositions.length > 0
      ? pricedPositions.reduce((s, p) => s + p.marketValueEUR!, 0)
      : null;
  const unrealizedPnlEUR =
    pricedPositions.length > 0
      ? pricedPositions.reduce((s, p) => s + p.unrealizedPnlEUR!, 0)
      : null;
  const pricedCostEUR = pricedPositions.reduce((s, p) => s + p.costBasisEUR, 0);
  const unrealizedPnlPct =
    unrealizedPnlEUR != null && pricedCostEUR > 0
      ? (unrealizedPnlEUR / pricedCostEUR) * 100
      : null;
  const realizedPnlEUR =
    activePositions.reduce((s, p) => s + p.realizedPnlEUR, 0) +
    closedPositions.reduce((s, p) => s + p.realizedPnlEUR, 0);

  return {
    byPocket,
    closedPositions,
    summary: {
      eurUsdRate,
      costBasisEUR,
      marketValueEUR,
      unrealizedPnlEUR,
      unrealizedPnlPct,
      realizedPnlEUR,
      positionCount: activePositions.length,
      closedCount: closedPositions.length,
    },
  };
}
