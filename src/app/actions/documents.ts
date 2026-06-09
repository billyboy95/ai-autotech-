"use server";

import { revalidatePath } from "next/cache";
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

  const supabase = await createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return { ok: false, message: "Join or create an organization before uploading documents." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${organizationId}/${Date.now()}-${safeName}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("documents")
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
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/command-centre");
  return { ok: true, message: "Document uploaded." };
}
