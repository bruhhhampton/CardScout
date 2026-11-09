// The card's photo, or a grey card-shaped spot when there is none yet.
const ICON = (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" />
  </svg>
);

export default function CardThumb({ offer, big = false }) {
  const src = offer.photo_path ? `/photo/${offer.id}?v=${encodeURIComponent(offer.photo_path.split('/').pop())}` : null;
  if (!src) return big ? <span className="thumb big" role="img" aria-label="No photo of this card yet">{ICON}</span> : <span className="thumb" aria-hidden="true">{ICON}</span>;
  if (big) {
    return (
      <a href={src} target="_blank" rel="noopener" className="thumb big has-photo" aria-label="Open the card photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Photo of the ${offer.player} card`} />
      </a>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="thumb has-photo" aria-hidden="true"><img src={src} alt="" loading="lazy" /></span>;
}
