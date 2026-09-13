import { NextResponse } from "next/server";
import { getFeatureGate } from "@/lib/billing";
import { persistGeneratedPdf } from "@/lib/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderBusinessPdf } from "@/lib/pdf";
import { formatCurrency } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let foundProposal = id === "demo";
  let proposal = {
    organization_id: null as string | null,
    title: "AI AutoTech Growth Automation Proposal",
    status: "Draft",
    total: 24500,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (id !== "demo") {
    const gate = await getFeatureGate("pdfs");
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason ?? "PDF generation is unavailable." }, { status: 403 });
    }
  }

  if (id !== "demo" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("proposals")
      .select("organization_id, title, status, total, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      foundProposal = true;
      proposal = data;
    }
  }

  if (!foundProposal) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
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

  if (id !== "demo" && proposal.organization_id) {
    await persistGeneratedPdf({
      recordType: "proposal",
      recordId: id,
      title: `${proposal.title} PDF`,
      bytes,
      sourceUpdatedAt: proposal.updated_at,
    });
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="proposal-${id}.pdf"`,
    },
  });
}
