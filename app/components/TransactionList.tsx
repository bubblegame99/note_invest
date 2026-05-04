"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTransaction } from "@/app/actions/transactions";
import EditTransactionModal, { type TxForEdit } from "./EditTransactionModal";

type Source = { id: string; name: string };

export type TxRow = TxForEdit & {
  source_name: string | null;
};

type PocketFilter = "all" | "long_term" | "active" | "watchlist";

const POCKET_LABEL: Record<string, string> = {
  long_term: "Long Term",
  active: "Active Management",
};
const SYM: Record<string, string> = { EUR: "€", USD: "$" };
const FILTERS: { value: PocketFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "long_term", label: "Long Term" },
  { value: "active", label: "Active" },
  { value: "watchlist", label: "Watchlist" },
];

function fmt(v: number, dec = 2) {
  return v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function TransactionList({
  transactions,
  sources,
}: {
  transactions: TxRow[];
  sources: Source[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pocket, setPocket] = useState<PocketFilter>("all");
  const [editTx, setEditTx] = useState<TxRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (q && !tx.ticker.toLowerCase().includes(q) && !(tx.company_name ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (pocket === "long_term") return tx.pocket === "long_term";
      if (pocket === "active") return tx.pocket === "active";
      if (pocket === "watchlist") return Number(tx.quantity) === 0;
      return true;
    });
  }, [transactions, search, pocket]);

  function handleDelete(id: string) {
    startDelete(async () => {
      await deleteTransaction(id);
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  return (
    <>
      {/* Search + filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticker or company…"
          className="input min-w-48 flex-1"
        />
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setPocket(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                pocket === f.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="mb-2 text-xs text-zinc-400">
        {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== transactions.length && ` (filtered from ${transactions.length})`}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-400">No transactions match your search.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {["Date", "Ticker", "Type", "Pocket", "Qty", "Price", "Total", "Last Analysis", "Source", "Notes", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {filtered.map((tx) => {
                  const isConfirming = confirmDeleteId === tx.id;
                  const s = SYM[tx.currency] ?? "";
                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors ${
                        isConfirming
                          ? "bg-red-50 dark:bg-red-950/20"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-500">
                        {tx.date}
                      </td>

                      {/* Ticker */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {tx.ticker}
                          <span className="ml-1 text-xs font-normal text-zinc-400">{s}</span>
                        </span>
                        {tx.company_name && (
                          <p className="max-w-[120px] truncate text-xs text-zinc-400">
                            {tx.company_name}
                          </p>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            tx.type === "buy"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          }`}
                        >
                          {tx.type.toUpperCase()}
                        </span>
                      </td>

                      {/* Pocket */}
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {POCKET_LABEL[tx.pocket] ?? tx.pocket}
                        {Number(tx.quantity) === 0 && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            WL
                          </span>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {Number(tx.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>

                      {/* Price */}
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {s}{fmt(Number(tx.price))}
                      </td>

                      {/* Total */}
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {s}{fmt(Number(tx.quantity) * Number(tx.price))}
                      </td>

                      {/* Last Analysis Date */}
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-400">
                        {tx.last_analysis_date ?? "—"}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 text-zinc-400">
                        {tx.source_name ?? "—"}
                      </td>

                      {/* Notes tooltip */}
                      <td className="px-4 py-3">
                        {tx.notes ? (
                          <div className="group relative inline-block">
                            <svg
                              className="h-4 w-4 cursor-default text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <rect x="2" y="2" width="12" height="12" rx="2" />
                              <path d="M5 6h6M5 9h4" />
                            </svg>
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {tx.notes}
                              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-200 dark:border-t-zinc-700" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              disabled={isDeleting}
                              className="rounded px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-0.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditTx(tx)}
                              title="Edit"
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(tx.id)}
                              title="Delete"
                              className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTx && (
        <EditTransactionModal
          transaction={editTx}
          sources={sources}
          onClose={() => setEditTx(null)}
        />
      )}
    </>
  );
}
