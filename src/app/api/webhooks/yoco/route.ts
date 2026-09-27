import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({
    ok: true,
    sandbox: true,
    charged: false,
    provider: "yoco",
    message: "Yoco is a once-off sandbox stub. The payload was ignored and no charge was sent.",
  });
}
