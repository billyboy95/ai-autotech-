import { NextResponse } from "next/server";
import { DOCUMENT_BUCKET, sanitizeFileName } from "@/lib/documents";
import { getCurrentOrganizationId } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return NextResponse.json({ error: "Organization access is required." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("storage_path, bucket_name, file_name")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(data.bucket_name || DOCUMENT_BUCKET)
    .download(data.storage_path);

  if (downloadError || !file) {
    return NextResponse.json({ error: downloadError?.message ?? "Could not download document." }, { status: 400 });
  }

  const fileName = sanitizeFileName(data.file_name || data.storage_path.split("/").pop() || "document");

  return new NextResponse(file, {
    headers: {
      "content-type": file.type || "application/octet-stream",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
