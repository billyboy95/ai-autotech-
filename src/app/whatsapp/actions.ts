"use server";

import { revalidatePath } from "next/cache";
import { patchConversation } from "@/lib/whatsapp/store";

export async function resumeBot(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await patchConversation(id, { bot_paused_until: null, needs_attention: false });
  revalidatePath("/whatsapp");
  revalidatePath(`/whatsapp/${id}`);
}

export async function pauseBot(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await patchConversation(id, { bot_paused_until: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(), handover_reason: "Paused from CRM" });
  revalidatePath("/whatsapp");
  revalidatePath(`/whatsapp/${id}`);
}

export async function clearAttention(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await patchConversation(id, { needs_attention: false });
  revalidatePath("/whatsapp");
}
