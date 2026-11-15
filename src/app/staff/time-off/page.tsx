import type { Metadata } from "next";
import TimeOffManager from "@/components/TimeOffManager";
import { pageUser } from "@/lib/auth";
import { salonNow } from "@/lib/time";

export const metadata: Metadata = { title: "Time off" };
export const dynamic = "force-dynamic";

export default async function StaffTimeOffPage() {
  await pageUser(["STAFF"]);
  return <TimeOffManager minDate={salonNow().date} />;
}
