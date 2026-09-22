import { supabase } from "@/integrations/supabase/client";
import { initialState, type AppState } from "./types";

export interface SavedCalculation {
  id: string;
  title: string;
  updated_at: string;
}

export async function listSavedCalculations(): Promise<SavedCalculation[]> {
  const { data, error } = await supabase
    .from("calculations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveCalculation(
  state: AppState,
  title: string,
  id?: string | null,
): Promise<string> {
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Du är inte inloggad.");

  if (id) {
    const { error } = await supabase
      .from("calculations")
      .update({ title, data: state as unknown as never })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }

  const { data, error } = await supabase
    .from("calculations")
    .insert({ user_id: userId, title, data: state as unknown as never })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function loadCalculation(id: string): Promise<{ title: string; state: AppState }> {
  const { data, error } = await supabase
    .from("calculations")
    .select("title, data")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  const parsed = (data.data ?? {}) as Partial<AppState>;
  const base = initialState();
  return {
    title: data.title,
    state: {
      project: { ...base.project, ...parsed.project },
      costToday: { ...base.costToday, ...parsed.costToday },
      costChange: { ...base.costChange, ...parsed.costChange },
      qualRatings: parsed.qualRatings ?? {},
      reallocationInGraph: parsed.reallocationInGraph ?? false,
      followUp: parsed.followUp ?? {},
      surveys: parsed.surveys ?? {},
    },
  };
}

export async function deleteCalculation(id: string): Promise<void> {
  const { error } = await supabase.from("calculations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
