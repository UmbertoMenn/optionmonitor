import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize name for matching (same logic as other edge functions)
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bINC\b/g, '')
    .replace(/\bCORP\b/g, '')
    .replace(/\bLTD\b/g, '')
    .replace(/\bLLC\b/g, '')
    .replace(/\bPLC\b/g, '')
    .replace(/\bCO\b/g, '')
    .replace(/\bTHE\b/g, '')
    .replace(/\bADR\b/g, '')
    .replace(/\bSPA\b/g, '')
    .replace(/^AZ\.\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build OCC symbol from option data
// Alpaca format: TICKER + YYMMDD + C/P + Strike*1000 (8 chars) - NO SPACES
// Regex required by Alpaca: ^[A-Z]{1,5}\d{6,7}[CP]\d{8}$
function buildOccSymbol(
  ticker: string,
  expiryDate: string, // YYYY-MM-DD
  optionType: string, // 'call' or 'put'
  strikePrice: number
): string {
  // Ticker uppercase, NO padding (1-5 chars)
  const cleanTicker = ticker.toUpperCase().trim();
  
  // Date in YYMMDD format
  const [year, month, day] = expiryDate.split('-');
  const dateStr = year.slice(-2) + month + day;
  
  // Option type: C for call, P for put
  const typeChar = optionType.toLowerCase() === 'call' ? 'C' : 'P';
  
  // Strike * 1000, padded to 8 characters with leading zeros
  const strikeInt = Math.round(strikePrice * 1000);
  const strikeStr = strikeInt.toString().padStart(8, '0');
  
  return `${cleanTicker}${dateStr}${typeChar}${strikeStr}`;
}

// Split array into chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Rate limiter state
interface RateLimiter {
  callsThisMinute: number;
  minuteStart: number;
}

// Fetch quotes from Alpaca with rate limiting
async function fetchAlpacaQuotes(
  symbols: string[],
  apiKey: string,
  apiSecret: string,
  rateLimiter: RateLimiter
): Promise<Record<string, number>> {
  // Check rate limit (max 200 calls/minute, we use 190 as safety margin)
  const now = Date.now();
  if (now - rateLimiter.minuteStart >= 60000) {
    // Reset counter every minute
    rateLimiter.callsThisMinute = 0;
    rateLimiter.minuteStart = now;
  }
  
  if (rateLimiter.callsThisMinute >= 190) {
    // Wait for the rest of the minute
    const waitTime = 60000 - (now - rateLimiter.minuteStart) + 1000;
    console.log(`Rate limit approaching, waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    rateLimiter.callsThisMinute = 0;
    rateLimiter.minuteStart = Date.now();
  }
  
  const url = new URL('https://data.alpaca.markets/v1beta1/options/quotes/latest');
  url.searchParams.set('symbols', symbols.join(','));
  url.searchParams.set('feed', 'indicative'); // Free tier (15 min delay)
  
  console.log(`Fetching quotes for ${symbols.length} symbols from Alpaca...`);
  
  const response = await fetch(url.toString(), {
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  });
  
  rateLimiter.callsThisMinute++;
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Alpaca API error: ${response.status} - ${errorText}`);
    throw new Error(`Alpaca API error: ${response.status}`);
  }
  
  const data = await response.json();
  const results: Record<string, number> = {};
  
  // Extract mid-price from each quote
  for (const [symbol, quote] of Object.entries(data.quotes || {})) {
    const q = quote as { bp?: number; ap?: number };
    const bid = q.bp || 0; // Bid price
    const ask = q.ap || 0; // Ask price
    
    let price = 0;
    if (bid > 0 && ask > 0) {
      price = (bid + ask) / 2; // Mid price
    } else if (ask > 0) {
      price = ask;
    } else if (bid > 0) {
      price = bid;
    }
    
    if (price > 0) {
      results[symbol] = price;
    }
  }
  
  console.log(`Got ${Object.keys(results).length} valid quotes from Alpaca`);
  return results;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    // Get secrets
    const ALPACA_API_KEY = Deno.env.get('ALPACA_API_KEY');
    const ALPACA_API_SECRET = Deno.env.get('ALPACA_API_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
      throw new Error('Missing Alpaca API credentials');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch all derivative positions with required fields
    console.log('Fetching derivative positions...');
    const { data: options, error: optionsError } = await supabase
      .from('positions')
      .select('id, underlying, strike_price, expiry_date, option_type')
      .eq('asset_type', 'derivative')
      .not('expiry_date', 'is', null)
      .not('strike_price', 'is', null)
      .not('option_type', 'is', null);

    if (optionsError) {
      throw new Error(`Failed to fetch positions: ${optionsError.message}`);
    }

    if (!options || options.length === 0) {
      console.log('No derivative positions found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No derivative positions to update',
        updated: 0,
        failed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter out expired options
    const today = new Date().toISOString().split('T')[0];
    const activeOptions = options.filter(o => o.expiry_date >= today);
    console.log(`Found ${options.length} derivatives, ${activeOptions.length} active (not expired)`);

    if (activeOptions.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All options are expired',
        updated: 0,
        failed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get all underlying -> ticker mappings
    const uniqueUnderlyings = [...new Set(activeOptions.map(o => o.underlying).filter(Boolean))];
    console.log(`Resolving tickers for ${uniqueUnderlyings.length} unique underlyings...`);

    // Fetch all mappings at once for efficiency
    const { data: allMappings } = await supabase
      .from('underlying_mappings')
      .select('underlying, ticker');

    // Build lookup maps (both exact and normalized)
    const exactMap: Record<string, string> = {};
    const normalizedMap: Record<string, string> = {};
    
    if (allMappings) {
      for (const m of allMappings) {
        exactMap[m.underlying] = m.ticker;
        const normalizedKey = normalizeName(m.underlying);
        if (!normalizedMap[normalizedKey]) {
          normalizedMap[normalizedKey] = m.ticker;
        }
      }
    }

    // Resolve ticker for each underlying
    const underlyingToTicker: Record<string, string> = {};
    for (const underlying of uniqueUnderlyings) {
      // Try exact match first
      if (exactMap[underlying]) {
        underlyingToTicker[underlying] = exactMap[underlying];
      } else {
        // Try normalized match
        const normalized = normalizeName(underlying);
        if (normalizedMap[normalized]) {
          underlyingToTicker[underlying] = normalizedMap[normalized];
        }
      }
    }

    console.log(`Resolved ${Object.keys(underlyingToTicker).length}/${uniqueUnderlyings.length} tickers`);

    // 3. Build OCC symbols and map to position IDs
    const symbolToPositionIds: Record<string, string[]> = {};
    const positionIdToSymbol: Record<string, string> = {};
    let skippedNoTicker = 0;

    for (const opt of activeOptions) {
      const ticker = underlyingToTicker[opt.underlying];
      if (!ticker) {
        console.warn(`No ticker mapping for underlying: ${opt.underlying}`);
        skippedNoTicker++;
        continue;
      }

      const symbol = buildOccSymbol(
        ticker,
        opt.expiry_date,
        opt.option_type,
        opt.strike_price
      );

      if (!symbolToPositionIds[symbol]) {
        symbolToPositionIds[symbol] = [];
      }
      symbolToPositionIds[symbol].push(opt.id);
      positionIdToSymbol[opt.id] = symbol;
    }

    const allSymbols = Object.keys(symbolToPositionIds);
    console.log(`Built ${allSymbols.length} unique OCC symbols, skipped ${skippedNoTicker} (no ticker)`);

    if (allSymbols.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No symbols to fetch (missing ticker mappings)',
        updated: 0,
        failed: skippedNoTicker 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Batch API calls (max 100 symbols per call)
    const batches = chunkArray(allSymbols, 100);
    console.log(`Processing ${batches.length} batches...`);

    const rateLimiter: RateLimiter = {
      callsThisMinute: 0,
      minuteStart: Date.now(),
    };

    const allQuotes: Record<string, number> = {};
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} symbols)`);
      
      try {
        const quotes = await fetchAlpacaQuotes(batch, ALPACA_API_KEY, ALPACA_API_SECRET, rateLimiter);
        Object.assign(allQuotes, quotes);
      } catch (err) {
        console.error(`Batch ${i + 1} failed:`, err);
        // Continue with other batches
      }
    }

    console.log(`Total quotes received: ${Object.keys(allQuotes).length}/${allSymbols.length}`);

    // 5. Update positions with new prices
    let updated = 0;
    let failed = 0;

    for (const [symbol, price] of Object.entries(allQuotes)) {
      const positionIds = symbolToPositionIds[symbol];
      if (!positionIds) continue;

      for (const posId of positionIds) {
        const { error: updateError } = await supabase
          .from('positions')
          .update({ 
            current_price: price,
            updated_at: new Date().toISOString()
          })
          .eq('id', posId);

        if (updateError) {
          console.error(`Failed to update position ${posId}:`, updateError.message);
          failed++;
        } else {
          updated++;
        }
      }
    }

    // Count symbols without quotes
    const symbolsWithoutQuotes = allSymbols.filter(s => !allQuotes[s]);
    failed += symbolsWithoutQuotes.length;
    
    if (symbolsWithoutQuotes.length > 0) {
      console.log(`Symbols without quotes (${symbolsWithoutQuotes.length}):`, symbolsWithoutQuotes.slice(0, 10));
    }

    const duration = Date.now() - startTime;
    console.log(`Completed in ${duration}ms: ${updated} updated, ${failed} failed, ${skippedNoTicker} skipped (no ticker)`);

    return new Response(JSON.stringify({ 
      success: true,
      updated,
      failed,
      skippedNoTicker,
      totalSymbols: allSymbols.length,
      quotesReceived: Object.keys(allQuotes).length,
      durationMs: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-option-prices-cron:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
