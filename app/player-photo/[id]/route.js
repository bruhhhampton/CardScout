import { readPlayerPhoto } from '@/lib/player-photos';

export const dynamic = 'force-dynamic';

// Shows a player's photo inside the app. The storage bucket itself stays private.
export async function GET(_request, { params }) {
  const { id } = await params;
  const photo = await readPlayerPhoto(id);
  if (!photo) return new Response('No photo', { status: 404 });
  return new Response(photo.bytes, {
    headers: { 'Content-Type': photo.type, 'Cache-Control': 'private, max-age=604800', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  });
}
