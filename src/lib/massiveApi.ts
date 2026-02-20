/**
 * Client-side wrapper for calling the massive-proxy edge function.
 */
import { supabase } from '@/integrations/supabase/client';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/massive-proxy`;

async function callProxy<T>(params: Record<string, string>): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error('Not authenticated');

  const url = new URL(BASE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`massive-proxy error ${res.status}: ${body}`);
  }
  return res.json();
}

export interface StockBar {
  t: number; // timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Fetch daily stock bars for a ticker. */
export async function fetchStockBars(ticker: string, from: string, to: string): Promise<StockBar[]> {
  return callProxy<StockBar[]>({ op: 'stock-bars', ticker, from, to });
}
