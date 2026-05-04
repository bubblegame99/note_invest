"use client";

import { useRef, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTransaction } from "@/app/actions/transactions";

type Source = { id: string; name: string };

export type TxForEdit = {
  id: string;
  date: string;
  ticker: string;
  company_name: string | null;
  type: string;
  pocket: string;
  quantity: number;
  price: number;
  currency: string;
  source_id: string | null;
  notes: string | null;
  last_analysis_date: string | null;
  support_price: number | null;
  resistance_price: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3_fair_value: number | null;
};

function fmtOptNum(v: number | null): string {
  if (v == null) return "";
  return String(v);
}

export default function EditTransactionModal({
  transaction: tx,
  sources,
  onClose,
}: {
  transaction: TxForEdit;
  sources: Source[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateTransaction(tx.id, formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        handleClose();
        router.refresh();
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-full max-w-lg rounded-xl bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:bg-zinc-900"
    >
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Edit Transaction
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          {/* Ticker + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ticker</label>
              <input
                name="ticker"
                required
                defaultValue={tx.ticker}
                className="input uppercase"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Company Name</label>
              <input
                name="company_name"
                defaultValue={tx.company_name ?? ""}
                className="input"
              />
            </div>
          </div>

          {/* Type + Pocket */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="type" required defaultValue={tx.type} className="input">
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="label">Pocket</label>
              <select name="pocket" required defaultValue={tx.pocket} className="input">
                <option value="long_term">Long Term</option>
                <option value="active">Active Management</option>
              </select>
            </div>
          </div>

          {/* Quantity + Price + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">
                Quantity
                <span className="ml-1 text-zinc-400">(0 = watchlist)</span>
              </label>
              <input
                name="quantity"
                type="number"
                min="0"
                step="any"
                required
                defaultValue={tx.quantity}
                className="input"
              />
            </div>
            <div>
              <label className="label">Price</label>
              <input
                name="price"
                type="number"
                min="0"
                step="any"
                required
                defaultValue={tx.price}
                className="input"
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <select name="currency" defaultValue={tx.currency} className="input">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="label">Transaction Date</label>
            <input
              name="date"
              type="date"
              required
              defaultValue={tx.date}
              className="input"
            />
          </div>

          {/* Last Analysis Date */}
          <div>
            <label className="label">Last Analysis Date</label>
            <input
              name="last_analysis_date"
              type="date"
              defaultValue={tx.last_analysis_date ?? ""}
              className="input"
            />
          </div>

          {/* Source */}
          <div>
            <label className="label">Source</label>
            <select name="source_id" defaultValue={tx.source_id ?? ""} className="input">
              <option value="">— select a source —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Price levels */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Support Price</label>
              <input
                name="support_price"
                type="number"
                min="0"
                step="any"
                defaultValue={fmtOptNum(tx.support_price)}
                placeholder="0.00"
                className="input"
              />
            </div>
            <div>
              <label className="label">Resistance Price</label>
              <input
                name="resistance_price"
                type="number"
                min="0"
                step="any"
                defaultValue={fmtOptNum(tx.resistance_price)}
                placeholder="0.00"
                className="input"
              />
            </div>
          </div>

          {/* Target prices */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">TP1</label>
              <input
                name="tp1"
                type="number"
                min="0"
                step="any"
                defaultValue={fmtOptNum(tx.tp1)}
                placeholder="0.00"
                className="input"
              />
            </div>
            <div>
              <label className="label">TP2</label>
              <input
                name="tp2"
                type="number"
                min="0"
                step="any"
                defaultValue={fmtOptNum(tx.tp2)}
                placeholder="0.00"
                className="input"
              />
            </div>
            <div>
              <label className="label">TP3 / Fair Value</label>
              <input
                name="tp3_fair_value"
                type="number"
                min="0"
                step="any"
                defaultValue={fmtOptNum(tx.tp3_fair_value)}
                placeholder="0.00"
                className="input"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={tx.notes ?? ""}
              placeholder="Optional notes…"
              className="input resize-none"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
