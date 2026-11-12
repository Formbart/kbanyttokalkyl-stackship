import { initialState, type AppState } from "./types";
import { migrateState } from "./calc";
import {
  deleteCalculationFn,
  getShareTokenFn,
  listCalculationsFn,
  loadCalculationFn,
  loadSharedCalculationFn,
  renameCalculationFn,
  saveCalculationFn,
  stopSharingFn,
} from "./saved.functions";

export interface SavedCalculation {
  id: string;
  title: string;
  updated_at: string;
}

export const PENDING_CALCULATION_STORAGE_KEY = "nyttokalkyl:pending-calculation";

export async function listSavedCalculations(): Promise<SavedCalculation[]> {
  return listCalculationsFn();
}

export async function saveCalculation(
  state: AppState,
  title: string,
  id?: string | null,
): Promise<string> {
  return saveCalculationFn({ data: { id: id ?? null, title, state } });
}

export async function getShareToken(id: string): Promise<string> {
  return getShareTokenFn({ data: { id } });
}

export async function stopSharing(id: string): Promise<void> {
  await stopSharingFn({ data: { id } });
}

export async function loadSharedCalculation(
  token: string,
): Promise<{ title: string; state: AppState } | null> {
  const row = await loadSharedCalculationFn({ data: { token } });
  if (!row) return null;
  return parseCalculation(row.title, JSON.parse(row.dataJson));
}

export async function loadCalculation(id: string): Promise<{ title: string; state: AppState }> {
  const row = await loadCalculationFn({ data: { id } });
  return parseCalculation(row.title, JSON.parse(row.dataJson));
}

function parseCalculation(title: string, raw: unknown): { title: string; state: AppState } {
  const parsed = (raw ?? {}) as Partial<AppState>;
  const base = initialState();
  return {
    title,
    state: migrateState({
      project: { ...base.project, ...parsed.project, name: title },
      costToday: { ...base.costToday, ...parsed.costToday },
      costChange: { ...base.costChange, ...parsed.costChange },
      qualRatings: parsed.qualRatings ?? {},
      reallocationInGraph: parsed.reallocationInGraph ?? false,
      followUp: parsed.followUp ?? {},
      surveys: parsed.surveys ?? {},
      surveyResults: parsed.surveyResults ?? {},
    }),
  };
}

export async function renameCalculation(id: string, title: string): Promise<void> {
  await renameCalculationFn({ data: { id, title } });
}

export async function deleteCalculation(id: string): Promise<void> {
  await deleteCalculationFn({ data: { id } });
}
