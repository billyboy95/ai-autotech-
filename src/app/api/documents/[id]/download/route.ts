import { NextResponse } from "next/server";
import { DOCUMENT_BUCKET } from "@/lib/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(data.storage_path, 60);

  if (signedUrlError || !signedUrl?.signedUrl) {
    return NextResponse.json({ error: signedUrlError?.message ?? "Could not sign document download." }, { status: 400 });
  }

  return NextResponse.redirect(signedUrl.signedUrl);
}
