-- CardScout: card photos (10 Nov 2026). Run once in the Supabase SQL editor.
-- The front photo staff take when they scan a card is kept with the offer, so staff and the
-- owner can see the actual card. Photos sit in a private storage bucket: only the CardScout
-- server can read them, and it shows them inside the app.
alter table public.card_offers add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-photos', 'card-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';
