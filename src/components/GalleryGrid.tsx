import { categoryPhoto } from "@/lib/photos";

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  description: string;
  hasImage: boolean;
}

/** "Our work" tiles: the owner's photo if uploaded, otherwise a photo for that category. */
export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <div className="gallery-grid">
      {items.map((g) => (
        <figure key={g.id} className="g-tile" style={{ margin: 0 }}>
          {g.hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/gallery/${g.id}/image`} alt={g.title} loading="lazy" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={categoryPhoto(g.category, 600).src} alt={categoryPhoto(g.category).alt} loading="lazy" />
          )}
          <figcaption className="g-cap">
            <strong>{g.title}</strong>
            <span>{g.category}{g.description ? ` · ${g.description}` : ""}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
