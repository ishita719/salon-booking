// Public content queries shared by pages.

import { asc, desc, sql } from "drizzle-orm";
import { DB, schema } from "@/db";

export async function galleryItems(db: DB, limit = 60) {
  const g = schema.gallery;
  const rows = await db
    .select({ id: g.id, title: g.title, category: g.category, description: g.description, hasImage: sql<number>`(${g.image} IS NOT NULL)` })
    .from(g)
    .orderBy(asc(g.sort), desc(g.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, hasImage: !!r.hasImage }));
}

export const stepsOf = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
