import { NextResponse } from "next/server";
import { receivePayfastItn } from "@/server/webhooks/payfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const result = await receivePayfastItn(request);
  return NextResponse.json(result.body, { status: result.status });
}
