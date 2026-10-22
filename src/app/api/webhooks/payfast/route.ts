import { NextResponse } from "next/server";
import { parsePayfastBody } from "@/lib/billing/signature";
import { receiveIncomeItn } from "@/server/webhooks/income-itn";
import { receivePayfastItn } from "@/server/webhooks/payfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function incomeItn(fields: Record<string, string>) {
  return fields.custom_str4 === "income" || fields.m_payment_id?.startsWith("svc_") || fields.m_payment_id?.startsWith("mem_");
}

export async function POST(request: Request) {
  const raw = await request.text();
  const { fields } = parsePayfastBody(raw);
  if (incomeItn(fields)) {
    const result = await receiveIncomeItn(raw, request.headers);
    return NextResponse.json(result.body, { status: result.status });
  }
  const replay = new Request(request.url, { method: "POST", headers: request.headers, body: raw });
  const result = await receivePayfastItn(replay);
  return NextResponse.json(result.body, { status: result.status });
}
