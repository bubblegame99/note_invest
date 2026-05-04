export type RawTx = {
  id: string;
  date: string;
  created_at: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  currency: string;
  source_id: string | null;
};

export type OpenLot = {
  id: string;
  date: string;
  quantity: number;  // original
  remaining: number; // after sells consumed
  price: number;
  currency: string;
  source_id: string | null;
};

export type ClosedLot = {
  buyDate: string;
  sellDate: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  currency: string;
  pnl: number; // native currency
  source_id: string | null; // source of the buy lot
};

export type FIFOResult = {
  openLots: OpenLot[];
  closedLots: ClosedLot[];
  remainingQty: number;
  avgCost: number;
  realizedPnl: number; // native currency sum
  isClosed: boolean;
  isWatchlist: boolean; // all buy transactions have quantity=0
};

export function computeFIFO(txs: RawTx[]): FIFOResult {
  const sorted = [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.created_at < b.created_at ? -1 : 1;
  });

  const lots: OpenLot[] = [];
  const closedLots: ClosedLot[] = [];
  let realizedPnl = 0;

  for (const tx of sorted) {
    if (tx.type === "buy") {
      lots.push({
        id: tx.id,
        date: tx.date,
        quantity: tx.quantity,
        remaining: tx.quantity,
        price: tx.price,
        currency: tx.currency,
        source_id: tx.source_id,
      });
    } else {
      let toSell = tx.quantity;
      for (const lot of lots) {
        if (toSell <= 0) break;
        if (lot.remaining <= 0) continue;
        const consumed = Math.min(lot.remaining, toSell);
        const pnl = (tx.price - lot.price) * consumed;
        realizedPnl += pnl;
        closedLots.push({
          buyDate: lot.date,
          sellDate: tx.date,
          quantity: consumed,
          buyPrice: lot.price,
          sellPrice: tx.price,
          currency: lot.currency,
          pnl,
          source_id: lot.source_id,
        });
        lot.remaining -= consumed;
        toSell -= consumed;
      }
    }
  }

  const openLots = lots.filter((l) => l.remaining > 0);
  const remainingQty = openLots.reduce((s, l) => s + l.remaining, 0);
  const totalCost = openLots.reduce((s, l) => s + l.remaining * l.price, 0);
  const avgCost = remainingQty > 0 ? totalCost / remainingQty : 0;

  const hasBuys = txs.some((t) => t.type === "buy");
  const isWatchlist =
    hasBuys &&
    txs.filter((t) => t.type === "buy").every((t) => t.quantity === 0);

  return {
    openLots,
    closedLots,
    remainingQty,
    avgCost,
    realizedPnl,
    isClosed: remainingQty === 0 && hasBuys && !isWatchlist,
    isWatchlist,
  };
}
