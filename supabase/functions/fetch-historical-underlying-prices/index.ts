import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceRequest {
  ticker: string;
  date: string;
}

interface PriceResult {
  ticker: string;
  requested_date: string;
  price_date: string | null;
  close_price: number | null;
  source: "exact_trade_date" | "previous_close" | "missing";
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const safeTicker = /^[A-Z0-9.^=\-]{1,24}$/;

function normalize(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function fetchYahooClose(ticker: string, requestedDate: string): Promise<PriceResult> {
  const requested = new Date(`${requestedDate}T12:00:00Z`);
  const from = new Date(requested);
  from.setUTCDate(from.getUTCDate() - 10);
  const to = new Date(requested);
  to.setUTCDate(to.getUTCDate() + 2);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`
    + `?period1=${Math.floor(from.getTime() / 1000)}`
    + `&period2=${Math.floor(to.getTime() / 1000)}`
    + "&interval=1d&events=history";
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Yahoo ${response.status}`);

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  // Per l'intrinseco serve il prezzo realmente quotato in quella seduta, non
  // l'adjusted close retroattivamente corretto per dividendi/split.
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close
    ?? result?.indicators?.adjclose?.[0]?.adjclose
    ?? [];

  const candidates = timestamps
    .map((ts, index) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: Number(closes[index]),
    }))
    .filter(row => row.date <= requestedDate && Number.isFinite(row.close) && row.close > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const selected = candidates[0];
  if (!selected) {
    return { ticker, requested_date: requestedDate, price_date: null, close_price: null, source: "missing" };
  }
  return {
    ticker,
    requested_date: requestedDate,
    price_date: selected.date,
    close_price: selected.close,
    source: selected.date === requestedDate ? "exact_trade_date" : "previous_close",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.requests) ? body.requests as PriceRequest[] : [];
    const requests = Array.from(new Map(
      raw
        .filter(r => r && typeof r.ticker === "string" && typeof r.date === "string")
        .map(r => ({ ticker: r.ticker.trim().toUpperCase(), date: r.date.trim() }))
        .filter(r => safeTicker.test(r.ticker) && isoDate.test(r.date))
        .map(r => [`${r.ticker}|${r.date}`, r]),
    ).values()).slice(0, 50);

    if (requests.length === 0) {
      return new Response(JSON.stringify({ prices: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: mappings } = await supabase
      .from("underlying_mappings")
      .select("underlying, ticker");
    const yahooByAlias = new Map<string, string>();
    for (const row of mappings ?? []) {
      const yahooTicker = String(row.ticker || "").trim().toUpperCase();
      if (!safeTicker.test(yahooTicker)) continue;
      yahooByAlias.set(normalize(String(row.underlying || "")), yahooTicker);
      yahooByAlias.set(normalize(yahooTicker), yahooTicker);
    }

    const resolveRequest = async (request: PriceRequest): Promise<PriceResult> => {
      const { data: cached } = await supabase
        .from("underlying_price_history")
        .select("ticker, requested_date, price_date, close_price")
        .eq("ticker", request.ticker)
        .eq("requested_date", request.date)
        .maybeSingle();
      if (cached) {
        return {
          ticker: request.ticker,
          requested_date: request.date,
          price_date: cached.price_date,
          close_price: Number(cached.close_price),
          source: cached.price_date === request.date ? "exact_trade_date" : "previous_close",
        };
      }

      const yahooTicker = yahooByAlias.get(normalize(request.ticker)) ?? request.ticker;
      let result: PriceResult;
      try {
        result = await fetchYahooClose(yahooTicker, request.date);
        result.ticker = request.ticker;
      } catch (error) {
        console.error(`[HistoricalUnderlying] ${request.ticker} ${request.date}:`, error);
        result = {
          ticker: request.ticker,
          requested_date: request.date,
          price_date: null,
          close_price: null,
          source: "missing",
        };
      }

      if (result.close_price && result.price_date) {
        await supabase.from("underlying_price_history").upsert({
          ticker: request.ticker,
          requested_date: request.date,
          price_date: result.price_date,
          close_price: result.close_price,
          source: "yahoo",
          updated_at: new Date().toISOString(),
        }, { onConflict: "ticker,requested_date" });
      }
      return result;
    };

    // Concorrenza limitata: evita sia il timeout di 50 fetch sequenziali sia
    // una raffica eccessiva verso il provider storico.
    const results: PriceResult[] = [];
    for (let index = 0; index < requests.length; index += 8) {
      const batch = requests.slice(index, index + 8);
      results.push(...await Promise.all(batch.map(resolveRequest)));
    }

    return new Response(JSON.stringify({ prices: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Errore sconosciuto" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
