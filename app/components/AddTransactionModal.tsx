"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { addTransaction } from "@/app/actions/transactions";

type Source = { id: string; name: string };
type Suggestion = { ticker: string; name: string; exchange: string };

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function AddTransactionModal({
  sources = [],
  existingTickers = [],
}: {
  sources?: Source[];
  existingTickers?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Ticker / autocomplete
  const [tickerInput, setTickerInput] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Price + currency
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"EUR" | "USD">("USD");
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");

  // Duplicate
  const [duplicateAlert, setDuplicateAlert] = useState(false);
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);

  // Analysis date
  const [analysisDate, setAnalysisDate] = useState(today());
  const [skipDateUpdate, setSkipDateUpdate] = useState(false);

  // Form error
  const [formError, setFormError] = useState("");

  // ── Autocomplete search ──────────────────────────────────
  useEffect(() => {
    const trimmed = tickerInput.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    const id = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/stock-price?search=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setSuggestionsOpen((data.results ?? []).length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [tickerInput]);

  // ── Price fetch when ticker is selected ─────────────────
  useEffect(() => {
    if (!selectedTicker) return;

    // Check duplicate
    const isDupe = existingTickers.includes(selectedTicker);
    setDuplicateAlert(isDupe);
    setDuplicateDismissed(false);

    setPriceError("");
    setPriceLoading(true);

    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/stock-price?ticker=${encodeURIComponent(selectedTicker)}`
        );
        const data = await res.json();
        if (res.ok) {
          setPrice(String(data.price));
          if (!companyName) setCompanyName(data.name ?? "");
          setCurrency(data.currency === "EUR" ? "EUR" : "USD");
        } else {
          setPriceError(data.error ?? "Price not found");
          setPrice("");
        }
      } catch {
        setPriceError("Network error");
      } finally {
        setPriceLoading(false);
      }
    }, 100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicker]);

  // ── Select suggestion ────────────────────────────────────
  function selectSuggestion(s: Suggestion) {
    setTickerInput(s.ticker);
    setSelectedTicker(s.ticker);
    setCompanyName(s.name);
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  // ── Dialog open/close sync ───────────────────────────────
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);

  function handleClose() {
    setOpen(false);
    setTickerInput("");
    setSelectedTicker("");
    setCompanyName("");
    setSuggestions([]);
    setSuggestionsOpen(false);
    setPrice("");
    setCurrency("USD");
    setPriceError("");
    setDuplicateAlert(false);
    setDuplicateDismissed(false);
    setAnalysisDate(today());
    setSkipDateUpdate(false);
    setFormError("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await addTransaction(null, formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        handleClose();
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setFormKey((k) => k + 1); }}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        + Add Transaction
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClose}
        className="w-full max-w-lg rounded-xl bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:bg-zinc-900"
      >
        <form key={formKey} onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Add Transaction
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
          <div className="space-y-4 px-6 py-5">
            {/* Ticker search */}
            <div className="relative">
              <label className="label">Ticker</label>
              <input
                name="ticker"
                value={tickerInput}
                onChange={(e) => {
                  setTickerInput(e.target.value.toUpperCase());
                  setSelectedTicker("");
                  setPrice("");
                  setCompanyName("");
                  setDuplicateAlert(false);
                }}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
                required
                placeholder="Search ticker or company…"
                className="input"
                autoComplete="off"
              />
              {/* Hidden fields */}
              <input type="hidden" name="company_name" value={companyName} />

              {/* Suggestions dropdown */}
              {suggestionsOpen && (
                <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  {searchLoading ? (
                    <li className="px-4 py-2 text-xs text-zinc-400">Searching…</li>
                  ) : (
                    suggestions.map((s) => (
                      <li key={s.ticker}>
                        <button
                          type="button"
                          onMouseDown={() => selectSuggestion(s)}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700"
                        >
                          <span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                              {s.ticker}
                            </span>
                            <span className="ml-2 text-zinc-500">{s.name}</span>
                          </span>
                          <span className="text-xs text-zinc-400">{s.exchange}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}

              {/* Company name hint */}
              {companyName && (
                <p className="mt-1 text-xs text-zinc-500">{companyName}</p>
              )}

              {/* Duplicate alert */}
              {duplicateAlert && !duplicateDismissed && (
                <div className="mt-2 flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                  <span>
                    Analysis already exists for{" "}
                    <strong>{selectedTicker}</strong>. You can still add
                    another transaction.
                  </span>
                  <button
                    type="button"
                    onClick={() => setDuplicateDismissed(true)}
                    className="ml-2 shrink-0 font-semibold hover:opacity-70"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>

            {/* Type + Pocket */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select name="type" required className="input">
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>
              <div>
                <label className="label">Pocket</label>
                <select name="pocket" required className="input">
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
                  placeholder="10"
                  className="input"
                />
              </div>
              <div>
                <label className="label">
                  Price
                  {price && !priceLoading && (
                    <span className="ml-1 text-zinc-400">(auto)</span>
                  )}
                </label>
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="input"
                />
                {priceLoading && (
                  <p className="mt-1 text-xs text-zinc-400">Fetching…</p>
                )}
                {!priceLoading && priceError && (
                  <p className="mt-1 text-xs text-red-500">{priceError}</p>
                )}
              </div>
              <div>
                <label className="label">Currency</label>
                <select
                  name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "EUR" | "USD")}
                  className="input"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            {/* Transaction Date */}
            <div>
              <label className="label">Transaction Date</label>
              <input
                name="date"
                type="date"
                required
                defaultValue={today()}
                max={today()}
                className="input"
              />
            </div>

            {/* Analysis date */}
            <div>
              <div className="flex items-center justify-between">
                <label className="label mb-0">Last Analysis Date</label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    checked={skipDateUpdate}
                    onChange={(e) => setSkipDateUpdate(e.target.checked)}
                    className="rounded"
                  />
                  Don&apos;t update date
                  <input
                    type="hidden"
                    name="skip_date_update"
                    value={skipDateUpdate ? "1" : "0"}
                  />
                </label>
              </div>
              <input
                name="last_analysis_date"
                type="date"
                value={skipDateUpdate ? "" : analysisDate}
                onChange={(e) => setAnalysisDate(e.target.value)}
                disabled={skipDateUpdate}
                max={today()}
                className={`input mt-1 ${skipDateUpdate ? "opacity-40" : ""}`}
              />
            </div>

            {/* Source */}
            <div>
              <label className="label">Source</label>
              <select name="source_id" className="input">
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
                <input name="support_price" type="number" min="0" step="any" placeholder="0.00" className="input" />
              </div>
              <div>
                <label className="label">Resistance Price</label>
                <input name="resistance_price" type="number" min="0" step="any" placeholder="0.00" className="input" />
              </div>
            </div>

            {/* Target prices */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">TP1</label>
                <input name="tp1" type="number" min="0" step="any" placeholder="0.00" className="input" />
              </div>
              <div>
                <label className="label">TP2</label>
                <input name="tp2" type="number" min="0" step="any" placeholder="0.00" className="input" />
              </div>
              <div>
                <label className="label">TP3 / Fair Value</label>
                <input name="tp3_fair_value" type="number" min="0" step="any" placeholder="0.00" className="input" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes</label>
              <textarea
                name="notes"
                rows={2}
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
              {isPending ? "Saving…" : "Save Transaction"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
