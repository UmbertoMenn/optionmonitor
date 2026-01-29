-- Add deposits and average_balance columns to portfolios table
ALTER TABLE public.portfolios 
ADD COLUMN deposits numeric DEFAULT 0,
ADD COLUMN average_balance numeric DEFAULT 0;