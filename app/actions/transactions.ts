"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TransactionActionState = { error: string } | null;

export async function addTransaction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const quantity = parseFloat(formData.get("quantity") as string);
  const price = parseFloat(formData.get("price") as string);

  if (isNaN(quantity) || quantity < 0) return { error: "Invalid quantity" };
  if (isNaN(price) || price < 0) return { error: "Invalid price" };

  const skipDateUpdate = formData.get("skip_date_update") === "1";
  const analysisDateRaw = formData.get("last_analysis_date") as string;

  function parseOptionalFloat(val: FormDataEntryValue | null) {
    const n = parseFloat(val as string);
    return isNaN(n) ? null : n;
  }

  const currencyRaw = (formData.get("currency") as string) || "USD";
  const currency = currencyRaw === "EUR" ? "EUR" : "USD";

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    ticker: (formData.get("ticker") as string).trim().toUpperCase(),
    company_name: (formData.get("company_name") as string) || null,
    type: formData.get("type") as string,
    pocket: formData.get("pocket") as string,
    quantity,
    price,
    currency,
    date: formData.get("date") as string,
    source_id: (formData.get("source_id") as string) || null,
    notes: (formData.get("notes") as string) || null,
    last_analysis_date: skipDateUpdate
      ? null
      : (analysisDateRaw || new Date().toISOString().split("T")[0]),
    support_price: parseOptionalFloat(formData.get("support_price")),
    resistance_price: parseOptionalFloat(formData.get("resistance_price")),
    tp1: parseOptionalFloat(formData.get("tp1")),
    tp2: parseOptionalFloat(formData.get("tp2")),
    tp3_fair_value: parseOptionalFloat(formData.get("tp3_fair_value")),
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return null;
}

export async function updateTransaction(
  id: string,
  formData: FormData
): Promise<TransactionActionState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const quantity = parseFloat(formData.get("quantity") as string);
  const price = parseFloat(formData.get("price") as string);

  if (isNaN(quantity) || quantity < 0) return { error: "Invalid quantity" };
  if (isNaN(price) || price < 0) return { error: "Invalid price" };

  function parseOptionalFloat(val: FormDataEntryValue | null) {
    const n = parseFloat(val as string);
    return isNaN(n) ? null : n;
  }

  const currencyRaw = (formData.get("currency") as string) || "USD";
  const currency = currencyRaw === "EUR" ? "EUR" : "USD";
  const analysisDateRaw = (formData.get("last_analysis_date") as string) || null;

  const { error } = await supabase
    .from("transactions")
    .update({
      ticker: (formData.get("ticker") as string).trim().toUpperCase(),
      company_name: (formData.get("company_name") as string) || null,
      type: formData.get("type") as string,
      pocket: formData.get("pocket") as string,
      quantity,
      price,
      currency,
      date: formData.get("date") as string,
      source_id: (formData.get("source_id") as string) || null,
      notes: (formData.get("notes") as string) || null,
      last_analysis_date: analysisDateRaw || null,
      support_price: parseOptionalFloat(formData.get("support_price")),
      resistance_price: parseOptionalFloat(formData.get("resistance_price")),
      tp1: parseOptionalFloat(formData.get("tp1")),
      tp2: parseOptionalFloat(formData.get("tp2")),
      tp3_fair_value: parseOptionalFloat(formData.get("tp3_fair_value")),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return null;
}

export async function deleteTransaction(
  id: string
): Promise<TransactionActionState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/history");
  return null;
}
