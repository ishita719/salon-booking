import type { Metadata } from "next";
import ClientAuth from "@/components/ClientAuth";

export const metadata: Metadata = { title: "Client login" };

export default function LoginPage() {
  return <ClientAuth mode="login" />;
}
