-- Offers had no status/provenance tracking; strategy had nowhere to carry a
-- confirmed-with-caveats fact that doesn't fit a single structured field.
-- Schema only — no client data here. Idempotent: safe to re-run.
alter table client_marketing_strategy add column if not exists verified_notes text;

alter table client_offer_history add column if not exists status text not null default 'planned';
alter table client_offer_history drop constraint if exists client_offer_history_status_check;
alter table client_offer_history add constraint client_offer_history_status_check
  check (status in ('planned', 'approved', 'live', 'completed', 'paused'));
alter table client_offer_history add column if not exists source_url text;
alter table client_offer_history add column if not exists source_date date;
