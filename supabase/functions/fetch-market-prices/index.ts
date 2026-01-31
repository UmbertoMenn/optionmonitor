import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceData {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  lastUpdated: string;
  source: 'tradier' | 'yahoo' | 'error';
  error?: string;
}

interface RequestBody {
  tickers: string[];       // Stock/ETF tickers: ["AAPL", "MSFT"]
  options: OptionRequest[]; // Options with full details for OCC conversion
}

interface OptionRequest {
  underlying: string;
  expiry: string;      // ISO date string "2025-09-15"
  optionType: 'call' | 'put';
  strike: number;
  originalId: string;  // Position ID for mapping back
}

// Convert to OCC standard format: AAPL230915C00187500
function toOCCSymbol(underlying: string, expiry: string, optionType: 'call' | 'put', strike: number): string {
  const date = new Date(expiry);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const type = optionType === 'call' ? 'C' : 'P';
  const strikeFormatted = Math.round(strike * 1000).toString().padStart(8, '0');
  return `${underlying.toUpperCase()}${yy}${mm}${dd}${type}${strikeFormatted}`;
}

// Fetch stock/ETF prices from Yahoo Finance (unofficial API)
async function fetchYahooPrices(tickers: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>();
  
  if (tickers.length === 0) return results;
  
  try {
    // Yahoo Finance quote endpoint (batch up to 100)
    const symbols = tickers.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.error(`Yahoo Finance error: ${response.status}`);
      // Return error entries for all tickers
      for (const ticker of tickers) {
        results.set(ticker, {
          symbol: ticker,
          price: null,
          change: null,
          changePct: null,
          bid: null,
          ask: null,
          volume: null,
          lastUpdated: new Date().toISOString(),
          source: 'error',
          error: `Yahoo API returned ${response.status}`,
        });
      }
      return results;
    }
    
    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];
    
    for (const quote of quotes) {
      results.set(quote.symbol, {
        symbol: quote.symbol,
        price: quote.regularMarketPrice ?? null,
        change: quote.regularMarketChange ?? null,
        changePct: quote.regularMarketChangePercent ?? null,
        bid: quote.bid ?? null,
        ask: quote.ask ?? null,
        volume: quote.regularMarketVolume ?? null,
        lastUpdated: new Date().toISOString(),
        source: 'yahoo',
      });
    }
    
    // Mark missing tickers as not found
    for (const ticker of tickers) {
      if (!results.has(ticker)) {
        results.set(ticker, {
          symbol: ticker,
          price: null,
          change: null,
          changePct: null,
          bid: null,
          ask: null,
          volume: null,
          lastUpdated: new Date().toISOString(),
          source: 'error',
          error: 'Symbol not found',
        });
      }
    }
  } catch (error) {
    console.error('Yahoo Finance fetch error:', error);
    for (const ticker of tickers) {
      results.set(ticker, {
        symbol: ticker,
        price: null,
        change: null,
        changePct: null,
        bid: null,
        ask: null,
        volume: null,
        lastUpdated: new Date().toISOString(),
        source: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return results;
}

// Fetch option prices from Tradier
async function fetchTradierOptionPrices(
  options: OptionRequest[],
  apiKey: string
): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>();
  
  if (options.length === 0 || !apiKey) return results;
  
  try {
    // Convert options to OCC symbols
    const occSymbols = options.map(opt => ({
      occ: toOCCSymbol(opt.underlying, opt.expiry, opt.optionType, opt.strike),
      originalId: opt.originalId,
      original: opt,
    }));
    
    // Tradier options quotes endpoint
    const symbols = occSymbols.map(o => o.occ).join(',');
    const url = `https://api.tradier.com/v1/markets/quotes?symbols=${encodeURIComponent(symbols)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Tradier API error: ${response.status} - ${errorText}`);
      
      // Return error entries for all options
      for (const opt of occSymbols) {
        results.set(opt.originalId, {
          symbol: opt.occ,
          price: null,
          change: null,
          changePct: null,
          bid: null,
          ask: null,
          volume: null,
          lastUpdated: new Date().toISOString(),
          source: 'error',
          error: `Tradier API returned ${response.status}`,
        });
      }
      return results;
    }
    
    const data = await response.json();
    
    // Tradier returns quotes in various formats depending on count
    let quotes = data?.quotes?.quote || [];
    if (!Array.isArray(quotes)) {
      quotes = quotes ? [quotes] : [];
    }
    
    // Create a map from OCC symbol to quote
    const quoteMap = new Map<string, any>();
    for (const quote of quotes) {
      quoteMap.set(quote.symbol, quote);
    }
    
    // Map results back to original IDs
    for (const opt of occSymbols) {
      const quote = quoteMap.get(opt.occ);
      
      if (quote) {
        results.set(opt.originalId, {
          symbol: opt.occ,
          price: quote.last ?? quote.close ?? null,
          change: quote.change ?? null,
          changePct: quote.change_percentage ?? null,
          bid: quote.bid ?? null,
          ask: quote.ask ?? null,
          volume: quote.volume ?? null,
          lastUpdated: new Date().toISOString(),
          source: 'tradier',
        });
      } else {
        results.set(opt.originalId, {
          symbol: opt.occ,
          price: null,
          change: null,
          changePct: null,
          bid: null,
          ask: null,
          volume: null,
          lastUpdated: new Date().toISOString(),
          source: 'error',
          error: 'Option not found in Tradier',
        });
      }
    }
  } catch (error) {
    console.error('Tradier fetch error:', error);
    for (const opt of options) {
      results.set(opt.originalId, {
        symbol: opt.underlying,
        price: null,
        change: null,
        changePct: null,
        bid: null,
        ask: null,
        volume: null,
        lastUpdated: new Date().toISOString(),
        source: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return results;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { tickers = [], options = [] }: RequestBody = await req.json();
    
    console.log(`Fetching prices for ${tickers.length} stocks and ${options.length} options`);
    
    // Get Tradier API key from environment
    const tradierApiKey = Deno.env.get('TRADIER_API_KEY') || '';
    
    // Fetch both in parallel
    const [stockPrices, optionPrices] = await Promise.all([
      fetchYahooPrices(tickers),
      fetchTradierOptionPrices(options, tradierApiKey),
    ]);
    
    // Combine results
    const result = {
      stocks: Object.fromEntries(stockPrices),
      options: Object.fromEntries(optionPrices),
      fetchedAt: new Date().toISOString(),
    };
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-market-prices:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stocks: {},
        options: {},
        fetchedAt: new Date().toISOString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
