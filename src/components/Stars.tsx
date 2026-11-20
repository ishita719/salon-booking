/** Read-only star rating, e.g. ★★★★☆ */
export default function Stars({ rating, size = "1rem" }: { rating: number; size?: string }) {
  const r = Math.round(rating);
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= r ? undefined : "off"}>★</span>
      ))}
    </span>
  );
}
