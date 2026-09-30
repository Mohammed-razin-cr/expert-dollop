-- Run this in the Supabase SQL Editor BEFORE importing leads.
-- Adds two fields the import preserves from your v7 backup.
alter table public.leads add column if not exists source_detail text;
alter table public.leads add column if not exists temperature   text;
