"use server";

import { revalidatePath } from "next/cache";
import { getFeatureGate } from "@/lib/billing";
import {
  buildDocumentStoragePath,
  DOCUMENT_BUCKET,
  sanitizeFileName,
  validateDocumentUpload,
} from "@/lib/documents";
import { getCurrentOrganizationId } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UploadActionState = {
  ok: boolean;
  message: string;
};

export async function uploadDocument(
  _state: UploadActionState,
  formData: FormData,
): Promise<UploadActionState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, message: "Add Supabase environment variables before uploading documents." };
  }

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();

  if (!(file instanceof File) || file.size === 0 || !title) {
    return { ok: false, message: "Choose a file and add a document title." };
  }

  const validationMessage = validateDocumentUpload(file);
  if (validationMessage) {
    return { ok: false, message: validationMessage };
  }

  const supabase = await createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return { ok: false, message: "Join or create an organization before uploading documents." };
  }

  const gate = await getFeatureGate("documents");
  if (!gate.allowed) {
    return { ok: false, message: gate.reason ?? "Document uploads are unavailable." };
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = buildDocumentStoragePath({
    organizationId,
    folder: "uploads",
    fileName: `${Date.now()}-${safeName}`,
  });
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { error } = await supabase.from("documents").insert({
    title,
    storage_path: storagePath,
    client_visible: formData.get("client_visible") === "on",
    organization_id: organizationId,
    file_name: safeName,
    mime_type: file.type || "application/octet-stream",
    file_size_bytes: file.size,
    bucket_name: DOCUMENT_BUCKET,
    record_type: "upload",
    version_number: 1,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/command-centre");
  return { ok: true, message: "Document uploaded." };
}

export async function deleteDocument(
  _state: UploadActionState,
  formData: FormData,
): Promise<UploadActionState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, message: "Add Supabase environment variables before managing documents." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { ok: false, message: "Choose a document to remove." };
  }

  const gate = await getFeatureGate("documents");
  if (!gate.allowed) {
    return { ok: false, message: gate.reason ?? "Document removal is unavailable." };
  }

  const supabase = await createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return { ok: false, message: "Join or create an organization before managing documents." };
  }

  const { data, error: readError } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: readError.message };
  }

  if (!data) {
    return { ok: false, message: "Document not found." };
  }

  const { error: storageError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([data.storage_path]);
  if (storageError) {
    return { ok: false, message: storageError.message };
  }

  const { error } = await supabase.from("documents").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) {
    await supabase
      .from("documents")
      .update({
        status: "Delete cleanup required",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return { ok: false, message: `${error.message}. The file was removed, but the document record was preserved for cleanup.` };
  }

  revalidatePath("/command-centre");
  return { ok: true, message: "Document removed." };
}
