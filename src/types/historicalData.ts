export interface HistoricalDataEntry {
  id: string;
  portfolio_id: string;
  snapshot_date: string;
  total_value: number;
  netting_total: number;
  netting_ex_cc: number;
  /** Netting Intrinseco (A) — colonna DB storica `netting_ex_cc_np` */
  netting_ex_cc_np: number;
  /** Netting Intrinseco (B) — null per snapshot precedenti all'introduzione della vista */
  netting_intrinsic_b: number | null;
  deposits: number;
  average_balance: number;
  equity_exposure_pct: number; // 0-1, default 0.6
  usd_exposure_pct: number;    // 0-1, default 0.8
  snapshot_underlying_prices?: Record<string, number>; // prezzi sottostanti congelati per il netting
  created_at: string;
  updated_at: string;
}

export interface HistoricalDataInput {
  id?: string; // Optional: used for updates
  snapshot_date: string;
  total_value: number;
  netting_total: number;
  /** Netting Intrinseco (A) — colonna DB storica `netting_ex_cc_np` */
  netting_ex_cc_np: number;
  /** Netting Intrinseco (B) */
  netting_intrinsic_b: number;
  deposits: number;
  average_balance: number;
  equity_exposure_pct: number; // 0-1
  usd_exposure_pct: number;    // 0-1
}

export interface SyntheticDeposit {
  date: string;
  amount: number;
  portfolioId: string;
}

export interface AggregatedHistoricalResult {
  entries: HistoricalDataEntry[];
  syntheticDeposits: SyntheticDeposit[];
  rawEntries?: HistoricalDataEntry[]; // Dati originali per ricalcolo viewMode
}
