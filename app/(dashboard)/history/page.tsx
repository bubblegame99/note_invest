import { createClient } from "@/lib/supabase/server";
import { getPortfolioData } from "@/lib/portfolio";
import { toEUR } from "@/lib/fx";
import AddTransactionModal from "@/app/components/AddTransactionModal";
import PositionsTable from "@/app/components/PositionsTable";
import TransactionList, { type TxRow } from "@/app/components/TransactionList";

const SYM: Record<string, string> = { EUR: "€", USD: "$" };
function sym(c: string) { return SYM[c] ?? ""; }

function fmtNum(v: number | null, dec = 2): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function PnlCell({ value, currency }: { value: number; currency: string }) {
  const pos = value >= 0;
  return (
    <span className={pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
      {pos ? "+" : ""}
      {sym(currency)}{fmtNum(value)}
    </span>
  );
}

export default async function HistoryPage() {
  const supabase = await createClient();

  const [portfolioData, { data: sources }, { data: allTickers }, { data: rawTransactions }] =
    await Promise.all([
      getPortfolioData(supabase).catch(() => ({
        byPocket: { long_term: [], active: [] },
        closedPositions: [],
        summary: {
          eurUsdRate: 1.08,
          costBasisEUR: 0,
          marketValueEUR: null,
          unrealizedPnlEUR: null,
          unrealizedPnlPct: null,
          realizedPnlEUR: 0,
          positionCount: 0,
          closedCount: 0,
        },
      })),
      supabase.from("sources").select("id, name").order("name"),
      supabase.from("transactions").select("ticker"),
      supabase
        .from("transactions")
        .select(
          "id, date, ticker, company_name, type, pocket, quantity, price, currency, source_id, notes, last_analysis_date, support_price, resistance_price, tp1, tp2, tp3_fair_value, sources(name)"
        )
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions: TxRow[] = (rawTransactions ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    ticker: r.ticker,
    company_name: r.company_name ?? null,
    type: r.type,
    pocket: r.pocket,
    quantity: Number(r.quantity),
    price: Number(r.price),
    currency: r.currency ?? "USD",
    source_id: r.source_id ?? null,
    source_name: r.sources?.name ?? null,
    notes: r.notes ?? null,
    last_analysis_date: r.last_analysis_date ?? null,
    support_price: r.support_price != null ? Number(r.support_price) : null,
    resistance_price: r.resistance_price != null ? Number(r.resistance_price) : null,
    tp1: r.tp1 != null ? Number(r.tp1) : null,
    tp2: r.tp2 != null ? Number(r.tp2) : null,
    tp3_fair_value: r.tp3_fair_value != null ? Number(r.tp3_fair_value) : null,
  }));

  const existingTickers = [
    ...new Set((allTickers ?? []).map((r: { ticker: string }) => r.ticker)),
  ];

  const { byPocket, closedPositions, summary } = portfolioData;
  const hasActive = Object.values(byPocket).some((arr) => arr.length > 0);
  const hasClosed = closedPositions.length > 0;

  // ─── Source ROI computation ───────────────────────────────────────────────
  // Map sourceId → { name, unrealizedPnlEUR, realizedPnlEUR, positionCount }
  const sourceMap = new Map<string, { name: string; unrealizedPnlEUR: number; realizedPnlEUR: number; positions: Set<string> }>();

  const sourceNames = new Map((sources ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));

  // Unrealized: iterate open lots per active position
  for (const positions of Object.values(byPocket)) {
    for (const pos of positions) {
      if (pos.currentPrice == null) continue;
      for (const lot of pos.openLots) {
        if (!lot.source_id) continue;
        if (!sourceMap.has(lot.source_id)) {
          sourceMap.set(lot.source_id, {
            name: sourceNames.get(lot.source_id) ?? lot.source_id,
            unrealizedPnlEUR: 0,
            realizedPnlEUR: 0,
            positions: new Set(),
          });
        }
        const entry = sourceMap.get(lot.source_id)!;
        const lotPnl = (pos.currentPrice - lot.price) * lot.remaining;
        entry.unrealizedPnlEUR += toEUR(lotPnl, pos.currency, summary.eurUsdRate);
        entry.positions.add(pos.ticker);
      }
    }
  }

  // Realized: iterate closed lots
  for (const cp of closedPositions) {
    for (const lot of cp.closedLots) {
      if (!lot.source_id) continue;
      if (!sourceMap.has(lot.source_id)) {
        sourceMap.set(lot.source_id, {
          name: sourceNames.get(lot.source_id) ?? lot.source_id,
          unrealizedPnlEUR: 0,
          realizedPnlEUR: 0,
          positions: new Set(),
        });
      }
      const entry = sourceMap.get(lot.source_id)!;
      entry.realizedPnlEUR += toEUR(lot.pnl, cp.currency, summary.eurUsdRate);
      entry.positions.add(cp.ticker);
    }
  }

  const sourceROI = [...sourceMap.entries()]
    .map(([id, e]) => ({
      id,
      name: e.name,
      positionCount: e.positions.size,
      unrealizedPnlEUR: e.unrealizedPnlEUR,
      realizedPnlEUR: e.realizedPnlEUR,
      totalPnlEUR: e.unrealizedPnlEUR + e.realizedPnlEUR,
    }))
    .sort((a, b) => b.totalPnlEUR - a.totalPnlEUR);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">History</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Active positions, closed trades, and source performance</p>
        </div>
        <AddTransactionModal sources={sources ?? []} existingTickers={existingTickers} />
      </div>

      {/* Active positions */}
      {hasActive && (
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Active Positions
          </h3>
          <PositionsTable byPocket={byPocket} sources={sources ?? []} />
        </section>
      )}

      {/* Closed positions */}
      {hasClosed && (
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Closed Positions
          </h3>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    {["Ticker", "Pocket", "Shares", "Avg Buy", "Avg Sell", "Realized P&L", "Realized P&L (€)", "Closed"].map(
                      (h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {closedPositions.map((cp) => (
                    <tr key={`${cp.ticker}-${cp.pocket}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
                        {cp.ticker}
                        <span className="ml-1 text-xs font-normal text-zinc-400">{sym(cp.currency)}</span>
                        {cp.company_name && (
                          <p className="text-xs font-normal text-zinc-400">{cp.company_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 capitalize">
                        {cp.pocket.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {fmtNum(cp.totalQty, 4)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {sym(cp.currency)}{fmtNum(cp.avgBuyPrice)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {sym(cp.currency)}{fmtNum(cp.avgSellPrice)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <PnlCell value={cp.realizedPnl} currency={cp.currency} />
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <PnlCell value={cp.realizedPnlEUR} currency="EUR" />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-500">
                        {cp.lastSellDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Source ROI */}
      {sourceROI.length > 0 && (
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Source Performance
          </h3>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    {["Source", "Positions", "Unrealized (€)", "Realized (€)", "Total (€)"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {sourceROI.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{row.name}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-500">{row.positionCount}</td>
                      <td className="px-4 py-3 tabular-nums">
                        <PnlCell value={row.unrealizedPnlEUR} currency="EUR" />
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <PnlCell value={row.realizedPnlEUR} currency="EUR" />
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">
                        <PnlCell value={row.totalPnlEUR} currency="EUR" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!hasActive && !hasClosed && transactions.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-400">No transactions yet — add your first transaction to get started.</p>
        </div>
      )}

      {/* All transactions with search, filter, edit, delete */}
      {transactions.length > 0 && (
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            All Transactions
          </h3>
          <TransactionList transactions={transactions} sources={sources ?? []} />
        </section>
      )}
    </div>
  );
}
