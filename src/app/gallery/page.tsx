import type { Metadata } from "next";
import Link from "next/link";
import GalleryGrid from "@/components/GalleryGrid";
import { getDb } from "@/db";
import { galleryItems } from "@/lib/content";

export const metadata: Metadata = { title: "Our work" };
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const items = await galleryItems(getDb());
  return (
    <>
      <section className="hero" style={{ padding: "56px 0 36px" }}>
        <div className="container">
          <div className="eyebrow">Gallery</div>
          <h1>Our <span>work</span></h1>
          <p className="lead">Real results from our studio and home visits — colour, cuts, skin, nails and bridal.</p>
        </div>
      </section>
      <div className="container" style={{ paddingBottom: 40 }}>
        <GalleryGrid items={items} />
        <div className="card center" style={{ marginTop: 32 }}>
          <h3>Love what you see?</h3>
          <p className="muted">Take our free online skin &amp; hair check and we&apos;ll suggest the treatments that suit you best.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link href="/account/skin-check" className="btn">Start my skin check</Link>
            <Link href="/services" className="btn btn-outline">See services</Link>
          </div>
        </div>
      </div>
    </>
  );
}
