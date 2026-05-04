import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeFIFO, type RawTx } from "@/lib/fifo";
import { getEURUSDRate, toEUR } from "@/lib/fx";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SYM: Record<string, string> = { EUR: "€", USD: "$" };
function sym(c: string) { return SYM[c] ?? ""; }

function fmtNum(v: number | null, dec = 2): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtQty(v: number): string {
  return v % 1 === 0 ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function PnlCell({ value, currency }: { value: number | null; currency: string }) {
  if (value == null) return <span className="text-zinc-400">—</span>;
  const pos = value >= 0;
  return (
    <span className={pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
      {pos ? "+" : ""}
      {sym(currency)}{fmtNum(value)}
    </span>
  );
}

function TechBar({
  label,
  value,
  currency,
  currentPrice,
}: {
  label: string;
  value: number | null;
  currency: string;
  currentPrice: number | null;
}) {
  if (value == null) return null;
  const pct =
    currentPrice != null ? ((value - currentPrice) / currentPrice) * 100 : null;
  const pos = pct != null && pct >= 0;
  return (
    <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          {sym(currency)}{fmtNum(value)}
        </span>
        {pct != null && (
          <span
            className={`ml-2 text-xs ${pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            ({pos ? "+" : ""}{fmtNum(pct)}%)
          </span>
        )}
      </div>
    </div>
  );
}

export default async function PositionDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const decodedTicker = decodeURIComponent(ticker).toUpperCase();

  const supabase = await createClient();

  const { data: txRows } = await supabase
    .from("transactions")
    .select(
      "id, created_at, date, type, ticker, pocket, company_name, quantity, price, currency, source_id, last_analysis_date, support_price, resistance_price, tp1, tp2, tp3_fair_value, sources(name)"
    )
    .eq("ticker", decodedTicker)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (!txRows || txRows.length === 0) notFound();

  // Group by pocket
  const pockets = [...new Set(txRows.map((r: { pocket: string }) => r.pocket as string))];

  // Fetch current price and EUR/USD rate in parallel
  const [quote, eurUsdRate] = await Promise.all([
    yf.quote(decodedTicker).catch(() => null),
    getEURUSDRate(),
  ]);

  const currentPrice: number | null = quote?.regularMarketPrice ?? null;
  const liveCurrency: string = quote?.currency ?? txRows[0]?.currency ?? "USD";
  const companyName: string = quote?.longName ?? quote?.shortName ?? txRows[0]?.company_name ?? decodedTicker;

  // Latest tech levels (from most recent row that has them)
  let support_price: number | null = null;
  let resistance_price: number | null = null;
  let tp1: number | null = null;
  let tp2: number | null = null;
  let tp3_fair_value: number | null = null;
  let last_analysis_date: string | null = null;

  // Rows are descending, so first non-null value found = most recent
  for (const row of txRows) {
    if (support_price == null && row.support_price != null) support_price = Number(row.support_price);
    if (resistance_price == null && row.resistance_price != null) resistance_price = Number(row.resistance_price);
    if (tp1 == null && row.tp1 != null) tp1 = Number(row.tp1);
    if (tp2 == null && row.tp2 != null) tp2 = Number(row.tp2);
    if (tp3_fair_value == null && row.tp3_fair_value != null) tp3_fair_value = Number(row.tp3_fair_value);
    if (last_analysis_date == null && row.last_analysis_date != null) last_analysis_date = row.last_analysis_date;
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb + header */}
      <div>
        <Link href="/dashboard" className="text-xs text-zinc-400 hover:text-zinc-600">
          ← Dashboard
        </Link>
        <div className="mt-2 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{decodedTicker}</h2>
          <span className="text-sm text-zinc-400">{sym(liveCurrency)}</span>
          {currentPrice != null && (
            <span className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              {sym(liveCurrency)}{fmtNum(currentPrice)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">{companyName}</p>
        {last_analysis_date && (
          <p className="mt-1 text-xs text-zinc-400">Last analysis: {last_analysis_date}</p>
        )}
      </div>

      {/* Per-pocket breakdown */}
      {pockets.map((pocket) => {
        const pocketTxs = txRows.filter((r: { pocket: string }) => r.pocket === pocket);
        const rawTxs: RawTx[] = pocketTxs.map((r: {
          id: string; created_at: string; date: string; type: string;
          quantity: number; price: number; currency: string; source_id: string | null;
        }) => ({
          id: r.id,
          date: r.date,
          created_at: r.created_at,
          type: r.type as "buy" | "sell",
          quantity: Number(r.quantity),
          price: Number(r.price),
          currency: r.currency ?? "USD",
          source_id: r.source_id,
        }));

        const fifo = computeFIFO(rawTxs);
        const currency = pocketTxs[0]?.currency ?? "USD";

        const costBasis = fifo.avgCost * fifo.remainingQty;
        const marketValue = currentPrice != null ? currentPrice * fifo.remainingQty : null;
        const unrealizedPnl = marketValue != null ? marketValue - costBasis : null;
        const unrealizedPnlEUR = unrealizedPnl != null ? toEUR(unrealizedPnl, liveCurrency, eurUsdRate) : null;
        const unrealizedPnlPct = unrealizedPnl != null && costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : null;

        return (
          <section key={pocket}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              {pocket === "long_term" ? "Long Term" : "Active Management"}
            </h3>

            {/* Summary row */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Remaining Shares", value: fmtQty(fifo.remainingQty) },
                { label: "Avg Cost", value: sym(currency) + fmtNum(fifo.avgCost) },
                {
                  label: "Market Value",
                  value: marketValue != null ? sym(liveCurrency) + fmtNum(marketValue) : "—",
                },
                { label: "EUR/USD Rate", value: `1 € = ${fmtNum(eurUsdRate, 4)} $` },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
                  <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
                </div>
              ))}
            </div>

            {/* P&L */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Unrealized P&L</p>
                <p className="mt-1 text-base font-semibold">
                  <PnlCell value={unrealizedPnl} currency={liveCurrency} />
                  {unrealizedPnlPct != null && (
                    <span className="ml-2 text-sm text-zinc-400">({unrealizedPnlPct >= 0 ? "+" : ""}{fmtNum(unrealizedPnlPct)}%)</span>
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Unrealized P&L (€)</p>
                <p className="mt-1 text-base font-semibold">
                  <PnlCell value={unrealizedPnlEUR} currency="EUR" />
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Realized P&L</p>
                <p className="mt-1 text-base font-semibold">
                  <PnlCell value={fifo.realizedPnl !== 0 ? fifo.realizedPnl : null} currency={currency} />
                </p>
              </div>
            </div>

            {/* Technical levels */}
            {(support_price || resistance_price || tp1 || tp2 || tp3_fair_value) && (
              <div className="mb-6 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Technical Levels</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <TechBar label="Support" value={support_price} currency={currency} currentPrice={currentPrice} />
                  <TechBar label="Resistance" value={resistance_price} currency={currency} currentPrice={currentPrice} />
                  <TechBar label="TP1" value={tp1} currency={currency} currentPrice={currentPrice} />
                  <TechBar label="TP2" value={tp2} currency={currency} currentPrice={currentPrice} />
                  <TechBar label="TP3 / Fair Value" value={tp3_fair_value} currency={currency} currentPrice={currentPrice} />
                </div>
              </div>
            )}

            {/* Open lots table */}
            {fifo.openLots.length > 0 && (
              <div className="mb-6">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Open Lots (FIFO)</h4>
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        {["Date", "Bought", "Remaining", "Buy Price", "Unrealized P&L"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                      {fifo.openLots.map((lot) => {
                        const lotPnl = currentPrice != null ? (currentPrice - lot.price) * lot.remaining : null;
                        return (
                          <tr key={lot.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <td className="px-4 py-3 tabular-nums text-zinc-500">{lot.date}</td>
                            <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{fmtQty(lot.quantity)}</td>
                            <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{fmtQty(lot.remaining)}</td>
                            <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                              {sym(lot.currency)}{fmtNum(lot.price)}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              <PnlCell value={lotPnl} currency={liveCurrency} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Closed lots table */}
            {fifo.closedLots.length > 0 && (
              <div className="mb-6">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Closed Lots (FIFO)</h4>
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        {["Bought", "Sold", "Shares", "Buy Price", "Sell Price", "Realized P&L"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                      {fifo.closedLots.map((lot, i) => (
                        <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="px-4 py-3 tabular-nums text-zinc-500">{lot.buyDate}</td>
                          <td className="px-4 py-3 tabular-nums text-zinc-500">{lot.sellDate}</td>
                          <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{fmtQty(lot.quantity)}</td>
                          <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{sym(lot.currency)}{fmtNum(lot.buyPrice)}</td>
                          <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{sym(lot.currency)}{fmtNum(lot.sellPrice)}</td>
                          <td className="px-4 py-3 tabular-nums">
                            <PnlCell value={lot.pnl} currency={lot.currency} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All transactions */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">All Transactions</h4>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      {["Date", "Type", "Qty", "Price", "Total", "Source", "Notes"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {pocketTxs.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3 tabular-nums text-zinc-500">{tx.date}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            tx.type === "buy"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          }`}>
                            {tx.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{fmtQty(Number(tx.quantity))}</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                          {sym(tx.currency)}{fmtNum(Number(tx.price))}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                          {sym(tx.currency)}{fmtNum(Number(tx.quantity) * Number(tx.price))}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {tx.sources?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">
                          {tx.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
