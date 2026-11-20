import type { Metadata } from "next";
import ClientAuth from "@/components/ClientAuth";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return <ClientAuth mode="register" />;
}
