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
  let foundInvoice = id === "demo";
  let invoice = {
    organization_id: null as string | null,
    invoice_number: "INV-DEMO-001",
    status: "Draft",
    total: 18600,
    due_date: new Date().toISOString(),
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
      .from("invoices")
      .select("organization_id, invoice_number, status, total, due_date, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      foundInvoice = true;
      invoice = data;
    }
  }

  if (!foundInvoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const bytes = await renderBusinessPdf({
    title: "Invoice",
    subtitle: invoice.invoice_number,
    rows: [
      ["Invoice ID", id],
      ["Status", invoice.status],
      ["Due date", invoice.due_date ? new Intl.DateTimeFormat("en-ZA").format(new Date(invoice.due_date)) : "Not set"],
      ["Issued by", "AI AutoTech"],
    ],
    total: formatCurrency(Number(invoice.total ?? 0)),
  });

  if (id !== "demo" && invoice.organization_id) {
    await persistGeneratedPdf({
      recordType: "invoice",
      recordId: id,
      title: `${invoice.invoice_number} PDF`,
      bytes,
      sourceUpdatedAt: invoice.updated_at,
    });
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="invoice-${id}.pdf"`,
    },
  });
}
