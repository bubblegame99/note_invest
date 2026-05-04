import type { PortfolioSummary } from "@/lib/portfolio";

function fmtEUR(value: number | null): string {
  if (value == null) return "—";
  return (
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function SignedEUR({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-400">—</span>;
  const pos = value >= 0;
  return (
    <span className={pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
      {pos ? "+" : ""}
      {fmtEUR(value)}
    </span>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <div className="mt-2 text-xl font-semibold tabular-nums">{children}</div>
    </div>
  );
}

export default function PortfolioSummaryCards({
  summary,
}: {
  summary: PortfolioSummary;
}) {
  const {
    eurUsdRate,
    costBasisEUR,
    marketValueEUR,
    unrealizedPnlEUR,
    unrealizedPnlPct,
    realizedPnlEUR,
    positionCount,
    closedCount,
  } = summary;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs text-zinc-400">
          All values in EUR &nbsp;·&nbsp; 1 EUR = {eurUsdRate.toFixed(4)} USD
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Cost Basis */}
        <Card label="Cost Basis">
          <span className="text-zinc-900 dark:text-zinc-50">{fmtEUR(costBasisEUR)}</span>
        </Card>

        {/* Market Value */}
        <Card label="Market Value">
          {marketValueEUR == null ? (
            <span className="text-zinc-400 text-base">Partial data</span>
          ) : (
            <span className="text-zinc-900 dark:text-zinc-50">{fmtEUR(marketValueEUR)}</span>
          )}
        </Card>

        {/* Unrealized P&L */}
        <Card label="Unrealized P&L">
          <SignedEUR value={unrealizedPnlEUR} />
          {unrealizedPnlPct != null && (
            <span
              className={`ml-2 text-sm font-normal ${
                unrealizedPnlPct >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              ({unrealizedPnlPct >= 0 ? "+" : ""}
              {unrealizedPnlPct.toFixed(2)}%)
            </span>
          )}
        </Card>

        {/* Realized P&L */}
        <Card label="Realized P&L">
          <SignedEUR value={realizedPnlEUR !== 0 ? realizedPnlEUR : null} />
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Open Positions */}
        <Card label="Open Positions">
          <span className="text-zinc-900 dark:text-zinc-50">{positionCount}</span>
        </Card>

        {/* Closed Positions */}
        <Card label="Closed Positions">
          <span className="text-zinc-900 dark:text-zinc-50">{closedCount}</span>
        </Card>
      </div>
    </div>
  );
}
