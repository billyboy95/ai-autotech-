import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderBusinessPdf } from "@/lib/pdf";
import { formatCurrency } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let invoice = {
    invoice_number: "INV-DEMO-001",
    status: "Draft",
    total: 18600,
    due_date: new Date().toISOString(),
  };

  if (id !== "demo" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("invoices")
      .select("invoice_number, status, total, due_date")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      invoice = data;
    }
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

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="invoice-${id}.pdf"`,
    },
  });
}
