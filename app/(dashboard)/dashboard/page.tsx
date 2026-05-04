import { createClient } from "@/lib/supabase/server";
import { getPortfolioData } from "@/lib/portfolio";
import AddTransactionModal from "@/app/components/AddTransactionModal";
import PortfolioSummaryCards from "@/app/components/PortfolioSummaryCards";
import PositionsTable from "@/app/components/PositionsTable";
import TransactionList, { type TxRow } from "@/app/components/TransactionList";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: rawTransactions },
    portfolioData,
    { data: sources },
    { data: allTickers },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, date, ticker, company_name, type, pocket, quantity, price, currency, source_id, notes, last_analysis_date, support_price, resistance_price, tp1, tp2, tp3_fair_value, sources(name)"
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
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
  ]);

  const existingTickers = [
    ...new Set((allTickers ?? []).map((r: { ticker: string }) => r.ticker)),
  ];

  // Flatten the joined sources relation into a simple string
  const transactions: TxRow[] = (rawTransactions ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
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
    })
  );

  const hasPositions = Object.values(portfolioData.byPocket).some(
    (arr) => arr.length > 0
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Welcome back, {user?.email}
          </p>
        </div>
        <AddTransactionModal sources={sources ?? []} existingTickers={existingTickers} />
      </div>

      {/* Portfolio summary cards */}
      {hasPositions && (
        <PortfolioSummaryCards summary={portfolioData.summary} />
      )}

      {/* Positions by pocket */}
      {hasPositions && (
        <PositionsTable byPocket={portfolioData.byPocket} sources={sources ?? []} />
      )}

      {/* Empty state */}
      {transactions.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-400">
            No positions yet — add your first transaction to get started.
          </p>
        </div>
      )}

      {/* All transactions with search, filter, edit, delete */}
      {transactions.length > 0 && (
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Transaction History
          </h3>
          <TransactionList transactions={transactions} sources={sources ?? []} />
        </section>
      )}
    </div>
  );
}
