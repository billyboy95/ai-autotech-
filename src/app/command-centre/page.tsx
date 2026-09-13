import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommandCentreDashboard } from "@/components/command-centre-dashboard";
import { getDashboardData } from "@/lib/dashboard-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Command Centre",
  description: "Tenant-aware AI AutoTech command centre.",
};

export default async function CommandCentrePage() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
  }

  const data = await getDashboardData();
  return <CommandCentreDashboard data={data} />;
}
