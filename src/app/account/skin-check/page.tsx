import type { Metadata } from "next";
import SkinCheck from "@/components/SkinCheck";
import { getDb } from "@/db";
import { pageUser } from "@/lib/auth";
import { getRecommendations } from "@/lib/recommend";

export const metadata: Metadata = { title: "Skin & hair check" };
export const dynamic = "force-dynamic";

export default async function SkinCheckPage() {
  const user = await pageUser(["CUSTOMER"]);
  const recs = await getRecommendations(getDb(), user.id);
  return (
    <div className="container section">
      <SkinCheck initial={recs} />
    </div>
  );
}
