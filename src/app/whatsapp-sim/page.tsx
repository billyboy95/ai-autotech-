import type { Metadata } from "next";
import { WhatsappSimulator } from "@/components/whatsapp-simulator";

export const metadata: Metadata = {
  title: "WhatsApp bot simulator",
  robots: { index: false, follow: false, nocache: true },
};

export default function WhatsappSimPage() {
  return <WhatsappSimulator />;
}
