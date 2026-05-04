"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { EnrichedPosition } from "@/lib/portfolio";

type Source = { id: string; name: string };
type ProximityFilter = "near_support" | "near_resistance" | "underpriced";
type PocketFilter = "all" | "long_term" | "active";

const POCKET_LABEL: Record<string, string> = {
  long_term: "Long Term",
  active: "Active Management",
};
const POCKET_ORDER = ["long_term", "active"];

const SYM: Record<string, string> = { EUR: "€", USD: "$" };
function sym(currency: string) { return SYM[currency] ?? ""; }

function fmtNum(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtQty(v: number): string {
  return v % 1 === 0
    ? v.toLocaleString()
    : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function PctCell({ value, positiveIsGood = true }: { value: number | null; positiveIsGood?: boolean }) {
  if (value == null) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  const good = positiveIsGood ? value >= 0 : value <= 0;
  return (
    <span className={good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
      {value >= 0 ? "+" : ""}{fmtNum(value)}%
    </span>
  );
}

function PnlCell({ pnl, pnlPct, currency }: { pnl: number | null; pnlPct?: number | null; currency: string }) {
  if (pnl == null) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  const pos = pnl >= 0;
  const cls = pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return (
    <span className={cls}>
      {pos ? "+" : ""}{sym(currency)}{fmtNum(pnl)}
      {pnlPct != null && (
        <span className="ml-1 text-xs opacity-75">({pos ? "+" : ""}{fmtNum(pnlPct)}%)</span>
      )}
    </span>
  );
}

function RRCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  const cls =
    value >= 3 ? "text-emerald-600 dark:text-emerald-400 font-semibold"
    : value >= 2 ? "text-emerald-600 dark:text-emerald-400"
    : value >= 1 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  return <span className={cls}>{fmtNum(value, 1)}:1</span>;
}

function SupportCell({ distanceToSupport }: { distanceToSupport: number | null }) {
  if (distanceToSupport == null) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  const cls = distanceToSupport < 0
    ? "text-red-600 dark:text-red-400"
    : distanceToSupport <= 5
    ? "text-emerald-600 dark:text-emerald-400 font-medium"
    : "text-zinc-700 dark:text-zinc-300";
  return <span className={cls}>{distanceToSupport >= 0 ? "+" : ""}{fmtNum(distanceToSupport)}%</span>;
}

function ResistanceCell({ distanceToResistance }: { distanceToResistance: number | null }) {
  if (distanceToResistance == null) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  const cls = distanceToResistance >= 0 && distanceToResistance <= 5
    ? "text-red-600 dark:text-red-400 font-medium"
    : "text-zinc-700 dark:text-zinc-300";
  return <span className={cls}>+{fmtNum(distanceToResistance)}%</span>;
}

function supportRowHighlight(pos: EnrichedPosition): string {
  if (pos.distanceToSupport == null) return "";
  if (pos.distanceToSupport < 0) return "bg-red-50/40 dark:bg-red-950/10";
  if (pos.distanceToSupport <= 5) return "bg-emerald-50/40 dark:bg-emerald-950/10";
  return "";
}

// ── Source multi-select dropdown ──────────────────────────────────────────────
function SourceDropdown({
  sources,
  selected,
  onChange,
}: {
  sources: Source[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  const label =
    selected.length === 0
      ? "All Sources"
      : selected.length === 1
      ? (sources.find((s) => s.id === selected[0])?.name ?? "1 source")
      : `${selected.length} sources`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
          selected.length > 0
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        {label}
        <svg className="h-3 w-3 opacity-60" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {sources.length === 0 ? (
            <p className="px-4 py-2 text-xs text-zinc-400">No sources</p>
          ) : (
            <div className="py-1">
              {sources.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    className="rounded accent-blue-600"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Positions table display ───────────────────────────────────────────────────
function PocketSection({ label, positions }: { label: string; positions: EnrichedPosition[] }) {
  const hasMissing = positions.some((p) => p.currentPrice == null && !p.isWatchlist);

  const COLS = [
    "Ticker", "Shares", "Avg Cost", "Price", "Value (€)", "P&L",
    "vs Support", "Resistance", "TP1", "TP2", "TP3", "R:R",
  ];

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">{label}</h3>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {COLS.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {positions.map((pos) => (
                <tr
                  key={`${pos.ticker}-${pos.pocket}`}
                  className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${supportRowHighlight(pos)}`}
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/positions/${encodeURIComponent(pos.ticker)}`}
                      className="font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-50 dark:hover:text-blue-400"
                    >
                      {pos.ticker}
                      <span className="ml-1 text-xs font-normal text-zinc-400">{sym(pos.currency)}</span>
                    </Link>
                    {pos.company_name && (
                      <p className="max-w-[100px] truncate text-xs text-zinc-400">{pos.company_name}</p>
                    )}
                    {pos.isWatchlist && (
                      <span className="inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        WL
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {pos.isWatchlist ? <span className="text-zinc-400">—</span> : fmtQty(pos.remainingQty)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {pos.isWatchlist ? <span className="text-zinc-400">—</span> : <>{sym(pos.currency)}{fmtNum(pos.avgCost)}</>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {pos.currentPrice == null ? <span className="text-zinc-400">—</span> : <>{sym(pos.currency)}{fmtNum(pos.currentPrice)}</>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {pos.marketValueEUR == null ? <span className="text-zinc-400">—</span> : <>{fmtNum(pos.marketValueEUR)} €</>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <PnlCell pnl={pos.unrealizedPnl} pnlPct={pos.unrealizedPnlPct} currency={pos.currency} />
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {pos.support_price != null ? (
                      <span title={`Support: ${sym(pos.currency)}${fmtNum(pos.support_price)}`}>
                        <SupportCell distanceToSupport={pos.distanceToSupport} />
                      </span>
                    ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {pos.resistance_price != null ? (
                      <span title={`Resistance: ${sym(pos.currency)}${fmtNum(pos.resistance_price)}`}>
                        <ResistanceCell distanceToResistance={pos.distanceToResistance} />
                      </span>
                    ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {pos.tp1 != null ? (
                      <span title={`TP1: ${sym(pos.currency)}${fmtNum(pos.tp1)}`}>
                        <PctCell value={pos.potentialToTP1} />
                      </span>
                    ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {pos.tp2 != null ? (
                      <span title={`TP2: ${sym(pos.currency)}${fmtNum(pos.tp2)}`}>
                        <PctCell value={pos.potentialToTP2} />
                      </span>
                    ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {pos.tp3_fair_value != null ? (
                      <span title={`TP3/Fair: ${sym(pos.currency)}${fmtNum(pos.tp3_fair_value)}`}>
                        <PctCell value={pos.potentialToTP3} />
                      </span>
                    ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <RRCell value={pos.rrRatio} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMissing && (
          <p className="border-t border-zinc-100 px-4 py-2 text-xs italic text-zinc-400 dark:border-zinc-800">
            Some prices could not be fetched — those positions show —
          </p>
        )}
      </div>
    </section>
  );
}

// ── Filter counter message ────────────────────────────────────────────────────
function counterLabel(
  count: number,
  total: number,
  proximity: Set<ProximityFilter>
): string {
  if (count === total) return `${count} stock${count !== 1 ? "s" : ""}`;
  const tag =
    proximity.size === 1
      ? proximity.has("near_support")
        ? "near support"
        : proximity.has("near_resistance")
        ? "near resistance"
        : "below fair value"
      : null;
  return tag
    ? `Found ${count} stock${count !== 1 ? "s" : ""} ${tag}`
    : `${count} of ${total} stock${total !== 1 ? "s" : ""}`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PositionsTable({
  byPocket,
  sources = [],
}: {
  byPocket: Record<string, EnrichedPosition[]>;
  sources?: Source[];
}) {
  const [search, setSearch] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [proximity, setProximity] = useState<Set<ProximityFilter>>(new Set());
  const [pocket, setPocket] = useState<PocketFilter>("all");

  const allPositions = useMemo(() => Object.values(byPocket).flat(), [byPocket]);

  function toggleProximity(f: ProximityFilter) {
    setProximity((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  }

  const filtered = useMemo(() => {
    let list = allPositions;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.ticker.toLowerCase().includes(q) ||
          (p.company_name ?? "").toLowerCase().includes(q)
      );
    }

    if (pocket !== "all") {
      list = list.filter((p) => p.pocket === pocket);
    }

    if (selectedSources.length > 0) {
      list = list.filter((p) =>
        p.openLots.some((l) => l.source_id && selectedSources.includes(l.source_id))
      );
    }

    if (proximity.has("near_support")) {
      list = list.filter(
        (p) => p.distanceToSupport != null && p.distanceToSupport >= 0 && p.distanceToSupport <= 5
      );
    }
    if (proximity.has("near_resistance")) {
      list = list.filter(
        (p) => p.distanceToResistance != null && p.distanceToResistance >= 0 && p.distanceToResistance <= 5
      );
    }
    if (proximity.has("underpriced")) {
      list = list.filter(
        (p) => p.currentPrice != null && p.tp3_fair_value != null && p.currentPrice < p.tp3_fair_value
      );
    }

    return list;
  }, [allPositions, search, pocket, selectedSources, proximity]);

  const filteredByPocket = useMemo(() => {
    const result: Record<string, EnrichedPosition[]> = { long_term: [], active: [] };
    for (const pos of filtered) {
      const key = pos.pocket in result ? pos.pocket : "active";
      result[key].push(pos);
    }
    return result;
  }, [filtered]);

  const hasFilters =
    search.trim() !== "" ||
    selectedSources.length > 0 ||
    proximity.size > 0 ||
    pocket !== "all";

  function clearAll() {
    setSearch("");
    setSelectedSources([]);
    setProximity(new Set());
    setPocket("all");
  }

  const POCKET_BTNS: { value: PocketFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "long_term", label: "Long Term" },
    { value: "active", label: "Active" },
  ];

  const PROXIMITY_BTNS: { value: ProximityFilter; label: string; activeClass: string }[] = [
    {
      value: "near_support",
      label: "Near Support",
      activeClass: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    {
      value: "near_resistance",
      label: "Near Resistance",
      activeClass: "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    {
      value: "underpriced",
      label: "Underpriced",
      activeClass: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    },
  ];

  const inactiveToggle =
    "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800";

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticker or company…"
          className="input min-w-44 flex-1"
        />

        {/* Source dropdown */}
        {sources.length > 0 && (
          <SourceDropdown
            sources={sources}
            selected={selectedSources}
            onChange={setSelectedSources}
          />
        )}

        {/* Proximity toggles */}
        {PROXIMITY_BTNS.map((btn) => (
          <button
            key={btn.value}
            type="button"
            onClick={() => toggleProximity(btn.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              proximity.has(btn.value) ? btn.activeClass : inactiveToggle
            }`}
          >
            {btn.label}
          </button>
        ))}

        {/* Pocket toggles */}
        <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          {POCKET_BTNS.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => setPocket(btn.value)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                pocket === btn.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Counter + Clear */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">
            {counterLabel(filtered.length, allPositions.length, proximity)}
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-400">No stocks match the current filters.</p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-3 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {POCKET_ORDER.filter((key) => (filteredByPocket[key]?.length ?? 0) > 0).map((key) => (
            <PocketSection
              key={key}
              label={POCKET_LABEL[key] ?? key}
              positions={filteredByPocket[key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
