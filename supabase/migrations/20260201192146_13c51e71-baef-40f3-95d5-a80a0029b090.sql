-- Invalidate ETF cache entries that have empty sector_allocations
-- This forces re-scraping with the new fallback logic
UPDATE etf_allocations 
SET last_fetched_at = '2020-01-01T00:00:00Z'
WHERE sector_allocations IS NULL 
   OR sector_allocations = '{}'::jsonb 
   OR sector_allocations = 'null'::jsonb;