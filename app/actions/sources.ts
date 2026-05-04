"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addSource(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required" };

  const { error } = await supabase.from("sources").insert({ user_id: user.id, name });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return null;
}

export async function deleteSource(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("sources").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/settings");
}
