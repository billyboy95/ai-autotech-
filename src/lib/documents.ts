import { getCurrentOrganizationId } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const DOCUMENT_BUCKET = "documents";
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type StoredDocument = {
  id: string;
  title: string;
  storage_path: string;
  client_visible: boolean;
  created_at: string;
  mime_type: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  record_type: string | null;
  record_id: string | null;
  version_number: number | null;
};

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function buildDocumentStoragePath({
  organizationId,
  fileName,
  folder,
}: {
  organizationId: string;
  fileName: string;
  folder: string;
}) {
  return `org/${organizationId}/${folder}/${fileName}`;
}

export function validateDocumentUpload(file: File) {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
    return "Upload a PDF, DOCX, PNG, JPG, WEBP, or TXT document.";
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return "Upload a document smaller than 10 MB.";
  }

  return null;
}

export async function listRecentDocuments(limit = 8) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("documents")
    .select(
      "id, title, storage_path, client_visible, created_at, mime_type, file_name, file_size_bytes, record_type, record_id, version_number",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as StoredDocument[];
}

export async function persistGeneratedPdf({
  recordType,
  recordId,
  title,
  bytes,
}: {
  recordType: "proposal" | "invoice";
  recordId: string;
  title: string;
  bytes: Uint8Array<ArrayBufferLike>;
}) {
  const supabase = await createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return null;
  }

  const { data: latestDocument } = await supabase
    .from("documents")
    .select("version_number")
    .eq("organization_id", organizationId)
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = Number(latestDocument?.version_number ?? 0) + 1;
  const fileName = `${recordType}-${recordId}-v${versionNumber}.pdf`;
  const storagePath = buildDocumentStoragePath({
    organizationId,
    folder: `generated/${recordType}s/${recordId}`,
    fileName,
  });

  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      title,
      storage_path: storagePath,
      organization_id: organizationId,
      file_name: fileName,
      mime_type: "application/pdf",
      file_size_bytes: bytes.byteLength,
      record_type: recordType,
      record_id: recordId,
      version_number: versionNumber,
      status: "Generated",
    })
    .select("id, title, storage_path, client_visible, created_at, mime_type, file_name, file_size_bytes, record_type, record_id, version_number")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as StoredDocument | null) ?? null;
}
