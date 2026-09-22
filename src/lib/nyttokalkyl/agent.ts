export type AgentAction =
  | "generate_full_draft"
  | "suggest_benefits"
  | "suggest_costs"
  | "assess_qualitative"
  | "review_calculation"
  | "suggest_followup"
  | "suggest_survey"
  | "chat";


export interface FactCheckMeta {
  factChecked?: boolean | undefined;
  factCheckReport?: string | undefined;
  factCheckError?: string | undefined;
}

export type AgentResult<T = unknown> =
  | ({ success: true; action: AgentAction; data: T } & FactCheckMeta)
  | { success: false; error: string };

const DEFAULT_WEBHOOK_URL =
  "https://kontakinte113355.app.n8n.cloud/webhook/nyttokalkyl-agent";

const WEBHOOK_URL =
  (import.meta.env["VITE_N8N_WEBHOOK_URL"] as string | undefined) ||
  DEFAULT_WEBHOOK_URL;

export function agentConfigured(): boolean {
  return Boolean(WEBHOOK_URL);
}

export async function callAgent<T = unknown>(
  action: AgentAction,
  context: Record<string, unknown>,
): Promise<AgentResult<T>> {
  if (!WEBHOOK_URL) {
    return {
      success: false,
      error:
        "AI-tjänsten är inte konfigurerad. Sätt miljövariabeln VITE_N8N_WEBHOOK_URL till din n8n-webhook.",
    };
  }
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, context }),
    });
    if (!res.ok) {
      return { success: false, error: `AI-tjänsten svarade ${res.status}.` };
    }
    const json = (await res.json()) as
      | ({ success?: boolean; action?: AgentAction; data?: T; error?: string } &
          FactCheckMeta)
      | T;
    if (json && typeof json === "object" && "data" in json) {
      const j = json as { success?: boolean; data?: T; error?: string } &
        FactCheckMeta;
      if (j.success === false) {
        return { success: false, error: j.error ?? "Okänt fel från AI:n." };
      }
      return {
        success: true,
        action,
        data: j.data as T,
        factChecked: j.factChecked,
        factCheckReport: j.factCheckReport,
        factCheckError: j.factCheckError,
      };
    }
    return { success: true, action, data: json as T };
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error ? e.message : "Kunde inte nå AI-tjänsten just nu.",
    };
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
