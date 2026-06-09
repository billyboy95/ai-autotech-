import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderBusinessPdf } from "@/lib/pdf";
import { formatCurrency } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let proposal = {
    title: "AI AutoTech Growth Automation Proposal",
    status: "Draft",
    total: 24500,
    created_at: new Date().toISOString(),
  };

  if (id !== "demo" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("proposals")
      .select("title, status, total, created_at")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      proposal = data;
    }
  }

  const bytes = await renderBusinessPdf({
    title: "Proposal",
    subtitle: proposal.title,
    rows: [
      ["Proposal ID", id],
      ["Status", proposal.status],
      ["Created", new Intl.DateTimeFormat("en-ZA").format(new Date(proposal.created_at))],
      ["Prepared by", "AI AutoTech"],
    ],
    total: formatCurrency(Number(proposal.total ?? 0)),
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="proposal-${id}.pdf"`,
    },
  });
}
