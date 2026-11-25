// Stock photos used around the website (free to use under the Unsplash License — https://unsplash.com/license).
// Swap these for the salon's own photos any time: the owner's uploads in Manage → Gallery always take priority there.

const unsplash = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;

export const PHOTOS = {
  heroMain: { src: unsplash("1580618672591-eb180b1a973f", 1000), alt: "A stylist blow-drying a client's hair with a round brush" },
  heroSide: { src: unsplash("1570172619644-dfd03ed5d881", 600), alt: "A client relaxing during a facial mask treatment" },
  salon: { src: unsplash("1521590832167-7bcbfaa6381f", 1600), alt: "Salon chairs facing a long mirror" },
  skincare: { src: unsplash("1580870069867-74c57ee1bb07", 900), alt: "Skincare serums arranged with pink petals" },
  tools: { src: unsplash("1595475884562-073c30d45670", 900), alt: "Hands holding brushes, scissors and a tint brush" },
};

const CATEGORY: Record<string, { id: string; alt: string }> = {
  Hair: { id: "1634449571010-02389ed0f9b0", alt: "A stylist cutting a client's hair" },
  Nails: { id: "1610992015762-45dca7fa3a85", alt: "Soft pink manicured nails" },
  Colour: { id: "1560869713-bf165a9cfac1", alt: "Glossy blonde hair colour" },
  Treatments: { id: "1562322140-8baeececf3df", alt: "A stylist finishing a smoothing hair treatment" },
  Skin: { id: "1570172619644-dfd03ed5d881", alt: "A client during a facial treatment" },
  "Bridal & Events": { id: "1523264114838-feca761983c4", alt: "A bride with a floral hair piece" },
};
const FALLBACK = { id: "1560066984-138dadb4c035", alt: "Inside a hair salon" };

/** A photo for a service category (or a general salon photo for categories the owner adds later). */
export function categoryPhoto(category: string, w = 800) {
  const p = CATEGORY[category] ?? FALLBACK;
  return { src: unsplash(p.id, w), alt: p.alt };
}
