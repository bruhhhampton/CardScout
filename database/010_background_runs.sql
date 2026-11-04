-- CardScout: AI drafts run in the background (4 Nov 2026).
-- Adds a "running" status, so staff can leave the page while the AI works.
-- Until this is run, CardScout waits for the AI as before.
alter table public.agent_runs drop constraint if exists agent_runs_status_check;
alter table public.agent_runs
  add constraint agent_runs_status_check check (status in ('running', 'completed', 'failed'));
