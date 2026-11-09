import { readPhoto } from '@/lib/photos';

export const dynamic = 'force-dynamic';

// Shows an offer's card photo inside the app. The storage bucket itself stays private.
export async function GET(_request, { params }) {
  const { id } = await params;
  const photo = await readPhoto(id);
  if (!photo) return new Response('No photo', { status: 404 });
  return new Response(photo.bytes, {
    headers: { 'Content-Type': photo.type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  });
}
